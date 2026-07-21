import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .ilike('name', '%alexandre%');
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('CONTACTS MATCHING ALEXANDRE:');
    console.log(JSON.stringify(contacts, null, 2));
}

test();
