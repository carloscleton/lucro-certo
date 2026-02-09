import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';

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

        let yPosition = 20;

        // --- Header / Logo ---
        if (data.company.logo_url) {
            try {
                // Fetch image to convert to base64 or blob for jsPDF
                // Note: CORS issues might happen if not handled. Supabase public URLs usually allow GET.
                // We need to fetch it client-side.
                const img = new Image();
                img.src = data.company.logo_url;
                // Wait for load? In a non-browser env or without await, this is tricky. 
                // Better strategy: Fetch as blob -> base64

                console.log('🖼️ Fetching logo from:', data.company.logo_url);

                // Since we are in an async function, let's try fetch
                const response = await fetch(data.company.logo_url);
                if (!response.ok) throw new Error(`Failed to fetch logo: ${response.statusText}`);

                const blob = await response.blob();
                console.log('📦 Logo blob received, size:', blob.size, 'type:', blob.type);

                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') resolve(reader.result);
                        else reject(new Error('Failed to convert blob to base64'));
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                console.log('✅ Logo converted to base64');

                // Add image (x, y, w, h) - adjust aspect ratio if needed
                const imgProps = doc.getImageProperties(base64);
                const pdfWidth = 40;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                doc.addImage(base64, 'PNG', 20, yPosition, pdfWidth, pdfHeight);

                // Move text to right if logo exists, or move Y down?
                // Standard layout: Logo Left, Text Right OR Logo Top Center.
                // Let's go with Logo Top Left, Company Info Below or Right.
                // Let's put Company Info to the right of logo

                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text(data.company.name, 70, yPosition + 10);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                let infoY = yPosition + 16;
                if (data.company.legal_name) {
                    doc.text(data.company.legal_name, 70, infoY);
                    infoY += 5;
                }
                if (data.company.cnpj) {
                    doc.text(`CNPJ: ${data.company.cnpj}`, 70, infoY);
                    infoY += 5;
                }

                yPosition += Math.max(pdfHeight, 30) + 10;

            } catch (e) {
                console.error("Error loading logo for PDF", e);
                // Fallback if logo fails: Just text
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.text(data.company.name, 20, yPosition);
                yPosition += 10;
            }
        } else {
            // No Logo - Default Header
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text(data.company.name, 20, yPosition);
            yPosition += 10;
        }

        // Company Contact / Address (Full Width below header)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);

        // Build address string if parts exist or use pre-formatted address
        let addressLine = '';
        if (data.company.address) addressLine += data.company.address;

        let contactLine = '';
        if (data.company.email) contactLine += `Email: ${data.company.email}  `;
        if (data.company.phone) contactLine += `Tel: ${data.company.phone}`;

        if (addressLine) {
            doc.text(addressLine, 20, yPosition);
            yPosition += 5;
        }
        if (contactLine) {
            doc.text(contactLine, 20, yPosition);
            yPosition += 5;
        }

        doc.setTextColor(0); // Reset color
        yPosition += 10;
        doc.line(20, yPosition, 190, yPosition); // Separator line
        yPosition += 10;

        // Title (Orçamento)
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('ORÇAMENTO', 20, yPosition);
        yPosition += 10;

        // Quote Info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Título: ${data.quote.title}`, 20, yPosition);
        yPosition += 5;
        doc.text(`Data: ${new Date(data.quote.created_at).toLocaleDateString('pt-BR')}`, 20, yPosition);
        yPosition += 5;
        doc.text(`Validade: ${new Date(data.quote.valid_until).toLocaleDateString('pt-BR')}`, 20, yPosition);
        yPosition += 10;

        // Customer Info
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE:', 20, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(data.customer.name, 20, yPosition);
        yPosition += 5;
        if (data.customer.email) doc.text(`Email: ${data.customer.email}`, 20, yPosition);
        yPosition += 5;
        if (data.customer.phone) doc.text(`Telefone: ${data.customer.phone}`, 20, yPosition);
        yPosition += 5;
        if (data.customer.address) doc.text(`Endereço: ${data.customer.address}`, 20, yPosition);
        yPosition += 15;

        // Items Table Header
        doc.setFont('helvetica', 'bold');
        doc.text('ITENS:', 20, yPosition);
        yPosition += 7;

        // Table headers
        doc.setFontSize(9);
        doc.text('Descrição', 20, yPosition);
        doc.text('Qtd', 120, yPosition);
        doc.text('Valor Unit.', 140, yPosition);
        doc.text('Total', 170, yPosition);
        yPosition += 5;

        // Line
        doc.line(20, yPosition, 190, yPosition);
        yPosition += 5;

        // Items
        doc.setFont('helvetica', 'normal');
        data.items.forEach(item => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }

            doc.text(item.description.substring(0, 50), 20, yPosition);
            doc.text(item.quantity.toString(), 120, yPosition);
            doc.text(`R$ ${item.unit_price.toFixed(2)}`, 140, yPosition);
            doc.text(`R$ ${item.total_price.toFixed(2)}`, 170, yPosition);
            yPosition += 5;
        });

        yPosition += 5;
        doc.line(20, yPosition, 190, yPosition);
        yPosition += 7;

        // Totals
        doc.setFont('helvetica', 'bold');
        doc.text(`Subtotal: R$ ${data.subtotal.toFixed(2)}`, 140, yPosition);
        yPosition += 5;

        if (data.quote.discount > 0) {
            const discountText = data.quote.discount_type === 'percentage'
                ? `${data.quote.discount}%`
                : `R$ ${data.quote.discount.toFixed(2)}`;
            doc.text(`Desconto: ${discountText}`, 140, yPosition);
            yPosition += 5;
        }

        doc.setFontSize(12);
        doc.text(`TOTAL: R$ ${data.total.toFixed(2)}`, 140, yPosition);
        yPosition += 10;

        // Notes
        if (data.quote.notes) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('OBSERVAÇÕES:', 20, yPosition);
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            const splitNotes = doc.splitTextToSize(data.quote.notes, 170);
            doc.text(splitNotes, 20, yPosition);
        }

        // Convert to Blob
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
        // 1. List existing files for this quote to delete them
        // we search for files containing the quoteId in the company folder
        const { data: existingFiles } = await supabase.storage
            .from('orcamento-quote-pdfs')
            .list(companyId, {
                search: quoteId
            });

        if (existingFiles && existingFiles.length > 0) {
            const filesToRemove = existingFiles.map(f => `${companyId}/${f.name}`);
            await supabase.storage
                .from('orcamento-quote-pdfs')
                .remove(filesToRemove);
        }

        // 2. Upload new file with timestamp to avoid caching
        const timestamp = Date.now();
        const fileName = `${companyId}/${quoteId}_${timestamp}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('orcamento-quote-pdfs')
            .upload(fileName, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) {
            console.error('Error uploading PDF:', uploadError);
            throw uploadError;
        }

        // Get public URL
        const { data } = supabase.storage
            .from('orcamento-quote-pdfs')
            .getPublicUrl(fileName);

        return data.publicUrl;
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
