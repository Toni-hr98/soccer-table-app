'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Shield, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Players from '@/components/Players'

export default function AdminPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    // Check admin status
    const adminStatus = localStorage.getItem('isAdmin') === 'true'
    setIsAdmin(adminStatus)
    setChecking(false)
    
    if (!adminStatus) {
      setShowLogin(true)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    
    // Simple password check (in production, this should be more secure)
    if (password === 'admin123') {
      localStorage.setItem('isAdmin', 'true')
      setIsAdmin(true)
      setShowLogin(false)
      setPassword('')
    } else {
      setLoginError('Incorrect password')
      setPassword('')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('isAdmin')
    setIsAdmin(false)
    setShowLogin(true)
  }

  if (checking) {
    return (
      <div className="min-h-screen pb-16">
        <div className="max-w-4xl mx-auto py-10 px-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e51f5c] mx-auto mb-4"></div>
              <p className="text-slate-400">Checking access...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showLogin) {
    return (
      <div className="min-h-screen pb-16">
        <div className="max-w-4xl mx-auto py-10 px-4">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => router.push('/')}
              className="btn-secondary p-2"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="text-[#e51f5c]" size={24} />
              <h1 className="text-2xl font-bold text-white">Admin Login</h1>
            </div>
          </div>

          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="card max-w-md w-full">
              <div className="text-center mb-6">
                <Shield className="mx-auto text-[#e51f5c] mb-4" size={48} />
                <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
                <p className="text-slate-400">Enter the admin password to continue</p>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a2631] border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#e51f5c]"
                      placeholder="Enter admin password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                
                {loginError && (
                  <p className="text-red-400 text-sm">{loginError}</p>
                )}
                
                <button
                  type="submit"
                  className="w-full btn-primary"
                >
                  Login
                </button>
              </form>
              
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  Hint: Try "admin123" 😉
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-4xl mx-auto py-10 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="btn-secondary p-2"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="text-[#e51f5c]" size={24} />
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="btn-secondary text-sm"
          >
            Logout
          </button>
        </div>

        <Players />
      </div>
    </div>
  )
} 