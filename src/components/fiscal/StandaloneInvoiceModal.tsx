import { useState } from 'react';
import { AlertCircle, Receipt, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useEntity } from '../../context/EntityContext';
import { useContacts } from '../../hooks/useContacts';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { useCompanies } from '../../hooks/useCompanies';

interface StandaloneInvoiceModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface InvoiceItem {
    id: string;
    description: string;
    taxCode: string;
    amount: string;
    quantity: number;
}

export function StandaloneInvoiceModal({ onClose, onSuccess }: StandaloneInvoiceModalProps) {
    const { currentEntity } = useEntity();
    const { contacts } = useContacts();
    const { companies } = useCompanies();
    const currentCompany = companies.find(c => c.id === currentEntity.id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorDetail, setErrorDetail] = useState('');
    
    // Form State
    const [contactId, setContactId] = useState('');
    const [type, setType] = useState<'nfse' | 'nfe'>('nfse');
    const [cityCode, setCityCode] = useState('3106200');
    const [items, setItems] = useState<InvoiceItem[]>([
        { id: crypto.randomUUID(), description: '', taxCode: '', amount: '', quantity: 1 }
    ]);

    const addItem = () => {
        setItems([...items, { id: crypto.randomUUID(), description: '', taxCode: '', amount: '', quantity: 1 }]);
    };

    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setErrorDetail('');

        if (!contactId || items.some(i => !i.description || !i.amount || !i.taxCode)) {
            setError('Preencha todos os campos obrigatórios de todos os itens.');
            return;
        }

        const contact = contacts.find(c => c.id === contactId);
        if (!contact?.tax_id) {
            setError('O cliente selecionado não possui CPF/CNPJ cadastrado.');
            return;
        }

        if (!currentCompany || !currentCompany.tecnospeed_config) {
            setError('Configurações fiscais da empresa não encontradas.');
            return;
        }

        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            let payload: any;
            const totalAmount = items.reduce((acc, i) => acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.')) * i.quantity), 0);

            if (type === 'nfse') {
                payload = {
                    prestador: {
                        cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || currentCompany.tecnospeed_config?.cnpj?.replace(/\D/g, '')
                    },
                    tomador: {
                        cpfCnpj: contact.tax_id.replace(/\D/g, ''),
                        razaoSocial: contact.name,
                        email: contact.email,
                        endereco: {
                            logradouro: contact.street || '',
                            numero: contact.number || 'S/N',
                            bairro: contact.neighborhood || '',
                            cep: contact.zip_code?.replace(/\D/g, ''),
                            codigoCidade: cityCode,
                            uf: contact.state || ''
                        }
                    },
                    servico: items.map(i => {
                        // Converte string "1.234,56" para number 1234.56
                        const cleanValue = i.amount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                        const val = parseFloat(cleanValue);
                        
                        return {
                            codigo: i.taxCode,
                            descricao: i.description,
                            valor: {
                                servico: isNaN(val) ? 0 : val
                            },
                            quantidade: i.quantity,
                            itemListaServico: '01.01'
                        };
                    })
                };
                console.log('📤 [FRONTEND] Payload NFSe:', JSON.stringify(payload, null, 2));
                await fiscalService.emitirNFSe(currentEntity.id!, payload, token);
            } else {
                payload = {
                    presenca: 1,
                    natureza: 'Venda de Mercadoria',
                    destinatario: {
                        cpfCnpj: contact.tax_id.replace(/\D/g, ''),
                        razaoSocial: contact.name,
                        email: contact.email,
                        endereco: {
                            logradouro: contact.street || '',
                            numero: contact.number || 'S/N',
                            bairro: contact.neighborhood || '',
                            cep: contact.zip_code?.replace(/\D/g, ''),
                            codigoCidade: cityCode,
                            uf: contact.state || ''
                        }
                    },
                    itens: items.map((i, idx) => {
                        const cleanValue = i.amount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                        const val = parseFloat(cleanValue);
                        const numVal = isNaN(val) ? 0 : val;
                        
                        return {
                            codigo: String(idx + 1).padStart(3, '0'),
                            descricao: i.description,
                            ncm: i.taxCode.replace(/\D/g, ''),
                            cfop: '5102',
                            valorUnitario: { comercial: numVal },
                            quantidade: { comercial: i.quantity },
                            unidade: { comercial: 'UN' },
                            tributos: {
                                icms: { origem: '0', cst: '00', aliquota: 0 },
                                pis: { cst: '07' },
                                cofins: { cst: '07' }
                            }
                        };
                    }),
                    pagamentos: [
                        { meio: '90', valor: totalAmount }
                    ]
                };
                console.log('📤 [FRONTEND] Payload NFe:', JSON.stringify(payload, null, 2));
                await fiscalService.emitirNFe(currentEntity.id!, payload, token);
            }

            alert('Nota emitida com sucesso! Ela aparecerá na listagem com status "Processando".');
            onSuccess();
        } catch (err: any) {
            console.error('Erro ao emitir avulsa:', err);
            
            const apiError = err.response?.data;
            const detailMessage = apiError?.detail?.message || apiError?.detail?.erros?.[0]?.message || (typeof apiError?.detail === 'string' ? apiError.detail : JSON.stringify(apiError?.detail));
            
            const errorMessage = typeof apiError?.error === 'string' 
                ? apiError.error 
                : (apiError?.error?.message || err.message || 'Erro ao emitir nota fiscal.');

            setError(errorMessage);
            if (detailMessage) {
                setErrorDetail(detailMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Nova Nota Fiscal Avulsa" icon={Receipt} maxWidth="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg flex flex-col gap-1 text-sm border border-red-200">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p className="font-bold">{error}</p>
                        </div>
                        {errorDetail && <p className="ml-6 text-xs opacity-80">{errorDetail}</p>}
                    </div>
                )}

                {currentCompany?.tecnospeed_config?.ambiente === 'producao' && !currentCompany?.tecnospeed_config?.certificado_enviado && (
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
                        <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-sm font-bold">Certificado Digital não detectado!</p>
                            <p className="text-xs opacity-90 mt-1">
                                Você está em ambiente de <strong>PRODUÇÃO</strong>. A emissão de notas reais exige um Certificado Digital A1 válido. 
                                <br />Suba seu certificado nas <strong>Configurações Fiscais</strong> antes de prosseguir.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Nota</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                            required
                        >
                            <option value="nfse">NFS-e (Nota de Serviço)</option>
                            <option value="nfe">NF-e (Nota de Produto)</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                        <select
                            value={contactId}
                            onChange={(e) => setContactId(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                            required
                        >
                            <option value="">Selecione um cliente...</option>
                            {contacts.map(c => (
                                <option key={c.id} value={c.id}>{c.name} {c.tax_id ? `(${c.tax_id})` : '(Sem CPF/CNPJ)'}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <Input
                            label="Cód. IBGE da Cidade (Tomador)"
                            value={cityCode}
                            onChange={(e: any) => setCityCode(e.target.value)}
                            placeholder="Ex: 3106200"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Itens da Nota ({items.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 py-0">
                            <Plus size={14} className="mr-1" /> Add Item
                        </Button>
                    </div>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                        {items.map((item, index) => (
                            <div key={item.id} className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 space-y-3 relative">
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                
                                <Input
                                    label={`Descrição do ${type === 'nfse' ? 'Serviço' : 'Produto'} #${index + 1}`}
                                    value={item.description}
                                    onChange={(e: any) => updateItem(item.id, 'description', e.target.value)}
                                    placeholder="Ex: Consultoria Técnica"
                                    required
                                />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <Input
                                        label={type === 'nfse' ? 'Cód. Municipal' : 'NCM'}
                                        value={item.taxCode}
                                        onChange={(e: any) => updateItem(item.id, 'taxCode', e.target.value)}
                                        placeholder={type === 'nfse' ? '01.01' : '84713019'}
                                        required
                                    />
                                    <Input
                                        label="Valor Unit."
                                        type="text"
                                        value={item.amount}
                                        onChange={(e: any) => updateItem(item.id, 'amount', e.target.value)}
                                        placeholder="0,00"
                                        required
                                    />
                                    <Input
                                        label="Qtd"
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e: any) => updateItem(item.id, 'quantity', parseInt(e.target.value))}
                                        required
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-gray-200 dark:border-slate-700">
                    <div className="text-sm">
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-2 font-bold text-lg text-blue-600 dark:text-blue-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                items.reduce((acc, i) => acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.') || '0') * i.quantity), 0)
                            )}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" isLoading={loading} className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
                            {loading ? 'Emitindo...' : 'Emitir Nota'}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

