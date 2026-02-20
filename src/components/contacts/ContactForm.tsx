import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import type { Contact } from '../../hooks/useContacts';

interface ContactFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Contact | null;
}

export function ContactForm({ isOpen, onClose, onSubmit, initialData }: ContactFormProps) {
    const { notify } = useNotification();
    const [name, setName] = useState('');
    const [type, setType] = useState<'client' | 'supplier'>('client');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [taxId, setTaxId] = useState('');

    // Address fields
    const [zipCode, setZipCode] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');

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
            setPhone(initialData.phone || '');
            setTaxId(initialData.tax_id || '');
            setZipCode(initialData.zip_code || '');
            setStreet(initialData.street || '');
            setNumber(initialData.number || '');
            setComplement(initialData.complement || '');
            setNeighborhood(initialData.neighborhood || '');
            setCity(initialData.city || '');
            setState(initialData.state || '');
        } else {
            setName('');
            setType('client');
            setEmail('');
            setPhone('');
            setTaxId('');
            setZipCode('');
            setStreet('');
            setNumber('');
            setComplement('');
            setNeighborhood('');
            setCity('');
            setState('');
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
            // Format phone number: add "55" if not present
            let formattedPhone = phone ? phone.replace(/\D/g, '') : ''; // Remove non-digits
            if (formattedPhone && !formattedPhone.startsWith('55')) {
                formattedPhone = '55' + formattedPhone;
            }

            await onSubmit({
                name,
                type,
                email: email || null,
                phone: formattedPhone || null,
                tax_id: taxId || null,
                zip_code: zipCode || null,
                street: street || null,
                number: number || null,
                complement: complement || null,
                neighborhood: neighborhood || null,
                city: city || null,
                state: state || null,
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
                        label="Telefone / WhatsApp"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                    />

                    <Input
                        label="CPF / CNPJ"
                        value={taxId}
                        onChange={e => setTaxId(e.target.value)}
                        placeholder="000.000.000-00"
                    />
                </div>

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
                    <Button type="button" variant="outline" onClick={onClose} className="px-8">
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
