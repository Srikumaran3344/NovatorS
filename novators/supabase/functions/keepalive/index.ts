/// <reference lib="deno.ns" />

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  await fetch(`${supabaseUrl}/rest/v1/profiles?limit=1`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  })

  return new Response('ok', { status: 200 })
})