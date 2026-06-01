-- Migration to add Warranty and Technician Assignment to Quote Items
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS warranty_months INTEGER;

-- Comment on new columns to keep database well documented
COMMENT ON COLUMN public.quote_items.assigned_technician_id IS 'ID do perfil do técnico responsável pela execução do serviço';
COMMENT ON COLUMN public.quote_items.warranty_months IS 'Prazo de garantia em meses para o item de serviço';
