const findDocument = (obj, format) => {
    if (!obj || typeof obj !== 'object') return null;
    
    // 1. Tenta campos diretos (prioridade absoluta - http ou blob)
    const candidates = [
        obj[`${format}_url`], 
        obj[format]?.url, 
        obj[format], 
        obj[`url_${format}`], 
        obj[`url${format.charAt(0).toUpperCase() + format.slice(1)}`]
    ];

    for (const cand of candidates) {
        if (typeof cand === 'string' && (cand.startsWith('http') || cand.startsWith('blob:'))) return cand;
        if (typeof cand === 'object' && cand !== null && typeof cand.url === 'string' && (cand.url.startsWith('http') || cand.url.startsWith('blob:'))) return cand.url;
    }

    // 2. Busca exaustiva em todas as chaves (http ou blob)
    for (const k in obj) {
        const val = obj[k];
        
        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('blob:'))) {
            const low = val.toLowerCase();
            if (format === 'pdf' && (low.includes('pdf') || low.includes('impressao') || low.includes('danfe') || low.endsWith('.pdf'))) return val;
            if (format === 'xml' && (low.includes('xml') || low.includes('arquivo') || low.endsWith('.xml'))) return val;
        }
        
        if (typeof val === 'object' && val !== null) {
            const found = findDocument(val, format);
            if (found) return found;
        }
    }
    return null;
};

const data = {
  "documents": [
    {
      "idIntegracao": "TEST_1779274567307_5423",
      "prestador": "08187168000160",
      "id": "6a0db69d591b34c052801ff5"
    }
  ],
  "message": "Nota(s) em processamento",
  "pdf": "https://api.lucrocerto.net/fiscal-module/nfse/6a0db69d591b34c052801ff5/pdf?companyId=84d1586a-5d0c-456f-aa12-aefc5a9364a7&token=123",
  "xml": "https://api.lucrocerto.net/fiscal-module/nfse/6a0db69d591b34c052801ff5/xml?companyId=84d1586a-5d0c-456f-aa12-aefc5a9364a7&token=123"
};

console.log("PDF URL:", findDocument(data, 'pdf'));
console.log("XML URL:", findDocument(data, 'xml'));
