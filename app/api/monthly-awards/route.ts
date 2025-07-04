import { NextRequest, NextResponse } from 'next/server'
import { calculateMonthlyAwards, getAvailableMonths } from '@/lib/monthly-awards'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, month, action } = body

    if (action === 'calculate') {
      if (!year || !month) {
        return NextResponse.json(
          { error: 'Year and month are required' },
          { status: 400 }
        )
      }

      const result = await calculateMonthlyAwards(year, month)
      return NextResponse.json(result)
    }

    if (action === 'calculate_current') {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      const result = await calculateMonthlyAwards(currentYear, currentMonth)
      return NextResponse.json(result)
    }

    if (action === 'calculate_previous') {
      const now = new Date()
      let year = now.getFullYear()
      let month = now.getMonth() // Previous month (0-based)
      
      if (month === 0) {
        month = 12
        year = year - 1
      }

      const result = await calculateMonthlyAwards(year, month)
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const months = await getAvailableMonths()
    return NextResponse.json({ months })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 