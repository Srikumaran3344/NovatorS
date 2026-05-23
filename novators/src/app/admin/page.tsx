// PAGE 8 — src/app/admin/page.tsx — Admin Panel
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Project, ProjectRemark, Profile, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { Trash2, Plus, ChevronDown, ChevronUp, MessageSquare, Archive, X, Users } from 'lucide-react'

interface ApproverEmail {
  id: string
  email: string
  name: string
  approver_role: 'OC/NC' | 'CO'
}

type AdminTab = 'approvers' | 'users' | 'projects' | 'remarks'

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('approvers')
  const [approvers, setApprovers] = useState<ApproverEmail[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [remarks, setRemarks] = useState<ProjectRemark[]>([])
  const [form, setForm] = useState({ email: '', name: '', approver_role: 'OC/NC' as 'OC/NC' | 'CO' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingUser, setSavingUser] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (p?.role !== 'admin') { router.push('/'); return }

      const [
        { data: approverData },
        { data: userData },
        { data: projectData },
        { data: remarkData }
      ] = await Promise.all([
        supabase.from('approver_emails').select('*').order('created_at', { ascending: true }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*, profiles(full_name, rank, company)').order('created_at', { ascending: false }),
        supabase.from('project_remarks').select('*, profiles(full_name, rank), projects(title)').order('created_at', { ascending: false }),
      ])

      setApprovers(approverData || [])
      setUsers(userData || [])
      setProjects(projectData || [])
      setRemarks(remarkData || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Approver email actions ────────────────────────────────────────────────
  const addApprover = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { data, error: err } = await supabase.from('approver_emails').insert(form).select().single()
    if (err) { setError(err.message); return }
    setApprovers(a => [...a, data])
    setForm({ email: '', name: '', approver_role: 'OC/NC' })
  }

  const removeApprover = async (id: string) => {
    await supabase.from('approver_emails').delete().eq('id', id)
    setApprovers(a => a.filter(x => x.id !== id))
  }

  // ── User role actions ─────────────────────────────────────────────────────
  const updateUserRole = async (
    userId: string,
    role: string,
    approverType: string | null
  ) => {
    setSavingUser(userId)
    const { error: err } = await supabase
      .from('profiles')
      .update({ role, approver_type: approverType })
      .eq('id', userId)

    if (!err) {
      setUsers(us => us.map(u =>
        u.id === userId ? { ...u, role: role as any, approver_type: approverType as any } : u
      ))
    }
    setSavingUser(null)
  }

  // ── Project actions ───────────────────────────────────────────────────────
  const archiveProject = async (id: string) => {
    const { error: err } = await supabase
      .from('projects').update({ status: 'archived' }).eq('id', id)
    if (!err) setProjects(ps => ps.map(p => p.id === id ? { ...p, status: 'archived' } : p))
  }

  const deleteProject = async (id: string) => {
    const { error: err } = await supabase.from('projects').delete().eq('id', id)
    if (err) { alert('Delete failed: ' + err.message); return }
    setProjects(ps => ps.filter(p => p.id !== id))
    setRemarks(rs => rs.filter(r => r.project_id !== id))
    setConfirmDelete(null)
  }

  // ── Remark actions ────────────────────────────────────────────────────────
  const deleteRemark = async (id: string) => {
    const { error: err } = await supabase.from('project_remarks').delete().eq('id', id)
    if (err) { alert('Delete failed: ' + err.message); return }
    setRemarks(rs => rs.filter(r => r.id !== id))
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  const tabs: { key: AdminTab; label: string; count: number }[] = [
    { key: 'approvers', label: 'Approver Emails', count: approvers.length },
    { key: 'users', label: 'Users', count: users.length },
    { key: 'projects', label: 'Projects', count: projects.length },
    { key: 'remarks', label: 'Remarks', count: remarks.length },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage users, approvers, projects, and remarks</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab: Approver Emails ── */}
      {tab === 'approvers' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-1">Add approver email</h2>
            <p className="text-xs text-gray-500 mb-4">
              Users who sign up with these emails automatically get the Approver role.
              To change an existing user's role, use the Users tab.
            </p>
            <form onSubmit={addApprover} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input className="input" required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.approver_role}
                    onChange={e => setForm(f => ({ ...f, approver_role: e.target.value as 'OC/NC' | 'CO' }))}>
                    <option value="OC">OC/NC</option>
                    <option value="CO">CO</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
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
                        {a.approver_role === 'OC/NC' ? 'OC/NC' : 'CO'}
                      </span>
                      <button onClick={() => removeApprover(a.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Users ── */}
      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-700 text-sm">All users ({users.length})</h2>
            <p className="text-xs text-gray-400 mt-0.5">Change role directly — updates immediately without SQL</p>
          </div>
          <div className="divide-y divide-gray-100">
            {users.map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {u.rank} {u.full_name || '—'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  {u.company && <p className="text-xs text-gray-400">{u.company}</p>}
                </div>

                {/* Role selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="input text-xs py-1 px-2 w-32"
                    value={`${u.role}${u.approver_type ? ':' + u.approver_type : ''}`}
                    onChange={async e => {
                      const val = e.target.value
                      if (val === 'submitter') {
                        await updateUserRole(u.id, 'submitter', null)
                      } else if (val === 'approver:OC') {
                        await updateUserRole(u.id, 'approver', 'OC/NC')
                      } else if (val === 'approver:CO') {
                        await updateUserRole(u.id, 'approver', 'CO')
                      } else if (val === 'admin') {
                        await updateUserRole(u.id, 'admin', null)
                      }
                    }}
                  >
                    <option value="submitter">Submitter</option>
                    <option value="approver:OC">Approver — OC/NC</option>
                    <option value="approver:CO">Approver — CO</option>
                    <option value="admin">Admin</option>
                  </select>
                  {savingUser === u.id && (
                    <span className="text-xs text-gray-400">Saving...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Projects ── */}
      {tab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No projects yet</p>}
          {projects.map(project => (
            <div key={project.id} className="card overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link href={`/projects/${project.id}`}
                      className="font-semibold text-gray-900 text-sm hover:underline">
                      {project.title}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {(project.profiles as any)?.rank} {(project.profiles as any)?.full_name}
                    {' '}· {(project.profiles as any)?.company}
                    {' '}· {new Date(project.created_at).toLocaleDateString('en-SG')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {project.status !== 'archived' && (
                    <button onClick={() => archiveProject(project.id)}
                      title="Archive"
                      className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors">
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(project.id)}
                    title="Delete permanently"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors">
                    {expandedProject === project.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedProject === project.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-600 leading-relaxed">{project.short_description}</p>
                </div>
              )}

              {confirmDelete === project.id && (
                <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-red-700 font-medium">
                    Permanently delete this project and all its data?
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => deleteProject(project.id)}
                      className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Remarks ── */}
      {tab === 'remarks' && (
        <div className="space-y-2">
          {remarks.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No remarks yet</p>}
          {remarks.map(remark => (
            <div key={remark.id} className="card p-4 flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-xs font-semibold text-gray-700">
                    {(remark.profiles as any)?.rank} {(remark.profiles as any)?.full_name}
                  </p>
                  <span className="text-xs text-gray-400">on</span>
                  <Link href={`/projects/${remark.project_id}`}
                    className="text-xs text-blue-600 hover:underline truncate max-w-[200px]">
                    {(remark as any).projects?.title}
                  </Link>
                  <span className="text-xs text-gray-400">
                    · {new Date(remark.created_at).toLocaleDateString('en-SG')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{remark.content}</p>
              </div>
              <button onClick={() => deleteRemark(remark.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}