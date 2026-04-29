import { describe, expect, it } from 'vitest';

import { evaluateVerdict } from '../src/features/game/engine';
import { createGeneratedResponsePacketRecord } from '../src/features/game/runtimeSession';
import { HOME_LABEL, scenarioDayMap } from '../src/features/game/scenarios';
import type { RuntimePacket, TranslationTableEntry } from '../src/features/game/types';

const toRuntimePacket = (dayId: string, packetIndex: number): RuntimePacket => {
  const packet = scenarioDayMap[dayId].packets[packetIndex];

  return {
    ...packet,
    runtimeId: `${packet.id}-runtime`,
    templateId: packet.id,
    cycleIndex: 0,
    variantGroup: packet.runtime?.variantGroup ?? null,
    variantId: packet.runtime?.variantId ?? null,
    spawnChance: packet.runtime?.spawnChance ?? null,
  };
};

const toGeneratedResponsePacket = (dayId: string, packetIndex: number): RuntimePacket => {
  const day = scenarioDayMap[dayId];
  const outboundPacket = toRuntimePacket(dayId, packetIndex);
  const generated = createGeneratedResponsePacketRecord({
    day,
    sourcePacket: {
      ...outboundPacket,
      ordinal: packetIndex,
      status: 'active',
      spawnSource: 'scenario',
      resolvedByActionId: null,
    },
    rewrittenSource:
      day.phaseId === 'directRouting'
        ? outboundPacket.packet.source
        : day.availableStamps[0] === 'home'
          ? { host: HOME_LABEL }
          : { host: HOME_LABEL, port: day.availableStamps[packetIndex] ?? day.availableStamps[0] },
    appliedStampId: day.availableStamps[packetIndex] ?? day.availableStamps[0] ?? null,
    ordinal: 99,
  });

  if (!generated) {
    throw new Error(`No generated response for ${dayId}:${packetIndex}`);
  }

  return generated;
};

describe('evaluateVerdict', () => {
  it('returns direct-routing traffic when accepted without an applied route slip', () => {
    const day = scenarioDayMap['day-1'];
    const packet = toRuntimePacket('day-1', 0);

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: null,
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: false,
      tableEntries: [],
      nextTableSequence: 1,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('returnedForRoute');
    expect(result.advancesPacket).toBe(false);
  });

  it('accepts direct-routing traffic when the route slip was applied to the paper', () => {
    const day = scenarioDayMap['day-1'];
    const packet = toRuntimePacket('day-1', 0);

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: null,
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: true,
      tableEntries: [],
      nextTableSequence: 1,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('forwardedDirectRoute');
    expect(result.advancesPacket).toBe(true);
  });

  it('treats NAT ambiguity as a guaranteed failure even if a matching row was chosen', () => {
    const day = scenarioDayMap['day-2'];
    const packet = toGeneratedResponsePacket('day-2', 0);
    const matchingEntries: TranslationTableEntry[] = [
      {
        id: 'entry-a',
        sequence: 1,
        createdFromPacketId: 'out-a',
        externalHost: HOME_LABEL,
        internalHost: 'PC-A',
        lifecycleState: 'active',
        remainingTurns: Number.MAX_SAFE_INTEGER,
        maxRemainingTurns: Number.MAX_SAFE_INTEGER,
      },
      {
        id: 'entry-b',
        sequence: 2,
        createdFromPacketId: 'out-b',
        externalHost: HOME_LABEL,
        internalHost: 'PC-B',
        lifecycleState: 'active',
        remainingTurns: Number.MAX_SAFE_INTEGER,
        maxRemainingTurns: Number.MAX_SAFE_INTEGER,
      },
    ];

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: matchingEntries[0],
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: { host: 'PC-A' },
      documentDestinationApplied: true,
      tableEntries: matchingEntries,
      nextTableSequence: 3,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('misroutedReturnTraffic');
    expect(result.incidentKind).toBe('ambiguousReturnRoute');
    expect(result.causedIncident).toBe(true);
  });

  it('returns outbound traffic for rewrite when accepted without a selected stamp', () => {
    const day = scenarioDayMap['day-3'];
    const packet = toRuntimePacket('day-3', 0);

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: null,
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: false,
      tableEntries: [],
      nextTableSequence: 1,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('returnedForRewrite');
    expect(result.advancesPacket).toBe(false);
    expect(result.autoAssignedStampId).toBeNull();
    expect(result.createdTableEntry).toBeUndefined();
    expect(result.nextSeed).toBe(1);
  });

  it('marks a legitimate packet as an incident when the player rejects it', () => {
    const day = scenarioDayMap['day-3'];
    const packet = toRuntimePacket('day-3', 0);

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'REJECT',
      selectedStampId: null,
      selectedTableEntry: null,
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: false,
      tableEntries: [],
      nextTableSequence: 1,
      rngSeed: 10,
    });

    expect(result.outcomeCode).toBe('rejectedLegitimate');
    expect(result.incidentKind).toBe('rejectedLegitimateTraffic');
    expect(result.causedIncident).toBe(true);
  });

  it('returns inbound traffic for lookup when accepted without a selected table entry', () => {
    const day = scenarioDayMap['day-3'];
    const packet = toGeneratedResponsePacket('day-3', 0);
    const matchingEntries: TranslationTableEntry[] = [
      {
        id: 'entry-correct',
        sequence: 1,
        createdFromPacketId: 'x',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        internalHost: 'PC-A',
        lifecycleState: 'active',
        remainingTurns: 3,
        maxRemainingTurns: 3,
      },
      {
        id: 'entry-wrong',
        sequence: 2,
        createdFromPacketId: 'y',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        internalHost: 'PC-B',
        lifecycleState: 'active',
        remainingTurns: 3,
        maxRemainingTurns: 3,
      },
    ];

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: null,
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: false,
      tableEntries: matchingEntries,
      nextTableSequence: 3,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('returnedForLookup');
    expect(result.advancesPacket).toBe(false);
    expect(result.deliveredTarget).toBeNull();
    expect(result.expectedTarget).toEqual({ host: 'PC-A' });
  });

  it('restores an ambiguous inbound packet when the player picks the correct row', () => {
    const day = scenarioDayMap['day-3'];
    const packet = toGeneratedResponsePacket('day-3', 0);
    const matchingEntries: TranslationTableEntry[] = [
      {
        id: 'entry-correct',
        sequence: 1,
        createdFromPacketId: 'x',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        internalHost: 'PC-A',
        lifecycleState: 'active',
        remainingTurns: 3,
        maxRemainingTurns: 3,
      },
      {
        id: 'entry-wrong',
        sequence: 2,
        createdFromPacketId: 'y',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        internalHost: 'PC-B',
        lifecycleState: 'active',
        remainingTurns: 3,
        maxRemainingTurns: 3,
      },
    ];

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: matchingEntries[0],
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: { host: 'PC-A' },
      documentDestinationApplied: true,
      tableEntries: matchingEntries,
      nextTableSequence: 3,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('restoredExactRoute');
    expect(result.incidentKind).toBe(null);
    expect(result.deliveredTarget).toEqual({ host: 'PC-A', port: undefined });
    expect(result.expectedTarget).toEqual({ host: 'PC-A' });
  });

  it('records an ambiguous misroute when the player picks the wrong matching row', () => {
    const day = scenarioDayMap['day-3'];
    const packet = toGeneratedResponsePacket('day-3', 0);
    const matchingEntries: TranslationTableEntry[] = [
      {
        id: 'entry-wrong',
        sequence: 1,
        createdFromPacketId: 'x',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        internalHost: 'PC-B',
        lifecycleState: 'active',
        remainingTurns: 3,
        maxRemainingTurns: 3,
      },
      {
        id: 'entry-correct',
        sequence: 2,
        createdFromPacketId: 'y',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        internalHost: 'PC-A',
        lifecycleState: 'active',
        remainingTurns: 3,
        maxRemainingTurns: 3,
      },
    ];

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: null,
      selectedTableEntry: matchingEntries[0],
      documentSource: packet.packet.source,
      documentSourceApplied: false,
      documentDestination: { host: 'PC-B' },
      documentDestinationApplied: true,
      tableEntries: matchingEntries,
      nextTableSequence: 3,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('misroutedReturnTraffic');
    expect(result.incidentKind).toBe('ambiguousReturnRoute');
    expect(result.causedIncident).toBe(true);
    expect(result.deliveredTarget).toEqual({ host: 'PC-B', port: undefined });
  });

  it('uses the applied outbound document header as the source of truth', () => {
    const day = scenarioDayMap['day-3'];
    const packet = toRuntimePacket('day-3', 0);

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: 'red',
      selectedTableEntry: null,
      documentSource: { host: HOME_LABEL, port: 'blue' },
      documentSourceApplied: true,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: false,
      tableEntries: [],
      nextTableSequence: 1,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('returnedForRewrite');
    expect(result.advancesPacket).toBe(false);
  });

  it('returns outbound traffic when the chosen color is still occupied in exclusive mode', () => {
    const day = scenarioDayMap['day-21'];
    const packet = toRuntimePacket('day-21', 0);
    const occupiedEntries: TranslationTableEntry[] = [
      {
        id: 'seed-entry-red',
        sequence: 1,
        createdFromPacketId: 'seed-red',
        protocol: 'TCP',
        externalHost: HOME_LABEL,
        externalPort: 'red',
        destinationHost: 'Server-1',
        destinationService: 'Web',
        internalHost: 'PC-A',
        internalPort: '1001',
        lifecycleState: 'active',
        remainingTurns: 9,
        maxRemainingTurns: 9,
      },
    ];

    const result = evaluateVerdict({
      day,
      packet,
      verdict: 'ACCEPT',
      selectedStampId: 'red',
      selectedTableEntry: null,
      documentSource: { host: HOME_LABEL, port: 'red' },
      documentSourceApplied: true,
      documentDestination: packet.packet.destination,
      documentDestinationApplied: false,
      tableEntries: occupiedEntries,
      nextTableSequence: 2,
      rngSeed: 1,
    });

    expect(result.outcomeCode).toBe('returnedForRewrite');
    expect(result.advancesPacket).toBe(false);
    expect(result.conflictingEntryId).toBe('seed-entry-red');
    expect(result.feedbackMessage).toContain('その色はまだ使用中');
  });
});
