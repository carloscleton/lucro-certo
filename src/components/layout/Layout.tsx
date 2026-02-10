import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    Briefcase,
    Menu,
    LogOut,
    X,
    Sun,
    Moon,
    Settings,
    DollarSign,
    Bell
} from 'lucide-react';
import styles from './Layout.module.css';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEntity } from '../../context/EntityContext';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { APP_MODULES, getModulePermission } from '../../config/permissions';

export function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { signOut, user, profile } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { currentEntity, availableEntities, switchEntity, isLoading } = useEntity();

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
        // Exclude items that are managed in the Administrative Submenu below (only in company view)
        const isManagementItem = ['commissions', 'settings'].includes(item.key);
        if (currentEntity.type === 'company' && isManagementItem) return false;

        if (currentEntity.type === 'company' && userRole) {
            // Owner always sees everything
            if (userRole === 'owner') return true;

            // Admin/Member: Check Permission Matrix
            return getModulePermission(item.key, userRole as 'admin' | 'member', settings);
        }
        // Personal View: Show everything by default (filtered later)
        return true;
    });

    const finalNavItems = currentEntity.type === 'personal'
        ? displayedNavItems.filter(item => {
            // Basic items always allowed in personal view
            if (['dashboard', 'companies', 'settings'].includes(item.key)) return true;

            // Check if module is allowed in personal settings (treat as admin)
            return getModulePermission(item.key, 'admin', settings);
        })
        : displayedNavItems;

    // Management items for the sidebar group (Comissões, Configurações)
    const managementItems = [
        { label: 'Comissões', icon: DollarSign, path: '/commissions', key: 'commissions' },
        { label: 'Configurações', icon: Settings, path: '/settings', key: 'settings' },
    ].filter(item => {
        if (currentEntity.type !== 'company') return false; // Handled in main nav for personal
        if (userRole === 'owner') return true;
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
    };

    return (
        <div className={styles.layout}>
            {/* Mobile Overlay */}
            <div
                className={`${styles.mobileOverlay} ${sidebarOpen ? styles.open : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
                <div className={styles.sidebarHeader}>
                    <Wallet className="w-8 h-8 text-blue-600" />
                    <span className={styles.logoText}>Lucro Certo</span>
                    <button
                        className="md:hidden ml-auto p-1 text-gray-500"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="px-4 mb-4">
                    {currentEntity.type === 'company' && currentEntity.logo_url && (
                        <div className="mb-4 flex justify-center">
                            <img
                                src={currentEntity.logo_url}
                                alt={currentEntity.name}
                                className="max-h-24 w-auto object-contain"
                            />
                        </div>
                    )}
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
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <div className={styles.navIcon}>
                                        <item.icon size={20} />
                                    </div>
                                    <span className={styles.navLabel}>{item.label}</span>
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
                                    <span className="font-semibold">Administrativo</span>
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

                <div className={styles.userSection}>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-gray-900 dark:text-gray-100">
                            {profile?.full_name || 'Usuário'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate -mt-0.5">
                            {user?.email}
                        </p>
                        <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate mt-0.5">
                            {currentEntity.type === 'personal'
                                ? 'Conta Pessoal'
                                : translateRole(currentEntity.role || 'member')}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={signOut} title="Sair">
                        <LogOut size={18} />
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            < main className={styles.main} >
                <header className={styles.header}>
                    <button
                        className="md:hidden p-2 -ml-2 text-gray-600"
                        onClick={toggleSidebar}
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="text-lg font-semibold md:hidden">Lucro Certo</h1>
                    <div className="hidden md:flex items-center justify-between w-full">
                        {/* Pending Invite Banner */}
                        {pendingInvites.length > 0 && (
                            <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm shadow-md animate-pulse">
                                <Bell size={16} />
                                <span>
                                    Você tem {pendingInvites.length} convite(s) pendente(s)!
                                    <span className="font-bold ml-1">{pendingInvites[0].company_name}</span>
                                </span>
                                <button
                                    onClick={() => navigate(`/accept-invite?token=${pendingInvites[0].token}`)}
                                    className="bg-white text-blue-600 px-3 py-0.5 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors ml-2"
                                >
                                    Aceitar Agora
                                </button>
                            </div>
                        )}
                        <div className="flex-1" /> {/* Spacer */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                            title="Alternar Tema"
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>
                    </div>
                </header>

                <div className={styles.content}>
                    <Outlet />
                </div>
            </main >
        </div >
    );
}

function translateRole(role: string): string {
    const roles: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        member: 'Membro',
    };
    return roles[role] || role;
}
