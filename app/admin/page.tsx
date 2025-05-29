'use client'

import { useState } from 'react'
import { ArrowLeft, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Players from '@/components/Players'
import Login from '@/components/Login'

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e51f5c]"></div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />
  }

  // Show access denied if not admin
  if (!user.is_admin) {
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
              <h1 className="text-2xl font-bold text-white">Access Denied</h1>
            </div>
          </div>

          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="card max-w-md w-full text-center">
              <Shield className="mx-auto text-[#e51f5c] mb-4" size={48} />
              <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
              <p className="text-slate-400 mb-6">You need admin privileges to access this page.</p>
              <button
                onClick={() => router.push('/')}
                className="btn-primary"
              >
                Go Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
        </div>

        <Players />
      </div>
    </div>
  )
} 