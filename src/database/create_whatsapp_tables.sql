-- MODULO WHATSAPP - ESTRUTURA INICIAL 🛡️
-- Criação da tabela de instâncias e configuração de segurança RLS

-- 1. Criar Tabela de Instâncias
CREATE TABLE IF NOT EXISTS public.instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    evolution_instance_id TEXT UNIQUE, -- ID retornado pela Evolution API
    status TEXT DEFAULT 'disconnected', -- disconnected, connecting, connected
    api_key_encrypted TEXT, -- Chave de API criptografada
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança (Usuário Comum)
-- Usuário só vê suas próprias instâncias (pessoais ou da empresa dele)
DROP POLICY IF EXISTS "Usuários podem ver suas próprias instâncias" ON public.instances;
CREATE POLICY "Usuários podem ver suas próprias instâncias"
ON public.instances FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.company_members cm 
        WHERE cm.company_id = instances.company_id 
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias instâncias" ON public.instances;
CREATE POLICY "Usuários podem gerenciar suas próprias instâncias"
ON public.instances FOR ALL
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.company_members cm 
        WHERE cm.company_id = instances.company_id 
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
);

-- 4. Gatilho para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_instances_updated_at
    BEFORE UPDATE ON public.instances
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- FIM DO SCRIPT ✅
