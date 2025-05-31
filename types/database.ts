export interface Player {
  id: string
  name: string
  photo_url?: string
  rating: number
  highest_rating: number
  goals_scored: number
  goals_conceded: number
  wins: number
  losses: number
  current_win_streak: number
  current_loss_streak: number
  best_win_streak: number
  crawls: number
  crawls_caused: number
  active_achievement_id?: string
  created_at: string
}

export interface Match {
  id: string
  team1_player1: string
  team1_player2: string | null
  team2_player1: string
  team2_player2: string | null
  team1_score: number
  team2_score: number
  total_rating_change: number
  is_crawl_game: boolean
  game_mode: 'classic' | 'duel'
  created_at: string
}

export interface MatchPlayerRating {
  id: string
  match_id: string
  player_id: string
  rating_change: number
  previous_rating: number
  new_rating: number
  created_at: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'streak' | 'rating' | 'games' | 'special' | 'milestone' | 'goals'
  requirement_type: string
  requirement_value: number
  created_at: string
}

export interface PlayerAchievement {
  id: string
  player_id: string
  achievement_id: string
  achieved_at: string
  achievement?: Achievement
}

export interface Tournament {
  id: string
  name: string
  description?: string
  status: 'upcoming' | 'active' | 'completed'
  tournament_type: 'bracket' | 'round_robin'
  max_participants: number
  start_date?: string
  end_date?: string
  winner_id?: string
  created_at: string
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  player_id: string
  seed?: number
  eliminated_at?: string
  player?: Player
}

export interface TournamentMatch {
  id: string
  tournament_id: string
  match_id: string
  round: number
  bracket_position?: number
  created_at: string
  match?: Match
}

export interface MonthlyAward {
  id: string
  year: number
  month: number
  award_type: 'player_of_month' | 'crawler_of_month' | 'most_active' | 'game_of_month'
  player_id?: string
  match_id?: string
  value?: number
  description?: string
  created_at: string
  player?: Player
  match?: Match
}

export interface HeadToHeadStats {
  player1_id: string
  player1_name: string
  player2_id: string
  player2_name: string
  total_matches: number
  player1_wins: number
  player2_wins: number
}

export interface PlayerStats extends Player {
  matches_played: number
  win_ratio: number
  goal_ratio: number
  current_streak: number
  streak_type: 'win' | 'loss' | 'none'
  recent_form: ('W' | 'L')[]
  achievement_count: number
  achievements?: PlayerAchievement[]
  monthly_awards?: MonthlyAward[]
  total_matches: number
  last_rating_change: number
  recent_achievement?: PlayerAchievement | null
  active_achievement?: PlayerAchievement | null
  recent_monthly_award?: MonthlyAward | null
}

export interface Team {
  player1: Player
  player2: Player
  combined_rating: number
}

export interface MatchResult {
  team1: Team
  team2: Team
  team1_score: number
  team2_score: number
  rating_changes: {
    [playerId: string]: number
  }
  is_crawl_game: boolean
  total_rating_change: number
}

export interface HallOfFameRecord {
  type: 'best_streak' | 'highest_rating' | 'most_crawls' | 'player_of_year'
  player: Player
  value: number
  description: string
  achieved_at?: string
}

export interface MonthlyStats {
  year: number
  month: number
  player_of_month?: MonthlyAward
  crawler_of_month?: MonthlyAward
  most_active?: MonthlyAward
  game_of_month?: MonthlyAward
} 