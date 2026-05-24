// PAGE — src/app/manage/page.tsx — CO User Management (limited admin)
// CO can only change: submitter → OC/NC and OC/NC → submitter
// CO cannot promote anyone to CO or admin
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'

export default function ManagePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      // Only CO approvers and admins can access this page
      if (!p || !(p.role === 'admin' || (p.role === 'approver' && p.approver_type === 'CO'))) {
        router.push('/'); return
      }
      setProfile(p)

      // Load all submitters and OC/NC users (not CO or admin — CO cannot manage those)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['submitter', 'approver'])
        .order('full_name', { ascending: true })

      // Filter out CO and admin from the list
      setUsers((data || []).filter(u =>
        u.role === 'submitter' || (u.role === 'approver' && u.approver_type === 'OC/NC')
      ))
      setLoading(false)
    }
    load()
  }, [])

  const toggleRole = async (u: Profile) => {
    setSaving(u.id)
    setSaveError(null)

    const isCurrentlyOC = u.role === 'approver' && u.approver_type === 'OC/NC'
    const newRole = isCurrentlyOC ? 'submitter' : 'approver'
    const newApproverType = isCurrentlyOC ? null : 'OC/NC'

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, approver_type: newApproverType })
      .eq('id', u.id)

    if (error) {
      setSaveError('Failed to update: ' + error.message)
    } else {
      setUsers(us => us.map(user =>
        user.id === u.id
          ? { ...user, role: newRole as any, approver_type: newApproverType as any }
          : user
      ))
    }
    setSaving(null)
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  const ocUsers = users.filter(u => u.role === 'approver' && u.approver_type === 'OC/NC')
  const submitters = users.filter(u => u.role === 'submitter')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage OC/NC Appointments</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Appoint or remove OC/NC roles. You cannot manage CO or Admin accounts.
        </p>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Current OC/NC */}
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-700 text-sm">
            Current OC/NC ({ocUsers.length})
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Click Remove to change back to Submitter
          </p>
        </div>
        {ocUsers.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">No OC/NC appointed yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ocUsers.map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {u.rank} {u.full_name}
                  </p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  {u.company && <p className="text-xs text-gray-400">{u.company}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    OC/NC
                  </span>
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={saving === u.id}
                    className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-medium transition-colors disabled:opacity-50">
                    {saving === u.id ? 'Saving...' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submitters — appoint as OC/NC */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-700 text-sm">
            Submitters ({submitters.length})
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Click Appoint to give OC/NC role
          </p>
        </div>
        {submitters.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">No submitters found</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {submitters.map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {u.rank} {u.full_name}
                  </p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  {u.company && <p className="text-xs text-gray-400">{u.company}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    Submitter
                  </span>
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={saving === u.id}
                    className="text-xs px-3 py-1.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--olive)' }}>
                    {saving === u.id ? 'Saving...' : 'Appoint OC/NC'}
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