import { supabase } from './supabase'
import { Player, Match, MonthlyAward } from '@/types/database'

interface MonthlyStats {
  player_id: string
  player_name: string
  matches_played: number
  rating_start: number
  rating_end: number
  rating_growth: number
  crawls_received: number
  crawls_caused: number
}

interface GameImpact {
  match_id: string
  total_rating_change: number
  match_date: string
  description: string
}

export async function calculateMonthlyAwards(year: number, month: number) {
  try {
    console.log(`Calculating monthly awards for ${year}-${month}`)
    
    // Get all matches for the specified month
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()
    
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        team1_player1:players!matches_team1_player1_fkey(id, name, rating),
        team1_player2:players!matches_team1_player2_fkey(id, name, rating),
        team2_player1:players!matches_team2_player1_fkey(id, name, rating),
        team2_player2:players!matches_team2_player2_fkey(id, name, rating)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })

    if (matchesError) throw matchesError
    if (!matches || matches.length === 0) {
      console.log('No matches found for this month')
      return { success: true, message: 'No matches found for this month' }
    }

    // Get rating changes for this month
    const { data: ratingChanges, error: ratingError } = await supabase
      .from('match_player_ratings')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (ratingError) throw ratingError

    // Calculate monthly stats for each player
    const playerStats = await calculatePlayerMonthlyStats(matches, ratingChanges || [])
    
    // Calculate awards
    const awards = {
      player_of_month: calculatePlayerOfMonth(playerStats),
      most_active: calculateMostActive(playerStats),
      crawler_of_month: calculateCrawlerOfMonth(playerStats),
      game_of_month: calculateGameOfMonth(matches)
    }

    // Insert awards into database
    await insertMonthlyAwards(year, month, awards)
    
    return { 
      success: true, 
      message: `Monthly awards calculated and saved for ${year}-${month}`,
      awards 
    }
    
  } catch (error) {
    console.error('Error calculating monthly awards:', error)
    return { 
      success: false, 
      message: 'Failed to calculate monthly awards', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function calculatePlayerMonthlyStats(matches: any[], ratingChanges: any[]): Promise<MonthlyStats[]> {
  const playerStatsMap = new Map<string, MonthlyStats>()
  
  // Initialize player stats
  const allPlayerIds = new Set<string>()
  matches.forEach(match => {
    if (match.team1_player1) allPlayerIds.add(match.team1_player1.id)
    if (match.team1_player2) allPlayerIds.add(match.team1_player2.id)
    if (match.team2_player1) allPlayerIds.add(match.team2_player1.id)
    if (match.team2_player2) allPlayerIds.add(match.team2_player2.id)
  })

  // Get current player data
  const { data: players } = await supabase
    .from('players')
    .select('id, name, rating')
    .in('id', Array.from(allPlayerIds))

  if (!players) return []

  // Initialize stats for each player
  players.forEach(player => {
    playerStatsMap.set(player.id, {
      player_id: player.id,
      player_name: player.name,
      matches_played: 0,
      rating_start: player.rating,
      rating_end: player.rating,
      rating_growth: 0,
      crawls_received: 0,
      crawls_caused: 0
    })
  })

  // Calculate matches played and crawls
  matches.forEach(match => {
    const isCrawlGame = match.is_crawl_game
    const team1Won = match.team1_score > match.team2_score
    
    // Team 1 players
    if (match.team1_player1) {
      const stats = playerStatsMap.get(match.team1_player1.id)
      if (stats) {
        stats.matches_played++
        if (isCrawlGame && team1Won) stats.crawls_caused++
        if (isCrawlGame && !team1Won) stats.crawls_received++
      }
    }
    if (match.team1_player2) {
      const stats = playerStatsMap.get(match.team1_player2.id)
      if (stats) {
        stats.matches_played++
        if (isCrawlGame && team1Won) stats.crawls_caused++
        if (isCrawlGame && !team1Won) stats.crawls_received++
      }
    }
    
    // Team 2 players
    if (match.team2_player1) {
      const stats = playerStatsMap.get(match.team2_player1.id)
      if (stats) {
        stats.matches_played++
        if (isCrawlGame && !team1Won) stats.crawls_caused++
        if (isCrawlGame && team1Won) stats.crawls_received++
      }
    }
    if (match.team2_player2) {
      const stats = playerStatsMap.get(match.team2_player2.id)
      if (stats) {
        stats.matches_played++
        if (isCrawlGame && !team1Won) stats.crawls_caused++
        if (isCrawlGame && team1Won) stats.crawls_received++
      }
    }
  })

  // Calculate rating changes from rating changes table
  const ratingChangesByPlayer = new Map<string, { start: number, total: number }>()
  
  ratingChanges.forEach(change => {
    if (!ratingChangesByPlayer.has(change.player_id)) {
      ratingChangesByPlayer.set(change.player_id, {
        start: change.previous_rating,
        total: 0
      })
    }
    const playerChange = ratingChangesByPlayer.get(change.player_id)!
    playerChange.total += change.rating_change
  })

  // Update rating info
  ratingChangesByPlayer.forEach((ratingInfo, playerId) => {
    const stats = playerStatsMap.get(playerId)
    if (stats) {
      stats.rating_start = ratingInfo.start
      stats.rating_end = ratingInfo.start + ratingInfo.total
      stats.rating_growth = ratingInfo.total
    }
  })

  return Array.from(playerStatsMap.values())
}

function calculatePlayerOfMonth(playerStats: MonthlyStats[]) {
  const playersWithGames = playerStats.filter(p => p.matches_played > 0)
  if (playersWithGames.length === 0) return null
  
  const winner = playersWithGames.reduce((prev, current) => 
    current.rating_growth > prev.rating_growth ? current : prev
  )
  
  if (winner.rating_growth <= 0) return null
  
  return {
    player_id: winner.player_id,
    value: winner.rating_growth,
    description: `Groei van ${winner.rating_start} naar ${winner.rating_end} (+${winner.rating_growth})`
  }
}

function calculateMostActive(playerStats: MonthlyStats[]) {
  const winner = playerStats.reduce((prev, current) => 
    current.matches_played > prev.matches_played ? current : prev
  )
  
  if (winner.matches_played === 0) return null
  
  return {
    player_id: winner.player_id,
    value: winner.matches_played,
    description: `${winner.matches_played} wedstrijden gespeeld`
  }
}

function calculateCrawlerOfMonth(playerStats: MonthlyStats[]) {
  const playersWithCrawls = playerStats.filter(p => p.crawls_received > 0)
  if (playersWithCrawls.length === 0) return null
  
  const winner = playersWithCrawls.reduce((prev, current) => 
    current.crawls_received > prev.crawls_received ? current : prev
  )
  
  return {
    player_id: winner.player_id,
    value: winner.crawls_received,
    description: `${winner.crawls_received} keer onder de tafel gekropen`
  }
}

function calculateGameOfMonth(matches: any[]) {
  if (matches.length === 0) return null
  
  const winner = matches.reduce((prev, current) => {
    const prevImpact = prev.total_rating_change || 0
    const currentImpact = current.total_rating_change || 0
    return currentImpact > prevImpact ? current : prev
  })
  
  if (!winner.total_rating_change || winner.total_rating_change === 0) return null
  
  return {
    match_id: winner.id,
    value: winner.total_rating_change,
    description: `${winner.team1_score}-${winner.team2_score} wedstrijd met grote rating impact`
  }
}

async function insertMonthlyAwards(year: number, month: number, awards: any) {
  // Delete existing awards for this month
  await supabase
    .from('monthly_awards')
    .delete()
    .eq('year', year)
    .eq('month', month)

  const awardsToInsert = []

  if (awards.player_of_month) {
    awardsToInsert.push({
      year,
      month,
      award_type: 'player_of_month',
      player_id: awards.player_of_month.player_id,
      value: awards.player_of_month.value,
      description: awards.player_of_month.description
    })
  }

  if (awards.most_active) {
    awardsToInsert.push({
      year,
      month,
      award_type: 'most_active',
      player_id: awards.most_active.player_id,
      value: awards.most_active.value,
      description: awards.most_active.description
    })
  }

  if (awards.crawler_of_month) {
    awardsToInsert.push({
      year,
      month,
      award_type: 'crawler_of_month',
      player_id: awards.crawler_of_month.player_id,
      value: awards.crawler_of_month.value,
      description: awards.crawler_of_month.description
    })
  }

  if (awards.game_of_month) {
    awardsToInsert.push({
      year,
      month,
      award_type: 'game_of_month',
      match_id: awards.game_of_month.match_id,
      value: awards.game_of_month.value,
      description: awards.game_of_month.description
    })
  }

  if (awardsToInsert.length > 0) {
    const { error } = await supabase
      .from('monthly_awards')
      .insert(awardsToInsert)

    if (error) throw error
  }
}

export async function getAvailableMonths() {
  const { data: matches } = await supabase
    .from('matches')
    .select('created_at')
    .order('created_at', { ascending: true })

  if (!matches || matches.length === 0) return []

  const months = new Set<string>()
  matches.forEach(match => {
    const date = new Date(match.created_at)
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
    months.add(monthKey)
  })

  return Array.from(months).sort()
} 