import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
  try {
    const data: MatchNotificationData = await request.json()
    
    const webhookUrl = process.env.MATTERMOST_WEBHOOK_URL
    
    if (!webhookUrl) {
      console.log('⚠️ Mattermost webhook URL not configured, skipping notification')
      return NextResponse.json({ success: false, error: 'Webhook URL not configured' })
    }

    // Format team names
    const team1Name = data.team1_player2_name 
      ? `${data.team1_player1_name} & ${data.team1_player2_name}`
      : data.team1_player1_name

    const team2Name = data.team2_player2_name 
      ? `${data.team2_player1_name} & ${data.team2_player2_name}`
      : data.team2_player1_name

    // Determine winner and emojis
    const team1Won = data.team1_score > data.team2_score
    const team1Emoji = team1Won ? ':trophy:' : ':crossed_swords:'
    const team2Emoji = team1Won ? ':crossed_swords:' : ':trophy:'

    // Create main message
    let message = ''
    if (data.game_mode === 'duel') {
      message = `🤺 Er heeft een epische DUEL plaatsgevonden! ⚔️\n\n`
    } else {
      message = `⚽ Klassieke 2vs2 gespeeld! 🏆\n\n`
    }
    
    message += `${team1Emoji} ${team1Name}     ${data.team1_score} - ${data.team2_score}     ${team2Name} ${team2Emoji}\n\n`

    // Add crawl game indicator
    if (data.is_crawl_game) {
      message += `🐛 **CRAWL GAME!** Onder de tafel! 🐛\n\n`
    }

    // Add rating changes
    const avgRatingChange = Math.round(Math.abs(data.total_rating_change) / (data.game_mode === 'duel' ? 2 : 4))
    message += `📊 Rating verandering: ${team1Won ? '+' : '-'}${avgRatingChange} punten\n\n`

    // Add achievements if any
    if (data.achievements && data.achievements.length > 0) {
      message += `🏆 **Nieuwe achievements behaald:**\n`
      data.achievements.forEach(achievement => {
        message += `• ${achievement.player_name} - ${achievement.achievement_name}\n`
      })
      message += `\n`
    }

    // Add link
    message += `Klik [hier](https://niice-soccer.netlify.app/) voor meer informatie.`

    const payload = {
      text: message,
      username: 'Tablesoccer',
      icon_url: 'https://media.istockphoto.com/id/599911068/nl/foto/dirty-soccer-ball-isolated-on-white-background.jpg?s=612x612&w=0&k=20&c=LjiP7vwf7jHYYCkLIdIj2kH36W2X_95yJe7cZ0mE8ME='
    }

    console.log('🔄 Attempting to send notification to Mattermost...')
    console.log('Webhook URL:', webhookUrl)
    console.log('Payload:', JSON.stringify(payload, null, 2))

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Soccer-App/1.0',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Mattermost webhook error: ${response.status} - ${errorText}`)
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
    }

    console.log('✅ Match notification sent to Mattermost successfully!')
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('❌ Error sending match notification to Mattermost:', error)
    console.error('Webhook URL being used:', process.env.MATTERMOST_WEBHOOK_URL)
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
} 