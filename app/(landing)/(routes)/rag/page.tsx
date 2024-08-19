import { LandingNavbar } from '@/components/LandingNavbar'
import { LandingHero } from '@/components/LandingHero'
import { UploadPDF } from '@/components/UploadPDF'

const RagPage = () => {
  return (
    <div className="h-max flex justify-between items-center flex-col overflow-hidden mb-6">
      <div>
        <LandingNavbar />
        <LandingHero />
        <div className="px-10 pb-6">
          <div className="flex items-center justify-center">
            <UploadPDF />
          </div>
        </div>
      </div>
    </div>
  )
}
export default RagPage
