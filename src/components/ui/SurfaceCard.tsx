import type { HTMLAttributes, ReactNode } from 'react'

type SurfaceTone = 'default' | 'muted'

const toneClassName: Record<SurfaceTone, string> = {
  default:
    'ink-panel shadow-[0_24px_70px_rgba(0,0,0,0.45)]',
  muted:
    'ink-panel shadow-[0_18px_48px_rgba(0,0,0,0.38)]',
}

export function SurfaceCard({
  children,
  className = '',
  tone = 'default',
  ...rest
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode
  tone?: SurfaceTone
}) {
  return (
    <section
      className={`relative border border-[#6c665b] p-6 ${toneClassName[tone]} ${className}`.trim()}
      {...rest}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:100%_8px]" />
      {children}
    </section>
  )
}
