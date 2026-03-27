import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, Award, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { TextArea } from '../components/ui/TextArea';
import { Modal } from '../components/ui/Modal';
import { useQuotes, type Quote, type QuoteItem } from '../hooks/useQuotes';
import { useContacts } from '../hooks/useContacts';
import { useServices } from '../hooks/useServices';
import { useProducts } from '../hooks/useProducts';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { useCRM } from '../hooks/useCRM';
import { Tooltip } from '../components/ui/Tooltip';
import { useAutoSave } from '../hooks/useAutoSave';
import { TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function QuoteForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { getQuote, createQuote, updateQuote } = useQuotes();
    const { contacts, addContact } = useContacts();
    const { services } = useServices();
    const { products } = useProducts();
    const { settings, loading: settingsLoading } = useSettings();
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const { deals } = useCRM();

    const isCRMEnabled = currentEntity.type === 'company' &&
        companies.find(c => c.id === currentEntity.id)?.crm_module_enabled;

    const isFiscalEnabled = currentEntity.type === 'company' &&
        companies.find(c => c.id === currentEntity.id)?.fiscal_module_enabled;

    const [loading, setLoading] = useState(false);

    // Header State
    const [title, setTitle] = useState('');
    const [contactId, setContactId] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<Quote['status']>('draft');
    const [paymentStatus, setPaymentStatus] = useState<Quote['payment_status']>('none');

    const [validityDays, setValidityDays] = useState<number | ''>('');
    const [dealId, setDealId] = useState<string | null>(null);

    // Items State
    const [items, setItems] = useState<QuoteItem[]>([]);

    // Quick Client Modal State
    const [showClientModal, setShowClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientTaxId, setNewClientTaxId] = useState('');
    const [addingClient, setAddingClient] = useState(false);

    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');

    // Expenses State
    const [expenses, setExpenses] = useState<any[]>([]);

    // Loyalty State
    const [loyaltySub, setLoyaltySub] = useState<any>(null);
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const isLoyaltyEnabled = currentEntity.type === 'company' &&
        companies.find(c => c.id === currentEntity.id)?.loyalty_module_enabled;

    const { clearCache } = useAutoSave(
        'quote_form',
        { title, contactId, validUntil, notes, discount, discountType, items },
        {
            title: setTitle, contactId: setContactId, validUntil: setValidUntil,
            notes: setNotes, discount: setDiscount, discountType: setDiscountType as any,
            items: setItems
        },
        id === 'new',
        true
    );

    const handleBack = () => {
        if (id === 'new') clearCache();
        navigate('/dashboard/quotes');
    };

    const loadQuote = useCallback(async (quoteId: string) => {
        if (!quoteId || quoteId === 'new') return;
        
        console.log('🔍 Loading quote with ID:', quoteId);
        setLoading(true);
        try {
            const data = await getQuote(quoteId);
            
            setTitle(data.title);
            setContactId(data.contact_id || '');
            setValidUntil(data.valid_until || '');
            setStatus(data.status);
            setPaymentStatus(data.payment_status || 'none');

            if (data.valid_until) {
                const date = new Date(data.valid_until);
                const today = new Date();
                date.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                const diffTime = date.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setValidityDays(diffDays);
            }

            setNotes(data.notes || '');

            if (data.items && data.items.length > 0) {
                setItems(data.items);
            } else {
                setItems([]);
            }

            setDiscount(data.discount || 0);
            setDiscountType(data.discount_type || 'amount');
            setDealId(data.deal_id || null);

            // Load ONLY expenses for this quote
            const { data: transData } = await supabase
                .from('transactions')
                .select('id, description, amount, date, status, quote_id, company_id, user_id, type')
                .eq('quote_id', quoteId)
                .eq('type', 'expense')
                .order('date', { ascending: false });
            
            if (transData) setExpenses(transData);

            console.log('✅ All data loaded successfully!');
        } catch (error) {
            console.error('❌ Error loading quote:', error);
            alert('Erro ao carregar orçamento');
            navigate('/dashboard/quotes');
        } finally {
            setLoading(false);
            console.log('✅ Loading finished');
        }
    }, [getQuote, navigate, user?.id, currentEntity.id]);

    useEffect(() => {
        if (settingsLoading) return;

        if (id && id !== 'new') {
            loadQuote(id);
        } else if (id === 'new') {
            // Initialize with one empty item row for new quotes
            setItems([{
                description: '',
                quantity: 1,
                unit_price: 0,
                total_price: 0,
                service_id: null,
                product_id: null
            }]);

            // Set default validity from settings
            const defaultDays = settings?.quote_validity_days || 7;
            setValidityDays(defaultDays);
            const date = new Date();
            date.setDate(date.getDate() + defaultDays);
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .split('T')[0];
            setValidUntil(localDate);
        }
    }, [id, settingsLoading, loadQuote]);

    // Handle initial pre-fill from searchParams
    useEffect(() => {
        if (id === 'new') {
            const dealIdParam = searchParams.get('dealId');
            const contactIdParam = searchParams.get('contactId');
            const titleParam = searchParams.get('title');
            const amountParam = searchParams.get('amount');

            if (dealIdParam) setDealId(dealIdParam);
            if (contactIdParam) setContactId(contactIdParam);
            if (titleParam) setTitle(titleParam);
            if (amountParam && !isNaN(parseFloat(amountParam))) {
                setItems([{
                    description: titleParam || 'Item do Negócio',
                    quantity: 1,
                    unit_price: parseFloat(amountParam),
                    total_price: parseFloat(amountParam),
                    service_id: null,
                    product_id: null
                }]);
            }
        }
    }, [id, searchParams]);

    // Fetch Loyalty Subscription when Contact changes
    useEffect(() => {
        const checkLoyalty = async () => {
            if (!contactId || !isLoyaltyEnabled) {
                setLoyaltySub(null);
                return;
            }

            setLoyaltyLoading(true);
            try {
                const { data, error } = await supabase
                    .from('loyalty_subscriptions')
                    .select('*, plan:loyalty_plans(id, name, price, discount_percent, included_services)')
                    .eq('contact_id', contactId)
                    .single();

                if (!error && data) {
                    setLoyaltySub(data);
                } else {
                    setLoyaltySub(null);
                }
            } catch (err) {
                console.error('Error fetching loyalty sub:', err);
                setLoyaltySub(null);
            } finally {
                setLoyaltyLoading(false);
            }
        };

        checkLoyalty();
    }, [contactId, isLoyaltyEnabled]);

    // State for discount


    const addExpenseRow = () => {
        setExpenses([
            ...expenses,
            {
                id: `temp-${Date.now()}`,
                description: '',
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                status: 'pending',
                quote_id: id,
                company_id: currentEntity.id,
                user_id: user?.id
            }
        ]);
    };

    const updateExpenseRow = (index: number, field: string, value: any) => {
        const newExpenses = [...expenses];
        newExpenses[index] = { ...newExpenses[index], [field]: value };
        setExpenses(newExpenses);
    };

    const removeExpenseRow = async (index: number) => {
        const expense = expenses[index];
        if (!expense.id.toString().startsWith('temp-')) {
            if (!confirm('Esta despesa já está salva no financeiro. Deseja realmente excluí-la?')) return;
            try {
                const { error } = await supabase.from('transactions').delete().eq('id', expense.id);
                if (error) throw error;
            } catch (err) {
                console.error(err);
                alert('Erro ao excluir despesa');
                return;
            }
        }
        const newExpenses = [...expenses];
        newExpenses.splice(index, 1);
        setExpenses(newExpenses);
    };

    // ... addItem, removeItem, updateItem, handleItemSelect ...

    // Helper function needs to be inside the component to access items state
    // but typescript might complain if I just use '...' comments in replace_file_content 
    // without context, so I will stick to targeting specific blocks or re-writing related parts.

    // Re-writing helper functions to ensure context (though previous step restored them, 
    // I am focused on calculateTotal here mostly)

    const addItem = (customItem?: Partial<QuoteItem>) => {
        setItems([
            ...items,
            {
                description: '',
                quantity: 1,
                unit_price: 0,
                total_price: 0,
                service_id: null,
                product_id: null,
                ...customItem
            }
        ]);
    };

    const handleEmbedDebt = () => {
        if (!loyaltySub || !loyaltySub.plan) return;
        
        // Add the debt item
        addItem({
            description: '[Clube VIP] Regularização da Assinatura Atrasada',
            unit_price: loyaltySub.plan.price,
            total_price: loyaltySub.plan.price
        });

        alert('Dívida embutida com sucesso! Quando este orçamento for pago, a assinatura Clube VIP será reativada automaticamente.');
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        // Auto-calculate total
        if (field === 'quantity' || field === 'unit_price') {
            item.total_price = Number(item.quantity) * Number(item.unit_price);
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const handleItemSelect = (index: number, type: 'service' | 'product', id: string) => {
        let selectedItem;
        const newItems = [...items];

        if (type === 'service') {
            selectedItem = services.find(s => s.id === id);
            if (selectedItem) {
                let unitPrice = selectedItem.price;

                // ITEM-BASED VIP DISCOUNT LOGIC
                if (loyaltySub?.status === 'active' && loyaltySub.plan) {
                    const isCovered = loyaltySub.plan.included_services?.includes(id);
                    if (isCovered && loyaltySub.plan.discount_percent > 0) {
                        unitPrice = selectedItem.price * (1 - (loyaltySub.plan.discount_percent / 100));
                    }
                }

                newItems[index] = {
                    ...newItems[index],
                    service_id: id,
                    product_id: null,
                    description: selectedItem.name,
                    unit_price: unitPrice,
                    total_price: newItems[index].quantity * unitPrice,
                    show_in_pdf: selectedItem.show_in_pdf !== false,
                    codigo_servico_municipal: (selectedItem as any).codigo_servico_municipal,
                    item_lista_servico: (selectedItem as any).item_lista_servico
                };
            }
        } else {
            selectedItem = products.find(p => p.id === id);
            if (selectedItem) {
                // Build complete description: Name + Description + Sub Description
                let fullDescription = selectedItem.name;
                if (selectedItem.description) {
                    fullDescription += `\n${selectedItem.description}`;
                }
                if (selectedItem.sub_description) {
                    fullDescription += `\n${selectedItem.sub_description}`;
                }

                newItems[index] = {
                    ...newItems[index],
                    service_id: null,
                    product_id: id,
                    description: fullDescription,
                    unit_price: selectedItem.price,
                    total_price: newItems[index].quantity * selectedItem.price,
                    show_in_pdf: selectedItem.show_in_pdf !== false,
                    ncm: (selectedItem as any).ncm,
                    cest: (selectedItem as any).cest,
                    origem: (selectedItem as any).origem
                };
            }
        }
        setItems(newItems);
    };

    const calculateSubtotal = () => {
        return items.reduce((acc, item) => acc + (item.total_price || 0), 0);
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        let discountValue = 0;

        if (discountType === 'percentage') {
            discountValue = subtotal * (discount / 100);
        } else {
            discountValue = discount;
        }

        return Math.max(0, subtotal - discountValue);
    };

    const calculateTotalExpenses = () => {
        return expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
    };

    const calculateProfit = () => {
        return calculateTotal() - calculateTotalExpenses();
    };

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingClient(true);
        try {
            const newClient = await addContact({
                name: newClientName,
                phone: newClientPhone,
                email: newClientEmail,
                tax_id: newClientTaxId,
                type: 'client',

                // Optional fields as empty strings
                zip_code: '',
                street: '',
                number: '',
                complement: '',
                neighborhood: '',
                city: '',
                state: ''
            });

            if (newClient) {
                setContactId(newClient.id);
                setShowClientModal(false);
                // Reset form
                setNewClientName('');
                setNewClientPhone('');
                setNewClientEmail('');
                setNewClientTaxId('');
            }
        } catch (error) {
            console.error('Error adding client:', error);
            alert('Erro ao cadastrar cliente rápido.');
        } finally {
            setAddingClient(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !contactId) {
            alert('Preencha o título e selecione um cliente.');
            return;
        }

        if (paymentStatus === 'paid') {
            const confirmMsg = "Este orçamento já consta como PAGO no financeiro.\n\n" +
                "Ao salvar as alterações, o valor recebido será atualizado automaticamente para R$ " + calculateTotal().toFixed(2) + ".\n\n" +
                "Deseja prosseguir com a atualização automática?";

            if (!confirm(confirmMsg)) return;
        }

        setLoading(true);
        try {
            // ... inside loadQuote ...
            // setStatus(data.status);

            // ... inside handleSubmit ...
            const quoteData = {
                title,
                contact_id: contactId,
                valid_until: validUntil || undefined,
                notes,
                discount,
                discount_type: discountType,
                total_amount: calculateTotal(),
                status: id && id !== 'new' ? status : 'draft',
                deal_id: dealId
            };

            if (id && id !== 'new') {
                await updateQuote(id, quoteData, items);
                // Save inline expenses
                const finalQuoteId = id;
                for (const exp of expenses) {
                    const { id: expId, ...expData } = exp;
                    const payload = {
                        ...expData,
                        description: expData.description.startsWith('[ORÇ]') 
                            ? expData.description 
                            : `[ORÇ] ${expData.description}`,
                        user_id: user?.id,
                        quote_id: finalQuoteId,
                        type: 'expense'
                    };
                    if (expId.toString().startsWith('temp-')) {
                        await supabase.from('transactions').insert([payload]);
                    } else {
                        await supabase.from('transactions').update(payload).eq('id', expId);
                    }
                }
            } else {
                const newQuote = await createQuote(quoteData, items);
                // Save inline expenses for new quote
                if (newQuote && newQuote.id) {
                    for (const exp of expenses) {
                        const { id: expId, ...expData } = exp;
                        await supabase.from('transactions').insert([{
                            ...expData,
                            description: expData.description.startsWith('[ORÇ]') 
                                ? expData.description 
                                : `[ORÇ] ${expData.description}`,
                            user_id: user?.id,
                            quote_id: newQuote.id,
                            type: 'expense'
                        }]);
                    }
                }
            }
            clearCache();
            navigate('/dashboard/quotes');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar orçamento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* ... Header ... */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={handleBack}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {id === 'new' ? 'Novo Orçamento' : 'Editar Orçamento'}
                    </h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Card */}
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Título do Orçamento"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ex: Reforma Banheiro"
                            required
                        />
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                                <button
                                    type="button"
                                    onClick={() => setShowClientModal(true)}
                                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                >
                                    <Plus size={12} />
                                    Novo
                                </button>
                            </div>
                            <select
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:focus:ring-blue-400"
                                value={contactId}
                                onChange={e => setContactId(e.target.value)}
                                required
                            >
                                <option value="">Selecione um cliente...</option>
                                {contacts
                                    .filter(c => c.type === 'client')
                                    .map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.name}
                                        </option>
                                    ))}
                            </select>
                            {loyaltyLoading && <span className="text-xs text-gray-400 mt-1 animate-pulse">Verificando Clube VIP...</span>}
                            {!loyaltyLoading && loyaltySub && loyaltySub.status === 'active' && (
                                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 animate-in fade-in slide-in-from-top-1 w-fit">
                                    <Award size={14} className="animate-pulse" />
                                    <span>Cliente Clube VIP Ativo (Descontos aplicados nos serviços cobertos).</span>
                                </div>
                            )}
                            {!loyaltyLoading && loyaltySub && (loyaltySub.status === 'past_due' || loyaltySub.status === 'canceled') && (
                                <div className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/50 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={14} />
                                        <span>Assinatura do Clube VIP está {loyaltySub.status === 'past_due' ? 'em atraso' : 'cancelada'}.</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleEmbedDebt}
                                        className="self-start text-[11px] font-bold bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/40 px-2 py-1 rounded transition-colors"
                                    >
                                        Embutir Mensalidade e Liberar Desconto
                                    </button>
                                </div>
                            )}
                        </div>
                        <Input
                            label="Validade"
                            type="date"
                            value={validUntil}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                setValidUntil(newDate);
                                if (newDate) {
                                    const date = new Date(newDate);
                                    const today = new Date();
                                    date.setHours(0, 0, 0, 0);
                                    today.setHours(0, 0, 0, 0);
                                    const diffTime = date.getTime() - today.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    setValidityDays(diffDays);
                                } else {
                                    setValidityDays('');
                                }
                            }}
                        />
                        <Input
                            label="Validade (em dias)"
                            type="number"
                            value={validityDays}
                            onChange={(e) => {
                                const days = parseInt(e.target.value);
                                setValidityDays(isNaN(days) ? '' : days);
                                if (!isNaN(days)) {
                                    const date = new Date();
                                    date.setDate(date.getDate() + days);
                                    // Handle timezone offset to get correct YYYY-MM-DD locally
                                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                                        .toISOString()
                                        .split('T')[0];
                                    setValidUntil(localDate);
                                }
                            }}
                            placeholder="Ex: 15"
                        />
                        {isCRMEnabled && (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Negócio (CRM)</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-gray-300 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:focus:ring-blue-400"
                                    value={dealId || ''}
                                    onChange={e => {
                                        const selectedDealId = e.target.value || null;
                                        setDealId(selectedDealId);

                                        if (selectedDealId) {
                                            const deal = deals.find(d => d.id === selectedDealId);
                                            if (deal) {
                                                // Auto-populate contact if the deal is linked to one
                                                if (deal.contact_id) {
                                                    setContactId(deal.contact_id);
                                                }
                                                // Auto-populate title if empty or default
                                                if (!title || title.trim() === '') {
                                                    setTitle(deal.title);
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
                </div>

                {/* Items Card */}
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Itens</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[20%]">Item (Serviço/Produto)</th>
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[35%]">Descrição</th>
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[10%] text-center">Qtd</th>
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[12%] text-right">Valor Unit.</th>
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[10%] text-right">Total</th>
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[8%] text-center">
                                        <Tooltip content="Mostrar no PDF">
                                            <span>PDF?</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[5%]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="p-2 align-top">
                                            <select
                                                className="w-full rounded-md border border-gray-300 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-main)] dark:bg-slate-800 dark:border-slate-700"
                                                onChange={(e) => {
                                                    const [type, id] = e.target.value.split(':');
                                                    if (type && id) handleItemSelect(index, type as 'service' | 'product', id);
                                                }}
                                                value={item.service_id ? `service:${item.service_id}` : item.product_id ? `product:${item.product_id}` : ''}
                                            >
                                                <option value="">Personalizado...</option>
                                                <optgroup label="Serviços">
                                                    {services.map(s => (
                                                        <option key={s.id} value={`service:${s.id}`}>{s.name}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Produtos">
                                                    {products.map(p => (
                                                        <option key={p.id} value={`product:${p.id}`}>{p.name}</option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </td>
                                        <td className="p-2 align-top">
                                            <textarea
                                                value={item.description}
                                                onChange={e => updateItem(index, 'description', e.target.value)}
                                                placeholder="Descrição do item"
                                                className="w-full rounded-md border border-gray-300 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-main)] dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                                                rows={3}
                                            />

                                            {/* Item VIP Covered Badge */}
                                            {loyaltySub?.status === 'active' && loyaltySub.plan && item.service_id && loyaltySub.plan.included_services?.includes(item.service_id) && (
                                                <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/50 w-fit">
                                                    <Award size={10} />
                                                    Serviço VIP (-{loyaltySub.plan.discount_percent}%)
                                                </div>
                                            )}

                                            {isFiscalEnabled && item.service_id && (
                                                <div className="mt-2 flex gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Cód. Municipal</label>
                                                        <input
                                                            type="text"
                                                            value={item.codigo_servico_municipal || ''}
                                                            onChange={e => updateItem(index, 'codigo_servico_municipal', e.target.value)}
                                                            className="w-full bg-transparent border-b border-gray-200 dark:border-slate-700 text-xs py-0.5 focus:border-blue-500 outline-none dark:text-gray-300"
                                                            placeholder="Código municipal..."
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Item LC 116</label>
                                                        <input
                                                            type="text"
                                                            value={item.item_lista_servico || ''}
                                                            onChange={e => updateItem(index, 'item_lista_servico', e.target.value)}
                                                            className="w-full bg-transparent border-b border-gray-200 dark:border-slate-700 text-xs py-0.5 focus:border-blue-500 outline-none dark:text-gray-300"
                                                            placeholder="00.00"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 align-top">
                                            <Input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                                className="h-9 text-center"
                                            />
                                        </td>
                                        <td className="p-2 align-top text-right">
                                            <div className="flex flex-col items-end w-full">
                                                {loyaltySub?.status === 'active' && loyaltySub.plan && item.service_id && loyaltySub.plan.included_services?.includes(item.service_id) && (() => {
                                                    const originalService = services.find(s => s.id === item.service_id);
                                                    if (originalService && originalService.price > item.unit_price) {
                                                        return (
                                                            <div className="text-[10px] text-gray-400 line-through mb-0.5 pr-3" title="Preço original sem plano VIP">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalService.price)}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <div className="w-full">
                                                    <Input
                                                        type="number"
                                                        value={item.unit_price}
                                                        onChange={e => updateItem(index, 'unit_price', parseFloat(e.target.value))}
                                                        className="h-9 text-right"
                                                        leftElement={<span className="text-xs font-bold text-gray-400">R$</span>}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2 align-top pt-2 font-medium text-gray-900 dark:text-white">
                                            <div className="flex flex-col items-end w-full">
                                                {loyaltySub?.status === 'active' && loyaltySub.plan && item.service_id && loyaltySub.plan.included_services?.includes(item.service_id) && (() => {
                                                    const originalService = services.find(s => s.id === item.service_id);
                                                    if (originalService && originalService.price > item.unit_price) {
                                                        return (
                                                            <div className="text-[10px] text-gray-400 line-through mb-0.5 pr-1">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity * originalService.price)}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <div className="pr-1">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity * item.unit_price)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2 align-top text-center pt-2">
                                            <Tooltip content="Mostrar este item no PDF">
                                                <input
                                                    type="checkbox"
                                                    checked={item.show_in_pdf !== false}
                                                    onChange={e => updateItem(index, 'show_in_pdf', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                                />
                                            </Tooltip>
                                        </td>
                                        <td className="p-2 align-top text-center pt-1.5">
                                            <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItem(index)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4">
                        <Button type="button" variant="outline" onClick={() => addItem()}>
                            <Plus size={18} className="mr-2" />
                            Adicionar Item
                        </Button>
                    </div>
                </div>

                {/* Expenses Card */}
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-orange-500" />
                            Despesas do Serviço / Obra
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2 px-2 text-xs font-bold text-gray-400 uppercase tracking-tighter w-[15%]">Data</th>
                                    <th className="py-2 px-2 text-xs font-bold text-gray-400 uppercase tracking-tighter w-[55%]">Descrição da Despesa</th>
                                    <th className="py-2 px-2 text-xs font-bold text-gray-400 uppercase tracking-tighter w-[20%] text-right">Valor (R$)</th>
                                    <th className="py-2 px-2 text-xs font-bold text-gray-400 uppercase tracking-tighter w-[10%]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((exp, index) => (
                                    <tr key={exp.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="p-2">
                                            <input
                                                type="date"
                                                value={exp.date}
                                                onChange={e => updateExpenseRow(index, 'date', e.target.value)}
                                                className="w-full bg-transparent border-none text-sm outline-none focus:ring-0 text-gray-600 dark:text-gray-300"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={exp.description}
                                                onChange={e => updateExpenseRow(index, 'description', e.target.value)}
                                                placeholder="Ex: Material Hidráulico, Frete, etc."
                                                className="w-full bg-transparent border-none text-sm outline-none focus:ring-0 text-gray-900 dark:text-white font-medium"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <div className="relative flex items-center">
                                                <span className="absolute left-0 text-xs font-bold text-gray-400">R$</span>
                                                <input
                                                    type="number"
                                                    value={exp.amount}
                                                    onChange={e => updateExpenseRow(index, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent border-none text-sm outline-none focus:ring-0 text-right font-bold text-red-600 px-6"
                                                    step="0.01"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-2 text-right">
                                            <button 
                                                type="button" 
                                                onClick={() => removeExpenseRow(index)}
                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {expenses.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400 text-sm italic">
                                            Nenhuma despesa lançada para este orçamento.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={addExpenseRow}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50 font-bold"
                        >
                            <Plus size={16} className="mr-2" />
                            Adicionar Despesa
                        </Button>
                    </div>
                </div>

                {/* Footer / Summary */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
                    <div className="w-full md:w-1/2">
                        <TextArea
                            label="Notas / Observações"
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Condições de pagamento, prazos, etc."
                        />
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow min-w-[250px] space-y-2">
                        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                            <span>Subtotal</span>
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateSubtotal())}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span>Desconto</span>
                            <div className="flex items-center gap-2">
                                <div className="flex bg-gray-100 dark:bg-slate-700 rounded-md p-1">
                                    <button
                                        type="button"
                                        onClick={() => setDiscountType('amount')}
                                        className={`px-2 py-0.5 text-xs rounded-sm transition-colors ${discountType === 'amount' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500'}`}
                                    >
                                        R$
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDiscountType('percentage')}
                                        className={`px-2 py-0.5 text-xs rounded-sm transition-colors ${discountType === 'percentage' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500'}`}
                                    >
                                        %
                                    </button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                                        {discountType === 'amount' ? 'R$' : '%'}
                                    </span>
                                    <input
                                        type="number"
                                        className="w-24 text-right rounded-md border border-gray-300 bg-[var(--color-surface)] pl-6 pr-2 py-1 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-slate-700 dark:border-slate-600"
                                        value={discount}
                                        onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-xl font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-slate-700">
                            <span>Total</span>
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</span>
                        </div>

                        {id !== 'new' && (
                            <div className="space-y-2 pt-2 animate-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-center text-sm text-gray-400">
                                    <span className="flex items-center gap-1.5 font-bold uppercase tracking-tighter">(-) Total Despesas</span>
                                    <span className="font-bold">-{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotalExpenses())}</span>
                                </div>
                                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/40 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Lucro Líquido Real</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Fórmula: Total - Despesas</span>
                                    </div>
                                    <span className={`text-xl font-black ${calculateProfit() >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 font-black'}`}>
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateProfit())}
                                    </span>
                                </div>
                            </div>
                        )}
                        <div className="pt-2">
                            <Button type="submit" className="w-full" isLoading={loading}>
                                <Save size={18} className="mr-2" />
                                Salvar Orçamento
                            </Button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Quick Client Modal */}
            <Modal
                isOpen={showClientModal}
                onClose={() => setShowClientModal(false)}
                title="Novo Cliente Rápido"
                subtitle="Cadastre um cliente sem sair do orçamento"
                icon={Plus}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleAddClient} className="space-y-4">
                    <Input
                        label="Nome Completo *"
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                        required
                        autoFocus
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Telefone / WhatsApp"
                            value={newClientPhone}
                            onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                let formatted = value;
                                if (value.length <= 11) {
                                    formatted = value
                                        .replace(/^(\d{2})/, '($1) ')
                                        .replace(/(\d{1})(\d{4})/, '$1 $2')
                                        .replace(/(\d{4})(\d{4})$/, '$1-$2');
                                }
                                setNewClientPhone(formatted);
                            }}
                            maxLength={16}
                            placeholder="(84) 9 9999-9999"
                        />
                        <Input
                            label="CPF / CNPJ"
                            value={newClientTaxId}
                            onChange={e => setNewClientTaxId(e.target.value)}
                        />
                    </div>

                    <Input
                        label="Email"
                        type="email"
                        value={newClientEmail}
                        onChange={e => setNewClientEmail(e.target.value)}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowClientModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={addingClient} className="bg-emerald-600 hover:bg-emerald-700 px-6">
                            Salvar e Selecionar
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
