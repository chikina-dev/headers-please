import type {
  ActionOutcomeCode,
  ActionDecisionContext,
  ActionResultRecord,
  DaySessionBlueprint,
  DayHistoryEntry,
  DayResolution,
  DayObjectiveState,
  Endpoint,
  BackgroundFlowState,
  GameTrafficState,
  InitialTableEntryTemplate,
  IncidentKind,
  PlayerCommandRecord,
  ResolvedTurnRecord,
  RuntimePacketRecord,
  ScenarioDay,
  ScenarioPacket,
  SessionCheckpointRecord,
  SessionEventRecord,
  StampId,
  TranslationTableEntry,
  InboundAcceptExpectation,
  OutboundAcceptExpectation,
} from './types';
import { buildTrafficQueue, toRuntimePacket } from './random';
import { pickRandomIndex } from './random';
import { getScenarioPhase } from './phases';
import { HOME_LABEL } from './scenarios';

const defaultRuntimeConfig = {
  ordering: 'grouped' as const,
  repeatForcedFailureUntilIncident: true,
  minCycles: 1,
  maxCycles: 1,
};

const createObjectiveId = (packetId: string) => `objective-${packetId}`;
const createResponseTemplateId = (packetId: string) => `${packetId}__response`;
const endpointsEqual = (left: Endpoint, right: Endpoint) =>
  left.host === right.host && left.port === right.port;

const isOutboundAcceptPacket = (
  packet: ScenarioPacket,
): packet is ScenarioPacket & { expectation: OutboundAcceptExpectation } =>
  packet.expectation.verdict === 'ACCEPT' && packet.expectation.flow === 'outbound';

const isInboundAcceptPacket = (
  packet: ScenarioPacket,
): packet is ScenarioPacket & { expectation: InboundAcceptExpectation } =>
  packet.expectation.verdict === 'ACCEPT' && packet.expectation.flow === 'inbound';

const isMatchingScenarioResponseTemplate = (
  outboundPacket: ScenarioPacket,
  inboundPacket: ScenarioPacket,
) => {
  if (!isOutboundAcceptPacket(outboundPacket) || !isInboundAcceptPacket(inboundPacket)) {
    return false;
  }

  if (outboundPacket.responsePlan) {
    return false;
  }

  if (
    outboundPacket.packet.destination.host !== inboundPacket.packet.source.host ||
    (outboundPacket.packet.destination.port ?? null) !== (inboundPacket.packet.source.port ?? null)
  ) {
    return false;
  }

  if ((outboundPacket.packet.protocol ?? null) !== (inboundPacket.packet.protocol ?? null)) {
    return false;
  }

  if (!endpointsEqual(outboundPacket.packet.source, inboundPacket.expectation.expectedTarget)) {
    return false;
  }

  const outboundCopyGroup = outboundPacket.runtime?.copyGroup ?? null;
  const inboundCopyGroup = inboundPacket.runtime?.copyGroup ?? null;

  if (outboundCopyGroup || inboundCopyGroup) {
    return outboundCopyGroup === inboundCopyGroup;
  }

  return true;
};

export const createEmptyWorkbenchDraft = (packetRuntimeId: string | null = null) => ({
  packetRuntimeId,
  stampId: null,
  routeTargetId: null,
  tableEntryId: null,
  appliedStampId: null,
  appliedRouteTargetId: null,
  appliedTableEntryId: null,
  dispatchIntent: null,
});

export const createEmptyWorkbenchDocument = () => ({
  packetRuntimeId: null,
  placement: 'idle' as const,
  originalSource: null,
  source: null,
  sourceApplied: false,
  originalDestination: null,
  destination: null,
  destinationApplied: false,
});

export const createWorkbenchDocumentFromPacket = (packet: RuntimePacketRecord | null) =>
  packet
    ? {
        packetRuntimeId: packet.runtimeId,
        placement: 'inbox' as const,
        originalSource: { ...packet.packet.source },
        source: { ...packet.packet.source },
        sourceApplied: false,
        originalDestination: { ...packet.packet.destination },
        destination: { ...packet.packet.destination },
        destinationApplied: false,
      }
    : createEmptyWorkbenchDocument();

export const buildStampedHomeEndpoint = (stampId: string): Endpoint => ({
  host: HOME_LABEL,
  ...(stampId === 'home' ? {} : { port: stampId }),
});

const buildSeededTableEntry = (
  dayId: string,
  sequence: number,
  template: InitialTableEntryTemplate,
): TranslationTableEntry => ({
  id: `seed-entry-${dayId}-${sequence}`,
  sequence,
  createdFromPacketId: `seed-packet-${dayId}-${sequence}`,
  protocol: template.protocol,
  externalHost: template.externalHost,
  externalPort: template.externalPort,
  destinationHost: template.destinationHost,
  destinationService: template.destinationService,
  internalHost: template.internalHost,
  internalPort: template.internalPort,
  lifecycleState: template.lifecycleState ?? 'active',
  remainingTurns: template.remainingTurns,
  maxRemainingTurns: template.maxRemainingTurns ?? template.remainingTurns,
});

export const buildInitialTableEntries = (day: ScenarioDay): TranslationTableEntry[] =>
  (day.initialTableEntries ?? []).map((template, index) => buildSeededTableEntry(day.id, index + 1, template));

const buildBackgroundFlowStates = (
  day: ScenarioDay,
  seed: number,
): { seed: number; flows: BackgroundFlowState[] } => {
  let nextSeed = seed;
  const flows: BackgroundFlowState[] = [];

  (day.initialTableEntries ?? []).forEach((template, index) => {
    const backgroundFlow = template.backgroundFlow;

    if (!backgroundFlow || !template.destinationHost) {
      return;
    }

    const minPackets = Math.max(backgroundFlow.minPackets, 1);
    const maxPackets = Math.max(backgroundFlow.maxPackets ?? minPackets, minPackets);
    let remainingPackets = minPackets;

    if (maxPackets > minPackets) {
      const roll = pickRandomIndex(nextSeed, maxPackets - minPackets + 1);
      nextSeed = roll.seed;
      remainingPackets = minPackets + Math.max(roll.index, 0);
    }

    flows.push({
      id: `background-flow-${day.id}-${index + 1}`,
      entryId: `seed-entry-${day.id}-${index + 1}`,
      source: {
        host: template.destinationHost,
        ...(template.destinationService ? { port: template.destinationService } : {}),
      },
      destination: {
        host: HOME_LABEL,
        ...(template.externalPort ? { port: template.externalPort } : {}),
      },
      expectedTarget: {
        host: template.internalHost,
        ...(template.internalPort ? { port: template.internalPort } : {}),
      },
      protocol: template.protocol,
      prompt:
        backgroundFlow.prompt ??
        `${template.destinationHost} から継続中の返信が届いた。対応する行を見て内側へ戻す。`,
      note: backgroundFlow.note,
      queuePosition: backgroundFlow.queuePosition ?? 'back',
      intervalActions: Math.max(backgroundFlow.intervalActions ?? 1, 1),
      nextArrivalAction: Math.max(backgroundFlow.firstDelayActions ?? 1, 1),
      remainingPackets,
      waitBudgetActions: backgroundFlow.waitBudgetActions ?? null,
    });
  });

  return {
    seed: nextSeed >>> 0,
    flows,
  };
};

export const buildObjectiveStates = (day: ScenarioDay): DayObjectiveState[] =>
  day.packets.flatMap((packet) => {
    const objectives: DayObjectiveState[] = [];

    if (packet.forcedFailure) {
      objectives.push({
        id: createObjectiveId(packet.id),
        type: 'observeIncident' as const,
        templateId: packet.id,
        status: 'pending' as const,
        title: packet.forcedFailure.title,
        message: packet.forcedFailure.message,
        satisfiedByActionId: null,
      });
    }

    if (packet.responsePlan?.forcedFailure) {
      objectives.push({
        id: createObjectiveId(createResponseTemplateId(packet.id)),
        type: 'observeIncident' as const,
        templateId: createResponseTemplateId(packet.id),
        status: 'pending' as const,
        title: packet.responsePlan.forcedFailure.title,
        message: packet.responsePlan.forcedFailure.message,
        satisfiedByActionId: null,
      });
    }

    return objectives;
  });

export const createRuntimePacketRecord = (
  packet: ScenarioPacket,
  ordinal: number,
  spawnSource: RuntimePacketRecord['spawnSource'] = 'scenario',
  availableAtAction = 0,
): RuntimePacketRecord => {
  const runtimePacket = toRuntimePacket(packet, ordinal);
  const maxPendingAge = packet.runtime?.waitBudgetActions ?? Number.MAX_SAFE_INTEGER;

  return {
    ...runtimePacket,
    ordinal,
    availableAtAction,
    pendingAge: 0,
    maxPendingAge,
    status: 'pending',
    spawnSource,
    resolvedByActionId: null,
  };
};

export const findAutoResponseTemplateForOutbound = (
  day: ScenarioDay,
  outboundPacket: ScenarioPacket,
): ScenarioPacket | null => {
  const matchingInboundPackets = day.packets.filter((candidate) =>
    isMatchingScenarioResponseTemplate(outboundPacket, candidate),
  );

  return matchingInboundPackets.length === 1 ? matchingInboundPackets[0] ?? null : null;
};

export const shouldAutoGenerateInboundFromScenario = (
  day: ScenarioDay,
  candidatePacket: ScenarioPacket,
) =>
  isInboundAcceptPacket(candidatePacket) &&
  day.packets.some((outboundPacket) => {
    const matchedTemplate = findAutoResponseTemplateForOutbound(day, outboundPacket);
    return matchedTemplate?.id === candidatePacket.id;
  });

interface GeneratedResponsePacketInput {
  day: ScenarioDay;
  sourcePacket: RuntimePacketRecord;
  rewrittenSource: Endpoint | null;
  appliedStampId: StampId | null;
  ordinal: number;
}

export const createGeneratedResponsePacketRecord = ({
  day,
  sourcePacket,
  rewrittenSource,
  appliedStampId,
  ordinal,
}: GeneratedResponsePacketInput): RuntimePacketRecord | null => {
  const responsePlan = sourcePacket.responsePlan;

  if (!responsePlan) {
    return null;
  }

  const responseDestination =
    day.phaseId === 'directRouting'
      ? { ...sourcePacket.packet.source }
      : rewrittenSource
        ? { ...rewrittenSource }
        : appliedStampId
          ? buildStampedHomeEndpoint(appliedStampId)
          : { ...sourcePacket.packet.source };

  const responsePacket: ScenarioPacket = {
    id: createResponseTemplateId(sourcePacket.id),
    prompt: responsePlan.prompt,
    expectation: {
      verdict: 'ACCEPT',
      flow: 'inbound',
      expectedTarget: { ...sourcePacket.packet.source },
    },
    routeTargets: responsePlan.routeTargets,
    forcedFailure: responsePlan.forcedFailure,
    packet: {
      id: createResponseTemplateId(sourcePacket.packet.id),
      direction: 'wanToLan',
      source: { ...sourcePacket.packet.destination },
      destination: responseDestination,
      protocol: sourcePacket.packet.protocol,
      note: responsePlan.note,
    },
  };

  return createRuntimePacketRecord(responsePacket, ordinal, 'generatedResponse');
};

export const createGeneratedScenarioResponsePacketRecord = (
  templatePacket: ScenarioPacket,
  ordinal: number,
): RuntimePacketRecord => createRuntimePacketRecord(templatePacket, ordinal, 'generatedResponse');

export const createBackgroundFlowPacketRecord = (
  flow: BackgroundFlowState,
  ordinal: number,
  availableAtAction: number,
): RuntimePacketRecord =>
  createRuntimePacketRecord(
    {
      id: `${flow.id}-packet`,
      prompt: flow.prompt,
      expectation: {
        verdict: 'ACCEPT',
        flow: 'inbound',
        expectedTarget: flow.expectedTarget,
      },
      packet: {
        id: `${flow.id}-packet`,
        direction: 'wanToLan',
        source: flow.source,
        destination: flow.destination,
        protocol: flow.protocol,
        note: flow.note,
      },
      runtime:
        flow.waitBudgetActions == null
          ? undefined
          : {
              waitBudgetActions: flow.waitBudgetActions,
            },
    },
    ordinal,
    'backgroundFlow',
    availableAtAction,
  );

export const buildDaySession = (day: ScenarioDay, seed: number, runId: string): DaySessionBlueprint => {
  const runtime = {
    ...defaultRuntimeConfig,
    ...day.runtime,
  };
  const initialScenarioPackets = day.packets.filter(
    (packet) => !shouldAutoGenerateInboundFromScenario(day, packet),
  );
  const trafficPlan = buildTrafficQueue(
    {
      ...day,
      packets: initialScenarioPackets,
    },
    seed,
    runtime.ordering,
  );
  const phase = getScenarioPhase(day.phaseId);
  const initialInboxCount = Math.min(phase.initialInboxCount, trafficPlan.packets.length);
  const buildArrivalTick = (index: number) =>
    index < initialInboxCount ? 0 : 1 + Math.floor((index - initialInboxCount) / phase.arrivalsPerAction);
  const orderedPackets = trafficPlan.packets.map((packet, index) => ({
    ...packet,
    ordinal: index,
    availableAtAction: buildArrivalTick(index) + (packet.runtime?.arrivalDelayActions ?? 0),
    pendingAge: 0,
    maxPendingAge: packet.runtime?.waitBudgetActions ?? Number.MAX_SAFE_INTEGER,
    status: (index < initialInboxCount ? 'pending' : 'upcoming') as RuntimePacketRecord['status'],
    spawnSource: 'scenario' as const,
    resolvedByActionId: null,
  }));
  const pendingPacketIds = orderedPackets
    .filter((packet) => packet.availableAtAction <= 0)
    .map((packet) => packet.runtimeId);
  const upcomingPacketIds = orderedPackets
    .filter((packet) => packet.availableAtAction > 0)
    .map((packet) => packet.runtimeId);

  for (const packet of orderedPackets) {
    packet.status = packet.availableAtAction <= 0 ? 'pending' : 'upcoming';
  }

  const backgroundFlowResolution = buildBackgroundFlowStates(day, trafficPlan.seed);

  return {
    dayId: day.id,
    runId,
    sessionStatus: orderedPackets.length > 0 ? ('active' as const) : ('resolved' as const),
    packets: orderedPackets,
    packetOrder: orderedPackets.map((packet) => packet.runtimeId),
    activePacketId: null,
    upcomingPacketIds,
    pendingPacketIds,
    resolvedPacketIds: [] as string[],
    backgroundFlows: backgroundFlowResolution.flows,
    actionClock: 0,
    actionResults: [] as ActionResultRecord[],
    objectives: buildObjectiveStates(day),
    nextActionSequence: 1,
    nextRuntimeOrdinal: orderedPackets.length,
    daySeed: seed >>> 0,
    rngSeed: backgroundFlowResolution.seed >>> 0,
  };
};

export const getActiveRuntimePacket = (traffic: GameTrafficState): RuntimePacketRecord | null =>
  traffic.activePacketId ? traffic.entities[traffic.activePacketId] ?? null : null;

export const getRuntimePacketById = (traffic: GameTrafficState, packetId: string | null) =>
  packetId ? traffic.entities[packetId] ?? null : null;

export const shouldRepeatForcedFailurePacket = (
  day: ScenarioDay,
  packet: RuntimePacketRecord,
  causedIncident: boolean,
) => {
  const runtime = {
    ...defaultRuntimeConfig,
    ...day.runtime,
  };

  return Boolean(packet.forcedFailure && runtime.repeatForcedFailureUntilIncident && !causedIncident);
};

export const applyObjectivesAfterAction = (
  objectives: DayObjectiveState[],
  packet: RuntimePacketRecord,
  actionId: string,
  causedIncident: boolean,
): DayObjectiveState[] =>
  objectives.map((objective) => {
    if (objective.templateId !== packet.templateId || objective.status === 'satisfied') {
      return objective;
    }

    if (!causedIncident) {
      return objective;
    }

    return {
      ...objective,
      status: 'satisfied' as const,
      satisfiedByActionId: actionId,
    };
  });

export const createActionResultRecord = (
  traffic: GameTrafficState,
  payload: Omit<ActionResultRecord, 'id' | 'sequence' | 'runId'>,
): ActionResultRecord => ({
  ...payload,
  id: `action-${traffic.dayId ?? 'none'}-${traffic.nextActionSequence}`,
  sequence: traffic.nextActionSequence,
  runId: traffic.runId,
});

export const createPlayerCommandRecord = (
  traffic: GameTrafficState,
  payload: Omit<PlayerCommandRecord, 'id' | 'sequence' | 'dayId' | 'runId'>,
): PlayerCommandRecord => ({
  ...payload,
  id: `command-${traffic.dayId ?? 'none'}-${traffic.nextCommandSequence}`,
  sequence: traffic.nextCommandSequence,
  dayId: traffic.dayId,
  runId: traffic.runId,
});

export const createEmptyActionContext = (): ActionDecisionContext => ({
  workbenchPacketRuntimeId: null,
  draftStampId: null,
  draftRouteTargetId: null,
  draftTableEntryId: null,
  appliedStampId: null,
  appliedRouteTargetId: null,
  appliedTableEntryId: null,
  draftDispatchIntent: null,
  documentSource: null,
  documentDestination: null,
  matchingEntryIds: [],
  conflictingEntryId: null,
  createdTableEntryId: null,
  activatedEntryId: null,
  autoAssignedStampId: null,
  deliveredTarget: null,
  expectedTarget: null,
  expiredEntryIds: [],
  preservedEntryIds: [],
});

export const createSessionEventRecord = (
  traffic: GameTrafficState,
  payload: Omit<SessionEventRecord, 'id' | 'sequence' | 'dayId' | 'runId'>,
): SessionEventRecord => ({
  ...payload,
  id: `event-${traffic.dayId ?? 'none'}-${traffic.nextEventSequence}`,
  sequence: traffic.nextEventSequence,
  dayId: traffic.dayId,
  runId: traffic.runId,
});

export const buildSessionEventMetadata = (
  entries: Array<[string, string | number | boolean | null | undefined]>,
): Record<string, string | number | boolean | null> =>
  Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as Record<
    string,
    string | number | boolean | null
  >;

export const createSessionCheckpointRecord = (
  traffic: GameTrafficState,
  tableEntries: TranslationTableEntry[],
  payload: Omit<
    SessionCheckpointRecord,
    | 'id'
    | 'sequence'
    | 'dayId'
    | 'runId'
    | 'actionClock'
    | 'activePacketId'
    | 'upcomingPacketIds'
    | 'pendingPacketIds'
    | 'resolvedPacketIds'
    | 'sessionStatus'
    | 'tableEntries'
    | 'objectives'
  >,
): SessionCheckpointRecord => ({
  ...payload,
  id: `checkpoint-${traffic.dayId ?? 'none'}-${traffic.nextCheckpointSequence}`,
  sequence: traffic.nextCheckpointSequence,
  dayId: traffic.dayId,
  runId: traffic.runId,
  actionClock: traffic.actionClock,
  activePacketId: traffic.activePacketId,
  upcomingPacketIds: traffic.upcomingPacketIds.slice(),
  pendingPacketIds: traffic.pendingPacketIds.slice(),
  resolvedPacketIds: traffic.resolvedPacketIds.slice(),
  sessionStatus: traffic.sessionStatus,
  tableEntries: tableEntries.map((entry) => ({
    id: entry.id,
    lifecycleState: entry.lifecycleState,
    remainingTurns: entry.remainingTurns,
    externalPort: entry.externalPort ?? null,
    destinationHost: entry.destinationHost ?? null,
    destinationService: entry.destinationService ?? null,
    internalHost: entry.internalHost,
    internalPort: entry.internalPort ?? null,
    protocol: entry.protocol ?? null,
  })),
  objectives: traffic.objectives.map((objective) => ({
    id: objective.id,
    templateId: objective.templateId,
    status: objective.status,
    satisfiedByActionId: objective.satisfiedByActionId,
  })),
});

export const createResolvedTurnRecord = (
  traffic: GameTrafficState,
  payload: Omit<ResolvedTurnRecord, 'id' | 'sequence' | 'dayId' | 'runId'>,
): ResolvedTurnRecord => ({
  ...payload,
  id: `turn-${traffic.dayId ?? 'none'}-${traffic.nextTurnSequence}`,
  sequence: traffic.nextTurnSequence,
  dayId: traffic.dayId,
  runId: traffic.runId,
});

export const getPendingObjectiveFailure = (objectives: DayObjectiveState[]) =>
  objectives.find((objective) => objective.status === 'satisfied') ?? null;

export const getShiftGoalProgress = (day: ScenarioDay, traffic: GameTrafficState) => {
  const goal = day.shiftGoal ?? null;
  const successes = traffic.actionResults.filter(
    (result) =>
      !result.causedIncident &&
      result.outcomeCode !== 'returnedForRoute' &&
      result.outcomeCode !== 'returnedForRewrite' &&
      result.outcomeCode !== 'returnedForLookup',
  ).length;
  const rejects = traffic.actionResults.filter(
    (result) => result.action === 'REJECT' && !result.causedIncident,
  ).length;
  const closes = traffic.actionResults.filter(
    (result) => result.action === 'CLOSE' && !result.causedIncident,
  ).length;
  const incidents = traffic.actionResults.filter((result) => result.causedIncident).length;

  const requiredSuccesses = goal?.requiredSuccesses ?? 0;
  const requiredRejects = goal?.requiredRejects ?? 0;
  const requiredCloses = goal?.requiredCloses ?? 0;
  const maxIncidents = goal?.maxIncidents ?? null;
  const maxActions = goal?.maxActions ?? null;
  const actionsElapsed = traffic.actionClock;
  const remainingActions = maxActions == null ? null : Math.max(maxActions - actionsElapsed, 0);
  const isComplete =
    goal != null &&
    successes >= requiredSuccesses &&
    rejects >= requiredRejects &&
    closes >= requiredCloses;
  const exceededIncidentLimit = maxIncidents != null && incidents > maxIncidents;
  const exhaustedActionBudget = maxActions != null && actionsElapsed >= maxActions;

  return {
    goal,
    successes,
    rejects,
    closes,
    incidents,
    actionsElapsed,
    requiredSuccesses,
    requiredRejects,
    requiredCloses,
    maxIncidents,
    maxActions,
    remainingActions,
    isComplete,
    exceededIncidentLimit,
    exhaustedActionBudget,
  };
};

export const deriveDayResolution = (
  day: ScenarioDay,
  traffic: GameTrafficState,
  reason: 'trafficExhausted' | 'shiftGoalMet' | 'incidentLimitExceeded' | 'shiftWindowExpired' = 'trafficExhausted',
): DayResolution => {
  const failureObjective = getPendingObjectiveFailure(traffic.objectives);
  const shiftGoalProgress = getShiftGoalProgress(day, traffic);
  const incidentCount = shiftGoalProgress.incidents;

  if (failureObjective) {
    return {
      kind: 'failure',
      title: failureObjective.title,
      message: failureObjective.message,
    };
  }

  if (shiftGoalProgress.exceededIncidentLimit) {
    return {
      kind: 'failure',
      title: `${day.title} 失敗`,
      message:
        day.shiftGoal?.failureMessage ??
        `事故が ${incidentCount} 件に達し、この日の許容上限を超えました。`,
    };
  }

  if (reason === 'shiftGoalMet' && shiftGoalProgress.goal && shiftGoalProgress.isComplete) {
    return {
      kind: 'clear',
      title: `${day.title} 完了`,
      message:
        shiftGoalProgress.goal.clearMessage ??
        `${day.learningGoal} 成功 ${shiftGoalProgress.successes} / 拒否 ${shiftGoalProgress.rejects} / 終了 ${shiftGoalProgress.closes}`,
    };
  }

  if (reason === 'shiftWindowExpired' && shiftGoalProgress.goal && !shiftGoalProgress.isComplete) {
    return {
      kind: 'failure',
      title: `${day.title} 時間切れ`,
      message:
        day.shiftGoal?.failureMessage ??
        `勤務時間内に必要な処理数へ届かず、今日のシフトが終了しました。`,
    };
  }

  if (reason === 'trafficExhausted' && shiftGoalProgress.goal && !shiftGoalProgress.isComplete) {
    return {
      kind: 'failure',
      title: `${day.title} 未達`,
      message:
        day.shiftGoal?.failureMessage ??
        `必要な処理を達成する前に、その日の受付が終わってしまいました。`,
    };
  }

  return {
    kind: 'clear',
    title: `${day.title} 完了`,
    message: incidentCount > 0 ? `${day.learningGoal} 今回は ${incidentCount} 件の事故が出ました。` : day.learningGoal,
  };
};

export const buildDayHistoryEntry = (
  day: ScenarioDay,
  traffic: GameTrafficState,
  resolution: DayResolution,
): DayHistoryEntry => {
  const outcomeCounts = new Map<ActionOutcomeCode, number>();
  const incidentCounts = new Map<IncidentKind, number>();

  for (const result of traffic.actionResults) {
    outcomeCounts.set(result.outcomeCode, (outcomeCounts.get(result.outcomeCode) ?? 0) + 1);

    if (result.incidentKind) {
      incidentCounts.set(result.incidentKind, (incidentCounts.get(result.incidentKind) ?? 0) + 1);
    }
  }

  return {
    runId: traffic.runId ?? `run-${day.id}-unknown`,
    dayId: day.id,
    dayNumber: day.dayNumber,
    title: day.title,
    kind: resolution.kind,
    actionCount: traffic.actionResults.length,
    incidentCount: traffic.actionResults.filter((result) => result.causedIncident).length,
    daySeed: traffic.daySeed,
    outcomeBreakdown: [...outcomeCounts.entries()].map(([code, count]) => ({ code, count })),
    incidentBreakdown: [...incidentCounts.entries()].map(([kind, count]) => ({ kind, count })),
  };
};
