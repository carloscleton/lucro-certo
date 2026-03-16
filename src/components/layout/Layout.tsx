import { useState, useEffect } from 'react';
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
    DollarSign,
    Bell,
    Users,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
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

export function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { signOut, user, profile } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { currentEntity, availableEntities, switchEntity, isLoading } = useEntity();
    const { t } = useTranslation();

    // Browser push notifications for due bills
    useBillNotifications();

    const navigate = useNavigate();
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);

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
    const isSystemAdmin = user?.email === 'carloscleton.nat@gmail.com';
    const userRole = currentEntity.role || 'member';

    // Permission Logic
    const settings = currentEntity.settings || {};

    // Filter Logic
    const displayedNavItems = APP_MODULES.filter(item => {
        // Exclude management items that go into the administrative submenu
        const isManagementItem = ['commissions', 'settings'].includes(item.key);
        if (currentEntity.type === 'company' && isManagementItem) return false;

        const isSuper = userRole === 'owner' || isSystemAdmin;

        // 1. Company Feature Flags Check
        if (currentEntity.type === 'company') {
            // CRM
            if (item.key === 'crm' && !currentEntity.crm_module_enabled && !isSuper) return false;
            // Marketing
            if (item.key === 'marketing' && !currentEntity.has_social_copilot && !isSuper) return false;
            // Lead Radar
            if (item.key === 'lead_radar' && !currentEntity.has_lead_radar && !isSuper) return false;

            // 2. Role-based Permission Check
            if (isSuper) return true;
            return getModulePermission(item.key, userRole as 'admin' | 'member', settings);
        }

        // 3. Fallback/Personal View (Role permissions handled later in finalNavItems)
        return true;
    });

    const finalNavItems = currentEntity.type === 'personal'
        ? displayedNavItems.filter(item => {
            // Bypass for System Admin - they see everything in personal context
            if (isSystemAdmin) return true;

            // Basic items always allowed in personal view
            if (['dashboard', 'companies'].includes(item.key)) return true;

            // Check if module is allowed in personal settings (treat as admin)
            return getModulePermission(item.key, 'admin', settings);
        })
        : displayedNavItems;

    // Management items for the sidebar group (Comissões, Configurações)
    const managementItems = [
        { label: t('nav.commissions'), icon: DollarSign, path: '/dashboard/commissions', key: 'commissions' },
        { label: t('nav.settings'), icon: Settings, path: '/dashboard/settings', key: 'settings' },
    ].filter(item => {
        if (currentEntity.type !== 'company') return false; // Handled in main nav for personal

        // Owner/SystemAdmin see everything by default
        if (userRole === 'owner' || isSystemAdmin) return true;

        return getModulePermission(item.key, userRole as 'admin' | 'member', settings);
    });

    const canSeeManagementGroup = currentEntity.type === 'company' && (managementItems.length > 0 || isSystemAdmin);

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

                    <div className={styles.contextSection} data-tour="entity-selector">
                        <div className={styles.entitySelectWrapper}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('layout.current_environment')}</span>
                                <div className={`${styles.entityBadge} ${currentEntity.type === 'personal' ? styles.badgePersonal : styles.badgeCompany}`}>
                                    {currentEntity.type === 'personal' ? t('layout.personal_label') : t('layout.company_label')}
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={currentEntity.type === 'personal' ? 'personal' : currentEntity.id}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const entity = availableEntities.find(ent =>
                                            value === 'personal' ? ent.type === 'personal' : ent.id === value
                                        );
                                        if (entity) switchEntity(entity);
                                    }}
                                    className="w-full pl-3 pr-8 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
                                    disabled={isLoading}
                                >
                                    {availableEntities.map((entity) => (
                                        <option
                                            key={entity.type === 'personal' ? 'personal' : entity.id}
                                            value={entity.type === 'personal' ? 'personal' : entity.id}
                                        >
                                            {entity.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                    <Briefcase className="w-4 h-4 text-gray-500" />
                                </div>
                            </div>
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
                                            <Settings size={20} />
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
                                <div className="mt-6 p-5 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-700">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {t('login.contact_support')}
                                    </p>
                                </div>
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
                    ) : (currentEntity.status === 'blocked' || ['past_due', 'unpaid'].includes(currentEntity.subscription_status || '')) ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center animate-pulse">
                                <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="max-w-md">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    {currentEntity.subscription_status === 'unpaid'
                                        ? `Bem-vindo, ${profile?.full_name?.split(' ')[0] || ''}! ✨`
                                        : `${currentEntity.name} ${t('common.status')}: Bloqueada`}
                                </h2>
                                <p className="text-gray-600 dark:text-gray-300 font-medium">
                                    {currentEntity.subscription_status === 'past_due'
                                        ? "O acesso foi suspenso devido a pendências financeiras."
                                        : currentEntity.subscription_status === 'unpaid'
                                            ? "Sua conta foi criada com sucesso! Para começar a usar o Lucro Certo, conclua a ativação da sua assinatura."
                                            : "O acesso a esta empresa está temporariamente suspenso pela administração."}
                                </p>
                                <div className="mt-6 p-5 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-700">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {['past_due', 'unpaid'].includes(currentEntity.subscription_status || '')
                                            ? "Ao clicar no botão abaixo, você será redirecionado para concluir o pagamento de forma segura."
                                            : "Selecione outro ambiente na barra lateral ou contate o administrador."}
                                    </p>
                                </div>
                                {['past_due', 'unpaid'].includes(currentEntity.subscription_status || '') && (
                                    <div className="mt-8 flex justify-center">
                                        <Button
                                            onClick={async () => {
                                                try {
                                                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                                                    const res = await supabase.functions.invoke('platform-checkout', {
                                                        body: { company_id: currentEntity.id },
                                                        headers: {
                                                            Authorization: `Bearer ${currentSession?.access_token}`
                                                        }
                                                    });
                                                    if (res.error) throw res.error;
                                                    if (res.data?.paymentUrl) {
                                                        window.location.href = res.data.paymentUrl;
                                                    } else {
                                                        throw new Error('Falha ao gerar link. Contate o suporte.');
                                                    }
                                                } catch (err: any) {
                                                    alert(err.message || 'Erro ao gerar pagamento.');
                                                }
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                                        >
                                            <DollarSign size={20} />
                                            {currentEntity.subscription_status === 'unpaid' ? 'Concluir Assinatura' : 'Regularizar Pagamento'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Outlet />
                    )}
                </div>
            </main>
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
