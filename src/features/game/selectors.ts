import { createSelector } from '@reduxjs/toolkit';

import { HANDBOOK_ACTIONS, HANDBOOK_GLOSSARY, UNIT_REFERENCES } from './docsContent';
import {
  findMatchingInboundEntries,
  findOutboundConflict,
  formatEndpoint,
  getCurrentDay,
} from './engine';
import { getScenarioPhase, isScenarioPhaseAtLeast } from './phases';
import { gameAuditAdapter } from './gameAuditSlice';
import { validateProgressState } from './progressIntegrity';
import { gameTrafficAdapter } from './gameTrafficSlice';
import { HOME_LABEL, scenarioDays, STAMP_DEFINITIONS, TABLE_COLUMN_LABELS } from './scenarios';
import { buildPacketLedgers, buildSessionExportSnapshot } from './sessionAnalytics';
import { validateTrafficState } from './sessionIntegrity';
import { gameTableAdapter } from './gameTableSlice';
import { getActiveRuntimePacket, getShiftGoalProgress } from './runtimeSession';
import type { HandbookAction, HandbookGlossaryEntry, TableColumnKey, TranslationTableEntry } from './types';
import type { RootState } from '../../app/store';

const selectGameProgress = (state: RootState) => state.game.progress;
const selectGameWorkspace = (state: RootState) => state.game.workspace;
const selectGameTable = (state: RootState) => state.game.table;
const selectGameAudit = (state: RootState) => state.game.audit;
const selectGameTableView = (state: RootState) => state.game.tableView;
const selectGameTraffic = (state: RootState) => state.game.traffic;

const tableSelectors = gameTableAdapter.getSelectors(selectGameTable);
const auditSelectors = gameAuditAdapter.getSelectors(selectGameAudit);
const trafficSelectors = gameTrafficAdapter.getSelectors(selectGameTraffic);
const isDefined = <T>(value: T | null | undefined): value is T => value != null;
const endpointsEqual = (
  left: { host: string; port?: string } | null,
  right: { host: string; port?: string } | null,
) =>
  left?.host === right?.host &&
  (left?.port ?? null) === (right?.port ?? null);

export const selectGameScreen = createSelector(selectGameProgress, (progress) => progress.screen);
export const selectRunHistory = createSelector(selectGameProgress, (progress) => progress.runHistory);
export const selectRunArchives = createSelector(selectGameProgress, (progress) => progress.runArchives);
export const selectActiveRunId = createSelector(selectGameProgress, (progress) => progress.activeRunId);
export const selectInspectedRunId = createSelector(selectGameProgress, (progress) => progress.inspectedRunId);
export const selectDayHistory = createSelector(selectGameProgress, (progress) => progress.dayHistory);
export const selectDayTransitions = createSelector(selectGameProgress, (progress) => progress.transitions);
export const selectUnlockedDayIds = createSelector(selectGameProgress, (progress) => progress.unlockedDayIds);
export const selectClearedDayIds = createSelector(selectGameProgress, (progress) => progress.clearedDayIds);
export const selectFailedDayIds = createSelector(selectGameProgress, (progress) => progress.failedDayIds);
export const selectCampaignRouteState = createSelector(selectGameProgress, (progress) => ({
  firstDayId: progress.firstDayId,
  currentDayId: progress.currentDayId,
  nextDayId: progress.nextDayId,
  activeRunId: progress.activeRunId,
  inspectedRunId: progress.inspectedRunId,
  unlockedDayIds: progress.unlockedDayIds,
  clearedDayIds: progress.clearedDayIds,
  failedDayIds: progress.failedDayIds,
}));
export const selectFeedback = createSelector(selectGameWorkspace, (workspace) => workspace.feedback);
export const selectLastResolution = createSelector(
  selectGameProgress,
  (progress) => progress.lastResolution,
);
export const selectWorkbenchDraft = createSelector(
  selectGameWorkspace,
  (workspace) => workspace.draft,
);
export const selectWorkbenchDocument = createSelector(
  selectGameWorkspace,
  (workspace) => workspace.document,
);
export const selectSuspendedWorkbenchPackets = createSelector(
  selectGameWorkspace,
  (workspace) => workspace.suspendedPackets,
);
export const selectWorkbenchPlacement = createSelector(
  selectWorkbenchDocument,
  (document) => document.placement,
);
export const selectDraftStampId = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.stampId,
);
export const selectDraftRouteTargetId = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.routeTargetId,
);
export const selectAppliedStampId = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.appliedStampId,
);
export const selectAppliedRouteTargetId = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.appliedRouteTargetId,
);
export const selectDraftTableEntryId = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.tableEntryId,
);
export const selectAppliedTableEntryId = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.appliedTableEntryId,
);
export const selectSelectedStampId = selectDraftStampId;
export const selectSelectedTableEntryId = selectDraftTableEntryId;
export const selectWorkbenchDispatchIntent = createSelector(
  selectWorkbenchDraft,
  (draft) => draft.dispatchIntent,
);
export const selectReferenceTab = createSelector(selectGameWorkspace, (workspace) => workspace.referenceTab);
export const selectReferenceOpen = createSelector(selectGameWorkspace, (workspace) => workspace.referenceOpen);
export const selectTableViewState = createSelector(selectGameTableView, (tableView) => tableView);

export const selectCurrentDay = createSelector(selectGameProgress, (progress) => getCurrentDay(progress));
export const selectNextDay = createSelector(selectGameProgress, (progress) =>
  progress.nextDayId ? scenarioDays.find((day) => day.id === progress.nextDayId) ?? null : null,
);
export const selectAvailableVerdicts = createSelector(
  [selectCurrentDay],
  (day): Array<'ACCEPT' | 'REJECT'> => day?.availableVerdicts ?? ['ACCEPT', 'REJECT'],
);

export const selectTrafficPackets = createSelector(
  [selectGameTraffic, trafficSelectors.selectEntities],
  (traffic, entities) => traffic.packetOrder.map((packetId) => entities[packetId]).filter(isDefined),
);
export const selectTrafficActionResults = createSelector(
  selectGameTraffic,
  (traffic) => traffic.actionResults,
);
export const selectTrafficCommands = createSelector(
  selectGameTraffic,
  (traffic) => traffic.commandHistory,
);
export const selectTrafficResolvedTurns = createSelector(
  selectGameTraffic,
  (traffic) => traffic.resolvedTurns,
);
export const selectCurrentTurnState = createSelector(
  selectGameTraffic,
  (traffic) => traffic.currentTurn,
);
export const selectTrafficSessionEvents = createSelector(
  selectGameTraffic,
  (traffic) => traffic.sessionEvents,
);
export const selectTrafficCheckpoints = createSelector(
  selectGameTraffic,
  (traffic) => traffic.checkpoints,
);
export const selectTrafficObjectives = createSelector(selectGameTraffic, (traffic) => traffic.objectives);
export const selectTrafficSessionStatus = createSelector(selectGameTraffic, (traffic) => traffic.sessionStatus);
export const selectCurrentPacket = createSelector(selectGameTraffic, (traffic) => getActiveRuntimePacket(traffic));
export const selectIsWorkbenchBoundToCurrentPacket = createSelector(
  [selectWorkbenchDraft, selectCurrentPacket],
  (draft, packet) => {
    if (!packet) {
      return draft.packetRuntimeId === null;
    }

    return draft.packetRuntimeId === packet.runtimeId;
  },
);

export const selectTableEntries = tableSelectors.selectAll;

export const selectAuditLog = createSelector(auditSelectors.selectAll, (entries) =>
  entries.slice().sort((left, right) => right.sequence - left.sequence),
);
const selectAuditEntriesAscending = auditSelectors.selectAll;

export const selectTableColumns = createSelector(selectCurrentDay, (day) =>
  day ? day.rules.columns.map((key) => ({ key, label: TABLE_COLUMN_LABELS[key] })) : [],
);

export const selectMatchingTableEntryIds = createSelector(
  [selectCurrentDay, selectCurrentPacket, selectTableEntries],
  (day, packet, tableEntries) => {
    if (!day) {
      return [];
    }

    return findMatchingInboundEntries(day, packet, tableEntries).map((entry) => entry.id);
  },
);

export const selectStampOptions = createSelector(
  [selectCurrentDay, selectCurrentPacket, selectDraftStampId, selectTableEntries],
  (day, packet, draftStampId, tableEntries) => {
    if (!day) {
      return [];
    }

    return day.availableStamps.map((stampId) => {
      const definition = STAMP_DEFINITIONS[stampId];
      const conflictEntry = findOutboundConflict(day, packet, stampId, tableEntries);
      const isInUse = tableEntries.some((entry) => entry.externalPort === stampId);
      const isRequired =
        packet?.expectation.verdict === 'ACCEPT' &&
        packet.expectation.flow === 'outbound' &&
        packet.expectation.requiredStampId === stampId;

      return {
        ...definition,
        label: stampId === 'home' ? HOME_LABEL : `${HOME_LABEL}:${definition.label}`,
        conflictEntryId: conflictEntry?.id ?? null,
        isInUse,
        isSelected: draftStampId === stampId,
        isRequired,
        isUnavailable: conflictEntry !== null,
      };
    });
  },
);

export const selectDraftStampSummary = createSelector([selectDraftStampId], (draftStampId) =>
  draftStampId
    ? {
        id: draftStampId,
        label: draftStampId === 'home' ? HOME_LABEL : `${HOME_LABEL}:${STAMP_DEFINITIONS[draftStampId].label}`,
      }
    : null,
);

export const selectAppliedStampSummary = createSelector([selectAppliedStampId], (appliedStampId) =>
  appliedStampId
    ? {
        id: appliedStampId,
        label: appliedStampId === 'home' ? HOME_LABEL : `${HOME_LABEL}:${STAMP_DEFINITIONS[appliedStampId].label}`,
      }
    : null,
);

export const selectDraftRouteTargetSummary = createSelector(
  [selectCurrentPacket, selectDraftRouteTargetId],
  (packet, draftRouteTargetId) => {
    if (!packet || !draftRouteTargetId) {
      return null;
    }

    const target = (packet.routeTargets ?? []).find((candidate) => {
      const candidateId = candidate.port ? `${candidate.host}:${candidate.port}` : candidate.host;
      return candidateId === draftRouteTargetId;
    });

    return target
      ? {
          id: draftRouteTargetId,
          label: formatEndpoint(target),
        }
      : null;
  },
);

export const selectAppliedRouteTargetSummary = createSelector(
  [selectCurrentPacket, selectAppliedRouteTargetId],
  (packet, appliedRouteTargetId) => {
    if (!packet || !appliedRouteTargetId) {
      return null;
    }

    const target = (packet.routeTargets ?? []).find((candidate) => {
      const candidateId = candidate.port ? `${candidate.host}:${candidate.port}` : candidate.host;
      return candidateId === appliedRouteTargetId;
    });

    return target
      ? {
          id: appliedRouteTargetId,
          label: formatEndpoint(target),
        }
      : null;
  },
);

export const selectPacketPresentation = createSelector(
  [selectCurrentPacket, selectWorkbenchDocument],
  (packet, workbenchDocument) => {
    if (!packet) {
      return null;
    }

    const outboundSelectedStamp =
      workbenchDocument.packetRuntimeId === packet.runtimeId &&
      workbenchDocument.source?.host === HOME_LABEL
        ? workbenchDocument.source.port
          ? STAMP_DEFINITIONS[workbenchDocument.source.port as keyof typeof STAMP_DEFINITIONS].label
          : HOME_LABEL
        : null;
    const inboundPort = packet.packet.destination.port;
    const inboundStampLabel =
      inboundPort && inboundPort in STAMP_DEFINITIONS
        ? STAMP_DEFINITIONS[inboundPort as keyof typeof STAMP_DEFINITIONS].label
        : inboundPort ?? 'なし';

    return {
      id: packet.id,
      runtimeId: packet.runtimeId,
      direction: packet.packet.direction,
      directionLabel: packet.packet.direction === 'lanToWan' ? 'LAN -> WAN' : 'WAN -> LAN',
      sourceLabel: formatEndpoint(packet.packet.source),
      sourceHostLabel: packet.packet.source.host,
      sourcePortLabel: packet.packet.source.port ?? null,
      destinationLabel: formatEndpoint(packet.packet.destination),
      destinationHostLabel: packet.packet.destination.host,
      destinationPortLabel: packet.packet.destination.port ?? null,
      externalPortLabel:
        packet.packet.direction === 'lanToWan' ? outboundSelectedStamp ?? '未設定' : inboundStampLabel,
      protocolLabel: packet.packet.protocol ?? 'N/A',
      cycleIndex: packet.cycleIndex,
      variantLabel: packet.variantId
        ? `${packet.variantGroup ?? 'traffic'}:${packet.variantId}`
        : packet.spawnSource === 'repeatUntilIncident'
          ? 'repeat'
          : null,
      note: packet.packet.note,
      prompt: packet.prompt,
    };
  },
);

export const selectSelectedTableEntry = createSelector(
  [selectGameTable, selectAppliedTableEntryId],
  (table, selectedEntryId) => (selectedEntryId ? table.entities[selectedEntryId] ?? null : null),
);

export const selectDraftTableEntrySummary = createSelector(
  [selectGameTable, selectDraftTableEntryId],
  (table, selectedEntryId) =>
    selectedEntryId
      ? table.entities[selectedEntryId]
        ? {
            id: selectedEntryId,
            label: formatEndpoint({
              host: table.entities[selectedEntryId]!.internalHost,
              port: table.entities[selectedEntryId]!.internalPort,
            }),
          }
        : null
      : null,
);

export const selectSelectedTableEntrySummary = createSelector(
  [selectSelectedTableEntry],
  (entry) =>
    entry
      ? {
          id: entry.id,
          label: formatEndpoint({
            host: entry.internalHost,
            port: entry.internalPort,
          }),
        }
      : null,
);

export const selectPacketRewritePreview = createSelector(
  [selectCurrentDay, selectCurrentPacket, selectWorkbenchDocument],
  (day, packet, workbenchDocument) => {
    if (!day || !packet) {
      return {
        source: null,
        destination: null,
      };
    }
    const isBoundDocument = workbenchDocument.packetRuntimeId === packet.runtimeId;
    const source =
      packet.packet.direction === 'lanToWan' &&
      isBoundDocument &&
      workbenchDocument.source &&
      !endpointsEqual(workbenchDocument.source, packet.packet.source)
        ? formatEndpoint(workbenchDocument.source)
        : null;

    const destination =
      isBoundDocument &&
      workbenchDocument.destinationApplied &&
      workbenchDocument.destination &&
      ((day.phaseId === 'directRouting') ||
        (packet.packet.direction === 'wanToLan' &&
          !endpointsEqual(workbenchDocument.destination, packet.packet.destination)))
        ? formatEndpoint(workbenchDocument.destination)
        : null;

    return {
      source,
      destination,
    };
  },
);

export const selectIncomingPacketPreview = createSelector(
  [selectCurrentPacket, selectWorkbenchDocument, selectSuspendedWorkbenchPackets],
  (packet, document, suspendedPackets) =>
    packet && document.packetRuntimeId === packet.runtimeId
      ? {
          runtimeId: packet.runtimeId,
          direction: packet.packet.direction,
          sourceLabel: formatEndpoint(packet.packet.source),
          destinationLabel: formatEndpoint(packet.packet.destination),
          prompt: packet.prompt,
          pendingAge: packet.pendingAge,
          maxPendingAge: packet.maxPendingAge,
          placement: document.placement,
          hasSuspendedDraft: Boolean(suspendedPackets[packet.runtimeId]),
        }
      : null,
);

export const selectIncomingPacketPreviews = createSelector(
  [selectGameTraffic, trafficSelectors.selectEntities, selectSuspendedWorkbenchPackets],
  (traffic, entities, suspendedPackets) =>
    traffic.pendingPacketIds
      .map((packetId) => entities[packetId])
      .filter(isDefined)
      .map((packet) => ({
        runtimeId: packet.runtimeId,
        direction: packet.packet.direction,
        sourceLabel: formatEndpoint(packet.packet.source),
        destinationLabel: formatEndpoint(packet.packet.destination),
        prompt: packet.prompt,
        pendingAge: packet.pendingAge,
        maxPendingAge: packet.maxPendingAge,
        placement: 'inbox' as const,
        hasSuspendedDraft: Boolean(suspendedPackets[packet.runtimeId]),
      })),
);

export const selectUpcomingPacketCount = createSelector(
  [selectGameTraffic],
  (traffic) => traffic.upcomingPacketIds.length,
);

export const selectRouteSlipTargets = createSelector(
  [
    selectCurrentDay,
    selectCurrentPacket,
    selectMatchingTableEntryIds,
    selectTableEntries,
    selectDraftRouteTargetId,
    selectAppliedRouteTargetId,
    selectAppliedTableEntryId,
  ],
  (
    day,
    packet,
    matchingEntryIds,
    tableEntries,
    draftRouteTargetId,
    appliedRouteTargetId,
    appliedTableEntryId,
  ) => {
    if (!day || !packet) {
      return [];
    }

    if (day.phaseId === 'directRouting') {
      return (packet.routeTargets ?? []).map((target) => {
        const id = target.port ? `${target.host}:${target.port}` : target.host;
        const expectedTarget =
          packet.expectation.verdict === 'ACCEPT' && packet.expectation.flow === 'outbound'
            ? packet.packet.destination
            : packet.expectation.verdict === 'ACCEPT' && packet.expectation.flow === 'inbound'
              ? packet.expectation.expectedTarget
              : packet.packet.destination;

        return {
          id,
          headerLabel: packet.packet.direction === 'lanToWan' ? '宛先札' : '戻し先札',
          label: formatEndpoint(target),
          detailLabel: packet.packet.direction === 'lanToWan' ? '右へ送る相手' : '左へ戻す相手',
          isMatching: endpointsEqual(target, expectedTarget),
          isSelected: appliedRouteTargetId === id,
          isDraft: draftRouteTargetId === id,
        };
      });
    }

    if (day.phaseId === 'natBasics') {
      return tableEntries.map((entry) => ({
          id: entry.id,
          headerLabel: entry.externalHost,
          label: formatEndpoint({
            host: entry.internalHost,
            port: entry.internalPort,
          }),
          detailLabel: `${entry.externalHost} への返信をこの端末へ戻す`,
          isMatching: matchingEntryIds.includes(entry.id),
          isSelected: appliedTableEntryId === entry.id,
          isDraft: false,
          ambiguityCount: tableEntries.filter((candidate) => candidate.externalHost === entry.externalHost).length,
        }));
    }

    return [];
  },
);

export const selectWorkbenchStatus = createSelector(
  [
    selectCurrentDay,
    selectCurrentPacket,
    selectPacketRewritePreview,
    selectWorkbenchPlacement,
    selectIsWorkbenchBoundToCurrentPacket,
    selectDraftStampId,
    selectDraftRouteTargetId,
    selectAppliedRouteTargetId,
    selectMatchingTableEntryIds,
    selectDraftTableEntrySummary,
    selectSelectedTableEntrySummary,
    selectWorkbenchDispatchIntent,
  ],
  (
    day,
    packet,
    packetRewritePreview,
    placement,
    isWorkbenchBoundToCurrentPacket,
    draftStampId,
    draftRouteTargetId,
    appliedRouteTargetId,
    matchingEntryIds,
    draftEntrySummary,
    selectedEntrySummary,
    dispatchIntent,
  ) => {
    if (!packet) {
      return {
        canCommit: false,
        dispatchIntent,
        routeSummary: null,
        steps: [] as Array<{ id: string; label: string; status: 'pending' | 'ready' }>,
      };
    }

    if (day?.phaseId === 'directRouting') {
      const routedDestination = packetRewritePreview.destination;

      return {
        canCommit: Boolean(
          placement === 'workbench' &&
            isWorkbenchBoundToCurrentPacket &&
            dispatchIntent &&
            appliedRouteTargetId &&
            routedDestination,
        ),
        dispatchIntent,
        routeSummary: routedDestination ? `${formatEndpoint(packet.packet.source)} -> ${routedDestination}` : null,
        steps: [
          {
            id: 'pick',
            label: draftRouteTargetId ? `宛先候補 ${draftRouteTargetId}` : '宛先札を選ぶ',
            status: draftRouteTargetId ? ('ready' as const) : ('pending' as const),
          },
          {
            id: 'route',
            label: routedDestination ? `DST ${routedDestination}` : 'DST 適用待ち',
            status: routedDestination ? ('ready' as const) : ('pending' as const),
          },
          {
            id: 'dispatch',
            label:
              dispatchIntent === 'ACCEPT'
                ? packet.packet.direction === 'lanToWan'
                  ? '右へ通す'
                  : '左へ戻す'
                : packet.packet.direction === 'lanToWan'
                  ? '外へ出さない'
                  : '内側へ戻さない',
            status: dispatchIntent ? ('ready' as const) : ('pending' as const),
          },
        ],
      };
    }

    if (packet.packet.direction === 'lanToWan') {
      const rewrittenSource = packetRewritePreview.source;
      const selectedSource =
        draftStampId ? `${HOME_LABEL}:${STAMP_DEFINITIONS[draftStampId].label}` : null;

      return {
        canCommit: Boolean(placement === 'workbench' && isWorkbenchBoundToCurrentPacket && dispatchIntent && rewrittenSource),
        dispatchIntent,
        routeSummary: rewrittenSource ? `${rewrittenSource} -> ${formatEndpoint(packet.packet.destination)}` : null,
        steps: [
          {
            id: 'pick',
            label: selectedSource ? `色候補 ${selectedSource}` : '色を選ぶ',
            status: selectedSource ? ('ready' as const) : ('pending' as const),
          },
          {
            id: 'rewrite',
            label: rewrittenSource ? `SRC ${rewrittenSource}` : 'SRC 書き換え待ち',
            status: rewrittenSource ? ('ready' as const) : ('pending' as const),
          },
          {
            id: 'dispatch',
            label:
              dispatchIntent === 'ACCEPT'
                ? '右へ通す'
                : dispatchIntent === 'REJECT'
                  ? '外へ出さない'
                  : '送出判断待ち',
            status: dispatchIntent ? ('ready' as const) : ('pending' as const),
          },
        ],
      };
    }

    return {
      canCommit: Boolean(placement === 'workbench' && isWorkbenchBoundToCurrentPacket && dispatchIntent && selectedEntrySummary),
      dispatchIntent,
      routeSummary: selectedEntrySummary ? `${formatEndpoint(packet.packet.source)} -> ${selectedEntrySummary.label}` : null,
      steps: [
        {
          id: 'pick',
          label:
            draftEntrySummary
              ? `行候補 ${draftEntrySummary.label}`
              : matchingEntryIds.length === 0
                ? '一致行なし'
                : matchingEntryIds.length === 1
                  ? '候補 1件'
                  : `候補 ${matchingEntryIds.length}件`,
          status: draftEntrySummary ? ('ready' as const) : ('pending' as const),
        },
        {
          id: 'lookup',
          label:
            selectedEntrySummary
              ? `DST ${selectedEntrySummary.label}`
              : 'DST 復元待ち',
          status: selectedEntrySummary ? ('ready' as const) : ('pending' as const),
        },
        {
          id: 'dispatch',
          label:
            dispatchIntent === 'ACCEPT'
              ? '左へ戻す'
              : dispatchIntent === 'REJECT'
                ? '内側へ戻さない'
                : '送出判断待ち',
          status: dispatchIntent ? ('ready' as const) : ('pending' as const),
        },
      ],
    };
  },
);

export const selectDayProgress = createSelector(
  [selectTrafficPackets, selectGameTraffic],
  (packets, traffic) =>
    packets.length > 0
      ? {
          current: traffic.resolvedPacketIds.length,
          total: packets.length,
        }
      : null,
);

export const selectRuntimeQueueSummary = createSelector(
  [selectTrafficPackets, selectGameTraffic, selectTrafficObjectives],
  (packets, traffic, objectives) => ({
    runId: traffic.runId,
    totalPackets: packets.length,
    resolvedPackets: traffic.resolvedPacketIds.length,
    pendingPackets: traffic.pendingPacketIds.length + (traffic.activePacketId ? 1 : 0),
    upcomingPackets: traffic.upcomingPacketIds.length,
    activePacketId: traffic.activePacketId,
    pendingObjectives: objectives.filter((objective) => objective.status === 'pending').length,
    satisfiedObjectives: objectives.filter((objective) => objective.status === 'satisfied').length,
    sessionStatus: traffic.sessionStatus,
  }),
);

export const selectTrafficBoard = createSelector(
  [selectTrafficPackets, selectGameTraffic, selectTrafficActionResults],
  (packets, traffic, actionResults) => {
    const latestIncidentByPacket = new Map(
      actionResults
        .filter((result) => result.packetRuntimeId && result.causedIncident)
        .map((result) => [result.packetRuntimeId!, true] as const),
    );

    const items = packets.map((packet) => ({
      runtimeId: packet.runtimeId,
      direction: packet.packet.direction,
      sourceLabel: formatEndpoint(packet.packet.source),
      destinationLabel: formatEndpoint(packet.packet.destination),
      cycleIndex: packet.cycleIndex,
      variantLabel: packet.variantId ? `${packet.variantGroup ?? 'traffic'}:${packet.variantId}` : null,
      status: packet.status,
      causedIncident: latestIncidentByPacket.get(packet.runtimeId) ?? false,
      isActive: packet.runtimeId === traffic.activePacketId,
    }));

    return {
      items,
      laneSummary: {
        lanToWan: items.filter((item) => item.direction === 'lanToWan').length,
        wanToLan: items.filter((item) => item.direction === 'wanToLan').length,
        activeLanToWan: items.filter((item) => item.direction === 'lanToWan' && item.isActive).length,
        activeWanToLan: items.filter((item) => item.direction === 'wanToLan' && item.isActive).length,
      },
    };
  },
);

export const selectRunHistorySummary = createSelector(selectRunHistory, (runHistory) => ({
  total: runHistory.length,
  active: runHistory.filter((run) => run.status === 'active').length,
  clears: runHistory.filter((run) => run.status === 'clear').length,
  failures: runHistory.filter((run) => run.status === 'failure').length,
  abandoned: runHistory.filter((run) => run.status === 'abandoned').length,
  latest: runHistory[runHistory.length - 1] ?? null,
}));

export const selectRunArchiveSummary = createSelector(selectRunArchives, (runArchives) => ({
  total: runArchives.length,
  latest: runArchives[runArchives.length - 1] ?? null,
  totalActions: runArchives.reduce((sum, archive) => sum + archive.actionCount, 0),
  totalIncidents: runArchives.reduce((sum, archive) => sum + archive.incidentCount, 0),
  abandoned: runArchives.filter((archive) => archive.archiveReason === 'abandoned').length,
  resolved: runArchives.filter((archive) => archive.archiveReason === 'resolved').length,
  byResolution: Object.entries(
    runArchives.reduce<Record<string, number>>((accumulator, archive) => {
      const key = archive.resolutionKind ?? 'unresolved';
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([kind, count]) => ({ kind, count })),
}));

export const selectInspectedRunArchive = createSelector(
  [selectRunArchives, selectInspectedRunId],
  (runArchives, inspectedRunId) =>
    runArchives.find((archive) => archive.runId === inspectedRunId) ?? null,
);
export const selectIsArchiveInspection = createSelector(
  [selectInspectedRunId, selectActiveRunId],
  (inspectedRunId, activeRunId) => inspectedRunId !== null && activeRunId === null,
);
export const selectArchiveList = createSelector(selectRunArchives, (runArchives) =>
  runArchives
    .slice()
    .reverse()
    .map((archive) => ({
      runId: archive.runId,
      dayId: archive.dayId,
      title: archive.title,
      archiveReason: archive.archiveReason,
      resolutionKind: archive.resolutionKind,
      actionCount: archive.actionCount,
      incidentCount: archive.incidentCount,
    })),
);

export const selectPacketLedgers = createSelector(selectGameTraffic, (traffic) =>
  buildPacketLedgers(traffic),
);

export const selectPacketLedgerSummary = createSelector(selectPacketLedgers, (packetLedgers) => ({
  total: packetLedgers.length,
  repeatedPackets: packetLedgers.filter((ledger) => ledger.spawnSource === 'repeatUntilIncident').length,
  incidentPackets: packetLedgers.filter((ledger) => ledger.incidentKinds.length > 0).length,
  unresolvedPackets: packetLedgers.filter((ledger) => ledger.resolvedByActionId == null).length,
  latest: packetLedgers.at(-1) ?? null,
}));

export const selectObjectiveSummary = createSelector(selectTrafficObjectives, (objectives) => ({
  total: objectives.length,
  pending: objectives.filter((objective) => objective.status === 'pending').length,
  satisfied: objectives.filter((objective) => objective.status === 'satisfied').length,
  entries: objectives,
}));

export const selectSessionEventSummary = createSelector(selectTrafficSessionEvents, (events) => ({
  total: events.length,
  byKind: Object.entries(
    events.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.kind] = (accumulator[event.kind] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([kind, count]) => ({ kind, count })),
  latest: events[events.length - 1] ?? null,
}));

export const selectCheckpointSummary = createSelector(selectTrafficCheckpoints, (checkpoints) => ({
  total: checkpoints.length,
  latest: checkpoints[checkpoints.length - 1] ?? null,
  byReason: Object.entries(
    checkpoints.reduce<Record<string, number>>((accumulator, checkpoint) => {
      accumulator[checkpoint.reason] = (accumulator[checkpoint.reason] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([reason, count]) => ({ reason, count })),
}));

export const selectTransitionSummary = createSelector(selectDayTransitions, (transitions) => ({
  total: transitions.length,
  latest: transitions[transitions.length - 1] ?? null,
  byEdge: Object.entries(
    transitions.reduce<Record<string, number>>((accumulator, transition) => {
      accumulator[transition.selectedEdge] = (accumulator[transition.selectedEdge] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([edge, count]) => ({ edge, count })),
}));

export const selectReplayTimeline = createSelector(
  [
    selectTrafficCommands,
    selectTrafficResolvedTurns,
    selectTrafficSessionEvents,
    selectTrafficCheckpoints,
    selectPacketLedgers,
    selectDayTransitions,
    selectRunArchives,
  ],
  (commands, turns, events, checkpoints, packetLedgers, transitions, runArchives) => ({
    commands,
    turns,
    events,
    checkpoints,
    packetLedgers,
    transitions,
    runArchives,
  }),
);

export const selectCommandSummary = createSelector(selectTrafficCommands, (commands) => ({
  total: commands.length,
  byKind: Object.entries(
    commands.reduce<Record<string, number>>((accumulator, command) => {
      accumulator[command.kind] = (accumulator[command.kind] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([kind, count]) => ({ kind, count })),
  latest: commands[commands.length - 1] ?? null,
}));

export const selectCurrentTurnSummary = createSelector(
  [selectCurrentTurnState, selectTrafficCommands],
  (currentTurn, commands) => ({
    packetRuntimeId: currentTurn.packetRuntimeId,
    commandCount: currentTurn.commandIds.length,
    commands: currentTurn.commandIds
      .map((commandId) => commands.find((command) => command.id === commandId))
      .filter(isDefined),
  }),
);

export const selectSessionIntegrityReport = createSelector(
  [selectGameTraffic, selectCurrentDay, selectTableEntries],
  (traffic, day, tableEntries) => {
    const issues = validateTrafficState(traffic, day, tableEntries);

    return {
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    };
  },
);

export const selectProgressIntegrityReport = createSelector(selectGameProgress, (progress) => {
  const issues = validateProgressState(progress);

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
});

export const selectRuleSummary = createSelector(selectCurrentDay, (day) => {
  if (!day) {
    return [];
  }

  return [
    `学習目標: ${day.learningGoal}`,
    `照合キー: ${day.rules.inboundLookupKeys.map((key) => TABLE_COLUMN_LABELS[key]).join(' / ')}`,
    `有効列: ${day.rules.columns.map((key) => TABLE_COLUMN_LABELS[key]).join(' / ')}`,
    `外側ポート運用: ${day.rules.portReusePolicy === 'exclusive' ? '通信ごとに専有' : '照合キーごとに再利用'}`,
  ];
});

export const selectMechanicFlags = createSelector(selectCurrentDay, (day) => {
  const columns = day?.rules.columns ?? [];

  return {
    usesExternalPort: columns.includes('externalPort'),
    usesDestinationHost: columns.includes('destinationHost'),
    usesDestinationService: columns.includes('destinationService'),
    usesInternalPort: columns.includes('internalPort'),
    usesProtocol: columns.includes('protocol'),
    usesTimeoutManagement: (day?.unit ?? 0) >= 7,
    usesPortExhaustionRules: (day?.unit ?? 0) >= 8,
  };
});

const filterAndSortTableEntries = (
  entries: TranslationTableEntry[],
  tableView: ReturnType<typeof selectTableViewState>,
) => {
  const normalizedDestinationFilter = tableView.filterDestinationHost.trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    if (tableView.filterExternalPort !== 'all' && entry.externalPort !== tableView.filterExternalPort) {
      return false;
    }

    if (
      normalizedDestinationFilter.length > 0 &&
      !(entry.destinationHost ?? '').toLowerCase().includes(normalizedDestinationFilter)
    ) {
      return false;
    }

    return true;
  });

  if (tableView.sortMode === 'newest') {
    return filtered.slice().reverse();
  }

  if (tableView.sortMode === 'remainingTime') {
    return filtered.slice().sort((left, right) => left.remainingTurns - right.remainingTurns);
  }

  return filtered;
};

export const selectVisibleTableEntries = createSelector(
  [selectTableEntries, selectTableViewState],
  (entries, tableView) => filterAndSortTableEntries(entries, tableView),
);

const getEntryStatusLabel = (entry: TranslationTableEntry) => {
  if (entry.remainingTurns <= 2) {
    return '期限切れ間近';
  }

  return entry.lifecycleState === 'active' ? '通信中' : '待機中';
};

export const selectTableRows = createSelector(
  [selectVisibleTableEntries, selectCurrentDay],
  (entries, day) => {
    if (!day) {
      return [];
    }

    return entries.map((entry) => ({
      id: entry.id,
      cells: day.rules.columns.map((column) => stringifyColumn(entry, column)),
      statusLabel: getEntryStatusLabel(entry),
      remainingTurns: entry.remainingTurns,
      maxRemainingTurns: entry.maxRemainingTurns,
    }));
  },
);

export const selectTableFilterOptions = createSelector(selectCurrentDay, (day) => {
  const stampIds = day?.availableStamps ?? [];

  return [
    { value: 'all' as const, label: 'すべての色' },
    ...stampIds.map((stampId) => ({
      value: stampId,
      label: STAMP_DEFINITIONS[stampId].label,
    })),
  ];
});

export const selectCatalogSummary = createSelector(selectGameProgress, () => ({
  totalDays: scenarioDays.length,
  totalUnits: new Set(scenarioDays.map((day) => day.unit)).size,
}));

export const selectCampaignSummary = createSelector(
  [selectAuditLog, selectCurrentDay, selectRunHistory, selectUnlockedDayIds, selectClearedDayIds, selectFailedDayIds],
  (auditLog, currentDay, runHistory, unlockedDayIds, clearedDayIds, failedDayIds) => ({
    clearedDays: clearedDayIds.length,
    totalRuns: runHistory.length,
    unlockedDays: unlockedDayIds.length,
    clearedUniqueDays: clearedDayIds.length,
    failedUniqueDays: failedDayIds.length,
    totalLogs: auditLog.length,
    accepts: auditLog.filter((entry) => entry.action === 'ACCEPT').length,
    rejects: auditLog.filter((entry) => entry.action === 'REJECT').length,
    closes: auditLog.filter((entry) => entry.action === 'CLOSE').length,
    timeouts: auditLog.filter((entry) => entry.action === 'TIMEOUT').length,
    blocked: auditLog.filter((entry) => entry.outcome === 'blocked').length,
    failures: auditLog.filter((entry) => entry.outcome === 'failed').length,
    currentDayNumber: currentDay?.dayNumber ?? 0,
  }),
);

export const selectResolutionUnlockSummary = createSelector(
  [selectCurrentDay, selectNextDay],
  (currentDay, nextDay) => {
    if (!currentDay || !nextDay) {
      return null;
    }

    const addedColumns = nextDay.rules.columns
      .filter((column) => !currentDay.rules.columns.includes(column))
      .map((column) => TABLE_COLUMN_LABELS[column]);
    const addedStamps = nextDay.availableStamps
      .filter((stampId) => !currentDay.availableStamps.includes(stampId))
      .map((stampId) => STAMP_DEFINITIONS[stampId].label);
    const addedActions = (nextDay.availableVerdicts ?? ['ACCEPT', 'REJECT'])
      .filter((verdict) => !(currentDay.availableVerdicts ?? ['ACCEPT', 'REJECT']).includes(verdict))
      .map((verdict) => (verdict === 'REJECT' ? 'REJECT / 拒否' : 'ACCEPT / 通す'));
    const unlockedTools: string[] = [];

    if (
      !isScenarioPhaseAtLeast(currentDay, 'destinationHost') &&
      isScenarioPhaseAtLeast(nextDay, 'destinationHost')
    ) {
      unlockedTools.push('流量監視盤');
    }

    return {
      nextDayNumber: nextDay.dayNumber,
      nextDayTitle: nextDay.title,
      nextDaySummary: nextDay.summary,
      addedColumns,
      addedStamps,
      addedActions,
      unlockedTools,
      hasUnlocks:
        addedColumns.length > 0 ||
        addedStamps.length > 0 ||
        addedActions.length > 0 ||
        unlockedTools.length > 0,
    };
  },
);

export const selectCampaignHistoryBreakdown = createSelector(selectDayHistory, (dayHistory) => ({
  clearRuns: dayHistory.filter((entry) => entry.kind === 'clear').length,
  failureRuns: dayHistory.filter((entry) => entry.kind === 'failure').length,
  totalIncidents: dayHistory.reduce((sum, entry) => sum + entry.incidentCount, 0),
  outcomeBreakdown: Object.entries(
    dayHistory.reduce<Record<string, number>>((accumulator, entry) => {
      for (const outcome of entry.outcomeBreakdown) {
        accumulator[outcome.code] = (accumulator[outcome.code] ?? 0) + outcome.count;
      }

      return accumulator;
    }, {}),
  ).map(([code, count]) => ({ code, count })),
  incidentBreakdown: Object.entries(
    dayHistory.reduce<Record<string, number>>((accumulator, entry) => {
      for (const incident of entry.incidentBreakdown) {
        accumulator[incident.kind] = (accumulator[incident.kind] ?? 0) + incident.count;
      }

      return accumulator;
    }, {}),
  ).map(([kind, count]) => ({ kind, count })),
}));

export const selectSessionExportSnapshot = createSelector(
  [selectCurrentDay, selectGameProgress, selectGameTraffic, selectGameTable, selectAuditEntriesAscending, selectGameAudit],
  (day, progress, traffic, table, auditEntries, audit) =>
    buildSessionExportSnapshot(
      day,
      progress,
      traffic,
      table,
      auditEntries.filter((entry) => entry.runId === traffic.runId),
      audit.nextSequence,
    ),
);

export const selectDayRuntimeSummary = createSelector(selectTrafficActionResults, (results) => ({
  actions: results.length,
  judgements: results.filter((result) => result.action === 'ACCEPT' || result.action === 'REJECT').length,
  closes: results.filter((result) => result.action === 'CLOSE').length,
  incidents: results.filter((result) => result.causedIncident).length,
  successes: results.filter(
    (result) =>
      !result.causedIncident &&
      result.outcomeCode !== 'returnedForRoute' &&
      result.outcomeCode !== 'returnedForRewrite' &&
      result.outcomeCode !== 'returnedForLookup',
  ).length,
  outcomeBreakdown: Object.entries(
    results.reduce<Record<string, number>>((accumulator, result) => {
      accumulator[result.outcomeCode] = (accumulator[result.outcomeCode] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([code, count]) => ({ code, count })),
  incidentBreakdown: Object.entries(
    results.reduce<Record<string, number>>((accumulator, result) => {
      if (!result.incidentKind) {
        return accumulator;
      }

      accumulator[result.incidentKind] = (accumulator[result.incidentKind] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([kind, count]) => ({ kind, count })),
}));

export const selectShiftGoalSummary = createSelector(
  [selectCurrentDay, selectGameTraffic],
  (day, traffic) => {
    if (!day?.shiftGoal) {
      return null;
    }

    const progress = getShiftGoalProgress(day, traffic);

    return {
      requiredSuccesses: progress.requiredSuccesses,
      requiredRejects: progress.requiredRejects,
      requiredCloses: progress.requiredCloses,
      maxIncidents: progress.maxIncidents,
      maxActions: progress.maxActions,
      actionsElapsed: progress.actionsElapsed,
      remainingActions: progress.remainingActions,
      successes: progress.successes,
      rejects: progress.rejects,
      closes: progress.closes,
      incidents: progress.incidents,
      isComplete: progress.isComplete,
      exceededIncidentLimit: progress.exceededIncidentLimit,
      exhaustedActionBudget: progress.exhaustedActionBudget,
    };
  },
);

export const selectResolutionDossier = createSelector(
  [
    selectCurrentDay,
    selectGameTraffic,
    tableSelectors.selectAll,
    selectSuspendedWorkbenchPackets,
    selectShiftGoalSummary,
    selectTrafficActionResults,
  ],
  (day, traffic, tableEntries, suspendedPackets, shiftGoalSummary, actionResults) => {
    if (!day) {
      return null;
    }

    const unresolvedPackets =
      (traffic.activePacketId ? 1 : 0) + traffic.pendingPacketIds.length + traffic.upcomingPacketIds.length;
    const backgroundRepliesRemaining = traffic.backgroundFlows.reduce(
      (total, flow) => total + flow.remainingPackets,
      0,
    );
    const activeLines = tableEntries.filter((entry) => entry.lifecycleState === 'active').length;
    const waitingLines = tableEntries.filter((entry) => entry.lifecycleState === 'waiting').length;
    const suspendedCount = Object.keys(suspendedPackets).length;
    const latestIncident =
      [...actionResults].reverse().find((result) => result.causedIncident) ?? null;

    return {
      hasShiftGoal: shiftGoalSummary != null,
      shiftGoalSummary,
      unresolvedPackets,
      pendingPackets: traffic.pendingPacketIds.length,
      upcomingPackets: traffic.upcomingPacketIds.length,
      activePacket: traffic.activePacketId ? 1 : 0,
      suspendedPackets: suspendedCount,
      openLines: tableEntries.length,
      activeLines,
      waitingLines,
      backgroundRepliesRemaining,
      latestIncident:
        latestIncident == null
          ? null
          : {
              outcomeCode: latestIncident.outcomeCode,
              incidentKind: latestIncident.incidentKind,
              message: latestIncident.feedbackMessage,
              subjectLabel: latestIncident.subjectLabel,
            },
    };
  },
);

export const selectLatestActionResult = createSelector(
  [selectTrafficActionResults, selectTrafficPackets],
  (results, packets) => {
    const latest = results[results.length - 1];

    if (!latest) {
      return null;
    }

    const relatedPacket =
      packets.find((packet) => packet.runtimeId === latest.packetRuntimeId) ??
      packets.find((packet) => packet.runtimeId === latest.sourceId) ??
      null;

    return {
      id: latest.id,
      action: latest.action,
      sourceId: latest.sourceId,
      direction: relatedPacket?.packet.direction ?? null,
      outcomeCode: latest.outcomeCode,
      incidentKind: latest.incidentKind,
      causedIncident: latest.causedIncident,
      auditMessage: latest.auditMessage,
      feedbackMessage: latest.feedbackMessage,
      feedbackTone: latest.feedbackTone,
      subjectLabel: latest.subjectLabel,
    };
  },
);

export const selectRecentActionSlips = createSelector(selectTrafficActionResults, (results) =>
  results
    .slice(-4)
    .reverse()
    .map((result, index) => ({
      id: `${result.sourceId}:${result.action}:${result.sequence}`,
      action: result.action,
      message: result.feedbackMessage,
      subjectLabel: result.subjectLabel,
      rewriteLabel:
        result.context.documentSource && result.context.documentDestination
          ? `${formatEndpoint(result.context.documentSource)} -> ${formatEndpoint(result.context.documentDestination)}`
          : result.context.documentSource
            ? formatEndpoint(result.context.documentSource)
            : result.context.documentDestination
              ? formatEndpoint(result.context.documentDestination)
              : null,
      feedbackTone: result.feedbackTone,
      stackIndex: index,
    })),
);

export const selectTableUsageSummary = createSelector([selectCurrentDay, selectTableEntries], (day, entries) => {
  const totalSlots = Math.max(day?.availableStamps.length ?? 0, 1);
  const usedStampIds = new Set(entries.map((entry) => entry.externalPort).filter(Boolean));
  const expiringEntries = entries.filter((entry) => entry.remainingTurns <= 2).length;

  return {
    totalSlots,
    usedSlots: usedStampIds.size,
    freeSlots: Math.max(totalSlots - usedStampIds.size, 0),
    usagePercent: Math.min((usedStampIds.size / totalSlots) * 100, 100),
    expiringEntries,
  };
});

export const selectTableFeatureFlags = createSelector(selectCurrentDay, (day) => ({
  showsStatus: isScenarioPhaseAtLeast(day, 'timeoutLifecycle'),
  showsRemainingTurns: isScenarioPhaseAtLeast(day, 'timeoutLifecycle'),
  allowsManualClose: isScenarioPhaseAtLeast(day, 'manualClose'),
  allowsWaiting: isScenarioPhaseAtLeast(day, 'timeoutLifecycle'),
  pendingCapacity: day ? getScenarioPhase(day.phaseId).pendingCapacity ?? null : null,
}));

export const selectCurrentUnitReference = createSelector(selectCurrentDay, (day) =>
  day ? UNIT_REFERENCES.find((reference) => reference.unit === day.unit) ?? null : null,
);

const actionById = Object.fromEntries(HANDBOOK_ACTIONS.map((action) => [action.id, action])) as Record<
  string,
  HandbookAction
>;

const selectActionIdsForPacket = createSelector([selectCurrentDay, selectCurrentPacket], (day, packet) => {
  if (!day || !packet) {
    return [] as string[];
  }

  const canReject = (day.availableVerdicts ?? ['ACCEPT', 'REJECT']).includes('REJECT');

  if (day.phaseId === 'directRouting') {
    if (packet.packet.direction === 'lanToWan') {
      return ['read-packet', 'select-entry', 'accept-outbound'];
    }

    return ['read-packet', 'select-entry', 'accept-inbound'];
  }

  if (packet.packet.direction === 'lanToWan') {
    const actionIds = ['read-packet'];

    if (isScenarioPhaseAtLeast(day, 'timeoutLifecycle')) {
      actionIds.push('watch-timeout');
    }

    if (day.rules.columns.includes('externalPort')) {
      actionIds.push('assign-external-port');
    }

    if (isScenarioPhaseAtLeast(day, 'manualClose')) {
      actionIds.push('close-entry');
    }

    actionIds.push('rewrite-outbound-source', 'register-table');
    actionIds.push(packet.expectation.verdict === 'REJECT' && canReject ? 'reject-packet' : 'accept-outbound');

    if (isScenarioPhaseAtLeast(day, 'portExhaustion') && packet.expectation.verdict === 'REJECT') {
      actionIds.push('reject-on-exhaustion');
    }

    return actionIds;
  }

  if (packet.expectation.verdict === 'REJECT') {
    return canReject ? ['read-packet', 'lookup-table', 'reject-packet'] : ['read-packet', 'lookup-table'];
  }

  return ['read-packet', 'lookup-table', 'select-entry', 'restore-target', 'accept-inbound'];
});

export const selectCurrentActionChecklist = createSelector(selectActionIdsForPacket, (actionIds) =>
  actionIds.map((actionId) => actionById[actionId]).filter(Boolean),
);

export const selectRelevantGlossaryEntries = createSelector(
  [selectCurrentDay],
  (day): HandbookGlossaryEntry[] => {
    if (!day) {
      return [];
    }

    return HANDBOOK_GLOSSARY.filter((entry) => {
      const unitMatch = entry.relatedUnits.includes(day.unit);
      const columnMatch =
        entry.relatedColumns.length === 0 ||
        entry.relatedColumns.some((column) => day.rules.columns.includes(column));

      return unitMatch && columnMatch;
    });
  },
);

export const selectReferenceSummary = createSelector(
  [selectRuleSummary, selectCurrentUnitReference],
  (ruleSummary, unitReference) => {
    const notes = unitReference?.notes ?? [];
    const failureLesson = unitReference ? [`破綻の学び: ${unitReference.failureLesson}`] : [];

    return [...ruleSummary, ...notes, ...failureLesson];
  },
);

const stringifyColumn = (entry: TranslationTableEntry, column: TableColumnKey) => {
  switch (column) {
    case 'protocol':
      return entry.protocol ?? '—';
    case 'externalHost':
      return entry.externalHost;
    case 'externalPort':
      return entry.externalPort ? STAMP_DEFINITIONS[entry.externalPort].label : '—';
    case 'destinationHost':
      return entry.destinationHost ?? '—';
    case 'destinationService':
      return entry.destinationService ?? '—';
    case 'internalHost':
      return entry.internalHost;
    case 'internalPort':
      return entry.internalPort ?? '—';
    default:
      return '—';
  }
};
