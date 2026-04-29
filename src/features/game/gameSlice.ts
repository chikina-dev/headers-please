import { combineReducers } from '@reduxjs/toolkit';

import { getNextDayIdForResolution } from './campaignFlow';
import { createAuditLogEntry, evaluateVerdict, findMatchingInboundEntries, getCurrentDay } from './engine';
import { getScenarioPhase } from './phases';
import { gameAuditActions, gameAuditReducer } from './gameAuditSlice';
import { gameProgressActions, gameProgressReducer } from './gameProgressSlice';
import { createDayRunRecord, createDayTransitionRecord } from './progressHistory';
import { createRunArchiveRecord } from './runArchive';
import { buildArchiveRestorePayload } from './sessionRestore';
import { gameTableActions, gameTableAdapter, gameTableReducer } from './gameTableSlice';
import { gameTableViewActions, gameTableViewReducer } from './gameTableViewSlice';
import { gameTrafficActions, gameTrafficReducer } from './gameTrafficSlice';
import { gameWorkspaceActions, gameWorkspaceReducer } from './gameWorkspaceSlice';
import {
  applyObjectivesAfterAction,
  buildDaySession,
  buildInitialTableEntries,
  buildDayHistoryEntry,
  buildSessionEventMetadata,
  createSessionCheckpointRecord,
  createEmptyActionContext,
  createActionResultRecord,
  createBackgroundFlowPacketRecord,
  createRegisteredEntryBackgroundFlow,
  createGeneratedResponsePacketRecord,
  createGeneratedScenarioResponsePacketRecord,
  createPlayerCommandRecord,
  createResolvedTurnRecord,
  createRuntimePacketRecord,
  createSessionEventRecord,
  deriveDayResolution,
  findAutoResponseTemplateForOutbound,
  getActiveRuntimePacket,
  getShiftGoalProgress,
  shouldRepeatForcedFailurePacket,
} from './runtimeSession';
import { buildSessionExportSnapshot } from './sessionAnalytics';
import type { AppThunk, RootState } from '../../app/store';
import type { AuditAction, ReferenceTab, StampId, Verdict, WorkbenchDispatchIntent } from './types';

export const gameReducer = combineReducers({
  progress: gameProgressReducer,
  workspace: gameWorkspaceReducer,
  table: gameTableReducer,
  audit: gameAuditReducer,
  tableView: gameTableViewReducer,
  traffic: gameTrafficReducer,
});

const isReadOnlyInspection = (state: RootState) =>
  state.game.progress.inspectedRunId !== null && state.game.progress.activeRunId === null;

const logAudit = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameAuditActions.appendAuditLog>) => void,
  payload: {
    dayId: string;
    runId: string | null;
    packetId: string;
    action: AuditAction;
    outcome: 'advanced' | 'blocked' | 'failed';
    message: string;
  },
) => {
  const state = getState();

  dispatch(
    gameAuditActions.appendAuditLog(
      createAuditLogEntry(
        state.game.audit.nextSequence,
        payload.dayId,
        payload.runId,
        payload.packetId,
        payload.action,
        payload.outcome,
        payload.message,
      ),
    ),
  );
};

const appendCommand = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameTrafficActions.appendCommand>) => void,
  payload: Parameters<typeof createPlayerCommandRecord>[1],
) => {
  const command = createPlayerCommandRecord(getState().game.traffic, payload);
  dispatch(gameTrafficActions.appendCommand(command));
  return command;
};

const syncWorkbenchToActivePacket = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameWorkspaceActions.focusWorkbenchPacket>) => void,
) => {
  const activePacket = getActiveRuntimePacket(getState().game.traffic);
  dispatch(
    gameWorkspaceActions.focusWorkbenchPacket({
      packetRuntimeId: activePacket?.runtimeId ?? null,
      source: activePacket?.packet.source ?? null,
      destination: activePacket?.packet.destination ?? null,
    }),
  );
};

const shelveActiveWorkbenchPacket = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameWorkspaceActions.stashWorkbenchPacket>
      | ReturnType<typeof gameTrafficActions.returnActivePacketToPending>
  ) => void,
) => {
  const activePacket = getActiveRuntimePacket(getState().game.traffic);
  const workspace = getState().game.workspace;

  if (!activePacket || workspace.document.placement !== 'workbench' || workspace.document.packetRuntimeId !== activePacket.runtimeId) {
    return null;
  }

  dispatch(gameWorkspaceActions.stashWorkbenchPacket());
  dispatch(
    gameTrafficActions.returnActivePacketToPending({
      packetId: activePacket.runtimeId,
      position: 'front',
      resetPendingAge: false,
    }),
  );
  return activePacket.runtimeId;
};

const resolveGeneratedResponseQueuePosition = (state: RootState) => {
  const queuedPackets = [...state.game.traffic.pendingPacketIds, ...state.game.traffic.upcomingPacketIds]
    .map((packetId) => state.game.traffic.entities[packetId])
    .filter((packet): packet is NonNullable<typeof packet> => packet != null);

  return queuedPackets.some(
    (packet) => packet.spawnSource === 'scenario' && packet.packet.direction === 'lanToWan',
  )
    ? 'back'
    : 'front';
};

const resolveArrivalActionForGeneratedPacket = (
  state: RootState,
  day: NonNullable<ReturnType<typeof getCurrentDay>>,
  queuePosition: 'front' | 'back',
  delayActions?: number,
) => {
  const phase = getScenarioPhase(day.phaseId);
  const baseDelay = queuePosition === 'front' ? 1 : Math.max(2, phase.arrivalsPerAction);
  return state.game.traffic.actionClock + Math.max(delayActions ?? baseDelay, 1);
};

const isWorkbenchFocusedOnPacket = (state: RootState, packetRuntimeId: string | null) =>
  state.game.workspace.draft.packetRuntimeId === packetRuntimeId;

const releaseUpcomingPacketsForDay = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameTrafficActions.releaseUpcomingPackets> | ReturnType<typeof gameTrafficActions.appendSessionEvent>) => void,
  day: ReturnType<typeof getCurrentDay>,
  actionResultId: string | null,
) => {
  if (!day) {
    return;
  }

  const phase = getScenarioPhase(day.phaseId);
  let releasedPacketIds: string[] = [];
  let attempts = 0;

  while (attempts < 8) {
    const beforePendingIds = getState().game.traffic.pendingPacketIds.slice();
    const beforePendingSet = new Set(beforePendingIds);
    const hadPendingPackets = beforePendingIds.length > 0;

    dispatch(
      gameTrafficActions.releaseUpcomingPackets({
        count: phase.arrivalsPerAction,
        position: 'back',
      }),
    );

    const trafficAfterRelease = getState().game.traffic;
    releasedPacketIds = trafficAfterRelease.pendingPacketIds.filter((packetId) => !beforePendingSet.has(packetId));

    if (releasedPacketIds.length > 0 || hadPendingPackets || trafficAfterRelease.upcomingPacketIds.length === 0) {
      break;
    }

    attempts += 1;
  }

  if (releasedPacketIds.length === 0) {
    return;
  }

  for (const packetId of releasedPacketIds) {
    const packet = getState().game.traffic.entities[packetId];

    if (!packet) {
      continue;
    }

    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'packetArrived',
          packetRuntimeId: packet.runtimeId,
          relatedEntryId: null,
          actionResultId,
          message:
            packet.packet.direction === 'lanToWan'
              ? `${packet.packet.source.host} からの新しい個包が左受取口へ届きました。`
              : `${packet.packet.source.host} からの個包が右受取口へ届きました。`,
          metadata: buildSessionEventMetadata([
            ['direction', packet.packet.direction],
            ['spawnSource', packet.spawnSource],
          ]),
        }),
      ),
    );
  }
};

const advanceLifecycleAfterProgress = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameAuditActions.appendAuditLog> | ReturnType<typeof gameTableActions.advanceTableLifecycle>) => void,
  payload: {
    dayId: string;
    runId: string | null;
    packetId: string;
    preserveEntryIds: string[];
  },
) => {
  const state = getState();
  const expiringEntries = gameTableAdapter
    .getSelectors()
    .selectAll(state.game.table)
    .filter((entry) => !payload.preserveEntryIds.includes(entry.id) && entry.remainingTurns <= 1);

  dispatch(gameTableActions.advanceTableLifecycle({ preserveEntryIds: payload.preserveEntryIds }));

  for (const entry of expiringEntries) {
    const nextState = getState();

    dispatch(
      gameAuditActions.appendAuditLog(
        createAuditLogEntry(
          nextState.game.audit.nextSequence,
          payload.dayId,
          payload.runId,
          payload.packetId,
          'TIMEOUT',
          'advanced',
          `${entry.id} は期限切れとなり、外側ポートを再利用可能にしました。`,
        ),
      ),
    );
  }

  return expiringEntries;
};

const resolveCurrentDay = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameTrafficActions.appendCheckpoint>
      | ReturnType<typeof gameProgressActions.resolveDay>
      | ReturnType<typeof gameProgressActions.completeCampaign>
  ) => void,
  day: NonNullable<ReturnType<typeof getCurrentDay>>,
  actionResultId: string | null,
  reason: 'trafficExhausted' | 'shiftGoalMet' | 'incidentLimitExceeded' | 'shiftWindowExpired',
) => {
  const resolution = deriveDayResolution(day, getState().game.traffic, reason);
  const historyEntry = buildDayHistoryEntry(day, getState().game.traffic, resolution);
  const nextDayId = getNextDayIdForResolution(day, resolution);
  const transition = createDayTransitionRecord(getState().game.progress, day, resolution, nextDayId);
  dispatch(
    gameTrafficActions.appendCheckpoint(
      createSessionCheckpointRecord(getState().game.traffic, gameTableAdapter.getSelectors().selectAll(getState().game.table), {
        reason: 'dayResolved',
        actionResultId,
        sessionEventId: getState().game.traffic.sessionEvents.at(-1)?.id ?? null,
      }),
    ),
  );
  const progressSnapshot = {
    ...getState().game.progress,
    activeRunId: historyEntry.runId,
    nextDayId,
    runHistory: getState().game.progress.runHistory.map((run) =>
      run.id === historyEntry.runId
        ? {
            ...run,
            endRngSeed: getState().game.traffic.rngSeed,
            status: resolution.kind,
            resolutionKind: resolution.kind,
            actionCount: historyEntry.actionCount,
            incidentCount: historyEntry.incidentCount,
            transitionId: transition.id,
          }
        : run,
    ),
    dayHistory: [...getState().game.progress.dayHistory, historyEntry],
    transitions: [...getState().game.progress.transitions, transition],
  };
  const exportSnapshot = buildSessionExportSnapshot(
    day,
    progressSnapshot,
    getState().game.traffic,
    getState().game.table,
    getState().game.audit.ids
      .map((auditId) => getState().game.audit.entities[auditId])
      .filter(
        (entry): entry is NonNullable<typeof entry> =>
          entry != null && entry.runId === getState().game.traffic.runId,
      ),
    getState().game.audit.nextSequence,
  );
  const archive = createRunArchiveRecord(
    getState().game.progress.nextArchiveSequence,
    exportSnapshot,
    {
      dayId: day.id,
      title: day.title,
      resolutionKind: resolution.kind,
      archiveReason: 'resolved',
      actionCount: historyEntry.actionCount,
      incidentCount: historyEntry.incidentCount,
    },
  );

  if (nextDayId) {
    dispatch(
      gameProgressActions.resolveDay({
        resolution,
        historyEntry,
        nextDayId,
        transition,
        archive,
        finalRngSeed: getState().game.traffic.rngSeed,
      }),
    );
    return true;
  }

  dispatch(
    gameProgressActions.completeCampaign({
      resolution: {
        kind: resolution.kind,
        title: resolution.kind === 'failure' ? resolution.title : 'GLORY TO NAPT',
        message:
          resolution.kind === 'failure'
            ? resolution.message
            : '複合キー照合、色再利用、期限切れ管理まで含めて、NAPT の教材フローを完走しました。',
      },
      historyEntry,
      nextDayId: null,
      transition,
      archive,
      finalRngSeed: getState().game.traffic.rngSeed,
    }),
  );
  return true;
};

const finishDayIfNoTrafficRemains = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameTrafficActions.appendCheckpoint>
      | ReturnType<typeof gameProgressActions.resolveDay>
      | ReturnType<typeof gameProgressActions.completeCampaign>
  ) => void,
  day: NonNullable<ReturnType<typeof getCurrentDay>>,
  actionResultId: string | null,
) => {
  if (
    getState().game.traffic.activePacketId ||
    getState().game.traffic.pendingPacketIds.length > 0 ||
    getState().game.traffic.upcomingPacketIds.length > 0 ||
    getState().game.traffic.backgroundFlows.some((flow) => flow.remainingPackets > 0)
  ) {
    return false;
  }

  return resolveCurrentDay(getState, dispatch, day, actionResultId, 'trafficExhausted');
};

const finishDayIfShiftStateResolved = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameTrafficActions.appendCheckpoint>
      | ReturnType<typeof gameProgressActions.resolveDay>
      | ReturnType<typeof gameProgressActions.completeCampaign>
  ) => void,
  day: NonNullable<ReturnType<typeof getCurrentDay>>,
  actionResultId: string | null,
) => {
  const progress = getShiftGoalProgress(day, getState().game.traffic);

  if (progress.exceededIncidentLimit) {
    return resolveCurrentDay(getState, dispatch, day, actionResultId, 'incidentLimitExceeded');
  }

  if (progress.goal && progress.isComplete) {
    return resolveCurrentDay(getState, dispatch, day, actionResultId, 'shiftGoalMet');
  }

  if (progress.goal && progress.exhaustedActionBudget) {
    return resolveCurrentDay(getState, dispatch, day, actionResultId, 'shiftWindowExpired');
  }

  return false;
};

const appendTimeoutSessionEvents = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameTrafficActions.appendSessionEvent>) => void,
  payload: {
    packetRuntimeId: string | null;
    actionResultId: string | null;
    expiredEntries: Array<{ id: string; externalPort?: string | null }>;
  },
) => {
  for (const entry of payload.expiredEntries) {
    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'mappingTimedOut',
          packetRuntimeId: payload.packetRuntimeId,
          relatedEntryId: entry.id,
          actionResultId: payload.actionResultId,
          message: `${entry.id} が期限切れになりました。`,
          metadata: buildSessionEventMetadata([['externalPort', entry.externalPort ?? null]]),
        }),
      ),
    );
  }
};

const processPendingPacketPressure = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameTrafficActions.applyPendingPacketPressure>
      | ReturnType<typeof gameTrafficActions.appendActionResult>
      | ReturnType<typeof gameTrafficActions.appendSessionEvent>
      | ReturnType<typeof gameTrafficActions.replaceObjectives>
      | ReturnType<typeof gameAuditActions.appendAuditLog>
      | ReturnType<typeof gameWorkspaceActions.dropSuspendedPacket>
  ) => void,
  payload: {
    day: NonNullable<ReturnType<typeof getCurrentDay>>;
    excludePacketIds?: string[];
  },
) => {
  const state = getState();
  const excluded = new Set(payload.excludePacketIds ?? []);
  const pendingPackets = state.game.traffic.pendingPacketIds
    .map((packetId) => state.game.traffic.entities[packetId])
    .filter((packet): packet is NonNullable<typeof packet> => packet != null);
  const freshPacketIds = new Set(
    pendingPackets
      .filter((packet) => packet.pendingAge === 0 && packet.availableAtAction === state.game.traffic.actionClock)
      .map((packet) => packet.runtimeId),
  );
  const ageCandidates = pendingPackets.filter(
    (packet) =>
      !excluded.has(packet.runtimeId) &&
      !freshPacketIds.has(packet.runtimeId) &&
      packet.maxPendingAge < Number.MAX_SAFE_INTEGER,
  );
  const droppedPackets = ageCandidates.filter((packet) => packet.pendingAge + 1 >= packet.maxPendingAge);
  const agedPackets = ageCandidates.filter((packet) => packet.pendingAge + 1 < packet.maxPendingAge);

  if (droppedPackets.length === 0 && agedPackets.length === 0) {
    return [];
  }

  dispatch(
    gameTrafficActions.applyPendingPacketPressure({
      agedPacketIds: agedPackets.map((packet) => packet.runtimeId),
      droppedPacketIds: droppedPackets.map((packet) => packet.runtimeId),
    }),
  );

  const expiredActionIds: string[] = [];

  for (const packet of droppedPackets) {
    const actionResult = createActionResultRecord(getState().game.traffic, {
      action: 'TIMEOUT',
      sourceId: packet.runtimeId,
      packetRuntimeId: packet.runtimeId,
      rngSeedBefore: getState().game.traffic.rngSeed,
      rngSeedAfter: getState().game.traffic.rngSeed,
      subjectLabel: `${packet.packet.source.host} -> ${packet.packet.destination.host}`,
      outcomeCode: 'expiredInInbox',
      incidentKind: 'queueTimeoutLoss',
      causedIncident: true,
      auditMessage: '受取口で個包を放置したため、事故として記録されました。',
      feedbackMessage: '未処理の個包が滞留し、事故が発生しました。',
      feedbackTone: 'error',
      context: {
        ...createEmptyActionContext(),
        workbenchPacketRuntimeId: null,
        expectedTarget:
          packet.expectation.verdict === 'ACCEPT'
            ? packet.expectation.flow === 'outbound'
              ? packet.packet.destination
              : packet.expectation.expectedTarget
            : null,
      },
    });
    expiredActionIds.push(actionResult.id);
    dispatch(gameTrafficActions.appendActionResult(actionResult));
    dispatch(gameWorkspaceActions.dropSuspendedPacket(packet.runtimeId));
    logAudit(getState, dispatch, {
      dayId: payload.day.id,
      runId: getState().game.traffic.runId,
      packetId: packet.runtimeId,
      action: 'TIMEOUT',
      outcome: 'failed',
      message: `${packet.packet.source.host} からの個包を捌ききれず、受取口で事故になりました。`,
    });
    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'packetExpiredInInbox',
          packetRuntimeId: packet.runtimeId,
          relatedEntryId: null,
          actionResultId: actionResult.id,
          message: `${packet.runtimeId} が受取口で滞留し、事故として失われました。`,
          metadata: buildSessionEventMetadata([
            ['pendingAge', packet.pendingAge + 1],
            ['maxPendingAge', packet.maxPendingAge],
          ]),
        }),
      ),
    );

    const updatedObjectives = applyObjectivesAfterAction(
      getState().game.traffic.objectives,
      packet,
      actionResult.id,
      true,
    );
    dispatch(gameTrafficActions.replaceObjectives(updatedObjectives));
  }

  return expiredActionIds;
};

const processPendingPacketOverflow = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameTrafficActions.applyPendingPacketOverflow>
      | ReturnType<typeof gameTrafficActions.appendActionResult>
      | ReturnType<typeof gameTrafficActions.appendSessionEvent>
      | ReturnType<typeof gameTrafficActions.replaceObjectives>
      | ReturnType<typeof gameAuditActions.appendAuditLog>
  ) => void,
  payload: {
    day: NonNullable<ReturnType<typeof getCurrentDay>>;
  },
) => {
  const phase = getScenarioPhase(payload.day.phaseId);
  const capacity = phase.pendingCapacity;

  if (!capacity || getState().game.traffic.pendingPacketIds.length <= capacity) {
    return [];
  }

  const droppedPacketIds = getState().game.traffic.pendingPacketIds.slice(capacity);
  const droppedPackets = droppedPacketIds
    .map((packetId) => getState().game.traffic.entities[packetId])
    .filter((packet): packet is NonNullable<typeof packet> => packet != null);

  dispatch(gameTrafficActions.applyPendingPacketOverflow({ droppedPacketIds }));

  const overflowActionIds: string[] = [];

  for (const packet of droppedPackets) {
    const actionResult = createActionResultRecord(getState().game.traffic, {
      action: 'OVERFLOW',
      sourceId: packet.runtimeId,
      packetRuntimeId: packet.runtimeId,
      rngSeedBefore: getState().game.traffic.rngSeed,
      rngSeedAfter: getState().game.traffic.rngSeed,
      subjectLabel: `${packet.packet.source.host} -> ${packet.packet.destination.host}`,
      outcomeCode: 'overflowedInInbox',
      incidentKind: 'queueOverflowLoss',
      causedIncident: true,
      auditMessage: '受取口が満杯になり、個包を取りこぼしました。',
      feedbackMessage: '受取口があふれ、個包を処理できませんでした。',
      feedbackTone: 'error',
      context: {
        ...createEmptyActionContext(),
        workbenchPacketRuntimeId: null,
        expectedTarget:
          packet.expectation.verdict === 'ACCEPT'
            ? packet.expectation.flow === 'outbound'
              ? packet.packet.destination
              : packet.expectation.expectedTarget
            : null,
      },
    });
    overflowActionIds.push(actionResult.id);
    dispatch(gameTrafficActions.appendActionResult(actionResult));
    logAudit(getState, dispatch, {
      dayId: payload.day.id,
      runId: getState().game.traffic.runId,
      packetId: packet.runtimeId,
      action: 'OVERFLOW',
      outcome: 'failed',
      message: `${packet.packet.source.host} からの個包を受取口で取りこぼしました。`,
    });
    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'packetOverflowedInInbox',
          packetRuntimeId: packet.runtimeId,
          relatedEntryId: null,
          actionResultId: actionResult.id,
          message: `${packet.runtimeId} が受取口の容量を超えてあふれました。`,
          metadata: buildSessionEventMetadata([
            ['pendingCapacity', capacity],
          ]),
        }),
      ),
    );

    const updatedObjectives = applyObjectivesAfterAction(
      getState().game.traffic.objectives,
      packet,
      actionResult.id,
      true,
    );
    dispatch(gameTrafficActions.replaceObjectives(updatedObjectives));
  }

  return overflowActionIds;
};

const processBackgroundFlowsForCurrentAction = (
  getState: () => RootState,
  dispatch: (
    action:
      | ReturnType<typeof gameTrafficActions.enqueueRuntimePackets>
      | ReturnType<typeof gameTrafficActions.appendSessionEvent>
      | ReturnType<typeof gameTrafficActions.replaceBackgroundFlows>
  ) => void,
  payload: {
    day: NonNullable<ReturnType<typeof getCurrentDay>>;
    actionResultId: string | null;
  },
) => {
  const state = getState();
  const tableEntries = gameTableAdapter.getSelectors().selectAll(state.game.table);
  const activeEntryIds = new Set(tableEntries.map((entry) => entry.id));
  const frontPackets: Array<{ packet: ReturnType<typeof createBackgroundFlowPacketRecord>; entryId: string }> = [];
  const backPackets: Array<{ packet: ReturnType<typeof createBackgroundFlowPacketRecord>; entryId: string }> = [];
  const nextFlows = state.game.traffic.backgroundFlows.flatMap((flow) => {
    if (flow.remainingPackets <= 0 || !activeEntryIds.has(flow.entryId)) {
      return [];
    }

    if (flow.nextArrivalAction > state.game.traffic.actionClock) {
      return [flow];
    }

    const packet = createBackgroundFlowPacketRecord(
      flow,
      state.game.traffic.nextRuntimeOrdinal + frontPackets.length + backPackets.length,
      state.game.traffic.actionClock,
    );

    if (flow.queuePosition === 'front') {
      frontPackets.push({ packet, entryId: flow.entryId });
    } else {
      backPackets.push({ packet, entryId: flow.entryId });
    }

    const remainingPackets = flow.remainingPackets - 1;

    if (remainingPackets <= 0) {
      return [];
    }

    return [
      {
        ...flow,
        remainingPackets,
        nextArrivalAction: state.game.traffic.actionClock + flow.intervalActions,
      },
    ];
  });

  if (frontPackets.length === 0 && backPackets.length === 0) {
    if (nextFlows.length !== state.game.traffic.backgroundFlows.length) {
      dispatch(gameTrafficActions.replaceBackgroundFlows(nextFlows));
    }
    return;
  }

  if (frontPackets.length > 0) {
    dispatch(
      gameTrafficActions.enqueueRuntimePackets({
        packets: frontPackets.map(({ packet }) => packet),
        position: 'front',
        placement: 'pending',
        availableAtAction: state.game.traffic.actionClock,
      }),
    );
  }

  if (backPackets.length > 0) {
    dispatch(
      gameTrafficActions.enqueueRuntimePackets({
        packets: backPackets.map(({ packet }) => packet),
        position: 'back',
        placement: 'pending',
        availableAtAction: state.game.traffic.actionClock,
      }),
    );
  }

  dispatch(gameTrafficActions.replaceBackgroundFlows(nextFlows));

  [...frontPackets, ...backPackets].forEach(({ packet, entryId }) => {
    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'backgroundPacketQueued',
          packetRuntimeId: packet.runtimeId,
          relatedEntryId: entryId,
          actionResultId: payload.actionResultId,
          message: `${packet.packet.source.host} から継続中の返信個包が届きました。`,
          metadata: buildSessionEventMetadata([
            ['spawnSource', packet.spawnSource],
            ['availableAtAction', packet.availableAtAction],
          ]),
        }),
      ),
    );
    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'packetArrived',
          packetRuntimeId: packet.runtimeId,
          relatedEntryId: null,
          actionResultId: payload.actionResultId,
          message: `${packet.packet.source.host} からの個包が右受取口へ届きました。`,
          metadata: buildSessionEventMetadata([
            ['direction', packet.packet.direction],
            ['spawnSource', packet.spawnSource],
          ]),
        }),
      ),
    );
  });
};

const archiveCurrentRunIfNeeded = (
  getState: () => RootState,
  dispatch: (action: ReturnType<typeof gameProgressActions.archiveActiveRun>) => void,
) => {
  const state = getState();
  const { progress, traffic, table, audit } = state.game;
  const day = getCurrentDay(progress);

  if (!day || !traffic.runId || traffic.sessionStatus !== 'active') {
    return;
  }

  const exportSnapshot = buildSessionExportSnapshot(
    day,
    progress,
    traffic,
    table,
    audit.ids
      .map((auditId) => audit.entities[auditId])
      .filter((entry): entry is NonNullable<typeof entry> => entry != null && entry.runId === traffic.runId),
    audit.nextSequence,
  );
  const archive = createRunArchiveRecord(progress.nextArchiveSequence, exportSnapshot, {
    dayId: day.id,
    title: day.title,
    resolutionKind: null,
    archiveReason: 'abandoned',
    actionCount: traffic.actionResults.length,
    incidentCount: traffic.actionResults.filter((result) => result.causedIncident).length,
  });

  dispatch(
    gameProgressActions.archiveActiveRun({
      runId: traffic.runId,
      archive,
      finalRngSeed: traffic.rngSeed,
      actionCount: traffic.actionResults.length,
      incidentCount: traffic.actionResults.filter((result) => result.causedIncident).length,
    }),
  );
};

export const startCampaign = (): AppThunk => (dispatch) => {
  dispatch(gameTrafficActions.reseedTraffic(Date.now()));
  dispatch(gameProgressActions.resetCampaign());
  dispatch(gameWorkspaceActions.resetWorkspace());
  dispatch(gameTableActions.resetTable());
  dispatch(gameTableViewActions.resetTableView());
  dispatch(gameTrafficActions.resetTraffic());
  dispatch(gameAuditActions.resetAudit());
  dispatch(beginCurrentDay());
};

export const beginCurrentDay = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const day = getCurrentDay(state.game.progress);

  if (!day) {
    return;
  }

  const run = createDayRunRecord(state.game.progress, day, state.game.traffic.rngSeed, state.game.traffic.rngSeed);
  const session = buildDaySession(day, state.game.traffic.rngSeed, run.id);
  const initialTableEntries = buildInitialTableEntries(day);

  dispatch(gameWorkspaceActions.resetWorkspace());
  dispatch(
    gameTableActions.hydrateTableSnapshot({
      entries: initialTableEntries,
      nextSequence: initialTableEntries.length + 1,
    }),
  );
  dispatch(gameTableViewActions.resetTableView());
  dispatch(gameProgressActions.startDayRun(run));
  dispatch(gameTrafficActions.startDaySession(session));
  dispatch(
    gameWorkspaceActions.focusWorkbenchPacket({
      packetRuntimeId: null,
      source: null,
      destination: null,
    }),
  );
  dispatch(
    gameTrafficActions.appendSessionEvent(
      createSessionEventRecord(getState().game.traffic, {
        kind: 'daySessionStarted',
        packetRuntimeId: session.activePacketId,
        relatedEntryId: null,
        actionResultId: null,
        message: `${day.id} のセッションを開始しました。`,
        metadata: buildSessionEventMetadata([
          ['seed', session.daySeed],
          ['packetCount', session.packetOrder.length],
          ['objectiveCount', session.objectives.length],
        ]),
      }),
    ),
  );
  dispatch(
    gameTrafficActions.appendCheckpoint(
      createSessionCheckpointRecord(getState().game.traffic, [], {
        reason: 'dayStart',
        actionResultId: null,
        sessionEventId: getState().game.traffic.sessionEvents.at(-1)?.id ?? null,
      }),
    ),
  );
  dispatch(gameProgressActions.beginInspection());
};

export const advanceToNextDay = (): AppThunk => (dispatch, getState) => {
  const isLastDay = !getState().game.progress.nextDayId;

  dispatch(gameWorkspaceActions.resetWorkspace());
  dispatch(gameTableActions.resetTable());
  dispatch(gameTableViewActions.resetTableView());
  dispatch(gameTrafficActions.resetTraffic());
  dispatch(gameProgressActions.advanceToNextDay());

  if (!isLastDay) {
    dispatch(beginCurrentDay());
  }
};

export const replayCurrentDay = (): AppThunk => (dispatch, getState) => {
  archiveCurrentRunIfNeeded(getState, dispatch);
  dispatch(gameWorkspaceActions.resetWorkspace());
  dispatch(gameTableActions.resetTable());
  dispatch(gameTableViewActions.resetTableView());
  dispatch(gameTrafficActions.resetTraffic());
  dispatch(gameProgressActions.prepareDayReplay());
  dispatch(beginCurrentDay());
};

export const inspectRunArchive =
  (runId: string): AppThunk =>
  (dispatch, getState) => {
    archiveCurrentRunIfNeeded(getState, dispatch);

    const archive = getState().game.progress.runArchives.find((entry) => entry.runId === runId);

    if (!archive) {
      return;
    }

    const payload = buildArchiveRestorePayload(archive);

    dispatch(gameWorkspaceActions.resetWorkspace());
    dispatch(gameTableViewActions.resetTableView());
    dispatch(gameTableActions.hydrateTableSnapshot(payload.tableSnapshot));
    dispatch(gameAuditActions.hydrateAuditSnapshot(payload.auditSnapshot));
    dispatch(gameTrafficActions.hydrateTrafficSnapshot(payload.trafficSnapshot));
    const activePacket =
      payload.trafficSnapshot.activePacketId == null
        ? null
        : payload.trafficSnapshot.packets.find((packet) => packet.runtimeId === payload.trafficSnapshot.activePacketId) ?? null;
    dispatch(
      gameWorkspaceActions.focusWorkbenchPacket({
        packetRuntimeId: payload.trafficSnapshot.activePacketId,
        source: activePacket?.packet.source ?? null,
        destination: activePacket?.packet.destination ?? null,
      }),
    );
    dispatch(
      gameProgressActions.openRunArchiveReview({
        runId: payload.runId,
        dayId: payload.dayId,
      }),
    );
  };

export const submitVerdict =
  (verdict: Verdict): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const { game } = state;

    if (game.progress.screen !== 'inspection' || isReadOnlyInspection(state)) {
      return;
    }

    const day = getCurrentDay(game.progress);
    const packet = getActiveRuntimePacket(game.traffic);

    if (!day || !packet) {
      return;
    }

    if (!(day.availableVerdicts ?? ['ACCEPT', 'REJECT']).includes(verdict)) {
      dispatch(
        gameWorkspaceActions.setFeedback({
          tone: 'error',
          message: verdict === 'REJECT' ? 'この日の机ではまだ拒否操作は使えません。' : 'この操作はまだ使えません。',
        }),
      );
      return;
    }

    if (!isWorkbenchFocusedOnPacket(state, packet.runtimeId) || state.game.workspace.document.placement !== 'workbench') {
      syncWorkbenchToActivePacket(getState, dispatch);
      return;
    }

    appendCommand(getState, dispatch, {
      kind: 'submitVerdict',
      packetRuntimeId: packet.runtimeId,
      payload: {
        verdict,
      },
    });

    const tableEntries = gameTableAdapter.getSelectors().selectAll(game.table);
    const selectedTableEntry =
      game.workspace.draft.appliedTableEntryId === null
        ? null
        : game.table.entities[game.workspace.draft.appliedTableEntryId] ?? null;

    const evaluation = evaluateVerdict({
      day,
      packet,
      verdict,
      selectedStampId: game.workspace.draft.appliedStampId,
      selectedTableEntry,
      documentSource: game.workspace.document.source,
      documentSourceApplied: game.workspace.document.sourceApplied,
      documentDestination: game.workspace.document.destination,
      documentDestinationApplied: game.workspace.document.destinationApplied,
      tableEntries,
      nextTableSequence: game.table.nextSequence,
      rngSeed: game.traffic.rngSeed,
    });
    const matchingEntryIds =
      packet.packet.direction === 'wanToLan'
        ? findMatchingInboundEntries(day, packet, tableEntries).map((entry) => entry.id)
        : [];

    const actionResult = createActionResultRecord(game.traffic, {
      action: verdict,
      sourceId: packet.runtimeId,
      packetRuntimeId: packet.runtimeId,
      rngSeedBefore: game.traffic.rngSeed,
      rngSeedAfter: evaluation.nextSeed,
      subjectLabel:
        packet.packet.direction === 'lanToWan'
          ? `${packet.packet.source.host} -> ${packet.packet.destination.host}`
          : `${packet.packet.source.host} -> ${packet.packet.destination.host}`,
      outcomeCode: evaluation.outcomeCode,
      incidentKind: evaluation.incidentKind,
      causedIncident: evaluation.causedIncident,
      auditMessage: evaluation.auditMessage,
      feedbackMessage: evaluation.feedbackMessage,
      feedbackTone: evaluation.feedbackTone,
      context: {
        workbenchPacketRuntimeId: game.workspace.draft.packetRuntimeId,
        draftStampId: game.workspace.draft.stampId,
        draftRouteTargetId: game.workspace.draft.routeTargetId,
        draftTableEntryId: game.workspace.draft.tableEntryId,
        appliedStampId: game.workspace.draft.appliedStampId,
        appliedRouteTargetId: game.workspace.draft.appliedRouteTargetId,
        appliedTableEntryId: game.workspace.draft.appliedTableEntryId,
        draftDispatchIntent: game.workspace.draft.dispatchIntent,
        documentSource: game.workspace.document.source ? { ...game.workspace.document.source } : null,
        documentDestination: game.workspace.document.destination ? { ...game.workspace.document.destination } : null,
        matchingEntryIds: [],
        conflictingEntryId: evaluation.conflictingEntryId,
        createdTableEntryId: evaluation.createdTableEntry?.id ?? null,
        activatedEntryId: evaluation.activatedEntryId ?? null,
        autoAssignedStampId: evaluation.autoAssignedStampId,
        deliveredTarget: evaluation.deliveredTarget,
        expectedTarget: evaluation.expectedTarget,
        expiredEntryIds: [],
        preservedEntryIds: [],
      },
    });

    const auditOutcome =
      evaluation.outcomeCode === 'returnedForRewrite' || evaluation.outcomeCode === 'returnedForLookup'
        || evaluation.outcomeCode === 'returnedForRoute'
        ? 'failed'
        : evaluation.causedIncident
          ? 'blocked'
          : 'advanced';

    logAudit(getState, dispatch, {
      dayId: day.id,
      runId: game.traffic.runId,
      packetId: packet.runtimeId,
      action: verdict,
      outcome: auditOutcome,
      message: evaluation.auditMessage,
    });
    dispatch(gameTrafficActions.setTrafficSeed(evaluation.nextSeed));
    dispatch(
      gameTrafficActions.appendSessionEvent(
        createSessionEventRecord(getState().game.traffic, {
          kind: 'actionResolved',
          packetRuntimeId: packet.runtimeId,
          relatedEntryId: evaluation.createdTableEntry?.id ?? evaluation.activatedEntryId ?? null,
          actionResultId: actionResult.id,
          message: evaluation.auditMessage,
          metadata: buildSessionEventMetadata([
            ['action', verdict],
            ['outcomeCode', evaluation.outcomeCode],
            ['incident', evaluation.causedIncident],
            ['incidentKind', evaluation.incidentKind],
          ]),
        }),
      ),
    );
    dispatch(
      gameWorkspaceActions.setFeedback({
        tone: evaluation.feedbackTone,
        message: evaluation.feedbackMessage,
      }),
    );
    dispatch(gameWorkspaceActions.clearDispatchIntent());

    const preservedEntryIds: string[] = [];

    if (!evaluation.advancesPacket) {
      const expiredEntries = advanceLifecycleAfterProgress(getState, dispatch, {
        dayId: day.id,
        runId: game.traffic.runId,
        packetId: packet.runtimeId,
        preserveEntryIds: preservedEntryIds,
      });
      dispatch(
        gameTrafficActions.returnActivePacketToPending({
          packetId: packet.runtimeId,
          position: 'front',
        }),
      );
      dispatch(gameWorkspaceActions.returnDocumentToInbox());
      actionResult.context.matchingEntryIds = matchingEntryIds;
      actionResult.context.preservedEntryIds = preservedEntryIds.slice();
      actionResult.context.expiredEntryIds = expiredEntries.map((entry) => entry.id);
      dispatch(gameTrafficActions.appendActionResult(actionResult));
      appendTimeoutSessionEvents(getState, dispatch, {
        packetRuntimeId: packet.runtimeId,
        actionResultId: actionResult.id,
        expiredEntries,
      });
      dispatch(
        gameTrafficActions.appendCheckpoint(
          createSessionCheckpointRecord(
            getState().game.traffic,
            gameTableAdapter.getSelectors().selectAll(getState().game.table),
            {
              reason: 'afterAction',
              actionResultId: actionResult.id,
              sessionEventId: getState().game.traffic.sessionEvents.at(-1)?.id ?? null,
            },
          ),
        ),
      );
      dispatch(
        gameTrafficActions.appendResolvedTurn(
          createResolvedTurnRecord(getState().game.traffic, {
            packetRuntimeId: packet.runtimeId,
            commandIds: getState().game.traffic.currentTurn.commandIds.slice(),
            actionResultId: actionResult.id,
            checkpointId: getState().game.traffic.checkpoints.at(-1)?.id ?? null,
            causedIncident: actionResult.causedIncident,
            outcomeCode: actionResult.outcomeCode,
          }),
        ),
      );
      dispatch(
        gameWorkspaceActions.focusWorkbenchPacket({
          packetRuntimeId: null,
          source: null,
          destination: null,
        }),
      );
      releaseUpcomingPacketsForDay(getState, dispatch, day, actionResult.id);
      processBackgroundFlowsForCurrentAction(getState, dispatch, {
        day,
        actionResultId: actionResult.id,
      });
      processPendingPacketOverflow(getState, dispatch, { day });
      processPendingPacketPressure(getState, dispatch, {
        day,
        excludePacketIds: [packet.runtimeId],
      });
      finishDayIfShiftStateResolved(getState, dispatch, day, actionResult.id);
      return;
    }

    if (evaluation.createdTableEntry) {
      dispatch(gameTableActions.registerTableEntry(evaluation.createdTableEntry));
      preservedEntryIds.push(evaluation.createdTableEntry.id);
      dispatch(
        gameTrafficActions.appendSessionEvent(
          createSessionEventRecord(getState().game.traffic, {
            kind: 'mappingRegistered',
            packetRuntimeId: packet.runtimeId,
            relatedEntryId: evaluation.createdTableEntry.id,
            actionResultId: actionResult.id,
            message: `${evaluation.createdTableEntry.id} を登録しました。`,
            metadata: buildSessionEventMetadata([
              ['externalPort', evaluation.createdTableEntry.externalPort ?? null],
              ['destinationHost', evaluation.createdTableEntry.destinationHost ?? null],
            ]),
          }),
        ),
      );

      const registeredEntryFlow = createRegisteredEntryBackgroundFlow(
        day,
        evaluation.createdTableEntry,
        packet,
        getState().game.traffic.actionClock,
      );

      if (registeredEntryFlow) {
        dispatch(
          gameTrafficActions.replaceBackgroundFlows([
            ...getState().game.traffic.backgroundFlows,
            registeredEntryFlow,
          ]),
        );
        dispatch(
          gameTrafficActions.appendSessionEvent(
            createSessionEventRecord(getState().game.traffic, {
              kind: 'backgroundPacketQueued',
              packetRuntimeId: packet.runtimeId,
              relatedEntryId: evaluation.createdTableEntry.id,
              actionResultId: actionResult.id,
              message: `${evaluation.createdTableEntry.id} は開いたまま継続返信を生む通信行になりました。`,
              metadata: buildSessionEventMetadata([
                ['spawnSource', 'registeredEntryFlow'],
                ['nextArrivalAction', registeredEntryFlow.nextArrivalAction],
                ['remainingPackets', registeredEntryFlow.remainingPackets],
              ]),
            }),
          ),
        );
      }
    } else if (evaluation.activatedEntryId) {
      dispatch(gameTableActions.activateTableEntry(evaluation.activatedEntryId));
      preservedEntryIds.push(evaluation.activatedEntryId);
      dispatch(
        gameTrafficActions.appendSessionEvent(
          createSessionEventRecord(getState().game.traffic, {
            kind: 'mappingActivated',
            packetRuntimeId: packet.runtimeId,
            relatedEntryId: evaluation.activatedEntryId,
            actionResultId: actionResult.id,
            message: `${evaluation.activatedEntryId} を再活性化しました。`,
            metadata: buildSessionEventMetadata([]),
          }),
        ),
      );
    }

    const updatedObjectives = applyObjectivesAfterAction(
      getState().game.traffic.objectives,
      packet,
      actionResult.id,
      evaluation.causedIncident,
    );
    const satisfiedObjectives = updatedObjectives.filter(
      (objective) =>
        objective.satisfiedByActionId === actionResult.id && objective.status === 'satisfied',
    );
    dispatch(gameTrafficActions.replaceObjectives(updatedObjectives));
    for (const objective of satisfiedObjectives) {
      dispatch(
        gameTrafficActions.appendSessionEvent(
          createSessionEventRecord(getState().game.traffic, {
            kind: 'objectiveSatisfied',
            packetRuntimeId: packet.runtimeId,
            relatedEntryId: null,
            actionResultId: actionResult.id,
            message: `${objective.title} を観測しました。`,
            metadata: buildSessionEventMetadata([['objectiveId', objective.id]]),
          }),
        ),
      );
    }

    if (shouldRepeatForcedFailurePacket(day, packet, evaluation.causedIncident)) {
      const repeatedPacket = createRuntimePacketRecord(
        packet,
        getState().game.traffic.nextRuntimeOrdinal,
        'repeatUntilIncident',
      );
      dispatch(
        gameTrafficActions.enqueueRuntimePackets({
          packets: [repeatedPacket],
          position: 'back',
          placement: 'upcoming',
          availableAtAction: getState().game.traffic.actionClock + 1,
        }),
      );
      dispatch(
        gameTrafficActions.appendSessionEvent(
          createSessionEventRecord(getState().game.traffic, {
            kind: 'packetRepeated',
            packetRuntimeId: repeatedPacket.runtimeId,
            relatedEntryId: null,
            actionResultId: actionResult.id,
            message: `${packet.templateId} を事故観測まで再投入しました。`,
            metadata: buildSessionEventMetadata([['spawnSource', repeatedPacket.spawnSource]]),
          }),
        ),
      );
    }

    if (
      packet.expectation.verdict === 'ACCEPT' &&
      packet.expectation.flow === 'outbound' &&
      !evaluation.causedIncident
    ) {
      let responsePacket = null;
      let queuePosition: 'front' | 'back' = 'front';
      const skipsReply = packet.responsePlan?.skipReply === true;

      if (packet.responsePlan && !skipsReply) {
        responsePacket = createGeneratedResponsePacketRecord({
          day,
          sourcePacket: packet,
          rewrittenSource: game.workspace.document.source,
          appliedStampId: game.workspace.draft.appliedStampId,
          ordinal: getState().game.traffic.nextRuntimeOrdinal,
        });
        queuePosition = packet.responsePlan.queuePosition ?? 'front';
      } else if (!packet.responsePlan) {
        const responseTemplate = findAutoResponseTemplateForOutbound(day, packet);

        if (responseTemplate) {
          responsePacket = createGeneratedScenarioResponsePacketRecord(
            responseTemplate,
            getState().game.traffic.nextRuntimeOrdinal,
          );
          queuePosition = resolveGeneratedResponseQueuePosition(getState());
        }
      }

      if (responsePacket) {
        const availableAtAction = resolveArrivalActionForGeneratedPacket(
          getState(),
          day,
          queuePosition,
          packet.responsePlan?.delayActions ?? responsePacket.runtime?.arrivalDelayActions,
        );
        dispatch(
          gameTrafficActions.enqueueRuntimePackets({
            packets: [responsePacket],
            position: queuePosition,
            placement: 'upcoming',
            availableAtAction,
          }),
        );
        dispatch(
          gameTrafficActions.appendSessionEvent(
            createSessionEventRecord(getState().game.traffic, {
              kind: 'packetRepeated',
              packetRuntimeId: responsePacket.runtimeId,
              relatedEntryId: null,
              actionResultId: actionResult.id,
              message: `${packet.packet.destination.host} からの返信個包が到着待ちキューへ追加されました。`,
              metadata: buildSessionEventMetadata([
                ['spawnSource', responsePacket.spawnSource],
                ['queuePosition', queuePosition],
                ['availableAtAction', availableAtAction],
                ['responseTemplateId', responsePacket.templateId],
              ]),
            }),
          ),
        );
      } else if (skipsReply) {
        dispatch(
          gameTrafficActions.appendSessionEvent(
            createSessionEventRecord(getState().game.traffic, {
              kind: 'packetRepeated',
              packetRuntimeId: packet.runtimeId,
              relatedEntryId: null,
              actionResultId: actionResult.id,
              message: `${packet.packet.destination.host} 宛ての通信は返答がなく、行だけが残ります。`,
              metadata: buildSessionEventMetadata([
                ['spawnSource', 'noReply'],
              ]),
            }),
          ),
        );
      }
    }

    const expiredEntries = advanceLifecycleAfterProgress(getState, dispatch, {
      dayId: day.id,
      runId: game.traffic.runId,
      packetId: packet.runtimeId,
      preserveEntryIds: preservedEntryIds,
    });
    actionResult.context.matchingEntryIds = matchingEntryIds;
    actionResult.context.preservedEntryIds = preservedEntryIds.slice();
    actionResult.context.expiredEntryIds = expiredEntries.map((entry) => entry.id);
    dispatch(gameTrafficActions.appendActionResult(actionResult));
    dispatch(
      gameTrafficActions.appendCheckpoint(
        createSessionCheckpointRecord(getState().game.traffic, gameTableAdapter.getSelectors().selectAll(getState().game.table), {
          reason: 'afterAction',
          actionResultId: actionResult.id,
          sessionEventId: getState().game.traffic.sessionEvents.at(-1)?.id ?? null,
        }),
      ),
    );
    dispatch(
      gameTrafficActions.appendResolvedTurn(
        createResolvedTurnRecord(getState().game.traffic, {
          packetRuntimeId: packet.runtimeId,
          commandIds: getState().game.traffic.currentTurn.commandIds.slice(),
          actionResultId: actionResult.id,
          checkpointId: getState().game.traffic.checkpoints.at(-1)?.id ?? null,
          causedIncident: actionResult.causedIncident,
          outcomeCode: actionResult.outcomeCode,
        }),
      ),
    );

    appendTimeoutSessionEvents(getState, dispatch, {
      packetRuntimeId: packet.runtimeId,
      actionResultId: actionResult.id,
      expiredEntries,
    });

    dispatch(
      gameTrafficActions.resolveActivePacket({
        packetId: packet.runtimeId,
        actionId: actionResult.id,
      }),
    );

    dispatch(
      gameWorkspaceActions.focusWorkbenchPacket({
        packetRuntimeId: null,
        source: null,
        destination: null,
      }),
    );
    releaseUpcomingPacketsForDay(getState, dispatch, day, actionResult.id);
    processBackgroundFlowsForCurrentAction(getState, dispatch, {
      day,
      actionResultId: actionResult.id,
    });
    processPendingPacketOverflow(getState, dispatch, { day });
    processPendingPacketPressure(getState, dispatch, {
      day,
    });
    if (finishDayIfShiftStateResolved(getState, dispatch, day, actionResult.id)) {
      return;
    }
    finishDayIfNoTrafficRemains(getState, dispatch, day, actionResult.id);
  };

export const closeSelectedTableEntry = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  if (isReadOnlyInspection(state)) {
    return;
  }
  const day = getCurrentDay(state.game.progress);
  const packet = getActiveRuntimePacket(state.game.traffic);
  const selectedEntryId = state.game.workspace.draft.tableEntryId;

  if (!day || !selectedEntryId) {
    return;
  }

  const selectedEntry = state.game.table.entities[selectedEntryId];

  if (!selectedEntry) {
    return;
  }

  appendCommand(getState, dispatch, {
    kind: 'closeEntry',
    packetRuntimeId: packet?.runtimeId ?? null,
    payload: {
      entryId: selectedEntryId,
    },
  });

  dispatch(gameTableActions.closeTableEntry(selectedEntryId));
  dispatch(gameWorkspaceActions.clearTableEntrySelection());
  dispatch(
    gameWorkspaceActions.setFeedback({
      tone: 'success',
      message: '通信を終了し、外側ポートを再利用可能にしました。',
    }),
  );
  dispatch(
    gameTrafficActions.appendActionResult(
      createActionResultRecord(state.game.traffic, {
        action: 'CLOSE',
        sourceId: selectedEntryId,
        packetRuntimeId: null,
        rngSeedBefore: state.game.traffic.rngSeed,
        rngSeedAfter: state.game.traffic.rngSeed,
        subjectLabel: selectedEntryId,
        outcomeCode: 'manualClose',
        incidentKind: null,
        causedIncident: false,
        auditMessage: `${selectedEntryId} を閉じて外側ポートを解放しました。`,
        feedbackMessage: '通信を終了しました。',
        feedbackTone: 'success',
        context: {
          ...createEmptyActionContext(),
          workbenchPacketRuntimeId: state.game.workspace.draft.packetRuntimeId,
          draftStampId: state.game.workspace.draft.stampId,
          draftRouteTargetId: state.game.workspace.draft.routeTargetId,
          draftTableEntryId: selectedEntryId,
          appliedStampId: state.game.workspace.draft.appliedStampId,
          appliedRouteTargetId: state.game.workspace.draft.appliedRouteTargetId,
          appliedTableEntryId: state.game.workspace.draft.appliedTableEntryId,
          documentSource: state.game.workspace.document.source ? { ...state.game.workspace.document.source } : null,
          documentDestination: state.game.workspace.document.destination ? { ...state.game.workspace.document.destination } : null,
          preservedEntryIds: [],
          expiredEntryIds: [],
        },
      }),
    ),
  );
  dispatch(
    gameTrafficActions.appendSessionEvent(
      createSessionEventRecord(getState().game.traffic, {
        kind: 'mappingClosed',
        packetRuntimeId: packet?.runtimeId ?? null,
        relatedEntryId: selectedEntryId,
        actionResultId: null,
        message: `${selectedEntryId} を手動クローズしました。`,
        metadata: buildSessionEventMetadata([]),
      }),
    ),
  );
  dispatch(
    gameTrafficActions.appendCheckpoint(
      createSessionCheckpointRecord(getState().game.traffic, gameTableAdapter.getSelectors().selectAll(getState().game.table), {
        reason: 'afterManualClose',
        actionResultId: getState().game.traffic.actionResults.at(-1)?.id ?? null,
        sessionEventId: getState().game.traffic.sessionEvents.at(-1)?.id ?? null,
      }),
    ),
  );
  dispatch(
    gameTrafficActions.appendResolvedTurn(
        createResolvedTurnRecord(getState().game.traffic, {
          packetRuntimeId: packet?.runtimeId ?? null,
          commandIds: getState().game.traffic.currentTurn.commandIds.slice(),
          actionResultId: getState().game.traffic.actionResults.at(-1)?.id ?? '',
          checkpointId: getState().game.traffic.checkpoints.at(-1)?.id ?? null,
          causedIncident: false,
        outcomeCode: 'manualClose',
      }),
    ),
  );

  logAudit(getState, dispatch, {
    dayId: day.id,
    runId: state.game.traffic.runId,
    packetId: packet?.id ?? selectedEntryId,
    action: 'CLOSE',
    outcome: 'advanced',
    message: `${selectedEntryId} を手動で閉じました。`,
  });

  releaseUpcomingPacketsForDay(getState, dispatch, day, getState().game.traffic.actionResults.at(-1)?.id ?? null);
  processBackgroundFlowsForCurrentAction(getState, dispatch, {
    day,
    actionResultId: getState().game.traffic.actionResults.at(-1)?.id ?? null,
  });
  processPendingPacketOverflow(getState, dispatch, { day });
  processPendingPacketPressure(getState, dispatch, {
    day,
  });
  finishDayIfShiftStateResolved(getState, dispatch, day, getState().game.traffic.actionResults.at(-1)?.id ?? null);
};

export const waitOneTurn = (): AppThunk => (dispatch, getState) => {
  const state = getState();

  if (isReadOnlyInspection(state) || state.game.progress.screen !== 'inspection') {
    return;
  }

  const day = getCurrentDay(state.game.progress);

  if (!day || getScenarioPhase(day.phaseId).index < getScenarioPhase('timeoutLifecycle').index) {
    return;
  }

  const activePacket = getActiveRuntimePacket(state.game.traffic);
  const packetRuntimeId = activePacket?.runtimeId ?? null;

  appendCommand(getState, dispatch, {
    kind: 'waitTurn',
    packetRuntimeId,
    payload: {
      actionClock: state.game.traffic.actionClock,
    },
  });

  const expiredEntries = advanceLifecycleAfterProgress(getState, dispatch, {
    dayId: day.id,
    runId: state.game.traffic.runId,
    packetId: packetRuntimeId ?? `wait-${state.game.traffic.actionClock}`,
    preserveEntryIds: [],
  });

  const actionResult = createActionResultRecord(getState().game.traffic, {
    action: 'WAIT',
    sourceId: packetRuntimeId ?? `wait-${getState().game.traffic.actionClock}`,
    packetRuntimeId,
    rngSeedBefore: getState().game.traffic.rngSeed,
    rngSeedAfter: getState().game.traffic.rngSeed,
    subjectLabel: packetRuntimeId ? '作業台の個包を保留したまま待機' : '設備全体を監視して待機',
    outcomeCode: 'waited',
    incidentKind: null,
    causedIncident: false,
    auditMessage: '1手待って時間を進めました。',
    feedbackMessage: '時間を進めました。',
    feedbackTone: 'success',
    context: {
      ...createEmptyActionContext(),
      workbenchPacketRuntimeId: state.game.workspace.draft.packetRuntimeId,
      draftStampId: state.game.workspace.draft.stampId,
      draftRouteTargetId: state.game.workspace.draft.routeTargetId,
      draftTableEntryId: state.game.workspace.draft.tableEntryId,
      appliedStampId: state.game.workspace.draft.appliedStampId,
      appliedRouteTargetId: state.game.workspace.draft.appliedRouteTargetId,
      appliedTableEntryId: state.game.workspace.draft.appliedTableEntryId,
      draftDispatchIntent: state.game.workspace.draft.dispatchIntent,
      documentSource: state.game.workspace.document.source ? { ...state.game.workspace.document.source } : null,
      documentDestination: state.game.workspace.document.destination ? { ...state.game.workspace.document.destination } : null,
      matchingEntryIds: [],
      conflictingEntryId: null,
      createdTableEntryId: null,
      activatedEntryId: null,
      autoAssignedStampId: null,
      deliveredTarget: null,
      expectedTarget: null,
      expiredEntryIds: expiredEntries.map((entry) => entry.id),
      preservedEntryIds: [],
    },
  });

  dispatch(gameTrafficActions.appendActionResult(actionResult));
  logAudit(getState, dispatch, {
    dayId: day.id,
    runId: getState().game.traffic.runId,
    packetId: packetRuntimeId ?? `wait-${getState().game.traffic.actionClock}`,
    action: 'WAIT',
    outcome: 'advanced',
    message: '時間を進め、設備の状態を更新しました。',
  });
  dispatch(
    gameTrafficActions.appendSessionEvent(
      createSessionEventRecord(getState().game.traffic, {
        kind: 'actionResolved',
        packetRuntimeId,
        relatedEntryId: null,
        actionResultId: actionResult.id,
        message: '待機して時間を進めました。',
        metadata: buildSessionEventMetadata([
          ['action', 'WAIT'],
          ['expiredEntries', expiredEntries.length],
        ]),
      }),
    ),
  );
  appendTimeoutSessionEvents(getState, dispatch, {
    packetRuntimeId,
    actionResultId: actionResult.id,
    expiredEntries,
  });
  dispatch(
    gameTrafficActions.appendCheckpoint(
      createSessionCheckpointRecord(
        getState().game.traffic,
        gameTableAdapter.getSelectors().selectAll(getState().game.table),
        {
          reason: 'afterAction',
          actionResultId: actionResult.id,
          sessionEventId: getState().game.traffic.sessionEvents.at(-1)?.id ?? null,
        },
      ),
    ),
  );
  dispatch(
    gameTrafficActions.appendResolvedTurn(
      createResolvedTurnRecord(getState().game.traffic, {
        packetRuntimeId,
        commandIds: getState().game.traffic.currentTurn.commandIds.slice(),
        actionResultId: actionResult.id,
        checkpointId: getState().game.traffic.checkpoints.at(-1)?.id ?? null,
        causedIncident: false,
        outcomeCode: 'waited',
      }),
    ),
  );
  dispatch(
    gameWorkspaceActions.setFeedback({
      tone: 'success',
      message: '時間を進めました。',
    }),
  );

  releaseUpcomingPacketsForDay(getState, dispatch, day, actionResult.id);
  processBackgroundFlowsForCurrentAction(getState, dispatch, {
    day,
    actionResultId: actionResult.id,
  });
  processPendingPacketOverflow(getState, dispatch, { day });
  processPendingPacketPressure(getState, dispatch, { day });
  if (finishDayIfShiftStateResolved(getState, dispatch, day, actionResult.id)) {
    return;
  }
  finishDayIfNoTrafficRemains(getState, dispatch, day, actionResult.id);
};

export const chooseStamp =
  (stampId: StampId): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    syncWorkbenchToActivePacket(getState, dispatch);
    appendCommand(getState, dispatch, {
      kind: 'selectStamp',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        stampId,
      },
    });
    dispatch(gameWorkspaceActions.chooseStamp(stampId));
    appendCommand(getState, dispatch, {
      kind: 'applyStamp',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        stampId,
      },
    });
    dispatch(gameWorkspaceActions.applyStampSelection());
  };

export const pullPacketToWorkbench =
  (packetRuntimeId?: string): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    const state = getState();
    let packet = getActiveRuntimePacket(state.game.traffic);

    if (!packet) {
      const targetPacketId = packetRuntimeId ?? state.game.traffic.pendingPacketIds[0] ?? null;

      if (!targetPacketId) {
        return;
      }

      dispatch(gameTrafficActions.activatePendingPacket({ packetId: targetPacketId }));
      packet = getActiveRuntimePacket(getState().game.traffic);
      syncWorkbenchToActivePacket(getState, dispatch);
    } else if (packetRuntimeId && packetRuntimeId !== packet.runtimeId) {
      if (!state.game.traffic.pendingPacketIds.includes(packetRuntimeId)) {
        return;
      }

      appendCommand(getState, dispatch, {
        kind: 'shelvePacket',
        packetRuntimeId: packet.runtimeId,
        payload: {
          targetPacketRuntimeId: packetRuntimeId,
        },
      });
      shelveActiveWorkbenchPacket(getState, dispatch);
      dispatch(gameTrafficActions.activatePendingPacket({ packetId: packetRuntimeId }));
      packet = getActiveRuntimePacket(getState().game.traffic);
      syncWorkbenchToActivePacket(getState, dispatch);
    } else {
      syncWorkbenchToActivePacket(getState, dispatch);
    }

    if (!packet || !isWorkbenchFocusedOnPacket(getState(), packet.runtimeId)) {
      return;
    }

    appendCommand(getState, dispatch, {
      kind: 'pullPacket',
      packetRuntimeId: packet.runtimeId,
      payload: {
        location: 'workbench',
      },
    });
    dispatch(gameWorkspaceActions.moveDocumentToWorkbench());
  };

export const shelveWorkbenchPacket = (): AppThunk => (dispatch, getState) => {
  if (isReadOnlyInspection(getState())) {
    return;
  }

  const packet = getActiveRuntimePacket(getState().game.traffic);

  if (!packet) {
    return;
  }

  appendCommand(getState, dispatch, {
    kind: 'shelvePacket',
    packetRuntimeId: packet.runtimeId,
    payload: {
      location: 'inbox',
    },
  });
  shelveActiveWorkbenchPacket(getState, dispatch);
};
export const applyStampSelection = (): AppThunk => (dispatch, getState) => {
  if (isReadOnlyInspection(getState())) {
    return;
  }
  syncWorkbenchToActivePacket(getState, dispatch);
  const stampId = getState().game.workspace.draft.stampId;
  const packet = getActiveRuntimePacket(getState().game.traffic);

  if (!stampId || !isWorkbenchFocusedOnPacket(getState(), packet?.runtimeId ?? null)) {
    return;
  }

  appendCommand(getState, dispatch, {
    kind: 'applyStamp',
    packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
    payload: {
      stampId,
    },
  });
  dispatch(gameWorkspaceActions.applyStampSelection());
};
export const chooseRouteTarget =
  (routeTargetId: string): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    syncWorkbenchToActivePacket(getState, dispatch);
    const currentSelection = getState().game.workspace.draft.routeTargetId;
    const nextRouteTargetId = currentSelection === routeTargetId ? null : routeTargetId;
    appendCommand(getState, dispatch, {
      kind: 'selectRouteTarget',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        routeTargetId: nextRouteTargetId,
      },
    });
    if (nextRouteTargetId) {
      dispatch(gameWorkspaceActions.chooseRouteTarget(nextRouteTargetId));
      const packet = getActiveRuntimePacket(getState().game.traffic);

      if (!packet || !isWorkbenchFocusedOnPacket(getState(), packet.runtimeId)) {
        return;
      }

      const routeTarget =
        packet.routeTargets?.find((candidate) => {
          const candidateId = candidate.port ? `${candidate.host}:${candidate.port}` : candidate.host;
          return candidateId === nextRouteTargetId;
        }) ?? null;

      if (!routeTarget) {
        return;
      }

      appendCommand(getState, dispatch, {
        kind: 'applyRouteTarget',
        packetRuntimeId: packet.runtimeId,
        payload: {
          routeTargetId: nextRouteTargetId,
        },
      });
      dispatch(
        gameWorkspaceActions.applyRouteTargetSelection({
          routeTargetId: nextRouteTargetId,
          destination: routeTarget,
        }),
      );
      return;
    }

    dispatch(gameWorkspaceActions.clearRouteTargetSelection());
  };
export const applyRouteTargetSelection = (): AppThunk => (dispatch, getState) => {
  if (isReadOnlyInspection(getState())) {
    return;
  }
  syncWorkbenchToActivePacket(getState, dispatch);
  const routeTargetId = getState().game.workspace.draft.routeTargetId;
  const packet = getActiveRuntimePacket(getState().game.traffic);

  if (!routeTargetId || !packet || !isWorkbenchFocusedOnPacket(getState(), packet.runtimeId)) {
    return;
  }

  const routeTarget =
    packet.routeTargets?.find((candidate) => {
      const candidateId = candidate.port ? `${candidate.host}:${candidate.port}` : candidate.host;
      return candidateId === routeTargetId;
    }) ?? null;

  if (!routeTarget) {
    return;
  }

  appendCommand(getState, dispatch, {
    kind: 'applyRouteTarget',
    packetRuntimeId: packet.runtimeId,
    payload: {
      routeTargetId,
    },
  });
  dispatch(
    gameWorkspaceActions.applyRouteTargetSelection({
      routeTargetId,
      destination: routeTarget,
    }),
  );
};
export const setDispatchIntent =
  (intent: WorkbenchDispatchIntent): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    syncWorkbenchToActivePacket(getState, dispatch);
    appendCommand(getState, dispatch, {
      kind: 'setDispatchIntent',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        intent,
      },
    });
    dispatch(gameWorkspaceActions.setDispatchIntent(intent));
  };
export const commitWorkbenchDispatch = (): AppThunk => (dispatch, getState) => {
  if (isReadOnlyInspection(getState())) {
    return;
  }
  const intent = getState().game.workspace.draft.dispatchIntent;
  const packet = getActiveRuntimePacket(getState().game.traffic);

  if (!intent || !isWorkbenchFocusedOnPacket(getState(), packet?.runtimeId ?? null)) {
    return;
  }

  dispatch(submitVerdict(intent));
};
export const clearStampSelection = gameWorkspaceActions.clearStampSelection;
export const dropStampSelection = (): AppThunk => (dispatch, getState) => {
  if (isReadOnlyInspection(getState())) {
    return;
  }
  syncWorkbenchToActivePacket(getState, dispatch);
  appendCommand(getState, dispatch, {
    kind: 'selectStamp',
    packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
    payload: {
      stampId: null,
    },
  });
  dispatch(gameWorkspaceActions.clearStampSelection());
};
export const chooseTableEntry =
  (entryId: string): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    syncWorkbenchToActivePacket(getState, dispatch);
    const currentSelection = getState().game.workspace.draft.tableEntryId;
    const nextEntryId = currentSelection === entryId ? null : entryId;
    appendCommand(getState, dispatch, {
      kind: 'selectTableEntry',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        entryId: nextEntryId,
      },
    });
    if (nextEntryId) {
      dispatch(gameWorkspaceActions.chooseTableEntry(nextEntryId));
      const packet = getActiveRuntimePacket(getState().game.traffic);
      const selectedEntry = getState().game.table.entities[nextEntryId] ?? null;

      if (!selectedEntry || !isWorkbenchFocusedOnPacket(getState(), packet?.runtimeId ?? null)) {
        return;
      }

      appendCommand(getState, dispatch, {
        kind: 'applyTableEntry',
        packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
        payload: {
          entryId: nextEntryId,
        },
      });
      dispatch(
        gameWorkspaceActions.applyTableEntrySelection({
          entryId: nextEntryId,
          destination: {
            host: selectedEntry.internalHost,
            ...(selectedEntry.internalPort ? { port: selectedEntry.internalPort } : {}),
          },
        }),
      );
      return;
    }

    dispatch(gameWorkspaceActions.clearTableEntrySelection());
  };
export const applyTableEntrySelection = (): AppThunk => (dispatch, getState) => {
  if (isReadOnlyInspection(getState())) {
    return;
  }
  syncWorkbenchToActivePacket(getState, dispatch);
  const entryId = getState().game.workspace.draft.tableEntryId;
  const packet = getActiveRuntimePacket(getState().game.traffic);
  const selectedEntry = entryId ? getState().game.table.entities[entryId] ?? null : null;

  if (!entryId || !selectedEntry || !isWorkbenchFocusedOnPacket(getState(), packet?.runtimeId ?? null)) {
    return;
  }

  appendCommand(getState, dispatch, {
    kind: 'applyTableEntry',
    packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
    payload: {
      entryId,
    },
  });
  dispatch(
    gameWorkspaceActions.applyTableEntrySelection({
      entryId,
      destination: {
        host: selectedEntry.internalHost,
        ...(selectedEntry.internalPort ? { port: selectedEntry.internalPort } : {}),
      },
    }),
  );
};
export const clearFeedback = gameWorkspaceActions.clearFeedback;
export const setReferenceTab =
  (tab: ReferenceTab): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    appendCommand(getState, dispatch, {
      kind: 'setReferenceTab',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        tab,
      },
    });
    dispatch(gameWorkspaceActions.setReferenceTab(tab));
  };
export const setReferenceOpen =
  (isOpen: boolean): AppThunk =>
  (dispatch, getState) => {
    if (isReadOnlyInspection(getState())) {
      return;
    }
    appendCommand(getState, dispatch, {
      kind: 'setReferenceOpen',
      packetRuntimeId: getActiveRuntimePacket(getState().game.traffic)?.runtimeId ?? null,
      payload: {
        isOpen,
      },
    });
    dispatch(gameWorkspaceActions.setReferenceOpen(isOpen));
  };
export const setTableSortMode = gameTableViewActions.setTableSortMode;
export const setExternalPortFilter = gameTableViewActions.setExternalPortFilter;
export const setDestinationHostFilter = gameTableViewActions.setDestinationHostFilter;
