import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkDetails() {
    const { data: trans, error: tErr } = await supabase
        .from('transactions')
        .select(`
            id, 
            amount, 
            status, 
            type, 
            created_at, 
            description,
            companies ( trade_name )
        `)
        .eq('type', 'income')
        .gte('created_at', '2026-02-01')
        .lte('created_at', '2026-02-28T23:59:59');

    if (tErr) {
        console.error('Error:', tErr);
        return;
    }

    console.log(`Found ${trans?.length} income transactions in Feb 2026:`);
    console.table(trans?.map(t => ({
        id: t.id,
        amount: t.amount,
        status: t.status,
        date: t.created_at,
        company: (t.companies as any)?.trade_name,
        desc: t.description
    })));
}

checkDetails();
