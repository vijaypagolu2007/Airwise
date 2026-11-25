import { useState } from 'react'
import { bandForAqi } from '../lib/aqiBands.js'
import { UsersFour, WhatsappLogo, Copy, Check } from '@phosphor-icons/react'

/** @type {Record<string, { title: string, actions: string, share: string, copy: string, copied: string }>} */
const T = {
  en: { title: "Today's air", actions: 'Top actions', share: 'Share on WhatsApp', copy: 'Copy', copied: 'Copied!' },
  hi: { title: 'आज की हवा', actions: 'मुख्य कदम', share: 'WhatsApp पर भेजें', copy: 'कॉपी करें', copied: 'कॉपी हो गया!' },
  te: { title: 'ఈరోజు గాలి', actions: 'ముఖ్య చర్యలు', share: 'WhatsAppలో పంపండి', copy: 'కాపీ', copied: 'కాపీ అయింది!' },
}

/** @param {{ city: string, aqi: number | null, actions: string[], lang?: string }} props */
export default function ShareCard({ city, aqi, actions, lang = 'en' }) {
  const t = T[lang] || T.en
  const band = bandForAqi(aqi)
  const [copied, setCopied] = useState(false)
  const text = `${t.title} — ${city}: AQI ${aqi} (${band.label})\n${t.actions}:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n— via AirWise`

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="card h-full p-5">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><UsersFour size={18} weight="duotone" aria-hidden="true" /> Community card</div>
      <div className="mt-1 text-lg font-semibold">{t.title} — {city}: <span style={{ color: band.color }}>AQI {aqi} ({band.label})</span></div>
      <div className="mt-2 text-sm font-medium">{t.actions}</div>
      <ol className="ml-5 list-decimal text-sm text-slate-700">{actions.map((a) => <li key={a}>{a}</li>)}</ol>
      <div className="mt-4 flex gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"><WhatsappLogo size={18} weight="fill" aria-hidden="true" />{t.share}</a>
        <button onClick={copy} className="btn btn-ghost px-3 py-2 text-sm">{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? t.copied : t.copy}</button>
      </div>
    </div>
  )
}
