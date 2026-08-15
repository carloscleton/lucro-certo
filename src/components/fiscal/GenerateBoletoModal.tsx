import { useState, useEffect, useRef } from 'react';
import { FileText, Calendar, CreditCard, Copy, ExternalLink, AlertCircle, Rocket, Star, Link as LinkIcon, Download, RefreshCw, XCircle, ShieldCheck, Info, QrCode, Percent } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useContacts } from '../../hooks/useContacts';
import { usePaymentGateways } from '../../hooks/usePaymentGateways';
import { useCharges } from '../../hooks/useCharges';
import { useNotification } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import { API_BASE_URL } from '../../lib/constants';
import axios from 'axios';

import { useNavigate } from 'react-router-dom';

interface GenerateBoletoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    invoice: any;
}

export function GenerateBoletoModal({ isOpen, onClose, onSuccess, invoice }: GenerateBoletoModalProps) {
    const navigate = useNavigate();
    const { contacts } = useContacts();
    const { gateways, defaultGateway } = usePaymentGateways();
    const { createCharge } = useCharges();
    const { notify } = useNotification();

    // Form states
    const [selectedContactId, setSelectedContactId] = useState('');
    const [customName, setCustomName] = useState('');
    const [customTaxId, setCustomTaxId] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [dueDate, setDueDate] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('banco_inter');
    const [selectedMethod, setSelectedMethod] = useState<'boleto' | 'pix' | 'credit_card' | 'all'>('boleto');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Rates States (Juros, Multa, Desconto)
    const [interestValue, setInterestValue] = useState<string>('0');
    const [fineValue, setFineValue] = useState<string>('0');
    const [discountValue, setDiscountValue] = useState<string>('0');
    const [discountDaysValue, setDiscountDaysValue] = useState<string>('0');
    const [instructionsValue, setInstructionsValue] = useState<string>('');
    const [showAdvancedRates, setShowAdvancedRates] = useState(false);

    // Existing Charge State & Error state
    const [existingCharge, setExistingCharge] = useState<any>(null);
    const [loadingExisting, setLoadingExisting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initial default due date: +15 days from today
    const getDefaultDueDate = () => {
        const date = new Date();
        date.setDate(date.getDate() + 15);
        return date.toISOString().split('T')[0];
    };

    // Helper function to extract invoice details comprehensively
    const getInvoiceDetails = (inv: any) => {
        if (!inv) return { amount: 0, clientName: '', clientTaxId: '', clientEmail: '' };
        
        const payload = inv.payload || {};
        const retorno = payload.retorno || {};
        const infDPS = payload.infDPS || payload.DPS?.infDPS || retorno.infDPS || {};
        const toma = infDPS.toma || payload.toma || {};

        const amount = Number(
            inv.amount || 
            payload.servicesAmount || 
            retorno.servicesAmount || 
            retorno.valorTotal || 
            infDPS.valores?.vServPrest?.vServ ||
            payload.valores?.vServPrest?.vServ ||
            retorno.valores?.vServPrest?.vServ ||
            payload.servico?.[0]?.valor?.servico || 
            payload.itens?.[0]?.valorUnitario?.comercial || 
            payload.vServ ||
            inv.valor ||
            0
        );

        const clientName = inv.quote?.contact?.name || 
                           toma.xNome ||
                           payload.tomador?.razaoSocial || 
                           payload.tomador?.nome ||
                           payload.destinatario?.razaoSocial || 
                           payload.destinatario?.nome || 
                           payload.borrower?.name || 
                           retorno.tomador?.razaoSocial ||
                           retorno.borrower?.name ||
                           '';

        const rawTaxId = inv.quote?.contact?.tax_id || 
                         toma.CNPJ ||
                         toma.CPF ||
                         toma.cnpj ||
                         toma.cpf ||
                         payload.tomador?.cpfCnpj || 
                         payload.tomador?.cnpj || 
                         payload.tomador?.cpf || 
                         payload.destinatario?.cpfCnpj || 
                         payload.destinatario?.cnpj || 
                         payload.borrower?.federalTaxNumber || 
                         retorno.borrower?.federalTaxNumber || 
                         '';
                         
        const clientTaxId = (rawTaxId || '').replace(/\D/g, '');

        const clientEmail = inv.quote?.contact?.email || 
                            toma.email ||
                            payload.tomador?.email || 
                            payload.destinatario?.email || 
                            payload.borrower?.email || 
                            retorno.borrower?.email || 
                            '';

        return { amount, clientName, clientTaxId, clientEmail };
    };

    const prevIsOpenRef = useRef<boolean>(false);
    const prevInvoiceIdRef = useRef<string | null>(null);

    // Check if a boleto has already been created for this invoice
    useEffect(() => {
        if (!isOpen) {
            prevIsOpenRef.current = false;
            return;
        }

        const isNewOpen = !prevIsOpenRef.current && isOpen;
        const isDifferentInvoice = prevInvoiceIdRef.current !== (invoice?.id || null);

        if ((isNewOpen || isDifferentInvoice) && invoice) {
            prevIsOpenRef.current = true;
            prevInvoiceIdRef.current = invoice.id || null;

            setResult(null);
            setExistingCharge(null);
            setErrorMessage(null);
            const { amount: extractedAmount, clientName: extractedName, clientTaxId: extractedTaxId } = getInvoiceDetails(invoice);

            setAmount(extractedAmount);
            const invoiceNo = invoice.invoice_number || invoice.external_id?.slice(-6) || '';
            setDescription(`Ref. Nota Fiscal Nº ${invoiceNo}`);
            setDueDate(getDefaultDueDate());

            // Check if active charge exists in database for this invoice
            const checkCharge = async () => {
                setLoadingExisting(true);
                try {
                    const { data } = await supabase
                        .from('company_charges')
                        .select('*')
                        .eq('company_id', invoice.company_id)
                        .in('status', ['pending', 'approved'])
                        .or(`external_reference.eq.NF${invoiceNo},description.ilike.%Nº ${invoiceNo}%`)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (data && data.length > 0) {
                        setExistingCharge(data[0]);
                    }
                } catch (err) {
                    console.error('Erro ao verificar cobrança existente:', err);
                } finally {
                    setLoadingExisting(false);
                }
            };

            checkCharge();

            // Contact pre-selection logic
            const contactId = invoice.customer_id || invoice.contact_id || invoice.quote?.contact_id || '';
            let matchedContact = contacts.find(c => c.id === contactId);

            if (!matchedContact && extractedTaxId) {
                matchedContact = contacts.find(c => (c.tax_id || (c as any).cpf_cnpj || '').replace(/\D/g, '') === extractedTaxId);
            }

            if (!matchedContact && extractedName) {
                matchedContact = contacts.find(c => c.name.toLowerCase().trim() === extractedName.toLowerCase().trim());
            }

            if (matchedContact) {
                setSelectedContactId(matchedContact.id);
                setCustomName(matchedContact.name);
                setCustomTaxId(matchedContact.tax_id || (matchedContact as any).cpf_cnpj || extractedTaxId);
            } else {
                setSelectedContactId('');
                setCustomName(extractedName);
                setCustomTaxId(extractedTaxId);
            }

            const activeGateways = gateways.filter(g => g.is_active);
            const defProv = defaultGateway?.provider || activeGateways[0]?.provider || 'banco_inter';
            setSelectedProvider(defProv);
        }
    }, [isOpen, invoice?.id, contacts, gateways, defaultGateway]);

    useEffect(() => {
        const gw = gateways.find(g => g.provider === selectedProvider);
        if (gw?.config) {
            setInterestValue(gw.config.default_interest_percent !== undefined ? String(gw.config.default_interest_percent) : '0');
            setFineValue(gw.config.default_fine_percent !== undefined ? String(gw.config.default_fine_percent) : '0');
            setDiscountValue(gw.config.default_discount_percent !== undefined ? String(gw.config.default_discount_percent) : '0');
            setDiscountDaysValue(gw.config.default_discount_days !== undefined ? String(gw.config.default_discount_days) : '0');
            setInstructionsValue(gw.config.default_payment_instructions || '');
        }
    }, [selectedProvider, gateways]);

    const activeGateways = gateways.filter(g => g.is_active);
    const selectedGateway = activeGateways.find(g => g.provider === selectedProvider) || activeGateways[0];

    const handleSelectContact = (contactId: string) => {
        setSelectedContactId(contactId);
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            setCustomName(contact.name);
            setCustomTaxId(contact.tax_id || (contact as any).cpf_cnpj || '');
        }
    };

    const handleGenerate = async () => {
        setErrorMessage(null);
        if (!amount || amount <= 0) {
            notify('warning', 'Atenção', 'Informe um valor válido para a cobrança.');
            return;
        }

        const selectedContact = contacts.find(c => c.id === selectedContactId);
        const gateway = gateways.find(g => g.provider === selectedProvider) || gateways[0];

        if (!gateway) {
            notify('warning', 'Atenção', 'Nenhum processador de pagamento ativo selecionado.');
            return;
        }

        setGenerating(true);
        try {
            const customerName = selectedContact?.name || customName || 'Consumidor Final';
            const customerTaxId = selectedContact?.tax_id || (selectedContact as any)?.cpf_cnpj || customTaxId || undefined;
            const invoiceNo = invoice?.invoice_number || invoice?.external_id?.slice(-6) || Date.now();

            const fine = Number(fineValue) > 0 ? { value: Number(fineValue), type: 'PERCENTAGE' as const } : undefined;
            const interest = Number(interestValue) > 0 ? { value: Number(interestValue) } : undefined;
            const discount = Number(discountValue) > 0 ? { value: Number(discountValue), dueDateLimitDays: Number(discountDaysValue) || 0, type: 'PERCENTAGE' as const } : undefined;
            const instructions = instructionsValue.trim() || undefined;

            const res = await createCharge({
                provider: selectedProvider,
                config: gateway.config,
                is_sandbox: gateway.is_sandbox,
                customerId: selectedContact?.id,
                quoteId: invoice?.quote_id || undefined,
                payload: {
                    amount: Number(amount),
                    description: description || `Ref. Nota Fiscal Nº ${invoiceNo}`,
                    due_date: dueDate,
                    currency: 'BRL',
                    customer: {
                        name: customerName,
                        email: selectedContact?.email || 'financeiro@lucrocerto.com.br',
                        tax_id: customerTaxId
                    },
                    payment_method: selectedMethod,
                    fine,
                    interest,
                    discount,
                    instructions
                }
            });

            if (res.success) {
                setResult(res);
                setExistingCharge(res);
                const methodLabel = selectedMethod === 'pix' ? 'Pix' : selectedMethod === 'credit_card' ? 'Cartão de Crédito' : selectedMethod === 'all' ? 'Cobrança Flexível' : 'Boleto bancário';
                notify('success', 'Sucesso', `${methodLabel} gerado com sucesso!`);
                onSuccess?.();
            } else {
                const errMsg = res.error || 'Falha na comunicação com o gateway de pagamento.';
                setErrorMessage(errMsg);
                notify('error', 'Erro ao Gerar Cobrança', errMsg);
            }
        } catch (error: any) {
            console.error('Error generating boleto for invoice:', error);
            const errMsg = error.message || 'Erro ao gerar boleto.';
            setErrorMessage(errMsg);
            notify('error', 'Erro', errMsg);
        } finally {
            setGenerating(false);
        }
    };

    const handleCancelBoleto = async () => {
        const targetCharge = existingCharge || result;
        if (!targetCharge) return;

        const chargeProvider = targetCharge.provider || selectedProvider;
        const providerName = chargeProvider === 'asaas' ? 'Asaas' : chargeProvider === 'mercado_pago' ? 'Mercado Pago' : 'Banco Inter';

        if (!window.confirm(`Deseja realmente cancelar esta cobrança no ${providerName}? Esta ação baixará/cancelará o título no provedor.`)) return;

        setCancelling(true);
        try {
            const session = (await supabase.auth.getSession()).data.session;
            const res = await axios.post(`${API_BASE_URL}/payments/cancel`, {
                companyId: invoice.company_id,
                chargeId: targetCharge.id || targetCharge.chargeId,
                provider: chargeProvider,
                codigoSolicitacao: targetCharge.gateway_id || targetCharge.payment_id || targetCharge.external_reference
            }, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            if (res.data.success) {
                notify('success', 'Cobrança Cancelada', `A cobrança foi cancelada no ${providerName} com sucesso!`);
                setExistingCharge(null);
                setResult(null);
                onSuccess?.();
            } else {
                notify('error', 'Erro ao Cancelar', res.data.error || 'Falha ao cancelar cobrança.');
            }
        } catch (err: any) {
            console.error('Erro ao cancelar cobrança:', err);
            notify('error', 'Erro ao Cancelar', err.response?.data?.error || err.message || 'Falha ao cancelar cobrança.');
        } finally {
            setCancelling(false);
        }
    };

    const handleCheckStatus = async () => {
        const targetCharge = existingCharge || result;
        if (!targetCharge) return;

        const code = targetCharge.gateway_id || targetCharge.external_reference || targetCharge.id;
        if (!code) return;

        const chargeProvider = targetCharge.provider || selectedProvider;
        const providerName = chargeProvider === 'asaas' ? 'Asaas' : chargeProvider === 'mercado_pago' ? 'Mercado Pago' : 'Banco Inter';

        setCheckingStatus(true);
        try {
            const session = (await supabase.auth.getSession()).data.session;
            const res = await axios.get(`${API_BASE_URL}/payments/status/${code}?companyId=${invoice.company_id}&provider=${chargeProvider}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            if (res.data.success) {
                const statusMap: Record<string, string> = {
                    approved: 'PAGO / APROVADO',
                    paid: 'PAGO / APROVADO',
                    pending: 'PENDENTE / EM ABERTO',
                    cancelled: 'CANCELADO / EXPIRADO',
                    rejected: 'RECUSADO / CANCELADO'
                };
                const formattedStatus = statusMap[res.data.status] || res.data.status;
                notify('info', `Status ${providerName}`, `Status atual no ${providerName}: ${formattedStatus}`);

                if (res.data.status === 'cancelled') {
                    setExistingCharge(null);
                    setResult(null);
                } else if (existingCharge) {
                    setExistingCharge((prev: any) => ({ ...prev, status: res.data.status }));
                }
            }
        } catch (err: any) {
            console.error('Erro ao consultar status:', err);
            notify('error', 'Erro', `Não foi possível consultar o status atual no ${providerName}.`);
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleCopyLink = async () => {
        const targetCharge = existingCharge || result;
        const textToCopy = targetCharge?.payment_link || targetCharge?.bank_slip_url || targetCharge?.invoice_url || targetCharge?.qr_code || '';

        if (!textToCopy) {
            notify('warning', 'Atenção', 'Nenhum link de boleto disponível para copiar.');
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            notify('success', 'Copiado', 'Link do boleto copiado com sucesso!');
        } catch (copyErr) {
            console.error('Erro ao copiar link:', copyErr);
            notify('error', 'Erro ao copiar', 'Não foi possível copiar o link automaticamente.');
        }
    };

    const activeCharge = existingCharge || result;
    const activeProviderName = ((activeCharge?.provider || selectedProvider || '').replace('_', ' ')).toUpperCase();

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Gestão de Boleto Bancário (${activeProviderName || 'GATEWAY'})`} icon={FileText} maxWidth="max-w-2xl">
            {loadingExisting ? (
                <div className="flex flex-col items-center justify-center py-16 text-emerald-600 gap-3">
                    <RefreshCw size={32} className="animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Verificando boletos no Banco Inter...</span>
                </div>
            ) : !activeCharge ? (
                activeGateways.length === 0 ? (
                    /* ALERTA DE GATEWAY NÃO CONFIGURADO */
                    <div className="py-4 space-y-5 animate-in fade-in duration-300">
                        <div className="p-6 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-center space-y-4 my-2">
                            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 shadow-sm">
                                <AlertCircle size={32} />
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    Nenhum Gateway de Pagamento Configurado
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                                    Para emitir e enviar boletos bancários ou cobranças Pix, sua empresa precisa ter ao menos um Gateway de Pagamento ativo (ex: Banco Inter, Asaas, Mercado Pago).
                                </p>
                            </div>

                            <div className="p-3.5 bg-amber-100/60 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/40 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-200 inline-block text-left">
                                <p className="font-bold flex items-center gap-1.5 mb-0.5">
                                    <span>📍</span> Onde configurar:
                                </p>
                                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                                    Acesse no menu lateral: <strong>Configurações &gt; Integradores / Pagamentos</strong> e ative o provedor desejado.
                                </p>
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
                                >
                                    Fechar
                                </Button>
                                <Button
                                    onClick={() => {
                                        onClose();
                                        navigate('/dashboard/settings?tab=payments');
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-emerald-500/20"
                                >
                                    Ir para Configurações de Gateways
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* FORMULÁRIO DE GERAÇÃO */
                    <div className="space-y-6 py-2">
                    {/* Alerta de Erro / Indisponibilidade caso ocorra */}
                    {errorMessage && (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-start gap-3.5 shadow-sm animate-in fade-in duration-300">
                            <AlertCircle className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" size={20} />
                            <div className="space-y-1">
                                <h5 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                                    Não foi possível comunicar com o Banco Inter
                                </h5>
                                <p className="text-xs text-rose-800 dark:text-rose-300 font-medium leading-relaxed">
                                    {errorMessage}
                                </p>
                                {selectedGateway?.is_sandbox && (
                                    <div className="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-800/40 text-[11px] text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1.5">
                                        <Info size={14} className="text-rose-600 flex-shrink-0" />
                                        <span><strong>Dica:</strong> Em ambiente de Produção os boletos funcionam 24h sem interrupção noturna.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Alerta de Nota e Tomador */}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl flex items-start gap-3">
                        <FileText className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                Nota Fiscal Nº {invoice?.invoice_number || invoice?.external_id?.slice(-6) || 'Avulsa'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 font-medium">
                                Valor da Nota: <strong className="text-emerald-600 dark:text-emerald-400">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                                </strong>
                            </p>
                        </div>
                    </div>

                    {/* Seleção do Tomador / Cliente */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Cliente / Tomador do Serviço
                        </label>
                        <select
                            value={selectedContactId}
                            onChange={(e) => handleSelectContact(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">Selecione um cliente cadastrado...</option>
                            {contacts.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.tax_id || (c as any).cpf_cnpj ? `(${c.tax_id || (c as any).cpf_cnpj})` : ''}
                                </option>
                            ))}
                        </select>

                        {!selectedContactId && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5">
                                <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                    Esta nota não possui tomador cadastrado no CRM. Os dados do pagador abaixo foram extraídos da Nota Fiscal e serão registrados no Banco Inter.
                                </p>
                            </div>
                        )}

                        {!selectedContactId && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome / Razão Social</label>
                                    <Input
                                        placeholder="Nome do Pagador"
                                        value={customName}
                                        onChange={(e) => setCustomName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">CPF ou CNPJ (obrigatório)</label>
                                    <Input
                                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                                        value={customTaxId}
                                        onChange={(e) => setCustomTaxId(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Vencimento e Valores */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <Calendar size={12} className="text-emerald-500" /> Data de Vencimento
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <CurrencyInput
                                label="Valor do Boleto (R$)"
                                value={amount}
                                onChange={(num) => setAmount(num)}
                            />
                        </div>
                    </div>

                    {/* Referência Externa / Descrição */}
                    <div>
                        <Input
                            label="Referência / Descrição do Boleto (seuNumero)"
                            placeholder="Ex: Ref. Nota Fiscal Nº 63"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Juros, Multa e Desconto (Pré-fixados) */}
                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-3">
                        <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setShowAdvancedRates(!showAdvancedRates)}
                        >
                            <div className="flex items-center gap-2">
                                <Percent size={16} className="text-emerald-500" />
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                    Juros, Multa e Desconto (Pré-fixados)
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline uppercase tracking-wider">
                                {showAdvancedRates ? 'Ocultar' : 'Ajustar / Visualizar'}
                            </span>
                        </div>

                        {showAdvancedRates && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-slate-800 animate-in fade-in duration-200">
                                <Input
                                    label="Juros ao mês (%)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={interestValue}
                                    onChange={e => setInterestValue(e.target.value)}
                                    placeholder="Ex: 1.00"
                                />
                                <Input
                                    label="Multa por atraso (%)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={fineValue}
                                    onChange={e => setFineValue(e.target.value)}
                                    placeholder="Ex: 2.00"
                                />
                                <Input
                                    label="Desconto antecipado (%)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={discountValue}
                                    onChange={e => setDiscountValue(e.target.value)}
                                    placeholder="Ex: 5.00"
                                />
                                <Input
                                    label="Prazo máximo do desconto (dias)"
                                    type="number"
                                    min="0"
                                    value={discountDaysValue}
                                    onChange={e => setDiscountDaysValue(e.target.value)}
                                    placeholder="Ex: 0"
                                />
                                <div className="sm:col-span-2">
                                    <Input
                                        label="Mensagem / Instruções do Boleto"
                                        value={instructionsValue}
                                        onChange={e => setInstructionsValue(e.target.value)}
                                        placeholder="Ex: Não receber após 30 dias do vencimento. Sujeito a protesto."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Processador de Pagamento */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Processador de Pagamento</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeGateways.map(gw => (
                                <button
                                    key={gw.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedProvider(gw.provider);
                                        setErrorMessage(null);
                                    }}
                                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                                        selectedProvider === gw.provider
                                            ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-md'
                                            : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-gray-200'
                                    }`}
                                >
                                    <div className={`p-2.5 rounded-xl ${selectedProvider === gw.provider ? 'bg-white text-emerald-600' : 'bg-gray-50 dark:bg-slate-800 text-gray-400'}`}>
                                        <CreditCard size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className="block text-xs font-black uppercase tracking-tight dark:text-white">{gw.provider.replace('_', ' ')}</span>
                                            {gw.is_default && (
                                                <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[8px] font-black px-1 py-0.5 rounded flex items-center gap-0.5 uppercase">
                                                    <Star size={8} className="fill-amber-500 text-amber-500" /> Padrão
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${gw.is_sandbox ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {gw.is_sandbox ? 'Sandbox (Manutenção Noturna)' : 'Produção 24/7'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Formas / Métodos de Pagamento Aceitos */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Método Aceito / Tipo de Cobrança</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedMethod('pix')}
                                className={clsx(
                                    "p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all text-center cursor-pointer",
                                    selectedMethod === 'pix'
                                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-500 bg-white dark:bg-slate-900"
                                )}
                            >
                                <div className={clsx(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs",
                                    selectedMethod === 'pix' ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                                )}>
                                    <QrCode size={20} />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider">Pix</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedMethod('credit_card')}
                                className={clsx(
                                    "p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all text-center cursor-pointer",
                                    selectedMethod === 'credit_card'
                                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-500 bg-white dark:bg-slate-900"
                                )}
                            >
                                <div className={clsx(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs",
                                    selectedMethod === 'credit_card' ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                                )}>
                                    <CreditCard size={20} />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider">Cartão</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedMethod('boleto')}
                                className={clsx(
                                    "p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all text-center cursor-pointer",
                                    selectedMethod === 'boleto'
                                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-500 bg-white dark:bg-slate-900"
                                )}
                            >
                                <div className={clsx(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs",
                                    selectedMethod === 'boleto' ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                                )}>
                                    <FileText size={20} />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider">Boleto</span>
                            </button>
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                        <Button variant="ghost" onClick={onClose} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGenerate}
                            isLoading={generating}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 shadow-lg shadow-emerald-500/20 font-black uppercase tracking-wider text-xs"
                        >
                            <Rocket size={16} className="mr-2" />
                            {selectedMethod === 'pix' ? 'Lançar e Gerar Pix' : selectedMethod === 'credit_card' ? 'Lançar e Gerar Link Cartão' : selectedMethod === 'all' ? 'Lançar e Gerar Cobrança' : 'Lançar e Gerar Boleto'}
                        </Button>
                    </div>
                </div>
            )
            ) : (
                /* PAINEL DE GESTÃO DO BOLETO / COBRANÇA EXISTENTE OU RECÉM-GERADA */
                (() => {
                    const method = activeCharge.payment_method || selectedMethod;
                    const isPix = method === 'pix' || !!activeCharge.qr_code || !!activeCharge.qr_code_base64;
                    const isCard = method === 'credit_card';

                    return (
                        <div className="py-4 space-y-5 animate-in zoom-in-95 duration-300">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center text-emerald-600 font-bold">
                                        {isPix ? <QrCode size={22} /> : isCard ? <CreditCard size={22} /> : <ShieldCheck size={24} />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                            Cobrança {isPix ? 'PIX' : isCard ? 'CARTÃO' : 'BOLETO'} ({activeProviderName}) Registrada
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            Referência: <strong>{activeCharge.external_reference || `NF${invoice?.invoice_number}`}</strong>
                                        </p>
                                    </div>
                                </div>

                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    activeCharge.status === 'approved' || activeCharge.status === 'paid'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                }`}>
                                    {activeCharge.status === 'approved' || activeCharge.status === 'paid' ? '✓ PAGO' : '⏳ PENDENTE'}
                                </span>
                            </div>

                            {/* Conteúdo Específico por Método (Pix vs Cartão vs Boleto) */}
                            {isPix ? (
                                <div className="p-6 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 text-center space-y-4">
                                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
                                        <QrCode size={26} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                            QR Code & Chave Pix Copia e Cola
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 max-w-sm mx-auto">
                                            Escaneie com o app do seu banco ou copie a chave Pix Copia e Cola para realizar o pagamento.
                                        </p>
                                    </div>

                                    {activeCharge.qr_code_base64 && (
                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl inline-block border border-emerald-200 dark:border-emerald-800 shadow-sm mx-auto">
                                            <img
                                                src={activeCharge.qr_code_base64.startsWith('data:') ? activeCharge.qr_code_base64 : `data:image/png;base64,${activeCharge.qr_code_base64}`}
                                                alt="QR Code Pix"
                                                className="w-48 h-48 object-contain mx-auto rounded-lg"
                                            />
                                        </div>
                                    )}

                                    {activeCharge.qr_code && (
                                        <div className="space-y-1.5 text-left max-w-md mx-auto">
                                            <label className="block text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Chave Pix Copia e Cola:</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={activeCharge.qr_code}
                                                    className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-mono text-gray-800 dark:text-gray-200 select-all focus:outline-none"
                                                />
                                                <Button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(activeCharge.qr_code);
                                                        notify('success', 'Pix Copiado', 'Chave Pix Copia e Cola copiada com sucesso!');
                                                    }}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm shrink-0"
                                                >
                                                    <Copy size={14} /> Copiar Chave
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isCard ? (
                                <div className="p-6 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-800/40 text-center space-y-4">
                                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-blue-500/20">
                                        <CreditCard size={26} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                            Link de Pagamento no Cartão
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 max-w-sm mx-auto">
                                            Envie este link para o cliente realizar o pagamento seguro com Cartão de Crédito.
                                        </p>
                                    </div>

                                    {(activeCharge.payment_link || activeCharge.qr_code) && (
                                        <div className="space-y-3 max-w-md mx-auto">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={activeCharge.payment_link || activeCharge.qr_code}
                                                    className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-mono text-gray-800 dark:text-gray-200 select-all focus:outline-none"
                                                />
                                                <Button
                                                    onClick={() => {
                                                        const link = activeCharge.payment_link || activeCharge.qr_code;
                                                        navigator.clipboard.writeText(link);
                                                        notify('success', 'Link Copiado', 'Link de pagamento no cartão copiado com sucesso!');
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm shrink-0"
                                                >
                                                    <Copy size={14} /> Copiar Link
                                                </Button>
                                            </div>
                                            {activeCharge.payment_link && (
                                                <a
                                                    href={activeCharge.payment_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                                                >
                                                    Abrir Checkout em Nova Aba <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                                    {activeCharge.payment_link ? (
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-2 px-2">
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic flex items-center gap-1">
                                                    <FileText size={14} /> PDF Oficial do Boleto ({activeProviderName})
                                                </span>
                                                <a
                                                    href={activeCharge.payment_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                >
                                                    Abrir em nova aba <ExternalLink size={12} />
                                                </a>
                                            </div>
                                            <iframe
                                                src={activeCharge.payment_link}
                                                className="w-full h-80 rounded-xl border border-gray-200 dark:border-slate-700 bg-white"
                                                title="Visualização do Boleto"
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-gray-400">
                                            <LinkIcon size={40} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-xs font-bold">Cobrança ativa registrada no banco.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Botões de Gestão (Download, Consultar Status, Cancelar) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                {!isPix && !isCard && activeCharge.payment_link && (
                                    <a
                                        href={activeCharge.payment_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={`Boleto_NF_${invoice?.invoice_number || 'Inter'}.pdf`}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 px-4 shadow-md font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                                    >
                                        <Download size={16} />
                                        Baixar PDF do Boleto
                                    </a>
                                )}

                                <Button
                                    onClick={handleCopyLink}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 shadow-md font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                                >
                                    <Copy size={16} />
                                    {isPix ? 'Copiar Chave Pix' : isCard ? 'Copiar Link do Cartão' : 'Copiar Link do Boleto'}
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={handleCheckStatus}
                                    isLoading={checkingStatus}
                                    className="rounded-xl py-3 px-4 font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={16} className={checkingStatus ? 'animate-spin' : ''} />
                                    Consultar Status no {activeProviderName || 'Gateway'}
                                </Button>

                                <Button
                                    variant="danger"
                                    onClick={handleCancelBoleto}
                                    isLoading={cancelling}
                                    className="rounded-xl py-3 px-4 font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                                >
                                    <XCircle size={16} />
                                    Cancelar {isPix ? 'Pix' : isCard ? 'Cobrança' : 'Boleto'} no {activeProviderName || 'Gateway'}
                                </Button>
                            </div>

                            <div className="pt-2 text-center border-t border-gray-100 dark:border-slate-800">
                                <Button variant="ghost" onClick={onClose} className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600">
                                    Fechar Janela
                                </Button>
                            </div>
                        </div>
                    );
                })()
            )}
        </Modal>
    );
}
