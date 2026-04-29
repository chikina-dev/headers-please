import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import {
  applyRouteTargetSelection,
  applyStampSelection,
  applyTableEntrySelection,
  advanceToNextDay,
  chooseStamp,
  chooseTableEntry,
  chooseRouteTarget,
  closeSelectedTableEntry,
  inspectRunArchive,
  pullPacketToWorkbench,
  replayCurrentDay,
  shelveWorkbenchPacket,
  startCampaign,
  submitVerdict,
  waitOneTurn,
} from '../src/features/game/gameSlice';
import { gameTableActions } from '../src/features/game/gameTableSlice';
import { gameTrafficActions } from '../src/features/game/gameTrafficSlice';
import { buildDaySession, buildInitialTableEntries, createRuntimePacketRecord } from '../src/features/game/runtimeSession';
import { scenarioDayMap } from '../src/features/game/scenarios';
import { gameReducer } from '../src/features/game/gameSlice';
import { selectRouteSlipTargets } from '../src/features/game/selectors';
import { buildArchiveRestorePayload } from '../src/features/game/sessionRestore';
import { selectSessionExportSnapshot } from '../src/features/game/selectors';
import type { ScenarioDay } from '../src/features/game/types';
import { createTestStore, type TestStore } from './helpers/createTestStore';

const getGameState = (store: TestStore) => store.getState().game;

describe('game backend flow', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('archives an in-progress run as abandoned before replaying the current day', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    const firstRunId = getGameState(store).traffic.runId;

    expect(firstRunId).toBeTruthy();

    store.dispatch(replayCurrentDay());

    const state = getGameState(store);

    expect(state.progress.runHistory).toHaveLength(2);
    expect(state.progress.runArchives).toHaveLength(1);
    expect(state.progress.dayHistory).toHaveLength(0);
    expect(state.progress.runArchives[0]?.runId).toBe(firstRunId);
    expect(state.progress.runArchives[0]?.archiveReason).toBe('abandoned');
    expect(state.traffic.runId).not.toBe(firstRunId);
    expect(state.progress.currentDayId).toBe('day-1');
  });

  it('restores an archived run snapshot for inspection', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    const firstRunId = getGameState(store).traffic.runId;
    store.dispatch(replayCurrentDay());

    const archive = getGameState(store).progress.runArchives[0];

    expect(archive?.runId).toBe(firstRunId);

    store.dispatch(inspectRunArchive(firstRunId!));

    const state = getGameState(store);

    expect(state.progress.inspectedRunId).toBe(firstRunId);
    expect(state.progress.activeRunId).toBe(null);
    expect(state.traffic.runId).toBe(firstRunId);
    expect(state.traffic.packetOrder).toEqual(archive?.exportSnapshot.trafficSnapshot.packetOrder);
    expect(state.table.ids).toEqual(
      archive?.exportSnapshot.tableSnapshot.entries.map((entry) => entry.id) ?? [],
    );
    expect(state.audit.ids).toEqual(
      archive?.exportSnapshot.auditSnapshot.logs.map((entry) => entry.id) ?? [],
    );
  });

  it('builds a session export snapshot with exact restore data and cloneable restore payloads', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());

    const exportSnapshot = selectSessionExportSnapshot(store.getState());

    expect(exportSnapshot.runId).toBe(getGameState(store).traffic.runId);
    expect(exportSnapshot.trafficSnapshot.packetOrder).toEqual(getGameState(store).traffic.packetOrder);
    expect(exportSnapshot.tableSnapshot.nextSequence).toBe(getGameState(store).table.nextSequence);
    expect(exportSnapshot.auditSnapshot.nextSequence).toBe(getGameState(store).audit.nextSequence);

    store.dispatch(replayCurrentDay());
    const archive = getGameState(store).progress.runArchives[0];
    const restorePayload = buildArchiveRestorePayload(archive!);

    restorePayload.trafficSnapshot.packetOrder.push('mutated');
    restorePayload.tableSnapshot.entries.push({
      id: 'extra',
      sequence: 999,
      createdFromPacketId: 'extra',
      externalHost: 'home',
      internalHost: 'pc',
      lifecycleState: 'waiting',
      remainingTurns: 1,
      maxRemainingTurns: 1,
    });
    restorePayload.auditSnapshot.logs.push({
      id: 'audit-extra',
      sequence: 999,
      dayId: 'day-1',
      runId: archive!.runId,
      packetId: 'packet',
      action: 'ACCEPT',
      outcome: 'advanced',
      message: 'extra',
    });

    expect(archive?.exportSnapshot.trafficSnapshot.packetOrder).not.toContain('mutated');
    expect(archive?.exportSnapshot.tableSnapshot.entries).toHaveLength(0);
    expect(archive?.exportSnapshot.auditSnapshot.logs).toHaveLength(0);
  });

  it('records verdict side effects and resolves a run into history and archive data', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    let actionsSubmitted = 0;

    store.dispatch(pullPacketToWorkbench());

    expect(getGameState(store).traffic.actionResults).toHaveLength(0);

    store.dispatch(chooseRouteTarget('Server-1'));
    store.dispatch(applyRouteTargetSelection());
    store.dispatch(submitVerdict('ACCEPT'));
    actionsSubmitted += 1;

    let state = getGameState(store);

    expect(state.traffic.actionResults).toHaveLength(1);
    expect(state.traffic.sessionEvents.some((event) => event.kind === 'actionResolved')).toBe(true);
    expect(state.traffic.resolvedTurns).toHaveLength(1);
    expect(state.progress.dayHistory).toHaveLength(0);

    while (state.progress.dayHistory.length === 0 && actionsSubmitted < 20) {
      if (state.traffic.activePacketId == null && state.traffic.pendingPacketIds.length > 0) {
        store.dispatch(pullPacketToWorkbench());
        state = getGameState(store);
      }

      const activePacket =
        state.traffic.activePacketId == null
          ? null
          : state.traffic.entities[state.traffic.activePacketId] ?? null;

      if (!activePacket) {
        break;
      }

      if (activePacket?.routeTargets?.length) {
        const expectedRouteTarget =
          activePacket.expectation.verdict === 'ACCEPT' && activePacket.expectation.flow === 'inbound'
            ? activePacket.expectation.expectedTarget
            : activePacket.packet.destination;
        const routeTargetId = expectedRouteTarget.port
          ? `${expectedRouteTarget.host}:${expectedRouteTarget.port}`
          : expectedRouteTarget.host;

        if (state.workspace.draft.routeTargetId == null) {
          store.dispatch(chooseRouteTarget(routeTargetId));
        }
        if (state.workspace.draft.appliedRouteTargetId == null) {
          store.dispatch(applyRouteTargetSelection());
        }
      }
      if (activePacket?.packet.direction === 'lanToWan' && !activePacket.routeTargets?.length && state.workspace.draft.stampId == null) {
        store.dispatch(chooseStamp('home'));
      }
      if (activePacket?.packet.direction === 'lanToWan' && !activePacket.routeTargets?.length && state.workspace.draft.appliedStampId == null) {
        store.dispatch(applyStampSelection());
      }
      if (
        !activePacket?.routeTargets?.length &&
        activePacket?.packet.direction === 'wanToLan' &&
        state.workspace.draft.tableEntryId == null &&
        typeof state.table.ids[0] === 'string'
      ) {
        store.dispatch(chooseTableEntry(state.table.ids[0]));
      }
      if (activePacket?.packet.direction === 'wanToLan' && state.workspace.draft.appliedTableEntryId == null) {
        store.dispatch(applyTableEntrySelection());
      }
      store.dispatch(submitVerdict('ACCEPT'));
      actionsSubmitted += 1;
      state = getGameState(store);
    }

    expect(actionsSubmitted).toBeGreaterThan(1);

    expect(state.progress.dayHistory).toHaveLength(1);
    expect(state.progress.dayHistory[0]?.actionCount).toBe(actionsSubmitted);
    expect(state.progress.dayHistory[0]?.incidentCount).toBeGreaterThanOrEqual(0);
    expect(state.progress.runArchives).toHaveLength(1);
    expect(state.progress.runArchives[0]?.archiveReason).toBe('resolved');
    expect(state.progress.transitions).toHaveLength(1);
    expect(state.progress.lastResolution?.kind).toBe('clear');
    expect(state.progress.nextDayId).toBe('day-2');
  });

  it('applies rewrites to the workbench document as soon as a stamp or row is chosen', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    store.dispatch(pullPacketToWorkbench());

    let state = getGameState(store);
    expect(state.workspace.document.source?.host).toBe('PC-A');
    expect(state.workspace.document.sourceApplied).toBe(false);

    store.dispatch(chooseStamp('home'));
    state = getGameState(store);

    expect(state.workspace.document.source?.host).toBe('自宅');
    expect(state.workspace.draft.appliedStampId).toBe('home');
    expect(state.workspace.document.sourceApplied).toBe(true);

    store.dispatch(submitVerdict('ACCEPT'));
    state = getGameState(store);

    expect(state.workspace.document.placement).toBe('idle');
    if (state.traffic.activePacketId == null && state.traffic.pendingPacketIds.length > 0) {
      store.dispatch(pullPacketToWorkbench());
      state = getGameState(store);
    }
    const inboundPacket =
      state.traffic.activePacketId == null ? null : state.traffic.entities[state.traffic.activePacketId] ?? null;

    expect(inboundPacket?.packet.direction).toBe('wanToLan');
    expect(state.workspace.document.placement).toBe('workbench');
    expect(state.workspace.document.destination?.host).toBe('自宅');
    expect(state.workspace.document.destinationApplied).toBe(false);

    if (typeof state.table.ids[0] === 'string') {
      store.dispatch(chooseTableEntry(state.table.ids[0]));
    }
    state = getGameState(store);

    expect(state.workspace.document.destination?.host).toBe('PC-A');
    expect(state.workspace.document.destinationApplied).toBe(true);
  });

  it('does not allow reject before the reject lesson is unlocked', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    store.dispatch(pullPacketToWorkbench());
    store.dispatch(chooseStamp('home'));
    store.dispatch(applyStampSelection());
    store.dispatch(submitVerdict('REJECT'));

    const state = getGameState(store);

    expect(state.traffic.actionResults).toHaveLength(0);
    expect(state.workspace.feedback?.message).toContain('まだ拒否操作は使えません');
    expect(state.progress.currentDayId).toBe('day-1');
  });

  it('fails day 2 on NAT ambiguity and advances to the color-stamp lesson', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    store.dispatch(pullPacketToWorkbench());
    store.dispatch(chooseStamp('home'));
    store.dispatch(applyStampSelection());
    store.dispatch(submitVerdict('ACCEPT'));

    store.dispatch(pullPacketToWorkbench());
    if (typeof getGameState(store).table.ids[0] === 'string') {
      store.dispatch(chooseTableEntry(getGameState(store).table.ids[0] as string));
      store.dispatch(applyTableEntrySelection());
    }
    store.dispatch(submitVerdict('ACCEPT'));

    let state = getGameState(store);
    expect(state.progress.screen).toBe('dayClear');

    store.dispatch(advanceToNextDay());
    state = getGameState(store);
    expect(state.progress.currentDayId).toBe('day-2');

    expect(selectRouteSlipTargets(store.getState())).toHaveLength(0);

    store.dispatch(pullPacketToWorkbench());
    store.dispatch(chooseStamp('home'));
    store.dispatch(applyStampSelection());
    store.dispatch(submitVerdict('ACCEPT'));

    state = getGameState(store);
    expect(state.traffic.actionResults.at(-1)?.outcomeCode).toBe('registeredMapping');

    let guard = 0;
    while (guard < 12) {
      state = getGameState(store);
      if (state.progress.screen !== 'inspection') {
        break;
      }

      if (state.traffic.activePacketId == null && state.traffic.pendingPacketIds.length > 0) {
        store.dispatch(pullPacketToWorkbench());
        state = getGameState(store);
      }

      const activePacket =
        state.traffic.activePacketId == null ? null : state.traffic.entities[state.traffic.activePacketId] ?? null;

      if (!activePacket) {
        break;
      }

      if (activePacket.packet.direction === 'lanToWan') {
        if (state.workspace.draft.stampId == null) {
          store.dispatch(chooseStamp('home'));
        }
        if (state.workspace.draft.appliedStampId == null) {
          store.dispatch(applyStampSelection());
        }
      } else {
        const routeSlips = selectRouteSlipTargets(store.getState());
        expect(routeSlips.length).toBeGreaterThan(0);
        if (state.table.ids.length === 2) {
          expect(routeSlips).toHaveLength(2);
          expect(routeSlips[0]?.ambiguityCount).toBe(2);
        }
        const firstEntryId = state.table.ids[0];
        if (typeof firstEntryId === 'string' && state.workspace.draft.tableEntryId == null) {
          store.dispatch(chooseTableEntry(firstEntryId));
        }
        if (typeof firstEntryId === 'string' && state.workspace.draft.appliedTableEntryId == null) {
          store.dispatch(applyTableEntrySelection());
        }
      }

      store.dispatch(submitVerdict('ACCEPT'));
      guard += 1;
    }

    state = getGameState(store);
    expect(state.progress.screen).toBe('dayFailure');
    expect(state.progress.nextDayId).toBe('day-3');
    expect(state.progress.dayHistory.at(-1)?.kind).toBe('failure');
    expect(state.progress.dayHistory.at(-1)?.dayId).toBe('day-2');
    expect(state.traffic.actionResults.at(-1)?.incidentKind).toBe('ambiguousReturnRoute');
    expect(
      state.traffic.packetOrder.some((packetId) =>
        state.traffic.entities[packetId]?.spawnSource === 'generatedResponse',
      ),
    ).toBe(true);
  });

  it('records manual close as an action result and removes the selected entry', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    store.dispatch(
      gameTableActions.registerTableEntry({
        id: 'entry-test',
        sequence: 1,
        createdFromPacketId: 'packet-test',
        externalHost: '自宅',
        internalHost: 'PC-Z',
        lifecycleState: 'active',
        remainingTurns: 4,
        maxRemainingTurns: 4,
      }),
    );
    store.dispatch(chooseTableEntry('entry-test'));

    store.dispatch(closeSelectedTableEntry());

    const state = getGameState(store);
    const latestAction = state.traffic.actionResults.at(-1);
    const latestEvent = state.traffic.sessionEvents.at(-1);

    expect(state.table.ids).not.toContain('entry-test');
    expect(latestAction?.action).toBe('CLOSE');
    expect(latestAction?.outcomeCode).toBe('manualClose');
    expect(latestEvent?.kind).toBe('mappingClosed');
    expect(state.traffic.resolvedTurns.at(-1)?.outcomeCode).toBe('manualClose');
  });

  it('advances table lifecycles even when the packet is returned without progressing', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());
    store.dispatch(
      gameTableActions.registerTableEntry({
        id: 'entry-timeout-on-return',
        sequence: 1,
        createdFromPacketId: 'packet-test',
        externalHost: '自宅',
        internalHost: 'PC-Z',
        lifecycleState: 'waiting',
        remainingTurns: 1,
        maxRemainingTurns: 1,
      }),
    );
    store.dispatch(pullPacketToWorkbench());
    store.dispatch(submitVerdict('ACCEPT'));

    const state = getGameState(store);
    const latestAction = state.traffic.actionResults.at(-1);
    const timeoutEvent = state.traffic.sessionEvents.find((event) => event.kind === 'mappingTimedOut');

    expect(latestAction?.outcomeCode).toBe('returnedForRewrite');
    expect(state.table.ids).not.toContain('entry-timeout-on-return');
    expect(timeoutEvent?.relatedEntryId).toBe('entry-timeout-on-return');
    expect(latestAction?.context.expiredEntryIds).toContain('entry-timeout-on-return');
  });

  it('lets the player shelve a half-processed packet, inspect another one, and then resume from the same paper state', () => {
    const store = createTestStore();
    const day: ScenarioDay = {
      id: 'switch-day',
      unit: 99,
      dayNumber: 99,
      phaseId: 'portExhaustion',
      title: 'Switch Day',
      summary: 'switch test',
      learningGoal: 'switch test',
      availableStamps: ['red', 'blue'],
      rules: {
        columns: ['externalHost', 'externalPort', 'internalHost'],
        inboundLookupKeys: ['externalHost', 'externalPort'],
      },
      packets: [
        {
          id: 'outbound-a',
          prompt: 'outbound-a',
          expectation: { verdict: 'ACCEPT', flow: 'outbound', requiredStampId: 'blue' },
          packet: {
            id: 'outbound-a',
            direction: 'lanToWan',
            source: { host: 'PC-A', port: '1001' },
            destination: { host: 'Server-1', port: 'Web' },
          },
        },
        {
          id: 'outbound-b',
          prompt: 'outbound-b',
          expectation: { verdict: 'ACCEPT', flow: 'outbound', requiredStampId: 'red' },
          packet: {
            id: 'outbound-b',
            direction: 'lanToWan',
            source: { host: 'PC-B', port: '2001' },
            destination: { host: 'Server-2', port: 'Game' },
          },
        },
        {
          id: 'outbound-c',
          prompt: 'outbound-c',
          expectation: { verdict: 'ACCEPT', flow: 'outbound', requiredStampId: 'red' },
          packet: {
            id: 'outbound-c',
            direction: 'lanToWan',
            source: { host: 'PC-C', port: '3001' },
            destination: { host: 'Server-3', port: 'Mail' },
          },
        },
      ],
    };
    const session = buildDaySession(day, 77, 'run-switch');
    store.dispatch(gameTrafficActions.startDaySession(session));

    let state = store.getState().game;
    const outboundId =
      state.traffic.pendingPacketIds.find((packetId) => state.traffic.entities[packetId]?.packet.direction === 'lanToWan') ?? null;
    const otherPendingId =
      state.traffic.pendingPacketIds.find((packetId) => packetId !== outboundId) ?? null;

    expect(outboundId).toBeTruthy();
    expect(otherPendingId).toBeTruthy();

    store.dispatch(pullPacketToWorkbench(outboundId!));
    store.dispatch(chooseStamp('blue'));
    store.dispatch(applyStampSelection());

    state = store.getState().game;
    expect(state.workspace.document.sourceApplied).toBe(true);
    expect(state.workspace.draft.appliedStampId).toBe('blue');

    store.dispatch(shelveWorkbenchPacket());
    state = store.getState().game;

    expect(state.traffic.activePacketId).toBe(null);
    expect(state.traffic.pendingPacketIds).toContain(outboundId!);
    expect(state.workspace.document.packetRuntimeId).toBe(null);
    expect(state.workspace.suspendedPackets[outboundId!]?.document.sourceApplied).toBe(true);

    store.dispatch(pullPacketToWorkbench(otherPendingId!));
    state = store.getState().game;
    expect(state.traffic.activePacketId).toBe(otherPendingId);

    store.dispatch(pullPacketToWorkbench(outboundId!));
    state = store.getState().game;

    expect(state.traffic.activePacketId).toBe(outboundId);
    expect(state.workspace.document.packetRuntimeId).toBe(outboundId);
    expect(state.workspace.document.placement).toBe('workbench');
    expect(state.workspace.document.sourceApplied).toBe(true);
    expect(state.workspace.document.source).toEqual({ host: '自宅', port: 'blue' });
    expect(state.workspace.draft.appliedStampId).toBe('blue');
    expect(state.workspace.suspendedPackets[outboundId!]).toBeUndefined();
  });

  it('lets the player wait a turn to advance timeouts and free occupied colors', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-20',
            nextDayId: null,
            unlockedDayIds: ['day-20'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-20'];
    const session = buildDaySession(day, 77, 'run-day-20');
    const seededEntries = buildInitialTableEntries(day);
    session.backgroundFlows = [];

    store.dispatch(
      gameTableActions.hydrateTableSnapshot({
        entries: seededEntries,
        nextSequence: seededEntries.length + 1,
      }),
    );
    store.dispatch(gameTrafficActions.startDaySession(session));

    let state = store.getState().game;
    const blueEntry = state.table.ids
      .map((id) => state.table.entities[id])
      .find((entry) => entry?.externalPort === 'blue');

    expect(blueEntry?.remainingTurns).toBe(3);

    store.dispatch(waitOneTurn());
    state = store.getState().game;

    expect(state.traffic.actionClock).toBe(1);
    expect(state.traffic.actionResults.at(-1)?.action).toBe('WAIT');
    expect(state.table.entities[blueEntry!.id]?.remainingTurns).toBe(2);

    store.dispatch(waitOneTurn());
    store.dispatch(waitOneTurn());
    state = store.getState().game;

    expect(state.table.entities[blueEntry!.id]).toBeUndefined();
    expect(state.traffic.sessionEvents.some((event) => event.kind === 'mappingTimedOut' && event.relatedEntryId === blueEntry!.id)).toBe(true);
  });

  it('turns a newly accepted late-game line into recurring background work', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-20',
            nextDayId: null,
            unlockedDayIds: ['day-20'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-20'];
    const packet = createRuntimePacketRecord(
      {
        ...day.packets[0]!,
        runtime: {
          ...day.packets[0]!.runtime,
          waitBudgetActions: 99,
        },
      },
      0,
      'scenario',
      0,
    );
    const session = {
      dayId: day.id,
      runId: 'run-recurring-line',
      sessionStatus: 'active' as const,
      packets: [packet],
      packetOrder: [packet.runtimeId],
      activePacketId: null,
      upcomingPacketIds: [],
      pendingPacketIds: [packet.runtimeId],
      resolvedPacketIds: [],
      backgroundFlows: [],
      actionClock: 0,
      actionResults: [],
      objectives: [],
      nextActionSequence: 1,
      nextRuntimeOrdinal: 1,
      daySeed: 55,
      rngSeed: 55,
    };

    store.dispatch(gameTrafficActions.startDaySession(session));

    store.dispatch(pullPacketToWorkbench());
    store.dispatch(chooseStamp('blue'));
    store.dispatch(applyStampSelection());
    store.dispatch(submitVerdict('ACCEPT'));

    let state = getGameState(store);
    expect(state.traffic.backgroundFlows).toHaveLength(1);
    expect(state.traffic.sessionEvents.some((event) => event.kind === 'backgroundPacketQueued')).toBe(true);

    store.dispatch(waitOneTurn());
    state = getGameState(store);

    expect(
      state.traffic.pendingPacketIds.some(
        (packetId) => state.traffic.entities[packetId]?.spawnSource === 'backgroundFlow',
      ),
    ).toBe(true);
  });

  it('can overflow the inbox in late-game phases when arrivals outpace handling', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-20',
            nextDayId: null,
            unlockedDayIds: ['day-20'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-20'];
    const session = buildDaySession(day, 99, 'run-day-20-overflow');
    session.pendingPacketIds = [];
    session.upcomingPacketIds = [];
    session.activePacketId = null;
    session.backgroundFlows = [];
    session.packets = session.packets.map((packet) => ({
      ...packet,
      status: 'resolved',
    }));
    session.resolvedPacketIds = session.packetOrder.slice();

    store.dispatch(gameTrafficActions.startDaySession(session));
    let state = store.getState().game;
    const ordinalBase = state.traffic.nextRuntimeOrdinal;
    const pendingClonePackets = [
      createRuntimePacketRecord(day.packets[0]!, ordinalBase, 'scenario', 0),
      createRuntimePacketRecord(day.packets[0]!, ordinalBase + 1, 'scenario', 0),
      createRuntimePacketRecord(day.packets[0]!, ordinalBase + 2, 'scenario', 0),
      createRuntimePacketRecord(day.packets[0]!, ordinalBase + 3, 'scenario', 0),
    ];
    const upcomingClonePackets = [
      createRuntimePacketRecord(day.packets[1]!, ordinalBase + 4, 'scenario', 1),
      createRuntimePacketRecord(day.packets[1]!, ordinalBase + 5, 'scenario', 1),
    ];
    const droppedUpcomingIds = upcomingClonePackets.map((packet) => packet.runtimeId);

    store.dispatch(
      gameTrafficActions.enqueueRuntimePackets({
        packets: pendingClonePackets,
        placement: 'pending',
        position: 'back',
        availableAtAction: 0,
      }),
    );
    store.dispatch(
      gameTrafficActions.enqueueRuntimePackets({
        packets: upcomingClonePackets,
        placement: 'upcoming',
        position: 'back',
        availableAtAction: 1,
      }),
    );

    store.dispatch(waitOneTurn());

    state = store.getState().game;
    const overflowActions = state.traffic.actionResults.filter((result) => result.action === 'OVERFLOW');
    const overflowEvents = state.traffic.sessionEvents.filter((event) => event.kind === 'packetOverflowedInInbox');

    expect(state.traffic.pendingPacketIds).toHaveLength(4);
    expect(overflowActions).toHaveLength(2);
    expect(overflowActions.every((result) => result.outcomeCode === 'overflowedInInbox')).toBe(true);
    expect(overflowActions.every((result) => result.incidentKind === 'queueOverflowLoss')).toBe(true);
    expect(overflowEvents.map((event) => event.packetRuntimeId)).toEqual(droppedUpcomingIds);
    expect(state.traffic.resolvedPacketIds).toEqual(expect.arrayContaining(droppedUpcomingIds));
    expect(droppedUpcomingIds.every((packetId) => state.traffic.entities[packetId]?.status === 'resolved')).toBe(true);
  });

  it('spawns recurring background replies from active seeded entries and stops when the entry is closed', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-21',
            nextDayId: null,
            unlockedDayIds: ['day-21'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-21'];
    const session = buildDaySession(day, 55, 'run-day-21-background');
    const seededEntries = buildInitialTableEntries(day);

    store.dispatch(
      gameTableActions.hydrateTableSnapshot({
        entries: seededEntries,
        nextSequence: seededEntries.length + 1,
      }),
    );
    store.dispatch(gameTrafficActions.startDaySession(session));

    store.dispatch(waitOneTurn());

    let state = store.getState().game;
    const backgroundPacket = state.traffic.pendingPacketIds
      .map((packetId) => state.traffic.entities[packetId])
      .find((packet) => packet?.spawnSource === 'backgroundFlow');
    const initialBackgroundEventCount = state.traffic.sessionEvents.filter(
      (event) => event.kind === 'backgroundPacketQueued',
    ).length;

    expect(backgroundPacket?.packet.direction).toBe('wanToLan');
    expect(backgroundPacket?.packet.source.host).toBe('Server-1');
    expect(initialBackgroundEventCount).toBe(1);

    store.dispatch(chooseTableEntry(seededEntries[0]!.id));
    store.dispatch(closeSelectedTableEntry());
    store.dispatch(waitOneTurn());

    state = store.getState().game;
    const finalBackgroundEventCount = state.traffic.sessionEvents.filter(
      (event) => event.kind === 'backgroundPacketQueued',
    ).length;

    expect(state.table.entities[seededEntries[0]!.id]).toBeUndefined();
    expect(state.traffic.backgroundFlows).toHaveLength(0);
    expect(finalBackgroundEventCount).toBe(initialBackgroundEventCount);
  });

  it('clears a shift as soon as the late-game quota is met even if more packets remain', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-22',
            nextDayId: null,
            unlockedDayIds: ['day-22'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-22'];
    const rejectPackets = Array.from({ length: 4 }, (_, index) =>
      createRuntimePacketRecord(
        {
          ...day.packets[0]!,
          runtime: {
            ...day.packets[0]!.runtime,
            waitBudgetActions: 99,
          },
        },
        index,
        'scenario',
        0,
      ),
    );

    store.dispatch(
      gameTrafficActions.startDaySession({
        dayId: day.id,
        runId: 'run-day-22-shift-clear',
        sessionStatus: 'active',
        packets: rejectPackets,
        packetOrder: rejectPackets.map((packet) => packet.runtimeId),
        activePacketId: null,
        upcomingPacketIds: [],
        pendingPacketIds: rejectPackets.map((packet) => packet.runtimeId),
        resolvedPacketIds: [],
        backgroundFlows: [],
        actionClock: 0,
        actionResults: [],
        objectives: [],
        nextActionSequence: 1,
        nextRuntimeOrdinal: rejectPackets.length,
        daySeed: 77,
        rngSeed: 77,
      }),
    );

    for (let index = 0; index < 3; index += 1) {
      store.dispatch(pullPacketToWorkbench());
      store.dispatch(submitVerdict('REJECT'));
    }

    const state = store.getState().game;

    expect(state.progress.screen).toBe('campaignComplete');
    expect(state.progress.lastResolution?.kind).toBe('clear');
    expect(state.traffic.pendingPacketIds.length).toBeGreaterThan(0);
  });

  it('fails a shift immediately when the incident limit is exceeded', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-22',
            nextDayId: null,
            unlockedDayIds: ['day-22'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-22'];
    const rejectPackets = Array.from({ length: 2 }, (_, index) =>
      createRuntimePacketRecord(day.packets[0]!, index, 'scenario', 0),
    );

    store.dispatch(
      gameTrafficActions.startDaySession({
        dayId: day.id,
        runId: 'run-day-22-shift-failure',
        sessionStatus: 'active',
        packets: rejectPackets,
        packetOrder: rejectPackets.map((packet) => packet.runtimeId),
        activePacketId: null,
        upcomingPacketIds: [],
        pendingPacketIds: rejectPackets.map((packet) => packet.runtimeId),
        resolvedPacketIds: [],
        backgroundFlows: [],
        actionClock: 0,
        actionResults: [],
        objectives: [],
        nextActionSequence: 1,
        nextRuntimeOrdinal: rejectPackets.length,
        daySeed: 88,
        rngSeed: 88,
      }),
    );

    store.dispatch(pullPacketToWorkbench());
    store.dispatch(submitVerdict('ACCEPT'));

    const state = store.getState().game;

    expect(state.progress.screen).toBe('campaignComplete');
    expect(state.progress.lastResolution?.kind).toBe('failure');
    expect(state.traffic.pendingPacketIds.length).toBeGreaterThan(0);
  });

  it('allows REJECT without applying a route, lookup row, or stamp', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-4',
            nextDayId: null,
            unlockedDayIds: ['day-4'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-4'];
    const rejectPacket = createRuntimePacketRecord(day.packets[1]!, 0, 'scenario', 0);

    store.dispatch(
      gameTrafficActions.startDaySession({
        dayId: day.id,
        runId: 'run-day-4-reject',
        sessionStatus: 'active',
        packets: [rejectPacket],
        packetOrder: [rejectPacket.runtimeId],
        activePacketId: null,
        upcomingPacketIds: [],
        pendingPacketIds: [rejectPacket.runtimeId],
        resolvedPacketIds: [],
        backgroundFlows: [],
        actionClock: 0,
        actionResults: [],
        objectives: [],
        nextActionSequence: 1,
        nextRuntimeOrdinal: 1,
        daySeed: 44,
        rngSeed: 44,
      }),
    );

    store.dispatch(pullPacketToWorkbench());
    store.dispatch(submitVerdict('REJECT'));

    const state = getGameState(store);

    expect(state.traffic.actionResults.at(-1)?.action).toBe('REJECT');
    expect(state.traffic.actionResults.at(-1)?.outcomeCode).toBe('rejectedExpected');
  });

  it('fails a late-game shift when the action clock runs out before the quota is met', () => {
    const baseStore = createTestStore();
    const baseGameState = baseStore.getState().game;
    const store = configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          ...baseGameState,
          progress: {
            ...baseGameState.progress,
            screen: 'inspection',
            currentDayId: 'day-22',
            nextDayId: null,
            unlockedDayIds: ['day-22'],
          },
        },
      },
    });

    const day = scenarioDayMap['day-22'];
    const patientPacket = createRuntimePacketRecord(
      {
        ...day.packets[0]!,
        runtime: {
          ...day.packets[0]!.runtime,
          waitBudgetActions: 99,
        },
      },
      0,
      'scenario',
      0,
    );

    store.dispatch(
      gameTrafficActions.startDaySession({
        dayId: day.id,
        runId: 'run-day-22-shift-window',
        sessionStatus: 'active',
        packets: [patientPacket],
        packetOrder: [patientPacket.runtimeId],
        activePacketId: null,
        upcomingPacketIds: [],
        pendingPacketIds: [patientPacket.runtimeId],
        resolvedPacketIds: [],
        backgroundFlows: [],
        actionClock: 0,
        actionResults: [],
        objectives: [],
        nextActionSequence: 1,
        nextRuntimeOrdinal: 1,
        daySeed: 91,
        rngSeed: 91,
      }),
    );

    for (let index = 0; index < 6; index += 1) {
      store.dispatch(waitOneTurn());
    }

    const state = store.getState().game;

    expect(state.progress.screen).toBe('campaignComplete');
    expect(state.progress.lastResolution?.kind).toBe('failure');
    expect(state.progress.lastResolution?.title).toContain('時間切れ');
    expect(state.traffic.actionClock).toBe(6);
  });
});
