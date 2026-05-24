// PAGE — src/app/submit/edit/[id]/page.tsx — Edit / Resubmit Project
// Handles two flows:
//   REJECTED: submitter sees rejection reason, edits, resubmits to OC/NC
//   APPROVED: submitter edits — project STAYS PUBLISHED while update goes through approval
//             once CO approves the update, the live version is replaced
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Project } from '@/lib/types'
import { Upload, X, AlertCircle } from 'lucide-react'

export default function EditSubmitPage() {
  const { id } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [form, setForm] = useState({
    title: '', short_description: '', full_description: '',
    oc_name: '', oc_email: '', demo_video_url: '', project_url: '', github_url: '',
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [keepExistingPdf, setKeepExistingPdf] = useState(true)
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
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

      // Pre-fill form — if there's a pending update in progress, use that as base
      // Otherwise use the live project data
      const base = proj.pending_update || proj
      setForm({
        title: base.title || proj.title,
        short_description: base.short_description || proj.short_description,
        full_description: base.full_description || proj.full_description,
        oc_name: base.oc_name || proj.oc_name,
        oc_email: base.oc_email || proj.oc_email,
        demo_video_url: base.demo_video_url || proj.demo_video_url || '',
        project_url: base.project_url || proj.project_url || '',
        github_url: base.github_url || proj.github_url || '',
      })

      // Load rejection remark if rejected
      if (proj.status === 'rejected') {
        const { data: ev } = await supabase
          .from('approval_events')
          .select('actor_name, remarks, created_at')
          .eq('project_id', proj.id)
          .eq('to_status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setRejectionRemark(ev)
      }
    }
    load()
  }, [id])

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'title') setTitleError('')
  }

  const checkTitleUnique = async (title: string): Promise<boolean> => {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .ilike('title', title.trim())
      .neq('id', project?.id)
    return !data || data.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !project) return
    setError('')
    setSubmitting(true)

    // Title uniqueness check
    const titleOk = await checkTitleUnique(form.title)
    if (!titleOk) {
      setTitleError('A project with this title already exists.')
      setSubmitting(false)
      return
    }

    let pdf_url = keepExistingPdf ? project.pdf_url : null
    let pdf_name = keepExistingPdf ? project.pdf_name : null

    if (pdfFile) {
      const ext = pdfFile.name.split('.').pop()
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('project-files').upload(path, pdfFile, { cacheControl: '3600', upsert: false })
      if (uploadError) { setError('PDF upload failed: ' + uploadError.message); setSubmitting(false); return }
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path)
      pdf_url = urlData.publicUrl
      pdf_name = pdfFile.name
    }

    const isRejected = project.status === 'rejected'

    if (isRejected) {
      // ── REJECTED flow: update project directly and resubmit ──────────────
      const { error: updateError } = await supabase.from('projects').update({
        ...form,
        title: form.title.trim(),
        pdf_url,
        pdf_name,
        status: 'submitted',
        pending_update: null,
        pending_update_status: null,
      }).eq('id', project.id)

      if (updateError) { setError(updateError.message); setSubmitting(false); return }

      await supabase.from('approval_events').insert({
        project_id: project.id,
        actor_id: profile.id,
        actor_name: `${profile.rank} ${profile.full_name}`,
        action: 'Project resubmitted after rejection',
        from_status: 'rejected',
        to_status: 'submitted',
      })

    } else {
      // ── APPROVED flow: store edits as pending_update, keep live version ──
      // Project stays 'approved' (visible in registry) but pending_update holds the new version
      const pendingData = {
        ...form,
        title: form.title.trim(),
        pdf_url,
        pdf_name,
      }

      const { error: updateError } = await supabase.from('projects').update({
        pending_update: pendingData,
        pending_update_status: 'submitted',
      }).eq('id', project.id)

      if (updateError) { setError(updateError.message); setSubmitting(false); return }

      await supabase.from('approval_events').insert({
        project_id: project.id,
        actor_id: profile.id,
        actor_name: `${profile.rank} ${profile.full_name}`,
        action: 'Update submitted for approval (project stays live until CO approves)',
        from_status: 'approved',
        to_status: 'approved', // status unchanged — only pending_update changes
      })
    }

    router.push('/dashboard')
  }

  if (!project || !profile) return (
    <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>
  )

  const isRejected = project.status === 'rejected'
  const hasPendingUpdate = !isRejected && project.pending_update_status

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isRejected ? 'Resubmit project' : 'Update project'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isRejected
            ? 'Review the feedback below, make your changes, and resubmit for OC/NC review.'
            : 'Update your project details. The current published version stays live until CO approves the update.'}
        </p>
      </div>

      {/* Rejection reason banner */}
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
              {rejectionRemark.remarks ? (
                <p className="text-sm text-red-700">"{rejectionRemark.remarks}"</p>
              ) : (
                <p className="text-sm text-red-500 italic">No reason was provided.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending update notice */}
      {hasPendingUpdate && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm text-amber-800">
            <strong>Update in progress:</strong> A previous update is currently under review
            (status: <span className="font-medium">{project.pending_update_status}</span>).
            Submitting now will replace that pending update.
          </p>
        </div>
      )}

      {/* Update stays live notice */}
      {!isRejected && !hasPendingUpdate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm text-blue-800">
            Your project will <strong>remain published</strong> while this update goes through OC/NC → CO approval.
            Votes and remarks are preserved throughout.
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
          <label className="label">Short description * <span className="text-gray-400 font-normal">(shown on registry cards)</span></label>
          <input className="input" required maxLength={200}
            value={form.short_description} onChange={e => set('short_description', e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">{form.short_description.length}/200</p>
        </div>

        <div>
          <label className="label">Full description *</label>
          <textarea className="input min-h-[160px]" required
            value={form.full_description} onChange={e => set('full_description', e.target.value)} />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">OC/NC details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">OC/NC name *</label>
              <input className="input" required value={form.oc_name} onChange={e => set('oc_name', e.target.value)} />
            </div>
            <div>
              <label className="label">OC/NC email *</label>
              <input className="input" type="email" required value={form.oc_email} onChange={e => set('oc_email', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Links</p>
          <div className="space-y-3">
            <div>
              <label className="label">Demo video URL * <span className="text-gray-400 font-normal">(YouTube)</span></label>
              <input className="input" type="url" required value={form.demo_video_url} onChange={e => set('demo_video_url', e.target.value)} />
            </div>
            <div>
              <label className="label">Project URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="url" value={form.project_url} onChange={e => set('project_url', e.target.value)} />
            </div>
            <div>
              <label className="label">GitHub URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="url" value={form.github_url} onChange={e => set('github_url', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className="label">Supporting document <span className="text-gray-400 font-normal">(PDF, max 10MB)</span></label>

          {project.pdf_name && keepExistingPdf && !pdfFile && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 mb-2">
              <span className="flex-1 truncate">Keeping: {project.pdf_name}</span>
              <button type="button" onClick={() => setKeepExistingPdf(false)}
                className="text-blue-500 hover:text-blue-700 text-xs underline shrink-0">
                Replace
              </button>
            </div>
          )}

          {(!keepExistingPdf || !project.pdf_name) && !pdfFile && (
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-5 cursor-pointer hover:border-gray-300 transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Click to upload PDF (optional)</span>
              <input type="file" accept=".pdf" className="hidden" onChange={e => {
                const f = e.target.files?.[0]
                if (f && f.size > 10 * 1024 * 1024) { setError('PDF must be under 10MB'); return }
                setPdfFile(f || null); setError('')
              }} />
            </label>
          )}

          {pdfFile && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              <span className="flex-1 truncate">{pdfFile.name}</span>
              <button type="button" onClick={() => setPdfFile(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary text-sm px-6 py-2.5">
            {submitting
              ? 'Submitting...'
              : isRejected
              ? 'Resubmit for approval'
              : 'Submit update for approval'}
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