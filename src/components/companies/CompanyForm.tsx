import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Building2, Search, MapPin, Upload } from 'lucide-react';
import type { Company } from '../../hooks/useCompanies';
import { useNotification } from '../../context/NotificationContext';

interface CompanyFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Company | null;
}

export function CompanyForm({ isOpen, onClose, onSubmit, initialData }: CompanyFormProps) {
    const { notify } = useNotification();
    const [tradeName, setTradeName] = useState('');
    const [legalName, setLegalName] = useState('');
    const [cnpj, setCnpj] = useState('');

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
            setLogoFile(null);
        } else {
            setTradeName('');
            setLegalName('');
            setCnpj('');
            setZipCode('');
            setStreet('');
            setNumber('');
            setComplement('');
            setNeighborhood('');
            setCity('');
            setState('');
            setLogoUrl('');
            setLogoFile(null);
        }
    }, [initialData, isOpen]);

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
                cnpj,
                zip_code: zipCode || null,
                street: street || null,
                number: number || null,
                complement: complement || null,
                neighborhood: neighborhood || null,
                city: city || null,
                state: state || null,
                logo_url: logoUrl || null,
                logo_file: logoFile,
            });
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
            onClose={onClose}
            title={initialData ? 'Editar Empresa' : 'Nova Empresa'}
            subtitle={initialData ? 'Atualize os dados da sua organização' : 'Cadastre uma nova empresa no sistema'}
            icon={Building2}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Nome Fantasia *"
                        value={tradeName}
                        onChange={e => setTradeName(e.target.value)}
                        required
                        placeholder="Ex: Minha Loja"
                    />

                    <Input
                        label="Razão Social"
                        value={legalName}
                        onChange={e => setLegalName(e.target.value)}
                        placeholder="Ex: Minha Loja Ltda"
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

                    <Input
                        label="CNPJ"
                        value={cnpj}
                        onChange={e => setCnpj(e.target.value)}
                        placeholder="00.000.000/0000-00"
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

                <div className="flex justify-end gap-3 mt-8">
                    <Button type="button" variant="outline" onClick={onClose} className="px-8">
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
