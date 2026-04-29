import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { GameTableState, TranslationTableEntry } from './types';

export const gameTableAdapter = createEntityAdapter<TranslationTableEntry>({
  sortComparer: (left, right) => left.sequence - right.sequence,
});

const initialState: GameTableState = gameTableAdapter.getInitialState({
  nextSequence: 1,
});

const gameTableSlice = createSlice({
  name: 'gameTable',
  initialState,
  reducers: {
    resetTable(state) {
      gameTableAdapter.removeAll(state);
      state.nextSequence = 1;
    },
    hydrateTableSnapshot(
      state,
      action: PayloadAction<{ entries: TranslationTableEntry[]; nextSequence: number }>,
    ) {
      gameTableAdapter.removeAll(state);
      gameTableAdapter.addMany(state, action.payload.entries);
      state.nextSequence = action.payload.nextSequence;
    },
    registerTableEntry(state, action: PayloadAction<TranslationTableEntry>) {
      gameTableAdapter.addOne(state, action.payload);
      state.nextSequence = Math.max(state.nextSequence, action.payload.sequence + 1);
    },
    activateTableEntry(state, action: PayloadAction<string>) {
      const entry = state.entities[action.payload];

      if (!entry) {
        return;
      }

      entry.lifecycleState = 'active';
      entry.remainingTurns = entry.maxRemainingTurns;
    },
    advanceTableLifecycle(state, action: PayloadAction<{ preserveEntryIds: string[] }>) {
      const preservedEntries = new Set(action.payload.preserveEntryIds);

      for (const entry of Object.values(state.entities)) {
        if (!entry || preservedEntries.has(entry.id)) {
          continue;
        }

        entry.remainingTurns -= 1;
      }

      const expiredEntryIds = Object.values(state.entities)
        .filter((entry) => entry && entry.remainingTurns <= 0)
        .map((entry) => entry.id);

      gameTableAdapter.removeMany(state, expiredEntryIds);
    },
    closeTableEntry(state, action: PayloadAction<string>) {
      gameTableAdapter.removeOne(state, action.payload);
    },
    removeTableEntries(state, action: PayloadAction<string[]>) {
      gameTableAdapter.removeMany(state, action.payload);
    },
  },
});

export const gameTableReducer = gameTableSlice.reducer;
export const gameTableActions = gameTableSlice.actions;
