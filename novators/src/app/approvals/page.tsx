// PAGE 6 - src/app/approvals/page.tsx - OC/NC and CO Approval Queue
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, Profile, ProjectStatus, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { CheckCircle, XCircle, Archive, ExternalLink, GitBranch, FileText, ChevronDown, ChevronUp } from 'lucide-react'

export default function ApprovalsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [approverType, setApproverType] = useState<'OC/NC' | 'CO' | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: p } = await supabase
        .from('profiles')
        .select('*, approver_type')
        .eq('id', user.id)
        .single()

      if (!p || !['approver', 'admin'].includes(p.role)) { router.push('/'); return }
      setProfile(p)

      // Determine what stage this person can approve
      // OC/NC sees: submitted, under_oc_review
      // CO sees: under_co_review
      // Admin sees: everything
      const type = p.approver_type as 'OC/NC' | 'CO' | null
      setApproverType(type)

      let statusFilter: string[]
      if (p.role === 'admin') {
        statusFilter = ['submitted', 'under_oc_review', 'under_co_review']
      } else if (type === 'CO') {
        statusFilter = ['under_co_review']
      } else {
        // OC or approver with no type - sees submitted and under_oc_review
        statusFilter = ['submitted', 'under_oc_review']
      }

      const { data } = await supabase
        .from('projects')
        .select('*, profiles(full_name, rank, company, vocation)')
        .in('status', statusFilter)
        .order('created_at', { ascending: true })

      setProjects(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleExpand = async (project: Project) => {
    if (expanded === project.id) { setExpanded(null); return }
    setExpanded(project.id)

    // Mark as under_oc_review when OC/NC opens a submitted project
    if (project.status === 'submitted' && profile && approverType !== 'CO') {
      await supabase.from('projects')
        .update({ status: 'under_oc_review' })
        .eq('id', project.id)
      await supabase.from('approval_events').insert({
        project_id: project.id,
        actor_id: profile.id,
        actor_name: `${profile.rank} ${profile.full_name}`,
        action: 'Opened for review by OC/NC',
        from_status: 'submitted',
        to_status: 'under_oc_review',
      })
      setProjects(ps => ps.map(p =>
        p.id === project.id ? { ...p, status: 'under_oc_review' } : p
      ))
    }
  }

  const act = async (
    project: Project,
    action: 'approve_to_co' | 'approve_final' | 'reject' | 'archive'
  ) => {
    if (!profile) return
    setActingOn(project.id)

    const statusMap: Record<string, ProjectStatus> = {
      approve_to_co: 'under_co_review',
      approve_final: 'approved',
      reject: 'rejected',
      archive: 'archived',
    }
    const actionLabels: Record<string, string> = {
      approve_to_co: 'Approved by OC/NC - forwarded to CO',
      approve_final: 'Approved by CO - project published',
      reject: 'Rejected',
      archive: 'Archived with remarks',
    }

    const newStatus = statusMap[action]
    await supabase.from('projects').update({
      status: newStatus,
      ...(action === 'approve_final'
        ? { approved_by: `${profile.rank} ${profile.full_name}` }
        : {}),
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
    setExpanded(null)
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  const roleLabel = approverType === 'CO' ? 'CO' : approverType === 'OC/NC' ? 'OC/NC' : 'Admin'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending approvals</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.rank} {profile?.full_name} · {roleLabel} ·{' '}
          {projects.length} project{projects.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      {/* Role info banner */}
      <div className={`rounded-lg px-4 py-2.5 mb-5 text-sm border ${
        approverType === 'CO'
          ? 'bg-purple-50 border-purple-200 text-purple-800'
          : 'bg-blue-50 border-blue-200 text-blue-800'
      }`}>
        {approverType === 'CO'
          ? 'You are reviewing as CO - you see projects forwarded by OC/NC for final approval.'
          : approverType === 'OC/NC'
          ? 'You are reviewing as OC/NC - you can approve projects to forward to CO, or reject them.'
          : 'You are reviewing as Admin - you can see and act on all stages.'}
      </div>

      {projects.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          All caught up - no pending projects for your review stage
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <div key={project.id} className="card overflow-hidden">
              {/* Header - click to expand */}
              <div
                className="p-5 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleExpand(project)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-semibold text-gray-900 text-sm">{project.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {(project.profiles as any)?.rank} {(project.profiles as any)?.full_name}
                    {' '}· {(project.profiles as any)?.company}
                    {' '}· Submitted {new Date(project.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-gray-400 shrink-0">
                  {expanded === project.id
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Expanded detail + actions */}
              {expanded === project.id && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Short description</p>
                    <p className="text-sm text-gray-700">{project.short_description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full description</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{project.full_description}</p>
                  </div>

                  <div className="flex gap-3 flex-wrap">
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
                    {project.project_url && (
                      <a href={project.project_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Live project
                      </a>
                    )}
                    {project.pdf_url && (
                      <a href={project.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {project.pdf_name || 'PDF'}
                      </a>
                    )}
                  </div>

                  <div>
                    <label className="label text-xs">
                      Remarks{' '}
                      <span className="text-gray-400 font-normal">
                        (shown to submitter - required for reject/archive)
                      </span>
                    </label>
                    <textarea
                      className="input text-sm min-h-[80px]"
                      placeholder="Leave feedback for the submitter..."
                      value={remarks[project.id] || ''}
                      onChange={e => setRemarks(r => ({ ...r, [project.id]: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap pt-1">
                    {/* OC/NC: approve to CO - only shown for OC type or admin on OC-stage projects */}
                    {(project.status === 'submitted' || project.status === 'under_oc_review') &&
                      (approverType === 'OC/NC' || approverType === null) && (
                      <button
                        onClick={() => act(project, 'approve_to_co')}
                        disabled={actingOn === project.id}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
                        <CheckCircle className="w-4 h-4" /> Approve → CO
                      </button>
                    )}

                    {/* CO: final publish - only shown for CO type or admin on CO-stage */}
                    {project.status === 'under_co_review' &&
                      (approverType === 'CO' || approverType === null) && (
                      <button
                        onClick={() => act(project, 'approve_final')}
                        disabled={actingOn === project.id}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-white font-medium transition-colors"
                        style={{ backgroundColor: 'var(--olive)' }}>
                        <CheckCircle className="w-4 h-4" /> Publish to registry
                      </button>
                    )}

                    <button
                      onClick={() => act(project, 'reject')}
                      disabled={actingOn === project.id}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium border border-red-200 transition-colors">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>

                    <button
                      onClick={() => act(project, 'archive')}
                      disabled={actingOn === project.id}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium border border-gray-200 transition-colors">
                      <Archive className="w-4 h-4" /> Archive
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}