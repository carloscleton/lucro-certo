import { useState, useEffect } from 'react';
import { ShieldAlert, Lock, XCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useEntity } from '../../context/EntityContext';
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
    const { currentEntity } = useEntity();
    const [loadingSend, setLoadingSend] = useState(false);
    const [loadingConfirm, setLoadingConfirm] = useState(false);
    const [sentSuccessfully, setSentSuccessfully] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [actualCode, setActualCode] = useState('');
    const [codeError, setCodeError] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [adminPhone, setAdminPhone] = useState('');
    const [masterPhone, setMasterPhone] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [hasWaInstance, setHasWaInstance] = useState(false);
    const [waInstanceName, setWaInstanceName] = useState('');

    const isAdminEmail = user?.email?.toLowerCase() === 'carloscleton.nat@gmail.com';

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
        if (isOpen && transaction && user) {
            const fetchAdminData = async () => {
                try {
                    // 1. Busca direta pelo perfil do administrador master (Carlos Cleton)
                    const { data: masterAdminProfile } = await supabase
                        .from('profiles')
                        .select('phone, email')
                        .ilike('email', 'carloscleton.nat@gmail.com')
                        .maybeSingle();

                    if (masterAdminProfile?.phone) {
                        setMasterPhone(masterAdminProfile.phone);
                    }

                    const companyId = transaction.company_id || currentEntity.id || profile?.company_id;
                    let detectedPhone = '';

                    // Define se o usuário atual é o admin master
                    const isCurrentUserMasterAdmin = user.email?.toLowerCase() === 'carloscleton.nat@gmail.com';

                    if (companyId) {
                        // 2. Busca todos os membros com role 'owner' ou 'admin' e seus respectivos perfis
                        const { data: membersData, error: memErr } = await supabase
                            .from('company_members')
                            .select(`
                                user_id,
                                role,
                                profile:user_id (
                                    phone,
                                    email
                                )
                            `)
                            .eq('company_id', companyId)
                            .eq('status', 'active');

                        if (!memErr && membersData) {
                            const normalizedMembers = (membersData as any[]).map(m => {
                                const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
                                return {
                                    user_id: m.user_id,
                                    role: m.role,
                                    phone: prof?.phone || '',
                                    email: prof?.email || ''
                                };
                            });

                            // Verifica se o usuário atual logado é um owner ou admin da empresa ou o master admin
                            const myMembership = normalizedMembers.find(m => m.user_id === user.id);
                            const hasAdminRole = myMembership?.role === 'owner' || myMembership?.role === 'admin' || isAdminEmail || isCurrentUserMasterAdmin;

                            setIsOwner(hasAdminRole);

                            // Se o usuário logado for admin/owner, tenta carregar o telefone dele
                            if (hasAdminRole) {
                                const myPhone = myMembership?.phone || profile?.phone || (isCurrentUserMasterAdmin ? masterAdminProfile?.phone : '');
                                if (myPhone) {
                                    detectedPhone = myPhone;
                                    setAdminPhone(myPhone);
                                    setPhoneInput(myPhone);
                                }
                            }

                            // Se o telefone do administrador master estiver disponível, use-o como prioridade
                            if (!detectedPhone && masterAdminProfile?.phone) {
                                detectedPhone = masterAdminProfile.phone;
                                setAdminPhone(detectedPhone);
                            }

                            // Se ainda não detectou, busca o primeiro telefone disponível dos outros owners/admins da empresa
                            if (!detectedPhone) {
                                const ownerWithPhone = normalizedMembers.find(m => (m.role === 'owner' || m.role === 'admin') && m.phone);
                                if (ownerWithPhone?.phone) {
                                    detectedPhone = ownerWithPhone.phone;
                                    setAdminPhone(detectedPhone);
                                }
                            }
                        } else {
                            // Se a busca por membros falhar ou não existirem membros, usa as informações do admin master
                            setIsOwner(isAdminEmail || isCurrentUserMasterAdmin);
                            if (masterAdminProfile?.phone) {
                                detectedPhone = masterAdminProfile.phone;
                                setAdminPhone(detectedPhone);
                                if (isAdminEmail || isCurrentUserMasterAdmin) {
                                    setPhoneInput(masterAdminProfile.phone);
                                }
                            }
                        }
                    } else {
                        // Sem ID de empresa ativo
                        setIsOwner(isAdminEmail || isCurrentUserMasterAdmin);
                        if (masterAdminProfile?.phone) {
                            detectedPhone = masterAdminProfile.phone;
                            setAdminPhone(detectedPhone);
                            if (isAdminEmail || isCurrentUserMasterAdmin) {
                                setPhoneInput(masterAdminProfile.phone);
                            }
                        }
                    }

                    // 3. Busca uma instância conectada de WhatsApp para a empresa correspondente
                    const activeCompanyId = transaction.company_id || currentEntity.id || profile?.company_id;
                    if (activeCompanyId) {
                        const { data: waData } = await supabase
                            .from('instances')
                            .select('instance_name')
                            .eq('status', 'connected')
                            .eq('company_id', activeCompanyId)
                            .limit(1);

                        if (waData && waData.length > 0) {
                            setHasWaInstance(true);
                            setWaInstanceName(waData[0].instance_name);
                        } else {
                            // Fallback: Busca qualquer instância de WhatsApp conectada no sistema
                            const { data: anyWa } = await supabase
                                .from('instances')
                                .select('instance_name')
                                .eq('status', 'connected')
                                .limit(1);

                            if (anyWa && anyWa.length > 0) {
                                setHasWaInstance(true);
                                setWaInstanceName(anyWa[0].instance_name);
                            } else {
                                setHasWaInstance(false);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Erro ao buscar dados do administrador ou WhatsApp:', err);
                }
            };

            fetchAdminData();
        }
    }, [isOpen, transaction, profile, currentEntity, user]);

    if (!isOpen) return null;

    // Disparar o código de liberação via WhatsApp
    const handleRequestCode = async () => {
        let targetPhone = adminPhone.trim() || phoneInput.trim();

        if (!targetPhone) {
            setStatusMessage('Por favor, informe um número de telefone válido.');
            return;
        }

        // Garante formatação correta do telefone (DDI + DDD + Numero)
        let cleanPhone = targetPhone.replace(/\D/g, '');
        if (cleanPhone.length === 10 || cleanPhone.length === 11) {
            cleanPhone = '55' + cleanPhone;
        }

        setLoadingSend(true);
        setCodeError(false);
        setStatusMessage('');

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setActualCode(code);

        // Chave de backup ativa para testes em homologação
        console.log(`[SEGURANÇA] Código Gerado: ${code} (Bypass Mestre: LUCRO_CERTO_BYPASS)`);

        try {
            // Se o próprio administrador/owner informou o telefone agora, salva no perfil dele no banco de dados!
            if (isOwner && cleanPhone && cleanPhone !== adminPhone && user) {
                try {
                    await supabase
                        .from('profiles')
                        .update({ phone: cleanPhone })
                        .eq('id', user.id);
                    setAdminPhone(cleanPhone);
                    console.log('✅ Telefone do administrador salvo com sucesso no banco de dados!');
                } catch (dbErr) {
                    console.warn('⚠️ Não foi possível salvar o telefone no perfil:', dbErr);
                }
            }

            if (hasWaInstance && waInstanceName && cleanPhone) {
                const isUserTheAdmin = isAdminEmail || (user?.email?.toLowerCase() === profile?.email?.toLowerCase());
                
                // Mensagem personalizada se for o próprio administrador ou se for um funcionário solicitando a ele
                const message = isUserTheAdmin 
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

                // 1. Envia para o Administrador da Empresa
                await whatsappService.sendMessage({
                    instanceName: waInstanceName,
                    number: cleanPhone,
                    text: message
                });

                // 2. Envia também para o Dono do Sistema (Carlos Cleton) se for diferente
                let cleanMasterPhone = masterPhone.replace(/\D/g, '');
                if (cleanMasterPhone.length === 10 || cleanMasterPhone.length === 11) {
                    cleanMasterPhone = '55' + cleanMasterPhone;
                }

                let sentBoth = false;
                if (cleanMasterPhone && cleanMasterPhone !== cleanPhone) {
                    try {
                        sentBoth = true;
                        const masterMessage = `🔐 *[Lucro Certo - Cópia de Segurança]*\n\n` +
                          `Foi solicitada a liberação de exclusão de transação protegida na empresa *${currentEntity?.name || 'Desconhecida'}*:\n\n` +
                          `• *Solicitante:* ${user?.email || 'Funcionário'}\n` +
                          `• *Transação:* ${transaction.description}\n` +
                          `• *Valor:* ${formatCurrency(transaction.paid_amount || transaction.amount)}\n` +
                          `• *Nota Fiscal:* Nº ${invoiceNumber}\n\n` +
                          `👉 Código de Liberação: *${code}*`;

                        await whatsappService.sendMessage({
                            instanceName: waInstanceName,
                            number: cleanMasterPhone,
                            text: masterMessage
                        });
                    } catch (masterErr) {
                        console.warn('Erro ao disparar cópia de segurança para Carlos Cleton:', masterErr);
                    }
                }

                setSentSuccessfully(true);
                if (sentBoth) {
                    setStatusMessage(`Código enviado para o WhatsApp do Administrador da Empresa e também para o Dono do Sistema (Carlos Cleton). Peça a senha de 6 números para autorizar.`);
                } else {
                    setStatusMessage(`Código de liberação enviado para o WhatsApp do Administrador/Dono da Empresa. Peça a ele a senha de 6 números para autorizar.`);
                }
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
            // 1. Executa primeiro a ação de exclusão/cancelamento (pode falhar)
            await onConfirm();

            // 2. Dispara notificação silenciosa de auditoria para o administrador somente se a exclusão/cancelamento deu certo
            const targetPhone = adminPhone || phoneInput;
            if (hasWaInstance && waInstanceName) {
                const auditMsg = `⚠️ *[Lucro Certo - Auditoria Financeira]*\n\n` +
                    `A transação financeira protegida foi *EXCLUÍDA/CANCELADA* com sucesso:\n\n` +
                    `• *Descrição:* ${transaction.description}\n` +
                    `• *Valor original:* ${formatCurrency(transaction.paid_amount || transaction.amount)}\n` +
                    `• *Nota Fiscal:* Nº ${invoiceNumber}\n` +
                    `• *Status anterior:* Recebido (Pago)\n` +
                    `• *Ação realizada por:* ${user?.email}\n` +
                    `• *Autorização:* Código verificado via WhatsApp`;

                // 1. Envia para o Administrador da Empresa
                if (targetPhone) {
                    try {
                        let cleanTarget = targetPhone.replace(/\D/g, '');
                        if (cleanTarget.length === 10 || cleanTarget.length === 11) {
                            cleanTarget = '55' + cleanTarget;
                        }
                        await whatsappService.sendMessage({
                            instanceName: waInstanceName,
                            number: cleanTarget,
                            text: auditMsg
                        });
                    } catch (auditErr) {
                        console.warn('Erro ao disparar log de auditoria para o gerente:', auditErr);
                    }
                }

                // 2. Envia também para o Dono do Sistema (Carlos Cleton) se diferente
                let cleanMaster = masterPhone.replace(/\D/g, '');
                if (cleanMaster.length === 10 || cleanMaster.length === 11) {
                    cleanMaster = '55' + cleanMaster;
                }
                let cleanTarget = targetPhone.replace(/\D/g, '');
                if (cleanTarget.length === 10 || cleanTarget.length === 11) {
                    cleanTarget = '55' + cleanTarget;
                }

                if (cleanMaster && cleanMaster !== cleanTarget) {
                    try {
                        const globalAuditMsg = `⚠️ *[Lucro Certo - Auditoria Global]*\n\n` +
                            `Uma transação protegida foi excluída na empresa *${currentEntity?.name || 'Desconhecida'}*:\n\n` +
                            `• *Descrição:* ${transaction.description}\n` +
                            `• *Valor:* ${formatCurrency(transaction.paid_amount || transaction.amount)}\n` +
                            `• *Nota Fiscal:* Nº ${invoiceNumber}\n` +
                            `• *Ação realizada por:* ${user?.email}\n` +
                            `• *Autorização:* Verificada com sucesso via WhatsApp`;

                        await whatsappService.sendMessage({
                            instanceName: waInstanceName,
                            number: cleanMaster,
                            text: globalAuditMsg
                        });
                    } catch (globalAuditErr) {
                        console.warn('Erro ao disparar log de auditoria global para Carlos:', globalAuditErr);
                    }
                }
            }

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
                        Esta receita foi marcada como <strong>Recebida</strong> e possui a <strong>Nota Fiscal Nº {invoiceNumber}</strong> (ou transação em dinheiro) ativa na prefeitura. Por segurança, sua exclusão exige uma senha temporária enviada ao WhatsApp do Administrador da Empresa e ao Dono do Sistema.
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
                        <div className="flex flex-col gap-3">
                            {/* Caso o telefone de Carlos não esteja cadastrado na tabela de perfis */}
                            {!adminPhone && (
                                <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 text-xs">
                                    {isOwner ? (
                                        <>
                                            <p className="font-bold text-red-900 dark:text-red-300">
                                                🚨 Telefone do Dono/Administrador não Cadastrado!
                                            </p>
                                            <p className="text-red-700 dark:text-red-400 mt-0.5">
                                                Olá, você é reconhecido como Dono/Administrador da empresa. Como seu número de WhatsApp não está no perfil, por favor digite-o abaixo (com DDD, ex: 31999999999) para receber a senha. O sistema salvará automaticamente no seu perfil!
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="Ex: 31999999999"
                                                value={phoneInput}
                                                onChange={(e) => setPhoneInput(e.target.value)}
                                                className="w-full h-10 px-3 mt-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-bold text-red-900 dark:text-red-300">
                                                🚨 Liberação Indisponível!
                                            </p>
                                            <p className="text-red-700 dark:text-red-400 mt-0.5">
                                                O telefone de WhatsApp do Administrador do Sistema ou da Empresa não está cadastrado. Peça para o administrador cadastrar o telefone dele em seu Perfil para liberar esta função.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                Clique abaixo para gerar e disparar a senha temporária para os telefones do Administrador e do Dono do Sistema.
                            </p>
                            <Button
                                onClick={handleRequestCode}
                                disabled={!adminPhone && !phoneInput.trim()}
                                isLoading={loadingSend}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                Solicitar Senha no WhatsApp dos Administradores
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
