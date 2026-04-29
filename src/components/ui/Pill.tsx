import type { ReactNode } from 'react'

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'subtle'
}) {
  const toneClassName = {
    neutral: 'border-[#6f685c] bg-[#27251f] text-stone-200',
    accent: 'border-cyan-800 bg-cyan-950/50 text-cyan-100',
    success: 'border-emerald-800 bg-emerald-950/50 text-emerald-100',
    subtle: 'border-[#4d493f] bg-[#1c1a17] text-stone-500',
  } satisfies Record<'neutral' | 'accent' | 'success' | 'subtle', string>

  return (
    <span className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${toneClassName[tone]}`}>
      {children}
    </span>
  )
}
