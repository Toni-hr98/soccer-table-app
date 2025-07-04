'use client'

import { useState, useEffect } from 'react'
import { Crown, Star, TrendingUp, Zap, Target, Trophy, Info, Users, Settings, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { HallOfFameRecord, Player, MonthlyAward, Match } from '@/types/database'
import { useAuth } from '@/lib/auth-context'

interface MonthlyAwardsData {
  player_of_month?: MonthlyAward & { player: Player }
  crawler_of_month: (MonthlyAward & { player: Player })[]
  most_active?: MonthlyAward & { player: Player }
  game_of_month?: MonthlyAward & { match: Match }
}

export default function Dashboard() {
  const { user } = useAuth()
  const [hallOfFameRecords, setHallOfFameRecords] = useState<HallOfFameRecord[]>([])
  const [monthlyAwards, setMonthlyAwards] = useState<MonthlyAwardsData>({ crawler_of_month: [] })
  const [loading, setLoading] = useState(true)
  const [showSystemInfo, setShowSystemInfo] = useState(false)
  const [awardsMonthName, setAwardsMonthName] = useState('')

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

    // Most crawls (handle ties) -> group into one record with winners array
    const maxCrawls = players.length ? Math.max(...players.map(p => p.crawls)) : 0
    if (maxCrawls > 0) {
      const winners = players.filter(p => p.crawls === maxCrawls)

      // Use the first winner as representative for legacy fields, but attach full winners list
      records.push({
        type: 'most_crawls',
        player: winners[0],
        value: maxCrawls,
        description: `keer gekropen`,
        // @ts-ignore – extend with extra winners field for UI purposes
        winners
      } as HallOfFameRecord & { winners: Player[] })
    }

    setHallOfFameRecords(records)
  }

  const fetchMonthlyAwards = async () => {
    // Get previous month for awards (current month is still being played)
    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth() // This gives 0-11, so January = 0
    
    // If current month is January (0), go to December of previous year
    if (month === 0) {
      month = 12
      year = year - 1
    }
    // Otherwise just use the previous month
    
    // Set the month name for display
    const monthNames = [
      'December', 'Januari', 'Februari', 'Maart', 'April', 'Mei',
      'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November'
    ]
    const displayMonthName = month === 12 ? 'December' : monthNames[month]
    setAwardsMonthName(`${displayMonthName} ${year}`)

    const { data, error } = await supabase
      .from('monthly_awards')
      .select(`
        *,
        player:players(*),
        match:matches(
          *,
          team1_player1:players!matches_team1_player1_fkey(id, name, photo_url),
          team1_player2:players!matches_team1_player2_fkey(id, name, photo_url),
          team2_player1:players!matches_team2_player1_fkey(id, name, photo_url),
          team2_player2:players!matches_team2_player2_fkey(id, name, photo_url)
        )
      `)
      .eq('year', year)
      .eq('month', month)

    if (error) throw error

    const awardsData: MonthlyAwardsData = { crawler_of_month: [] }
    
    data?.forEach(award => {
      switch (award.award_type) {
        case 'player_of_month':
          awardsData.player_of_month = award as MonthlyAward & { player: Player }
          break
        case 'crawler_of_month':
          awardsData.crawler_of_month.push(award as MonthlyAward & { player: Player })
          break
        case 'most_active':
          awardsData.most_active = award as MonthlyAward & { player: Player }
          break
        case 'game_of_month':
          awardsData.game_of_month = award as MonthlyAward & { match: Match }
          break
      }
    })

    setMonthlyAwards(awardsData)
  }

  const handleUserManagement = () => {
    window.dispatchEvent(new CustomEvent('showUserManagement'))
  }

  const handleMonthlyAwardsAdmin = () => {
    window.dispatchEvent(new CustomEvent('showMonthlyAwardsAdmin'))
  }

  const calculateTeamRatingChanges = (match: any, totalImpact: number) => {
    if (!match) return { team1Change: 0, team2Change: 0 }
    
    const team1Won = match.team1_score > match.team2_score
    const playersPerTeam = match.team1_player2 ? 2 : 1 // Check if it's 2v2 or 1v1
    
    // Calculate rating change per team, then divide by number of players per team
    const changePerTeam = Math.round(totalImpact / 2)
    const changePerPlayer = Math.round(changePerTeam / playersPerTeam)
    
    return {
      team1Change: team1Won ? changePerPlayer : -changePerPlayer,
      team2Change: team1Won ? -changePerPlayer : changePerPlayer
    }
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
              <>
                <button
                  onClick={handleUserManagement}
                  className="btn-secondary flex items-center gap-2 text-sm"
                  title="Gebruikersbeheer"
                >
                  <Users size={16} />
                  Gebruikers
                </button>
                
                <button
                  onClick={handleMonthlyAwardsAdmin}
                  className="btn-secondary flex items-center gap-2 text-sm"
                  title="Monthly Awards Beheer"
                >
                  <Calendar size={16} />
                  Awards
                </button>
              </>
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
            <p>• <strong>Wedstrijden:</strong> Alle matches gaan tot 10 doelpunten</p>
            <p>• <strong>Win Streaks:</strong> Geven bonussen: 3+ (30%), 5+ (60%), 10+ (90%)</p>
            <p>• <strong>Crawl Games:</strong> 10-0 of 10-1 wedstrijden waarbij verliezers onder de tafel moeten kruipen</p>
            <p>• <strong>Monthly Awards:</strong> Toegekend op basis van maandelijkse statistieken (rating groei, meeste matches, crawls, meest intense wedstrijd)</p>
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
                
                {/* Winner Avatars & Names */}
                {record.type === 'most_crawls' && (record as any).winners ? (
                  <>
                    <div className="mb-3 flex justify-center gap-4 flex-wrap">
                      {(record as any).winners.map((p: Player) => (
                        <div key={p.id} className="flex flex-col items-center gap-1">
                          {renderPlayerAvatar(p, 'medium')}
                          <span className="text-sm text-white font-medium mt-1">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Profile Photo */}
                    <div className="mb-3 flex justify-center">
                      {renderPlayerAvatar(record.player, 'medium')}
                    </div>
                    {/* Player Name */}
                    <p className="text-lg font-semibold text-white mb-3">{record.player.name}</p>
                  </>
                )}
                
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
          {awardsMonthName || 'Vorige Maand'}
        </h2>
        
        <div className="space-y-6">
          {/* Top row: Player awards */}
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

              {(monthlyAwards.crawler_of_month && monthlyAwards.crawler_of_month.length > 0) ? (
                <div className="flex flex-col items-center gap-6">
                  {monthlyAwards.crawler_of_month.map((award) => (
                    <div key={award.player.id} className="flex flex-col items-center">
                      <div className="mb-2">
                        {renderPlayerAvatar(award.player)}
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1">
                        {award.player.name}
                      </h4>
                      {award.value && (
                        <div className="text-xl font-bold text-red-400">
                          {award.value}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Description */}
                  <p className="text-sm text-slate-400">crawls deze maand</p>
                </div>
              ) : (
                <p className="text-slate-400">Geen crawls deze maand!</p>
              )}
            </div>
          </div>

          {/* Bottom row: Game of the Month - Full width */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
              <Zap className="text-purple-400" />
              Game of the Month
            </h3>
            
            {monthlyAwards.game_of_month && monthlyAwards.game_of_month.match ? (
              <div className="space-y-6">
                {/* Match Header */}
                <div className="text-center">
                  <h4 className="text-2xl font-bold text-white mb-2">
                    Meest Intense Wedstrijd
                  </h4>
                
                </div>

                {/* Match Details */}
                <div className="bg-slate-800/50 rounded-lg p-6">
                                     <div className="grid gap-6 md:grid-cols-3 items-center">
                     {/* Team 1 */}
                     <div className="text-center">
                       <h5 className="text-sm font-semibold text-slate-400 mb-3">TEAM 1</h5>
                       <div className="space-y-2 mb-4">
                         {monthlyAwards.game_of_month.match.team1_player1 && typeof monthlyAwards.game_of_month.match.team1_player1 === 'object' && (
                           <div className="flex items-center gap-3 justify-center">
                             {renderPlayerAvatar(monthlyAwards.game_of_month.match.team1_player1 as Player, 'small')}
                             <span className="text-white font-medium">
                               {(monthlyAwards.game_of_month.match.team1_player1 as Player).name}
                             </span>
                           </div>
                         )}
                         {monthlyAwards.game_of_month.match.team1_player2 && typeof monthlyAwards.game_of_month.match.team1_player2 === 'object' && (
                           <div className="flex items-center gap-3 justify-center">
                             {renderPlayerAvatar(monthlyAwards.game_of_month.match.team1_player2 as Player, 'small')}
                             <span className="text-white font-medium">
                               {(monthlyAwards.game_of_month.match.team1_player2 as Player).name}
                             </span>
                           </div>
                         )}
                       </div>
                       {/* Team 1 Rating Change */}
                       {(() => {
                         const { team1Change } = calculateTeamRatingChanges(monthlyAwards.game_of_month.match, monthlyAwards.game_of_month.value || 0)
                         return (
                           <div className={`text-xl font-bold ${team1Change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                             {team1Change > 0 ? '+' : ''}{team1Change}
                           </div>
                         )
                       })()}
                     </div>

                    {/* Score */}
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white mb-2">
                        {monthlyAwards.game_of_month.match.team1_score} - {monthlyAwards.game_of_month.match.team2_score}
                      </div>
                      <div className="text-sm text-slate-400 space-y-1">
                        <div>{new Date(monthlyAwards.game_of_month.match.created_at).toLocaleDateString('nl-NL')}</div>
                        <div className="capitalize">{monthlyAwards.game_of_month.match.game_mode || 'classic'}</div>
                        {monthlyAwards.game_of_month.match.is_crawl_game && (
                          <div className="text-red-400 font-semibold">CRAWL GAME</div>
                        )}
                      </div>
                    </div>

                                         {/* Team 2 */}
                     <div className="text-center">
                       <h5 className="text-sm font-semibold text-slate-400 mb-3">TEAM 2</h5>
                       <div className="space-y-2 mb-4">
                         {monthlyAwards.game_of_month.match.team2_player1 && typeof monthlyAwards.game_of_month.match.team2_player1 === 'object' && (
                           <div className="flex items-center gap-3 justify-center">
                             {renderPlayerAvatar(monthlyAwards.game_of_month.match.team2_player1 as Player, 'small')}
                             <span className="text-white font-medium">
                               {(monthlyAwards.game_of_month.match.team2_player1 as Player).name}
                             </span>
                           </div>
                         )}
                         {monthlyAwards.game_of_month.match.team2_player2 && typeof monthlyAwards.game_of_month.match.team2_player2 === 'object' && (
                           <div className="flex items-center gap-3 justify-center">
                             {renderPlayerAvatar(monthlyAwards.game_of_month.match.team2_player2 as Player, 'small')}
                             <span className="text-white font-medium">
                               {(monthlyAwards.game_of_month.match.team2_player2 as Player).name}
                             </span>
                           </div>
                         )}
                       </div>
                       {/* Team 2 Rating Change */}
                       {(() => {
                         const { team2Change } = calculateTeamRatingChanges(monthlyAwards.game_of_month.match, monthlyAwards.game_of_month.value || 0)
                         return (
                           <div className={`text-xl font-bold ${team2Change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                             {team2Change > 0 ? '+' : ''}{team2Change}
                           </div>
                         )
                       })()}
                     </div>
                  </div>

                  {/* Additional Info */}
                  {monthlyAwards.game_of_month.description && (
                    <div className="text-center mt-4 pt-4 border-t border-slate-700">
                      <p className="text-slate-300">{monthlyAwards.game_of_month.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="mx-auto text-slate-400 mb-4" size={48} />
                <p className="text-slate-400">Geen intense wedstrijd deze maand!</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
} 