// PAGE 7 — src/app/projects/[id]/page.tsx — Project Detail
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, ProjectRemark, Profile, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { ExternalLink, GitBranch, FileText, ThumbsUp, Send, Play } from 'lucide-react'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [remarks, setRemarks] = useState<ProjectRemark[]>([])
  const [newRemark, setNewRemark] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        const { data: v } = await supabase.from('project_votes')
          .select('id').eq('project_id', id).eq('user_id', user.id).maybeSingle()
        setVoted(!!v)
      }

      const { data: proj } = await supabase
        .from('projects')
        .select('*, profiles(full_name, rank, company)')
        .eq('id', id)
        .single()
      setProject(proj)

      const { data: rem } = await supabase
        .from('project_remarks')
        .select('*, profiles(full_name, rank)')
        .eq('project_id', id)
        .order('created_at', { ascending: true })
      setRemarks(rem || [])
      setLoading(false)
    }
    load()
  }, [id])

  const handleVote = async () => {
    if (!profile || !project) return
    if (voted) {
      await supabase.from('project_votes').delete().eq('project_id', project.id).eq('user_id', profile.id)
      await supabase.from('projects').update({ votes: project.votes - 1 }).eq('id', project.id)
      setProject(p => p ? { ...p, votes: p.votes - 1 } : p)
      setVoted(false)
    } else {
      await supabase.from('project_votes').insert({ project_id: project.id, user_id: profile.id })
      await supabase.from('projects').update({ votes: project.votes + 1 }).eq('id', project.id)
      setProject(p => p ? { ...p, votes: p.votes + 1 } : p)
      setVoted(true)
    }
  }

  const submitRemark = async () => {
    if (!profile || !project || !newRemark.trim()) return
    const { data } = await supabase.from('project_remarks').insert({
      project_id: project.id,
      author_id: profile.id,
      content: newRemark.trim(),
    }).select('*, profiles(full_name, rank)').single()
    if (data) { setRemarks(r => [...r, data]); setNewRemark('') }
  }

  const getYoutubeEmbedUrl = (url: string) => {
    try {
      const u = new URL(url)
      const v = u.searchParams.get('v') || u.pathname.split('/').pop()
      return v ? `https://www.youtube.com/embed/${v}` : null
    } catch { return null }
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>
  if (!project) return <div className="text-sm text-gray-500 py-10 text-center">Project not found</div>

  const embedUrl = project.demo_video_url ? getYoutubeEmbedUrl(project.demo_video_url) : null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[project.status]}`}>
            {STATUS_LABELS[project.status]}
          </span>
        </div>
        {project.profiles && (
          <p className="text-sm text-gray-500">
            By {(project.profiles as any).rank} {(project.profiles as any).full_name} · {(project.profiles as any).company}
          </p>
        )}
        {project.approved_by && (
          <p className="text-xs text-green-700 mt-1">Approved by {project.approved_by}</p>
        )}
      </div>

      {embedUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-gray-200" style={{ aspectRatio: '16/9' }}>
          <iframe src={embedUrl} className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen />
        </div>
      )}

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-800 mb-2 text-sm">About this project</h2>
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{project.full_description}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-6">
        {project.demo_video_url && !embedUrl && (
          <a href={project.demo_video_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
            <Play className="w-3.5 h-3.5" /> Demo video
          </a>
        )}
        {project.project_url && (
          <a href={project.project_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Live project
          </a>
        )}
        {project.github_url && (
          <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
            <GitBranch className="w-3.5 h-3.5" /> GitHub
          </a>
        )}
        {project.pdf_url && (
          <a href={project.pdf_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
            <FileText className="w-3.5 h-3.5" /> {project.pdf_name || 'Download PDF'}
          </a>
        )}
        <button onClick={handleVote} disabled={!profile} title={!profile ? 'Sign in to vote' : ''}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border font-medium transition-colors ${
            voted ? 'bg-green-50 border-green-300 text-green-700'
            : profile ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
          }`}>
          <ThumbsUp className="w-3.5 h-3.5" /> {project.votes} {voted ? 'voted' : 'upvote'}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-4 text-sm">Remarks ({remarks.length})</h2>
        {remarks.length === 0 && <p className="text-sm text-gray-400 mb-4">No remarks yet. Be the first to comment.</p>}
        <div className="space-y-3 mb-4">
          {remarks.map(r => (
            <div key={r.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-xs font-medium text-gray-700 mb-1">
                {(r.profiles as any)?.rank} {(r.profiles as any)?.full_name}
                <span className="text-gray-400 font-normal ml-1.5">· {new Date(r.created_at).toLocaleDateString('en-SG')}</span>
              </p>
              <p className="text-sm text-gray-600">{r.content}</p>
            </div>
          ))}
        </div>
        {profile ? (
          <div className="flex gap-2">
            <input className="input text-sm flex-1" placeholder="Add a remark..."
              value={newRemark} onChange={e => setNewRemark(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitRemark() } }} />
            <button onClick={submitRemark} disabled={!newRemark.trim()} className="btn-primary text-sm px-3 py-2">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            <a href="/auth/login" className="font-medium underline" style={{ color: 'var(--olive)' }}>Sign in</a> to leave a remark
          </p>
        )}
      </div>
    </div>
  )
}