import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

const supabase = createClient(supabaseUrl, supabaseKey);

const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';

const { data: config, error } = await supabase
    .from('fiscal_configs')
    .select('*')
    .eq('company_id', companyId);

if (error) {
    console.error('Error fetching fiscal configs:', error);
} else {
    console.log('Fiscal Configs:', JSON.stringify(config, null, 2));
}
