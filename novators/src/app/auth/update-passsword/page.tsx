// PAGE - src/app/auth/update-password/page.tsx - Set New Password (from reset email link)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'


export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Minimum 8 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard') }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <div className="flex items-center gap-2 mb-6">
          <img src="/myLogo.png" alt="Logo" className="w-9 h-9 rounded-lg flex items-center justify-center object-contain"/>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Set new password</h1>
            <p className="text-xs text-gray-500">SAF Project Registry</p>
          </div>
        </div>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input className="input" type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-sm">
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}