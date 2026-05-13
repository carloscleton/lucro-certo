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
import { useServices } from '../../hooks/useServices';
import { useProducts } from '../../hooks/useProducts';
import { ResultModal } from '../ui/ResultModal';
import { API_BASE_URL } from '../../lib/constants';

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
    codigoTributacaoNacional?: string;
    issAliquota?: string;
    issExigibilidade?: string;
    issTipo?: string;
    pisAliquota?: string;
    cofinsAliquota?: string;
    csllAliquota?: string;
    irrfAliquota?: string;
    inssAliquota?: string;
}

export function StandaloneInvoiceModal({ onClose, onSuccess }: StandaloneInvoiceModalProps) {
    const { currentEntity } = useEntity();
    const { contacts } = useContacts();
    const { companies } = useCompanies();
    const { services } = useServices();
    const { products } = useProducts();
    const currentCompany = companies.find(c => c.id === currentEntity.id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorDetail, setErrorDetail] = useState('');
    const [resultModal, setResultModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
        data?: any;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success'
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
    const [waInstances, setWaInstances] = useState<any[]>([]);
    const [notes, setNotes] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const config = currentCompany?.tecnospeed_config as any;
    const isNacional = config?.nfse_nacional || config?.nfse?.config?.nfseNacional || false;

    // Auto-fill for Sandbox/Homologação
    useEffect(() => {
        const isHomolog = config?.ambiente === 'homologacao' || config?.use_test_data;

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
                            taxCode: isNacional ? (config.default_taxation_code || '010101001') : (config.default_taxation_code || '01.01'),
                            cnae: config.default_cnae || '7490104',
                            taxationCode: isNacional ? (config.default_taxation_code || '010101001') : (config.default_taxation_code || '01.01'),
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
                            taxCode: isNacional ? (config.default_taxation_code || '010101001').replace(/\D/g, '').substring(0, 9) : (config.default_taxation_code || '01.01'),
                            cnae: config.default_cnae || '',
                            taxationCode: isNacional ? (config.default_taxation_code || '010101001').replace(/\D/g, '').substring(0, 9) : (config.default_taxation_code || '01.01'),
                             issAliquota: config.default_iss_aliquota || '',
                             issExigibilidade: config.default_iss_exigibilidade || '1',
                             issTipo: config.default_iss_tipo || '7',
                             pisAliquota: config.default_pis_aliquota || '',
                             cofinsAliquota: config.default_cofins_aliquota || '',
                             csllAliquota: config.default_csll_aliquota || '',
                             irrfAliquota: config.default_irrf_aliquota || ''
                         };
                    }
                }
                return item;
            }));
        }
    }, [currentCompany, type, currentEntity.id]);

    useEffect(() => {
        const fetchWA = async () => {
            const { data } = await supabase
                .from('instances')
                .select('*')
                .eq('status', 'connected');

            if (currentEntity.id) {
                setWaInstances(data?.filter(i => i.company_id === currentEntity.id) || []);
            }
        };
        fetchWA();
    }, [currentEntity.id]);

    const addItem = () => {
        setItems([...items, { id: crypto.randomUUID(), description: '', taxCode: '', amount: '', quantity: 1 }]);
    };

    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(i => {
            if (i.id === id) {
                const updated = { ...i, [field]: value };
                
                // Keep taxationCode in sync with taxCode
                if (field === 'taxCode') {
                    updated.taxationCode = value;
                }

                // If description changed, check for auto-fill
                if (field === 'description') {
                    if (type === 'nfse') {
                        const service = services.find(s => s.name === value);
                        if (service) {
                            updated.taxCode = service.codigo_servico_municipal || service.item_lista_servico || '';
                            updated.taxationCode = service.codigo_servico_municipal || service.item_lista_servico || '';
                            updated.codigoTributacaoNacional = service.codigo_tributacao_nacional || '';
                            updated.amount = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(service.price);
                        }
                    } else {
                        const product = products.find(p => p.name === value);
                        if (product) {
                            updated.taxCode = product.ncm || '';
                            updated.taxationCode = product.ncm || '';
                            updated.amount = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(product.price);
                        }
                    }
                }
                
                return updated;
            }
            return i;
        }));
    };

    const wrapFiscalLinks = (data: any, companyId: string, sessionToken?: string) => {
        if (!data || typeof data !== 'object') return data;
        const newData = Array.isArray(data) ? [...data] : { ...data };
        for (const key in newData) {
            const value = newData[key];
            if (typeof value === 'string' && value.includes('plugnotas.com.br')) {
                const match = value.match(/\/(nfse|nfe|nfce)\/(pdf|xml)\/([a-f0-9]+)/i);
                if (match) {
                    const [_, type, format, id] = match;
                    const base = API_BASE_URL.replace(/\/$/, '');
                    const tokenPart = sessionToken ? `&token=${sessionToken}` : '';
                    newData[key] = `${base}/fiscal-module/${type}/${id}/${format}?companyId=${companyId}${tokenPart}`;
                }
            } else if (typeof value === 'object') {
                newData[key] = wrapFiscalLinks(value, companyId, sessionToken);
            }
        }
        return newData;
    };

    const showSuccessMessage = (result: any, token?: string) => {
        const invoiceId = result.id || result.protocolo || 'N/A';
        setResultModal({
            isOpen: true,
            title: 'Emissão Iniciada',
            message: `A nota fiscal (ID: ${invoiceId}) foi enviada com sucesso e está sendo processada pela prefeitura.`,
            type: 'success',
            data: wrapFiscalLinks(result, currentEntity.id!, token)
        });
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

        const isNacional = currentCompany.tecnospeed_config.nfse_nacional || currentCompany.tecnospeed_config.nfse?.config?.nfseNacional || false;

        if (type === 'nfse' && isNacional) {
            const invalidItem = items.find(i => {
                const code = i.codigoTributacaoNacional || i.taxationCode || i.taxCode;
                return !code || code.replace(/\D/g, '').length !== 9;
            });
            if (invalidItem) {
                setError(`O item "${invalidItem.description}" deve ter um código de tributação de exatamente 9 dígitos para o Padrão Nacional.`);
                return;
            }
        }

        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            let payload: any;
            const totalAmount = items.reduce((acc, i) => acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.')) * i.quantity), 0);

            if (type === 'nfse') {
                const config = currentCompany.tecnospeed_config;
                payload = {
                    idIntegracao: `AVULSA_${Date.now()}`,
                    prestador: {
                        cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || config?.cnpj?.replace(/\D/g, ''),
                        inscricaoMunicipal: config?.inscricao_municipal?.replace(/\D/g, '') || config?.inscricaoMunicipal?.replace(/\D/g, '')
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
                            codigo: isNacional ? (i.taxCode?.replace(/\D/g, '').substring(0, 6)) : i.taxCode,
                            discriminacao: i.description,
                            valor: {
                                servico: isNaN(val) ? 0 : val,
                                descontoCondicionado: 0,
                                descontoIncondicionado: 0
                            },
                            quantidade: i.quantity,
                            itemListaServico: i.taxCode.includes('.') ? i.taxCode : '01.01'
                        };

                        // Campos Avançados
                        if (i.cnae) {
                            item.cnae = String(i.cnae).replace(/\D/g, '').substring(0, 7);
                        }
                        
                        if (isNacional) {
                            // REGRA FLEXÍVEL: 
                            // Se for Maringá no Sandbox ou se o código for curto, mantemos o código original (Legado/Híbrido)
                            // Se for Padrão Nacional puro, o usuário deve digitar os 9 dígitos.
                            const rawNatCode = i.codigoTributacaoNacional || i.taxationCode || '';
                            const cleanNatCode = String(rawNatCode).replace(/\D/g, '').trim();
                            
                            if (cleanNatCode) {
                                // Não forçamos mais padEnd(9, '0') se o código já parece ser municipal (3-4 dígitos)
                                item.codigoTributacao = cleanNatCode;
                            }
                            
                            const cleanMunCode = String(i.taxCode || '').replace(/\D/g, '');
                            
                            // Para Padrão Nacional, o 'codigo' deve ter 6 dígitos
                            item.codigo = cleanMunCode.substring(0, 6).padEnd(6, '0');
                            
                            // itemListaServico formatado (ex: 01.07)
                            if (cleanMunCode.length >= 4) {
                                item.itemListaServico = cleanMunCode.substring(0, 2) + '.' + cleanMunCode.substring(2, 4);
                            } else {
                                item.itemListaServico = '01.01'; // Fallback
                            }
                            
                            item.naturezaOperacao = 1;
                        } else {
                            if (i.taxationCode) {
                                item.codigoTributacao = String(i.taxationCode).replace(/\s/g, '');
                            }
                        }
                        
                        if (i.issAliquota || i.issExigibilidade || i.issTipo) {
                            item.iss = {
                                aliquota: parseFloat(i.issAliquota || '0'),
                                exigibilidade: parseInt(i.issExigibilidade || '1'),
                                tipoTributacao: parseInt(i.issTipo || '7')
                             };
                         }
 
                        // Retenções Federais
                        if (i.pisAliquota || i.cofinsAliquota || i.csllAliquota || i.irrfAliquota || i.inssAliquota) {
                            item.valor = {
                                ...item.valor,
                                pis: { aliquota: parseFloat(i.pisAliquota || '0') },
                                cofins: { aliquota: parseFloat(i.cofinsAliquota || '0') },
                                csll: { aliquota: parseFloat(i.csllAliquota || '0') },
                                ir: { aliquota: parseFloat(i.irrfAliquota || '0') },
                                inss: { aliquota: parseFloat(i.inssAliquota || '0') }
                            };
                        }

                        return item;
                    })
                };

                // Regime Especial de Tributação
                if (config.default_regime_especial && config.default_regime_especial !== '0') {
                    payload.prestador.regimeEspecialTributacao = parseInt(config.default_regime_especial);
                }

                if (notes) {
                    payload.informacoesComplementares = notes;
                }

                if (sendEmail) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [contact.email]
                        }
                    };
                }
                console.log('📤 [FRONTEND] Payload NFSe:', JSON.stringify(payload, null, 2));
                const result = await fiscalService.emitirNFSe(currentEntity.id!, payload, token);
                
                // Envio de WhatsApp se habilitado
                if (sendWhatsApp && contact.phone) {
                    try {
                        const instance = waInstances[0];
                        if (instance) {
                            const message = `Olá ${contact.name}! Sua Nota Fiscal de Serviço foi emitida com sucesso. Você receberá o documento em breve no seu e-mail.`;
                            await whatsappService.sendMessage({
                                instanceName: instance.name,
                                number: contact.phone,
                                text: message
                            });
                        }
                    } catch (wsError) {
                        console.error('❌ [WHATSAPP] Erro ao enviar notificação:', wsError);
                    }
                }
                
                showSuccessMessage(result, token);
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

                if (notes) {
                    payload.informacoesComplementares = {
                        interesseContribuinte: notes
                    };
                }

                if (sendEmail) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [contact.email]
                        }
                    };
                }

                console.log('📤 [FRONTEND] Payload NFe:', JSON.stringify(payload, null, 2));
                const result = await fiscalService.emitirNFe(currentEntity.id!, payload, token);

                // Envio de WhatsApp se habilitado
                if (sendWhatsApp && contact.phone) {
                    try {
                        const instance = waInstances[0];
                        if (instance) {
                            const message = `Olá ${contact.name}! Sua Nota Fiscal de Produto foi emitida com sucesso. Você receberá o documento em breve no seu e-mail.`;
                            await whatsappService.sendMessage({
                                instanceName: instance.name,
                                number: contact.phone,
                                text: message
                            });
                        }
                    } catch (wsError) {
                        console.error('❌ [WHATSAPP] Erro ao enviar notificação:', wsError);
                    }
                }
                
                showSuccessMessage(result);
            }

            onSuccess();
        } catch (error: any) {
            console.error('❌ Erro na emissão:', error);
            const isAlreadyEmitted = error.response?.status === 409;
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            setResultModal({
                isOpen: true,
                title: isAlreadyEmitted ? 'Nota Já Emitida' : 'Erro na Emissão',
                message: isAlreadyEmitted 
                    ? 'Esta nota já foi processada e autorizada anteriormente pela TecnoSpeed.' 
                    : (error.message || 'Erro interno ao tentar emitir a nota fiscal.'),
                type: isAlreadyEmitted ? 'info' : 'error',
                data: wrapFiscalLinks(error.response?.data, currentEntity.id!, token || undefined)
            });
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
                                        placeholder={type === 'nfse' ? "Ex: Consultoria Técnica Mensal" : "Ex: Teclado Mecânico RGB"}
                                        list="invoice-items-list"
                                        required
                                        className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm h-11"
                                    />
                                    <datalist id="invoice-items-list">
                                        {type === 'nfse' ? (
                                            services.map(s => <option key={s.id} value={s.name}>{s.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price)}</option>)
                                        ) : (
                                            products.map(p => <option key={p.id} value={p.name}>{p.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}</option>)
                                        )}
                                    </datalist>
                                </div>

                                <div className={`grid grid-cols-1 ${isNacional && type === 'nfse' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                            {type === 'nfse' ? (isNacional ? 'Cód. Municipal (6)' : 'Cód. Municipal') : 'NCM'}
                                        </label>
                                        <Input
                                            value={item.taxCode}
                                            onChange={(e: any) => updateItem(item.id, 'taxCode', e.target.value)}
                                            placeholder={type === 'nfse' ? (isNacional ? 'Ex: 123456' : 'Ex: 01.01') : '84713019'}
                                            required
                                            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-transparent shadow-sm h-11"
                                        />
                                    </div>

                                    {isNacional && type === 'nfse' && (
                                        <div className="space-y-1.5 animate-in fade-in zoom-in duration-300">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                                Cód. Nacional (9)
                                            </label>
                                            <Input
                                                value={item.codigoTributacaoNacional}
                                                onChange={(e: any) => updateItem(item.id, 'codigoTributacaoNacional', e.target.value)}
                                                placeholder="Ex: 010101001"
                                                required
                                                className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/20 shadow-sm h-11"
                                            />
                                        </div>
                                    )}

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
                                {showAdvanced && (
                                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                                        <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">Retenções de Impostos Federais (%)</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Input
                                                label="PIS"
                                                type="number"
                                                step="0.01"
                                                value={item.pisAliquota}
                                                onChange={(e: any) => updateItem(item.id, 'pisAliquota', e.target.value)}
                                                placeholder="0.65"
                                                className="bg-white dark:bg-slate-900 h-9 text-xs"
                                            />
                                            <Input
                                                label="COFINS"
                                                type="number"
                                                step="0.01"
                                                value={item.cofinsAliquota}
                                                onChange={(e: any) => updateItem(item.id, 'cofinsAliquota', e.target.value)}
                                                placeholder="3.00"
                                                className="bg-white dark:bg-slate-900 h-9 text-xs"
                                            />
                                            <Input
                                                label="CSLL"
                                                type="number"
                                                step="0.01"
                                                value={item.csllAliquota}
                                                onChange={(e: any) => updateItem(item.id, 'csllAliquota', e.target.value)}
                                                placeholder="1.00"
                                                className="bg-white dark:bg-slate-900 h-9 text-xs"
                                            />
                                            <Input
                                                label="IRRF"
                                                type="number"
                                                step="0.01"
                                                value={item.irrfAliquota}
                                                onChange={(e: any) => updateItem(item.id, 'irrfAliquota', e.target.value)}
                                                placeholder="1.50"
                                                className="bg-white dark:bg-slate-900 h-9 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="text-[9px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wider flex items-center gap-1 mt-2"
                                >
                                    {showAdvanced ? 'Ocultar Opções Avançadas' : 'Mostrar Opções Avançadas (Impostos)'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Corpo da Nota / Informações Complementares */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                        Corpo da Nota / Informações Complementares
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalhes adicionais, condições de pagamento, observações fiscais..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-2xl border-2 border-transparent bg-gray-50/50 dark:bg-slate-800/30 text-gray-900 dark:text-white text-sm shadow-sm focus:border-blue-500 focus:ring-0 transition-all outline-none resize-none"
                    />
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
                data={resultModal.data}
            />
        </Modal>
    );
}

