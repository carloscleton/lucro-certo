import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', '64d1016e-5d0c-4ddf-ae12-eefc5a9264a7');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Company:', JSON.stringify(data, null, 2));
}

check();
