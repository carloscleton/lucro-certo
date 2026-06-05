import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log("Listing recent invoices...");
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error querying db:", error);
    } else {
        console.log(`Found ${invoices.length} invoices:`);
        invoices.forEach(i => {
            console.log(`=========================================`);
            console.log(`ID: ${i.id} | Number: ${i.invoice_number}`);
            console.log(`dps_number: ${i.dps_number} | dps_serie: ${i.dps_serie}`);
            console.log(`Root payload keys:`, Object.keys(i.payload || {}));
            console.log(`Payload retorno keys:`, Object.keys(i.payload?.retorno || {}));
            console.log(`dps:`, i.payload?.dps || i.payload?.retorno?.dps);
            console.log(`nacional.dps:`, i.payload?.nacional?.dps || i.payload?.retorno?.nacional?.dps);
            console.log(`DPS.infDPS:`, i.payload?.DPS?.infDPS || i.payload?.retorno?.DPS?.infDPS);
            console.log(`nDPS:`, i.payload?.nDPS || i.payload?.retorno?.nDPS);
            console.log(`serie:`, i.payload?.serie || i.payload?.retorno?.serie);
            console.log(`rps:`, i.payload?.rps || i.payload?.retorno?.rps);
            console.log(`PlugNotas raw response:`, JSON.stringify(i.payload?.retorno, null, 2));
        });
    }
}

main();
