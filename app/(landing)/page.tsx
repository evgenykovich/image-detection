import { LandingNavbar } from '@/components/LandingNavbar'
import { LandingHero } from '@/components/LandingHero'
import { LandingContent } from '@/components/LandingContent'
import { AISelector } from '@/components/AISelector'

const LandingPage = async () => {
  return (
    <div className="h-max flex justify-between items-center flex-col overflow-hidden mb-6">
      <div>
        <LandingNavbar />
        <LandingHero />
        <LandingContent />
      </div>
      <div>
        <AISelector />
      </div>
    </div>
  )
}

export default LandingPage
