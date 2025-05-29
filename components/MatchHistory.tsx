'use client'

import { useState, useEffect } from 'react'
import { History, Users, Trophy, Zap, AlertTriangle, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Match, Player } from '@/types/database'

interface MatchWithPlayers extends Match {
  team1_player1_data: Player
  team1_player2_data: Player
  team2_player1_data: Player
  team2_player2_data: Player
}

export default function MatchHistory() {
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          team1_player1_data:team1_player1(id, name, photo_url),
          team1_player2_data:team1_player2(id, name, photo_url),
          team2_player1_data:team2_player1(id, name, photo_url),
          team2_player2_data:team2_player2(id, name, photo_url)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMatches(data || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getWinnerTeam = (match: MatchWithPlayers) => {
    return match.team1_score > match.team2_score ? 'team1' : 'team2'
  }

  const getScoreDifference = (match: MatchWithPlayers) => {
    return Math.abs(match.team1_score - match.team2_score)
  }

  const getMatchIntensity = (match: MatchWithPlayers) => {
    const diff = getScoreDifference(match)
    if (diff >= 9) return { label: 'Vernietiging', color: 'text-red-400', bg: 'bg-red-500/20' }
    if (diff >= 7) return { label: 'Dominantie', color: 'text-orange-400', bg: 'bg-orange-500/20' }
    if (diff >= 4) return { label: 'Overtuigend', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    if (diff >= 2) return { label: 'Spannend', color: 'text-blue-400', bg: 'bg-blue-500/20' }
    return { label: 'Thriller', color: 'text-purple-400', bg: 'bg-purple-500/20' }
  }

  const renderPlayerAvatar = (player: Player, size: 'sm' | 'md' = 'sm') => {
    const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-sm'
    
    if (player.photo_url) {
      return (
        <img
          src={player.photo_url}
          alt={player.name}
          className={`${sizeClasses} rounded-lg object-cover border border-white/20`}
        />
      )
    }
    
    return (
      <div className={`${sizeClasses} rounded-lg bg-[#e51f5c] flex items-center justify-center text-white font-bold`}>
        {player.name.charAt(0).toUpperCase()}
      </div>
    )
  }

  const renderTeam = (player1: Player, player2: Player, isWinner: boolean, size: 'sm' | 'md' = 'sm') => {
    return (
      <div className={`flex items-center gap-2 ${isWinner ? 'opacity-100' : 'opacity-70'}`}>
        <div className="flex -space-x-2">
          {renderPlayerAvatar(player1, size)}
          {renderPlayerAvatar(player2, size)}
        </div>
        <div className="flex flex-col">
          <span className={`font-semibold ${isWinner ? 'text-white' : 'text-slate-300'} text-sm`}>
            {player1.name}
          </span>
          <span className={`font-semibold ${isWinner ? 'text-white' : 'text-slate-300'} text-sm`}>
            {player2.name}
          </span>
        </div>
        {isWinner && (
          <Trophy className="text-yellow-400 ml-2" size={16} />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          <History className="text-blue-400" />
          Wedstrijd Historie
        </h2>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card">
            <div className="animate-pulse">
              <div className="h-20 bg-white/10 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
        <History className="text-blue-400" />
        Wedstrijd Historie ({matches.length})
      </h2>

      {matches.length === 0 ? (
        <div className="card text-center py-12">
          <History className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">Nog geen wedstrijden gespeeld</p>
          <p className="text-slate-500 text-sm mt-2">Ga naar Nieuwe Wedstrijd om je eerste match toe te voegen</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const winnerTeam = getWinnerTeam(match)
            const intensity = getMatchIntensity(match)
            
            return (
              <div
                key={match.id}
                className="card relative overflow-hidden group hover:scale-[1.01] transition-transform"
              >
                {/* Background intensity indicator */}
                <div className={`absolute inset-0 ${intensity.bg} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                
                {/* Crawl game indicator */}
                {match.is_crawl_game && (
                  <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/30 rounded-full p-2">
                    <AlertTriangle className="text-red-400" size={16} />
                  </div>
                )}
                
                <div className="relative z-10">
                  {/* Match Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar size={14} />
                      {formatDate(match.created_at)}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${intensity.bg} ${intensity.color} font-semibold`}>
                        {intensity.label}
                      </span>
                      {match.total_rating_change > 0 && (
                        <div className="flex items-center gap-1 bg-purple-500/20 rounded-full px-2 py-1">
                          <Zap size={12} className="text-purple-400" />
                          <span className="text-xs font-bold text-purple-400">
                            {match.total_rating_change}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Teams and Score */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Team 1 */}
                    <div className="flex justify-start">
                      {renderTeam(
                        match.team1_player1_data,
                        match.team1_player2_data,
                        winnerTeam === 'team1',
                        'md'
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-4">
                        <span className={`text-3xl font-bold ${
                          winnerTeam === 'team1' ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {match.team1_score}
                        </span>
                        <span className="text-slate-500 text-xl">-</span>
                        <span className={`text-3xl font-bold ${
                          winnerTeam === 'team2' ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {match.team2_score}
                        </span>
                      </div>
                      
                      {match.is_crawl_game && (
                        <div className="mt-2 text-xs text-red-400 font-semibold flex items-center justify-center gap-1">
                          <span>🐛</span>
                          Crawl Game!
                        </div>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex justify-end">
                      {renderTeam(
                        match.team2_player1_data,
                        match.team2_player2_data,
                        winnerTeam === 'team2',
                        'md'
                      )}
                    </div>
                  </div>

                  {/* Match Stats */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <p className="text-slate-400">Score verschil</p>
                        <p className="font-bold text-white">{getScoreDifference(match)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Rating impact</p>
                        <p className="font-bold text-purple-400">{match.total_rating_change}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Match type</p>
                        <p className={`font-bold ${intensity.color}`}>{intensity.label}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
} 