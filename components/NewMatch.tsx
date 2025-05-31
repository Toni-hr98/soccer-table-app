'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Trophy, Zap, AlertTriangle, Award, Swords } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Player, Team, MatchResult } from '@/types/database'
import { processMatchResult, processDuelResult, updatePlayerStreaks, checkAchievements, checkStreakStopperAchievements, DuelMatchResult, calculateExpectedScore, getWinStreakMultiplier } from '@/lib/rating-system'
import { sendMatchToMattermost } from '@/lib/mattermost'

interface NewMatchProps {
  onSuccess?: () => void
}

export default function NewMatch({ onSuccess }: NewMatchProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [gameMode, setGameMode] = useState<'classic' | 'duel'>('classic')
  
  // 2vs2 state
  const [team1Player1, setTeam1Player1] = useState<string>('')
  const [team1Player2, setTeam1Player2] = useState<string>('')
  const [team2Player1, setTeam2Player1] = useState<string>('')
  const [team2Player2, setTeam2Player2] = useState<string>('')
  
  // 1vs1 state
  const [player1, setPlayer1] = useState<string>('')
  const [player2, setPlayer2] = useState<string>('')
  
  const [team1Score, setTeam1Score] = useState<number>(0)
  const [team2Score, setTeam2Score] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [matchResult, setMatchResult] = useState<MatchResult | DuelMatchResult | null>(null)

  useEffect(() => {
    fetchPlayers()
  }, [])

  useEffect(() => {
    if (gameMode === 'classic') {
    if (team1Player1 && team1Player2 && team2Player1 && team2Player2) {
      calculateMatchPreview()
    } else {
      setMatchResult(null)
    }
    } else if (gameMode === 'duel') {
      if (player1 && player2) {
        calculateDuelPreview()
      } else {
        setMatchResult(null)
      }
    }
  }, [gameMode, team1Player1, team1Player2, team2Player1, team2Player2, player1, player2, team1Score, team2Score])

  const fetchPlayers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateMatchPreview = () => {
    const p1 = players.find(p => p.id === team1Player1)
    const p2 = players.find(p => p.id === team1Player2)
    const p3 = players.find(p => p.id === team2Player1)
    const p4 = players.find(p => p.id === team2Player2)

    if (!p1 || !p2 || !p3 || !p4) return

    const team1: Team = {
      player1: p1,
      player2: p2,
      combined_rating: p1.rating + p2.rating
    }

    const team2: Team = {
      player1: p3,
      player2: p4,
      combined_rating: p3.rating + p4.rating
    }

    const result = processMatchResult(team1, team2, team1Score, team2Score)
    setMatchResult(result)
  }

  const calculateDuelPreview = () => {
    const p1 = players.find(p => p.id === player1)
    const p2 = players.find(p => p.id === player2)

    if (!p1 || !p2) return

    const result = processDuelResult(p1, p2, team1Score, team2Score)
    setMatchResult(result)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchResult) return

    setSubmitting(true)
    try {
      // Insert match with appropriate game mode
      const matchData = gameMode === 'classic' ? {
          team1_player1: team1Player1,
          team1_player2: team1Player2,
          team2_player1: team2Player1,
          team2_player2: team2Player2,
          team1_score: team1Score,
          team2_score: team2Score,
          total_rating_change: matchResult.total_rating_change,
        is_crawl_game: matchResult.is_crawl_game,
        game_mode: 'classic' as const
      } : {
        team1_player1: player1,
        team1_player2: null,
        team2_player1: player2,
        team2_player2: null,
        team1_score: team1Score,
        team2_score: team2Score,
        total_rating_change: matchResult.total_rating_change,
        is_crawl_game: matchResult.is_crawl_game,
        game_mode: 'duel' as const
      }

      const { data: matchDataResult, error: matchError } = await supabase
        .from('matches')
        .insert(matchData)
        .select()
        .single()

      if (matchError) {
        console.error('Match insertion error:', matchError)
        console.error('Match data being sent:', matchData)
        throw matchError
      }

      // Store individual rating changes for accurate history tracking
      const ratingChangeInserts = []
      for (const [playerId, ratingChange] of Object.entries(matchResult.rating_changes)) {
        const player = players.find(p => p.id === playerId)
        if (!player) continue

        const newRating = Math.max(0, player.rating + ratingChange)
        ratingChangeInserts.push({
          match_id: matchDataResult.id,
          player_id: playerId,
          rating_change: ratingChange,
          previous_rating: player.rating,
          new_rating: newRating
        })
      }

      // Insert rating changes
      if (ratingChangeInserts.length > 0) {
        const { error: ratingError } = await supabase
          .from('match_player_ratings')
          .insert(ratingChangeInserts)

        if (ratingError) {
          console.error('Error inserting rating changes:', ratingError)
          throw ratingError
        }
      }

      // Update all players
      const playerUpdates = []
      const achievementInserts = []

      for (const [playerId, ratingChange] of Object.entries(matchResult.rating_changes)) {
        const player = players.find(p => p.id === playerId)
        if (!player) continue

        const isWinner = ratingChange > 0
        const newRating = Math.max(0, player.rating + ratingChange)
        const streaks = updatePlayerStreaks(player, isWinner)
        
        // Update goals
        let goalsScored = 0
        let goalsConceded = 0
        
        if (gameMode === 'classic') {
        if (playerId === team1Player1 || playerId === team1Player2) {
          goalsScored = team1Score
          goalsConceded = team2Score
        } else {
          goalsScored = team2Score
          goalsConceded = team1Score
          }
        } else {
          if (playerId === player1) {
            goalsScored = team1Score
            goalsConceded = team2Score
          } else {
            goalsScored = team2Score
            goalsConceded = team1Score
          }
        }

        const updatedPlayer: Player = {
          ...player,
          rating: newRating,
          highest_rating: Math.max(player.highest_rating, newRating),
          goals_scored: player.goals_scored + goalsScored,
          goals_conceded: player.goals_conceded + goalsConceded,
          wins: player.wins + (isWinner ? 1 : 0),
          losses: player.losses + (isWinner ? 0 : 1),
          current_win_streak: streaks.current_win_streak,
          current_loss_streak: streaks.current_loss_streak,
          best_win_streak: streaks.best_win_streak,
          crawls: player.crawls + (matchResult.is_crawl_game && !isWinner ? 1 : 0),
          crawls_caused: player.crawls_caused + (matchResult.is_crawl_game && isWinner ? 1 : 0)
        }

        playerUpdates.push({
          id: playerId,
          rating: newRating,
          highest_rating: updatedPlayer.highest_rating,
          goals_scored: updatedPlayer.goals_scored,
          goals_conceded: updatedPlayer.goals_conceded,
          wins: updatedPlayer.wins,
          losses: updatedPlayer.losses,
          current_win_streak: updatedPlayer.current_win_streak,
          current_loss_streak: updatedPlayer.current_loss_streak,
          best_win_streak: updatedPlayer.best_win_streak,
          crawls: updatedPlayer.crawls,
          crawls_caused: updatedPlayer.crawls_caused
        })

        // Check for new achievements
        const newAchievements = checkAchievements(updatedPlayer, matchResult)
        
        for (const achievementName of newAchievements) {
          // Get achievement ID
          const { data: achievementData, error: achievementError } = await supabase
            .from('achievements')
            .select('id')
            .eq('name', achievementName)
            .single()

          if (achievementData) {
            achievementInserts.push({
              player_id: playerId,
              achievement_id: achievementData.id
            })
          } else {
            console.error(`❌ Achievement "${achievementName}" not found in database!`)
          }
        }
      }

      // Check for streak-stopping achievements
      const winningPlayers = []
      const losingPlayers = []
      
      for (const [playerId, ratingChange] of Object.entries(matchResult.rating_changes)) {
        const player = players.find(p => p.id === playerId)
        if (!player) continue
        
        const isWinner = ratingChange > 0
        if (isWinner) {
          winningPlayers.push(player)
        } else {
          losingPlayers.push(player)
        }
      }
      
      const streakStopperAchievements = checkStreakStopperAchievements(winningPlayers, losingPlayers)
      
      // Add streak-stopper achievements to achievement inserts
      for (const [playerId, achievementNames] of Object.entries(streakStopperAchievements)) {
        for (const achievementName of achievementNames) {
          // Get achievement ID
          const { data: achievementData } = await supabase
            .from('achievements')
            .select('id')
            .eq('name', achievementName)
            .single()

          if (achievementData) {
            achievementInserts.push({
              player_id: playerId,
              achievement_id: achievementData.id
            })
          }
        }
      }

      // Update all players
      for (const update of playerUpdates) {
        const { error: updateError } = await supabase
          .from('players')
          .update(update)
          .eq('id', update.id)

        if (updateError) throw updateError
      }

      // Insert new achievements and auto-activate them
      if (achievementInserts.length > 0) {
        let successfulInserts = 0
        
        // Insert achievements one by one to handle duplicates gracefully
        for (const achievementInsert of achievementInserts) {
          const { data: insertedAchievement, error: achievementError } = await supabase
            .from('player_achievements')
            .insert([achievementInsert])
            .select('player_id, achievement_id')
            .single()

          if (achievementError) {
            // If it's a duplicate key error, that's fine - achievement already exists
            if (achievementError.code === '23505') {
              console.log('ℹ️ Achievement already exists, skipping duplicate')
            } else {
              console.error('❌ Error inserting achievement:', achievementError)
            }
          } else if (insertedAchievement) {
            successfulInserts++
            // Auto-activate the new achievement
            const { error: activateError } = await supabase
              .from('players')
              .update({ active_achievement_id: insertedAchievement.achievement_id })
              .eq('id', insertedAchievement.player_id)

            if (activateError) {
              console.error('❌ Error activating achievement:', activateError)
            }
          }
        }
        
        if (successfulInserts > 0) {
          console.log('✅ Successfully awarded', successfulInserts, 'new achievements!')
        }
      }

      // Reset form
      setTeam1Player1('')
      setTeam1Player2('')
      setTeam2Player1('')
      setTeam2Player2('')
      setPlayer1('')
      setPlayer2('')
      setTeam1Score(0)
      setTeam2Score(0)
      setMatchResult(null)

      // Refresh players data
      await fetchPlayers()

      if (onSuccess) {
        onSuccess()
      }

      // Send match to Mattermost (non-blocking - don't wait for it)
      const achievementData = []
      for (const insert of achievementInserts) {
        const player = players.find(p => p.id === insert.player_id)
        if (player) {
          const { data: achievementInfo } = await supabase
            .from('achievements')
            .select('name')
            .eq('id', insert.achievement_id)
            .single()
          
          if (achievementInfo) {
            achievementData.push({
              player_name: player.name,
              achievement_name: achievementInfo.name
            })
          }
        }
      }

      const notificationData = {
        team1_player1_name: getPlayerName(gameMode === 'classic' ? team1Player1 : player1),
        team1_player2_name: gameMode === 'classic' ? getPlayerName(team1Player2) : undefined,
        team2_player1_name: getPlayerName(gameMode === 'classic' ? team2Player1 : player2),
        team2_player2_name: gameMode === 'classic' ? getPlayerName(team2Player2) : undefined,
        team1_score: team1Score,
        team2_score: team2Score,
        game_mode: gameMode,
        total_rating_change: matchResult.total_rating_change,
        is_crawl_game: matchResult.is_crawl_game,
        achievements: achievementData.length > 0 ? achievementData : undefined
      }

      // Fire and forget - don't block match creation if Mattermost fails
      sendMatchToMattermost(notificationData).catch(error => {
        console.error('Mattermost notification failed (non-blocking):', error)
      })

    } catch (error) {
      console.error('Error submitting match:', error)
      alert('Er is een fout opgetreden bij het toevoegen van de wedstrijd')
    } finally {
      setSubmitting(false)
    }
  }

  const isFormValid = () => {
    if (gameMode === 'classic') {
    return team1Player1 && team1Player2 && team2Player1 && team2Player2 &&
           (team1Score === 10 || team2Score === 10) &&
           team1Score !== team2Score &&
           new Set([team1Player1, team1Player2, team2Player1, team2Player2]).size === 4
    } else {
      return player1 && player2 &&
             (team1Score === 10 || team2Score === 10) &&
             team1Score !== team2Score &&
             player1 !== player2
    }
  }

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || ''
  }

  // Helper function to calculate rating breakdown with streak bonuses
  const calculateRatingBreakdown = (playerId: string, ratingChange: number, isWinner: boolean) => {
    const player = players.find(p => p.id === playerId)
    if (!player || !isWinner || player.current_win_streak === 0) {
      return { baseChange: ratingChange, streakBonus: 0, streakMultiplier: 1 }
    }

    const streakMultiplier = getWinStreakMultiplier(player.current_win_streak)
    const baseChange = Math.round(ratingChange / streakMultiplier)
    const streakBonus = ratingChange - baseChange

    return { 
      baseChange, 
      streakBonus, 
      streakMultiplier,
      winStreak: player.current_win_streak 
    }
  }

  // Helper function to render player avatar (photo or initials)
  const renderPlayerAvatar = (playerId: string, size: 'small' | 'medium' = 'medium') => {
    const player = players.find(p => p.id === playerId)
    if (!player) return null

    const sizeClasses = size === 'small' ? 'w-10 h-10' : 'w-12 h-12'

    if (player.photo_url) {
      return (
        <img 
          src={player.photo_url} 
          alt={player.name}
          className={`${sizeClasses} rounded-full bg-white/10 object-cover`}
        />
      )
    } else {
      return (
        <div className={`${sizeClasses} rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold ${
          size === 'small' ? 'text-sm' : 'text-lg'
        }`}>
          {player.name.charAt(0).toUpperCase()}
        </div>
      )
    }
  }

  const minimumPlayers = gameMode === 'classic' ? 4 : 2

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded"></div>
          <div className="h-32 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2 text-white">
        <Plus className="text-[#e51f5c]" />
        Nieuwe Wedstrijd
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Game Mode Selection */}
        <div className="card">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            Game Mode
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setGameMode('classic')}
              className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                gameMode === 'classic' 
                  ? 'border-[#e51f5c] bg-[#e51f5c]/20 text-white' 
                  : 'border-white/20 bg-white/5 text-slate-300 hover:border-white/30'
              }`}
            >
              <Users className={gameMode === 'classic' ? 'text-[#e51f5c]' : 'text-slate-400'} size={24} />
              <div className="text-left">
                <div className="font-semibold">Classic</div>
                <div className="text-sm opacity-75">2vs2 Teams</div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setGameMode('duel')}
              className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                gameMode === 'duel' 
                  ? 'border-[#e51f5c] bg-[#e51f5c]/20 text-white' 
                  : 'border-white/20 bg-white/5 text-slate-300 hover:border-white/30'
              }`}
            >
              <Swords className={gameMode === 'duel' ? 'text-[#e51f5c]' : 'text-slate-400'} size={24} />
              <div className="text-left">
                <div className="font-semibold">Duel</div>
                <div className="text-sm opacity-75">1vs1 Match</div>
              </div>
            </button>
          </div>
        </div>

        {/* Player Selection - 2vs2 */}
        {gameMode === 'classic' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Team 1 */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Users className="text-white" />
              Team 1
                {matchResult && 'team1' in matchResult && (
                <span className="text-sm font-normal text-slate-400">
                  (Rating: {matchResult.team1.combined_rating})
                </span>
              )}
            </h3>
            
            <div className="space-y-3">
              <select
                value={team1Player1}
                onChange={(e) => setTeam1Player1(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 pr-10 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all appearance-none"
                required
              >
                <option value="">Selecteer speler 1</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.rating})
                  </option>
                ))}
              </select>

              <select
                value={team1Player2}
                onChange={(e) => setTeam1Player2(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 pr-10 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all appearance-none"
                required
              >
                <option value="">Selecteer speler 2</option>
                {players
                  .filter(p => p.id !== team1Player1)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.rating})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Team 2 */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Users className="text-[#e51f5c]" />
              Team 2
                {matchResult && 'team2' in matchResult && (
                <span className="text-sm font-normal text-slate-400">
                  (Rating: {matchResult.team2.combined_rating})
                </span>
              )}
            </h3>
            
            <div className="space-y-3">
              <select
                value={team2Player1}
                onChange={(e) => setTeam2Player1(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 pr-10 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all appearance-none"
                required
              >
                <option value="">Selecteer speler 1</option>
                {players
                  .filter(p => p.id !== team1Player1 && p.id !== team1Player2)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.rating})
                    </option>
                  ))}
              </select>

              <select
                value={team2Player2}
                onChange={(e) => setTeam2Player2(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 pr-10 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all appearance-none"
                required
              >
                <option value="">Selecteer speler 2</option>
                {players
                  .filter(p => p.id !== team1Player1 && p.id !== team1Player2 && p.id !== team2Player1)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.rating})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
        )}

        {/* Player Selection - 1vs1 */}
        {gameMode === 'duel' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Player 1 */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <Swords className="text-white" />
                Speler 1
                {matchResult && 'player1' in matchResult && (
                  <span className="text-sm font-normal text-slate-400">
                    (Rating: {matchResult.player1.player.rating})
                  </span>
                )}
              </h3>
              
              <select
                value={player1}
                onChange={(e) => setPlayer1(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 pr-10 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all appearance-none"
                required
              >
                <option value="">Selecteer speler</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.rating})
                  </option>
                ))}
              </select>
            </div>

            {/* Player 2 */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <Swords className="text-[#e51f5c]" />
                Speler 2
                {matchResult && 'player2' in matchResult && (
                  <span className="text-sm font-normal text-slate-400">
                    (Rating: {matchResult.player2.player.rating})
                  </span>
                )}
              </h3>
              
              <select
                value={player2}
                onChange={(e) => setPlayer2(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 pr-10 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all appearance-none"
                required
              >
                <option value="">Selecteer speler</option>
                {players
                  .filter(p => p.id !== player1)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.rating})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {/* Expected Score & Win Probability */}
        {matchResult && (
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              Verwachte Uitslag
            </h3>
            
            {gameMode === 'classic' && 'team1' in matchResult ? (
              <div className="space-y-4">
                {/* Rating Difference */}
                <div className="text-center">
                  <p className="text-xs text-slate-400">Rating Verschil</p>
                  <p className="text-lg font-bold text-slate-300">
                    {Math.abs(matchResult.team1.combined_rating - matchResult.team2.combined_rating)} punten
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className={`text-center p-4 rounded-lg ${(() => {
                    const expectedScore = calculateExpectedScore(matchResult.team1.combined_rating, matchResult.team2.combined_rating)
                    return expectedScore > 0.5 ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/20'
                  })()}`}>
                    {/* Team 1 Profile Photos */}
                    <div className="flex justify-center mb-3 -space-x-2">
                      {(() => {
                        const p1 = players.find(p => p.id === team1Player1)
                        const p2 = players.find(p => p.id === team1Player2)
                        return (
                          <>
                            {renderPlayerAvatar(team1Player1, 'small')}
                            {renderPlayerAvatar(team1Player2, 'small')}
                          </>
                        )
                      })()}
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(() => {
                        const expectedScore = calculateExpectedScore(matchResult.team1.combined_rating, matchResult.team2.combined_rating)
                        return `${(expectedScore * 100).toFixed(0)}%`
                      })()}
                    </p>
                    <p className="text-xs text-slate-400">winkans</p>
                    <p className="text-sm text-slate-300 mt-2">
                      {(() => {
                        const p1 = players.find(p => p.id === team1Player1)
                        const p2 = players.find(p => p.id === team1Player2)
                        return `${p1?.name} & ${p2?.name}`
                      })()}
                    </p>
                  </div>
                  
                  <div className={`text-center p-4 rounded-lg ${(() => {
                    const expectedScore = calculateExpectedScore(matchResult.team2.combined_rating, matchResult.team1.combined_rating)
                    return expectedScore > 0.5 ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/20'
                  })()}`}>
                    {/* Team 2 Profile Photos */}
                    <div className="flex justify-center mb-3 -space-x-2">
                      {(() => {
                        const p1 = players.find(p => p.id === team2Player1)
                        const p2 = players.find(p => p.id === team2Player2)
                        return (
                          <>
                            {renderPlayerAvatar(team2Player1, 'small')}
                            {renderPlayerAvatar(team2Player2, 'small')}
                          </>
                        )
                      })()}
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(() => {
                        const expectedScore = calculateExpectedScore(matchResult.team2.combined_rating, matchResult.team1.combined_rating)
                        return `${(expectedScore * 100).toFixed(0)}%`
                      })()}
                    </p>
                    <p className="text-xs text-slate-400">winkans</p>
                    <p className="text-sm text-slate-300 mt-2">
                      {(() => {
                        const p1 = players.find(p => p.id === team2Player1)
                        const p2 = players.find(p => p.id === team2Player2)
                        return `${p1?.name} & ${p2?.name}`
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Rating Difference */}
                <div className="text-center">
                  <p className="text-xs text-slate-400">Rating Verschil</p>
                  <p className="text-lg font-bold text-slate-300">
                    {(() => {
                      const duelMatch = matchResult as DuelMatchResult
                      return Math.abs(duelMatch.player1.player.rating - duelMatch.player2.player.rating)
                    })()} punten
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className={`text-center p-4 rounded-lg ${(() => {
                    const duelMatch = matchResult as DuelMatchResult
                    const expectedScore = calculateExpectedScore(duelMatch.player1.player.rating, duelMatch.player2.player.rating)
                    return expectedScore > 0.5 ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/20'
                  })()}`}>
                    {/* Player 1 Profile Photo */}
                    <div className="flex justify-center mb-3">
                      {renderPlayerAvatar(player1)}
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(() => {
                        const duelMatch = matchResult as DuelMatchResult
                        const expectedScore = calculateExpectedScore(duelMatch.player1.player.rating, duelMatch.player2.player.rating)
                        return `${(expectedScore * 100).toFixed(0)}%`
                      })()}
                    </p>
                    <p className="text-xs text-slate-400">winkans</p>
                    <p className="text-sm text-slate-300 mt-2">{getPlayerName(player1)}</p>
                  </div>
                  
                  <div className={`text-center p-4 rounded-lg ${(() => {
                    const duelMatch = matchResult as DuelMatchResult
                    const expectedScore = calculateExpectedScore(duelMatch.player2.player.rating, duelMatch.player1.player.rating)
                    return expectedScore > 0.5 ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/20'
                  })()}`}>
                    {/* Player 2 Profile Photo */}
                    <div className="flex justify-center mb-3">
                      {renderPlayerAvatar(player2)}
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(() => {
                        const duelMatch = matchResult as DuelMatchResult
                        const expectedScore = calculateExpectedScore(duelMatch.player2.player.rating, duelMatch.player1.player.rating)
                        return `${(expectedScore * 100).toFixed(0)}%`
                      })()}
                    </p>
                    <p className="text-xs text-slate-400">winkans</p>
                    <p className="text-sm text-slate-300 mt-2">{getPlayerName(player2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score Input */}
        <div className="card">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            <Trophy className="text-[#e51f5c]" />
            Score
          </h3>
          
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-2">
                {gameMode === 'classic' ? 'Team 1' : 'Speler 1'}
              </p>
              <input
                type="number"
                min="0"
                max="10"
                value={team1Score}
                onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                className="bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all text-center text-2xl font-bold w-20 mx-auto"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                {gameMode === 'classic' 
                  ? `${getPlayerName(team1Player1)} & ${getPlayerName(team1Player2)}`
                  : getPlayerName(player1)
                }
              </p>
            </div>
            
            <div className="text-center text-2xl font-bold text-slate-400">
              VS
            </div>
            
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-2">
                {gameMode === 'classic' ? 'Team 2' : 'Speler 2'}
              </p>
              <input
                type="number"
                min="0"
                max="10"
                value={team2Score}
                onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                className="bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all text-center text-2xl font-bold w-20 mx-auto"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                {gameMode === 'classic' 
                  ? `${getPlayerName(team2Player1)} & ${getPlayerName(team2Player2)}`
                  : getPlayerName(player2)
                }
              </p>
            </div>
          </div>

          {/* Crawl Game Warning */}
          {matchResult?.is_crawl_game && (
            <div className="mt-4 p-3 bg-[#e51f5c]/20 border border-[#e51f5c]/30 rounded-lg flex items-center gap-2">
              <AlertTriangle className="text-[#e51f5c]" size={20} />
              <span className="text-[#e51f5c] font-semibold">
                Crawl Game! Verliezers moeten onder de tafel kruipen! 🐛
              </span>
            </div>
          )}
        </div>

        {/* Match Preview */}
        {matchResult && (
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Zap className="text-[#e51f5c]" />
              Rating Veranderingen
            </h3>
            
            <h4 className="text-md font-semibold text-slate-300 mb-3">Rating Veranderingen</h4>
            
            {gameMode === 'classic' && 'team1' in matchResult ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-[#63c4dc]">Team 1</h4>
                <div className="space-y-1">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>{getPlayerName(team1Player1)}</span>
                      <span className={`font-bold ${matchResult.rating_changes[team1Player1] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                        {matchResult.rating_changes[team1Player1] >= 0 ? '+' : ''}{matchResult.rating_changes[team1Player1]}
                      </span>
                    </div>
                    {(() => {
                      const breakdown = calculateRatingBreakdown(team1Player1, matchResult.rating_changes[team1Player1], matchResult.rating_changes[team1Player1] > 0)
                      return breakdown.streakBonus > 0 && (
                        <div className="text-xs text-slate-400 ml-4">
                          <div>Base: +{breakdown.baseChange}</div>
                          <div className="text-yellow-400">Streak bonus: +{breakdown.streakBonus}</div>
                        </div>
                      )
                    })()}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>{getPlayerName(team1Player2)}</span>
                      <span className={`font-bold ${matchResult.rating_changes[team1Player2] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                        {matchResult.rating_changes[team1Player2] >= 0 ? '+' : ''}{matchResult.rating_changes[team1Player2]}
                      </span>
                    </div>
                    {(() => {
                      const breakdown = calculateRatingBreakdown(team1Player2, matchResult.rating_changes[team1Player2], matchResult.rating_changes[team1Player2] > 0)
                      return breakdown.streakBonus > 0 && (
                        <div className="text-xs text-slate-400 ml-4">
                          <div>Base: +{breakdown.baseChange}</div>
                          <div className="text-yellow-400">Streak bonus: +{breakdown.streakBonus}</div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-[#e51f5c]">Team 2</h4>
                <div className="space-y-1">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>{getPlayerName(team2Player1)}</span>
                      <span className={`font-bold ${matchResult.rating_changes[team2Player1] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                        {matchResult.rating_changes[team2Player1] >= 0 ? '+' : ''}{matchResult.rating_changes[team2Player1]}
                      </span>
                    </div>
                    {(() => {
                      const breakdown = calculateRatingBreakdown(team2Player1, matchResult.rating_changes[team2Player1], matchResult.rating_changes[team2Player1] > 0)
                      return breakdown.streakBonus > 0 && (
                        <div className="text-xs text-slate-400 ml-4">
                          <div>Base: +{breakdown.baseChange}</div>
                          <div className="text-yellow-400">Streak bonus: +{breakdown.streakBonus}</div>
                        </div>
                      )
                    })()}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>{getPlayerName(team2Player2)}</span>
                      <span className={`font-bold ${matchResult.rating_changes[team2Player2] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                        {matchResult.rating_changes[team2Player2] >= 0 ? '+' : ''}{matchResult.rating_changes[team2Player2]}
                      </span>
                    </div>
                    {(() => {
                      const breakdown = calculateRatingBreakdown(team2Player2, matchResult.rating_changes[team2Player2], matchResult.rating_changes[team2Player2] > 0)
                      return breakdown.streakBonus > 0 && (
                        <div className="text-xs text-slate-400 ml-4">
                          <div>Base: +{breakdown.baseChange}</div>
                          <div className="text-yellow-400">Streak bonus: +{breakdown.streakBonus}</div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                </div>
            </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#63c4dc]">Speler 1</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>{getPlayerName(player1)}</span>
                      <span className={`font-bold ${matchResult.rating_changes[player1] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                        {matchResult.rating_changes[player1] >= 0 ? '+' : ''}{matchResult.rating_changes[player1]}
                      </span>
                    </div>
                    {(() => {
                      const breakdown = calculateRatingBreakdown(player1, matchResult.rating_changes[player1], matchResult.rating_changes[player1] > 0)
                      return breakdown.streakBonus > 0 && (
                        <div className="text-xs text-slate-400 ml-4">
                          <div>Base: +{breakdown.baseChange}</div>
                          <div className="text-yellow-400">Streak bonus: +{breakdown.streakBonus}</div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#e51f5c]">Speler 2</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span>{getPlayerName(player2)}</span>
                      <span className={`font-bold ${matchResult.rating_changes[player2] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                        {matchResult.rating_changes[player2] >= 0 ? '+' : ''}{matchResult.rating_changes[player2]}
                      </span>
                    </div>
                    {(() => {
                      const breakdown = calculateRatingBreakdown(player2, matchResult.rating_changes[player2], matchResult.rating_changes[player2] > 0)
                      return breakdown.streakBonus > 0 && (
                        <div className="text-xs text-slate-400 ml-4">
                          <div>Base: +{breakdown.baseChange}</div>
                          <div className="text-yellow-400">Streak bonus: +{breakdown.streakBonus}</div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Totale rating verandering:</span>
                <span className="font-bold">{matchResult.total_rating_change}</span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid() || submitting}
          className="bg-[#e51f5c] w-full py-4 rounded-lg text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-lg h-5 w-5 border-b-2 border-white"></div>
              Wedstrijd toevoegen...
            </>
          ) : (
            <>
              <Trophy size={20} />
              Wedstrijd Toevoegen
            </>
          )}
        </button>
      </form>

      {players.length < minimumPlayers && (
        <div className="card text-center py-8">
          <Users className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">
            Je hebt minimaal {minimumPlayers} spelers nodig voor {gameMode === 'classic' ? '2vs2' : '1vs1'} wedstrijden
          </p>
          <p className="text-slate-500 text-sm mt-2">Ga naar de Spelers tab om meer spelers toe te voegen</p>
        </div>
      )}
    </div>
  )
} 