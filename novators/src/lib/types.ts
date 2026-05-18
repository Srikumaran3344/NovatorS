export type UserRole = 'submitter' | 'approver' | 'admin'

export type ProjectStatus =
  | 'submitted'
  | 'under_oc_review'
  | 'under_co_review'
  | 'approved'
  | 'rejected'
  | 'archived'

export interface Profile {
  id: string
  email: string
  full_name: string
  rank: string
  company: string
  vocation: string
  role: UserRole
  created_at: string
}

export interface Project {
  id: string
  title: string
  short_description: string
  full_description: string
  submitter_id: string
  oc_name: string
  oc_email: string
  demo_video_url: string | null
  project_url: string | null
  github_url: string | null
  pdf_url: string | null
  pdf_name: string | null
  status: ProjectStatus
  approved_by: string | null
  votes: number
  created_at: string
  updated_at: string
  // joined
  profiles?: Profile
  user_voted?: boolean
}

export interface ApprovalEvent {
  id: string
  project_id: string
  actor_id: string | null
  actor_name: string
  action: string
  remarks: string | null
  from_status: ProjectStatus | null
  to_status: ProjectStatus | null
  created_at: string
}

export interface ProjectRemark {
  id: string
  project_id: string
  author_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  submitted: 'Submitted',
  under_oc_review: 'Under OC Review',
  under_co_review: 'Under CO Review',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  under_oc_review: 'bg-yellow-100 text-yellow-800',
  under_co_review: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-600',
}