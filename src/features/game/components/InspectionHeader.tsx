export function InspectionHeader({
  title,
  dayNumber,
  currentCountLabel,
  progress,
  isArchiveInspection,
  shiftGoalSummary,
}: {
  title: string
  dayNumber: number
  currentCountLabel: string
  progress: { current: number; total: number } | null
  isArchiveInspection: boolean
  shiftGoalSummary: {
    requiredSuccesses: number
    requiredRejects: number
    requiredCloses: number
    maxIncidents: number | null
    successes: number
    rejects: number
    closes: number
    incidents: number
    isComplete: boolean
    exceededIncidentLimit: boolean
  } | null
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-1">
      <div className="max-w-3xl">
        <p className="text-[10px] uppercase tracking-[0.42em] text-stone-500">Checkpoint Desk</p>
        <h1 className="mt-1 text-2xl font-black tracking-[0.08em] text-stone-100">{title}</h1>
        {!isArchiveInspection && <p className="mt-2 text-sm text-stone-300">{currentCountLabel}</p>}
        {isArchiveInspection && <p className="mt-2 text-sm text-cyan-200">Archive Review</p>}
        {!isArchiveInspection && shiftGoalSummary && (
          <p className="mt-2 text-xs font-semibold tracking-[0.04em] text-amber-200">
            Shift Goal:
            {shiftGoalSummary.requiredSuccesses > 0 && ` 成功 ${shiftGoalSummary.successes}/${shiftGoalSummary.requiredSuccesses}`}
            {shiftGoalSummary.requiredRejects > 0 && ` 拒否 ${shiftGoalSummary.rejects}/${shiftGoalSummary.requiredRejects}`}
            {shiftGoalSummary.requiredCloses > 0 && ` 終了 ${shiftGoalSummary.closes}/${shiftGoalSummary.requiredCloses}`}
            {shiftGoalSummary.maxIncidents != null && ` 事故 ${shiftGoalSummary.incidents}/${shiftGoalSummary.maxIncidents}`}
          </p>
        )}
      </div>
      <div className="paper-sheet min-w-48 rotate-[0.35deg] border border-[#9f9178] px-4 py-2 text-stone-800 shadow-[4px_4px_0_rgba(0,0,0,0.14)]">
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Date</p>
        <p className="mt-1 text-base font-black tracking-[0.08em]">1982.11.DAY {dayNumber}</p>
        {progress && <p className="mt-1 text-xs font-semibold">Packet {progress.current} / {progress.total}</p>}
      </div>
    </div>
  )
}
