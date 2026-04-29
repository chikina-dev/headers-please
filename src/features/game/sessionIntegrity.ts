import type { GameTrafficState, ScenarioDay, TranslationTableEntry } from './types';

export interface SessionIntegrityIssue {
  code:
    | 'missingActivePacket'
    | 'activePacketDuplicated'
    | 'missingRunId'
    | 'recordRunMismatch'
    | 'currentTurnMismatch'
    | 'currentTurnCommandMissing'
    | 'currentTurnCommandPacketMismatch'
    | 'unknownPacketReference'
    | 'packetOrderMismatch'
    | 'objectiveReferenceMissing'
    | 'eventReferenceMissing'
    | 'checkpointReferenceMissing'
    | 'turnReferenceMissing'
    | 'actionPacketReferenceMissing'
    | 'turnActionPacketMismatch'
    | 'duplicateCommandConsumption'
    | 'actionSequenceGap'
    | 'commandSequenceGap'
    | 'turnSequenceGap'
    | 'eventSequenceGap'
    | 'checkpointSequenceGap'
    | 'exclusivePortConflict';
  severity: 'warning' | 'error';
  message: string;
}

const hasSequentialNumbers = (values: number[]) =>
  values.every((value, index) => value === index + 1);

export const validateTrafficState = (
  traffic: GameTrafficState,
  day: ScenarioDay | null,
  tableEntries: TranslationTableEntry[],
): SessionIntegrityIssue[] => {
  const issues: SessionIntegrityIssue[] = [];
  const entityIds = new Set(traffic.ids);
  const packetOrderSet = new Set(traffic.packetOrder);
  const upcomingSet = new Set(traffic.upcomingPacketIds);
  const pendingSet = new Set(traffic.pendingPacketIds);
  const resolvedSet = new Set(traffic.resolvedPacketIds);

  if (
    traffic.sessionStatus === 'active' &&
    !traffic.activePacketId &&
    traffic.pendingPacketIds.length === 0 &&
    traffic.upcomingPacketIds.length === 0
  ) {
    issues.push({
      code: 'missingActivePacket',
      severity: 'error',
      message: 'active セッションなのに active / pending / upcoming packet がありません。',
    });
  }

  if (traffic.dayId && !traffic.runId) {
    issues.push({
      code: 'missingRunId',
      severity: 'error',
      message: 'day session が存在するのに runId がありません。',
    });
  }

  if (
    traffic.activePacketId &&
    (upcomingSet.has(traffic.activePacketId) ||
      pendingSet.has(traffic.activePacketId) ||
      resolvedSet.has(traffic.activePacketId))
  ) {
    issues.push({
      code: 'activePacketDuplicated',
      severity: 'error',
      message: 'active packet が pending または resolved に重複しています。',
    });
  }

  if (traffic.currentTurn.packetRuntimeId !== traffic.activePacketId) {
    issues.push({
      code: 'currentTurnMismatch',
      severity: 'error',
      message: 'currentTurn の packetRuntimeId が activePacketId と一致していません。',
    });
  }

  for (const packetId of [
    ...traffic.packetOrder,
    ...traffic.upcomingPacketIds,
    ...traffic.pendingPacketIds,
    ...traffic.resolvedPacketIds,
  ]) {
    if (!entityIds.has(packetId)) {
      issues.push({
        code: 'unknownPacketReference',
        severity: 'error',
        message: `${packetId} が packet entity に存在しません。`,
      });
    }
  }

  if (traffic.packetOrder.length !== traffic.ids.length || packetOrderSet.size !== traffic.ids.length) {
    issues.push({
      code: 'packetOrderMismatch',
      severity: 'error',
      message: 'packetOrder と packet entity の内容が一致していません。',
    });
  }

  const actionIds = new Set(traffic.actionResults.map((result) => result.id));
  const eventIds = new Set(traffic.sessionEvents.map((event) => event.id));

  for (const result of traffic.actionResults) {
    if (result.runId !== traffic.runId) {
      issues.push({
        code: 'recordRunMismatch',
        severity: 'error',
        message: `${result.id} の runId が traffic.runId と一致していません。`,
      });
    }

    if (result.packetRuntimeId && !entityIds.has(result.packetRuntimeId)) {
      issues.push({
        code: 'actionPacketReferenceMissing',
        severity: 'error',
        message: `${result.id} が存在しない packetRuntimeId を参照しています。`,
      });
    }
  }

  for (const objective of traffic.objectives) {
    if (objective.satisfiedByActionId && !actionIds.has(objective.satisfiedByActionId)) {
      issues.push({
        code: 'objectiveReferenceMissing',
        severity: 'error',
        message: `${objective.id} が存在しない actionResult を参照しています。`,
      });
    }
  }

  for (const event of traffic.sessionEvents) {
    if (event.runId !== traffic.runId) {
      issues.push({
        code: 'recordRunMismatch',
        severity: 'error',
        message: `${event.id} の runId が traffic.runId と一致していません。`,
      });
    }

    if (event.actionResultId && !actionIds.has(event.actionResultId)) {
      issues.push({
        code: 'eventReferenceMissing',
        severity: 'error',
        message: `${event.id} が存在しない actionResult を参照しています。`,
      });
    }
  }

  for (const checkpoint of traffic.checkpoints) {
    if (checkpoint.runId !== traffic.runId) {
      issues.push({
        code: 'recordRunMismatch',
        severity: 'error',
        message: `${checkpoint.id} の runId が traffic.runId と一致していません。`,
      });
    }

    if (checkpoint.actionResultId && !actionIds.has(checkpoint.actionResultId)) {
      issues.push({
        code: 'checkpointReferenceMissing',
        severity: 'error',
        message: `${checkpoint.id} が存在しない actionResult を参照しています。`,
      });
    }

    if (checkpoint.sessionEventId && !eventIds.has(checkpoint.sessionEventId)) {
      issues.push({
        code: 'checkpointReferenceMissing',
        severity: 'error',
        message: `${checkpoint.id} が存在しない sessionEvent を参照しています。`,
      });
    }
  }

  const commandIds = new Set(traffic.commandHistory.map((command) => command.id));
  const actionResultsById = new Map(traffic.actionResults.map((result) => [result.id, result] as const));
  const consumedCommandIds = new Set<string>();

  for (const commandId of traffic.currentTurn.commandIds) {
    const command = traffic.commandHistory.find((entry) => entry.id === commandId);

    if (!command) {
      issues.push({
        code: 'currentTurnCommandMissing',
        severity: 'error',
        message: `currentTurn が存在しない command ${commandId} を参照しています。`,
      });
      continue;
    }

    if (command.packetRuntimeId !== traffic.currentTurn.packetRuntimeId) {
      issues.push({
        code: 'currentTurnCommandPacketMismatch',
        severity: 'error',
        message: `${command.id} の packetRuntimeId が currentTurn と一致していません。`,
      });
    }
  }

  for (const turn of traffic.resolvedTurns) {
    if (turn.runId !== traffic.runId) {
      issues.push({
        code: 'recordRunMismatch',
        severity: 'error',
        message: `${turn.id} の runId が traffic.runId と一致していません。`,
      });
    }

    if (!actionIds.has(turn.actionResultId)) {
      issues.push({
        code: 'turnReferenceMissing',
        severity: 'error',
        message: `${turn.id} が存在しない actionResult を参照しています。`,
      });
    }

    if (turn.checkpointId && !traffic.checkpoints.some((checkpoint) => checkpoint.id === turn.checkpointId)) {
      issues.push({
        code: 'turnReferenceMissing',
        severity: 'error',
        message: `${turn.id} が存在しない checkpoint を参照しています。`,
      });
    }

    for (const commandId of turn.commandIds) {
      if (!commandIds.has(commandId)) {
        issues.push({
          code: 'turnReferenceMissing',
          severity: 'error',
          message: `${turn.id} が存在しない command を参照しています。`,
        });
      }

      if (consumedCommandIds.has(commandId)) {
        issues.push({
          code: 'duplicateCommandConsumption',
          severity: 'error',
          message: `${commandId} が複数の resolved turn で消費されています。`,
        });
      }

      consumedCommandIds.add(commandId);
    }

    const actionResult = actionResultsById.get(turn.actionResultId);

    if (
      actionResult?.packetRuntimeId &&
      turn.packetRuntimeId &&
      actionResult.packetRuntimeId !== turn.packetRuntimeId
    ) {
      issues.push({
        code: 'turnActionPacketMismatch',
        severity: 'error',
        message: `${turn.id} の packetRuntimeId が actionResult ${actionResult.id} と一致していません。`,
      });
    }
  }

  for (const command of traffic.commandHistory) {
    if (command.runId !== traffic.runId) {
      issues.push({
        code: 'recordRunMismatch',
        severity: 'error',
        message: `${command.id} の runId が traffic.runId と一致していません。`,
      });
    }
  }

  if (!hasSequentialNumbers(traffic.commandHistory.map((command) => command.sequence))) {
    issues.push({
      code: 'commandSequenceGap',
      severity: 'warning',
      message: 'commandHistory の sequence が連番になっていません。',
    });
  }
  if (!hasSequentialNumbers(traffic.actionResults.map((result) => result.sequence))) {
    issues.push({
      code: 'actionSequenceGap',
      severity: 'warning',
      message: 'actionResults の sequence が連番になっていません。',
    });
  }

  if (!hasSequentialNumbers(traffic.sessionEvents.map((event) => event.sequence))) {
    issues.push({
      code: 'eventSequenceGap',
      severity: 'warning',
      message: 'sessionEvents の sequence が連番になっていません。',
    });
  }

  if (!hasSequentialNumbers(traffic.checkpoints.map((checkpoint) => checkpoint.sequence))) {
    issues.push({
      code: 'checkpointSequenceGap',
      severity: 'warning',
      message: 'checkpoints の sequence が連番になっていません。',
    });
  }

  if (!hasSequentialNumbers(traffic.resolvedTurns.map((turn) => turn.sequence))) {
    issues.push({
      code: 'turnSequenceGap',
      severity: 'warning',
      message: 'resolvedTurns の sequence が連番になっていません。',
    });
  }

  if (day?.rules.portReusePolicy === 'exclusive') {
    const inUsePorts = tableEntries
      .map((entry) => entry.externalPort)
      .filter((port): port is NonNullable<typeof port> => port != null);
    const uniquePorts = new Set(inUsePorts);

    if (inUsePorts.length !== uniquePorts.size) {
      issues.push({
        code: 'exclusivePortConflict',
        severity: 'error',
        message: 'exclusive 運用なのに同じ外側ポートが複数行で使われています。',
      });
    }
  }

  return issues;
};
