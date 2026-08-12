import { useState, useEffect } from 'react';
import { FileText, Calendar, CreditCard, Copy, ExternalLink, AlertCircle, Rocket, CheckCircle2, Star, Link as LinkIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useContacts } from '../../hooks/useContacts';
import { usePaymentGateways } from '../../hooks/usePaymentGateways';
import { useCharges } from '../../hooks/useCharges';
import { useNotification } from '../../context/NotificationContext';

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

    // Initial default due date: +15 days from today
    const getDefaultDueDate = () => {
        const date = new Date();
        date.setDate(date.getDate() + 15);
        return date.toISOString().split('T')[0];
    };

    useEffect(() => {
        if (isOpen && invoice) {
            setResult(null);
            setAmount(Number(invoice.amount || invoice.valor || 0));
            setDescription(`Ref. Nota Fiscal Nº ${invoice.invoice_number || invoice.external_id?.slice(-6) || ''}`);
            setDueDate(getDefaultDueDate());

            // Tenta identificar o cliente tomador vinculado à nota
            const contactId = invoice.customer_id || invoice.contact_id || invoice.quote?.contact_id || '';
            const matchedContact = contacts.find(c => c.id === contactId);

            if (matchedContact) {
                setSelectedContactId(matchedContact.id);
                setCustomName(matchedContact.name);
                setCustomTaxId(matchedContact.tax_id || matchedContact.cpf_cnpj || '');
            } else {
                // Tenta puxar do payload tomador se existir
                const tomador = invoice.payload?.tomador;
                if (tomador) {
                    setCustomName(tomador.razaoSocial || tomador.nome || '');
                    setCustomTaxId(tomador.cpfCnpj || tomador.cnpj || tomador.cpf || '');
                } else {
                    setCustomName('');
                    setCustomTaxId('');
                }
                setSelectedContactId('');
            }

            // Define o gateway padrão
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
            setCustomTaxId(contact.tax_id || contact.cpf_cnpj || '');
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
            const customerTaxId = selectedContact?.tax_id || selectedContact?.cpf_cnpj || customTaxId || undefined;

            const res = await createCharge({
                provider: selectedProvider,
                config: gateway.config,
                is_sandbox: gateway.is_sandbox,
                customerId: selectedContact?.id,
                quoteId: invoice?.quote_id || undefined,
                payload: {
                    amount: Number(amount),
                    description: description || `Ref. Nota Fiscal Nº ${invoice?.invoice_number || ''}`,
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

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Emissão de Boleto Bancário (Banco Inter)" icon={FileText} maxWidth="max-w-2xl">
            {!result ? (
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
                                    {c.name} {c.tax_id || c.cpf_cnpj ? `(${c.tax_id || c.cpf_cnpj})` : ''}
                                </option>
                            ))}
                        </select>

                        {!selectedContactId && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5">
                                <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                    Esta nota não possui tomador cadastrado (Consumidor Final). Selecione um cliente da lista ou informe os dados do pagador abaixo para registrar no Banco Inter.
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
                            label="Referência / Descrição do Boleto"
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
                /* Resultado Gerado com Visualizador de PDF Embutido */
                <div className="py-6 text-center space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
                        <CheckCircle2 size={36} />
                    </div>

                    <div className="space-y-1">
                        <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Boleto Emitido com Sucesso!</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">O boleto do Banco Inter foi registrado e está pronto para o cliente.</p>
                    </div>

                    <div className="max-w-md mx-auto p-2 bg-gray-50 dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-inner">
                        {result.payment_link ? (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2 px-2">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic flex items-center gap-1">
                                        <FileText size={14} /> Boleto Digital (Banco Inter)
                                    </span>
                                    <a
                                        href={result.payment_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        Abrir em nova aba <ExternalLink size={12} />
                                    </a>
                                </div>
                                <iframe
                                    src={result.payment_link}
                                    className="w-full h-80 rounded-xl border border-gray-200 dark:border-slate-700 bg-white"
                                    title="Visualização do Boleto"
                                />
                            </div>
                        ) : (
                            <div className="p-8 bg-white dark:bg-slate-800 rounded-[1.5rem] text-emerald-600/30 shadow-sm border border-gray-50 dark:border-slate-700">
                                <LinkIcon size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Cobrança Registrada</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2.5 max-w-sm mx-auto pt-2">
                        {result.payment_link && (
                            <a
                                href={result.payment_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3 shadow-lg shadow-blue-500/20 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                <ExternalLink size={16} />
                                Visualizar / Baixar Boleto (PDF)
                            </a>
                        )}
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 shadow-lg shadow-emerald-500/20 font-black uppercase tracking-widest text-xs"
                            onClick={() => {
                                const key = result.qr_code || result.payment_link;
                                navigator.clipboard.writeText(key);
                                notify('success', 'Copiado', 'Link do boleto copiado com sucesso!');
                            }}
                        >
                            <Copy size={16} className="mr-2" />
                            Copiar Link do Boleto
                        </Button>
                        <Button variant="ghost" className="w-full font-bold uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600" onClick={onClose}>
                            Concluir e Fechar
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
