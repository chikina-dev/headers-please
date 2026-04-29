import { getFlowEdgeForResolution } from './campaignFlow';
import type {
  DayResolution,
  DayRunRecord,
  DayTransitionRecord,
  GameProgressState,
  ScenarioDay,
} from './types';

export const createDayRunRecord = (
  progress: GameProgressState,
  day: ScenarioDay,
  sessionSeed: number,
  startRngSeed: number,
): DayRunRecord => ({
  id: `run-${day.id}-${progress.nextRunSequence}`,
  sequence: progress.nextRunSequence,
  dayId: day.id,
  dayNumber: day.dayNumber,
  title: day.title,
  sessionSeed,
  startRngSeed,
  endRngSeed: null,
  status: 'active',
  resolutionKind: null,
  actionCount: 0,
  incidentCount: 0,
  transitionId: null,
});

export const createDayTransitionRecord = (
  progress: GameProgressState,
  day: ScenarioDay,
  resolution: DayResolution,
  nextDayId: string | null,
): DayTransitionRecord => ({
  id: `transition-${day.id}-${progress.nextTransitionSequence}`,
  sequence: progress.nextTransitionSequence,
  runId: progress.activeRunId ?? `run-${day.id}-unknown`,
  fromDayId: day.id,
  toDayId: nextDayId,
  resolutionKind: resolution.kind,
  selectedEdge: getFlowEdgeForResolution(day, resolution),
  unlockedDayId:
    nextDayId && !progress.unlockedDayIds.includes(nextDayId) ? nextDayId : null,
  historyEntryDayId: day.id,
});
