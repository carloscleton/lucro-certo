-- Migração para adicionar controle de auditoria de notas fiscais (emissão e cancelamento)

-- 1. Adicionar colunas de auditoria na tabela fiscal_invoices
ALTER TABLE public.fiscal_invoices
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid();

-- 2. Criar a tabela fiscal_invoice_events
CREATE TABLE IF NOT EXISTS public.fiscal_invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'emissao_solicitada', 'autorizada', 'rejeitada', 'cancelamento_solicitado', 'cancelado', 'erro', 'status_alterado'
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS na tabela de eventos
ALTER TABLE public.fiscal_invoice_events ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS para fiscal_invoice_events
DROP POLICY IF EXISTS "Users can view events of their company invoices" ON public.fiscal_invoice_events;
CREATE POLICY "Users can view events of their company invoices"
ON public.fiscal_invoice_events FOR SELECT
TO authenticated
USING (
    invoice_id IN (
        SELECT id FROM public.fiscal_invoices WHERE company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Users can insert events for their company invoices" ON public.fiscal_invoice_events;
CREATE POLICY "Users can insert events for their company invoices"
ON public.fiscal_invoice_events FOR INSERT
TO authenticated
WITH CHECK (
    invoice_id IN (
        SELECT id FROM public.fiscal_invoices WHERE company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
    )
);

-- 5. Trigger BEFORE INSERT OR UPDATE na tabela fiscal_invoices para preencher automaticamente os campos de auditoria
CREATE OR REPLACE FUNCTION set_fiscal_invoice_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.created_by IS NULL THEN
            NEW.created_by := auth.uid();
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
            IF NEW.cancelled_by IS NULL THEN
                NEW.cancelled_by := auth.uid();
            END IF;
            IF NEW.cancelled_at IS NULL THEN
                NEW.cancelled_at := now();
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_fiscal_invoice_audit_fields ON public.fiscal_invoices;
CREATE TRIGGER trigger_set_fiscal_invoice_audit_fields
BEFORE INSERT OR UPDATE ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION set_fiscal_invoice_audit_fields();

-- 6. Trigger AFTER INSERT OR UPDATE na tabela fiscal_invoices para registrar automaticamente na tabela de eventos (timeline)
CREATE OR REPLACE FUNCTION log_fiscal_invoice_event()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type VARCHAR(50);
    v_description TEXT;
    v_metadata JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_event_type := 'emissao_solicitada';
        v_description := 'A emissão da nota fiscal foi iniciada no sistema.';
        v_metadata := jsonb_build_object(
            'status', NEW.status,
            'type', NEW.type
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Só cria log de evento se o status de fato mudou
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            v_event_type := CASE 
                WHEN NEW.status = 'autorizado' OR NEW.status = 'concluido' THEN 'autorizada'
                WHEN NEW.status = 'erro' OR NEW.status = 'rejeitado' THEN 'rejeitada'
                WHEN NEW.status = 'cancelado' THEN 'cancelado'
                ELSE 'status_alterado'
            END;

            v_description := CASE 
                WHEN NEW.status = 'autorizado' OR NEW.status = 'concluido' THEN 'Nota fiscal autorizada e assinada pela TecnoSpeed.'
                WHEN NEW.status = 'erro' OR NEW.status = 'rejeitado' THEN COALESCE(NEW.error_message, 'Erro no processamento da nota fiscal.')
                WHEN NEW.status = 'cancelado' THEN 'Nota fiscal cancelada com sucesso.'
                ELSE 'Status da nota fiscal alterado para: ' || NEW.status
            END;

            v_metadata := jsonb_build_object(
                'status_anterior', OLD.status,
                'status_novo', NEW.status,
                'error_message', NEW.error_message,
                'cancellation_reason', NEW.cancellation_reason
            );
        ELSE
            -- Status não mudou, nada a fazer
            RETURN NEW;
        END IF;
    END IF;

    -- Inserir o log histórico
    INSERT INTO public.fiscal_invoice_events (invoice_id, user_id, event_type, description, metadata)
    VALUES (
        NEW.id,
        auth.uid(),
        v_event_type,
        v_description,
        v_metadata
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_fiscal_invoice_event ON public.fiscal_invoices;
CREATE TRIGGER trigger_log_fiscal_invoice_event
AFTER INSERT OR UPDATE ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION log_fiscal_invoice_event();
