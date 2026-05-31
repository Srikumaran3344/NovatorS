// PAGE - src/app/auth/update-password/page.tsx - Set New Password (from reset email link)
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Token exchange state
  const [tokenReady, setTokenReady] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase puts the token in the URL hash fragment on redirect
    // We must exchange it for a session before the user can update their password
    const exchangeToken = async () => {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', ''))

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const errorCode = params.get('error_code')
      const errorDesc = params.get('error_description')

      if (errorCode) {
        // Token expired or invalid - shown when user clicks an old link
        if (errorCode === 'otp_expired') {
          setTokenError('This reset link has expired. Please request a new one.')
        } else {
          setTokenError(errorDesc?.replace(/\+/g, ' ') || 'Invalid reset link.')
        }
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          setTokenError('Could not verify reset link: ' + error.message)
        } else {
          setTokenReady(true)
        }
      } else {
        // No token in URL - user navigated here directly
        // Check if they're already logged in (e.g. from profile edit)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setTokenReady(true)
        } else {
          setTokenError('No reset token found. Please use the link from your email.')
        }
      }
    }

    exchangeToken()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Minimum 8 characters'); return }
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Sign out after password change so they log in fresh
      await supabase.auth.signOut()
      router.push('/auth/login?message=Password+updated+successfully')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <div className="flex items-center gap-2 mb-6">
          <img src="/myLogo.png" alt="Logo" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Set new password</h1>
            <p className="text-xs text-gray-500">NovatorS</p>
          </div>
        </div>

        {/* Token error state - expired or invalid link */}
        {tokenError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <p className="text-sm text-red-700">{tokenError}</p>
            <a href="/auth/reset"
              className="btn-primary text-sm inline-flex">
              Request a new reset link
            </a>
          </div>
        )}

        {/* Loading - exchanging token */}
        {!tokenError && !tokenReady && (
          <div className="text-sm text-gray-500 text-center py-4">
            Verifying reset link...
          </div>
        )}

        {/* Ready - show password form */}
        {tokenReady && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <p className="text-sm text-gray-500">Enter your new password below.</p>
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" required minLength={8}
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input className="input" type="password" required minLength={8}
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-sm">
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}