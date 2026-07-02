import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co',
    process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
);

async function check() {
    try {
        const { data: companies } = await supabase.from('companies').select('id, trade_name');
        if (!companies || companies.length === 0) {
            console.log("No companies found.");
            return;
        }

        const companyIds = companies.map(c => c.id);
        console.log("Found company IDs:", companyIds);

        const { data, error } = await supabase
            .from('fiscal_invoices')
            .select('*')
            .in('company_id', companyIds)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error fetching invoices:', error);
            return;
        }

        console.log(`Fetched ${data.length} invoices:`);
        data.forEach(inv => {
            console.log(`ID: ${inv.id}, Number: ${inv.invoice_number}, External ID: ${inv.external_id}, Created: ${inv.created_at}`);
            console.log('Quote ID:', inv.quote_id);
            console.log('Payload keys:', inv.payload ? Object.keys(inv.payload) : 'null');
            if (inv.payload) {
                console.log('Payload keys in payload:', Object.keys(inv.payload));
                if (inv.payload.retorno) {
                    console.log('Payload.retorno keys:', Object.keys(inv.payload.retorno));
                    if (inv.payload.retorno.data) {
                        console.log('Payload.retorno.data keys:', Object.keys(inv.payload.retorno.data));
                        console.log('  tomador:', JSON.stringify(inv.payload.retorno.data.tomador));
                        console.log('  destinatario:', JSON.stringify(inv.payload.retorno.data.destinatario));
                    } else {
                        console.log('  tomador:', JSON.stringify(inv.payload.retorno.tomador));
                        console.log('  destinatario:', JSON.stringify(inv.payload.retorno.destinatario));
                    }
                } else {
                    console.log('  tomador:', JSON.stringify(inv.payload.tomador));
                    console.log('  destinatario:', JSON.stringify(inv.payload.destinatario));
                }
            }
            console.log('-------------------------------------------');
        });
    } catch (e) {
        console.error('Runtime error:', e);
    }
}

check();
