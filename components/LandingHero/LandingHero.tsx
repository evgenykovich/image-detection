'use client'

type LandingHeroProps = {
  title: string
  description: string
}

export const LandingHero = ({ title, description }: LandingHeroProps) => {
  return (
    <div className="text-white font-bold py-12 text-center space-y-5">
      <div className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl space-y-5 font-extrabold">
        <h1>{title}</h1>
      </div>
      <div className="text-sm md:text-xl font-light text-zinc-400">
        {description}
      </div>
    </div>
  )
}
