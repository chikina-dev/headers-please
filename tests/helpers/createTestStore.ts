import { configureStore } from '@reduxjs/toolkit';

import { gameReducer } from '../../src/features/game/gameSlice';

export const createTestStore = () =>
  configureStore({
    reducer: {
      game: gameReducer,
    },
  });

export type TestStore = ReturnType<typeof createTestStore>;
