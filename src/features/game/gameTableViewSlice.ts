import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { GameTableViewState, StampId, TableSortMode } from './types';

const initialState: GameTableViewState = {
  sortMode: 'oldest',
  filterExternalPort: 'all',
  filterDestinationHost: '',
};

const gameTableViewSlice = createSlice({
  name: 'gameTableView',
  initialState,
  reducers: {
    resetTableView(state) {
      state.sortMode = 'oldest';
      state.filterExternalPort = 'all';
      state.filterDestinationHost = '';
    },
    setTableSortMode(state, action: PayloadAction<TableSortMode>) {
      state.sortMode = action.payload;
    },
    setExternalPortFilter(state, action: PayloadAction<StampId | 'all'>) {
      state.filterExternalPort = action.payload;
    },
    setDestinationHostFilter(state, action: PayloadAction<string>) {
      state.filterDestinationHost = action.payload;
    },
  },
});

export const gameTableViewReducer = gameTableViewSlice.reducer;
export const gameTableViewActions = gameTableViewSlice.actions;
