import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Receipt, TrendingUp, Paperclip, Repeat } from 'lucide-react';
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

interface TransactionFormProps {
    type: TransactionType;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Transaction | null;
}

// Helper function to calculate next recurring dates
function calculateNextDates(startDate: string, frequency: string, count: number = 5): Date[] {
    const dates: Date[] = [];
    const start = new Date(startDate);

    for (let i = 1; i <= count; i++) {
        const nextDate = new Date(start);

        if (frequency === 'weekly') {
            nextDate.setDate(start.getDate() + (i * 7));
        } else if (frequency === 'monthly') {
            nextDate.setMonth(start.getMonth() + i);
        } else if (frequency === 'yearly') {
            nextDate.setFullYear(start.getFullYear() + i);
        }

        dates.push(nextDate);
    }

    return dates;
}

// Helper function to format date in Brazilian format
function formatBrazilianDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
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
    const [frequency, setFrequency] = useState('monthly');
    const [file, setFile] = useState<File | null>(null);
    const [dealId, setDealId] = useState('');
    const [loading, setLoading] = useState(false);

    const { categories } = useCategories();
    const { companies } = useCompanies();
    const { contacts } = useContacts();
    const { deals } = useCRM();
    const { currentEntity } = useEntity();

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
            setFrequency('monthly');
            setDealId('');
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
                frequency: isRecurring ? frequency : null,
                attachment_url: attachmentUrl,
                attachment_path: attachmentPath,
                deal_id: dealId || null
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const isExpense = type === 'expense';

    return (
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
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
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
                        </select>
                        {categories.filter(c => c.type === type).length === 0 && (
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
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {isExpense ? 'Fornecedor' : 'Cliente'}
                        </label>
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
                                onChange={e => setDealId(e.target.value)}
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
                            onChange={e => setIsRecurring(e.target.checked)}
                            className="w-5 h-5 text-emerald-600 rounded-md border-gray-300 focus:ring-emerald-500 dark:bg-slate-700 dark:border-slate-600"
                        />
                    </div>

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
                                            {calculateNextDates(date, frequency, 5).map((nextDate, index) => (
                                                <div
                                                    key={index}
                                                    className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 rounded-md border border-emerald-100 dark:border-emerald-800/50 shadow-sm"
                                                >
                                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                        #{index + 2}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                                                        {formatBrazilianDate(nextDate)}
                                                    </span>
                                                </div>
                                            ))}
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
    );
}
