import type {
  ActionResultRecord,
  AuditLogEntry,
  GameAuditState,
  GameProgressState,
  GameTableState,
  GameTrafficState,
  PacketLedgerRecord,
  ScenarioDay,
  SessionExportSnapshot,
  TranslationTableEntry,
} from './types';

const appendUnique = (target: string[], value: string) => {
  if (!target.includes(value)) {
    target.push(value);
  }
};

const createPacketLedgerRecord = (
  packet: NonNullable<GameTrafficState['entities'][string]>,
): PacketLedgerRecord => ({
  packetRuntimeId: packet.runtimeId,
  templateId: packet.templateId,
  ordinal: packet.ordinal,
  cycleIndex: packet.cycleIndex,
  variantGroup: packet.variantGroup,
  variantId: packet.variantId,
  spawnSource: packet.spawnSource,
  status: packet.status,
  resolvedByActionId: packet.resolvedByActionId,
  commandIds: [],
  turnIds: [],
  actionResultIds: [],
  sessionEventIds: [],
  checkpointIds: [],
  finalOutcomeCode: null,
  incidentKinds: [],
});

const buildActionResultIndex = (results: ActionResultRecord[]) =>
  new Map(results.map((result) => [result.id, result] as const));

export const buildPacketLedgers = (traffic: GameTrafficState): PacketLedgerRecord[] => {
  const ledgers = new Map<string, PacketLedgerRecord>();

  for (const packetId of traffic.packetOrder) {
    const packet = traffic.entities[packetId];

    if (packet) {
      ledgers.set(packet.runtimeId, createPacketLedgerRecord(packet));
    }
  }

  const actionResultsById = buildActionResultIndex(traffic.actionResults);

  for (const command of traffic.commandHistory) {
    if (!command.packetRuntimeId) {
      continue;
    }

    const ledger = ledgers.get(command.packetRuntimeId);

    if (ledger) {
      appendUnique(ledger.commandIds, command.id);
    }
  }

  for (const turn of traffic.resolvedTurns) {
    if (!turn.packetRuntimeId) {
      continue;
    }

    const ledger = ledgers.get(turn.packetRuntimeId);

    if (ledger) {
      appendUnique(ledger.turnIds, turn.id);
    }
  }

  for (const actionResult of traffic.actionResults) {
    if (!actionResult.packetRuntimeId) {
      continue;
    }

    const ledger = ledgers.get(actionResult.packetRuntimeId);

    if (!ledger) {
      continue;
    }

    appendUnique(ledger.actionResultIds, actionResult.id);
    ledger.finalOutcomeCode = actionResult.outcomeCode;

    if (actionResult.incidentKind && !ledger.incidentKinds.includes(actionResult.incidentKind)) {
      ledger.incidentKinds.push(actionResult.incidentKind);
    }
  }

  for (const event of traffic.sessionEvents) {
    if (!event.packetRuntimeId) {
      continue;
    }

    const ledger = ledgers.get(event.packetRuntimeId);

    if (ledger) {
      appendUnique(ledger.sessionEventIds, event.id);
    }
  }

  for (const checkpoint of traffic.checkpoints) {
    const checkpointAction = checkpoint.actionResultId
      ? actionResultsById.get(checkpoint.actionResultId) ?? null
      : null;
    const checkpointPacketId = checkpointAction?.packetRuntimeId ?? checkpoint.activePacketId;

    if (!checkpointPacketId) {
      continue;
    }

    const ledger = ledgers.get(checkpointPacketId);

    if (ledger) {
      appendUnique(ledger.checkpointIds, checkpoint.id);
    }
  }

  return [...ledgers.values()].sort((left, right) => left.ordinal - right.ordinal);
};

export const buildSessionExportSnapshot = (
  day: ScenarioDay | null,
  progress: GameProgressState,
  traffic: GameTrafficState,
  table: GameTableState,
  auditLogs: AuditLogEntry[],
  auditNextSequence: GameAuditState['nextSequence'],
): SessionExportSnapshot => ({
  dayId: traffic.dayId,
  runId: traffic.runId,
  dayNumber: day?.dayNumber ?? null,
  sessionStatus: traffic.sessionStatus,
  route: {
    firstDayId: progress.firstDayId,
    currentDayId: progress.currentDayId,
    nextDayId: progress.nextDayId,
    inspectedRunId: progress.inspectedRunId,
    unlockedDayIds: progress.unlockedDayIds.slice(),
    clearedDayIds: progress.clearedDayIds.slice(),
    failedDayIds: progress.failedDayIds.slice(),
  },
  activeRunId: progress.activeRunId,
  runHistory: progress.runHistory.slice(),
  transitions: progress.transitions.slice(),
  trafficSnapshot: {
    dayId: traffic.dayId,
    runId: traffic.runId,
    sessionStatus: traffic.sessionStatus,
    packets: traffic.packetOrder
      .map((packetId) => traffic.entities[packetId])
      .filter((packet): packet is NonNullable<typeof packet> => packet != null),
    packetOrder: traffic.packetOrder.slice(),
    activePacketId: traffic.activePacketId,
    upcomingPacketIds: traffic.upcomingPacketIds.slice(),
    pendingPacketIds: traffic.pendingPacketIds.slice(),
    resolvedPacketIds: traffic.resolvedPacketIds.slice(),
    backgroundFlows: traffic.backgroundFlows.slice(),
    actionClock: traffic.actionClock,
    commandHistory: traffic.commandHistory.slice(),
    actionResults: traffic.actionResults.slice(),
    currentTurn: {
      packetRuntimeId: traffic.currentTurn.packetRuntimeId,
      commandIds: traffic.currentTurn.commandIds.slice(),
    },
    resolvedTurns: traffic.resolvedTurns.slice(),
    sessionEvents: traffic.sessionEvents.slice(),
    checkpoints: traffic.checkpoints.slice(),
    objectives: traffic.objectives.slice(),
    nextCommandSequence: traffic.nextCommandSequence,
    nextActionSequence: traffic.nextActionSequence,
    nextTurnSequence: traffic.nextTurnSequence,
    nextEventSequence: traffic.nextEventSequence,
    nextCheckpointSequence: traffic.nextCheckpointSequence,
    nextRuntimeOrdinal: traffic.nextRuntimeOrdinal,
    daySeed: traffic.daySeed,
    rngSeed: traffic.rngSeed,
  },
  tableSnapshot: {
    entries: table.ids
      .map((entryId) => table.entities[entryId])
      .filter((entry): entry is TranslationTableEntry => entry != null),
    nextSequence: table.nextSequence,
  },
  auditSnapshot: {
    logs: auditLogs.slice(),
    nextSequence: auditNextSequence,
  },
  packetLedgers: buildPacketLedgers(traffic),
  commands: traffic.commandHistory.slice(),
  turns: traffic.resolvedTurns.slice(),
  actions: traffic.actionResults.slice(),
  events: traffic.sessionEvents.slice(),
  checkpoints: traffic.checkpoints.slice(),
  objectives: traffic.objectives.slice(),
  tableEntries: table.ids
    .map((entryId) => table.entities[entryId])
    .filter((entry): entry is TranslationTableEntry => entry != null),
});
