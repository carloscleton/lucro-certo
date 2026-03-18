import {
    LayoutDashboard,
    ArrowDownCircle,
    ArrowUpCircle,
    Wallet,
    Briefcase,
    Users,
    Package,
    Box,
    FileText,
    DollarSign,
    Settings,
    Lock,
    MessageSquare,
    CreditCard,
    Sparkles,
    Target,
    Rocket,
    BarChart3,
    Percent,
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
        path: '/dashboard',
        desc: 'Visão geral e gráficos',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'quotes',
        label: 'Orçamentos',
        icon: FileText,
        path: '/dashboard/quotes',
        desc: 'Propostas comerciais',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'receivables',
        label: 'A Receber',
        icon: ArrowUpCircle,
        path: '/dashboard/receivables',
        desc: 'Faturamento e receitas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'payables',
        label: 'A Pagar',
        icon: ArrowDownCircle,
        path: '/dashboard/payables',
        desc: 'Contas e despesas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'categories',
        label: 'Categorias',
        icon: Wallet,
        path: '/dashboard/categories',
        desc: 'Gestão financeira',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'companies',
        label: 'Empresas',
        icon: Briefcase,
        path: '/dashboard/companies',
        desc: 'Gestão de empresas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'contacts',
        label: 'Contatos',
        icon: Users,
        path: '/dashboard/contacts',
        desc: 'Clientes e fornecedores',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'services',
        label: 'Serviços',
        icon: Package,
        path: '/dashboard/services',
        desc: 'Catálogo de serviços',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'products',
        label: 'Produtos',
        icon: Box,
        path: '/dashboard/products',
        desc: 'Catálogo de produtos',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp (Uso)',
        icon: MessageSquare,
        path: '/dashboard/whatsapp',
        desc: 'Envio de mensagens e chat',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'payments',
        label: 'Pagamentos (Módulo)',
        icon: CreditCard,
        path: '/dashboard/payments',
        desc: 'Gestão de cobranças e links',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'crm',
        label: 'CRM / Funil',
        icon: Rocket,
        path: '/dashboard/crm',
        desc: 'Gestão de leads e funil de vendas',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'marketing',
        label: 'Marketing IA',
        icon: Sparkles,
        path: '/dashboard/marketing',
        desc: 'Geração automática de postagens',
        defaultPermissions: { admin: true, member: true }
    },
    {
        key: 'lead_radar',
        label: 'Radar de Leads',
        icon: Target,
        path: '/dashboard/lead-radar',
        desc: 'Mineração e abordagem automática de clientes',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'commissions',
        label: 'Comissões',
        icon: Percent,
        path: '/dashboard/commissions',
        desc: 'Controle de vendas',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'reports',
        label: 'Relatórios',
        icon: BarChart3,
        path: '/dashboard/reports',
        desc: 'Análises detalhadas',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'settings',
        label: 'Configurações',
        icon: Settings,
        path: '/dashboard/settings',
        desc: 'Sistema e preferências',
        defaultPermissions: { admin: true, member: false }
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
    },
    {
        key: 'automations',
        label: 'Automações',
        icon: Sparkles,
        color: 'blue',
        desc: 'Lembretes e avisos automáticos',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'subscription',
        label: 'Plano e Assinatura',
        icon: CreditCard,
        color: 'blue',
        desc: 'Gestão da sua conta Lucro Certo',
        defaultPermissions: { admin: true, member: false }
    },
    {
        key: 'platform_billing',
        label: 'Gestão da Plataforma',
        icon: DollarSign,
        color: 'emerald',
        desc: 'Faturamento, Gateway e controle de assinantes',
        defaultPermissions: { admin: false, member: false } // Only for Super Admin
    }
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
