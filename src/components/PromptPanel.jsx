import { useState } from 'react'
import { Robot, CaretDown, CaretUp } from '@phosphor-icons/react'

function pretty(raw) {
  if (!raw) return '(no raw model response — rule-based fallback was used)'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return String(raw)
  }
}

export default function PromptPanel({ prompt, raw, source, cached, error, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl glass border-2 border-dashed !border-sky-300 p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 font-semibold text-sky-900"><Robot size={22} weight="duotone" aria-hidden="true" /> GenAI under the hood: prompt in, response out</span>
        <span className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${source === 'gemini' ? 'bg-primary-strong text-white' : 'bg-accent text-on-accent'}`}>{source === 'gemini' ? 'Gemini' : 'Fallback'}</span>
          {cached && <span className="rounded-full bg-slate-200 px-2 py-0.5">cached</span>}
          {open ? <CaretUp size={16} aria-hidden="true" /> : <CaretDown size={16} aria-hidden="true" />}
        </span>
      </button>
      {open && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-1 text-sm font-semibold text-sky-900">Prompt sent</h4>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{prompt || '(none)'}</pre>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold text-sky-900">Raw model response</h4>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs text-emerald-200">{pretty(raw)}</pre>
            {error && <p className="mt-2 text-xs text-amber-700">Fallback reason: {error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
