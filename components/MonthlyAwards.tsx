'use client'

import { useState, useEffect } from 'react'
import { Calendar, Star, Target, Users, Zap, Crown, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MonthlyAward, Player, Match } from '@/types/database'

interface MonthlyAwardsData {
  player_of_month?: MonthlyAward & { player: Player }
  crawler_of_month?: MonthlyAward & { player: Player }
  most_active?: MonthlyAward & { player: Player }
  game_of_month?: MonthlyAward & { match: Match }
}

export default function MonthlyAwards() {
  const [awards, setAwards] = useState<MonthlyAwardsData>({})
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchMonthlyAwards()
  }, [selectedMonth, selectedYear])

  const fetchMonthlyAwards = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('monthly_awards')
        .select(`
          *,
          player:players(*),
          match:matches(*)
        `)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)

      if (error) throw error

      const awardsData: MonthlyAwardsData = {}
      
      data?.forEach(award => {
        switch (award.award_type) {
          case 'player_of_month':
            awardsData.player_of_month = award as MonthlyAward & { player: Player }
            break
          case 'crawler_of_month':
            awardsData.crawler_of_month = award as MonthlyAward & { player: Player }
            break
          case 'most_active':
            awardsData.most_active = award as MonthlyAward & { player: Player }
            break
          case 'game_of_month':
            awardsData.game_of_month = award as MonthlyAward & { match: Match }
            break
        }
      })

      setAwards(awardsData)
    } catch (error) {
      console.error('Error fetching monthly awards:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMonthName = (month: number) => {
    const months = [
      'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
      'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
    ]
    return months[month - 1]
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedMonth(12)
        setSelectedYear(selectedYear - 1)
      } else {
        setSelectedMonth(selectedMonth - 1)
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1)
        setSelectedYear(selectedYear + 1)
      } else {
        setSelectedMonth(selectedMonth + 1)
      }
    }
  }

  const renderPlayerAvatar = (player: Player) => {
    if (player.photo_url) {
      return (
        <img
          src={player.photo_url}
          alt={player.name}
          className="w-16 h-16 rounded-full object-cover"
        />
      )
    }
    
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
        {player.name.charAt(0).toUpperCase()}
      </div>
    )
  }

  const renderAwardCard = (
    title: string,
    icon: React.ReactNode,
    award: MonthlyAward & { player?: Player; match?: Match },
    color: string,
    bgColor: string
  ) => {
    if (!award) {
      return (
        <div className="card text-center py-8">
          <div className={`mx-auto mb-4 ${color} opacity-50`}>
            {icon}
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-400">Geen winnaar deze maand</p>
        </div>
      )
    }

    return (
      <div className={`card relative overflow-hidden group hover:scale-[1.02] transition-transform`}>
        {/* Background gradient */}
        <div className={`absolute inset-0 ${bgColor} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
        
        <div className="relative z-10 text-center">
          <div className={`mx-auto mb-4 ${color}`}>
            {icon}
          </div>
          
          <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
          
          {award.player && (
            <div className="flex flex-col items-center gap-3">
              {renderPlayerAvatar(award.player)}
              <div>
                <h4 className="text-xl font-bold text-white">{award.player.name}</h4>
                {award.description && (
                  <p className="text-sm text-slate-300 mt-1">{award.description}</p>
                )}
                {award.value && (
                  <div className={`text-2xl font-bold ${color} mt-2`}>
                    {award.value}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {award.match && (
            <div className="text-center">
              <p className="text-slate-300 mb-2">Meest intense wedstrijd</p>
              <div className={`text-2xl font-bold ${color}`}>
                Rating impact: {award.value}
              </div>
              {award.description && (
                <p className="text-sm text-slate-400 mt-2">{award.description}</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="text-yellow-400" />
            Maandelijkse Awards
          </h2>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="animate-pulse">
                <div className="h-8 bg-white/10 rounded mb-4"></div>
                <div className="h-32 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Star className="text-yellow-400" />
          Maandelijkse Awards
        </h2>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="btn-secondary p-2"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">
              {getMonthName(selectedMonth)} {selectedYear}
            </h3>
          </div>
          
          <button
            onClick={() => navigateMonth('next')}
            className="btn-secondary p-2"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Awards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {renderAwardCard(
          'Player of the Month',
          <Crown size={32} />,
          awards.player_of_month!,
          'text-yellow-400',
          'bg-gradient-to-br from-yellow-500 to-orange-500'
        )}
        
        {renderAwardCard(
          'Crawler of the Month',
          <Target size={32} />,
          awards.crawler_of_month!,
          'text-red-400',
          'bg-gradient-to-br from-red-500 to-pink-500'
        )}
        
        {renderAwardCard(
          'Most Active Player',
          <Users size={32} />,
          awards.most_active!,
          'text-green-400',
          'bg-gradient-to-br from-green-500 to-emerald-500'
        )}
        
        {renderAwardCard(
          'Game of the Month',
          <Zap size={32} />,
          awards.game_of_month!,
          'text-purple-400',
          'bg-gradient-to-br from-purple-500 to-indigo-500'
        )}
      </div>

      {/* Info Section */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Award Criteria</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-yellow-400 mb-2">Player of the Month</h4>
            <p className="text-sm text-slate-300">Speler met de grootste rating groei deze maand</p>
          </div>
          <div>
            <h4 className="font-semibold text-red-400 mb-2">Crawler of the Month</h4>
            <p className="text-sm text-slate-300">Speler die het vaakst heeft moeten kruipen (10-0 of 10-1 verlies)</p>
          </div>
          <div>
            <h4 className="font-semibold text-green-400 mb-2">Most Active Player</h4>
            <p className="text-sm text-slate-300">Speler die de meeste wedstrijden heeft gespeeld</p>
          </div>
          <div>
            <h4 className="font-semibold text-purple-400 mb-2">Game of the Month</h4>
            <p className="text-sm text-slate-300">Wedstrijd met de grootste rating impact</p>
          </div>
        </div>
      </div>
    </div>
  )
} 