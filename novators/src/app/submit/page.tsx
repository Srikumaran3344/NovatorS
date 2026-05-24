// PAGE 4 - src/app/submit/page.tsx - Submit New Project
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, PROJECT_SCALES, ProjectScale } from '@/lib/types'

export default function SubmitPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({
    title: '',
    short_description: '',
    full_description: '',
    oc_email: '',
    demo_video_url: '',
    project_url: '',
    github_url: '',
    project_scale: 'Unit' as ProjectScale,
  })
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [ocEmailError, setOcEmailError] = useState('')
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
    if (k === 'oc_email') setOcEmailError('')
  }

  const checkTitleUnique = async (title: string): Promise<boolean> => {
    const { data } = await supabase
      .from('projects').select('id').ilike('title', title.trim())
    return !data || data.length === 0
  }

  // Validate that the typed OC email is a registered OC/NC approver
  const validateOcEmail = async (email: string): Promise<{ valid: boolean; name?: string }> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, rank, role, approver_type')
      .eq('email', email.trim().toLowerCase())
      .eq('role', 'approver')
      .eq('approver_type', 'OC/NC')
      .maybeSingle()
    if (!data) return { valid: false }
    return { valid: true, name: `${data.rank} ${data.full_name}` }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setError('')
    setSubmitting(true)

    // Check title uniqueness
    const titleOk = await checkTitleUnique(form.title)
    if (!titleOk) {
      setTitleError('A project with this title already exists.')
      setSubmitting(false)
      return
    }

    // Validate OC/NC email
    const ocCheck = await validateOcEmail(form.oc_email)
    if (!ocCheck.valid) {
      setOcEmailError('This email is not registered as an OC/NC. Please check the email and try again.')
      setSubmitting(false)
      return
    }

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        title: form.title.trim(),
        short_description: form.short_description,
        full_description: form.full_description,
        oc_email: form.oc_email.trim().toLowerCase(),
        oc_name: ocCheck.name || '',
        demo_video_url: form.demo_video_url || null,
        project_url: form.project_url || null,
        github_url: form.github_url || null,
        project_scale: form.project_scale,
        submitter_id: profile.id,
        status: 'submitted',
      })
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
        <p className="text-sm text-gray-500 mt-1">
          Ensure you have verbally discussed this with your PC before submitting.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-sm text-gray-700">
        Submitting as: <span className="font-medium">{profile.rank} {profile.full_name}</span>
        {' '}· {profile.company} · {profile.vocation}
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">

        {/* Project title */}
        <div>
          <label className="label">Project title *</label>
          <input className={`input ${titleError ? 'border-red-400' : ''}`} required
            value={form.title} onChange={e => set('title', e.target.value)} />
          {titleError && <p className="text-xs text-red-600 mt-1">{titleError}</p>}
        </div>

        {/* Short description */}
        <div>
          <label className="label">
            Short description *{' '}
            <span className="text-gray-400 font-normal">(shown on registry cards)</span>
          </label>
          <input className="input" required maxLength={200}
            value={form.short_description} onChange={e => set('short_description', e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">{form.short_description.length}/200</p>
        </div>

        {/* Full description */}
        <div>
          <label className="label">Full description *</label>
          <textarea className="input min-h-[160px]" required
            value={form.full_description} onChange={e => set('full_description', e.target.value)} />
        </div>

        {/* Project scale */}
        <div>
          <label className="label">
            Project scale *{' '}
            <span className="text-gray-400 font-normal">(can be adjusted by OC/NC or CO during approval)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_SCALES.map(scale => (
              <button
                key={scale}
                type="button"
                onClick={() => setForm(f => ({ ...f, project_scale: scale }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.project_scale === scale
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {scale}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            SAF = army-wide · Formation = brigade/division · Unit = battalion · Coy = company level
          </p>
        </div>

        {/* OC/NC email */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">OC/NC details</p>
          <div>
            <label className="label">OC/NC email *</label>
            <input className={`input ${ocEmailError ? 'border-red-400' : ''}`}
              type="email" required
              placeholder="Enter your OC/NC's registered email"
              value={form.oc_email} onChange={e => set('oc_email', e.target.value)} />
            {ocEmailError
              ? <p className="text-xs text-red-600 mt-1">{ocEmailError}</p>
              : <p className="text-xs text-gray-400 mt-1">
                  Must be a registered OC/NC in the system
                </p>
            }
          </div>
        </div>

        {/* Links */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Links</p>
          <div className="space-y-3">
            <div>
              <label className="label">
                Demo video URL *{' '}
                <span className="text-gray-400 font-normal">(YouTube link)</span>
              </label>
              <input className="input" type="url"
                placeholder="https://youtube.com/watch?v=..." required
                value={form.demo_video_url} onChange={e => set('demo_video_url', e.target.value)} />
            </div>
            <div>
              <label className="label">
                Project / deployment URL{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input className="input" type="url" placeholder="https://..."
                value={form.project_url} onChange={e => set('project_url', e.target.value)} />
            </div>
            <div>
              <label className="label">
                GitHub URL{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input className="input" type="url" placeholder="https://github.com/..."
                value={form.github_url} onChange={e => set('github_url', e.target.value)} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary text-sm px-6 py-2.5">
            {submitting ? 'Submitting...' : 'Submit project'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="btn-secondary text-sm px-4 py-2.5">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}