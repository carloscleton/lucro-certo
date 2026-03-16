-- Migration adding landing page plans to app_settings
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS landing_plans JSONB DEFAULT '[
    {
        "name": "Essencial",
        "price": "97",
        "period": "mês",
        "features": [
            "Gestão Financeira Completa",
            "CRM até 500 contatos",
            "Relatórios Básicos"
        ],
        "button_text": "Escolher Plano",
        "button_type": "secondary",
        "is_popular": false
    },
    {
        "name": "Profissional + IA",
        "price": "197",
        "period": "mês",
        "features": [
            "Tudo do Essencial",
            "**Radar de Leads (IA)**",
            "**Marketing Copilot (IA)**",
            "WhatsApp Ilimitado"
        ],
        "button_text": "Começar agora",
        "button_type": "primary",
        "is_popular": true
    },
    {
        "name": "Empresarial",
        "price": "497",
        "period": "mês",
        "features": [
            "Tudo do Profissional",
            "Multi-empresas (até 5)",
            "Suporte VIP 24h",
            "API de Integração"
        ],
        "button_text": "Falar com Consultor",
        "button_type": "secondary",
        "is_popular": false
    }
]'::jsonb;
