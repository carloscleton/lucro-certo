import { useEffect, useState, useMemo, useRef } from 'react';
// Force refresh
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, FileText, Wallet, Save, RefreshCw, Shield, Users, Building, DollarSign, Trash2, Lock, MessageSquare, CreditCard, X, Sparkles, Edit, Calculator, Zap, Activity, Award, AlertTriangle, Percent, Landmark, Receipt, Download } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useSettings } from '../hooks/useSettings';
import { useAdmin } from '../hooks/useAdmin';
import { usePresence } from '../hooks/usePresence';
import { useTeam } from '../hooks/useTeam';
import { useTechnicians } from '../hooks/useTechnicians';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { supabase } from '../lib/supabase';
import { SETTINGS_TABS, APP_MODULES, getTabPermission, getModulePermission } from '../config/permissions';
import { WebhookSettings } from './WebhookSettings';
import { WhatsApp } from './WhatsApp';
import { FiscalSettings } from '../components/settings/FiscalSettings';
import { PaymentSettings } from '../components/settings/PaymentSettings';
import { BankingSettings } from '../components/settings/BankingSettings';
import { SubscriptionSettings } from '../components/settings/SubscriptionSettings';
import { PlatformBillingDashboard } from '../components/admin/PlatformBillingDashboard';
import { useCharges } from '../hooks/useCharges';
import { useAuth } from '../context/AuthContext';
import { formatPhoneInput, cleanPhoneNumber, formatPhoneFromDB } from '../utils/phoneUtils';
import { LandingPlansEditor } from '../components/admin/LandingPlansEditor';
import axios from 'axios';
import jsPDF from 'jspdf';
import { API_BASE_URL } from '../lib/constants';

export function Settings() {
    const { t } = useTranslation();
    const { settings, loading, updateSettings, clonePersonalSettings } = useSettings();
    const { isAdmin, stats, usersList, companiesList, loading: adminLoading, refresh: refreshAdmin, deleteUser, deleteCompany, toggleUserBan, toggleCompanyBlock, updateUserLimit, updateUserConfig, updateCompanyConfig, updateAppSettings, appSettings } = useAdmin();
    const { members, invites, loading: teamLoading, inviteMember, removeMember, updateMemberRole, cancelInvite, copyInviteLink, refresh: refreshTeam } = useTeam();
    const { currentEntity, refresh: refreshEntity } = useEntity();
    const { companies } = useCompanies();
    const { createCharge, charges: recentCharges, loading: chargesLoading, fetchCharges: refreshCharges } = useCharges();
    const { user, profile, refreshProfile } = useAuth();

    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [cloning, setCloning] = useState(false);

    // Local state for form inputs
    const [quoteValidity, setQuoteValidity] = useState(7);
    const [enableServiceWarranty, setEnableServiceWarranty] = useState(false);
    const [warrantyType, setWarrantyType] = useState<'individual' | 'global'>('individual');
    const [commissionRate, setCommissionRate] = useState(0);
    const [serviceCommissionRate, setServiceCommissionRate] = useState(0);
    const [productCommissionRate, setProductCommissionRate] = useState(0);
    const [currency, setCurrency] = useState('BRL');
    const [autoFinancial, setAutoFinancial] = useState(false);
    const [autoFinancialTime, setAutoFinancialTime] = useState('08:00');
    const [autoFinancialPrompt, setAutoFinancialPrompt] = useState('');
    const [autoFinancialTemplate, setAutoFinancialTemplate] = useState('');
    const [autoBirthday, setAutoBirthday] = useState(false);
    const [autoBirthdayTime, setAutoBirthdayTime] = useState('09:00');
    const [autoBirthdayPrompt, setAutoBirthdayPrompt] = useState('');
    const [autoBirthdayTemplate, setAutoBirthdayTemplate] = useState('');
    const [autoOverdue, setAutoOverdue] = useState(false);
    const [autoOverdueTime, setAutoOverdueTime] = useState('10:00');
    const [autoOverduePrompt, setAutoOverduePrompt] = useState('');
    const [autoOverdueTemplate, setAutoOverdueTemplate] = useState('');
    const [automationWhatsAppNumber, setAutomationWhatsAppNumber] = useState('');
    const [loyaltyWaEnabled, setLoyaltyWaEnabled] = useState(true);
    const [loyaltyWaTemplate, setLoyaltyWaTemplate] = useState('');
    const [loyaltyEmailEnabled, setLoyaltyEmailEnabled] = useState(true);
    const [loyaltyEmailTemplate, setLoyaltyEmailTemplate] = useState('');
    const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
    const [waConnected, setWaConnected] = useState(false);
    const isTrial = useMemo(() => {
        if (isAdmin) return false;
        // 1. Check current entity
        if (currentEntity.subscription_plan === 'trial' || currentEntity.settings?.subscription_plan === 'trial' || !!currentEntity.trial_ends_at) return true;
        // 2. Check if any company is on trial
        if (companies.some(c => c.subscription_plan === 'trial' || c.settings?.subscription_plan === 'trial' || !!c.trial_ends_at)) return true;
        // 3. Fallback: Registration date (7 days)
        if (profile?.created_at) {
            const createdAt = new Date(profile.created_at).getTime();
            const now = Date.now();
            if ((now - createdAt) < (7.5 * 24 * 60 * 60 * 1000)) return true;
        }
        return false;
    }, [currentEntity, companies, isAdmin, profile]);
    const [generatingMagic, setGeneratingMagic] = useState<string | null>(null);
    const currentCompany = useMemo(() => companies.find(c => c.id === currentEntity.id), [companies, currentEntity]);

    // Company Settings State


    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
    const [inviting, setInviting] = useState(false);

    // Custom Technicians staff states
    const { technicians, addTechnician, updateTechnician, deleteTechnician } = useTechnicians();
    const [techName, setTechName] = useState('');
    const [techSpecialty, setTechSpecialty] = useState('');
    const [techPhone, setTechPhone] = useState('');
    const [addingTech, setAddingTech] = useState(false);

    // Edit states for members and technicians
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editMemberRole, setEditMemberRole] = useState<'admin' | 'member'>('member');
    const [updatingMember, setUpdatingMember] = useState(false);

    const [editingTechId, setEditingTechId] = useState<string | null>(null);
    const [editTechName, setEditTechName] = useState('');
    const [editTechSpecialty, setEditTechSpecialty] = useState('');
    const [editTechPhone, setEditTechPhone] = useState('');
    const [updatingTech, setUpdatingTech] = useState(false);

    const handleSaveMemberRole = async (memberId: string) => {
        setUpdatingMember(true);
        const { error } = await updateMemberRole(memberId, editMemberRole);
        setUpdatingMember(false);
        if (error) {
            alert('Erro ao atualizar função: ' + error);
        } else {
            setEditingMemberId(null);
        }
    };

    const handleSaveTechnician = async (techId: string) => {
        if (!editTechName) return;
        setUpdatingTech(true);
        const { error } = await updateTechnician(techId, {
            name: editTechName,
            specialty: editTechSpecialty || undefined,
            phone: editTechPhone || undefined
        });
        setUpdatingTech(false);
        if (error) {
            alert('Erro ao atualizar profissional: ' + error);
        } else {
            setEditingTechId(null);
        }
    };

    const handleAddTechnician = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!techName) return;
        setAddingTech(true);
        const { error } = await addTechnician(techName, techSpecialty || undefined, techPhone || undefined);
        setAddingTech(false);
        if (error) {
            alert('Erro ao cadastrar: ' + error);
        } else {
            setTechName('');
            setTechSpecialty('');
            setTechPhone('');
        }
    };

    const financialSuggestions = [
        "Mande o resumo do dia destacando o saldo previsto e deseje um ótimo trabalho.",
        "Crie um resumo financeiro formal e direto focado nos vencimentos de hoje.",
        "Seja motivador! Mostre o saldo positivo e incentive a equipe a bater metas.",
        "Resumo focado apenas em contas a receber para controle de fluxo de caixa."
    ];

    const birthdaySuggestions = [
        "Dê parabéns de forma carinhosa e ofereça um cupom de 10% de desconto.",
        "Mande uma mensagem festiva e pergunte se o cliente vai comemorar conosco.",
        "Seja profissional e envie uma mensagem de parabéns em nome de toda a equipe.",
        "Deseje um feliz aniversário e ofereça um brinde especial na próxima compra."
    ];

    const overdueSuggestions = [
        "Lembre o cliente sobre a fatura pendente de forma cordial e ofereça ajuda.",
        "Seja direto sobre o atraso da fatura mas mantenha o tom profissional e amigável.",
        "Mande um aviso de cobrança suave e disponibilize o link para segunda via.",
        "Crie uma mensagem de lembrete de pagamento reforçando os benefícios do serviço."
    ];

    const getRandomSuggestion = (type: 'financial' | 'birthday' | 'overdue') => {
        const list = type === 'financial' ? financialSuggestions : type === 'birthday' ? birthdaySuggestions : overdueSuggestions;
        return list[Math.floor(Math.random() * list.length)];
    };

    const [searchParams, setSearchParams] = useSearchParams();

    const [activeTab, setActiveTabState] = useState<string>(() => {
        if (typeof window === 'undefined') return 'quotes';
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const validTabs = ['quotes', 'financial', 'team', 'webhooks', 'whatsapp', 'fiscal', 'payments', 'admin', 'automations', 'subscription', 'platform_billing', 'loyalty', 'banking'];
        
        if (tab && validTabs.includes(tab)) {
            sessionStorage.setItem('last_active_settings_tab', tab);
            return tab;
        }
        
        const savedTab = sessionStorage.getItem('last_active_settings_tab');
        if (savedTab && validTabs.includes(savedTab)) {
            return savedTab;
        }
        
        return 'quotes';
    });

    const setActiveTab = (tab: string) => {
        sessionStorage.setItem('last_active_settings_tab', tab);
        setActiveTabState(tab);
        setSearchParams({ tab });
    };

    // Sincroniza a aba ativa quando a URL muda (ex: cliques em links externos para abas específicas)
    useEffect(() => {
        const tab = searchParams.get('tab');
        const validTabs = ['quotes', 'financial', 'team', 'webhooks', 'whatsapp', 'fiscal', 'payments', 'admin', 'automations', 'subscription', 'platform_billing', 'loyalty', 'banking'];
        if (tab && validTabs.includes(tab) && tab !== activeTab) {
            setActiveTabState(tab);
        }
    }, [searchParams, activeTab]);

    const [adminSubTab, setAdminSubTab] = useState<'users' | 'companies' | 'invoices' | 'system' | 'billing'>('companies');
    const [selectedCompanyForConfig, setSelectedCompanyForConfig] = useState<any | null>(null);
    const [tempCompanyConfig, setTempCompanyConfig] = useState<any | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);
    const [selectedCompanyForInvoice, setSelectedCompanyForInvoice] = useState<any | null>(null);
    const [invoiceData, setInvoiceData] = useState({ amount: '', description: '' });
    const [generatingInvoice, setGeneratingInvoice] = useState(false);
    const [selectedUserForConfig, setSelectedUserForConfig] = useState<any | null>(null);
    const [editingAutomation, setEditingAutomation] = useState<'financial' | 'birthday' | 'overdue' | null>(null);
    const [togglingLoyalty, setTogglingLoyalty] = useState(false);
    const [optimisticLoyalty, setOptimisticLoyalty] = useState<boolean | null>(null);

    // Faturamento Automático Fiscal Admin States
    const [billingStartDate, setBillingStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Default to first day of current month
        return d.toISOString().split('T')[0];
    });
    const [billingEndDate, setBillingEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [billingSimulation, setBillingSimulation] = useState<any[]>([]);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingProcessing, setBillingProcessing] = useState(false);
    const [selectedBillingCompanyIds, setSelectedBillingCompanyIds] = useState<string[]>([]);
    const [whatsappBillingInstance, setWhatsappBillingInstance] = useState('');

    const uniqueCompaniesWithSuggested = Array.from(new Set(billingSimulation.filter(c => c.totalSuggested > 0).map(c => c.companyId))) as string[];

    const [selectedCompanyNotes, setSelectedCompanyNotes] = useState<any[]>([]);
    const [selectedCompanyNotesMetadata, setSelectedCompanyNotesMetadata] = useState<any | null>(null);
    const [companyNotesLoading, setCompanyNotesLoading] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);

    useEffect(() => {
        if (appSettings?.platform_whatsapp_instance && !whatsappBillingInstance) {
            setWhatsappBillingInstance(appSettings.platform_whatsapp_instance);
        }
    }, [appSettings]);

    // Update local state when company settings load
    useEffect(() => {
        // Company settings effect removed as it's now handled in the Super Admin modal for central management
    }, [currentEntity, companies]);

    // Listen for online users only if admin
    usePresence(isAdmin);

    const handleSimulateBilling = async () => {
        setBillingLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await axios.get(`${API_BASE_URL}/fiscal-module/admin/billing-simulation`, {
                params: {
                    startDate: billingStartDate,
                    endDate: billingEndDate
                },
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            if (response.data?.success) {
                const rawSimulation = response.data.simulation || [];
                const filteredSimulation = rawSimulation.filter((c: any) => c.fixedFee > 0 || c.notesCount > 0 || (c.canceledCount && c.canceledCount > 0));
                setBillingSimulation(filteredSimulation);
                // Select all unique companies with a non-zero balance by default
                const uniqueIds = Array.from(new Set(filteredSimulation.filter((c: any) => c.totalSuggested > 0).map((c: any) => c.companyId))) as string[];
                setSelectedBillingCompanyIds(uniqueIds);
            } else {
                alert('Erro na simulação: ' + (response.data?.error || 'Erro desconhecido.'));
            }
        } catch (error: any) {
            console.error('Error running billing simulation:', error);
            alert('Erro ao rodar simulação: ' + (error.response?.data?.error || error.message));
        } finally {
            setBillingLoading(false);
        }
    };

    const handleProcessBilling = async () => {
        if (selectedBillingCompanyIds.length === 0) return;
        
        const confirmMsg = `Deseja realmente gerar cobranças para as ${selectedBillingCompanyIds.length} empresas selecionadas?\n\nAs cobranças de pix/boleto serão criadas no gateway e mensagens automáticas de notificação serão enviadas por WhatsApp.`;
        if (!window.confirm(confirmMsg)) return;

        setBillingProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            // Map the selected companies to the expected payload, consolidating rows by companyId
            const consolidatedMap = new Map<string, { amount: number, descriptions: string[] }>();
            
            for (const s of billingSimulation) {
                if (selectedBillingCompanyIds.includes(s.companyId)) {
                    let record = consolidatedMap.get(s.companyId);
                    if (!record) {
                        record = { amount: 0, descriptions: [] };
                        consolidatedMap.set(s.companyId, record);
                    }
                    
                    record.amount += s.totalSuggested;
                    
                    const totalNotes = s.notesCount + (s.canceledCount || 0);
                    const providerLabel = String(s.provider).toUpperCase();
                    
                    if (s.isActiveProvider) {
                        const feeFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.fixedFee);
                        const costFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.notesCost);
                        record.descriptions.push(
                            `Mensalidade Fiscal (${feeFormatted}) + ${totalNotes} Notas ${providerLabel} (${s.notesCount} Ativas / ${s.canceledCount || 0} Canceladas) (${costFormatted})`
                        );
                    } else {
                        const costFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.notesCost);
                        record.descriptions.push(
                            `${totalNotes} Notas ${providerLabel} (${s.notesCount} Ativas / ${s.canceledCount || 0} Canceladas) (${costFormatted})`
                        );
                    }
                }
            }
            
            const selectedData = Array.from(consolidatedMap.entries()).map(([companyId, data]) => {
                return {
                    companyId,
                    amount: data.amount.toFixed(2),
                    description: data.descriptions.join(' + ')
                };
            });

            const response = await axios.post(`${API_BASE_URL}/fiscal-module/admin/billing-process`, {
                startDate: billingStartDate,
                endDate: billingEndDate,
                whatsappInstance: whatsappBillingInstance,
                billingData: selectedData
            }, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (response.data) {
                alert('Faturamento em lote finalizado!\n\nCobranças criadas e notificações agendadas/enviadas.');
                setBillingSimulation([]);
                setSelectedBillingCompanyIds([]);
            }
        } catch (error: any) {
            console.error('Error processing billing:', error);
            alert('Erro ao processar faturamento: ' + (error.response?.data?.error || error.message));
        } finally {
            setBillingProcessing(false);
        }
    };

    const handleFetchNotesDetails = async (sim: any) => {
        setCompanyNotesLoading(true);
        setSelectedCompanyNotesMetadata(sim);
        setShowNotesModal(true);
        setSelectedCompanyNotes([]); // Clear previous notes while loading
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await axios.get(`${API_BASE_URL}/fiscal-module/admin/billing-invoices`, {
                params: {
                    companyId: sim.companyId,
                    provider: sim.provider,
                    startDate: billingStartDate,
                    endDate: billingEndDate
                },
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            if (response.data?.success) {
                setSelectedCompanyNotes(response.data.invoices || []);
            } else {
                alert('Erro ao carregar notas: ' + (response.data?.error || 'Erro desconhecido.'));
            }
        } catch (error: any) {
            console.error('Error fetching notes details:', error);
            alert('Erro ao buscar notas detalhadas: ' + (error.response?.data?.error || error.message));
        } finally {
            setCompanyNotesLoading(false);
        }
    };

    const handleGeneratePDF = () => {
        if (!selectedCompanyNotesMetadata) return;
        const sim = selectedCompanyNotesMetadata;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // Slate/Indigo Theme colors
        const primaryColor = [30, 41, 59]; // Slate 800
        const accentColor = [79, 70, 229]; // Indigo 600
        const textColor = [55, 65, 81]; // Gray 700
        const lightBg = [249, 250, 251]; // Gray 50
        const borderColor = [226, 232, 240]; // Slate 200

        let yPos = 20;

        // Decorative top bar
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');

        // Document Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Relatório de Apuração Fiscal', margin, yPos + 10);
        
        // Issuer name / status
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(String(sim.provider).toUpperCase(), pageWidth - margin, yPos + 10, { align: 'right' });
        
        yPos += 20;

        // Meta Info Block
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 30, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('EMPRESA:', margin + 5, yPos + 8);
        doc.text('CNPJ:', margin + 5, yPos + 15);
        doc.text('PERÍODO:', margin + 5, yPos + 22);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(sim.tradeName, margin + 30, yPos + 8);
        doc.text(sim.cnpj || 'Não cadastrado', margin + 30, yPos + 15);
        
        // Dates formatting
        const startFormatted = billingStartDate.split('-').reverse().join('/');
        const endFormatted = billingEndDate.split('-').reverse().join('/');
        doc.text(`${startFormatted} a ${endFormatted}`, margin + 30, yPos + 22);

        yPos += 38;

        // Section Title: Detalhamento das Notas
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Detalhamento de Movimentações', margin, yPos);
        yPos += 6;

        // Draw Table Header
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('DATA E HORA', margin + 3, yPos + 5.5);
        doc.text('IDENTIFICAÇÃO', margin + 36, yPos + 5.5);
        doc.text('CLIENTE / BENEFICIÁRIO', margin + 74, yPos + 5.5);
        doc.text('STATUS', margin + 125, yPos + 5.5);
        doc.text('VALOR', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });

        yPos += 8;

        // Draw Table Rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        selectedCompanyNotes.forEach((inv, index) => {
            // Check if page overflow
            if (yPos > pageHeight - 50) {
                doc.addPage();
                yPos = 20;
                // Redraw top bar
                doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.rect(0, 0, pageWidth, 5, 'F');
                // Redraw header
                doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('DATA E HORA', margin + 3, yPos + 5.5);
                doc.text('IDENTIFICAÇÃO', margin + 36, yPos + 5.5);
                doc.text('CLIENTE / BENEFICIÁRIO', margin + 74, yPos + 5.5);
                doc.text('STATUS', margin + 125, yPos + 5.5);
                doc.text('VALOR', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
                yPos += 8;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            }

            // Alternating row background
            if (index % 2 === 1) {
                doc.setFillColor(245, 247, 250);
                doc.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
            }

            // Bottom border row line
            doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
            doc.line(margin, yPos + 7, pageWidth - margin, yPos + 7);

            // Format date
            const dateStr = new Date(inv.created_at).toLocaleString('pt-BR', { timeZone: 'UTC' });
            
            doc.text(dateStr, margin + 3, yPos + 5);
            
            // Limit identification length to avoid overflow
            let identText = inv.ident || '';
            if (identText.length > 22) {
                identText = identText.substring(0, 19) + '...';
            }
            doc.text(identText, margin + 36, yPos + 5);
            
            // Limit client name length to avoid overflow
            let clientText = inv.clientName || 'Cliente não identificado';
            if (clientText.length > 22) {
                clientText = clientText.substring(0, 19) + '...';
            }
            doc.text(clientText, margin + 74, yPos + 5);

            // Format status uppercase
            const statusLabel = String(inv.status).toUpperCase();
            doc.text(statusLabel, margin + 125, yPos + 5);

            // Format value
            const valFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.valor || 0);
            doc.text(valFormatted, pageWidth - margin - 3, yPos + 5, { align: 'right' });

            yPos += 7;
        });

        yPos += 15;

        // Check overflow for summary block
        if (yPos > pageHeight - 65) {
            doc.addPage();
            yPos = 20;
            doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.rect(0, 0, pageWidth, 5, 'F');
        }

        // Summary financial card
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 40, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('RESUMO DO CUSTO DE APURAÇÃO', margin + 5, yPos + 8);
        doc.line(margin + 5, yPos + 11, pageWidth - margin - 5, yPos + 11);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        
        const fixedFeeStr = sim.isExempt
            ? 'Isento'
            : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.fixedFee || 0);
        doc.text(`Taxa de Mensalidade Fixa:`, margin + 5, yPos + 18);
        doc.text(fixedFeeStr, pageWidth - margin - 5, yPos + 18, { align: 'right' });

        const totalNotesCount = sim.notesCount + (sim.canceledCount || 0);
        const perNoteStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.perNoteFee);
        const notesCostStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.notesCost);
        doc.text(`Taxa por Notas (${totalNotesCount} notas x ${perNoteStr}/nota):`, margin + 5, yPos + 25);
        doc.text(notesCostStr, pageWidth - margin - 5, yPos + 25, { align: 'right' });

        // Total suggested row
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(`TOTAL A PAGAR DESTA APURAÇÃO:`, margin + 5, yPos + 33);
        const totalSuggestedStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.totalSuggested);
        doc.text(totalSuggestedStr, pageWidth - margin - 5, yPos + 33, { align: 'right' });

        // Save file
        const fileName = `Apuracao_Fiscal_${sim.tradeName.replace(/\s+/g, '_')}_${sim.provider}.pdf`;
        doc.save(fileName);
    };

    const handleGenerateBatchPDF = () => {
        if (selectedBillingCompanyIds.length === 0) return;

        const selectedRows = billingSimulation.filter(s => selectedBillingCompanyIds.includes(s.companyId));
        if (selectedRows.length === 0) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // Theme colors
        const primaryColor = [30, 41, 59]; // Slate 800
        const accentColor = [79, 70, 229]; // Indigo 600
        const textColor = [55, 65, 81]; // Gray 700
        const lightBg = [249, 250, 251]; // Gray 50
        const borderColor = [226, 232, 240]; // Slate 200

        let yPos = 20;

        // Decorative top bar
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');

        // Document Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Relatório Consolidado de Apuração Fiscal', margin, yPos + 10);
        
        yPos += 20;

        // Meta Info Block
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 20, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('PERÍODO:', margin + 5, yPos + 8);
        doc.text('EMPRESAS SELECIONADAS:', margin + 5, yPos + 14);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        const startFormatted = billingStartDate.split('-').reverse().join('/');
        const endFormatted = billingEndDate.split('-').reverse().join('/');
        doc.text(`${startFormatted} a ${endFormatted}`, margin + 60, yPos + 8);
        doc.text(`${selectedBillingCompanyIds.length} empresa(s)`, margin + 60, yPos + 14);

        yPos += 28;

        // Section Title: Detalhamento
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Resumo por Empresa e Provedor', margin, yPos);
        yPos += 6;

        // Draw Table Header
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('EMPRESA', margin + 2, yPos + 5.5);
        doc.text('CNPJ', margin + 52, yPos + 5.5);
        doc.text('PROVEDOR', margin + 83, yPos + 5.5);
        doc.text('NOTAS (A/C)', margin + 121, yPos + 5.5, { align: 'right' });
        doc.text('TAXA FIXA', margin + 143, yPos + 5.5, { align: 'right' });
        doc.text('TAXA/NOTA', margin + 161, yPos + 5.5, { align: 'right' });
        doc.text('TOTAL', pageWidth - margin - 2, yPos + 5.5, { align: 'right' });

        yPos += 8;

        // Draw Table Rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        selectedRows.forEach((sim, index) => {
            if (yPos > pageHeight - 50) {
                doc.addPage();
                yPos = 20;
                // Redraw top bar
                doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.rect(0, 0, pageWidth, 5, 'F');
                // Redraw header
                doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('EMPRESA', margin + 2, yPos + 5.5);
                doc.text('CNPJ', margin + 52, yPos + 5.5);
                doc.text('PROVEDOR', margin + 83, yPos + 5.5);
                doc.text('NOTAS (A/C)', margin + 121, yPos + 5.5, { align: 'right' });
                doc.text('TAXA FIXA', margin + 143, yPos + 5.5, { align: 'right' });
                doc.text('TAXA/NOTA', margin + 161, yPos + 5.5, { align: 'right' });
                doc.text('TOTAL', pageWidth - margin - 2, yPos + 5.5, { align: 'right' });
                yPos += 8;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            }

            // Alternating row background
            if (index % 2 === 1) {
                doc.setFillColor(245, 247, 250);
                doc.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
            }

            // Bottom border row line
            doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
            doc.line(margin, yPos + 7, pageWidth - margin, yPos + 7);

            // Limit trade name length to avoid overflow
            let tradeName = sim.tradeName || '';
            if (tradeName.length > 28) {
                tradeName = tradeName.substring(0, 25) + '...';
            }
            doc.text(tradeName, margin + 2, yPos + 5);
            doc.text(sim.cnpj || '', margin + 52, yPos + 5);

            // Provider
            const providerStr = `${sim.provider.toUpperCase()}${!sim.isActiveProvider ? ' (INAT)' : ''}`;
            doc.text(providerStr, margin + 83, yPos + 5);

            // Notes count (Active / Canceled)
            doc.text(`${sim.notesCount} / ${sim.canceledCount || 0}`, margin + 121, yPos + 5, { align: 'right' });

            // Fixed fee or Exempt
            const fixedFeeStr = sim.isExempt
                ? 'Isento'
                : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.fixedFee || 0);
            doc.text(fixedFeeStr, margin + 143, yPos + 5, { align: 'right' });

            // Fee per note
            const perNoteFeeStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.perNoteFee || 0);
            doc.text(perNoteFeeStr, margin + 161, yPos + 5, { align: 'right' });

            // Total suggested
            const totalStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.totalSuggested);
            doc.text(totalStr, pageWidth - margin - 2, yPos + 5, { align: 'right' });

            yPos += 7;
        });

        yPos += 15;

        // Check overflow for summary block
        if (yPos > pageHeight - 70) {
            doc.addPage();
            yPos = 20;
            doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.rect(0, 0, pageWidth, 5, 'F');
        }

        // Summary financial card
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, yPos, pageWidth - (margin * 2), 44, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('RESUMO CONSOLIDADO DO LOTE', margin + 5, yPos + 8);
        doc.line(margin + 5, yPos + 11, pageWidth - margin - 5, yPos + 11);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        const totalIssued = selectedRows.reduce((acc, cur) => acc + cur.notesCount, 0);
        const totalCanceled = selectedRows.reduce((acc, cur) => acc + (cur.canceledCount || 0), 0);
        const totalFixedFees = selectedRows.reduce((acc, cur) => acc + cur.fixedFee, 0);
        const totalSuggested = selectedRows.reduce((acc, cur) => acc + cur.totalSuggested, 0);

        doc.text(`Total de Notas Emitidas (Ativas):`, margin + 5, yPos + 18);
        doc.text(String(totalIssued), pageWidth - margin - 5, yPos + 18, { align: 'right' });

        doc.text(`Total de Notas Canceladas:`, margin + 5, yPos + 24);
        doc.text(String(totalCanceled), pageWidth - margin - 5, yPos + 24, { align: 'right' });

        doc.text(`Total de Taxas Fixas Aplicadas:`, margin + 5, yPos + 30);
        doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFixedFees), pageWidth - margin - 5, yPos + 30, { align: 'right' });

        // Total suggested row
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(`VALOR TOTAL ESTIMADO DO LOTE:`, margin + 5, yPos + 38);
        doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSuggested), pageWidth - margin - 5, yPos + 38, { align: 'right' });

        // Save file
        const fileName = `Consolidado_Apuracao_Fiscal_${startFormatted.replace(/\//g, '-')}_a_${endFormatted.replace(/\//g, '-')}.pdf`;
        doc.save(fileName);
    };

    useEffect(() => {
        if (currentEntity?.id && currentEntity.type === 'company') {
            checkWAConnection();
        }
    }, [currentEntity]);

    const checkWAConnection = async () => {
        const { data } = await supabase
            .from('instances')
            .select('status')
            .eq('company_id', currentEntity.id)
            .eq('status', 'connected')
            .limit(1);
        setWaConnected(!!data && data.length > 0);
    };

    const handleMagic = async (type: 'financial' | 'birthday' | 'overdue', prompt: string) => {
        if (!prompt) return alert('Por favor, digite um prompt para a vara mágica.');
        setGeneratingMagic(type);
        try {
            const { data } = await supabase.functions.invoke('social-copilot-magic', {
                body: {
                    company_id: currentEntity.id,
                    mode: 'automation_template',
                    topic: prompt
                }
            });

            if (data?.template) {
                if (type === 'financial') setAutoFinancialTemplate(data.template);
                if (type === 'birthday') setAutoBirthdayTemplate(data.template);
                if (type === 'overdue') setAutoOverdueTemplate(data.template);
            } else {
                alert('Erro ao gerar template com IA.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setGeneratingMagic(null);
        }
    };

    // Removed global email restriction to allow team management for all users
    // Admin tab is still protected by isAdmin check

    useEffect(() => {
        if (!loading) {
            setQuoteValidity(settings.quote_validity_days || 7);
            setCommissionRate(settings.commission_rate || 0);
            setAutoFinancial(!!settings.automation_financial_reminders);
            setAutoFinancialTime(settings.automation_financial_time || '08:00');
            setAutoFinancialPrompt(settings.automation_financial_prompt || '');
            setAutoFinancialTemplate(settings.automation_financial_template || '');
            setAutoBirthday(!!settings.automation_birthday_reminders);
            setAutoBirthdayTime(settings.automation_birthday_time || '09:00');
            setAutoBirthdayPrompt(settings.automation_birthday_prompt || '');
            setAutoBirthdayTemplate(settings.automation_birthday_template || '');
            setAutoOverdue(!!settings.automation_overdue_reminders);
            setAutoOverdueTime(settings.automation_overdue_time || '10:00');
            setAutoOverduePrompt(settings.automation_overdue_prompt || '');
            setAutoOverdueTemplate(settings.automation_overdue_template || '');
            setAutomationWhatsAppNumber(formatPhoneFromDB(settings.automation_whatsapp_number));
            setEnableServiceWarranty(!!settings.enable_service_warranty);
            setWarrantyType(settings.warranty_type || 'individual');
        }
        if (currentEntity?.currency) {
            setCurrency(currentEntity.currency);
        }
    }, [settings, loading, currentEntity]);

    useEffect(() => {
        if (appSettings) {
            setLoyaltyWaEnabled(appSettings.loyalty_whatsapp_enabled ?? true);
            setLoyaltyWaTemplate(appSettings.loyalty_whatsapp_template || '');
            setLoyaltyEmailEnabled(appSettings.loyalty_email_enabled ?? true);
            setLoyaltyEmailTemplate(appSettings.loyalty_email_template || '');
            setLoyaltyEnabled(appSettings.loyalty_enabled ?? true);
        }
    }, [appSettings]);

    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!rootRef.current) return;

        // Encontra recursivamente o container ancestral que possui rolagem vertical ativa
        const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
            if (!node) return null;
            const overflowY = window.getComputedStyle(node).overflowY;
            const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
            if (isScrollable) return node;
            return getScrollParent(node.parentElement);
        };

        const container = getScrollParent(rootRef.current);
        if (!container) return;

        // Restaura a posição anterior do scroll para a aba ativa da empresa ativa
        const savedScroll = sessionStorage.getItem(`settings_scroll_${currentEntity.id}_${activeTab}`);
        if (savedScroll) {
            const scrollTop = parseInt(savedScroll, 10);
            if (!scrollTop) {
                container.scrollTop = 0;
            } else if (!isNaN(scrollTop)) {
                // Pequeno delay para garantir que o layout da aba e os sub-componentes (como os cards) já renderizaram e tomaram tamanho na tela
                const timer = setTimeout(() => {
                    container.scrollTop = scrollTop;
                }, 150);
                return () => clearTimeout(timer);
            }
        } else {
            container.scrollTop = 0;
        }

        // Salva a posição do scroll com debounce leve
        let timeoutId: any = null;
        const handleScroll = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                sessionStorage.setItem(`settings_scroll_${currentEntity.id}_${activeTab}`, String(container.scrollTop));
            }, 100);
        };

        container.addEventListener('scroll', handleScroll);
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            container.removeEventListener('scroll', handleScroll);
        };
    }, [activeTab, currentEntity.id]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await updateSettings({
            quote_validity_days: quoteValidity,
            commission_rate: commissionRate,
            service_commission_rate: serviceCommissionRate,
            product_commission_rate: productCommissionRate,
            automation_financial_reminders: autoFinancial,
            automation_financial_time: autoFinancialTime,
            automation_financial_prompt: autoFinancialPrompt,
            automation_financial_template: autoFinancialTemplate,
            automation_birthday_reminders: autoBirthday,
            automation_birthday_time: autoBirthdayTime,
            automation_birthday_prompt: autoBirthdayPrompt,
            automation_birthday_template: autoBirthdayTemplate,
            automation_overdue_reminders: autoOverdue,
            automation_overdue_time: autoOverdueTime,
            automation_overdue_prompt: autoOverduePrompt,
            automation_overdue_template: autoOverdueTemplate,
            automation_whatsapp_number: cleanPhoneNumber(automationWhatsAppNumber) || undefined,
            enable_service_warranty: enableServiceWarranty,
            warranty_type: warrantyType
        });

        // Save currency to company if changed
        // Save currency to company or profile if changed
        if (currency !== currentEntity.currency) {
            const table = currentEntity.type === 'company' ? 'companies' : 'profiles';
            const targetId = currentEntity.type === 'company' ? currentEntity.id : user?.id;

            if (targetId) {
                const { error: currencyError } = await supabase
                    .from(table)
                    .update({ currency })
                    .eq('id', targetId);
                
                if (!currencyError) {
                    if (currentEntity.type === 'personal') {
                        await refreshProfile();
                    }
                    refreshEntity();
                }
            }
        }

        setSaving(false);
        if (error) {
            alert(t('settings.save_error'));
        } else {
            alert(t('settings.save_success'));
        }
    };

    const handleSyncTransactions = async () => {
        setSyncing(true);
        try {
            // 1. Get all approved quotes
            const { data: quotes } = await supabase
                .from('quotes')
                .select('id, title, status')
                .eq('status', 'approved');

            if (!quotes) return;

            let updatedCount = 0;

            // 2. For each quote, find matching transaction by description pattern
            for (const quote of quotes) {
                const { data: transactions } = await supabase
                    .from('transactions')
                    .select('id, status')
                    .ilike('description', `% Ref.Orçamento: ${quote.title}%`);

                if (transactions && transactions.length > 0) {
                    // Update transaction with quote_id
                    for (const tx of transactions) {
                        await supabase
                            .from('transactions')
                            .update({ quote_id: quote.id })
                            .eq('id', tx.id);

                        // Also sync payment status back to quote if needed
                        if (tx.status === 'paid' || tx.status === 'received') {
                            await supabase
                                .from('quotes')
                                .update({ payment_status: 'paid' })
                                .eq('id', quote.id);
                        }
                        updatedCount++;
                    }
                }
            }
            alert(t('settings.sync_complete', { count: updatedCount }));
        } catch (error) {
            console.error(error);
            alert(t('settings.sync_error'));
        } finally {
            setSyncing(false);
        }
    };

    const handleImportFromPersonal = async () => {
        if (!confirm(t('settings.import_confirm'))) return;

        setCloning(true);
        const { error } = await clonePersonalSettings();
        setCloning(false);

        if (error) {
            alert(t('settings.import_error') + error);
        } else {
            alert(t('settings.import_success'));
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        const { error } = await inviteMember(inviteEmail, inviteRole);
        setInviting(false);
        if (error) {
            alert(t('settings.invite_error') + error);
        } else {
            alert(t('settings.invite_success'));
            setInviteEmail('');
        }
    };

    const getDaysRemaining = (dateString?: string) => {
        if (!dateString) return null;
        const diffTime = new Date(dateString).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const handleGenerateInvoice = async () => {
        if (!selectedCompanyForInvoice || !invoiceData.amount) return;

        setGeneratingInvoice(true);
        try {
            // 1. Tentar usar configurações de plataforma do app_settings primeiro
            let provider = appSettings?.platform_billing_provider;
            let config: any = null;
            const isSandbox = appSettings?.platform_billing_sandbox || false;
            const env = isSandbox ? 'sandbox' : 'production';
            const configData = (appSettings?.platform_billing_config as any)?.[provider!]?.[env] || {};

            if (provider === 'asaas') {
                config = { api_key: configData.api_key };
            } else if (provider === 'stripe') {
                config = { secret_key: configData.secret_key };
            } else if (provider === 'mercadopago') {
                config = { access_token: configData.access_token };
            }

            // 2. Se não houver config de plataforma, buscar gateway ativo da empresa master (LEGACY/Fallback)
            if (!config) {
                const masterCompanyId = profile?.company_id;
                if (!masterCompanyId) {
                    alert('Erro: Sua conta Master não está vinculada a uma empresa ou plataforma para faturar.');
                    return;
                }

                const { data: gateways } = await supabase
                    .from('company_payment_gateways')
                    .select('*')
                    .eq('company_id', masterCompanyId)
                    .eq('is_active', true)
                    .limit(1);

                if (!gateways || gateways.length === 0) {
                    alert('Erro: Configure um Gateway de Plataforma em "Cobrança de Plano" primeiro.');
                    return;
                }

                provider = gateways[0].provider;
                config = gateways[0].config;
            }

            const result = await createCharge({
                provider: provider!,
                config: config,
                is_sandbox: false, // Invoices for customers are usually real
                payload: {
                    amount: parseFloat(invoiceData.amount),
                    description: invoiceData.description,
                    payment_method: 'pix',
                    customer: {
                        name: selectedCompanyForInvoice.trade_name,
                        email: selectedCompanyForInvoice.owner_email || '',
                        tax_id: selectedCompanyForInvoice.cnpj
                    }
                }
            });

            if (result.success) {
                alert('Fatura gerada com sucesso! Você pode copiar o link na aba de faturas.');
                setSelectedCompanyForInvoice(null);
                setAdminSubTab('invoices');
                refreshCharges();
            } else {
                alert('Erro ao gerar fatura: ' + result.error);
            }
        } catch (error: any) {
            alert('Erro: ' + error.message);
        } finally {
            setGeneratingInvoice(false);
        }
    };

    // Loading guard is handled inline within the tab content container to prevent page-level unmounting and flashing.

    return (
        <div ref={rootRef} className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon className="text-blue-600" />
                        {t('settings.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('settings.subtitle')}</p>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
                {[
                    { key: 'quotes', label: t('settings.tab_quotes'), icon: FileText, color: 'blue' },
                    { key: 'financial', label: t('settings.tab_financial'), icon: Wallet, color: 'blue' },
                    { key: 'team', label: t('settings.tab_team'), icon: Users, color: 'blue' },
                    { key: 'webhooks', label: t('settings.tab_webhooks'), icon: SettingsIcon, color: 'purple' },
                    { key: 'whatsapp', label: t('settings.tab_whatsapp'), icon: MessageSquare, color: 'green' },
                    { key: 'payments', label: t('settings.tab_payments'), icon: CreditCard, color: 'emerald' },
                    { key: 'automations', label: 'Automações', icon: Sparkles, color: 'blue' },
                    { key: 'fiscal', label: t('settings.tab_fiscal'), icon: Calculator, color: 'indigo' },
                    { key: 'loyalty', label: 'Clube de Fidelidade', icon: Award, color: 'indigo' },
                    { key: 'banking', label: 'Bancos e DDA', icon: Landmark, color: 'indigo' },
                    { key: 'subscription', label: 'Plano e Assinatura', icon: Zap, color: 'blue' },
                    ...(isAdmin ? [
                        { key: 'platform_billing', label: 'Gestão da Plataforma', icon: Activity, color: 'emerald' },
                        { key: 'admin', label: t('settings.tab_admin'), icon: Shield, color: 'purple' }
                    ] : [])
                ].filter(tab => {
                    const currentCompany = companies.find(c => c.id === currentEntity.id);
                    // 1. Feature Availability / Plan Check
                    if (tab.key === 'loyalty' && !currentCompany?.loyalty_module_enabled) return false;
                    if (tab.key === 'fiscal' && (currentEntity.type !== 'company' || !currentCompany?.fiscal_module_enabled)) return false;
                    if (tab.key === 'banking' && currentEntity.type !== 'company') return false;
                    
                    if (!isTrial) {
                        if (tab.key === 'payments' && (currentEntity.type !== 'company' || !currentCompany?.payments_module_enabled)) return false;
                        if (tab.key === 'automations' && (currentEntity.type === 'company' && !currentCompany?.automations_module_enabled)) return false;
                    }

                    // 0. Super Admin Bypass (Moved down to respect module toggles)
                    if (isAdmin) return true;

                    // 2. Personal Context Restrictions
                    // Hide company-specific tabs in personal context UNLESS on trial
                    if (currentEntity.type === 'personal' && !isTrial) {
                        const companyOnlyTabs = ['financial', 'team', 'webhooks'];
                        if (companyOnlyTabs.includes(tab.key)) return false;
                    }


                    // 4. Matrix-based filtering (from "Configurar Empresa")
                    const matrix = currentEntity.settings || {};
                    const role = currentEntity.type === 'company' ? (currentEntity.role || 'member') : 'admin';
                    const roleForMatrix = role === 'owner' ? 'admin' : role;

                    return getTabPermission(tab.key, roleForMatrix as any, matrix);
                }).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`pb-3 px-4 flex items-center gap-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.key
                            ? `border-b-2 border-${tab.color}-600 text-${tab.color}-600 dark:text-${tab.color}-400`
                            : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={`bg-white dark:bg-slate-800 shadow rounded-lg p-6 transition-all duration-200 ${loading ? 'min-h-[400px] flex flex-col justify-center items-center' : ''}`}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-4 py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        <p className="text-gray-500 dark:text-gray-400 animate-pulse font-medium">{t('settings.loading')}</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'subscription' && (
                            <SubscriptionSettings />
                        )}


                {activeTab === 'quotes' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <FileText className="text-blue-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('settings.quote_defaults')}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {t('settings.quote_defaults_desc')}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label={t('settings.default_validity')}
                                type="number"
                                value={quoteValidity}
                                onChange={(e) => setQuoteValidity(parseInt(e.target.value) || 0)}
                                placeholder="Ex: 7"
                                min="1"
                                helpText={t('settings.validity_help')}
                            />
                        </div>

                        {currentEntity.type === 'company' && currentEntity.warranty_module_enabled && (
                            <div className="mt-6 space-y-4">
                                <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                    <div className="space-y-1 pr-4">
                                        <h4 className="font-bold text-gray-900 dark:text-white leading-none">
                                            Controle de Garantia e Responsabilidade Técnica
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                            Ativa o controle de período de garantia e a atribuição de responsáveis técnicos para os itens de serviço de seus orçamentos.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={enableServiceWarranty} 
                                            onChange={(e) => setEnableServiceWarranty(e.target.checked)} 
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                {enableServiceWarranty && (
                                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 animate-in fade-in duration-300 space-y-3">
                                        <div>
                                            <h5 className="text-xs font-black uppercase tracking-wider text-gray-400">Modelo de Aplicação da Garantia</h5>
                                            <p className="text-[11px] text-gray-500 leading-tight">Escolha como a garantia será definida e apresentada nos orçamentos da empresa.</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                            <button
                                                type="button"
                                                onClick={() => setWarrantyType('individual')}
                                                className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${warrantyType === 'individual' ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 shadow-sm ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'}`}
                                            >
                                                <span className="text-xs font-bold text-gray-900 dark:text-white mb-0.5">Por Item / Serviço (Individual)</span>
                                                <span className="text-[10px] text-gray-500 leading-normal">Defina técnico responsável e garantia específica para cada serviço individualmente no orçamento.</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWarrantyType('global')}
                                                className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${warrantyType === 'global' ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 shadow-sm ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'}`}
                                            >
                                                <span className="text-xs font-bold text-gray-900 dark:text-white mb-0.5">Por Orçamento Completo (Global)</span>
                                                <span className="text-[10px] text-gray-500 leading-normal">Defina um único prazo de garantia e técnico executor geral válido para todo o orçamento.</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={saving}>
                                <Save size={18} className="mr-2" />
                                {t('settings.save_settings')}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'financial' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <Wallet className="text-green-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('settings.fees_commissions')}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {t('settings.fees_desc')}
                                </p>
                            </div>
                        </div>


                        {currentEntity.type === 'company' && (
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleImportFromPersonal}
                                    isLoading={cloning}
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                    <RefreshCw size={14} className="mr-2" />
                                    {t('settings.import_personal')}
                                </Button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <Input
                                    label={t('settings.receiving_fee')}
                                    type="number"
                                    value={commissionRate}
                                    onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 4.5"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    helpText={t('settings.receiving_fee_help')}
                                />
                            </div>
                            <div className="relative">
                                <Input
                                    label={t('settings.service_commission')}
                                    type="number"
                                    value={serviceCommissionRate}
                                    onChange={(e) => setServiceCommissionRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 10"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    helpText={t('settings.service_commission_help')}
                                />
                            </div>
                            <div className="relative">
                                <Input
                                    label={t('settings.product_commission')}
                                    type="number"
                                    value={productCommissionRate}
                                    onChange={(e) => setProductCommissionRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 5"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    helpText={t('settings.product_commission_help')}
                                />
                            </div>
                        </div>

                        <div className="mt-8 mb-4 border-t border-gray-100 dark:border-slate-700 pt-6 flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <Calculator className="text-purple-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('settings.regional_options', 'Opções Regionais')}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Configure a moeda que o sistema utilizará para exibir orçamentos, faturas, contratos e painéis financeiros. (Afeta a exibição para clientes).
                                </p>
                            </div>
                        </div>
                        
                        <div className="w-full md:w-1/2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {currentEntity.type === 'company' ? 'Moeda Principal da Empresa' : 'Moeda Principal da Conta'}
                            </label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            >
                                <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                                <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                                <option value="EUR">🇪🇺 Euro (EUR)</option>
                                <option value="PYG">🇵🇾 Guarani Paraguaio (PYG)</option>
                                <option value="ARS">🇦🇷 Peso Argentino (ARS)</option>
                                <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-2">Gateways de pagamento podem ter restrições dependendo da moeda selecionada.</p>
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={saving}>
                                <Save size={18} className="mr-2" />
                                {t('settings.save_settings')}
                            </Button>
                        </div>

                        {/* Maintenance Section moved here to be part of Financial or just general Settings footer? 
                            Keeping it inside Financial or separate? Previously it was at bottom of page. 
                            Let's keep it here for now or at the bottom. 
                            Actually, the user replaced the whole component, so I'll put it at the bottom of the financial tab or page.
                            The previous code had it outside the tabs. Let's keep it outside tabs if possible or put it in financial.
                            I'll put it in Financial for now as it relates to transactions.
                         */}
                        <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">{t('settings.maintenance')}</h3>
                            <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg flex items-center justify-between">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('settings.sync_desc')}
                                </p>
                                <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors" onClick={handleSyncTransactions} disabled={syncing}>
                                    <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                                    {t('common.sync')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="space-y-8">
                        {/* Invite Section */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('settings.invite_member')}</h3>
                            <form onSubmit={handleInvite} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <Input
                                        label={t('settings.user_email')}
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="exemplo@email.com"
                                        required
                                    />
                                </div>
                                <div className="w-48">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('settings.role')}
                                    </label>
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                                        className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="member">{t('settings.role_member')}</option>
                                        <option value="admin">{t('settings.role_admin')}</option>
                                    </select>
                                </div>
                                <Button type="submit" isLoading={inviting} className="mb-[2px]">
                                    {t('settings.invite_btn')}
                                </Button>
                            </form>
                        </div>

                        {/* Members List */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('settings.team_members')}</h3>
                                <Button size="sm" variant="ghost" onClick={refreshTeam} isLoading={teamLoading}>
                                    <RefreshCw size={16} />
                                </Button>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar border border-gray-200 dark:border-slate-700 rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('settings.name_email')}</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('settings.role')}</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('settings.joined_at')}</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                        {teamLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    {t('settings.loading_team')}
                                                </td>
                                            </tr>
                                        ) : members.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    {t('settings.no_members')}
                                                </td>
                                            </tr>
                                        ) : (
                                            members.map((m) => (
                                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {m.profile.full_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{m.profile.email}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {editingMemberId === m.id ? (
                                                            <select
                                                                value={editMemberRole}
                                                                onChange={(e) => setEditMemberRole(e.target.value as 'admin' | 'member')}
                                                                className="text-xs p-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                                            >
                                                                <option value="member">{t('settings.role_member')}</option>
                                                                <option value="admin">{t('settings.role_admin')}</option>
                                                            </select>
                                                        ) : (
                                                            <span className={`px-2 py-0.5 rounded text-xs border capitalize ${m.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-gray-50 border-gray-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                                {m.role === 'owner' ? t('settings.platform_owner') : m.role === 'admin' ? t('settings.role_admin') : t('settings.role_member')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-200">
                                                            {t('common.active')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500">
                                                        {new Date(m.joined_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {m.role !== 'owner' && (
                                                            <div className="flex items-center justify-end gap-3">
                                                                {editingMemberId === m.id ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleSaveMemberRole(m.id)}
                                                                            disabled={updatingMember}
                                                                            className="text-green-600 hover:text-green-800 text-xs font-bold"
                                                                        >
                                                                            {updatingMember ? 'Salvando...' : 'Salvar'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingMemberId(null)}
                                                                            className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingMemberId(m.id);
                                                                                setEditMemberRole(m.role as 'admin' | 'member');
                                                                            }}
                                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm(t('settings.remove_member_confirm'))) removeMember(m.id);
                                                                            }}
                                                                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                                                                        >
                                                                            {t('settings.remove_member')}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Invites List */}
                        {invites.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('settings.pending_invites')}</h3>
                                <div className="overflow-x-auto custom-scrollbar border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('common.email')}</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('settings.role')}</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('settings.expires_at')}</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">{t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                            {invites.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                        {inv.email}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="capitalize text-gray-600">{inv.role}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500">
                                                        {new Date(inv.expires_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => copyInviteLink(inv.token)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            {t('common.copy_link')}
                                                        </button>
                                                        <button
                                                            onClick={() => cancelInvite(inv.id)}
                                                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                                                        >
                                                            {t('settings.cancel_invite')}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Técnicos de Campo / Funcionários Externos */}
                        {currentEntity.type === 'company' && currentEntity.warranty_module_enabled && (
                            <div className="space-y-8 mt-10 pt-8 border-t border-gray-100 dark:border-slate-700 animate-in fade-in duration-300 text-left">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Técnicos de Campo / Funcionários</h3>
                                    <p className="text-xs text-gray-500">Cadastre e gerencie a equipe que executa os serviços em campo, sem precisar convidá-los a logar no sistema.</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Cadastrar Novo Profissional</h4>
                                    <form onSubmit={handleAddTechnician} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                        <div>
                                            <Input
                                                label="Nome do Profissional"
                                                type="text"
                                                value={techName}
                                                onChange={(e) => setTechName(e.target.value)}
                                                placeholder="Ex: Roberto Eletricista"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Input
                                                label="Especialidade / Cargo"
                                                type="text"
                                                value={techSpecialty}
                                                onChange={(e) => setTechSpecialty(e.target.value)}
                                                placeholder="Ex: Ar Condicionado, Pintor"
                                            />
                                        </div>
                                        <div className="flex gap-3 items-end">
                                            <div className="flex-1">
                                                <Input
                                                    label="Telefone / WhatsApp"
                                                    type="text"
                                                    value={techPhone}
                                                    onChange={(e) => setTechPhone(formatPhoneInput(e.target.value))}
                                                    placeholder="(00) 00000-0000"
                                                />
                                            </div>
                                            <Button type="submit" isLoading={addingTech} className="mb-[2px]">
                                                Adicionar
                                            </Button>
                                        </div>
                                    </form>
                                </div>

                                <div>
                                    <div className="overflow-x-auto custom-scrollbar border border-gray-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/50 shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Nome do Técnico</th>
                                                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Especialidade</th>
                                                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Contato</th>
                                                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Cadastrado em</th>
                                                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                                {technicians.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                            Nenhum técnico de campo cadastrado ainda.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    technicians.map((tech) => (
                                                        <tr key={tech.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                                                                {editingTechId === tech.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editTechName}
                                                                        onChange={(e) => setEditTechName(e.target.value)}
                                                                        className="text-xs p-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white w-full max-w-[150px]"
                                                                        required
                                                                    />
                                                                ) : (
                                                                    tech.name
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {editingTechId === tech.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editTechSpecialty}
                                                                        onChange={(e) => setEditTechSpecialty(e.target.value)}
                                                                        className="text-xs p-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white w-full max-w-[150px]"
                                                                        placeholder="Ex: Geral"
                                                                    />
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium">
                                                                        {tech.specialty || 'Geral'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">
                                                                {editingTechId === tech.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editTechPhone}
                                                                        onChange={(e) => setEditTechPhone(formatPhoneInput(e.target.value))}
                                                                        className="text-xs p-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white w-full max-w-[150px]"
                                                                        placeholder="(00) 00000-0000"
                                                                    />
                                                                ) : (
                                                                    tech.phone || 'Sem contato'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-500">
                                                                {new Date(tech.created_at).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-3">
                                                                    {editingTechId === tech.id ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleSaveTechnician(tech.id)}
                                                                                disabled={updatingTech}
                                                                                className="text-green-600 hover:text-green-800 text-xs font-bold transition-colors"
                                                                            >
                                                                                {updatingTech ? 'Salvando...' : 'Salvar'}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingTechId(null)}
                                                                                className="text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingTechId(tech.id);
                                                                                    setEditTechName(tech.name);
                                                                                    setEditTechSpecialty(tech.specialty || '');
                                                                                    setEditTechPhone(tech.phone || '');
                                                                                }}
                                                                                className="text-blue-600 hover:text-blue-800 text-xs font-bold transition-colors"
                                                                            >
                                                                                Editar
                                                                            </button>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    if (confirm(`Deseja realmente remover o técnico ${tech.name}?`)) {
                                                                                        const { error } = await deleteTechnician(tech.id);
                                                                                        if (error) alert(error);
                                                                                    }
                                                                                }}
                                                                                className="text-red-600 hover:text-red-800 text-xs font-bold transition-colors"
                                                                            >
                                                                                Remover
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'automations' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Sparkles className="text-blue-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Central de Automações e Lembretes</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Configure o envio automático de mensagens e avisos para você e seus clientes.
                                </p>
                            </div>
                        </div>

                        {!waConnected && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3 text-amber-700 dark:text-amber-400 mb-4">
                                <Shield size={18} />
                                <p className="text-sm font-medium">As automações estão desativadas porque não há um WhatsApp conectado. Vá na aba "WhatsApp API" para conectar.</p>
                            </div>
                        )}

                        <div className="p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700 mb-6">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare size={16} className="text-blue-600" />
                                Contato para Lembretes Administrativos
                            </h4>
                            <div className="max-w-md">
                                <Input
                                    label="WhatsApp para Receber Relatórios"
                                    value={automationWhatsAppNumber}
                                    onChange={(e) => setAutomationWhatsAppNumber(formatPhoneInput(e.target.value))}
                                    placeholder="+55 (00) 00000-0000"
                                    helpText="Este número receberá o Resumo Financeiro Diário e alertas do sistema."
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Financeiro */}
                            <div className="p-4 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">Resumo Financeiro Diário</h4>
                                        <p className="text-sm text-gray-500">Receba no seu WhatsApp um resumo diário de todas as contas a pagar e receber do dia atual e atrasos.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {autoFinancial && waConnected && (
                                            <button
                                                onClick={() => setEditingAutomation('financial')}
                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                                            >
                                                <Edit size={16} />
                                                Configurar Mensagem
                                            </button>
                                        )}
                                        <div className="flex flex-col items-center">
                                            <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Horário</label>
                                            <input
                                                type="time"
                                                value={autoFinancialTime}
                                                disabled={!waConnected}
                                                onChange={(e) => setAutoFinancialTime(e.target.value)}
                                                className="text-xs border rounded p-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white disabled:opacity-50"
                                            />
                                        </div>
                                        <label className={`relative inline-flex items-center ${!waConnected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                            <input type="checkbox" className="sr-only peer" checked={autoFinancial} onChange={(e) => setAutoFinancial(e.target.checked)} disabled={!waConnected} />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Aniversário */}
                            <div className="p-4 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">Lembrete de Aniversário</h4>
                                        <p className="text-sm text-gray-500">Enviar mensagem automática de felicitação para clientes no dia do aniversário.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {autoBirthday && waConnected && (
                                            <button
                                                onClick={() => setEditingAutomation('birthday')}
                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                                            >
                                                <Edit size={16} />
                                                Configurar Mensagem
                                            </button>
                                        )}
                                        <div className="flex flex-col items-center">
                                            <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Horário</label>
                                            <input
                                                type="time"
                                                value={autoBirthdayTime}
                                                disabled={!waConnected}
                                                onChange={(e) => setAutoBirthdayTime(e.target.value)}
                                                className="text-xs border rounded p-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white disabled:opacity-50"
                                            />
                                        </div>
                                        <label className={`relative inline-flex items-center ${!waConnected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                            <input type="checkbox" className="sr-only peer" checked={autoBirthday} onChange={(e) => setAutoBirthday(e.target.checked)} disabled={!waConnected} />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Pagamento Atrasado */}
                            <div className="p-4 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">Aviso de Pagamento Atrasado</h4>
                                        <p className="text-sm text-gray-500">Notificar o cliente automaticamente via WhatsApp quando uma fatura estiver com mais de 3 dias de atraso.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {autoOverdue && waConnected && (
                                            <button
                                                onClick={() => setEditingAutomation('overdue')}
                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                                            >
                                                <Edit size={16} />
                                                Configurar Mensagem
                                            </button>
                                        )}
                                        <div className="flex flex-col items-center">
                                            <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Horário</label>
                                            <input
                                                type="time"
                                                value={autoOverdueTime}
                                                disabled={!waConnected}
                                                onChange={(e) => setAutoOverdueTime(e.target.value)}
                                                className="text-xs border rounded p-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white disabled:opacity-50"
                                            />
                                        </div>
                                        <label className={`relative inline-flex items-center ${!waConnected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                            <input type="checkbox" className="sr-only peer" checked={autoOverdue} onChange={(e) => setAutoOverdue(e.target.checked)} disabled={!waConnected} />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={saving}>
                                <Save size={18} className="mr-2" />
                                {t('settings.save_settings')}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'webhooks' && (
                    <WebhookSettings />
                )}

                {activeTab === 'whatsapp' && (
                    <WhatsApp />
                )}

                {activeTab === 'fiscal' && (
                    <FiscalSettings />
                )}

                {activeTab === 'payments' && (
                    <PaymentSettings />
                )}

                {activeTab === 'banking' && (
                    <BankingSettings />
                )}

                {activeTab === 'loyalty' && currentCompany?.loyalty_module_enabled && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                                <Award size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clube de Fidelidade</h1>
                                <p className="text-gray-500">Gestão de recorrência, planos e benefícios para seus clientes.</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm space-y-8">
                            <div className="flex items-center justify-between p-6 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/10 bg-indigo-50/20 dark:bg-indigo-900/10">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 rounded-xl bg-indigo-100 text-indigo-600">
                                        <Shield size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Status do Módulo</h3>
                                        <p className="text-sm text-gray-500">Ao ativar, você poderá criar planos e faturar assinaturas recorrentes dos seus clientes.</p>
                                    </div>
                                </div>
                                <label className={`relative inline-flex items-center cursor-pointer scale-125 ${togglingLoyalty ? 'opacity-50 cursor-wait' : ''}`}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={optimisticLoyalty !== null ? optimisticLoyalty : !!currentEntity.loyalty_module_enabled}
                                        disabled={togglingLoyalty}
                                        onChange={async (e) => {
                                            if (currentEntity.type === 'personal') {
                                                alert('O Clube de Fidelidade é um módulo exclusivo para Empresas. Mude o contexto no seletor do topo.');
                                                return;
                                            }
                                            const newVal = e.target.checked;
                                            setOptimisticLoyalty(newVal);
                                            setTogglingLoyalty(true);
                                            
                                            try {
                                                const { error } = await supabase
                                                    .from('companies')
                                                     .update({ loyalty_module_enabled: newVal })
                                                     .eq('id', currentEntity.id);
                                                 
                                                 if (error) throw error;
                                                 await refreshEntity();
                                            } catch (err: any) {
                                                setOptimisticLoyalty(null);
                                                alert('Erro ao atualizar módulo: ' + err.message);
                                            } finally {
                                                setTogglingLoyalty(false);
                                                setTimeout(() => setOptimisticLoyalty(null), 1500);
                                            }
                                        }}
                                    />
                                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {(optimisticLoyalty !== null ? optimisticLoyalty : !!currentEntity.loyalty_module_enabled) ? (
                                <div className="p-6 rounded-xl border border-blue-100 bg-blue-50/30 dark:border-blue-900/20 dark:bg-blue-900/10 flex items-start gap-3">
                                    <Sparkles className="text-blue-600 mt-1" size={20} />
                                    <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                                        Módulo Ativo! Agora você pode acessar o menu <b>Clube de Fidelidade</b> na barra lateral para configurar seus planos e gerenciar seus assinantes.
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 rounded-xl border border-orange-100 bg-orange-50/30 dark:border-orange-900/20 dark:bg-orange-900/10 flex items-start gap-3">
                                    <AlertTriangle className="text-orange-600 mt-1" size={20} />
                                    <div className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
                                        Módulo Inativo. O menu de fidelidade ficará oculto para todos os membros da sua equipe até que você o ative.
                                    </div>
                                </div>
                            )}

                            {isAdmin && (
                                <div className="pt-8 border-t border-gray-100 dark:border-slate-700 space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Shield className="text-indigo-600" size={20} />
                                        Configurações de Notificação (Global)
                                    </h3>
                                    
                                    <div className="flex items-center justify-between mb-8 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                        <div>
                                            <h3 className="font-bold text-indigo-900 dark:text-indigo-100">Disponibilidade do Módulo</h3>
                                            <p className="text-sm text-indigo-600 dark:text-indigo-400">Ative ou desative o Clube de Fidelidade globalmente para todas as empresas.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer" 
                                                checked={loyaltyEnabled} 
                                                onChange={(e) => setLoyaltyEnabled(e.target.checked)} 
                                            />
                                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                        {/* WhatsApp Loyalty */}
                                        <div className="space-y-4 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50/30">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-green-100 text-green-600">
                                                        <MessageSquare size={18} />
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">WhatsApp Automático</h4>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer" 
                                                        checked={loyaltyWaEnabled} 
                                                        onChange={(e) => setLoyaltyWaEnabled(e.target.checked)} 
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                                </label>
                                            </div>
                                            <textarea
                                                className="w-full h-32 p-3 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Digite o template do WhatsApp..."
                                                value={loyaltyWaTemplate}
                                                onChange={(e) => setLoyaltyWaTemplate(e.target.value)}
                                            />
                                            <p className="text-[10px] text-gray-400">Variáveis: {'{name}, {plan_name}, {payment_link}, {price}'}</p>
                                        </div>

                                        {/* Email Loyalty */}
                                        <div className="space-y-4 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50/30">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                                        <FileText size={18} />
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">E-mail HTML (Resend)</h4>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer" 
                                                        checked={loyaltyEmailEnabled} 
                                                        onChange={(e) => setLoyaltyEmailEnabled(e.target.checked)} 
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                            <textarea
                                                className="w-full h-32 p-3 text-[10px] font-mono border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Digite o template HTML do e-mail..."
                                                value={loyaltyEmailTemplate}
                                                onChange={(e) => setLoyaltyEmailTemplate(e.target.value)}
                                            />
                                            <p className="text-[10px] text-gray-400">Suporta HTML e as mesmas variáveis do WhatsApp.</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button
                                            onClick={async () => {
                                                setSaving(true);
                                                const { error } = await updateAppSettings({
                                                    loyalty_whatsapp_enabled: loyaltyWaEnabled,
                                                    loyalty_whatsapp_template: loyaltyWaTemplate,
                                                    loyalty_email_enabled: loyaltyEmailEnabled,
                                                    loyalty_email_template: loyaltyEmailTemplate,
                                                    loyalty_enabled: loyaltyEnabled
                                                });
                                                setSaving(false);
                                                if (error) alert('Erro ao salvar: ' + error);
                                                else alert('Configurações globais salvas!');
                                            }}
                                            isLoading={saving}
                                        >
                                            <Save size={18} className="mr-2" />
                                            Salvar Configurações Globais
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Per-Company Config Modal */}
                {selectedCompanyForConfig && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.configure_company')}</h2>
                                        <p className="text-sm text-gray-500">{selectedCompanyForConfig.trade_name} • {selectedCompanyForConfig.cnpj}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedCompanyForConfig(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-10">
                                <div className="space-y-8">
                                    {/* Módulos do Sistema */}
                                    <div className="overflow-x-auto custom-scrollbar border border-gray-100 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/50 shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest text-[10px]">Módulo do Sistema</th>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 text-center w-32 uppercase tracking-widest text-[10px]">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <div className="mb-2">
                                                            <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">{t('settings.fiscal_module')}</h4>
                                                            <p className="text-xs text-gray-500 leading-tight">{t('settings.fiscal_module_desc')}</p>
                                                        </div>
                                                        {tempCompanyConfig.fiscal_module_enabled && (
                                                            <div className="mt-3 p-3 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/20 space-y-3">
                                                                <label className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-1">
                                                                    Emissores Fiscais Autorizados
                                                                </label>
                                                                <div className="flex flex-col gap-2.5">
                                                                    {(() => {
                                                                        const enabledList = tempCompanyConfig.settings?.enabled_fiscal_providers || 
                                                                            (tempCompanyConfig.settings?.fiscal_provider ? [tempCompanyConfig.settings.fiscal_provider] : ['tecnospeed']);
                                                                        
                                                                        const providers = [
                                                                            { id: 'tecnospeed', name: 'TecnoSpeed' },
                                                                            { id: 'nfeio', name: 'NFe.io' },
                                                                            { id: 'other', name: 'Outro (Customizado)' }
                                                                        ];

                                                                        const toggleProvider = (id: string) => {
                                                                            let next = [...enabledList];
                                                                            if (next.includes(id)) {
                                                                                next = next.filter(p => p !== id);
                                                                            } else {
                                                                                next.push(id);
                                                                            }
                                                                            if (next.length === 0) {
                                                                                next = ['tecnospeed'];
                                                                            }
                                                                            let currentActive = tempCompanyConfig.settings?.fiscal_provider || 'tecnospeed';
                                                                            if (!next.includes(currentActive)) {
                                                                                currentActive = next[0];
                                                                            }
                                                                            setTempCompanyConfig({
                                                                                ...tempCompanyConfig,
                                                                                settings: {
                                                                                    ...(tempCompanyConfig.settings || {}),
                                                                                    enabled_fiscal_providers: next,
                                                                                    fiscal_provider: currentActive
                                                                                }
                                                                            });
                                                                        };

                                                                        return providers.map(p => (
                                                                            <label key={p.id} className="flex items-center gap-2 cursor-pointer group text-xs">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                                    checked={enabledList.includes(p.id)}
                                                                                    onChange={() => toggleProvider(p.id)}
                                                                                />
                                                                                <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">
                                                                                    {p.name}
                                                                                </span>
                                                                            </label>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                                <div className="border-t border-indigo-100/50 dark:border-indigo-800/30 pt-3 mt-3">
                                                                    <label className="flex items-center gap-2 cursor-pointer group text-xs">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                            checked={!!tempCompanyConfig.settings?.fiscal_billing_exempt}
                                                                            onChange={(e) => setTempCompanyConfig({
                                                                                ...tempCompanyConfig,
                                                                                settings: {
                                                                                    ...(tempCompanyConfig.settings || {}),
                                                                                    fiscal_billing_exempt: e.target.checked
                                                                                }
                                                                            })}
                                                                        />
                                                                        <span className="font-bold text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">
                                                                            Isento de Mensalidade Fiscal (Cortesia)
                                                                        </span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.fiscal_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, fiscal_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">{t('settings.payments_module')}</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">{t('settings.payments_module_desc')}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.payments_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, payments_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">Módulo Bancário & DDA</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">Configurações de contas bancárias, credenciais de APIs e DDA automático.</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.banking_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, banking_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">{t('settings.crm_module')}</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">{t('settings.crm_module_desc')}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.crm_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, crm_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">Marketing: Postagens IA</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">Criação estratégica de postagens automáticas via WhatsApp/Instagram.</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.has_social_copilot} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, has_social_copilot: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">Automações</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">Lembretes, aniversários e cobranças automáticas via WhatsApp.</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.automations_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, automations_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">Radar de Leads</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">Mineração e abordagem automática de clientes em massa via IA.</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.has_lead_radar} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, has_lead_radar: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <div className="mb-2">
                                                            <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">🏆 Clube de Fidelidade</h4>
                                                            <p className="text-xs text-gray-500 leading-tight">Gestão de planos, recorrência e benefícios para clientes.</p>
                                                        </div>
                                                        {tempCompanyConfig.loyalty_module_enabled && (
                                                            <div className="mt-3 p-3 bg-amber-50/30 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-800/20 space-y-3">
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Taxa Plataforma (%)</span>
                                                                    <input
                                                                        type="number"
                                                                        value={tempCompanyConfig.loyalty_platform_fee || 5}
                                                                        onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, loyalty_platform_fee: Number(e.target.value) })}
                                                                        className="w-16 px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 rounded-lg text-amber-900 dark:text-amber-200 focus:ring-1 focus:ring-amber-500 outline-none"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id="split_enabled"
                                                                        checked={!!tempCompanyConfig.loyalty_split_enabled}
                                                                        onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, loyalty_split_enabled: e.target.checked })}
                                                                        className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                                                    />
                                                                    <label htmlFor="split_enabled" className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 cursor-pointer">Split Automático Asaas</label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.loyalty_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, loyalty_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">Controle de Garantia</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">Habilita o controle de prazos de garantia e executantes técnicos para os serviços.</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={!!tempCompanyConfig.warranty_module_enabled} onChange={(e) => setTempCompanyConfig({ ...tempCompanyConfig, warranty_module_enabled: e.target.checked })} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <h4 className="font-bold text-gray-900 dark:text-white mb-1 leading-none">{t('settings.data_deletion')}</h4>
                                                        <p className="text-xs text-gray-500 leading-tight">{t('settings.data_deletion_desc')}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={tempCompanyConfig.settings?.member_can_delete}
                                                                    onChange={(e) => setTempCompanyConfig({
                                                                        ...tempCompanyConfig,
                                                                        settings: { ...tempCompanyConfig.settings, member_can_delete: e.target.checked }
                                                                    })}
                                                                />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Platform Commission Setting */}
                                <div className="p-6 rounded-xl border-2 border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-900/10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                            <Percent size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Taxas e Comissões da Plataforma</h4>
                                            <p className="text-sm text-gray-500">Defina os percentuais que o sistema cobra desta empresa.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">
                                                Comissão sobre Orçamentos (%)
                                            </label>
                                            <Input
                                                type="number"
                                                value={tempCompanyConfig.settings?.commission_rate || 0}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    const rate = parseFloat(e.target.value) || 0;
                                                    setTempCompanyConfig({
                                                        ...tempCompanyConfig,
                                                        settings: { ...(tempCompanyConfig.settings || {}), commission_rate: rate }
                                                    });
                                                }}
                                                placeholder="Ex: 5"
                                                step="0.1"
                                                min="0"
                                                max="100"
                                            />
                                            <p className="text-[10px] text-gray-400">Percentual cobrado sobre o valor total de orçamentos aprovados.</p>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">
                                                Taxa do Clube VIP (%)
                                            </label>
                                            <Input
                                                type="number"
                                                value={tempCompanyConfig.loyalty_platform_fee || 0}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    const rate = parseFloat(e.target.value) || 0;
                                                    setTempCompanyConfig({
                                                        ...tempCompanyConfig,
                                                        loyalty_platform_fee: rate
                                                    });
                                                }}
                                                placeholder="Ex: 5"
                                                step="0.1"
                                                min="0"
                                                max="100"
                                            />
                                            <p className="text-[10px] text-gray-400">Percentual cobrado sobre as mensalidades do Clube de Fidelidade.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* WhatsApp Instance Limit */}
                                <div className="p-6 rounded-xl border-2 border-green-100 dark:border-green-900/30 bg-green-50/20 dark:bg-green-900/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-2 rounded-lg bg-green-100 text-green-600">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Instâncias WhatsApp</h4>
                                            <p className="text-sm text-gray-500">Limite de contas WhatsApp que esta empresa pode conectar.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            type="number"
                                            label="Quantidade máxima de instâncias"
                                            value={tempCompanyConfig.whatsapp_instance_limit ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                                setTempCompanyConfig({ ...tempCompanyConfig, whatsapp_instance_limit: val });
                                            }}
                                            min="1"
                                            max="50"
                                            step="1"
                                        />
                                        <p className="text-[11px] text-gray-400 mt-5">Mínimo: 1 &nbsp;•&nbsp; Máximo: 50</p>
                                    </div>
                                </div>

                                {/* Tipos de Conta Permitidos (PF / PJ) */}
                                <div className="p-6 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-900/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                                            <Building size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Tipos de Conta Permitidos</h4>
                                            <p className="text-sm text-gray-500">Defina se este cliente pode cadastrar contas como Pessoa Física, Jurídica ou Ambas.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-8 mt-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={(tempCompanyConfig.allowed_entity_types || ['PF', 'PJ']).includes('PF')}
                                                    onChange={(e) => {
                                                        const current = tempCompanyConfig.allowed_entity_types || ['PF', 'PJ'];
                                                        let next = [...current];
                                                        if (e.target.checked) {
                                                            if (!next.includes('PF')) next.push('PF');
                                                        } else {
                                                            if (next.length > 1) next = next.filter(t => t !== 'PF');
                                                            else alert('Selecione ao menos um tipo de conta.');
                                                        }
                                                        setTempCompanyConfig({ ...tempCompanyConfig, allowed_entity_types: next });
                                                    }}
                                                />
                                            </div>
                                            <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">🧑 Pessoa Física (PF)</span>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={(tempCompanyConfig.allowed_entity_types || ['PF', 'PJ']).includes('PJ')}
                                                    onChange={(e) => {
                                                        const current = tempCompanyConfig.allowed_entity_types || ['PF', 'PJ'];
                                                        let next = [...current];
                                                        if (e.target.checked) {
                                                            if (!next.includes('PJ')) next.push('PJ');
                                                        } else {
                                                            if (next.length > 1) next = next.filter(t => t !== 'PJ');
                                                            else alert('Selecione ao menos um tipo de conta.');
                                                        }
                                                        setTempCompanyConfig({ ...tempCompanyConfig, allowed_entity_types: next });
                                                    }}
                                                />
                                            </div>
                                            <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">🏢 Pessoa Jurídica (PJ)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Subscription Plan (Monthly & Annual) */}
                                <div className="p-6 rounded-xl border-2 border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/10 space-y-6">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">{t('settings.subscription_plan')}</h4>
                                            <p className="text-sm text-gray-500">{t('settings.subscription_desc')}</p>
                                        </div>
                                    </div>

                                    {/* Isenção de Faturamento (Solicitado pelo usuário) */}
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                                <Shield size={16} />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-[12px] text-gray-900 dark:text-white leading-tight">Cortesia / Isento de Faturamento</h5>
                                                <p className="text-[10px] text-gray-400">Marque para não gerar cobranças automáticas para esta empresa.</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer scale-90">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!tempCompanyConfig.settings?.billing_exempt}
                                                onChange={(e) => {
                                                    const newVal = e.target.checked;
                                                    setTempCompanyConfig({
                                                        ...tempCompanyConfig,
                                                        settings: { ...(tempCompanyConfig.settings || {}), billing_exempt: newVal }
                                                    });
                                                }}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <CurrencyInput
                                            label={t('settings.monthly_fee', { symbol: window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}` })}
                                            value={tempCompanyConfig.settings?.monthly_fee || 0}
                                            onChange={(num) => {
                                                setTempCompanyConfig({
                                                    ...tempCompanyConfig,
                                                    settings: { ...(tempCompanyConfig.settings || {}), monthly_fee: num }
                                                });
                                            }}
                                            placeholder="Ex: 150"
                                        />
                                        <CurrencyInput
                                            label={t('settings.annual_fee', { symbol: window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}` })}
                                            value={tempCompanyConfig.settings?.annual_fee || 0}
                                            onChange={(num) => {
                                                setTempCompanyConfig({
                                                    ...tempCompanyConfig,
                                                    settings: { ...(tempCompanyConfig.settings || {}), annual_fee: num }
                                                });
                                            }}
                                            placeholder="Ex: 1200"
                                        />
                                        <div className="flex flex-col gap-2">
                                            <Input
                                                label={t('settings.license_expiry')}
                                                type="date"
                                                value={tempCompanyConfig.settings?.license_expires_at ? new Date(tempCompanyConfig.settings.license_expires_at).toISOString().split('T')[0] : ''}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    const val = e.target.value;
                                                    setTempCompanyConfig({
                                                        ...tempCompanyConfig,
                                                        settings: { ...(tempCompanyConfig.settings || {}), license_expires_at: val }
                                                    });
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const nextYear = new Date();
                                                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                                                    const val = nextYear.toISOString().split('T')[0];
                                                    setTempCompanyConfig({
                                                        ...tempCompanyConfig,
                                                        settings: { ...(tempCompanyConfig.settings || {}), license_expires_at: val }
                                                    });
                                                }}
                                                className="text-[10px] w-fit font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                            >
                                                {t('settings.renew_one_year')}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Taxas por Emissão de Notas Fiscais */}
                                <div className="p-6 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-900/10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                                            <Receipt size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Taxas por Emissão de Notas Fiscais</h4>
                                            <p className="text-sm text-gray-500">Defina o custo fixo mensal e o valor cobrado por nota emitida para cada emissor fiscal ativo.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* TecnoSpeed */}
                                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 space-y-4">
                                            <h5 className="font-bold text-gray-900 dark:text-white border-b pb-2">TecnoSpeed</h5>
                                            <div className="space-y-4">
                                                <CurrencyInput
                                                    label="Valor Fixo Mensal"
                                                    value={tempCompanyConfig.settings?.admin_fiscal_billing?.tecnospeed?.fixed_fee ?? 30.00}
                                                    onChange={(num) => {
                                                        const currentBilling = tempCompanyConfig.settings?.admin_fiscal_billing || {};
                                                        setTempCompanyConfig({
                                                            ...tempCompanyConfig,
                                                            settings: {
                                                                ...(tempCompanyConfig.settings || {}),
                                                                admin_fiscal_billing: {
                                                                    ...currentBilling,
                                                                    tecnospeed: {
                                                                        ...(currentBilling.tecnospeed || {}),
                                                                        fixed_fee: num
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    placeholder="Ex: 30,00"
                                                />
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight block">
                                                        Valor Adicional por Nota (R$)
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        value={tempCompanyConfig.settings?.admin_fiscal_billing?.tecnospeed?.per_note_fee ?? 0.50}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const currentBilling = tempCompanyConfig.settings?.admin_fiscal_billing || {};
                                                            setTempCompanyConfig({
                                                                ...tempCompanyConfig,
                                                                settings: {
                                                                    ...(tempCompanyConfig.settings || {}),
                                                                    admin_fiscal_billing: {
                                                                        ...currentBilling,
                                                                        tecnospeed: {
                                                                            ...(currentBilling.tecnospeed || {}),
                                                                            per_note_fee: val
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        placeholder="Ex: 0.50"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* NFe.io */}
                                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 space-y-4">
                                            <h5 className="font-bold text-gray-900 dark:text-white border-b pb-2">NFe.io</h5>
                                            <div className="space-y-4">
                                                <CurrencyInput
                                                    label="Valor Fixo Mensal"
                                                    value={tempCompanyConfig.settings?.admin_fiscal_billing?.nfeio?.fixed_fee ?? 30.00}
                                                    onChange={(num) => {
                                                        const currentBilling = tempCompanyConfig.settings?.admin_fiscal_billing || {};
                                                        setTempCompanyConfig({
                                                            ...tempCompanyConfig,
                                                            settings: {
                                                                ...(tempCompanyConfig.settings || {}),
                                                                admin_fiscal_billing: {
                                                                    ...currentBilling,
                                                                    nfeio: {
                                                                        ...(currentBilling.nfeio || {}),
                                                                        fixed_fee: num
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    placeholder="Ex: 30,00"
                                                />
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight block">
                                                        Valor Adicional por Nota (R$)
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        value={tempCompanyConfig.settings?.admin_fiscal_billing?.nfeio?.per_note_fee ?? 0.50}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const currentBilling = tempCompanyConfig.settings?.admin_fiscal_billing || {};
                                                            setTempCompanyConfig({
                                                                ...tempCompanyConfig,
                                                                settings: {
                                                                    ...(tempCompanyConfig.settings || {}),
                                                                    admin_fiscal_billing: {
                                                                        ...currentBilling,
                                                                        nfeio: {
                                                                            ...(currentBilling.nfeio || {}),
                                                                            per_note_fee: val
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        placeholder="Ex: 0.50"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Outro (Customizado) */}
                                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 space-y-4">
                                            <h5 className="font-bold text-gray-900 dark:text-white border-b pb-2">Outro (Customizado)</h5>
                                            <div className="space-y-4">
                                                <CurrencyInput
                                                    label="Valor Fixo Mensal"
                                                    value={tempCompanyConfig.settings?.admin_fiscal_billing?.other?.fixed_fee ?? 30.00}
                                                    onChange={(num) => {
                                                        const currentBilling = tempCompanyConfig.settings?.admin_fiscal_billing || {};
                                                        setTempCompanyConfig({
                                                            ...tempCompanyConfig,
                                                            settings: {
                                                                ...(tempCompanyConfig.settings || {}),
                                                                admin_fiscal_billing: {
                                                                    ...currentBilling,
                                                                    other: {
                                                                        ...(currentBilling.other || {}),
                                                                        fixed_fee: num
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    placeholder="Ex: 30,00"
                                                />
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight block">
                                                        Valor Adicional por Nota (R$)
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        value={tempCompanyConfig.settings?.admin_fiscal_billing?.other?.per_note_fee ?? 0.50}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const currentBilling = tempCompanyConfig.settings?.admin_fiscal_billing || {};
                                                            setTempCompanyConfig({
                                                                ...tempCompanyConfig,
                                                                settings: {
                                                                    ...(tempCompanyConfig.settings || {}),
                                                                    admin_fiscal_billing: {
                                                                        ...currentBilling,
                                                                        other: {
                                                                            ...(currentBilling.other || {}),
                                                                            per_note_fee: val
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        placeholder="Ex: 0.50"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>



                                {/* Permissions Matrix */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Lock size={18} className="text-orange-500" />
                                        {t('settings.module_access_matrix')}
                                    </h4>
                                    <div className="overflow-x-auto custom-scrollbar border border-gray-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900/50 shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest text-[10px]">{t('settings.module')}</th>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 text-center w-32 uppercase tracking-widest text-[10px]">{t('settings.role_admin')}</th>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 text-center w-32 uppercase tracking-widest text-[10px]">{t('settings.role_member')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                                {APP_MODULES.map((module) => {
                                                    const currentSettings = tempCompanyConfig.settings || {};
                                                    const adminEnabled = getModulePermission(module.key, 'admin', currentSettings);
                                                    const memberEnabled = getModulePermission(module.key, 'member', currentSettings);

                                                    const toggleMod = (role: 'admin' | 'member', value: boolean) => {
                                                        const modules = currentSettings.modules || {};
                                                        setTempCompanyConfig({
                                                            ...tempCompanyConfig,
                                                            settings: {
                                                                ...currentSettings,
                                                                modules: {
                                                                    ...modules,
                                                                    [module.key]: {
                                                                        ...modules[module.key],
                                                                        [role]: value
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    };

                                                    return (
                                                        <tr key={module.key} className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                            <td className="px-6 py-5 text-gray-800 dark:text-gray-300 font-medium leading-none">{module.label}</td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex justify-center">
                                                                    <input type="checkbox" checked={adminEnabled} onChange={(e) => toggleMod('admin', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex justify-center">
                                                                    <input type="checkbox" checked={memberEnabled} onChange={(e) => toggleMod('member', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Tabs Matrix */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <SettingsIcon size={18} className="text-purple-500" />
                                        Matriz de Acesso: Abas de Configuração
                                    </h4>
                                    <div className="overflow-x-auto custom-scrollbar border border-gray-100 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/50 shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest text-[10px]">Aba de Configuração</th>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 text-center w-32 uppercase tracking-widest text-[10px]">Admin</th>
                                                    <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 text-center w-32 uppercase tracking-widest text-[10px]">Membro</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                                                {SETTINGS_TABS.map((tab) => {
                                                    const currentSettings = tempCompanyConfig.settings || {};
                                                    const adminEnabled = getTabPermission(tab.key, 'admin', currentSettings);
                                                    const memberEnabled = getTabPermission(tab.key, 'member', currentSettings);

                                                    const toggleTb = (role: 'admin' | 'member', value: boolean) => {
                                                        const tabs = currentSettings.settings_tabs || {};
                                                        setTempCompanyConfig({
                                                            ...tempCompanyConfig,
                                                            settings: {
                                                                ...currentSettings,
                                                                settings_tabs: {
                                                                    ...tabs,
                                                                    [tab.key]: {
                                                                        ...tabs[tab.key],
                                                                        [role]: value
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    };

                                                    return (
                                                        <tr key={tab.key} className="hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors">
                                                            <td className="px-6 py-5 text-gray-800 dark:text-gray-300 font-medium leading-none">{tab.label}</td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex justify-center">
                                                                    <input type="checkbox" checked={adminEnabled} onChange={(e) => toggleTb('admin', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex justify-center">
                                                                    <input type="checkbox" checked={memberEnabled} onChange={(e) => toggleTb('member', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                                <Button onClick={() => setSelectedCompanyForConfig(null)} variant="ghost">Cancelar</Button>
                                <Button
                                    onClick={async () => {
                                        setSavingConfig(true);
                                        try {
                                            const { error } = await updateCompanyConfig(
                                                tempCompanyConfig.id,
                                                !!tempCompanyConfig.fiscal_module_enabled,
                                                !!tempCompanyConfig.payments_module_enabled,
                                                !!tempCompanyConfig.banking_module_enabled,
                                                !!tempCompanyConfig.crm_module_enabled,
                                                !!tempCompanyConfig.has_social_copilot,
                                                !!tempCompanyConfig.automations_module_enabled,
                                                !!tempCompanyConfig.has_lead_radar,
                                                !!tempCompanyConfig.loyalty_module_enabled,
                                                !!tempCompanyConfig.warranty_module_enabled,
                                                tempCompanyConfig.allowed_entity_types || ['PF', 'PJ'],
                                                tempCompanyConfig.settings || {},
                                                tempCompanyConfig.loyalty_platform_fee || 5,
                                                !!tempCompanyConfig.loyalty_split_enabled
                                            );
                                            if (error) throw new Error(error);

                                            // Atualizar limite de instâncias WhatsApp
                                            const waLimit = Math.max(1, parseInt(tempCompanyConfig.whatsapp_instance_limit) || 1);
                                            const { error: waError } = await supabase.rpc('update_company_whatsapp_limit', {
                                                target_company_id: tempCompanyConfig.id,
                                                new_limit: waLimit
                                            });
                                            if (waError) console.warn('[Config] Erro ao salvar limite de instâncias:', waError.message);

                                            // Se for a empresa atual, atualiza o contexto
                                            if (tempCompanyConfig.id === currentEntity?.id) {
                                                refreshEntity();
                                            }
                                            setSelectedCompanyForConfig(null);
                                        } catch (err: any) {
                                            alert('Erro ao salvar: ' + err.message);
                                        } finally {
                                            setSavingConfig(false);
                                        }
                                    }}
                                    isLoading={savingConfig}
                                    variant="primary"
                                >
                                    Salvar Alterações
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Per-User Config Modal */}
                {selectedUserForConfig && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurar Usuário</h2>
                                        <p className="text-sm text-gray-500">{selectedUserForConfig.full_name} • {selectedUserForConfig.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedUserForConfig(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-6">
                                {/* Isenção de Faturamento (VIP) */}
                                <div className="p-4 rounded-xl border-2 border-emerald-100 dark:border-emerald-900/10 bg-emerald-50/20 dark:bg-emerald-900/10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                                <Shield size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">VIP / Isento de Faturamento</h4>
                                                <p className="text-sm text-gray-500">Este usuário não será cobrado pela plataforma.</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer scale-90">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!selectedUserForConfig.settings?.billing_exempt}
                                                onChange={async (e) => {
                                                    const newVal = e.target.checked;
                                                    const newSettings = { ...(selectedUserForConfig.settings || {}), billing_exempt: newVal };
                                                    const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                    if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                }}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>
                                </div>

                                {/* NOVO: Limites da Empresa (Solicitado pelo usuário) */}
                                <div className="p-4 rounded-xl border-2 border-orange-100 dark:border-orange-900/10 bg-orange-50/20 dark:bg-orange-900/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                                            <Building size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Limite de Gerenciamento</h4>
                                            <p className="text-sm text-gray-500">Defina se este usuário pode cadastrar empresas (PJ) e qual o seu limite.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/20">
                                            <div>
                                                <h5 className="font-bold text-[12px] text-gray-900 dark:text-white leading-tight">Pode Criar Empresas</h5>
                                                <p className="text-[10px] text-gray-400">Permite criar empresas novas como PJ</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer scale-90">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={selectedUserForConfig.settings?.can_create_companies !== false}
                                                    onChange={async (e) => {
                                                        const newVal = e.target.checked;
                                                        const newSettings = { ...(selectedUserForConfig.settings || {}), can_create_companies: newVal };
                                                        const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                        if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                        <div className="flex items-end gap-3 min-w-[140px]">
                                            <Input
                                                label="Limite de Empresas (PJ)"
                                                type="number"
                                                value={selectedUserForConfig.max_companies ?? 1}
                                                onChange={async (e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    const { error } = await updateUserLimit(selectedUserForConfig.id, val);
                                                    if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, max_companies: val });
                                                }}
                                                min="1"
                                                className="h-10 text-center font-bold text-lg"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Modules Matrix */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Acesso aos Módulos (Sidebar)</h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    const currentSettings = selectedUserForConfig.settings || {};
                                                    const newModules = { ...(currentSettings.modules || {}) };
                                                    APP_MODULES.filter(m => !['dashboard', 'companies'].includes(m.key)).forEach(m => {
                                                        newModules[m.key] = { admin: true, member: true };
                                                    });
                                                    const newSettings = { ...currentSettings, modules: newModules };
                                                    const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                    if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase"
                                            >
                                                Marcar Tudo
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={async () => {
                                                    const currentSettings = selectedUserForConfig.settings || {};
                                                    const newModules = { ...(currentSettings.modules || {}) };
                                                    APP_MODULES.filter(m => !['dashboard', 'companies'].includes(m.key)).forEach(m => {
                                                        newModules[m.key] = { admin: false, member: false };
                                                    });
                                                    const newSettings = { ...currentSettings, modules: newModules };
                                                    const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                    if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                }}
                                                className="text-[10px] font-bold text-gray-500 hover:text-gray-600 uppercase"
                                            >
                                                Desmarcar Tudo
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {APP_MODULES.filter(m => !['dashboard', 'companies'].includes(m.key)).map(module => {
                                            const isEnabled = selectedUserForConfig.settings?.modules?.[module.key]?.admin !== false;
                                            return (
                                                <div key={module.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                                                            <module.icon size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{module.label}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer scale-90">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={isEnabled}
                                                            onChange={async (e) => {
                                                                const newVal = e.target.checked;
                                                                const currentSettings = selectedUserForConfig.settings || {};
                                                                const newSettings = {
                                                                    ...currentSettings,
                                                                    modules: {
                                                                        ...(currentSettings.modules || {}),
                                                                        [module.key]: { admin: newVal, member: newVal }
                                                                    }
                                                                };
                                                                
                                                                // Marcar carregando visualmente seria ideal, mas o instant save já dá o feedback
                                                                const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                                if (error) {
                                                                    alert('Erro ao salvar: ' + error);
                                                                } else {
                                                                    setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                                }
                                                            }}
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tabs Matrix */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Abas de Configuração</h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    const currentSettings = selectedUserForConfig.settings || {};
                                                    const newTabs = { ...(currentSettings.settings_tabs || {}) };
                                                    SETTINGS_TABS.filter(t => !['admin', 'permissions'].includes(t.key)).forEach(t => {
                                                        newTabs[t.key] = { admin: true, member: true };
                                                    });
                                                    const newSettings = { ...currentSettings, settings_tabs: newTabs };
                                                    const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                    if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase"
                                            >
                                                Marcar Tudo
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={async () => {
                                                    const currentSettings = selectedUserForConfig.settings || {};
                                                    const newTabs = { ...(currentSettings.settings_tabs || {}) };
                                                    SETTINGS_TABS.filter(t => !['admin', 'permissions'].includes(t.key)).forEach(t => {
                                                        newTabs[t.key] = { admin: false, member: false };
                                                    });
                                                    const newSettings = { ...currentSettings, settings_tabs: newTabs };
                                                    const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                    if (!error) setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                }}
                                                className="text-[10px] font-bold text-gray-500 hover:text-gray-600 uppercase"
                                            >
                                                Desmarcar Tudo
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {SETTINGS_TABS.filter(t => !['admin', 'permissions'].includes(t.key)).map(tab => {
                                            const isEnabled = selectedUserForConfig.settings?.settings_tabs?.[tab.key]?.admin !== false;
                                            return (
                                                <div key={tab.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                                                            <tab.icon size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{tab.label}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer scale-90">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={isEnabled}
                                                            onChange={async (e) => {
                                                                const newVal = e.target.checked;
                                                                const currentSettings = selectedUserForConfig.settings || {};
                                                                const newSettings = {
                                                                    ...currentSettings,
                                                                    settings_tabs: {
                                                                        ...(currentSettings.settings_tabs || {}),
                                                                        [tab.key]: { admin: newVal, member: newVal }
                                                                    }
                                                                };
                                                                const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                                if (error) {
                                                                    alert('Erro ao salvar: ' + error);
                                                                } else {
                                                                    setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                                }
                                                            }}
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end">
                                <Button onClick={() => setSelectedUserForConfig(null)} variant="primary">Concluído</Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'admin' && isAdmin && (
                    <div className="space-y-8">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Total Usuários</span>
                                    <Users size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : stats?.total_users || 0}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Registros na plataforma
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Empresas (PJ)</span>
                                    <Building size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : stats?.total_companies || 0}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Contas corporativas
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Volume Processado</span>
                                    <DollarSign size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(stats?.total_revenue || 0)}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Total de vendas (Recebidas)
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Comissão Plataforma</span>
                                    <Wallet size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(stats?.total_commission || 0)}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Sua receita estimada
                                </div>
                            </div>
                        </div>

                        {/* Admin Sub-tabs */}
                        <div className="flex gap-2 p-2 bg-gray-100/50 dark:bg-slate-900/50 rounded-xl mb-6">
                            {[
                                { id: 'companies', label: 'Empresas', icon: Building },
                                { id: 'users', label: 'Usuários', icon: Users },
                                { id: 'invoices', label: 'Faturas de Cobrança', icon: CreditCard },
                                { id: 'billing', label: 'Faturamento Fiscal', icon: Receipt },
                                { id: 'system', label: 'Sistema', icon: SettingsIcon },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setAdminSubTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-200 ${adminSubTab === tab.id
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <tab.icon size={18} />
                                    <span className="text-sm font-semibold">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Admin Sections */}
                        {adminSubTab === 'users' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Movimento de Usuários</h3>
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()} isLoading={adminLoading}>
                                        <RefreshCw size={16} className={adminLoading ? 'animate-spin' : ''} />
                                    </Button>
                                </div>

                                <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/50 dark:bg-slate-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider border-b border-gray-100 dark:border-slate-700">
                                            <tr>
                                                <th className="px-5 py-4">Usuário / Email</th>
                                                <th className="px-5 py-4">Tipo</th>
                                                <th className="px-5 py-4 text-center">Config</th>
                                                <th className="px-5 py-4 text-center">Atividades</th>
                                                <th className="px-5 py-4 text-center">Status</th>
                                                <th className="px-5 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                            {adminLoading ? (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Carregando dados...</td>
                                                </tr>
                                            ) : usersList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum usuário encontrado.</td>
                                                </tr>
                                            ) : (
                                                usersList.map((u) => {
                                                    const isBlocked = u.status === 'blocked';
                                                    return (
                                                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-full ${isBlocked ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                        <Users size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`font-medium ${isBlocked ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{u.full_name || 'Sem nome'}</div>
                                                                            {u.settings?.billing_exempt && (
                                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-tighter">
                                                                                    Isento
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${u.user_type === 'PJ' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                                                                    {u.user_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{u.max_companies ?? 1}</span>
                                                                    <Tooltip content="Configurar Usuário">
                                                                        <button onClick={() => setSelectedUserForConfig(u)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-blue-500">
                                                                            <Lock size={14} />
                                                                        </button>
                                                                    </Tooltip>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 text-center">
                                                                <div className="flex flex-col text-[10px] text-gray-500 font-medium">
                                                                    <span>{u.quotes_count || 0} Orçamentos</span>
                                                                    <span>{u.transactions_count || 0} Transações</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={!isBlocked}
                                                                        onChange={() => toggleUserBan(u.id, !isBlocked)}
                                                                    />
                                                                    <div className="w-11 h-6 bg-red-500 peer-focus:outline-none rounded-full peer dark:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                                                </label>
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                <button onClick={() => { if (confirm('Excluir usuário?')) deleteUser(u.id); }} className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors group">
                                                                    <Trash2 size={18} className="transition-transform group-hover:scale-110" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminSubTab === 'companies' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestão de Empresas</h3>
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()} isLoading={adminLoading}>
                                        <RefreshCw size={16} className={adminLoading ? 'animate-spin' : ''} />
                                    </Button>
                                </div>

                                <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/50 dark:bg-slate-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider border-b border-gray-100 dark:border-slate-700">
                                            <tr>
                                                <th className="px-5 py-4">Logo / Empresa</th>
                                                <th className="px-5 py-4 text-center">Responsável</th>
                                                <th className="px-5 py-4 text-center">Plano / Licença</th>
                                                <th className="px-5 py-4 text-center">Faturamento</th>
                                                <th className="px-5 py-4 text-center">Sua Comissão</th>
                                                <th className="px-5 py-4 text-center">Status</th>
                                                <th className="px-5 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                            {adminLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Carregando empresas...</td>
                                                </tr>
                                            ) : companiesList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhuma empresa encontrada.</td>
                                                </tr>
                                            ) : (
                                                companiesList.map((c) => (
                                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-2 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden bg-gray-50 dark:bg-slate-900 flex items-center justify-center flex-shrink-0">
                                                                    {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-contain" /> : <Building className="text-gray-400" size={16} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-bold text-gray-900 dark:text-white text-[12px] leading-tight truncate">{c.trade_name}</div>
                                                                        {c.settings?.billing_exempt && (
                                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-tighter">
                                                                                Isento
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[9px] text-gray-500 font-mono italic truncate">{c.cnpj}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 text-center text-[11px]">
                                                            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[100px]">{c.owner_name}</div>
                                                            <div className="text-gray-400 truncate max-w-[100px]">{c.owner_email}</div>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                                                                    <span className="text-[10px]">M:</span>
                                                                    <span>{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(c.settings?.monthly_fee || 0)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-medium">
                                                                    <span>A:</span>
                                                                    <span>{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(c.settings?.annual_fee || 0)}</span>
                                                                </div>
                                                                {c.license_expires_at && (
                                                                    <div className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${getDaysRemaining(c.license_expires_at)! < 0 ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                        getDaysRemaining(c.license_expires_at)! < 30 ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                                                            'bg-blue-50 text-blue-600 border border-blue-100'
                                                                        }`}>
                                                                        Expira {new Date(c.license_expires_at).toLocaleDateString('pt-BR')}
                                                                    </div>
                                                                )}
                                                                <div className="mt-1 flex flex-col items-center gap-1">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${c.subscription_status === 'active' ? 'bg-green-50 text-green-600' :
                                                                        c.subscription_status === 'past_due' ? 'bg-red-50 text-red-600' :
                                                                            'bg-gray-50 text-gray-600'
                                                                        }`}>
                                                                        {c.subscription_status?.toUpperCase() || 'Pendente'}
                                                                    </span>
                                                                    {(() => {
                                                                        const isTrial = c.subscription_plan === 'trial' || c.settings?.subscription_plan === 'trial';
                                                                        const isExpired = isTrial && c.trial_ends_at && new Date(c.trial_ends_at) < new Date();
                                                                        const isBlocked = c.status === 'blocked';
                                                                        
                                                                        if (isBlocked || isExpired) {
                                                                            return (
                                                                                <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-red-600 text-white uppercase animate-pulse">
                                                                                    {isBlocked ? 'Bloqueada' : 'Expirada'}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-bold text-gray-900 dark:text-white text-[12px]">{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(c.total_revenue || 0)}</span>
                                                                <span className="text-[9px] text-gray-500 font-medium tracking-tight whitespace-nowrap">Recebido</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[12px]">{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(c.commission_earned || 0)}</span>
                                                                {c.settings?.commission_rate > 0 && (
                                                                    <span className="text-[9px] text-gray-500 font-medium">{c.settings.commission_rate}% (Geral)</span>
                                                                )}
                                                                {c.settings?.service_commission_rate > 0 && (
                                                                    <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">{c.settings.service_commission_rate}% Serviços</span>
                                                                )}
                                                                {c.settings?.product_commission_rate > 0 && (
                                                                    <span className="text-[9px] text-purple-600 dark:text-purple-400 font-medium">{c.settings.product_commission_rate}% Produtos</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={c.status !== 'blocked'}
                                                                    onChange={() => toggleCompanyBlock(c.id, c.status !== 'blocked')}
                                                                />
                                                                <div className="w-11 h-6 bg-red-500 peer-focus:outline-none rounded-full peer dark:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                                            </label>
                                                        </td>
                                                        <td className="px-2 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <Tooltip content="Gerar Faturamento">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 px-2.5 text-[10px] gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 rounded-lg transition-all"
                                                                        onClick={() => {
                                                                            setSelectedCompanyForInvoice(c);
                                                                            const month = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                                                                            const monthlyFee = c.settings?.monthly_fee || 0;
                                                                            const commissions = c.commission_earned || 0;
                                                                            setInvoiceData({
                                                                                amount: (monthlyFee + commissions).toString(),
                                                                                description: `Mensalidade + Comissões - ${c.trade_name} - ${month} `
                                                                            });
                                                                        }}
                                                                    >
                                                                        <CreditCard size={14} />
                                                                        Faturar
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip content="Configurar Master">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="primary"
                                                                        className="h-8 px-2.5 text-[10px] gap-1.5 rounded-lg shadow-lg shadow-blue-500/10 transition-all"
                                                                        onClick={() => {
                                                                            setSelectedCompanyForConfig(c);
                                                                            setTempCompanyConfig({ ...c });
                                                                        }}
                                                                    >
                                                                        <Shield size={14} />
                                                                        Configurar
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip content="Excluir Empresa">
                                                                    <button
                                                                        onClick={() => { if (confirm(`Deseja realmente EXCLUIR a empresa ${c.trade_name} e TODOS os seus dados permanentemente?`)) deleteCompany(c.id); }}
                                                                        className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors group"
                                                                    >
                                                                        <Trash2 size={18} className="transition-transform group-hover:scale-110" />
                                                                    </button>
                                                                </Tooltip>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminSubTab === 'invoices' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Faturas Geradas</h3>
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()}>
                                        <RefreshCw size={16} />
                                    </Button>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex items-start gap-3">
                                    <Shield className="text-blue-600 mt-0.5" size={18} />
                                    <div className="text-[11px] text-blue-700 dark:text-blue-300">
                                        Estas são faturas geradas por você para as empresas. O pagamento cairá na sua conta Master vinculada.
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-x-auto custom-scrollbar shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/50 dark:bg-slate-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider border-b border-gray-100 dark:border-slate-700">
                                            <tr>
                                                <th className="px-5 py-4">Empresa / Referência</th>
                                                <th className="px-5 py-4 text-center">Valor</th>
                                                <th className="px-5 py-4 text-center">Status</th>
                                                <th className="px-5 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                            {chargesLoading ? (
                                                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Carregando...</td></tr>
                                            ) : recentCharges.length === 0 ? (
                                                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhuma fatura encontrada.</td></tr>
                                            ) : (
                                                recentCharges.map((chg) => (
                                                    <tr key={chg.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-5 py-4">
                                                            <div className="font-bold text-gray-900 dark:text-white leading-tight mb-0.5">{chg.description}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">Ref: {chg.external_reference}</div>
                                                        </td>
                                                        <td className="px-5 py-4 text-center font-bold text-gray-900 dark:text-white">
                                                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(chg.amount)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${chg.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                chg.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    'bg-gray-50 text-gray-600 border-gray-200'
                                                                }`}>
                                                                {chg.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <div className="flex justify-end items-center gap-1">
                                                                <Tooltip content="Copiar Link">
                                                                    <button
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(chg.payment_link || '');
                                                                            alert('Link copiado!');
                                                                        }}
                                                                        className="p-2 hover:bg-blue-50 text-blue-500 rounded-xl transition-all hover:scale-110"
                                                                    >
                                                                        <CreditCard size={18} />
                                                                    </button>
                                                                </Tooltip>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminSubTab === 'system' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configurações Globais do Sistema</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 rounded-xl border-2 border-orange-100 dark:border-orange-900/30 bg-orange-50/20 dark:bg-orange-900/10">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                                                <Shield size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Provedor de Armazenamento</h4>
                                                <p className="text-sm text-gray-500">Escolha onde os arquivos do sistema serão armazenados.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <button
                                                onClick={() => updateAppSettings({ storage_provider: 'supabase' })}
                                                className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${appSettings?.storage_provider === 'supabase'
                                                    ? 'border-orange-500 bg-white dark:bg-slate-800 shadow-md ring-2 ring-orange-100'
                                                    : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 hover:border-gray-300'}`}
                                            >
                                                <span className="font-bold text-gray-900 dark:text-white">Supabase Storage</span>
                                                <span className="text-xs text-gray-500">Padrão do sistema, integrado nativamente.</span>
                                            </button>

                                            <button
                                                onClick={() => updateAppSettings({ storage_provider: 'r2' })}
                                                className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${appSettings?.storage_provider === 'r2'
                                                    ? 'border-orange-500 bg-white dark:bg-slate-800 shadow-md ring-2 ring-orange-100'
                                                    : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 hover:border-gray-300'}`}
                                            >
                                                <span className="font-bold text-gray-900 dark:text-white">Cloudflare R2</span>
                                                <span className="text-xs text-gray-500">Alternativa de baixo custo compatível com S3.</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 border-t border-gray-100 dark:border-slate-800 pt-8">
                                    <LandingPlansEditor />
                                </div>
                            </div>
                        )}

                        {adminSubTab === 'billing' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Receipt className="text-indigo-600 dark:text-indigo-400" />
                                            Faturamento Automático de Emissão Fiscal
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Gerencie cobranças dinâmicas e verifique a integridade dos certificados de todas as empresas integradas.
                                        </p>
                                    </div>
                                </div>

                                {/* Filtros e Configurações */}
                                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 shadow-sm space-y-6">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Configuração da Apuração</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight block">
                                                Data Inicial
                                            </label>
                                            <Input
                                                type="date"
                                                value={billingStartDate}
                                                onChange={(e) => setBillingStartDate(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight block">
                                                Data Final
                                            </label>
                                            <Input
                                                type="date"
                                                value={billingEndDate}
                                                onChange={(e) => setBillingEndDate(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight block">
                                                Instância WhatsApp p/ Envio
                                            </label>
                                            <Input
                                                type="text"
                                                value={whatsappBillingInstance}
                                                onChange={(e) => setWhatsappBillingInstance(e.target.value)}
                                                placeholder="Ex: MinhaInstancia"
                                            />
                                            <p className="text-[10px] text-gray-400">Default: Instância global configurada nas configurações de plataforma.</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end border-t border-gray-100 dark:border-slate-800 pt-4">
                                        <Button
                                            onClick={handleSimulateBilling}
                                            isLoading={billingLoading}
                                            variant="primary"
                                            className="h-11 px-6 font-bold"
                                        >
                                            <RefreshCw size={18} className="mr-2" />
                                            Simular Apuração & Verificar Saúde
                                        </Button>
                                    </div>
                                </div>

                                {/* Resultados da Simulação */}
                                {billingSimulation.length > 0 ? (
                                    <div className="space-y-6">
                                        <div className="overflow-x-auto border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                                                    <tr>
                                                        <th className="px-6 py-4 w-12 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                checked={selectedBillingCompanyIds.length > 0 && selectedBillingCompanyIds.length === uniqueCompaniesWithSuggested.length}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedBillingCompanyIds(uniqueCompaniesWithSuggested);
                                                                    } else {
                                                                        setSelectedBillingCompanyIds([]);
                                                                    }
                                                                }}
                                                            />
                                                        </th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px]">Empresa / CNPJ</th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px] text-center">Emissor / Saúde</th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px] text-center">Notas Emitidas</th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px] text-center">Canceladas</th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px] text-right">Taxa Fixa</th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px] text-right">Taxa/Nota</th>
                                                        <th className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px] text-right">Total Sugerido</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                                                    {billingSimulation.map((sim) => {
                                                        const isSelected = selectedBillingCompanyIds.includes(sim.companyId);
                                                        const isHealthOk = sim.issuerStatus.includes('✅');
                                                        const isNoConfig = sim.issuerStatus.includes('❌');
                                                        
                                                        return (
                                                            <tr key={`${sim.companyId}_${sim.provider}`} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                                <td className="px-6 py-4 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        checked={isSelected}
                                                                        disabled={sim.totalSuggested <= 0}
                                                                        onChange={() => {
                                                                            if (isSelected) {
                                                                                setSelectedBillingCompanyIds(prev => prev.filter(id => id !== sim.companyId));
                                                                            } else {
                                                                                setSelectedBillingCompanyIds(prev => [...prev, sim.companyId]);
                                                                            }
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-bold text-gray-900 dark:text-white">{sim.tradeName}</div>
                                                                        {sim.isExempt && (
                                                                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                                                                                Isento
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-0.5">{sim.cnpj}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full inline-block ${sim.isActiveProvider ? 'bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-550 dark:text-gray-400'}`}>
                                                                        {sim.provider.toUpperCase()}
                                                                        {!sim.isActiveProvider && ' (INATIVO)'}
                                                                    </span>
                                                                    <div className={`text-xs mt-1 font-medium ${isHealthOk ? 'text-emerald-600' : isNoConfig ? 'text-red-600' : 'text-amber-600'}`}>
                                                                        {sim.issuerStatus}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <button
                                                                        onClick={() => handleFetchNotesDetails(sim)}
                                                                        className={`font-bold hover:underline transition-all ${sim.notesCount > 0 ? 'text-indigo-600 dark:text-indigo-400 cursor-pointer' : 'text-gray-450 dark:text-slate-650 cursor-default'}`}
                                                                        disabled={sim.notesCount === 0}
                                                                    >
                                                                        {sim.notesCount}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <button
                                                                        onClick={() => handleFetchNotesDetails(sim)}
                                                                        className={`font-bold hover:underline transition-all ${sim.canceledCount > 0 ? 'text-red-600 cursor-pointer' : 'text-gray-450 dark:text-slate-650 cursor-default'}`}
                                                                        disabled={!sim.canceledCount || sim.canceledCount === 0}
                                                                    >
                                                                        {sim.canceledCount || 0}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-medium text-gray-650 dark:text-gray-300">
                                                                    {sim.isExempt ? (
                                                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/35 px-2 py-0.5 rounded">Isento</span>
                                                                    ) : (
                                                                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.fixedFee || 0)
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-medium text-gray-650 dark:text-gray-300">
                                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.perNoteFee)}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.totalSuggested)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Painel de Confirmação de Cobrança em Lote */}
                                        <div className="p-6 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-900/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Resumo do Lote Selecionado</h4>
                                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                                                    <span>Empresas selecionadas: <strong className="text-gray-900 dark:text-white">{selectedBillingCompanyIds.length}</strong></span>
                                                    <span>•</span>
                                                    <span>Total de notas: <strong className="text-gray-900 dark:text-white">{billingSimulation.filter(s => selectedBillingCompanyIds.includes(s.companyId)).reduce((acc, cur) => acc + cur.notesCount + (cur.canceledCount || 0), 0)}</strong></span>
                                                    <span>•</span>
                                                    <span>Valor total estimado: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingSimulation.filter(s => selectedBillingCompanyIds.includes(s.companyId)).reduce((acc, cur) => acc + cur.totalSuggested, 0))}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <Button
                                                    onClick={handleGenerateBatchPDF}
                                                    disabled={selectedBillingCompanyIds.length === 0}
                                                    variant="outline"
                                                    className="h-12 px-6 font-bold text-md border-indigo-200 text-indigo-600 dark:border-indigo-900/50 dark:text-indigo-400"
                                                >
                                                    <FileText size={18} className="mr-2" />
                                                    Gerar PDF do Lote
                                                </Button>

                                                <Button
                                                    onClick={handleProcessBilling}
                                                    disabled={selectedBillingCompanyIds.length === 0}
                                                    isLoading={billingProcessing}
                                                    variant="primary"
                                                    className="h-12 px-8 font-black text-md shadow-lg shadow-indigo-200 dark:shadow-none"
                                                >
                                                    Confirmar & Processar Lote
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    !billingLoading && (
                                        <div className="p-10 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10">
                                            <Receipt size={40} className="mx-auto text-gray-400 mb-3" />
                                            <h4 className="font-bold text-gray-900 dark:text-white">Nenhuma apuração rodada</h4>
                                            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                                                Defina as datas e clique no botão acima para simular a apuração e visualizar a lista de empresas.
                                            </p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'platform_billing' && isAdmin && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faturamento da Plataforma</h1>
                                <p className="text-gray-500">Gestão global de assinaturas, gateways e cobranças de empresas.</p>
                            </div>
                        </div>
                        <PlatformBillingDashboard />
                    </div>
                )}
                    </>
                )}
            </div>

            {/* Modal Gerar Fatura */}
            {
                selectedCompanyForInvoice && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CreditCard className="text-blue-600" size={20} />
                                    Gerar Fatura Admin
                                </h2>
                                <button onClick={() => setSelectedCompanyForInvoice(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">EMPRESA DESTINO</div>
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompanyForInvoice.trade_name}</div>
                                    <div className="text-[10px] text-gray-500">{selectedCompanyForInvoice.cnpj}</div>
                                </div>

                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Detalhamento da Cobrança</div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Mensalidade Fixa:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(selectedCompanyForInvoice.settings?.monthly_fee || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Comissões Acumuladas:</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(selectedCompanyForInvoice.commission_earned || 0)}</span>
                                    </div>
                                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex justify-between text-sm font-bold">
                                        <span className="text-gray-700 dark:text-gray-300">Total Sugerido:</span>
                                        <span className="text-gray-900 dark:text-white">{new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format((selectedCompanyForInvoice.settings?.monthly_fee || 0) + (selectedCompanyForInvoice.commission_earned || 0))}</span>
                                    </div>
                                </div>

                                <CurrencyInput
                                    label={`Valor da Fatura (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})`}
                                    value={parseFloat(invoiceData.amount) || 0}
                                    onChange={(num) => setInvoiceData({ ...invoiceData, amount: num.toString() })}
                                    placeholder="0,00"
                                />

                                <Input
                                    label="Descrição / Referência"
                                    value={invoiceData.description}
                                    onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
                                    placeholder="Ex: Mensalidade Fevereiro/2024"
                                />

                                <div className="pt-4 flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => setSelectedCompanyForInvoice(null)}>Cancelar</Button>
                                    <Button className="flex-1" onClick={handleGenerateInvoice} isLoading={generatingInvoice}>Gerar Link</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Edição de Automações */}
            {
                editingAutomation && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Edit className="text-blue-600" size={20} />
                                    {editingAutomation === 'financial' && 'Configurar Resumo Financeiro'}
                                    {editingAutomation === 'birthday' && 'Configurar Lembrete de Aniversário'}
                                    {editingAutomation === 'overdue' && 'Configurar Aviso de Vencimento'}
                                </h2>
                                <button onClick={() => setEditingAutomation(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                                Prompt da Vara Mágica (O que quer destacar?)
                                            </label>
                                            <Input
                                                value={
                                                    editingAutomation === 'financial' ? autoFinancialPrompt :
                                                        editingAutomation === 'birthday' ? autoBirthdayPrompt :
                                                            autoOverduePrompt
                                                }
                                                onChange={(e) => {
                                                    if (editingAutomation === 'financial') setAutoFinancialPrompt(e.target.value);
                                                    if (editingAutomation === 'birthday') setAutoBirthdayPrompt(e.target.value);
                                                    if (editingAutomation === 'overdue') setAutoOverduePrompt(e.target.value);
                                                }}
                                                placeholder="Ex: Foque no saldo previsto e seja motivador..."
                                                className="h-10"
                                            />
                                            <p className="text-xs text-blue-500 mt-2 cursor-pointer hover:underline font-medium flex items-center gap-1"
                                                onClick={() => {
                                                    const suggestion = getRandomSuggestion(editingAutomation!);
                                                    if (editingAutomation === 'financial') setAutoFinancialPrompt(suggestion);
                                                    if (editingAutomation === 'birthday') setAutoBirthdayPrompt(suggestion);
                                                    if (editingAutomation === 'overdue') setAutoOverduePrompt(suggestion);
                                                }}>
                                                <Sparkles size={12} />
                                                Outra sugestão? Clique aqui para alternar.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => handleMagic(editingAutomation!,
                                                editingAutomation === 'financial' ? autoFinancialPrompt :
                                                    editingAutomation === 'birthday' ? autoBirthdayPrompt :
                                                        autoOverduePrompt
                                            )}
                                            isLoading={generatingMagic === editingAutomation}
                                            variant="outline"
                                            className="h-10"
                                        >
                                            <Sparkles size={16} className="mr-2" />
                                            Vara Mágica
                                        </Button>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                            Modelo da Mensagem (Customizado)
                                        </label>
                                        <p className="text-[10px] text-gray-500 mb-2">Use {'{name}'} para o nome do cliente e {'{amount}'} para valores.</p>
                                        <textarea
                                            value={
                                                editingAutomation === 'financial' ? autoFinancialTemplate :
                                                    editingAutomation === 'birthday' ? autoBirthdayTemplate :
                                                        autoOverdueTemplate
                                            }
                                            onChange={(e) => {
                                                if (editingAutomation === 'financial') setAutoFinancialTemplate(e.target.value);
                                                if (editingAutomation === 'birthday') setAutoBirthdayTemplate(e.target.value);
                                                if (editingAutomation === 'overdue') setAutoOverdueTemplate(e.target.value);
                                            }}
                                            placeholder="Deixe em branco para usar o padrão do sistema..."
                                            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl p-4 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            rows={6}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button
                                        variant="primary"
                                        className="w-full h-12 text-md font-bold"
                                        onClick={() => setEditingAutomation(null)}
                                    >
                                        Confirmar Edição
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Detalhamento de Notas */}
            {showNotesModal && selectedCompanyNotesMetadata && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                                    Detalhamento de Notas
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Empresa: <strong className="text-gray-700 dark:text-gray-300">{selectedCompanyNotesMetadata.tradeName}</strong> | 
                                    CNPJ: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedCompanyNotesMetadata.cnpj}</span> | 
                                    Emissor: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedCompanyNotesMetadata.provider.toUpperCase()}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {!companyNotesLoading && selectedCompanyNotes.length > 0 && (
                                    <Button
                                        onClick={handleGeneratePDF}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm transition-all"
                                    >
                                        <Download size={16} />
                                        Gerar PDF
                                    </Button>
                                )}
                                <button onClick={() => setShowNotesModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 min-h-0">
                            {companyNotesLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <RefreshCw className="animate-spin text-indigo-600 dark:text-indigo-400" size={36} />
                                    <span className="text-sm text-gray-500 font-medium">Carregando movimentações...</span>
                                </div>
                            ) : selectedCompanyNotes.length === 0 ? (
                                <div className="text-center py-12 space-y-3">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400">
                                        <FileText size={24} />
                                    </div>
                                    <h3 className="text-md font-bold text-gray-900 dark:text-white">Nenhuma nota encontrada</h3>
                                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                        Não foram encontradas notas fiscais emitidas ou canceladas por este emissor no período selecionado.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-150 dark:border-slate-700 rounded-xl">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Data e Hora</th>
                                                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Identificação</th>
                                                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Cliente</th>
                                                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                            {selectedCompanyNotes.map((inv) => {
                                                const statusLower = String(inv.status).toLowerCase();
                                                const isCanceled = ['cancelada', 'cancelado', 'canceled', 'rejeitada', 'rejeitado', 'error', 'failed', 'falha'].includes(statusLower);
                                                const isSuccess = ['autorizada', 'concluida', 'concluido', 'processando', 'emissao_sucesso', 'sucesso', 'emitida', 'sent', 'approved', 'done'].includes(statusLower);
                                                
                                                return (
                                                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                                        <td className="px-4 py-3 whitespace-nowrap text-gray-650 dark:text-gray-300">
                                                            {new Date(inv.created_at).toLocaleString('pt-BR', { timeZone: 'UTC' })}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                                                            {inv.ident}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[220px] truncate" title={inv.clientName}>
                                                            {inv.clientName}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                                                                isCanceled 
                                                                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600' 
                                                                    : isSuccess 
                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' 
                                                                        : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'
                                                            }`}>
                                                                {inv.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.valor || 0)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer (Financial Breakdown) */}
                        <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-150 dark:border-slate-700 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mensalidade Fixa</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {selectedCompanyNotesMetadata.isExempt ? (
                                            <span className="text-emerald-600 dark:text-emerald-400">Isento</span>
                                        ) : (
                                            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCompanyNotesMetadata.fixedFee || 0)
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1 border-y sm:border-y-0 sm:border-x border-gray-100 dark:border-slate-700 py-2 sm:py-0 sm:px-4">
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        Custo por Notas ({selectedCompanyNotesMetadata.notesCount + (selectedCompanyNotesMetadata.canceledCount || 0)})
                                    </div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCompanyNotesMetadata.notesCost)}
                                        <span className="text-[10px] text-gray-400 font-normal ml-1">
                                            ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCompanyNotesMetadata.perNoteFee)}/un)
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1 sm:pl-2">
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Custo Total Sugerido</div>
                                    <div className="text-sm font-extrabold text-indigo-650 dark:text-indigo-400">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCompanyNotesMetadata.totalSuggested)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowNotesModal(false)}
                                    className="px-6 py-2.5 rounded-xl text-sm"
                                >
                                    Fechar
                                </Button>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div >
    );
}