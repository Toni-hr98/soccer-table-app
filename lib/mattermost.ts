interface MatchNotificationData {
  team1_player1_name: string
  team1_player2_name?: string
  team2_player1_name: string
  team2_player2_name?: string
  team1_score: number
  team2_score: number
  game_mode: 'classic' | 'duel'
  total_rating_change: number
  is_crawl_game: boolean
  achievements?: { player_name: string; achievement_name: string }[]
}

export async function sendMatchToMattermost(data: MatchNotificationData) {
  // Feature flag - set to false to disable Mattermost notifications
  const MATTERMOST_ENABLED = process.env.NEXT_PUBLIC_MATTERMOST_ENABLED !== 'false'
  
  if (!MATTERMOST_ENABLED) {
    console.log('🔇 Mattermost notifications disabled via feature flag')
    return
  }

  try {
    const response = await fetch('/api/mattermost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`)
    }

    if (result.success) {
      console.log('✅ Match notification sent to Mattermost successfully!')
    } else {
      console.log('⚠️ Mattermost notification failed:', result.error)
    }
    
  } catch (error) {
    console.error('❌ Error sending match notification to Mattermost:', error)
  }
} 