'use client'

import { useState, useEffect } from 'react'
import { Crown, TrendingUp, Zap, Trophy, Calendar, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { HallOfFameRecord, Player, MonthlyAward } from '@/types/database'
import FireAnimation from './FireAnimation'

export default function HallOfFame() {
  const [records, setRecords] = useState<HallOfFameRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHallOfFameRecords()
  }, [])

  const fetchHallOfFameRecords = async () => {
    try {
      const [playersResult, awardsResult] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('monthly_awards').select('*, player:players(*)').eq('award_type', 'player_of_month')
      ])

      if (playersResult.error) throw playersResult.error
      if (awardsResult.error) throw awardsResult.error

      const players = playersResult.data || []
      const monthlyAwards = awardsResult.data || []

      const hallOfFameRecords: HallOfFameRecord[] = []

      // Best win streak ever
      const bestStreakPlayer = players.reduce((prev, current) => 
        (prev.best_win_streak > current.best_win_streak) ? prev : current
      )
      if (bestStreakPlayer.best_win_streak > 0) {
        hallOfFameRecords.push({
          type: 'best_streak',
          player: bestStreakPlayer,
          value: bestStreakPlayer.best_win_streak,
          description: `${bestStreakPlayer.best_win_streak} wedstrijden op rij gewonnen`
        })
      }

      // Highest rating ever
      const highestRatingPlayer = players.reduce((prev, current) => 
        (prev.highest_rating > current.highest_rating) ? prev : current
      )
      if (highestRatingPlayer.highest_rating > 1200) {
        hallOfFameRecords.push({
          type: 'highest_rating',
          player: highestRatingPlayer,
          value: highestRatingPlayer.highest_rating,
          description: `Hoogste rating ooit behaald: ${highestRatingPlayer.highest_rating}`
        })
      }

      // Most crawls (most humiliated)
      const mostCrawlsPlayer = players.reduce((prev, current) => 
        (prev.crawls > current.crawls) ? prev : current
      )
      if (mostCrawlsPlayer.crawls > 0) {
        hallOfFameRecords.push({
          type: 'most_crawls',
          player: mostCrawlsPlayer,
          value: mostCrawlsPlayer.crawls,
          description: `${mostCrawlsPlayer.crawls} keer onder de tafel gekropen`
        })
      }

      // Player of the Year (most player of the month awards)
      const playerAwardCounts = monthlyAwards.reduce((acc, award) => {
        if (award.player_id) {
          acc[award.player_id] = (acc[award.player_id] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const playerOfYearId = Object.keys(playerAwardCounts).reduce((a, b) => 
        playerAwardCounts[a] > playerAwardCounts[b] ? a : b
      )

      if (playerOfYearId && playerAwardCounts[playerOfYearId] > 0) {
        const playerOfYear = players.find(p => p.id === playerOfYearId)
        if (playerOfYear) {
          hallOfFameRecords.push({
            type: 'player_of_year',
            player: playerOfYear,
            value: playerAwardCounts[playerOfYearId],
            description: `${playerAwardCounts[playerOfYearId]} Player of the Month awards`
          })
        }
      }

      setRecords(hallOfFameRecords)
    } catch (error) {
      console.error('Error fetching hall of fame:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'best_streak':
        return <Zap className="text-yellow-400" size={32} />
      case 'highest_rating':
        return <TrendingUp className="text-blue-400" size={32} />
      case 'most_crawls':
        return <Target className="text-red-400" size={32} />
      case 'player_of_year':
        return <Crown className="text-purple-400" size={32} />
      default:
        return <Trophy className="text-yellow-400" size={32} />
    }
  }

  const getRecordTitle = (type: string) => {
    switch (type) {
      case 'best_streak':
        return 'Beste Win Streak Ooit'
      case 'highest_rating':
        return 'Hoogste Rating Ooit'
      case 'most_crawls':
        return 'Meest Gekropen'
      case 'player_of_year':
        return 'Player of the Year'
      default:
        return 'Record'
    }
  }

  const getRecordColor = (type: string) => {
    switch (type) {
      case 'best_streak':
        return 'from-yellow-500 to-orange-500'
      case 'highest_rating':
        return 'from-blue-500 to-cyan-500'
      case 'most_crawls':
        return 'from-red-500 to-pink-500'
      case 'player_of_year':
        return 'from-purple-500 to-indigo-500'
      default:
        return 'from-gray-500 to-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          <Crown className="text-purple-400" />
          Hall of Fame
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="animate-pulse">
                <div className="h-8 bg-white/10 rounded mb-4"></div>
                <div className="h-16 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
        <Crown className="text-purple-400" />
        Hall of Fame
      </h2>

      {records.length === 0 ? (
        <div className="card text-center py-12">
          <Crown className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">Nog geen records behaald</p>
          <p className="text-slate-500 text-sm mt-2">Speel meer wedstrijden om records te vestigen</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {records.map((record, index) => (
            <div
              key={`${record.type}-${index}`}
              className="card relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${getRecordColor(record.type)} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  {getRecordIcon(record.type)}
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {getRecordTitle(record.type)}
                    </h3>
                    <p className="text-sm text-slate-400">
                      All-time record holder
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {record.player.photo_url ? (
                    <img
                      src={record.player.photo_url}
                      alt={record.player.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                      {record.player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-1">
                      {record.player.name}
                    </h4>
                    <p className="text-slate-300 text-sm">
                      {record.description}
                    </p>
                    <div className={`text-2xl font-bold bg-gradient-to-r ${getRecordColor(record.type)} bg-clip-text text-transparent mt-2`}>
                      {record.value}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 