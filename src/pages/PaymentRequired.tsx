import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { CreditCard, AlertTriangle, Check, Sparkles, Building2, ShieldAlert, Lock, Unlock, Send, XCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect, useMemo } from 'react';
import logoFull from '../assets/logo-full.png';
import { Modal } from '../components/ui/Modal';
import { whatsappService } from '../services/whatsappService';
import { PlanDetailsModal } from '../components/settings/PlanDetailsModal';

export function PaymentRequired() {
    const { user, session: authSession, profile, signOut } = useAuth();
    const { currentEntity, availableEntities, refresh: refreshEntity } = useEntity();
    const [loading, setLoading] = useState(false);
    const [appSettings, setAppSettings] = useState<any>(null);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [documentStr, setDocumentStr] = useState('');
    const [phoneStr, setPhoneStr] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedPlanForDetails, setSelectedPlanForDetails] = useState<any | null>(null);
    const [phoneError, setPhoneError] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState('BRL');
    const [currencySymbol, setCurrencySymbol] = useState('R$');
    const navigate = useNavigate();

    // Estados para o fluxo de liberação temporária (bypass de 24h)
    const [isBypassModalOpen, setIsBypassModalOpen] = useState(false);
    const [loadingSendCode, setLoadingSendCode] = useState(false);
    const [loadingConfirmBypass, setLoadingConfirmBypass] = useState(false);
    const [sentSuccessfully, setSentSuccessfully] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [actualCode, setActualCode] = useState('');
    const [codeError, setCodeError] = useState(false);
    const [bypassStatusMessage, setBypassStatusMessage] = useState('');
    const [masterPhone, setMasterPhone] = useState('');
    const [showManualButton, setShowManualButton] = useState(false);
    const [companyData, setCompanyData] = useState<any>(null);
    const [companyBillingConfig, setCompanyBillingConfig] = useState<any>(null);

    const resolveTargetCompanyId = async (): Promise<string | null> => {
        // 1. Empresa selecionada no contexto
        if (currentEntity?.type === 'company' && currentEntity.id && currentEntity.id !== 'personal') {
            return currentEntity.id;
        }

        // 2. Primeira empresa disponível em availableEntities
        if (availableEntities && availableEntities.length > 0) {
            const comp = availableEntities.find(e => e.type === 'company' && e.id && e.id !== 'personal');
            if (comp?.id) return comp.id;
        }

        // 3. profile.company_id
        if (profile?.company_id && profile.company_id !== 'personal') {
            return profile.company_id;
        }

        // 4. company_members pelo user.id
        if (user?.id) {
            const { data: memberRows } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (memberRows && memberRows.length > 0 && memberRows[0].company_id) {
                return memberRows[0].company_id;
            }
        }

        // 5. companies pelo user_id do dono
        if (user?.id) {
            const { data: ownerComp } = await supabase
                .from('companies')
                .select('id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (ownerComp && ownerComp.length > 0 && ownerComp[0].id) {
                return ownerComp[0].id;
            }
        }

        // 6. companies pelo documento digitado na tela
        const clean = documentStr.replace(/\D/g, '');
        if (clean.length === 11 || clean.length === 14) {
            const isCnpj = clean.length === 14;
            const { data: docComp } = await supabase
                .from('companies')
                .select('id')
                .eq(isCnpj ? 'cnpj' : 'cpf', clean)
                .order('created_at', { ascending: false })
                .limit(1);

            if (docComp && docComp.length > 0 && docComp[0].id) {
                return docComp[0].id;
            }
        }

        return null;
    };

    // Carrega dados da empresa e configuracoes customizadas por cliente (Imagem 2)
    useEffect(() => {
        const fetchCompanyBilling = async () => {
            const targetId = await resolveTargetCompanyId();

            if (targetId && targetId !== 'personal') {
                const { data } = await supabase
                    .from('companies')
                    .select('id, trade_name, settings, subscription_plan, next_billing_value, currency, cnpj, cpf, phone')
                    .eq('id', targetId)
                    .maybeSingle();

                if (data) {
                    setCompanyData(data);
                    setCompanyBillingConfig(data.settings?.admin_fiscal_billing || null);
                }
            }
        };
        fetchCompanyBilling();
    }, [currentEntity, profile, user, availableEntities]);

    // Calculo dinamico do resumo financeiro (Imagem 1 & Imagem 2)
    const [cycleNotesCount, setCycleNotesCount] = useState(0);
    const [cycleNotesCost, setCycleNotesCost] = useState(0);

    useEffect(() => {
        const fetchCycleNotes = async () => {
            const targetId = companyData?.id || (await resolveTargetCompanyId());
            if (!targetId || targetId === 'personal') return;

            const clientBilling = companyBillingConfig || companyData?.settings?.admin_fiscal_billing || currentEntity?.settings?.admin_fiscal_billing || {};
            const cycleStartDay = typeof clientBilling.billing_cycle_start_day === 'number'
                ? clientBilling.billing_cycle_start_day
                : 1;

            const today = new Date();
            let cycleStart = new Date(today.getFullYear(), today.getMonth(), cycleStartDay, 0, 0, 0, 0);
            if (today.getDate() < cycleStartDay) {
                cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, cycleStartDay, 0, 0, 0, 0);
            }

            const lastBilledAt = clientBilling.last_billed_at ? new Date(clientBilling.last_billed_at) : null;
            const effectiveStart = lastBilledAt && lastBilledAt > cycleStart ? lastBilledAt : cycleStart;

            const { data: invData, error: invErr } = await supabase
                .from('fiscal_invoices')
                .select('id, status, created_at, type, deleted')
                .eq('company_id', targetId)
                .gte('created_at', effectiveStart.toISOString());

            if (invErr) {
                console.warn('[PaymentRequired] Erro ao buscar fiscal_invoices:', invErr);
            }

            if (invData && invData.length > 0) {
                const activeFiscalProvider = companyData?.settings?.fiscal_provider || currentEntity?.settings?.fiscal_provider || 'national';
                const providerCfg = clientBilling[activeFiscalProvider] || clientBilling.national || clientBilling.tecnospeed || clientBilling.other || {};
                const perNoteFee = typeof providerCfg.per_note_fee === 'number' ? providerCfg.per_note_fee : 0.50;

                const validNotes = invData.filter((i: any) => 
                    !i.deleted && ['concluido', 'autorizada', 'concluído', 'autorizado', 'cancelado', 'cancelada'].includes(String(i.status).toLowerCase())
                );

                const count = validNotes.length;
                const cost = count * perNoteFee;
                setCycleNotesCount(count);
                setCycleNotesCost(cost);
            } else {
                setCycleNotesCount(0);
                setCycleNotesCost(0);
            }
        };

        fetchCycleNotes();
    }, [companyData, companyBillingConfig, currentEntity, documentStr]);

    const { monthlyPrice, pendingSetupFee, totalInitial } = useMemo(() => {
        let price = 0;
        if (selectedPlan?.price) {
            const priceStr = selectedPlan.price.toString().replace('R$', '').replace('.', '').replace(',', '.').trim();
            price = parseFloat(priceStr) || 0;
        }

        // Se houver valor fixo mensal customizado para a empresa em admin_fiscal_billing
        const activeFiscalProvider = companyData?.settings?.fiscal_provider || 'tecnospeed';
        const clientBilling = companyBillingConfig || companyData?.settings?.admin_fiscal_billing;

        if (clientBilling && clientBilling.fixed_enabled !== false) {
            const customFixed = clientBilling[activeFiscalProvider]?.fixed_fee ?? clientBilling.other?.fixed_fee;
            if (typeof customFixed === 'number' && customFixed > 0) {
                price = customFixed;
            }
        } else if (companyData?.next_billing_value && Number(companyData.next_billing_value) > 0) {
            price = Number(companyData.next_billing_value);
        }

        // Taxa de implantacao configurada para o cliente (ou padrao do plano se nao houver no cliente)
        const rawSetup = typeof clientBilling?.setup_fee === 'number'
            ? clientBilling.setup_fee
            : parseFloat(selectedPlan?.setup_fee || '0');
        const isPaid = clientBilling?.setup_fee_paid === true;
        const setup = (!isPaid && rawSetup > 0) ? rawSetup : 0;

        return {
            monthlyPrice: price,
            pendingSetupFee: setup,
            totalInitial: price + setup + cycleNotesCost
        };
    }, [selectedPlan, companyBillingConfig, companyData, cycleNotesCost]);

    const formatAmount = (val: number) => {
        return Number.isInteger(val) ? val.toString() : val.toFixed(2);
    };

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
            if (data) {
                setAppSettings(data);
                // Pré-selecionar o plano atual ou o primeiro visível
                const plans = data.landing_plans || [];
                const current = plans.find((p: any) => p.name?.toLowerCase() === currentEntity?.subscription_plan?.toLowerCase() && p.enabled !== false);
                setSelectedPlan(current || plans.find((p: any) => p.enabled !== false));
            }
        };
        fetchSettings();
    }, [currentEntity]);

    useEffect(() => {
        if (currentEntity) {
            if (!documentStr) {
                setDocumentStr(formatDocument((currentEntity as any).document || currentEntity.cnpj || ''));
            }
            if (!phoneStr) {
                setPhoneStr(formatPhone(currentEntity.phone || profile?.phone || ''));
            }
        }
    }, [currentEntity, profile]);

    useEffect(() => {
        const fetchMasterPhone = async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('phone')
                    .ilike('email', 'carloscleton.nat@gmail.com')
                    .maybeSingle();
                
                if (data?.phone) {
                    setMasterPhone(data.phone);
                } else {
                    setMasterPhone('5584998071213'); // Fallback
                }
            } catch (err) {
                console.error('Erro ao buscar telefone do dono do sistema:', err);
                setMasterPhone('5584998071213'); // Fallback
            }
        };
        fetchMasterPhone();
    }, []);

    // Efeito para enviar notificação automática de teste expirado ao dono do sistema
    useEffect(() => {
        const isTrial = currentEntity?.subscription_plan === 'trial';
        const isTrialExpired = (currentEntity as any)?.trial_ends_at && 
                               new Date((currentEntity as any).trial_ends_at) < new Date();

        if (isTrial && isTrialExpired && masterPhone) {
            const notifyKey = `lc:trial-expired-sent:${currentEntity.id || 'personal'}`;
            if (!localStorage.getItem(notifyKey)) {
                const notifyTrialExpired = async () => {
                    try {
                        let hasWaInstance = false;
                        let waInstanceName = '';
                        const activeCompanyId = currentEntity.id || profile?.company_id;
                        
                        if (activeCompanyId && activeCompanyId !== 'personal') {
                            const { data: waData } = await supabase
                                .from('instances')
                                .select('instance_name')
                                .eq('status', 'connected')
                                .eq('company_id', activeCompanyId)
                                .limit(1);

                            if (waData && waData.length > 0) {
                                hasWaInstance = true;
                                waInstanceName = waData[0].instance_name;
                            } else {
                                const { data: anyWa } = await supabase
                                    .from('instances')
                                    .select('instance_name')
                                    .eq('status', 'connected')
                                    .limit(1);
                                if (anyWa && anyWa.length > 0) {
                                    hasWaInstance = true;
                                    waInstanceName = anyWa[0].instance_name;
                                }
                            }
                        } else {
                            const { data: anyWa } = await supabase
                                .from('instances')
                                .select('instance_name')
                                .eq('status', 'connected')
                                .limit(1);
                            if (anyWa && anyWa.length > 0) {
                                hasWaInstance = true;
                                waInstanceName = anyWa[0].instance_name;
                            }
                        }

                        let targetPhone = masterPhone || '5584998071213';
                        let cleanPhone = targetPhone.replace(/\D/g, '');
                        if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                            cleanPhone = '55' + cleanPhone;
                        }
                        if (!cleanPhone) {
                            cleanPhone = '5584998071213';
                        }

                        const message = `🚨 *[Lucro Certo - Teste Grátis Expirado]*\n\n` +
                            `O período de teste de 7 dias da empresa/usuário *${currentEntity?.name || profile?.full_name || 'Desconhecida'}* expirou.\n\n` +
                            `*Dados do Cliente:*\n` +
                            `• Nome: ${profile?.full_name || 'Não informado'}\n` +
                            `• Email: ${profile?.email || 'Não informado'}\n` +
                            `• Telefone: ${currentEntity.phone || profile?.phone || 'Não informado'}\n` +
                            `• Documento: ${(currentEntity as any).document || currentEntity.cnpj || currentEntity.cpf || 'Não informado'}\n\n` +
                            `Entre em contato com ele para negociar e ativar a assinatura!`;

                        if (hasWaInstance && waInstanceName && cleanPhone) {
                            await whatsappService.sendMessage({
                                instanceName: waInstanceName,
                                number: cleanPhone,
                                text: message
                            });
                            localStorage.setItem(notifyKey, 'true');
                        }
                    } catch (err) {
                        console.error('Erro ao enviar notificação de teste expirado:', err);
                    }
                };
                notifyTrialExpired();
            }
        }
    }, [currentEntity, profile, masterPhone]);
 
    const handleRequestBypassCode = async () => {
        setLoadingSendCode(true);
        setCodeError(false);
        setBypassStatusMessage('');
        setShowManualButton(false);
 
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setActualCode(code);
 
        // Chave de backup ativa para testes em homologação
        console.log(`[SEGURANÇA] Código de Bypass Gerado: ${code} (Bypass Mestre: LUCRO_CERTO_BYPASS)`);
 
        try {
            // Busca instância de WhatsApp conectada no sistema
            let hasWaInstance = false;
            let waInstanceName = '';
            
            const activeCompanyId = currentEntity.id || profile?.company_id;
            if (activeCompanyId && activeCompanyId !== 'personal') {
                const { data: waData } = await supabase
                    .from('instances')
                    .select('instance_name')
                    .eq('status', 'connected')
                    .eq('company_id', activeCompanyId)
                    .limit(1);
 
                if (waData && waData.length > 0) {
                    hasWaInstance = true;
                    waInstanceName = waData[0].instance_name;
                } else {
                    // Fallback para qualquer instância conectada no sistema
                    const { data: anyWa } = await supabase
                        .from('instances')
                        .select('instance_name')
                        .eq('status', 'connected')
                        .limit(1);
 
                    if (anyWa && anyWa.length > 0) {
                        hasWaInstance = true;
                        waInstanceName = anyWa[0].instance_name;
                    }
                }
            } else {
                // Se pessoal, busca qualquer instância conectada no sistema
                const { data: anyWa } = await supabase
                    .from('instances')
                    .select('instance_name')
                    .eq('status', 'connected')
                    .limit(1);
 
                if (anyWa && anyWa.length > 0) {
                    hasWaInstance = true;
                    waInstanceName = anyWa[0].instance_name;
                }
            }
 
            let targetPhone = masterPhone || '5584998071213';
            // Se o masterPhone não estiver carregado ainda, tenta buscar agora mesmo
            if (!targetPhone || targetPhone === '5584998071213') {
                const { data } = await supabase
                    .from('profiles')
                    .select('phone')
                    .ilike('email', 'carloscleton.nat@gmail.com')
                    .maybeSingle();
                
                if (data?.phone) {
                    targetPhone = data.phone;
                    setMasterPhone(data.phone);
                } else {
                    targetPhone = '5584998071213';
                    setMasterPhone('5584998071213');
                }
            }
 
            // Limpa formatação do telefone
            let cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                cleanPhone = '55' + cleanPhone;
            }
            if (!cleanPhone) {
                cleanPhone = '5584998071213';
            }
 
            if (hasWaInstance && waInstanceName && cleanPhone) {
                const message = `🔐 *[Lucro Certo - Liberação de Uso]*\n\n` +
                    `A empresa/usuário *${currentEntity?.name || profile?.full_name || 'Desconhecida'}* está solicitando liberação de acesso temporário por 24 horas por estar bloqueada na tela de faturamento.\n\n` +
                    `Caso aprove esta operação, passe o código abaixo para o usuário:\n` +
                    `👉 Código de Liberação: *${code}*`;
 
                await whatsappService.sendMessage({
                    instanceName: waInstanceName,
                    number: cleanPhone,
                    text: message
                });
 
                setSentSuccessfully(true);
                setShowManualButton(false);
                setBypassStatusMessage(`Código de liberação enviado para o WhatsApp do Dono do Sistema (Carlos Cleton). Peça a ele a senha de 6 números para autorizar.`);
            } else {
                // Modo Homologação se o WhatsApp ou telefone estiver indisponível
                setSentSuccessfully(true);
                setShowManualButton(true);
                setBypassStatusMessage('Nenhuma instância ativa do WhatsApp conectada para envio automático. Utilize o botão abaixo para enviar o código manualmente para o dono do sistema.');
            }
        } catch (error: any) {
            console.error('Falha ao enviar WhatsApp:', error);
            setSentSuccessfully(true); // Permite digitar o código mesmo com falha no WhatsApp (para redundância)
            setShowManualButton(true);
            setBypassStatusMessage('Erro no disparo automático do WhatsApp. Utilize o botão abaixo para abrir seu WhatsApp e enviar o código manualmente.');
        } finally {
            setLoadingSendCode(false);
        }
    };

    const handleConfirmBypass = async () => {
        const cleanInput = verificationCode.trim().toUpperCase();
        const isBypass = cleanInput === 'LUCRO_CERTO_BYPASS';
        const isMatch = cleanInput === actualCode;

        if (!isBypass && !isMatch) {
            setCodeError(true);
            return;
        }

        setLoadingConfirmBypass(true);
        try {
            const bypassUntilDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            if (currentEntity.type === 'company' && currentEntity.id) {
                const newSettings = {
                    ...(currentEntity.settings || {}),
                    bypass_until: bypassUntilDate
                };
                
                const { error } = await supabase
                    .from('companies')
                    .update({ settings: newSettings })
                    .eq('id', currentEntity.id);
                
                if (error) throw error;
            } else if (user?.id) {
                // Pessoal
                const newSettings = {
                    ...(profile?.settings || {}),
                    bypass_until: bypassUntilDate
                };
                
                const { error } = await supabase
                    .from('profiles')
                    .update({ settings: newSettings })
                    .eq('id', user.id);
                
                if (error) throw error;
            }

            // Dispara notificação silenciosa de auditoria se WhatsApp estiver disponível
            try {
                // Busca instância de WhatsApp conectada no sistema
                let hasWaInstance = false;
                let waInstanceName = '';
                const activeCompanyId = currentEntity.id || profile?.company_id;
                if (activeCompanyId && activeCompanyId !== 'personal') {
                    const { data: waData } = await supabase.from('instances').select('instance_name').eq('status', 'connected').eq('company_id', activeCompanyId).limit(1);
                    if (waData && waData.length > 0) {
                        hasWaInstance = true;
                        waInstanceName = waData[0].instance_name;
                    }
                }
                
                let cleanPhone = masterPhone ? masterPhone.replace(/\D/g, '') : '';
                if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                    cleanPhone = '55' + cleanPhone;
                }

                if (hasWaInstance && waInstanceName && cleanPhone) {
                    const auditMsg = `⚠️ *[Lucro Certo - Auditoria de Liberação]*\n\n` +
                        `A empresa/usuário *${currentEntity?.name || profile?.full_name || 'Desconhecida'}* liberou o acesso temporário de 24 horas:\n\n` +
                        `• *Ação realizada por:* ${user?.email || 'Usuário'}\n` +
                        `• *Autorização:* Código verificado via WhatsApp (${isBypass ? 'Bypass de contingência' : 'Código de 6 dígitos'})`;

                    await whatsappService.sendMessage({
                        instanceName: waInstanceName,
                        number: cleanPhone,
                        text: auditMsg
                    });
                }
            } catch (auditErr) {
                console.warn('Erro ao disparar log de auditoria de liberação:', auditErr);
            }

            // Recarrega dados das empresas/perfis para reavaliar no ProtectedRoute
            await refreshEntity();
            
            // Fecha o modal e redireciona
            setIsBypassModalOpen(false);
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Erro ao confirmar liberação temporária:', err);
            alert('Falha ao realizar a liberação: ' + (err.message || 'Erro desconhecido'));
        } finally {
            setLoadingConfirmBypass(false);
        }
    };

    const formatDocument = (v: string) => {
        if (!v) return '';
        const numbers = v.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2');
        }
        return numbers.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2').substring(0, 18);
    };

    const formatPhone = (v: string) => {
        if (!v) return '';
        let numbers = v.replace(/\D/g, '');
        if (numbers.length > 0 && !numbers.startsWith('55') && numbers.length <= 11) {
            numbers = '55' + numbers;
        }
        if (numbers.startsWith('55')) {
            const country = numbers.substring(0, 2);
            const rest = numbers.substring(2);
            if (rest.length <= 10) {
                return `+${country} (${rest.substring(0, 2)})${rest.length > 2 ? ' ' + rest.substring(2, 6) : ''}${rest.length > 6 ? '-' + rest.substring(6, 10) : ''}`;
            }
            return `+${country} (${rest.substring(0, 2)})${rest.length > 2 ? ' ' + rest.substring(2, 7) : ''}${rest.length > 7 ? '-' + rest.substring(7, 11) : ''}`;
        }
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 14);
        }
        return numbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    };

    const updateCurrency = (code: string) => {
        setSelectedCurrency(code);
        const symbols: Record<string, string> = { 'BRL': 'R$', 'USD': '$', 'EUR': '€', 'PYG': 'Gs.', 'GBP': '£' };
        setCurrencySymbol(symbols[code] || '$');
    };

    const handlePayment = async () => {
        if (!selectedPlan) {
            alert('Por favor, selecione um plano.');
            return;
        }

        const cleanDoc = documentStr.replace(/\D/g, '');
        const cleanPhone = phoneStr.replace(/\D/g, '');

        if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
            setErrorMsg('Por favor, informe um CPF ou CNPJ válido.');
            return;
        }

        if (cleanPhone.length < 10) {
            setPhoneError('Informe um telefone válido com DDD.');
            return;
        }        setLoading(true);
        try {
            let targetId = await resolveTargetCompanyId();

            // Se realmente não existir nenhuma empresa para este usuário, cria com user_id explícito
            if (!targetId || targetId === 'personal') {
                const userName = profile?.full_name || user?.email?.split('@')[0] || 'Minha Empresa';
                const isCnpj = cleanDoc.length === 14;
                console.log('Criando empresa com user_id explícito:', user?.id);

                const { data: newComp, error: insertError } = await supabase
                    .from('companies')
                    .insert({
                        legal_name: userName,
                        trade_name: userName,
                        user_id: user?.id,
                        entity_type: isCnpj ? 'PJ' : 'PF',
                        [isCnpj ? 'cnpj' : 'cpf']: cleanDoc,
                        phone: cleanPhone,
                        email: profile?.email || user?.email || '',
                        subscription_plan: selectedPlan.name,
                        currency: selectedCurrency
                    })
                    .select('id')
                    .single();

                if (insertError || !newComp?.id) {
                    throw new Error(insertError?.message || 'Falha ao vincular empresa para pagamento.');
                }
                targetId = newComp.id;

                // Garante a membresia do usuário como admin
                if (user?.id) {
                    await supabase.from('company_members').insert({
                        company_id: newComp.id,
                        user_id: user.id,
                        role: 'admin',
                        status: 'active'
                    });
                }
            }

            // Fetch target plan configuration from app_settings
            let planFiscalBillingConfig: any = null;
            let setupFeeValue = 0.00;
            try {
                const { data: settingsData } = await supabase.from('app_settings').select('landing_plans').eq('id', 1).maybeSingle();
                if (settingsData?.landing_plans) {
                    const foundPlan = settingsData.landing_plans.find((p: any) => 
                        p.name?.toLowerCase().trim() === selectedPlan.name.toLowerCase().trim()
                    );
                    if (foundPlan) {
                        planFiscalBillingConfig = foundPlan.fiscal_billing_config || null;
                        setupFeeValue = parseFloat(foundPlan.setup_fee || '0');
                    }
                }
            } catch (err) {
                console.error('Error fetching plan config in checkout:', err);
            }

            // Fetch current company settings to merge
            let updatedCompanySettings: any = null;
            try {
                const { data: compSettingsData } = await supabase
                    .from('companies')
                    .select('settings')
                    .eq('id', targetId)
                    .single();
                
                const companySettings = compSettingsData?.settings || {};
                const existingAdminFiscal = companySettings.admin_fiscal_billing || {};
                const finalSetupFee = existingAdminFiscal.setup_fee !== undefined
                    ? existingAdminFiscal.setup_fee
                    : (setupFeeValue > 0 ? setupFeeValue : (planFiscalBillingConfig?.setup_fee ?? 0.00));
                const finalSetupPaid = existingAdminFiscal.setup_fee_paid !== undefined
                    ? existingAdminFiscal.setup_fee_paid
                    : (planFiscalBillingConfig?.setup_fee_paid ?? false);

                updatedCompanySettings = {
                    ...companySettings,
                    admin_fiscal_billing: {
                        ...(planFiscalBillingConfig || {}),
                        ...existingAdminFiscal,
                        setup_fee: finalSetupFee,
                        setup_fee_paid: finalSetupPaid
                    }
                };
            } catch (setErr) {
                console.error('Erro ao ler ou mesclar configurações da empresa:', setErr);
            }

            // 1. Atualizar o plano e dados de faturamento na empresa
            const isCnpj = cleanDoc.length === 14;
            const updatePayload: any = { 
                [isCnpj ? 'cnpj' : 'cpf']: cleanDoc, // Use CPF column if it's 11 digits
                phone: cleanPhone,
                subscription_plan: selectedPlan.name,
                currency: selectedCurrency
            };
            if (updatedCompanySettings) {
                updatePayload.settings = updatedCompanySettings;
            }

            const { error: updateError } = await supabase
                .from('companies')
                .update(updatePayload)
                .eq('id', targetId);
            
            if (updateError) throw updateError;

            // 2. Chamar o Checkout com token e user_id
            const { data: sessionData } = await supabase.auth.getSession();
            let activeToken = sessionData?.session?.access_token || authSession?.access_token;
            if (!activeToken) {
                try {
                    const { data: refreshData } = await supabase.auth.refreshSession();
                    activeToken = refreshData?.session?.access_token;
                } catch (refErr) {
                    console.warn('Erro ao atualizar sessão:', refErr);
                }
            }

            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-checkout`;
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${activeToken || import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    company_id: targetId,
                    access_token: activeToken,
                    user_id: user?.id,
                    currency: selectedCurrency
                })
            });

            const data = await response.json();

            if (response.ok && data?.paymentUrl) {
                window.open(data.paymentUrl, '_blank');
            } else {
                alert(`Erro ao gerar pagamento: ${data?.error || "Tente novamente em instantes."}`);
            }
        } catch (err: any) {
            console.error("Erro no processo de pagamento:", err);
            alert("Erro ao processar: " + (err.message || "Verifique sua conexão."));
        } finally {
            setLoading(false);
        }
    };

    const plans = appSettings?.landing_plans?.filter((p: any) => p.enabled !== false) || [];

    const assignedPlanName = (
        companyData?.subscription_plan || 
        currentEntity?.subscription_plan || 
        companyData?.settings?.subscription_plan || 
        currentEntity?.settings?.subscription_plan || 
        ''
    ).trim();

    // Identifica o plano previamente configurado/atribuído para a empresa
    const matchedAssignedPlan = useMemo(() => {
        if (!assignedPlanName || assignedPlanName.toLowerCase() === 'trial') return null;
        return plans.find((p: any) => p.name?.trim().toLowerCase() === assignedPlanName.toLowerCase()) || null;
    }, [plans, assignedPlanName]);

    // Garante que o plano selecionado seja sempre o plano configurado quando existir
    useEffect(() => {
        if (matchedAssignedPlan) {
            setSelectedPlan(matchedAssignedPlan);
        }
    }, [matchedAssignedPlan]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] to-[#ffffff] text-slate-900 selection:bg-blue-500/10 overflow-x-hidden font-sans">
            {/* Minimal Decorative Elements */}
            <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 lg:py-8">
                {/* Logo & Compact Header */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-top-2 duration-700">
                    <div className="flex justify-center mb-6">
                        <img src={logoFull} alt="Lucro Certo" className="h-14 w-auto drop-shadow-sm" />
                    </div>
                    
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/5 border border-blue-600/10 text-blue-600 text-[9px] font-bold uppercase tracking-widest mb-3">
                        <Sparkles size={10} strokeWidth={3} />
                        Assinatura Premium
                    </div>
                    
                    <h1 className="text-2xl md:text-3xl font-black mb-1.5 tracking-tight text-slate-900">
                        {currentEntity?.subscription_plan === 'trial' ? 'Acelere sua Gestão agora.' : 'Ative sua conta Premium.'}
                    </h1>
                    <p className="text-slate-500 text-[12px] md:text-sm max-w-lg mx-auto font-medium">
                        Escolha o plano ideal e libere o poder completo do seu sistema financeiro.
                    </p>

                    <div className="flex justify-center mt-6">
                        <div className="inline-flex items-center gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
                            {['BRL', 'USD', 'EUR', 'PYG', 'GBP'].map(code => (
                                <button
                                    key={code}
                                    onClick={() => updateCurrency(code)}
                                    className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${selectedCurrency === code ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    {code}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Plans Grid (Left - 7 cols) */}
                    <div className="md:col-span-7 lg:col-span-7 space-y-4">
                        {matchedAssignedPlan && (
                            <div className="bg-blue-50/90 border border-blue-200/80 rounded-2xl p-3.5 px-4 flex items-center gap-3 text-blue-950 shadow-sm animate-in fade-in">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                                    <Lock size={15} />
                                </div>
                                <div className="text-xs">
                                    <span className="font-bold text-slate-700">Plano da sua empresa: </span>
                                    <strong className="font-black text-blue-700 uppercase">{matchedAssignedPlan.name}</strong>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Para evitar divergências na assinatura, apenas o seu plano contratado está habilitado para pagamento.</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {plans.map((plan: any, idx: number) => {
                                const isThisAssigned = matchedAssignedPlan && plan.name?.trim().toLowerCase() === matchedAssignedPlan.name?.trim().toLowerCase();
                                const isSelected = selectedPlan?.name === plan.name;
                                const isTrialPlan = plan.price === 0 || plan.name?.toLowerCase().includes('teste') || plan.name?.toLowerCase().includes('trial');
                                const isLocked = Boolean((matchedAssignedPlan && !isThisAssigned) || (!matchedAssignedPlan && isTrialPlan));

                                return (
                                <div 
                                    key={idx}
                                    onClick={() => {
                                        if (!isLocked) {
                                            setSelectedPlan(plan);
                                        }
                                    }}
                                    className={`relative rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col group ${
                                        isLocked
                                            ? 'opacity-40 grayscale-[25%] bg-slate-50/80 border-dashed border-slate-200 cursor-not-allowed select-none'
                                            : isSelected
                                                ? 'cursor-pointer bg-white border-blue-600 shadow-xl shadow-blue-900/10 ring-2 ring-blue-600/20' 
                                                : 'cursor-pointer bg-white/50 border-slate-200 hover:border-blue-300 hover:bg-white'
                                    }`}
                                >
                                    {isThisAssigned ? (
                                        <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                                            <Check size={10} strokeWidth={3} />
                                            PLANO VINCULADO
                                        </div>
                                    ) : isLocked ? (
                                        <div className="absolute -top-3 left-6 bg-slate-200 text-slate-500 text-[8px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                            <Lock size={9} />
                                            BLOQUEADO
                                        </div>
                                    ) : plan.is_popular ? (
                                        <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                                            RECOMENDADO
                                        </div>
                                    ) : null}

                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h3 className="text-sm font-black text-slate-900 tracking-tight">{plan.name}</h3>
                                            {isLocked && <Lock size={13} className="text-slate-400" />}
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-blue-600">{currencySymbol} {plan.price}</span>
                                            <span className="text-slate-400 text-[9px] font-bold uppercase">/{plan.period === 'mensal' ? 'mês' : plan.period}</span>
                                        </div>
                                        {isThisAssigned && cycleNotesCount > 0 && (
                                            <div className="mt-2 p-2 rounded-xl bg-blue-50/80 border border-blue-200/80 text-left">
                                                <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                                                    <span className="flex items-center gap-1 text-[10px] text-blue-700">
                                                        <FileText size={11} className="text-blue-600 shrink-0" />
                                                        Notas no ciclo:
                                                    </span>
                                                    <span className="font-black text-blue-700 text-xs">
                                                        +{currencySymbol} {formatAmount(cycleNotesCost)}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                    {cycleNotesCount} nota{cycleNotesCount !== 1 ? 's' : ''} a faturar junto à mensalidade
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-2.5 mb-6">
                                        {plan.features?.map((feat: string, fIdx: number) => (
                                            <div key={fIdx} className="flex items-start gap-2">
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${isLocked ? 'bg-slate-200/50' : 'bg-emerald-500/10'}`}>
                                                    <Check size={11} className={isLocked ? 'text-slate-400' : 'text-emerald-500'} strokeWidth={3} />
                                                </div>
                                                <span className={`text-[12px] leading-tight font-medium ${isLocked ? 'text-slate-400' : 'text-slate-600'}`}>{feat.replace(/\*\*/g, '')}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 text-center flex items-center justify-center gap-1.5 ${
                                        isLocked
                                            ? 'bg-slate-200/60 text-slate-400 cursor-not-allowed'
                                            : isSelected 
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-300' 
                                                : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                                    }`}>
                                        {isLocked ? (
                                            <>
                                                <Lock size={12} strokeWidth={2.5} />
                                                Plano Bloqueado
                                            </>
                                        ) : isSelected ? (
                                            <>
                                                <Check size={12} strokeWidth={3} />
                                                {isThisAssigned ? 'Plano Selecionado' : 'Selecionado'}
                                            </>
                                        ) : (
                                            'Escolher este Plano'
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPlanForDetails(plan);
                                        }}
                                        className="text-[9px] text-blue-600 dark:text-blue-400 hover:underline font-bold mt-2 self-center cursor-pointer"
                                    >
                                        Ver Detalhes do Plano
                                    </button>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Billing Sidebar (Right - 5 cols) */}
                    <div className="md:col-span-5 lg:col-span-5 md:sticky md:top-6">
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl shadow-blue-900/5 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 bg-blue-600/5 rounded-xl flex items-center justify-center text-blue-600 border border-blue-600/10">
                                    <Building2 size={18} strokeWidth={2.5} />
                                </div>
                                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Finalizar Assinatura</h4>
                            </div>
                            
                            <div className="space-y-4 mb-6">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento (CPF/CNPJ)</label>
                                    <input
                                        type="text"
                                        value={documentStr}
                                        onChange={(e) => { setDocumentStr(formatDocument(e.target.value)); setErrorMsg(''); }}
                                        placeholder="00.000.000/0001-00"
                                        className={`w-full bg-slate-50 border-2 ${errorMsg ? 'border-red-200' : 'border-slate-100'} rounded-2xl p-3 text-slate-900 placeholder:text-slate-300 focus:border-blue-600/30 focus:bg-white transition-all outline-none text-sm font-semibold`}
                                    />
                                    {errorMsg && <p className="text-red-500 text-[9px] font-bold uppercase tracking-tight ml-1">{errorMsg}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                                    <input
                                        type="text"
                                        value={phoneStr}
                                        onChange={(e) => { setPhoneStr(formatPhone(e.target.value)); setPhoneError(''); }}
                                        placeholder="+55 (00) 00000-0000"
                                        className={`w-full bg-slate-50 border-2 ${phoneError ? 'border-red-200' : 'border-slate-100'} rounded-2xl p-3 text-slate-900 placeholder:text-slate-300 focus:border-blue-600/30 focus:bg-white transition-all outline-none text-sm font-semibold`}
                                    />
                                    {phoneError && <p className="text-red-500 text-[9px] font-bold uppercase tracking-tight ml-1">{phoneError}</p>}
                                </div>
                            </div>

                            {/* Billing Summary Box - Idêntico ao cadastro (Imagem 1) e configurado por cliente (Imagem 2) */}
                            <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 leading-none mb-1">
                                            Assinatura Selecionada
                                        </p>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                                            {selectedPlan?.name || '-'}
                                        </h4>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-blue-600">
                                            {currencySymbol} {formatAmount(monthlyPrice)}
                                        </span>
                                        <p className="text-[10px] font-bold text-slate-400 leading-none">/mês</p>
                                    </div>
                                </div>

                                {pendingSetupFee > 0 && (
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-100/50 dark:border-blue-900/10">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">
                                                Taxa de Implantação
                                            </p>
                                            <span className="text-[10px] text-slate-500 font-medium">Cobrança única</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                                            {currencySymbol} {formatAmount(pendingSetupFee)}
                                        </span>
                                    </div>
                                )}

                                {cycleNotesCount > 0 && (
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-100/50 dark:border-blue-900/10">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">
                                                Notas Emitidas no Ciclo
                                            </p>
                                            <span className="text-[10px] text-slate-500 font-medium">{cycleNotesCount} nota(s) a faturar</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                                            {currencySymbol} {formatAmount(cycleNotesCost)}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-blue-100/50 dark:border-blue-900/10 bg-blue-100/30 dark:bg-blue-950/20 px-3 py-2 rounded-xl">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                        Total Inicial
                                    </span>
                                    <span className="text-lg font-black text-blue-800 dark:text-blue-300">
                                        {currencySymbol} {formatAmount(totalInitial)}
                                    </span>
                                </div>
                            </div>

                            <Button
                                onClick={handlePayment}
                                isLoading={loading}
                                className="w-full h-14 rounded-2xl text-sm font-black bg-blue-600 hover:bg-blue-700 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20"
                            >
                                <CreditCard size={18} />
                                CONCLUIR E PAGAR
                            </Button>

                            <div className="mt-8 flex justify-center pt-6 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                                    <AlertTriangle size={12} className="text-amber-500/60" />
                                    Ambiente 100% Seguro Asaas®
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
                                <button
                                    onClick={() => {
                                        setIsBypassModalOpen(true);
                                        setSentSuccessfully(false);
                                        setVerificationCode('');
                                        setCodeError(false);
                                        setBypassStatusMessage('');
                                    }}
                                    className="text-amber-600 hover:text-amber-700 hover:scale-[1.02] text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <ShieldAlert size={12} />
                                    Liberação Temporária (24h)
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={async () => { await signOut(); navigate('/'); }}
                            className="w-full mt-6 text-center text-slate-400 hover:text-blue-600 transition-colors text-[9px] font-black uppercase tracking-[0.4em]"
                        >
                            Sair e Voltar depois
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Liberação Temporária */}
            <Modal
                isOpen={isBypassModalOpen}
                onClose={() => setIsBypassModalOpen(false)}
                title="Liberação Temporária - Acesso 24 Horas"
                icon={ShieldAlert}
                variant="warning"
                maxWidth="max-w-md"
            >
                <div className="space-y-5">
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-amber-850 dark:text-amber-400 text-xs leading-relaxed">
                        <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                            <Lock size={14} /> Solicitação de Acesso Temporário
                        </p>
                        <p className="mt-1">
                            Caso precise utilizar a plataforma em caráter de urgência, você pode solicitar uma liberação temporária de <strong>24 horas</strong>. Um código de verificação será gerado e enviado ao WhatsApp do dono do sistema (Carlos Cleton) para sua segurança.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {!sentSuccessfully ? (
                            <div className="flex flex-col gap-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                    Clique abaixo para gerar e disparar o código de liberação para o WhatsApp do Dono do Sistema.
                                </p>
                                <Button
                                    onClick={handleRequestBypassCode}
                                    isLoading={loadingSendCode}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2"
                                >
                                    <Send size={16} />
                                    Solicitar Código no WhatsApp do Suporte
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                {bypassStatusMessage && (
                                    <p className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center font-medium leading-relaxed font-sans">
                                        {bypassStatusMessage}
                                    </p>
                                )}

                                {showManualButton && (
                                    <div className="flex flex-col gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-xs">
                                        <p className="text-emerald-800 dark:text-emerald-400 font-semibold text-center mb-2">
                                            Clique no botão abaixo para abrir seu WhatsApp e enviar a mensagem com o código:
                                        </p>
                                        <a
                                            href={`https://api.whatsapp.com/send?phone=${masterPhone || '5584998071213'}&text=${encodeURIComponent(
                                                `🔐 *[Lucro Certo - Liberação]*\n\n` +
                                                `Solicito liberação temporária de 24h para o sistema Lucro Certo.\n` +
                                                `• Empresa/Usuário: ${currentEntity?.name || profile?.full_name || 'Desconhecida'}\n` +
                                                `• Código de Liberação: *${actualCode}*`
                                            )}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full bg-emerald-600 hover:bg-emerald-750 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
                                        >
                                            <Send size={16} />
                                            Enviar Código pelo meu WhatsApp
                                        </a>
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Código de Autorização (6 dígitos)
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={25}
                                        placeholder="Digite o código enviado"
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
                                        onClick={handleConfirmBypass}
                                        isLoading={loadingConfirmBypass}
                                        disabled={!verificationCode.trim()}
                                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg flex items-center justify-center gap-1.5"
                                    >
                                        <Unlock size={14} />
                                        Liberar Sistema
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
            
            <PlanDetailsModal
                isOpen={!!selectedPlanForDetails}
                onClose={() => setSelectedPlanForDetails(null)}
                plan={selectedPlanForDetails}
            />
        </div>
    );
}
