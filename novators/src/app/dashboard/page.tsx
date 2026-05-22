// PAGE 5 — src/app/dashboard/page.tsx — My Projects Dashboard
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Project, ApprovalEvent, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [events, setEvents] = useState<Record<string, ApprovalEvent[]>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('submitter_id', user.id)
        .order('created_at', { ascending: false })
      setProjects(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!events[id]) {
      const { data } = await supabase
        .from('approval_events')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true })
      setEvents(e => ({ ...e, [id]: data || [] }))
    }
  }

  if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your submissions and approvals</p>
        </div>
        <Link href="/submit" className="btn-primary text-sm">+ Submit new</Link>
      </div>

      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-3">No projects submitted yet</p>
          <Link href="/submit" className="btn-primary text-sm inline-flex">Submit your first project</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <div key={project.id} className="card overflow-hidden">
              <div className="p-5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-semibold text-gray-900 text-sm">{project.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Submitted {new Date(project.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · OC: {project.oc_name}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {project.status === 'rejected' && (
                    <Link href={`/submit/edit/${project.id}`} className="text-xs text-blue-600 hover:underline font-medium">Resubmit</Link>
                  )}
                  <button onClick={() => toggleExpand(project.id)} className="text-gray-400 hover:text-gray-600 p-1">
                    {expandedId === project.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === project.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Approval timeline</p>
                  {(events[project.id] || []).length === 0 ? (
                    <p className="text-xs text-gray-400">No events yet</p>
                  ) : (
                    <div className="space-y-3">
                      {(events[project.id] || []).map((ev, i) => (
                        <div key={ev.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ev.to_status === 'approved' ? 'bg-green-100' : ev.to_status === 'rejected' ? 'bg-red-100' : 'bg-blue-50'}`}>
                              {ev.to_status === 'approved'
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                : ev.to_status === 'rejected'
                                ? <XCircle className="w-3.5 h-3.5 text-red-500" />
                                : <Clock className="w-3.5 h-3.5 text-blue-400" />}
                            </div>
                            {i < (events[project.id] || []).length - 1 && (
                              <div className="w-px flex-1 bg-gray-200 my-1" />
                            )}
                          </div>
                          <div className="pb-2">
                            <p className="text-xs font-medium text-gray-800">{ev.action}</p>
                            <p className="text-xs text-gray-500">{ev.actor_name}</p>
                            {ev.remarks && (
                              <p className="text-xs text-gray-600 mt-1 bg-white border border-gray-200 rounded px-2 py-1">"{ev.remarks}"</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(ev.created_at).toLocaleString('en-SG')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}