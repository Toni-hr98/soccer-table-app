-- =====================================================
-- PRODUCTION SOCCER DATABASE RESET WITH ALL FEATURES
-- =====================================================
-- Complete fresh setup with all latest features
-- Run this to completely reset and go to production

-- DEBUG: If achievements aren't working, first try adding the missing 'First Win' achievement:
-- INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value) 
-- VALUES ('First Win', 'Win your first match', '🏆', 'milestone', 'wins', 1)
-- ON CONFLICT (name) DO NOTHING;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop all existing tables (clean slate)
DROP TABLE IF EXISTS player_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS tournament_matches CASCADE;
DROP TABLE IF EXISTS tournament_participants CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS monthly_awards CASCADE;
DROP TABLE IF EXISTS match_player_ratings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Create players table with crawls_caused
CREATE TABLE players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  photo_url TEXT,
  rating INTEGER DEFAULT 1200 NOT NULL,
  highest_rating INTEGER DEFAULT 1200 NOT NULL,
  goals_scored INTEGER DEFAULT 0 NOT NULL,
  goals_conceded INTEGER DEFAULT 0 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  current_win_streak INTEGER DEFAULT 0 NOT NULL,
  current_loss_streak INTEGER DEFAULT 0 NOT NULL,
  best_win_streak INTEGER DEFAULT 0 NOT NULL,
  crawls INTEGER DEFAULT 0 NOT NULL,
  crawls_caused INTEGER DEFAULT 0 NOT NULL,
  active_achievement_id UUID, -- Will add foreign key constraint later
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create users table for authentication
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  player_id UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create matches table (supports both 1vs1 and 2vs2)
CREATE TABLE matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team1_player1 UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team1_player2 UUID REFERENCES players(id) ON DELETE CASCADE, -- NULL for 1vs1
  team2_player1 UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team2_player2 UUID REFERENCES players(id) ON DELETE CASCADE, -- NULL for 1vs1
  team1_score INTEGER NOT NULL CHECK (team1_score >= 0 AND team1_score <= 10),
  team2_score INTEGER NOT NULL CHECK (team2_score >= 0 AND team2_score <= 10),
  total_rating_change INTEGER DEFAULT 0 NOT NULL,
  is_crawl_game BOOLEAN DEFAULT FALSE,
  game_mode VARCHAR(10) DEFAULT 'classic' NOT NULL CHECK (game_mode IN ('classic', 'duel')), -- classic = 2vs2, duel = 1vs1
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure one team reaches 10 and scores are different
  CONSTRAINT valid_score CHECK (
    (team1_score = 10 OR team2_score = 10) AND team1_score != team2_score
  ),
  
  -- Ensure no duplicate players and proper team setup based on game mode
  CONSTRAINT no_duplicate_players_flexible CHECK (
    CASE 
      WHEN game_mode = 'classic' THEN (
        team1_player1 != team1_player2 AND
        team1_player1 != team2_player1 AND
        team1_player1 != team2_player2 AND
        team1_player2 != team2_player1 AND
        team1_player2 != team2_player2 AND
        team2_player1 != team2_player2 AND
        team1_player2 IS NOT NULL AND
        team2_player2 IS NOT NULL
      )
      WHEN game_mode = 'duel' THEN (
        team1_player1 != team2_player1 AND
        team1_player2 IS NULL AND
        team2_player2 IS NULL
      )
      ELSE false
    END
  )
);

-- Create match_player_ratings table for accurate rating history
CREATE TABLE match_player_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating_change INTEGER NOT NULL,
  previous_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(match_id, player_id)
);

-- Create achievements table with unique name constraint
CREATE TABLE achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create player achievements junction table
CREATE TABLE player_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(player_id, achievement_id)
);

-- Create tournaments table
CREATE TABLE tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  tournament_type VARCHAR(20) DEFAULT 'bracket' CHECK (tournament_type IN ('bracket', 'round_robin')),
  max_participants INTEGER DEFAULT 8,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  winner_id UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create tournament participants table
CREATE TABLE tournament_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed INTEGER,
  eliminated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(tournament_id, player_id)
);

-- Create tournament matches table
CREATE TABLE tournament_matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  bracket_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create monthly awards table
CREATE TABLE monthly_awards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  award_type VARCHAR(50) NOT NULL,
  player_id UUID REFERENCES players(id),
  match_id UUID REFERENCES matches(id),
  value INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(year, month, award_type)
);

-- Insert ALL achievements with updated realistic thresholds
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value) VALUES
  -- Milestone achievements
  ('First Win', 'Win your first match', '🏆', 'milestone', 'wins', 1),
  ('Winner', 'Win 5 matches', '🏆', 'milestone', 'wins', 5),
  ('Veteran', 'Play 30 matches', '🎖️', 'milestone', 'games_played', 30),
  ('Centurion', 'Play 50 matches', '💯', 'milestone', 'games_played', 50),
  ('Legend', 'Play 80 matches', '🏛️', 'milestone', 'games_played', 80),
  
  -- Win streak achievements
  ('Hattrick', 'Win 3 matches in a row', '🎩', 'streak', 'win_streak', 3),
  ('Pentakill', 'Win 5 matches in a row', '⚡', 'streak', 'win_streak', 5),
  ('Unstoppable', 'Win 10 matches in a row', '🔥', 'streak', 'win_streak', 10),
  ('Godlike', 'Win 15 matches in a row', '👹', 'streak', 'win_streak', 15),
  ('Beyond Godlike', 'Win 20 matches in a row', '🌟', 'streak', 'win_streak', 20),
  
  -- Losing streak achievements
  ('Rough Patch', 'Lose 3 matches in a row', '😓', 'streak', 'loss_streak', 3),
  ('Slump', 'Lose 5 matches in a row', '📉', 'streak', 'loss_streak', 5),
  ('Cursed', 'Lose 10 matches in a row', '😈', 'streak', 'loss_streak', 10),
  ('Nightmare Mode', 'Lose 15 matches in a row', '💀', 'streak', 'loss_streak', 15),
  ('Rock Bottom', 'Lose 20 matches in a row', '🕳️', 'streak', 'loss_streak', 20),
  
  -- Rating achievements
  ('Newbie', 'Start below 1000 rating', '🌱', 'rating', 'rating_reached', 1000),
  ('Rising Star', 'Reach 1300 rating', '⭐', 'rating', 'rating_reached', 1300),
  ('Elite Player', 'Reach 1400 rating', '💎', 'rating', 'rating_reached', 1400),
  ('Master', 'Reach 1500 rating', '👑', 'rating', 'rating_reached', 1500),
  ('Grandmaster', 'Reach 1600 rating', '🔱', 'rating', 'rating_reached', 1600),
  ('God', 'Reach 1700 rating', '🏅', 'rating', 'rating_reached', 1700),
  
  -- Goal achievements
  ('Prikgarantie', 'Score 50 goals', '⚽', 'goals', 'goals_scored', 50),
  ('Goal Machine', 'Score 100 goals', '⚽', 'goals', 'goals_scored', 100),
  ('Sniper', 'Score 250 goals', '🎯', 'goals', 'goals_scored', 250),
  ('Goal God', 'Score 500 goals', '⚽👑', 'goals', 'goals_scored', 500),
  
  -- Goal average achievements  
  ('Sharp Shooter', 'Average 8+ goals per match (min 10 games)', '🎯', 'goals', 'avg_goals_8', 1),
  ('Goal Machine Pro', 'Average 9+ goals per match (min 20 games)', '⚽👑', 'goals', 'avg_goals_9', 1),
  ('Perfect Shooter', 'Average 10 goals per match (min 10 games)', '💯⚽', 'goals', 'avg_goals_10', 1),
  
  -- Crawl achievements (getting destroyed)
  ('Crawler', 'Lose a match 10-0 or 10-1', '🐛', 'crawl', 'crawl_game', 1),
  ('Serial Crawler', 'Get crawled 5 times', '🐛🐛', 'crawl', 'crawl_games', 5),
  ('Crawl King', 'Get crawled 10 times', '🐛👑', 'crawl', 'crawl_games', 10),
  ('Glutton for Punishment', 'Get crawled 20 times', '🐛💀', 'crawl', 'crawl_games', 20),
  
  -- Destroyer achievements (crawling others)
  ('Executioner', 'Make 1 opponent crawl', '⚔️', 'crawl_others', 'crawls_caused', 1),
  ('Destroyer', 'Make 5 opponents crawl', '💀', 'crawl_others', 'crawls_caused', 5),
  ('Terminator', 'Make 10 opponents crawl', '🤖', 'crawl_others', 'crawls_caused', 10),
  ('Nightmare', 'Make 25 opponents crawl', '👹', 'crawl_others', 'crawls_caused', 25),
  
  -- Crawl defense achievements
  ('Crawl Dodger', 'Play 15 games without getting crawled', '🛡️', 'crawl_defense', 'no_crawl_15', 1),
  ('Uncrawlable', 'Play 30 games without getting crawled', '🏰', 'crawl_defense', 'no_crawl_30', 1),
  
  -- Mixed crawl achievements
  ('Crawl Veteran', 'Experience 30 total crawl games (given + received)', '🐛⚡', 'crawl_total', 'total_crawls_30', 1),
  ('Glass Cannon', 'High average goals but also high crawls received', '💎💥', 'special', 'glass_cannon', 1),
  
  -- Noob Killer achievements (beating lower rated players)
  ('Noob Killer', 'Beat 10 players with 200+ rating difference', '🔪', 'noob_killer', 'noob_kills', 10),
  ('Bully', 'Beat 25 players with 200+ rating difference', '😈', 'noob_killer', 'noob_kills', 25),
  ('Seal Clubber', 'Beat 50 players with 200+ rating difference', '🦭🏒', 'noob_killer', 'noob_kills', 50),
  
  -- David vs Goliath (beating higher rated players)
  ('Giant Slayer', 'Beat 10 players with 200+ higher rating', '🪨', 'giant_slayer', 'giant_kills', 10),
  ('Dragon Slayer', 'Beat 25 players with 200+ higher rating', '🐉', 'giant_slayer', 'giant_kills', 25),
  ('God Slayer', 'Beat 50 players with 200+ higher rating', '⚡👑', 'giant_slayer', 'giant_kills', 50),
  
  -- 1vs1 Duel specific achievements
  ('Duelist', 'Win your first 1vs1 match', '⚔️', 'duel', 'duel_wins', 1),
  ('Duel Master', 'Win 25 duel matches', '🤺', 'duel', 'duel_wins', 25),
  ('Sword Saint', 'Win 100 duel matches', '⚔️👑', 'duel', 'duel_wins', 100),
  ('Lone Wolf', 'Win 10 duels in a row', '🐺', 'duel', 'duel_streak', 10),
  ('Duel God', 'Win 20 duels in a row', '⚔️🌟', 'duel', 'duel_streak', 20),
  
  -- 2vs2 Classic specific achievements  
  ('Team Player', 'Win 25 classic matches', '👥', 'classic', 'classic_wins', 25),
  ('Dynamic Duo', 'Win 100 classic matches', '👫', 'classic', 'classic_wins', 100),
  ('Squad Goals', 'Win 10 classic matches in a row', '💪', 'classic', 'classic_streak', 10),
  
  -- Special achievements
  ('Comeback King', 'Win 10 matches after being 5+ goals behind', '🔄', 'special', 'comebacks', 10),
  ('Perfectionist', 'Win 5 matches without conceding', '💯', 'special', 'clean_sheets', 5),
  ('Never Give Up', 'Win a match after being 8+ goals behind', '💪⚡', 'special', 'epic_comeback', 1),
  ('Speed Demon', 'Win a match in under 3 minutes', '💨', 'special', 'quick_win', 1),
  ('Marathon Man', 'Play a match longer than 15 minutes', '⏰', 'special', 'long_match', 1),
  
  -- Consistency achievements
  ('Consistent', 'Win 80% of matches (min 20 games)', '📊', 'consistency', 'win_rate_80', 1),
  ('Elite Consistency', 'Win 90% of matches (min 50 games)', '📈', 'consistency', 'win_rate_90', 1),
  ('Unbeatable', 'Win 95% of matches (min 100 games)', '🛡️', 'consistency', 'win_rate_95', 1),
  
  -- Fun achievements
  ('Lucky Seven', 'Win exactly 7-7 then score winning goal', '🍀', 'fun', 'lucky_seven', 1),
  ('Double Trouble', 'Score exactly double opponent''s goals', '✌️', 'fun', 'double_score', 5),
  ('Houdini', 'Win after opponent reaches 9 goals', '🎩✨', 'fun', 'escape_artist', 1),
  ('Goal Machine Gun', 'Score 8+ goals in a single match', '🔫⚽', 'fun', 'high_scorer', 1),
  ('Fortress', 'Concede 0 goals in 10 different matches', '🏰', 'fun', 'fortress', 1),
  
  -- Streak stopper achievements
  ('Streak Breaker', 'Stop someone''s 3+ win streak', '🛑', 'streak_stopper', 'stop_streak_3', 1),
  ('Hot Streak Killer', 'Stop someone''s 5+ win streak', '🧯', 'streak_stopper', 'stop_streak_5', 1),
  ('Momentum Crusher', 'Stop someone''s 10+ win streak', '💥', 'streak_stopper', 'stop_streak_10', 1),
  ('Godlike Slayer', 'Stop someone''s 15+ win streak', '⚔️👹', 'streak_stopper', 'stop_streak_15', 1),
  ('Legend Killer', 'Stop someone''s 20+ win streak', '🗡️👑', 'streak_stopper', 'stop_streak_20', 1);

-- Add foreign key constraint for active_achievement_id now that achievements table exists
ALTER TABLE players ADD CONSTRAINT fk_players_active_achievement 
FOREIGN KEY (active_achievement_id) REFERENCES achievements(id);

-- Create head to head stats view (supports both game modes)
CREATE OR REPLACE VIEW head_to_head_stats AS
SELECT 
  p1.id as player1_id,
  p1.name as player1_name,
  p2.id as player2_id,
  p2.name as player2_name,
  COUNT(*) as total_matches,
  SUM(CASE 
    WHEN (m.team1_player1 = p1.id OR m.team1_player2 = p1.id) AND m.team1_score > m.team2_score THEN 1
    WHEN (m.team2_player1 = p1.id OR m.team2_player2 = p1.id) AND m.team2_score > m.team1_score THEN 1
    ELSE 0
  END) as player1_wins,
  SUM(CASE 
    WHEN (m.team1_player1 = p2.id OR m.team1_player2 = p2.id) AND m.team1_score > m.team2_score THEN 1
    WHEN (m.team2_player1 = p2.id OR m.team2_player2 = p2.id) AND m.team2_score > m.team1_score THEN 1
    ELSE 0
  END) as player2_wins,
  SUM(CASE WHEN m.game_mode = 'classic' THEN 1 ELSE 0 END) as classic_matches,
  SUM(CASE WHEN m.game_mode = 'duel' THEN 1 ELSE 0 END) as duel_matches
FROM players p1
CROSS JOIN players p2
LEFT JOIN matches m ON (
  (m.team1_player1 = p1.id OR m.team1_player2 = p1.id OR m.team2_player1 = p1.id OR m.team2_player2 = p1.id) AND
  (m.team1_player1 = p2.id OR m.team1_player2 = p2.id OR m.team2_player1 = p2.id OR m.team2_player2 = p2.id) AND
  p1.id != p2.id
)
WHERE p1.id < p2.id
GROUP BY p1.id, p1.name, p2.id, p2.name
HAVING COUNT(*) > 0;

-- Create enhanced player stats view with crawls_caused
CREATE OR REPLACE VIEW player_stats AS
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
  p.crawls_caused,
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
  CASE 
    WHEN (p.wins + p.losses) = 0 THEN 0 
    ELSE ROUND((p.goals_scored::DECIMAL / (p.wins + p.losses)), 2) 
  END as avg_goals_per_match,
  (p.wins + p.losses) as total_matches,
  (p.crawls + p.crawls_caused) as total_crawl_games
FROM players p;

-- Function to get recent form (supports both game modes)
CREATE OR REPLACE FUNCTION get_recent_form(player_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  recent_matches RECORD;
  form_string TEXT := '';
BEGIN
  FOR recent_matches IN
    SELECT 
      CASE 
        WHEN (team1_player1 = player_uuid OR (team1_player2 = player_uuid AND team1_player2 IS NOT NULL)) AND team1_score > team2_score THEN 'W'
        WHEN (team2_player1 = player_uuid OR (team2_player2 = player_uuid AND team2_player2 IS NOT NULL)) AND team2_score > team1_score THEN 'W'
        ELSE 'L'
      END as result
    FROM matches 
    WHERE team1_player1 = player_uuid 
       OR (team1_player2 = player_uuid AND team1_player2 IS NOT NULL)
       OR team2_player1 = player_uuid 
       OR (team2_player2 = player_uuid AND team2_player2 IS NOT NULL)
    ORDER BY created_at DESC 
    LIMIT 5
  LOOP
    form_string := form_string || recent_matches.result;
  END LOOP;
  
  RETURN form_string;
END;
$$ LANGUAGE plpgsql;

-- Create storage bucket for player photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Users can update their own photos" ON storage.objects FOR UPDATE USING (bucket_id = 'photos');
CREATE POLICY "Users can delete their own photos" ON storage.objects FOR DELETE USING (bucket_id = 'photos');

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_awards ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust for production security as needed)
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON users FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON players FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON players FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON players FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON matches FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON matches FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON matches FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON match_player_ratings FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON match_player_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON match_player_ratings FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON match_player_ratings FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON achievements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON achievements FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON achievements FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON player_achievements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON player_achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON player_achievements FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON player_achievements FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournaments FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournament_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournament_participants FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournament_participants FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournament_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournament_matches FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournament_matches FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON monthly_awards FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON monthly_awards FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON monthly_awards FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON monthly_awards FOR DELETE USING (true);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_win_streak ON players(current_win_streak DESC);
CREATE INDEX IF NOT EXISTS idx_players_best_streak ON players(best_win_streak DESC);
CREATE INDEX IF NOT EXISTS idx_players_crawls_caused ON players(crawls_caused DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(team1_player1, team1_player2, team2_player1, team2_player2);
CREATE INDEX IF NOT EXISTS idx_matches_crawl ON matches(is_crawl_game);
CREATE INDEX IF NOT EXISTS idx_matches_game_mode ON matches(game_mode);
CREATE INDEX IF NOT EXISTS idx_match_player_ratings_match_player ON match_player_ratings(match_id, player_id);
CREATE INDEX IF NOT EXISTS idx_match_player_ratings_player_created ON match_player_ratings(player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_monthly_awards_date ON monthly_awards(year, month);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id);

-- Insert initial admin user (toni) and create their player profile
DO $$
DECLARE
  toni_player_id UUID;
BEGIN
  -- First, create toni's player profile
  INSERT INTO players (name) VALUES ('Toni')
  ON CONFLICT (name) DO NOTHING;
  
  -- Get toni's player ID
  SELECT id INTO toni_player_id FROM players WHERE name = 'Toni';
  
  -- Create toni's user account with corrected password
  INSERT INTO users (name, password, is_admin, player_id) 
  VALUES ('Toni', 'unicornDevelopers', true, toni_player_id)
  ON CONFLICT (name) DO UPDATE SET 
    password = EXCLUDED.password,
    is_admin = EXCLUDED.is_admin,
    player_id = EXCLUDED.player_id;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 PRODUCTION DATABASE RESET SUCCESSFUL!';
    RAISE NOTICE '✅ All tables created with latest schema';
    RAISE NOTICE '✅ All 60+ achievements loaded with realistic thresholds';
    RAISE NOTICE '✅ Enhanced rating tracking with match_player_ratings';
    RAISE NOTICE '✅ Crawls_caused tracking enabled';
    RAISE NOTICE '✅ Average goals per match calculation';
    RAISE NOTICE '✅ 1vs1 and 2vs2 support fully enabled';
    RAISE NOTICE '✅ Performance indexes created';
    RAISE NOTICE '👤 Admin user "Toni" created with password "unicornDevelopers"';
    RAISE NOTICE '🚀 READY FOR PRODUCTION!';
END $$; 