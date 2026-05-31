/// <reference lib="deno.ns" />
// supabase/functions/notify/index.ts - Email notification Edge Function
// Triggered by a Supabase Database Webhook on approval_events INSERT

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000'
const FROM_ADDRESS = 'onboarding@resend.dev' // change to your domain in production

interface ApprovalEvent {
  project_id: string
  actor_id: string
  actor_name: string
  action: string
  remarks: string | null
  to_status: string
  from_status: string | null
}

// Fix 1: Replace Record<string, any> with a proper typed interface
interface PendingUpdate {
  [key: string]: string | number | boolean | null | PendingUpdate | PendingUpdate[]
}

interface ProjectProfile {
  full_name: string
  rank: string
  email: string
}

interface Project {
  id: string
  title: string
  oc_email: string
  oc_name: string
  pending_update: PendingUpdate | null
  pending_update_status: string | null
  profiles: ProjectProfile
}

// Fix 2: No longer import serve() - Supabase Edge Functions on Deno 2.x
// use a default export handler instead of serve()
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      }
    })
  }

  try {
    const payload = await req.json()
    const event: ApprovalEvent = payload.record

    if (!event?.project_id) {
      return new Response('Missing event data', { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const res = await fetch(
      `${supabaseUrl}/rest/v1/projects?id=eq.${event.project_id}&select=id,title,oc_email,oc_name,pending_update,pending_update_status,profiles(full_name,rank,email)`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )

    const projects: Project[] = await res.json()
    const project = projects[0]
    if (!project) return new Response('Project not found', { status: 404 })

    const submitterName = `${project.profiles.rank} ${project.profiles.full_name}`
    const projectUrl = `${APP_URL}/projects/${project.id}`
    const approvalsUrl = `${APP_URL}/approvals`

    let to: string | null = null
    let subject = ''
    let body = ''

    // ── Detect if this is a pending update action or a normal project action ──
    // Update actions keep to_status = 'approved' and action contains 'Update'
    const isUpdateAction = event.action?.toLowerCase().includes('update')

    if (isUpdateAction) {
      // ── Update flow emails ──────────────────────────────────────────────────

      if (event.action.includes('submitted for approval')) {
        // Submitter submitted an update → email the OC/NC named in the project
        to = project.oc_email
        subject = `[NovatorS] Update submitted for review: ${project.title}`
        body = `
          <p>Hi ${project.oc_name || 'OC/NC'},</p>
          <p><strong>${submitterName}</strong> has submitted an update to an approved project for your review:</p>
          <h3 style="margin:12px 0 4px">${project.title}</h3>
          <p>The published version remains live until the update is approved through the chain of command.</p>
          <p><a href="${approvalsUrl}" style="background:#4a5c2f;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Review update →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.action.includes('forwarded to CO')) {
        // OC/NC approved update → email submitter
        to = project.profiles.email
        subject = `[NovatorS] Your update is with the CO: ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Your update to <strong>${project.title}</strong> has been approved by ${event.actor_name} and forwarded to the CO for final approval.</p>
          <p>The current published version remains live until CO approves.</p>
          <p><a href="${projectUrl}" style="color:#4a5c2f">View project →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.action.includes('live version updated')) {
        // CO approved update → email submitter
        to = project.profiles.email
        subject = `[NovatorS] Your update is now live: ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Your update to <strong>${project.title}</strong> has been approved by ${event.actor_name}. The registry has been updated with your new version.</p>
          <p><a href="${projectUrl}" style="background:#4a5c2f;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">View updated project →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.action.includes('Update rejected')) {
        // Update rejected → email submitter
        to = project.profiles.email
        subject = `[NovatorS] Update not approved: ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Your proposed update to <strong>${project.title}</strong> was reviewed by ${event.actor_name} and was not approved. The published version remains unchanged.</p>
          ${event.remarks ? `<p><strong>Reason:</strong> ${event.remarks}</p>` : ''}
          <p><a href="${APP_URL}/submit/edit/${project.id}" style="color:#4a5c2f">Submit a revised update →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      }

    } else {
      // ── Normal project flow emails ──────────────────────────────────────────

      if (event.to_status === 'submitted') {
        // New submission or resubmission → email OC/NC
        to = project.oc_email
        subject = `[NovatorS] Project submitted for your review: ${project.title}`
        body = `
          <p>Hi ${project.oc_name || 'OC/NC'},</p>
          <p><strong>${submitterName}</strong> has submitted a project for your review:</p>
          <h3 style="margin:12px 0 4px">${project.title}</h3>
          <p><a href="${approvalsUrl}" style="background:#4a5c2f;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Review project →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.to_status === 'under_co_review') {
        // OC/NC approved → email submitter
        to = project.profiles.email
        subject = `[NovatorS] Your project is with the CO: ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Your project <strong>${project.title}</strong> has been approved by ${event.actor_name} and forwarded to the CO for final approval.</p>
          <p><a href="${projectUrl}" style="color:#4a5c2f">View your project →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.to_status === 'approved') {
        // CO final approval → email submitter
        to = project.profiles.email
        subject = `[NovatorS] Your project is now published! ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Congratulations! Your project <strong>${project.title}</strong> has been approved by ${event.actor_name} and is now live on the registry.</p>
          <p><a href="${projectUrl}" style="background:#4a5c2f;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">View published project →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.to_status === 'rejected') {
        // Rejected → email submitter with reason
        to = project.profiles.email
        subject = `[NovatorS] Update on your project: ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Your project <strong>${project.title}</strong> was reviewed by ${event.actor_name} and was not approved at this stage.</p>
          ${event.remarks ? `<p><strong>Reason:</strong> ${event.remarks}</p>` : ''}
          <p>You can update and resubmit from your dashboard.</p>
          <p><a href="${APP_URL}/dashboard" style="color:#4a5c2f">Go to dashboard →</a></p>
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      } else if (event.to_status === 'archived') {
        // Archived → email submitter
        to = project.profiles.email
        subject = `[NovatorS] Your project has been archived: ${project.title}`
        body = `
          <p>Hi ${submitterName},</p>
          <p>Your project <strong>${project.title}</strong> has been archived by ${event.actor_name}.</p>
          ${event.remarks ? `<p><strong>Reason:</strong> ${event.remarks}</p>` : ''}
          <p style="color:#888;font-size:12px;margin-top:24px">NovatorS</p>
        `
      }
    }

    if (!to) {
      return new Response(
        JSON.stringify({ message: 'No email needed for this event' }),
        { status: 200 }
      )
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;color:#111">${body}</div>`,
      }),
    })

    const result = await emailRes.json()
    if (!emailRes.ok) {
      console.error('Resend error:', result)
      return new Response(JSON.stringify({ error: result }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), { status: 200 })

  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}