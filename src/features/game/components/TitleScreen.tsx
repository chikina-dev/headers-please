import { ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'

import { Pill } from '../../../components/ui/Pill'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { ScreenFrame } from '../../../components/ui/ScreenFrame'
import { SurfaceCard } from '../../../components/ui/SurfaceCard'

export function TitleScreen({
  totalUnits,
  totalDays,
  runSummary,
  archiveSummary,
  latestArchive,
  onStart,
  onInspectLatestArchive,
}: {
  totalUnits: number
  totalDays: number
  runSummary: {
    total: number
    clears: number
    failures: number
    abandoned: number
  }
  archiveSummary: {
    total: number
    resolved: number
    abandoned: number
  }
  latestArchive: {
    runId: string
    title: string
    archiveReason: 'resolved' | 'abandoned'
    incidentCount: number
  } | null
  onStart: () => void
  onInspectLatestArchive: (runId: string) => void
}) {
  return (
    <ScreenFrame>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: 'easeOut' }}
        className="w-full max-w-3xl"
      >
        <SurfaceCard className="w-full border-2 border-[#847a67] p-8">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, rotate: -2.5, y: 10 }}
              animate={{ opacity: 1, rotate: -1.2, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
              className="paper-sheet border-2 border-[#9f947d] px-6 py-5 text-stone-900 shadow-[10px_10px_0_rgba(0,0,0,0.22)]"
            >
              <ShieldCheck className="mx-auto h-14 w-14 text-[#6f6554]" />
              <p className="mt-3 text-xs uppercase tracking-[0.55em] text-stone-500">Border Router Authority</p>
              <h1 className="mt-3 border-b-4 border-[#8d826d] pb-4 text-5xl font-black tracking-[0.18em] text-stone-900">
                HEADERS, PLEASE
              </h1>
              <p className="mt-3 text-lg text-stone-600">NAT / NAPT 通信審査業務</p>
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.12, ease: 'easeOut' }}
            className="mx-auto mt-6 max-w-2xl border border-[#4c473e] bg-[#1c1a17] px-5 py-4 text-center text-base leading-8 text-stone-300"
          >
            通すか、止めるか、事故を起こすか。境界装置の審査官として通信をさばき、
            破綻が出た日だけ次の機能が解禁されます。
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.16, ease: 'easeOut' }}
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            <Pill>Units: {totalUnits}</Pill>
            <Pill>Days: {totalDays}</Pill>
          </motion.div>
          {(runSummary.total > 0 || archiveSummary.total > 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.2, ease: 'easeOut' }}
              className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-stone-400"
            >
              <span>Run {runSummary.total}</span>
              <span>Clear {runSummary.clears}</span>
              <span>Failure {runSummary.failures}</span>
              <span>Archive {archiveSummary.total}</span>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.24, ease: 'easeOut' }}
            className="mt-8 flex justify-center"
          >
            <div className="flex flex-wrap justify-center gap-4">
              {latestArchive && (
                <PrimaryButton
                  tone="cyan"
                  className="min-w-64 text-lg"
                  onClick={() => onInspectLatestArchive(latestArchive.runId)}
                >
                  直近の記録を見る
                </PrimaryButton>
              )}
              <PrimaryButton tone="amber" className="min-w-64 text-lg" onClick={onStart}>
                業務開始
              </PrimaryButton>
            </div>
          </motion.div>
        </SurfaceCard>
      </motion.div>
    </ScreenFrame>
  )
}
