// PAGE — src/app/submit/edit/[id]/page.tsx — Edit / Resubmit / Update Project
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Project, PROJECT_SCALES, ProjectScale } from '@/lib/types'
import { AlertCircle } from 'lucide-react'

export default function EditSubmitPage() {
  const { id } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [form, setForm] = useState({
    title: '', short_description: '', full_description: '',
    oc_email: '', demo_video_url: '', project_url: '', github_url: '',
    project_scale: 'Unit' as ProjectScale,
  })
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [ocEmailError, setOcEmailError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rejectionRemark, setRejectionRemark] = useState<{
    actor_name: string; remarks: string | null; created_at: string
  } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single()
      if (!proj || proj.submitter_id !== user.id) { router.push('/dashboard'); return }
      if (!['rejected', 'approved'].includes(proj.status)) { router.push('/dashboard'); return }

      setProject(proj)

      // Pre-fill from pending_update if one exists, otherwise from live project
      const base = (proj.pending_update && Object.keys(proj.pending_update).length > 0)
        ? proj.pending_update
        : proj

      setForm({
        title: base.title || '',
        short_description: base.short_description || '',
        full_description: base.full_description || '',
        oc_email: base.oc_email || '',
        demo_video_url: base.demo_video_url || '',
        project_url: base.project_url || '',
        github_url: base.github_url || '',
        project_scale: base.project_scale || 'Unit',
      })

      // Load rejection remark if rejected
      if (proj.status === 'rejected') {
        const { data: ev } = await supabase
          .from('approval_events')
          .select('actor_name, remarks, created_at')
          .eq('project_id', proj.id)
          .eq('to_status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle()
        setRejectionRemark(ev)
      }
    }
    load()
  }, [id])

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'title') setTitleError('')
    if (k === 'oc_email') setOcEmailError('')
  }

  const checkTitleUnique = async (title: string): Promise<boolean> => {
    const { data } = await supabase.from('projects').select('id')
      .ilike('title', title.trim()).neq('id', project?.id)
    return !data || data.length === 0
  }

  const validateOcEmail = async (email: string): Promise<{ valid: boolean; name?: string }> => {
    const { data } = await supabase.from('profiles')
      .select('id, full_name, rank')
      .eq('email', email.trim().toLowerCase())
      .eq('role', 'approver')
      .eq('approver_type', 'OC/NC')
      .maybeSingle()
    if (!data) return { valid: false }
    return { valid: true, name: `${data.rank} ${data.full_name}` }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !project) return
    setError('')
    setSubmitting(true)

    // Title uniqueness
    const titleOk = await checkTitleUnique(form.title)
    if (!titleOk) {
      setTitleError('A project with this title already exists.')
      setSubmitting(false)
      return
    }

    // OC/NC email validation
    const ocCheck = await validateOcEmail(form.oc_email)
    if (!ocCheck.valid) {
      setOcEmailError('This email is not registered as an OC/NC.')
      setSubmitting(false)
      return
    }

    const isRejected = project.status === 'rejected'
    const payload = {
      title: form.title.trim(),
      short_description: form.short_description,
      full_description: form.full_description,
      oc_email: form.oc_email.trim().toLowerCase(),
      oc_name: ocCheck.name || '',
      demo_video_url: form.demo_video_url || null,
      project_url: form.project_url || null,
      github_url: form.github_url || null,
      project_scale: form.project_scale,
    }

    if (isRejected) {
      // ── Resubmit rejected: replace project data, reset to submitted ───────
      const { error: err } = await supabase.from('projects').update({
        ...payload,
        status: 'submitted',
        pending_update: null,
        pending_update_status: null,
      }).eq('id', project.id)

      if (err) {
        console.error('Resubmit error:', err)
        setError(`Failed to resubmit: ${err.message}`)
        setSubmitting(false)
        return
      }

      await supabase.from('approval_events').insert({
        project_id: project.id,
        actor_id: profile.id,
        actor_name: `${profile.rank} ${profile.full_name}`,
        action: 'Project resubmitted after rejection',
        from_status: 'rejected',
        to_status: 'submitted',
      })

    } else {
      // ── Update approved project: store as pending_update ─────────────────
      // Project stays 'approved' and visible in registry
      // OC/NC sees it in their approvals queue via pending_update_status = 'submitted'
      const { error: err } = await supabase.from('projects').update({
        pending_update: payload,
        pending_update_status: 'submitted',
      }).eq('id', project.id)

      if (err) {
        console.error('Update submit error:', err)
        setError(`Failed to submit update: ${err.message}`)
        setSubmitting(false)
        return
      }

      await supabase.from('approval_events').insert({
        project_id: project.id,
        actor_id: profile.id,
        actor_name: `${profile.rank} ${profile.full_name}`,
        action: 'Update submitted for approval — live version unchanged until CO approves',
        from_status: 'approved',
        to_status: 'approved',
      })
    }

    router.push('/dashboard')
  }

  if (!project || !profile) return (
    <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>
  )

  const isRejected = project.status === 'rejected'
  const hasPendingUpdate = !isRejected &&
    project.pending_update_status != null &&
    Object.keys(project.pending_update || {}).length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isRejected ? 'Resubmit project' : 'Update project'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isRejected
            ? 'Review the feedback, make changes, and resubmit for OC/NC review.'
            : 'The current published version stays live until CO approves the update.'}
        </p>
      </div>

      {/* Rejection reason */}
      {isRejected && rejectionRemark && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-4 mb-5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">
                Rejected by {rejectionRemark.actor_name} ·{' '}
                {new Date(rejectionRemark.created_at).toLocaleDateString('en-SG', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
              {rejectionRemark.remarks
                ? <p className="text-sm text-red-700">"{rejectionRemark.remarks}"</p>
                : <p className="text-sm text-red-500 italic">No reason provided</p>}
            </div>
          </div>
        </div>
      )}

      {/* Already has a pending update in progress */}
      {hasPendingUpdate && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> An update is already under review
            (status: <span className="font-medium capitalize">{project.pending_update_status?.replace(/_/g, ' ')}</span>).
            Submitting now will replace that pending update with this new version.
          </p>
        </div>
      )}

      {/* Update stays live notice */}
      {!isRejected && !hasPendingUpdate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm text-blue-800">
            Your project will <strong>remain published</strong> while this update goes through
            OC/NC → CO approval. Votes and remarks are preserved.
          </p>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-sm text-gray-700">
        Submitting as: <span className="font-medium">{profile.rank} {profile.full_name}</span>
        {' '}· {profile.company}
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">

        <div>
          <label className="label">Project title *</label>
          <input className={`input ${titleError ? 'border-red-400' : ''}`} required
            value={form.title} onChange={e => set('title', e.target.value)} />
          {titleError && <p className="text-xs text-red-600 mt-1">{titleError}</p>}
        </div>

        <div>
          <label className="label">Short description * <span className="text-gray-400 font-normal">(shown on cards)</span></label>
          <input className="input" required maxLength={200}
            value={form.short_description} onChange={e => set('short_description', e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">{form.short_description.length}/200</p>
        </div>

        <div>
          <label className="label">Full description *</label>
          <textarea className="input min-h-[160px]" required
            value={form.full_description} onChange={e => set('full_description', e.target.value)} />
        </div>

        <div>
          <label className="label">Project scale *</label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_SCALES.map(scale => (
              <button key={scale} type="button"
                onClick={() => setForm(f => ({ ...f, project_scale: scale }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.project_scale === scale
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}>
                {scale}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">OC/NC details</p>
          <div>
            <label className="label">OC/NC email *</label>
            <input className={`input ${ocEmailError ? 'border-red-400' : ''}`}
              type="email" required value={form.oc_email}
              onChange={e => set('oc_email', e.target.value)} />
            {ocEmailError && <p className="text-xs text-red-600 mt-1">{ocEmailError}</p>}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Links</p>
          <div className="space-y-3">
            <div>
              <label className="label">Demo video URL * <span className="text-gray-400 font-normal">(YouTube)</span></label>
              <input className="input" type="url" required value={form.demo_video_url}
                onChange={e => set('demo_video_url', e.target.value)} />
            </div>
            <div>
              <label className="label">Project URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="url" value={form.project_url}
                onChange={e => set('project_url', e.target.value)} />
            </div>
            <div>
              <label className="label">GitHub URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="url" value={form.github_url}
                onChange={e => set('github_url', e.target.value)} />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary text-sm px-6 py-2.5">
            {submitting
              ? 'Submitting...'
              : isRejected ? 'Resubmit for approval' : 'Submit update for approval'}
          </button>
          <button type="button" onClick={() => router.push('/dashboard')}
            className="btn-secondary text-sm px-4 py-2.5">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}