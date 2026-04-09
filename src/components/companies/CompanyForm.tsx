import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Building2, Search, MapPin, Upload } from 'lucide-react';
import type { Company } from '../../hooks/useCompanies';
import { useNotification } from '../../context/NotificationContext';
import { formatPhoneInput, cleanPhoneNumber, formatPhoneFromDB } from '../../utils/phoneUtils';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useAuth } from '../../context/AuthContext';

interface CompanyFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Company | null;
}

export function CompanyForm({ isOpen, onClose, onSubmit, initialData }: CompanyFormProps) {
    const { notify } = useNotification();
    const { profile } = useAuth();
    const [tradeName, setTradeName] = useState('');
    const [legalName, setLegalName] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [entityType, setEntityType] = useState<'PF' | 'PJ'>('PJ');
    const [cpf, setCpf] = useState('');
    const [slug, setSlug] = useState('');

    // Address fields
    const [zipCode, setZipCode] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);

    const [phone, setPhone] = useState('');
    const [loyaltyModuleEnabled, setLoyaltyModuleEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);
    const [isFetchingCNPJ, setIsFetchingCNPJ] = useState(false);

    // CEP Search State
    const [showCepSearch, setShowCepSearch] = useState(false);
    const [searchState, setSearchState] = useState('');
    const [searchCity, setSearchCity] = useState('');
    const [searchStreet, setSearchStreet] = useState('');
    const [cepResults, setCepResults] = useState<any[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

    const handleCNPJLookup = async (cnpjValue: string) => {
        const clean = cnpjValue.replace(/\D/g, '');
        if (clean.length !== 14) return;

        setIsFetchingCNPJ(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
            if (response.ok) {
                const data = await response.json();
                if (data.razao_social || data.nome_fantasia) {
                    setTradeName(data.nome_fantasia || data.razao_social);
                    setLegalName(data.razao_social || data.nome_fantasia);
                    
                    if (!slug) {
                        const name = data.nome_fantasia || data.razao_social;
                        setSlug(name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                    }
                }
                if (data.cep) setZipCode(data.cep);
                if (data.logradouro) setStreet(data.logradouro);
                if (data.bairro) setNeighborhood(data.bairro);
                if (data.municipio) setCity(data.municipio);
                if (data.uf) setState(data.uf);
                if (data.numero && data.numero !== 'S/N') setNumber(data.numero);
                if (data.complemento) setComplement(data.complemento);
            }
        } catch (err) {
            console.error('Error fetching CNPJ:', err);
        } finally {
            setIsFetchingCNPJ(false);
        }
    };

    useEffect(() => {
        if (initialData) {
            setTradeName(initialData.trade_name || '');
            setLegalName(initialData.legal_name || '');
            setCnpj(initialData.cnpj || '');
            setZipCode(initialData.zip_code || '');
            setStreet(initialData.street || '');
            setNumber(initialData.number || '');
            setComplement(initialData.complement || '');
            setNeighborhood(initialData.neighborhood || '');
            setCity(initialData.city || '');
            setState(initialData.state || '');
            setLogoUrl(initialData.logo_url || '');
            setEntityType(initialData.entity_type || 'PJ');
            setCpf(initialData.cpf || '');
            setSlug(initialData.slug || '');
            setPhone(formatPhoneFromDB(initialData.phone));
            setLoyaltyModuleEnabled(initialData.loyalty_module_enabled || false);
            setLogoFile(null);
        } else if (isOpen) {
            // Pre-fill from profile for new company if open
            const isPFProfile = profile?.user_type === 'PF';
            setTradeName(profile?.full_name || '');
            setLegalName(profile?.full_name || '');
            setEntityType(isPFProfile ? 'PF' : 'PJ');
            
            if (isPFProfile) {
                setCpf(profile?.document || '');
                setCnpj('');
            } else {
                const doc = profile?.document || '';
                setCnpj(doc);
                setCpf('');
                // TRIGER AUTOMATIC LOOKUP IF CNPJ IS PRESENT
                if (doc.replace(/\D/g, '').length === 14) {
                    handleCNPJLookup(doc);
                }
            }
            
            setPhone(profile?.phone ? formatPhoneFromDB(profile.phone) : '');
            
            // Generate slug automatically
            if (profile?.full_name) {
                setSlug(profile.full_name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
            } else {
                setSlug('');
            }

            setZipCode('');
            setStreet('');
            setNumber('');
            setComplement('');
            setNeighborhood('');
            setCity('');
            setState('');
            setLogoUrl('');
            setLoyaltyModuleEnabled(false);
            setLogoFile(null);
        }
    }, [initialData, isOpen, profile]);

    const { clearCache } = useAutoSave(
        'company_form',
        { tradeName, legalName, cnpj, entityType, cpf, zipCode, street, number, complement, neighborhood, city, state, phone, loyaltyModuleEnabled },
        {
            tradeName: setTradeName, legalName: setLegalName, cnpj: setCnpj, entityType: setEntityType as any,
            cpf: setCpf, zipCode: setZipCode, street: setStreet, number: setNumber,
            complement: setComplement, neighborhood: setNeighborhood, city: setCity,
            state: setState, phone: setPhone, loyaltyModuleEnabled: setLoyaltyModuleEnabled
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
            await onSubmit({
                trade_name: tradeName,
                legal_name: legalName,
                cnpj: entityType === 'PJ' ? cnpj : null,
                cpf: entityType === 'PF' ? cpf : null,
                slug: slug || null,
                entity_type: entityType,
                phone: cleanPhoneNumber(phone),
                zip_code: zipCode || null,
                street: street || null,
                number: number || null,
                complement: complement || null,
                neighborhood: neighborhood || null,
                city: city || null,
                state: state || null,
                loyalty_module_enabled: loyaltyModuleEnabled,
                logo_url: logoUrl || null,
                logo_file: logoFile,
            });
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
            title={initialData ? 'Editar Empresa' : 'Nova Empresa'}
            subtitle={initialData ? 'Atualize os dados da sua organização' : 'Cadastre uma nova empresa no sistema'}
            icon={Building2}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Entity Type Selector */}
                <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-fit mb-2">
                    <button
                        type="button"
                        onClick={() => setEntityType('PJ')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${entityType === 'PJ'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        🏢 Pessoa Jurídica (PJ)
                    </button>
                    <button
                        type="button"
                        onClick={() => setEntityType('PF')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${entityType === 'PF'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        🧑 Pessoa Física (PF)
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label={entityType === 'PJ' ? "Nome Fantasia *" : "Apelido / Nome Curto *"}
                        value={tradeName}
                        onChange={e => setTradeName(e.target.value)}
                        required
                        placeholder={entityType === 'PJ' ? "Ex: Minha Loja" : "Como quer ser chamado"}
                        onBlur={() => {
                            if (!slug && tradeName) {
                                setSlug(tradeName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                            }
                        }}
                    />

                    <Input
                        label={entityType === 'PJ' ? "Razão Social" : "Nome Completo *"}
                        value={legalName}
                        onChange={e => setLegalName(e.target.value)}
                        required={entityType === 'PF'}
                        placeholder={entityType === 'PJ' ? "Ex: Minha Loja Ltda" : "Seu nome completo"}
                    />

                    <div className="col-span-1 md:col-span-2">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                Logo da Empresa
                            </label>

                            <div className="flex items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <label className="cursor-pointer bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md py-2 px-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors">
                                            <Upload size={16} />
                                            Escolher Imagem
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setLogoFile(file);
                                                        // Preview
                                                        const url = URL.createObjectURL(file);
                                                        setLogoUrl(url);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {logoUrl && (
                                    <div className="w-24 h-24 border rounded-lg bg-gray-50 flex items-center justify-center p-2">
                                        <img src={logoUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {entityType === 'PJ' ? (
                        <div className="relative">
                            <Input
                                label="CNPJ"
                                value={cnpj}
                                onChange={e => setCnpj(e.target.value)}
                                onBlur={() => handleCNPJLookup(cnpj)}
                                placeholder="00.000.000/0000-00"
                                className={isFetchingCNPJ ? 'opacity-50' : ''}
                            />
                            {isFetchingCNPJ && (
                                <div className="absolute right-3 top-[34px] animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                            )}
                        </div>
                    ) : (
                        <Input
                            label="CPF"
                            value={cpf}
                            onChange={e => setCpf(e.target.value)}
                            placeholder="000.000.000-00"
                        />
                    )}

                    <Input
                        label="Friendly URL (Slug)"
                        value={slug}
                        onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="ex-minha-loja"
                        helpText="Acesso público: lucrocerto.com/clube/[slug]"
                    />

                    <Input
                        label="WhatsApp da Empresa (Para notificações)"
                        value={phone}
                        onChange={e => setPhone(formatPhoneInput(e.target.value))}
                        placeholder="+55 (00) 0 0000-0000"
                        helpText="Número para receber resumos e alertas"
                    />
                </div>

                <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <MapPin size={16} className="text-emerald-500" />
                        Endereço da Empresa
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

                <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                         Módulos de Expansão
                    </h3>

                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                        <div>
                            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">🏆 Clube de Fidelidade</p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">Ativa planos de recorrência e descontos para clientes</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={loyaltyModuleEnabled}
                                onChange={e => setLoyaltyModuleEnabled(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <Button type="button" variant="outline" onClick={handleClose} className="px-8">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                        Salvar Empresa
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
