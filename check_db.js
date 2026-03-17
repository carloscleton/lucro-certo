const { createClient } = require('@supabase/supabase-js');

async function check() {
    const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );

    const email = 'dannydanyelle123@gmail.com';

    console.log('--- User Info ---');
    const { data: userProfile } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    console.log('Profile:', userProfile);

    if (userProfile) {
        console.log('\n--- Memberships ---');
        const { data: memberships } = await supabase
            .from('company_members')
            .select('*, company:companies(*)')
            .eq('user_id', userProfile.id);
        console.log('Memberships:', JSON.stringify(memberships, null, 2));
    }
}

check();
