import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock3, XCircle, RefreshCw, Play, Pause, Calendar, AlertTriangle, CheckSquare, Square, Search, Loader2, FileText, Check, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { fiscalService } from '../../services/fiscalService';
import { whatsappService } from '../../services/whatsappService';
import { useEntity } from '../../context/EntityContext';
import { useCompanies } from '../../hooks/useCompanies';
import { API_BASE_URL } from '../../lib/constants';
import { formatCurrency, parseCurrency } from '../../utils/currencyUtils';
import clsx from 'clsx';

interface BatchInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ChargeWithContact {
    id: string;
    amount: number;
    reference_month: string;
    status: string;
    fiscal_invoice_id: string | null;
    due_date: string;
    contact: {
        id: string;
        name: string;
        type?: 'client' | 'supplier' | 'both';
        tax_id: string | null;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        zip_code: string | null;
        street: string | null;
        number: string | null;
        complement: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
    };
    subscription: {
        id: string;
        plan?: {
            id: string;
            name: string;
            price: number;
        };
        service?: {
            id: string;
            name: string;
            price: number;
            codigo_servico_municipal?: string;
            item_lista_servico?: string;
            codigo_tributacao_nacional?: string;
            description?: string;
        };
    };
}

interface QuickEditData {
    id: string;
    name: string;
    tax_id: string;
    email: string;
    zip_code: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
}

export function BatchInvoiceModal({ isOpen, onClose }: BatchInvoiceModalProps) {
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const activeProvider = currentCompany?.settings?.fiscal_provider || 'tecnospeed';

    const config = useMemo(() => {
        if (!currentCompany) return null;
        if (activeProvider === 'nfeio') {
            const nfe = currentCompany?.settings?.nfeio_config || {};
            const tecno = currentCompany?.tecnospeed_config || {};
            return {
                ...nfe,
                cnpj: currentCompany?.cnpj || '',
                inscricao_municipal: nfe.inscricaoMunicipal || '',
                regime_tributario: nfe.simplesNacional ? '1' : '3',
                simples_nacional_aliquota: nfe.aliquotaIss || '0',
                endereco: tecno?.endereco || nfe?.endereco || {}
            } as any;
        }
        return currentCompany.tecnospeed_config as any;
    }, [currentCompany, activeProvider]);

    const isNacional = activeProvider === 'nfeio' ? false : (config?.nfse_nacional || config?.nfse?.config?.nfseNacional || false);

    // States
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [charges, setCharges] = useState<ChargeWithContact[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'emitted' | 'error' | 'incomplete'>('all');
    const [waInstances, setWaInstances] = useState<any[]>([]);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
    const [tempAmountText, setTempAmountText] = useState('');

    const handleAmountChange = (id: string, newAmount: number) => {
        setCharges(prev => prev.map(c => {
            if (c.id === id) {
                return { ...c, amount: isNaN(newAmount) ? 0 : newAmount };
            }
            return c;
        }));
    };

    // Quick Edit Contact
    const [editingContact, setEditingContact] = useState<QuickEditData | null>(null);
    const [isSavingContact, setIsSavingContact] = useState(false);

    // Batch execution states
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [executionLogs, setExecutionLogs] = useState<Record<string, { status: 'idle' | 'sending' | 'success' | 'error'; message?: string; pdfUrl?: string }>>({});

    // Generate Month Options
    const monthOptions = useMemo(() => {
        const options = [];
        const d = new Date();
        // Generates last 6 months and next 3 months
        for (let i = -6; i <= 3; i++) {
            const temp = new Date(d.getFullYear(), d.getMonth() + i, 1);
            const value = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`;
            const label = temp.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        return options;
    }, []);

    // Load WhatsApp connected instances
    useEffect(() => {
        if (!isOpen || !currentEntity.id) return;
        const fetchWA = async () => {
            const { data } = await supabase
                .from('instances')
                .select('*')
                .eq('status', 'connected');
            setWaInstances(data?.filter(i => i.company_id === currentEntity.id) || []);
        };
        fetchWA();
    }, [isOpen, currentEntity.id]);

    // Load charges for selected month
    const fetchCharges = async () => {
        if (!currentEntity.id) return;
        setIsLoading(true);
        setQueryError(null);
        try {
            // Get UUID for company
            let filterId = currentEntity.id;
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filterId || '');
            if (currentEntity.cnpj && (!filterId || !isUUID)) {
                const cleanCnpj = currentEntity.cnpj.replace(/\D/g, '');
                const { data: compData } = await supabase
                    .from('companies')
                    .select('id')
                    .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${currentEntity.cnpj}`)
                    .maybeSingle();
                if (compData?.id) {
                    filterId = compData.id;
                }
            }

            // 1. Fetch subscriptions
            const { data: subsData, error: subsError } = await supabase
                .from('loyalty_subscriptions')
                .select(`
                    id,
                    status,
                    next_due_at,
                    created_at,
                    custom_price,
                    service_id,
                    contact:contacts (
                        id,
                        name,
                        type,
                        tax_id,
                        email,
                        phone,
                        whatsapp,
                        zip_code,
                        street,
                        number,
                        complement,
                        neighborhood,
                        city,
                        state
                    ),
                    plan:loyalty_plans (
                        id,
                        name,
                        price
                    ),
                    service:services (
                        id,
                        name,
                        price,
                        codigo_servico_municipal,
                        item_lista_servico,
                        codigo_tributacao_nacional,
                        description
                    )
                `)
                .eq('company_id', filterId)
                .in('status', ['active', 'overdue', 'pending']);

            if (subsError) throw subsError;

            // 2. Fetch fiscal invoices for this month to check which ones have already been emitted
            const { data: invoicesData, error: invError } = await supabase
                .from('fiscal_invoices')
                .select('id, payload, created_at')
                .eq('company_id', filterId)
                .is('deleted', false);

            if (invError) throw invError;

            // 3. Map subscriptions to "charges" structure for backward compatibility with JSX
            const mappedCharges: ChargeWithContact[] = (subsData || []).map(s => {
                const contactObj = Array.isArray(s.contact) ? s.contact[0] : s.contact;
                const planObj = Array.isArray(s.plan) ? s.plan[0] : s.plan;
                const serviceObj = Array.isArray(s.service) ? s.service[0] : s.service;

                // Find if an invoice already exists for this contact in the selected reference_month
                const existingInvoice = (invoicesData || []).find(inv => {
                    const invPayload = inv.payload as any;
                    const idIntegracao = invPayload?.idIntegracao || invPayload?.retorno?.idIntegracao || '';
                    
                    // 1. Matches exact RECORRENTE_${s.id}_${selectedMonth}
                    if (idIntegracao === `RECORRENTE_${s.id}_${selectedMonth}`) {
                        return true;
                    }

                    const payloadCnpj = invPayload?.tomador?.cpfCnpj?.replace(/\D/g, '') || 
                                        invPayload?.destinatario?.cpfCnpj?.replace(/\D/g, '') ||
                                        invPayload?.destinatario?.cnpj?.replace(/\D/g, '') || '';
                    const contactCnpj = contactObj?.tax_id?.replace(/\D/g, '') || '';
                    const isSameContact = payloadCnpj !== '' && payloadCnpj === contactCnpj;

                    // 2. Fallback: Check legacy matching (startsWith RECORRENTE_${s.id}_) and creation date/ref_month matches selectedMonth
                    const createdMonth = inv.created_at ? inv.created_at.substring(0, 7) : '';
                    const isSameMonth = createdMonth === selectedMonth || invPayload?.reference_month === selectedMonth;
                    const isLegacyRecorrenteMatch = idIntegracao.startsWith(`RECORRENTE_${s.id}_`) && isSameMonth;

                    return isSameContact && (isSameMonth || isLegacyRecorrenteMatch);
                });

                // Default configured price for new / unemitted invoices
                let chargeAmount = s.custom_price || serviceObj?.price || planObj?.price || 0;

                // If invoice was ALREADY emitted, preserve the exact historical emitted amount from payload
                if (existingInvoice) {
                    const invPayload = (existingInvoice.payload || {}) as any;
                    const servicoObj = Array.isArray(invPayload?.servico) ? invPayload?.servico[0] : invPayload?.servico;
                    const servicosArr = Array.isArray(invPayload?.servicos) ? invPayload?.servicos[0] : invPayload?.servicos;
                    
                    const emittedVal = 
                        invPayload?.retorno?.valorTotal ||
                        invPayload?.valorTotal ||
                        invPayload?.valor_total ||
                        servicoObj?.valor?.servico ||
                        servicosArr?.valor?.servico ||
                        servicoObj?.valorServicos ||
                        invPayload?.retorno?.servico?.valor?.servico ||
                        invPayload?.amount;

                    if (emittedVal !== undefined && emittedVal !== null) {
                        const parsed = typeof emittedVal === 'number' ? emittedVal : parseFloat(String(emittedVal).replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                            chargeAmount = parsed;
                        }
                    }
                }

                return {
                    id: s.id, // using subscription id as the unique identifier
                    amount: chargeAmount,
                    reference_month: selectedMonth,
                    status: s.status,
                    fiscal_invoice_id: existingInvoice ? existingInvoice.id : null,
                    due_date: s.next_due_at || s.created_at || new Date().toISOString(),
                    contact: contactObj,
                    subscription: {
                        id: s.id,
                        plan: planObj || undefined,
                        service: serviceObj || undefined
                    }
                } as any;
            });

            setCharges(mappedCharges);
            // Auto-select ready and pending charges
            const initialSelected = new Set<string>();
            mappedCharges.forEach(c => {
                const isPending = !c.fiscal_invoice_id;
                const hasDetails = validateContact(c.contact).length === 0;
                if (isPending && hasDetails) {
                    initialSelected.add(c.id);
                }
            });
            setSelectedIds(initialSelected);
        } catch (error: any) {
            console.error('Error fetching loyalty charges:', error);
            setQueryError(error.message || 'Falha ao buscar assinaturas do banco de dados.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && currentEntity.id) {
            fetchCharges();
            setIsProcessing(false);
            setIsPaused(false);
            setProgress(0);
            setExecutionLogs({});
        }
    }, [isOpen, selectedMonth, currentEntity.id]);

    // Validation helper
    const validateContact = (contact: any) => {
        const missing = [];
        if (!contact) return ['Contato não vinculado'];
        if (!contact.name) missing.push('Nome');
        if (!contact.tax_id || contact.tax_id.replace(/\D/g, '').length < 11) missing.push('CPF/CNPJ');
        if (!contact.email) missing.push('E-mail');
        if (!contact.zip_code || contact.zip_code.replace(/\D/g, '').length !== 8) missing.push('CEP');
        if (!contact.street) missing.push('Logradouro');
        if (!contact.number) missing.push('Número');
        if (!contact.neighborhood) missing.push('Bairro');
        if (!contact.city) missing.push('Cidade');
        if (!contact.state) missing.push('UF');
        return missing;
    };

    // Filter charges
    const filteredCharges = useMemo(() => {
        return charges.filter(c => {
            // Search filter
            const contactName = c.contact?.name || '';
            const matchesSearch = contactName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (c.subscription?.plan?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            // Status filter
            const isEmitted = !!c.fiscal_invoice_id;
            const hasErrors = executionLogs[c.id]?.status === 'error';
            const missing = validateContact(c.contact);
            const isIncomplete = missing.length > 0;

            if (statusFilter === 'pending') return matchesSearch && !isEmitted && !isIncomplete;
            if (statusFilter === 'emitted') return matchesSearch && isEmitted;
            if (statusFilter === 'error') return matchesSearch && hasErrors;
            if (statusFilter === 'incomplete') return matchesSearch && isIncomplete;
            return matchesSearch;
        });
    }, [charges, searchTerm, statusFilter, executionLogs]);

    const handleSelectAll = () => {
        const allFilteredSelected = filteredCharges.every(c => selectedIds.has(c.id));
        const newSelected = new Set(selectedIds);
        filteredCharges.forEach(c => {
            const hasDetails = validateContact(c.contact).length === 0;
            const isPending = !c.fiscal_invoice_id;
            if (hasDetails && isPending) {
                if (allFilteredSelected) {
                    newSelected.delete(c.id);
                } else {
                    newSelected.add(c.id);
                }
            }
        });
        setSelectedIds(newSelected);
    };

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    // Open Quick Edit
    const handleOpenEdit = (contact: any) => {
        setEditingContact({
            id: contact.id,
            name: contact.name || '',
            tax_id: contact.tax_id || '',
            email: contact.email || '',
            zip_code: contact.zip_code || '',
            street: contact.street || '',
            number: contact.number || '',
            complement: contact.complement || '',
            neighborhood: contact.neighborhood || '',
            city: contact.city || '',
            state: contact.state || ''
        });
    };

    const handleSaveContact = async () => {
        if (!editingContact) return;
        setIsSavingContact(true);
        try {
            const { error } = await supabase
                .from('contacts')
                .update({
                    name: editingContact.name,
                    tax_id: editingContact.tax_id,
                    email: editingContact.email,
                    zip_code: editingContact.zip_code,
                    street: editingContact.street,
                    number: editingContact.number,
                    complement: editingContact.complement,
                    neighborhood: editingContact.neighborhood,
                    city: editingContact.city,
                    state: editingContact.state
                })
                .eq('id', editingContact.id);

            if (error) throw error;
            setEditingContact(null);
            fetchCharges(); // Refresh list
        } catch (err: any) {
            alert('Erro ao salvar contato: ' + err.message);
        } finally {
            setIsSavingContact(false);
        }
    };

    // CEP Auto-fill for Quick Edit
    const handleCepBlur = async () => {
        if (!editingContact?.zip_code) return;
        const cleanCep = editingContact.zip_code.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();
            if (!data.erro && editingContact) {
                setEditingContact({
                    ...editingContact,
                    street: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    state: data.uf || ''
                });
            }
        } catch (err) {
            console.error('Error fetching CEP:', err);
        }
    };

    // Batch emission execution
    const runBatchEmission = async () => {
        if (selectedIds.size === 0) return;
        setIsProcessing(true);
        setIsPaused(false);
        setProgress(0);

        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
            alert('Sessão expirada. Por favor logue novamente.');
            setIsProcessing(false);
            return;
        }

        const idsToProcess = Array.from(selectedIds);
        const total = idsToProcess.length;
        const logs: typeof executionLogs = {};
        
        idsToProcess.forEach(id => {
            logs[id] = { status: 'idle' };
        });
        setExecutionLogs(logs);

        // Fetch company city IBGE
        const companyCityCode = config?.endereco?.codigoCidade || config?.codigo_municipio || '3106200';
        const isHomolog = config?.ambiente === 'homologacao' || config?.use_test_data;
        const defaultCityCode = isHomolog ? '4115200' : (config?.endereco?.codigoCidade || '3106200');

        let processedCount = 0;
        const concurrencyLimit = 3;
        const queue = [...idsToProcess];
        const activePromises: Promise<void>[] = [];

        const processItem = async (chargeId: string) => {
            if (isPaused) {
                // Wait until unpaused
                while (isPaused) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            setExecutionLogs(prev => ({
                ...prev,
                [chargeId]: { status: 'sending' }
            }));

            const charge = charges.find(c => c.id === chargeId);
            if (!charge) return;

            try {
                // 1. Resolve client city IBGE code dynamically
                let clientCityCode = defaultCityCode;
                const cep = charge.contact.zip_code?.replace(/\D/g, '') || '';
                if (cep.length === 8) {
                    try {
                        const cepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                        const cepData = await cepRes.json();
                        if (!cepData.erro && cepData.ibge) {
                            clientCityCode = cepData.ibge;
                        }
                    } catch (err) {
                        console.warn('ViaCEP lookup failed, using default company IBGE', err);
                    }
                }

                // 2. Prepare payload
                const isSimples = config?.regime_tributario === '1' || config?.regime_tributario === '2' || config?.regime_tributario === '4';
                const defaultIss = isSimples ? (config?.simples_nacional_aliquota || '0') : (config?.default_iss_aliquota || '3');
                const natCode = config?.default_taxation_code?.replace(/\D/g, '').substring(0, 9) || '';

                const serviceObj = (charge.subscription as any)?.service;
                const planName = serviceObj?.name || charge.subscription?.plan?.name || 'Recorrente';
                const serviceDescription = serviceObj?.description || serviceObj?.name || `Mensalidade do plano de fidelidade: ${planName}`;
                
                const serviceTaxCode = serviceObj?.codigo_servico_municipal || serviceObj?.item_lista_servico;
                const serviceNatCode = serviceObj?.codigo_tributacao_nacional;
                
                const finalTaxCode = serviceTaxCode ? serviceTaxCode.replace(/\D/g, '') : (isNacional ? natCode : (config?.default_taxation_code || '01.01'));
                const finalNatCode = serviceNatCode ? serviceNatCode.replace(/\D/g, '').substring(0, 9) : natCode;

                const itemPayload = {
                    amount: String(charge.amount),
                    quantity: 1,
                    description: serviceDescription,
                    taxCode: isNacional ? finalNatCode : finalTaxCode,
                    cnae: config?.default_cnae || '',
                    taxationCode: isNacional ? finalNatCode : '',
                    codigoTributacaoNacional: isNacional ? finalNatCode : '',
                    issAliquota: defaultIss,
                    issExigibilidade: config?.default_iss_exigibilidade || '1',
                    issTipo: config?.default_iss_tipo || '7',
                    pisAliquota: config?.default_pis_aliquota || '',
                    cofinsAliquota: config?.default_cofins_aliquota || '',
                    csllAliquota: config?.default_csll_aliquota || '',
                    irrfAliquota: config?.default_irrf_aliquota || ''
                };

                const payload: any = {
                    idIntegracao: `RECORRENTE_${chargeId}_${selectedMonth}`,
                    codigoIbge: companyCityCode,
                    prestador: {
                        cpfCnpj: currentCompany?.cnpj?.replace(/\D/g, '') || config?.cnpj?.replace(/\D/g, ''),
                        inscricaoMunicipal: config?.inscricao_municipal?.replace(/\D/g, '') || config?.inscricaoMunicipal?.replace(/\D/g, ''),
                        regimeTributario: parseInt(config?.regime_tributario || '1'),
                        regimeEspecialTributacao: config?.regime_tributario === '1' || config?.regime_tributario === '2' ? 6 : 
                                                 config?.regime_tributario === '4' ? 5 : 
                                                 parseInt(config?.default_regime_especial || '0')
                    },
                    tomador: {
                        cpfCnpj: charge.contact.tax_id!.replace(/\D/g, ''),
                        razaoSocial: charge.contact.name,
                        email: charge.contact.email,
                        endereco: {
                            logradouro: charge.contact.street || '',
                            numero: charge.contact.number || 'S/N',
                            bairro: charge.contact.neighborhood || '',
                            cep: charge.contact.zip_code?.replace(/\D/g, ''),
                            codigoCidade: clientCityCode,
                            cidade: charge.contact.city || '',
                            descricaoCidade: charge.contact.city || '',
                            uf: charge.contact.state || ''
                        }
                    },
                    servico: [
                        {
                            codigo: isNacional ? (itemPayload.taxCode?.replace(/\D/g, '').substring(0, 6)) : itemPayload.taxCode,
                            codigoIbge: companyCityCode,
                            discriminacao: itemPayload.description,
                            valor: {
                                servico: charge.amount,
                                descontoCondicionado: 0,
                                descontoIncondicionado: 0
                            },
                            quantidade: 1,
                            itemListaServico: itemPayload.taxCode.includes('.') ? itemPayload.taxCode : '01.01',
                            cnae: itemPayload.cnae ? String(itemPayload.cnae).replace(/\D/g, '').substring(0, 7) : undefined,
                            iss: {
                                aliquota: parseFloat(itemPayload.issAliquota || '0'),
                                exigibilidade: parseInt(itemPayload.issExigibilidade || '1'),
                                tipoTributacao: parseInt(itemPayload.issTipo || '7')
                            }
                        }
                    ]
                };

                // Add national taxes if Simples Nacional config is set
                if (config?.simples_nacional_aliquota) {
                    payload.servico[0].valor.aliquota = parseFloat(config.simples_nacional_aliquota);
                }
                if (config?.pis_cofins_situacao_tributaria) {
                    payload.servico[0].pis = { situacaoTributaria: config.pis_cofins_situacao_tributaria };
                    payload.servico[0].cofins = { situacaoTributaria: config.pis_cofins_situacao_tributaria };
                }

                if (config?.default_regime_especial && config.default_regime_especial !== '0') {
                    payload.prestador.regimeEspecialTributacao = parseInt(config.default_regime_especial);
                }

                if (config?.send_email_automatically) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [charge.contact.email]
                        }
                    };
                }

                // 3. Call API
                const result = await fiscalService.emitirNFSe(
                    currentEntity.id!,
                    payload,
                    token,
                    undefined,
                    false,
                    activeProvider
                );

                const externalId = result.data?.id || result.id || result.documents?.[0]?.id;
                let finalPayload = result.data || result;
                const statusStr = String(finalPayload.status || finalPayload.situacao || 'processando').toLowerCase();

                if (!externalId) {
                    throw new Error(result.message || 'ID da nota não retornado pela API.');
                }

                // 4. Save/Update in DB (Check if backend proxy already created the row)
                let dbInvoiceId = '';
                
                const { data: existingInv } = await supabase
                    .from('fiscal_invoices')
                    .select('id')
                    .eq('external_id', externalId)
                    .maybeSingle();

                if (existingInv) {
                    console.log(`📝 [DB-SAVE] Nota ${externalId} já existe no DB. Atualizando status e payload...`);
                    const { data: updatedInv, error: dbError } = await supabase
                        .from('fiscal_invoices')
                        .update({
                            status: statusStr,
                            payload: {
                                ...payload,
                                retorno: finalPayload,
                                reference_month: selectedMonth
                            }
                        })
                        .eq('id', existingInv.id)
                        .select('id')
                        .single();

                    if (dbError) throw dbError;
                    dbInvoiceId = updatedInv.id;
                } else {
                    console.log(`💾 [DB-SAVE] Inserindo nova nota ${externalId} no DB...`);
                    const { data: newInv, error: dbError } = await supabase
                        .from('fiscal_invoices')
                        .insert({
                            company_id: currentEntity.id,
                            external_id: externalId,
                            type: activeProvider === 'nfeio' ? 'nfeio' : (isNacional ? 'nfsenac' : 'nfse'),
                            status: statusStr,
                            payload: {
                                ...payload,
                                retorno: finalPayload,
                                reference_month: selectedMonth
                            }
                        })
                        .select('id')
                        .single();

                    if (dbError) throw dbError;
                    dbInvoiceId = newInv.id;
                }

                // 5. Link to charge if a charge exists in loyalty_charges for this month
                await supabase
                    .from('loyalty_charges')
                    .update({ fiscal_invoice_id: dbInvoiceId })
                    .eq('subscription_id', chargeId)
                    .eq('reference_month', selectedMonth);

                // 6. WhatsApp Notification
                if (config?.send_whatsapp_automatically && waInstances.length > 0 && charge.contact.whatsapp) {
                    try {
                        const instance = waInstances[0];
                        let apiBase = API_BASE_URL.replace(/\/$/, '');
                        if (apiBase.startsWith('/')) {
                            apiBase = window.location.origin + apiBase;
                        }
                        const tokenPart = token ? `&token=${token}` : '';
                        const pdfUrl = `${apiBase}/fiscal-module/nfse/${externalId}/pdf?companyId=${currentEntity.id}${tokenPart}`;
                        
                        const message = `Olá, *${charge.contact.name}*! 👋\n\nSua Nota Fiscal de assinatura foi emitida com sucesso.\n\n🔗 *Acesse sua NOTA FISCAL aqui:*\n${pdfUrl}`;
                        
                        await whatsappService.sendMessage({
                            instanceName: instance.instance_name || instance.name,
                            token: instance.evolution_instance_id,
                            number: charge.contact.whatsapp,
                            text: message,
                            mediaUrl: pdfUrl,
                            mediaType: 'document',
                            mimetype: 'application/pdf',
                            fileName: `NotaFiscal-${selectedMonth}.pdf`,
                            companyId: currentEntity.id
                        });
                    } catch (waErr) {
                        console.error('Failed sending WhatsApp notification:', waErr);
                    }
                }

                setExecutionLogs(prev => ({
                    ...prev,
                    [chargeId]: { status: 'success', pdfUrl: `https://dummy-link-pdf` } // status ok
                }));
            } catch (err: any) {
                console.error(`Error emitting note for charge ${chargeId}:`, err);
                const errMsg = err.response?.data?.detail || err.message || 'Erro de comunicação fiscal';
                setExecutionLogs(prev => ({
                    ...prev,
                    [chargeId]: { status: 'error', message: errMsg }
                }));
            } finally {
                processedCount++;
                setProgress(Math.round((processedCount / total) * 100));
            }
        };

        // Execution Scheduler with concurrency limit
        while (queue.length > 0) {
            while (activePromises.length < concurrencyLimit && queue.length > 0) {
                const id = queue.shift()!;
                const promise = processItem(id).then(() => {
                    activePromises.splice(activePromises.indexOf(promise), 1);
                });
                activePromises.push(promise);
            }
            if (activePromises.length > 0) {
                await Promise.race(activePromises);
            }
        }
        await Promise.all(activePromises);

        setIsProcessing(false);
        fetchCharges(); // Reload data
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (!isProcessing) onClose();
            }}
            title="Faturamento Recorrente em Lote"
            subtitle="Emissão simplificada das Notas Fiscais dos seus assinantes fidelidade"
            icon={RefreshCw}
            maxWidth="max-w-6xl"
            variant="primary"
        >
            <div className="flex flex-col gap-6 text-gray-900 dark:text-gray-100">
                {/* Header controls */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800/40">
                    <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-violet-500" />
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Competência:</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={isProcessing}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            {monthOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-grow sm:w-64">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente ou plano..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                disabled={isProcessing}
                                className="pl-9 pr-4 py-1.5 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e: any) => setStatusFilter(e.target.value)}
                            disabled={isProcessing}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendentes</option>
                            <option value="emitted">Emitidos</option>
                            <option value="error">Erros</option>
                            <option value="incomplete">Cadastro Incompleto</option>
                        </select>
                    </div>
                </div>

                {queryError && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/10 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-200">
                        <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <div className="font-bold">Erro ao carregar dados</div>
                            <div className="text-xs mt-0.5">{queryError}</div>
                        </div>
                    </div>
                )}

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl flex flex-col">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total de Assinantes</span>
                        <span className="text-2xl font-black mt-1">{charges.length}</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl flex flex-col">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Prontos p/ Emitir</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {charges.filter(c => !c.fiscal_invoice_id && validateContact(c.contact).length === 0).length}
                        </span>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl flex flex-col">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Já Emitidos</span>
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                            {charges.filter(c => c.fiscal_invoice_id).length}
                        </span>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl flex flex-col">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Incompletos</span>
                        <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                            {charges.filter(c => validateContact(c.contact).length > 0).length}
                        </span>
                    </div>
                </div>

                {/* Table or Loading */}
                {isLoading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="animate-spin text-violet-500" size={32} />
                        <span className="text-sm font-semibold text-gray-500">Buscando assinantes...</span>
                    </div>
                ) : filteredCharges.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                        <FileText size={40} className="text-gray-300" />
                        <span className="text-sm font-bold text-gray-400">Nenhum registro encontrado</span>
                    </div>
                ) : (
                    <div className="border border-gray-100 dark:border-slate-800/40 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                        <th className="py-3.5 px-4 w-10 text-center">
                                            <button
                                                type="button"
                                                onClick={handleSelectAll}
                                                disabled={isProcessing}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                            >
                                                {filteredCharges.every(c => selectedIds.has(c.id)) ? (
                                                    <CheckSquare size={18} className="text-violet-600" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </th>
                                        <th className="py-3.5 px-4">Cliente / Contato</th>
                                        <th className="py-3.5 px-4">Plano / Cobrança</th>
                                        <th className="py-3.5 px-4">Valor</th>
                                        <th className="py-3.5 px-4">Validação Fiscal</th>
                                        <th className="py-3.5 px-4">Status da Nota</th>
                                        <th className="py-3.5 px-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/40 text-sm">
                                    {filteredCharges.map((c, index) => {
                                        const missing = validateContact(c.contact);
                                        const isChecked = selectedIds.has(c.id);
                                        const isEmitted = !!c.fiscal_invoice_id;
                                        const log = executionLogs[c.id];

                                        return (
                                            <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                                <td className="py-4 px-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleSelect(c.id)}
                                                        disabled={isProcessing || isEmitted || missing.length > 0}
                                                        className={clsx(
                                                            "w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500",
                                                            (isEmitted || missing.length > 0) && "opacity-40 cursor-not-allowed"
                                                        )}
                                                    />
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{c.contact.name}</span>
                                                        {c.contact.type && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                                                c.contact.type === 'both'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                                                                    : c.contact.type === 'supplier'
                                                                    ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-900/30'
                                                                    : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30'
                                                            }`}>
                                                                {c.contact.type === 'both' ? 'Ambos' : c.contact.type === 'supplier' ? 'Fornecedor' : 'Cliente'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-0.5">{c.contact.tax_id || 'Sem CPF/CNPJ'}</div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="font-medium">{c.subscription?.plan?.name || 'Assinatura'}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">Vencimento: {new Date(c.due_date).toLocaleDateString('pt-BR')}</div>
                                                </td>
                                                <td className="py-4 px-4">
                                                     <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1 min-w-[130px] max-w-[150px]">
                                                         <span className="text-xs text-gray-400 font-bold">R$</span>
                                                         <input
                                                              id={`amount-input-${index}`}
                                                              type="text"
                                                              value={editingAmountId === c.id ? tempAmountText : formatCurrency(c.amount)}
                                                              onFocus={(e) => {
                                                                  setEditingAmountId(c.id);
                                                                  setTempAmountText(c.amount === 0 ? '' : formatCurrency(c.amount));
                                                                  setTimeout(() => {
                                                                      e.target.select();
                                                                  }, 50);
                                                              }}
                                                              onChange={(e) => setTempAmountText(e.target.value)}
                                                              onKeyDown={(e) => {
                                                                  if (e.key === 'Enter') {
                                                                      e.preventDefault();
                                                                      e.currentTarget.blur();
                                                                      setTimeout(() => {
                                                                          const nextInput = document.getElementById(`amount-input-${index + 1}`) as HTMLInputElement | null;
                                                                          if (nextInput) {
                                                                              nextInput.focus();
                                                                          }
                                                                      }, 50);
                                                                  }
                                                              }}
                                                              onBlur={() => {
                                                                  const parsed = parseCurrency(tempAmountText);
                                                                  handleAmountChange(c.id, parsed);
                                                                  setEditingAmountId(null);
                                                              }}
                                                              disabled={isProcessing || isEmitted}
                                                              className="w-full bg-transparent border-none text-right font-mono font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-0 p-0 text-sm"
                                                              placeholder="0,00"
                                                          />
                                                     </div>
                                                 </td>
                                                <td className="py-4 px-4">
                                                    {missing.length === 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-950/10">
                                                            <Check size={12} strokeWidth={2.5} /> Pronto
                                                        </span>
                                                    ) : (
                                                        <span 
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-950/10 cursor-help"
                                                            title={`Campos ausentes: ${missing.join(', ')}`}
                                                        >
                                                            <AlertTriangle size={12} /> Dados Incompletos
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4">
                                                    {isEmitted ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-950/10">
                                                            <CheckCircle2 size={12} /> Emitida
                                                        </span>
                                                    ) : log?.status === 'sending' ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-0.5 rounded-full border border-amber-100 dark:border-amber-950/10 animate-pulse">
                                                            <Loader2 size={12} className="animate-spin" /> Emitindo...
                                                        </span>
                                                    ) : log?.status === 'success' ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-950/10">
                                                            <CheckCircle2 size={12} /> Sucesso
                                                        </span>
                                                    ) : log?.status === 'error' ? (
                                                        <span 
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2.5 py-0.5 rounded-full border border-rose-100 dark:border-rose-950/10 cursor-help"
                                                            title={log.message}
                                                        >
                                                            <XCircle size={12} /> Rejeitada
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-gray-100 dark:border-slate-700/60">
                                                            <Clock3 size={12} /> Pendente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenEdit(c.contact)}
                                                        disabled={isProcessing}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Edit2 size={14} className="text-gray-500 hover:text-violet-600" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Progress bar overlay during processing */}
                {isProcessing && (
                    <div className="p-5 bg-violet-50 dark:bg-violet-950/20 rounded-2xl border border-violet-100 dark:border-violet-950/10 animate-in fade-in duration-300 flex flex-col gap-3">
                        <div className="flex justify-between items-center text-sm font-bold text-violet-950 dark:text-violet-200">
                            <span className="flex items-center gap-2">
                                <Loader2 className="animate-spin text-violet-600" size={16} />
                                Emitindo Notas Fiscais ({progress}%)
                            </span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-violet-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex gap-4 text-xs font-semibold text-violet-700 dark:text-violet-400">
                            <span>Sucesso: {Object.values(executionLogs).filter(l => l.status === 'success').length}</span>
                            <span>Falhou: {Object.values(executionLogs).filter(l => l.status === 'error').length}</span>
                            <span>Restante: {selectedIds.size - Object.values(executionLogs).filter(l => ['success', 'error'].includes(l.status)).length}</span>
                            <div className="ml-auto flex gap-2">
                                <button 
                                    onClick={() => setIsPaused(!isPaused)} 
                                    className="hover:underline flex items-center gap-1 font-bold"
                                >
                                    {isPaused ? <Play size={12} /> : <Pause size={12} />}
                                    {isPaused ? 'Retomar' : 'Pausar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="font-bold"
                    >
                        Fechar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={runBatchEmission}
                        disabled={selectedIds.size === 0 || isProcessing}
                        className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20 font-bold"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={16} className="animate-spin mr-2" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Play size={16} className="mr-2" />
                                Emitir {selectedIds.size} Notas Selecionadas
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Quick Edit Contact Modal */}
            {editingContact && (
                <Modal
                    isOpen={!!editingContact}
                    onClose={() => setEditingContact(null)}
                    title="Editar Cadastro Fiscal"
                    subtitle="Preencha os campos fiscais obrigatórios para a nota fiscal"
                    icon={Edit2}
                    maxWidth="max-w-2xl"
                    variant="warning"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-900 dark:text-gray-100">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Razão Social / Nome</label>
                            <input
                                type="text"
                                value={editingContact.name}
                                onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">CPF / CNPJ</label>
                            <input
                                type="text"
                                value={editingContact.tax_id}
                                onChange={(e) => setEditingContact({ ...editingContact, tax_id: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">E-mail</label>
                            <input
                                type="email"
                                value={editingContact.email}
                                onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">CEP</label>
                            <input
                                type="text"
                                value={editingContact.zip_code}
                                onChange={(e) => setEditingContact({ ...editingContact, zip_code: e.target.value })}
                                onBlur={handleCepBlur}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Logradouro</label>
                            <input
                                type="text"
                                value={editingContact.street}
                                onChange={(e) => setEditingContact({ ...editingContact, street: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Número</label>
                            <input
                                type="text"
                                value={editingContact.number}
                                onChange={(e) => setEditingContact({ ...editingContact, number: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Complemento</label>
                            <input
                                type="text"
                                value={editingContact.complement}
                                onChange={(e) => setEditingContact({ ...editingContact, complement: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Bairro</label>
                            <input
                                type="text"
                                value={editingContact.neighborhood}
                                onChange={(e) => setEditingContact({ ...editingContact, neighborhood: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cidade</label>
                            <input
                                type="text"
                                value={editingContact.city}
                                onChange={(e) => setEditingContact({ ...editingContact, city: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Estado (UF)</label>
                            <input
                                type="text"
                                value={editingContact.state}
                                onChange={(e) => setEditingContact({ ...editingContact, state: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                            <Button
                                variant="ghost"
                                onClick={() => setEditingContact(null)}
                                disabled={isSavingContact}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSaveContact}
                                disabled={isSavingContact}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                            >
                                {isSavingContact ? 'Salvando...' : 'Salvar Alterações'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
}
