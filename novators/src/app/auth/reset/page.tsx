// PAGE - src/app/auth/reset/page.tsx - Password Reset Request
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // redirectTo must use the live Vercel URL, not localhost
    // Supabase will send this URL in the reset email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/update-password`,
    })

    if (error) { setError(error.message) } else { setSent(true) }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <div className="flex items-center gap-2 mb-6">
          <img src="/myLogo.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Reset password</h1>
            <p className="text-xs text-gray-500">NovatorS</p>
          </div>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            Check your email - we've sent a password reset link. Click it to set a new password.
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-gray-500">
              Enter your registered email and we'll send you a reset link.
            </p>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-sm">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-center text-gray-500">
          <Link href="/auth/login" className="font-medium underline"
            style={{ color: 'var(--olive)' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}