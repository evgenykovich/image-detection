import { LandingNavbar } from '@/components/LandingNavbar'
import { LandingHero } from '@/components/LandingHero'
import { TranslateComponent } from '@/components/TranslateComponent'
const title = 'Sitetracker skunkworks Translations'
const description = 'upload a glossary file to translate to and from'

const TranslationsPage = () => {
  return (
    <div className="h-max flex justify-between items-center flex-col overflow-hidden mb-6">
      <div>
        <LandingNavbar />
        <LandingHero title={title} description={description} />
        <div className="px-10 pb-6">
          <div className="flex items-center justify-center">
            <TranslateComponent />
          </div>
        </div>
      </div>
    </div>
  )
}
export default TranslationsPage
