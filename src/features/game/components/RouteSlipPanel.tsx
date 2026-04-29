interface RouteSlipRow {
  id: string
  headerLabel: string
  label: string
  detailLabel?: string
  isMatching: boolean
  isSelected: boolean
  isDraft: boolean
  ambiguityCount?: number
}

export function RouteSlipPanel({
  title,
  subtitle,
  emptyLabel,
  rows,
  isReadOnly,
  dragPayloadType,
  onChooseRow,
  onApplySelectedRow,
}: {
  title: string
  subtitle: string
  emptyLabel: string
  rows: RouteSlipRow[]
  isReadOnly: boolean
  dragPayloadType: 'table-entry' | 'route-slip'
  onChooseRow: (rowId: string) => void
  onApplySelectedRow: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
      <div className="paper-sheet flex min-h-0 flex-1 flex-col border-2 border-[#a79f8d] px-4 py-4 text-stone-900 shadow-[10px_10px_0_rgba(0,0,0,0.2)]">
        <div className="border-b-4 border-stone-800 pb-2">
          <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Route Slips</p>
          <p className="mt-1 text-xl font-black uppercase tracking-[0.18em]">{title}</p>
          <p className="mt-2 text-sm font-semibold text-stone-600">{subtitle}</p>
        </div>

        <div className="mt-4 grid gap-3">
          {rows.length === 0 && (
            <div className="border border-dashed border-stone-400 bg-stone-100/70 px-4 py-8 text-center text-sm font-semibold text-stone-500">
              {emptyLabel}
            </div>
          )}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              draggable={!isReadOnly}
              onDragStart={(event) => {
                if (isReadOnly) {
                  event.preventDefault()
                  return
                }
                event.dataTransfer.setData(
                  dragPayloadType === 'table-entry'
                    ? 'application/x-headers-please-table-entry'
                    : 'application/x-headers-please-route-slip',
                  row.id,
                )
                event.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => {
                if (isReadOnly) {
                  return
                }
                onChooseRow(row.id)
                onApplySelectedRow()
              }}
              className={`paper-sheet border px-4 py-4 text-left shadow-[4px_4px_0_rgba(0,0,0,0.12)] transition ${
                row.isSelected
                  ? 'border-cyan-700 bg-cyan-100 text-cyan-950'
                  : row.isDraft
                    ? 'border-amber-700 bg-amber-100 text-amber-950'
                  : row.isMatching
                    ? 'border-emerald-700 bg-emerald-100 text-emerald-950'
                    : 'border-[#b8ab92] bg-[#f4ecd8] text-stone-800'
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.24em] opacity-70">
                {row.isSelected ? '適用済み' : row.isDraft ? '選択中' : row.isMatching ? '候補' : 'Slip'}
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] opacity-80">{row.headerLabel}</p>
              <p className="mt-1 text-base font-black tracking-[0.06em]">{row.label}</p>
              {row.detailLabel && <p className="mt-1 text-xs font-semibold opacity-80">{row.detailLabel}</p>}
              {row.ambiguityCount && row.ambiguityCount > 1 && (
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-red-800">
                  同じ外側 {row.ambiguityCount}件
                </p>
              )}
              <p className="mt-2 text-xs font-semibold opacity-75">クリックまたは DST へドラッグ</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
