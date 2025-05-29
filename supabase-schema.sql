-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- In production, this should be hashed
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  player_id UUID REFERENCES players(id), -- Link to their player profile
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
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
  crawls INTEGER DEFAULT 0 NOT NULL, -- Times had to crawl under table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team1_player1 UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team1_player2 UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team2_player1 UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team2_player2 UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team1_score INTEGER NOT NULL CHECK (team1_score >= 0 AND team1_score <= 10),
  team2_score INTEGER NOT NULL CHECK (team2_score >= 0 AND team2_score <= 10),
  total_rating_change INTEGER DEFAULT 0 NOT NULL, -- For game of the month tracking
  is_crawl_game BOOLEAN DEFAULT FALSE, -- 10-0 or 10-1 games
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure one team reaches 10 and scores are different
  CONSTRAINT valid_score CHECK (
    (team1_score = 10 OR team2_score = 10) AND team1_score != team2_score
  ),
  
  -- Ensure no player plays against themselves
  CONSTRAINT no_duplicate_players CHECK (
    team1_player1 != team1_player2 AND
    team1_player1 != team2_player1 AND
    team1_player1 != team2_player2 AND
    team1_player2 != team2_player1 AND
    team1_player2 != team2_player2 AND
    team2_player1 != team2_player2
  )
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'streak', 'rating', 'games', 'special'
  requirement_type VARCHAR(50) NOT NULL, -- 'win_streak', 'rating_reached', 'games_played', etc.
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create player achievements junction table
CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(player_id, achievement_id)
);

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
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
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed INTEGER,
  eliminated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(tournament_id, player_id)
);

-- Create tournament matches table
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  bracket_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create monthly awards table
CREATE TABLE IF NOT EXISTS monthly_awards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  award_type VARCHAR(50) NOT NULL, -- 'player_of_month', 'crawler_of_month', 'most_active', 'game_of_month'
  player_id UUID REFERENCES players(id),
  match_id UUID REFERENCES matches(id), -- For game of the month
  value INTEGER, -- Rating growth, games played, etc.
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(year, month, award_type)
);

-- Create head to head stats view
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
  END) as player2_wins
FROM players p1
CROSS JOIN players p2
LEFT JOIN matches m ON (
  (m.team1_player1 = p1.id OR m.team1_player2 = p1.id OR m.team2_player1 = p1.id OR m.team2_player2 = p1.id) AND
  (m.team1_player1 = p2.id OR m.team1_player2 = p2.id OR m.team2_player1 = p2.id OR m.team2_player2 = p2.id) AND
  p1.id != p2.id
)
WHERE p1.id < p2.id -- Avoid duplicates
GROUP BY p1.id, p1.name, p2.id, p2.name
HAVING COUNT(*) > 0;

-- Insert default achievements (only if they don't exist)
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value) 
SELECT * FROM (VALUES
  ('First Win', 'Win your first match', '🏆', 'milestone', 'wins', 1),
  ('Hat Trick', 'Win 3 matches in a row', '🎩', 'streak', 'win_streak', 3),
  ('Pentakill', 'Win 5 matches in a row', '⚡', 'streak', 'win_streak', 5),
  ('Unstoppable', 'Win 10 matches in a row', '🔥', 'streak', 'win_streak', 10),
  ('Rising Star', 'Reach 1300 rating', '⭐', 'rating', 'rating_reached', 1300),
  ('Elite Player', 'Reach 1500 rating', '💎', 'rating', 'rating_reached', 1500),
  ('Legend', 'Reach 1700 rating', '👑', 'rating', 'rating_reached', 1700),
  ('Veteran', 'Play 50 matches', '🎖️', 'games', 'games_played', 50),
  ('Centurion', 'Play 100 matches', '💯', 'games', 'games_played', 100),
  ('Goal Machine', 'Score 100 goals', '⚽', 'goals', 'goals_scored', 100),
  ('Crawler', 'Lose a match 10-0 or 10-1', '🐛', 'special', 'crawl_game', 1),
  ('Destroyer', 'Win a match 10-0 or 10-1', '💀', 'special', 'destroy_game', 1)
) AS new_achievements(name, description, icon, category, requirement_type, requirement_value)
WHERE NOT EXISTS (
  SELECT 1 FROM achievements WHERE achievements.name = new_achievements.name
);

-- Create storage bucket for player photos (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Users can update their own photos" ON storage.objects FOR UPDATE USING (bucket_id = 'photos');
CREATE POLICY "Users can delete their own photos" ON storage.objects FOR DELETE USING (bucket_id = 'photos');

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_awards ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (drop and recreate to avoid conflicts)
-- Users policies
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON users;
DROP POLICY IF EXISTS "Enable update access for all users" ON users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON users;

CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON users FOR DELETE USING (true);

-- Players policies
DROP POLICY IF EXISTS "Enable read access for all users" ON players;
DROP POLICY IF EXISTS "Enable insert access for all users" ON players;
DROP POLICY IF EXISTS "Enable update access for all users" ON players;
DROP POLICY IF EXISTS "Enable delete access for all users" ON players;

CREATE POLICY "Enable read access for all users" ON players FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON players FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON players FOR DELETE USING (true);

-- Matches policies
DROP POLICY IF EXISTS "Enable read access for all users" ON matches;
DROP POLICY IF EXISTS "Enable insert access for all users" ON matches;
DROP POLICY IF EXISTS "Enable update access for all users" ON matches;
DROP POLICY IF EXISTS "Enable delete access for all users" ON matches;

CREATE POLICY "Enable read access for all users" ON matches FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON matches FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON matches FOR DELETE USING (true);

-- Achievements policies
DROP POLICY IF EXISTS "Enable read access for all users" ON achievements;
DROP POLICY IF EXISTS "Enable insert access for all users" ON achievements;
DROP POLICY IF EXISTS "Enable update access for all users" ON achievements;
DROP POLICY IF EXISTS "Enable delete access for all users" ON achievements;

CREATE POLICY "Enable read access for all users" ON achievements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON achievements FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON achievements FOR DELETE USING (true);

-- Player achievements policies
DROP POLICY IF EXISTS "Enable read access for all users" ON player_achievements;
DROP POLICY IF EXISTS "Enable insert access for all users" ON player_achievements;
DROP POLICY IF EXISTS "Enable update access for all users" ON player_achievements;
DROP POLICY IF EXISTS "Enable delete access for all users" ON player_achievements;

CREATE POLICY "Enable read access for all users" ON player_achievements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON player_achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON player_achievements FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON player_achievements FOR DELETE USING (true);

-- Tournament policies
DROP POLICY IF EXISTS "Enable read access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable insert access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable update access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable delete access for all users" ON tournaments;

CREATE POLICY "Enable read access for all users" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournaments FOR DELETE USING (true);

-- Tournament participants policies
DROP POLICY IF EXISTS "Enable read access for all users" ON tournament_participants;
DROP POLICY IF EXISTS "Enable insert access for all users" ON tournament_participants;
DROP POLICY IF EXISTS "Enable update access for all users" ON tournament_participants;
DROP POLICY IF EXISTS "Enable delete access for all users" ON tournament_participants;

CREATE POLICY "Enable read access for all users" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournament_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournament_participants FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournament_participants FOR DELETE USING (true);

-- Tournament matches policies
DROP POLICY IF EXISTS "Enable read access for all users" ON tournament_matches;
DROP POLICY IF EXISTS "Enable insert access for all users" ON tournament_matches;
DROP POLICY IF EXISTS "Enable update access for all users" ON tournament_matches;
DROP POLICY IF EXISTS "Enable delete access for all users" ON tournament_matches;

CREATE POLICY "Enable read access for all users" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournament_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournament_matches FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournament_matches FOR DELETE USING (true);

-- Monthly awards policies
DROP POLICY IF EXISTS "Enable read access for all users" ON monthly_awards;
DROP POLICY IF EXISTS "Enable insert access for all users" ON monthly_awards;
DROP POLICY IF EXISTS "Enable update access for all users" ON monthly_awards;
DROP POLICY IF EXISTS "Enable delete access for all users" ON monthly_awards;

CREATE POLICY "Enable read access for all users" ON monthly_awards FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON monthly_awards FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON monthly_awards FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON monthly_awards FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_win_streak ON players(current_win_streak DESC);
CREATE INDEX IF NOT EXISTS idx_players_best_streak ON players(best_win_streak DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(team1_player1, team1_player2, team2_player1, team2_player2);
CREATE INDEX IF NOT EXISTS idx_matches_crawl ON matches(is_crawl_game);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_monthly_awards_date ON monthly_awards(year, month);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id);

-- Create player stats view with comprehensive statistics
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

-- Function to get recent form (last 5 matches)
CREATE OR REPLACE FUNCTION get_recent_form(player_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  recent_matches RECORD;
  form_string TEXT := '';
BEGIN
  FOR recent_matches IN
    SELECT 
      CASE 
        WHEN (team1_player1 = player_uuid OR team1_player2 = player_uuid) AND team1_score > team2_score THEN 'W'
        WHEN (team2_player1 = player_uuid OR team2_player2 = player_uuid) AND team2_score > team1_score THEN 'W'
        ELSE 'L'
      END as result
    FROM matches 
    WHERE team1_player1 = player_uuid OR team1_player2 = player_uuid 
       OR team2_player1 = player_uuid OR team2_player2 = player_uuid
    ORDER BY created_at DESC 
    LIMIT 5
  LOOP
    form_string := form_string || recent_matches.result;
  END LOOP;
  
  RETURN form_string;
END;
$$ LANGUAGE plpgsql;

-- Insert initial admin user (toni) and create their player profile
DO $$
DECLARE
  toni_player_id UUID;
BEGIN
  -- First, create or find toni's player profile
  INSERT INTO players (name) VALUES ('toni')
  ON CONFLICT (name) DO NOTHING;
  
  -- Get toni's player ID
  SELECT id INTO toni_player_id FROM players WHERE name = 'toni';
  
  -- Create toni's user account
  INSERT INTO users (name, password, is_admin, player_id) 
  VALUES ('toni', 'unicornDeveloper', true, toni_player_id)
  ON CONFLICT (name) DO UPDATE SET 
    password = EXCLUDED.password,
    is_admin = EXCLUDED.is_admin,
    player_id = EXCLUDED.player_id;
END $$; 