import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'

import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { ScreenFrame } from '../../../components/ui/ScreenFrame'
import { SurfaceCard } from '../../../components/ui/SurfaceCard'

export function ResolutionScreen({
  toneLabel,
  title,
  message,
  daySummary,
  summary,
  unlockSummary,
  buttonLabel,
  replayLabel,
  onNext,
  onReplay,
}: {
  toneLabel: string
  title: string
  message?: string
  daySummary?: {
    actions: number
    judgements: number
    closes: number
    incidents: number
    successes: number
  }
  summary?: {
    clearedDays: number
    totalLogs: number
    accepts: number
    rejects: number
    closes: number
    timeouts: number
    blocked: number
    failures: number
  }
  unlockSummary?: {
    nextDayNumber: number
    nextDayTitle: string
    nextDaySummary: string
    addedColumns: string[]
    addedStamps: string[]
    addedActions: string[]
    unlockedTools: string[]
    hasUnlocks: boolean
  } | null
  buttonLabel?: string
  replayLabel?: string
  onNext?: () => void
  onReplay?: () => void
}) {
  return (
    <ScreenFrame>
      <div className="flex w-full max-w-6xl items-start justify-center gap-6">
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-3xl"
        >
          <SurfaceCard
            className={`w-full border-2 p-6 text-center md:p-8 ${
              toneLabel === 'Failure' ? 'border-red-700' : 'border-[#847a67]'
            }`}
          >
            <div className="flex justify-center">
              {toneLabel === 'Failure' ? (
                <AlertTriangle className="h-16 w-16 text-red-500" />
              ) : (
                <ShieldCheck className="h-16 w-16 text-emerald-400" />
              )}
            </div>
            <p className="mt-5 text-sm uppercase tracking-[0.45em] text-amber-300">{toneLabel}</p>
            <h1 className="mt-3 text-4xl font-black tracking-[0.08em] text-stone-100">{title}</h1>
            {message && (
              <p className="mt-5 bg-[#181713] px-5 py-5 text-lg leading-8 text-stone-300 ring-1 ring-[#4c473e]">
                {message}
              </p>
            )}
            {daySummary && (
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                <div className="border border-[#4c473e] bg-[#181713] px-4 py-4 text-sm text-stone-300">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Actions</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{daySummary.actions}</p>
                </div>
                <div className="border border-[#4c473e] bg-[#181713] px-4 py-4 text-sm text-stone-300">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Incidents</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{daySummary.incidents}</p>
                </div>
                <div className="border border-[#4c473e] bg-[#181713] px-4 py-4 text-sm text-stone-300">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Success</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{daySummary.successes}</p>
                </div>
              </div>
            )}
            {!daySummary && summary && (
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                <div className="border border-[#4c473e] bg-[#181713] px-4 py-4 text-sm text-stone-300">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Days</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{summary.clearedDays}</p>
                </div>
                <div className="border border-[#4c473e] bg-[#181713] px-4 py-4 text-sm text-stone-300">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Logs</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{summary.totalLogs}</p>
                </div>
                <div className="border border-[#4c473e] bg-[#181713] px-4 py-4 text-sm text-stone-300">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Failures</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{summary.failures}</p>
                </div>
              </div>
            )}
            {(onNext && buttonLabel) || (onReplay && replayLabel) ? (
              <div className="mt-8 flex flex-wrap justify-center gap-4 border-t border-[#4c473e] pt-5">
                {onReplay && replayLabel && (
                  <PrimaryButton tone="cyan" className="min-w-56 text-lg" onClick={onReplay}>
                    {replayLabel}
                  </PrimaryButton>
                )}
                {onNext && buttonLabel && (
                  <PrimaryButton tone="amber" className="min-w-56 text-lg" onClick={onNext}>
                    {buttonLabel}
                  </PrimaryButton>
                )}
              </div>
            ) : null}
          </SurfaceCard>
        </motion.div>

        {unlockSummary && (
          <aside className="hidden w-80 shrink-0 xl:block">
            <motion.div
              initial={{ opacity: 0, x: 16, rotate: 1.5 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.28, delay: 0.08, ease: 'easeOut' }}
              className="paper-sheet border border-[#9f9178] px-5 py-5 text-left text-stone-900 shadow-[8px_8px_0_rgba(0,0,0,0.18)]"
            >
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">Next Assignment</p>
              <h2 className="mt-2 text-2xl font-black tracking-[0.08em]">
                DAY {unlockSummary.nextDayNumber}
              </h2>
              <p className="mt-2 text-base font-bold">{unlockSummary.nextDayTitle.replace(/^DAY \d+:\s*/, '')}</p>
              {unlockSummary.hasUnlocks ? (
                <div className="mt-4 space-y-2 text-sm text-stone-800">
                  {unlockSummary.addedColumns.length > 0 && (
                    <p>新しい記録列: {unlockSummary.addedColumns.join(' / ')}</p>
                  )}
                  {unlockSummary.addedStamps.length > 0 && (
                    <p>使える色: {unlockSummary.addedStamps.join(' / ')}</p>
                  )}
                  {unlockSummary.addedActions.length > 0 && (
                    <p>新しい操作: {unlockSummary.addedActions.join(' / ')}</p>
                  )}
                  {unlockSummary.unlockedTools.length > 0 && (
                    <p>解禁設備: {unlockSummary.unlockedTools.join(' / ')}</p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-stone-700">{unlockSummary.nextDaySummary}</p>
              )}
            </motion.div>
          </aside>
        )}
      </div>
    </ScreenFrame>
  )
}
