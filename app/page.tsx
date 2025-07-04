'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Leaderboard from '@/components/Leaderboard'
import PlayerDetail from '@/components/PlayerDetail'
import Dashboard from '@/components/Dashboard'
import Login from '@/components/Login'
import UserProfile from '@/components/UserProfile'
import UserManagement from '@/components/UserManagement'
import MonthlyAwardsAdmin from '@/components/MonthlyAwardsAdmin'

type View = 'main' | 'player-detail' | 'dashboard' | 'profile' | 'user-management' | 'monthly-awards-admin'

export default function Home() {
  const { user, isLoading } = useAuth()
  const searchParams = useSearchParams()
  const [currentView, setCurrentView] = useState<View>('main')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')

  useEffect(() => {
    // Check URL parameters
    const view = searchParams.get('view')
    if (view === 'dashboard') {
      setCurrentView('dashboard')
    } else if (view === 'profile') {
      setCurrentView('profile')
    } else if (view === 'user-management') {
      setCurrentView('user-management')
    } else {
      // If no view parameter or different view, reset to main
      setCurrentView('main')
    }

    // Listen for events from navigation
    const handleShowDashboard = () => {
      setCurrentView('dashboard')
    }

    const handleShowLeaderboard = () => {
      setCurrentView('main')
    }

    const handleShowProfile = () => {
      setCurrentView('profile')
    }

    const handleShowUserManagement = () => {
      setCurrentView('user-management')
    }

    const handleShowMonthlyAwardsAdmin = () => {
      setCurrentView('monthly-awards-admin')
    }

    window.addEventListener('showDashboard', handleShowDashboard)
    window.addEventListener('showLeaderboard', handleShowLeaderboard)
    window.addEventListener('showProfile', handleShowProfile)
    window.addEventListener('showUserManagement', handleShowUserManagement)
    window.addEventListener('showMonthlyAwardsAdmin', handleShowMonthlyAwardsAdmin)
    
    return () => {
      window.removeEventListener('showDashboard', handleShowDashboard)
      window.removeEventListener('showLeaderboard', handleShowLeaderboard)
      window.removeEventListener('showProfile', handleShowProfile)
      window.removeEventListener('showUserManagement', handleShowUserManagement)
      window.removeEventListener('showMonthlyAwardsAdmin', handleShowMonthlyAwardsAdmin)
    }
  }, [searchParams])

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayerId(playerId)
    setCurrentView('player-detail')
  }

  const handleBackToMain = () => {
    setCurrentView('main')
    setSelectedPlayerId('')
    // Dispatch event to update navigation
    window.dispatchEvent(new CustomEvent('showLeaderboard'))
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card">
          <p className="text-white">Laden...</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />
  }

  const renderContent = () => {
    if (currentView === 'player-detail' && selectedPlayerId) {
      return <PlayerDetail playerId={selectedPlayerId} onBack={handleBackToMain} />
    }
    if (currentView === 'dashboard') {
      return <Dashboard />
    }
    if (currentView === 'profile') {
      return <UserProfile />
    }
    if (currentView === 'user-management') {
      return <UserManagement />
    }
    if (currentView === 'monthly-awards-admin') {
      return <MonthlyAwardsAdmin />
    }
    return <Leaderboard onPlayerClick={handlePlayerClick} />
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-4xl mx-auto py-10 px-4">
        {/* Content */}
        <div className="animate-fade-in">
          {renderContent()}
        </div>
      </div>
    </div>
  )
} 