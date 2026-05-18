// PAGE 8 — src/app/admin/page.tsx — Admin Panel
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Plus } from 'lucide-react'

interface ApproverEmail {
  id: string
  email: string
  name: string
  approver_role: 'OC' | 'CO'
}

export default function AdminPage() {
  const [approvers, setApprovers] = useState<ApproverEmail[]>([])
  const [form, setForm] = useState({ email: '', name: '', approver_role: 'OC' as 'OC' | 'CO' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (p?.role !== 'admin') { router.push('/'); return }
      const { data } = await supabase.from('approver_emails').select('*').order('created_at', { ascending: true })
      setApprovers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const addApprover = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { data, error: err } = await supabase.from('approver_emails').insert(form).select().single()
    if (err) { setError(err.message); return }
    setApprovers(a => [...a, data])
    setForm({ email: '', name: '', approver_role: 'OC' })
  }

  const removeApprover = async (id: string) => {
    await supabase.from('approver_emails').delete().eq('id', id)
    setApprovers(a => a.filter(x => x.id !== id))
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage OC/CO emails. Users who sign up with these emails get the Approver role automatically.
        </p>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-gray-800 text-sm mb-4">Add approver email</h2>
        <form onSubmit={addApprover} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.approver_role} onChange={e => setForm(f => ({ ...f, approver_role: e.target.value as 'OC' | 'CO' }))}>
                <option value="OC">OC</option>
                <option value="CO">CO</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add approver
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-700 text-sm">Registered approvers ({approvers.length})</h2>
        </div>
        {approvers.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">No approvers added yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {approvers.map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.approver_role === 'CO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {a.approver_role}
                  </span>
                  <button onClick={() => removeApprover(a.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}