'use client'

import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const font = Montserrat({ weight: '600', subsets: ['latin'] })

export const LandingNavbar = () => {
  return (
    <nav className="p-4 bg-transparent flex items-center justify-start">
      <Link href="/" className="flex items-center">
        <h1 className={cn('text-2xl font-bold text-white', font.className)}>
          Sitetracker
        </h1>
      </Link>
      <Link href="/rag" className="flex items-center ml-4">
        <h1 className={cn('text-2xl font-bold text-white', font.className)}>
          RAG
        </h1>
      </Link>
    </nav>
  )
}
