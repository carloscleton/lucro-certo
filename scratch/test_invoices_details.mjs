// Unit test for detailed billing invoices endpoint logic
const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';

// Mock raw response from Supabase Rest API for fiscal_invoices
const mockRawDbResponse = [
    {
        id: 'invoice-nfe-1',
        created_at: '2026-06-19T10:00:00.000Z',
        type: 'nfeio',
        status: 'autorizada',
        external_id: 'nfe_ext_123',
        payload: {
            borrower: { name: 'Cliente Mock NFe.io' },
            amount: 150.50,
            numero: '1001'
        }
    },
    {
        id: 'invoice-nfe-2',
        created_at: '2026-06-19T10:15:00.000Z',
        type: 'nfeio',
        status: 'cancelada',
        external_id: 'nfe_ext_124',
        payload: {
            cliente: { nome: 'Outro Cliente NFe' },
            valorTotal: 75.00,
            series: '1'
        }
    },
    {
        id: 'invoice-ts-1',
        created_at: '2026-06-19T11:00:00.000Z',
        type: 'nfse',
        status: 'autorizada',
        external_id: 'ts_ext_789',
        invoice_number: '11950',
        dps_number: '7',
        dps_serie: 'LAL',
        payload: {
            tomador: { razaoSocial: 'Cliente Mock TecnoSpeed' },
            servico: {
                valor: {
                    servico: 280.00
                }
            },
            numero: '2002'
        }
    },
    {
        id: 'invoice-ts-2',
        created_at: '2026-06-19T11:30:00.000Z',
        type: 'nfsenac', // national service invoice
        status: 'cancelada',
        external_id: 'ts_ext_790',
        dps_number: '505',
        payload: {
            tomador: { nome: 'Cliente Cancelado TecnoSpeed' },
            servico: [
                {
                    valorUnitario: 50.00
                }
            ],
            rps: { numero: '505' }
        }
    }
];

function testEndpointMapping(provider) {
    console.log(`\n=========================================`);
    console.log(`TESTANDO EMISSOR: ${provider.toUpperCase()}`);
    console.log(`=========================================`);

    // 1. Filter by requested provider (logic from api/index.ts)
    const filteredInvoices = mockRawDbResponse.filter((inv) => {
        const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
        return p === provider;
    });

    console.log(`Notas encontradas para ${provider}: ${filteredInvoices.length}`);

    // 2. Map key info (logic from api/index.ts)
    const mappedInvoices = filteredInvoices.map((inv) => {
        const payload = inv.payload || {};
        let clientName = 'Cliente não identificado';
        let ident = `ID: ${inv.external_id || inv.id}`;
        let valor = 0;

        if (inv.type === 'nfeio') {
            clientName = payload.borrower?.name || payload.cliente?.nome || payload.retorno?.borrower?.name || 'Cliente não identificado';
            const invNo = inv.invoice_number || payload.retorno?.number || payload.numero || payload.retorno?.numero;
            const series = payload.retorno?.series || payload.series || '';
            ident = invNo ? `Nº ${invNo}` : `Série: ${series} / ID: ${inv.external_id}`;
            valor = payload.servicesAmount || payload.amount || payload.valorTotal || payload.retorno?.servicesAmount || payload.retorno?.amount || 0;
        } else {
            const tomador = payload.tomador || {};
            clientName = tomador.razaoSocial || tomador.nome || payload.retorno?.tomador?.razaoSocial || payload.retorno?.tomador?.nome || 'Cliente não identificado';
            
            const invNo = inv.invoice_number 
                || payload.retorno?.numeroNfse 
                || payload.numeroNfse 
                || payload.numeroNfe 
                || payload.retorno?.numero 
                || payload.numero 
                || payload.retorno?.dps?.numero;
                
            const dpsNo = inv.dps_number 
                || payload.retorno?.dps?.numero 
                || payload.dps?.numero 
                || payload.nacional?.dps?.numero 
                || payload.DPS?.infDPS?.nDPS 
                || payload.nDPS 
                || payload.retorno?.rps?.numero 
                || payload.rps?.numero;

            ident = invNo ? `Nº ${invNo}` : (dpsNo ? `RPS: ${dpsNo} / ID: ${inv.external_id}` : `ID: ${inv.external_id}`);
            
            // Get TecnoSpeed service value
            const tsServico = Array.isArray(payload.servico) ? payload.servico[0] : payload.servico;
            const tsRetornoServico = Array.isArray(payload.retorno?.servico) ? payload.retorno.servico[0] : payload.retorno?.servico;
            
            valor = payload.valorTotal 
                || tsServico?.valor?.servico 
                || tsServico?.valorUnitario 
                || tsServico?.valorTotal 
                || tsServico?.valorServico
                || payload.retorno?.valorTotal 
                || tsRetornoServico?.valor?.servico 
                || tsRetornoServico?.valorUnitario 
                || tsRetornoServico?.valorTotal 
                || tsRetornoServico?.valorServico 
                || 0;
        }

        return {
            id: inv.id,
            created_at: inv.created_at,
            type: inv.type,
            status: inv.status,
            external_id: inv.external_id,
            clientName,
            ident,
            valor
        };
    });

    // 3. Assertions
    mappedInvoices.forEach((inv, index) => {
        console.log(`[${index + 1}] ID: ${inv.id} | Ident: ${inv.ident} | Client: ${inv.clientName} | Status: ${inv.status} | Value: R$ ${inv.valor}`);
    });

    if (provider === 'nfeio') {
        const inv1 = mappedInvoices.find(i => i.id === 'invoice-nfe-1');
        const inv2 = mappedInvoices.find(i => i.id === 'invoice-nfe-2');
        if (inv1 && inv1.clientName === 'Cliente Mock NFe.io' && inv1.ident === 'Nº 1001' && inv1.valor === 150.50) {
            console.log("✅ Assertion 1 OK: NFe.io nota emitida mapeada com sucesso.");
        } else {
            console.error("❌ Assertion 1 FAILED: NFe.io nota emitida mapeada incorretamente.");
        }
        if (inv2 && inv2.clientName === 'Outro Cliente NFe' && inv2.ident === 'Série: 1 / ID: nfe_ext_124' && inv2.valor === 75.00) {
            console.log("✅ Assertion 2 OK: NFe.io nota sem número mapeada com sucesso.");
        } else {
            console.error("❌ Assertion 2 FAILED: NFe.io nota sem número mapeada incorretamente.");
        }
    } else {
        const inv1 = mappedInvoices.find(i => i.id === 'invoice-ts-1');
        const inv2 = mappedInvoices.find(i => i.id === 'invoice-ts-2');
        if (inv1 && inv1.clientName === 'Cliente Mock TecnoSpeed' && inv1.ident === 'Nº 11950' && inv1.valor === 280.00) {
            console.log("✅ Assertion 3 OK: TecnoSpeed nota de serviço emitida mapeada com sucesso.");
        } else {
            console.error("❌ Assertion 3 FAILED: TecnoSpeed nota de serviço emitida mapeada incorretamente.");
        }
        if (inv2 && inv2.clientName === 'Cliente Cancelado TecnoSpeed' && inv2.ident === 'RPS: 505 / ID: ts_ext_790' && inv2.valor === 50.00) {
            console.log("✅ Assertion 4 OK: TecnoSpeed nota nacional/RPS cancelada mapeada com sucesso.");
        } else {
            console.error("❌ Assertion 4 FAILED: TecnoSpeed nota nacional/RPS cancelada mapeada incorretamente.");
        }
    }
}

// Run test
testEndpointMapping('nfeio');
testEndpointMapping('tecnospeed');
