import type { EntityState } from '@reduxjs/toolkit';

export type GameScreen =
  | 'title'
  | 'inspection'
  | 'dayClear'
  | 'dayFailure'
  | 'campaignComplete';

export type PacketDirection = 'lanToWan' | 'wanToLan';
export type TransportProtocol = 'TCP' | 'UDP';
export type Verdict = 'ACCEPT' | 'REJECT';
export type AuditAction = Verdict | 'CLOSE' | 'TIMEOUT' | 'WAIT' | 'OVERFLOW';
export type WorkbenchDispatchIntent = Verdict;
export type ReferenceTab = 'summary' | 'actions' | 'glossary';
export type RuntimeVarianceTier = 'intro' | 'steady' | 'rising' | 'full';
export type ScenarioPhaseId =
  | 'directRouting'
  | 'natBasics'
  | 'portStamp'
  | 'destinationHost'
  | 'destinationService'
  | 'internalPort'
  | 'externalUniqueness'
  | 'protocolSplit'
  | 'timeoutLifecycle'
  | 'manualClose'
  | 'portExhaustion';
export type RejectReasonCode =
  | 'unknownInbound'
  | 'destinationHostMismatch'
  | 'destinationServiceMismatch'
  | 'protocolMismatch'
  | 'sourceHostMismatch'
  | 'portExhausted';
export type IncidentKind =
  | 'rejectedLegitimateTraffic'
  | 'acceptedUnauthorizedTraffic'
  | 'ambiguousReturnRoute'
  | 'missingReturnRoute'
  | 'misroutedReturnTraffic'
  | 'queueTimeoutLoss'
  | 'queueOverflowLoss';
export type ActionOutcomeCode =
  | 'rejectedExpected'
  | 'rejectedLegitimate'
  | 'acceptedUnauthorized'
  | 'returnedForRoute'
  | 'returnedForRewrite'
  | 'returnedForLookup'
  | 'forwardedDirectRoute'
  | 'registeredMapping'
  | 'registeredConflictingMapping'
  | 'registeredAutoAssignedMapping'
  | 'restoredExactRoute'
  | 'missingReturnRoute'
  | 'misroutedReturnTraffic'
  | 'expiredInInbox'
  | 'overflowedInInbox'
  | 'manualClose'
  | 'waited'
  | 'timeoutRelease';
export type SessionEventKind =
  | 'daySessionStarted'
  | 'packetArrived'
  | 'backgroundPacketQueued'
  | 'packetExpiredInInbox'
  | 'packetOverflowedInInbox'
  | 'actionResolved'
  | 'mappingRegistered'
  | 'mappingActivated'
  | 'mappingClosed'
  | 'mappingTimedOut'
  | 'objectiveSatisfied'
  | 'packetRepeated';
export type SessionCheckpointReason =
  | 'dayStart'
  | 'afterAction'
  | 'afterManualClose'
  | 'dayResolved';
export type FlowEdgeKey = 'nextOnClear' | 'nextOnFailure' | 'terminal';
export type RunArchiveReason = 'resolved' | 'abandoned';
export type PlayerCommandKind =
  | 'pullPacket'
  | 'shelvePacket'
  | 'waitTurn'
  | 'selectStamp'
  | 'applyStamp'
  | 'selectRouteTarget'
  | 'applyRouteTarget'
  | 'selectTableEntry'
  | 'applyTableEntry'
  | 'setDispatchIntent'
  | 'submitVerdict'
  | 'closeEntry'
  | 'setReferenceTab'
  | 'setReferenceOpen';

export type TableColumnKey =
  | 'protocol'
  | 'externalHost'
  | 'externalPort'
  | 'destinationHost'
  | 'destinationService'
  | 'internalHost'
  | 'internalPort';

export type LookupKey = Extract<
  TableColumnKey,
  'protocol' | 'externalHost' | 'externalPort' | 'destinationHost' | 'destinationService'
>;

export type StampId =
  | 'home'
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'cyan'
  | 'pink'
  | 'lime'
  | 'amber'
  | 'teal'
  | 'indigo'
  | 'rose'
  | 'sky'
  | 'emerald'
  | 'slate';

export interface StampDefinition {
  id: StampId;
  label: string;
  chipClassName: string;
  buttonClassName: string;
}

export interface Endpoint {
  host: string;
  port?: string;
}

export interface PacketSnapshot {
  id: string;
  direction: PacketDirection;
  source: Endpoint;
  destination: Endpoint;
  protocol?: TransportProtocol;
  note?: string;
}

export interface TranslationTableEntry {
  id: string;
  sequence: number;
  createdFromPacketId: string;
  protocol?: TransportProtocol;
  externalHost: string;
  externalPort?: StampId;
  destinationHost?: string;
  destinationService?: string;
  internalHost: string;
  internalPort?: string;
  lifecycleState: 'waiting' | 'active';
  remainingTurns: number;
  maxRemainingTurns: number;
}

export interface FailureTrigger {
  title: string;
  message: string;
}

export interface OutboundAcceptExpectation {
  verdict: 'ACCEPT';
  flow: 'outbound';
  requiredStampId?: StampId;
}

export interface InboundAcceptExpectation {
  verdict: 'ACCEPT';
  flow: 'inbound';
  expectedTarget: Endpoint;
}

export interface RejectExpectation {
  verdict: 'REJECT';
  reason: string;
  reasonCode?: RejectReasonCode;
}

export type PacketExpectation =
  | OutboundAcceptExpectation
  | InboundAcceptExpectation
  | RejectExpectation;

export interface ScenarioPacket {
  id: string;
  packet: PacketSnapshot;
  prompt: string;
  expectation: PacketExpectation;
  routeTargets?: Endpoint[];
  responsePlan?: {
    prompt: string;
    note?: string;
    routeTargets?: Endpoint[];
    queuePosition?: 'front' | 'back';
    delayActions?: number;
    skipReply?: boolean;
    forcedFailure?: FailureTrigger;
  };
  forcedFailure?: FailureTrigger;
  runtime?: {
    minCopies?: number;
    maxCopies?: number;
    copyGroup?: string;
    spawnTiming?: 'perCycle' | 'oncePerSession';
    arrivalDelayActions?: number;
    waitBudgetActions?: number;
    spawnChance?: number;
    variantGroup?: string;
    variantId?: string;
  };
}

export interface RuntimePacket extends ScenarioPacket {
  runtimeId: string;
  templateId: string;
  cycleIndex: number;
  variantGroup: string | null;
  variantId: string | null;
  spawnChance: number | null;
}

export interface ScenarioRules {
  columns: TableColumnKey[];
  inboundLookupKeys: LookupKey[];
  portReusePolicy?: 'lookupScoped' | 'exclusive';
}

export interface InitialTableEntryTemplate {
  protocol?: TransportProtocol;
  externalHost: string;
  externalPort?: StampId;
  destinationHost?: string;
  destinationService?: string;
  internalHost: string;
  internalPort?: string;
  lifecycleState?: 'waiting' | 'active';
  remainingTurns: number;
  maxRemainingTurns?: number;
  backgroundFlow?: {
    minPackets: number;
    maxPackets?: number;
    firstDelayActions?: number;
    intervalActions?: number;
    queuePosition?: 'front' | 'back';
    waitBudgetActions?: number;
    prompt?: string;
    note?: string;
  };
}

export interface ScenarioRuntimeConfig {
  ordering?: 'grouped' | 'mixed' | 'returnsMayLead';
  repeatForcedFailureUntilIncident?: boolean;
  minCycles?: number;
  maxCycles?: number;
  varianceMode?: RuntimeVarianceTier;
}

export interface ScenarioPhaseDefinition {
  id: ScenarioPhaseId;
  index: number;
  label: string;
  defaultVarianceMode: RuntimeVarianceTier;
  initialInboxCount: number;
  arrivalsPerAction: number;
  pendingCapacity?: number;
}

export interface ScenarioFlow {
  nextOnClear?: string | null;
  nextOnFailure?: string | null;
}

export interface ScenarioShiftGoal {
  requiredSuccesses?: number;
  requiredRejects?: number;
  requiredCloses?: number;
  maxIncidents?: number;
  clearMessage?: string;
  failureMessage?: string;
}

export interface ScenarioDay {
  id: string;
  unit: number;
  dayNumber: number;
  phaseId: ScenarioPhaseId;
  title: string;
  summary: string;
  learningGoal: string;
  availableStamps: StampId[];
  availableVerdicts?: Verdict[];
  rules: ScenarioRules;
  initialTableEntries?: InitialTableEntryTemplate[];
  packets: ScenarioPacket[];
  runtime?: ScenarioRuntimeConfig;
  flow?: ScenarioFlow;
  shiftGoal?: ScenarioShiftGoal;
}

export interface HandbookAction {
  id: string;
  label: string;
  description: string;
}

export interface HandbookGlossaryEntry {
  id: string;
  gameTerm: string;
  networkTerm: string;
  description: string;
  relatedColumns: TableColumnKey[];
  relatedUnits: number[];
}

export interface UnitReference {
  unit: number;
  title: string;
  objective: string;
  failureLesson: string;
  addedKeys: TableColumnKey[];
  notes: string[];
}

export interface FeedbackMessage {
  tone: 'success' | 'error';
  message: string;
}

export interface DayResolution {
  kind: 'clear' | 'failure';
  title: string;
  message: string;
}

export interface DayHistoryEntry {
  runId: string;
  dayId: string;
  dayNumber: number;
  title: string;
  kind: 'clear' | 'failure';
  actionCount: number;
  incidentCount: number;
  daySeed: number;
  outcomeBreakdown: Array<{ code: ActionOutcomeCode; count: number }>;
  incidentBreakdown: Array<{ kind: IncidentKind; count: number }>;
}

export interface DayTransitionRecord {
  id: string;
  sequence: number;
  runId: string;
  fromDayId: string;
  toDayId: string | null;
  resolutionKind: DayResolution['kind'];
  selectedEdge: FlowEdgeKey;
  unlockedDayId: string | null;
  historyEntryDayId: string;
}

export interface DayRunRecord {
  id: string;
  sequence: number;
  dayId: string;
  dayNumber: number;
  title: string;
  sessionSeed: number;
  startRngSeed: number;
  endRngSeed: number | null;
  status: 'active' | 'clear' | 'failure' | 'abandoned';
  resolutionKind: DayResolution['kind'] | null;
  actionCount: number;
  incidentCount: number;
  transitionId: string | null;
}

export interface ActionResult {
  action: AuditAction;
  sourceId: string;
  subjectLabel: string;
  outcomeCode: ActionOutcomeCode;
  incidentKind: IncidentKind | null;
  causedIncident: boolean;
  auditMessage: string;
  feedbackMessage: string;
  feedbackTone: 'success' | 'error';
}

export interface ActionDecisionContext {
  workbenchPacketRuntimeId: string | null;
  draftStampId: StampId | null;
  draftRouteTargetId: string | null;
  draftTableEntryId: string | null;
  appliedStampId: StampId | null;
  appliedRouteTargetId: string | null;
  appliedTableEntryId: string | null;
  draftDispatchIntent: WorkbenchDispatchIntent | null;
  documentSource: Endpoint | null;
  documentDestination: Endpoint | null;
  matchingEntryIds: string[];
  conflictingEntryId: string | null;
  createdTableEntryId: string | null;
  activatedEntryId: string | null;
  autoAssignedStampId: StampId | null;
  deliveredTarget: Endpoint | null;
  expectedTarget: Endpoint | null;
  expiredEntryIds: string[];
  preservedEntryIds: string[];
}

export interface WorkbenchDocumentState {
  packetRuntimeId: string | null;
  placement: 'idle' | 'inbox' | 'workbench';
  originalSource: Endpoint | null;
  source: Endpoint | null;
  sourceApplied: boolean;
  originalDestination: Endpoint | null;
  destination: Endpoint | null;
  destinationApplied: boolean;
}

export interface WorkbenchDraftState {
  packetRuntimeId: string | null;
  stampId: StampId | null;
  routeTargetId: string | null;
  tableEntryId: string | null;
  appliedStampId: StampId | null;
  appliedRouteTargetId: string | null;
  appliedTableEntryId: string | null;
  dispatchIntent: WorkbenchDispatchIntent | null;
}

export interface SuspendedWorkbenchPacketState {
  draft: WorkbenchDraftState;
  document: WorkbenchDocumentState;
}

export interface ActionResultRecord extends ActionResult {
  id: string;
  sequence: number;
  runId: string | null;
  packetRuntimeId: string | null;
  rngSeedBefore: number;
  rngSeedAfter: number;
  context: ActionDecisionContext;
}

export interface SessionEventRecord {
  id: string;
  sequence: number;
  kind: SessionEventKind;
  dayId: string | null;
  runId: string | null;
  packetRuntimeId: string | null;
  relatedEntryId: string | null;
  actionResultId: string | null;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface TableEntrySnapshot {
  id: string;
  lifecycleState: 'waiting' | 'active';
  remainingTurns: number;
  externalPort: StampId | null;
  destinationHost: string | null;
  destinationService: string | null;
  internalHost: string;
  internalPort: string | null;
  protocol: TransportProtocol | null;
}

export interface ObjectiveSnapshot {
  id: string;
  templateId: string;
  status: 'pending' | 'satisfied';
  satisfiedByActionId: string | null;
}

export interface SessionCheckpointRecord {
  id: string;
  sequence: number;
  reason: SessionCheckpointReason;
  dayId: string | null;
  runId: string | null;
  actionResultId: string | null;
  sessionEventId: string | null;
  actionClock: number;
  activePacketId: string | null;
  upcomingPacketIds: string[];
  pendingPacketIds: string[];
  resolvedPacketIds: string[];
  sessionStatus: 'idle' | 'active' | 'resolved';
  tableEntries: TableEntrySnapshot[];
  objectives: ObjectiveSnapshot[];
}

export interface PlayerCommandRecord {
  id: string;
  sequence: number;
  kind: PlayerCommandKind;
  dayId: string | null;
  runId: string | null;
  packetRuntimeId: string | null;
  payload: Record<string, string | number | boolean | null>;
}

export interface ResolvedTurnRecord {
  id: string;
  sequence: number;
  dayId: string | null;
  runId: string | null;
  packetRuntimeId: string | null;
  commandIds: string[];
  actionResultId: string;
  checkpointId: string | null;
  causedIncident: boolean;
  outcomeCode: ActionOutcomeCode;
}

export interface CurrentTurnState {
  packetRuntimeId: string | null;
  commandIds: string[];
}

export interface PacketLedgerRecord {
  packetRuntimeId: string;
  templateId: string;
  ordinal: number;
  cycleIndex: number;
  variantGroup: string | null;
  variantId: string | null;
  spawnSource: RuntimePacketRecord['spawnSource'];
  status: RuntimePacketRecord['status'];
  resolvedByActionId: string | null;
  commandIds: string[];
  turnIds: string[];
  actionResultIds: string[];
  sessionEventIds: string[];
  checkpointIds: string[];
  finalOutcomeCode: ActionOutcomeCode | null;
  incidentKinds: IncidentKind[];
}

export interface SessionExportSnapshot {
  dayId: string | null;
  runId: string | null;
  dayNumber: number | null;
  sessionStatus: GameTrafficState['sessionStatus'];
  route: {
    firstDayId: GameProgressState['firstDayId'];
    currentDayId: GameProgressState['currentDayId'];
    nextDayId: GameProgressState['nextDayId'];
    inspectedRunId: GameProgressState['inspectedRunId'];
    unlockedDayIds: GameProgressState['unlockedDayIds'];
    clearedDayIds: GameProgressState['clearedDayIds'];
    failedDayIds: GameProgressState['failedDayIds'];
  };
  activeRunId: GameProgressState['activeRunId'];
  runHistory: DayRunRecord[];
  transitions: DayTransitionRecord[];
  trafficSnapshot: {
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
    currentTurn: CurrentTurnState;
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
  };
  tableSnapshot: {
    entries: TranslationTableEntry[];
    nextSequence: GameTableState['nextSequence'];
  };
  auditSnapshot: {
    logs: AuditLogEntry[];
    nextSequence: GameAuditState['nextSequence'];
  };
  packetLedgers: PacketLedgerRecord[];
  commands: PlayerCommandRecord[];
  turns: ResolvedTurnRecord[];
  actions: ActionResultRecord[];
  events: SessionEventRecord[];
  checkpoints: SessionCheckpointRecord[];
  objectives: DayObjectiveState[];
  tableEntries: TranslationTableEntry[];
}

export interface RunArchiveRecord {
  id: string;
  sequence: number;
  runId: string;
  dayId: string;
  dayNumber: number | null;
  title: string;
  resolutionKind: DayResolution['kind'] | null;
  archiveReason: RunArchiveReason;
  actionCount: number;
  incidentCount: number;
  exportSnapshot: SessionExportSnapshot;
}

export interface DayObjectiveState {
  id: string;
  type: 'observeIncident';
  templateId: string;
  status: 'pending' | 'satisfied';
  title: string;
  message: string;
  satisfiedByActionId: string | null;
}

export interface BackgroundFlowState {
  id: string;
  entryId: string;
  source: Endpoint;
  destination: Endpoint;
  expectedTarget: Endpoint;
  protocol?: TransportProtocol;
  prompt: string;
  note?: string;
  queuePosition: 'front' | 'back';
  intervalActions: number;
  nextArrivalAction: number;
  remainingPackets: number;
  waitBudgetActions: number | null;
}

export interface RuntimePacketRecord extends RuntimePacket {
  ordinal: number;
  availableAtAction: number;
  pendingAge: number;
  maxPendingAge: number;
  status: 'upcoming' | 'pending' | 'active' | 'resolved';
  spawnSource: 'scenario' | 'repeatUntilIncident' | 'generatedResponse' | 'backgroundFlow';
  resolvedByActionId: string | null;
}

export interface DaySessionBlueprint {
  dayId: string;
  runId: string;
  sessionStatus: 'idle' | 'active' | 'resolved';
  packets: RuntimePacketRecord[];
  packetOrder: string[];
  activePacketId: string | null;
  upcomingPacketIds: string[];
  pendingPacketIds: string[];
  resolvedPacketIds: string[];
  backgroundFlows: BackgroundFlowState[];
  actionClock: number;
  actionResults: ActionResultRecord[];
  objectives: DayObjectiveState[];
  nextActionSequence: number;
  nextRuntimeOrdinal: number;
  daySeed: number;
  rngSeed: number;
}

export interface AuditLogEntry {
  id: string;
  sequence: number;
  dayId: string;
  runId: string | null;
  packetId: string;
  action: AuditAction;
  outcome: 'advanced' | 'blocked' | 'failed';
  message: string;
}

export interface GameProgressState {
  screen: GameScreen;
  firstDayId: ScenarioDay['id'] | null;
  currentDayId: ScenarioDay['id'] | null;
  nextDayId: ScenarioDay['id'] | null;
  activeRunId: string | null;
  inspectedRunId: string | null;
  unlockedDayIds: ScenarioDay['id'][];
  clearedDayIds: ScenarioDay['id'][];
  failedDayIds: ScenarioDay['id'][];
  lastResolution: DayResolution | null;
  runHistory: DayRunRecord[];
  runArchives: RunArchiveRecord[];
  dayHistory: DayHistoryEntry[];
  transitions: DayTransitionRecord[];
  nextRunSequence: number;
  nextArchiveSequence: number;
  nextTransitionSequence: number;
}

export interface GameWorkspaceState {
  draft: WorkbenchDraftState;
  document: WorkbenchDocumentState;
  suspendedPackets: Record<string, SuspendedWorkbenchPacketState>;
  feedback: FeedbackMessage | null;
  referenceTab: ReferenceTab;
  referenceOpen: boolean;
}

export type TableSortMode = 'oldest' | 'newest' | 'remainingTime';

export interface GameTableViewState {
  sortMode: TableSortMode;
  filterExternalPort: StampId | 'all';
  filterDestinationHost: string;
}

export interface GameTableState extends EntityState<TranslationTableEntry, string> {
  nextSequence: number;
}

export interface GameAuditState extends EntityState<AuditLogEntry, string> {
  nextSequence: number;
}

export interface GameTrafficState extends EntityState<RuntimePacketRecord, string> {
  dayId: string | null;
  runId: string | null;
  sessionStatus: 'idle' | 'active' | 'resolved';
  packetOrder: string[];
  activePacketId: string | null;
  upcomingPacketIds: string[];
  pendingPacketIds: string[];
  resolvedPacketIds: string[];
  backgroundFlows: BackgroundFlowState[];
  actionClock: number;
  actionResults: ActionResultRecord[];
  commandHistory: PlayerCommandRecord[];
  currentTurn: CurrentTurnState;
  resolvedTurns: ResolvedTurnRecord[];
  sessionEvents: SessionEventRecord[];
  checkpoints: SessionCheckpointRecord[];
  objectives: DayObjectiveState[];
  nextCommandSequence: number;
  nextActionSequence: number;
  nextTurnSequence: number;
  nextEventSequence: number;
  nextCheckpointSequence: number;
  nextRuntimeOrdinal: number;
  daySeed: number;
  rngSeed: number;
}

export interface GameState {
  progress: GameProgressState;
  workspace: GameWorkspaceState;
  table: GameTableState;
  audit: GameAuditState;
  tableView: GameTableViewState;
  traffic: GameTrafficState;
}
