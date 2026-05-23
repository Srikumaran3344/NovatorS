// PAGE - src/app/profile/page.tsx - Edit Profile
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { CheckCircle } from 'lucide-react'

const RANKS = ['REC','PTE','LCP','CPL','CFC','SCT','3SG','2SG','1SG','SSG','MSG','3WO','2WO','1WO','MWO','SWO','CWO','2LT','LTA','CPT','MAJ','LTC','SLTC','COL','BG','MG','LG']

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', rank: 'PTE', company: '', vocation: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Password change state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        setForm({ full_name: data.full_name, rank: data.rank, company: data.company, vocation: data.vocation })
      }
      setLoading(false)
    }
    load()
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('profiles').update(form).eq('id', profile.id)
    if (err) { setError(err.message) } else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.newPw.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (err) { setPwError(err.message) } else {
      setPwSaved(true)
      setPwForm({ current: '', newPw: '', confirm: '' })
      setTimeout(() => setPwSaved(false), 3000)
    }
    setPwSaving(false)
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'var(--olive)' }}>
          {profile?.full_name?.[0] || profile?.email?.[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-xs text-gray-500">{profile?.email} · <span className="capitalize">{profile?.role}</span></p>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={saveProfile} className="card p-5 mb-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">Personal details</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rank</label>
            <select className="input" value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}>
              {RANKS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Company / Platoon</label>
          <input className="input" required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
        </div>

        <div>
          <label className="label">Vocation</label>
          <input className="input" value={form.vocation} onChange={e => setForm(f => ({ ...f, vocation: e.target.value }))} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {/* Password change */}
      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">Change password</h2>

        <div>
          <label className="label">New password</label>
          <input className="input" type="password" minLength={8} required
            value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" minLength={8} required
            value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
        </div>

        {pwError && <p className="text-sm text-red-600">{pwError}</p>}

        <button type="submit" disabled={pwSaving} className="btn-primary text-sm">
          {pwSaved ? <><CheckCircle className="w-4 h-4" /> Password updated!</> : pwSaving ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}