'use client'

import { useState, useEffect } from 'react'
import { History, Users, Trophy, Zap, AlertTriangle, Calendar, Swords } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Match, Player } from '@/types/database'

interface MatchWithPlayers extends Match {
  team1_player1_data: Player
  team1_player2_data: Player | null
  team2_player1_data: Player
  team2_player2_data: Player | null
}

export default function MatchHistory() {
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [gameMode, setGameMode] = useState<'all' | 'classic' | 'duel'>('all')

  // Map<matchId, { team1: number; team2: number }>
  const [matchTeamRatingChanges, setMatchTeamRatingChanges] = useState<
    Map<string, { team1: number; team2: number }>
  >(new Map())

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
      const matchesData = data || []
      setMatches(matchesData)

      // ------------------
      // Fetch rating changes for these matches so we can display exacte waarden
      // ------------------
      if (matchesData.length > 0) {
        const matchIds = matchesData.map(m => m.id)
        const { data: ratingRows, error: ratingErr } = await supabase
          .from('match_player_ratings')
          .select('match_id, player_id, rating_change')
          .in('match_id', matchIds)

        if (ratingErr) {
          console.warn('Kon rating changes niet laden, gebruik fallback', ratingErr)
        } else if (ratingRows) {
          const map: Map<string, any> = new Map()

          // Helper om snel spelers per team op te zoeken
          const matchMap = new Map(matchesData.map(m => [m.id, m]))

          ratingRows.forEach(row => {
            const match = matchMap.get(row.match_id)
            if (!match) return

            // Bepaal of speler team1 of team2 is
            const team1Ids = [match.team1_player1, match.team1_player2].filter(Boolean)
            const teamKey = team1Ids.includes(row.player_id) ? 'team1' : 'team2'

            const existing: any = map.get(row.match_id) || { team1: 0, team2: 0, cnt1: 0, cnt2: 0 }

            if (teamKey === 'team1') {
              existing.team1 += row.rating_change
              existing.cnt1 = (existing.cnt1 || 0) + 1
            } else {
              existing.team2 += row.rating_change
              existing.cnt2 = (existing.cnt2 || 0) + 1
            }

            map.set(row.match_id, existing)
          })

          // Gemiddelde per speler (zeker nuttig voor 2vs2)
          const finalMap = new Map<string, { team1: number; team2: number }>()
          map.forEach((val: any, key) => {
            const team1Avg = val.cnt1 ? Math.round(val.team1 / val.cnt1) : undefined
            const team2Avg = val.cnt2 ? Math.round(val.team2 / val.cnt2) : undefined
            finalMap.set(key, {
              team1: team1Avg ?? 0,
              team2: team2Avg ?? 0
            })
          })

          setMatchTeamRatingChanges(finalMap)
        }
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = matches.filter(match => {
    if (gameMode === 'all') return true
    return match.game_mode === gameMode
  })

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
          className={`${sizeClasses} rounded-full object-cover border border-white/20`}
        />
      )
    }
    
    return (
      <div className={`${sizeClasses} rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold`}>
        {player.name.charAt(0).toUpperCase()}
      </div>
    )
  }

  const renderTeam = (player1: Player, player2: Player | null, isWinner: boolean, size: 'sm' | 'md' = 'sm', ratingChange?: number, isRightSide: boolean = false) => {
    // For 1vs1 matches, player2 will be null
    const avatars = player2 ? (
        <div className="flex -space-x-2">
          {renderPlayerAvatar(player1, size)}
          {renderPlayerAvatar(player2, size)}
        </div>
    ) : (
      renderPlayerAvatar(player1, size)
    )
    
    const names = player2 ? (
        <div className="flex flex-col">
          <span className={`font-semibold ${isWinner ? 'text-white' : 'text-slate-300'} text-xs sm:text-sm`}>
            {player1.name}
          </span>
          <span className={`font-semibold ${isWinner ? 'text-white' : 'text-slate-300'} text-xs sm:text-sm`}>
            {player2.name}
          </span>
        </div>
    ) : (
      <span className={`font-semibold ${isWinner ? 'text-white' : 'text-slate-300'} text-xs sm:text-sm`}>
        {player1.name}
      </span>
    )
    
    const ratingBadge = ratingChange ? (
      <div className={`px-1.5 sm:px-2 py-1 rounded-md text-xs font-bold ${
        ratingChange > 0 
          ? 'text-green-400 bg-green-400/20 border border-green-400/30' 
          : 'text-red-400 bg-red-400/20 border border-red-400/30'
      }`}>
        {ratingChange > 0 ? '+' : ''}{ratingChange}
      </div>
    ) : null
    
    const trophy = isWinner ? <Trophy className="text-yellow-400" size={14} /> : null
    
    if (isRightSide) {
      return (
        <div className={`flex items-center gap-1.5 sm:gap-2 ${isWinner ? 'opacity-100' : 'opacity-70'}`}>
          {trophy}
          {ratingBadge}
          {names}
          {avatars}
        </div>
      )
    }
    
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 ${isWinner ? 'opacity-100' : 'opacity-70'}`}>
        {avatars}
        {names}
        {ratingBadge}
        {trophy}
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
        Wedstrijd Historie ({filteredMatches.length})
      </h2>

      {/* Game Mode Filter */}
      <div className="flex justify-center mb-6">
        <div className="flex flex-col sm:flex-row bg-white/5 rounded-lg p-1 gap-1 w-full sm:w-auto">
          <button
            onClick={() => setGameMode('all')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              gameMode === 'all' 
                ? 'bg-[#e51f5c] text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alle ({matches.length})
          </button>
          <button
            onClick={() => setGameMode('classic')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              gameMode === 'classic' 
                ? 'bg-[#e51f5c] text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            2vs2 ({matches.filter(m => m.game_mode === 'classic').length})
          </button>
          <button
            onClick={() => setGameMode('duel')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              gameMode === 'duel' 
                ? 'bg-[#e51f5c] text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Swords size={16} />
            1vs1 ({matches.filter(m => m.game_mode === 'duel').length})
          </button>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="card text-center py-12">
          <History className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">
            {gameMode === 'all' 
              ? 'Nog geen wedstrijden gespeeld' 
              : `Nog geen ${gameMode === 'classic' ? '2vs2' : '1vs1'} wedstrijden gespeeld`
            }
          </p>
          <p className="text-slate-500 text-sm mt-2">Ga naar Nieuwe Wedstrijd om je eerste match toe te voegen</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => {
            const winnerTeam = getWinnerTeam(match)
            const intensity = getMatchIntensity(match)
            const is1vs1 = match.game_mode === 'duel'
            
            return (
              <div
                key={match.id}
                className="card relative overflow-hidden group hover:scale-[1.01] transition-transform"
              >
                {/* Background intensity indicator */}
                <div className={`absolute inset-0 ${intensity.bg} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                
                <div className="relative z-10">
                  {/* Match Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar size={14} />
                      <span className="hidden sm:inline">{formatDate(match.created_at)}</span>
                      <span className="sm:hidden">{formatDate(match.created_at).replace(/\d{4},\s/, '')}</span>
                      <div className="flex items-center gap-1 ml-2">
                        {is1vs1 ? <Swords size={14} /> : <Users size={14} />}
                        <span className="text-xs font-semibold">
                          {is1vs1 ? 'DUEL' : 'CLASSIC'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${intensity.bg} ${intensity.color} font-semibold`}>
                        {intensity.label}
                      </span>
                      {match.is_crawl_game && (
                        <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-full px-2 py-1">
                          <AlertTriangle className="text-red-400" size={12} />
                          <span className="text-xs text-red-400 font-semibold hidden sm:inline">Crawl</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Teams and Score */}
                  <div className="flex flex-col md:grid md:grid-cols-3 gap-4 md:items-center">
                    {/* Team 1 / Player 1 */}
                    <div className="flex justify-start md:justify-start">
                      {(() => {
                        const changeData = matchTeamRatingChanges.get(match.id)
                        let team1Change: number | undefined
                        if (changeData) {
                          team1Change = changeData.team1
                        } else {
                          const base = Math.round(Math.abs(match.total_rating_change || 0) / (is1vs1 ? 2 : 4))
                          team1Change = winnerTeam === 'team1' ? base : -base
                        }
                        return renderTeam(
                        match.team1_player1_data,
                        match.team1_player2_data,
                        winnerTeam === 'team1',
                        'md',
                          team1Change,
                        false
                        )
                      })()}
                    </div>

                    {/* Score */}
                    <div className="text-center order-first md:order-none">
                      <div className="flex items-center justify-center gap-2 md:gap-4">
                        <span className={`text-2xl md:text-3xl font-bold ${
                          winnerTeam === 'team1' ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {match.team1_score}
                        </span>
                        <span className="text-slate-500 text-lg md:text-xl">-</span>
                        <span className={`text-2xl md:text-3xl font-bold ${
                          winnerTeam === 'team2' ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {match.team2_score}
                        </span>
                      </div>
                      
                      {match.is_crawl_game && (
                        <div className="mt-1 md:mt-2 text-xs text-red-400 font-semibold flex items-center justify-center gap-1">
                          <span>🐛</span>
                          Crawl Game!
                        </div>
                      )}
                    </div>

                    {/* Team 2 / Player 2 */}
                    <div className="flex justify-start md:justify-end">
                      {(() => {
                        const changeData = matchTeamRatingChanges.get(match.id)
                        let team2Change: number | undefined
                        if (changeData) {
                          team2Change = changeData.team2
                        } else {
                          const base = Math.round(Math.abs(match.total_rating_change || 0) / (is1vs1 ? 2 : 4))
                          team2Change = winnerTeam === 'team2' ? base : -base
                        }
                        return renderTeam(
                        match.team2_player1_data,
                        match.team2_player2_data,
                        winnerTeam === 'team2',
                        'md',
                          team2Change,
                        false
                        )
                      })()}
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