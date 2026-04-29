import { getCurrentDayFromProgress } from './campaignFlow';
import { isScenarioPhaseAtLeast } from './phases';
import { HOME_LABEL } from './scenarios';
import type {
  ActionOutcomeCode,
  AuditAction,
  AuditLogEntry,
  Endpoint,
  GameProgressState,
  IncidentKind,
  LookupKey,
  RejectReasonCode,
  RuntimePacket,
  ScenarioDay,
  StampId,
  TranslationTableEntry,
  Verdict,
} from './types';

interface VerdictEvaluationInput {
  day: ScenarioDay;
  packet: RuntimePacket;
  verdict: Verdict;
  selectedStampId: StampId | null;
  selectedTableEntry: TranslationTableEntry | null;
  documentSource: Endpoint | null;
  documentSourceApplied: boolean;
  documentDestination: Endpoint | null;
  documentDestinationApplied: boolean;
  tableEntries: TranslationTableEntry[];
  nextTableSequence: number;
  rngSeed: number;
}

type AdvancedEvaluation = {
  kind: 'advanced';
  advancesPacket: boolean;
  outcomeCode: ActionOutcomeCode;
  incidentKind: IncidentKind | null;
  rejectReasonCode: RejectReasonCode | null;
  autoAssignedStampId: StampId | null;
  conflictingEntryId: string | null;
  deliveredTarget: Endpoint | null;
  expectedTarget: Endpoint | null;
  auditMessage: string;
  feedbackMessage: string;
  feedbackTone: 'success' | 'error';
  causedIncident: boolean;
  nextSeed: number;
  createdTableEntry?: TranslationTableEntry;
  activatedEntryId?: string;
};

export type VerdictEvaluation = AdvancedEvaluation;

const incidentFromRejectReason = (
  reasonCode: RejectReasonCode | undefined,
): IncidentKind => {
  switch (reasonCode) {
    case 'unknownInbound':
      return 'acceptedUnauthorizedTraffic';
    case 'destinationHostMismatch':
    case 'destinationServiceMismatch':
    case 'protocolMismatch':
    case 'sourceHostMismatch':
      return 'misroutedReturnTraffic';
    case 'portExhausted':
      return 'acceptedUnauthorizedTraffic';
    default:
      return 'acceptedUnauthorizedTraffic';
  }
};

export const getCurrentDay = (progress: GameProgressState): ScenarioDay | null =>
  getCurrentDayFromProgress(progress);

export const getCurrentPacket = (currentIndex: number, packets: RuntimePacket[]): RuntimePacket | null =>
  packets[currentIndex] ?? null;

export const formatEndpoint = (endpoint: Endpoint) =>
  endpoint.port ? `${endpoint.host}:${endpoint.port}` : endpoint.host;

const getInitialRemainingTurns = (day: ScenarioDay, packet: RuntimePacket) => {
  if (!isScenarioPhaseAtLeast(day, 'timeoutLifecycle')) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (packet.packet.protocol === 'UDP') {
    return 3;
  }

  if (packet.packet.protocol === 'TCP') {
    return 5;
  }

  return 5;
};

export const matchesInboundEntry = (
  day: ScenarioDay,
  packet: RuntimePacket,
  entry: TranslationTableEntry,
) =>
  day.rules.inboundLookupKeys.every((key) => {
    switch (key) {
      case 'externalHost':
        return entry.externalHost === packet.packet.destination.host;
      case 'externalPort':
        return entry.externalPort === packet.packet.destination.port;
      case 'destinationHost':
        return entry.destinationHost === packet.packet.source.host;
      case 'destinationService':
        return entry.destinationService === packet.packet.source.port;
      case 'protocol':
        return entry.protocol === packet.packet.protocol;
      default:
        return true;
    }
  });

export const findMatchingInboundEntries = (
  day: ScenarioDay,
  packet: RuntimePacket | null,
  tableEntries: TranslationTableEntry[],
) => {
  if (!packet || packet.packet.direction !== 'wanToLan') {
    return [];
  }

  return tableEntries.filter((entry) => matchesInboundEntry(day, packet, entry));
};

const lookupKeyEquals = (
  key: LookupKey,
  left: TranslationTableEntry,
  right: TranslationTableEntry,
) => {
  switch (key) {
    case 'protocol':
      return left.protocol === right.protocol;
    case 'externalHost':
      return left.externalHost === right.externalHost;
    case 'externalPort':
      return left.externalPort === right.externalPort;
    case 'destinationHost':
      return left.destinationHost === right.destinationHost;
    case 'destinationService':
      return left.destinationService === right.destinationService;
    default:
      return true;
  }
};

const endpointsEqual = (left: Endpoint, right: Endpoint) =>
  left.host === right.host && left.port === right.port;

const deriveOutboundStampIdFromDocument = (
  documentSource: Endpoint | null,
): StampId | null => {
  if (!documentSource || documentSource.host !== HOME_LABEL) {
    return null;
  }

  return (documentSource.port as StampId | undefined) ?? 'home';
};

const buildTableEntry = (
  day: ScenarioDay,
  packet: RuntimePacket,
  stampId: StampId | null,
  sequence: number,
): TranslationTableEntry => {
  const initialRemainingTurns = getInitialRemainingTurns(day, packet);

  return {
    id: `entry-${sequence}-${packet.id}`,
    sequence,
    createdFromPacketId: packet.id,
    protocol: day.rules.columns.includes('protocol') ? packet.packet.protocol : undefined,
    externalHost: HOME_LABEL,
    externalPort: day.rules.columns.includes('externalPort') ? stampId ?? undefined : undefined,
    destinationHost: day.rules.columns.includes('destinationHost')
      ? packet.packet.destination.host
      : undefined,
    destinationService: day.rules.columns.includes('destinationService')
      ? packet.packet.destination.port
      : undefined,
    internalHost: packet.packet.source.host,
    internalPort: day.rules.columns.includes('internalPort') ? packet.packet.source.port : undefined,
    lifecycleState: 'waiting',
    remainingTurns: initialRemainingTurns,
    maxRemainingTurns: initialRemainingTurns,
  };
};

export const findOutboundConflict = (
  day: ScenarioDay,
  packet: RuntimePacket | null,
  stampId: StampId | null,
  tableEntries: TranslationTableEntry[],
) => {
  if (!packet || packet.packet.direction !== 'lanToWan') {
    return null;
  }

  if (!stampId || !day.rules.columns.includes('externalPort')) {
    return null;
  }

  if (day.rules.portReusePolicy === 'exclusive') {
    return tableEntries.find((existingEntry) => existingEntry.externalPort === stampId) ?? null;
  }

  const candidateEntry = buildTableEntry(day, packet, stampId, Number.MAX_SAFE_INTEGER);

  return (
    tableEntries.find((existingEntry) =>
      day.rules.inboundLookupKeys.every((key) => lookupKeyEquals(key, existingEntry, candidateEntry)),
    ) ?? null
  );
};

export const evaluateVerdict = ({
  day,
  packet,
  verdict,
  selectedStampId,
  selectedTableEntry,
  documentSource,
  documentSourceApplied,
  documentDestination,
  documentDestinationApplied,
  tableEntries,
  nextTableSequence,
  rngSeed,
}: VerdictEvaluationInput): VerdictEvaluation => {
  if (verdict === 'REJECT') {
    if (packet.expectation.verdict === 'REJECT') {
      return {
        kind: 'advanced',
        advancesPacket: true,
        outcomeCode: 'rejectedExpected',
        incidentKind: null,
        rejectReasonCode: packet.expectation.reasonCode ?? null,
        autoAssignedStampId: null,
        conflictingEntryId: null,
        deliveredTarget: null,
        expectedTarget: null,
        auditMessage: packet.expectation.reason,
        feedbackMessage: '通信を拒否しました。',
        feedbackTone: 'success',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

    return {
      kind: 'advanced',
      advancesPacket: true,
      outcomeCode: 'rejectedLegitimate',
      incidentKind: 'rejectedLegitimateTraffic',
      rejectReasonCode: null,
      autoAssignedStampId: null,
      conflictingEntryId: null,
      deliveredTarget: null,
      expectedTarget: null,
      auditMessage: '正当な通信を REJECT しました。',
      feedbackMessage: 'この通信は通せたはずです。今回は取りこぼしとして記録されます。',
      feedbackTone: 'error',
      causedIncident: true,
      nextSeed: rngSeed,
    };
  }

  if (packet.expectation.verdict === 'REJECT') {
    return {
      kind: 'advanced',
      advancesPacket: true,
      outcomeCode: 'acceptedUnauthorized',
      incidentKind: incidentFromRejectReason(packet.expectation.reasonCode),
      rejectReasonCode: packet.expectation.reasonCode ?? null,
      autoAssignedStampId: null,
      conflictingEntryId: null,
      deliveredTarget: null,
      expectedTarget: null,
      auditMessage: `本来は拒否すべき通信を通しました。${packet.expectation.reason}`,
      feedbackMessage: '通してしまいました。今回の判断は事故として記録されます。',
      feedbackTone: 'error',
      causedIncident: true,
      nextSeed: rngSeed,
    };
  }

  if (packet.expectation.flow === 'outbound') {
    if (day.phaseId === 'directRouting') {
      if (!documentDestinationApplied || !documentDestination) {
        return {
          kind: 'advanced',
          advancesPacket: false,
          outcomeCode: 'returnedForRoute',
          incidentKind: null,
          rejectReasonCode: null,
          autoAssignedStampId: null,
          conflictingEntryId: null,
          deliveredTarget: null,
          expectedTarget: packet.packet.destination,
          auditMessage: '宛先札が未適用のため、通信を右へ渡せず差し戻しました。',
          feedbackMessage: '右側の宛先札を個包へ重ねてから、もう一度送ってください。',
          feedbackTone: 'error',
          causedIncident: false,
          nextSeed: rngSeed,
        };
      }

      if (!endpointsEqual(documentDestination, packet.packet.destination)) {
        return {
          kind: 'advanced',
          advancesPacket: true,
          outcomeCode: 'misroutedReturnTraffic',
          incidentKind: 'acceptedUnauthorizedTraffic',
          rejectReasonCode: null,
          autoAssignedStampId: null,
          conflictingEntryId: null,
          deliveredTarget: documentDestination,
          expectedTarget: packet.packet.destination,
          auditMessage: '宛先札を誤って適用したまま右へ渡し、誤配送を起こしました。',
          feedbackMessage: '違う宛先へ送ってしまいました。',
          feedbackTone: 'error',
          causedIncident: true,
          nextSeed: rngSeed,
        };
      }

      return {
        kind: 'advanced',
        advancesPacket: true,
        outcomeCode: 'forwardedDirectRoute',
        incidentKind: null,
        rejectReasonCode: null,
        autoAssignedStampId: null,
        conflictingEntryId: null,
        deliveredTarget: documentDestination,
        expectedTarget: packet.packet.destination,
        auditMessage: '個包を右側へ渡しました。',
        feedbackMessage: '通信を右へ送りました。',
        feedbackTone: 'success',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

    const effectiveStampId = deriveOutboundStampIdFromDocument(documentSource);

    if (day.availableStamps.length > 0 && (!documentSourceApplied || !effectiveStampId)) {
      return {
        kind: 'advanced',
        advancesPacket: false,
        outcomeCode: 'returnedForRewrite',
        incidentKind: null,
        rejectReasonCode: null,
        autoAssignedStampId: null,
        conflictingEntryId: null,
        deliveredTarget: null,
        expectedTarget: null,
        auditMessage: '色が未設定のため、通信を外へ出せず差し戻しました。',
        feedbackMessage: '色が押されていないため、個包が差し戻されました。',
        feedbackTone: 'error',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

    if (
      selectedStampId &&
      effectiveStampId &&
      selectedStampId !== effectiveStampId
    ) {
      return {
        kind: 'advanced',
        advancesPacket: false,
        outcomeCode: 'returnedForRewrite',
        incidentKind: null,
        rejectReasonCode: null,
        autoAssignedStampId: null,
        conflictingEntryId: null,
        deliveredTarget: null,
        expectedTarget: null,
        auditMessage: '選んだスタンプと書き込まれた送信元が一致しないため、差し戻しました。',
        feedbackMessage: '紙の SRC がまだ正しく書き換わっていません。',
        feedbackTone: 'error',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

    const createdTableEntry = buildTableEntry(day, packet, effectiveStampId, nextTableSequence);
    const conflictingEntry = findOutboundConflict(day, packet, effectiveStampId, tableEntries);

    if (conflictingEntry && day.rules.portReusePolicy === 'exclusive') {
      return {
        kind: 'advanced',
        advancesPacket: false,
        outcomeCode: 'returnedForRewrite',
        incidentKind: null,
        rejectReasonCode: null,
        autoAssignedStampId: null,
        conflictingEntryId: conflictingEntry.id,
        deliveredTarget: null,
        expectedTarget: null,
        auditMessage: `${effectiveStampId ?? '未設定'} はまだ ${conflictingEntry.id} が使用中のため、通信を差し戻しました。`,
        feedbackMessage: 'その色はまだ使用中です。空くまで待つか、別の色を使ってください。',
        feedbackTone: 'error',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

    return {
      kind: 'advanced',
      advancesPacket: true,
      outcomeCode: conflictingEntry ? 'registeredConflictingMapping' : 'registeredMapping',
      incidentKind: null,
      rejectReasonCode: null,
      autoAssignedStampId: null,
      conflictingEntryId: conflictingEntry?.id ?? null,
      deliveredTarget: null,
      expectedTarget: null,
      auditMessage: conflictingEntry
        ? `衝突のある登録を行いました。後で返信が曖昧になる可能性があります。`
        : '変換テーブルへ登録しました。',
      feedbackMessage: conflictingEntry
        ? '送信は通しましたが、同じ色の競合が残っています。'
        : '送信を受理しました。',
      feedbackTone: conflictingEntry ? 'error' : 'success',
      causedIncident: false,
      nextSeed: rngSeed,
      createdTableEntry,
    };
  }

  const matchingEntries = findMatchingInboundEntries(day, packet, tableEntries);
  const restoredDestination =
    documentDestinationApplied &&
    documentDestination &&
    !endpointsEqual(documentDestination, packet.packet.destination)
      ? documentDestination
      : null;

  if (day.phaseId === 'directRouting') {
    if (!documentDestinationApplied || !documentDestination) {
      return {
        kind: 'advanced',
        advancesPacket: false,
        outcomeCode: 'returnedForRoute',
        incidentKind: null,
        rejectReasonCode: null,
        autoAssignedStampId: null,
        conflictingEntryId: null,
        deliveredTarget: null,
        expectedTarget: packet.expectation.expectedTarget,
        auditMessage: '戻し先札が未適用のため、通信を左へ戻せず差し戻しました。',
        feedbackMessage: '戻し先の札を個包へ重ねてから、もう一度送ってください。',
        feedbackTone: 'error',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

    const deliveredTarget = documentDestination;
    const isCorrectRoute = endpointsEqual(deliveredTarget, packet.expectation.expectedTarget);

    return {
      kind: 'advanced',
      advancesPacket: true,
      outcomeCode: isCorrectRoute ? 'forwardedDirectRoute' : 'misroutedReturnTraffic',
      incidentKind: isCorrectRoute ? null : 'misroutedReturnTraffic',
      rejectReasonCode: null,
      autoAssignedStampId: null,
      conflictingEntryId: null,
      deliveredTarget,
      expectedTarget: packet.expectation.expectedTarget,
      auditMessage: isCorrectRoute
        ? '個包を左側へ戻しました。'
        : '戻し先札を誤って適用したまま左へ戻し、誤配送を起こしました。',
      feedbackMessage: isCorrectRoute ? '通信を左へ戻しました。' : '違う内側宛先へ戻してしまいました。',
      feedbackTone: isCorrectRoute ? 'success' : 'error',
      causedIncident: !isCorrectRoute,
      nextSeed: rngSeed,
    };
  }

  if (!selectedTableEntry || !restoredDestination) {
    return {
      kind: 'advanced',
      advancesPacket: false,
      outcomeCode: 'returnedForLookup',
      incidentKind: null,
      rejectReasonCode: null,
      autoAssignedStampId: null,
      conflictingEntryId: null,
      deliveredTarget: null,
      expectedTarget: packet.expectation.expectedTarget,
      auditMessage: '戻し先の行が未指定のため、通信を内側へ戻せず差し戻しました。',
      feedbackMessage: 'テーブルから戻し先を選んでから、もう一度送ってください。',
        feedbackTone: 'error',
        causedIncident: false,
        nextSeed: rngSeed,
      };
    }

  if (day.phaseId === 'natBasics' && matchingEntries.length > 1) {
    return {
      kind: 'advanced',
      advancesPacket: true,
      outcomeCode: 'misroutedReturnTraffic',
      incidentKind: 'ambiguousReturnRoute',
      rejectReasonCode: null,
      autoAssignedStampId: null,
      conflictingEntryId: null,
      deliveredTarget: restoredDestination,
      expectedTarget: packet.expectation.expectedTarget,
      auditMessage:
        '同じ「自宅」に複数の端末がぶら下がっているため、どの行を選んでも返信先を一意に確定できません。',
      feedbackMessage:
        '返信先を決め打ちしても NAT だけでは保証できません。色スタンプが必要です。',
      feedbackTone: 'error',
      causedIncident: true,
      nextSeed: rngSeed,
    };
  }

  const deliveredTarget = restoredDestination;
  const selectedMatchesLookup = matchingEntries.some((entry) => entry.id === selectedTableEntry.id);
  const selectedWasAmbiguousGuess = selectedMatchesLookup && matchingEntries.length > 1;
  const selectedTarget = {
    host: selectedTableEntry.internalHost,
    port: selectedTableEntry.internalPort,
  };
  const selectedAndDocumentAgree = endpointsEqual(deliveredTarget, selectedTarget);
  const isCorrectRoute = endpointsEqual(deliveredTarget, packet.expectation.expectedTarget);
  const expectedTarget = packet.expectation.expectedTarget;

  return {
    kind: 'advanced',
    advancesPacket: true,
    outcomeCode:
      isCorrectRoute
        ? 'restoredExactRoute'
        : matchingEntries.length === 0
          ? 'missingReturnRoute'
          : 'misroutedReturnTraffic',
    incidentKind: isCorrectRoute
      ? null
      : matchingEntries.length === 0
        ? 'missingReturnRoute'
        : !selectedAndDocumentAgree
          ? 'misroutedReturnTraffic'
        : selectedWasAmbiguousGuess
          ? 'ambiguousReturnRoute'
          : 'misroutedReturnTraffic',
    rejectReasonCode: null,
    autoAssignedStampId: null,
    conflictingEntryId: null,
    deliveredTarget,
    expectedTarget,
    auditMessage: isCorrectRoute
      ? selectedWasAmbiguousGuess
        ? '候補が複数ある中から選んで、正しい戻し先へ復元しました。'
        : '戻り通信を正しく復元しました。'
      : matchingEntries.length === 0
        ? '一致する行がないまま内側へ通し、事故を起こしました。'
        : !selectedAndDocumentAgree
          ? '選んだ行と紙に書いた戻し先が一致せず、事故を起こしました。'
        : selectedWasAmbiguousGuess
          ? '候補が複数ある中で別の内側宛先を選び、事故を起こしました。'
          : '戻り通信の復元先を誤りました。',
    feedbackMessage: isCorrectRoute
      ? selectedWasAmbiguousGuess
        ? '候補は複数ありましたが、選んだ行で正しく届きました。'
        : '返信を内側へ戻しました。'
      : matchingEntries.length === 0
        ? '一致する行がないのに通したため、事故として記録されます。'
        : !selectedAndDocumentAgree
          ? '紙の DST が選択行と違うため、別の内側宛先へ送られました。'
        : selectedWasAmbiguousGuess
          ? '選んだ行が違ったため、別の内側宛先へ送られました。'
          : '通しましたが、別の内側宛先へ送られてしまいました。',
    feedbackTone: isCorrectRoute ? 'success' : 'error',
    causedIncident: !isCorrectRoute,
    nextSeed: rngSeed,
    activatedEntryId: selectedTableEntry.id,
  };
};

export const createAuditLogEntry = (
  sequence: number,
  dayId: string,
  runId: string | null,
  packetId: string,
  action: AuditAction,
  outcome: AuditLogEntry['outcome'],
  message: string,
): AuditLogEntry => ({
  id: `audit-${sequence}-${dayId}-${packetId}`,
  sequence,
  dayId,
  runId,
  packetId,
  action,
  outcome,
  message,
});
