import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import type { StampId } from '../types'

interface TableColumn {
  key: string
  label: string
}

interface TableRow {
  id: string
  cells: string[]
  statusLabel: string
  remainingTurns: number
  maxRemainingTurns: number
}

export function TranslationTablePanel(props: {
  packetDirection: 'lanToWan' | 'wanToLan' | null
  columns: TableColumn[]
  tableFeatureFlags: {
    showsStatus: boolean
    showsRemainingTurns: boolean
    allowsManualClose: boolean
    allowsWaiting: boolean
    pendingCapacity: number | null
  }
  rows: TableRow[]
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
  isReadOnly: boolean
  onSetSortMode: (mode: 'oldest' | 'newest' | 'remainingTime') => void
  onSetExternalPortFilter: (value: 'all' | StampId) => void
  onSetDestinationHostFilter: (value: string) => void
  onChooseRow: (rowId: string) => void
  onApplySelectedRow: () => void
  onCloseSelectedRow: () => void
}) {
  const {
    packetDirection,
    columns,
    tableFeatureFlags,
    rows,
    matchingEntryIds,
    selectedEntryId,
    appliedEntryId,
    draftEntrySummary,
    selectedEntrySummary,
    isReadOnly,
    onChooseRow,
    onApplySelectedRow,
    onCloseSelectedRow,
  } = props
  const selectedRow = rows.find((row) => row.id === selectedEntryId) ?? null
  const lookupNote =
    packetDirection !== 'wanToLan'
      ? null
      : selectedEntrySummary
        ? `戻し先 ${selectedEntrySummary.label}`
        : draftEntrySummary
          ? `候補選択 ${draftEntrySummary.label}`
        : matchingEntryIds.length === 0
          ? '一致行なし'
          : matchingEntryIds.length === 1
            ? '候補 1件'
            : `候補 ${matchingEntryIds.length}件`
  const needsApply = packetDirection === 'wanToLan' && !!draftEntrySummary && !selectedEntrySummary

  return (
    <div className="relative min-h-0 flex-1 pt-2">
      <div className="paper-sheet flex h-full min-h-0 rotate-[0.4deg] flex-col overflow-auto border-2 border-[#a79f8d] px-4 pb-4 pt-3 text-stone-900 shadow-[12px_12px_0_rgba(0,0,0,0.22)]">
        <div className="flex items-end justify-between border-b-4 border-stone-800 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Registry Copy</p>
            <p className="mt-1 text-xl font-black uppercase tracking-[0.2em]">Translation Table</p>
          </div>
          <span className="text-xs font-bold tracking-[0.25em] text-stone-500">NAPT_TBL_ACTIVE</span>
        </div>
        {lookupNote && (
          <p className="mt-2 text-xs font-bold tracking-[0.08em] text-stone-500">{lookupNote}</p>
        )}

        <table className="mt-4 min-w-full divide-y divide-stone-400 text-left text-sm">
          <thead className="bg-stone-300/80 text-stone-800">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3 font-bold">
                  {column.label}
                </th>
              ))}
              {tableFeatureFlags.showsStatus && <th className="px-3 py-3 font-bold">状態</th>}
              {tableFeatureFlags.showsRemainingTurns && <th className="px-3 py-3 font-bold">残り</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-300 bg-transparent text-stone-900">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(columns.length + (tableFeatureFlags.showsStatus ? 1 : 0) + (tableFeatureFlags.showsRemainingTurns ? 1 : 0), 1)}
                  className="px-3 py-10 text-center text-stone-500"
                >
                  記録なし
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isMatching = matchingEntryIds.includes(row.id)
              const isDraftSelected = selectedEntryId === row.id
              const isApplied = appliedEntryId === row.id

              return (
                <tr
                  key={row.id}
                  draggable={!isReadOnly && packetDirection === 'wanToLan'}
                  onDragStart={(event) => {
                    if (isReadOnly || packetDirection !== 'wanToLan') {
                      event.preventDefault()
                      return
                    }
                    event.dataTransfer.setData('application/x-headers-please-table-entry', row.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => {
                    if (!isReadOnly) {
                      onChooseRow(row.id)
                    }
                  }}
                  className={`cursor-pointer transition ${
                    isApplied
                      ? 'bg-cyan-200'
                      : isDraftSelected
                        ? 'bg-amber-100'
                        : isMatching
                          ? 'bg-emerald-100'
                          : 'hover:bg-stone-100'
                  }`}
                >
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${columns[index]?.key ?? index}`} className="px-3 py-3 font-semibold">
                      {index === 0 && (isApplied || isDraftSelected) ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                              isApplied
                                ? 'border border-cyan-800 bg-cyan-100 text-cyan-950'
                                : 'border border-amber-800 bg-amber-100 text-amber-950'
                            }`}
                          >
                            {isApplied ? '戻し先' : '候補'}
                          </span>
                          <span>{cell}</span>
                        </div>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  {tableFeatureFlags.showsStatus && (
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex border px-2 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                          row.statusLabel === '通信中'
                            ? 'border-emerald-700 bg-emerald-100 text-emerald-900'
                            : row.statusLabel === '待機中'
                              ? 'border-sky-700 bg-sky-100 text-sky-900'
                              : 'border-amber-700 bg-amber-100 text-amber-900'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                  )}
                  {tableFeatureFlags.showsRemainingTurns && (
                    <td className="px-3 py-3">
                      <div className="min-w-24">
                        <div className="h-2 border border-stone-400 bg-stone-200">
                          <div
                            className={`h-full ${row.remainingTurns <= 2 ? 'bg-amber-600' : 'bg-stone-700'}`}
                            style={{ width: `${(row.remainingTurns / row.maxRemainingTurns) * 100}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-bold text-stone-500">{row.remainingTurns}</p>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {needsApply && selectedRow && (
        <div className="pointer-events-none absolute bottom-6 right-[-0.85rem] z-10 rotate-[1.2deg] slip-swing-in">
          <div className="paper-sheet pointer-events-auto w-36 border border-[#9f9178] px-3 py-3 text-stone-800 shadow-[8px_8px_0_rgba(0,0,0,0.18)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Apply Row</p>
            <p className="mt-2 text-xs font-bold tracking-[0.08em]">{draftEntrySummary?.label}</p>
            <PrimaryButton
              tone="cyan"
              className="mt-3 w-full px-3 py-2 text-[11px]"
              onClick={onApplySelectedRow}
              disabled={isReadOnly}
            >
              DSTへ適用
            </PrimaryButton>
          </div>
        </div>
      )}

      {tableFeatureFlags.allowsManualClose && selectedRow && (
        <div className="pointer-events-none absolute bottom-6 right-[-0.85rem] z-10 rotate-[1.2deg] slip-swing-in">
          <div className="paper-sheet pointer-events-auto w-36 border border-[#9f9178] px-3 py-3 text-stone-800 shadow-[8px_8px_0_rgba(0,0,0,0.18)]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Close Entry</p>
            <p className="mt-2 text-xs font-bold tracking-[0.08em]">{selectedRow.id}</p>
            <PrimaryButton
              tone="amber"
              className="mt-3 w-full px-3 py-2 text-[11px]"
              onClick={onCloseSelectedRow}
              disabled={isReadOnly}
            >
              通信終了
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
