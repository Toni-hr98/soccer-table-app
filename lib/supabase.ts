import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pbnyolmnuitftzgegiid.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibnlvbG1udWl0ZnR6Z2VnaWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NDI0MzQsImV4cCI6MjA2NDAxODQzNH0.Kv4wZiEhngN0cSZzgXl1rYJ5PBIsMFYzcOEc22vF5MM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 