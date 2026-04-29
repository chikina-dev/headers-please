import { Clock3, RotateCcw, ScrollText } from 'lucide-react'

import { Pill } from '../../../components/ui/Pill'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SurfaceCard } from '../../../components/ui/SurfaceCard'

interface ArchiveListEntry {
  runId: string
  dayId: string
  title: string
  archiveReason: 'resolved' | 'abandoned'
  resolutionKind: 'clear' | 'failure' | null
  actionCount: number
  incidentCount: number
}

export function RunArchivePanel({
  isArchiveInspection,
  inspectedRunId,
  archiveSummary,
  archiveList,
  runHistorySummary,
  sessionIntegrityOk,
  progressIntegrityOk,
  onReplayCurrentDay,
  onInspectRunArchive,
}: {
  isArchiveInspection: boolean
  inspectedRunId: string | null
  archiveSummary: {
    total: number
    totalActions: number
    totalIncidents: number
    abandoned: number
    resolved: number
  }
  archiveList: ArchiveListEntry[]
  runHistorySummary: {
    total: number
    active: number
    clears: number
    failures: number
    abandoned: number
  }
  sessionIntegrityOk: boolean
  progressIntegrityOk: boolean
  onReplayCurrentDay: () => void
  onInspectRunArchive: (runId: string) => void
}) {
  return (
    <SurfaceCard tone="muted" className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Run Control</p>
          <h3 className="mt-2 text-xl font-black tracking-[0.08em] text-stone-100">Replay / Archive</h3>
        </div>
        <PrimaryButton tone="cyan" className="px-4 py-2 text-sm" onClick={onReplayCurrentDay}>
          <RotateCcw className="mr-2 inline h-4 w-4" />
          同じ Day を再試行
        </PrimaryButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {isArchiveInspection ? <Pill tone="accent">Archive Review</Pill> : <Pill>Live Session</Pill>}
        <Pill tone={sessionIntegrityOk ? 'success' : 'accent'}>
          Session {sessionIntegrityOk ? 'OK' : 'WARN'}
        </Pill>
        <Pill tone={progressIntegrityOk ? 'success' : 'accent'}>
          Progress {progressIntegrityOk ? 'OK' : 'WARN'}
        </Pill>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border border-[#4a453b] bg-[#14130f] px-4 py-4 text-sm text-stone-300">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Run History</p>
          <p className="mt-3">Total: {runHistorySummary.total}</p>
          <p className="mt-2">Active: {runHistorySummary.active}</p>
          <p className="mt-2">Clear: {runHistorySummary.clears}</p>
          <p className="mt-2">Failure: {runHistorySummary.failures}</p>
          <p className="mt-2">Abandoned: {runHistorySummary.abandoned}</p>
        </div>
        <div className="border border-[#4a453b] bg-[#14130f] px-4 py-4 text-sm text-stone-300">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Archive Summary</p>
          <p className="mt-3">Saved: {archiveSummary.total}</p>
          <p className="mt-2">Resolved: {archiveSummary.resolved}</p>
          <p className="mt-2">Abandoned: {archiveSummary.abandoned}</p>
          <p className="mt-2">Actions: {archiveSummary.totalActions}</p>
          <p className="mt-2">Incidents: {archiveSummary.totalIncidents}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ScrollText className="h-4 w-4 text-stone-400" />
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Archived Runs</p>
        </div>
        {archiveList.length === 0 ? (
          <div className="border border-dashed border-[#4a453b] bg-[#14130f] px-4 py-5 text-sm text-stone-500">
            まだ保存された run はありません。
          </div>
        ) : (
          <div className="space-y-3">
            {archiveList.slice(0, 6).map((archive) => {
              const isCurrent = archive.runId === inspectedRunId

              return (
                <div
                  key={archive.runId}
                  className={`flex flex-wrap items-center justify-between gap-4 border px-4 py-3 ${
                    isCurrent
                      ? 'border-cyan-700 bg-cyan-950/35'
                      : 'border-[#4a453b] bg-[#14130f]'
                  }`}
                >
                  <div className="space-y-1 text-sm text-stone-300">
                    <p className="font-bold tracking-[0.06em] text-stone-100">{archive.title}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                      {archive.dayId} / {archive.runId}
                    </p>
                    <p className="text-xs text-stone-400">
                      {archive.archiveReason === 'abandoned' ? '中断保存' : archive.resolutionKind ?? 'review'} ・
                      actions {archive.actionCount} ・ incidents {archive.incidentCount}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isCurrent && <Pill tone="accent">閲覧中</Pill>}
                    <PrimaryButton
                      tone="amber"
                      className="px-4 py-2 text-xs"
                      onClick={() => onInspectRunArchive(archive.runId)}
                    >
                      <Clock3 className="mr-2 inline h-4 w-4" />
                      再確認
                    </PrimaryButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SurfaceCard>
  )
}
