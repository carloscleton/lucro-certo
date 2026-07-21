import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    // We can use a query with service role / anonymous key. 
    // Since anon key might return empty due to RLS, let's see if we can get anything or if we can use a query that selects columns.
    const { data, error } = await supabase.from('fiscal_invoices').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Columns:', data.length > 0 ? Object.keys(data[0]) : 'No rows found');
    }
}

test();
