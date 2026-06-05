-- Adiciona o campo de ativação do módulo bancário na tabela de empresas
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS banking_module_enabled BOOLEAN DEFAULT false;
COMMENT ON COLUMN public.companies.banking_module_enabled IS 'Indica se o módulo de integrações bancárias e DDA está ativo para esta empresa';

-- Cria tabela de configurações bancárias por empresa
CREATE TABLE IF NOT EXISTS public.company_banking_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'itau_cnab', 'inter_api', 'stark_api', etc.
    is_active BOOLEAN DEFAULT true,
    dda_enabled BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Armazena agência, conta, tokens, etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, provider) -- Apenas uma configuração por banco por empresa
);

-- Habilita RLS
ALTER TABLE public.company_banking_configs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins can view company banking configs"
ON public.company_banking_configs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_banking_configs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);

CREATE POLICY "Admins can manage company banking configs"
ON public.company_banking_configs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_banking_configs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_banking_configs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_company_banking_configs_updated_at
    BEFORE UPDATE ON public.company_banking_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.company_banking_configs IS 'Configurações de contas bancárias e credenciais de DDA/Pagamento por empresa';
COMMENT ON COLUMN public.company_banking_configs.config IS 'Dados estruturados de agência, conta e credenciais de API/CNAB (JSONB)';
