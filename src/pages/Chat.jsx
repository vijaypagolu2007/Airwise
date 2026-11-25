import { useRef, useState } from 'react'
import ChatBox from '../components/ChatBox.jsx'
import PromptPanel from '../components/PromptPanel.jsx'
import { RiskBadge } from '../components/ui.jsx'
import { RequireAir } from '../components/Gates.jsx'
import { useLoadedAir, useProfile } from '../context/AirwiseContext.jsx'
import { postChat, buildContext } from '../lib/apiClient.js'
import { aqiToRisk, bandForAqi } from '../lib/aqiBands.js'

function Body() {
  const { place, air } = useLoadedAir()
  const { profile } = useProfile()
  const [messages, setMessages] = useState(/** @type {import('../components/ChatBox.jsx').ChatMessage[]} */ ([]))
  // Messages are only ever appended; a running counter gives each a stable React key.
  const nextId = useRef(0)
  const newId = () => ++nextId.current
  const [sending, setSending] = useState(false)
  const [last, setLast] = useState(/** @type {{ source: string, prompt: string | null, reply?: string, error?: string } | null} */ (null))

  /** @param {string} question */
  async function send(question) {
    const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.content }))
    setMessages((m) => [...m, { id: newId(), role: 'user', content: question }])
    setSending(true)
    try {
      const r = await postChat({ ...buildContext(place, air, profile), question, history })
      setMessages((m) => [...m, { id: newId(), role: 'model', content: r.reply, source: r.source, error: r.error }])
      setLast(r)
    } catch (err) {
      const e = err instanceof Error ? err : new Error('API_UNREACHABLE')
      const aqi = air.current.aqi
      const why = e.message === 'BOT_CHECK_FAILED' ? "I couldn't confirm this request came from a person." : "I couldn't reach the AirWise server."
      const reply = `${why} Rule-based answer: AQI in ${place.name} is ${aqi} (${bandForAqi(aqi).label}, ${aqiToRisk(aqi)} risk). For health symptoms please consult a doctor.`
      setMessages((m) => [...m, { id: newId(), role: 'model', content: reply, source: 'fallback', error: e.message }])
      setLast({ source: 'fallback', prompt: null, error: e.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge aqi={air.current.aqi} />
        <p className="text-sm text-muted-foreground">Grounded in {place.name}'s live AQI, the 24-hour forecast and your household profile.</p>
      </div>
      <div className="min-h-0 flex-1"><ChatBox messages={messages} onSend={send} sending={sending} /></div>
      {last && <PromptPanel prompt={last.prompt} raw={last.reply ? JSON.stringify({ reply: last.reply }) : null} source={last.source} error={last.error} />}
    </div>
  )
}

export default function Chat() {
  return <RequireAir><Body /></RequireAir>
}
