import type { RunArchiveRecord } from './types';

export const buildArchiveRestorePayload = (archive: RunArchiveRecord) => ({
  runId: archive.runId,
  dayId: archive.dayId,
  trafficSnapshot: {
    ...archive.exportSnapshot.trafficSnapshot,
    packets: archive.exportSnapshot.trafficSnapshot.packets.slice(),
    packetOrder: archive.exportSnapshot.trafficSnapshot.packetOrder.slice(),
    upcomingPacketIds: archive.exportSnapshot.trafficSnapshot.upcomingPacketIds.slice(),
    pendingPacketIds: archive.exportSnapshot.trafficSnapshot.pendingPacketIds.slice(),
    resolvedPacketIds: archive.exportSnapshot.trafficSnapshot.resolvedPacketIds.slice(),
    backgroundFlows: archive.exportSnapshot.trafficSnapshot.backgroundFlows.slice(),
    actionClock: archive.exportSnapshot.trafficSnapshot.actionClock,
    commandHistory: archive.exportSnapshot.trafficSnapshot.commandHistory.slice(),
    actionResults: archive.exportSnapshot.trafficSnapshot.actionResults.slice(),
    currentTurn: {
      packetRuntimeId: archive.exportSnapshot.trafficSnapshot.currentTurn.packetRuntimeId,
      commandIds: archive.exportSnapshot.trafficSnapshot.currentTurn.commandIds.slice(),
    },
    resolvedTurns: archive.exportSnapshot.trafficSnapshot.resolvedTurns.slice(),
    sessionEvents: archive.exportSnapshot.trafficSnapshot.sessionEvents.slice(),
    checkpoints: archive.exportSnapshot.trafficSnapshot.checkpoints.slice(),
    objectives: archive.exportSnapshot.trafficSnapshot.objectives.slice(),
  },
  tableSnapshot: {
    entries: archive.exportSnapshot.tableSnapshot.entries.slice(),
    nextSequence: archive.exportSnapshot.tableSnapshot.nextSequence,
  },
  auditSnapshot: {
    logs: archive.exportSnapshot.auditSnapshot.logs.slice(),
    nextSequence: archive.exportSnapshot.auditSnapshot.nextSequence,
  },
});
