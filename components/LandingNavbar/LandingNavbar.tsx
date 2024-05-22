'use client'

import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const font = Montserrat({ weight: '600', subsets: ['latin'] })

interface LandingNavbarProps {
  hideButton?: boolean
}

export const LandingNavbar = ({ hideButton = false }: LandingNavbarProps) => {
  return (
    <nav className="p-4 bg-transparent flex items-center justify-between">
      <Link href="/" className="flex items-center">
        <h1 className={cn('text-2xl font-bold text-white', font.className)}>
          Detect Items in Image
        </h1>
      </Link>
    </nav>
  )
}
