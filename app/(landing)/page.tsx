import { LandingNavbar } from '@/components/LandingNavbar'
import { LandingHero } from '@/components/LandingHero'
import { LandingContent } from '@/components/LandingContent'
import { AISelector } from '@/components/AISelector'
const title = 'Sitetracker skunkworks CV Analyzer'
const description =
  'upload an image and we write the items that need to be there, we will detect if the items are there'

const LandingPage = async () => {
  return (
    <div className="h-max flex justify-between items-center flex-col overflow-hidden mb-6">
      <div>
        <LandingNavbar />
        <LandingHero title={title} description={description} />
        <LandingContent />
      </div>
      <div>
        <AISelector />
      </div>
    </div>
  )
}

export default LandingPage
