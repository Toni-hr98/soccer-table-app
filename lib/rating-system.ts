import { Player, Team, MatchResult } from '@/types/database'

const K_FACTOR = 32 // Rating volatility
const SCORE_MULTIPLIER = 0.1 // How much score difference affects rating change
const WIN_STREAK_BONUS = 0.2 // Bonus multiplier for win streaks

export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export function getWinStreakMultiplier(winStreak: number): number {
  if (winStreak >= 10) return 1 + (WIN_STREAK_BONUS * 3) // 60% bonus for 10+ streak
  if (winStreak >= 5) return 1 + (WIN_STREAK_BONUS * 2) // 40% bonus for 5+ streak
  if (winStreak >= 3) return 1 + WIN_STREAK_BONUS // 20% bonus for 3+ streak
  return 1 // No bonus
}

export function calculateRatingChange(
  playerRating: number,
  teamRating: number,
  opponentTeamRating: number,
  actualScore: number,
  scoreDifference: number,
  isWinner: boolean,
  winStreak: number = 0
): number {
  const expectedScore = calculateExpectedScore(teamRating, opponentTeamRating)
  const actualResult = isWinner ? 1 : 0
  
  // Base rating change
  let ratingChange = K_FACTOR * (actualResult - expectedScore)
  
  // Adjust based on score difference (blowouts vs close games)
  const scoreMultiplier = 1 + (Math.abs(scoreDifference) * SCORE_MULTIPLIER)
  ratingChange *= scoreMultiplier
  
  // Apply win streak bonus for winners
  if (isWinner && winStreak > 0) {
    const streakMultiplier = getWinStreakMultiplier(winStreak)
    ratingChange *= streakMultiplier
  }
  
  return Math.round(ratingChange)
}

export function isCrawlGame(team1Score: number, team2Score: number): boolean {
  const scoreDiff = Math.abs(team1Score - team2Score)
  const maxScore = Math.max(team1Score, team2Score)
  return maxScore === 10 && scoreDiff >= 9 // 10-0 or 10-1
}

export function processMatchResult(
  team1: Team,
  team2: Team,
  team1Score: number,
  team2Score: number
): MatchResult {
  const team1Rating = team1.player1.rating + team1.player2.rating
  const team2Rating = team2.player1.rating + team2.player2.rating
  const scoreDifference = Math.abs(team1Score - team2Score)
  const team1Wins = team1Score > team2Score
  const crawlGame = isCrawlGame(team1Score, team2Score)
  
  const ratingChanges: { [playerId: string]: number } = {}
  
  // Calculate rating changes for team 1
  const team1Player1Streak = team1Wins ? team1.player1.current_win_streak : 0
  const team1Player2Streak = team1Wins ? team1.player2.current_win_streak : 0
  const avgTeam1Streak = Math.round((team1Player1Streak + team1Player2Streak) / 2)
  
  const team1Change = calculateRatingChange(
    0, // Individual player rating not used in team calculation
    team1Rating,
    team2Rating,
    team1Score,
    scoreDifference,
    team1Wins,
    avgTeam1Streak
  )
  
  // Calculate rating changes for team 2
  const team2Player1Streak = !team1Wins ? team2.player1.current_win_streak : 0
  const team2Player2Streak = !team1Wins ? team2.player2.current_win_streak : 0
  const avgTeam2Streak = Math.round((team2Player1Streak + team2Player2Streak) / 2)
  
  const team2Change = calculateRatingChange(
    0,
    team2Rating,
    team1Rating,
    team2Score,
    scoreDifference,
    !team1Wins,
    avgTeam2Streak
  )
  
  // Distribute rating change equally between team members
  ratingChanges[team1.player1.id] = Math.round(team1Change / 2)
  ratingChanges[team1.player2.id] = Math.round(team1Change / 2)
  ratingChanges[team2.player1.id] = Math.round(team2Change / 2)
  ratingChanges[team2.player2.id] = Math.round(team2Change / 2)
  
  // Calculate total rating change for game of the month tracking
  const totalRatingChange = Math.abs(team1Change) + Math.abs(team2Change)
  
  return {
    team1,
    team2,
    team1_score: team1Score,
    team2_score: team2Score,
    rating_changes: ratingChanges,
    is_crawl_game: crawlGame,
    total_rating_change: totalRatingChange
  }
}

export function updatePlayerStreaks(
  player: Player,
  won: boolean
): { current_win_streak: number; current_loss_streak: number; best_win_streak: number } {
  let newWinStreak = player.current_win_streak
  let newLossStreak = player.current_loss_streak
  let newBestStreak = player.best_win_streak
  
  if (won) {
    newWinStreak += 1
    newLossStreak = 0
    if (newWinStreak > newBestStreak) {
      newBestStreak = newWinStreak
    }
  } else {
    newWinStreak = 0
    newLossStreak += 1
  }
  
  return {
    current_win_streak: newWinStreak,
    current_loss_streak: newLossStreak,
    best_win_streak: newBestStreak
  }
}

export function checkAchievements(player: Player, matchResult?: MatchResult): string[] {
  const newAchievements: string[] = []
  
  // Win-based achievements
  if (player.wins === 1) newAchievements.push('First Win')
  
  // Streak achievements
  if (player.current_win_streak === 3) newAchievements.push('Hat Trick')
  if (player.current_win_streak === 5) newAchievements.push('Pentakill')
  if (player.current_win_streak === 10) newAchievements.push('Unstoppable')
  
  // Rating achievements
  if (player.rating >= 1300 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1300) {
    newAchievements.push('Rising Star')
  }
  if (player.rating >= 1500 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1500) {
    newAchievements.push('Elite Player')
  }
  if (player.rating >= 1700 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1700) {
    newAchievements.push('Legend')
  }
  
  // Games played achievements
  const totalGames = player.wins + player.losses
  if (totalGames === 50) newAchievements.push('Veteran')
  if (totalGames === 100) newAchievements.push('Centurion')
  
  // Goals achievement
  if (player.goals_scored >= 100) newAchievements.push('Goal Machine')
  
  // Special match achievements
  if (matchResult?.is_crawl_game) {
    const playerWon = matchResult.team1_score > matchResult.team2_score ? 
      (matchResult.team1.player1.id === player.id || matchResult.team1.player2.id === player.id) :
      (matchResult.team2.player1.id === player.id || matchResult.team2.player2.id === player.id)
    
    if (playerWon) {
      newAchievements.push('Destroyer')
    } else {
      newAchievements.push('Crawler')
    }
  }
  
  return newAchievements
} 