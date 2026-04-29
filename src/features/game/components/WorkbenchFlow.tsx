interface WorkbenchFlowProps {
  direction: 'lanToWan' | 'wanToLan' | null
  packetLabel: string
  packetSummary: string
  cycleIndex: number | null
  variantLabel: string | null
  isReadOnly: boolean
}

const stageCopy = {
  lanToWan: {
    leftTitle: 'LAN 受取口',
    leftState: '到着中',
    centerTitle: '作業台',
    centerState: '外向けに加工',
    rightTitle: 'WAN 送出口',
    rightState: '送出待ち',
  },
  wanToLan: {
    leftTitle: 'LAN 送出口',
    leftState: '戻し先待ち',
    centerTitle: '作業台',
    centerState: '照合して復元',
    rightTitle: 'WAN 受取口',
    rightState: '到着中',
  },
} as const

const stageTone = (isActive: boolean, isReadOnly: boolean) =>
  isActive
    ? isReadOnly
      ? 'border-cyan-700 bg-cyan-950/50 text-cyan-100'
      : 'border-amber-500 bg-amber-950/50 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]'
    : 'border-[#534c40] text-stone-500'

export function WorkbenchFlow({
  direction,
  packetLabel,
  packetSummary,
  cycleIndex,
  variantLabel,
  isReadOnly,
}: WorkbenchFlowProps) {
  const phase = direction ? stageCopy[direction] : null
  const leftActive = direction === 'lanToWan'
  const rightActive = direction === 'wanToLan'

  return (
    <div className="space-y-4 border border-[#4d473d] bg-[#14130f] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Traffic Board</p>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.25em] text-stone-400">
          {cycleIndex !== null && <span className="border border-[#575142] px-2 py-1">Cycle {cycleIndex + 1}</span>}
          {variantLabel && <span className="border border-[#575142] px-2 py-1">{variantLabel}</span>}
          {isReadOnly && <span className="border border-cyan-800 px-2 py-1 text-cyan-200">Review</span>}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(0,1.25fr)_1fr]">
        <section className={`tray-slot border px-4 py-4 ${stageTone(leftActive, isReadOnly)}`}>
          <p className="text-[11px] uppercase tracking-[0.35em]">{phase?.leftTitle ?? 'LAN'}</p>
          <p className="mt-2 text-lg font-bold tracking-[0.08em]">{phase?.leftState ?? '待機中'}</p>
          <p className="mt-3 text-sm leading-6 text-stone-300">
            {direction === 'lanToWan'
              ? '内側から来た通信を受け取り、外向けの姿へ変える。'
              : '照合が終われば、ここから内側端末へ戻す。'}
          </p>
        </section>

        <section className="border border-[#80745f] bg-[linear-gradient(180deg,#201d17,#171510)] px-4 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">{phase?.centerTitle ?? '作業台'}</p>
              <h3 className="mt-2 text-xl font-black tracking-[0.08em] text-stone-100">{phase?.centerState ?? '審査中'}</h3>
            </div>
            <span className="border border-[#8f7d5b] bg-[#2d261a] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-100">
              Active Packet
            </span>
          </div>
          <div className="paper-sheet mt-4 rotate-[-0.6deg] border-2 border-dashed border-[#a89b84] px-4 py-4 text-stone-900">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">Work Order</p>
            <p className="mt-3 text-lg font-black tracking-[0.05em]">{packetLabel}</p>
            <p className="mt-3 text-sm leading-6 text-stone-700">{packetSummary}</p>
          </div>
        </section>

        <section className={`tray-slot border px-4 py-4 ${stageTone(rightActive, isReadOnly)}`}>
          <p className="text-[11px] uppercase tracking-[0.35em]">{phase?.rightTitle ?? 'WAN'}</p>
          <p className="mt-2 text-lg font-bold tracking-[0.08em]">{phase?.rightState ?? '待機中'}</p>
          <p className="mt-3 text-sm leading-6 text-stone-300">
            {direction === 'lanToWan'
              ? '変換が終わった通信を外へ流す。'
              : '外から届いた返信を受け取り、正しい行だけ通す。'}
          </p>
        </section>
      </div>
    </div>
  )
}
