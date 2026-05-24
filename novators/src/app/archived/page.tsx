// PAGE - src/app/archived/page.tsx - Archived Projects (read-only reference)
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Project, ApprovalEvent } from '@/lib/types'
import { Search, Archive, ChevronDown, ChevronUp, ExternalLink, GitBranch, FileText } from 'lucide-react'

const PAGE_SIZE = 15

export default function ArchivedPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [archiveRemarks, setArchiveRemarks] = useState<Record<string, ApprovalEvent | null>>({})
  const supabase = createClient()

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch])

  useEffect(() => { fetchProjects(page) }, [debouncedSearch, page])

  const fetchProjects = async (pageNumber: number) => {
    setLoading(true)
    const from = (pageNumber - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('projects')
      .select('*, profiles(full_name, rank, company)', { count: 'exact' })
      .eq('status', 'archived')
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (debouncedSearch.trim()) {
      query = query.or(
        `title.ilike.%${debouncedSearch}%,short_description.ilike.%${debouncedSearch}%`
      )
    }

    const { data, count } = await query
    setProjects(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  // Fetch the archive remark (the approval event that set status to 'archived')
  const loadArchiveRemark = async (projectId: string) => {
    if (archiveRemarks[projectId] !== undefined) return
    const { data } = await supabase
      .from('approval_events')
      .select('*')
      .eq('project_id', projectId)
      .eq('to_status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setArchiveRemarks(r => ({ ...r, [projectId]: data }))
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    await loadArchiveRemark(id)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-200">
          <Archive className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archived Projects</h1>
          <p className="text-sm text-gray-500">Reference only - projects archived by commanders</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 mb-6">
        These projects were reviewed and archived. They are kept here for reference to avoid duplicate submissions.
        Archived projects cannot be voted on or commented on.
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9 max-w-md" placeholder="Search archived projects..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No archived projects</p>
          <p className="text-sm">
            {debouncedSearch ? 'Try a different search term' : 'Nothing archived yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {projects.map(project => (
              <div key={project.id} className="card overflow-hidden">
                {/* Header */}
                <div
                  className="p-5 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(project.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="font-semibold text-gray-900 text-sm">{project.title}</h2>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        Archived
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {(project.profiles as any)?.rank} {(project.profiles as any)?.full_name}
                      {' '}· {(project.profiles as any)?.company}
                      {' '}· {new Date(project.updated_at).toLocaleDateString('en-SG', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{project.short_description}</p>
                  </div>
                  <div className="text-gray-400 shrink-0">
                    {expandedId === project.id
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === project.id && (
                  <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
                    {/* Archive reason from commander */}
                    {archiveRemarks[project.id] ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1">
                          Archived by {archiveRemarks[project.id]?.actor_name}
                        </p>
                        {archiveRemarks[project.id]?.remarks ? (
                          <p className="text-sm text-amber-800">
                            "{archiveRemarks[project.id]?.remarks}"
                          </p>
                        ) : (
                          <p className="text-sm text-amber-600 italic">No reason provided</p>
                        )}
                        <p className="text-xs text-amber-600 mt-1">
                          {new Date(archiveRemarks[project.id]!.created_at).toLocaleString('en-SG')}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-100 rounded-lg px-4 py-3">
                        <p className="text-xs text-gray-500 italic">No archive reason recorded</p>
                      </div>
                    )}

                    {/* Full description */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Description
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {project.full_description}
                      </p>
                    </div>

                    {/* Links - view only, no actions */}
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

                    </div>

                    {/* Read-only note */}
                    <p className="text-xs text-gray-400 border-t border-gray-200 pt-3">
                      This project is archived and read-only. No votes or remarks can be added.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1
                const ellipsisBefore = p === page - 2 && page > 3
                const ellipsisAfter = p === page + 2 && page < totalPages - 2
                if (!show && !ellipsisBefore && !ellipsisAfter) return null
                if (ellipsisBefore || ellipsisAfter) {
                  return <span key={p} className="px-1 text-gray-400 text-sm">…</span>
                }
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-9 h-9 text-sm border rounded-lg transition-colors ${
                      page === p
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                Next →
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-3">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} archived project{total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}