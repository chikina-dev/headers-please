import { SurfaceCard } from '../../../components/ui/SurfaceCard'

export function AuditLogPanel({
  auditLog,
}: {
  auditLog: Array<{
    id: string
    action: string
    outcome: string
    message: string
  }>
}) {
  return (
    <SurfaceCard tone="muted">
      <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Audit Log</p>
      <div className="mt-4 grid max-h-72 gap-3 overflow-auto pr-1">
        {auditLog.length === 0 && <p className="text-sm text-stone-500">まだ操作ログはありません。</p>}
        {auditLog.map((entry) => (
          <article
            key={entry.id}
            className={`border-l-4 bg-[#14130f] px-4 py-3 text-sm text-stone-300 ${
              entry.action === 'TIMEOUT'
                ? 'border-amber-600'
                : entry.action === 'CLOSE'
                  ? 'border-cyan-700'
                  : 'border-[#685f4c]'
            }`}
          >
            <p className="font-semibold uppercase tracking-[0.14em] text-stone-100">
              {entry.action} / {entry.outcome}
            </p>
            <p className="mt-1 text-stone-400">{entry.message}</p>
          </article>
        ))}
      </div>
    </SurfaceCard>
  )
}
