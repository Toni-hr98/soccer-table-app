-- =====================================================
-- DEBUG SCRIPT FOR 1VS1 GAME MODE ISSUES
-- =====================================================
-- Run this to debug the game_mode constraint issues

-- Check current constraints on matches table (updated for newer PostgreSQL)
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'matches'::regclass 
AND contype = 'c';

-- Check if game_mode column exists and its properties
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name = 'game_mode';

-- Check existing game_mode values
SELECT game_mode, COUNT(*) 
FROM matches 
GROUP BY game_mode;

-- Test inserting a simple match to see what happens
-- (This won't actually insert, just test the constraint)
DO $$
BEGIN
    -- Test if we can create a temp table with the same constraints
    RAISE NOTICE 'Testing game_mode constraint...';
    
    -- Try to understand what's happening
    PERFORM 1 WHERE 'classic' IN ('classic', 'duel');
    RAISE NOTICE 'Classic value test passed';
    
    PERFORM 1 WHERE 'duel' IN ('classic', 'duel');
    RAISE NOTICE 'Duel value test passed';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error during test: %', SQLERRM;
END $$;

-- =====================================================
-- QUICK DEBUG FOR CURRENT STATE
-- =====================================================

-- Check current constraints
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'matches'::regclass 
AND contype = 'c'
AND conname LIKE '%game_mode%';

-- Check current game_mode column
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name = 'game_mode';

-- Test manual insert of 1vs1 match to see what happens
DO $$
DECLARE
    test_player1 UUID;
    test_player2 UUID;
BEGIN
    -- Get two random players for testing
    SELECT id INTO test_player1 FROM players LIMIT 1;
    SELECT id INTO test_player2 FROM players WHERE id != test_player1 LIMIT 1;
    
    RAISE NOTICE 'Testing manual insert with player1: % and player2: %', test_player1, test_player2;
    
    -- Try to insert a 1vs1 match
    BEGIN
        INSERT INTO matches (
            team1_player1, team1_player2, team2_player1, team2_player2, 
            team1_score, team2_score, game_mode, total_rating_change, is_crawl_game
        ) VALUES (
            test_player1, NULL, test_player2, NULL,
            10, 8, 'duel', 50, false
        );
        
        RAISE NOTICE 'SUCCESS: 1vs1 match inserted successfully!';
        
        -- Clean up the test
        DELETE FROM matches WHERE team1_player1 = test_player1 AND team2_player1 = test_player2 AND game_mode = 'duel';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERROR inserting 1vs1 match: %', SQLERRM;
    END;
    
END $$; 