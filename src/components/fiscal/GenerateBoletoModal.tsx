import { useState, useEffect } from 'react';
import { FileText, Calendar, CreditCard, Copy, ExternalLink, AlertCircle, Rocket, Star, Link as LinkIcon, Download, RefreshCw, XCircle, ShieldCheck } from 'lucide-react';
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

interface GenerateBoletoModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
}

export function GenerateBoletoModal({ isOpen, onClose, invoice }: GenerateBoletoModalProps) {
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
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Existing Charge State
    const [existingCharge, setExistingCharge] = useState<any>(null);
    const [loadingExisting, setLoadingExisting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);

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

    // Check if a boleto has already been created for this invoice
    useEffect(() => {
        if (isOpen && invoice) {
            setResult(null);
            setExistingCharge(null);
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
    }, [isOpen, invoice, contacts, gateways, defaultGateway]);

    const activeGateways = gateways.filter(g => g.is_active);

    const handleSelectContact = (contactId: string) => {
        setSelectedContactId(contactId);
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            setCustomName(contact.name);
            setCustomTaxId(contact.tax_id || (contact as any).cpf_cnpj || '');
        }
    };

    const handleGenerate = async () => {
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
                    payment_method: selectedProvider === 'banco_inter' ? 'boleto' : 'all'
                }
            });

            if (res.success) {
                setResult(res);
                setExistingCharge(res);
                notify('success', 'Sucesso', 'Boleto do Banco Inter gerado com sucesso!');
            } else {
                notify('error', 'Erro ao Gerar Boleto', res.error || 'Falha na comunicação com o Banco Inter.');
            }
        } catch (error: any) {
            console.error('Error generating boleto for invoice:', error);
            notify('error', 'Erro', error.message || 'Erro ao gerar boleto.');
        } finally {
            setGenerating(false);
        }
    };

    const handleCancelBoleto = async () => {
        const targetCharge = existingCharge || result;
        if (!targetCharge) return;

        if (!window.confirm('Deseja realmente cancelar este boleto no Banco Inter? Esta ação baixará o título no banco.')) return;

        setCancelling(true);
        try {
            const session = (await supabase.auth.getSession()).data.session;
            const res = await axios.post(`${API_BASE_URL}/payments/inter/cancel`, {
                companyId: invoice.company_id,
                chargeId: targetCharge.id,
                codigoSolicitacao: targetCharge.gateway_id || targetCharge.external_reference
            }, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            if (res.data.success) {
                notify('success', 'Boleto Cancelado', 'O boleto foi cancelado no Banco Inter com sucesso!');
                setExistingCharge(null);
                setResult(null);
            } else {
                notify('error', 'Erro ao Cancelar', res.data.error || 'Falha ao cancelar boleto.');
            }
        } catch (err: any) {
            console.error('Erro ao cancelar boleto:', err);
            notify('error', 'Erro ao Cancelar', err.response?.data?.error || err.message || 'Falha ao cancelar boleto.');
        } finally {
            setCancelling(false);
        }
    };

    const handleCheckStatus = async () => {
        const targetCharge = existingCharge || result;
        if (!targetCharge) return;

        const code = targetCharge.gateway_id || targetCharge.external_reference;
        if (!code) return;

        setCheckingStatus(true);
        try {
            const session = (await supabase.auth.getSession()).data.session;
            const res = await axios.get(`${API_BASE_URL}/payments/inter/status/${code}?companyId=${invoice.company_id}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            if (res.data.success) {
                const statusMap: Record<string, string> = {
                    approved: 'PAGO / APROVADO',
                    pending: 'PENDENTE / EM ABERTO',
                    cancelled: 'CANCELADO / EXPIRADO'
                };
                const formattedStatus = statusMap[res.data.status] || res.data.status;
                notify('info', 'Status Banco Inter', `Status atual no Banco Inter: ${formattedStatus}`);

                if (res.data.status === 'cancelled') {
                    setExistingCharge(null);
                    setResult(null);
                } else if (existingCharge) {
                    setExistingCharge((prev: any) => ({ ...prev, status: res.data.status }));
                }
            }
        } catch (err: any) {
            console.error('Erro ao consultar status:', err);
            notify('error', 'Erro', 'Não foi possível consultar o status atual no Banco Inter.');
        } finally {
            setCheckingStatus(false);
        }
    };

    const activeCharge = existingCharge || result;

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestão de Boleto Bancário (Banco Inter)" icon={FileText} maxWidth="max-w-2xl">
            {loadingExisting ? (
                <div className="flex flex-col items-center justify-center py-16 text-emerald-600 gap-3">
                    <RefreshCw size={32} className="animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Verificando boletos no Banco Inter...</span>
                </div>
            ) : !activeCharge ? (
                /* FORMULÁRIO DE GERAÇÃO */
                <div className="space-y-6 py-2">
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

                    {/* Processador de Pagamento */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Processador de Pagamento</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeGateways.map(gw => (
                                <button
                                    key={gw.id}
                                    type="button"
                                    onClick={() => setSelectedProvider(gw.provider)}
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
                                            {gw.is_sandbox ? 'Sandbox' : 'Produção'}
                                        </span>
                                    </div>
                                </button>
                            ))}
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
                            Lançar e Gerar Boleto
                        </Button>
                    </div>
                </div>
            ) : (
                /* PAINEL DE GESTÃO DO BOLETO EXISTENTE OU RECÉM-GERADO */
                <div className="py-4 space-y-5 animate-in zoom-in-95 duration-300">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center text-emerald-600">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    Boleto Banco Inter Registrado
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

                    {/* Visualizador de PDF Embutido */}
                    <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                        {activeCharge.payment_link ? (
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2 px-2">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic flex items-center gap-1">
                                        <FileText size={14} /> PDF Oficial do Boleto Banco Inter
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

                    {/* Botões de Gestão (Download, Consultar Status, Cancelar Boleto) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {activeCharge.payment_link && (
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
                            onClick={() => {
                                const key = activeCharge.qr_code || activeCharge.payment_link;
                                navigator.clipboard.writeText(key);
                                notify('success', 'Copiado', 'Link do boleto copiado com sucesso!');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 shadow-md font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                        >
                            <Copy size={16} />
                            Copiar Link do Boleto
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleCheckStatus}
                            isLoading={checkingStatus}
                            className="rounded-xl py-3 px-4 font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} className={checkingStatus ? 'animate-spin' : ''} />
                            Consultar Status no Inter
                        </Button>

                        <Button
                            variant="danger"
                            onClick={handleCancelBoleto}
                            isLoading={cancelling}
                            className="rounded-xl py-3 px-4 font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} />
                            Cancelar Boleto no Banco Inter
                        </Button>
                    </div>

                    <div className="pt-2 text-center border-t border-gray-100 dark:border-slate-800">
                        <Button variant="ghost" onClick={onClose} className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600">
                            Fechar Janela
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
