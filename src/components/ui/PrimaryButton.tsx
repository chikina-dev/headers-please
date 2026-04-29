import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonTone = 'amber' | 'cyan' | 'red' | 'emerald'

const toneClassName: Record<ButtonTone, string> = {
  amber:
    'border-[#71501f] bg-[linear-gradient(180deg,#c89f52,#8d692d)] text-stone-950',
  cyan:
    'border-[#3c6c78] bg-[linear-gradient(180deg,#8eb9b5,#51797a)] text-stone-950',
  red:
    'border-[#6d241d] bg-[linear-gradient(180deg,#7a2f27,#4a1713)] text-red-50',
  emerald:
    'border-[#2e6044] bg-[linear-gradient(180deg,#356a51,#1a3c2c)] text-emerald-50',
}

export function PrimaryButton({
  children,
  tone,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  tone: ButtonTone
}) {
  return (
    <button
      type="button"
      className={`stamp-press border-b-[6px] border-x border-t px-6 py-3 font-bold uppercase tracking-[0.18em] shadow-[0_6px_14px_rgba(0,0,0,0.18)] active:border-b-[4px] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 disabled:active:border-b-[6px] ${toneClassName[tone]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
