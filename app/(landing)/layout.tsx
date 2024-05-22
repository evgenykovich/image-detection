import React, { ReactNode } from 'react'

interface LandingLayoutProps {
  children: ReactNode
}

const LandingLayout = ({ children }: LandingLayoutProps) => {
  return (
    <main className="h-full bg-[#111827] overflow-auto min-h-[100vh]">
      <div className="mx-auto max-w-screen-xl h-full w-full">{children}</div>
    </main>
  )
}

export default LandingLayout
