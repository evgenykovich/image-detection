import { LandingNavbar } from '@/components/LandingNavbar'
import { LandingHero } from '@/components/LandingHero'

interface PageLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export const PageLayout = ({
  title,
  description,
  children,
}: PageLayoutProps) => {
  return (
    <div className="h-max flex justify-between items-center flex-col overflow-hidden mb-6">
      <div>
        <LandingNavbar />
        <LandingHero title={title} description={description} />
        <div className="px-10 pb-6">
          <div className="flex items-center justify-center">{children}</div>
        </div>
      </div>
    </div>
  )
}
