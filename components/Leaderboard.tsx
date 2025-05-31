'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerStats } from '@/types/database'
import { useAuth } from '@/lib/auth-context'
import FireAnimation from './FireAnimation'

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  requirement_type: string
  requirement_value: number
}

interface PlayerAchievement {
  id: string
  player_id: string
  achievement_id: string
  achieved_at: string
  achievement: Achievement
}

interface LeaderboardProps {
  onPlayerClick?: (playerId: string) => void
}

export default function Leaderboard({ onPlayerClick }: LeaderboardProps) {
  const { user } = useAuth()
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .order('rating', { ascending: false })

      if (error) throw error

      // Get last match rating change and active achievement for each player
      const playersWithLastChange = await Promise.all(
        (data || []).map(async (player) => {
          // Get the most recent match for this player
          const { data: lastMatch } = await supabase
            .from('matches')
            .select('*')
            .or(`team1_player1.eq.${player.id},team1_player2.eq.${player.id},team2_player1.eq.${player.id},team2_player2.eq.${player.id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          // Get the active achievement for this player (if any)
          let activeAchievement = null
          if (player.active_achievement_id) {
            const { data: activeAchievementData } = await supabase
              .from('player_achievements')
              .select(`
                *,
                achievement:achievements(*)
              `)
              .eq('player_id', player.id)
              .eq('achievement_id', player.active_achievement_id)
              .single()
            
            activeAchievement = activeAchievementData
          }

          // Get the most recent monthly award for this player
          const { data: recentMonthlyAward } = await supabase
            .from('monthly_awards')
            .select('*')
            .eq('player_id', player.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          let lastRatingChange = 0
          if (lastMatch && lastMatch.total_rating_change) {
            // Try to get the actual rating change for this player from match_player_ratings
            const { data: ratingChangeData } = await supabase
              .from('match_player_ratings')
              .select('rating_change')
              .eq('match_id', lastMatch.id)
              .eq('player_id', player.id)
              .single()

            if (ratingChangeData) {
              // Use actual rating change
              lastRatingChange = ratingChangeData.rating_change
            } else {
              // Fall back to estimation if rating change data not available
              const is1vs1 = lastMatch.game_mode === 'duel'
              const isWinner = (
                (lastMatch.team1_player1 === player.id || (lastMatch.team1_player2 === player.id && lastMatch.team1_player2 !== null)) 
                ? lastMatch.team1_score > lastMatch.team2_score 
                : lastMatch.team2_score > lastMatch.team1_score
              )
              const divisor = is1vs1 ? 2 : 4
              const avgChange = Math.abs(lastMatch.total_rating_change) / divisor
              lastRatingChange = isWinner ? Math.round(avgChange) : -Math.round(avgChange)
            }
          }

          const totalMatches = player.wins + player.losses
          const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0

          return {
            ...player,
            win_ratio: winRate,
            total_matches: totalMatches,
            last_rating_change: lastRatingChange,
            active_achievement: activeAchievement || null,
            recent_monthly_award: recentMonthlyAward || null
          }
        })
      )

      setPlayers(playersWithLastChange)
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (position: number) => {
    if (position === 1) return (
      <span className="text-yellow-400 text-xl">👑</span>
    )
    return <span className="text-slate-400 font-bold text-sm">#{position}</span>
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500'
    if (rank === 2) return 'bg-gray-400' 
    if (rank === 3) return 'bg-orange-500'
    return 'bg-slate-600'
  }

  const getMonthlyAwardDisplay = (awardType: string) => {
    switch (awardType) {
      case 'player_of_month':
        return { icon: '🏆', name: 'Player of Month', color: 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30' }
      case 'crawler_of_month':
        return { icon: '🐛', name: 'Crawler of Month', color: 'text-red-400 bg-red-400/20 border-red-400/30' }
      case 'most_active':
        return { icon: '⚡', name: 'Most Active', color: 'text-blue-400 bg-blue-400/20 border-blue-400/30' }
      case 'game_of_month':
        return { icon: '🎯', name: 'Game of Month', color: 'text-green-400 bg-green-400/20 border-green-400/30' }
      default:
        return { icon: '🏅', name: 'Award', color: 'text-gray-400 bg-gray-400/20 border-gray-400/30' }
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2 text-white">
          <Trophy className="text-[#e51f5c]" />
          Leaderboard
        </h2>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card py-4">
            <div className="animate-pulse">
              <div className="h-16 bg-white/10 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2 text-white">
        <Trophy className="text-[#e51f5c]" />
        Leaderboard
      </h2>

      {players.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">Nog geen spelers</p>
          <p className="text-slate-500 text-sm mt-2">Voeg spelers toe om te beginnen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player, index) => {
            // Check if this is the current user's player card
            const isCurrentUser = user && player.name.toLowerCase() === user.name.toLowerCase()
            
            return (
              <button
                key={player.id}
                onClick={() => onPlayerClick?.(player.id)}
                className={`card group transition-all duration-200 w-full text-left hover:bg-white/5 hover:border-white/20 ${
                  index === 0 
                    ? 'border-yellow-400/50 bg-gradient-to-r from-yellow-400/5 to-orange-400/5 shadow-lg shadow-yellow-400/10' 
                    : ''
                } ${
                  isCurrentUser
                    ? 'border-blue-400/50 bg-gradient-to-r from-blue-400/10 to-purple-400/10 shadow-lg shadow-blue-400/20'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-6 sm:w-8">
                      {getRankIcon(index + 1)}
                    </div>

                    {/* Player Photo */}
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt={player.name}
                        className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg object-cover border-2 ${
                          isCurrentUser ? 'border-blue-400/50' : 'border-white/10'
                        }`}
                      />
                    ) : (
                      <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg ${
                        isCurrentUser ? 'bg-blue-500' : 'bg-[#e51f5c]'
                      } flex items-center justify-center text-white font-bold text-sm sm:text-lg`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                        <h3 className={`font-bold text-base sm:text-lg truncate ${
                          isCurrentUser ? 'text-blue-400' : 'text-white'
                        }`}>
                          {player.name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-400/30">
                              JIJ
                            </span>
                          )}
                        </h3>
                        
                        {/* Badges container - stack on mobile */}
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {/* Active achievement tag */}
                          {player.active_achievement && player.active_achievement.achievement && (
                            <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-purple-500/20 border border-purple-400/30">
                              <span className="text-xs">{player.active_achievement.achievement.icon}</span>
                              <span className="text-xs font-bold text-purple-400 hidden sm:inline">
                                {player.active_achievement.achievement.name}
                              </span>
                            </div>
                          )}

                          {/* Most recent monthly award tag */}
                          {player.recent_monthly_award && (
                            (() => {
                              const awardDisplay = getMonthlyAwardDisplay(player.recent_monthly_award.award_type)
                              return (
                                <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md border ${awardDisplay.color}`}>
                                  <span className="text-xs">{awardDisplay.icon}</span>
                                  <span className="text-xs font-bold hidden sm:inline">
                                    {awardDisplay.name}
                                  </span>
                                </div>
                              )
                            })()
                          )}
                          
                          {/* Win streak with fire animation (only if >= 3) */}
                          {player.current_win_streak >= 3 && (
                            <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-[#e51f5c]/20 border border-[#e51f5c]/30">
                              <FireAnimation size="small" />
                              <span className="text-xs font-bold text-[#e51f5c]">
                                {player.current_win_streak}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-6 text-xs sm:text-sm text-slate-400">
                        <span>{player.total_matches} matches</span>
                        <span>{player.wins}W-{player.losses}L</span>
                        <span>{player.win_ratio}% WR</span>
                        <span className="hidden sm:inline">Avg: {player.total_matches > 0 ? (player.goals_scored / player.total_matches).toFixed(1) : '0.0'} goals</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating with last change */}
                  <div className="text-right">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 sm:gap-2">
                      <div className={`text-xl sm:text-2xl font-bold ${
                        isCurrentUser ? 'text-blue-400' : 'text-white'
                      }`}>
                        {player.rating}
                      </div>
                      {/* Last rating change next to rating */}
                      {player.last_rating_change !== 0 && (
                        <div className={`px-1.5 sm:px-2 py-1 rounded-md text-xs font-bold ${
                          player.last_rating_change > 0 
                            ? 'text-green-400 bg-green-400/20 border border-green-400/30' 
                            : 'text-red-400 bg-red-400/20 border border-red-400/30'
                        }`}>
                          {player.last_rating_change > 0 ? '+' : ''}{player.last_rating_change}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
} 