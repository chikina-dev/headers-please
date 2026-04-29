import { getScenarioPhase } from './phases';
import type { RuntimePacket, RuntimeVarianceTier, ScenarioDay, ScenarioPacket } from './types';

const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 2 ** 32;

export const nextRandom = (seed: number) => {
  const nextSeed = (LCG_A * seed + LCG_C) % LCG_M;
  return {
    seed: nextSeed,
    value: nextSeed / LCG_M,
  };
};

export const pickRandomIndex = (seed: number, length: number) => {
  if (length <= 0) {
    return { seed, index: -1 };
  }

  const next = nextRandom(seed);

  return {
    seed: next.seed,
    index: Math.floor(next.value * length),
  };
};

const shuffleWithSeed = <T>(items: T[], seed: number) => {
  const result = items.slice();
  let nextSeed = seed;

  for (let index = result.length - 1; index > 0; index -= 1) {
    const roll = pickRandomIndex(nextSeed, index + 1);
    nextSeed = roll.seed;
    const swapIndex = roll.index;
    const current = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = current;
  }

  return {
    seed: nextSeed,
    items: result,
  };
};

const resolveRuntimeVarianceTier = (day: ScenarioDay): RuntimeVarianceTier => {
  if (day.runtime?.varianceMode) {
    return day.runtime.varianceMode;
  }

  return getScenarioPhase(day.phaseId).defaultVarianceMode;
};

const selectVariantPackets = (
  day: ScenarioDay,
  packets: ScenarioPacket[],
  seed: number,
) => {
  let nextSeed = seed;
  const selectedPackets: ScenarioPacket[] = [];
  const variantGroups = new Map<string, Map<string, ScenarioPacket[]>>();
  const varianceTier = resolveRuntimeVarianceTier(day);

  for (const packet of packets) {
    const variantGroup = packet.runtime?.variantGroup;
    const variantId = packet.runtime?.variantId;

    if (!variantGroup || !variantId) {
      selectedPackets.push(packet);
      continue;
    }

    const groupVariants = variantGroups.get(variantGroup) ?? new Map<string, ScenarioPacket[]>();
    const variantPackets = groupVariants.get(variantId) ?? [];

    variantPackets.push(packet);
    groupVariants.set(variantId, variantPackets);
    variantGroups.set(variantGroup, groupVariants);
  }

  for (const groupVariants of variantGroups.values()) {
    const variantIds = [...groupVariants.keys()].sort();

    if (variantIds.length === 0) {
      continue;
    }

    let selectedVariantId = variantIds[0];

    if (varianceTier === 'rising' || varianceTier === 'full') {
      const roll = pickRandomIndex(nextSeed, variantIds.length);
      nextSeed = roll.seed;
      selectedVariantId = variantIds[Math.max(roll.index, 0)] ?? variantIds[0];
    }

    const variantPackets = groupVariants.get(selectedVariantId) ?? [];

    selectedPackets.push(...variantPackets);
  }

  return {
    seed: nextSeed,
    packets: selectedPackets,
  };
};

export const toRuntimePacket = (
  packet: ScenarioPacket,
  runtimeIndex: number,
  cycleIndex = 0,
): RuntimePacket => ({
  ...packet,
  runtimeId: `${packet.id}-${runtimeIndex}`,
  templateId: packet.id,
  cycleIndex,
  variantGroup: packet.runtime?.variantGroup ?? null,
  variantId: packet.runtime?.variantId ?? null,
  spawnChance: packet.runtime?.spawnChance ?? null,
});

const resolvePacketCopyCount = (
  day: ScenarioDay,
  packet: ScenarioPacket,
  seed: number,
) => {
  const minCopies = Math.max(packet.runtime?.minCopies ?? 1, 1);
  const maxCopies = Math.max(packet.runtime?.maxCopies ?? minCopies, minCopies);
  const varianceTier = resolveRuntimeVarianceTier(day);

  if (varianceTier === 'intro' || varianceTier === 'steady') {
    return {
      seed,
      copies: minCopies,
    };
  }

  const cappedMaxCopies =
    varianceTier === 'rising'
      ? Math.min(maxCopies, minCopies + 1)
      : maxCopies;

  if (minCopies === cappedMaxCopies) {
    return {
      seed,
      copies: minCopies,
    };
  }

  const roll = pickRandomIndex(seed, cappedMaxCopies - minCopies + 1);

  return {
    seed: roll.seed,
    copies: minCopies + Math.max(roll.index, 0),
  };
};

const resolvePacketSpawn = (
  day: ScenarioDay,
  packet: ScenarioPacket,
  seed: number,
) => {
  const spawnChance = Math.min(Math.max(packet.runtime?.spawnChance ?? 1, 0), 1);
  const varianceTier = resolveRuntimeVarianceTier(day);

  if (spawnChance <= 0) {
    return {
      seed,
      shouldSpawn: false,
    };
  }

  if (spawnChance >= 1) {
    return {
      seed,
      shouldSpawn: true,
    };
  }

  if (varianceTier === 'intro' || varianceTier === 'steady') {
    return {
      seed,
      shouldSpawn: false,
    };
  }

  const next = nextRandom(seed);

  return {
    seed: next.seed,
    shouldSpawn: next.value <= spawnChance,
  };
};

const resolveCycleCount = (day: ScenarioDay, seed: number) => {
  const minCycles = Math.max(day.runtime?.minCycles ?? 1, 1);
  const maxCycles = Math.max(day.runtime?.maxCycles ?? minCycles, minCycles);
  const varianceTier = resolveRuntimeVarianceTier(day);

  if (varianceTier === 'intro' || varianceTier === 'steady') {
    return {
      seed,
      cycles: minCycles,
    };
  }

  const cappedMaxCycles =
    varianceTier === 'rising'
      ? Math.min(maxCycles, minCycles + 1)
      : maxCycles;

  if (minCycles === cappedMaxCycles) {
    return {
      seed,
      cycles: minCycles,
    };
  }

  const roll = pickRandomIndex(seed, cappedMaxCycles - minCycles + 1);

  return {
    seed: roll.seed,
    cycles: minCycles + Math.max(roll.index, 0),
  };
};

const expandRuntimePackets = (
  day: ScenarioDay,
  packets: ScenarioPacket[],
  seed: number,
  runtimeIndexOffset = 0,
  cycleIndex = 0,
) => {
  let nextSeed = seed;
  const expandedPackets: ScenarioPacket[] = [];
  const groupCopyCounts = new Map<string, number>();
  const groupSpawnDecisions = new Map<string, boolean>();

  for (const packet of packets) {
    const copyGroup = packet.runtime?.copyGroup;
    let shouldSpawn: boolean;

    if (copyGroup && groupSpawnDecisions.has(copyGroup)) {
      shouldSpawn = groupSpawnDecisions.get(copyGroup) ?? true;
    } else {
      const spawnResolution = resolvePacketSpawn(day, packet, nextSeed);
      nextSeed = spawnResolution.seed;
      shouldSpawn = spawnResolution.shouldSpawn;

      if (copyGroup) {
        groupSpawnDecisions.set(copyGroup, shouldSpawn);
      }
    }

    if (!shouldSpawn) {
      continue;
    }

    let copies: number;

    if (copyGroup && groupCopyCounts.has(copyGroup)) {
      copies = groupCopyCounts.get(copyGroup) ?? 1;
    } else {
      const resolved = resolvePacketCopyCount(day, packet, nextSeed);
      nextSeed = resolved.seed;
      copies = resolved.copies;

      if (copyGroup) {
        groupCopyCounts.set(copyGroup, copies);
      }
    }

    for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
      expandedPackets.push(packet);
    }
  }

  return {
    seed: nextSeed,
    packets: expandedPackets.map((packet, index) =>
      toRuntimePacket(packet, runtimeIndexOffset + index, cycleIndex),
    ),
  };
};

export const buildTrafficQueue = (
  day: ScenarioDay,
  seed: number,
  ordering: 'grouped' | 'mixed' | 'returnsMayLead' = 'grouped',
) => {
  const varianceTier = resolveRuntimeVarianceTier(day);
  const cycleResolution = resolveCycleCount(day, seed);
  let nextSeed = cycleResolution.seed;
  let runtimeIndexOffset = 0;
  const runtimePackets: RuntimePacket[] = [];
  const effectiveOrdering =
    varianceTier === 'intro' || varianceTier === 'steady'
      ? ordering === 'mixed'
        ? 'grouped'
        : ordering
      : ordering;

  for (let cycleIndex = 0; cycleIndex < cycleResolution.cycles; cycleIndex += 1) {
    const cyclePackets = day.packets.filter(
      (packet) => cycleIndex === 0 || packet.runtime?.spawnTiming !== 'oncePerSession',
    );
    const selectedVariants = selectVariantPackets(day, cyclePackets, nextSeed);
    const expanded = expandRuntimePackets(
      day,
      selectedVariants.packets,
      selectedVariants.seed,
      runtimeIndexOffset,
      cycleIndex,
    );

    runtimePackets.push(...expanded.packets);
    nextSeed = expanded.seed;
    runtimeIndexOffset += expanded.packets.length;
  }

  if (effectiveOrdering === 'mixed') {
    const shuffled = shuffleWithSeed(runtimePackets, nextSeed);
    return {
      seed: shuffled.seed,
      packets: shuffled.items,
    };
  }

  const outboundPackets = runtimePackets.filter((packet) => packet.packet.direction === 'lanToWan');
  const inboundPackets = runtimePackets.filter((packet) => packet.packet.direction === 'wanToLan');
  const shuffledOutbound = shuffleWithSeed(outboundPackets, nextSeed);
  const shuffledInbound = shuffleWithSeed(inboundPackets, shuffledOutbound.seed);

  if (effectiveOrdering === 'returnsMayLead') {
    const combined = [...shuffledOutbound.items, ...shuffledInbound.items];
    const shuffled = shuffleWithSeed(combined, shuffledInbound.seed);
    return {
      seed: shuffled.seed,
      packets: shuffled.items,
    };
  }

  return {
    seed: shuffledInbound.seed,
    packets: [...shuffledOutbound.items, ...shuffledInbound.items],
  };
};
