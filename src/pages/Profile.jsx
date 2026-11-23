import { useNavigate } from 'react-router-dom'
import { MapPin, UserCircleGear, ArrowCounterClockwise } from '@phosphor-icons/react'
import CitySearch from '../components/CitySearch.jsx'
import ProfileForm from '../components/ProfileForm.jsx'
import { Panel, InfoBanner } from '../components/ui.jsx'
import { useAir, useProfile } from '../context/AirwiseContext.jsx'

export default function Profile() {
  const { profile, profileSaved, updateProfile, resetProfile } = useProfile()
  const { place, air } = useAir()
  const navigate = useNavigate()

  /** @param {import('../lib/types.js').Profile} p */
  function save(p) {
    updateProfile({ ...p, city: place?.name || p.city })
    if (place && air) navigate('/overview')
  }

  return (
    <div className="space-y-5">
      {!profileSaved && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-2xl font-bold sm:text-3xl">Breathe smarter through smog season.</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            AirWise reads live air quality for your city, learns your family's routine, and uses Gemini to plan a low-exposure,
            low-emission day, with the impact of every choice in numbers.
          </p>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel icon={MapPin} title="Your city" subtitle="Live AQI + 48h forecast" className="h-fit">
          <CitySearch />
          {place && air && <p className="mt-3 text-sm font-medium text-emerald-700" role="status">Loaded {place.name}: AQI {air.current.aqi}</p>}
        </Panel>
        <Panel
          className="lg:col-span-2"
          icon={UserCircleGear}
          title="Household & lifestyle"
          subtitle="Tailors every recommendation. Stored only in this browser."
          right={profileSaved && <button onClick={resetProfile} className="btn btn-ghost px-3 py-1.5 text-sm"><ArrowCounterClockwise size={16} aria-hidden="true" />Reset</button>}
        >
          {profileSaved && place && air && <div className="mb-4"><InfoBanner tone="sky">Saved profile in use. Edit and save to regenerate your plan.</InfoBanner></div>}
          <ProfileForm key={profileSaved ? 'saved' : 'new'} initial={profile} onSave={save} submitText={place && air ? 'Save & open dashboard' : 'Save profile'} />
          {!place && <p className="mt-2 text-sm text-muted-foreground">Search your city first to open the dashboard.</p>}
        </Panel>
      </div>
    </div>
  )
}
