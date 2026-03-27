import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugSettings() {
    const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    console.log('--- App Settings ---')
    console.log(JSON.stringify(settings, null, 2))

    const { data: instances } = await supabase.from('instances').select('*').limit(5)
    console.log('\n--- Instances (first 5) ---')
    console.log(JSON.stringify(instances, null, 2))
}

debugSettings()
