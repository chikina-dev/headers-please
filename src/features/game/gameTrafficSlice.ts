import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  ActionResultRecord,
  DayObjectiveState,
  DaySessionBlueprint,
  GameTrafficState,
  PlayerCommandRecord,
  ResolvedTurnRecord,
  RuntimePacketRecord,
  SessionCheckpointRecord,
  SessionEventRecord,
} from './types';

export const gameTrafficAdapter = createEntityAdapter<RuntimePacketRecord, string>({
  selectId: (packet: RuntimePacketRecord) => packet.runtimeId,
  sortComparer: (left, right) => left.ordinal - right.ordinal,
});

const initialState: GameTrafficState = gameTrafficAdapter.getInitialState({
  dayId: null,
  runId: null,
  sessionStatus: 'idle',
  packetOrder: [],
  activePacketId: null,
  upcomingPacketIds: [],
  pendingPacketIds: [],
  resolvedPacketIds: [],
  backgroundFlows: [],
  actionClock: 0,
  actionResults: [],
  commandHistory: [],
  currentTurn: {
    packetRuntimeId: null,
    commandIds: [],
  },
  resolvedTurns: [],
  sessionEvents: [],
  checkpoints: [],
  objectives: [],
  nextCommandSequence: 1,
  nextActionSequence: 1,
  nextTurnSequence: 1,
  nextEventSequence: 1,
  nextCheckpointSequence: 1,
  nextRuntimeOrdinal: 0,
  daySeed: 0x1234abcd,
  rngSeed: 0x1234abcd,
});

const gameTrafficSlice = createSlice({
  name: 'gameTraffic',
  initialState,
  reducers: {
    resetTraffic(state) {
      gameTrafficAdapter.removeAll(state);
      state.dayId = null;
      state.runId = null;
      state.sessionStatus = 'idle';
      state.packetOrder = [];
      state.activePacketId = null;
      state.upcomingPacketIds = [];
      state.pendingPacketIds = [];
      state.resolvedPacketIds = [];
      state.backgroundFlows = [];
      state.actionClock = 0;
      state.actionResults = [];
      state.commandHistory = [];
      state.currentTurn = {
        packetRuntimeId: null,
        commandIds: [],
      };
      state.resolvedTurns = [];
      state.sessionEvents = [];
      state.checkpoints = [];
      state.objectives = [];
      state.nextCommandSequence = 1;
      state.nextActionSequence = 1;
      state.nextTurnSequence = 1;
      state.nextEventSequence = 1;
      state.nextCheckpointSequence = 1;
      state.nextRuntimeOrdinal = 0;
      state.daySeed = state.rngSeed;
    },
    reseedTraffic(state, action: PayloadAction<number>) {
      state.rngSeed = action.payload >>> 0;
    },
    hydrateTrafficSnapshot(
      state,
      action: PayloadAction<{
        dayId: GameTrafficState['dayId'];
        runId: GameTrafficState['runId'];
        sessionStatus: GameTrafficState['sessionStatus'];
        packets: RuntimePacketRecord[];
        packetOrder: GameTrafficState['packetOrder'];
        activePacketId: GameTrafficState['activePacketId'];
        upcomingPacketIds: GameTrafficState['upcomingPacketIds'];
        pendingPacketIds: GameTrafficState['pendingPacketIds'];
        resolvedPacketIds: GameTrafficState['resolvedPacketIds'];
        backgroundFlows: GameTrafficState['backgroundFlows'];
        actionClock: GameTrafficState['actionClock'];
        commandHistory: PlayerCommandRecord[];
        actionResults: ActionResultRecord[];
        currentTurn: GameTrafficState['currentTurn'];
        resolvedTurns: ResolvedTurnRecord[];
        sessionEvents: SessionEventRecord[];
        checkpoints: SessionCheckpointRecord[];
        objectives: DayObjectiveState[];
        nextCommandSequence: GameTrafficState['nextCommandSequence'];
        nextActionSequence: GameTrafficState['nextActionSequence'];
        nextTurnSequence: GameTrafficState['nextTurnSequence'];
        nextEventSequence: GameTrafficState['nextEventSequence'];
        nextCheckpointSequence: GameTrafficState['nextCheckpointSequence'];
        nextRuntimeOrdinal: GameTrafficState['nextRuntimeOrdinal'];
        daySeed: GameTrafficState['daySeed'];
        rngSeed: GameTrafficState['rngSeed'];
      }>,
    ) {
      gameTrafficAdapter.removeAll(state);
      gameTrafficAdapter.addMany(state, action.payload.packets);
      state.dayId = action.payload.dayId;
      state.runId = action.payload.runId;
      state.sessionStatus = action.payload.sessionStatus;
      state.packetOrder = action.payload.packetOrder.slice();
      state.activePacketId = action.payload.activePacketId;
      state.upcomingPacketIds = action.payload.upcomingPacketIds.slice();
      state.pendingPacketIds = action.payload.pendingPacketIds.slice();
      state.resolvedPacketIds = action.payload.resolvedPacketIds.slice();
      state.backgroundFlows = action.payload.backgroundFlows.slice();
      state.actionClock = action.payload.actionClock;
      state.commandHistory = action.payload.commandHistory.slice();
      state.actionResults = action.payload.actionResults.slice();
      state.currentTurn = {
        packetRuntimeId: action.payload.currentTurn.packetRuntimeId,
        commandIds: action.payload.currentTurn.commandIds.slice(),
      };
      state.resolvedTurns = action.payload.resolvedTurns.slice();
      state.sessionEvents = action.payload.sessionEvents.slice();
      state.checkpoints = action.payload.checkpoints.slice();
      state.objectives = action.payload.objectives.slice();
      state.nextCommandSequence = action.payload.nextCommandSequence;
      state.nextActionSequence = action.payload.nextActionSequence;
      state.nextTurnSequence = action.payload.nextTurnSequence;
      state.nextEventSequence = action.payload.nextEventSequence;
      state.nextCheckpointSequence = action.payload.nextCheckpointSequence;
      state.nextRuntimeOrdinal = action.payload.nextRuntimeOrdinal;
      state.daySeed = action.payload.daySeed >>> 0;
      state.rngSeed = action.payload.rngSeed >>> 0;
    },
    startDaySession(state, action: PayloadAction<DaySessionBlueprint>) {
      gameTrafficAdapter.removeAll(state);
      gameTrafficAdapter.addMany(state, action.payload.packets);
      state.dayId = action.payload.dayId;
      state.runId = action.payload.runId;
      state.sessionStatus = action.payload.sessionStatus;
      state.packetOrder = action.payload.packetOrder;
      state.activePacketId = action.payload.activePacketId;
      state.upcomingPacketIds = action.payload.upcomingPacketIds;
      state.pendingPacketIds = action.payload.pendingPacketIds;
      state.resolvedPacketIds = action.payload.resolvedPacketIds;
      state.backgroundFlows = action.payload.backgroundFlows;
      state.actionClock = action.payload.actionClock;
      state.actionResults = action.payload.actionResults;
      state.commandHistory = [];
      state.currentTurn = {
        packetRuntimeId: null,
        commandIds: [],
      };
      state.resolvedTurns = [];
      state.sessionEvents = [];
      state.checkpoints = [];
      state.objectives = action.payload.objectives;
      state.nextCommandSequence = 1;
      state.nextActionSequence = action.payload.nextActionSequence;
      state.nextTurnSequence = 1;
      state.nextEventSequence = 1;
      state.nextCheckpointSequence = 1;
      state.nextRuntimeOrdinal = action.payload.nextRuntimeOrdinal;
      state.daySeed = action.payload.daySeed >>> 0;
      state.rngSeed = action.payload.rngSeed >>> 0;
    },
    setTrafficSeed(state, action: PayloadAction<number>) {
      state.rngSeed = action.payload >>> 0;
    },
    appendActionResult(state, action: PayloadAction<ActionResultRecord>) {
      state.actionResults.push(action.payload);
      state.nextActionSequence = Math.max(state.nextActionSequence, action.payload.sequence + 1);
    },
    appendCommand(state, action: PayloadAction<PlayerCommandRecord>) {
      state.commandHistory.push(action.payload);
      if (state.currentTurn.packetRuntimeId !== action.payload.packetRuntimeId) {
        state.currentTurn.packetRuntimeId = action.payload.packetRuntimeId;
        state.currentTurn.commandIds = [];
      }
      state.currentTurn.commandIds.push(action.payload.id);
      state.nextCommandSequence = Math.max(state.nextCommandSequence, action.payload.sequence + 1);
    },
    appendResolvedTurn(state, action: PayloadAction<ResolvedTurnRecord>) {
      state.resolvedTurns.push(action.payload);
      if (state.currentTurn.packetRuntimeId === action.payload.packetRuntimeId) {
        state.currentTurn.commandIds = [];
      }
      state.nextTurnSequence = Math.max(state.nextTurnSequence, action.payload.sequence + 1);
    },
    appendSessionEvent(state, action: PayloadAction<SessionEventRecord>) {
      state.sessionEvents.push(action.payload);
      state.nextEventSequence = Math.max(state.nextEventSequence, action.payload.sequence + 1);
    },
    appendCheckpoint(state, action: PayloadAction<SessionCheckpointRecord>) {
      state.checkpoints.push(action.payload);
      state.nextCheckpointSequence = Math.max(state.nextCheckpointSequence, action.payload.sequence + 1);
    },
    activatePendingPacket(state, action: PayloadAction<{ packetId: string }>) {
      if (state.activePacketId) {
        return;
      }

      const packetIndex = state.pendingPacketIds.indexOf(action.payload.packetId);

      if (packetIndex === -1) {
        return;
      }

      const [packetId] = state.pendingPacketIds.splice(packetIndex, 1);
      const packet = state.entities[packetId];

      if (!packet) {
        return;
      }

      packet.status = 'active';
      state.activePacketId = packetId;
      state.currentTurn.packetRuntimeId = packetId;
      state.currentTurn.commandIds = [];
      state.sessionStatus = 'active';
    },
    releaseUpcomingPackets(
      state,
      action: PayloadAction<{ count?: number; position?: 'front' | 'back' } | undefined>,
    ) {
      state.actionClock += 1;
      const count = Math.max(1, action.payload?.count ?? 1);
      const releasedIds: string[] = [];

      for (const packetId of state.upcomingPacketIds) {
        const packet = state.entities[packetId];

        if (!packet || packet.availableAtAction > state.actionClock) {
          continue;
        }

        releasedIds.push(packetId);

        if (releasedIds.length >= count) {
          break;
        }
      }

      if (releasedIds.length === 0) {
        return;
      }

      state.upcomingPacketIds = state.upcomingPacketIds.filter((packetId) => !releasedIds.includes(packetId));

      for (const packetId of releasedIds) {
        const packet = state.entities[packetId];

        if (packet) {
          packet.status = 'pending';
        }
      }

      if (action.payload?.position === 'front') {
        state.pendingPacketIds = [...releasedIds, ...state.pendingPacketIds];
      } else {
        state.pendingPacketIds.push(...releasedIds);
      }

      state.sessionStatus = 'active';
    },
    returnActivePacketToPending(
      state,
      action: PayloadAction<{ packetId: string; position?: 'front' | 'back'; resetPendingAge?: boolean }>,
    ) {
      const packet = state.entities[action.payload.packetId];

      if (!packet || state.activePacketId !== action.payload.packetId) {
        return;
      }

      packet.status = 'pending';
      if (action.payload.resetPendingAge !== false) {
        packet.pendingAge = 0;
      }
      state.activePacketId = null;
      if (action.payload.position === 'back') {
        state.pendingPacketIds.push(packet.runtimeId);
      } else {
        state.pendingPacketIds.unshift(packet.runtimeId);
      }
      state.currentTurn.packetRuntimeId = null;
      state.currentTurn.commandIds = [];
      state.sessionStatus = 'active';
    },
    applyPendingPacketPressure(
      state,
      action: PayloadAction<{ agedPacketIds: string[]; droppedPacketIds: string[] }>,
    ) {
      const droppedSet = new Set(action.payload.droppedPacketIds);

      for (const packetId of action.payload.agedPacketIds) {
        const packet = state.entities[packetId];

        if (!packet || droppedSet.has(packetId) || packet.status !== 'pending') {
          continue;
        }

        packet.pendingAge += 1;
      }

      if (action.payload.droppedPacketIds.length === 0) {
        return;
      }

      state.pendingPacketIds = state.pendingPacketIds.filter((packetId) => !droppedSet.has(packetId));

      for (const packetId of action.payload.droppedPacketIds) {
        const packet = state.entities[packetId];

        if (!packet) {
          continue;
        }

        packet.pendingAge += 1;
        packet.status = 'resolved';
        packet.resolvedByActionId = packet.resolvedByActionId ?? `auto-timeout-${packet.runtimeId}`;
        state.resolvedPacketIds.push(packet.runtimeId);
      }
    },
    applyPendingPacketOverflow(state, action: PayloadAction<{ droppedPacketIds: string[] }>) {
      if (action.payload.droppedPacketIds.length === 0) {
        return;
      }

      const droppedSet = new Set(action.payload.droppedPacketIds);
      state.pendingPacketIds = state.pendingPacketIds.filter((packetId) => !droppedSet.has(packetId));

      for (const packetId of action.payload.droppedPacketIds) {
        const packet = state.entities[packetId];

        if (!packet) {
          continue;
        }

        packet.status = 'resolved';
        packet.resolvedByActionId = packet.resolvedByActionId ?? `auto-overflow-${packet.runtimeId}`;
        state.resolvedPacketIds.push(packet.runtimeId);
      }
    },
    resolveActivePacket(state, action: PayloadAction<{ packetId: string; actionId: string }>) {
      const packet = state.entities[action.payload.packetId];

      if (!packet) {
        return;
      }

      packet.status = 'resolved';
      packet.resolvedByActionId = action.payload.actionId;
      state.resolvedPacketIds.push(packet.runtimeId);
      state.activePacketId = null;
      state.currentTurn.packetRuntimeId = null;
      state.currentTurn.commandIds = [];
      state.sessionStatus =
        state.pendingPacketIds.length > 0 || state.upcomingPacketIds.length > 0 ? 'active' : 'resolved';
    },
    enqueueRuntimePackets(
      state,
      action: PayloadAction<{
        packets: RuntimePacketRecord[];
        position?: 'front' | 'back';
        placement?: 'pending' | 'upcoming';
        availableAtAction?: number;
      }>,
    ) {
      if (action.payload.packets.length === 0) {
        return;
      }

      gameTrafficAdapter.addMany(state, action.payload.packets);

      const queuedIds: string[] = [];

      for (const packet of action.payload.packets) {
        state.packetOrder.push(packet.runtimeId);
        queuedIds.push(packet.runtimeId);
      }

      const placement = action.payload.placement ?? 'upcoming';

      if (placement === 'pending' && action.payload.position === 'front') {
        state.pendingPacketIds = [...queuedIds, ...state.pendingPacketIds];
      } else if (placement === 'pending') {
        state.pendingPacketIds.push(...queuedIds);
      } else if (action.payload.position === 'front') {
        state.upcomingPacketIds = [...queuedIds, ...state.upcomingPacketIds];
      } else {
        state.upcomingPacketIds.push(...queuedIds);
      }

      for (const packetId of queuedIds) {
        const packet = state.entities[packetId];

        if (packet) {
          packet.availableAtAction =
            action.payload.availableAtAction ?? (placement === 'pending' ? state.actionClock : state.actionClock + 1);
          packet.status = placement === 'pending' ? 'pending' : 'upcoming';
        }
      }

      state.nextRuntimeOrdinal = Math.max(
        state.nextRuntimeOrdinal,
        ...action.payload.packets.map((packet) => packet.ordinal + 1),
      );

      state.sessionStatus = 'active';
    },
    replaceObjectives(state, action: PayloadAction<DayObjectiveState[]>) {
      state.objectives = action.payload;
    },
    replaceBackgroundFlows(state, action: PayloadAction<GameTrafficState['backgroundFlows']>) {
      state.backgroundFlows = action.payload;
    },
  },
});

export const gameTrafficReducer = gameTrafficSlice.reducer;
export const gameTrafficActions = gameTrafficSlice.actions;
