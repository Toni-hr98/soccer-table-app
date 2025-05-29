'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const success = await login(username, password)
    
    if (!success) {
      setError('Ongeldige gebruikersnaam of wachtwoord')
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="text-center mb-6">
          <Lock className="mx-auto text-blue-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Inloggen</h2>
          <p className="text-slate-400">Log in met je account om verder te gaan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Gebruikersnaam"
              className="input-glass w-full pl-12"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="input-glass w-full pl-12 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button 
            type="submit" 
            className="btn-primary w-full disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm">
            Geen account? Vraag een admin om een account aan te maken.
          </p>
        </div>
      </div>
    </div>
  )
} 