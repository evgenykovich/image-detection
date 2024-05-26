'use client'

import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const font = Montserrat({ weight: '600', subsets: ['latin'] })

export const LandingNavbar = () => {
  return (
    <nav className="p-4 bg-transparent flex items-center justify-between">
      <Link href="/" className="flex items-center">
        <h1 className={cn('text-2xl font-bold text-white', font.className)}>
          Sitetracker skunkworks CV Analyzer
        </h1>
      </Link>
    </nav>
  )
}
