// PAGE 1 — src/app/page.tsx — Public Registry (homepage)
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Project, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { Search, ThumbsUp, ExternalLink, GitBranch, FileText, ArrowUpDown } from 'lucide-react'

type SortMode = 'recent' | 'votes'

export default function RegistryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      await fetchProjects()
    }
    init()
  }, [sort])

  const fetchProjects = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*, profiles(full_name, rank, company)')
      .eq('status', 'approved')
      .order(sort === 'votes' ? 'votes' : 'created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  const handleVote = async (project: Project) => {
    if (!userId) return
    if (project.user_voted) {
      await supabase.from('project_votes').delete().eq('project_id', project.id).eq('user_id', userId)
      await supabase.from('projects').update({ votes: project.votes - 1 }).eq('id', project.id)
    } else {
      await supabase.from('project_votes').insert({ project_id: project.id, user_id: userId })
      await supabase.from('projects').update({ votes: project.votes + 1 }).eq('id', project.id)
    }
    fetchProjects()
  }

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.short_description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Project Registry</h1>
        <p className="text-gray-500 text-sm">Approved innovations from 1 SAF TPT BN</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSort('recent')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${sort === 'recent' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            <ArrowUpDown className="w-3.5 h-3.5" /> Recent
          </button>
          <button onClick={() => setSort('votes')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${sort === 'votes' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            <ThumbsUp className="w-3.5 h-3.5" /> Most voted
          </button>
        </div>
        {userId && (
          <Link href="/submit" className="btn-primary text-sm whitespace-nowrap">+ Submit project</Link>
        )}
      </div>

      {!userId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-6">
          Viewing as guest. <Link href="/auth/login" className="font-medium underline">Sign in</Link> to upvote, submit, or comment.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No projects found</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} userId={userId} onVote={handleVote} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, userId, onVote }: { project: Project; userId: string | null; onVote: (p: Project) => void }) {
  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projects/${project.id}`} className="font-semibold text-gray-900 hover:underline leading-snug text-sm">
          {project.title}
        </Link>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
      </div>

      <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{project.short_description}</p>

      {project.profiles && (
        <p className="text-xs text-gray-400">
          By {(project.profiles as any).rank} {(project.profiles as any).full_name} · {(project.profiles as any).company}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {project.demo_video_url && (
          <a href={project.demo_video_url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Demo
          </a>
        )}
        {project.github_url && (
          <a href={project.github_url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> GitHub
          </a>
        )}
        {project.pdf_url && (
          <a href={project.pdf_url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <FileText className="w-3 h-3" /> PDF
          </a>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <button onClick={() => onVote(project)} disabled={!userId} title={!userId ? 'Sign in to vote' : ''}
          className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors ${project.user_voted ? 'text-green-700 bg-green-50' : userId ? 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}>
          <ThumbsUp className="w-3.5 h-3.5" /> {project.votes}
        </button>
        <Link href={`/projects/${project.id}`} className="text-xs text-gray-500 hover:text-gray-800 font-medium">
          View details →
        </Link>
      </div>
    </div>
  )
}