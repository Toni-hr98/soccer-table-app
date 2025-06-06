export type Player = {
  id: string
  name: string
  photo: string
  king_photo: string | null
  rating: number
  games_played: number
  wins: number
  losses: number
  win_streak: number
  best_win_streak: number
  created_at: string
  updated_at: string
} 