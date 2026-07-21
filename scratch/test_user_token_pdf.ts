import axios from 'axios'

async function test() {
    const url = 'https://lucrocertovercel-11exnl53f-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf';
    const params = {
        companyId: '84d1586e-5d0c-456f-aa12-aefc5a9364a7',
        token: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjY2MjZjOTBhLTNmNGMtNGQwOS1hMjlkLWIxMGUyMDVhZjc3YSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL29uY2RkYmFycnR4YWxzbXpyYXZrLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5ZWM3N2ZmYS02NzI2LTRiYzctYjFmMS01MjUwNDkxNGMxZWYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgzMTc1NDM0LCJpYXQiOjE3ODMxNzE4MzQsImVtYWlsIjoibGFiZmFjaWxzdXBvcnRlQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJsYWJmYWNpbHN1cG9ydGVAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IkNMRVRPTiIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOWVjNzdmZmEtNjcyNi00YmM3LWIxZjEtNTI1MDQ5MTRjMWVmIiwidXNlcl90eXBlIjoiUEYifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4MzE3MTgzNH1dLCJzZXNzaW9uX2lkIjoiMDMwNWNhMjItMTkzZS00ZWYwLWJmNGEtMGIyZDQ0NWIxZTkxIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.Bv2IvMmXkPwo4OYNXdezcUi_Y5rZn537jSXJlmIvZvf1grSLFLPSY9T2We_ASNTWuBhbJhKwZ5j-iGF41XplAA'
    };

    try {
        console.log('Fetching PDF with user token...');
        const response = await axios.get(url, { params });
        console.log('Success! Status:', response.status);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error details:', err.response?.data ? Buffer.from(err.response.data).toString() : err.message);
    }
}

test();
