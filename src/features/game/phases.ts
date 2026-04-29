import type { ScenarioDay, ScenarioPhaseDefinition, ScenarioPhaseId } from './types';

export const SCENARIO_PHASES: Record<ScenarioPhaseId, ScenarioPhaseDefinition> = {
  directRouting: {
    id: 'directRouting',
    index: 1,
    label: 'Direct Routing',
    defaultVarianceMode: 'intro',
    initialInboxCount: 1,
    arrivalsPerAction: 1,
  },
  natBasics: {
    id: 'natBasics',
    index: 2,
    label: 'NAT Basics',
    defaultVarianceMode: 'intro',
    initialInboxCount: 1,
    arrivalsPerAction: 1,
  },
  portStamp: {
    id: 'portStamp',
    index: 3,
    label: 'Port Stamp',
    defaultVarianceMode: 'steady',
    initialInboxCount: 1,
    arrivalsPerAction: 1,
  },
  destinationHost: {
    id: 'destinationHost',
    index: 4,
    label: 'Destination Host',
    defaultVarianceMode: 'steady',
    initialInboxCount: 2,
    arrivalsPerAction: 1,
  },
  destinationService: {
    id: 'destinationService',
    index: 5,
    label: 'Destination Service',
    defaultVarianceMode: 'steady',
    initialInboxCount: 2,
    arrivalsPerAction: 1,
  },
  internalPort: {
    id: 'internalPort',
    index: 6,
    label: 'Internal Port',
    defaultVarianceMode: 'rising',
    initialInboxCount: 2,
    arrivalsPerAction: 1,
  },
  externalUniqueness: {
    id: 'externalUniqueness',
    index: 7,
    label: 'External Uniqueness',
    defaultVarianceMode: 'rising',
    initialInboxCount: 2,
    arrivalsPerAction: 1,
  },
  protocolSplit: {
    id: 'protocolSplit',
    index: 8,
    label: 'Protocol Split',
    defaultVarianceMode: 'rising',
    initialInboxCount: 2,
    arrivalsPerAction: 1,
  },
  timeoutLifecycle: {
    id: 'timeoutLifecycle',
    index: 9,
    label: 'Timeout Lifecycle',
    defaultVarianceMode: 'full',
    initialInboxCount: 3,
    arrivalsPerAction: 2,
    pendingCapacity: 4,
  },
  manualClose: {
    id: 'manualClose',
    index: 10,
    label: 'Manual Close',
    defaultVarianceMode: 'full',
    initialInboxCount: 3,
    arrivalsPerAction: 2,
    pendingCapacity: 4,
  },
  portExhaustion: {
    id: 'portExhaustion',
    index: 11,
    label: 'Port Exhaustion',
    defaultVarianceMode: 'full',
    initialInboxCount: 3,
    arrivalsPerAction: 2,
    pendingCapacity: 4,
  },
};

export const getScenarioPhase = (phaseId: ScenarioPhaseId) => SCENARIO_PHASES[phaseId];

export const getScenarioPhaseIndex = (phaseId: ScenarioPhaseId) => SCENARIO_PHASES[phaseId].index;

export const isScenarioPhaseIdAtLeast = (
  currentPhaseId: ScenarioPhaseId,
  targetPhaseId: ScenarioPhaseId,
) => getScenarioPhaseIndex(currentPhaseId) >= getScenarioPhaseIndex(targetPhaseId);

export const isScenarioPhaseAtLeast = (
  day: Pick<ScenarioDay, 'phaseId'> | null | undefined,
  targetPhaseId: ScenarioPhaseId,
) => (day ? isScenarioPhaseIdAtLeast(day.phaseId, targetPhaseId) : false);
