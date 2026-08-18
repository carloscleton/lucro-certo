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
        doc.text(`Vencimento: ${new Date(data.quote.valid_until + 'T00:00:00').toLocaleDateString(locale)}`, pageWidth - margin - 6, yPos + 13, { align: 'right' });
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
        doc.text(`V. UNIT (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})`, pageWidth - margin - 30, yPos + 5.5, { align: 'center' });
        doc.text(`TOTAL (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})`, pageWidth - margin - 3, yPos + 5.5, { align: 'right' });

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
     * Generate DANFSE (Documento Auxiliar da NFS-e Nacional) PDF
     */
    /**
     * Generate DANFSE (Documento Auxiliar da NFS-e Nacional) PDF v2.0
     */
    static async generateDanfsePDF(data: any): Promise<Blob> {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const margin = 8;
        let y = 8;
        const pageWidth = 194; // 210 - 16

        // Helper functions for drawing crisp black borders & fills
        const drawBox = (x: number, y: number, w: number, h: number, bg: number[] | null = null, border = [0, 0, 0]) => {
            if (bg) {
                doc.setFillColor(bg[0], bg[1], bg[2]);
            }
            doc.setDrawColor(border[0], border[1], border[2]);
            doc.setLineWidth(0.2);
            doc.rect(x, y, w, h, bg ? 'FD' : 'S');
        };

        const drawHeaderBox = (x: number, y: number, w: number, h: number, title: string, bg = [240, 240, 240]) => {
            drawBox(x, y, w, h, bg, [0, 0, 0]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(0, 0, 0);
            doc.text(title.toUpperCase(), x + 2, y + 3.8);
        };

        const formatCurrency = (val: any) => {
            const num = parseFloat(String(val || 0));
            return isNaN(num) ? 'R$ 0,00' : `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        const formatCpfCnpj = (val: any) => {
            if (!val) return '-';
            const s = String(val).replace(/\D/g, '');
            if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
            return val;
        };

        const formatCep = (val: any) => {
            if (!val) return '';
            const s = String(val).replace(/\D/g, '');
            if (s.length === 8) return s.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3');
            return val;
        };

        const formatIbge = (val: any) => {
            if (!val) return '';
            const s = String(val).replace(/\D/g, '');
            if (s.length === 7) return s.replace(/^(\d{2})(\d{5})$/, '$1.$2');
            return val;
        };

        const formatCTribNac = (val: any) => {
            if (!val) return '01.07.01';
            const s = String(val).replace(/\D/g, '');
            if (s.length === 6) return `${s.substring(0, 2)}.${s.substring(2, 4)}.${s.substring(4, 6)}`;
            return val;
        };

        const formatNbs = (val: any) => {
            if (!val) return '-';
            const s = String(val).replace(/\D/g, '');
            if (s.length === 9) return `${s.substring(0, 1)}.${s.substring(1, 5)}.${s.substring(5, 7)}.${s.substring(7, 9)}`;
            return val;
        };

        const chave = String(data.chaveAcesso || data.chave || '24081022200893566000190000000000004526087773930690').replace(/\D/g, '');
        const nNfseVal = String(data.nNfse || data.nNFSe || '45');
        const nDpsVal = String(data.nDPS || data.nDps || '44');
        const prest = data.prestador || {};
        const toma = data.tomador || {};
        const serv = data.servico || {};

        // 1. TOP HEADER (LOGO, TITLE, AMBIENTE)
        drawBox(margin, y, pageWidth, 18, [255, 255, 255], [0, 0, 0]);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(0, 140, 68);
        doc.text('NFS-e', margin + 3, y + 10);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Nota Fiscal de\nServiço eletrônica', margin + 28, y + 7);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('DANFSe v2.0', margin + (pageWidth / 2), y + 7, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento Auxiliar da NFS-e', margin + (pageWidth / 2), y + 12, { align: 'center' });

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const prestCity = prest.cidade || prest.municipio || 'Natal';
        const prestUf = prest.uf || 'RN';
        doc.text(`Município: ${prestCity} - ${prestUf}`, margin + pageWidth - 3, y + 6, { align: 'right' });
        doc.text(`Ambiente Gerador: ${data.ambiente === 'producao' ? '1' : '2'}`, margin + pageWidth - 3, y + 10, { align: 'right' });
        doc.text(`Tipo de Ambiente: ${data.ambiente === 'producao' ? '1' : '1'}`, margin + pageWidth - 3, y + 14, { align: 'right' });

        y += 18;

        // 2. CHAVE DE ACESSO & QR CODE BOX
        const leftW = 148;
        const qrW = 46;
        drawBox(margin, y, leftW, 26, [255, 255, 255], [0, 0, 0]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text('CHAVE DE ACESSO DA NFS-e', margin + 2, y + 4);

        doc.setFont('courier', 'bold');
        doc.setFontSize(7.5);
        doc.text(chave, margin + 2, y + 9);

        const formatDateTimeBr = (dateStr: any) => {
            if (!dateStr) return '';
            const s = String(dateStr).trim();
            if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(s)) return s;

            const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
            if (isoMatch) {
                const [, year, month, day, hours, minutes, seconds] = isoMatch;
                return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
            }

            try {
                const d = new Date(s);
                if (isNaN(d.getTime())) return s;
                const parts = new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).formatToParts(d);

                const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
                return `${getPart('day')}/${getPart('month')}/${getPart('year')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
            } catch (e) {
                return s;
            }
        };

        const formatDateBr = (dateStr: any) => {
            if (!dateStr) return '';
            const s = String(dateStr).trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

            const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                const [, year, month, day] = isoMatch;
                return `${day}/${month}/${year}`;
            }

            try {
                const d = new Date(s);
                if (isNaN(d.getTime())) return s;
                const parts = new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).formatToParts(d);
                const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
                return `${getPart('day')}/${getPart('month')}/${getPart('year')}`;
            } catch (e) {
                return s;
            }
        };

        const formattedDhNfse = formatDateTimeBr(data.dhProc || data.dhEmi || new Date().toISOString());
        const formattedDhDps = formatDateTimeBr(data.dhEmi || data.dhProc || new Date().toISOString());
        const formattedDCompet = formatDateBr(data.dCompet || new Date().toISOString());

        const cW = leftW / 3;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('NÚMERO DA NFS-e', margin + 2, y + 14);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(nNfseVal, margin + 2, y + 17.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('COMPETÊNCIA DA NFS-e', margin + cW + 2, y + 14);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(formattedDCompet, margin + cW + 2, y + 17.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('DATA E HORA DA EMISSÃO DA NFS-e', margin + (cW * 2) + 2, y + 14);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(formattedDhNfse, margin + (cW * 2) + 2, y + 17.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('NÚMERO DA DPS', margin + 2, y + 21.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(nDpsVal, margin + 2, y + 25);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('SÉRIE DA DPS', margin + cW + 2, y + 21.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(String(data.serie || '1'), margin + cW + 2, y + 25);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('DATA E HORA DA EMISSÃO DA DPS', margin + (cW * 2) + 2, y + 21.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(formattedDhDps, margin + (cW * 2) + 2, y + 25);

        drawBox(margin + leftW, y, qrW, 26, [255, 255, 255], [0, 0, 0]);
        try {
            const qrTargetUrl = `https://www.nfse.gov.br/ConsultaPublica?tpc=1&chave=${chave}`;
            const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, { margin: 1, width: 120 });
            const qrImageSize = 17;
            const qrImageX = margin + leftW + (qrW - qrImageSize) / 2;
            doc.addImage(qrDataUrl, 'PNG', qrImageX, y + 1, qrImageSize, qrImageSize);
        } catch (qrErr: any) {
            console.error('❌ [DANFSE-QR] Erro ao gerar QR Code:', qrErr?.message || qrErr);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.8);
        doc.setTextColor(50, 50, 50);
        const qrSub = 'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e';
        const splitQrSub = doc.splitTextToSize(qrSub, qrW - 4);
        doc.text(splitQrSub, margin + leftW + 2, y + 19.5);

        y += 26;

        // Row 3: EMITENTE / SITUAÇÃO / FINALIDADE
        drawBox(margin, y, pageWidth, 7.5, [255, 255, 255], [0, 0, 0]);
        const w3 = pageWidth / 3;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
        doc.text('EMITENTE DA NFS-e', margin + 2, y + 2.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text('Prestador', margin + 2, y + 6);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('SITUAÇÃO DA NFS-e', margin + w3 + 2, y + 2.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text('NFS-e Gerada', margin + w3 + 2, y + 6);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text('FINALIDADE', margin + (w3 * 2) + 2, y + 2.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text('NFS-e regular', margin + (w3 * 2) + 2, y + 6);

        y += 7.5;

        // 3. PRESTADOR / FORNECEDOR
        drawHeaderBox(margin, y, pageWidth, 4.5, 'PRESTADOR / FORNECEDOR');
        y += 4.5;
        drawBox(margin, y, pageWidth, 22, [255, 255, 255], [0, 0, 0]);

        const prestName = prest.nome || prest.razaoSocial || 'CARLOSCLETON CARVALHO FERNANDES';
        const prestCnpjFmt = formatCpfCnpj(prest.cnpj || prest.doc || '00893566000190');
        const prestImFmt = prest.im || prest.inscricaoMunicipal || '-';
        const prestEndFmt = prest.endereco || 'RUA RIO SUASSUI, 7710, PITIMBU';
        const prestCityUf = `${prest.cidade || prest.municipio || 'Natal'} / ${prest.uf || 'RN'}`;
        const prestIbgeCep = `${formatIbge(prest.cMun || '2408102')} / ${formatCep(prest.cep || '59068320')}`;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
        doc.text('Nome / Nome Empresarial', margin + 2, y + 3.2);
        doc.text('CNPJ / CPF / NIF', margin + 95, y + 3.2);
        doc.text('Indicador Municipal (Inscrição)', margin + 135, y + 3.2);
        doc.text('Telefone', margin + 170, y + 3.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(prestName, margin + 2, y + 6.5);
        doc.text(prestCnpjFmt, margin + 95, y + 6.5);
        doc.text(prestImFmt, margin + 135, y + 6.5);
        doc.text(prest.telefone || '-', margin + 170, y + 6.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.text('Endereço', margin + 2, y + 10.5);
        doc.text('Município / Sigla UF', margin + 95, y + 10.5);
        doc.text('Código IBGE / CEP', margin + 145, y + 10.5);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(prestEndFmt, margin + 2, y + 13.8);
        doc.text(prestCityUf, margin + 95, y + 13.8);
        doc.text(prestIbgeCep, margin + 145, y + 13.8);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.text('Simples Nacional na Data de Competência', margin + 2, y + 17.8);
        doc.text('Regime de Apuração Tributária pelo SN', margin + 65, y + 17.8);
        doc.text('E-mail', margin + 145, y + 17.8);

        const prestEmail = prest.email || '-';
        let prestEmailFontSize = 6;
        if (prestEmail.length > 32) prestEmailFontSize = 4.6;
        else if (prestEmail.length > 25) prestEmailFontSize = 5.2;

        doc.setFont('helvetica', 'normal'); doc.setFontSize(prestEmailFontSize);
        doc.text('Optante - Microempresa ou Empresa de ...', margin + 2, y + 21);
        doc.text('Regime de apuração dos tributos federais e municipal pelo Simples Nacional', margin + 65, y + 21);
        doc.text(prestEmail, margin + 145, y + 21);

        y += 22;

        // 4. TOMADOR / ADQUIRENTE
        drawHeaderBox(margin, y, pageWidth, 4.5, 'TOMADOR / ADQUIRENTE');
        y += 4.5;
        drawBox(margin, y, pageWidth, 17, [255, 255, 255], [0, 0, 0]);

        const tomaName = toma.nome || toma.razaoSocial || 'NÃO IDENTIFICADO';
        const tomaCnpjFmt = formatCpfCnpj(toma.doc || toma.cnpj || toma.cpf || toma.cpfCnpj);
        const tomaImFmt = toma.im || toma.inscricaoMunicipal || '-';
        const tomaEndFmt = toma.endereco || '-';
        const tomaCityName = toma.cidade || toma.municipio || toma.xMun || '-';
        const tomaUfCode = toma.uf || '';
        const tomaCityUf = tomaCityName !== '-' ? `${tomaCityName}${tomaUfCode ? ' / ' + tomaUfCode : ''}` : '-';
        const tomaIbgeVal = toma.cMun || toma.codigoCidade || '';
        const tomaCepVal = toma.cep || '';
        const tomaIbgeCep = (tomaIbgeVal || tomaCepVal) ? `${formatIbge(tomaIbgeVal)}${tomaIbgeVal && tomaCepVal ? ' / ' : ''}${formatCep(tomaCepVal)}` : '-';

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
        doc.text('Nome / Nome Empresarial', margin + 2, y + 3.2);
        doc.text('CNPJ / CPF / NIF', margin + 90, y + 3.2);
        doc.text('Indicador Municipal (Inscrição)', margin + 128, y + 3.2);
        doc.text('Telefone', margin + 170, y + 3.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(tomaName, margin + 2, y + 6.5);
        doc.text(tomaCnpjFmt, margin + 90, y + 6.5);
        doc.text(tomaImFmt, margin + 128, y + 6.5);
        doc.text(toma.telefone || '-', margin + 170, y + 6.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.text('Endereço', margin + 2, y + 10.5);
        doc.text('Município / Sigla UF', margin + 90, y + 10.5);
        doc.text('Código IBGE / CEP', margin + 128, y + 10.5);
        doc.text('E-mail', margin + 158, y + 10.5);

        const tomaEmail = toma.email || '-';
        let tomaEmailFontSize = 6.5;
        if (tomaEmail.length > 32) tomaEmailFontSize = 4.5;
        else if (tomaEmail.length > 25) tomaEmailFontSize = 5.0;
        else if (tomaEmail.length > 20) tomaEmailFontSize = 5.6;

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(tomaEndFmt, margin + 2, y + 13.8);
        doc.text(tomaCityUf, margin + 90, y + 13.8);
        doc.text(tomaIbgeCep, margin + 128, y + 13.8);
        doc.setFontSize(tomaEmailFontSize);
        doc.text(tomaEmail, margin + 158, y + 13.8);

        y += 17;

        // 5. DESTINATÁRIO / INTERMEDIÁRIO BARS
        drawBox(margin, y, pageWidth, 7, [255, 255, 255], [0, 0, 0]);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0, 0, 0);
        doc.text('DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', margin + (pageWidth / 2), y + 2.8, { align: 'center' });
        doc.text('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', margin + (pageWidth / 2), y + 5.8, { align: 'center' });

        y += 7;

        // 6. SERVIÇO PRESTADO
        drawHeaderBox(margin, y, pageWidth, 4.5, 'SERVIÇO PRESTADO');
        y += 4.5;

        const xTribNacVal = serv.xTribNac || 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.';
        const splitXTribNac = doc.splitTextToSize(xTribNacVal, pageWidth - 4);

        const fullDesc = serv.descricao || 'SUPORTE TÉCNICO EM TI / INFORMÁTICA';
        const splitDesc = doc.splitTextToSize(fullDesc, pageWidth - 4);

        const servBoxHeight = Math.max(28, 12 + (splitXTribNac.length * 3.5) + (splitDesc.length * 3.5) + 4);
        drawBox(margin, y, pageWidth, servBoxHeight, [255, 255, 255], [0, 0, 0]);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
        doc.text('Código de Tributação Nacional/Municipal', margin + 2, y + 3.2);
        doc.text('Código da NBS', margin + 95, y + 3.2);
        doc.text('Local da Prestação / Sigla UF / País', margin + 145, y + 3.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(`${formatCTribNac(serv.cTribNac || '010701')} / -`, margin + 2, y + 6.5);
        doc.text(formatNbs(serv.nbs || serv.cNbs || '115013000'), margin + 95, y + 6.5);
        doc.text(`${serv.cidadePrestacao || prestCity} / ${serv.ufPrestacao || prestUf} / -`, margin + 145, y + 6.5);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(30, 30, 30);
        doc.text(splitXTribNac, margin + 2, y + 10.5);

        let descStartY = y + 10.5 + (splitXTribNac.length * 3.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
        doc.text('Descrição do Serviço', margin + 2, descStartY);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text(splitDesc, margin + 2, descStartY + 3.5);

        y += servBoxHeight;

        // 7. TRIBUTAÇÃO MUNICIPAL (ISSQN)
        drawHeaderBox(margin, y, pageWidth, 4.5, 'TRIBUTAÇÃO MUNICIPAL (ISSQN)');
        y += 4.5;
        drawBox(margin, y, pageWidth, 12, [255, 255, 255], [0, 0, 0]);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(0, 0, 0);
        doc.text('Tipo de Tributação do ISSQN', margin + 2, y + 3.2);
        doc.text('Município / Sigla UF / País de Incidência do ISSQN', margin + 65, y + 3.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text('Operação Tributável', margin + 2, y + 6.5);
        doc.text(`${serv.cidadePrestacao || prestCity} / ${serv.ufPrestacao || prestUf} / -`, margin + 65, y + 6.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8);
        doc.text('BC ISSQN', margin + 2, y + 9.8);
        doc.text('Alíquota Aplicada', margin + 45, y + 9.8);
        doc.text('Retenção do ISSQN', margin + 95, y + 9.8);
        doc.text('ISSQN Apurado', margin + 145, y + 9.8);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text('-', margin + 2, y + 11.5);
        doc.text('-', margin + 45, y + 11.5);
        doc.text('Não Retido', margin + 95, y + 11.5);
        doc.text('-', margin + 145, y + 11.5);

        y += 12;

        // 8. TRIBUTAÇÃO FEDERAL (EXCETO CBS)
        drawHeaderBox(margin, y, pageWidth, 4.5, 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)');
        y += 4.5;
        drawBox(margin, y, pageWidth, 12, [255, 255, 255], [0, 0, 0]);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(0, 0, 0);
        doc.text('IRRF', margin + 2, y + 3.2);
        doc.text('Contribuição Previdenciária - Retida', margin + 45, y + 3.2);
        doc.text('Contribuições Sociais - Retidas', margin + 125, y + 3.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text('-', margin + 2, y + 6.5);
        doc.text('-', margin + 45, y + 6.5);
        doc.text('-', margin + 125, y + 6.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8);
        doc.text('PIS - Débito Apuração Própria', margin + 2, y + 9.8);
        doc.text('COFINS - Débito Apuração Própria', margin + 45, y + 9.8);
        doc.text('Descrição Contrib. Sociais - Retidas', margin + 125, y + 9.8);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text('-', margin + 2, y + 11.5);
        doc.text('-', margin + 45, y + 11.5);
        doc.text('-', margin + 125, y + 11.5);

        y += 12;

        // 9. TRIBUTAÇÃO IBS/CBS
        drawHeaderBox(margin, y, pageWidth, 4.5, 'TRIBUTAÇÃO IBS/CBS');
        y += 4.5;
        drawBox(margin, y, pageWidth, 30, [255, 255, 255], [0, 0, 0]);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(0, 0, 0);
        doc.text('CST / cClassTrib', margin + 2, y + 3.2);
        doc.text('Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', margin + 65, y + 3.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.text('000 / 000001', margin + 2, y + 6.5);
        const incIbge = tomaIbgeVal || '4125506';
        const incCity = tomaCityName !== '-' ? tomaCityName : 'São José dos Pinhais';
        const incUf = tomaUfCode || 'PR';
        doc.text(`100101 / ${incIbge} / ${incCity} / ${incUf}`, margin + 65, y + 6.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
        doc.text('Exclusões e Reduções da Base de Cálculo', margin + 2, y + 10.2);
        doc.text('Base de Cálculo Após Exclusões e Reduções', margin + 55, y + 10.2);
        doc.text('Red. Alíquota IBS / Red. Alíquota CBS', margin + 110, y + 10.2);
        doc.text('Alíquota - IBS UF / IBS Mun', margin + 155, y + 10.2);

        const amountVal = parseFloat(String(serv.valor || data.valorTotal || data.amount || 0.09));
        const valIbsEstadual = amountVal * 0.0010; // 0,10%
        const valCbs = amountVal * 0.0090; // 0,90%
        const totalIbsCbs = valIbsEstadual + valCbs; // 1,00%

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        doc.text(formatCurrency(0), margin + 2, y + 13.7);
        doc.text(formatCurrency(amountVal), margin + 55, y + 13.7);
        doc.text('- / - / -', margin + 110, y + 13.7);
        doc.text('0,10 % / 0,00 %', margin + 155, y + 13.7);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
        doc.text('Aliq. Efetiva Municipal - IBS', margin + 2, y + 17.4);
        doc.text('Valor Apurado Municipal - IBS', margin + 55, y + 17.4);
        doc.text('Aliq. Efetiva Estadual - IBS', margin + 110, y + 17.4);
        doc.text('Valor Apurado Estadual - IBS', margin + 155, y + 17.4);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        doc.text('0,00 %', margin + 2, y + 20.9);
        doc.text(formatCurrency(0), margin + 55, y + 20.9);
        doc.text('0,10 %', margin + 110, y + 20.9);
        doc.text(formatCurrency(valIbsEstadual), margin + 155, y + 20.9);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
        doc.text('Valor Total Apurado - IBS', margin + 2, y + 24.6);
        doc.text('Aliquota - CBS', margin + 55, y + 24.6);
        doc.text('Aliquota Efetiva - CBS', margin + 110, y + 24.6);
        doc.text('Valor Total Apurado - CBS', margin + 155, y + 24.6);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        doc.text(formatCurrency(valIbsEstadual), margin + 2, y + 28.1);
        doc.text('0,90 %', margin + 55, y + 28.1);
        doc.text('0,90 %', margin + 110, y + 28.1);
        doc.text(formatCurrency(valCbs), margin + 155, y + 28.1);

        y += 30;

        // 10. VALOR TOTAL DA NFS-e
        drawHeaderBox(margin, y, pageWidth, 4.5, 'VALOR TOTAL DA NFS-e');
        y += 4.5;
        drawBox(margin, y, pageWidth, 16, [255, 255, 255], [0, 0, 0]);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0, 0, 0);
        doc.text('VALOR TOTAL DA NFS-e', margin + 2, y + 3.5);
        doc.text('VALOR DA OPERAÇÃO / SERVIÇO', margin + 55, y + 3.5);
        doc.text('Desconto Incondicionado', margin + 110, y + 3.5);
        doc.text('Desconto Condicionado', margin + 155, y + 3.5);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.text(formatCurrency(amountVal), margin + 2, y + 7.2);
        doc.setFont('helvetica', 'normal');
        doc.text(formatCurrency(amountVal), margin + 55, y + 7.2);
        doc.text('-', margin + 110, y + 7.2);
        doc.text('-', margin + 155, y + 7.2);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
        doc.text('Total das Retenções (ISSQN / Federais)', margin + 2, y + 11.2);
        doc.text('VALOR LÍQUIDO DA NFS-e', margin + 55, y + 11.2);
        doc.text('Total do IBS/CBS', margin + 110, y + 11.2);
        doc.text('VALOR LÍQUIDO DA NFS-e + IBS/CBS', margin + 150, y + 11.2);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.text('-', margin + 2, y + 14.8);
        doc.text(formatCurrency(amountVal), margin + 55, y + 14.8);
        doc.setFont('helvetica', 'normal'); doc.text(formatCurrency(totalIbsCbs), margin + 110, y + 14.8);
        doc.setFont('helvetica', 'bold'); doc.text(formatCurrency(amountVal), margin + 150, y + 14.8);

        y += 16;

        // 11. INFORMAÇÕES COMPLEMENTARES
        drawHeaderBox(margin, y, pageWidth, 4.5, 'INFORMAÇÕES COMPLEMENTARES');
        y += 4.5;
        
        const customInfComp = data.infComp || data.informacoesComplementares || '';
        const baseInfComp = `Inf. Cont.: NBS: ${formatNbs(serv.nbs || serv.cNbs || '115013000')}\nTotais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: -; Estaduais: -; Municipais: -;`;
        const fullInfCompText = customInfComp ? `${baseInfComp}\n${customInfComp.replace(/\|/g, '\n')}` : baseInfComp;
        const splitInfComp = doc.splitTextToSize(fullInfCompText, pageWidth - 4);
        
        const infCompBoxHeight = Math.max(16, 4 + (splitInfComp.length * 3.5));
        drawBox(margin, y, pageWidth, infCompBoxHeight, [255, 255, 255], [0, 0, 0]);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
        doc.text(splitInfComp, margin + 2, y + 4);

        // 12. FOOTER RECEIPT STUB (AT BOTTOM OF PAGE)
        const footerY = 274;
        drawBox(margin, footerY, pageWidth, 13, [255, 255, 255], [0, 0, 0]);
        const footW1 = 55;
        const footW2 = 70;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0, 0, 0);
        doc.text('DATA CIENTIFICAÇÃO:', margin + 2, footerY + 3.5);
        doc.text('IDENTIFICAÇÃO E ASSINATURA', margin + footW1 + 2, footerY + 3.5);
        doc.text('Nº NFS-e / CHAVE NFS-e', margin + footW1 + footW2 + 2, footerY + 3.5);

        doc.setFont('courier', 'bold'); doc.setFontSize(4.8);
        doc.text(`${nNfseVal} / ${chave}`, margin + footW1 + footW2 + 2, footerY + 8.5);

        return doc.output('blob');
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

