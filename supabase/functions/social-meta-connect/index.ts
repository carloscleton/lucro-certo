import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const APP_ID = Deno.env.get('VITE_META_APP_ID') || '897720413143999'
const APP_SECRET = Deno.env.get('META_APP_SECRET') || '223203568dc19fecaff9be861f5ba57f'
const API_VERSION = 'v19.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Header
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { short_lived_token, company_id } = await req.json()

    if (!short_lived_token || !company_id) {
      return new Response(JSON.stringify({ error: 'Faltam parametros' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Obter token de longa duraçao
    const tokenRes = await fetch(`https://graph.facebook.com/${API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${short_lived_token}`)
    const tokenData = await tokenRes.json()

    if (tokenData.error) throw new Error(tokenData.error.message || 'Erro ao trocar token')
    const longLivedToken = tokenData.access_token

    // 2. Obter Páginas gerenciadas por este usuário
    const pagesRes = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?access_token=${longLivedToken}`)
    const pagesData = await pagesRes.json()

    if (pagesData.error) throw new Error(pagesData.error.message || 'Erro ao obter contas')
    if (!pagesData.data || pagesData.data.length === 0) throw new Error('Nenhuma Página do Facebook encontrada com este usuário. Retorno Face: ' + JSON.stringify(pagesData))

    let fbPageId = ''
    let fbPageName = ''
    let fbAccessToken = ''
    let igAccountId = ''
    let igUsername = ''

    // 3. Checar qual página possui o Instagram vinculado
    for (const page of pagesData.data) {
      const pageId = page.id
      const pageToken = page.access_token

      const igRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}?fields=instagram_business_account,name&access_token=${pageToken}`)
      const igData = await igRes.json()

      if (igData.instagram_business_account && igData.instagram_business_account.id) {
        fbPageId = pageId
        fbPageName = igData.name
        fbAccessToken = pageToken
        igAccountId = igData.instagram_business_account.id

        // Tentar ver o nome do IG
        const usernameRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${igAccountId}?fields=username&access_token=${pageToken}`)
        const usernameData = await usernameRes.json()
        igUsername = usernameData.username || 'Desconhecido'

        break; // Encontrou o primeiro com insta, ta otimo pra MVP
      }
    }

    if (!igAccountId) {
      return new Response(JSON.stringify({ error: 'Nenhum Instagram Comercial vinculado encontrado nas páginas deste Facebook. Verifique as configurações da sua página no Facebook.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Salvar essas infos gigantes lá no banco "social_profiles"
    const { error: dbError } = await supabase
      .from('social_profiles')
      .update({
        fb_access_token: fbAccessToken,
        fb_page_id: fbPageId,
        fb_page_name: fbPageName,
        ig_account_id: igAccountId,
        ig_username: igUsername
      })
      .eq('company_id', company_id)

    if (dbError) throw dbError

    return new Response(JSON.stringify({
      success: true,
      page_name: fbPageName,
      ig_username: igUsername
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Erro no social-meta-connect:', error)
    return new Response(JSON.stringify({ error: error.message || 'Erro na conexão' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
