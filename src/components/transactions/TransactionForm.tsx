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
    const [file, setFile] = useState<File | null>(null);
    const [dealId, setDealId] = useState('');
    const [loading, setLoading] = useState(false);
    const [overrides, setOverrides] = useState<Record<number, { amount?: number; date?: string }>>({});
    const [editingInstallment, setEditingInstallment] = useState<number | null>(null);
    const [propagateChanges, setPropagateChanges] = useState(false);

    const { categories, addCategory } = useCategories();
    const { companies } = useCompanies();
    const { contacts, addContact } = useContacts();
    const { deals } = useCRM();
    const { currentEntity } = useEntity();

    // Quick-add modal states
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);

    const isCRMEnabled = currentEntity.type === 'company' &&
        companies.find(c => c.id === currentEntity.id)?.crm_module_enabled;

    // Load saved company preference for this transaction type
    useEffect(() => {
        if (initialData) {
            setDescription(initialData.description);
            setAmount(initialData.amount.toString());
            setDate(initialData.date);
            setStatus(initialData.status);
            setCategoryId(initialData.category_id || '');
            setCompanyId(initialData.company_id || '');
            setContactId(initialData.contact_id || '');
            setIsRecurring(initialData.is_recurring || false);
            setIsVariableAmount((initialData as any).is_variable_amount || false);
            setFrequency(initialData.frequency || 'monthly');
            setDealId(initialData.deal_id || '');
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
            setDealId('');
            setOverrides({});
            setEditingInstallment(null);
            setPropagateChanges(false);
        }
    }, [initialData, isOpen, type]);

    // Save company preference when changed (only for new transactions)
    useEffect(() => {
        if (!initialData && companyId !== undefined) {
            localStorage.setItem(`lastCompanyId_${type}`, companyId);
        }
    }, [companyId, type, initialData]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let attachmentUrl = initialData?.attachment_url;
            let attachmentPath = initialData?.attachment_path;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
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
                attachment_url: attachmentUrl,
                attachment_path: attachmentPath,
                deal_id: dealId || null,
                overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
                propagate: propagateChanges
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
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 space-y-4">
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
                                        className="w-4 h-4 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
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
                                            className="w-4 h-4 text-amber-600 rounded-md border-amber-300 focus:ring-amber-500 dark:bg-slate-700 dark:border-slate-600"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {isRecurring && (
                            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
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
                                {date && (
                                    <>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium italic">
                                            {frequency === 'monthly' && `* Este lançamento se repetirá todo dia ${date.split('-')[2]} de cada mês.`}
                                            {frequency === 'weekly' && `* Este lançamento se repetirá no mesmo dia da semana.`}
                                            {frequency === 'yearly' && `* Este lançamento se repetirá todo ano em ${date.split('-')[2]}/${date.split('-')[1]}.`}
                                        </p>

                                        {/* Preview of next recurring dates */}
                                        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                                                📅 Próximas 5 Datas
                                            </p>
                                            <div className="grid grid-cols-5 gap-2">
                                                {calculateNextDates(date, frequency, 5).map((nextDate, index) => {
                                                    const installmentIdx = (initialData?.installment_number || 1) + index + 1;
                                                    const currentOverride = overrides[installmentIdx];
                                                    const isEditing = editingInstallment === installmentIdx;
                                                    const displayDate = currentOverride?.date || nextDate.toISOString().split('T')[0];
                                                    const displayAmount = currentOverride?.amount !== undefined ? currentOverride.amount : parseFloat(amount || '0');

                                                    return (
                                                        <div
                                                            key={index}
                                                            onClick={() => setEditingInstallment(isEditing ? null : installmentIdx)}
                                                            className={`flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 rounded-md border transition-all cursor-pointer group ${isEditing ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-emerald-100 dark:border-emerald-800/50 hover:border-emerald-400 shadow-sm'}`}
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Paperclip className="w-4 h-4" /> Anexo / Comprovante
                        </label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-700 hover:bg-gray-100 dark:border-slate-600 dark:hover:border-slate-500 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-semibold">Clique para anexar</span> ou arraste o arquivo
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">PDF, PNG, JPG (Máx. 5MB)</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                        {file && (
                            <p className="text-xs text-emerald-600 font-medium mt-1 uppercase">Arquivo selecionado: {file.name}</p>
                        )}
                        {initialData?.attachment_url && !file && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Anexo atual: <a href={initialData.attachment_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-bold">Ver Comprovante</a>
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="px-8">
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 px-8 shadow-lg shadow-emerald-500/20">
                            Processar Lançamento
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
