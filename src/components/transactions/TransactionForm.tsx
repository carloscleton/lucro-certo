import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Receipt, TrendingUp, Paperclip, Repeat, Plus } from 'lucide-react';
import { CategoryForm } from '../categories/CategoryForm';
import { ContactForm } from '../contacts/ContactForm';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import type { Transaction, TransactionType } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useCompanies } from '../../hooks/useCompanies';
import { useContacts } from '../../hooks/useContacts';
import { useCRM } from '../../hooks/useCRM';
import { useEntity } from '../../context/EntityContext';
import { supabase } from '../../lib/supabase';
import { calculateNextDates, formatBrazilianDate } from '../../utils/dateUtils';
import { useNotification } from '../../context/NotificationContext';

interface TransactionFormProps {
    type: TransactionType;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Transaction | null;
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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [overrides, setOverrides] = useState<Record<number, { amount?: number; date?: string }>>({});
    const [editingInstallment, setEditingInstallment] = useState<number | null>(null);
    const [propagateChanges, setPropagateChanges] = useState(() => localStorage.getItem('propagatePref') === 'true');
    const [dbInstallments, setDbInstallments] = useState<Record<number, { amount: number; date: string }>>({});

    const { categories, addCategory } = useCategories();
    const { companies } = useCompanies();
    const { contacts, addContact } = useContacts();
    const { deals } = useCRM();
    const { currentEntity } = useEntity();
    const { notify } = useNotification();

    // Quick-add modal states
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);

    const isCRMEnabled = currentEntity.type === 'company' &&
        companies.find(c => c.id === currentEntity.id)?.crm_module_enabled;

    // Load saved company preference for this transaction type
    useEffect(() => {
        if (initialData) {
            setDescription(initialData.description || '');
            setAmount(initialData.amount ? initialData.amount.toString() : '');
            setDate(initialData.date || new Date().toISOString().split('T')[0]);
            setStatus(initialData.status);
            setCategoryId(initialData.category_id || '');
            setCompanyId(initialData.company_id || '');
            setContactId(initialData.contact_id || '');
            setIsRecurring(!!initialData.recurrence_group_id);
            setIsVariableAmount((initialData as any).is_variable_amount || false);
            setFrequency(initialData.frequency || 'monthly');
            setRecurringCount((initialData as any).recurring_count || 12);
            setDealId(initialData.deal_id || '');
            setNotes(initialData.notes || '');
        } else {
            // New transaction - load saved preference
            const savedCompanyId = localStorage.getItem(`lastCompanyId_${type}`) || '';

            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setStatus('pending');
            setCategoryId('');
            setCompanyId(savedCompanyId);
            setContactId('');
            setIsRecurring(false);
            setIsVariableAmount(false);
            setFrequency('monthly');
            setRecurringCount(12);
            setDealId('');
            setNotes('');
            setOverrides({});
            setEditingInstallment(null);
        }
    }, [initialData, isOpen, type]);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        setFile(selectedFile);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0] || null;
        if (droppedFile) setFile(droppedFile);
    };

    const analyzeDocument = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        try {
            // First, upload to a temporary location to get a URL for the IA
            const fileExt = file.name.split('.').pop();
            const fileName = `temp_${Math.random()}.${fileExt}`;
            const filePath = `analysis/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);
            const publicUrl = urlData.publicUrl;

            // Call the vision function
            const { data } = await supabase.functions.invoke('financial-vision', {
                body: { image_url: publicUrl, type }
            });

            if (data) {
                if (data.description) setDescription(data.description);
                if (data.amount) setAmount(data.amount.toString());
                if (data.date) setDate(data.date);
                if (data.notes_suggestion) setNotes(prev => prev ? `${prev}\n${data.notes_suggestion}` : data.notes_suggestion);

                notify('success', 'Documento analisado com sucesso!', 'IA Financeira');
            }

            // Clean up temp file (optional, but good practice)
            await supabase.storage.from('attachments').remove([filePath]);

        } catch (err: any) {
            console.error('Error analyzing document:', err);
            notify('error', 'Falha ao analisar documento.', 'Erro');
        } finally {
            setIsAnalyzing(false);
        }
    };


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let attachmentUrl = initialData?.attachment_url;
            let attachmentPath = initialData?.attachment_path;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
                attachmentUrl = data.publicUrl;
                attachmentPath = filePath;
            }

            await onSubmit({
                description,
                amount: parseFloat(amount),
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
                propagate: propagateChanges,
                notes: notes
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const isExpense = type === 'expense';

    // Chamado pelo CategoryForm após salvar — auto-seleciona a categoria criada
    const handleCategoryCreated = async (data: any) => {
        await addCategory(data);
        setPendingCategoryName(data.name);
        setShowCategoryModal(false);
    };

    // Chamado pelo ContactForm após salvar — auto-seleciona o contato criado
    const handleContactCreated = async (data: any) => {
        const newContact = await addContact(data);
        if (newContact) setContactId(newContact.id);
        setShowContactModal(false);
    };

    // Auto-select newly created category after the list refreshes
    useEffect(() => {
        if (pendingCategoryName && categories.length > 0) {
            const match = categories.find(c => c.name === pendingCategoryName && c.type === type);
            if (match) {
                setCategoryId(match.id);
                setPendingCategoryName(null);
            }
        }
    }, [categories, pendingCategoryName]);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={initialData ? (isExpense ? 'Editar Despesa' : 'Editar Receita') : (isExpense ? 'Nova Despesa' : 'Nova Receita')}
                subtitle={initialData ? 'Atualize os dados deste lançamento financeiro' : `Registre um novo fluxo de ${isExpense ? 'saída' : 'entrada'} no seu caixa`}
                icon={isExpense ? Receipt : TrendingUp}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <Input
                                label="Descrição"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                required
                                placeholder="Ex: Aluguel, Venda de Produto..."
                            />
                        </div>

                        <Input
                            label="Valor (R$)"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            required
                            placeholder="0,00"
                        />

                        <Input
                            label="Data do Lançamento"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                        />

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryModal(true)}
                                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Nova
                                </button>
                            </div>
                            <select
                                className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                                required
                            >
                                <option value="">Selecione uma categoria</option>
                                {categories
                                    .filter(c => c.type === type)
                                    .map(category => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))
                                }
                                {initialData?.category_id && !categories.some(c => c.id === initialData.category_id) && (
                                    <option key={`fallback-${initialData.category_id}`} value={initialData.category_id}>
                                        {(initialData as any).category?.name || 'Categoria Original'} (Outro Perfil)
                                    </option>
                                )}
                            </select>
                            {categories.filter(c => c.type === type).length === 0 && !initialData?.category_id && (
                                <p className="text-[10px] text-red-500 font-medium">Cadastre categorias de {isExpense ? 'Despesa' : 'Receita'} primeiro.</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de Pagamento / Status</label>
                            <select
                                className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                            >
                                <option value="pending">Pendente (Não concialiado)</option>
                                <option value={isExpense ? 'paid' : 'received'}>
                                    {isExpense ? 'Confirmado (Pago)' : 'Confirmado (Recebido)'}
                                </option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empresa / Conta</label>
                            <select
                                className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                                value={companyId}
                                onChange={e => setCompanyId(e.target.value)}
                            >
                                <option value="">Pessoal (Individual)</option>
                                {companies.map(company => (
                                    <option key={company.id} value={company.id}>
                                        {company.trade_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {isExpense ? 'Fornecedor' : 'Cliente'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowContactModal(true)}
                                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Novo
                                </button>
                            </div>
                            <select
                                className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                                value={contactId}
                                onChange={e => setContactId(e.target.value)}
                            >
                                <option value="">Selecione um contato (Opcional)</option>
                                {contacts
                                    .filter(c => c.type === (isExpense ? 'supplier' : 'client'))
                                    .map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.name}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>

                        {isCRMEnabled && !isExpense && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Negócio (CRM)</label>
                                <select
                                    className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                                    value={dealId}
                                    onChange={e => {
                                        const selectedId = e.target.value;
                                        setDealId(selectedId);

                                        if (selectedId) {
                                            const deal = deals.find(d => d.id === selectedId);
                                            if (deal) {
                                                // Auto-populate contact
                                                if (deal.contact_id) {
                                                    setContactId(deal.contact_id);
                                                }
                                                // Auto-populate description if empty
                                                if (!description || description.trim() === '') {
                                                    setDescription(`Ref: ${deal.title}`);
                                                }
                                                // Auto-populate amount if empty
                                                if (!amount || parseFloat(amount) === 0) {
                                                    setAmount(deal.value.toString());
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <option value="">Nenhum negócio associado</option>
                                    {deals.filter(d => d.status === 'active').map(deal => (
                                        <option key={deal.id} value={deal.id}>
                                            {deal.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Repeat className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-bold text-gray-900 dark:text-white">Lançamento Recorrente</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={e => {
                                    setIsRecurring(e.target.checked);
                                    if (!e.target.checked) setIsVariableAmount(false);
                                }}
                                className="w-5 h-5 text-emerald-600 rounded-md border-gray-300 focus:ring-emerald-500 dark:bg-slate-700 dark:border-slate-600"
                            />
                        </div>

                        {isRecurring && (
                            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-1 duration-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Valor Variável (Estimado)</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={isVariableAmount}
                                        onChange={e => setIsVariableAmount(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
                                    />
                                </div>

                                {initialData?.recurrence_group_id && (
                                    <div className="flex items-center justify-between py-1 px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Repeat className="w-3.5 h-3.5 text-amber-600" />
                                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Propagar alteração para os próximos meses?</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={propagateChanges}
                                            onChange={e => setPropagateChanges(e.target.checked)}
                                            className="w-5 h-5 text-amber-600 rounded-md border-amber-300 focus:ring-amber-500 dark:bg-slate-700 dark:border-slate-600"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {isRecurring && (
                            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequência da Repetição</label>
                                        <select
                                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                                            value={frequency}
                                            onChange={e => setFrequency(e.target.value)}
                                        >
                                            <option value="weekly">Semanal</option>
                                            <option value="monthly">Mensal</option>
                                            <option value="yearly">Anual</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nº de Repetições</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={120}
                                            value={recurringCount}
                                            onChange={e => setRecurringCount(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 text-center font-bold"
                                        />
                                    </div>
                                </div>
                                {date && (
                                    <>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium italic">
                                            {frequency === 'monthly' && `* Este lançamento se repetirá todo dia ${date.split('-')[2]} de cada mês.`}
                                            {frequency === 'weekly' && `* Este lançamento se repetirá no mesmo dia da semana.`}
                                            {frequency === 'yearly' && `* Este lançamento se repetirá todo ano em ${date.split('-')[2]}/${date.split('-')[1]}.`}
                                        </p>

                                        {/* Preview of next recurring dates */}
                                        <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                                                📅 Próximas {recurringCount} Datas
                                            </p>
                                            <div className="flex overflow-x-auto gap-2 pb-2 snap-x scrollbar-thin scrollbar-thumb-emerald-200 dark:scrollbar-thumb-emerald-800">
                                                {calculateNextDates(date, frequency, recurringCount).map((nextDate, index) => {
                                                    const installmentIdx = (initialData?.installment_number || 1) + index + 1;
                                                    const currentOverride = overrides[installmentIdx];
                                                    const isEditing = editingInstallment === installmentIdx;

                                                    // Source data prioritizes Overrides (unsaved) > Database (real) > Projection (fallback)
                                                    const realData = dbInstallments[installmentIdx];
                                                    const displayDate = currentOverride?.date || realData?.date || nextDate.toISOString().split('T')[0];
                                                    const displayAmount = currentOverride?.amount !== undefined
                                                        ? currentOverride.amount
                                                        : (realData?.amount ?? parseFloat(amount || '0'));

                                                    return (
                                                        <div
                                                            key={index}
                                                            onClick={() => setEditingInstallment(isEditing ? null : installmentIdx)}
                                                            className={`flex-none w-28 snap-start flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 rounded-md border transition-all cursor-pointer group ${isEditing ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-emerald-100 dark:border-emerald-800/50 hover:border-emerald-400 shadow-sm'}`}
                                                        >
                                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                #{installmentIdx}
                                                            </span>

                                                            {isEditing ? (
                                                                <div className="flex flex-col gap-1 mt-1 w-full" onClick={e => e.stopPropagation()}>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Valor"
                                                                        className="w-full text-[10px] p-1 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-center focus:ring-1 focus:ring-emerald-500 outline-none"
                                                                        value={currentOverride?.amount ?? ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                            setOverrides(prev => ({
                                                                                ...prev,
                                                                                [installmentIdx]: { ...prev[installmentIdx], amount: val }
                                                                            }));
                                                                        }}
                                                                        autoFocus
                                                                    />
                                                                    <input
                                                                        type="date"
                                                                        className="w-full text-[9px] p-0.5 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-center focus:ring-1 focus:ring-emerald-500 outline-none"
                                                                        value={displayDate}
                                                                        onChange={e => {
                                                                            setOverrides(prev => ({
                                                                                ...prev,
                                                                                [installmentIdx]: { ...prev[installmentIdx], date: e.target.value }
                                                                            }));
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className={`text-[10px] font-bold mt-0.5 ${currentOverride?.amount !== undefined ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayAmount)}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                                        {formatBrazilianDate(new Date(displayDate + 'T12:00:00'))}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Paperclip className="w-4 h-4" /> Anexo / Comprovante
                        </label>

                        {/* Summary / Notes Field */}
                        <div className="flex flex-col gap-1.5 mb-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resumo / Observações do Documento</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 resize-none"
                                placeholder="Descreva o que é este anexo ou adicione observações importantes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>

                        {/* File Preview */}
                        {(file || initialData?.attachment_url) && (
                            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 mb-3 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Visualização do Documento</p>
                                    {file && (file.type.startsWith('image/')) && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={analyzeDocument}
                                            isLoading={isAnalyzing}
                                            className="h-7 text-[10px] border-emerald-200 text-emerald-600 dark:border-emerald-900 bg-white"
                                        >
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            ANALISAR IMAGEM (IA)
                                        </Button>
                                    )}
                                </div>

                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        {file.type.startsWith('image/') ? (
                                            <div className="relative w-full max-h-64 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt="Preview"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 w-full bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
                                                <Paperclip className="w-8 h-8 text-emerald-500" />
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{file.name}</p>
                                                    <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB - PDF / Documento</p>
                                                </div>
                                            </div>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setFile(null)}
                                            className="text-red-500 hover:text-red-600 text-[10px]"
                                        >
                                            Remover Arquivo
                                        </Button>
                                    </div>
                                ) : initialData?.attachment_url && (
                                    <div className="flex flex-col items-center gap-3">
                                        {initialData.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)/i) || initialData.attachment_url.includes('image') ? (
                                            <div className="relative w-full max-h-80 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 shadow-sm">
                                                <img
                                                    src={initialData.attachment_url}
                                                    alt="Anexo"
                                                    className="w-full h-full object-contain"
                                                />
                                                <a
                                                    href={initialData.attachment_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                                    title="Ver em tela cheia"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col w-full gap-2">
                                                <div className="flex items-center gap-3 p-3 w-full bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
                                                    <Paperclip className="w-8 h-8 text-emerald-500" />
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Documento Vinculado</p>
                                                        <p className="text-[10px] text-gray-500">PDF / Comprovante de Pagamento</p>
                                                    </div>
                                                    <a
                                                        href={initialData.attachment_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        ABRIR / PAGAR
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-center w-full">
                            <label
                                className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-300 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:border-slate-600 dark:hover:border-slate-500'}`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                            >
                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                    <p className="mb-0.5 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="font-semibold">{file ? 'Trocar arquivo' : 'Clique para anexar'}</span> ou arraste
                                    </p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">PDF, PNG, JPG (Máx. 5MB)</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-2">
                        <Button type="button" variant="outline" onClick={onClose} className="px-6 h-9 text-sm">
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 px-6 h-9 text-sm shadow-lg shadow-emerald-500/20">
                            {initialData ? 'Salvar Alterações' : 'Processar Lançamento'}
                        </Button>
                    </div>
                </form>
            </Modal>
            {/* Modais auxiliares de cadastro rápido */}
            <CategoryForm
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                onSubmit={handleCategoryCreated}
            />
            <ContactForm
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                onSubmit={handleContactCreated}
            />
        </>
    );
}
