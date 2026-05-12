import { useState, useEffect } from 'react';
import { AlertCircle, Receipt, Plus, Trash2, Globe, ShieldCheck, Mail, MessageCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useEntity } from '../../context/EntityContext';
import { useContacts } from '../../hooks/useContacts';
import { fiscalService } from '../../services/fiscalService';
import { whatsappService } from '../../services/whatsappService';
import { supabase } from '../../lib/supabase';
import { useCompanies } from '../../hooks/useCompanies';
import { ResultModal } from '../ui/ResultModal';

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
    cnae?: string;
    taxationCode?: string;
    issAliquota?: string;
    issExigibilidade?: string;
    issTipo?: string;
}

export function StandaloneInvoiceModal({ onClose, onSuccess }: StandaloneInvoiceModalProps) {
    const { currentEntity } = useEntity();
    const { contacts } = useContacts();
    const { companies } = useCompanies();
    const currentCompany = companies.find(c => c.id === currentEntity.id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorDetail, setErrorDetail] = useState('');
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });
    
    // Form State
    const [contactId, setContactId] = useState('');
    const [type, setType] = useState<'nfse' | 'nfe'>('nfse');
    const [cityCode, setCityCode] = useState('3106200');
    const [items, setItems] = useState<InvoiceItem[]>([
        { id: crypto.randomUUID(), description: '', taxCode: '', amount: '', quantity: 1 }
    ]);
    const [sendEmail, setSendEmail] = useState(false);
    const [sendWhatsApp, setSendWhatsApp] = useState(false);

    // Auto-fill for Sandbox/Homologação
    useEffect(() => {
        const config = currentCompany?.tecnospeed_config;
        const isHomolog = config?.ambiente === 'homologacao' || config?.use_test_data;
        const isNacional = config?.nfse?.config?.nfseNacional;

        if (config) {
            setSendEmail(config.send_email_automatically || false);
            setSendWhatsApp(config.send_whatsapp_automatically || false);
        }

        if (isHomolog) {
            console.log('🛠️ [FISCAL] Preenchendo campos de teste (Homologação ativa)');
            setCityCode('4115200'); // Maringá (TecnoSpeed)
            
            setItems(prev => prev.map((item, idx) => {
                // Só preenche o primeiro item se estiver vazio
                if (idx === 0 && (!item.taxCode || item.taxCode === '')) {
                    if (type === 'nfse') {
                        // NFSe Nacional exige 6 dígitos, NFSe Municipal geralmente 4 (01.01)
                        return { 
                            ...item, 
                            taxCode: isNacional ? (config.default_taxation_code || '010101') : (config.default_taxation_code || '01.01'),
                            cnae: config.default_cnae || '7490104',
                            taxationCode: config.default_taxation_code || (isNacional ? '010101' : '01.01'),
                            issAliquota: config.default_iss_aliquota || '3',
                            issExigibilidade: config.default_iss_exigibilidade || '1',
                            issTipo: config.default_iss_tipo || '7'
                        };
                    } else {
                        return { ...item, taxCode: '84713019' };
                    }
                }
                return item;
            }));
        } else if (config) {
            // Se não for homologação, mas tivermos configurações padrão, preenchemos também
            setItems(prev => prev.map((item, idx) => {
                if (idx === 0 && (!item.taxCode || item.taxCode === '')) {
                    if (type === 'nfse') {
                        return { 
                            ...item, 
                            taxCode: config.default_taxation_code || (isNacional ? '010101' : '01.01'),
                            cnae: config.default_cnae || '',
                            taxationCode: config.default_taxation_code || '',
                            issAliquota: config.default_iss_aliquota || '',
                            issExigibilidade: config.default_iss_exigibilidade || '1',
                            issTipo: config.default_iss_tipo || '7'
                        };
                    }
                }
                return item;
            }));
        }
    }, [currentCompany, type]);

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
                        
                        const item: any = {
                            codigo: i.taxCode,
                            descricao: i.description,
                            valor: {
                                servico: isNaN(val) ? 0 : val,
                                descontoCondicionado: 0,
                                descontoIncondicionado: 0
                            },
                            quantidade: i.quantity,
                            itemListaServico: i.taxCode.includes('.') ? i.taxCode : '01.01'
                        };

                        // Campos Avançados
                        if (i.cnae) item.cnae = i.cnae.replace(/\D/g, '');
                        if (i.taxationCode) item.codigoTributacao = i.taxationCode;
                        
                        if (i.issAliquota || i.issExigibilidade || i.issTipo) {
                            item.iss = {
                                aliquota: parseFloat(i.issAliquota || '0'),
                                exigibilidade: parseInt(i.issExigibilidade || '1'),
                                tipoTributacao: parseInt(i.issTipo || '7')
                            };
                        }

                        return item;
                    })
                };
                if (sendEmail) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [contact.email]
                        }
                    };
                }
                console.log('📤 [FRONTEND] Payload NFSe:', JSON.stringify(payload, null, 2));
                const response = await fiscalService.emitirNFSe(currentEntity.id!, payload, token);
                
                // Envio de WhatsApp se habilitado
                if (sendWhatsApp && contact.phone) {
                    try {
                        const message = `Olá ${contact.name}! Sua Nota Fiscal de Serviço foi emitida com sucesso. Você receberá o documento em breve no seu e-mail.`;
                        await whatsappService.sendMessage(currentEntity.id!, contact.phone, message);
                    } catch (wsError) {
                        console.error('❌ [WHATSAPP] Erro ao enviar notificação:', wsError);
                    }
                }
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

                if (sendEmail) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [contact.email]
                        }
                    };
                }

                console.log('📤 [FRONTEND] Payload NFe:', JSON.stringify(payload, null, 2));
                const response = await fiscalService.emitirNFe(currentEntity.id!, payload, token);

                // Envio de WhatsApp se habilitado
                if (sendWhatsApp && contact.phone) {
                    try {
                        const message = `Olá ${contact.name}! Sua Nota Fiscal de Produto foi emitida com sucesso. Você receberá o documento em breve no seu e-mail.`;
                        await whatsappService.sendMessage(currentEntity.id!, contact.phone, message);
                    } catch (wsError) {
                        console.error('❌ [WHATSAPP] Erro ao enviar notificação:', wsError);
                    }
                }
            }

            setResultModal({
                isOpen: true,
                title: 'Nota Emitida!',
                message: 'A nota fiscal avulsa foi gerada com sucesso e aparecerá na listagem com status "Processando" em instantes.',
                type: 'success'
            });
            // We don't close immediately to let user see the result if they want, 
            // but usually onSuccess handles the refresh and closure.
            // In this case, we'll wait for user to close the result modal.
            // So we'll call onSuccess() only after ResultModal is closed.
            // Or better, we call it now but keep our modal state until result is closed.
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
                    <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-[2rem] border border-rose-100 dark:border-rose-900/20 animate-in shake duration-500">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                                <AlertCircle size={20} className="text-rose-600 dark:text-rose-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Falha na Emissão</p>
                                <p className="text-xs text-rose-600/80 dark:text-rose-400/60 mt-1 font-medium leading-relaxed">
                                    {error}
                                </p>
                                {errorDetail && (
                                    <div className="mt-3 pt-3 border-t border-rose-200/30 dark:border-rose-900/30 font-mono text-[10px] text-rose-500/70 break-all bg-white/30 dark:bg-black/20 p-2 rounded-lg">
                                        DETALHE TÉCNICO: {errorDetail}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {currentCompany?.tecnospeed_config?.ambiente === 'producao' && !currentCompany?.tecnospeed_config?.certificado_enviado && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-[2rem] border border-amber-100 dark:border-amber-900/20">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                                <AlertCircle className="text-amber-600 dark:text-amber-400" size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Certificado Digital Requerido</p>
                                <p className="text-xs text-amber-700/80 dark:text-amber-400/60 mt-1 leading-relaxed">
                                    Você está operando em ambiente de <strong>PRODUÇÃO</strong>. A emissão de notas fiscais reais exige um certificado digital válido vinculado à sua empresa.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {currentCompany?.tecnospeed_config?.nfse?.config?.nfseNacional && type === 'nfse' && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-3xl border border-blue-100 dark:border-blue-900/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Globe size={18} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wider">Padrão Nacional Ativo</p>
                            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/60 font-medium">Esta nota será emitida seguindo o novo padrão nacional (NFSe-N).</p>
                        </div>
                    </div>
                )}

                {/* Resumo Fiscal da Empresa */}
                {type === 'nfse' && currentCompany?.tecnospeed_config && (
                    <div className="bg-gray-50/50 dark:bg-slate-800/30 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configuração Fiscal Ativa:</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800">
                                <span className="text-[9px] font-medium text-gray-400">CNAE:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">
                                    {currentCompany.tecnospeed_config.default_cnae || (currentCompany.tecnospeed_config.ambiente === 'homologacao' ? '7490104' : 'N/A')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800">
                                <span className="text-[9px] font-medium text-gray-400">ISS:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">
                                    {currentCompany.tecnospeed_config.default_iss_aliquota || (currentCompany.tecnospeed_config.ambiente === 'homologacao' ? '3' : '0')}%
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800">
                                <span className="text-[9px] font-medium text-gray-400">Exigibilidade:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300 uppercase">
                                    {currentCompany.tecnospeed_config.default_iss_exigibilidade === '1' ? 'Exigível' : 
                                     currentCompany.tecnospeed_config.default_iss_exigibilidade === '2' ? 'Não Incidência' :
                                     currentCompany.tecnospeed_config.default_iss_exigibilidade === '3' ? 'Isenção' :
                                     currentCompany.tecnospeed_config.default_iss_exigibilidade === '4' ? 'Exportação' :
                                     currentCompany.tecnospeed_config.default_iss_exigibilidade === '5' ? 'Imunidade' :
                                     currentCompany.tecnospeed_config.default_iss_exigibilidade === '6' ? 'Susp. Judicial' :
                                     currentCompany.tecnospeed_config.default_iss_exigibilidade === '7' ? 'Susp. Admin' : 'Exigível'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-gray-100 dark:border-slate-800">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tipo de Nota</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full h-12 px-4 rounded-2xl border-2 border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-0 transition-all outline-none"
                            required
                        >
                            <option value="nfse">NFS-e (Serviço)</option>
                            <option value="nfe">NF-e (Produto)</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Cliente / Destinatário</label>
                        <select
                            value={contactId}
                            onChange={(e) => setContactId(e.target.value)}
                            className="w-full h-12 px-4 rounded-2xl border-2 border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-0 transition-all outline-none"
                            required
                        >
                            <option value="">Selecione um cliente...</option>
                            {contacts.map(c => (
                                <option key={c.id} value={c.id}>{c.name} {c.tax_id ? `(${c.tax_id})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <Input
                            label="Código IBGE da Cidade (Onde o serviço/venda ocorre)"
                            value={cityCode}
                            onChange={(e: any) => setCityCode(e.target.value)}
                            placeholder="Ex: 3106200"
                            required
                            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm"
                        />
                    </div>
                </div>

                <div className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <Plus size={16} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Itens da Nota ({items.length})
                            </h3>
                        </div>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={addItem} 
                            className="h-9 px-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-[10px] uppercase tracking-widest"
                        >
                            <Plus size={14} className="mr-1" /> Adicionar Item
                        </Button>
                    </div>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {items.map((item) => (
                            <div key={item.id} className="p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/20 space-y-4 relative group">
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="absolute top-4 right-4 p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                        Descrição do {type === 'nfse' ? 'Serviço' : 'Produto'}
                                    </label>
                                    <Input
                                        value={item.description}
                                        onChange={(e: any) => updateItem(item.id, 'description', e.target.value)}
                                        placeholder="Ex: Consultoria Técnica Mensal"
                                        required
                                        className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm h-11"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                            {type === 'nfse' ? 'Cód. Municipal' : 'NCM'}
                                        </label>
                                        <Input
                                            value={item.taxCode}
                                            onChange={(e: any) => updateItem(item.id, 'taxCode', e.target.value)}
                                            placeholder={type === 'nfse' ? (currentCompany?.tecnospeed_config?.nfse?.config?.nfseNacional ? '010101 (6 dígitos)' : '01.01') : '84713019'}
                                            required
                                            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm h-11"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Valor Unitário</label>
                                        <Input
                                            type="text"
                                            value={item.amount}
                                            onChange={(e: any) => updateItem(item.id, 'amount', e.target.value)}
                                            placeholder="0,00"
                                            required
                                            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm h-11"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Quantidade</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e: any) => updateItem(item.id, 'quantity', parseInt(e.target.value))}
                                            required
                                            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm h-11"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Controles de Automação */}
                <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex flex-wrap gap-4">
                        <div 
                            className={`flex-1 min-w-[200px] p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                sendEmail 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30'
                            }`}
                            onClick={() => setSendEmail(!sendEmail)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${sendEmail ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}>
                                    <Mail size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">E-mail</p>
                                    <p className="text-xs font-black text-gray-700 dark:text-white leading-none">Automático</p>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={sendEmail} 
                                readOnly
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>

                        <div 
                            className={`flex-1 min-w-[200px] p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                sendWhatsApp 
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                                : 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30'
                            }`}
                            onClick={() => setSendWhatsApp(!sendWhatsApp)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${sendWhatsApp ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}>
                                    <MessageCircle size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">WhatsApp</p>
                                    <p className="text-xs font-black text-gray-700 dark:text-white leading-none">Automático</p>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={sendWhatsApp} 
                                readOnly
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex flex-col items-center md:items-start">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Valor Total da Emissão</span>
                        <span className="font-black text-3xl text-blue-600 dark:text-blue-400 tracking-tighter">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                items.reduce((acc, i) => acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.') || '0') * i.quantity), 0)
                            )}
                        </span>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={onClose} 
                            disabled={loading}
                            className="flex-1 md:flex-none h-14 px-8 rounded-2xl font-bold text-gray-500 text-sm"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            variant="primary" 
                            isLoading={loading} 
                            className="flex-1 md:flex-none h-14 px-10 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 rounded-2xl font-bold text-sm tracking-wide"
                        >
                            {loading ? 'Processando...' : 'Confirmar Emissão'}
                        </Button>
                    </div>
                </div>
            </form>

            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => {
                    setResultModal(prev => ({ ...prev, isOpen: false }));
                    if (resultModal.type === 'success') {
                        onClose();
                    }
                }}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
            />
        </Modal>
    );
}

