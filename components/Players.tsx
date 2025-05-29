'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Camera, Trash2, Edit, LogOut, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Player } from '@/types/database'
import AdminLogin from './AdminLogin'

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ name: '', photo_url: '' })
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    fetchPlayers()
    // Check admin status
    const adminStatus = localStorage.getItem('isAdmin')
    setIsAdmin(adminStatus === 'true')
  }, [])

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = () => {
    setIsAdmin(true)
    setShowLogin(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('isAdmin')
    setIsAdmin(false)
    setShowAddForm(false)
  }

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlayer.name.trim() || !isAdmin) return

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([
          {
            name: newPlayer.name.trim(),
            photo_url: newPlayer.photo_url || null,
            rating: 1200,
            highest_rating: 1200,
            goals_scored: 0,
            goals_conceded: 0,
            wins: 0,
            losses: 0,
            current_win_streak: 0,
            current_loss_streak: 0,
            best_win_streak: 0,
            crawls: 0,
          },
        ])
        .select()

      if (error) throw error

      setPlayers([...players, data[0]])
      setNewPlayer({ name: '', photo_url: '' })
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding player:', error)
      alert('Fout bij toevoegen speler')
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isAdmin) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `player-photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath)

      setNewPlayer({ ...newPlayer, photo_url: data.publicUrl })
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Fout bij uploaden foto')
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePlayer = async (playerId: string) => {
    if (!isAdmin || !confirm('Weet je zeker dat je deze speler wilt verwijderen?')) return

    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId)

      if (error) throw error

      setPlayers(players.filter(p => p.id !== playerId))
    } catch (error) {
      console.error('Error deleting player:', error)
      alert('Fout bij verwijderen speler')
    }
  }

  if (showLogin) {
    return <AdminLogin onLogin={handleLogin} />
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-blue-400" />
          Spelers ({players.length})
        </h2>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={20} />
                Nieuwe Speler
              </button>
              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center gap-2"
              >
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Lock size={16} />
              Admin Login
            </button>
          )}
        </div>
      </div>

      {/* Admin Add Player Form */}
      {showAddForm && isAdmin && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Nieuwe Speler Toevoegen</h3>
          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Naam</label>
              <input
                type="text"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                className="input-glass w-full"
                placeholder="Voer naam in..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Foto (optioneel)</label>
              <div className="flex items-center gap-4">
                {newPlayer.photo_url ? (
                  <img
                    src={newPlayer.photo_url}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#e51f5c] flex items-center justify-center">
                    <Camera className="text-white" size={24} />
                  </div>
                )}
                <label className="btn-secondary cursor-pointer">
                  <Camera size={16} className="mr-2" />
                  {uploading ? 'Uploading...' : 'Kies Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                Speler Toevoegen
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Players List */}
      {players.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-400 text-lg">Nog geen spelers toegevoegd</p>
          <p className="text-slate-500 text-sm mt-2">
            {isAdmin ? 'Voeg je eerste speler toe om te beginnen' : 'Login als admin om spelers toe te voegen'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {players.map((player) => (
            <div key={player.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt={player.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#e51f5c] flex items-center justify-center">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-xl font-semibold">{player.name}</h3>
                    <div className="text-sm text-slate-400 space-y-1">
                      <div>Rating: <span className="text-blue-400 font-semibold">{player.rating}</span></div>
                      <div>Wedstrijden: {player.wins + player.losses} | Wins: {player.wins} | Losses: {player.losses}</div>
                      <div>Goals: {player.goals_scored} - {player.goals_conceded}</div>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Verwijder speler"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 