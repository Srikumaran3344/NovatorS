// PAGE 6 — src/app/approvals/page.tsx — OC/CO Approval Queue
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, Profile, ProjectStatus, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { CheckCircle, XCircle, Archive, ExternalLink, GitBranch, FileText } from 'lucide-react'

export default function ApprovalsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || !['approver', 'admin'].includes(p.role)) { router.push('/'); return }
      setProfile(p)
      const { data } = await supabase
        .from('projects')
        .select('*, profiles(full_name, rank, company, vocation)')
        .in('status', ['submitted', 'under_oc_review', 'under_co_review'])
        .order('created_at', { ascending: true })
      setProjects(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const act = async (project: Project, action: 'approve_to_co' | 'approve_final' | 'reject' | 'archive') => {
    if (!profile) return
    setActingOn(project.id)

    const statusMap: Record<string, ProjectStatus> = {
      approve_to_co: 'under_co_review',
      approve_final: 'approved',
      reject: 'rejected',
      archive: 'archived',
    }
    const actionLabels: Record<string, string> = {
      approve_to_co: 'Approved — forwarded to CO',
      approve_final: 'Approved — project published',
      reject: 'Rejected',
      archive: 'Archived',
    }

    const newStatus = statusMap[action]

    await supabase.from('projects').update({
      status: newStatus,
      ...(action === 'approve_final' ? { approved_by: `${profile.rank} ${profile.full_name}` } : {}),
    }).eq('id', project.id)

    await supabase.from('approval_events').insert({
      project_id: project.id,
      actor_id: profile.id,
      actor_name: `${profile.rank} ${profile.full_name}`,
      action: actionLabels[action],
      remarks: remarks[project.id] || null,
      from_status: project.status,
      to_status: newStatus,
    })

    setProjects(ps => ps.filter(p => p.id !== project.id))
    setActingOn(null)
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending approvals</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.rank} {profile?.full_name} · {projects.length} project{projects.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">All caught up — no pending projects</div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <div key={project.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{project.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(project.profiles as any)?.rank} {(project.profiles as any)?.full_name} · {(project.profiles as any)?.company}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[project.status]}`}>
                  {STATUS_LABELS[project.status]}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-2">{project.short_description}</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">{project.full_description}</p>

              <div className="flex gap-3 mb-4 flex-wrap">
                {project.demo_video_url && (
                  <a href={project.demo_video_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Demo video
                  </a>
                )}
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <GitBranch className="w-3 h-3" /> GitHub
                  </a>
                )}
                {project.pdf_url && (
                  <a href={project.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <FileText className="w-3 h-3" /> PDF
                  </a>
                )}
              </div>

              <div className="mb-4">
                <label className="label text-xs">Remarks (optional)</label>
                <textarea className="input text-sm min-h-[72px]" placeholder="Leave feedback for the submitter..."
                  value={remarks[project.id] || ''} onChange={e => setRemarks(r => ({ ...r, [project.id]: e.target.value }))} />
              </div>

              <div className="flex gap-2 flex-wrap">
                {project.status === 'submitted' && (
                  <button onClick={() => act(project, 'approve_to_co')} disabled={actingOn === project.id}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
                    <CheckCircle className="w-4 h-4" /> Approve → CO
                  </button>
                )}
                {project.status === 'under_co_review' && (
                  <button onClick={() => act(project, 'approve_final')} disabled={actingOn === project.id}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-white font-medium transition-colors"
                    style={{ backgroundColor: 'var(--olive)' }}>
                    <CheckCircle className="w-4 h-4" /> Publish to registry
                  </button>
                )}
                <button onClick={() => act(project, 'reject')} disabled={actingOn === project.id}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium border border-red-200 transition-colors">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => act(project, 'archive')} disabled={actingOn === project.id}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium border border-gray-200 transition-colors">
                  <Archive className="w-4 h-4" /> Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}