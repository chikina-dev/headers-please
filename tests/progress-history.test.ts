import { describe, expect, it } from 'vitest';

import { createDayRunRecord, createDayTransitionRecord } from '../src/features/game/progressHistory';
import { scenarioDayMap } from '../src/features/game/scenarios';
import type { GameProgressState } from '../src/features/game/types';

const baseProgress = (): GameProgressState => ({
  screen: 'inspection',
  firstDayId: 'day-1',
  currentDayId: 'day-2',
  nextDayId: null,
  activeRunId: 'run-day-2-7',
  inspectedRunId: null,
  unlockedDayIds: ['day-1', 'day-2'],
  clearedDayIds: ['day-1'],
  failedDayIds: [],
  lastResolution: null,
  runHistory: [],
  runArchives: [],
  dayHistory: [],
  transitions: [],
  nextRunSequence: 7,
  nextArchiveSequence: 1,
  nextTransitionSequence: 4,
});

describe('progressHistory', () => {
  it('creates run records with sequence and seed metadata', () => {
    const progress = baseProgress();
    const run = createDayRunRecord(progress, scenarioDayMap['day-2'], 111, 111);

    expect(run.id).toBe('run-day-2-7');
    expect(run.sequence).toBe(7);
    expect(run.dayId).toBe('day-2');
    expect(run.sessionSeed).toBe(111);
    expect(run.startRngSeed).toBe(111);
    expect(run.status).toBe('active');
  });

  it('creates transition records with the selected flow edge and unlock info', () => {
    const progress = baseProgress();
    const transition = createDayTransitionRecord(
      progress,
      scenarioDayMap['day-2'],
      {
        kind: 'failure',
        title: '仕様破綻',
        message: 'test',
      },
      'day-3',
    );

    expect(transition.id).toBe('transition-day-2-4');
    expect(transition.runId).toBe('run-day-2-7');
    expect(transition.selectedEdge).toBe('nextOnFailure');
    expect(transition.toDayId).toBe('day-3');
    expect(transition.unlockedDayId).toBe('day-3');
  });
});
