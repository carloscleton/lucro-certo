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
import { useAuth } from '../../context/AuthContext';
import { useServices } from '../../hooks/useServices';

interface ContactFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<any>;
    initialData?: Contact | null;
}

const formatCPF = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .substring(0, 14);
};

const formatCNPJ = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
        .substring(0, 18);
};

export function ContactForm({ isOpen, onClose, onSubmit, initialData }: ContactFormProps) {
    const { notify } = useNotification();
    const { currentEntity } = useEntity();
    const { plans } = useLoyalty();
    const { services } = useServices();
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [type, setType] = useState<'client' | 'supplier' | 'both'>('client');
    const [entityType, setEntityType] = useState<'PF' | 'PJ'>('PF');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [cpf, setCpf] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [birthday, setBirthday] = useState('');

    // Address fields
    const [zipCode, setZipCode] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [isRecorrenteEnabled, setIsRecorrenteEnabled] = useState(false);
    const [recorrenteType, setRecorrenteType] = useState<'none' | 'plan' | 'service' | 'custom'>('none');
    const [loyaltyPlanId, setLoyaltyPlanId] = useState('');
    const [loyaltyServiceId, setLoyaltyServiceId] = useState('');
    const [generateGatewayLink, setGenerateGatewayLink] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState('');
    const [whatsappSent, setWhatsappSent] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [nextDueAt, setNextDueAt] = useState('');
    const [customPrice, setCustomPrice] = useState('');

    const [loading, setLoading] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // CEP Search State
    const [showCepSearch, setShowCepSearch] = useState(false);
    const [searchState, setSearchState] = useState('');
    const [searchCity, setSearchCity] = useState('');
    const [searchStreet, setSearchStreet] = useState('');
    const [cepResults, setCepResults] = useState<any[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [isFetchingTaxId, setIsFetchingTaxId] = useState(false);

    const handleTaxIdLookup = async (value: string) => {
        if (!user) return;
        const clean = value.replace(/\D/g, '');
        if (entityType === 'PF' && clean.length !== 11) return;
        if (entityType === 'PJ' && clean.length !== 14) return;

        setIsFetchingTaxId(true);
        try {
            // 1. Search in local contacts first (filtered by the user's scope)
            const { data: localContact } = await supabase
                .from('contacts')
                .select('*')
                .eq('tax_id', clean)
                .eq('user_id', user.id)
                .maybeSingle();

            if (localContact) {
                setName(localContact.name || '');
                setEmail(localContact.email || '');
                setPhone(formatPhoneFromDB(localContact.phone || ''));
                setWhatsapp(formatPhoneFromDB(localContact.whatsapp || ''));
                setBirthday(localContact.birthday || '');
                setZipCode(localContact.zip_code || '');
                setStreet(localContact.street || '');
                setNumber(localContact.number || '');
                setComplement(localContact.complement || '');
                setNeighborhood(localContact.neighborhood || '');
                setCity(localContact.city || '');
                setState(localContact.state || '');
                notify('info', 'Contato Encontrado', 'Os dados foram preenchidos a partir de um contato existente.');
                return;
            }

            // 2. For PJ, if not found locally, fetch from BrasilAPI
            if (entityType === 'PJ') {
                const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.razao_social || data.nome_fantasia) {
                        setName(data.razao_social || data.nome_fantasia || '');
                    }
                    if (data.email) setEmail(data.email);
                    if (data.telefone) {
                        const cleanTel = formatPhoneFromDB(data.telefone);
                        setPhone(cleanTel);
                        setWhatsapp(cleanTel);
                    }
                    if (data.cep) setZipCode(data.cep);
                    if (data.logradouro) setStreet(data.logradouro);
                    if (data.bairro) setNeighborhood(data.bairro);
                    if (data.municipio) setCity(data.municipio);
                    if (data.uf) setState(data.uf);
                    if (data.numero && data.numero !== 'S/N') setNumber(data.numero);
                    if (data.complemento) setComplement(data.complemento);
                    notify('success', 'CNPJ Encontrado', 'Dados cadastrais importados com sucesso.');
                }
            }
        } catch (err) {
            console.error('Error looking up tax ID:', err);
        } finally {
            setIsFetchingTaxId(false);
        }
    };

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setType(initialData.type);
            const entType = initialData.entity_type || 'PF';
            setEntityType(entType);
            setEmail(initialData.email || '');
            setPhone(formatPhoneFromDB(initialData.phone));
            setWhatsapp(formatPhoneFromDB(initialData.whatsapp));
            
            if (entType === 'PJ') {
                setCnpj(formatCNPJ(initialData.tax_id || ''));
                setCpf('');
            } else {
                setCpf(formatCPF(initialData.tax_id || ''));
                setCnpj('');
            }

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
                    .select('plan_id, service_id, status, next_due_at, custom_price')
                    .eq('contact_id', initialData.id)
                    .eq('company_id', currentEntity.id)
                    .in('status', ['active', 'past_due', 'trialing', 'pending'])
                    .maybeSingle();
                
                if (data) {
                    setIsRecorrenteEnabled(true);
                    if (data.plan_id) {
                        setRecorrenteType('plan');
                        setLoyaltyPlanId(data.plan_id);
                        setLoyaltyServiceId('');
                        setCustomPrice('');
                    } else if (data.service_id) {
                        setRecorrenteType('service');
                        setLoyaltyServiceId(data.service_id);
                        setLoyaltyPlanId('');
                        setCustomPrice('');
                    } else {
                        setRecorrenteType('custom');
                        setLoyaltyPlanId('');
                        setLoyaltyServiceId('');
                        setCustomPrice(data.custom_price ? String(data.custom_price) : '');
                    }
                    if (data.next_due_at) {
                        setNextDueAt(data.next_due_at.substring(0, 10));
                    }
                } else {
                    setIsRecorrenteEnabled(false);
                    setRecorrenteType('none');
                    setLoyaltyPlanId('');
                    setLoyaltyServiceId('');
                    setCustomPrice('');
                    setNextDueAt('');
                }
            };
            fetchLoyalty();
        } else {
            setName('');
            setType('client');
            setEntityType('PF');
            setEmail('');
            setPhone('');
            setWhatsapp('');
            setCpf('');
            setCnpj('');
            setBirthday('');
            setZipCode('');
            setStreet('');
            setNumber('');
            setComplement('');
            setNeighborhood('');
            setCity('');
            setState('');
            setIsRecorrenteEnabled(false);
            setRecorrenteType('none');
            setLoyaltyPlanId('');
            setLoyaltyServiceId('');
            setCustomPrice('');
            setNextDueAt('');
            setGenerateGatewayLink(false);
            setCheckoutUrl('');
        }
    }, [initialData, isOpen, currentEntity.id]);

    const { clearCache } = useAutoSave(
        'contact_form',
        { name, type, entityType, email, phone, whatsapp, cpf, cnpj, birthday, zipCode, street, number, complement, neighborhood, city, state },
        {
            name: setName, type: setType as any, entityType: setEntityType as any, email: setEmail, phone: setPhone, whatsapp: setWhatsapp,
            cpf: setCpf, cnpj: setCnpj, birthday: setBirthday, zipCode: setZipCode, street: setStreet,
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
            const finalTaxId = entityType === 'PF' ? cpf : cnpj;

            const savedContact = await onSubmit({
                name,
                type,
                entity_type: entityType,
                email: email || null,
                phone: finalPhone || null,
                whatsapp: finalWhatsapp || null,
                tax_id: finalTaxId || null,
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
                if (isRecorrenteEnabled && recorrenteType === 'plan' && loyaltyPlanId) {
                    if (generateGatewayLink) {
                        if (!phone && !whatsapp) {
                            setLoading(false);
                            notify('warning', 'É necessário um telefone ou WhatsApp para gerar a cobrança no gateway.', 'Dados Faltando');
                            return;
                        }
                        if (!finalTaxId) {
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
                        if (nextDueAt) {
                            // First upsert to make sure we have the subscription
                            const { error: rpcError } = await supabase
                                .rpc('upsert_loyalty_subscription', {
                                    p_company_id: currentEntity.id,
                                    p_contact_id: contactId,
                                    p_plan_id: loyaltyPlanId,
                                    p_status: 'active',
                                    p_next_due_at: nextDueAt
                                });
                            if (rpcError) throw rpcError;
                            
                            // Explicit update to force matching fields and clean other paths
                            await supabase
                                .from('loyalty_subscriptions')
                                .update({ next_due_at: nextDueAt, custom_price: null, service_id: null })
                                .eq('contact_id', contactId)
                                .eq('company_id', currentEntity.id)
                                .in('status', ['active', 'past_due', 'trialing', 'pending']);
                        } else {
                            const { error: rpcError } = await supabase
                                .rpc('upsert_loyalty_subscription', {
                                    p_company_id: currentEntity.id,
                                    p_contact_id: contactId,
                                    p_plan_id: loyaltyPlanId,
                                    p_status: 'active'
                                });
                            
                            if (rpcError) throw rpcError;

                            await supabase
                                .from('loyalty_subscriptions')
                                .update({ custom_price: null, service_id: null })
                                .eq('contact_id', contactId)
                                .eq('company_id', currentEntity.id);
                        }
                        notify('success', 'Plano vinculado com sucesso!', 'Clube de Fidelidade');
                    }
                } else if (isRecorrenteEnabled && recorrenteType === 'service' && loyaltyServiceId) {
                    // Link to catalog service
                    const { error: upsertError } = await supabase
                        .from('loyalty_subscriptions')
                        .upsert({
                            company_id: currentEntity.id,
                            contact_id: contactId,
                            plan_id: null,
                            service_id: loyaltyServiceId,
                            status: 'active',
                            next_due_at: nextDueAt || null,
                            custom_price: null
                        }, { onConflict: 'company_id,contact_id' });

                    if (upsertError) throw upsertError;
                    notify('success', 'Serviço recorrente vinculado com sucesso!', 'Clube de Fidelidade');
                } else if (isRecorrenteEnabled && recorrenteType === 'custom') {
                    // Custom recurring price
                    const priceValue = customPrice ? parseFloat(customPrice) : 0;
                    const { error: upsertError } = await supabase
                        .from('loyalty_subscriptions')
                        .upsert({
                            company_id: currentEntity.id,
                            contact_id: contactId,
                            plan_id: null,
                            service_id: null,
                            status: 'active',
                            next_due_at: nextDueAt || null,
                            custom_price: priceValue
                        }, { onConflict: 'company_id,contact_id' });

                    if (upsertError) throw upsertError;
                    notify('success', 'Faturamento recorrente customizado configurado com sucesso!', 'Clube de Fidelidade');
                } else {
                    // Canceled / No Recorrente
                    await supabase
                        .from('loyalty_subscriptions')
                        .update({ status: 'canceled' })
                        .eq('contact_id', contactId)
                        .eq('company_id', currentEntity.id)
                        .in('status', ['active', 'past_due', 'trialing', 'pending']);
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
                {/* Entity Type Selector */}
                <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-fit mb-2">
                    <button
                        type="button"
                        onClick={() => setEntityType('PF')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${entityType === 'PF'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        🧑 Pessoa Física (PF)
                    </button>
                    <button
                        type="button"
                        onClick={() => setEntityType('PJ')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${entityType === 'PJ'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        🏢 Pessoa Jurídica (PJ)
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label={entityType === 'PF' ? "Nome Completo *" : "Razão Social *"}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder={entityType === 'PF' ? "Nome do cliente ou fornecedor" : "Nome da empresa"}
                    />

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Contato</label>
                        <select
                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                            value={type}
                            onChange={e => setType(e.target.value as 'client' | 'supplier' | 'both')}
                        >
                            <option value="client">Cliente</option>
                            <option value="supplier">Fornecedor</option>
                            <option value="both">Ambos (Cliente e Fornecedor)</option>
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
                        label={entityType === 'PF' ? "CPF" : "CNPJ"}
                        value={entityType === 'PF' ? cpf : cnpj}
                        onChange={e => {
                            const val = e.target.value;
                            if (entityType === 'PF') {
                                setCpf(formatCPF(val));
                            } else {
                                setCnpj(formatCNPJ(val));
                            }
                        }}
                        onBlur={e => handleTaxIdLookup(e.target.value)}
                        placeholder={entityType === 'PF' ? "000.000.000-00" : "00.000.000/0000-00"}
                        rightElement={
                            <button
                                type="button"
                                onClick={() => handleTaxIdLookup(entityType === 'PF' ? cpf : cnpj)}
                                disabled={isFetchingTaxId}
                                className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-50 transition-colors"
                                title="Buscar dados"
                            >
                                <Search size={16} className={isFetchingTaxId ? "animate-spin" : ""} />
                            </button>
                        }
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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2">
                                <Award size={18} />
                                Faturamento Recorrente
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    {isRecorrenteEnabled ? 'Ativado' : 'Desativado'}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isRecorrenteEnabled}
                                    onClick={() => {
                                        const nextState = !isRecorrenteEnabled;
                                        setIsRecorrenteEnabled(nextState);
                                        if (!nextState) {
                                            setRecorrenteType('none');
                                        } else if (recorrenteType === 'none') {
                                            setRecorrenteType('plan');
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        isRecorrenteEnabled ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            isRecorrenteEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {isRecorrenteEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex flex-col gap-1.5 mb-4">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Recorrência</label>
                                    <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-slate-800/80 p-1 rounded-xl border border-gray-200/60 dark:border-slate-700/60">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRecorrenteType('plan');
                                                setLoyaltyServiceId('');
                                            }}
                                            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                                                recorrenteType === 'plan'
                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                            }`}
                                        >
                                            Plano
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRecorrenteType('service');
                                                setLoyaltyPlanId('');
                                            }}
                                            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                                                recorrenteType === 'service'
                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                            }`}
                                        >
                                            Serviço
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRecorrenteType('custom');
                                                setLoyaltyPlanId('');
                                                setLoyaltyServiceId('');
                                            }}
                                            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                                                recorrenteType === 'custom'
                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                            }`}
                                        >
                                            Personalizado
                                        </button>
                                    </div>
                                </div>

                        {recorrenteType === 'plan' && (
                            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Plano Vinculado</label>
                                    <select
                                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                        value={loyaltyPlanId}
                                        onChange={e => setLoyaltyPlanId(e.target.value)}
                                    >
                                        <option value="">Selecione um plano...</option>
                                        {plans.filter(p => p.is_active).map(plan => (
                                            <option key={plan.id} value={plan.id}>{plan.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {loyaltyPlanId && (
                                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vencimento da Assinatura</label>
                                        <input
                                            type="date"
                                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                            value={nextDueAt}
                                            onChange={e => setNextDueAt(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {recorrenteType === 'service' && (
                            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Serviço do Catálogo</label>
                                    <select
                                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                        value={loyaltyServiceId}
                                        onChange={e => setLoyaltyServiceId(e.target.value)}
                                    >
                                        <option value="">Selecione um serviço...</option>
                                        {services.map(srv => (
                                            <option key={srv.id} value={srv.id}>
                                                {srv.name} (R$ {srv.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {loyaltyServiceId && (
                                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vencimento da Assinatura</label>
                                        <input
                                            type="date"
                                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                            value={nextDueAt}
                                            onChange={e => setNextDueAt(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {recorrenteType === 'custom' && (
                            <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in duration-200">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vencimento da Assinatura</label>
                                    <input
                                        type="date"
                                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                        value={nextDueAt}
                                        onChange={e => setNextDueAt(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Recorrente (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0,00"
                                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600"
                                        value={customPrice}
                                        onChange={e => setCustomPrice(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {recorrenteType === 'plan' && loyaltyPlanId && (
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
