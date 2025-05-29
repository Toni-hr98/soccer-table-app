'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Trash2, Crown, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface UserAccount {
  id: string
  name: string
  is_admin: boolean
  player_id: string | null
}

export default function UserManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Fout bij ophalen gebruikers')
    } finally {
      setLoading(false)
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')
    setSuccess('')

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('name', newUserName)
        .single()

      if (existingUser) {
        setError('Gebruiker bestaat al')
        setIsCreating(false)
        return
      }

      // First create a player profile
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert([{ name: newUserName }])
        .select()
        .single()

      if (playerError) throw playerError

      // Then create the user account
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{
          name: newUserName,
          password: 'tafelvoetbal',
          is_admin: false,
          player_id: playerData.id
        }])
        .select()
        .single()

      if (userError) throw userError

      // Update local state
      setUsers([userData, ...users])
      setSuccess(`Account aangemaakt voor ${newUserName} met wachtwoord: tafelvoetbal`)
      setNewUserName('')
    } catch (error) {
      console.error('Error creating user:', error)
      setError('Er ging iets mis bij het aanmaken van de gebruiker')
    }

    setIsCreating(false)
  }

  const deleteUser = async (userId: string) => {
    if (userId === user?.id) {
      setError('Je kunt je eigen account niet verwijderen')
      return
    }

    if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      setUsers(users.filter(u => u.id !== userId))
      setSuccess('Gebruiker verwijderd')
    } catch (error) {
      console.error('Error deleting user:', error)
      setError('Fout bij verwijderen gebruiker')
    }
  }

  if (!user?.is_admin) {
    return (
      <div className="card">
        <p className="text-red-400">Je hebt geen toegang tot gebruikersbeheer.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-blue-400" size={24} />
          <h2 className="text-xl font-bold text-white">Gebruikersbeheer</h2>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-blue-400" size={24} />
          <h2 className="text-xl font-bold text-white">Gebruikersbeheer</h2>
        </div>

        {/* Create new user form */}
        <form onSubmit={createUser} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nieuwe gebruikersnaam"
                className="input-glass w-full"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={18} />
              {isCreating ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Nieuwe gebruikers krijgen automatisch het wachtwoord: tafelvoetbal
          </p>
        </form>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        {/* Users list */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Bestaande gebruikers ({users.length})</h3>
          {users.map((userAccount) => (
            <div key={userAccount.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                {userAccount.is_admin ? (
                  <Crown className="text-yellow-400" size={20} />
                ) : (
                  <User className="text-slate-400" size={20} />
                )}
                <span className="text-white font-medium">{userAccount.name}</span>
                {userAccount.is_admin && (
                  <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                    Admin
                  </span>
                )}
              </div>
              
              {userAccount.id !== user?.id && (
                <button
                  onClick={() => deleteUser(userAccount.id)}
                  className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/20 rounded"
                  title="Gebruiker verwijderen"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 