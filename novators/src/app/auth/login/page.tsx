// PAGE 2 - src/app/auth/login/page.tsx - Sign In
'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const msg = searchParams.get('message')
    if (msg) setSuccess(msg.replace(/\+/g, ' '))
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <div className="flex items-center gap-2 mb-6">
          <img src="/myLogo.png" alt="Logo" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Sign in</h1>
            <p className="text-xs text-gray-500">NovatorS</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-800">
            {success}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label" style={{ marginBottom: 0 }}>Password</label>
              <Link href="/auth/reset" className="text-xs underline"
                style={{ color: 'var(--olive)' }}>
                Forgot password?
              </Link>
            </div>
            <input className="input" type="password" required
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="btn-primary w-full justify-center py-2.5 text-sm">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          No account?{' '}
          <Link href="/auth/register" className="font-medium underline"
            style={{ color: 'var(--olive)' }}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}