'use client'

import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

const font = Montserrat({ weight: '600', subsets: ['latin'] })

const navigation = [
  { href: '/rag', label: 'RAG' },
  { href: '/translations', label: 'Translations' },
  { href: '/gdpr', label: 'GDPR' },
  { href: '/validation-tool', label: 'Validation Tool' },
]

export const LandingNavbar = () => {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Close mobile menu when path changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const isActive = (path: string) => {
    return pathname === path
  }

  if (!isMounted) {
    return null
  }

  return (
    <>
      <nav className="sticky top-0 z-50 w-full backdrop-blur-lg bg-black/20 border-b border-white/10">
        <div className="w-full px-6 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className={cn(
                'flex items-center px-4 py-2 rounded-lg transition-colors',
                isActive('/') ? 'bg-white/10' : 'hover:bg-white/5',
                font.className
              )}
            >
              <h1 className="text-2xl font-bold text-white">Sitetracker</h1>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(link.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5',
                    font.className
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-white" />
              ) : (
                <Menu className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out md:hidden',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-6 space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="space-y-2">
            {navigation.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'block px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-blue-600 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5',
                  font.className
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
