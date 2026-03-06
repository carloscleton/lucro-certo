import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
// Try service role key if available from migrations or somewhere? No.
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    // Try to see if there's any company
    const { data: companies, error } = await supabase.from('companies').select('id, trade_name');
    console.log('Companies:', companies);
    if (error) console.error('Error:', error);
}

test();
