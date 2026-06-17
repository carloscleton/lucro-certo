/**
 * Helper to build a sanitized and structured filename for invoice downloads (PDF/XML).
 * Pattern: [Company CNPJ] - [Company Name] - [Client Name] - [Date DD-MM-YYYY] - NF-[Invoice Number].[format]
 */
export function getInvoiceFilename(invoice: any, format: 'pdf' | 'xml', company?: any): string {
    if (!invoice) return `nota.${format}`;

    const p = invoice.payload || {};

    // 1. Get CNPJ/CPF of the issuing company (from database company object, with fallback to payload prestador)
    const rawTaxId = company?.cnpj || 
                      p.prestador?.cpfCnpj || 
                      p.retorno?.prestador?.cpfCnpj ||
                      p.retorno?.data?.prestador?.cpfCnpj ||
                      '';
    const taxId = rawTaxId.replace(/\D/g, '');

    // 2. Get name of the issuing company (from database company object, with fallback to payload prestador)
    const rawCompanyName = company?.trade_name || 
                           company?.legal_name || 
                           p.prestador?.razaoSocial || 
                           p.prestador?.nome || 
                           p.retorno?.prestador?.razaoSocial ||
                           p.retorno?.data?.prestador?.razaoSocial ||
                           '';
    const companyName = rawCompanyName.replace(/[\\/:*?"<>|]/g, '').trim();

    // 3. Get name of the client (tomador/destinatario)
    const rawClientName = 
        invoice.quote?.contact?.name || 
        // Direct payload (from creation request)
        p.tomador?.razaoSocial || 
        p.tomador?.nome ||
        p.destinatario?.razaoSocial || 
        p.destinatario?.nome || 
        p.borrower?.name ||
        // From retorno (directly nested)
        p.retorno?.tomador?.razaoSocial ||
        p.retorno?.tomador?.nome ||
        p.retorno?.destinatario?.razaoSocial ||
        p.retorno?.destinatario?.nome ||
        p.retorno?.borrower?.name ||
        // From retorno.data (nested inside data object from PlugNotas API queries)
        p.retorno?.data?.tomador?.razaoSocial ||
        p.retorno?.data?.tomador?.nome ||
        p.retorno?.data?.destinatario?.razaoSocial ||
        p.retorno?.data?.destinatario?.nome ||
        p.retorno?.data?.borrower?.name ||
        // Nacional format fallback
        p.nacional?.tomador?.razaoSocial ||
        p.nacional?.tomador?.nome ||
        p.nacional?.destinatario?.razaoSocial ||
        p.nacional?.destinatario?.nome ||
        '';
    const clientName = rawClientName.replace(/[\\/:*?"<>|]/g, '').trim();

    // 4. Issue Date (formatted as DD-MM-YYYY)
    let dateStr = '';
    if (invoice.created_at) {
        try {
            const datePart = invoice.created_at.split('T')[0];
            const parts = datePart.split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                dateStr = `${day}-${month}-${year}`;
            }
        } catch (e) {
            console.error('Error parsing date for filename:', e);
        }
    }

    // 5. Invoice Number
    const num = invoice.invoice_number || 
                p.retorno?.numeroNfse || 
                p.numeroNfse || 
                p.numeroNfe || 
                p.retorno?.numero || 
                p.numero || 
                p.retorno?.dps?.numero || 
                invoice.external_id || 
                '';

    // Build parts list
    const parts: string[] = [];
    if (taxId) parts.push(taxId);
    if (companyName) parts.push(companyName);
    if (clientName) parts.push(clientName);
    if (dateStr) parts.push(dateStr);
    if (num) parts.push(`NF-${num}`);

    // Fallback if no parts are resolved
    if (parts.length === 0) {
        return `nota_${invoice.external_id || 'documento'}.${format}`;
    }

    return `${parts.join(' - ')}.${format}`;
}
