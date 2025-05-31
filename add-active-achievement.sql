-- =====================================================
-- ADD ACTIVE ACHIEVEMENT SUPPORT TO EXISTING DATABASE
-- =====================================================
-- Run this in your Supabase SQL Editor

-- 1. Add the active_achievement_id column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS active_achievement_id UUID REFERENCES achievements(id);

-- 2. Drop and recreate the player_stats view to include the new column
DROP VIEW IF EXISTS player_stats;

CREATE VIEW player_stats AS
SELECT 
  p.id,
  p.name,
  p.photo_url,
  p.rating,
  p.highest_rating,
  p.goals_scored,
  p.goals_conceded,
  p.wins,
  p.losses,
  p.current_win_streak,
  p.current_loss_streak,
  p.best_win_streak,
  p.crawls,
  p.active_achievement_id,
  p.created_at,
  CASE 
    WHEN (p.wins + p.losses) = 0 THEN 0 
    ELSE ROUND((p.wins::DECIMAL / (p.wins + p.losses)) * 100, 1) 
  END as win_percentage,
  CASE 
    WHEN p.goals_conceded = 0 THEN p.goals_scored 
    ELSE ROUND(p.goals_scored::DECIMAL / p.goals_conceded, 2) 
  END as goal_ratio,
  (p.wins + p.losses) as total_matches
FROM players p;

-- 3. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_players_active_achievement ON players(active_achievement_id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ SUCCESS! Active achievement support added to your database!';
    RAISE NOTICE '🎮 Players can now select their active achievements in their profile!';
    RAISE NOTICE '🏆 Active achievements will show in the leaderboard!';
END $$; 