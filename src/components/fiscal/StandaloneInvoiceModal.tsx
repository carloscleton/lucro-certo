import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Receipt, Plus, Trash2, Globe, ShieldCheck, Mail, MessageCircle, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useEntity } from '../../context/EntityContext';
import { useContacts } from '../../hooks/useContacts';
import { ContactForm } from '../contacts/ContactForm';
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
    initialData?: any;
    initialType?: 'nfse' | 'nfe';
    initialNotes?: string;
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

export function StandaloneInvoiceModal({ onClose, onSuccess, initialData, initialType, initialNotes }: StandaloneInvoiceModalProps) {
    const { currentEntity, availableEntities, switchEntity } = useEntity();
    const { contacts, addContact, updateContact } = useContacts();
    const { companies } = useCompanies();
    const { services } = useServices();
    const { products } = useProducts();
    const currentCompany = companies.find(c => c.id === currentEntity.id);

    const companyEntities = availableEntities.filter(e => e.type === 'company');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorDetail, setErrorDetail] = useState('');
    const [resultModal, setResultModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
        data?: any;
        action?: {
            label: string;
            onClick: () => void;
        };
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success'
    });
    
    // Form State
    const [contactId, setContactId] = useState(initialData?.contactId || '');
    const [type, setType] = useState<'nfse' | 'nfe'>(initialType || 'nfse');
    const [cityCode, setCityCode] = useState(initialData?.cityCode || '3106200');
    const [items, setItems] = useState<InvoiceItem[]>(initialData?.items || [
        { id: crypto.randomUUID(), description: '', taxCode: '', amount: '', quantity: 1 }
    ]);
    const [showContactModal, setShowContactModal] = useState(false);
    const [editingContact, setEditingContact] = useState<any>(null);

    const selectedContact = useMemo(() => {
        return contacts.find(c => c.id === contactId);
    }, [contacts, contactId]);

    const contactValidation = useMemo(() => {
        if (!selectedContact) return null;
        
        const missingFields: string[] = [];
        if (!selectedContact.tax_id) {
            missingFields.push(selectedContact.entity_type === 'PJ' ? 'CNPJ' : 'CPF');
        }
        if (!selectedContact.zip_code) missingFields.push('CEP');
        if (!selectedContact.street) missingFields.push('Logradouro');
        if (!selectedContact.neighborhood) missingFields.push('Bairro');
        if (!selectedContact.city) missingFields.push('Cidade');
        if (!selectedContact.state) missingFields.push('UF');

        if (missingFields.length > 0) {
            return {
                isValid: false,
                message: `Dados obrigatórios para emissão estão ausentes: ${missingFields.join(', ')}.`,
                missingFields
            };
        }
        return { isValid: true };
    }, [selectedContact]);

    const handleContactSubmit = async (contactData: any) => {
        try {
            let contactResult;
            if (editingContact?.id) {
                contactResult = await updateContact(editingContact.id, {
                    name: contactData.name,
                    type: contactData.type,
                    entity_type: contactData.entity_type,
                    email: contactData.email || '',
                    phone: contactData.phone || '',
                    whatsapp: contactData.whatsapp || '',
                    tax_id: contactData.tax_id || '',
                    zip_code: contactData.zip_code || '',
                    street: contactData.street || '',
                    number: contactData.number || '',
                    complement: contactData.complement || '',
                    neighborhood: contactData.neighborhood || '',
                    city: contactData.city || '',
                    state: contactData.state || '',
                    birthday: contactData.birthday || null
                });
            } else {
                contactResult = await addContact({
                    name: contactData.name,
                    type: contactData.type,
                    entity_type: contactData.entity_type,
                    email: contactData.email || '',
                    phone: contactData.phone || '',
                    whatsapp: contactData.whatsapp || '',
                    tax_id: contactData.tax_id || '',
                    zip_code: contactData.zip_code || '',
                    street: contactData.street || '',
                    number: contactData.number || '',
                    complement: contactData.complement || '',
                    neighborhood: contactData.neighborhood || '',
                    city: contactData.city || '',
                    state: contactData.state || '',
                    birthday: contactData.birthday || null
                });
            }
            
            const finalId = editingContact?.id || contactResult?.id;
            if (finalId) {
                setContactId(finalId);
                setShowContactModal(false);
                setEditingContact(null);
            }
        } catch (error) {
            console.error('Error saving contact:', error);
        }
    };
    const [sendEmail, setSendEmail] = useState(false);
    const [sendWhatsApp, setSendWhatsApp] = useState(false);
    const [waInstances, setWaInstances] = useState<any[]>([]);
    const [notes, setNotes] = useState(initialNotes || '');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Reset contact selection when switching companies
    useEffect(() => {
        setContactId('');
    }, [currentEntity.id]);

    const activeProvider = currentCompany?.settings?.fiscal_provider || 'tecnospeed';

    const config = useMemo(() => {
        if (activeProvider === 'nfeio') {
            const nfe = currentCompany?.settings?.nfeio_config || {};
            const tecno = currentCompany?.tecnospeed_config || {};
            return {
                ...nfe,
                cnpj: currentCompany?.cnpj || '',
                inscricao_municipal: nfe.inscricaoMunicipal || '',
                regime_tributario: nfe.simplesNacional ? '1' : '3',
                simples_nacional_aliquota: nfe.aliquotaIss || '0',
                default_iss_aliquota: nfe.aliquotaIss || '0',
                default_cnae: nfe.cnae || '',
                default_taxation_code: nfe.cityServiceCode || '',
                default_pis_aliquota: tecno.default_pis_aliquota || '',
                default_cofins_aliquota: tecno.default_cofins_aliquota || '',
                default_csll_aliquota: tecno.default_csll_aliquota || '',
                default_irrf_aliquota: tecno.default_irrf_aliquota || '',
                endereco: {
                    codigoCidade: nfe.codigoCidade || tecno?.endereco?.codigoCidade || ''
                },
                ambiente: nfe.ambiente || 'homologacao',
                send_email_automatically: nfe.send_email_automatically || false,
                send_whatsapp_automatically: nfe.send_whatsapp_automatically || false
            } as any;
        }
        return currentCompany?.tecnospeed_config as any;
    }, [currentCompany, activeProvider]);

    const isNacional = activeProvider === 'nfeio' ? false : (config?.nfse_nacional || config?.nfse?.config?.nfseNacional || false);
    const isRegimeNormal = config?.regime_tributario === '3';

    // Auto-fill from Config
    useEffect(() => {
        if (!config) return;

        setSendEmail(config.send_email_automatically || false);
        setSendWhatsApp(config.send_whatsapp_automatically || false);
        
        // Código da Cidade (IBGE) do endereço da empresa
        if (config.endereco?.codigoCidade) {
            setCityCode(config.endereco.codigoCidade);
        }

        const isHomolog = config?.ambiente === 'homologacao' || config?.use_test_data;

        setItems(prev => prev.map((item, idx) => {
            // Só preenche se o item estiver vazio
            if (idx === 0 && (!item.taxCode || item.taxCode === '')) {
                const isSimples = config.regime_tributario === '1' || config.regime_tributario === '2' || config.regime_tributario === '4';
                const defaultIss = isSimples ? (config.simples_nacional_aliquota || '0') : (config.default_iss_aliquota || '3');

                if (type === 'nfse') {
                    // Mapeamento Inteligente de Códigos
                    const natCode = config.default_taxation_code?.replace(/\D/g, '').substring(0, 9) || '';

                    return { 
                        ...item, 
                        taxCode: isNacional ? natCode : (config.default_taxation_code || ''),
                        cnae: config.default_cnae || '',
                        taxationCode: isNacional ? natCode : '',
                        codigoTributacaoNacional: isNacional ? natCode : '',
                        issAliquota: defaultIss,
                        issExigibilidade: config.default_iss_exigibilidade || '1',
                        issTipo: config.default_iss_tipo || '7',
                        // Retenções
                        pisAliquota: config.default_pis_aliquota || '',
                        cofinsAliquota: config.default_cofins_aliquota || '',
                        csllAliquota: config.default_csll_aliquota || '',
                        irrfAliquota: config.default_irrf_aliquota || ''
                    };
                } else {
                    return { ...item, taxCode: isHomolog ? '84713019' : '' };
                }
            }
            return item;
        }));
    }, [config, type, currentEntity.id]);

    useEffect(() => {
        if (activeProvider === 'nfeio' && type !== 'nfse') {
            setType('nfse');
        }
    }, [activeProvider, type]);

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

    const calculatedTaxes = useMemo(() => {
        let totalBruto = 0;
        let totalIss = 0;
        let totalPis = 0;
        let totalCofins = 0;
        let totalCsll = 0;
        let totalIr = 0;

        const isSimples = ['1', '2', '4'].includes(config?.regime_tributario || '');

        items.forEach(item => {
            const itemAmount = parseFloat(item.amount.replace(/\./g, '').replace(',', '.') || '0') * item.quantity;
            totalBruto += itemAmount;

            // ISS
            const issRate = parseFloat(item.issAliquota || (isSimples ? (config?.simples_nacional_aliquota || '0') : (config?.default_iss_aliquota || '0')));
            totalIss += itemAmount * (issRate / 100);

            if (!isSimples) {
                // PIS
                const pisRate = parseFloat(item.pisAliquota || config?.default_pis_aliquota || '0.65');
                totalPis += itemAmount * (pisRate / 100);

                // COFINS
                const cofinsRate = parseFloat(item.cofinsAliquota || config?.default_cofins_aliquota || '3');
                totalCofins += itemAmount * (cofinsRate / 100);

                // CSLL
                const csllRate = parseFloat(item.csllAliquota || config?.default_csll_aliquota || '1');
                totalCsll += itemAmount * (csllRate / 100);

                // IRRF
                const irrfRate = parseFloat(item.irrfAliquota || config?.default_irrf_aliquota || '1.5');
                totalIr += itemAmount * (irrfRate / 100);
            }
        });

        const totalRetencoes = totalPis + totalCofins + totalCsll + totalIr;
        const liquido = totalBruto - totalRetencoes;

        return {
            totalBruto,
            totalIss,
            totalPis,
            totalCofins,
            totalCsll,
            totalIr,
            totalRetencoes,
            liquido,
            isSimples
        };
    }, [items, config]);

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
        try {
            // console.log('🎉 [showSuccessMessage] Chamado com result:', JSON.stringify(result, null, 2));
            const invoiceId = result.id || result.protocolo || result.data?.id || result.documents?.[0]?.id || 'N/A';
            const links = wrapFiscalLinks(result, currentEntity.id!, token);

            // Injeção manual de links se concluído ou processando e temos um ID
            if (invoiceId && invoiceId !== 'N/A') {
                const base = API_BASE_URL.replace(/\/$/, '');
                const tokenPart = token ? `&token=${token}` : '';
                const typeVal = type || 'nfse';
                if (!links.pdf) {
                    links.pdf = `${base}/fiscal-module/${typeVal}/${invoiceId}/pdf?companyId=${currentEntity.id}${tokenPart}`;
                }
                if (!links.xml) {
                    links.xml = `${base}/fiscal-module/${typeVal}/${invoiceId}/xml?companyId=${currentEntity.id}${tokenPart}`;
                }
            }

            // console.log('🔗 [showSuccessMessage] Links processados:', JSON.stringify(links, null, 2));

            const isProcessing = result.isProcessing || result.status === 'EM_PROCESSAMENTO' || (result.message && result.message.includes('processamento'));

            setResultModal({
                isOpen: true,
                title: isProcessing ? 'Nota em Processamento' : 'Emissão Concluída',
                message: isProcessing 
                    ? 'A nota foi enviada e está na fila da prefeitura. Aguarde alguns instantes e verifique o status novamente.'
                    : 'A nota fiscal foi emitida com sucesso!',
                type: 'success',
                data: links,
                action: isProcessing && invoiceId !== 'N/A' ? {
                    label: 'Verificar Status Agora',
                    onClick: () => handleCheckStatus(invoiceId, token)
                } : undefined
            });
        } catch (err) {
            console.error('❌ [showSuccessMessage] Erro ao preparar modal de sucesso:', err);
            setResultModal({
                isOpen: true,
                title: 'Emissão Concluída',
                message: 'A nota foi enviada com sucesso, mas houve um erro ao processar os links de visualização.',
                type: 'success',
                data: result
            });
        }
    };

    const handleCheckStatus = async (invoiceId: string, token?: string) => {
        try {
            setLoading(true);
            const { data: sessionData } = await supabase.auth.getSession();
            const activeToken = token || sessionData.session?.access_token;
            
            if (!activeToken) return;

            const result = await fiscalService.checkStatus(invoiceId, currentEntity.id!, activeToken);
            // console.log('🔄 [CHECK-STATUS] Resultado da consulta:', result);
            
            showSuccessMessage(result, activeToken);
        } catch (err) {
            console.error('❌ [CHECK-STATUS] Erro ao consultar status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setErrorDetail('');

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
            setError('Sessão expirada. Faça login novamente.');
            setLoading(false);
            return;
        }

        if (!contactId || items.some(i => !i.description || !i.amount || !i.taxCode)) {
            setError('Preencha todos os campos obrigatórios de todos os itens.');
            return;
        }

        const contact = contacts.find(c => c.id === contactId);
        if (!contact) {
            setError('Selecione um cliente válido.');
            return;
        }
        if (!contact.tax_id) {
            setError('O cliente selecionado não possui CPF/CNPJ cadastrado.');
            return;
        }
        if (!contact.zip_code || !contact.street || !contact.neighborhood || !contact.city || !contact.state) {
            setError('O cliente selecionado possui dados de endereço incompletos (CEP, logradouro, bairro, cidade, estado são obrigatórios para emissão).');
            return;
        }

        if (!currentCompany) {
            setError('Empresa não encontrada.');
            return;
        }

        if (activeProvider === 'nfeio') {
            const nfeioConfig = currentCompany?.settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                setError('Configurações da NFe.io não encontradas ou incompletas.');
                return;
            }
        } else {
            if (!currentCompany.tecnospeed_config) {
                setError('Configurações fiscais da empresa (TecnoSpeed) não encontradas.');
                return;
            }
        }

        if (activeProvider === 'nfeio' && type === 'nfe') {
            setError('O emissor NFe.io está configurado apenas para NFS-e (Serviço). Para emitir NF-e (Produto), use a TecnoSpeed.');
            return;
        }

        const isNacional = activeProvider === 'nfeio' ? false : (currentCompany.tecnospeed_config.nfse_nacional || currentCompany.tecnospeed_config.nfse?.config?.nfseNacional || false);

        if (type === 'nfse' && isNacional) {
            if (items.length > 1) {
                setError('O padrão NFS-e Nacional permite apenas 1 item de serviço por nota fiscal. Remova os outros itens para prosseguir.');
                return;
            }
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
            let payload: any;
            const totalAmount = items.reduce((acc, i) => {
                const clean = (i.amount || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                const parsed = parseFloat(clean);
                const val = isNaN(parsed) ? 0 : parsed;
                return acc + (val * i.quantity);
            }, 0);

            if (type === 'nfse') {
                const companyCityCode = config?.endereco?.codigoCidade || config?.codigo_municipio || '3106200';
                
                payload = {
                    idIntegracao: `AVULSA_${Date.now()}`,
                    codigoIbge: companyCityCode,
                    prestador: {
                        cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || config?.cnpj?.replace(/\D/g, ''),
                        inscricaoMunicipal: config?.inscricao_municipal?.replace(/\D/g, '') || config?.inscricaoMunicipal?.replace(/\D/g, ''),
                        regimeTributario: parseInt(config?.regime_tributario || '1'),
                        // Define regime especial automático se for Simples (6) ou MEI (5)
                        regimeEspecialTributacao: config?.regime_tributario === '1' || config?.regime_tributario === '2' ? 6 : 
                                                 config?.regime_tributario === '4' ? 5 : 
                                                 parseInt(config?.default_regime_especial || '0')
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
                            cidade: contact.city || '',
                            descricaoCidade: contact.city || '',
                            uf: contact.state || ''
                        }
                    },
                    servico: items.map(i => {
                        const cleanValue = i.amount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                        const val = parseFloat(cleanValue);
                        const numVal = isNaN(val) ? 0 : val;
                        const totalVal = numVal * i.quantity;
                        
                        const formattedUnit = numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const formattedTotal = totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const descSuffix = i.quantity > 1 ? ` (${i.quantity} x R$ ${formattedUnit} = R$ ${formattedTotal})` : '';

                        const item: any = {
                            codigo: isNacional ? (i.taxCode?.replace(/\D/g, '').substring(0, 6)) : i.taxCode,
                            codigoIbge: companyCityCode,
                            discriminacao: `${i.description}${descSuffix}`,
                            valor: {
                                servico: totalVal,
                                descontoCondicionado: 0,
                                descontoIncondicionado: 0
                            },
                            quantidade: 1,
                            itemListaServico: i.taxCode.includes('.') ? i.taxCode : '01.01'
                        };

                        if (i.cnae) {
                            item.cnae = String(i.cnae).replace(/\D/g, '').substring(0, 7);
                        }
                        
                        if (isNacional) {
                            const rawNatCode = i.codigoTributacaoNacional || i.taxationCode || '';
                            const cleanNatCode = String(rawNatCode).replace(/\D/g, '').trim();
                            const cleanMunCode = String(i.taxCode || '').replace(/\D/g, '').trim();
                            
                            if (cleanMunCode) {
                                item.codigoTributacao = cleanMunCode;
                            }

                            if (cleanNatCode) {
                                const finalNatCode = cleanNatCode.substring(0, 9).padEnd(9, '0');
                                item.codigoTributacaoNacional = finalNatCode;
                            }
                            
                            item.codigo = cleanMunCode.substring(0, 6).padEnd(6, '0');
                            
                            if (cleanMunCode.length >= 4) {
                                item.itemListaServico = cleanMunCode.substring(0, 2) + '.' + cleanMunCode.substring(2, 4);
                            } else {
                                item.itemListaServico = '01.01';
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
 
                        if (i.pisAliquota || i.cofinsAliquota || i.csllAliquota || i.irrfAliquota || i.inssAliquota) {
                            item.pis = { aliquota: parseFloat(i.pisAliquota || '0') };
                            item.cofins = { aliquota: parseFloat(i.cofinsAliquota || '0') };
                            item.csll = { aliquota: parseFloat(i.csllAliquota || '0') };
                            item.ir = { aliquota: parseFloat(i.irrfAliquota || '0') };
                            item.inss = { aliquota: parseFloat(i.inssAliquota || '0') };
                        }

                        // Aplicação automática das configurações de Simples Nacional se disponíveis
                        const configFiscal = config;
                        if (configFiscal) {
                            if (configFiscal.simples_nacional_aliquota) {
                                if (!item.valor) item.valor = {};
                                if (!item.valor.aliquota) { 
                                    item.valor.aliquota = parseFloat(configFiscal.simples_nacional_aliquota);
                                }
                            }
                            if (configFiscal.pis_cofins_situacao_tributaria) {
                                item.pis = { situacaoTributaria: configFiscal.pis_cofins_situacao_tributaria };
                                item.cofins = { situacaoTributaria: configFiscal.pis_cofins_situacao_tributaria };
                            }
                        }

                        return item;
                    })
                };

                if (config.default_regime_especial && config.default_regime_especial !== '0') {
                    payload.prestador.regimeEspecialTributacao = parseInt(config.default_regime_especial);
                }

                if (notes) {
                    payload.informacoesComplementares = notes.replace(/\n/g, '|');
                }

                if (sendEmail) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [contact.email]
                        }
                    };
                }
                // console.log('📤 [FRONTEND] Payload NFSe:', JSON.stringify(payload, null, 2));
                const result = await fiscalService.emitirNFSe(
                    currentEntity.id!,
                    payload,
                    token,
                    undefined,
                    false,
                    activeProvider
                );
                
                // Extrair ID com suporte a múltiplos formatos (documents[0] ou raiz)
                const externalId = result.data?.id || result.id || result.documents?.[0]?.id;
                let finalPayloadToSave = result.data || result;

                if (externalId) {
                    try {
                        // Tentar buscar o payload completo imediatamente para gravar no banco
                        console.log(`🔄 [DB-SAVE] Buscando dados completos da nota ${externalId}...`);
                        const fullStatus = await fiscalService.checkStatus(externalId, currentEntity.id!, token);
                        if (fullStatus && Object.keys(fullStatus).length > 2) {
                            finalPayloadToSave = fullStatus;
                            console.log(`✅ [DB-SAVE] Dados completos obtidos com sucesso.`);
                        }
                    } catch (statusErr) {
                        console.warn('⚠️ [DB-SAVE] Não foi possível buscar o status completo imediatamente. Usando retorno da emissão.', statusErr);
                    }

                    try {
                        console.log(`💾 [DB-SAVE] Iniciando gravação da nota ${externalId}...`);
                        
                        let realCompanyId = currentEntity.id;
                        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realCompanyId || '');

                        if (currentEntity.cnpj && (!realCompanyId || !isUUID)) {
                            console.log(`🔍 [DB-SAVE] Resolvendo UUID via CNPJ: ${currentEntity.cnpj}`);
                            const cleanCnpj = currentEntity.cnpj.replace(/\D/g, '');
                            
                            const { data: compData } = await supabase
                                .from('companies')
                                .select('id')
                                .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${currentEntity.cnpj}`)
                                .maybeSingle();
                            
                            if (compData?.id) {
                                realCompanyId = compData.id;
                                console.log(`🎯 [DB-SAVE] UUID resolvido: ${realCompanyId}`);
                            } else {
                                console.warn(`⚠️ [DB-SAVE] Não foi possível resolver UUID para o CNPJ ${currentEntity.cnpj}. Usando ID original.`);
                            }
                        }

                        // Só tenta inserir se for um UUID válido
                        const finalIsUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realCompanyId || '');
                        
                        if (finalIsUUID) {
                            // Verificar se já existe no banco (salvo pelo backend)
                            const { data: existingInv } = await supabase
                                .from('fiscal_invoices')
                                .select('id')
                                .eq('external_id', externalId)
                                .maybeSingle();

                            if (existingInv?.id) {
                                console.log(`💾 [DB-SAVE] Nota ${externalId} já existe. Atualizando status...`);
                                const { error: dbError } = await supabase
                                    .from('fiscal_invoices')
                                    .update({
                                        status: finalPayloadToSave.status || finalPayloadToSave.situacao || 'processando',
                                        payload: {
                                            ...finalPayloadToSave,
                                            send_whatsapp: sendWhatsApp
                                        }
                                    })
                                    .eq('id', existingInv.id);
                                if (dbError) console.error('❌ [DB-SAVE] Erro no update:', dbError);
                            } else {
                                console.log(`💾 [DB-SAVE] Inserindo nova nota ${externalId}...`);
                                const { error: dbError } = await supabase.from('fiscal_invoices').insert({
                                    company_id: realCompanyId,
                                    external_id: externalId,
                                    type: activeProvider === 'nfeio' ? 'nfeio' : (isNacional ? 'nfsenac' : 'nfse'),
                                    status: finalPayloadToSave.status || finalPayloadToSave.situacao || 'processando',
                                    payload: {
                                        ...payload,
                                        retorno: finalPayloadToSave,
                                        send_whatsapp: sendWhatsApp
                                    }
                                });
                                if (dbError) console.error('❌ [DB-SAVE] Erro no insert:', dbError);
                            }
                        } else {
                            console.error(`❌ [DB-SAVE] Abortando gravação: ID da empresa não é um UUID válido (${realCompanyId})`);
                        }

                        console.log('✅ [DB-SAVE] Nota registrada no histórico.');
                    } catch (dbErr: any) {
                        console.error('❌ [DB-SAVE] Erro inesperado na gravação:', dbErr);
                    }
                }

                const recipientPhone = String(contact.whatsapp || contact.phone || '').replace(/\D/g, '');
                const rawStatus = String(result.data?.status || result.data?.situacao || result.status || 'processando').toLowerCase();
                const isAuthorized = ['concluido', 'autorizado', 'emitida', 'sucesso'].includes(rawStatus);
                
                if (sendWhatsApp && recipientPhone) {
                    if (isAuthorized) {
                        try {
                            const instance = waInstances[0];
                            if (instance) {
                                // Gerar link do PDF dinamicamente
                                let apiBase = API_BASE_URL.replace(/\/$/, '');
                                if (apiBase.startsWith('/')) {
                                    apiBase = window.location.origin + apiBase;
                                }
                                // Ignora URLs privadas da TecnoSpeed e força o uso do nosso proxy público
                                const pdfUrl = `${apiBase}/fiscal-module/${type}/${externalId}/pdf?companyId=${currentEntity.id}`;

                                const message = `Olá, *${contact.name}*! 👋\n\nSua Nota Fiscal foi emitida com sucesso.\n\n🔗 *Acesse sua NOTA FISCAL aqui:*\n${pdfUrl}`;
                                await whatsappService.sendMessage({
                                    instanceName: instance.instance_name || instance.name,
                                    token: instance.evolution_instance_id,
                                    number: recipientPhone,
                                    text: message,
                                    mediaUrl: pdfUrl.startsWith('http') ? pdfUrl : undefined,
                                    mediaType: 'document',
                                    mimetype: 'application/pdf',
                                    fileName: `NotaFiscal-${externalId || 'avulsa'}.pdf`,
                                    companyId: currentEntity.id
                                });
                            }
                        } catch (wsError) {
                            console.error('❌ [WHATSAPP] Erro ao enviar notificação:', wsError);
                        }
                    } else {
                        console.log(`⚠️ [WHATSAPP] Nota em processamento (${rawStatus}). O WhatsApp será enviado automaticamente assim que for autorizada pela prefeitura.`);
                    }
                }

                setLoading(false);
                showSuccessMessage(result, token);
                onSuccess();
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
                            cidade: contact.city || '',
                            descricaoCidade: contact.city || '',
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

                // console.log('📤 [FRONTEND] Payload NFe:', JSON.stringify(payload, null, 2));
                const result = await fiscalService.emitirNFe(
                    currentEntity.id!,
                    payload,
                    token,
                    undefined,
                    false,
                    activeProvider
                );

                const externalId = result.data?.id || result.id || result.documents?.[0]?.id;
                let finalPayloadToSave = result.data || result;

                if (externalId) {
                    try {
                        console.log(`🔄 [DB-SAVE] Buscando dados completos da NFe ${externalId}...`);
                        const fullStatus = await fiscalService.checkStatus(externalId, currentEntity.id!, token);
                        if (fullStatus && Object.keys(fullStatus).length > 2) {
                            finalPayloadToSave = fullStatus;
                            console.log(`✅ [DB-SAVE] Dados completos obtidos com sucesso.`);
                        }
                    } catch (statusErr) {
                        console.warn('⚠️ [DB-SAVE] Não foi possível buscar o status completo imediatamente.', statusErr);
                    }

                    try {
                        let realCompanyId = currentEntity.id;
                        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realCompanyId || '');

                        if (currentEntity.cnpj && (!realCompanyId || !isUUID)) {
                            const cleanCnpj = currentEntity.cnpj.replace(/\D/g, '');
                            const { data: compData } = await supabase
                                .from('companies')
                                .select('id')
                                .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${currentEntity.cnpj}`)
                                .maybeSingle();
                            if (compData?.id) realCompanyId = compData.id;
                        }

                        const finalIsUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realCompanyId || '');
                        if (finalIsUUID) {
                            // Verificar se já existe no banco (salvo pelo backend)
                            const { data: existingInv } = await supabase
                                .from('fiscal_invoices')
                                .select('id')
                                .eq('external_id', externalId)
                                .maybeSingle();

                            if (existingInv?.id) {
                                console.log(`💾 [DB-SAVE] NFe ${externalId} já existe. Atualizando status e payload...`);
                                const { error: dbError } = await supabase
                                    .from('fiscal_invoices')
                                    .update({
                                        status: finalPayloadToSave.status || finalPayloadToSave.situacao || 'processando',
                                        payload: {
                                            ...finalPayloadToSave,
                                            send_whatsapp: sendWhatsApp
                                        }
                                    })
                                    .eq('id', existingInv.id);
                                if (dbError) console.error('❌ [DB-SAVE] Erro no update da NFe:', dbError);
                            } else {
                                console.log(`💾 [DB-SAVE] Inserindo nova NFe ${externalId}...`);
                                const { error: dbError } = await supabase.from('fiscal_invoices').insert({
                                    company_id: realCompanyId,
                                    external_id: externalId,
                                    type: 'nfe',
                                    status: finalPayloadToSave.status || finalPayloadToSave.situacao || 'processando',
                                    payload: {
                                        ...finalPayloadToSave,
                                        send_whatsapp: sendWhatsApp
                                    }
                                });
                                if (dbError) console.error('❌ [DB-SAVE] Erro no insert da NFe:', dbError);
                            }
                        }
                    } catch (dbErr) {
                        console.error('❌ [DB-SAVE] Erro na gravação da NFe:', dbErr);
                    }
                }

                const recipientPhone = String(contact.whatsapp || contact.phone || '').replace(/\D/g, '');
                const rawStatus = String(result.data?.status || result.data?.situacao || result.status || 'processando').toLowerCase();
                const isAuthorized = ['concluido', 'autorizado', 'emitida', 'sucesso'].includes(rawStatus);

                if (sendWhatsApp && recipientPhone) {
                    if (isAuthorized) {
                        try {
                        const instance = waInstances[0];
                        if (instance) {
                            // Gerar link do PDF dinamicamente
                            let apiBase = API_BASE_URL.replace(/\/$/, '');
                            if (apiBase.startsWith('/')) {
                                apiBase = window.location.origin + apiBase;
                            }
                            // Ignora URLs privadas da TecnoSpeed e força o uso do nosso proxy público
                            const pdfUrl = `${apiBase}/fiscal-module/${type}/${externalId}/pdf?companyId=${currentEntity.id}`;

                            const message = `Olá, *${contact.name}*! 👋\n\nSua Nota Fiscal foi emitida com sucesso.\n\n🔗 *Acesse sua NOTA FISCAL aqui:*\n${pdfUrl}`;
                            await whatsappService.sendMessage({
                                instanceName: instance.instance_name || instance.name,
                                token: instance.evolution_instance_id,
                                number: recipientPhone,
                                text: message,
                                mediaUrl: pdfUrl.startsWith('http') ? pdfUrl : undefined,
                                mediaType: 'document',
                                mimetype: 'application/pdf',
                                fileName: `NotaFiscal-${externalId || 'avulsa'}.pdf`,
                                companyId: currentEntity.id
                            });
                        }
                        } catch (wsError) {
                            console.error('❌ [WHATSAPP] Erro ao enviar notificação:', wsError);
                        }
                    } else {
                        console.log(`⚠️ [WHATSAPP] Nota em processamento (${rawStatus}). O WhatsApp será enviado automaticamente assim que for autorizada pela prefeitura.`);
                    }
                }
                
                showSuccessMessage(result);
                onSuccess();
            }
        } catch (error: any) {
            console.error('❌ Erro na emissão:', error);
            const isAlreadyEmitted = error.response?.status === 409;
            
            if (isAlreadyEmitted) {
                const existingData = error.response?.data?.error?.data?.current || error.response?.data?.data || error.response?.data;
                const externalId = existingData?.id || existingData?.idIntegracao || existingData?.documents?.[0]?.id;
                
                if (externalId && currentEntity.id) {
                    try {
                        let realCompanyId = currentEntity.id;
                        if (currentEntity.cnpj) {
                            const cleanCnpj = currentEntity.cnpj.replace(/\D/g, '');
                            const { data: compData } = await supabase
                                .from('companies')
                                .select('id')
                                .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${currentEntity.cnpj}`)
                                .maybeSingle();
                            
                            if (compData?.id) {
                                realCompanyId = compData.id;
                            }
                        }

                        const finalIsUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realCompanyId || '');
                        
                        if (finalIsUUID) {
                            // Verificar se já existe no banco
                            const { data: existingInv } = await supabase
                                .from('fiscal_invoices')
                                .select('id')
                                .eq('external_id', externalId)
                                .maybeSingle();

                            if (existingInv?.id) {
                                console.log(`💾 [409-DB] Nota ${externalId} já existe. Atualizando status para concluido...`);
                                await supabase
                                    .from('fiscal_invoices')
                                    .update({ status: 'concluido' })
                                    .eq('id', existingInv.id);
                            } else {
                                console.log(`💾 [409-DB] Inserindo nova nota de conflito ${externalId}...`);
                                await supabase.from('fiscal_invoices').insert({
                                    company_id: realCompanyId,
                                    external_id: externalId,
                                    type: type,
                                    status: 'concluido',
                                    payload: {}
                                });
                            }
                        } else {
                            console.error(`❌ [409-DB] Abortando: ID da empresa não é um UUID válido (${realCompanyId})`);
                        }
                        
                        onSuccess();
                        onClose();
                        return;
                    } catch (dbErr) {
                        console.error('❌ [409-DB] Erro:', dbErr);
                        // No erro 409, mesmo que a gravação falhe, mostramos a mensagem de sucesso com os dados existentes
                        showSuccessMessage(error.response?.data?.data || {}, token);
                        return;
                    }
                }
                
                showSuccessMessage(error.response?.data?.data || {}, token);
                return;
            }

            const rawErrorMsg = typeof error.response?.data?.error === 'string'
                ? error.response.data.error
                : (error.response?.data?.error?.message || error.response?.data?.message || error.message);
            setError(rawErrorMsg);
            
            const detail = error.response?.data?.detail || error.response?.data || error.message;
            setErrorDetail(typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail);
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

                {activeProvider === 'tecnospeed' && config?.ambiente === 'producao' && !config?.certificado_enviado && (
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

                {activeProvider === 'tecnospeed' && config?.nfse?.config?.nfseNacional && type === 'nfse' && (
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
                {type === 'nfse' && config && (
                    <div className="bg-gray-50/50 dark:bg-slate-800/30 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configuração Fiscal Ativa:</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="Emissor Ativo">
                                <span className="text-[9px] font-medium text-gray-400">Emissor:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300 uppercase">
                                    {activeProvider === 'nfeio' ? 'NFe.io' : activeProvider === 'other' ? 'Webhook' : 'TecnoSpeed'}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="CNAE Padrão">
                                <span className="text-[9px] font-medium text-gray-400">CNAE:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">
                                    {config.default_cnae || (config.ambiente === 'homologacao' ? '7490104' : 'N/A')}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="Alíquota ISS / Simples">
                                <span className="text-[9px] font-medium text-gray-400">ISS:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">
                                    { (config.regime_tributario === '1' || config.regime_tributario === '2' || config.regime_tributario === '4') 
                                        ? (config.simples_nacional_aliquota || '0') 
                                        : (config.default_iss_aliquota || (config.ambiente === 'homologacao' ? '3' : '0')) }%
                                </span>
                            </div>

                            {/* Retenções Federais — PIS / COFINS / CSLL / IRRF */}
                            {(() => {
                                const isSimples = ['1', '2', '4'].includes(config.regime_tributario || '');
                                return (
                                    <>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="PIS">
                                            <span className="text-[9px] font-medium text-gray-400">PIS:</span>
                                            <span className={`text-[9px] font-bold ${isSimples ? 'text-amber-500' : 'text-violet-600 dark:text-violet-400'}`}>
                                                {isSimples ? 'SN' : `${config.default_pis_aliquota || '0.65'}%`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="COFINS">
                                            <span className="text-[9px] font-medium text-gray-400">COFINS:</span>
                                            <span className={`text-[9px] font-bold ${isSimples ? 'text-amber-500' : 'text-blue-600 dark:text-blue-400'}`}>
                                                {isSimples ? 'SN' : `${config.default_cofins_aliquota || '3'}%`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="CSLL">
                                            <span className="text-[9px] font-medium text-gray-400">CSLL:</span>
                                            <span className={`text-[9px] font-bold ${isSimples ? 'text-amber-500' : 'text-orange-600 dark:text-orange-400'}`}>
                                                {isSimples ? 'SN' : `${config.default_csll_aliquota || '1'}%`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800" title="IRRF">
                                            <span className="text-[9px] font-medium text-gray-400">IRRF:</span>
                                            <span className={`text-[9px] font-bold ${isSimples ? 'text-amber-500' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {isSimples ? 'SN' : `${config.default_irrf_aliquota || '1.5'}%`}
                                            </span>
                                        </div>
                                    </>
                                );
                            })()}

                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800">
                                <span className="text-[9px] font-medium text-gray-400">Regime:</span>
                                <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300 uppercase">
                                    {config.regime_tributario === '1' ? 'Simples' : 
                                     config.regime_tributario === '2' ? 'Simples (Exc)' :
                                     config.regime_tributario === '3' ? 'Normal' :
                                     config.regime_tributario === '4' ? 'MEI' : 
                                     config.regime_tributario === '5' ? 'Profissional' : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-gray-100 dark:border-slate-800">
                    {companyEntities.length > 1 && (
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Empresa Emissora</label>
                            <select
                                value={currentEntity.id || ''}
                                onChange={(e) => {
                                    const targetEntity = availableEntities.find(x => x.id === e.target.value);
                                    if (targetEntity) {
                                        switchEntity(targetEntity);
                                    }
                                }}
                                className="w-full h-12 px-4 rounded-2xl border-2 border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-0 transition-all outline-none"
                                required
                            >
                                {companyEntities.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.cnpj ? `(CNPJ: ${c.cnpj})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tipo de Nota</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full h-12 px-4 rounded-2xl border-2 border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-0 transition-all outline-none"
                            required
                            disabled={activeProvider === 'nfeio'}
                        >
                            <option value="nfse">NFS-e (Serviço)</option>
                            {activeProvider !== 'nfeio' && <option value="nfe">NF-e (Produto)</option>}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cliente / Destinatário</label>
                            <div className="flex items-center gap-3">
                                {contactId && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setEditingContact(contacts.find(c => c.id === contactId) || null);
                                            setShowContactModal(true);
                                        }} 
                                        className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-0.5"
                                        title="Editar cliente selecionado"
                                    >
                                        <Pencil size={12} /> Editar
                                    </button>
                                )}
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setEditingContact(null);
                                        setShowContactModal(true);
                                    }} 
                                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-0.5"
                                >
                                    <Plus size={12} /> Novo
                                </button>
                            </div>
                        </div>
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
                        {contactValidation && !contactValidation.isValid && (
                            <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-100 dark:border-amber-950/10 text-xs mt-1.5 animate-fadeIn">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">{contactValidation.message}</p>
                                    <p className="text-[10px] opacity-80 mt-0.5">Clique em "Editar" para preencher esses dados antes de emitir a nota.</p>
                                </div>
                            </div>
                        )}
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
                        {type === 'nfse' && isNacional ? (
                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 rounded-xl border border-amber-100 dark:border-amber-950/10 uppercase tracking-widest leading-none">
                                Limite: 1 item p/ NFS-e Nacional
                            </span>
                        ) : (
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={addItem} 
                                className="h-9 px-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-[10px] uppercase tracking-widest"
                            >
                                <Plus size={14} className="mr-1" /> Adicionar Item
                            </Button>
                        )}
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
                                </div>
                                {isRegimeNormal && (
                                    <>
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
                                    </>
                                )}
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

                {/* Resumo Financeiro / Tributário para Clareza do Usuário */}
                {type === 'nfse' && (
                    <div className="bg-gray-50/50 dark:bg-slate-800/20 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-3.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                            Detalhamento Financeiro Estimado
                        </span>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-600 dark:text-gray-400">
                            <div className="flex justify-between border-b border-gray-100 dark:border-slate-800/40 pb-1.5">
                                <span>Total dos Serviços (Bruto):</span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalBruto)}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 dark:border-slate-800/40 pb-1.5" title="ISS pago pela empresa ou retido na fonte">
                                <span>ISS Estimado:</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalIss)}
                                </span>
                            </div>
                        </div>

                        {!calculatedTaxes.isSimples && (
                            <div className="bg-white dark:bg-slate-900/40 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800/60 space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-amber-500 uppercase tracking-wider border-b border-amber-50 dark:border-amber-950/20 pb-1.5">
                                    <span>Retenções Federais Deduções</span>
                                    <span>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalRetencoes)}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] text-gray-500">
                                    <div className="flex justify-between">
                                        <span>PIS:</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalPis)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>COFINS:</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalCofins)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>CSLL:</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalCsll)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>IRRF:</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalIr)}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-normal font-medium mt-1">
                                    * Retenções federais ocorrem quando o cliente é Pessoa Jurídica (PJ). Esses valores são descontados do seu recebimento.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex flex-wrap gap-6 items-center">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Valor Real da Nota (Bruto)</span>
                            <span className="font-black text-2xl text-blue-600 dark:text-blue-400 tracking-tight">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.totalBruto)}
                            </span>
                        </div>
                        
                        {type === 'nfse' && !calculatedTaxes.isSimples && (
                            <div className="flex flex-col border-l border-gray-100 dark:border-slate-800 pl-6">
                                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Valor Líquido a Receber</span>
                                <span className="font-black text-2xl text-emerald-600 dark:text-emerald-400 tracking-tight">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedTaxes.liquido)}
                                </span>
                            </div>
                        )}
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
                        onSuccess();
                        onClose(); // Fecha o modal principal após o sucesso
                    }
                }}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
                data={resultModal.data}
                action={resultModal.action}
            />

            <ContactForm 
                isOpen={showContactModal} 
                onClose={() => {
                    setShowContactModal(false);
                    setEditingContact(null);
                }} 
                onSubmit={handleContactSubmit} 
                initialData={editingContact}
            />
        </Modal>
    );
}

