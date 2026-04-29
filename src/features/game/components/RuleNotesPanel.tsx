import { Pill } from '../../../components/ui/Pill'
import { SurfaceCard } from '../../../components/ui/SurfaceCard'
import type { HandbookAction, HandbookGlossaryEntry, ReferenceTab, UnitReference } from '../types'

const tabs: Array<{ id: ReferenceTab; label: string }> = [
  { id: 'summary', label: '要点' },
  { id: 'actions', label: '手順' },
  { id: 'glossary', label: '用語' },
]

export function RuleNotesPanel({
  unitReference,
  referenceOpen,
  referenceTab,
  referenceSummary,
  actionChecklist,
  glossaryEntries,
  onSetReferenceTab,
  onSetReferenceOpen,
}: {
  unitReference: UnitReference | null
  referenceOpen: boolean
  referenceTab: ReferenceTab
  referenceSummary: string[]
  actionChecklist: HandbookAction[]
  glossaryEntries: HandbookGlossaryEntry[]
  onSetReferenceTab: (tab: ReferenceTab) => void
  onSetReferenceOpen: (isOpen: boolean) => void
}) {
  return (
    <SurfaceCard tone="muted" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Inspection Handbook</p>
          <h3 className="mt-2 text-xl font-black tracking-[0.08em] text-stone-100">
            {unitReference?.title ?? '運用メモ'}
          </h3>
          {referenceOpen && unitReference && (
            <p className="mt-2 text-sm leading-7 text-stone-300">{unitReference.objective}</p>
          )}
        </div>
        {unitReference && (
          <div className="flex flex-wrap gap-2">
            {unitReference.addedKeys.map((key) => (
              <Pill key={key} tone="accent">
                {key}
              </Pill>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => onSetReferenceOpen(!referenceOpen)}
          className="border border-[#5a5447] bg-[#151411] px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-stone-300"
        >
          {referenceOpen ? '資料を閉じる' : '資料を開く'}
        </button>
      </div>

      {referenceOpen && <div className="flex flex-wrap gap-2 border-b border-[#4f493d] pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSetReferenceTab(tab.id)}
            className={`border px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] transition ${
              referenceTab === tab.id
                ? 'border-[#d6c39a] bg-[#d6c39a] text-stone-950'
                : 'border-[#5a5447] bg-[#151411] text-stone-300 hover:bg-[#1f1d19]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>}

      {referenceOpen && referenceTab === 'summary' && (
        <div className="grid gap-3">
          {referenceSummary.map((line) => (
            <div key={line} className="border border-[#4f493d] bg-[#161511] px-4 py-3 text-sm leading-7 text-stone-300">
              {line}
            </div>
          ))}
        </div>
      )}

      {referenceOpen && referenceTab === 'actions' && (
        <ol className="grid gap-3">
          {actionChecklist.map((action, index) => (
            <li key={action.id} className="grid gap-2 border border-[#4f493d] bg-[#161511] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center border border-[#7f745d] bg-[#2a261f] text-sm font-black text-[#e6d1a7]">
                  {index + 1}
                </span>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-stone-100">{action.label}</p>
              </div>
              <p className="text-sm leading-7 text-stone-300">{action.description}</p>
            </li>
          ))}
        </ol>
      )}

      {referenceOpen && referenceTab === 'glossary' && (
        <div className="grid gap-3">
          {glossaryEntries.map((entry) => (
            <article key={entry.id} className="border border-[#4f493d] bg-[#161511] px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-bold tracking-[0.08em] text-stone-100">{entry.gameTerm}</p>
                <span className="text-xs uppercase tracking-[0.22em] text-stone-500">{entry.networkTerm}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-stone-300">{entry.description}</p>
            </article>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}
