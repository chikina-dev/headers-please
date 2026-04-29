import { Pill } from '../../../components/ui/Pill'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { ScreenFrame } from '../../../components/ui/ScreenFrame'
import { SurfaceCard } from '../../../components/ui/SurfaceCard'
import type { ScenarioDay } from '../types'

const mechanicLabels: Record<string, string> = {
  usesExternalPort: '外側ポート',
  usesDestinationHost: '宛先ホスト',
  usesDestinationService: '宛先サービス',
  usesInternalPort: '内側ポート',
  usesProtocol: 'プロトコル',
  usesTimeoutManagement: 'タイムアウト管理',
  usesPortExhaustionRules: '満杯時REJECT',
}

export function BriefingScreen({
  day,
  mechanicFlags,
  onStart,
}: {
  day: ScenarioDay
  mechanicFlags: Record<string, boolean>
  onStart: () => void
}) {
  return (
    <ScreenFrame>
      <SurfaceCard className="w-full max-w-4xl border-2 border-[#847a67] p-8 md:p-10">
        <p className="text-sm uppercase tracking-[0.45em] text-cyan-300">Unit {day.unit}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[0.08em] text-stone-100">{day.title}</h1>
        <p className="mt-4 text-lg leading-8 text-stone-300">{day.summary}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(mechanicFlags).map(([key, enabled]) => (
            <Pill key={key} tone={enabled ? 'success' : 'subtle'}>
              {mechanicLabels[key] ?? key}
            </Pill>
          ))}
        </div>
        <PrimaryButton tone="cyan" className="mt-8 min-w-64 text-lg" onClick={onStart}>
          審査ブースへ
        </PrimaryButton>
      </SurfaceCard>
    </ScreenFrame>
  )
}
