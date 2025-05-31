-- =====================================================
-- DEBUG ACHIEVEMENTS ISSUE
-- =====================================================
-- Run this in Supabase SQL Editor to fix missing achievements

-- 1. Add missing 'First Win' achievement
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value) 
VALUES ('First Win', 'Win your first match', '🏆', 'milestone', 'wins', 1)
ON CONFLICT (name) DO NOTHING;

-- 2. Check what achievements exist
SELECT name, description, requirement_type, requirement_value 
FROM achievements 
ORDER BY category, requirement_value;

-- 3. Check if any achievements have been awarded
SELECT 
  pa.achieved_at,
  a.name as achievement_name,
  p.name as player_name,
  p.wins,
  p.losses
FROM player_achievements pa
JOIN achievements a ON pa.achievement_id = a.id
JOIN players p ON pa.player_id = p.id
ORDER BY pa.achieved_at DESC;

-- 4. Check current player stats
SELECT name, wins, losses, goals_scored, crawls, crawls_caused
FROM players 
ORDER BY wins DESC; 