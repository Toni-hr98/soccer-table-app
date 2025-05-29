'use client'

import { useState, useEffect } from 'react'
import { Award, Lock, CheckCircle, Star, Zap, Trophy, TrendingUp, Target, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Achievement, PlayerAchievement, Player } from '@/types/database'

interface AchievementWithProgress extends Achievement {
  earned_by: Player[]
  total_earned: number
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    fetchAchievements()
  }, [])

  const fetchAchievements = async () => {
    try {
      const [achievementsResult, playerAchievementsResult, playersResult] = await Promise.all([
        supabase.from('achievements').select('*').order('category, requirement_value'),
        supabase.from('player_achievements').select('*'),
        supabase.from('players').select('*')
      ])

      if (achievementsResult.error) throw achievementsResult.error
      if (playerAchievementsResult.error) throw playerAchievementsResult.error
      if (playersResult.error) throw playersResult.error

      const allAchievements = achievementsResult.data || []
      const playerAchievements = playerAchievementsResult.data || []
      const players = playersResult.data || []

      const achievementsWithProgress: AchievementWithProgress[] = allAchievements.map(achievement => {
        const earnedByPlayerIds = playerAchievements
          .filter(pa => pa.achievement_id === achievement.id)
          .map(pa => pa.player_id)
        
        const earnedByPlayers = players.filter(p => earnedByPlayerIds.includes(p.id))

        return {
          ...achievement,
          earned_by: earnedByPlayers,
          total_earned: earnedByPlayers.length
        }
      })

      setAchievements(achievementsWithProgress)
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    { id: 'all', label: 'Alle', icon: Award },
    { id: 'milestone', label: 'Mijlpalen', icon: Star },
    { id: 'streak', label: 'Streaks', icon: Zap },
    { id: 'rating', label: 'Rating', icon: TrendingUp },
    { id: 'games', label: 'Wedstrijden', icon: Trophy },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'special', label: 'Speciaal', icon: Crown },
  ]

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory)

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'milestone': return 'from-blue-500 to-cyan-500'
      case 'streak': return 'from-yellow-500 to-orange-500'
      case 'rating': return 'from-green-500 to-emerald-500'
      case 'games': return 'from-purple-500 to-indigo-500'
      case 'goals': return 'from-red-500 to-pink-500'
      case 'special': return 'from-gray-500 to-slate-500'
      default: return 'from-blue-500 to-purple-500'
    }
  }

  const getRarityColor = (totalEarned: number, totalPlayers: number) => {
    if (totalPlayers === 0) return 'text-gray-400'
    const percentage = (totalEarned / totalPlayers) * 100
    if (percentage >= 75) return 'text-green-400' // Common
    if (percentage >= 50) return 'text-blue-400' // Uncommon
    if (percentage >= 25) return 'text-purple-400' // Rare
    if (percentage >= 10) return 'text-orange-400' // Epic
    return 'text-red-400' // Legendary
  }

  const getRarityLabel = (totalEarned: number, totalPlayers: number) => {
    if (totalPlayers === 0) return 'Onbekend'
    const percentage = (totalEarned / totalPlayers) * 100
    if (percentage >= 75) return 'Gewoon'
    if (percentage >= 50) return 'Ongewoon'
    if (percentage >= 25) return 'Zeldzaam'
    if (percentage >= 10) return 'Episch'
    return 'Legendarisch'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          <Award className="text-yellow-400" />
          Achievements
        </h2>
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="animate-pulse">
                <div className="h-6 bg-white/10 rounded mb-2"></div>
                <div className="h-4 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const totalPlayers = achievements.length > 0 ? 
    Array.from(new Set(achievements.flatMap(a => a.earned_by.map(p => p.id)))).length : 0

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
        <Award className="text-yellow-400" />
        Achievements ({achievements.length})
      </h2>

      {/* Category Filter */}
      <div className="glass p-2 rounded-2xl">
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={16} className="mb-1" />
                <span className="text-xs font-medium">{category.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid gap-4">
        {filteredAchievements.map((achievement) => (
          <div
            key={achievement.id}
            className="card relative overflow-hidden group hover:scale-[1.01] transition-transform"
          >
            {/* Background gradient based on category */}
            <div className={`absolute inset-0 bg-gradient-to-r ${getCategoryColor(achievement.category)} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl">
                  {achievement.icon}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">
                      {achievement.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full bg-black/20 ${getRarityColor(achievement.total_earned, totalPlayers)}`}>
                      {getRarityLabel(achievement.total_earned, totalPlayers)}
                    </span>
                  </div>
                  
                  <p className="text-slate-300 text-sm mb-2">
                    {achievement.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle size={12} />
                      {achievement.total_earned} spelers
                    </span>
                    <span className="capitalize">
                      {achievement.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400 mb-2">
                  {achievement.total_earned > 0 ? (
                    <CheckCircle className="text-green-400" size={32} />
                  ) : (
                    <Lock className="text-slate-500" size={32} />
                  )}
                </div>
                
                {achievement.total_earned > 0 && (
                  <div className="text-xs text-slate-400">
                    {Math.round((achievement.total_earned / Math.max(totalPlayers, 1)) * 100)}% behaald
                  </div>
                )}
              </div>
            </div>

            {/* Players who earned this achievement */}
            {achievement.earned_by.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-slate-400 mb-2">Behaald door:</p>
                <div className="flex flex-wrap gap-2">
                  {achievement.earned_by.slice(0, 5).map((player) => (
                    <div key={player.id} className="flex items-center gap-1 bg-black/20 rounded-full px-2 py-1">
                      {player.photo_url ? (
                        <img
                          src={player.photo_url}
                          alt={player.name}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-slate-300">{player.name}</span>
                    </div>
                  ))}
                  {achievement.earned_by.length > 5 && (
                    <span className="text-xs text-slate-400 px-2 py-1">
                      +{achievement.earned_by.length - 5} meer
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="card text-center py-12">
          <Award className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">Geen achievements in deze categorie</p>
        </div>
      )}
    </div>
  )
} 