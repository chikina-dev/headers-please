import type { RunArchiveRecord, SessionExportSnapshot } from './types';

export const createRunArchiveRecord = (
  nextSequence: number,
  exportSnapshot: SessionExportSnapshot,
  payload: {
    dayId: string;
    title: string;
    resolutionKind: RunArchiveRecord['resolutionKind'];
    archiveReason: RunArchiveRecord['archiveReason'];
    actionCount: number;
    incidentCount: number;
  },
): RunArchiveRecord => ({
  id: `archive-${payload.dayId}-${nextSequence}`,
  sequence: nextSequence,
  runId: exportSnapshot.runId ?? `run-${payload.dayId}-unknown`,
  dayId: payload.dayId,
  dayNumber: exportSnapshot.dayNumber,
  title: payload.title,
  resolutionKind: payload.resolutionKind,
  archiveReason: payload.archiveReason,
  actionCount: payload.actionCount,
  incidentCount: payload.incidentCount,
  exportSnapshot,
});
