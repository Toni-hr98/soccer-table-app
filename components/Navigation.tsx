'use client'

import { useState, useEffect } from 'react'
import { Trophy, Plus, BarChart3, User } from 'lucide-react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Navigation() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'match' | 'more' | 'profile'>('leaderboard')

  const tabs = [
    { id: 'leaderboard' as const, icon: Trophy },
    { id: 'match' as const, icon: Plus },
    { id: 'more' as const, icon: BarChart3 },
    { id: 'profile' as const, icon: User },
  ]

  useEffect(() => {
    // Set active tab based on current pathname and search params
    if (pathname === '/') {
      const view = searchParams.get('view')
      if (view === 'dashboard') {
        setActiveTab('more')
      } else if (view === 'profile') {
        setActiveTab('profile')
      } else {
        setActiveTab('leaderboard')
      }
    } else if (pathname === '/matches') {
      setActiveTab('match')
    } else if (pathname.includes('/admin')) {
      setActiveTab('more')
    }
  }, [pathname, searchParams])

  useEffect(() => {
    // Listen for dashboard view changes from the main page
    const handleShowDashboard = () => {
      setActiveTab('more')
    }

    const handleShowLeaderboard = () => {
      setActiveTab('leaderboard')
    }

    const handleShowProfile = () => {
      setActiveTab('profile')
    }

    window.addEventListener('showDashboard', handleShowDashboard)
    window.addEventListener('showLeaderboard', handleShowLeaderboard)
    window.addEventListener('showProfile', handleShowProfile)
    
    return () => {
      window.removeEventListener('showDashboard', handleShowDashboard)
      window.removeEventListener('showLeaderboard', handleShowLeaderboard)
      window.removeEventListener('showProfile', handleShowProfile)
    }
  }, [])

  const handleTabClick = (tabId: 'leaderboard' | 'match' | 'more' | 'profile') => {
    setActiveTab(tabId)
    
    if (tabId === 'leaderboard') {
      // Clear any view parameters and go to main page
      router.push('/')
      // Also dispatch event to ensure immediate state update
      window.dispatchEvent(new CustomEvent('showLeaderboard'))
    } else if (tabId === 'match') {
      router.push('/matches')
    } else if (tabId === 'more') {
      // Navigate to the main page but trigger the dashboard view
      if (pathname !== '/') {
        router.push('/?view=dashboard')
      } else {
        // We're already on the main page, trigger a custom event
        window.dispatchEvent(new CustomEvent('showDashboard'))
      }
    } else if (tabId === 'profile') {
      // Navigate to the main page but trigger the profile view
      if (pathname !== '/') {
        router.push('/?view=profile')
      } else {
        // We're already on the main page, trigger a custom event
        window.dispatchEvent(new CustomEvent('showProfile'))
      }
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1a2631]/80 backdrop-blur-md border-t border-white/10 px-6 py-3 z-50">
      <div className="flex justify-center gap-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`p-3 rounded-lg transition-all duration-200 relative ${
              activeTab === tab.id
                ? 'bg-[#e51f5c] text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-6 h-6" />
            {tab.id === 'profile' && user && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-[#1a2631]" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
} 