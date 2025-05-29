'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Trophy, Zap, AlertTriangle, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Player, Team, MatchResult } from '@/types/database'
import { processMatchResult, updatePlayerStreaks, checkAchievements } from '@/lib/rating-system'

interface NewMatchProps {
  onSuccess?: () => void
}

export default function NewMatch({ onSuccess }: NewMatchProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [team1Player1, setTeam1Player1] = useState<string>('')
  const [team1Player2, setTeam1Player2] = useState<string>('')
  const [team2Player1, setTeam2Player1] = useState<string>('')
  const [team2Player2, setTeam2Player2] = useState<string>('')
  const [team1Score, setTeam1Score] = useState<number>(0)
  const [team2Score, setTeam2Score] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)

  useEffect(() => {
    fetchPlayers()
  }, [])

  useEffect(() => {
    if (team1Player1 && team1Player2 && team2Player1 && team2Player2) {
      calculateMatchPreview()
    } else {
      setMatchResult(null)
    }
  }, [team1Player1, team1Player2, team2Player1, team2Player2, team1Score, team2Score])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchResult) return

    setSubmitting(true)
    try {
      // Insert match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          team1_player1: team1Player1,
          team1_player2: team1Player2,
          team2_player1: team2Player1,
          team2_player2: team2Player2,
          team1_score: team1Score,
          team2_score: team2Score,
          total_rating_change: matchResult.total_rating_change,
          is_crawl_game: matchResult.is_crawl_game
        })
        .select()
        .single()

      if (matchError) throw matchError

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
        
        if (playerId === team1Player1 || playerId === team1Player2) {
          goalsScored = team1Score
          goalsConceded = team2Score
        } else {
          goalsScored = team2Score
          goalsConceded = team1Score
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
          crawls: player.crawls + (matchResult.is_crawl_game && !isWinner ? 1 : 0)
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
          crawls: updatedPlayer.crawls
        })

        // Check for new achievements
        const newAchievements = checkAchievements(updatedPlayer, matchResult)
        for (const achievementName of newAchievements) {
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

      // Insert new achievements
      if (achievementInserts.length > 0) {
        const { error: achievementError } = await supabase
          .from('player_achievements')
          .insert(achievementInserts)

        if (achievementError) {
          console.error('Error inserting achievements:', achievementError)
        }
      }

      // Reset form
      setTeam1Player1('')
      setTeam1Player2('')
      setTeam2Player1('')
      setTeam2Player2('')
      setTeam1Score(0)
      setTeam2Score(0)
      setMatchResult(null)

      // Refresh players data
      await fetchPlayers()

      alert('Wedstrijd succesvol toegevoegd!')

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error submitting match:', error)
      alert('Er is een fout opgetreden bij het toevoegen van de wedstrijd')
    } finally {
      setSubmitting(false)
    }
  }

  const isFormValid = () => {
    return team1Player1 && team1Player2 && team2Player1 && team2Player2 &&
           (team1Score === 10 || team2Score === 10) &&
           team1Score !== team2Score &&
           new Set([team1Player1, team1Player2, team2Player1, team2Player2]).size === 4
  }

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || ''
  }

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
        {/* Team Selection */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Team 1 */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Users className="text-white" />
              Team 1
              {matchResult && (
                <span className="text-sm font-normal text-slate-400">
                  (Rating: {matchResult.team1.combined_rating})
                </span>
              )}
            </h3>
            
            <div className="space-y-3">
              <select
                value={team1Player1}
                onChange={(e) => setTeam1Player1(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all"
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
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all"
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
              {matchResult && (
                <span className="text-sm font-normal text-slate-400">
                  (Rating: {matchResult.team2.combined_rating})
                </span>
              )}
            </h3>
            
            <div className="space-y-3">
              <select
                value={team2Player1}
                onChange={(e) => setTeam2Player1(e.target.value)}
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all"
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
                className="w-full bg-[#1a2631]/30 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#e51f5c] focus:ring-2 focus:ring-[#e51f5c]/20 transition-all"
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

        {/* Score Input */}
        <div className="card">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            <Trophy className="text-[#e51f5c]" />
            Score
          </h3>
          
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-2">Team 1</p>
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
                {getPlayerName(team1Player1)} & {getPlayerName(team1Player2)}
              </p>
            </div>
            
            <div className="text-center text-2xl font-bold text-slate-400">
              VS
            </div>
            
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-2">Team 2</p>
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
                {getPlayerName(team2Player1)} & {getPlayerName(team2Player2)}
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
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-[#63c4dc]">Team 1</h4>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span>{getPlayerName(team1Player1)}</span>
                    <span className={`font-bold ${matchResult.rating_changes[team1Player1] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                      {matchResult.rating_changes[team1Player1] >= 0 ? '+' : ''}{matchResult.rating_changes[team1Player1]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{getPlayerName(team1Player2)}</span>
                    <span className={`font-bold ${matchResult.rating_changes[team1Player2] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                      {matchResult.rating_changes[team1Player2] >= 0 ? '+' : ''}{matchResult.rating_changes[team1Player2]}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-[#e51f5c]">Team 2</h4>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span>{getPlayerName(team2Player1)}</span>
                    <span className={`font-bold ${matchResult.rating_changes[team2Player1] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                      {matchResult.rating_changes[team2Player1] >= 0 ? '+' : ''}{matchResult.rating_changes[team2Player1]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{getPlayerName(team2Player2)}</span>
                    <span className={`font-bold ${matchResult.rating_changes[team2Player2] >= 0 ? 'text-[#63c4dc]' : 'text-[#e51f5c]'}`}>
                      {matchResult.rating_changes[team2Player2] >= 0 ? '+' : ''}{matchResult.rating_changes[team2Player2]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

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

      {players.length < 4 && (
        <div className="card text-center py-8">
          <Users className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">Je hebt minimaal 4 spelers nodig</p>
          <p className="text-slate-500 text-sm mt-2">Ga naar de Spelers tab om meer spelers toe te voegen</p>
        </div>
      )}
    </div>
  )
} 