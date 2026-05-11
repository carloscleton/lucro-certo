import axios from 'axios';

async function testHealth() {
    const API_BASE = "http://localhost:3001"; // Se estiver rodando local, senão use a URL de prod
    // Como queremos testar se o PROXY está funcionando, vamos tentar chamar o health check que criamos
    
    try {
        console.log("📡 Testando Health Check do Proxy Fiscal...");
        const response = await axios.get(`${API_BASE}/fiscal-module/health`);
        console.log("✅ Resposta do Proxy:", JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log("❌ O servidor local não parece estar rodando ou o endpoint falhou.");
        console.log("Dica: Se você já fez o deploy, o teste deve ser feito via interface ou usando a URL do seu domínio.");
    }
}

testHealth();
