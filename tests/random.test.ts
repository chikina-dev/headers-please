import { describe, expect, it } from 'vitest';

import { buildTrafficQueue } from '../src/features/game/random';
import { buildDaySession, buildInitialTableEntries } from '../src/features/game/runtimeSession';
import { scenarioDayMap } from '../src/features/game/scenarios';
import type { ScenarioDay } from '../src/features/game/types';

const makeDay = (): ScenarioDay => ({
  id: 'test-day',
  unit: 99,
  dayNumber: 99,
  phaseId: 'portExhaustion',
  title: 'Test Day',
  summary: 'random test',
  learningGoal: 'random test',
  availableStamps: [],
  rules: {
    columns: ['externalHost', 'internalHost'],
    inboundLookupKeys: ['externalHost'],
  },
  packets: [
    {
      id: 'out-a',
      prompt: 'out-a',
      expectation: { verdict: 'ACCEPT', flow: 'outbound' },
      runtime: { minCopies: 2, maxCopies: 2 },
      packet: {
        id: 'out-a',
        direction: 'lanToWan',
        source: { host: 'PC-A' },
        destination: { host: 'Server-A' },
      },
    },
    {
      id: 'in-a',
      prompt: 'in-a',
      expectation: {
        verdict: 'ACCEPT',
        flow: 'inbound',
        expectedTarget: { host: 'PC-A' },
      },
      runtime: { minCopies: 1, maxCopies: 1 },
      packet: {
        id: 'in-a',
        direction: 'wanToLan',
        source: { host: 'Server-A' },
        destination: { host: 'HOME' },
      },
    },
  ],
});

describe('buildTrafficQueue', () => {
  it('expands runtime copies and keeps grouped traffic ordered by direction', () => {
    const day = makeDay();

    const queue = buildTrafficQueue(day, 123, 'grouped');

    expect(queue.packets).toHaveLength(3);
    expect(queue.packets.map((packet) => packet.templateId)).toEqual(['out-a', 'out-a', 'in-a']);
    expect(queue.packets.map((packet) => packet.runtimeId).sort()).toEqual([
      'in-a-2',
      'out-a-0',
      'out-a-1',
    ]);
    expect(queue.packets.map((packet) => packet.packet.direction)).toEqual([
      'lanToWan',
      'lanToWan',
      'wanToLan',
    ]);
  });

  it('is deterministic for the same seed in mixed ordering', () => {
    const day = makeDay();

    const left = buildTrafficQueue(day, 777, 'mixed');
    const right = buildTrafficQueue(day, 777, 'mixed');

    expect(left.seed).toBe(right.seed);
    expect(left.packets.map((packet) => packet.runtimeId)).toEqual(
      right.packets.map((packet) => packet.runtimeId),
    );
  });

  it('keeps grouped copy counts aligned for outbound and inbound packets', () => {
    const day: ScenarioDay = {
      ...makeDay(),
      packets: [
        {
          id: 'out-group',
          prompt: 'out-group',
          expectation: { verdict: 'ACCEPT', flow: 'outbound' },
          runtime: { minCopies: 1, maxCopies: 4, copyGroup: 'conversation-a' },
          packet: {
            id: 'out-group',
            direction: 'lanToWan',
            source: { host: 'PC-A', port: '1001' },
            destination: { host: 'Server-A', port: 'Web' },
          },
        },
        {
          id: 'in-group',
          prompt: 'in-group',
          expectation: {
            verdict: 'ACCEPT',
            flow: 'inbound',
            expectedTarget: { host: 'PC-A', port: '1001' },
          },
          runtime: { minCopies: 1, maxCopies: 4, copyGroup: 'conversation-a' },
          packet: {
            id: 'in-group',
            direction: 'wanToLan',
            source: { host: 'Server-A', port: 'Web' },
            destination: { host: 'HOME', port: 'red' },
          },
        },
      ],
    };

    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const queue = buildTrafficQueue(day, seed, 'mixed');
      const outboundCount = queue.packets.filter((packet) => packet.templateId === 'out-group').length;
      const inboundCount = queue.packets.filter((packet) => packet.templateId === 'in-group').length;

      expect(outboundCount).toBe(inboundCount);
      expect(outboundCount).toBeGreaterThanOrEqual(1);
      expect(outboundCount).toBeLessThanOrEqual(4);
    }
  });

  it('builds outbound-only initial sessions for paired response days', () => {
    const day = scenarioDayMap['day-15'];
    const queueLengths = new Set<number>();

    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const session = buildDaySession(day, seed, `run-${seed}`);
      const templateCounts = new Map<string, number>();

      for (const packet of session.packets) {
        templateCounts.set(packet.templateId, (templateCounts.get(packet.templateId) ?? 0) + 1);
      }

      expect(templateCounts.get('day-15-inbound-web') ?? 0).toBe(0);
      expect(templateCounts.get('day-15-inbound-game') ?? 0).toBe(0);
      expect((templateCounts.get('day-15-outbound-web') ?? 0)).toBeGreaterThanOrEqual(1);
      expect((templateCounts.get('day-15-outbound-game') ?? 0)).toBeGreaterThanOrEqual(1);
      expect(session.packets.length).toBeGreaterThanOrEqual(2);
      queueLengths.add(session.packets.length);
    }

    expect(queueLengths.size).toBeGreaterThan(1);
  });

  it('keeps the earliest tutorial day fixed and compact', () => {
    const day = scenarioDayMap['day-1'];
    const queueLengths = new Set<number>();

    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const queue = buildTrafficQueue(day, seed, day.runtime?.ordering);
      queueLengths.add(queue.packets.length);
      expect(queue.packets.map((packet) => packet.templateId)).toEqual(['day-1-outbound']);
    }

    expect(queueLengths).toEqual(new Set([1]));
  });

  it('keeps early reject lessons stable before traffic scaling starts', () => {
    const day = scenarioDayMap['day-7'];
    const queueLengths = new Set<number>();

    for (const seed of [21, 22, 23, 24, 25, 26, 27, 28]) {
      const queue = buildTrafficQueue(day, seed, day.runtime?.ordering);
      queueLengths.add(queue.packets.length);
      expect(queue.packets.map((packet) => packet.templateId)).toEqual([
        'day-7-outbound-a',
        'day-7-inbound-bad',
      ]);
    }

    expect(queueLengths).toEqual(new Set([2]));
  });

  it('honors scenario variance modes so mid-game lessons can stay stable', () => {
    const day = scenarioDayMap['day-9'];
    const queueLengths = new Set<number>();

    for (const seed of [31, 32, 33, 34, 35, 36, 37, 38]) {
      const session = buildDaySession(day, seed, `run-${seed}`);
      queueLengths.add(session.packets.length);
      expect(session.packets.map((packet) => packet.templateId).sort()).toEqual([
        'day-9-outbound-game',
        'day-9-outbound-web',
      ]);
    }

    expect(queueLengths).toEqual(new Set([2]));
  });

  it('filters paired accept inbounds from the initial session so replies can be generated from outbound sends', () => {
    const day = scenarioDayMap['day-12'];
    const session = buildDaySession(day, 77, 'run-77');

    expect(session.packets.every((packet) => packet.packet.direction === 'lanToWan')).toBe(true);
    expect(session.packets.map((packet) => packet.templateId).sort()).toEqual([
      'day-12-outbound-1001',
      'day-12-outbound-1002',
    ]);
  });

  it('builds seeded table rows for operational late-game days', () => {
    const timeoutEntries = buildInitialTableEntries(scenarioDayMap['day-20']);
    const manualCloseEntries = buildInitialTableEntries(scenarioDayMap['day-21']);
    const exhaustionEntries = buildInitialTableEntries(scenarioDayMap['day-22']);

    expect(timeoutEntries).toHaveLength(16);
    expect(timeoutEntries.every((entry) => entry.externalHost === '自宅')).toBe(true);
    expect(timeoutEntries.some((entry) => entry.externalPort === 'blue' && entry.remainingTurns === 3)).toBe(true);
    expect(manualCloseEntries).toHaveLength(1);
    expect(manualCloseEntries[0]?.externalPort).toBe('red');
    expect(exhaustionEntries.map((entry) => entry.externalPort).sort()).toEqual(['blue', 'red']);
  });

  it('repeats per-cycle packets while keeping once-per-session packets singular', () => {
    const day: ScenarioDay = {
      ...makeDay(),
      runtime: {
        minCycles: 2,
        maxCycles: 3,
      },
      packets: [
        {
          id: 'setup-outbound',
          prompt: 'setup-outbound',
          expectation: { verdict: 'ACCEPT', flow: 'outbound' },
          runtime: { spawnTiming: 'oncePerSession' },
          packet: {
            id: 'setup-outbound',
            direction: 'lanToWan',
            source: { host: 'PC-A', port: '1001' },
            destination: { host: 'Server-A', port: 'Web' },
          },
        },
        {
          id: 'repeated-inbound',
          prompt: 'repeated-inbound',
          expectation: {
            verdict: 'REJECT',
            reason: 'unknown inbound',
            reasonCode: 'unknownInbound',
          },
          runtime: { minCopies: 1, maxCopies: 1 },
          packet: {
            id: 'repeated-inbound',
            direction: 'wanToLan',
            source: { host: 'Unknown', port: 'Web' },
            destination: { host: 'HOME', port: 'red' },
          },
        },
      ],
    };

    const cycleSizes = new Set<number>();

    for (const seed of [1, 1000, 10000, 100000]) {
      const queue = buildTrafficQueue(day, seed, 'grouped');
      const setupCount = queue.packets.filter((packet) => packet.templateId === 'setup-outbound').length;
      const repeatedCount = queue.packets.filter((packet) => packet.templateId === 'repeated-inbound').length;
      const repeatedCycleIndexes = queue.packets
        .filter((packet) => packet.templateId === 'repeated-inbound')
        .map((packet) => packet.cycleIndex);

      expect(setupCount).toBe(1);
      expect(repeatedCount).toBeGreaterThanOrEqual(2);
      expect(repeatedCount).toBeLessThanOrEqual(3);
      expect(new Set(repeatedCycleIndexes).size).toBe(repeatedCount);
      cycleSizes.add(repeatedCount);
    }

    expect(cycleSizes.size).toBeGreaterThan(1);
  });

  it('applies grouped spawn chance consistently across related packets', () => {
    const day: ScenarioDay = {
      ...makeDay(),
      packets: [
        {
          id: 'out-optional',
          prompt: 'out-optional',
          expectation: { verdict: 'ACCEPT', flow: 'outbound' },
          runtime: { copyGroup: 'optional-flow', spawnChance: 0.5 },
          packet: {
            id: 'out-optional',
            direction: 'lanToWan',
            source: { host: 'PC-A', port: '1001' },
            destination: { host: 'Server-A', port: 'Web' },
          },
        },
        {
          id: 'in-optional',
          prompt: 'in-optional',
          expectation: {
            verdict: 'ACCEPT',
            flow: 'inbound',
            expectedTarget: { host: 'PC-A', port: '1001' },
          },
          runtime: { copyGroup: 'optional-flow', spawnChance: 0.5 },
          packet: {
            id: 'in-optional',
            direction: 'wanToLan',
            source: { host: 'Server-A', port: 'Web' },
            destination: { host: 'HOME', port: 'red' },
          },
        },
      ],
    };

    const seenCounts = new Set<number>();

    for (const seed of [1, 1000, 10000, 100000]) {
      const queue = buildTrafficQueue(day, seed, 'mixed');
      const outboundCount = queue.packets.filter((packet) => packet.templateId === 'out-optional').length;
      const inboundCount = queue.packets.filter((packet) => packet.templateId === 'in-optional').length;

      expect(outboundCount).toBe(inboundCount);
      expect([0, 1]).toContain(outboundCount);
      seenCounts.add(outboundCount);
    }

    expect(seenCounts.size).toBeGreaterThan(1);
  });

  it('selects exactly one variant from a variant group per queue build', () => {
    const day: ScenarioDay = {
      ...makeDay(),
      packets: [
        {
          id: 'variant-a',
          prompt: 'variant-a',
          expectation: { verdict: 'REJECT', reason: 'a', reasonCode: 'unknownInbound' },
          runtime: { variantGroup: 'noise', variantId: 'a' },
          packet: {
            id: 'variant-a',
            direction: 'wanToLan',
            source: { host: 'Server-A', port: 'Web' },
            destination: { host: 'HOME', port: 'red' },
          },
        },
        {
          id: 'variant-b',
          prompt: 'variant-b',
          expectation: { verdict: 'REJECT', reason: 'b', reasonCode: 'unknownInbound' },
          runtime: { variantGroup: 'noise', variantId: 'b' },
          packet: {
            id: 'variant-b',
            direction: 'wanToLan',
            source: { host: 'Server-B', port: 'Web' },
            destination: { host: 'HOME', port: 'red' },
          },
        },
      ],
    };

    const seenVariants = new Set<string>();

    for (const seed of [1, 1000, 10000, 100000]) {
      const queue = buildTrafficQueue(day, seed, 'mixed');
      const templates = queue.packets.map((packet) => packet.templateId);
      const packet = queue.packets[0];

      expect(templates).toHaveLength(1);
      expect(['variant-a', 'variant-b']).toContain(templates[0]);
      expect(packet?.variantGroup).toBe('noise');
      expect(['a', 'b']).toContain(packet?.variantId);
      seenVariants.add(templates[0]!);
    }

    expect(seenVariants.size).toBeGreaterThan(1);
  });
});
