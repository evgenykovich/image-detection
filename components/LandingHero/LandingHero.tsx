'use client'

export const LandingHero = () => {
  return (
    <div className="text-white font-bold py-12 text-center space-y-5">
      <div className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl space-y-5 font-extrabold">
        <h1>Detect Items in Image</h1>
      </div>
      <div className="text-sm md:text-xl font-light text-zinc-400">
        upload an image and we write the items that need to be there, we will
        detect if the items are there
      </div>
    </div>
  )
}
