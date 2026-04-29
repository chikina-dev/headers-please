import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion } from 'motion/react'

import { PrimaryButton } from '../../../components/ui/PrimaryButton'

export function DeskOverlay({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,8,6,0.58)] px-4 pb-0 pt-10 backdrop-blur-[1px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 42 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="relative flex max-h-[72svh] w-full max-w-6xl flex-col overflow-hidden rounded-t-sm border-2 border-[#8e816a] bg-[#1a1712] shadow-[0_-18px_56px_rgba(0,0,0,0.58)]"
      >
        <div className="mx-auto mt-2 h-2 w-28 rounded-full bg-[#5e5546]" />
        <div className="flex items-start justify-between gap-4 border-b border-[#4f473b] bg-[#14120e] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Storage Drawer</p>
            <h2 className="mt-2 text-2xl font-black tracking-[0.08em] text-stone-100">{title}</h2>
            {subtitle && <p className="mt-2 text-sm text-stone-400">{subtitle}</p>}
          </div>
          <PrimaryButton tone="red" className="px-4 py-2 text-xs" onClick={onClose}>
            <X className="mr-2 inline h-4 w-4" />
            閉じる
          </PrimaryButton>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </motion.div>
    </motion.div>
  )
}
