import { Player, Team, MatchResult } from '@/types/database'

const K_FACTOR = 32 // Rating volatility
const SCORE_MULTIPLIER = 0.15 // How much score difference affects rating change
const WIN_STREAK_BONUS = 0.3 // Bonus multiplier for win streaks

// New interface for 1vs1 matches
export interface DuelPlayer {
  player: Player
}

export interface DuelMatchResult {
  player1: DuelPlayer
  player2: DuelPlayer
  player1_score: number
  player2_score: number
  rating_changes: {
    [playerId: string]: number
  }
  is_crawl_game: boolean
  total_rating_change: number
  game_mode: 'duel'
}

// Update MatchResult to include game_mode
export interface ExtendedMatchResult extends MatchResult {
  game_mode: 'classic' | 'duel'
}

export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export function getWinStreakMultiplier(winStreak: number): number {
  if (winStreak >= 10) return 1 + (WIN_STREAK_BONUS * 3) // 90% bonus for 10+ streak
  if (winStreak >= 5) return 1 + (WIN_STREAK_BONUS * 2) // 60% bonus for 5+ streak
  if (winStreak >= 3) return 1 + WIN_STREAK_BONUS // 30% bonus for 3+ streak
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

// New function for 1vs1 matches
export function processDuelResult(
  player1: Player,
  player2: Player,
  player1Score: number,
  player2Score: number
): DuelMatchResult {
  const scoreDifference = Math.abs(player1Score - player2Score)
  const player1Wins = player1Score > player2Score
  const crawlGame = isCrawlGame(player1Score, player2Score)
  
  const ratingChanges: { [playerId: string]: number } = {}
  
  // Calculate rating changes for 1vs1 but scale them down to match classic matches
  const DUEL_SCALE_FACTOR = 0.6 // Scale down duel rating changes to balance with classic
  
  const player1Change = calculateRatingChange(
    player1.rating,
    player1.rating,
    player2.rating,
    player1Score,
    scoreDifference,
    player1Wins,
    player1Wins ? player1.current_win_streak : 0
  )
  
  const player2Change = calculateRatingChange(
    player2.rating,
    player2.rating,
    player1.rating,
    player2Score,
    scoreDifference,
    !player1Wins,
    !player1Wins ? player2.current_win_streak : 0
  )
  
  // Apply scaling factor to make duels more balanced with classic matches
  ratingChanges[player1.id] = Math.round(player1Change * DUEL_SCALE_FACTOR)
  ratingChanges[player2.id] = Math.round(player2Change * DUEL_SCALE_FACTOR)
  
  const totalRatingChange = Math.abs(ratingChanges[player1.id]) + Math.abs(ratingChanges[player2.id])
  
  return {
    player1: { player: player1 },
    player2: { player: player2 },
    player1_score: player1Score,
    player2_score: player2Score,
    rating_changes: ratingChanges,
    is_crawl_game: crawlGame,
    total_rating_change: totalRatingChange,
    game_mode: 'duel'
  }
}

// Updated function for 2vs2 matches
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

// Updated to work with both match types
export function checkAchievements(player: Player, matchResult?: MatchResult | DuelMatchResult): string[] {
  const newAchievements: string[] = []
  
  // Win-based achievements
  if (player.wins === 1) newAchievements.push('First Win')
  if (player.wins === 5) newAchievements.push('Winner')
  
  // Streak achievements
  if (player.current_win_streak === 3) newAchievements.push('Hattrick')
  if (player.current_win_streak === 5) newAchievements.push('Pentakill')
  if (player.current_win_streak === 10) newAchievements.push('Unstoppable')
  if (player.current_win_streak === 15) newAchievements.push('Godlike')
  if (player.current_win_streak === 20) newAchievements.push('Beyond Godlike')
  
  // Losing streak achievements
  if (player.current_loss_streak === 3) newAchievements.push('Rough Patch')
  if (player.current_loss_streak === 5) newAchievements.push('Slump')
  if (player.current_loss_streak === 10) newAchievements.push('Cursed')
  if (player.current_loss_streak === 15) newAchievements.push('Nightmare Mode')
  if (player.current_loss_streak === 20) newAchievements.push('Rock Bottom')
  
  // Rating achievements
  if (player.rating <= 1000 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1000) {
    newAchievements.push('Newbie')
  }
  if (player.rating >= 1300 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1300) {
    newAchievements.push('Rising Star')
  }
  if (player.rating >= 1400 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1400) {
    newAchievements.push('Elite Player')
  }
  if (player.rating >= 1500 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1500) {
    newAchievements.push('Master')
  }
  if (player.rating >= 1600 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1600) {
    newAchievements.push('Grandmaster')
  }
  if (player.rating >= 1700 && player.rating - (matchResult?.rating_changes[player.id] || 0) < 1700) {
    newAchievements.push('God')
  }
  
  // Games played achievements
  const totalGames = player.wins + player.losses
  if (totalGames === 30) newAchievements.push('Veteran')
  if (totalGames === 50) newAchievements.push('Centurion')
  if (totalGames === 80) newAchievements.push('Legend')
  
  // Goal achievements
  if (player.goals_scored >= 50) newAchievements.push('Prikgarantie')
  if (player.goals_scored >= 100) newAchievements.push('Goal Machine')
  if (player.goals_scored >= 250) newAchievements.push('Sniper')
  if (player.goals_scored >= 500) newAchievements.push('Goal God')
  
  // Crawl achievements (receiving crawls)
  if (player.crawls >= 1) newAchievements.push('Crawler')
  if (player.crawls >= 5) newAchievements.push('Serial Crawler')
  if (player.crawls >= 10) newAchievements.push('Crawl King')
  if (player.crawls >= 20) newAchievements.push('Glutton for Punishment')
  
  // Crawl achievements (causing crawls)
  if (player.crawls_caused >= 1) newAchievements.push('Executioner')
  if (player.crawls_caused >= 5) newAchievements.push('Destroyer')
  if (player.crawls_caused >= 10) newAchievements.push('Terminator')
  if (player.crawls_caused >= 25) newAchievements.push('Nightmare')
  
  // Goal average achievements
  const avgGoalsPerMatch = totalGames > 0 ? player.goals_scored / totalGames : 0
  if (totalGames >= 10 && avgGoalsPerMatch >= 8) newAchievements.push('Sharp Shooter')
  if (totalGames >= 20 && avgGoalsPerMatch >= 9) newAchievements.push('Goal Machine Pro')
  if (totalGames >= 10 && avgGoalsPerMatch >= 10) newAchievements.push('Perfect Shooter')
  
  // Crawl defense achievements
  if (totalGames >= 15 && player.crawls === 0) newAchievements.push('Crawl Dodger')
  if (totalGames >= 30 && player.crawls === 0) newAchievements.push('Uncrawlable')
  
  // Mixed crawl achievements
  const totalCrawlGames = player.crawls + player.crawls_caused
  if (totalCrawlGames >= 30) newAchievements.push('Crawl Veteran')
  
  // Glass cannon (high goals, high crawls received)
  if (totalGames >= 20 && avgGoalsPerMatch >= 8 && player.crawls >= 5) {
    newAchievements.push('Glass Cannon')
  }
  
  // FIXED: Duel/Classic specific achievements
  
  
  // Special match achievements
  if (matchResult?.is_crawl_game) {
    let playerWon = false
    
    if ('team1' in matchResult) {
      // 2vs2 match
      playerWon = matchResult.team1_score > matchResult.team2_score ? 
      (matchResult.team1.player1.id === player.id || matchResult.team1.player2.id === player.id) :
      (matchResult.team2.player1.id === player.id || matchResult.team2.player2.id === player.id)
    } else {
      // 1vs1 match
      const duelMatch = matchResult as DuelMatchResult
      playerWon = duelMatch.player1_score > duelMatch.player2_score ? 
        (duelMatch.player1.player.id === player.id) :
        (duelMatch.player2.player.id === player.id)
    }
    
    if (!playerWon) {
      // Only push crawler for the specific match, causes are handled above
      if (player.crawls === 1) newAchievements.push('Crawler')
    }
  }
  
  return newAchievements
}

// New function to check for streak-stopping achievements
export function checkStreakStopperAchievements(
  winningPlayers: Player[],
  losingPlayers: Player[]
): { [playerId: string]: string[] } {
  const achievements: { [playerId: string]: string[] } = {}
  
  // Find the highest win streak among losing players
  const highestLosingStreak = Math.max(...losingPlayers.map(p => p.current_win_streak))
  
  // If no one had a streak, no achievements to award
  if (highestLosingStreak < 3) {
    return achievements
  }
  
  // Award achievements to all winning players
  winningPlayers.forEach(player => {
    if (!achievements[player.id]) {
      achievements[player.id] = []
    }
    
    // Check different streak thresholds
    if (highestLosingStreak >= 20) {
      achievements[player.id].push('Legend Killer')
    } else if (highestLosingStreak >= 15) {
      achievements[player.id].push('Godlike Slayer')
    } else if (highestLosingStreak >= 10) {
      achievements[player.id].push('Momentum Crusher')
    } else if (highestLosingStreak >= 5) {
      achievements[player.id].push('Hot Streak Killer')
    } else if (highestLosingStreak >= 3) {
      achievements[player.id].push('Streak Breaker')
    }
  })
  
  return achievements
} 