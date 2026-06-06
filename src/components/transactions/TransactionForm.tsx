/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Receipt, TrendingUp, Paperclip, Repeat, Plus, Search, Eye, EyeOff, Trash2, FileText, Copy, Pencil, Check, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';
import { CategoryForm } from '../categories/CategoryForm';
import { ContactForm } from '../contacts/ContactForm';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Modal } from '../ui/Modal';
import type { Transaction, TransactionType } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useCompanies } from '../../hooks/useCompanies';
import { useContacts } from '../../hooks/useContacts';
import { useEntity } from '../../context/EntityContext';
import { useAutoSave } from '../../hooks/useAutoSave';


import { supabase } from '../../lib/supabase';
import { storageService } from '../../lib/storageService';
import { calculateNextDates, formatBrazilianDate, formatDateString } from '../../utils/dateUtils';
import { useNotification } from '../../context/NotificationContext';
import { formatBRL, parseBRL } from '../../utils/currencyUtils';
interface TransactionFormProps {
    type: TransactionType;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Partial<Transaction> | null;
}

export function TransactionForm({ type, isOpen, onClose, onSubmit, initialData }: TransactionFormProps) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [status, setStatus] = useState('pending');
    const [categoryId, setCategoryId] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [contactId, setContactId] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [isVariableAmount, setIsVariableAmount] = useState(false);
    const [frequency, setFrequency] = useState('monthly');
    const [recurringCount, setRecurringCount] = useState(12);
    const [file, setFile] = useState<File | null>(null);
    const [dealId, setDealId] = useState('');
    const [notes, setNotes] = useState('');
    const [barcode, setBarcode] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [overrides, setOverrides] = useState<Record<number, { amount?: number; date?: string }>>({});
    const [exclusions, setExclusions] = useState<number[]>([]);
    const [editingInstallment, setEditingInstallment] = useState<number | null>(null);
    const [tempOverrideAmount, setTempOverrideAmount] = useState('');
    const [tempOverrideDate, setTempOverrideDate] = useState('');
    const [removedAttachment, setRemovedAttachment] = useState(false);
    const [showEmbeddedPreview, setShowEmbeddedPreview] = useState(false);
    const [tempAttachmentUrl, setTempAttachmentUrl] = useState('');
    const [tempAttachmentPath, setTempAttachmentPath] = useState('');
    const [tempAttachmentName, setTempAttachmentName] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<{
        description?: string;
        amount?: string;
        date?: string;
        barcode?: string;
    } | null>(null);
    const [pdfPasswordRequired, setPdfPasswordRequired] = useState(false);
    const [pdfFilePendingPassword, setPdfFilePendingPassword] = useState<File | null>(null);
    const [pdfPassword, setPdfPassword] = useState('');
    const [decryptedPdfPages, setDecryptedPdfPages] = useState<string[]>([]);
    const [saveFile, setSaveFile] = useState(false); // Desligado por padrão: só lê, não salva

    // Optimized memory for local file preview
    const fileUrl = useMemo(() => {
        if (!file) return null;
        try {
            return URL.createObjectURL(file);
        } catch (e) {
            console.debug(e);
            return null;
        }
    }, [file]);

    const [propagateChanges] = useState(() => localStorage.getItem('propagatePref') === 'true');
    const [dbInstallments, setDbInstallments] = useState<Record<number, { amount: number; date: string }>>({});

    const { categories, addCategory } = useCategories();
    const { companies } = useCompanies();
    const { contacts, addContact } = useContacts();
    const { currentEntity } = useEntity();

    const { notify } = useNotification();

    // Quick-add modal states
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);
    const [showNotesModal, setShowNotesModal] = useState(false);

    // Load saved company preference for this transaction type
    useEffect(() => {
        // Reset all recurrence overrides, exclusions and pending states to prevent leaks
        setExclusions([]);
        setOverrides({});
        setEditingInstallment(null);
        setTempOverrideAmount('');
        setTempOverrideDate('');
        setAiSuggestions(null);
        setPdfPasswordRequired(false);
        setPdfFilePendingPassword(null);
        setPdfPassword('');
        setDecryptedPdfPages([]);
        setSaveFile(false);

        if (initialData) {
            setDescription(initialData.description || '');
            setAmount(initialData.amount ? formatBRL(initialData.amount) : '');
            setDate(initialData.date || new Date().toISOString().split('T')[0]);
            setStatus(initialData.status || 'pending');
            setCategoryId(initialData.category_id || '');
            setCompanyId(initialData.company_id || '');
            setContactId(initialData.contact_id || '');
            setIsRecurring(!!initialData.recurrence_group_id);
            setIsVariableAmount((initialData as any).is_variable_amount || false);
            setFrequency(initialData.frequency || 'monthly');
            setRecurringCount((initialData as any).recurring_count || 12);
            setDealId(initialData.deal_id || '');
            
            // Extrai o código de barras das notas
            const notesVal = initialData.notes || '';
            const barcodeMarker = notesVal.match(/>+BARCODE_DATA<+([\s\S]*?)>+END_BARCODE<+/);
            const extractedBarcode = barcodeMarker ? barcodeMarker[1].trim() : '';
            setBarcode(extractedBarcode);
            setNotes(notesVal.replace(/>+BARCODE_DATA<+[\s\S]*?>+END_BARCODE<+/g, '').trim());

            setRemovedAttachment(false);
            setFile(null);
            setTempAttachmentUrl('');
            setTempAttachmentPath('');
            setTempAttachmentName('');
        } else {
            // New transaction - prioritize current context, fallback to saved preference
            const savedCompanyId = localStorage.getItem(`lastCompanyId_${type}`) || '';
            const defaultCompanyId = currentEntity.type === 'company' ? currentEntity.id : '';

            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setStatus('pending');
            setCategoryId('');
            setCompanyId(defaultCompanyId || savedCompanyId);
            setContactId('');
            setIsRecurring(false);
            setIsVariableAmount(false);
            setFrequency('monthly');
            setRecurringCount(12);
            setDealId('');
            setNotes('');
            setBarcode('');
            setRemovedAttachment(false);
            setFile(null);
            setTempAttachmentUrl('');
            setTempAttachmentPath('');
            setTempAttachmentName('');
        }
    }, [initialData, isOpen, type]);

    // Global persistence for Transaction Form
    const filteredCompanies = currentEntity.type === 'company'
        ? companies.filter(c => c.id === currentEntity.id)
        : companies;

    const { clearCache } = useAutoSave(
        `transaction_${type}`,
        {
            description, amount, date, status, categoryId, companyId, contactId,
            isRecurring, isVariableAmount, frequency, recurringCount, dealId, notes,
            tempAttachmentUrl, tempAttachmentPath, tempAttachmentName
        },
        {
            description: setDescription, amount: setAmount, date: setDate, status: setStatus,
            categoryId: setCategoryId, companyId: setCompanyId, contactId: setContactId,
            isRecurring: setIsRecurring, isVariableAmount: setIsVariableAmount,
            frequency: setFrequency, recurringCount: setRecurringCount, dealId: setDealId, notes: setNotes,
            tempAttachmentUrl: setTempAttachmentUrl,
            tempAttachmentPath: setTempAttachmentPath,
            tempAttachmentName: setTempAttachmentName
        },
        !initialData, // only for NEW transactions
        isOpen
    );

    const handleClose = () => {
        clearCache();
        onClose();
    };

    // Save preferences
    useEffect(() => {
        if (!initialData && companyId !== undefined) {
            localStorage.setItem(`lastCompanyId_${type}`, companyId);
        }
        localStorage.setItem('propagatePref', propagateChanges.toString());
    }, [companyId, type, initialData, propagateChanges]);

    // Fetch real installment data when editing an existing recurrence
    useEffect(() => {
        if (isOpen && initialData?.recurrence_group_id) {
            const fetchGroupData = async () => {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('installment_number, amount, date')
                    .eq('recurrence_group_id', initialData.recurrence_group_id);

                if (data && !error) {
                    const mapped: Record<number, { amount: number; date: string }> = {};
                    data.forEach(item => {
                        if (item.installment_number) {
                            mapped[item.installment_number] = { amount: item.amount, date: item.date };
                        }
                    });
                    setDbInstallments(mapped);
                }
            };
            fetchGroupData();
        } else if (!isOpen) {
            setDbInstallments({});
        }
    }, [isOpen, initialData]);

    const checkPdfPasswordRequired = async (fileToCheck: File): Promise<boolean> => {
        if (fileToCheck.type !== 'application/pdf' && !fileToCheck.name.toLowerCase().endsWith('.pdf')) {
            return false;
        }
        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
            const arrayBuffer = await fileToCheck.arrayBuffer();
            await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            return false; // Decrypted successfully without password
        } catch (err: any) {
            if (err.name === 'PasswordException' || err.code === 1 || err.message?.toLowerCase().includes('password')) {
                return true; // Password required!
            }
            return false;
        }
    };

    const verifyPdfPassword = async (fileToCheck: File, passwordToCheck: string): Promise<boolean> => {
        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
            const arrayBuffer = await fileToCheck.arrayBuffer();
            await pdfjsLib.getDocument({ data: arrayBuffer, password: passwordToCheck }).promise;
            return true;
        } catch (err: any) {
            return false;
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        if (selectedFile) {
            setIsAnalyzing(true);
            try {
                const needsPassword = await checkPdfPasswordRequired(selectedFile);
                if (needsPassword) {
                    setPdfFilePendingPassword(selectedFile);
                    setPdfPasswordRequired(true);
                    notify('warning', 'Este PDF está protegido por senha. Por favor, insira a senha para descriptografá-lo.', 'Senha Requerida');
                    return;
                }

                // Normal flow if no password required
                setFile(selectedFile);
                setTempAttachmentName(selectedFile.name);
                await analyzeDocument(selectedFile);
            } catch (err) {
                console.error(err);
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const analyzeDocument = async (fileToAnalyze: File, password?: string) => {
        setIsAnalyzing(true);
        try {
            // 1. Upload para storage (somente se saveFile estiver ativado)
            let uploadedPublicUrl = '';

            if (saveFile) {
                const fileExt = fileToAnalyze.name.split('.').pop() || 'tmp';
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const filePath = `attachments/temp/${fileName}`;
                const { publicUrl } = await storageService.upload(fileToAnalyze, 'attachments', filePath);
                uploadedPublicUrl = publicUrl;
                setTempAttachmentUrl(publicUrl);
                setTempAttachmentPath(filePath);
            }

            let extractedText = '';
            let pdfFirstPageImageBase64: string | null = null;
            const renderedPages: string[] = [];

            // 2. OCR Analysis
            try {
                if (fileToAnalyze.type === 'application/pdf' || fileToAnalyze.name.toLowerCase().endsWith('.pdf')) {
                    const pdfjsLib = await import('pdfjs-dist');
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

                    const arrayBuffer = await fileToAnalyze.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise;

                    const QrScanner = (await import('qr-scanner')).default;
                    const pagesToRender = Math.min(pdf.numPages, 5);

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const sortedItems = content.items.sort((a: any, b: any) => {
                            if (Math.abs(b.transform[5] - a.transform[5]) > 5) {
                                return b.transform[5] - a.transform[5];
                            }
                            return a.transform[4] - b.transform[4];
                        });

                        const pageText = sortedItems.map((item: any) => item.str).join(' ');
                        extractedText += pageText + '\n';

                        // Render pages to canvases for OCR, QR scanning, and custom viewer
                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement("canvas");
                        const context = canvas.getContext("2d", { willReadFrequently: true });
                        if (context) {
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            context.imageSmoothingEnabled = false;
                            await (page as any).render({ canvasContext: context, viewport: viewport }).promise;
                            
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            if (i === 1) {
                                pdfFirstPageImageBase64 = dataUrl;
                            }
                            if (i <= pagesToRender) {
                                renderedPages.push(dataUrl);
                            }

                            try {
                                const result = await QrScanner.scanImage(canvas, { returnDetailedScanResult: true });
                                if (result && result.data && result.data.length > 10) {
                                    const foundText = result.data;
                                    if (foundText.includes('000201') && foundText.includes('BR.GOV.BCB.PIX')) {
                                        extractedText += `\n>>>>PIX_DATA<<<<${foundText}>>>>END_PIX<<<<\n`;
                                    } else {
                                        extractedText += `\n>>>>QR_DATA<<<<${foundText}>>>>END_QR<<<<\n`;
                                    }
                                }
                            } catch (decodeErr) { console.debug(decodeErr); }
                        }

                        // --- Barcode / Linha Digitável Detection ---
                        // Strategy: join all text items tightly (no spaces) then scan, 
                        // because PDF text items can be fragmented across tokens.
                        // Also try joining with spaces to catch human-readable linha digitável format.
                        
                        const textJoined = sortedItems.map((item: any) => item.str).join('');
                        const textWithSpaces = sortedItems.map((item: any) => item.str).join(' ');
                        
                        if (!extractedText.includes('>>>>BARCODE_DATA<<<<')) {
                            // Pattern 1: Raw 44-48 digit numeric barcode (no spaces/dots)
                            const rawBarcode = textJoined.match(/\d{44,48}/);
                            if (rawBarcode) {
                                extractedText += `\n>>>>BARCODE_DATA<<<<${rawBarcode[0]}>>>>END_BARCODE<<<<\n`;
                            } else {
                                // Pattern 2: Linha digitável com pontos e espaços
                                // Ex: 00190.00009 02801.872059 90000.963301 1 10100000003677
                                // Ex: 341.9 36307 .76538 3 60460000037700
                                // Normalize: remove spaces, keep digits and dots, then strip non-digits
                                const linhaDigMatch = textWithSpaces.match(
                                    /\d{4,5}[\.\s]\d{5,6}\s+\d{4,6}[\.\s]\d{5,6}\s+\d{4,6}[\.\s]\d{5,6}\s+\d\s+\d{14,15}/
                                );
                                if (linhaDigMatch) {
                                    const cleanCode = linhaDigMatch[0].replace(/[^\d]/g, '');
                                    if (cleanCode.length >= 44 && cleanCode.length <= 48) {
                                        extractedText += `\n>>>>BARCODE_DATA<<<<${cleanCode}>>>>END_BARCODE<<<<\n`;
                                    }
                                } else {
                                    // Pattern 3: Fallback – any continuous sequence of digits, dots, hyphens ≥ 40 chars
                                    const potentialBarcodeMatch = textWithSpaces.match(/[\d][\d\.\-\s]{38,73}[\d]/g);
                                    if (potentialBarcodeMatch) {
                                        for (const possible of potentialBarcodeMatch) {
                                            const clean = possible.replace(/[^\d]/g, '');
                                            if (clean.length >= 44 && clean.length <= 48) {
                                                extractedText += `\n>>>>BARCODE_DATA<<<<${clean}>>>>END_BARCODE<<<<\n`;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }


                        const cleanText = pageText.replace(/\s+/g, '');
                        const textPixMatch = cleanText.match(/000201[a-zA-Z0-9]*?6304[a-fA-F0-9]{4}/i) ||
                            cleanText.match(/https?:\/\/[\w.-]*pix[\s\S]*?qr[\s\S]*?[a-zA-Z0-9]{10,150}/i);
                        if (textPixMatch && !extractedText.includes('>>>>PIX_DATA<<<<')) {
                            extractedText += `\n>>>>PIX_DATA<<<<${textPixMatch[0]}>>>>END_PIX<<<<\n`;
                        }
                    }
                } else if (fileToAnalyze.type.startsWith('image/')) {
                    const QrScanner = (await import('qr-scanner')).default;
                    const objectUrl = URL.createObjectURL(fileToAnalyze);
                    const HTMLImageElement = document.createElement('img');
                    HTMLImageElement.src = objectUrl;
                    await new Promise(resolve => { HTMLImageElement.onload = resolve; HTMLImageElement.onerror = resolve; });
                    try {
                        const result = await QrScanner.scanImage(HTMLImageElement, { returnDetailedScanResult: true });
                        if (result && result.data && result.data.length > 10) {
                            const foundText = result.data;
                            if (foundText.includes('000201') && foundText.includes('BR.GOV.BCB.PIX')) {
                                extractedText += `\n>>>>PIX_DATA<<<<${foundText}>>>>END_PIX<<<<\n`;
                            } else {
                                extractedText += `\n>>>>QR_DATA<<<<${foundText}>>>>END_QR<<<<\n`;
                            }
                        }
                    } catch (decodeErr) { console.debug(decodeErr); }
                    URL.revokeObjectURL(objectUrl);
                }
            } catch (ocrErr) {
                console.warn('OCR error ignored, fallback to IA vision:', ocrErr);
            }

            // Save decrypted pages for custom rendering (so the preview doesn't show browser password prompt)
            setDecryptedPdfPages(renderedPages);

            // 3. IA Processing (Financial Vision)
            const payload: any = { type };
            if (extractedText) {
                payload.text_content = extractedText;
                if (pdfFirstPageImageBase64) payload.image_url = pdfFirstPageImageBase64;
            } else {
                payload.image_url = uploadedPublicUrl || undefined;
            }

            const { data, error: invokeError } = await supabase.functions.invoke('financial-vision', { body: payload });
            if (invokeError) throw new Error(invokeError.message || 'Erro ao chamar função de IA');

            if (data && !data.error) {
                // Resolvendo o código de barras do OCR local ou da IA
                let resolvedBarcode = '';
                if (extractedText) {
                    const localBarcodeMatch = extractedText.match(/>+BARCODE_DATA<+([\s\S]*?)>+END_BARCODE<+/);
                    if (localBarcodeMatch) {
                        resolvedBarcode = localBarcodeMatch[1].trim();
                    }
                }
                if (!resolvedBarcode && data.barcode) {
                    resolvedBarcode = data.barcode.trim();
                }

                // Preenche o campo de código de barras diretamente
                if (resolvedBarcode) {
                    setBarcode(resolvedBarcode);
                }

                if (initialData) {
                    setAiSuggestions({
                        description: data.description || undefined,
                        amount: data.amount ? formatBRL(data.amount) : undefined,
                        date: data.date || undefined,
                        barcode: resolvedBarcode || undefined
                    });
                } else {
                    if (data.description) setDescription(data.description);
                    if (data.amount) setAmount(formatBRL(data.amount));
                    if (data.date) setDate(data.date);
                }
                let finalNotes = data.notes_suggestion || '';
                let paymentBlock = '';
                if (extractedText) {
                    const localPixMatch = extractedText.match(/>+PIX_DATA<+([\s\S]*?)>+END_PIX<+/);
                    if (localPixMatch) paymentBlock += `>>>>PIX_DATA<<<<${localPixMatch[1].trim()}>>>>END_PIX<<<<\n`;
                }
                if (paymentBlock) finalNotes = paymentBlock + "\n" + finalNotes;
                setNotes(prev => prev ? `${prev}\n${finalNotes}` : finalNotes);
                notify('success', 'Documento analisado com sucesso!', 'IA Financeira');
            } else if (data && data.error) throw new Error(data.error);

        } catch (err: any) {
            console.error('Error analyzing document:', err);
            notify('error', err.message || 'Falha ao analisar documento.', 'Erro na IA');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!pdfFilePendingPassword || !pdfPassword) return;
        const fileToAnalyze = pdfFilePendingPassword;
        const password = pdfPassword;

        setIsAnalyzing(true);
        const isCorrect = await verifyPdfPassword(fileToAnalyze, password);
        if (!isCorrect) {
            notify('error', 'Senha incorreta para o PDF. Tente novamente.', 'Erro de Senha');
            setIsAnalyzing(false);
            return;
        }

        // Correct password!
        setPdfPasswordRequired(false);
        setPdfFilePendingPassword(null);
        setPdfPassword('');

        setFile(fileToAnalyze);
        setTempAttachmentName(fileToAnalyze.name);
        await analyzeDocument(fileToAnalyze, password);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!categoryId) {
            notify('error', 'Por favor, selecione uma categoria.', 'Campo Obrigatório');
            setLoading(false);
            return;
        }

        try {
            const cleanedNotes = notes
                .replace(/>+BARCODE_DATA<+[\s\S]*?>+END_BARCODE<+/g, '')
                .trim();
            const finalNotes = barcode.trim()
                ? `>>>>BARCODE_DATA<<<<${barcode.trim()}>>>>END_BARCODE<<<<\n${cleanedNotes}`
                : cleanedNotes;

            let attachmentUrl = removedAttachment ? null : (tempAttachmentUrl || initialData?.attachment_url);
            let attachmentPath = removedAttachment ? null : (tempAttachmentPath || initialData?.attachment_path);

            if (removedAttachment && (initialData?.attachment_path || tempAttachmentPath)) {
                try {
                    const pathToRemove = tempAttachmentPath || initialData?.attachment_path;
                    if (pathToRemove) await supabase.storage.from('attachments').remove([pathToRemove]);
                } catch (err) { console.debug(err); }
            }

            // Se o arquivo foi trocado e ainda não foi upado pela análise (e saveFile está ativado)
            if (file) {
                if (saveFile) {
                    if (!tempAttachmentUrl) {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                        const filePath = `attachments/${fileName}`;

                        const { publicUrl } = await storageService.upload(file, 'attachments', filePath);
                        attachmentUrl = publicUrl;
                        attachmentPath = filePath;
                    }
                } else {
                    // Se o arquivo foi selecionado mas saveFile está desativado, garante que não seja salvo nenhum anexo
                    attachmentUrl = null;
                    attachmentPath = null;
                }
            }

            // Auto-save pending installment edit before submitting
            if (editingInstallment !== null) {
                const idx = editingInstallment;
                setOverrides(prev => ({
                    ...prev,
                    [idx]: {
                        amount: tempOverrideAmount ? parseBRL(tempOverrideAmount) : undefined,
                        date: tempOverrideDate || undefined
                    }
                }));
                // We need to use the value directly for the submission payload 
                // because setOverrides won't reflect in 'overrides' constant within this same tick
                const finalOverrides = {
                    ...overrides,
                    [idx]: {
                        amount: tempOverrideAmount ? parseBRL(tempOverrideAmount) : undefined,
                        date: tempOverrideDate || undefined
                    }
                };

                await onSubmit({
                    description,
                    amount: parseBRL(amount),
                    date,
                    type,
                    status,
                    category_id: categoryId || null,
                    company_id: companyId || null,
                    contact_id: contactId || null,
                    is_recurring: isRecurring,
                    is_variable_amount: isRecurring ? isVariableAmount : false,
                    frequency: isRecurring ? frequency : null,
                    recurring_count: isRecurring ? recurringCount : undefined,
                    attachment_url: attachmentUrl,
                    attachment_path: attachmentPath,
                    deal_id: dealId || null,
                    overrides: Object.keys(finalOverrides).length > 0 ? finalOverrides : undefined,
                    exclusions: exclusions.length > 0 ? exclusions : undefined,
                    propagate: propagateChanges,
                    notes: finalNotes
                });
            } else {
                await onSubmit({
                    description,
                    amount: parseBRL(amount),
                    date,
                    type,
                    status,
                    category_id: categoryId || null,
                    company_id: companyId || null,
                    contact_id: contactId || null,
                    is_recurring: isRecurring,
                    is_variable_amount: isRecurring ? isVariableAmount : false,
                    frequency: isRecurring ? frequency : null,
                    recurring_count: isRecurring ? recurringCount : undefined,
                    attachment_url: attachmentUrl,
                    attachment_path: attachmentPath,
                    deal_id: dealId || null,
                    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
                    exclusions: exclusions.length > 0 ? exclusions : undefined,
                    propagate: propagateChanges,
                    notes: finalNotes
                });
            }
            clearCache();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOverride = (idx: number) => {
        setOverrides(prev => ({
            ...prev,
            [idx]: {
                amount: tempOverrideAmount ? parseBRL(tempOverrideAmount) : undefined,
                date: tempOverrideDate || undefined
            }
        }));
        setEditingInstallment(null);
    };

    const handleStartEditOverride = (idx: number, currentAmount: number, currentDate: string) => {
        setEditingInstallment(idx);
        setTempOverrideAmount(formatBRL(currentAmount));
        setTempOverrideDate(currentDate);
    };

    const handleRemoveOverride = (idx: number) => {
        setOverrides(prev => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
        setEditingInstallment(null);
    };

    const handleToggleExclusion = (idx: number) => {
        setExclusions(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    const isExpense = type === 'expense';
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const handleCategoryCreated = async (data: any) => {
        await addCategory(data);
        setPendingCategoryName(data.name);
        setShowCategoryModal(false);
    };
    const handleContactCreated = async (data: any) => {
        const newContact = await addContact(data);
        if (newContact) setContactId(newContact.id);
        setShowContactModal(false);
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
    useEffect(() => {
        if (pendingCategoryName && categories.length > 0) {
            const match = categories.find(c => c.name === pendingCategoryName && c.type === type);
            if (match) {
                setCategoryId(match.id);
                setPendingCategoryName(null);
            }
        }
    }, [categories, pendingCategoryName, type]);


    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={handleClose}
                title={initialData?.id ? (type === 'expense' ? 'Editar Despesa' : 'Editar Receita') : (type === 'expense' ? 'Nova Despesa' : 'Nova Receita')}
                subtitle={initialData?.id ? 'Atualize os dados deste lançamento financeiro' : `Registre um novo fluxo de ${isExpense ? 'saída' : 'entrada'} no seu caixa`}
                icon={isExpense ? Receipt : TrendingUp}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <Input label="Descrição" value={description} onChange={e => setDescription(e.target.value)} required placeholder="Ex: Aluguel..." />
                        </div>
                        <CurrencyInput 
                            label={`Valor (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})`} 
                            value={parseBRL(amount)} 
                            onChange={num => setAmount(formatBRL(num))}
                            required 
                        />
                        <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria <span className="text-red-500">*</span></label>
                                <button type="button" onClick={() => setShowCategoryModal(true)} className="text-xs text-emerald-600 font-semibold"><Plus className="w-3 h-3 inline mr-1" /> Nova</button>
                            </div>
                            <select className="h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
                                <option value="">Selecione...</option>
                                {categories.filter(c => c.type === type).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                            <select className="h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="pending">Pendente</option>
                                <option value={isExpense ? 'paid' : 'received'}>{isExpense ? 'Confirmado (Pago)' : 'Confirmado (Recebido)'}</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empresa / Conta</label>
                            <select className="h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                                {currentEntity.type !== 'company' && <option value="">Pessoal</option>}
                                {filteredCompanies.map(company => <option key={company.id} value={company.id}>{company.trade_name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{isExpense ? 'Fornecedor' : 'Cliente'}</label>
                                <button type="button" onClick={() => setShowContactModal(true)} className="text-xs text-emerald-600 font-semibold"><Plus className="w-3 h-3 inline mr-1" /> Novo</button>
                            </div>
                            <select className="h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm" value={contactId} onChange={e => setContactId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {contacts.filter(c => c.type === (isExpense ? 'supplier' : 'client')).map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                            </select>
                        </div>

                        {isExpense && (
                            <div className="md:col-span-2">
                                <Input
                                    label="Código de Barras / Linha Digitável"
                                    value={barcode}
                                    onChange={e => setBarcode(e.target.value)}
                                    placeholder="Cole ou digite o código de barras do boleto (apenas números ou formatado)"
                                    preserveCase
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Repeat className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-bold text-gray-900 dark:text-white">Lançamento Recorrente</span>
                            </div>
                            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-5 h-5" />
                        </div>
                        {isRecurring && (
                            <div className="flex flex-col gap-2 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold">Valor Variável?</span>
                                    <input type="checkbox" checked={isVariableAmount} onChange={e => setIsVariableAmount(e.target.checked)} className="w-5 h-5" />
                                </div>
                            </div>
                        )}
                    </div>

                    {isRecurring && (
                        <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold">Frequência</label>
                                    <select className="h-10 rounded-lg border px-3" value={frequency} onChange={e => setFrequency(e.target.value)}>
                                        <option value="weekly">Semanal</option>
                                        <option value="monthly">Mensal</option>
                                        <option value="yearly">Anual</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold">Nº Repetições</label>
                                    <input type="number" min={1} value={recurringCount} onChange={e => setRecurringCount(parseInt(e.target.value) || 1)} className="h-10 rounded-lg border px-3" />
                                </div>
                            </div>
                            {date && (
                                <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
                                    <p className="text-[10px] font-bold uppercase mb-2">Próximas Datas</p>
                                    <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-thin scrollbar-thumb-emerald-200">
                                        {(() => {
                                            const currentNum = initialData?.installment_number || 1;
                                            const remaining = isRecurring ? Math.max(0, recurringCount - currentNum) : 0;
                                            const displayCount = initialData ? remaining : recurringCount - 1;
                                            const finalDisplayCount = Math.max(displayCount, 0);

                                            return calculateNextDates(date, frequency, finalDisplayCount).map((nextDate, index) => {
                                                const installmentIdx = currentNum + index + 1;
                                                const isExcluded = exclusions.includes(installmentIdx);
                                                const currentOverride = overrides[installmentIdx];
                                                const realData = dbInstallments[installmentIdx];
                                                const displayDate = currentOverride?.date || realData?.date || nextDate.toISOString().split('T')[0];
                                                const displayAmount = currentOverride?.amount !== undefined ? currentOverride.amount : (realData?.amount ?? parseBRL(amount || '0'));
                                                const isEditing = editingInstallment === installmentIdx;

                                                return (
                                                    <div key={index} className={`flex-none w-36 p-2 rounded-xl border transition-all ${isEditing ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-100 shadow-md' : isExcluded ? 'bg-red-50/50 border-red-200 opacity-60 grayscale-[0.5]' : 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-slate-700 hover:border-emerald-300'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] font-bold text-emerald-600">#{installmentIdx}</span>
                                                            {!isEditing ? (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditOverride(installmentIdx, displayAmount, displayDate)}
                                                                        className="p-1 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-md text-gray-400 hover:text-emerald-600 transition-colors"
                                                                    >
                                                                        <Pencil size={10} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleExclusion(installmentIdx)}
                                                                        className={`p-1 rounded-md transition-colors ${isExcluded ? 'text-red-600 bg-red-100' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                                                                        title={isExcluded ? 'Restaurar' : 'Excluir'}
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-1">
                                                                    <button type="button" onClick={() => handleSaveOverride(installmentIdx)} className="p-1 bg-emerald-600 text-white rounded-md">
                                                                        <Check size={10} />
                                                                    </button>
                                                                    <button type="button" onClick={() => setEditingInstallment(null)} className="p-1 bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 rounded-md">
                                                                        <X size={10} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                                                                <CurrencyInput
                                                                    value={parseBRL(tempOverrideAmount)}
                                                                    onChange={num => setTempOverrideAmount(formatBRL(num))}
                                                                    className="w-full text-[10px] font-bold p-1 border rounded bg-white dark:bg-slate-900 border-emerald-200"
                                                                    autoFocus
                                                                />
                                                                <input
                                                                    type="date"
                                                                    value={tempOverrideDate}
                                                                    onChange={e => setTempOverrideDate(e.target.value)}
                                                                    className="w-full text-[9px] p-1 border rounded bg-white dark:bg-slate-900 border-emerald-200"
                                                                />
                                                                {(currentOverride || realData) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveOverride(installmentIdx)}
                                                                        className="w-full text-[8px] font-bold text-red-500 hover:underline uppercase pt-1"
                                                                    >
                                                                        Resetar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-xs font-bold mt-0.5 ${isExcluded ? 'text-red-400 line-through' : currentOverride ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                                                    {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(displayAmount)}
                                                                </span>
                                                                <span className={`text-[10px] text-gray-500 ${isExcluded ? 'text-red-300' : currentOverride ? 'text-blue-500' : ''}`}>
                                                                    {formatBrazilianDate(new Date(displayDate + 'T12:00:00'))}
                                                                </span>
                                                                {isExcluded ? (
                                                                    <span className="text-[8px] font-bold text-red-500 uppercase mt-1">Excluído</span>
                                                                ) : currentOverride ? (
                                                                    <span className="text-[8px] font-bold text-blue-500 uppercase mt-1">Editado</span>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="text-sm font-medium flex items-center gap-2"><Paperclip className="w-4 h-4" /> Anexo / Comprovante</label>
                        <div className="flex flex-col gap-1.5 mb-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase flex justify-between items-center w-full">
                                <span>Observação</span>
                                {notes.length > 0 && <button type="button" onClick={() => setShowNotesModal(true)} className="text-emerald-600 font-bold text-[10px]"><Search className="w-3 h-3 inline mr-1" /> LUPA</button>}
                            </label>
                            <textarea className="flex min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informações importantes sobre este lançamento..." />
                            {(() => {
                                const pixMarker = notes.match(/>+PIX_DATA<+([\s\S]*?)>+END_PIX<+/);
                                const pixCode = pixMarker ? pixMarker[1].trim() : null;
                                const barcodeCode = barcode.trim() || null;
                                if (!pixCode && !barcodeCode) return null;
                                return (
                                    <div className="mt-2 p-4 bg-white dark:bg-slate-800 border border-emerald-500/30 rounded-2xl flex flex-col gap-8 shadow-lg shadow-emerald-500/5 overflow-hidden animate-in zoom-in-95 duration-300">
                                        {pixCode && (
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Pagamento Instantâneo PIX</p>
                                                </div>
                                                <div className="p-3 bg-white rounded-2xl shadow-inner border border-emerald-100 dark:border-slate-700 mb-4 ring-8 ring-emerald-50 dark:ring-emerald-900/10">
                                                    <QRCode value={pixCode} size={160} />
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="md"
                                                    className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 py-3 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(pixCode); notify('success', 'Chave PIX copiada!'); }}
                                                >
                                                    <Copy size={16} />
                                                    COPIAR CHAVE PIX
                                                </Button>
                                            </div>
                                        )}
                                        {barcodeCode && (
                                            <div className="flex flex-col items-center pt-8 border-t border-gray-100 dark:border-slate-700">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                    <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Boleto Bancário</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-xl shadow-inner border border-blue-50 dark:border-slate-700 mb-4 w-full overflow-hidden flex justify-center ring-4 ring-blue-50 dark:ring-blue-900/10">
                                                    <Barcode value={barcodeCode} width={1.8} height={50} displayValue={false} />
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="md"
                                                    className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 py-3 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(barcodeCode); notify('success', 'Código de barras copiado!'); }}
                                                >
                                                    <Copy size={16} />
                                                    COPIAR CÓDIGO DO BOLETO
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {aiSuggestions && (
                            (() => {
                                const hasDiff = 
                                    (aiSuggestions.description && aiSuggestions.description !== description) ||
                                    (aiSuggestions.amount && aiSuggestions.amount !== amount) ||
                                    (aiSuggestions.date && aiSuggestions.date !== date) ||
                                    (aiSuggestions.barcode && aiSuggestions.barcode !== barcode);
                                
                                if (!hasDiff) return null;
 
                                return (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-2 text-xs mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <p className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                                            <span>💡 IA detectou novos dados no anexo:</span>
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[10px]">
                                            {aiSuggestions.description && aiSuggestions.description !== description && (
                                                <div>
                                                    <span className="font-semibold block text-gray-500">Descrição:</span>
                                                    <span className="line-through text-red-500 block">{description || '(vazio)'}</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block">{aiSuggestions.description}</span>
                                                </div>
                                            )}
                                            {aiSuggestions.amount && aiSuggestions.amount !== amount && (
                                                <div>
                                                    <span className="font-semibold block text-gray-500">Valor:</span>
                                                    <span className="line-through text-red-500 block">{amount || '(vazio)'}</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block">{aiSuggestions.amount}</span>
                                                </div>
                                            )}
                                            {aiSuggestions.date && aiSuggestions.date !== date && (
                                                <div>
                                                    <span className="font-semibold block text-gray-500">Vencimento:</span>
                                                    <span className="line-through text-red-500 block">{formatDateString(date)}</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block">{formatDateString(aiSuggestions.date)}</span>
                                                </div>
                                            )}
                                        </div>
                                        {aiSuggestions.barcode && aiSuggestions.barcode !== barcode && (
                                            <div className="text-[10px] pt-1.5 border-t border-blue-200/50 dark:border-blue-900/20">
                                                <span className="font-semibold block text-gray-500">Código de Barras:</span>
                                                <span className="line-through text-red-500 block truncate">{barcode || '(vazio)'}</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold block truncate">{aiSuggestions.barcode}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2 justify-end pt-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="text-[10px] text-gray-500 hover:text-gray-700 h-7"
                                                onClick={() => setAiSuggestions(null)}
                                            >
                                                Ignorar
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-7 px-3 rounded-lg border-none"
                                                onClick={() => {
                                                    if (aiSuggestions.description) setDescription(aiSuggestions.description);
                                                    if (aiSuggestions.amount) setAmount(aiSuggestions.amount);
                                                    if (aiSuggestions.date) setDate(aiSuggestions.date);
                                                    if (aiSuggestions.barcode) setBarcode(aiSuggestions.barcode);
                                                    setAiSuggestions(null);
                                                    notify('success', 'Dados da IA aplicados!');
                                                }}
                                            >
                                                Aplicar Sugestões
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()
                        )}

                        {(file || tempAttachmentUrl || (initialData?.attachment_url && !removedAttachment)) && (
                            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border mb-3">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-[10px] font-bold uppercase">Anexo / Comprovante</p>
                                    {isAnalyzing && <div className="text-[10px] text-emerald-600 font-bold animate-pulse">ANALISANDO...</div>}
                                </div>
                                {(file || tempAttachmentUrl) ? (
                                    <div className="flex flex-col gap-2">
                                        {/* Nome do arquivo */}
                                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 w-full shadow-sm">
                                            <FileText size={16} className="text-emerald-500 shrink-0" />
                                            <p className="text-xs font-bold truncate flex-1 text-gray-700 dark:text-gray-300">{file?.name || tempAttachmentName}</p>
                                        </div>
                                        {/* Botões de ação */}
                                        <div className="grid grid-cols-2 gap-2 w-full">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-[11px] font-bold h-9 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                onClick={() => setShowEmbeddedPreview(!showEmbeddedPreview)}
                                            >
                                                {showEmbeddedPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                                                {showEmbeddedPreview ? 'Fechar' : 'Visualizar'}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="text-[11px] font-bold h-9 bg-red-500 hover:bg-red-600 text-white border-none shadow-md shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                onClick={async () => {
                                                    if (tempAttachmentPath) {
                                                        try { await supabase.storage.from('attachments').remove([tempAttachmentPath]); } catch(e) { console.debug(e); }
                                                    }
                                                    setFile(null);
                                                    setTempAttachmentUrl('');
                                                    setTempAttachmentPath('');
                                                    setTempAttachmentName('');
                                                    setNotes('');
                                                    setBarcode('');
                                                    setDecryptedPdfPages([]);
                                                    setShowEmbeddedPreview(false);
                                                }}
                                            >
                                                <Trash2 size={13} />
                                                Remover Arquivo
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {/* Documento salvo na nuvem */}
                                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 w-full shadow-sm">
                                            <Paperclip size={16} className="text-blue-500 shrink-0" />
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 flex-1">Documento Vinculado</p>
                                        </div>
                                        {/* Botões de ação */}
                                        <div className="grid grid-cols-2 gap-2 w-full">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-[11px] font-bold h-9 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                onClick={() => setShowEmbeddedPreview(!showEmbeddedPreview)}
                                            >
                                                {showEmbeddedPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                                                {showEmbeddedPreview ? 'Fechar' : 'Visualizar'}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="text-[11px] font-bold h-9 bg-red-500 hover:bg-red-600 text-white border-none shadow-md shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                onClick={async () => {
                                                    const pathToDelete = initialData?.attachment_path;
                                                    if (pathToDelete) {
                                                        try { await supabase.storage.from('attachments').remove([pathToDelete]); } catch(e) { console.debug(e); }
                                                    }
                                                    setRemovedAttachment(true);
                                                    setNotes('');
                                                    setBarcode('');
                                                    setDecryptedPdfPages([]);
                                                    setShowEmbeddedPreview(false);
                                                }}
                                            >
                                                <Trash2 size={13} />
                                                Excluir Arquivo
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {showEmbeddedPreview && (fileUrl || tempAttachmentUrl || initialData?.attachment_url) && (
                                    <div className="mt-4 border-t pt-4 animate-in fade-in zoom-in duration-300">
                                        <div className="relative w-full min-h-[300px] max-h-[60vh] overflow-y-auto bg-gray-100 dark:bg-slate-900 rounded-lg p-3 border scrollbar-thin">
                                            {decryptedPdfPages.length > 0 ? (
                                                <div className="flex flex-col gap-3">
                                                    {decryptedPdfPages.map((pageImg, idx) => (
                                                        <div key={idx} className="relative w-full bg-white dark:bg-slate-800 rounded-lg shadow border overflow-hidden">
                                                            <img
                                                                src={pageImg}
                                                                alt={`Página ${idx + 1}`}
                                                                className="w-full h-auto object-contain"
                                                            />
                                                            <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full select-none">
                                                                Pág. {idx + 1} de {decryptedPdfPages.length}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (file?.type === 'application/pdf' || (tempAttachmentUrl?.toLowerCase().includes('.pdf')) || (initialData?.attachment_url?.toLowerCase().includes('.pdf'))) ? (
                                                <iframe
                                                    src={`${fileUrl || tempAttachmentUrl || initialData?.attachment_url}#toolbar=0&navpanes=0`}
                                                    className="w-full h-full min-h-[400px] border-none"
                                                    title="Document Preview"
                                                />
                                            ) : (
                                                <img
                                                    src={fileUrl || tempAttachmentUrl || initialData?.attachment_url}
                                                    alt="Preview"
                                                    className="w-full h-full object-contain"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Toggle: Salvar arquivo */}
                        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-slate-800/60 border border-dashed rounded-xl mb-1">
                            <div className="flex items-center gap-2">
                                <label htmlFor="save-file-toggle" className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                    💾 Salvar arquivo no sistema
                                </label>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">(só leitura por padrão)</span>
                            </div>
                            <button
                                id="save-file-toggle"
                                type="button"
                                role="switch"
                                aria-checked={saveFile}
                                onClick={() => setSaveFile(prev => !prev)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                    saveFile ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                                    saveFile ? 'translate-x-4' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-2">
                                    <p className="text-xs text-gray-500"><span className="font-semibold">Clique para ler com IA</span></p>
                                    <p className="text-[10px] text-gray-400 font-bold">
                                        {saveFile ? '📎 Arquivo será salvo' : '🔍 Apenas leitura — não salva'} · PDF, PNG, JPG (5MB)
                                    </p>
                                </div>
                                <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.webp" />
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <Button type="button" variant="outline" onClick={handleClose} className="px-6 h-9 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95">Cancelar</Button>
                        <Button
                            type="submit"
                            isLoading={loading}
                            className="bg-emerald-600 hover:bg-emerald-700 px-6 h-9 text-sm text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all hover:scale-[1.02] active:scale-95 border-none font-bold"
                        >
                            {initialData?.id ? 'Salvar Alterações' : 'Processar Lançamento'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <CategoryForm isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSubmit={handleCategoryCreated} />
            <ContactForm isOpen={showContactModal} onClose={() => setShowContactModal(false)} onSubmit={handleContactCreated} />
            <Modal isOpen={showNotesModal} onClose={() => setShowNotesModal(false)} title="Observação Completa" icon={Search}>
                <div className="p-4">
                    <textarea readOnly className="w-full h-[60vh] rounded-lg border p-4 text-sm font-mono" value={notes} />
                    <div className="flex justify-end mt-4">
                        <Button type="button" onClick={() => setShowNotesModal(false)} className="px-6">Fechar</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Senha do PDF */}
            <Modal
                isOpen={pdfPasswordRequired}
                onClose={() => {
                    setPdfPasswordRequired(false);
                    setPdfFilePendingPassword(null);
                    setPdfPassword('');
                }}
                title="PDF Protegido por Senha"
                subtitle="Este arquivo está criptografado. Digite a senha para que a IA possa ler e preencher os dados."
                icon={Paperclip}
                maxWidth="max-w-md"
            >
                <div className="flex flex-col gap-4 p-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Senha do PDF</label>
                        <input
                            type="password"
                            value={pdfPassword}
                            onChange={(e) => setPdfPassword(e.target.value)}
                            placeholder="Digite a senha do documento"
                            className="h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-700 text-gray-800 dark:text-gray-100"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handlePasswordSubmit();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setPdfPasswordRequired(false);
                                setPdfFilePendingPassword(null);
                                setPdfPassword('');
                            }}
                            className="px-4 h-9 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handlePasswordSubmit}
                            className="bg-emerald-600 hover:bg-emerald-700 px-4 h-9 text-xs text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all hover:scale-[1.02] active:scale-95 border-none font-bold"
                        >
                            Descriptografar
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
