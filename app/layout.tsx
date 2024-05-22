import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PrimeReactProvider } from 'primereact/api'
import { Toaster } from '@/components/ui/toaster'
import 'primereact/resources/themes/lara-light-cyan/theme.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sitetracker skunkworks CV Analyzer',
  description: 'Upload and vet images for items that should be present.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PrimeReactProvider>
      <html lang="en" className="light">
        <body className={inter.className}>{children}</body>
        <Toaster />
      </html>
    </PrimeReactProvider>
  )
}
