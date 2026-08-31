const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://oncddbarrtxalsmzravk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0');

async function checkPolicies() {
  const { data, error } = await supabase.rpc('execute_sql_internal', { sql: "SELECT policyname, definition FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';" });
  if (error) {
    // If execute_sql_internal RPC doesn't exist, try querying a view or similar
    console.error('RPC Error:', error);
    // Let's do a direct query on a view or try to query the policies another way
  } else {
    console.log('Policies:', data);
  }
}

checkPolicies();
