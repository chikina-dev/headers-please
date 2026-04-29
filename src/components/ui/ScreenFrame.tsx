import type { ReactNode } from 'react'

export function ScreenFrame({
  children,
  centered = true,
  maxWidthClassName = 'max-w-7xl',
}: {
  children: ReactNode
  centered?: boolean
  maxWidthClassName?: string
}) {
  return (
    <main className="relative h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.18)_58%,rgba(0,0,0,0.62)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,245,220,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,245,220,0.05)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(0,0,0,0.5),transparent)]" />
      <div
        className={`relative mx-auto h-[100svh] w-full ${maxWidthClassName} px-3 py-3 md:px-4 md:py-4 ${
          centered ? 'flex items-center justify-center' : ''
        }`}
      >
        {children}
      </div>
    </main>
  )
}
