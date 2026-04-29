import { CheckCircle2, ShieldAlert, Stamp, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type DragEvent } from 'react'

import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import type { StampId } from '../types'

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

const stampInkClassName: Record<StampId, string> = {
  home: 'border-stone-700/50 bg-stone-200/85 text-stone-800',
  red: 'border-red-700/50 bg-red-100/70 text-red-800',
  blue: 'border-blue-700/50 bg-blue-100/70 text-blue-800',
  green: 'border-green-700/50 bg-green-100/70 text-green-800',
  yellow: 'border-yellow-700/50 bg-yellow-100/80 text-yellow-800',
  orange: 'border-orange-700/50 bg-orange-100/80 text-orange-800',
  purple: 'border-violet-700/50 bg-violet-100/70 text-violet-800',
  cyan: 'border-cyan-700/50 bg-cyan-100/70 text-cyan-800',
  pink: 'border-pink-700/50 bg-pink-100/70 text-pink-800',
  lime: 'border-lime-700/50 bg-lime-100/80 text-lime-800',
  amber: 'border-amber-700/50 bg-amber-100/80 text-amber-800',
  teal: 'border-teal-700/50 bg-teal-100/70 text-teal-800',
  indigo: 'border-indigo-700/50 bg-indigo-100/70 text-indigo-800',
  rose: 'border-rose-700/50 bg-rose-100/70 text-rose-800',
  sky: 'border-sky-700/50 bg-sky-100/70 text-sky-800',
  emerald: 'border-emerald-700/50 bg-emerald-100/70 text-emerald-800',
  slate: 'border-slate-700/50 bg-slate-200/80 text-slate-800',
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

export function PacketPanel({
  packet,
  incomingPacket,
  incomingPackets,
  upcomingPacketCount,
  workbenchPlacement,
  usesDirectRouteSlips,
  availableVerdicts,
  allowsWaiting,
  pendingCapacity,
  packetRewritePreview,
  workbenchStatus,
  workbenchDispatchIntent,
  matchingEntryIds,
  draftRouteTargetSummary,
  appliedRouteTargetSummary,
  draftEntrySummary,
  selectedEntrySummary,
  latestActionResult,
  recentActionSlips,
  stampOptions,
  draftStampSummary,
  appliedStampSummary,
  feedback,
  isReadOnly,
  onChooseStamp,
  onChooseRouteTarget,
  onChooseTableEntry,
  onPullPacketToWorkbench,
  onShelveWorkbenchPacket,
  onWaitOneTurn,
  onDropStampSelection,
  onSetDispatchIntent,
  onCommitWorkbenchDispatch,
}: {
  packet: PacketPresentation | null
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
  usesDirectRouteSlips: boolean
  availableVerdicts: Array<'ACCEPT' | 'REJECT'>
  allowsWaiting: boolean
  pendingCapacity: number | null
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
  matchingEntryIds: string[]
  draftRouteTargetSummary: { id: string; label: string } | null
  appliedRouteTargetSummary: { id: string; label: string } | null
  draftEntrySummary: { id: string; label: string } | null
  selectedEntrySummary: { id: string; label: string } | null
  latestActionResult: {
    id: string
    action: 'ACCEPT' | 'REJECT' | 'CLOSE' | 'TIMEOUT' | 'WAIT' | 'OVERFLOW'
    sourceId: string
    direction: 'lanToWan' | 'wanToLan' | null
    outcomeCode: string
    feedbackTone: 'success' | 'error'
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
  stampOptions: StampOption[]
  draftStampSummary: { id: StampId; label: string } | null
  appliedStampSummary: { id: StampId; label: string } | null
  feedback: { tone: 'success' | 'error'; message: string } | null
  isReadOnly: boolean
  onChooseStamp: (stampId: StampId) => void
  onChooseRouteTarget: (routeTargetId: string) => void
  onChooseTableEntry: (entryId: string) => void
  onPullPacketToWorkbench: (packetRuntimeId?: string) => void
  onShelveWorkbenchPacket: () => void
  onWaitOneTurn: () => void
  onDropStampSelection: () => void
  onSetDispatchIntent: (intent: 'ACCEPT' | 'REJECT') => void
  onCommitWorkbenchDispatch: () => void
}) {
  const [draggedStampId, setDraggedStampId] = useState<StampId | null>(null)
  const [dragSource, setDragSource] = useState<'tray' | 'paper' | null>(null)
  const [isPacketDragging, setIsPacketDragging] = useState(false)
  const acceptLabel =
    packet?.direction === 'lanToWan' ? '右へ通す' : packet?.direction === 'wanToLan' ? '左へ戻す' : 'Accept'
  const rejectLabel = packet?.direction === 'lanToWan' ? '外へ出さない' : '内側へ戻さない'
  const latestPacketVerdict =
    latestActionResult &&
    (latestActionResult.action === 'ACCEPT' || latestActionResult.action === 'REJECT') &&
    latestActionResult.sourceId === packet?.runtimeId
      ? latestActionResult
      : null
  const selectedStamp = stampOptions.find((option) => option.isSelected) ?? null
  const canReject = availableVerdicts.includes('REJECT')
  const homeStampOption = stampOptions.find((option) => option.id === 'home') ?? null
  const trayStampOptions = stampOptions.filter((option) => option.id !== 'home' && !option.isSelected)
  const lanInboxPackets = incomingPackets.filter((candidate) => candidate.direction === 'lanToWan')
  const wanInboxPackets = incomingPackets.filter((candidate) => candidate.direction === 'wanToLan')
  const inboxPacketCount = incomingPackets.length
  const inboxCapacityLabel =
    pendingCapacity == null ? `${inboxPacketCount}通待機中` : `${inboxPacketCount}/${pendingCapacity}`
  const inboxCapacityTone =
    pendingCapacity == null
      ? 'text-stone-500'
      : inboxPacketCount >= pendingCapacity
        ? 'text-red-700'
        : inboxPacketCount === pendingCapacity - 1
          ? 'text-amber-700'
          : 'text-stone-500'
  const sourceRewriteValue = packetRewritePreview.source
  const destinationRewriteValue = packetRewritePreview.destination
  const returnedToDesk =
    latestPacketVerdict?.outcomeCode === 'returnedForRoute' ||
    latestPacketVerdict?.outcomeCode === 'returnedForRewrite' ||
    latestPacketVerdict?.outcomeCode === 'returnedForLookup'
  const stagedIntentLabel =
    workbenchDispatchIntent === 'ACCEPT'
      ? acceptLabel
      : workbenchDispatchIntent === 'REJECT'
        ? rejectLabel
        : null
  const dispatchSlipMessage =
    usesDirectRouteSlips
      ? destinationRewriteValue
        ? stagedIntentLabel
          ? `${stagedIntentLabel} を準備中`
          : '送る向きを決めてから提出'
        : '宛先札を DST に重ねる'
      : packet?.direction === 'lanToWan'
      ? sourceRewriteValue
        ? stagedIntentLabel
          ? `${stagedIntentLabel} を準備中`
          : '送る向きを決めてから提出'
        : 'スタンプで SRC を書き換える'
      : destinationRewriteValue
        ? stagedIntentLabel
          ? `${stagedIntentLabel} を準備中`
          : '戻す向きを決めてから提出'
        : matchingEntryIds.length === 0
        ? '一致する行がありません'
        : matchingEntryIds.length === 1
          ? '候補 1件。戻し先を選ぶ'
          : `候補 ${matchingEntryIds.length}件。1行選ぶ`
  const verdictStampLabel =
    returnedToDesk
      ? 'RETURN'
      : latestPacketVerdict?.action === 'ACCEPT'
        ? 'PASS'
        : 'BLOCK'
  const canDragPacket =
    !isReadOnly &&
    packet != null &&
    workbenchPlacement === 'workbench' &&
    ((usesDirectRouteSlips && destinationRewriteValue !== null) ||
      (packet.direction === 'lanToWan' && sourceRewriteValue !== null) ||
      (packet.direction === 'wanToLan' && destinationRewriteValue !== null))

  const handleHomeRewrite = () => {
    if (isReadOnly || !homeStampOption) {
      return
    }
    onChooseStamp('home')
  }

  const handleTrayDragStart = (stampId: StampId) => {
    setDraggedStampId(stampId)
    setDragSource('tray')
  }

  const handlePaperDragStart = (stampId: StampId) => {
    setDraggedStampId(stampId)
    setDragSource('paper')
  }

  const handleDropOnPaper = () => {
    if (dragSource === 'tray' && draggedStampId) {
      onChooseStamp(draggedStampId)
    }
    setDraggedStampId(null)
    setDragSource(null)
  }

  const handleDropOnTray = () => {
    if (dragSource === 'paper') {
      onDropStampSelection()
    }
    setDraggedStampId(null)
    setDragSource(null)
  }

  const clearDragState = () => {
    setDraggedStampId(null)
    setDragSource(null)
  }

  const handlePacketDispatchDrop = (intent: 'ACCEPT' | 'REJECT') => {
    onSetDispatchIntent(intent)
    onCommitWorkbenchDispatch()
    setIsPacketDragging(false)
  }

  const handlePacketDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!canDragPacket) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData('application/x-headers-please-packet', packet?.runtimeId ?? '')
    event.dataTransfer.effectAllowed = 'move'
    setIsPacketDragging(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 pb-6">
      <div className="flex items-center justify-between gap-3 px-1 pb-1">
        <div>
          <h2 className="text-lg font-bold tracking-[0.06em] text-stone-100">{packet?.directionLabel ?? '待機中'}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-400">
          {packet?.protocolLabel && <span className="border border-[#4a453b] bg-[#11100d] px-2 py-1">{packet.protocolLabel}</span>}
          {packet && <span className="border border-[#4a453b] bg-[#11100d] px-2 py-1">Cycle {packet.cycleIndex + 1}</span>}
          {packet?.variantLabel && <span className="border border-[#4a453b] bg-[#11100d] px-2 py-1">{packet.variantLabel}</span>}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_13rem] gap-4">
        <div className="space-y-3">
          {workbenchPlacement !== 'workbench' ? (
            <div className="paper-sheet flex min-h-[26rem] flex-1 flex-col items-center justify-center border-2 border-dashed border-[#8b8069] bg-[#efe6d2]/90 px-6 py-8 text-center text-stone-700 shadow-[8px_8px_0_rgba(0,0,0,0.18)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Workbench</p>
              <p className="mt-3 text-lg font-black tracking-[0.08em] text-stone-800">机の上は空です</p>
              <p className="mt-2 max-w-sm text-sm leading-6">
                {incomingPacket
                  ? usesDirectRouteSlips
                    ? incomingPacket.direction === 'lanToWan'
                      ? '左受取口の個包を机へ出してから、宛先札を重ねて右へ送ります。'
                      : '右受取口の個包を机へ出してから、戻し先の札を重ねて左へ戻します。'
                    : incomingPacket.direction === 'lanToWan'
                    ? '左受取口の個包を机へ出してから、SRC を書き換えます。'
                    : '右受取口の個包を机へ出してから、戻し先を復元します。'
                  : '次の個包を待っています。'}
              </p>
              {upcomingPacketCount > 0 && (
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  まだ届いていない個包 {upcomingPacketCount} 通
                </p>
              )}
              <p className={`mt-2 text-xs font-bold uppercase tracking-[0.18em] ${inboxCapacityTone}`}>
                受取口 {inboxCapacityLabel}
                {pendingCapacity != null && ' 通'}
              </p>
              <div className="mt-5 grid w-full max-w-2xl grid-cols-2 gap-3 text-left">
                {[
                  {
                    title: '左受取口',
                    subtitle: 'LAN / 家の中',
                    packets: lanInboxPackets,
                  },
                  {
                    title: '右受取口',
                    subtitle: 'WAN / インターネット',
                    packets: wanInboxPackets,
                  },
                ].map((lane) => (
                  <div key={lane.title} className="border border-[#8b7b5f] bg-[#ddd1b9] p-3 shadow-[3px_3px_0_rgba(0,0,0,0.12)]">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">{lane.title}</p>
                    <p className="mt-1 text-xs font-black tracking-[0.08em] text-stone-700">{lane.subtitle}</p>
                    <div className="mt-3 space-y-2">
                      {lane.packets.length === 0 ? (
                        <p className="text-xs font-semibold text-stone-500">待機個包はありません</p>
                      ) : (
                        lane.packets.map((candidate) => (
                          <button
                            key={candidate.runtimeId}
                            type="button"
                            onClick={() => onPullPacketToWorkbench(candidate.runtimeId)}
                            disabled={isReadOnly}
                            className="block w-full border border-[#9f9073] bg-[#eee3cf] px-3 py-3 text-left transition hover:bg-[#f4ead7] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <p className="text-sm font-black tracking-[0.06em] text-stone-900">
                              {candidate.sourceLabel} {'->'} {candidate.destinationLabel}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-3 text-xs font-semibold text-stone-600">
                              <span>{candidate.hasSuspendedDraft ? '途中から再開する' : 'クリックして作業台へ出す'}</span>
                              {candidate.maxPendingAge < Number.MAX_SAFE_INTEGER && (
                                <span className={candidate.pendingAge + 1 >= candidate.maxPendingAge ? 'text-red-700' : 'text-amber-700'}>
                                  滞留 {candidate.pendingAge}/{candidate.maxPendingAge}
                                </span>
                              )}
                            </div>
                            {candidate.hasSuspendedDraft && (
                              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                                作業途中の個包
                              </p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
            <AnimatePresence mode="wait">
            <motion.div
              key={packet?.runtimeId ? `work-order:${packet.runtimeId}` : 'work-order:empty'}
              initial={{
                opacity: 0,
                x: packet?.direction === 'wanToLan' ? 20 : -20,
                rotate: packet?.direction === 'wanToLan' ? 1.5 : -1.5,
              }}
              animate={{ opacity: 1, x: 0, rotate: -0.8 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="paper-sheet inline-block max-w-lg border border-[#b8ab92] px-4 py-2 text-stone-800 shadow-[6px_6px_0_rgba(0,0,0,0.14)]"
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Work Order</p>
              <p className="mt-2 text-sm leading-6">{packet?.prompt ?? '次の個包を待っています。'}</p>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-3">
            <div
              className={`tray-slot border px-4 py-2 ${
                packet?.direction === 'lanToWan' ? 'border-[#9c8a61] text-stone-100' : 'border-[#4b4539] text-stone-500'
              } ${packet?.direction === 'lanToWan' ? 'tray-active-pulse' : ''}`}
            >
              <p className="text-[10px] uppercase tracking-[0.28em]">左受取口</p>
              <p className="mt-1 text-xs font-bold tracking-[0.06em]">LAN / 家の中</p>
            </div>
            <div
              className={`tray-slot border px-4 py-2 ${
                packet?.direction === 'wanToLan' ? 'border-[#9c8a61] text-stone-100' : 'border-[#4b4539] text-stone-500'
              } ${packet?.direction === 'wanToLan' ? 'tray-active-pulse' : ''}`}
            >
              <p className="text-[10px] uppercase tracking-[0.28em]">右受取口</p>
              <p className="mt-1 text-xs font-bold tracking-[0.06em]">WAN / インターネット</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={
                packet?.runtimeId
                  ? returnedToDesk
                    ? `packet:${packet.runtimeId}:returned:${latestPacketVerdict.id}`
                    : `packet:${packet.runtimeId}`
                  : 'packet-empty'
              }
              initial={{
                opacity: 0,
                x: returnedToDesk ? 0 : packet?.direction === 'wanToLan' ? 28 : -28,
                y: returnedToDesk ? -28 : 0,
                rotate: returnedToDesk ? -0.6 : packet?.direction === 'wanToLan' ? 1.3 : -1.3,
              }}
              animate={{
                opacity: 1,
                x: 0,
                y: 0,
                rotate: 0,
              }}
              exit={{ opacity: 0, y: 10 }}
              transition={{
                duration: returnedToDesk ? 0.28 : 0.24,
                ease: 'easeOut',
              }}
              draggable={canDragPacket}
              onDragStartCapture={handlePacketDragStart}
              onDragEndCapture={() => setIsPacketDragging(false)}
              className="paper-sheet relative flex min-h-0 flex-1 flex-col border-2 border-[#a79f8d] p-4 text-stone-900 shadow-[8px_8px_0_rgba(0,0,0,0.22)]"
            >
              <AnimatePresence>
                {latestPacketVerdict && (
                  <motion.div
                    key={`${latestPacketVerdict.action}:${latestPacketVerdict.sourceId}`}
                    initial={{ opacity: 0, scale: 1.35, rotate: -12 }}
                    animate={{ opacity: 0.92, scale: 1, rotate: -12 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`pointer-events-none absolute right-5 top-16 border-4 px-4 py-2 text-2xl font-black uppercase tracking-[0.16em] ${
                      latestPacketVerdict.feedbackTone === 'error'
                        ? 'border-red-700 text-red-700'
                        : 'border-emerald-700 text-emerald-700'
                    }`}
                  >
                    {verdictStampLabel}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between border-b-2 border-stone-300 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">Header</span>
                <div className="flex items-center gap-2">
                  {incomingPacket?.hasSuspendedDraft && (
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">作業途中</span>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{packet?.directionLabel ?? '待機中'}</span>
                </div>
              </div>

              <AnimatePresence>
                {returnedToDesk && (
                  <motion.div
                    key={`return-slip:${latestPacketVerdict.id}`}
                    initial={{ opacity: 0, y: -18, rotate: -1.8 }}
                    animate={{ opacity: 1, y: 0, rotate: -1.2 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="mt-3 w-fit border border-red-800/40 bg-red-100/80 px-3 py-2 text-xs font-black tracking-[0.1em] text-red-900 shadow-[3px_3px_0_rgba(0,0,0,0.12)]"
                  >
                    {latestPacketVerdict?.outcomeCode === 'returnedForRoute'
                      ? '送信失敗。宛先札を重ねてから再提出'
                      : latestPacketVerdict?.outcomeCode === 'returnedForLookup'
                      ? '送信失敗。テーブルを見て戻し先を選び直す'
                      : '送信失敗。上書きしてから再提出'}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 space-y-4">
                {!isReadOnly && (
                  <div className="flex justify-end gap-2">
                    {allowsWaiting && (
                      <button
                        type="button"
                        onClick={onWaitOneTurn}
                        className="border border-[#8b7b5f] bg-[#d7ccb8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-700 transition hover:bg-[#e2d7c4]"
                      >
                        1手待つ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onShelveWorkbenchPacket}
                      className="border border-[#8b7b5f] bg-[#e1d3bb] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-700 transition hover:bg-[#ebdfcb]"
                    >
                      棚へ戻す
                    </button>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">宛先</p>
                  <p className="mt-1 text-2xl font-black tracking-[0.04em] text-stone-900">
                    {packet?.destinationHostLabel ?? '—'}
                  </p>
                  {packet?.destinationPortLabel && (
                    <p className="mt-1 text-sm font-semibold text-stone-600">{packet.destinationPortLabel}</p>
                  )}
                </div>

                <div className="grid grid-cols-[4rem_1fr] items-start gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">SRC</span>
                  <div
                    onDragOver={(event) => {
                      if (!isReadOnly && packet?.direction === 'lanToWan') {
                        event.preventDefault()
                      }
                    }}
                    onDrop={() => {
                      if (!isReadOnly && packet?.direction === 'lanToWan') {
                        handleDropOnPaper()
                      }
                    }}
                    className="min-h-16 border-2 border-dashed border-[#a69779] bg-[#f4ecd8] px-3 py-2"
                  >
                    <p className={`text-sm font-semibold ${sourceRewriteValue ? 'text-stone-500 line-through' : 'text-stone-700'}`}>
                      {packet?.sourceLabel ?? '—'}
                    </p>
                    <AnimatePresence mode="wait">
                      {packet?.direction === 'lanToWan' && sourceRewriteValue ? (
                        <motion.div
                          key={`source-rewrite:${sourceRewriteValue}`}
                          initial={{ opacity: 0, scale: 1.06, rotate: -5 }}
                          animate={{ opacity: 1, scale: 1, rotate: -3 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          draggable={!isReadOnly && !!appliedStampSummary}
                          onDragStart={() => {
                            if (appliedStampSummary) {
                              handlePaperDragStart(appliedStampSummary.id)
                            }
                          }}
                          onDragEnd={clearDragState}
                          className={`mt-2 w-fit cursor-grab border-2 px-4 py-3 shadow-[2px_2px_0_rgba(0,0,0,0.12)] ${appliedStampSummary ? stampInkClassName[appliedStampSummary.id] : 'border-[#8f6a2f] bg-[#efd7a7] text-[#734f16]'}`}
                        >
                          <span className="block text-[10px] uppercase tracking-[0.24em] opacity-75">SRC rewritten</span>
                          <span className="mt-1 block text-base font-black tracking-[0.08em]">{sourceRewriteValue}</span>
                        </motion.div>
                      ) : packet?.direction === 'lanToWan' && !usesDirectRouteSlips ? (
                        <motion.p
                          key="source-rewrite-empty"
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: 0.8 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 text-sm font-bold tracking-[0.08em] text-[#8a7448]"
                        >
                          スタンプで SRC を上書き
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                    {packet?.direction === 'lanToWan' && draftStampSummary && !sourceRewriteValue && (
                      <motion.div
                        key={`source-draft:${draftStampSummary.id}`}
                        initial={{ opacity: 0, y: 6, rotate: -1.4 }}
                        animate={{ opacity: 1, y: 0, rotate: -0.8 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="mt-3 inline-flex items-center gap-2 border border-amber-800/35 bg-amber-100/80 px-3 py-2 text-xs font-black tracking-[0.08em] text-amber-950 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                      >
                        <span className="uppercase tracking-[0.16em] opacity-70">候補</span>
                        <span>{draftStampSummary.label}</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[4rem_1fr] items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">Proto</span>
                  <span className="text-sm font-semibold text-stone-700">{packet?.protocolLabel ?? 'N/A'}</span>
                </div>

                <div className="grid grid-cols-[4rem_1fr] items-start gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">DST</span>
                  <div
                    onDragOver={(event) => {
                      if (
                        !isReadOnly &&
                        ((usesDirectRouteSlips &&
                          event.dataTransfer.types.includes('application/x-headers-please-route-slip')) ||
                          (packet?.direction === 'wanToLan' &&
                            event.dataTransfer.types.includes('application/x-headers-please-table-entry')))
                      ) {
                        event.preventDefault()
                      }
                    }}
                    onDrop={(event) => {
                      if (isReadOnly) {
                        return
                      }
                      if (usesDirectRouteSlips) {
                        const routeTargetId = event.dataTransfer.getData('application/x-headers-please-route-slip')
                        if (!routeTargetId) {
                          return
                        }
                        onChooseRouteTarget(routeTargetId)
                        return
                      }
                      if (packet?.direction !== 'wanToLan') {
                        return
                      }
                      const entryId = event.dataTransfer.getData('application/x-headers-please-table-entry')
                      if (entryId) {
                        onChooseTableEntry(entryId)
                      }
                    }}
                    className="min-h-16 border border-stone-300 bg-stone-50/45 px-3 py-2"
                  >
                    <p className={`text-sm font-semibold ${destinationRewriteValue ? 'text-stone-500 line-through' : 'text-stone-700'}`}>
                      {packet?.destinationLabel ?? '—'}
                    </p>
                    <AnimatePresence mode="wait">
                      {packet?.direction === 'wanToLan' && destinationRewriteValue ? (
                        <motion.div
                          key={`destination-rewrite:${destinationRewriteValue}`}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="mt-2 border-l-4 border-emerald-700 pl-3 text-base font-black tracking-[0.06em] text-emerald-900"
                        >
                          {destinationRewriteValue}
                        </motion.div>
                      ) : packet?.direction === 'wanToLan' || usesDirectRouteSlips ? (
                        <motion.p
                          key="destination-rewrite-empty"
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: 0.8 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 text-sm font-bold tracking-[0.08em] text-[#8a7448]"
                        >
                          {usesDirectRouteSlips ? '宛先札で DST を決める' : 'テーブル行で DST を復元'}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                    {usesDirectRouteSlips && draftRouteTargetSummary && !destinationRewriteValue && (
                      <motion.div
                        key={`route-draft:${draftRouteTargetSummary.id}`}
                        initial={{ opacity: 0, y: 6, rotate: -1.4 }}
                        animate={{ opacity: 1, y: 0, rotate: -0.8 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="mt-3 inline-flex items-center gap-2 border border-amber-800/35 bg-amber-100/80 px-3 py-2 text-xs font-black tracking-[0.08em] text-amber-950 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                      >
                        <span className="uppercase tracking-[0.16em] opacity-70">候補</span>
                        <span>{draftRouteTargetSummary.label}</span>
                      </motion.div>
                    )}
                    {!usesDirectRouteSlips && packet?.direction === 'wanToLan' && draftEntrySummary && !destinationRewriteValue && (
                      <motion.div
                        key={`lookup-draft:${draftEntrySummary.id}`}
                        initial={{ opacity: 0, y: 6, rotate: -1.4 }}
                        animate={{ opacity: 1, y: 0, rotate: -0.8 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="mt-3 inline-flex items-center gap-2 border border-amber-800/35 bg-amber-100/80 px-3 py-2 text-xs font-black tracking-[0.08em] text-amber-950 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                      >
                        <span className="uppercase tracking-[0.16em] opacity-70">候補</span>
                        <span>{draftEntrySummary.label}</span>
                      </motion.div>
                    )}
                    {usesDirectRouteSlips && appliedRouteTargetSummary && (
                      <motion.div
                        key={`route-row:${appliedRouteTargetSummary.id}`}
                        initial={{ opacity: 0, y: 6, rotate: -1.4 }}
                        animate={{ opacity: 1, y: 0, rotate: -0.8 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="mt-3 inline-flex items-center gap-2 border border-cyan-800/40 bg-cyan-100/80 px-3 py-2 text-xs font-black tracking-[0.08em] text-cyan-950 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                      >
                        <span className="uppercase tracking-[0.16em] opacity-70">Route</span>
                        <span>{appliedRouteTargetSummary.label}</span>
                      </motion.div>
                    )}
                    {!usesDirectRouteSlips && packet?.direction === 'wanToLan' && selectedEntrySummary && (
                      <motion.div
                        key={`lookup-row:${selectedEntrySummary.id}`}
                        initial={{ opacity: 0, y: 6, rotate: -1.4 }}
                        animate={{ opacity: 1, y: 0, rotate: -0.8 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="mt-3 inline-flex items-center gap-2 border border-cyan-800/40 bg-cyan-100/80 px-3 py-2 text-xs font-black tracking-[0.08em] text-cyan-950 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                      >
                        <span className="uppercase tracking-[0.16em] opacity-70">Lookup</span>
                        <span>{selectedEntrySummary.label}</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {packet?.note && (
                <div className="mt-4 border border-stone-400 bg-stone-200 px-3 py-2 text-xs italic text-stone-700">
                  {packet.note}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => onSetDispatchIntent('ACCEPT')}
              onDragOver={(event) => {
                if (!isReadOnly && event.dataTransfer.types.includes('application/x-headers-please-packet')) {
                  event.preventDefault()
                }
              }}
              onDrop={(event) => {
                if (isReadOnly) {
                  return
                }
                event.preventDefault()
                handlePacketDispatchDrop('ACCEPT')
              }}
              disabled={isReadOnly}
              className={`tray-slot border px-3 py-3 text-left transition ${
                workbenchDispatchIntent === 'ACCEPT'
                  ? 'border-emerald-300 text-emerald-50 ring-2 ring-emerald-200/70'
                  : isPacketDragging
                    ? 'border-emerald-500/70 text-stone-100'
                  : 'border-[#5d574a] text-stone-300 hover:border-[#8a7b63]'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em]">Send Lane</span>
              </div>
              <p className="mt-2 text-sm font-black tracking-[0.08em]">{acceptLabel}</p>
            </button>
            {canReject && (
              <button
                type="button"
                onClick={() => onSetDispatchIntent('REJECT')}
                onDragOver={(event) => {
                  if (!isReadOnly && event.dataTransfer.types.includes('application/x-headers-please-packet')) {
                    event.preventDefault()
                  }
                }}
                onDrop={(event) => {
                  if (isReadOnly) {
                    return
                  }
                  event.preventDefault()
                  handlePacketDispatchDrop('REJECT')
                }}
                disabled={isReadOnly}
                className={`tray-slot border px-3 py-3 text-left transition ${
                  workbenchDispatchIntent === 'REJECT'
                    ? 'border-red-300 text-red-50 ring-2 ring-red-200/70'
                    : isPacketDragging
                      ? 'border-red-500/70 text-stone-100'
                      : 'border-[#5d574a] text-stone-300 hover:border-[#8a7b63]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em]">Hold Tray</span>
                </div>
                <p className="mt-2 text-sm font-black tracking-[0.08em]">{rejectLabel}</p>
              </button>
            )}
            <PrimaryButton
              tone="amber"
              className="py-3 text-sm"
              onClick={onCommitWorkbenchDispatch}
              disabled={isReadOnly || !workbenchStatus.canCommit}
            >
              送る
            </PrimaryButton>
          </div>

          <div className="paper-sheet border border-[#b8ab92] px-3 py-3 text-stone-800 shadow-[4px_4px_0_rgba(0,0,0,0.14)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Dispatch Slip</p>
            <p className="mt-2 text-sm font-bold text-stone-700">
              {dispatchSlipMessage}
            </p>
            {workbenchStatus.routeSummary && (
              <p className="mt-2 border-t border-stone-300 pt-2 text-xs font-bold tracking-[0.06em] text-stone-600">
                {workbenchStatus.routeSummary}
              </p>
            )}
            <div className="mt-3 space-y-2">
              {workbenchStatus.steps.map((step) => (
                <div key={step.id} className="flex items-center gap-2 text-xs font-bold tracking-[0.06em]">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      step.status === 'ready' ? 'bg-emerald-700' : 'bg-amber-700'
                    }`}
                  />
                  <span className={step.status === 'ready' ? 'text-stone-700' : 'text-stone-500'}>{step.label}</span>
                </div>
              ))}
            </div>
            {homeStampOption && packet?.direction === 'lanToWan' && sourceRewriteValue == null && (
              <PrimaryButton
                tone="cyan"
                className="mt-3 w-full px-3 py-2 text-[11px]"
                onClick={handleHomeRewrite}
                disabled={isReadOnly}
              >
                自宅へ書き換え
              </PrimaryButton>
            )}
            {usesDirectRouteSlips && appliedRouteTargetSummary && (
              <p className="mt-2 text-xs font-bold tracking-[0.06em] text-stone-500">
                宛先札: {appliedRouteTargetSummary.label}
              </p>
            )}
            {packet?.direction === 'wanToLan' && selectedEntrySummary && (
              <p className="mt-2 text-xs font-bold tracking-[0.06em] text-stone-500">
                戻し先: {selectedEntrySummary.label}
              </p>
            )}
          </div>

          <div className="border border-[#4a453b] bg-[#12110e] px-3 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Stamp Tray</p>
              {selectedStamp && <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500">紙に配置中</span>}
            </div>
            <div
              onDragOver={(event) => {
                if (!isReadOnly) {
                  event.preventDefault()
                }
              }}
              onDrop={() => {
                if (!isReadOnly) {
                  handleDropOnTray()
                }
              }}
              className="mt-3 rounded-sm border border-dashed border-[#5a5144] bg-[#171510] px-2 py-2"
            >
            {trayStampOptions.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-stone-500">
                <ShieldAlert className="h-4 w-4" />
                {homeStampOption ? '色スタンプなし' : '未解禁'}
              </div>
            ) : (
              <div className="grid max-h-[20rem] gap-2 overflow-auto pr-1">
                {trayStampOptions.map((option) => (
                  <div
                    key={option.id}
                    draggable={!isReadOnly}
                    onDragStart={() => handleTrayDragStart(option.id)}
                    onDragEnd={clearDragState}
                    onClick={() => {
                      if (!isReadOnly) {
                        onChooseStamp(option.id)
                      }
                    }}
                    className={`cursor-grab rounded-b-sm border border-[#5a4630] bg-transparent transition ${
                      option.isUnavailable ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="rounded-t-full border border-[#5a4630] bg-[linear-gradient(180deg,#7b6243,#54412d)] px-3 py-1 text-center text-[10px] font-black uppercase tracking-[0.22em] text-stone-100 shadow-[0_2px_0_rgba(255,255,255,0.08)_inset]">
                      <Stamp className="mx-auto h-4 w-4" />
                    </div>
                    <div
                      className={`flex items-center justify-center gap-2 rounded-b-sm border-x border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                        option.isUnavailable
                          ? 'border-[#7b5a2f] bg-[#2b1d12] text-amber-100'
                          : option.buttonClassName
                      }`}
                    >
                      <span>{option.label}</span>
                    </div>
                  </div>
                ))}
                {selectedStamp && (
                  <div className="border border-dashed border-[#6c604a] px-3 py-3 text-center text-[10px] uppercase tracking-[0.18em] text-stone-500">
                    紙のスタンプをここへ戻す
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          <div className="relative min-h-28">
            <AnimatePresence>
              {recentActionSlips.map((slip) => (
                <motion.div
                  key={slip.id}
                  initial={{ opacity: 0, y: -10, rotate: 2.5 }}
                  animate={{
                    opacity: 1,
                    y: slip.stackIndex * 18,
                    rotate: 1.5 - slip.stackIndex * 0.9,
                  }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="paper-sheet absolute left-3 right-0 border border-[#b8ab92] px-3 py-3 text-stone-800 shadow-[5px_5px_0_rgba(0,0,0,0.16)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">{slip.action}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{slip.subjectLabel}</p>
                  </div>
                  <p
                    className={`mt-2 text-sm font-bold ${
                      slip.feedbackTone === 'error' ? 'text-red-800' : 'text-emerald-900'
                    }`}
                  >
                    {slip.message}
                  </p>
                  {slip.rewriteLabel && (
                    <p className="mt-2 border-t border-stone-300 pt-2 text-[11px] font-bold tracking-[0.06em] text-stone-600">
                      {slip.rewriteLabel}
                    </p>
                  )}
                </motion.div>
              ))}
              {recentActionSlips.length === 0 && feedback && (
                <motion.div
                  key={`feedback:${feedback.tone}:${feedback.message}`}
                  initial={{ opacity: 0, y: -10, rotate: 2.5 }}
                  animate={{ opacity: 1, y: 0, rotate: 1.3 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="paper-sheet absolute left-3 right-0 border border-[#b8ab92] px-3 py-3 text-stone-800 shadow-[5px_5px_0_rgba(0,0,0,0.16)]"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Desk Note</p>
                  <p
                    className={`mt-2 text-sm font-bold ${
                      feedback.tone === 'error' ? 'text-red-800' : 'text-emerald-900'
                    }`}
                  >
                    {feedback.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto text-[10px] uppercase tracking-[0.18em] text-stone-500">
            {usesDirectRouteSlips
              ? isPacketDragging
                  ? packet?.direction === 'lanToWan'
                    ? '右へ通すか外へ出さないへ運ぶ'
                    : '左へ戻すか内側へ戻さないへ運ぶ'
                : destinationRewriteValue
                  ? '宛先札が個包に適用されています'
                  : '右紙の札を DST 欄へ落とします'
              : packet?.direction === 'lanToWan'
              ? draggedStampId && dragSource === 'tray'
                ? 'SRC 欄へ置くと送信元が書き換わります'
                : isPacketDragging
                  ? '右へ通すか外へ出さないへ運ぶ'
                : selectedStamp
                  ? '紙のスタンプを戻すと SRC の上書きが外れます'
                  : 'スタンプを SRC 欄へドラッグ'
              : isPacketDragging
                ? '左へ戻すか内側へ戻さないへ運ぶ'
                : destinationRewriteValue
                ? '選んだ行に合わせて DST が復元されています'
                : '右紙の行を DST 欄へ落とすと復元されます'}
          </div>
        </div>
      </div>
    </div>
  )
}
