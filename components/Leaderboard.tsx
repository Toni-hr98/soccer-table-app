'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerStats } from '@/types/database'
import { useAuth } from '@/lib/auth-context'
import FireAnimation from './FireAnimation'

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

      // Get last match rating change for each player
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

          let lastRatingChange = 0
          if (lastMatch && lastMatch.total_rating_change) {
            // Use the actual stored rating change from the match
            const isWinner = (
              (lastMatch.team1_player1 === player.id || lastMatch.team1_player2 === player.id) 
              ? lastMatch.team1_score > lastMatch.team2_score 
              : lastMatch.team2_score > lastMatch.team1_score
            )
            // Calculate the individual rating change based on total rating change
            // This is a simplified calculation - in reality you'd want to store individual changes
            const avgChange = Math.abs(lastMatch.total_rating_change) / 4
            lastRatingChange = isWinner ? Math.round(avgChange) : -Math.round(avgChange)
          }

          const totalMatches = player.wins + player.losses
          const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0

          return {
            ...player,
            win_ratio: winRate,
            total_matches: totalMatches,
            last_rating_change: lastRatingChange
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
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index + 1)}
                    </div>

                    {/* Player Photo */}
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt={player.name}
                        className={`w-14 h-14 rounded-lg object-cover border-2 ${
                          isCurrentUser ? 'border-blue-400/50' : 'border-white/10'
                        }`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-lg ${
                        isCurrentUser ? 'bg-blue-500' : 'bg-[#e51f5c]'
                      } flex items-center justify-center text-white font-bold text-lg`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Player Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`font-bold text-lg ${
                          isCurrentUser ? 'text-blue-400' : 'text-white'
                        }`}>
                          {player.name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-400/30">
                              JIJ
                            </span>
                          )}
                        </h3>
                        
                        {/* Win streak with fire animation (only if >= 3) */}
                        {player.current_win_streak >= 3 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#e51f5c]/20 border border-[#e51f5c]/30">
                            <FireAnimation size="small" />
                            <span className="text-xs font-bold text-[#e51f5c]">
                              {player.current_win_streak}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-6 text-sm text-slate-400">
                        <span>{player.total_matches} matches</span>
                        <span>{player.wins}W-{player.losses}L</span>
                        <span>{player.win_ratio}% WR</span>
                        <span>Goal ratio: {player.goals_conceded > 0 ? (player.goals_scored / player.goals_conceded).toFixed(2) : player.goals_scored}</span>
                        {player.crawls > 0 && (
                          <span className="text-[#e51f5c]">{player.crawls} crawls</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rating with last change */}
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className={`text-2xl font-bold ${
                        isCurrentUser ? 'text-blue-400' : 'text-white'
                      }`}>
                        {player.rating}
                      </div>
                      {/* Last rating change next to rating */}
                      {player.last_rating_change !== 0 && (
                        <div className={`px-2 py-1 rounded-md text-xs font-bold ${
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