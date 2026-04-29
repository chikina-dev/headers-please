import { scenarioDayMap } from './scenarios';
import type { GameProgressState } from './types';

export interface ProgressIntegrityIssue {
  code:
    | 'missingFirstDayUnlock'
    | 'currentDayLocked'
    | 'nextDayLocked'
    | 'activeRunMissing'
    | 'inspectedRunMissing'
    | 'historyRunMissing'
    | 'unknownTransitionDay'
    | 'transitionHistoryMismatch'
    | 'runTransitionMismatch'
    | 'archiveRunMissing'
    | 'archiveSequenceGap'
    | 'runSequenceGap'
    | 'transitionSequenceGap';
  severity: 'warning' | 'error';
  message: string;
}

const hasSequentialNumbers = (values: number[]) =>
  values.every((value, index) => value === index + 1);

export const validateProgressState = (
  progress: GameProgressState,
): ProgressIntegrityIssue[] => {
  const issues: ProgressIntegrityIssue[] = [];
  const unlockedSet = new Set(progress.unlockedDayIds);
  const historyDayIds = new Set(progress.dayHistory.map((entry) => entry.dayId));
  const runIds = new Set(progress.runHistory.map((entry) => entry.id));
  const archiveRunIds = new Set(progress.runArchives.map((entry) => entry.runId));

  if (progress.firstDayId && !unlockedSet.has(progress.firstDayId)) {
    issues.push({
      code: 'missingFirstDayUnlock',
      severity: 'error',
      message: 'firstDayId が unlockedDayIds に含まれていません。',
    });
  }

  if (progress.currentDayId && !unlockedSet.has(progress.currentDayId)) {
    issues.push({
      code: 'currentDayLocked',
      severity: 'error',
      message: 'currentDayId が未解禁のまま参照されています。',
    });
  }

  if (progress.nextDayId && !unlockedSet.has(progress.nextDayId)) {
    issues.push({
      code: 'nextDayLocked',
      severity: 'warning',
      message: 'nextDayId が unlockedDayIds に入る前に参照されています。',
    });
  }

  if (progress.activeRunId && !runIds.has(progress.activeRunId)) {
    issues.push({
      code: 'activeRunMissing',
      severity: 'error',
      message: 'activeRunId が runHistory に存在しません。',
    });
  }

  if (progress.inspectedRunId && !archiveRunIds.has(progress.inspectedRunId)) {
    issues.push({
      code: 'inspectedRunMissing',
      severity: 'error',
      message: 'inspectedRunId が runArchives に存在しません。',
    });
  }

  for (const historyEntry of progress.dayHistory) {
    if (!runIds.has(historyEntry.runId)) {
      issues.push({
        code: 'historyRunMissing',
        severity: 'error',
        message: `${historyEntry.dayId} の dayHistory が存在しない runId を参照しています。`,
      });
    }
  }

  for (const run of progress.runHistory) {
    if (run.transitionId && !progress.transitions.some((transition) => transition.id === run.transitionId)) {
      issues.push({
        code: 'runTransitionMismatch',
        severity: 'error',
        message: `${run.id} が存在しない transitionId を参照しています。`,
      });
    }
  }

  for (const archive of progress.runArchives) {
    if (!runIds.has(archive.runId)) {
      issues.push({
        code: 'archiveRunMissing',
        severity: 'error',
        message: `${archive.id} が存在しない runId を参照しています。`,
      });
    }
  }

  for (const transition of progress.transitions) {
    if (!scenarioDayMap[transition.fromDayId]) {
      issues.push({
        code: 'unknownTransitionDay',
        severity: 'error',
        message: `${transition.id} が存在しない fromDayId を参照しています。`,
      });
    }

    if (transition.toDayId && !scenarioDayMap[transition.toDayId]) {
      issues.push({
        code: 'unknownTransitionDay',
        severity: 'error',
        message: `${transition.id} が存在しない toDayId を参照しています。`,
      });
    }

    if (!historyDayIds.has(transition.historyEntryDayId)) {
      issues.push({
        code: 'transitionHistoryMismatch',
        severity: 'error',
        message: `${transition.id} が対応する dayHistory を参照できません。`,
      });
    }

    if (!runIds.has(transition.runId)) {
      issues.push({
        code: 'runTransitionMismatch',
        severity: 'error',
        message: `${transition.id} が存在しない runId を参照しています。`,
      });
    }
  }

  if (progress.transitions.length !== progress.dayHistory.length) {
    issues.push({
      code: 'transitionHistoryMismatch',
      severity: 'warning',
      message: 'transitions と dayHistory の件数が一致していません。',
    });
  }

  if (!hasSequentialNumbers(progress.transitions.map((transition) => transition.sequence))) {
    issues.push({
      code: 'transitionSequenceGap',
      severity: 'warning',
      message: 'transitions の sequence が連番になっていません。',
    });
  }

  if (!hasSequentialNumbers(progress.runHistory.map((run) => run.sequence))) {
    issues.push({
      code: 'runSequenceGap',
      severity: 'warning',
      message: 'runHistory の sequence が連番になっていません。',
    });
  }

  if (!hasSequentialNumbers(progress.runArchives.map((archive) => archive.sequence))) {
    issues.push({
      code: 'archiveSequenceGap',
      severity: 'warning',
      message: 'runArchives の sequence が連番になっていません。',
    });
  }

  return issues;
};
