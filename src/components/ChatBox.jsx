import { useEffect, useRef, useState } from 'react'

const SAMPLES = [
  'Is it safe for my 5-year-old to play outside at 5 pm?',
  'Should we keep windows open tonight?',
  'Is my asthma medication plan affected today?',
]

/**
 * @param {{ messages: { role: string, content: string, source?: string, error?: string }[], onSend: (q: string) => void, sending: boolean }} props
 */
export default function ChatBox({ messages, onSend, sending }) {
  const [q, setQ] = useState('')
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const endRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  /** @param {string} [text] */
  function submit(text) {
    const t = String(text ?? q).trim()
    if (!t) return setError('Type a question first.')
    if (t.length > 1000) return setError('Please keep questions under 1000 characters.')
    setError(null)
    setQ('')
    onSend(t)
  }

  return (
    <div className="card flex h-full min-h-[24rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Conversation with AirWise">
        {messages.length === 0 && <p className="text-center text-sm text-slate-600">Ask anything about today's air for your family.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${m.role === 'user' ? 'bg-primary-strong text-white' : 'bg-muted'}`}>
              <span className="sr-only">{m.role === 'user' ? 'You: ' : 'AirWise: '}</span>
              {m.content}
              {m.source === 'fallback' && <div className="mt-1 text-xs text-amber-800">Rule-based fallback{m.error ? ` (${m.error})` : ''}</div>}
            </div>
          </div>
        ))}
        {sending && <div className="text-sm text-muted-foreground" role="status">AirWise is thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s} type="button" onClick={() => setQ(s)} disabled={sending} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-800 transition-colors hover:bg-sky-100">{s}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex gap-2" noValidate>
          <label htmlFor="chat-input" className="sr-only">Your question</label>
          <input id="chat-input" value={q} onChange={(e) => { setQ(e.target.value); setError(null) }} placeholder="Ask AirWise…" maxLength={1000}
            aria-invalid={error ? true : undefined} aria-describedby={error ? 'chat-error' : undefined}
            className={`w-full rounded-xl border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 ${error ? 'border-red-400' : 'border-slate-300'}`} />
          <button type="submit" disabled={sending} className="btn btn-primary">Send</button>
        </form>
        {error && <p id="chat-error" role="alert" className="mt-1 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </div>
  )
}
