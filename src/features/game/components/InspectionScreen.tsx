import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { ScreenFrame } from '../../../components/ui/ScreenFrame'
import { isScenarioPhaseIdAtLeast } from '../phases'
import { ActionResultPanel } from './ActionResultPanel'
import { AuditLogPanel } from './AuditLogPanel'
import { DeskOverlay } from './DeskOverlay'
import { DeskToolsPanel } from './DeskToolsPanel'
import { InspectionHeader } from './InspectionHeader'
import { PacketPanel } from './PacketPanel'
import { RouteSlipPanel } from './RouteSlipPanel'
import { RunArchivePanel } from './RunArchivePanel'
import { RuleNotesPanel } from './RuleNotesPanel'
import { TrafficBoardPanel } from './TrafficBoardPanel'
import { TranslationTablePanel } from './TranslationTablePanel'
import type {
  HandbookAction,
  HandbookGlossaryEntry,
  ReferenceTab,
  ScenarioPhaseId,
  StampId,
  UnitReference,
} from '../types'

type OverlayId = 'handbook' | 'traffic' | 'records' | 'archive' | null

interface StampOption {
  id: StampId
  label: string
  buttonClassName: string
  conflictEntryId: string | null
  isInUse: boolean
  isSelected: boolean
  isRequired: boolean
  isUnavailable: boolean
}

interface PacketPresentation {
  id: string
  runtimeId: string
  direction: 'lanToWan' | 'wanToLan'
  directionLabel: string
  sourceLabel: string
  sourceHostLabel: string
  sourcePortLabel: string | null
  destinationLabel: string
  destinationHostLabel: string
  destinationPortLabel: string | null
  externalPortLabel: string
  protocolLabel: string
  cycleIndex: number
  variantLabel: string | null
  note?: string
  prompt: string
}

export function InspectionScreen({
  title,
  dayUnit,
  dayNumber,
  dayPhaseId,
  learningGoal,
  progress,
  isArchiveInspection,
  inspectedRunArchive,
  packet,
  availableVerdicts,
  incomingPacket,
  incomingPackets,
  upcomingPacketCount,
  workbenchPlacement,
  packetRewritePreview,
  workbenchStatus,
  workbenchDispatchIntent,
  trafficBoard,
  latestActionResult,
  recentActionSlips,
  dayRuntimeSummary,
  shiftGoalSummary,
  stampOptions,
  routeSlipTargets,
  draftRouteTargetSummary,
  appliedRouteTargetSummary,
  draftStampSummary,
  appliedStampSummary,
  feedback,
  columns,
  tableFeatureFlags,
  rows,
  tableUsageSummary,
  matchingEntryIds,
  selectedEntryId,
  appliedEntryId,
  draftEntrySummary,
  selectedEntrySummary,
  tableView,
  tableFilterOptions,
  unitReference,
  referenceOpen,
  referenceSummary,
  actionChecklist,
  glossaryEntries,
  referenceTab,
  auditLog,
  archiveSummary,
  archiveList,
  runHistorySummary,
  sessionIntegrity,
  progressIntegrity,
  onChooseStamp,
  onChooseRouteTarget,
  onPullPacketToWorkbench,
  onShelveWorkbenchPacket,
  onWaitOneTurn,
  onDropStampSelection,
  onSetDispatchIntent,
  onCommitWorkbenchDispatch,
  onReplayCurrentDay,
  onInspectRunArchive,
  onSetSortMode,
  onSetExternalPortFilter,
  onSetDestinationHostFilter,
  onChooseRow,
  onSetReferenceTab,
  onSetReferenceOpen,
  onCloseSelectedRow,
}: {
  title: string
  dayUnit: number
  dayNumber: number
  dayPhaseId: ScenarioPhaseId
  learningGoal: string
  progress: { current: number; total: number } | null
  isArchiveInspection: boolean
  inspectedRunArchive: {
    runId: string
    archiveReason: 'resolved' | 'abandoned'
    resolutionKind: 'clear' | 'failure' | null
  } | null
  packet: PacketPresentation | null
  availableVerdicts: Array<'ACCEPT' | 'REJECT'>
  incomingPacket: {
    runtimeId: string
    direction: 'lanToWan' | 'wanToLan'
    sourceLabel: string
    destinationLabel: string
    prompt: string
    pendingAge: number
    maxPendingAge: number
    placement: 'idle' | 'inbox' | 'workbench'
    hasSuspendedDraft: boolean
  } | null
  incomingPackets: Array<{
    runtimeId: string
    direction: 'lanToWan' | 'wanToLan'
    sourceLabel: string
    destinationLabel: string
    prompt: string
    pendingAge: number
    maxPendingAge: number
    placement: 'inbox'
    hasSuspendedDraft: boolean
  }>
  upcomingPacketCount: number
  workbenchPlacement: 'idle' | 'inbox' | 'workbench'
  packetRewritePreview: {
    source: string | null
    destination: string | null
  }
  workbenchStatus: {
    canCommit: boolean
    dispatchIntent: 'ACCEPT' | 'REJECT' | null
    routeSummary: string | null
    steps: Array<{ id: string; label: string; status: 'pending' | 'ready' }>
  }
  workbenchDispatchIntent: 'ACCEPT' | 'REJECT' | null
  trafficBoard: {
    items: Array<{
      runtimeId: string
      direction: 'lanToWan' | 'wanToLan'
      sourceLabel: string
      destinationLabel: string
      cycleIndex: number
      variantLabel: string | null
      status: 'upcoming' | 'pending' | 'active' | 'resolved'
      causedIncident: boolean
      isActive: boolean
    }>
    laneSummary: {
      lanToWan: number
      wanToLan: number
      activeLanToWan: number
      activeWanToLan: number
    }
  }
  latestActionResult: {
    id: string
    action: 'ACCEPT' | 'REJECT' | 'CLOSE' | 'TIMEOUT' | 'WAIT' | 'OVERFLOW'
    sourceId: string
    direction: 'lanToWan' | 'wanToLan' | null
    outcomeCode: string
    causedIncident: boolean
    auditMessage: string
    feedbackMessage: string
    feedbackTone: 'success' | 'error'
    subjectLabel: string
  } | null
  recentActionSlips: Array<{
    id: string
    action: 'ACCEPT' | 'REJECT' | 'CLOSE' | 'TIMEOUT' | 'WAIT' | 'OVERFLOW'
    message: string
    subjectLabel: string
    rewriteLabel: string | null
    feedbackTone: 'success' | 'error'
    stackIndex: number
  }>
  dayRuntimeSummary: {
    actions: number
    judgements: number
    closes: number
    incidents: number
    successes: number
  }
  shiftGoalSummary: {
    requiredSuccesses: number
    requiredRejects: number
    requiredCloses: number
    maxIncidents: number | null
    maxActions: number | null
    actionsElapsed: number
    remainingActions: number | null
    successes: number
    rejects: number
    closes: number
    incidents: number
    isComplete: boolean
    exceededIncidentLimit: boolean
    exhaustedActionBudget: boolean
  } | null
  stampOptions: StampOption[]
  routeSlipTargets: Array<{
    id: string
    headerLabel: string
    label: string
    detailLabel?: string
    isMatching: boolean
    isSelected: boolean
    isDraft: boolean
    ambiguityCount?: number
  }>
  draftRouteTargetSummary: { id: string; label: string } | null
  appliedRouteTargetSummary: { id: string; label: string } | null
  draftStampSummary: { id: StampId; label: string } | null
  appliedStampSummary: { id: StampId; label: string } | null
  feedback: { tone: 'success' | 'error'; message: string } | null
  columns: Array<{ key: string; label: string }>
  tableFeatureFlags: {
    showsStatus: boolean
    showsRemainingTurns: boolean
    allowsManualClose: boolean
    allowsWaiting: boolean
    pendingCapacity: number | null
  }
  rows: Array<{ id: string; cells: string[]; statusLabel: string; remainingTurns: number; maxRemainingTurns: number }>
  tableUsageSummary: {
    totalSlots: number
    usedSlots: number
    freeSlots: number
    usagePercent: number
    expiringEntries: number
  }
  matchingEntryIds: string[]
  selectedEntryId: string | null
  appliedEntryId: string | null
  draftEntrySummary: { id: string; label: string } | null
  selectedEntrySummary: { id: string; label: string } | null
  tableView: {
    sortMode: 'oldest' | 'newest' | 'remainingTime'
    filterExternalPort: StampId | 'all'
    filterDestinationHost: string
  }
  tableFilterOptions: Array<{ value: 'all' | StampId; label: string }>
  unitReference: UnitReference | null
  referenceOpen: boolean
  referenceSummary: string[]
  actionChecklist: HandbookAction[]
  glossaryEntries: HandbookGlossaryEntry[]
  referenceTab: ReferenceTab
  auditLog: Array<{ id: string; action: string; outcome: string; message: string }>
  archiveSummary: {
    total: number
    totalActions: number
    totalIncidents: number
    abandoned: number
    resolved: number
  }
  archiveList: Array<{
    runId: string
    dayId: string
    title: string
    archiveReason: 'resolved' | 'abandoned'
    resolutionKind: 'clear' | 'failure' | null
    actionCount: number
    incidentCount: number
  }>
  runHistorySummary: {
    total: number
    active: number
    clears: number
    failures: number
    abandoned: number
  }
  sessionIntegrity: { ok: boolean }
  progressIntegrity: { ok: boolean }
  onChooseStamp: (stampId: StampId) => void
  onChooseRouteTarget: (routeTargetId: string) => void
  onPullPacketToWorkbench: (packetRuntimeId?: string) => void
  onShelveWorkbenchPacket: () => void
  onWaitOneTurn: () => void
  onDropStampSelection: () => void
  onSetDispatchIntent: (intent: 'ACCEPT' | 'REJECT') => void
  onCommitWorkbenchDispatch: () => void
  onReplayCurrentDay: () => void
  onInspectRunArchive: (runId: string) => void
  onSetSortMode: (mode: 'oldest' | 'newest' | 'remainingTime') => void
  onSetExternalPortFilter: (value: 'all' | StampId) => void
  onSetDestinationHostFilter: (value: string) => void
  onChooseRow: (rowId: string) => void
  onSetReferenceTab: (tab: ReferenceTab) => void
  onSetReferenceOpen: (isOpen: boolean) => void
  onCloseSelectedRow: () => void
}) {
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>(null)
  const dispatchTrace =
    !isArchiveInspection && latestActionResult
      ? latestActionResult.outcomeCode === 'returnedForRewrite' || latestActionResult.outcomeCode === 'returnedForLookup'
        || latestActionResult.outcomeCode === 'returnedForRoute'
        ? {
            key: `trace:${latestActionResult.id}`,
            label: '差し戻し',
            className: 'border-red-800/50 bg-red-100/85 text-red-900',
            animate: { opacity: 0, x: 0, y: -120, rotate: -5 },
          }
        : latestActionResult.action === 'ACCEPT' && latestActionResult.direction === 'lanToWan'
          ? {
              key: `trace:${latestActionResult.id}`,
              label: '右へ送出',
              className: 'border-emerald-800/40 bg-emerald-100/85 text-emerald-950',
              animate: { opacity: 0, x: 280, y: -12, rotate: 8 },
            }
          : latestActionResult.action === 'ACCEPT' && latestActionResult.direction === 'wanToLan'
            ? {
                key: `trace:${latestActionResult.id}`,
                label: '左へ送出',
                className: 'border-emerald-800/40 bg-emerald-100/85 text-emerald-950',
                animate: { opacity: 0, x: -280, y: -12, rotate: -8 },
              }
            : latestActionResult.action === 'REJECT'
              ? {
                  key: `trace:${latestActionResult.id}`,
                  label: '保留',
                  className: 'border-red-800/40 bg-red-100/85 text-red-900',
                  animate: { opacity: 0, x: 0, y: 72, rotate: 3 },
                }
              : null
      : null

  const toolStates = [
    {
      id: 'handbook' as const,
      label: '運用手帳',
      description: '現在の unit で使える識別キーと判断手順を確認する。',
      unlocked: true,
      unlockHint: '',
      badge: `Unit ${dayUnit}`,
    },
    {
      id: 'traffic' as const,
      label: '流量監視盤',
      description: '今日流れている通信列と混雑しているレーンを見る。',
      unlocked: isScenarioPhaseIdAtLeast(dayPhaseId, 'destinationHost'),
      unlockHint: 'Unit 2 で流量監視盤が解禁されます。',
      badge: `${trafficBoard.items.length}件`,
    },
    {
      id: 'records' as const,
      label: '処理記録簿',
      description: '審査で残した ACCEPT / REJECT / CLOSE の記録を読む。',
      unlocked: dayRuntimeSummary.actions > 0,
      unlockHint: '最初の審査を終えると記録簿が使えます。',
      badge: `${auditLog.length}件`,
    },
    {
      id: 'archive' as const,
      label: '保管庫',
      description: '保存済み run や中断保存を見直す。',
      unlocked: archiveSummary.total > 0,
      unlockHint: '保存済み run ができると保管庫が開きます。',
      badge: `${archiveSummary.total}件`,
    },
  ]

  const openOverlay = (overlayId: Exclude<OverlayId, null>) => {
    if (overlayId === 'handbook') {
      onSetReferenceOpen(true)
    }

    setActiveOverlay(overlayId)
  }

  const closeOverlay = () => {
    if (activeOverlay === 'handbook') {
      onSetReferenceOpen(false)
    }

    setActiveOverlay(null)
  }

  return (
    <ScreenFrame centered={false}>
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-visible">
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_20rem] gap-3 overflow-hidden">
        <section className="relative flex min-h-0 flex-col gap-3 overflow-hidden">
          {!isArchiveInspection && latestActionResult?.feedbackTone === 'success' && (
            <div
              key={`${latestActionResult.action}:${latestActionResult.sourceId}:success`}
              className={`pointer-events-none absolute inset-x-2 top-16 z-20 h-1 rounded-full ${
                latestActionResult.direction === 'wanToLan'
                  ? 'desk-scan-line-rtl'
                  : latestActionResult.direction === 'lanToWan'
                    ? 'desk-scan-line-ltr'
                    : 'desk-scan-line-center'
              }`}
            />
          )}
          {!isArchiveInspection &&
            latestActionResult?.feedbackTone === 'error' &&
            latestActionResult.outcomeCode !== 'returnedForRewrite' &&
            latestActionResult.outcomeCode !== 'returnedForLookup' &&
            latestActionResult.outcomeCode !== 'returnedForRoute' && (
            <div
              key={`${latestActionResult.action}:${latestActionResult.sourceId}:error`}
              className="desk-error-flash pointer-events-none absolute inset-0 z-10 rounded-sm"
            />
            )}
          <InspectionHeader
            title={title}
            dayNumber={dayNumber}
            currentCountLabel={learningGoal}
            progress={progress}
            isArchiveInspection={isArchiveInspection}
            shiftGoalSummary={shiftGoalSummary}
          />
          <div className="flex justify-end px-1">
            <AnimatePresence mode="wait">
              {!isArchiveInspection && packet && progress && (
                <motion.div
                  key={`packet-cue:${packet.runtimeId}`}
                  initial={{ opacity: 0, y: -12, rotate: -2 }}
                  animate={{ opacity: 1, y: 0, rotate: -0.6 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="pointer-events-none"
                >
                  <div className="paper-sheet border border-[#b8ab92] px-3 py-2 text-stone-800 shadow-[6px_6px_0_rgba(0,0,0,0.18)]">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Next Packet</p>
                    <p className="mt-1 text-sm font-black tracking-[0.08em]">
                      {progress.current} / {progress.total}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {dispatchTrace && (
              <motion.div
                key={dispatchTrace.key}
                initial={{ opacity: 0.96, x: 0, y: 0, rotate: 0, scale: 1 }}
                animate={{
                  ...dispatchTrace.animate,
                  scale: 0.96,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.48, ease: 'easeOut' }}
                className={`pointer-events-none absolute left-1/2 top-[16.5rem] z-20 w-32 -translate-x-1/2 border px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] shadow-[5px_5px_0_rgba(0,0,0,0.18)] ${dispatchTrace.className}`}
              >
                {dispatchTrace.label}
              </motion.div>
            )}
          </AnimatePresence>
          <PacketPanel
            packet={packet}
            availableVerdicts={availableVerdicts}
            incomingPacket={incomingPacket}
            incomingPackets={incomingPackets}
            upcomingPacketCount={upcomingPacketCount}
            workbenchPlacement={workbenchPlacement}
            usesDirectRouteSlips={dayPhaseId === 'directRouting'}
            allowsWaiting={tableFeatureFlags.allowsWaiting}
            pendingCapacity={tableFeatureFlags.pendingCapacity}
            packetRewritePreview={packetRewritePreview}
            workbenchStatus={workbenchStatus}
            workbenchDispatchIntent={workbenchDispatchIntent}
            matchingEntryIds={matchingEntryIds}
            draftRouteTargetSummary={draftRouteTargetSummary}
            appliedRouteTargetSummary={appliedRouteTargetSummary}
            selectedEntrySummary={selectedEntrySummary}
            latestActionResult={latestActionResult}
            recentActionSlips={recentActionSlips}
            stampOptions={stampOptions}
            draftStampSummary={draftStampSummary}
            appliedStampSummary={appliedStampSummary}
            feedback={feedback}
            isReadOnly={isArchiveInspection}
            onChooseStamp={onChooseStamp}
            onChooseRouteTarget={onChooseRouteTarget}
            onChooseTableEntry={onChooseRow}
            onPullPacketToWorkbench={onPullPacketToWorkbench}
            onShelveWorkbenchPacket={onShelveWorkbenchPacket}
            onWaitOneTurn={onWaitOneTurn}
            onDropStampSelection={onDropStampSelection}
            onSetDispatchIntent={onSetDispatchIntent}
            onCommitWorkbenchDispatch={onCommitWorkbenchDispatch}
            draftEntrySummary={draftEntrySummary}
          />
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-visible">
          {dayPhaseId === 'directRouting' || dayPhaseId === 'natBasics' ? (
            <RouteSlipPanel
              title={dayPhaseId === 'directRouting' ? '宛先札' : 'NAT台帳'}
              subtitle={
                dayPhaseId === 'directRouting'
                  ? 'この個包をどこへ流すか、札を選んで DST に重ねる。'
                  : '外へ出した通信が自宅へ畳み込まれて記録される。戻り先はこの台帳から選ぶ。'
              }
              emptyLabel={
                dayPhaseId === 'directRouting'
                  ? 'まだ使える宛先札はありません'
                  : 'まだ台帳に登録された通信はありません'
              }
              rows={routeSlipTargets}
              isReadOnly={isArchiveInspection}
              dragPayloadType={dayPhaseId === 'directRouting' ? 'route-slip' : 'table-entry'}
              onChooseRow={dayPhaseId === 'directRouting' ? onChooseRouteTarget : onChooseRow}
            />
          ) : (
            <TranslationTablePanel
              packetDirection={packet?.direction ?? null}
              columns={columns}
              tableFeatureFlags={tableFeatureFlags}
              rows={rows}
              tableUsageSummary={tableUsageSummary}
              matchingEntryIds={matchingEntryIds}
              selectedEntryId={selectedEntryId}
              appliedEntryId={appliedEntryId}
              draftEntrySummary={draftEntrySummary}
              selectedEntrySummary={selectedEntrySummary}
              tableView={tableView}
              tableFilterOptions={tableFilterOptions}
              isReadOnly={isArchiveInspection}
              onSetSortMode={onSetSortMode}
              onSetExternalPortFilter={onSetExternalPortFilter}
              onSetDestinationHostFilter={onSetDestinationHostFilter}
              onChooseRow={onChooseRow}
              onCloseSelectedRow={onCloseSelectedRow}
            />
          )}
        </section>
        </div>
        <DeskToolsPanel tools={toolStates} onOpenTool={openOverlay} />
      </div>

      <AnimatePresence>
        {activeOverlay === 'traffic' && (
          <DeskOverlay title="流量監視盤" subtitle="本日の通信列と混雑レーン" onClose={closeOverlay}>
            <TrafficBoardPanel items={trafficBoard.items} laneSummary={trafficBoard.laneSummary} />
          </DeskOverlay>
        )}

        {activeOverlay === 'records' && (
          <DeskOverlay title="処理記録簿" subtitle="直近の判定と事故記録" onClose={closeOverlay}>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <ActionResultPanel latestActionResult={latestActionResult} dayRuntimeSummary={dayRuntimeSummary} />
              <AuditLogPanel auditLog={auditLog} />
            </div>
          </DeskOverlay>
        )}

        {activeOverlay === 'archive' && (
          <DeskOverlay title="保管庫" subtitle="保存済み run の見直し" onClose={closeOverlay}>
            <RunArchivePanel
              isArchiveInspection={isArchiveInspection}
              inspectedRunId={inspectedRunArchive?.runId ?? null}
              archiveSummary={archiveSummary}
              archiveList={archiveList}
              runHistorySummary={runHistorySummary}
              sessionIntegrityOk={sessionIntegrity.ok}
              progressIntegrityOk={progressIntegrity.ok}
              onReplayCurrentDay={onReplayCurrentDay}
              onInspectRunArchive={onInspectRunArchive}
            />
          </DeskOverlay>
        )}

        {activeOverlay === 'handbook' && (
          <DeskOverlay title={unitReference?.title ?? '運用手帳'} subtitle="現在の unit の判断基準" onClose={closeOverlay}>
            <RuleNotesPanel
              unitReference={unitReference}
              referenceOpen={referenceOpen}
              referenceTab={referenceTab}
              referenceSummary={referenceSummary}
              actionChecklist={actionChecklist}
              glossaryEntries={glossaryEntries}
              onSetReferenceTab={onSetReferenceTab}
              onSetReferenceOpen={onSetReferenceOpen}
            />
          </DeskOverlay>
        )}
      </AnimatePresence>
    </ScreenFrame>
  )
}
