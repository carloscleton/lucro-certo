import jsPDF from 'jspdf';
import { storageService } from '../lib/storageService';

export interface QuotePDFData {
    quote: {
        id: string;
        title: string;
        created_at: string;
        valid_until: string;
        status: string;
        discount: number;
        discount_type: 'amount' | 'percentage';
        notes?: string;
    };
    customer: {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    items: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }>;
    company: {
        name: string;
        legal_name?: string;
        logo_url?: string;
        email?: string;
        phone?: string;
        address?: string;
        cnpj?: string;
        cpf?: string;
        entity_type?: 'PF' | 'PJ';
    };
    subtotal: number;
    total: number;
}

export class PDFService {
    /**
     * Generate PDF for a quote
     */
    static async generateQuotePDF(data: QuotePDFData): Promise<Blob> {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // Cores Profesionais
        const primaryColor = [30, 41, 59]; // Slate 800
        const accentColor = [59, 130, 246]; // Blue 500
        const textColor = [55, 65, 81]; // Gray 700
        const lightBg = [249, 250, 251]; // Gray 50
        const borderColor = [226, 232, 240]; // Slate 200

        let yPos = 20;

        // --- 1. HEADER (Compacto) ---
        // Barra superior decorativa
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');
        yPos = margin - 5;

        // Bloco de Identidade
        if (data.company.logo_url) {
            try {
                const response = await fetch(data.company.logo_url);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    const imgProps = doc.getImageProperties(base64);
                    const pdfWidth = 35; // Reduzido de 45
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(base64, 'PNG', margin, yPos, pdfWidth, pdfHeight);
                }
            } catch (e) {
                console.error("Erro ao carregar logo no PDF", e);
            }
        }

        // Info da Empresa (Alinhado à Direita)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14); // Reduzido de 16
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(data.company.name.toUpperCase(), pageWidth - margin, yPos + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let companyInfoY = yPos + 13;
        
        const companyLines = [];
        if (data.company.cnpj || data.company.cpf) companyLines.push(`${data.company.cnpj || data.company.cpf}`);
        if (data.company.email) companyLines.push(data.company.email);
        if (data.company.phone) companyLines.push(data.company.phone);
        if (data.company.address) companyLines.push(data.company.address);

        companyLines.forEach(line => {
            doc.text(line, pageWidth - margin, companyInfoY, { align: 'right' });
            companyInfoY += 4;
        });

        yPos = 42; // Compactado de 60

        // --- 2. TÍTULO E NÚMERO DA PROPOSTA ---
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 22, 'F'); // Altura de 30 para 22
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 22, 'S');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text('ORÇAMENTO / PROPOSTA', margin + 6, yPos + 10);
        
        doc.setFontSize(9);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(`Ref: ${data.quote.title}`, margin + 6, yPos + 16);

        const locale = window.__CURRENCY_LOCALE__ || 'pt-BR';
        const currency = window.__CURRENCY_CODE__ || 'BRL';

        // Grid com detalhes do orçamento
        doc.setFontSize(8.5);
        doc.text(`Emissão: ${new Date(data.quote.created_at).toLocaleDateString(locale)}`, pageWidth - margin - 6, yPos + 8, { align: 'right' });
        doc.text(`Vencimento: ${new Date(data.quote.valid_until).toLocaleDateString(locale)}`, pageWidth - margin - 6, yPos + 13, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(`ID: ${data.quote.id.substring(0, 8).toUpperCase()}`, pageWidth - margin - 6, yPos + 18, { align: 'right' });

        yPos += 27; // Compactado de 45

        // --- 3. DADOS DO CLIENTE ---
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('DADOS DO CLIENTE', margin, yPos);
        doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.setLineWidth(0.6);
        doc.line(margin, yPos + 1.5, margin + 35, yPos + 1.5);
        
        yPos += 8;
        doc.setFontSize(9.5);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(data.customer.name, margin, yPos);
        
        doc.setFont('helvetica', 'normal');
        yPos += 5;
        const customerDetails = [];
        if (data.customer.phone) customerDetails.push(`Tel: ${data.customer.phone}`);
        if (data.customer.email) customerDetails.push(`E-mail: ${data.customer.email}`);
        if (data.customer.address) customerDetails.push(`End: ${data.customer.address}`);
        
        if (customerDetails.length > 0) {
            doc.text(customerDetails.join(' | '), margin, yPos);
            yPos += 8;
        } else {
            yPos += 3;
        }

        yPos += 4;

        // --- 4. LISTA DE ITENS (Tabela Compacta) ---
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.text('DESCRIÇÃO', margin + 3, yPos + 5.5);
        doc.text('QTD', pageWidth - margin - 50, yPos + 5.5, { align: 'center' });
        doc.text(`V. UNIT (${window.__CURRENCY_SYMBOL__ || 'R$'})`, pageWidth - margin - 30, yPos + 5.5, { align: 'center' });
        doc.text(`TOTAL (${window.__CURRENCY_SYMBOL__ || 'R$'})`, pageWidth - margin - 3, yPos + 5.5, { align: 'right' });

        yPos += 8;
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'normal');

        data.items.forEach((item, index) => {
            // Zebra Striping para facilitar leitura
            if (index % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
            }

            // Quebra de página se necessário
            if (yPos > pageHeight - 60) {
                doc.addPage();
                yPos = margin + 10;
            }

            // Multi-line description support
            const descriptionLines = doc.splitTextToSize(item.description, 100);
            doc.text(descriptionLines, margin + 3, yPos + 5);
            
            const cellHeight = Math.max(8, (descriptionLines.length * 4.5) + 1.5);

            doc.text(item.quantity.toString(), pageWidth - margin - 50, yPos + 5, { align: 'center' });
            doc.text(item.unit_price.toLocaleString(locale, { minimumFractionDigits: 2 }), pageWidth - margin - 30, yPos + 5, { align: 'center' });
            doc.text(item.total_price.toLocaleString(locale, { minimumFractionDigits: 2 }), pageWidth - margin - 3, yPos + 5, { align: 'right' });
            
            yPos += cellHeight;
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.1);
            doc.line(margin, yPos, pageWidth - margin, yPos);
        });

        yPos += 8;

        // --- 5. RESUMO DE VALORES ---
        const resumoWidth = 65;
        const resumoX = pageWidth - margin - resumoWidth;
        
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(resumoX, yPos, resumoWidth, 24, 'F');
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.rect(resumoX, yPos, resumoWidth, 24, 'S');

        doc.setFontSize(8.5);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('Subtotal:', resumoX + 4, yPos + 6);
        doc.text(data.subtotal.toLocaleString(locale, { style: 'currency', currency: currency }), pageWidth - margin - 4, yPos + 6, { align: 'right' });

        if (data.quote.discount > 0) {
            yPos += 5;
            doc.setTextColor(185, 28, 28); // Text-red-700
            const discValue = data.quote.discount_type === 'percentage' ? (data.subtotal * data.quote.discount / 100) : data.quote.discount;
            doc.text('Desconto:', resumoX + 4, yPos + 6);
            doc.text(`- ${discValue.toLocaleString(locale, { style: 'currency', currency: currency })}`, pageWidth - margin - 4, yPos + 6, { align: 'right' });
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        }

        yPos += 8;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', resumoX + 4, yPos + 6);
        doc.text(data.total.toLocaleString(locale, { style: 'currency', currency: currency }), pageWidth - margin - 4, yPos + 6, { align: 'right' });

        yPos += 15;

        // --- 6. OBSERVAÇÕES ---
        if (data.quote.notes) {
            doc.setFontSize(9);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text('NOTAS E CONDIÇÕES', margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            const splitNotes = doc.splitTextToSize(data.quote.notes, pageWidth - (margin * 2));
            doc.text(splitNotes, margin, yPos + 5);
            yPos += (splitNotes.length * 4) + 10;
        }

        // --- 7. ASSINATURAS (No final do documento) ---
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 30;
        } else {
            yPos = pageHeight - 45;
        }

        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.4);
        doc.line(margin + 5, yPos, margin + 70, yPos);
        doc.line(pageWidth - margin - 70, yPos, pageWidth - margin - 5, yPos);
        
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text('Assinatura da Empresa', margin + 37.5, yPos + 4, { align: 'center' });
        doc.text('Assinatura do Cliente', pageWidth - margin - 37.5, yPos + 4, { align: 'center' });

        // Rodapé (Pequeno)
        doc.setFontSize(7);
        doc.text(`Gerado em ${new Date().toLocaleString(locale)}.`, pageWidth / 2, pageHeight - 8, { align: 'center' });

        return doc.output('blob');
    }

    /**
     * Upload PDF to Supabase Storage
     */
    static async uploadPDFToStorage(
        pdfBlob: Blob,
        quoteId: string,
        companyId: string
    ): Promise<string> {
        const folder = `${companyId}/`;

        // 1. List existing files for this quote to delete them
        try {
            const existingFiles = await storageService.list('orcamento-quote-pdfs', folder);
            const filesToRemove = existingFiles
                .filter(f => f.name.includes(quoteId))
                .map(f => `${folder}${f.name}`);

            if (filesToRemove.length > 0) {
                await storageService.deleteMultiple('orcamento-quote-pdfs', filesToRemove);
            }
        } catch (e) {
            console.error('Error during old PDF cleanup:', e);
        }

        // 2. Upload new file with timestamp
        const timestamp = Date.now();
        const fileName = `${quoteId}_${timestamp}.pdf`;
        const path = `${folder}${fileName}`;

        const { publicUrl } = await storageService.upload(pdfBlob, 'orcamento-quote-pdfs', path);

        return publicUrl;
    }

    /**
     * Generate and upload quote PDF
     */
    static async generateAndUploadQuotePDF(
        data: QuotePDFData,
        companyId: string
    ): Promise<string> {
        console.log('📄 Generating PDF...');
        const pdfBlob = await this.generateQuotePDF(data);

        console.log('☁️ Uploading PDF to storage...');
        const pdfUrl = await this.uploadPDFToStorage(pdfBlob, data.quote.id, companyId);

        console.log('✅ PDF generated and uploaded:', pdfUrl);
        return pdfUrl;
    }
}
