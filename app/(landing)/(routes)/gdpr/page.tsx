import { LandingNavbar } from '@/components/LandingNavbar'
import { LandingHero } from '@/components/LandingHero'
import { BlurFaces } from '@/components/BlurFaces'
const title = 'Sitetracker blur detected faces'
const description = 'detect and blur faces in images'

const GDPRPage = () => {
  return (
    <div className="h-max flex justify-between items-center flex-col overflow-hidden mb-6">
      <div>
        <LandingNavbar />
        <LandingHero title={title} description={description} />
        <div className="px-10 pb-6">
          <div className="flex items-center justify-center">
            <BlurFaces />
          </div>
        </div>
      </div>
    </div>
  )
}
export default GDPRPage
