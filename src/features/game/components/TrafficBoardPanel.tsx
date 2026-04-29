import { ArrowLeftRight, ArrowRightLeft, Package2 } from 'lucide-react'

import { SurfaceCard } from '../../../components/ui/SurfaceCard'

interface TrafficBoardItem {
  runtimeId: string
  direction: 'lanToWan' | 'wanToLan'
  sourceLabel: string
  destinationLabel: string
  cycleIndex: number
  variantLabel: string | null
  status: 'upcoming' | 'pending' | 'active' | 'resolved'
  causedIncident: boolean
  isActive: boolean
}

export function TrafficBoardPanel({
  items,
  laneSummary,
}: {
  items: TrafficBoardItem[]
  laneSummary: {
    lanToWan: number
    wanToLan: number
    activeLanToWan: number
    activeWanToLan: number
  }
}) {
  const activeItem = items.find((item) => item.isActive) ?? null
  const pendingCount = items.filter((item) => item.status === 'pending').length
  const incidentCount = items.filter((item) => item.causedIncident).length

  return (
    <SurfaceCard tone="muted" className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Traffic Queue</p>
          <h3 className="mt-2 text-xl font-black tracking-[0.08em] text-stone-100">本日の流量監視盤</h3>
        </div>
        <div className="text-right text-xs uppercase tracking-[0.22em] text-stone-500">
          <p>Total</p>
          <p className="mt-2 text-lg font-black tracking-[0.08em] text-stone-100">{items.length}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="tray-slot border border-[#4b4539] px-4 py-4">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-4 w-4 text-emerald-300" />
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">LAN Intake</p>
          </div>
          <p className="mt-3 text-2xl font-black tracking-[0.08em] text-stone-100">{laneSummary.lanToWan}</p>
          <p className="mt-2 text-sm text-stone-400">外へ出る通信</p>
        </div>
        <div className="tray-slot border border-[#4b4539] px-4 py-4">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="h-4 w-4 text-cyan-300" />
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">WAN Intake</p>
          </div>
          <p className="mt-3 text-2xl font-black tracking-[0.08em] text-stone-100">{laneSummary.wanToLan}</p>
          <p className="mt-2 text-sm text-stone-400">戻り通信</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-[#50483d] bg-[#13120f] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Pending</p>
          <p className="mt-2 text-xl font-black text-stone-100">{pendingCount}</p>
        </div>
        <div className="border border-[#50483d] bg-[#13120f] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Incidents</p>
          <p className="mt-2 text-xl font-black text-stone-100">{incidentCount}</p>
        </div>
        <div className="border border-[#50483d] bg-[#13120f] px-3 py-3">
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-stone-400" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Now Handling</p>
          </div>
          <p className="mt-2 text-sm font-bold text-stone-200">
            {activeItem ? (activeItem.direction === 'lanToWan' ? 'LAN > WAN' : 'WAN > LAN') : '待機中'}
          </p>
        </div>
      </div>

      {activeItem && (
        <div className="paper-sheet border border-[#9a8b72] px-4 py-3 text-stone-800">
          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-stone-500">
            <span>{activeItem.direction === 'lanToWan' ? 'LAN > WAN' : 'WAN > LAN'}</span>
            <span>Cycle {activeItem.cycleIndex + 1}</span>
          </div>
          <p className="mt-2 font-bold">{activeItem.sourceLabel}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-600">to {activeItem.destinationLabel}</p>
          {activeItem.variantLabel && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-stone-500">{activeItem.variantLabel}</p>
          )}
        </div>
      )}
    </SurfaceCard>
  )
}
