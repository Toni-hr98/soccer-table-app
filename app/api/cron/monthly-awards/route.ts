import { NextRequest, NextResponse } from 'next/server'
import { calculateMonthlyAwards } from '@/lib/monthly-awards'

// This endpoint is designed to be called by a cron job on the 1st of each month
// It will calculate awards for the previous month
export async function GET(request: NextRequest) {
  try {
    // Verify this is coming from a cron job (simple security)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || 'cron-secret-key'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Calculate for previous month
    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth() // Previous month (0-based)
    
    if (month === 0) {
      month = 12
      year = year - 1
    }

    console.log(`Cron job: Calculating monthly awards for ${year}-${month}`)
    
    const result = await calculateMonthlyAwards(year, month)
    
    console.log(`Cron job result:`, result)
    
    return NextResponse.json({
      success: true,
      message: `Automated monthly awards calculation completed for ${year}-${month}`,
      result
    })
    
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request)
} 