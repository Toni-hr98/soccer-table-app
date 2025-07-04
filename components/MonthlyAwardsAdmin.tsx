'use client'

import { useState, useEffect } from 'react'
import { Calendar, Calculator, Clock, Trophy, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

export default function MonthlyAwardsAdmin() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    fetchAvailableMonths()
  }, [])

  const fetchAvailableMonths = async () => {
    try {
      const response = await fetch('/api/monthly-awards')
      const data = await response.json()
      setAvailableMonths(data.months || [])
      
      // Set current month as default
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
      setSelectedMonth(currentMonth)
    } catch (error) {
      console.error('Error fetching available months:', error)
    }
  }

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const calculateAwards = async (action: string, customYear?: number, customMonth?: number) => {
    setLoading(true)
    try {
      const body: any = { action }
      
      if (action === 'calculate' && customYear && customMonth) {
        body.year = customYear
        body.month = customMonth
      }

      const response = await fetch('/api/monthly-awards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        showMessage(result.message, 'success')
      } else {
        showMessage(result.error || result.message, 'error')
      }
    } catch (error) {
      console.error('Error calculating awards:', error)
      showMessage('Er is een fout opgetreden bij het berekenen van de awards', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCalculateForMonth = () => {
    if (!selectedMonth) {
      showMessage('Selecteer eerst een maand', 'error')
      return
    }

    const [year, month] = selectedMonth.split('-').map(Number)
    calculateAwards('calculate', year, month)
  }

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long' })
  }

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-2xl font-bold text-white mb-2">Monthly Awards Beheer</h2>
        <p className="text-slate-400">Bereken en beheer maandelijkse awards</p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          messageType === 'success' ? 'bg-green-500/20 text-green-400' :
          messageType === 'error' ? 'bg-red-500/20 text-red-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {messageType === 'success' && <CheckCircle size={20} />}
          {messageType === 'error' && <AlertCircle size={20} />}
          {messageType === 'info' && <RefreshCw size={20} />}
          {message}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="text-blue-400" />
            Snelle Acties
          </h3>
          
          <div className="space-y-3">
            <button
              onClick={() => calculateAwards('calculate_current')}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Calculator size={16} />
              {loading ? 'Berekenen...' : 'Bereken Huidige Maand'}
            </button>
            
            <button
              onClick={() => calculateAwards('calculate_previous')}
              disabled={loading}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Calendar size={16} />
              {loading ? 'Berekenen...' : 'Bereken Vorige Maand'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-400" />
            Specifieke Maand
          </h3>
          
          <div className="space-y-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-glass w-full"
            >
              <option value="">Selecteer een maand</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleCalculateForMonth}
              disabled={loading || !selectedMonth}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Calculator size={16} />
              {loading ? 'Berekenen...' : 'Bereken Geselecteerde Maand'}
            </button>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Award Criteria</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-yellow-400 mb-2">Player of the Month</h4>
            <p className="text-sm text-slate-300">Speler met de grootste rating groei deze maand</p>
          </div>
          <div>
            <h4 className="font-semibold text-red-400 mb-2">Crawler of the Month</h4>
            <p className="text-sm text-slate-300">Speler die het vaakst heeft moeten kruipen (10-0 of 10-1 verlies)</p>
          </div>
          <div>
            <h4 className="font-semibold text-green-400 mb-2">Most Active Player</h4>
            <p className="text-sm text-slate-300">Speler die de meeste wedstrijden heeft gespeeld</p>
          </div>
          <div>
            <h4 className="font-semibold text-purple-400 mb-2">Game of the Month</h4>
            <p className="text-sm text-slate-300">Wedstrijd met de grootste rating impact</p>
          </div>
        </div>
      </div>

      {/* Automation Info */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Automatisering</h3>
        <div className="space-y-3 text-sm text-slate-300">
          <p>• <strong>Automatische Berekening:</strong> Awards worden automatisch berekend op de 1e van elke maand</p>
          <p>• <strong>Cron Endpoint:</strong> <code className="bg-slate-700 px-2 py-1 rounded">/api/cron/monthly-awards</code></p>
          <p>• <strong>Handmatige Override:</strong> Gebruik de knoppen hierboven om awards opnieuw te berekenen</p>
          <p>• <strong>Retroactief:</strong> Je kunt awards voor oude maanden berekenen als er nieuwe data is</p>
        </div>
      </div>
    </div>
  )
} 