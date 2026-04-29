import { SurfaceCard } from '../../../components/ui/SurfaceCard'

export function ActionResultPanel({
  latestActionResult,
  dayRuntimeSummary,
}: {
  latestActionResult: {
    action: 'ACCEPT' | 'REJECT' | 'CLOSE' | 'TIMEOUT' | 'WAIT' | 'OVERFLOW'
    sourceId: string
    direction?: 'lanToWan' | 'wanToLan' | null
    causedIncident: boolean
    auditMessage: string
    feedbackMessage: string
    feedbackTone: 'success' | 'error'
    subjectLabel: string
  } | null
  dayRuntimeSummary: {
    actions: number
    judgements: number
    closes: number
    incidents: number
    successes: number
  }
}) {
  const missRate =
    dayRuntimeSummary.actions === 0
      ? 0
      : Math.round((dayRuntimeSummary.incidents / dayRuntimeSummary.actions) * 100)

  return (
    <SurfaceCard tone="muted" className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Action Record</p>
          <h3 className="mt-1 text-base font-black tracking-[0.08em] text-stone-100">今回の処理</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-xs text-stone-400 md:grid-cols-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Actions</p>
            <p className="mt-1 text-base font-black text-stone-100">{dayRuntimeSummary.actions}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Judge</p>
            <p className="mt-1 text-base font-black text-stone-100">{dayRuntimeSummary.judgements}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Close</p>
            <p className="mt-1 text-base font-black text-stone-100">{dayRuntimeSummary.closes}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Success</p>
            <p className="mt-1 text-base font-black text-emerald-300">{dayRuntimeSummary.successes}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Miss Rate</p>
            <p className={`mt-1 text-base font-black ${missRate > 0 ? 'text-red-300' : 'text-stone-100'}`}>{missRate}%</p>
          </div>
        </div>
      </div>

      {!latestActionResult && <p className="text-sm text-stone-500">まだアクション結果はありません。</p>}

      {latestActionResult && (
        <div
          className={`border px-4 py-3 ${
            latestActionResult.feedbackTone === 'error'
              ? 'border-red-700 bg-red-950/35 text-red-50'
              : 'border-emerald-700 bg-emerald-950/35 text-emerald-50'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.24em] opacity-80">
            {latestActionResult.action} / {latestActionResult.subjectLabel}
          </p>
          <p className="mt-2 text-sm font-bold">{latestActionResult.feedbackMessage}</p>
          <p className="mt-1 text-xs opacity-90">{latestActionResult.auditMessage}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.25em] opacity-75">
            {latestActionResult.causedIncident ? 'incident recorded' : 'operation stable'}
          </p>
        </div>
      )}
    </SurfaceCard>
  )
}
