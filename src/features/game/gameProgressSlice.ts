import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { getFirstDayId } from './campaignFlow';
import type { DayHistoryEntry, DayResolution, GameProgressState } from './types';

const firstDayId = getFirstDayId();

const initialState: GameProgressState = {
  screen: 'title',
  firstDayId,
  currentDayId: firstDayId,
  nextDayId: null,
  activeRunId: null,
  inspectedRunId: null,
  unlockedDayIds: firstDayId ? [firstDayId] : [],
  clearedDayIds: [],
  failedDayIds: [],
  lastResolution: null,
  runHistory: [],
  runArchives: [],
  dayHistory: [],
  transitions: [],
  nextRunSequence: 1,
  nextArchiveSequence: 1,
  nextTransitionSequence: 1,
};

const gameProgressSlice = createSlice({
  name: 'gameProgress',
  initialState,
  reducers: {
    resetCampaign(state) {
      state.screen = 'inspection';
      state.currentDayId = state.firstDayId;
      state.nextDayId = null;
      state.activeRunId = null;
      state.inspectedRunId = null;
      state.unlockedDayIds = state.firstDayId ? [state.firstDayId] : [];
      state.clearedDayIds = [];
      state.failedDayIds = [];
      state.lastResolution = null;
      state.runHistory = [];
      state.runArchives = [];
      state.dayHistory = [];
      state.transitions = [];
      state.nextRunSequence = 1;
      state.nextArchiveSequence = 1;
      state.nextTransitionSequence = 1;
    },
    startDayRun(state, action: PayloadAction<GameProgressState['runHistory'][number]>) {
      state.activeRunId = action.payload.id;
      state.inspectedRunId = null;
      state.runHistory.push(action.payload);
      state.nextRunSequence = Math.max(state.nextRunSequence, action.payload.sequence + 1);
    },
    archiveActiveRun(
      state,
      action: PayloadAction<{
        runId: string;
        archive: GameProgressState['runArchives'][number];
        finalRngSeed: number;
        actionCount: number;
        incidentCount: number;
      }>,
    ) {
      state.activeRunId = null;
      state.runArchives.push(action.payload.archive);
      state.nextArchiveSequence = Math.max(
        state.nextArchiveSequence,
        action.payload.archive.sequence + 1,
      );
      state.runHistory = state.runHistory.map((run) =>
        run.id === action.payload.runId
          ? {
              ...run,
              endRngSeed: action.payload.finalRngSeed,
              status: 'abandoned',
              resolutionKind: null,
              actionCount: action.payload.actionCount,
              incidentCount: action.payload.incidentCount,
              transitionId: null,
            }
          : run,
      );
    },
    prepareDayReplay(state) {
      state.activeRunId = null;
      state.inspectedRunId = null;
      state.nextDayId = null;
      state.lastResolution = null;
      state.screen = 'inspection';
    },
    openRunArchiveReview(
      state,
      action: PayloadAction<{ runId: string; dayId: GameProgressState['currentDayId'] }>,
    ) {
      state.activeRunId = null;
      state.inspectedRunId = action.payload.runId;
      state.currentDayId = action.payload.dayId;
      state.nextDayId = null;
      state.lastResolution = null;
      state.screen = 'inspection';
    },
    beginInspection(state) {
      state.screen = 'inspection';
      state.lastResolution = null;
    },
    resolveDay(
      state,
      action: PayloadAction<{
        resolution: DayResolution;
        historyEntry: DayHistoryEntry;
        nextDayId: string | null;
        transition: GameProgressState['transitions'][number];
        archive: GameProgressState['runArchives'][number];
        finalRngSeed: number;
      }>,
    ) {
      state.lastResolution = action.payload.resolution;
      state.activeRunId = action.payload.historyEntry.runId;
      state.dayHistory.push(action.payload.historyEntry);
      state.transitions.push(action.payload.transition);
      state.runArchives.push(action.payload.archive);
      state.nextTransitionSequence = Math.max(
        state.nextTransitionSequence,
        action.payload.transition.sequence + 1,
      );
      state.nextArchiveSequence = Math.max(
        state.nextArchiveSequence,
        action.payload.archive.sequence + 1,
      );
      state.nextDayId = action.payload.nextDayId;
      state.inspectedRunId = null;
      if (action.payload.resolution.kind === 'clear') {
        if (!state.clearedDayIds.includes(action.payload.historyEntry.dayId)) {
          state.clearedDayIds.push(action.payload.historyEntry.dayId);
        }
      } else if (!state.failedDayIds.includes(action.payload.historyEntry.dayId)) {
        state.failedDayIds.push(action.payload.historyEntry.dayId);
      }
      if (action.payload.nextDayId && !state.unlockedDayIds.includes(action.payload.nextDayId)) {
        state.unlockedDayIds.push(action.payload.nextDayId);
      }
      state.runHistory = state.runHistory.map((run) =>
        run.id === action.payload.historyEntry.runId
          ? {
              ...run,
              endRngSeed: action.payload.finalRngSeed,
              status: action.payload.resolution.kind,
              resolutionKind: action.payload.resolution.kind,
              actionCount: action.payload.historyEntry.actionCount,
              incidentCount: action.payload.historyEntry.incidentCount,
              transitionId: action.payload.transition.id,
            }
          : run,
      );
      state.screen = action.payload.resolution.kind === 'clear' ? 'dayClear' : 'dayFailure';
    },
    advanceToNextDay(state) {
      if (!state.nextDayId) {
        state.activeRunId = null;
        state.inspectedRunId = null;
        state.screen = 'campaignComplete';
        return;
      }

      state.currentDayId = state.nextDayId;
      state.nextDayId = null;
      state.activeRunId = null;
      state.inspectedRunId = null;
      state.lastResolution = null;
      state.screen = 'inspection';
    },
    completeCampaign(
      state,
      action: PayloadAction<{
        resolution: DayResolution;
        historyEntry?: DayHistoryEntry;
        nextDayId?: string | null;
        transition?: GameProgressState['transitions'][number];
        archive?: GameProgressState['runArchives'][number];
        finalRngSeed?: number;
      }>,
    ) {
      state.lastResolution = action.payload.resolution;
      if (action.payload.historyEntry) {
        state.dayHistory.push(action.payload.historyEntry);
        if (action.payload.resolution.kind === 'clear') {
          if (!state.clearedDayIds.includes(action.payload.historyEntry.dayId)) {
            state.clearedDayIds.push(action.payload.historyEntry.dayId);
          }
        } else if (!state.failedDayIds.includes(action.payload.historyEntry.dayId)) {
          state.failedDayIds.push(action.payload.historyEntry.dayId);
        }
      }
      if (action.payload.transition) {
        state.transitions.push(action.payload.transition);
        state.nextTransitionSequence = Math.max(
          state.nextTransitionSequence,
          action.payload.transition.sequence + 1,
        );
      }
      if (action.payload.archive) {
        state.runArchives.push(action.payload.archive);
        state.nextArchiveSequence = Math.max(
          state.nextArchiveSequence,
          action.payload.archive.sequence + 1,
        );
      }
      if (action.payload.historyEntry) {
        state.activeRunId = action.payload.historyEntry.runId;
        state.runHistory = state.runHistory.map((run) =>
          run.id === action.payload.historyEntry?.runId
            ? {
                ...run,
                endRngSeed: action.payload.finalRngSeed ?? run.endRngSeed,
                status: action.payload.resolution.kind,
                resolutionKind: action.payload.resolution.kind,
                actionCount: action.payload.historyEntry.actionCount,
                incidentCount: action.payload.historyEntry.incidentCount,
                transitionId: action.payload.transition?.id ?? null,
              }
            : run,
        );
      }
      state.nextDayId = action.payload.nextDayId ?? null;
      state.screen = 'campaignComplete';
    },
  },
});

export const gameProgressReducer = gameProgressSlice.reducer;
export const gameProgressActions = gameProgressSlice.actions;
