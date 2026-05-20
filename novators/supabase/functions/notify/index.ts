// supabase/functions/notify/index.ts — Email notification Edge Function
// Triggered by a Supabase Database Webhook on approval_events INSERT

// Use a recent std version to ensure the module and types are available
import { serve } from 'std/http'

// ─── THINGS TO CHANGE ────────────────────────────────────────────────────────
// 1. After deploying to Vercel, set APP_URL in Supabase Edge Function secrets
//    Supabase → Settings → Edge Functions → Secrets → APP_URL = https://yourapp.vercel.app
//    For local testing leave it as localhost (emails will still send, links just point locally)
//
// 2. Change the FROM address:
//    - For testing now:   'onboarding@resend.dev'  (Resend's free test address, no domain needed)
//    - For production:    'no-reply@yourdomain.com' (after adding domain in Resend dashboard)
//
// 3. RESEND_API_KEY and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set as
//    Supabase secrets — you do NOT hardcode them here. They are already available
//    as environment variables inside the deployed function.
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000'

// ─── CHANGE THIS for testing vs production ───────────────────────────────────
// Testing:    'onboarding@resend.dev'
// Production: 'SAF Registry <no-reply@yourdomain.com>'
const FROM_ADDRESS = 'onboarding@resend.dev'
// ─────────────────────────────────────────────────────────────────────────────

interface ApprovalEvent {
  project_id: string
  actor_name: string
  action: string
  remarks: string | null
  to_status: string
}

interface Project {
  id: string
  title: string
  oc_email: string
  oc_name: string
  profiles: { full_name: string; rank: string; email: string }
}

serve(async (req: Request) => {
  // Handle CORS preflight
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

    // Supabase DB webhook sends: { type, table, record, old_record }
    const event: ApprovalEvent = payload.record

    if (!event?.project_id || !event?.to_status) {
      return new Response('Missing event data', { status: 400 })
    }

    // Fetch project + submitter details using service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const res = await fetch(
      `${supabaseUrl}/rest/v1/projects?id=eq.${event.project_id}&select=id,title,oc_email,oc_name,profiles(full_name,rank,email)`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )

    const projects: Project[] = await res.json()
    const project = projects[0]

    if (!project) {
      return new Response('Project not found', { status: 404 })
    }

    const submitterName = `${project.profiles.rank} ${project.profiles.full_name}`
    const projectUrl = `${APP_URL}/projects/${project.id}`
    const approvalsUrl = `${APP_URL}/approvals`

    // ── Decide who to email based on status ──────────────────────────────────
    let to: string | null = null
    let subject = ''
    let body = ''

    if (event.to_status === 'submitted') {
      // New submission → email OC to review
      to = project.oc_email
      subject = `[SAF Registry] New project submitted for your review: ${project.title}`
      body = `
        <p>Hi ${project.oc_name},</p>
        <p><strong>${submitterName}</strong> has submitted a project for your review:</p>
        <h3 style="margin:12px 0 4px">${project.title}</h3>
        <p><a href="${approvalsUrl}" style="background:#4a5c2f;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Review project →</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px">SAF Project Registry</p>
      `
    } else if (event.to_status === 'under_co_review') {
      // OC approved → email submitter that it's now with CO
      // NOTE: to also email CO here, you would need CO's email stored on the project
      // For now we email the submitter to keep them informed
      to = project.profiles.email
      subject = `[SAF Registry] Your project is with the CO: ${project.title}`
      body = `
        <p>Hi ${submitterName},</p>
        <p>Your project <strong>${project.title}</strong> has been approved by ${event.actor_name} and forwarded to the CO for final approval.</p>
        <p><a href="${projectUrl}" style="color:#4a5c2f">View your project →</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px">SAF Project Registry</p>
      `
    } else if (event.to_status === 'approved') {
      // CO approved → email submitter
      to = project.profiles.email
      subject = `[SAF Registry] Your project is now published! ${project.title}`
      body = `
        <p>Hi ${submitterName},</p>
        <p>Congratulations! Your project <strong>${project.title}</strong> has been approved by ${event.actor_name} and is now live on the registry.</p>
        <p><a href="${projectUrl}" style="background:#4a5c2f;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">View published project →</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px">SAF Project Registry</p>
      `
    } else if (event.to_status === 'rejected') {
      // Rejected → email submitter with reason
      to = project.profiles.email
      subject = `[SAF Registry] Update on your project: ${project.title}`
      body = `
        <p>Hi ${submitterName},</p>
        <p>Your project <strong>${project.title}</strong> was reviewed by ${event.actor_name} and was not approved at this stage.</p>
        ${event.remarks ? `<p><strong>Reason:</strong> ${event.remarks}</p>` : ''}
        <p>You can review the feedback, make changes, and resubmit from your dashboard.</p>
        <p><a href="${APP_URL}/dashboard" style="color:#4a5c2f">Go to your dashboard →</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px">SAF Project Registry</p>
      `
    } else if (event.to_status === 'archived') {
      // Archived → email submitter
      to = project.profiles.email
      subject = `[SAF Registry] Your project has been archived: ${project.title}`
      body = `
        <p>Hi ${submitterName},</p>
        <p>Your project <strong>${project.title}</strong> has been archived by ${event.actor_name}.</p>
        ${event.remarks ? `<p><strong>Reason:</strong> ${event.remarks}</p>` : ''}
        <p style="color:#888;font-size:12px;margin-top:24px">SAF Project Registry</p>
      `
    }

    // No email needed for this status (e.g. under_oc_review open event)
    if (!to) {
      return new Response(JSON.stringify({ message: 'No email needed for this status' }), { status: 200 })
    }

    // ── Send via Resend ───────────────────────────────────────────────────────
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
})