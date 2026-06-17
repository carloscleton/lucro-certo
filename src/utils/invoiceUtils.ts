/**
 * Helper to build a sanitized and structured filename for invoice downloads (PDF/XML).
 * Pattern: [CNPJ/CPF] - [Client Name] - [Date DD-MM-YYYY] - NF-[Invoice Number].[format]
 */
export function getInvoiceFilename(invoice: any, format: 'pdf' | 'xml'): string {
    if (!invoice) return `nota.${format}`;

    const p = invoice.payload || {};

    // 1. CNPJ/CPF (Client Tax ID)
    const rawTaxId = invoice.quote?.contact?.tax_id || 
                      p.tomador?.cpfCnpj || 
                      p.destinatario?.cpfCnpj || 
                      p.destinatario?.cnpj || 
                      p.retorno?.tomador?.cpfCnpj ||
                      '';
    const taxId = rawTaxId.replace(/\D/g, ''); // Digits only

    // 2. Client/Receiver Name
    const rawClientName = invoice.quote?.contact?.name || 
                           p.tomador?.razaoSocial || 
                           p.destinatario?.razaoSocial || 
                           p.destinatario?.nome || 
                           p.retorno?.tomador?.razaoSocial ||
                           '';
    // Remove characters that are invalid in filenames across different OS: \ / : * ? " < > |
    const clientName = rawClientName.replace(/[\\/:*?"<>|]/g, '').trim();

    // 3. Issue Date (formatted as DD-MM-YYYY)
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

    // 4. Invoice Number
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
    if (clientName) parts.push(clientName);
    if (dateStr) parts.push(dateStr);
    if (num) parts.push(`NF-${num}`);

    // Fallback if no parts are resolved
    if (parts.length === 0) {
        return `nota_${invoice.external_id || 'documento'}.${format}`;
    }

    return `${parts.join(' - ')}.${format}`;
}
