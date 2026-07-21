import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const url = process.env.EVOLUTION_GO_API_URL || 'https://evogo.idealzap.com.br';
const key = process.env.EVOLUTION_GO_API_KEY || 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

console.log('Testing with API URL:', url);
console.log('Testing with API KEY:', key ? 'FOUND' : 'MISSING');

async function run() {
    try {
        // 1. Get all instances
        console.log('\n--- GET /instance/all ---');
        const resAll = await axios.get(`${url}/instance/all`, {
            headers: { 'apikey': key }
        });
        console.log('Status:', resAll.status);
        const instances = resAll.data?.data || [];
        console.log('Instances found:', instances.length);
        console.log(JSON.stringify(instances, null, 2));

        if (instances.length > 0) {
            const first = instances[0];
            const uuid = first.id;
            const name = first.name;
            const token = first.token;
            console.log(`\nTesting with Instance: ${name} (UUID: ${uuid}, Token: ${token})`);

            // Try GET advanced settings using UUID and admin key
            try {
                console.log(`\n--- GET /instance/${uuid}/advanced-settings (with admin key) ---`);
                const res1 = await axios.get(`${url}/instance/${uuid}/advanced-settings`, {
                    headers: { 'apikey': key }
                });
                console.log('SUCCESS (UUID + admin key):', res1.status, res1.data);
            } catch (e) {
                console.log('FAILED (UUID + admin key):', e.response?.status, JSON.stringify(e.response?.data));
            }

            // Try GET advanced settings using Name and admin key
            try {
                console.log(`\n--- GET /instance/${name}/advanced-settings (with admin key) ---`);
                const res2 = await axios.get(`${url}/instance/${name}/advanced-settings`, {
                    headers: { 'apikey': key }
                });
                console.log('SUCCESS (Name + admin key):', res2.status, res2.data);
            } catch (e) {
                console.log('FAILED (Name + admin key):', e.response?.status, JSON.stringify(e.response?.data));
            }

            // Try GET advanced settings using UUID and instance token
            try {
                console.log(`\n--- GET /instance/${uuid}/advanced-settings (with instance token) ---`);
                const res3 = await axios.get(`${url}/instance/${uuid}/advanced-settings`, {
                    headers: { 'apikey': token }
                });
                console.log('SUCCESS (UUID + instance token):', res3.status, res3.data);
            } catch (e) {
                console.log('FAILED (UUID + instance token):', e.response?.status, JSON.stringify(e.response?.data));
            }

            // Try GET advanced settings using Name and instance token
            try {
                console.log(`\n--- GET /instance/${name}/advanced-settings (with instance token) ---`);
                const res4 = await axios.get(`${url}/instance/${name}/advanced-settings`, {
                    headers: { 'apikey': token }
                });
                console.log('SUCCESS (Name + instance token):', res4.status, res4.data);
            } catch (e) {
                console.log('FAILED (Name + instance token):', e.response?.status, JSON.stringify(e.response?.data));
            }
            
            // Try PUT advanced settings using UUID and instance token
            try {
                console.log(`\n--- PUT /instance/${uuid}/advanced-settings (with instance token) ---`);
                const resPut = await axios.put(`${url}/instance/${uuid}/advanced-settings`, {
                    alwaysOnline: true,
                    rejectCall: false
                }, {
                    headers: { 'apikey': token }
                });
                console.log('SUCCESS (PUT UUID + instance token):', resPut.status, resPut.data);
            } catch (e) {
                console.log('FAILED (PUT UUID + instance token):', e.response?.status, JSON.stringify(e.response?.data));
            }
            
            // Try PUT advanced settings using UUID and admin key
            try {
                console.log(`\n--- PUT /instance/${uuid}/advanced-settings (with admin key) ---`);
                const resPutAdmin = await axios.put(`${url}/instance/${uuid}/advanced-settings`, {
                    alwaysOnline: true,
                    rejectCall: false
                }, {
                    headers: { 'apikey': key }
                });
                console.log('SUCCESS (PUT UUID + admin key):', resPutAdmin.status, resPutAdmin.data);
            } catch (e) {
                console.log('FAILED (PUT UUID + admin key):', e.response?.status, JSON.stringify(e.response?.data));
            }
        }
    } catch (e) {
        console.error('Global error:', e.message);
        if (e.response) {
            console.error('Response data:', e.response.status, JSON.stringify(e.response.data));
        }
    }
}

run();
