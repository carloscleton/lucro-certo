import { useState } from 'react';
import { AlertCircle, Receipt } from 'lucide-react';
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
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [taxCode, setTaxCode] = useState(''); // NCM or Servico

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setErrorDetail('');

        if (!contactId || !description || !amount || !taxCode) {
            setError('Preencha todos os campos obrigatórios.');
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

            const numAmount = parseFloat(amount.replace(',', '.'));
            let payload: any;

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
                            codigoCidade: '3106200', // BH default for tests
                            uf: contact.state || ''
                        }
                    },
                    servico: [
                        {
                            codigo: taxCode,
                            descricao: description,
                            valorUnitario: numAmount,
                            quantidade: 1,
                            itemListaServico: '01.01' // Default generic service item
                        }
                    ]
                };
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
                            codigoCidade: '3106200',
                            uf: contact.state || ''
                        }
                    },
                    itens: [
                        {
                            codigo: '001',
                            descricao: description,
                            ncm: taxCode.replace(/\D/g, ''),
                            cfop: '5102',
                            valorUnitario: { comercial: numAmount },
                            quantidade: { comercial: 1 },
                            unidade: { comercial: 'UN' },
                            tributos: {
                                icms: { origem: '0', cst: '00', aliquota: 0 },
                                pis: { cst: '07' },
                                cofins: { cst: '07' }
                            }
                        }
                    ],
                    pagamentos: [
                        { meio: '90', valor: numAmount }
                    ]
                };
                await fiscalService.emitirNFe(currentEntity.id!, payload, token);
            }

            alert('Nota emitida com sucesso! Ela aparecerá na listagem com status "Processando".');
            onSuccess();
        } catch (err: any) {
            console.error('Erro ao emitir avulsa:', err);
            
            const apiError = err.response?.data;
            const detailMessage = apiError?.detail?.message || apiError?.detail?.erros?.[0]?.message || JSON.stringify(apiError?.detail);
            
            setError(apiError?.error || err.message || 'Erro ao emitir nota fiscal.');
            if (detailMessage) {
                setErrorDetail(detailMessage);
                console.warn('Detalhe do erro fiscal:', detailMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Nova Nota Fiscal Avulsa" icon={Receipt}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg flex flex-col gap-1 text-sm border border-red-200">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p className="font-bold">{error}</p>
                        </div>
                        {errorDetail && <p className="ml-6 text-xs opacity-80">{errorDetail}</p>}
                    </div>
                )}

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

                <Input
                    label={type === 'nfse' ? 'Descrição do Serviço' : 'Descrição do Produto'}
                    value={description}
                    onChange={(e: any) => setDescription(e.target.value)}
                    placeholder="Ex: Consultoria Técnica ou Notebook Dell"
                    required
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label={type === 'nfse' ? 'Código do Serviço Municipal' : 'NCM'}
                        value={taxCode}
                        onChange={(e: any) => setTaxCode(e.target.value)}
                        placeholder={type === 'nfse' ? 'Ex: 01.01' : 'Ex: 84713019'}
                        helpText={type === 'nfse' ? 'Verifique na prefeitura' : '8 dígitos numéricos'}
                        required
                    />
                    <Input
                        label="Valor Total (R$)"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e: any) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                    />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-gray-200 dark:border-slate-700">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" isLoading={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? 'Emitindo...' : 'Emitir Nota'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
