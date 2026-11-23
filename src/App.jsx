import { Component, lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AirwiseProvider, useAir, useProfile } from './context/AirwiseContext.jsx'
import Layout from './components/Layout.jsx'
import { ErrorBanner } from './components/ui.jsx'
import { Spinner } from './components/ui.jsx'

// Each menu screen is its own chunk, so Recharts only loads on the screens that draw a chart.
const Overview = lazy(() => import('./pages/Overview.jsx'))
const Forecast = lazy(() => import('./pages/Forecast.jsx'))
const Routine = lazy(() => import('./pages/Routine.jsx'))
const Indoor = lazy(() => import('./pages/Indoor.jsx'))
const Swaps = lazy(() => import('./pages/Swaps.jsx'))
const Exposure = lazy(() => import('./pages/Exposure.jsx'))
const Chat = lazy(() => import('./pages/Chat.jsx'))
const Inspector = lazy(() => import('./pages/Inspector.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))

class ErrorBoundary extends Component {
  /** @type {{ error: Error | null }} */
  state = { error: null }
  /** @param {Error} error */
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return <ErrorBanner message={`This view hit an error: ${this.state.error.message}`} onRetry={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

function Home() {
  const { air } = useAir()
  const { profileSaved } = useProfile()
  return <Navigate to={air && profileSaved ? '/overview' : '/profile'} replace />
}

export default function App() {
  return (
    <AirwiseProvider>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<Spinner label="Loading…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/routine" element={<Routine />} />
            <Route path="/indoor" element={<Indoor />} />
            <Route path="/swaps" element={<Swaps />} />
            <Route path="/exposure" element={<Exposure />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/inspector" element={<Inspector />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
            <Route path="/plan" element={<Navigate to="/routine" replace />} />
            <Route path="/onboarding" element={<Navigate to="/profile" replace />} />
            <Route path="*" element={<Home />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </AirwiseProvider>
  )
}
