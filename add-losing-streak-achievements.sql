-- Add losing streak achievements to existing database
-- Run this if you already have a database and want to add the new achievements

INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value) VALUES
  -- Losing streak achievements
  ('Rough Patch', 'Lose 3 matches in a row', '😓', 'streak', 'loss_streak', 3),
  ('Slump', 'Lose 5 matches in a row', '📉', 'streak', 'loss_streak', 5),
  ('Cursed', 'Lose 10 matches in a row', '😈', 'streak', 'loss_streak', 10),
  ('Nightmare Mode', 'Lose 15 matches in a row', '💀', 'streak', 'loss_streak', 15),
  ('Rock Bottom', 'Lose 20 matches in a row', '🕳️', 'streak', 'loss_streak', 20)
ON CONFLICT (name) DO NOTHING; 