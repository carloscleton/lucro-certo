
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastPost() {
    const { data, error } = await supabase
        .from('social_posts')
        .select('content, image_url, status')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching post:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('--- CONTENT START ---');
        console.log(data[0].content);
        console.log('--- CONTENT END ---');
        console.log('Image URL:', data[0].image_url);
        console.log('Status:', data[0].status);
    } else {
        console.log('No posts found.');
    }
}

checkLastPost();
