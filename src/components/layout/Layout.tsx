import { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Briefcase,
    Menu,
    LogOut,
    X,
    Sun,
    Moon,
    Settings,
    Shield,
    Users,
    Bell,
    ShieldAlert,
    AlertTriangle,
    Activity,
    User,
    Building2,
    ChevronDown
} from 'lucide-react';
import { useRef } from 'react';
import logoFull from '../../assets/logo-full.png';
import styles from './Layout.module.css';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEntity } from '../../context/EntityContext';
import { Button } from '../ui/Button';
import { OnboardingTour } from '../orientation/OnboardingTour';
import { HelpCenter } from '../orientation/HelpCenter';
import { supabase } from '../../lib/supabase';
import { Tooltip } from '../ui/Tooltip';
import { APP_MODULES, getModulePermission } from '../../config/permissions';
import { OfflineBanner } from '../ui/OfflineBanner';
import { LanguageSelector } from '../ui/LanguageSelector';
import { useBillNotifications } from '../../hooks/useBillNotifications';
import { ProfileCompletionModal } from '../orientation/ProfileCompletionModal';

export function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { signOut, user, profile, refreshProfile } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { currentEntity, availableEntities, switchEntity, isLoading } = useEntity();
    const { t } = useTranslation();

    const isIncomplete = profile && (!profile.full_name || !profile.phone);

    // Browser push notifications for due bills
    useBillNotifications();

    const navigate = useNavigate();
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [isEntityMenuOpen, setIsEntityMenuOpen] = useState(false);
    const entityMenuRef = useRef<HTMLDivElement>(null);
    
    // Checkout states
    const [loadingCheckout, setLoadingCheckout] = useState(false);
    const [cpfModalOpen, setCpfModalOpen] = useState(false);
    const [cpfInput, setCpfInput] = useState('');
    const [cpfError, setCpfError] = useState('');
    const [pendingCheckoutCompanyId, setPendingCheckoutCompanyId] = useState<string | null>(null);

    // Checkout Logic
    const executeCheckout = async (companyId: string) => {
        try {
            setLoadingCheckout(true);
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-checkout`;
            const fetchRes = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ company_id: companyId, access_token: freshSession?.access_token })
            });
            const data = await fetchRes.json();
            if (fetchRes.ok && data?.paymentUrl) {
                window.open(data.paymentUrl, '_blank');
            } else {
                console.error('Checkout Error:', data);
                alert('Erro ao gerar link de pagamento: ' + (data.error || 'Erro desconhecido.'));
            }
        } catch (err: any) {
            alert('Falha ao processar checkout: ' + err.message);
        } finally {
            setLoadingCheckout(false);
        }
    };

    const handleCpfConfirm = async () => {
        const cleanCpf = cpfInput.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            setCpfError('CPF inválido. Informe os 11 dígitos.');
            return;
        }
        setCpfError('');
        setCpfModalOpen(false);

        try {
            setLoadingCheckout(true);
            if (pendingCheckoutCompanyId) {
                await supabase
                    .from('companies')
                    .update({ cpf: cleanCpf, entity_type: 'PF' })
                    .eq('id', pendingCheckoutCompanyId);
                const targetId = pendingCheckoutCompanyId;
                setPendingCheckoutCompanyId(null);
                await executeCheckout(targetId);
                return;
            }

            const userName = profile?.full_name || 'Conta Pessoal';
            const { data: createData, error: createError } = await supabase.rpc('create_company', {
                name_input: userName,
                trade_name_input: userName,
                cnpj_input: '',
                entity_type_input: 'PF',
                cpf_input: cleanCpf,
                email_input: profile?.email || '',
                phone_input: profile?.phone || '',
            });

            if (createError || !createData?.success) {
                alert('Erro ao preparar sua conta: ' + (createData?.message || createError?.message || 'Erro ao criar conta.'));
                setLoadingCheckout(false);
                return;
            }
            await executeCheckout(createData.company_id);
        } catch (err: any) {
            alert('Erro: ' + err.message);
            setLoadingCheckout(false);
        }
    };
    const handleUpgrade = () => navigate('/payment-required');


    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (entityMenuRef.current && !entityMenuRef.current.contains(event.target as Node)) {
                setIsEntityMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchInvites = async () => {
            if (!user) return;
            const { data } = await supabase.rpc('get_my_invites');
            if (data && data.length > 0) {
                setPendingInvites(data);
            }
        };
        fetchInvites();
    }, [user]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const [adminOpen, setAdminOpen] = useState(true); // Default to open for visibility
    const isSystemAdmin = user?.email?.toLowerCase() === 'carloscleton.nat@gmail.com';
    // Permission Logic

    // Filter Logic
    // Filter Logic - Check current entity OR any other company for trial status
    const isTrial = useMemo(() => {
        if (isSystemAdmin) return false;
        
        // 1. Check current entity
        if (currentEntity.subscription_plan === 'trial' || currentEntity.settings?.subscription_plan === 'trial' || !!currentEntity.trial_ends_at) return true;
        
        // 2. Check if any available company is on trial
        if (availableEntities.some(ent => ent.subscription_plan === 'trial' || ent.settings?.subscription_plan === 'trial' || !!ent.trial_ends_at)) return true;

        // 3. Robust Fallback: Check profile creation date (7 days)
        if (profile?.created_at) {
            const createdAt = new Date(profile.created_at).getTime();
            const now = Date.now();
            if ((now - createdAt) < (7.5 * 24 * 60 * 60 * 1000)) return true; // 7.5 days buffer
        }

        return false;
    }, [currentEntity, availableEntities, isSystemAdmin, profile]);
    
    // Unified Sidebar Filter
    const finalNavItems = APP_MODULES.filter(item => {
        // 0. Super Admin Bypass: Always see everything
        if (isSystemAdmin) return true;

        // 1. Get settings and role for the current context (Personal Profile or Company)
        const settings = currentEntity.settings || {};
        const role = currentEntity.type === 'personal' ? 'admin' : (currentEntity.role || 'member');
        const roleForMatrix = role === 'owner' ? 'admin' : role;

        // 2. EXPLICIT OVERRIDE: Respect even in Trial
        // If the module is explicitly disabled for this role in settings, return false
        if (settings?.modules?.[item.key]?.[roleForMatrix as 'admin' | 'member'] === false) return false;

        // 3. TRIAL BYPASS: If not explicitly disabled, show everything in trial
        // (Except modules that require a Company ID like CRM, Marketing, Lead Radar and Agenda)
        if (isTrial) {
            if (currentEntity.type === 'personal' && (item.key === 'crm' || item.key === 'marketing' || item.key === 'lead_radar' || item.key === 'agenda')) {
                return false;
            }
            return true;
        }

        // 4. PLAN & FEATURE CHECK (For non-trial users)
        if (currentEntity.type === 'company') {
            const isModuleEnabled = 
                (item.key === 'crm' && currentEntity.crm_module_enabled) ||
                (item.key === 'marketing' && currentEntity.has_social_copilot) ||
                (item.key === 'lead_radar' && currentEntity.has_lead_radar) ||
                (typeof (currentEntity as any)[`${item.key}_module_enabled`] !== 'undefined' ? (currentEntity as any)[`${item.key}_module_enabled`] : true);

            // Owner sees everything unless explicitly disabled (checked above)
            if (!isModuleEnabled && role !== 'owner') return false;
        }

        // 5. DEFAULT PERMISSIONS (Fallback to getModulePermission)
        return getModulePermission(item.key, roleForMatrix as 'admin' | 'member', settings);
    });

    // Management items for the sidebar group (ONLY system tools now)
    const managementItems: any[] = [];
    const canSeeManagementGroup = managementItems.length > 0 || isSystemAdmin;

    const getEntityColor = (entity: any) => {
        if (entity.type === 'personal') return '#10b981'; // Emerald
        const colors = [
            '#3b82f6', // Blue
            '#8b5cf6', // Violet
            '#ec4899', // Pink
            '#f59e0b', // Amber
            '#06b6d4', // Cyan
            '#84cc16', // Lime
            '#f43f5e', // Rose
        ];
        // Use a simple hash of the ID to pick a consistent color
        const id = entity.id || entity.name || '';
        const hash = id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    const currentEntityColor = getEntityColor(currentEntity);

    // Color Mapping (Hex values for CSS Variables)
    const MODULE_COLORS: Record<string, string> = {
        dashboard: '#2563eb', // blue-600
        payables: '#dc2626',  // red-600
        receivables: '#16a34a', // green-600
        categories: '#9333ea', // purple-600
        companies: '#4f46e5', // indigo-600
        contacts: '#0d9488',  // teal-600
        services: '#0891b2',  // cyan-600
        products: '#ea580c',  // orange-600
        quotes: '#db2777',    // pink-600
        commissions: '#ca8a04', // yellow-600
        reports: '#e11d48',   // rose-600
        settings: '#475569',  // slate-600
        whatsapp: '#10b981',  // emerald-500
        payments: '#2563eb', // blue-600
        crm: '#f59e0b',      // amber-500
        agenda: '#0ea5e9',   // sky-500
        marketing: '#f43f5e', // rose-500
        lead_radar: '#8b5cf6', // violet-500
    };

    return (
        <div className={styles.layout}>
            <OnboardingTour />
            <HelpCenter />
            {/* Mobile Overlay */}
            {profile?.status !== 'blocked' && (
                <div
                    className={`${styles.mobileOverlay} ${sidebarOpen ? styles.open : ''}`}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            {profile?.status !== 'blocked' && (
                <aside
                    className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}
                    data-tour="sidebar"
                >
                    <div className={styles.sidebarHeader}>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-md mb-2 w-full flex justify-center border border-gray-100 dark:border-slate-700">
                            <img src={logoFull} alt="Lucro Certo" className="w-full max-w-[280px] h-auto object-contain transition-transform hover:scale-105" />
                        </div>
                        <button
                            className="md:hidden ml-auto p-1 text-gray-500"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className={styles.contextSection} data-tour="entity-selector" ref={entityMenuRef}>
                        <div className={styles.contextDropdown}>
                            <div className="flex items-center justify-between mb-1.5 px-1">
                                <span className={styles.contextSectionLabel}>{t('layout.current_environment')}</span>
                                <div className={`${styles.entityBadge} ${currentEntity.type === 'personal' ? styles.badgePersonal : styles.badgeCompany}`}>
                                    {currentEntity.type === 'personal' ? t('layout.personal_label') : t('layout.company_label')}
                                </div>
                            </div>
                            
                            <button
                                type="button"
                                className={`${styles.contextTrigger} ${isEntityMenuOpen ? styles.contextTriggerOpen : ''}`}
                                onClick={() => setIsEntityMenuOpen(!isEntityMenuOpen)}
                                disabled={isLoading}
                                style={{ '--active-color': currentEntityColor } as React.CSSProperties}
                            >
                                <div className={styles.triggerContent}>
                                    <div 
                                        className={styles.triggerIcon}
                                        style={{ 
                                            color: currentEntityColor, 
                                            backgroundColor: `${currentEntityColor}15` 
                                        }}
                                    >
                                        {currentEntity.type === 'personal' ? (
                                            <User size={18} />
                                        ) : (
                                            <Building2 size={18} />
                                        )}
                                    </div>
                                    <span className={styles.triggerName}>{currentEntity.name}</span>
                                </div>
                                <ChevronDown 
                                    size={16} 
                                    className={`text-gray-400 transition-transform duration-200 ${isEntityMenuOpen ? 'rotate-180' : ''}`} 
                                    style={isEntityMenuOpen ? { color: currentEntityColor } : {}}
                                />
                            </button>

                            {isEntityMenuOpen && (
                                <div className={styles.dropdownMenu}>
                                    {availableEntities.map((entity) => {
                                        const isActive = entity.type === 'personal' 
                                            ? currentEntity.type === 'personal' 
                                            : currentEntity.id === entity.id;
                                        
                                        const entityColor = getEntityColor(entity);
                                        
                                        return (
                                            <button
                                                key={entity.type === 'personal' ? 'personal' : entity.id}
                                                className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                                                onClick={() => {
                                                    switchEntity(entity);
                                                    setIsEntityMenuOpen(false);
                                                }}
                                                style={{ '--item-color': entityColor } as React.CSSProperties}
                                            >
                                                <div 
                                                    className={styles.itemIcon}
                                                    style={isActive ? { backgroundColor: entityColor, color: 'white' } : { color: entityColor, backgroundColor: `${entityColor}10` }}
                                                >
                                                    {entity.type === 'personal' ? (
                                                        <User size={16} />
                                                    ) : (
                                                        <Building2 size={16} />
                                                    )}
                                                </div>
                                                <span 
                                                    className={styles.itemName}
                                                    style={isActive ? { color: entityColor, fontWeight: 700 } : {}}
                                                >
                                                    {entity.name}
                                                </span>
                                                {isActive && (
                                                    <div 
                                                        className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.2)]"
                                                        style={{ backgroundColor: entityColor }}
                                                    ></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <nav className={styles.nav}>
                        {finalNavItems
                            .map((item) => {
                                const color = MODULE_COLORS[item.key] || '#2563eb';
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path || '#'}
                                        className={({ isActive }) =>
                                            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                                        }
                                        style={{ '--hover-color': color } as React.CSSProperties}
                                        data-tour={`nav-${item.key}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <div className={styles.navIcon}>
                                            <item.icon size={20} />
                                        </div>
                                        <span className={styles.navLabel}>{t(`nav.${item.key}`)}</span>
                                    </NavLink>
                                );
                            })}

                        {/* Admin Submenu */}
                        {canSeeManagementGroup && (
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                                <button
                                    onClick={() => setAdminOpen(!adminOpen)}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-all group ${adminOpen
                                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
                                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`${styles.navIcon} ${adminOpen ? 'bg-blue-600 !text-white' : ''}`}>
                                            <Shield size={20} />
                                        </div>
                                        <span className="font-semibold">{t('nav.administrative')}</span>
                                    </div>
                                    {adminOpen ? <ArrowUpCircle size={18} className="text-blue-500" /> : <ArrowDownCircle size={18} className="text-gray-400 group-hover:text-gray-600" />}
                                </button>

                                {adminOpen && (
                                    <div className="mt-1 space-y-1">
                                        {managementItems.map((item) => {
                                            const color = MODULE_COLORS[item.key] || '#2563eb';
                                            return (
                                                <NavLink
                                                    key={item.path}
                                                    to={item.path}
                                                    className={({ isActive }) =>
                                                        `${styles.navItem} ${styles.adminItem} ${isActive ? styles.navItemActive : ''}`
                                                    }
                                                    style={{ '--hover-color': color } as React.CSSProperties}
                                                    onClick={() => setSidebarOpen(false)}
                                                >
                                                    <div className={styles.navIcon}>
                                                        <item.icon size={20} />
                                                    </div>
                                                    <span className={styles.navLabel}>{item.label}</span>
                                                </NavLink>
                                            );
                                        })}

                                        {/* Super Admin Panel Shortcut */}
                                        {isSystemAdmin && (
                                            <NavLink
                                                to="/dashboard/settings?tab=platform_billing"
                                                className={({ isActive }) =>
                                                    `${styles.navItem} ${styles.adminItem} ${isActive ? styles.navItemActive : ''}`
                                                }
                                                style={{ '--hover-color': '#059669' } as React.CSSProperties}
                                                onClick={() => setSidebarOpen(false)}
                                            >
                                                <div className={styles.navIcon}>
                                                    <Activity size={20} />
                                                </div>
                                                <span className={styles.navLabel}>Gestão da Plataforma</span>
                                            </NavLink>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>

                    <div className={styles.userSection} data-tour="user-section">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-gray-900 dark:text-gray-100">
                                {profile?.full_name || t('common.user')}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate -mt-0.5">
                                {user?.email}
                            </p>
                            <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate mt-0.5">
                                {currentEntity.type === 'personal'
                                    ? t('layout.personal_account')
                                    : translateRole(currentEntity.role || 'member', t)}
                            </p>
                        </div>
                        <Tooltip content={t('nav.logout')}>
                            <Button variant="ghost" size="sm" onClick={async () => {
                                await signOut();
                                navigate('/');
                            }}>
                                <LogOut size={18} />
                            </Button>
                        </Tooltip>
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <button
                        className="md:hidden p-2 -ml-2 text-gray-600"
                        onClick={toggleSidebar}
                    >
                        <Menu size={24} />
                    </button>
                    <img src={logoFull} alt="Lucro Certo" className="h-20 w-auto object-contain md:hidden ml-2" />
                    <div className="hidden md:flex items-center justify-between w-full">
                        {/* Pending Invite Banner */}
                        {pendingInvites.length > 0 && (
                            <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm shadow-md animate-pulse">
                                <Bell size={16} />
                                <span>
                                    {t('layout.pending_invites', { count: pendingInvites.length })}
                                    <span className="font-bold ml-1">{pendingInvites[0].company_name}</span>
                                </span>
                                <button
                                    onClick={() => navigate(`/accept-invite?token=${pendingInvites[0].token}`)}
                                    className="bg-white text-blue-600 px-3 py-0.5 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors ml-2"
                                >
                                    {t('layout.accept_now')}

                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <div className={styles.headerContext}>
                                <div className="flex items-center gap-2">
                                    {currentEntity.type === 'personal' ? (
                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                                            <Users size={16} />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                            {currentEntity.logo_url ? (
                                                <img src={currentEntity.logo_url} alt="" className="w-5 h-5 object-contain" />
                                            ) : (
                                                <Briefcase size={16} />
                                            )}
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <span className={styles.headerContextLabel}>{currentEntity.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`${styles.headerContextType} ${currentEntity.type === 'personal' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'}`}>
                                                {currentEntity.type === 'personal' ? t('layout.personal_context') : t('layout.company_context')}
                                            </span>
                                            {currentEntity.type === 'personal' && (
                                                <button
                                                    onClick={() => navigate('/dashboard/settings?tab=automations')}
                                                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors whitespace-nowrap"
                                                    title="Configurar WhatsApp Pessoal"
                                                >
                                                    <Settings size={10} />
                                                    Configurar WhatsApp
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Unified Trial Banner */}
                            {currentEntity.subscription_plan === 'trial' && currentEntity.trial_ends_at && (
                                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 px-5 py-2.5 rounded-2xl ml-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-500 w-full max-w-4xl">
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="text-xl">🚀</span>
                                        <span className="text-sm font-medium text-blue-800 dark:text-blue-100">
                                            Você está em teste gratuito: <span className="font-bold text-blue-600 dark:text-blue-400">
                                                {(() => {
                                                    const diff = new Date(currentEntity.trial_ends_at!).getTime() - Date.now();
                                                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                    return days > 0 ? `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}` : 'Expirado';
                                                })()}
                                            </span>. Aproveite todas as ferramentas!
                                        </span>
                                    </div>
                                    <button 
                                        onClick={handleUpgrade}
                                        disabled={loadingCheckout}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 whitespace-nowrap disabled:opacity-70"
                                    >
                                        {loadingCheckout ? '...' : 'Assinar Agora →'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1" /> {/* Spacer */}
                        <LanguageSelector />
                        <Tooltip content={t('layout.toggle_theme')}>
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                            >
                                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                            </button>
                        </Tooltip>
                    </div>
                </header>

                <OfflineBanner />
                <div className={styles.content}>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <p className="text-gray-500 animate-pulse">{t('common.loading')}</p>
                        </div>
                    ) : profile?.status === 'blocked' ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center animate-bounce">
                                <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="max-w-md">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    {t('login.access_blocked')}
                                </h2>
                                <p className="text-gray-600 dark:text-gray-300">
                                    {t('login.account_suspended')}
                                </p>
                                <div className="mt-8">
                                    <Button onClick={async () => {
                                        await signOut();
                                        navigate('/');
                                    }} variant="outline" className="flex items-center gap-2 mx-auto">
                                        <LogOut size={18} />
                                        Sair da Conta
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : currentEntity.status === 'blocked' ? (
                        <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center animate-pulse">
                                <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="max-w-md">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    Ambiente Bloqueado
                                </h2>
                                <p className="text-gray-600 dark:text-gray-300 font-medium">
                                    O acesso a esta empresa está temporariamente suspenso pela administração.
                                </p>
                                <div className="mt-8 flex justify-center">
                                    <Button
                                        onClick={async () => { await signOut(); navigate('/'); }}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <LogOut size={18} />
                                        Sair da Conta
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Outlet />
                    )}
                </div>
            </main>
            {/* CPF Modal - Solicita CPF antes do checkout */}
            {cpfModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                <span className="text-xl">📄</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Dados para Pagamento</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Precisamos do seu CPF para gerar o link</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 text-left">
                            Para processar o pagamento como <strong>Pessoa Física</strong>, informe seu CPF abaixo.
                            Ele será usado apenas para identificação no gateway de pagamento.
                        </p>

                        <div className="mb-4 text-left">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                CPF
                            </label>
                            <input
                                type="text"
                                value={cpfInput}
                                onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    let formatted = digits;
                                    if (digits.length > 9) formatted = digits.slice(0,3) + '.' + digits.slice(3,6) + '.' + digits.slice(6,9) + '-' + digits.slice(9);
                                    else if (digits.length > 6) formatted = digits.slice(0,3) + '.' + digits.slice(3,6) + '.' + digits.slice(6);
                                    else if (digits.length > 3) formatted = digits.slice(0,3) + '.' + digits.slice(3);
                                    setCpfInput(formatted);
                                    setCpfError('');
                                }}
                                placeholder="000.000.000-00"
                                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg tracking-widest"
                                autoFocus
                            />
                            {cpfError && (
                                <p className="text-red-500 text-sm mt-1">{cpfError}</p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setCpfModalOpen(false); setPendingCheckoutCompanyId(null); }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCpfConfirm}
                                disabled={loadingCheckout}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-70"
                            >
                                {loadingCheckout ? 'Processando...' : 'Confirmar e Pagar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Profile Completion Modal */}
            {isIncomplete && user && (
                <ProfileCompletionModal 
                    userId={user.id} 
                    onComplete={refreshProfile} 
                />
            )}
        </div>
    );
}

function translateRole(role: string, t: (key: string) => string): string {
    const roles: Record<string, string> = {
        owner: t('layout.role_owner'),
        admin: t('layout.role_admin'),
        member: t('layout.role_member'),
    };
    return roles[role] || role;
}
