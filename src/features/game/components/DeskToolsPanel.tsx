type ToolId = 'handbook' | 'traffic' | 'records' | 'archive'

interface ToolState {
  id: ToolId
  label: string
  description: string
  unlocked: boolean
  unlockHint: string
  badge?: string
}

export function DeskToolsPanel({
  tools,
  onOpenTool,
}: {
  tools: ToolState[]
  onOpenTool: (toolId: ToolId) => void
}) {
  return (
    <div className="relative border-t border-[#3f392f] bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.34))] px-3 pb-1 pt-1">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[#655a48]" />
      <div className="flex flex-wrap items-end justify-center gap-3 overflow-visible pt-1">
        {tools.map((tool) => {
          return (
            <button
              key={tool.id}
              type="button"
              disabled={!tool.unlocked}
              onClick={() => onOpenTool(tool.id)}
              className={`group relative translate-y-3 text-left transition ${
                tool.unlocked
                  ? 'flex min-w-28 flex-col items-center rounded-t-sm border border-[#5e5648] bg-[linear-gradient(180deg,#2a261f,#17140f)] px-4 pb-1.5 pt-1.5 text-stone-100 shadow-[0_-1px_0_rgba(255,255,255,0.05)_inset]'
                  : 'flex min-w-28 flex-col items-center rounded-t-sm border border-dashed border-[#5d564a] bg-[#151410] px-4 pb-1.5 pt-1.5 text-stone-500'
              }`}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.22em]">{tool.label}</p>
              <span
                className={`absolute -bottom-3 left-1/2 h-5 w-16 -translate-x-1/2 rounded-b-full border ${
                  tool.unlocked ? 'border-[#8f836f] bg-[#4a4338]' : 'border-[#5a5449] bg-[#2a2620]'
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
