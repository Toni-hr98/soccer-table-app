'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Trophy, TrendingUp, Target, Calendar, Award, Zap, Users, Heart, Skull } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Player, Match, PlayerAchievement, Achievement } from '@/types/database'
import FireAnimation from './FireAnimation'

interface PlayerDetailProps {
  playerId: string
  onBack: () => void
}

interface MatchWithPlayers extends Match {
  team1_player1_data: Player
  team1_player2_data: Player
  team2_player1_data: Player
  team2_player2_data: Player
}

interface TeammateStats {
  player: Player
  gamesPlayed: number
  wins: number
  losses: number
  winRate: number
}

interface OpponentStats {
  player: Player
  gamesPlayed: number
  wins: number
  losses: number
  lossRate: number
}

interface PlayerStats {
  totalMatches: number
  winRate: number
  ratingHistory: { 
    date: string; 
    rating: number;
    match?: MatchWithPlayers;
    won?: boolean;
    ratingChange?: number;
  }[]
  recentMatches: MatchWithPlayers[]
  achievements: (PlayerAchievement & { achievement: Achievement })[]
  rank: number
  teammateStats: TeammateStats[]
  opponentStats: OpponentStats[]
}

export default function PlayerDetail({ playerId, onBack }: PlayerDetailProps) {
  const [player, setPlayer] = useState<Player | null>(null)
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayerData()
  }, [playerId])

  const fetchPlayerData = async () => {
    try {
      // Fetch player data
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()

      if (playerError) throw playerError

      // Fetch all players to calculate rank
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('id, rating')
        .order('rating', { ascending: false })

      if (playersError) throw playersError

      // Calculate rank
      const rank = allPlayers.findIndex(p => p.id === playerId) + 1

      // Fetch ALL matches for teammate/opponent stats
      const { data: allMatchesData, error: allMatchesError } = await supabase
        .from('matches')
        .select(`
          *,
          team1_player1_data:team1_player1(id, name, photo_url),
          team1_player2_data:team1_player2(id, name, photo_url),
          team2_player1_data:team2_player1(id, name, photo_url),
          team2_player2_data:team2_player2(id, name, photo_url)
        `)
        .or(`team1_player1.eq.${playerId},team1_player2.eq.${playerId},team2_player1.eq.${playerId},team2_player2.eq.${playerId}`)
        .order('created_at', { ascending: false })

      if (allMatchesError) throw allMatchesError

      // Fetch recent matches (limited)
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          team1_player1_data:team1_player1(id, name, photo_url),
          team1_player2_data:team1_player2(id, name, photo_url),
          team2_player1_data:team2_player1(id, name, photo_url),
          team2_player2_data:team2_player2(id, name, photo_url)
        `)
        .or(`team1_player1.eq.${playerId},team1_player2.eq.${playerId},team2_player1.eq.${playerId},team2_player2.eq.${playerId}`)
        .order('created_at', { ascending: false })
        .limit(15)

      if (matchesError) throw matchesError

      // Fetch achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('player_achievements')
        .select('*, achievement:achievements(*)')
        .eq('player_id', playerId)
        .order('achieved_at', { ascending: false })

      if (achievementsError) throw achievementsError

      // Calculate teammate and opponent statistics
      const teammateStats = calculateTeammateStats(allMatchesData || [], playerId)
      const opponentStats = calculateOpponentStats(allMatchesData || [], playerId)

      // Calculate stats
      const totalMatches = playerData.wins + playerData.losses
      const winRate = totalMatches > 0 ? (playerData.wins / totalMatches) * 100 : 0

      // Create rating history based on recent matches
      const ratingHistory = []
      
      if (matchesData && matchesData.length > 0) {
        // Start with estimated starting rating and work forward
        let estimatedStartRating = playerData.rating
        const matchesToUse = matchesData.slice(0, 10).reverse() // Get last 10 matches and reverse to chronological order
        
        // Estimate the starting rating by working backwards from current rating
        matchesToUse.forEach(match => {
          const isWinner = (
            (match.team1_player1 === playerId || match.team1_player2 === playerId) 
            ? match.team1_score > match.team2_score 
            : match.team2_score > match.team1_score
          )
          // Reverse the rating change to estimate starting point
          const estimatedChange = isWinner ? -(Math.random() * 20 + 10) : (Math.random() * 20 + 10)
          estimatedStartRating += estimatedChange
        })
        estimatedStartRating = Math.max(1200, Math.round(estimatedStartRating))
        
        // Add starting point
        ratingHistory.push({
          date: 'Start',
          rating: Math.round(estimatedStartRating)
        })
        
        // Now build the history forward from estimated start to current
        let currentRating = estimatedStartRating
        matchesToUse.forEach((match, index) => {
          const isWinner = (
            (match.team1_player1 === playerId || match.team1_player2 === playerId) 
            ? match.team1_score > match.team2_score 
            : match.team2_score > match.team1_score
          )
          
          // Calculate estimated rating change for this match
          const avgRatingChange = Math.abs(match.total_rating_change || 0) / 4
          const ratingChange = isWinner ? Math.round(avgRatingChange) : -Math.round(avgRatingChange)
          currentRating += ratingChange
          currentRating = Math.max(1200, currentRating)
          
          ratingHistory.push({
            date: `Game ${index + 1}`,
            rating: Math.round(currentRating),
            match: match,
            won: isWinner,
            ratingChange: Math.round(ratingChange)
          })
        })
        
        // Update final rating to match current
        if (ratingHistory.length > 1) {
          ratingHistory[ratingHistory.length - 1].rating = playerData.rating
        }
      } else {
        // Default history if no matches
        ratingHistory.push(
          { date: 'Start', rating: 1200 },
          { date: 'Now', rating: playerData.rating }
        )
      }

      setPlayer(playerData)
      setStats({
        totalMatches,
        winRate,
        ratingHistory,
        recentMatches: matchesData || [],
        achievements: achievementsData || [],
        rank,
        teammateStats,
        opponentStats
      })
    } catch (error) {
      console.error('Error fetching player data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTeammateStats = (matches: MatchWithPlayers[], playerId: string): TeammateStats[] => {
    const teammateMap = new Map<string, { player: Player; wins: number; losses: number; games: number }>()

    matches.forEach(match => {
      const isTeam1 = match.team1_player1 === playerId || match.team1_player2 === playerId
      const won = isTeam1 ? match.team1_score > match.team2_score : match.team2_score > match.team1_score
      
      let teammate: Player | null = null
      
      if (isTeam1) {
        teammate = match.team1_player1 === playerId ? match.team1_player2_data : match.team1_player1_data
      } else {
        teammate = match.team2_player1 === playerId ? match.team2_player2_data : match.team2_player1_data
      }

      if (teammate) {
        const existing = teammateMap.get(teammate.id) || { 
          player: teammate, 
          wins: 0, 
          losses: 0, 
          games: 0 
        }
        
        existing.games++
        if (won) existing.wins++
        else existing.losses++
        
        teammateMap.set(teammate.id, existing)
      }
    })

    return Array.from(teammateMap.values())
      .map(stats => ({
        player: stats.player,
        gamesPlayed: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0
      }))
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
  }

  const calculateOpponentStats = (matches: MatchWithPlayers[], playerId: string): OpponentStats[] => {
    const opponentMap = new Map<string, { player: Player; wins: number; losses: number; games: number }>()

    matches.forEach(match => {
      const isTeam1 = match.team1_player1 === playerId || match.team1_player2 === playerId
      const won = isTeam1 ? match.team1_score > match.team2_score : match.team2_score > match.team1_score
      
      let opponents: Player[] = []
      
      if (isTeam1) {
        opponents = [match.team2_player1_data, match.team2_player2_data]
      } else {
        opponents = [match.team1_player1_data, match.team1_player2_data]
      }

      opponents.forEach(opponent => {
        if (opponent) {
          const existing = opponentMap.get(opponent.id) || { 
            player: opponent, 
            wins: 0, 
            losses: 0, 
            games: 0 
          }
          
          existing.games++
          if (won) existing.wins++
          else existing.losses++
          
          opponentMap.set(opponent.id, existing)
        }
      })
    })

    return Array.from(opponentMap.values())
      .map(stats => ({
        player: stats.player,
        gamesPlayed: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        lossRate: stats.games > 0 ? (stats.losses / stats.games) * 100 : 0
      }))
      .sort((a, b) => b.losses - a.losses)
  }

  const getMatchResult = (match: MatchWithPlayers) => {
    const isTeam1 = match.team1_player1 === playerId || match.team1_player2 === playerId
    const won = isTeam1 ? match.team1_score > match.team2_score : match.team2_score > match.team1_score
    return { won, isTeam1 }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getWinLossData = () => {
    if (!player) return []
    return [
      { name: 'Wins', value: player.wins },
      { name: 'Losses', value: player.losses }
    ]
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload
      
      if (!data.match) {
        return (
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
            <p className="text-white font-semibold">{label}</p>
            <p className="text-[#e51f5c]">Rating: {data.rating}</p>
          </div>
        )
      }

      const match = data.match
      const isTeam1 = match.team1_player1 === playerId || match.team1_player2 === playerId
      const playerScore = isTeam1 ? match.team1_score : match.team2_score
      const opponentScore = isTeam1 ? match.team2_score : match.team1_score

      const playerTeam = isTeam1 
        ? `${match.team1_player1_data.name} & ${match.team1_player2_data.name}`
        : `${match.team2_player1_data.name} & ${match.team2_player2_data.name}`
      
      const opponentTeam = isTeam1 
        ? `${match.team2_player1_data.name} & ${match.team2_player2_data.name}`
        : `${match.team1_player1_data.name} & ${match.team1_player2_data.name}`

      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg max-w-xs">
          <p className="text-white font-semibold mb-2">{label}</p>
          
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${data.won ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-white font-medium">
                {playerScore} - {opponentScore}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                data.won 
                  ? 'text-green-400 bg-green-400/20' 
                  : 'text-red-400 bg-red-400/20'
              }`}>
                {data.ratingChange && data.ratingChange > 0 ? '+' : ''}{data.ratingChange}
              </span>
            </div>
            
            <div className="text-slate-300 text-xs">
              <div>{playerTeam}</div>
              <div className="text-slate-500">vs</div>
              <div>{opponentTeam}</div>
            </div>
            
            <div className="pt-1 border-t border-slate-600">
              <span className="text-white font-medium">Rating: {data.rating}</span>
            </div>
            
            {match.is_crawl_game && (
              <div className="text-[#e51f5c] text-xs font-bold">🐛 CRAWL GAME</div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn-secondary p-2">
            <ArrowLeft size={20} />
          </button>
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-48"></div>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="animate-pulse">
                <div className="h-32 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!player || !stats) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">Speler niet gevonden</p>
        <button onClick={onBack} className="btn-primary mt-4">
          Terug naar leaderboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary p-2">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-6 flex-1">
          {/* Player Avatar */}
          {player.photo_url ? (
            <img
              src={player.photo_url}
              alt={player.name}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold text-3xl">
              {player.name.charAt(0).toUpperCase()}
            </div>
          )}
          
          {/* Player Info */}
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">{player.name}</h1>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Rank: <span className="text-white font-bold">#{stats.rank}</span></span>
              {player.current_win_streak >= 3 && (
                <div className="flex items-center gap-1">
                  <FireAnimation size="small" />
                  <span className="text-[#e51f5c] font-bold">{player.current_win_streak} streak</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Rating Card - 2 columns wide */}
        <div className="card text-center md:col-span-2">
          <div className="p-2 rounded-lg bg-white/5 inline-block mb-2">
            <Trophy className="text-[#e51f5c]" size={20} />
          </div>
          <p className="text-3xl font-bold text-white">{player.rating}</p>
          <p className="text-slate-400 text-sm">Current Rating</p>
          <p className="text-xs text-slate-500 mt-1">Peak: {player.highest_rating}</p>
        </div>
        
        <div className="card text-center">
          <div className="p-2 rounded-lg bg-white/5 inline-block mb-2">
            <Trophy className="text-white" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">{player.wins}</p>
          <p className="text-slate-400 text-sm">Wins</p>
        </div>
        <div className="card text-center">
          <div className="p-2 rounded-lg bg-white/5 inline-block mb-2">
            <Target className="text-white" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">{player.losses}</p>
          <p className="text-slate-400 text-sm">Losses</p>
        </div>
        
        {/* Goal Ratio - where Win Rate used to be */}
        <div className="card text-center">
          <div className="p-2 rounded-lg bg-white/5 inline-block mb-2">
            <Target className="text-white" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">
            {player.goals_conceded > 0 ? (player.goals_scored / player.goals_conceded).toFixed(2) : player.goals_scored}
          </p>
          <p className="text-slate-400 text-sm">Goal Ratio</p>
        </div>
        
        <div className="card text-center">
          <div className="p-2 rounded-lg bg-white/5 inline-block mb-2">
            <Zap className="text-white" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">{player.best_win_streak}</p>
          <p className="text-slate-400 text-sm">Best Streak</p>
        </div>
        
        {/* Win Rate - 2 columns wide at bottom right */}
        <div className="card text-center md:col-span-2">
          <div className="p-2 rounded-lg bg-white/5 inline-block mb-2">
            <TrendingUp className="text-white" size={20} />
          </div>
          <p className="text-3xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
          <p className="text-slate-400 text-sm">Win Rate</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Rating History Chart */}
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4">Rating History</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.ratingHistory}>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="rating" 
                  stroke="#e51f5c" 
                  strokeWidth={2}
                  dot={{ fill: '#e51f5c', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#e51f5c' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Chart */}
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4">Win/Loss Ratio</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getWinLossData()}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <Bar dataKey="value" fill="#e51f5c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Performance Statistics</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Matches</span>
              <span className="font-bold text-white">{stats.totalMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Goals Scored</span>
              <span className="font-bold text-white">{player.goals_scored}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Goals Conceded</span>
              <span className="font-bold text-white">{player.goals_conceded}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Times Crawled</span>
              <span className="font-bold text-white">{player.crawls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Achievements</span>
              <span className="font-bold text-white">{stats.achievements.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {stats.achievements.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Award className="text-white" />
            Achievements ({stats.achievements.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {stats.achievements.map((playerAchievement) => (
              <div key={playerAchievement.id} className="bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{playerAchievement.achievement.icon}</span>
                  <div>
                    <h4 className="font-bold text-white">{playerAchievement.achievement.name}</h4>
                    <p className="text-slate-400 text-sm">{playerAchievement.achievement.description}</p>
                    <p className="text-slate-500 text-xs">
                      {formatDate(playerAchievement.achieved_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teammate Statistics */}
      {stats.teammateStats.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users className="text-white" />
            Teamgenoot Statistieken
          </h3>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Most Played With */}
            <div>
              <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <Heart className="text-pink-400" size={16} />
                Meest Gespeeld Mee
              </h4>
              {stats.teammateStats.slice(0, 3).map((teammate, index) => (
                <div key={teammate.player.id} className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-pink-500 rounded-full">
                    {index + 1}
                  </div>
                  
                  {teammate.player.photo_url ? (
                    <img
                      src={teammate.player.photo_url}
                      alt={teammate.player.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold text-sm">
                      {teammate.player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="font-semibold text-white">{teammate.player.name}</p>
                    <div className="text-xs text-slate-400">
                      <span>{teammate.gamesPlayed} games</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Best Win Rate With */}
            <div>
              <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <Trophy className="text-green-400" size={16} />
                Beste Win Rate
              </h4>
              {stats.teammateStats
                .filter(t => t.gamesPlayed >= 2 && t.winRate > 50)
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, 3)
                .map((teammate, index) => (
                <div key={teammate.player.id} className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-green-500 rounded-full">
                    {index + 1}
                  </div>
                  
                  {teammate.player.photo_url ? (
                    <img
                      src={teammate.player.photo_url}
                      alt={teammate.player.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold text-sm">
                      {teammate.player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="font-semibold text-white">{teammate.player.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{teammate.gamesPlayed} games</span>
                      <span>{teammate.wins}W-{teammate.losses}L</span>
                      <span className="font-bold text-green-400">
                        {teammate.winRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {stats.teammateStats.filter(t => t.gamesPlayed >= 2 && t.winRate > 50).length === 0 && (
                <p className="text-slate-500 text-sm">Geen teammates met 50%+ win rate</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Opponent Statistics */}
      {stats.opponentStats.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Skull className="text-white" />
            Tegenstander Statistieken
          </h3>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Most Played Against */}
            <div>
              <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <Target className="text-blue-400" size={16} />
                Meest Tegen Gespeeld
              </h4>
              {stats.opponentStats.slice(0, 3).map((opponent, index) => (
                <div key={opponent.player.id} className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-500 rounded-full">
                    {index + 1}
                  </div>
                  
                  {opponent.player.photo_url ? (
                    <img
                      src={opponent.player.photo_url}
                      alt={opponent.player.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold text-sm">
                      {opponent.player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="font-semibold text-white">{opponent.player.name}</p>
                    <div className="text-xs text-slate-400">
                      <span>{opponent.gamesPlayed} games</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Biggest Nemesis */}
            <div>
              <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <Skull className="text-red-400" size={16} />
                Grootste Nemesis
              </h4>
              {stats.opponentStats
                .filter(o => o.gamesPlayed >= 2 && o.lossRate > 50)
                .sort((a, b) => b.lossRate - a.lossRate)
                .slice(0, 3)
                .map((opponent, index) => (
                <div key={opponent.player.id} className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
                    {index + 1}
                  </div>
                  
                  {opponent.player.photo_url ? (
                    <img
                      src={opponent.player.photo_url}
                      alt={opponent.player.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold text-sm">
                      {opponent.player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="font-semibold text-white">{opponent.player.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{opponent.gamesPlayed} games</span>
                      <span>{opponent.wins}W-{opponent.losses}L</span>
                      <span className="font-bold text-red-400">
                        {opponent.lossRate.toFixed(0)}% verloren
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {stats.opponentStats.filter(o => o.gamesPlayed >= 2 && o.lossRate > 50).length === 0 && (
                <p className="text-slate-500 text-sm">Geen echte nemesis gevonden</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Matches */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="text-white" />
          Recent Matches ({stats.recentMatches.length})
        </h3>
        <div className="space-y-3">
          {stats.recentMatches.map((match, index) => {
            const { won, isTeam1 } = getMatchResult(match)
            const playerScore = isTeam1 ? match.team1_score : match.team2_score
            const opponentScore = isTeam1 ? match.team2_score : match.team1_score
            
            // Calculate estimated rating change for this match
            const avgRatingChange = Math.abs(match.total_rating_change || 0) / 4
            const ratingChange = won ? Math.round(avgRatingChange) : -Math.round(avgRatingChange)
            
            // Calculate goal ratio for this match
            const goalRatio = opponentScore > 0 ? (playerScore / opponentScore).toFixed(2) : playerScore.toString()
            
            // Get team compositions
            const playerTeam = isTeam1 
              ? `${match.team1_player1_data.name} & ${match.team1_player2_data.name}`
              : `${match.team2_player1_data.name} & ${match.team2_player2_data.name}`
            
            const opponentTeam = isTeam1 
              ? `${match.team2_player1_data.name} & ${match.team2_player2_data.name}`
              : `${match.team1_player1_data.name} & ${match.team1_player2_data.name}`

            return (
              <div key={match.id} className="bg-white/5 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${won ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    
                    <div className="flex-1">
                      {/* Score and result */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-white text-lg">
                          {playerScore} - {opponentScore}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          won 
                            ? 'text-green-400 bg-green-400/20 border border-green-400/30' 
                            : 'text-red-400 bg-red-400/20 border border-red-400/30'
                        }`}>
                          {ratingChange > 0 ? '+' : ''}{ratingChange}
                        </span>
                        {match.is_crawl_game && (
                          <span className="text-[#e51f5c] text-xs px-2 py-1 bg-[#e51f5c]/20 rounded">
                            CRAWL
                          </span>
                        )}
                      </div>
                      
                      {/* Team compositions */}
                      <div className="text-sm text-slate-300">
                        <span className="font-semibold">{playerTeam}</span>
                        <span className="text-slate-500 mx-2">VS</span>
                        <span>{opponentTeam}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-400">
                    {formatDate(match.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
} 