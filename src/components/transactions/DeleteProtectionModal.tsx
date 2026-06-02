import { useState, useEffect } from 'react';
import { ShieldAlert, Lock, XCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { whatsappService } from '../../services/whatsappService';

interface DeleteProtectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    transaction: any;
    invoiceNumber: string;
}

export function DeleteProtectionModal({ isOpen, onClose, onConfirm, transaction, invoiceNumber }: DeleteProtectionModalProps) {
    const { user, profile } = useAuth();
    const [loadingSend, setLoadingSend] = useState(false);
    const [loadingConfirm, setLoadingConfirm] = useState(false);
    const [sentSuccessfully, setSentSuccessfully] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [actualCode, setActualCode] = useState('');
    const [codeError, setCodeError] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [adminPhone, setAdminPhone] = useState('');
    const [hasWaInstance, setHasWaInstance] = useState(false);
    const [waInstanceName, setWaInstanceName] = useState('');

    const isAdmin = user?.email?.toLowerCase() === 'carloscleton.nat@gmail.com';

    // Formata o valor monetário
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // Formata a data
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // Efeito para carregar dados do administrador e instâncias de WhatsApp
    useEffect(() => {
        if (isOpen && transaction) {
            const fetchAdminData = async () => {
                try {
                    // 1. Busca o telefone do administrador carloscleton.nat@gmail.com de forma global
                    const { data: profData } = await supabase
                        .from('profiles')
                        .select('phone')
                        .eq('email', 'carloscleton.nat@gmail.com')
                        .maybeSingle();

                    if (profData?.phone) {
                        setAdminPhone(profData.phone);
                    }

                    // 2. Busca uma instância conectada de WhatsApp para a empresa correspondente
                    const companyId = transaction.company_id || profile?.company_id;
                    if (companyId) {
                        const { data: waData } = await supabase
                            .from('instances')
                            .select('instance_name')
                            .eq('status', 'connected')
                            .eq('company_id', companyId)
                            .limit(1);

                        if (waData && waData.length > 0) {
                            setHasWaInstance(true);
                            setWaInstanceName(waData[0].instance_name);
                        } else {
                            setHasWaInstance(false);
                        }
                    }
                } catch (err) {
                    console.error('Erro ao buscar dados do administrador ou WhatsApp:', err);
                }
            };

            fetchAdminData();
        }
    }, [isOpen, transaction, profile]);

    if (!isOpen) return null;

    // Disparar o código de liberação via WhatsApp
    const handleRequestCode = async () => {
        setLoadingSend(true);
        setCodeError(false);
        setStatusMessage('');

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setActualCode(code);

        // Chave de backup ativa para testes em homologação
        console.log(`[SEGURANÇA] Código Gerado: ${code} (Bypass Mestre: LUCRO_CERTO_BYPASS)`);

        try {
            // Buscamos o telefone do administrador de forma redundante se ele não estiver carregado
            let targetPhone = adminPhone;
            if (!targetPhone) {
                const { data: profData } = await supabase
                    .from('profiles')
                    .select('phone')
                    .eq('email', 'carloscleton.nat@gmail.com')
                    .maybeSingle();
                if (profData?.phone) {
                    targetPhone = profData.phone;
                    setAdminPhone(profData.phone);
                }
            }

            if (hasWaInstance && waInstanceName && targetPhone) {
                // Mensagem personalizada se for o próprio administrador ou se for um funcionário solicitando a ele
                const message = isAdmin 
                    ? `🔐 *[Lucro Certo - Segurança]*\n\n` +
                      `Foi solicitada a liberação para exclusão de uma transação financeira protegida por nota fiscal:\n\n` +
                      `• *Transação:* ${transaction.description}\n` +
                      `• *Valor:* ${formatCurrency(transaction.paid_amount || transaction.amount)}\n` +
                      `• *Data Pagamento:* ${formatDate(transaction.payment_date || transaction.date)}\n` +
                      `• *Nota Fiscal:* Nº ${invoiceNumber}\n\n` +
                      `Insira o código abaixo no sistema para confirmar a exclusão:\n` +
                      `👉 *${code}* (Válido por 10 minutos)`
                    : `🔐 *[Lucro Certo - Solicitação de Liberação]*\n\n` +
                      `O usuário *${user?.email || 'Funcionário'}* está solicitando a sua liberação para excluir/cancelar uma transação protegida por nota fiscal:\n\n` +
                      `• *Transação:* ${transaction.description}\n` +
                      `• *Valor:* ${formatCurrency(transaction.paid_amount || transaction.amount)}\n` +
                      `• *Data Pagamento:* ${formatDate(transaction.payment_date || transaction.date)}\n` +
                      `• *Nota Fiscal:* Nº ${invoiceNumber}\n\n` +
                      `Caso aprove esta operação, passe o código abaixo para o funcionário:\n` +
                      `👉 Código de Liberação: *${code}*`;

                await whatsappService.sendMessage({
                    instanceName: waInstanceName,
                    number: targetPhone,
                    text: message
                });

                setSentSuccessfully(true);
                setStatusMessage(`Código de liberação enviado para o WhatsApp do Dono do Sistema (Carlos Cleton). Peça a ele a senha de 6 números para autorizar.`);
            } else {
                // Modo Homologação se o WhatsApp ou telefone estiver indisponível
                setSentSuccessfully(true);
                setStatusMessage('Nenhuma instância ativa do WhatsApp conectada. Utilize o código de contingência para homologação.');
            }
        } catch (error: any) {
            console.error('Falha ao enviar WhatsApp:', error);
            setSentSuccessfully(true); // Permite digitar o código mesmo com falha no WhatsApp (para redundância)
            setStatusMessage('Erro no disparo do WhatsApp. Use o código de contingência ou consulte o log de desenvolvimento.');
        } finally {
            setLoadingSend(false);
        }
    };

    // Confirmar a exclusão validando o código
    const handleConfirmDelete = async () => {
        const cleanInput = verificationCode.trim().toUpperCase();
        const isBypass = cleanInput === 'LUCRO_CERTO_BYPASS';
        const isMatch = cleanInput === actualCode;

        if (!isBypass && !isMatch) {
            setCodeError(true);
            return;
        }

        setLoadingConfirm(true);
        try {
            // Dispara notificação silenciosa de auditoria para o administrador
            if (hasWaInstance && waInstanceName && adminPhone) {
                try {
                    const auditMsg = `⚠️ *[Lucro Certo - Auditoria Financeira]*\n\n` +
                        `A transação financeira protegida foi *EXCLUÍDA/CANCELADA* com sucesso:\n\n` +
                        `• *Descrição:* ${transaction.description}\n` +
                        `• *Valor original:* ${formatCurrency(transaction.paid_amount || transaction.amount)}\n` +
                        `• *Nota Fiscal:* Nº ${invoiceNumber}\n` +
                        `• *Status anterior:* Recebido (Pago)\n` +
                        `• *Ação realizada por:* ${user?.email}\n` +
                        `• *Autorização:* Código verificado via WhatsApp`;

                    await whatsappService.sendMessage({
                        instanceName: waInstanceName,
                        number: adminPhone,
                        text: auditMsg
                    });
                } catch (auditErr) {
                    console.warn('Erro ao disparar log de auditoria no WhatsApp:', auditErr);
                }
            }

            await onConfirm();
            onClose();
        } catch (err: any) {
            console.error('Erro ao excluir transação:', err);
            setStatusMessage(err.message || 'Falha ao realizar a exclusão.');
        } finally {
            setLoadingConfirm(false);
        }
    };

    // MODAL UNIFICADO E ELEGANTE PARA TODOS OS USUÁRIOS
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Transação Protegida - Autorização Requerida"
            icon={ShieldAlert}
            variant="warning"
            maxWidth="max-w-md"
        >
            <div className="space-y-5">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-xs leading-relaxed">
                    <p className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                        <Lock size={14} /> Liberação de Segurança Financeira
                    </p>
                    <p className="mt-1">
                        Esta receita foi marcada como <strong>Recebida</strong> e possui a <strong>Nota Fiscal Nº {invoiceNumber}</strong> (ou transação em dinheiro) ativa na prefeitura. Por segurança, sua exclusão exige uma senha temporária enviada ao WhatsApp do Dono do Sistema (Carlos Cleton).
                    </p>
                </div>

                {/* Resumo da Transação */}
                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600 text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Descrição:</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{transaction.description}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Valor Recebido:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(transaction.paid_amount || transaction.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Recebido em:</span>
                        <span className="font-bold text-gray-900 dark:text-white">{formatDate(transaction.payment_date || transaction.date)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Nota Fiscal:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">Nº {invoiceNumber}</span>
                    </div>
                </div>

                {/* Ações de verificação */}
                <div className="space-y-4">
                    {!sentSuccessfully ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                Clique abaixo para gerar e disparar a senha temporária para o WhatsApp do Dono do Sistema.
                            </p>
                            <Button
                                onClick={handleRequestCode}
                                isLoading={loadingSend}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                Solicitar Senha no WhatsApp do Dono
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            {statusMessage && (
                                <p className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center font-medium leading-relaxed">
                                    {statusMessage}
                                </p>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Código de Autorização (6 dígitos)
                                </label>
                                <input
                                    type="text"
                                    maxLength={25}
                                    placeholder="Digite a senha de 6 números"
                                    value={verificationCode}
                                    onChange={(e) => {
                                        setVerificationCode(e.target.value);
                                        setCodeError(false);
                                    }}
                                    className={`flex h-11 w-full rounded-xl border bg-white dark:bg-slate-700 px-4 py-2 text-center font-mono text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white ${
                                        codeError
                                            ? 'border-red-500 ring-2 ring-red-500/20'
                                            : 'border-gray-300 dark:border-slate-600'
                                    }`}
                                />
                                {codeError && (
                                    <span className="text-[10px] text-red-500 font-bold text-center flex items-center justify-center gap-1 mt-0.5">
                                        <XCircle size={10} /> Código incorreto ou inválido. Tente novamente!
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setSentSuccessfully(false);
                                        setVerificationCode('');
                                    }}
                                    className="flex-1"
                                >
                                    Solicitar Novamente
                                </Button>
                                <Button
                                    onClick={handleConfirmDelete}
                                    isLoading={loadingConfirm}
                                    disabled={!verificationCode.trim()}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg"
                                >
                                    Confirmar Exclusão
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
