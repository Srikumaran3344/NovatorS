// PAGE 6 — src/app/approvals/page.tsx — OC/NC and CO Approval Queue
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, Profile, ProjectStatus, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { CheckCircle, XCircle, Archive, ExternalLink, GitBranch, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

// A project needing approval is either:
// 1. status in (submitted, under_oc_review, under_co_review) — new/resubmitted project
// 2. status = approved AND pending_update_status is not null — update to existing project
type ApprovalProject = Project & {
  pending_update?: Record<string, any> | null
  pending_update_status?: string | null
}

export default function ApprovalsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [approverType, setApproverType] = useState<'OC/NC' | 'CO' | null>(null)
  const [projects, setProjects] = useState<ApprovalProject[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [ocApprovedBy, setOcApprovedBy] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (!p || !['approver', 'admin'].includes(p.role)) { router.push('/'); return }
      setProfile(p)

      const type = p.approver_type as 'OC/NC' | 'CO' | null
      setApproverType(type)

      // Fetch pending projects based on role
      let statusFilter: string[]
      if (p.role === 'admin') {
        statusFilter = ['submitted', 'under_oc_review', 'under_co_review']
      } else if (type === 'CO') {
        statusFilter = ['under_co_review']
      } else {
        statusFilter = ['submitted', 'under_oc_review']
      }

      // New/resubmitted projects
      const { data: newProjects } = await supabase
        .from('projects')
        .select('*, profiles(full_name, rank, company, vocation)')
        .in('status', statusFilter)
        .order('created_at', { ascending: true })

      // Updates to existing approved projects — filter by oc_email so only
      // the specific OC/NC the submitter addressed sees the request
      let updateProjects: ApprovalProject[] = []
      if (type === 'CO' || p.role === 'admin') {
        const { data: u } = await supabase
          .from('projects')
          .select('*, profiles(full_name, rank, company)')
          .eq('status', 'approved')
          .eq('pending_update_status', 'under_co_review')
        updateProjects = u || []
      } else if (type === 'OC/NC') {
        // Only show updates where oc_email matches this approver's email
        const { data: u } = await supabase
          .from('projects')
          .select('*, profiles(full_name, rank, company)')
          .eq('status', 'approved')
          .in('pending_update_status', ['submitted', 'under_oc_review'])
          .eq('oc_email', p.email)
        updateProjects = u || []
      }

      setProjects([...(newProjects || []), ...updateProjects])
      setLoading(false)
    }
    load()
  }, [])

  const handleExpand = async (project: ApprovalProject) => {
    if (expanded === project.id) { setExpanded(null); return }
    setExpanded(project.id)

    // If CO is viewing, fetch which OC/NC approved/forwarded this project
    if ((approverType === 'CO' || profile?.role === 'admin') && !ocApprovedBy[project.id]) {
      const { data: ev } = await supabase
        .from('approval_events')
        .select('actor_name')
        .eq('project_id', project.id)
        .or('action.ilike.%forwarded to CO%,action.ilike.%Approved by OC%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (ev?.actor_name) {
        setOcApprovedBy(prev => ({ ...prev, [project.id]: ev.actor_name }))
      }
    }

    // Mark as under_oc_review when OC/NC opens a submitted new project
    if (project.status === 'submitted' && profile && approverType !== 'CO') {
      await supabase.from('projects').update({ status: 'under_oc_review' }).eq('id', project.id)
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

    // Mark pending update as under_oc_review when OC/NC opens it
    if (project.status === 'approved' &&
        project.pending_update_status === 'submitted' &&
        project.pending_update != null &&
        profile && approverType !== 'CO') {
      await supabase.from('projects')
        .update({ pending_update_status: 'under_oc_review' })
        .eq('id', project.id)
      setProjects(ps => ps.map(p =>
        p.id === project.id ? { ...p, pending_update_status: 'under_oc_review' } : p
      ))
    }
  }

  const act = async (
    project: ApprovalProject,
    action: 'approve_to_co' | 'approve_final' | 'reject' | 'archive'
  ) => {
    if (!profile) return
    setActingOn(project.id)

    const isPendingUpdate = project.status === 'approved' &&
      project.pending_update != null &&
      project.pending_update_status != null

    if (isPendingUpdate) {
      // ── Handle update approval ────────────────────────────────────────────
      if (action === 'approve_to_co') {
        await supabase.from('projects')
          .update({ pending_update_status: 'under_co_review' })
          .eq('id', project.id)
        await supabase.from('approval_events').insert({
          project_id: project.id,
          actor_id: profile.id,
          actor_name: `${profile.rank} ${profile.full_name}`,
          action: 'Update approved by OC/NC — forwarded to CO',
          remarks: remarks[project.id] || null,
          from_status: 'approved',
          to_status: 'approved',
        })
      } else if (action === 'approve_final') {
        // Apply the pending update to the live project
        const update = project.pending_update!
        await supabase.from('projects').update({
          title: update.title,
          short_description: update.short_description,
          full_description: update.full_description,
          oc_name: update.oc_name,
          oc_email: update.oc_email,
          demo_video_url: update.demo_video_url,
          project_url: update.project_url,
          github_url: update.github_url,
          pdf_url: update.pdf_url,
          pdf_name: update.pdf_name,
          pending_update: null,
          pending_update_status: null,
          approved_by: `${profile.rank} ${profile.full_name}`,
        }).eq('id', project.id)
        await supabase.from('approval_events').insert({
          project_id: project.id,
          actor_id: profile.id,
          actor_name: `${profile.rank} ${profile.full_name}`,
          action: 'Update approved by CO — live version updated',
          remarks: remarks[project.id] || null,
          from_status: 'approved',
          to_status: 'approved',
        })
      } else if (action === 'reject') {
        // Clear the pending update
        await supabase.from('projects').update({
          pending_update: null,
          pending_update_status: null,
        }).eq('id', project.id)
        await supabase.from('approval_events').insert({
          project_id: project.id,
          actor_id: profile.id,
          actor_name: `${profile.rank} ${profile.full_name}`,
          action: 'Update rejected — live version unchanged',
          remarks: remarks[project.id] || null,
          from_status: 'approved',
          to_status: 'approved',
        })
      }
    } else {
      // ── Handle new/resubmitted project ───────────────────────────────────
      const statusMap: Record<string, ProjectStatus> = {
        approve_to_co: 'under_co_review',
        approve_final: 'approved',
        reject: 'rejected',
        archive: 'archived',
      }
      const actionLabels: Record<string, string> = {
        approve_to_co: 'Approved by OC/NC — forwarded to CO',
        approve_final: 'Approved by CO — project published',
        reject: 'Rejected',
        archive: 'Archived',
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
    }

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
          {projects.length} item{projects.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      <div className={`rounded-lg px-4 py-2.5 mb-5 text-sm border ${
        approverType === 'CO'
          ? 'bg-purple-50 border-purple-200 text-purple-800'
          : 'bg-blue-50 border-blue-200 text-blue-800'
      }`}>
        {approverType === 'CO'
          ? 'CO view — you see projects and updates forwarded by OC/NC for final approval.'
          : approverType === 'OC/NC'
          ? 'OC/NC view — you see new submissions and project updates. Approve to forward to CO.'
          : 'Admin view — all stages visible.'}
      </div>

      {projects.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          All caught up — no pending items for your review stage
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const isPendingUpdate = project.status === 'approved' &&
              project.pending_update_status != null &&
              project.pending_update != null
            const displayData = isPendingUpdate ? project.pending_update! : project

            return (
              <div key={project.id} className="card overflow-hidden">
                <div
                  className="p-5 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleExpand(project)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="font-semibold text-gray-900 text-sm">
                        {isPendingUpdate ? displayData.title : project.title}
                      </h2>
                      {isPendingUpdate ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Update pending
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status]}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {(project.profiles as any)?.rank} {(project.profiles as any)?.full_name}
                      {' '}· {(project.profiles as any)?.company}
                      {' '}· {new Date(project.updated_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-gray-400 shrink-0">
                    {expanded === project.id
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {expanded === project.id && (
                  <div className="border-t border-gray-100 p-5 space-y-4">

                    {/* Show which OC/NC approved and forwarded — visible to CO and admin */}
                    {(approverType === 'CO' || profile?.role === 'admin') && ocApprovedBy[project.id] && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                        <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-sm text-green-800">
                          Approved and forwarded by{' '}
                          <span className="font-semibold">{ocApprovedBy[project.id]}</span>
                        </p>
                      </div>
                    )}

                    {/* For updates — show diff between current and proposed */}
                    {isPendingUpdate && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                        <p className="font-semibold mb-1">This is a proposed update to an already-published project.</p>
                        <p>The live version remains unchanged until you approve this update.</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Short description</p>
                      <p className="text-sm text-gray-700">{displayData.short_description}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full description</p>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{displayData.full_description}</p>
                    </div>

                    {/* Scale — editable by OC/NC and CO */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Project scale{' '}
                        <span className="text-gray-400 font-normal normal-case">(you can adjust this)</span>
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {(['SAF','Formation','Unit','Coy'] as const).map(scale => (
                          <button key={scale} type="button"
                            onClick={async () => {
                              if (isPendingUpdate) {
                                const updated = { ...project.pending_update, project_scale: scale }
                                await supabase.from('projects').update({ pending_update: updated }).eq('id', project.id)
                                setProjects(ps => ps.map(p => p.id === project.id
                                  ? { ...p, pending_update: updated } : p))
                              } else {
                                await supabase.from('projects').update({ project_scale: scale }).eq('id', project.id)
                                setProjects(ps => ps.map(p => p.id === project.id
                                  ? { ...p, project_scale: scale } : p))
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              (displayData.project_scale || project.project_scale) === scale
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}>
                            {scale}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      {displayData.demo_video_url && (
                        <a href={displayData.demo_video_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Demo video
                        </a>
                      )}
                      {displayData.github_url && (
                        <a href={displayData.github_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <GitBranch className="w-3 h-3" /> GitHub
                        </a>
                      )}
                      {displayData.project_url && (
                        <a href={displayData.project_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Live project
                        </a>
                      )}
                    </div>

                    <div>
                      <label className="label text-xs">
                        Remarks <span className="text-gray-400 font-normal">(shown to submitter)</span>
                      </label>
                      <textarea className="input text-sm min-h-[80px]"
                        placeholder="Leave feedback for the submitter..."
                        value={remarks[project.id] || ''}
                        onChange={e => setRemarks(r => ({ ...r, [project.id]: e.target.value }))} />
                    </div>

                    <div className="flex gap-2 flex-wrap pt-1">
                      {/* OC/NC approve buttons */}
                      {(project.status === 'under_oc_review' ||
                        (isPendingUpdate && (project.pending_update_status === 'submitted' || project.pending_update_status === 'under_oc_review'))) &&
                        (approverType === 'OC/NC' || approverType === null) && (
                        <button onClick={() => act(project, 'approve_to_co')} disabled={actingOn === project.id}
                          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
                          <CheckCircle className="w-4 h-4" />
                          {isPendingUpdate ? 'Approve update → CO' : 'Approve → CO'}
                        </button>
                      )}

                      {/* CO final approve */}
                      {(project.status === 'under_co_review' ||
                        (isPendingUpdate && project.pending_update_status === 'under_co_review')) &&
                        (approverType === 'CO' || approverType === null) && (
                        <button onClick={() => act(project, 'approve_final')} disabled={actingOn === project.id}
                          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-white font-medium transition-colors"
                          style={{ backgroundColor: 'var(--olive)' }}>
                          <CheckCircle className="w-4 h-4" />
                          {isPendingUpdate ? 'Approve & apply update' : 'Publish to registry'}
                        </button>
                      )}

                      <button onClick={() => act(project, 'reject')} disabled={actingOn === project.id}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium border border-red-200 transition-colors">
                        <XCircle className="w-4 h-4" />
                        {isPendingUpdate ? 'Reject update' : 'Reject'}
                      </button>

                      {!isPendingUpdate && (
                        <button onClick={() => act(project, 'archive')} disabled={actingOn === project.id}
                          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium border border-gray-200 transition-colors">
                          <Archive className="w-4 h-4" /> Archive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}