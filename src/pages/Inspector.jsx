import PromptPanel from '../components/PromptPanel.jsx'
import { RequireAir, RequirePlan } from '../components/Gates.jsx'

export default function Inspector() {
  return (
    <RequireAir>
      <RequirePlan>
        {({ advice }) => (
          <>
            <p className="text-muted-foreground">
              The exact prompt AirWise sent to Gemini for your plan (live AQI, forecast, profile and computed impacts),
              and the raw JSON it returned. Change your city or profile and the prompt and response change too.
            </p>
            <PromptPanel prompt={advice.prompt} raw={advice.raw} source={advice.source} cached={advice.cached} error={advice.error} defaultOpen />
          </>
        )}
      </RequirePlan>
    </RequireAir>
  )
}
