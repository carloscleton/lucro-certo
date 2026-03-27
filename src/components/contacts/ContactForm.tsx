import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { UserPlus, Search, Award, Check, Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import type { Contact } from '../../hooks/useContacts';
import { formatPhoneInput, cleanPhoneNumber, formatPhoneFromDB } from '../../utils/phoneUtils';
import { useAutoSave } from '../../hooks/useAutoSave';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../context/EntityContext';
import { useLoyalty } from '../../hooks/useLoyalty';

interface ContactFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<any>;
    initialData?: Contact | null;
}

export function ContactForm({ isOpen, onClose, onSubmit, initialData }: ContactFormProps) {
    const { notify } = useNotification();
    const { currentEntity } = useEntity();
    const { plans } = useLoyalty();
    const [name, setName] = useState('');
    const [type, setType] = useState<'client' | 'supplier'>('client');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [taxId, setTaxId] = useState('');
    const [birthday, setBirthday] = useState('');

    // Address fields
    const [zipCode, setZipCode] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [loyaltyPlanId, setLoyaltyPlanId] = useState('');
    const [generateGatewayLink, setGenerateGatewayLink] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState('');
    const [whatsappSent, setWhatsappSent] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const [loading, setLoading] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // CEP Search State
    const [showCepSearch, setShowCepSearch] = useState(false);
    const [searchState, setSearchState] = useState('');
    const [searchCity, setSearchCity] = useState('');
    const [searchStreet, setSearchStreet] = useState('');
    const [cepResults, setCepResults] = useState<any[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setType(initialData.type);
            setEmail(initialData.email || '');
            setPhone(formatPhoneFromDB(initialData.phone));
            setWhatsapp(formatPhoneFromDB(initialData.whatsapp));
            setTaxId(initialData.tax_id || '');
            setBirthday(initialData.birthday || '');
            setZipCode(initialData.zip_code || '');
            setStreet(initialData.street || '');
            setNumber(initialData.number || '');
            setComplement(initialData.complement || '');
            setNeighborhood(initialData.neighborhood || '');
            setCity(initialData.city || '');
            setState(initialData.state || '');

            const fetchLoyalty = async () => {
                if (!currentEntity.id) return;
                const { data } = await supabase
                    .from('loyalty_subscriptions')
                    .select('plan_id, status')
                    .eq('contact_id', initialData.id)
                    .eq('company_id', currentEntity.id)
                    .in('status', ['active', 'past_due', 'trialing'])
                    .maybeSingle();
                
                if (data) setLoyaltyPlanId(data.plan_id);
                else setLoyaltyPlanId('');
            };
            fetchLoyalty();
        } else {
            setName('');
            setType('client');
            setEmail('');
            setPhone('');
            setWhatsapp('');
            setTaxId('');
            setBirthday('');
            setZipCode('');
            setStreet('');
            setNumber('');
            setComplement('');
            setNeighborhood('');
            setCity('');
            setState('');
            setLoyaltyPlanId('');
            setGenerateGatewayLink(false);
            setCheckoutUrl('');
        }
    }, [initialData, isOpen, currentEntity.id]);

    const { clearCache } = useAutoSave(
        'contact_form',
        { name, type, email, phone, whatsapp, taxId, birthday, zipCode, street, number, complement, neighborhood, city, state },
        {
            name: setName, type: setType as any, email: setEmail, phone: setPhone, whatsapp: setWhatsapp,
            taxId: setTaxId, birthday: setBirthday, zipCode: setZipCode, street: setStreet,
            number: setNumber, complement: setComplement, neighborhood: setNeighborhood,
            city: setCity, state: setState
        },
        !initialData,
        isOpen
    );

    const handleClose = () => {
        clearCache();
        onClose();
    };

    // Auto-CEP search when 8 digits are reached
    useEffect(() => {
        const cleanCep = zipCode.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            handleZipCodeLookup(cleanCep);
        }
    }, [zipCode]);

    const handleZipCodeLookup = async (cleanCep: string) => {
        setLoadingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setStreet(data.logradouro);
                setNeighborhood(data.bairro);
                setCity(data.localidade);
                setState(data.uf);
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setLoadingCep(false);
        }
    };

    const handleZipCodeBlur = () => {
        const cleanCep = zipCode.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            handleZipCodeLookup(cleanCep);
        }
    };

    const handleSearchCep = async () => {
        if (searchState.length !== 2 || searchCity.length < 3 || searchStreet.length < 3) {
            notify('warning', 'Preencha UF (2 letras), Cidade (min 3 letras) e Logradouro (min 3 letras).', 'Campos Incompletos');
            return;
        }

        setLoadingSearch(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${searchState}/${searchCity}/${searchStreet}/json/`);
            const data = await response.json();

            if (Array.isArray(data)) {
                setCepResults(data);
            } else {
                setCepResults([]);
                notify('info', 'Nenhum CEP encontrado para os dados informados.', 'Busca Vazia');
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            notify('error', 'Ocorreu um erro ao buscar os CEPs.', 'Erro na Busca');
        } finally {
            setLoadingSearch(false);
        }
    };

    const selectCep = (result: any) => {
        setZipCode(result.cep);
        setStreet(result.logradouro);
        setNeighborhood(result.bairro);
        setCity(result.localidade);
        setState(result.uf);
        setShowCepSearch(false);
        // Clear search
        setSearchState('');
        setSearchCity('');
        setSearchStreet('');
        setCepResults([]);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Format phone numbers before saving
            const finalPhone = cleanPhoneNumber(phone);
            const finalWhatsapp = cleanPhoneNumber(whatsapp);

            const savedContact = await onSubmit({
                name,
                type,
                email: email || null,
                phone: finalPhone || null,
                whatsapp: finalWhatsapp || null,
                tax_id: taxId || null,
                zip_code: zipCode || null,
                street: street || null,
                number: number || null,
                complement: complement || null,
                neighborhood: neighborhood || null,
                city: city || null,
                state: state || null,
                birthday: birthday || null,
            });

            const contactId = initialData?.id || savedContact?.id;

            if (contactId && currentEntity.id) {
                if (loyaltyPlanId) {
                    if (generateGatewayLink) {
                        if (!phone && !whatsapp) {
                            setLoading(false);
                            notify('warning', 'É necessário um telefone ou WhatsApp para gerar a cobrança no gateway.', 'Dados Faltando');
                            return;
                        }
                        if (!taxId) {
                            setLoading(false);
                            notify('warning', 'É necessário informar o CPF ou CNPJ para gerar a cobrança no gateway.', 'Dados Faltando');
                            return;
                        }
                        // Call Edge Function for Gateway Checkout
                        try {
                            const { data, error: functionError } = await supabase.functions.invoke('loyalty-checkout', {
                                body: { 
                                    planId: loyaltyPlanId, 
                                    contactId: contactId
                                }
                            });

                            if (functionError) throw functionError;
                            if (data?.success && data.checkout_url) {
                                setCheckoutUrl(data.checkout_url);
                                if (data.whatsapp_sent) setWhatsappSent(true);
                                if (data.email_sent) setEmailSent(true);
                                notify('success', 'Cobrança gerada e enviada para o cliente!', 'Sucesso');
                                // We don't close the modal yet so the user can see the link
                                return; 
                            } else {
                                throw new Error(data?.error || 'Erro desconhecido ao gerar cobrança.');
                            }
                        } catch (err: any) {
                            console.error('Checkout Error:', err);
                            notify('error', err.message || 'Falha ao processar checkout no gateway.', 'Erro no Gateway');
                            setLoading(false);
                            return;
                        }
                    } else {
                        // Manual Activation (Atomic RPC)
                        const { error: rpcError } = await supabase
                            .rpc('upsert_loyalty_subscription', {
                                p_company_id: currentEntity.id,
                                p_contact_id: contactId,
                                p_plan_id: loyaltyPlanId,
                                p_status: 'active'
                            });
                        
                        if (rpcError) throw rpcError;
                        notify('success', 'Plano vinculado com sucesso!', 'Clube de Fidelidade');
                    }
                } else {
                    // Canceled / No Plan
                    await supabase
                        .from('loyalty_subscriptions')
                        .update({ status: 'canceled' })
                        .eq('contact_id', contactId)
                        .eq('company_id', currentEntity.id)
                        .in('status', ['active', 'past_due', 'trialing']);
                }
            }

            clearCache();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={initialData ? 'Editar Contato' : 'Novo Contato'}
            subtitle={initialData ? 'Atualize os dados do seu cliente ou fornecedor' : 'Cadastre um novo cliente ou fornecedor na sua agenda'}
            icon={UserPlus}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Nome Completo *"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="Nome do cliente ou fornecedor"
                    />

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Contato</label>
                        <select
                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                            value={type}
                            onChange={e => setType(e.target.value as 'client' | 'supplier')}
                        >
                            <option value="client">Cliente</option>
                            <option value="supplier">Fornecedor</option>
                        </select>
                    </div>

                    <Input
                        label="Email Principal"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                    />

                    <Input
                        label="Telefone Comercial"
                        value={phone}
                        onChange={e => setPhone(formatPhoneInput(e.target.value))}
                        placeholder="+55 (00) 0000-0000"
                    />

                    <Input
                        label="WhatsApp p/ Automação"
                        value={whatsapp}
                        onChange={e => setWhatsapp(formatPhoneInput(e.target.value))}
                        placeholder="+55 (00) 0 0000-0000"
                        helpText="Número usado para envio de lembretes automáticos."
                    />

                    <Input
                        label="CPF / CNPJ"
                        value={taxId}
                        onChange={e => setTaxId(e.target.value)}
                        placeholder="000.000.000-00"
                    />

                    <Input
                        label="Data de Nascimento"
                        type="date"
                        value={birthday}
                        onChange={e => setBirthday(e.target.value)}
                    />
                </div>

                {currentEntity.loyalty_module_enabled && (
                    <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                        <h3 className="text-sm font-bold text-amber-600 dark:text-amber-500 mb-4 flex items-center gap-2">
                            <Award size={18} />
                            Clube de Fidelidade
                        </h3>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Plano Vinculado</label>
                            <select
                                className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                value={loyaltyPlanId}
                                onChange={e => setLoyaltyPlanId(e.target.value)}
                            >
                                <option value="">Nenhum</option>
                                {plans.filter(p => p.is_active).map(plan => (
                                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ao selecionar um plano, ele será ativado manualmente para este contato.</p>
                        </div>

                        {loyaltyPlanId && (
                            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/50 animate-in fade-in slide-in-from-top-1">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={generateGatewayLink}
                                        onChange={e => setGenerateGatewayLink(e.target.checked)}
                                        className="mt-1 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-amber-900 dark:text-amber-100">Gerar cobrança no Gateway (Asaas)</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-300">O sistema criará a assinatura no gateway e gerará o link de pagamento.</span>
                                    </div>
                                </label>
                            </div>
                        )}

                        {checkoutUrl && (
                            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 animate-in zoom-in-95 duration-300">
                                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2">
                                    <Check className="text-emerald-500" size={18} />
                                    Cobrança Gerada e Enviada!
                                </h4>
                                
                                <div className="space-y-2 mb-4">
                                    {whatsappSent && (
                                        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Enviado via WhatsApp
                                        </div>
                                    )}
                                    {emailSent && (
                                        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Enviado via E-mail (Asaas)
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded border border-emerald-100 dark:border-emerald-900/50 text-xs font-mono text-emerald-700 dark:text-emerald-400 truncate">
                                        {checkoutUrl}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            type="button" 
                                            size="sm" 
                                            onClick={() => {
                                                navigator.clipboard.writeText(checkoutUrl);
                                                notify('success', 'Link copiado!', 'Sucesso');
                                            }}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            <Copy size={14} className="mr-1" /> Copiar Link
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        Endereço e Localização
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="relative">
                            <Input
                                label="CEP"
                                value={zipCode}
                                onChange={e => setZipCode(e.target.value)}
                                onBlur={handleZipCodeBlur}
                                placeholder="00000-000"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCepSearch(!showCepSearch)}
                                className="absolute right-0 top-0 text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 mr-1 font-medium"
                            >
                                Não sei o CEP
                            </button>
                        </div>
                        {loadingCep && <div className="text-xs text-emerald-500 self-center mt-6 animate-pulse">Buscando endereço...</div>}
                    </div>

                    {showCepSearch && (
                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-3">Busca por Endereço</h4>
                            <div className="grid grid-cols-4 gap-2 mb-2">
                                <input
                                    placeholder="UF"
                                    className="col-span-1 p-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    value={searchState}
                                    onChange={e => setSearchState(e.target.value.toUpperCase())}
                                    maxLength={2}
                                />
                                <input
                                    placeholder="Cidade"
                                    className="col-span-3 p-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    value={searchCity}
                                    onChange={e => setSearchCity(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <input
                                    placeholder="Logradouro (Rua, Av, etc)"
                                    className="flex-1 p-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    value={searchStreet}
                                    onChange={e => setSearchStreet(e.target.value)}
                                />
                                <Button type="button" size="sm" onClick={handleSearchCep} isLoading={loadingSearch} className="bg-emerald-600">
                                    <Search size={18} />
                                </Button>
                            </div>
                            {cepResults.length > 0 && (
                                <div className="mt-3 max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                                    {cepResults.map((res, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer border-b border-gray-100 dark:border-slate-700 last:border-0"
                                            onClick={() => selectCep(res)}
                                        >
                                            <strong className="text-emerald-700 dark:text-emerald-400">{res.cep}</strong> - {res.logradouro}, {res.bairro} ({res.localidade}-{res.uf})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <Input
                                label="Logradouro / Rua"
                                value={street}
                                onChange={e => setStreet(e.target.value)}
                                placeholder="Nome da rua, avenida..."
                            />
                        </div>
                        <Input
                            label="Número"
                            value={number}
                            onChange={e => setNumber(e.target.value)}
                            placeholder="S/N"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input
                            label="Complemento"
                            value={complement}
                            onChange={e => setComplement(e.target.value)}
                            placeholder="Apt, Sala, Bloco..."
                        />
                        <Input
                            label="Bairro"
                            value={neighborhood}
                            onChange={e => setNeighborhood(e.target.value)}
                            placeholder="Nome do bairro"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <Input
                                label="Cidade"
                                value={city}
                                onChange={e => setCity(e.target.value)}
                                placeholder="Nome da cidade"
                            />
                        </div>
                        <Input
                            label="UF"
                            value={state}
                            onChange={e => setState(e.target.value)}
                            maxLength={2}
                            placeholder="EX: SP"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <Button type="button" variant="outline" onClick={handleClose} className="px-8">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                        Salvar Contato
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
