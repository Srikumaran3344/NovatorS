// PAGE 4 - src/app/submit/page.tsx - Submit New Project
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { Upload, X } from 'lucide-react'

export default function SubmitPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({
    title: '', short_description: '', full_description: '',
    oc_name: '', oc_email: '', demo_video_url: '', project_url: '', github_url: '',
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    getProfile()
  }, [])

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'title') setTitleError('')
  }

  const checkTitleUnique = async (title: string): Promise<boolean> => {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .ilike('title', title.trim())
    return !data || data.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setError('')
    setSubmitting(true)

    // Check title uniqueness
    const titleOk = await checkTitleUnique(form.title)
    if (!titleOk) {
      setTitleError('A project with this title already exists. Please use a different title.')
      setSubmitting(false)
      return
    }

    let pdf_url = null
    let pdf_name = null

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

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({ ...form, title: form.title.trim(), submitter_id: profile.id, pdf_url, pdf_name, status: 'submitted' })
      .select().single()

    if (insertError) { setError(insertError.message); setSubmitting(false); return }

    await supabase.from('approval_events').insert({
      project_id: project.id,
      actor_id: profile.id,
      actor_name: `${profile.rank} ${profile.full_name}`,
      action: 'Project submitted',
      from_status: null,
      to_status: 'submitted',
    })

    router.push('/dashboard')
  }

  if (!profile) return null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Submit a project</h1>
        <p className="text-sm text-gray-500 mt-1">Ensure you have verbally discussed this with your PC before submitting.</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-sm text-gray-700">
        Submitting as: <span className="font-medium">{profile.rank} {profile.full_name}</span> · {profile.company} · {profile.vocation}
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
          <p className="text-xs text-gray-400 mt-1">{form.short_description.length}/200 characters</p>
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
              <label className="label">Demo video URL * <span className="text-gray-400 font-normal">(YouTube link)</span></label>
              <input className="input" type="url" placeholder="https://youtube.com/watch?v=..." required
                value={form.demo_video_url} onChange={e => set('demo_video_url', e.target.value)} />
            </div>
            <div>
              <label className="label">Project / deployment URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="url" placeholder="https://..."
                value={form.project_url} onChange={e => set('project_url', e.target.value)} />
            </div>
            <div>
              <label className="label">GitHub URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="url" placeholder="https://github.com/..."
                value={form.github_url} onChange={e => set('github_url', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className="label">Supporting document <span className="text-gray-400 font-normal">(PDF, max 10MB - optional)</span></label>
          {pdfFile ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              <span className="flex-1 truncate">{pdfFile.name}</span>
              <button type="button" onClick={() => setPdfFile(null)}>
                <X className="w-4 h-4 text-green-600 hover:text-green-800" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-5 cursor-pointer hover:border-gray-300 transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Click to upload PDF</span>
              <input type="file" accept=".pdf" className="hidden" onChange={e => {
                const f = e.target.files?.[0]
                if (f && f.size > 10 * 1024 * 1024) { setError('PDF must be under 10MB'); return }
                setPdfFile(f || null); setError('')
              }} />
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary text-sm px-6 py-2.5">
            {submitting ? 'Submitting...' : 'Submit project'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary text-sm px-4 py-2.5">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}