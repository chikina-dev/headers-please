import { describe, expect, it } from 'vitest';

import { gameTrafficActions, gameTrafficReducer } from '../src/features/game/gameTrafficSlice';
import { buildDaySession } from '../src/features/game/runtimeSession';
import type { ScenarioDay } from '../src/features/game/types';

const makeArrivalDay = (): ScenarioDay => ({
  id: 'arrival-day',
  unit: 99,
  dayNumber: 99,
  phaseId: 'portExhaustion',
  title: 'Arrival Day',
  summary: 'arrival test',
  learningGoal: 'arrival test',
  availableStamps: ['red'],
  availableVerdicts: ['ACCEPT', 'REJECT'],
  rules: {
    columns: ['externalHost', 'externalPort', 'internalHost'],
    inboundLookupKeys: ['externalHost', 'externalPort'],
  },
  packets: [
    {
      id: 'packet-1',
      prompt: 'packet-1',
      expectation: { verdict: 'ACCEPT', flow: 'outbound', requiredStampId: 'red' },
      packet: {
        id: 'packet-1',
        direction: 'lanToWan',
        source: { host: 'PC-A' },
        destination: { host: 'Server-1' },
      },
    },
    {
      id: 'packet-2',
      prompt: 'packet-2',
      expectation: { verdict: 'ACCEPT', flow: 'outbound', requiredStampId: 'red' },
      packet: {
        id: 'packet-2',
        direction: 'lanToWan',
        source: { host: 'PC-B' },
        destination: { host: 'Server-2' },
      },
    },
    {
      id: 'packet-3',
      prompt: 'packet-3',
      expectation: { verdict: 'ACCEPT', flow: 'outbound', requiredStampId: 'red' },
      packet: {
        id: 'packet-3',
        direction: 'lanToWan',
        source: { host: 'PC-C' },
        destination: { host: 'Server-3' },
      },
    },
    {
      id: 'packet-4',
      prompt: 'packet-4',
      expectation: {
        verdict: 'REJECT',
        reason: 'unknown inbound',
        reasonCode: 'unknownInbound',
      },
      packet: {
        id: 'packet-4',
        direction: 'wanToLan',
        source: { host: 'Unknown-1' },
        destination: { host: '自宅', port: 'red' },
      },
    },
    {
      id: 'packet-5',
      prompt: 'packet-5',
      expectation: {
        verdict: 'REJECT',
        reason: 'unknown inbound',
        reasonCode: 'unknownInbound',
      },
      packet: {
        id: 'packet-5',
        direction: 'wanToLan',
        source: { host: 'Unknown-2' },
        destination: { host: '自宅', port: 'red' },
      },
    },
  ],
});

describe('traffic arrivals', () => {
  it('starts a day with only the phase inbox window visible and keeps the rest upcoming', () => {
    const session = buildDaySession(makeArrivalDay(), 42, 'run-arrival');

    expect(session.pendingPacketIds).toHaveLength(3);
    expect(session.upcomingPacketIds).toHaveLength(2);
    expect(
      session.packets
        .filter((packet) => packet.status === 'pending')
        .every((packet) => packet.availableAtAction === 0),
    ).toBe(true);
    expect(
      session.packets
        .filter((packet) => packet.status === 'upcoming')
        .every((packet) => packet.availableAtAction === 1),
    ).toBe(true);
    expect(session.packets.filter((packet) => packet.status === 'pending')).toHaveLength(3);
    expect(session.packets.filter((packet) => packet.status === 'upcoming')).toHaveLength(2);
  });

  it('releases due upcoming packets by arrival step without auto-focusing the workbench', () => {
    const session = buildDaySession(makeArrivalDay(), 42, 'run-arrival');
    let state = gameTrafficReducer(undefined, gameTrafficActions.startDaySession(session));

    expect(state.activePacketId).toBe(null);
    expect(state.pendingPacketIds).toHaveLength(3);
    expect(state.upcomingPacketIds).toHaveLength(2);
    expect(state.actionClock).toBe(0);

    const nextUpcomingIds = state.upcomingPacketIds.slice();

    state = gameTrafficReducer(
      state,
      gameTrafficActions.releaseUpcomingPackets({
        count: 2,
        position: 'back',
      }),
    );

    expect(state.activePacketId).toBe(null);
    expect(state.actionClock).toBe(1);
    expect(state.pendingPacketIds).toHaveLength(5);
    expect(state.pendingPacketIds.slice(-2)).toEqual(nextUpcomingIds);
    expect(state.upcomingPacketIds).toHaveLength(0);
    expect(state.entities[nextUpcomingIds[0]]?.status).toBe('pending');
    expect(state.entities[nextUpcomingIds[1]]?.status).toBe('pending');
  });

  it('keeps delayed packets hidden until their arrival step is reached', () => {
    const delayedDay: ScenarioDay = {
      ...makeArrivalDay(),
      phaseId: 'directRouting',
      packets: [
        {
          id: 'early-packet',
          prompt: 'early-packet',
          expectation: { verdict: 'ACCEPT', flow: 'outbound' },
          packet: {
            id: 'early-packet',
            direction: 'lanToWan',
            source: { host: 'PC-A' },
            destination: { host: 'Server-1' },
          },
        },
        {
          id: 'delayed-packet',
          prompt: 'delayed-packet',
          expectation: { verdict: 'REJECT', reason: 'unknown', reasonCode: 'unknownInbound' },
          runtime: { arrivalDelayActions: 2 },
          packet: {
            id: 'delayed-packet',
            direction: 'wanToLan',
            source: { host: 'Unknown' },
            destination: { host: '自宅', port: 'red' },
          },
        },
      ],
    };

    const session = buildDaySession(delayedDay, 42, 'run-delay');
    let state = gameTrafficReducer(undefined, gameTrafficActions.startDaySession(session));

    expect(state.pendingPacketIds).toHaveLength(1);
    expect(state.upcomingPacketIds).toHaveLength(1);
    const delayedId = state.upcomingPacketIds[0]!;

    state = gameTrafficReducer(
      state,
      gameTrafficActions.releaseUpcomingPackets({
        count: 1,
        position: 'back',
      }),
    );
    expect(state.actionClock).toBe(1);
    expect(state.pendingPacketIds).toHaveLength(1);
    expect(state.upcomingPacketIds).toEqual([delayedId]);

    state = gameTrafficReducer(
      state,
      gameTrafficActions.releaseUpcomingPackets({
        count: 1,
        position: 'back',
      }),
    );
    expect(state.actionClock).toBe(2);
    expect(state.pendingPacketIds).toHaveLength(1);
    expect(state.upcomingPacketIds).toEqual([delayedId]);

    state = gameTrafficReducer(
      state,
      gameTrafficActions.releaseUpcomingPackets({
        count: 1,
        position: 'back',
      }),
    );
    expect(state.actionClock).toBe(3);
    expect(state.pendingPacketIds).toContain(delayedId);
    expect(state.upcomingPacketIds).toHaveLength(0);
  });

  it('drops pending packets that overflow the inbox capacity', () => {
    const session = buildDaySession(makeArrivalDay(), 42, 'run-overflow');
    let state = gameTrafficReducer(undefined, gameTrafficActions.startDaySession(session));

    expect(state.pendingPacketIds).toHaveLength(3);

    state = gameTrafficReducer(
      state,
      gameTrafficActions.releaseUpcomingPackets({
        count: 2,
        position: 'back',
      }),
    );

    expect(state.pendingPacketIds).toHaveLength(5);

    const droppedPacketId = state.pendingPacketIds[4]!;

    state = gameTrafficReducer(
      state,
      gameTrafficActions.applyPendingPacketOverflow({
        droppedPacketIds: [droppedPacketId],
      }),
    );

    expect(state.pendingPacketIds).toHaveLength(4);
    expect(state.pendingPacketIds).not.toContain(droppedPacketId);
    expect(state.resolvedPacketIds).toContain(droppedPacketId);
    expect(state.entities[droppedPacketId]?.status).toBe('resolved');
    expect(state.entities[droppedPacketId]?.resolvedByActionId).toBe(`auto-overflow-${droppedPacketId}`);
  });
});
