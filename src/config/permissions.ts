import {
    LayoutDashboard,
    ArrowDownCircle,
    ArrowUpCircle,
    Wallet,
    Briefcase,
    PieChart,
    Users,
    Package,
    Box,
    FileText,
    DollarSign,
    Settings,
    Lock,
    MessageSquare,
    CreditCard
} from 'lucide-react';

export interface ModuleDefinition {
    key: string;
    label: string;
    icon?: any;
    path?: string;
    desc?: string;
    defaultPermissions: {
        admin: boolean;
        member: boolean;
    };
}

export interface TabDefinition {
    key: string;
    label: string;
    icon?: any;
    desc?: string;
    color?: string;
    defaultPermissions: {
        admin: boolean;
        member: boolean;
    };
}

export const APP_MODULES: ModuleDefinition[] = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/',
        desc: 'Visão geral e gráficos',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'quotes',
        label: 'Orçamentos',
        icon: FileText,
        path: '/quotes',
        desc: 'Propostas comerciais',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'receivables',
        label: 'A Receber',
        icon: ArrowUpCircle,
        path: '/receivables',
        desc: 'Faturamento e receitas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'payables',
        label: 'A Pagar',
        icon: ArrowDownCircle,
        path: '/payables',
        desc: 'Contas e despesas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'categories',
        label: 'Categorias',
        icon: Wallet,
        path: '/categories',
        desc: 'Gestão financeira',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'companies',
        label: 'Empresas',
        icon: Briefcase,
        path: '/companies',
        desc: 'Gestão de empresas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'contacts',
        label: 'Contatos',
        icon: Users,
        path: '/contacts',
        desc: 'Clientes e fornecedores',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'services',
        label: 'Serviços',
        icon: Package,
        path: '/services',
        desc: 'Catálogo de serviços',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'products',
        label: 'Produtos',
        icon: Box,
        path: '/products',
        desc: 'Catálogo de produtos',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'commissions',
        label: 'Comissões',
        icon: DollarSign,
        path: '/commissions',
        desc: 'Controle de vendas',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'reports',
        label: 'Relatórios',
        icon: PieChart,
        path: '/reports',
        desc: 'Análises detalhadas',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'settings',
        label: 'Configurações',
        icon: Settings,
        path: '/settings',
        desc: 'Sistema e preferências',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp (Uso)',
        icon: MessageSquare,
        path: '/whatsapp',
        desc: 'Envio de mensagens e chat',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'payments',
        label: 'Pagamentos (Módulo)',
        icon: CreditCard,
        path: '/payments',
        desc: 'Gestão de cobranças e links',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'crm',
        label: 'CRM / Funil',
        icon: Users,
        path: '/crm',
        desc: 'Gestão de leads e funil de vendas',
        defaultPermissions: { admin: true, member: true }
    }
];

export const SETTINGS_TABS: TabDefinition[] = [
    {
        key: 'quotes',
        label: 'Orçamentos',
        icon: FileText,
        color: 'blue',
        desc: 'Validade e termos',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'financial',
        label: 'Financeiro',
        icon: Wallet,
        color: 'blue',
        desc: 'Taxas e comissões',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'team',
        label: 'Time',
        icon: Users,
        color: 'blue',
        desc: 'Convites e gestão',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'webhooks',
        label: 'Webhooks',
        icon: Settings,
        color: 'purple',
        desc: 'Integrações externas',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'permissions',
        label: 'Permissões',
        icon: Lock,
        color: 'orange',
        desc: 'Controle de acesso',
        defaultPermissions: { admin: false, member: false }
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp (Configuração)',
        icon: MessageSquare,
        color: 'green',
        desc: 'Tokens e conexão com servidor',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'payments',
        label: 'Pagamentos (Configuração)',
        icon: CreditCard,
        color: 'emerald',
        desc: 'Chaves de API e Gateways',
        defaultPermissions: { admin: true, member: false }
    }
    // Admin tab is special, handled separately usually, but good to list if needed
];

export function getModulePermission(
    moduleKey: string,
    role: 'admin' | 'member',
    settings: any // Company settings
): boolean {
    const moduleDef = APP_MODULES.find(m => m.key === moduleKey);
    const defaultPerm = moduleDef?.defaultPermissions[role] ?? false;

    // Explicit setting > Default
    return settings?.modules?.[moduleKey]?.[role] ?? defaultPerm;
}

export function getTabPermission(
    tabKey: string,
    role: 'admin' | 'member',
    settings: any // Company settings
): boolean {
    const tabDef = SETTINGS_TABS.find(t => t.key === tabKey);
    const defaultPerm = tabDef?.defaultPermissions[role] ?? false;

    // Explicit setting > Default
    return settings?.settings_tabs?.[tabKey]?.[role] ?? defaultPerm;
}
