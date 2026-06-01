// PAGE 3 - src/app/auth/register/page.tsx - Register
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RANKS = ['REC','PTE','LCP','CPL','CFC','SCT','3SG','2SG','1SG','SSG','MSG','3WO','2WO','1WO','MWO','SWO','CWO','2LT','LTA','CPT','MAJ','LTC','SLTC','COL','BG','MG','LG']

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', rank: 'PTE', company: '', vocation: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Pass ALL fields through raw_user_meta_data so the DB trigger
    // can write them directly - no separate update call needed
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          rank: form.rank,
          company: form.company,
          vocation: form.vocation,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <div className="flex items-center gap-2 mb-6">
          <img src="/myLogo.png" alt="NovatorS" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Create account</h1>
            <p className="text-xs text-gray-500">NovatorS</p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rank</label>
              <select className="input" value={form.rank} onChange={e => set('rank', e.target.value)}>
                {RANKS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.full_name}
                onChange={e => set('full_name', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Company / Platoon</label>
            <input className="input" placeholder="e.g. HQ" required
              value={form.company} onChange={e => set('company', e.target.value)} />
          </div>

          <div>
            <label className="label">Vocation</label>
            <input className="input" placeholder="e.g. ASA, SA(GE), TO(CBT) "
              value={form.vocation} onChange={e => set('vocation', e.target.value)} />
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required
              value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={8}
              value={form.password} onChange={e => set('password', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="btn-primary w-full justify-center py-2.5 text-sm">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium underline" style={{ color: 'var(--olive)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}