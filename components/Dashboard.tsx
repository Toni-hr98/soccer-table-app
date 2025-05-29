'use client'

import { useState, useEffect } from 'react'
import { Crown, Star, TrendingUp, Zap, Target, Trophy, Info, Users, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { HallOfFameRecord, Player, MonthlyAward } from '@/types/database'
import { useAuth } from '@/lib/auth-context'

interface MonthlyAwardsData {
  player_of_month?: MonthlyAward & { player: Player }
  crawler_of_month?: MonthlyAward & { player: Player }
  most_active?: MonthlyAward & { player: Player }
}

export default function Dashboard() {
  const { user } = useAuth()
  const [hallOfFameRecords, setHallOfFameRecords] = useState<HallOfFameRecord[]>([])
  const [monthlyAwards, setMonthlyAwards] = useState<MonthlyAwardsData>({})
  const [loading, setLoading] = useState(true)
  const [showSystemInfo, setShowSystemInfo] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchHallOfFameRecords(),
        fetchMonthlyAwards()
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHallOfFameRecords = async () => {
    const { data: players, error } = await supabase.from('players').select('*')
    if (error) throw error

    const records: HallOfFameRecord[] = []

    // Best win streak ever
    const bestStreakPlayer = players.reduce((prev, current) => 
      (prev.best_win_streak > current.best_win_streak) ? prev : current
    )
    if (bestStreakPlayer.best_win_streak > 0) {
      records.push({
        type: 'best_streak',
        player: bestStreakPlayer,
        value: bestStreakPlayer.best_win_streak,
        description: `wedstrijden op rij`
      })
    }

    // Highest rating ever
    const highestRatingPlayer = players.reduce((prev, current) => 
      (prev.highest_rating > current.highest_rating) ? prev : current
    )
    if (highestRatingPlayer.highest_rating > 1200) {
      records.push({
        type: 'highest_rating',
        player: highestRatingPlayer,
        value: highestRatingPlayer.highest_rating,
        description: `Hoogste rating`
      })
    }

    // Most crawls
    const mostCrawlsPlayer = players.reduce((prev, current) => 
      (prev.crawls > current.crawls) ? prev : current
    )
    if (mostCrawlsPlayer.crawls > 0) {
      records.push({
        type: 'most_crawls',
        player: mostCrawlsPlayer,
        value: mostCrawlsPlayer.crawls,
        description: `keer gekropen`
      })
    }

    setHallOfFameRecords(records)
  }

  const fetchMonthlyAwards = async () => {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const { data, error } = await supabase
      .from('monthly_awards')
      .select(`
        *,
        player:players(*)
      `)
      .eq('year', currentYear)
      .eq('month', currentMonth)

    if (error) throw error

    const awardsData: MonthlyAwardsData = {}
    
    data?.forEach(award => {
      switch (award.award_type) {
        case 'player_of_month':
          awardsData.player_of_month = award as MonthlyAward & { player: Player }
          break
        case 'crawler_of_month':
          awardsData.crawler_of_month = award as MonthlyAward & { player: Player }
          break
        case 'most_active':
          awardsData.most_active = award as MonthlyAward & { player: Player }
          break
      }
    })

    setMonthlyAwards(awardsData)
  }

  const handleUserManagement = () => {
    window.dispatchEvent(new CustomEvent('showUserManagement'))
  }

  const renderPlayerAvatar = (player: Player, size: 'small' | 'medium' = 'medium') => {
    const sizeClasses = size === 'small' ? 'w-12 h-12' : 'w-16 h-16'
    
    if (player.photo_url) {
      return (
        <img
          src={player.photo_url}
          alt={player.name}
          className={`${sizeClasses} rounded-full object-cover`}
        />
      )
    }
    
    return (
      <div className={`${sizeClasses} rounded-full bg-[#e51f5c] flex items-center justify-center text-white font-bold ${size === 'small' ? 'text-lg' : 'text-xl'}`}>
        {player.name.charAt(0).toUpperCase()}
      </div>
    )
  }

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'best_streak':
        return <Zap className="text-white" size={20} />
      case 'highest_rating':
        return <TrendingUp className="text-white" size={20} />
      case 'most_crawls':
        return <Target className="text-white" size={20} />
      default:
        return <Trophy className="text-white" size={20} />
    }
  }

  const getRecordTitle = (type: string) => {
    switch (type) {
      case 'best_streak':
        return 'Beste Win Streak'
      case 'highest_rating':
        return 'Hoogste Rating'
      case 'most_crawls':
        return 'Meest Gekropen'
      default:
        return 'Record'
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-left">
          <h1 className="text-3xl font-bold text-white mb-2">Prestaties en records</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="animate-pulse">
                <div className="h-24 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with admin controls and system info button */}
      <div className="text-left relative">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white mb-2">Prestaties en records</h1>
          
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <button
                onClick={handleUserManagement}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Gebruikersbeheer"
              >
                <Users size={16} />
                Gebruikers
              </button>
            )}
            
            <button
              onClick={() => setShowSystemInfo(!showSystemInfo)}
              className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
              title="Systeem informatie"
            >
              <Info size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* System info panel */}
      {showSystemInfo && (
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4">Rating Systeem</h3>
          <div className="space-y-3 text-sm text-slate-300">
            <p>• <strong>Rating:</strong> Nieuwe spelers starten op 1200, verandert op basis van wins/losses en tegenstander sterkte</p>
            <p>• <strong>Rating Berekening:</strong> Gebruikt Elo-systeem met K-factor 32, score verschil en win streak bonussen</p>
            <p>• <strong>Wedstrijden:</strong> Alle matches gaan tot 10 doelpunten, scores mogen niet gelijk zijn</p>
            <p>• <strong>Win Streaks:</strong> Geven bonussen: 3+ (20%), 5+ (40%), 10+ (60%)</p>
            <p>• <strong>Crawl Games:</strong> 10-0 of 10-1 wedstrijden waarbij verliezers onder de tafel moeten kruipen</p>
            <p>• <strong>Monthly Awards:</strong> Toegekend op basis van maandelijkse statistieken (rating groei, meeste matches, crawls)</p>
            <p>• <strong>Hall of Fame:</strong> All-time records van alle spelers</p>
          </div>
        </div>
      )}

      {/* Hall of Fame */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Crown className="text-[#e51f5c]" />
          Hall of Fame
        </h2>
        
        {hallOfFameRecords.length === 0 ? (
          <div className="card text-center py-8">
            <Crown className="mx-auto text-slate-400 mb-4" size={48} />
            <p className="text-slate-400">Nog geen records behaald</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hallOfFameRecords.map((record, index) => (
              <div key={`${record.type}-${index}`} className="card text-center group hover:bg-white/5 transition-all">
                {/* Title */}
                <h3 className="font-bold text-white text-lg mb-4">
                  {getRecordTitle(record.type)}
                </h3>
                
                {/* Profile Photo */}
                <div className="mb-3 flex justify-center">
                  {renderPlayerAvatar(record.player, 'medium')}
                </div>
                
                {/* Player Name */}
                <p className="text-lg font-semibold text-white mb-3">{record.player.name}</p>
                
                {/* Description */}
                <p className="text-sm text-slate-400 mb-3">{record.description}</p>
                
                {/* Value */}
                <div className={`text-3xl font-bold ${
                  record.type === 'most_crawls' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {record.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Monthly Awards */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Star className="text-[#e51f5c]" />
          Deze Maand
        </h2>
        
        <div className="grid gap-6 md:grid-cols-3">
          {/* Player of the Month */}
          <div className="card text-center">
            <h3 className="text-lg font-bold text-white mb-4">Player of the Month</h3>
            
            {monthlyAwards.player_of_month ? (
              <div>
                {/* Profile Photo */}
                <div className="mb-4 flex justify-center">
                  {renderPlayerAvatar(monthlyAwards.player_of_month.player)}
                </div>
                
                {/* Player Name */}
                <h4 className="text-xl font-bold text-white mb-3">
                  {monthlyAwards.player_of_month.player.name}
                </h4>
                
                {/* Description */}
                {monthlyAwards.player_of_month.description && (
                  <p className="text-sm text-slate-400">
                    {monthlyAwards.player_of_month.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-400">Nog geen winnaar</p>
            )}
          </div>

          {/* Most Active */}
          <div className="card text-center">
            <h3 className="text-lg font-bold text-white mb-4">Most Active</h3>
            
            {monthlyAwards.most_active ? (
              <div>
                {/* Profile Photo */}
                <div className="mb-4 flex justify-center">
                  {renderPlayerAvatar(monthlyAwards.most_active.player)}
                </div>
                
                {/* Player Name */}
                <h4 className="text-xl font-bold text-white mb-3">
                  {monthlyAwards.most_active.player.name}
                </h4>
                
                {/* Value */}
                {monthlyAwards.most_active.value && (
                  <div className="text-2xl font-bold text-green-400 mb-2">
                    {monthlyAwards.most_active.value}
                  </div>
                )}
                
                {/* Description */}
                <p className="text-sm text-slate-400">games gespeeld</p>
              </div>
            ) : (
              <p className="text-slate-400">Nog geen winnaar</p>
            )}
          </div>

          {/* Crawler of the Month */}
          <div className="card text-center">
            <h3 className="text-lg font-bold text-white mb-4">Crawler of the Month</h3>
            
            {monthlyAwards.crawler_of_month ? (
              <div>
                {/* Profile Photo */}
                <div className="mb-4 flex justify-center">
                  {renderPlayerAvatar(monthlyAwards.crawler_of_month.player)}
                </div>
                
                {/* Player Name */}
                <h4 className="text-xl font-bold text-white mb-3">
                  {monthlyAwards.crawler_of_month.player.name}
                </h4>
                
                {/* Value */}
                {monthlyAwards.crawler_of_month.value && (
                  <div className="text-2xl font-bold text-red-400 mb-2">
                    {monthlyAwards.crawler_of_month.value}
                  </div>
                )}
                
                {/* Description */}
                <p className="text-sm text-slate-400">crawls deze maand</p>
              </div>
            ) : (
              <p className="text-slate-400">Geen crawls deze maand!</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
} 