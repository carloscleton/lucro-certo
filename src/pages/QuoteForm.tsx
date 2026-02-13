import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
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

export function QuoteForm() {
    const { id } = useParams();
    const navigate = useNavigate();
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

    useEffect(() => {
        if (settingsLoading) return;

        if (id && id !== 'new') {
            loadQuote(id);
        } else {
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
    }, [id, settingsLoading]); // Removed settings and items from dependencies

    // State for discount
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');

    const loadQuote = async (quoteId: string) => {
        console.log('🔍 Loading quote with ID:', quoteId);
        setLoading(true);
        try {
            const data = await getQuote(quoteId);
            console.log('📋 Quote Data:', data);
            console.log('👤 Your User ID:', user?.id);
            console.log('👤 Quote Owner ID:', data.user_id);
            console.log('🏢 Quote Company ID:', data.company_id);
            console.log('📦 Items retrieved:', data.items?.length || 0);

            setTitle(data.title);
            console.log('✅ Title set:', data.title);

            setContactId(data.contact_id || '');
            console.log('✅ Contact ID set:', data.contact_id);

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
                console.log('✅ Validity days set:', diffDays);
            }

            setNotes(data.notes || '');

            if (data.items && data.items.length > 0) {
                console.log(`📦 Loaded ${data.items.length} items from database`);
                setItems(data.items);
            } else {
                console.error('❌ NO ITEMS LOADED! This is likely an RLS (Row Level Security) issue in Supabase.');
                console.log('💡 Joyce may not have permission to view items of this quote.');
                setItems([]);
            }

            setDiscount(data.discount || 0);
            setDiscountType(data.discount_type || 'amount');
            setDealId(data.deal_id || null);
            console.log('✅ Discount set:', data.discount, data.discount_type);

            console.log('✅ All data loaded successfully!');
        } catch (error) {
            console.error('❌ Error loading quote:', error);
            alert('Erro ao carregar orçamento');
            navigate('/quotes');
        } finally {
            setLoading(false);
            console.log('✅ Loading finished');
        }
    };

    // ... addItem, removeItem, updateItem, handleItemSelect ...

    // Helper function needs to be inside the component to access items state
    // but typescript might complain if I just use '...' comments in replace_file_content 
    // without context, so I will stick to targeting specific blocks or re-writing related parts.

    // Re-writing helper functions to ensure context (though previous step restored them, 
    // I am focused on calculateTotal here mostly)

    const addItem = () => {
        setItems([
            ...items,
            {
                description: '',
                quantity: 1,
                unit_price: 0,
                total_price: 0,
                service_id: null,
                product_id: null
            }
        ]);
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
                newItems[index] = {
                    ...newItems[index],
                    service_id: id,
                    product_id: null,
                    description: selectedItem.name,
                    unit_price: selectedItem.price,
                    total_price: newItems[index].quantity * selectedItem.price,
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
            } else {
                await createQuote(quoteData, items);
            }
            navigate('/quotes');
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
                <Button variant="ghost" onClick={() => navigate('/quotes')}>
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
                                    onChange={e => setDealId(e.target.value || null)}
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
                                    <th className="py-2 px-2 text-sm font-medium text-gray-500 w-[8%] text-center" title="Mostrar no PDF">PDF?</th>
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
                                        <td className="p-2 align-top">
                                            <Input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={e => updateItem(index, 'unit_price', parseFloat(e.target.value))}
                                                className="h-9 text-right"
                                            />
                                        </td>
                                        <td className="p-2 align-top text-right pt-2.5 font-medium text-gray-900 dark:text-white">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity * item.unit_price)}
                                        </td>
                                        <td className="p-2 align-top text-center pt-2">
                                            <input
                                                type="checkbox"
                                                checked={item.show_in_pdf !== false}
                                                onChange={e => updateItem(index, 'show_in_pdf', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                                title="Mostrar este item no PDF"
                                            />
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
                        <Button type="button" variant="outline" onClick={addItem}>
                            <Plus size={18} className="mr-2" />
                            Adicionar Item
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
