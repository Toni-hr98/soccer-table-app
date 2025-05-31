-- Migration to add match_player_ratings table and enhance crawling statistics
-- Run this on existing databases to add support for accurate rating history tracking

-- Create match_player_ratings table if it doesn't exist
CREATE TABLE IF NOT EXISTS match_player_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating_change INTEGER NOT NULL,
  previous_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(match_id, player_id)
);

-- Add crawls_caused column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS crawls_caused INTEGER DEFAULT 0 NOT NULL;

-- Backfill crawls_caused data from existing matches
UPDATE players SET crawls_caused = (
  SELECT COUNT(*)
  FROM matches m
  WHERE m.is_crawl_game = true
  AND (
    -- Player was on winning team in crawl game
    (m.team1_score > m.team2_score AND (m.team1_player1 = players.id OR m.team1_player2 = players.id))
    OR
    (m.team2_score > m.team1_score AND (m.team2_player1 = players.id OR m.team2_player2 = players.id))
  )
) WHERE crawls_caused = 0;

-- Add unique constraint to achievements name column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'achievements_name_unique'
  ) THEN
    ALTER TABLE achievements ADD CONSTRAINT achievements_name_unique UNIQUE (name);
  END IF;
END $$;

-- Add new crawl-related achievements
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value) VALUES
  -- Basic achievements that might be missing
  ('Newbie', 'Start below 1000 rating', '🌱', 'rating', 'rating_reached', 1000),
  
  -- Crawling others achievements
  ('Executioner', 'Make 1 opponent crawl', '⚔️', 'crawl_others', 'crawls_caused', 1),
  ('Destroyer', 'Make 5 opponents crawl', '💀', 'crawl_others', 'crawls_caused', 5),
  ('Terminator', 'Make 10 opponents crawl', '🤖', 'crawl_others', 'crawls_caused', 10),
  ('Nightmare', 'Make 25 opponents crawl', '👹', 'crawl_others', 'crawls_caused', 25),
  
  -- Goal scoring achievements  
  ('Prikgarantie', 'Score 50 goals', '⚽', 'goals', 'goals_scored', 50),
  ('Sharp Shooter', 'Average 8+ goals per match (min 10 games)', '🎯', 'goals', 'avg_goals_8', 1),
  ('Goal Machine Pro', 'Average 9+ goals per match (min 20 games)', '⚽👑', 'goals', 'avg_goals_9', 1),
  ('Perfect Shooter', 'Average 10 goals per match (min 10 games)', '💯⚽', 'goals', 'avg_goals_10', 1),
  
  -- Crawl defense achievements
  ('Crawl Dodger', 'Play 15 games without getting crawled', '🛡️', 'crawl_defense', 'no_crawl_15', 1),
  ('Uncrawlable', 'Play 30 games without getting crawled', '🏰', 'crawl_defense', 'no_crawl_30', 1),
  
  -- Mixed achievements
  ('Crawl Veteran', 'Experience 30 total crawl games (given + received)', '🐛⚡', 'crawl_total', 'total_crawls_30', 1),
  ('Glass Cannon', 'High average goals but also high crawls received', '💎💥', 'special', 'glass_cannon', 1)
ON CONFLICT (name) DO NOTHING;

-- Optional: Populate match_player_ratings with estimated data for existing matches
-- This is a best-effort estimation based on total_rating_change
-- Comment out this section if you prefer to start fresh with new matches only

INSERT INTO match_player_ratings (match_id, player_id, rating_change, previous_rating, new_rating, created_at)
SELECT 
  m.id as match_id,
  CASE 
    WHEN p.id = m.team1_player1 OR p.id = m.team1_player2 THEN p.id
    ELSE p.id
  END as player_id,
  CASE 
    WHEN (p.id = m.team1_player1 OR p.id = m.team1_player2) AND m.team1_score > m.team2_score THEN 
      -- Winner estimation
      ROUND(ABS(m.total_rating_change) / CASE WHEN m.game_mode = 'duel' THEN 2 ELSE 4 END)
    WHEN (p.id = m.team2_player1 OR p.id = m.team2_player2) AND m.team2_score > m.team1_score THEN 
      -- Winner estimation  
      ROUND(ABS(m.total_rating_change) / CASE WHEN m.game_mode = 'duel' THEN 2 ELSE 4 END)
    ELSE 
      -- Loser estimation (negative)
      -ROUND(ABS(m.total_rating_change) / CASE WHEN m.game_mode = 'duel' THEN 2 ELSE 4 END)
  END as rating_change,
  -- Estimate previous rating (this is very rough)
  p.rating - CASE 
    WHEN (p.id = m.team1_player1 OR p.id = m.team1_player2) AND m.team1_score > m.team2_score THEN 
      ROUND(ABS(m.total_rating_change) / CASE WHEN m.game_mode = 'duel' THEN 2 ELSE 4 END)
    WHEN (p.id = m.team2_player1 OR p.id = m.team2_player2) AND m.team2_score > m.team1_score THEN 
      ROUND(ABS(m.total_rating_change) / CASE WHEN m.game_mode = 'duel' THEN 2 ELSE 4 END)
    ELSE 
      -ROUND(ABS(m.total_rating_change) / CASE WHEN m.game_mode = 'duel' THEN 2 ELSE 4 END)
  END as previous_rating,
  p.rating as new_rating,
  m.created_at
FROM matches m
CROSS JOIN players p
WHERE (
  p.id = m.team1_player1 OR 
  p.id = m.team1_player2 OR 
  p.id = m.team2_player1 OR 
  p.id = m.team2_player2
)
AND NOT EXISTS (
  SELECT 1 FROM match_player_ratings mpr 
  WHERE mpr.match_id = m.id AND mpr.player_id = p.id
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_player_ratings_match_player 
ON match_player_ratings(match_id, player_id);

CREATE INDEX IF NOT EXISTS idx_match_player_ratings_player_created 
ON match_player_ratings(player_id, created_at);

-- Add index for crawls analysis
CREATE INDEX IF NOT EXISTS idx_matches_crawl_game ON matches(is_crawl_game);
CREATE INDEX IF NOT EXISTS idx_players_crawls_caused ON players(crawls_caused DESC);

-- Create view for enhanced player statistics
CREATE OR REPLACE VIEW enhanced_player_stats AS
SELECT 
  p.*,
  CASE 
    WHEN (p.wins + p.losses) = 0 THEN 0 
    ELSE ROUND((p.goals_scored::DECIMAL / (p.wins + p.losses)), 2) 
  END as avg_goals_per_match,
  CASE 
    WHEN (p.wins + p.losses) = 0 THEN 0 
    ELSE ROUND((p.goals_conceded::DECIMAL / (p.wins + p.losses)), 2) 
  END as avg_goals_conceded_per_match,
  (p.crawls + p.crawls_caused) as total_crawl_games,
  CASE 
    WHEN p.crawls = 0 THEN 0
    ELSE ROUND((p.crawls_caused::DECIMAL / p.crawls), 2)
  END as crawl_ratio
FROM players p;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced rating and crawl tracking migration completed!';
    RAISE NOTICE '📊 Added crawls_caused column and backfilled data';
    RAISE NOTICE '🏆 Added new achievements for crawling others and goal averages';
    RAISE NOTICE '📈 Created enhanced_player_stats view with avg goals per match';
    RAISE NOTICE '⚡ Added performance indexes';
END $$; 