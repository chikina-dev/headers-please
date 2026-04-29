import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuditLogEntry, GameAuditState } from './types';

export const gameAuditAdapter = createEntityAdapter<AuditLogEntry>({
  sortComparer: (left, right) => left.sequence - right.sequence,
});

const initialState: GameAuditState = gameAuditAdapter.getInitialState({
  nextSequence: 1,
});

const gameAuditSlice = createSlice({
  name: 'gameAudit',
  initialState,
  reducers: {
    resetAudit(state) {
      gameAuditAdapter.removeAll(state);
      state.nextSequence = 1;
    },
    hydrateAuditSnapshot(state, action: PayloadAction<{ logs: AuditLogEntry[]; nextSequence: number }>) {
      gameAuditAdapter.removeAll(state);
      gameAuditAdapter.addMany(state, action.payload.logs);
      state.nextSequence = action.payload.nextSequence;
    },
    appendAuditLog(state, action: PayloadAction<AuditLogEntry>) {
      gameAuditAdapter.addOne(state, action.payload);
      state.nextSequence = Math.max(state.nextSequence, action.payload.sequence + 1);
    },
  },
});

export const gameAuditReducer = gameAuditSlice.reducer;
export const gameAuditActions = gameAuditSlice.actions;
