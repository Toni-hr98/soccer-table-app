-- =====================================================
-- 1VS1 GAME MODE UPDATE FOR EXISTING DATABASE
-- =====================================================
-- Run this script in your Supabase SQL editor to add 1vs1 support
-- This is safe to run on an existing database with data

-- First, check if game_mode column exists and what its current state is
DO $$
BEGIN
    -- Check if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'game_mode') THEN
        RAISE NOTICE 'game_mode column already exists, updating it...';
        
        -- Drop existing check constraint if it exists
        ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_game_mode_check;
        
        -- Update any existing '2v2' values to 'classic'
        UPDATE matches SET game_mode = 'classic' WHERE game_mode = '2v2' OR game_mode IS NULL;
        
        -- Change the default value
        ALTER TABLE matches ALTER COLUMN game_mode SET DEFAULT 'classic';
        
    ELSE
        RAISE NOTICE 'Creating new game_mode column...';
        -- Add the column with correct default
        ALTER TABLE matches ADD COLUMN game_mode VARCHAR(10) DEFAULT 'classic';
    END IF;
END $$;

-- Now add the correct check constraint
ALTER TABLE matches ADD CONSTRAINT matches_game_mode_check CHECK (game_mode IN ('classic', 'duel'));

-- Make sure all existing matches are set to 'classic' (2vs2)
UPDATE matches SET game_mode = 'classic' WHERE game_mode IS NULL OR game_mode = '2v2';

-- Make the column NOT NULL after updating existing records
ALTER TABLE matches ALTER COLUMN game_mode SET NOT NULL;

-- Update foreign key constraints to allow NULL for 1vs1 BEFORE adding the new constraint
ALTER TABLE matches ALTER COLUMN team1_player2 DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN team2_player2 DROP NOT NULL;

-- Check for problematic data and show it
DO $$
DECLARE
    problematic_count INTEGER;
    rec RECORD;
BEGIN
    -- Count rows that would violate the new constraint
    SELECT COUNT(*) INTO problematic_count
    FROM matches 
    WHERE game_mode = 'classic' 
    AND (
        team1_player2 IS NULL 
        OR team2_player2 IS NULL
        OR team1_player1 = team1_player2 
        OR team1_player1 = team2_player1 
        OR team1_player1 = team2_player2 
        OR team1_player2 = team2_player1 
        OR team1_player2 = team2_player2 
        OR team2_player1 = team2_player2
    );
    
    IF problematic_count > 0 THEN
        RAISE NOTICE 'Found % matches that would violate the constraint. These need to be fixed first.', problematic_count;
        
        -- Show the problematic matches
        RAISE NOTICE 'Problematic matches:';
        FOR rec IN 
            SELECT id, team1_player1, team1_player2, team2_player1, team2_player2 
            FROM matches 
            WHERE game_mode = 'classic' 
            AND (
                team1_player2 IS NULL 
                OR team2_player2 IS NULL
                OR team1_player1 = team1_player2 
                OR team1_player1 = team2_player1 
                OR team1_player1 = team2_player2 
                OR team1_player2 = team2_player1 
                OR team1_player2 = team2_player2 
                OR team2_player1 = team2_player2
            )
        LOOP
            RAISE NOTICE 'Match ID: %, Team1: % & %, Team2: % & %', 
                rec.id, rec.team1_player1, rec.team1_player2, rec.team2_player1, rec.team2_player2;
        END LOOP;
        
        RAISE EXCEPTION 'Cannot add constraint due to existing invalid data. Please fix the above matches first.';
    ELSE
        RAISE NOTICE 'All existing matches are valid for the new constraint.';
    END IF;
END $$;

-- Update the existing constraint to allow 1vs1 matches
ALTER TABLE matches DROP CONSTRAINT IF EXISTS no_duplicate_players;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS no_duplicate_players_flexible;

-- Add new constraint that handles both 2vs2 and 1vs1
ALTER TABLE matches ADD CONSTRAINT no_duplicate_players_flexible CHECK (
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
);

-- Add index for game_mode for better performance
CREATE INDEX IF NOT EXISTS idx_matches_game_mode ON matches(game_mode);

-- Update the head_to_head_stats view to handle both game modes
DROP VIEW IF EXISTS head_to_head_stats;

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
WHERE p1.id < p2.id -- Avoid duplicates
GROUP BY p1.id, p1.name, p2.id, p2.name
HAVING COUNT(*) > 0;

-- Update the get_recent_form function to handle both game modes
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