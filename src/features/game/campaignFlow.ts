import { scenarioDayIds, scenarioDayMap } from './scenarios';
import type { DayResolution, FlowEdgeKey, GameProgressState, ScenarioDay } from './types';

export const getFirstDayId = (): ScenarioDay['id'] | null => scenarioDayIds[0] ?? null;

export const getCurrentDayFromProgress = (progress: GameProgressState): ScenarioDay | null => {
  if (!progress.currentDayId) {
    return null;
  }

  return scenarioDayMap[progress.currentDayId] ?? null;
};

export const getNextDayIdForResolution = (
  day: ScenarioDay,
  resolution: DayResolution,
): ScenarioDay['id'] | null => {
  const edge = getFlowEdgeForResolution(day, resolution);

  if (edge === 'nextOnFailure') {
    return day.flow?.nextOnFailure ?? null;
  }

  if (edge === 'nextOnClear') {
    return day.flow?.nextOnClear ?? null;
  }

  return null;
};

export const getFlowEdgeForResolution = (
  day: ScenarioDay,
  resolution: DayResolution,
): FlowEdgeKey => {
  if (resolution.kind === 'failure') {
    if (day.flow?.nextOnFailure) {
      return 'nextOnFailure';
    }

    if (day.flow?.nextOnClear) {
      return 'nextOnClear';
    }

    return 'terminal';
  }

  if (day.flow?.nextOnClear) {
    return 'nextOnClear';
  }

  if (day.flow?.nextOnFailure) {
    return 'nextOnFailure';
  }

  return 'terminal';
};
