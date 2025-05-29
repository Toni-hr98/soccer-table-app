'use client'

import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import NewMatch from '@/components/NewMatch'
import MatchHistory from '@/components/MatchHistory'
import Login from '@/components/Login'

export default function MatchesPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [showAddMatch, setShowAddMatch] = useState(false)

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e51f5c]"></div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />
  }

  if (showAddMatch) {
    return (
      <div className="min-h-screen pb-16">
        <div className="max-w-4xl mx-auto py-10 px-4">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => setShowAddMatch(false)}
              className="btn-secondary p-2"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-white">Nieuwe Wedstrijd</h1>
          </div>
          <NewMatch onSuccess={() => setShowAddMatch(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-4xl mx-auto py-10 px-4">
        {/* Header with Add Match Button */}
        <div className="flex sm:flex-row flex-col items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white sm:mb-0 mb-4 sm:block hidden">Wedstrijd Historie</h1>
          
          <button
            onClick={() => setShowAddMatch(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Nieuwe Wedstrijd
          </button>
        </div>

        {/* Match History */}
        <MatchHistory />
      </div>
    </div>
  )
} 