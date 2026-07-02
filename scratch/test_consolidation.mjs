const billingSimulation = [
  {
    "companyId": "84d1586e-5d0c-456f-aa12-aefc5a9364a7",
    "tradeName": "SERVICE LINE INFORMATICA",
    "cnpj": "00893566000190",
    "provider": "tecnospeed",
    "isActiveProvider": true,
    "issuerStatus": "Sem Configuração ❌",
    "fixedFee": 30,
    "perNoteFee": 0.61,
    "notesCount": 3,
    "canceledCount": 1,
    "notesCost": 2.44,
    "totalSuggested": 32.44,
    "isExempt": false
  },
  {
    "companyId": "84d1586e-5d0c-456f-aa12-aefc5a9364a7",
    "tradeName": "SERVICE LINE INFORMATICA",
    "cnpj": "00893566000190",
    "provider": "nfeio",
    "isActiveProvider": false,
    "issuerStatus": "Histórico (Inativo) ⚠️",
    "fixedFee": 0,
    "perNoteFee": 0.62,
    "notesCount": 2,
    "canceledCount": 0,
    "notesCost": 1.24,
    "totalSuggested": 1.24,
    "isExempt": false
  }
];

const selectedBillingCompanyIds = ["84d1586e-5d0c-456f-aa12-aefc5a9364a7"];

const consolidatedMap = new Map();

for (const s of billingSimulation) {
    if (selectedBillingCompanyIds.includes(s.companyId)) {
        let record = consolidatedMap.get(s.companyId);
        if (!record) {
            record = { amount: 0, descriptions: [] };
            consolidatedMap.set(s.companyId, record);
        }
        
        record.amount += s.totalSuggested;
        
        const totalNotes = s.notesCount + (s.canceledCount || 0);
        const providerLabel = String(s.provider).toUpperCase();
        
        if (s.isActiveProvider) {
            const feeFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.fixedFee);
            const costFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.notesCost);
            record.descriptions.push(
                `Mensalidade Fiscal (${feeFormatted}) + ${totalNotes} Notas ${providerLabel} (${s.notesCount} Ativas / ${s.canceledCount || 0} Canceladas) (${costFormatted})`
            );
        } else {
            const costFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.notesCost);
            record.descriptions.push(
                `${totalNotes} Notas ${providerLabel} (${s.notesCount} Ativas / ${s.canceledCount || 0} Canceladas) (${costFormatted})`
            );
        }
    }
}

const selectedData = Array.from(consolidatedMap.entries()).map(([companyId, data]) => {
    return {
        companyId,
        amount: data.amount.toFixed(2),
        description: data.descriptions.join(' + ')
    };
});

console.log(JSON.stringify(selectedData, null, 2));
