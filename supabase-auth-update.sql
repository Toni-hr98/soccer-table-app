-- =====================================================
-- AUTHENTICATION SYSTEM UPDATE FOR EXISTING DATABASE
-- =====================================================
-- Run this script in your Supabase SQL editor to add authentication features
-- This is safe to run on an existing database with data

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- In production, this should be hashed
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  player_id UUID REFERENCES players(id), -- Link to their player profile
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table (allow all operations for now)
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON users;
DROP POLICY IF EXISTS "Enable update access for all users" ON users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON users;

CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON users FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id);

-- Insert initial admin user (toni) and create their player profile
DO $$
DECLARE
  toni_player_id UUID;
  existing_player_id UUID;
BEGIN
  -- Check if toni player already exists
  SELECT id INTO existing_player_id FROM players WHERE name = 'toni';
  
  -- If player doesn't exist, create it
  IF existing_player_id IS NULL THEN
    INSERT INTO players (name) VALUES ('toni') RETURNING id INTO toni_player_id;
  ELSE
    toni_player_id := existing_player_id;
  END IF;
  
  -- Create or update toni's user account
  INSERT INTO users (name, password, is_admin, player_id) 
  VALUES ('toni', 'unicornDeveloper', true, toni_player_id)
  ON CONFLICT (name) DO UPDATE SET 
    password = EXCLUDED.password,
    is_admin = EXCLUDED.is_admin,
    player_id = EXCLUDED.player_id;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify everything worked correctly:

-- Check if users table was created
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'users';

-- Check if toni's account was created
-- SELECT * FROM users WHERE name = 'toni';

-- Check if toni's player profile exists
-- SELECT p.*, u.is_admin FROM players p 
-- LEFT JOIN users u ON u.player_id = p.id 
-- WHERE p.name = 'toni'; 