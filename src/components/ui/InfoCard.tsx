export function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#3b3832] bg-[#181714] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[10px] uppercase tracking-[0.35em] text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-stone-100">{value}</p>
    </div>
  )
}
