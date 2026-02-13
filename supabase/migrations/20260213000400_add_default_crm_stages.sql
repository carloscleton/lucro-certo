-- Migration to add default CRM stages for existing and future companies
-- Standard Sales Funnel: Lead -> Qualification -> Proposal -> Negotiation -> Closing

DO $$
DECLARE
    comp_record RECORD;
BEGIN
    FOR comp_record IN SELECT id FROM public.companies LOOP
        -- Check if company already has stages
        IF NOT EXISTS (SELECT 1 FROM public.crm_stages WHERE company_id = comp_record.id) THEN
            -- Insert default stages
            INSERT INTO public.crm_stages (company_id, name, color, position)
            VALUES 
                (comp_record.id, 'Lead / Prospecção', '#3b82f6', 0),
                (comp_record.id, 'Qualificação', '#8b5cf6', 1),
                (comp_record.id, 'Proposta Enviada', '#f59e0b', 2),
                (comp_record.id, 'Negociação', '#d946ef', 3),
                (comp_record.id, 'Fechamento', '#10b981', 4);
        END IF;
    END LOOP;
END $$;
