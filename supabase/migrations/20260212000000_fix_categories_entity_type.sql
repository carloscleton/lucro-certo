-- Ensure the column entity_type exists and has a correct check constraint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'entity_type') THEN
        ALTER TABLE public.categories ADD COLUMN entity_type TEXT DEFAULT 'individual';
    END IF;
END $$;

-- Update constraint if it exists (dropping and recreating is safer)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_entity_type_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_entity_type_check CHECK (entity_type IN ('individual', 'company'));

-- Ensure existing rows are not null
UPDATE public.categories SET entity_type = 'individual' WHERE entity_type IS NULL;

-- REBUILD RLS POLICIES FOR CATEGORIES
-- This ensures that all columns (including new ones) are covered and permissions are clear.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

-- SELECT POLICY
CREATE POLICY "Users can view their own categories"
ON public.categories FOR SELECT
TO authenticated
USING (
    (company_id IS NULL AND user_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = categories.company_id
        AND cm.user_id = auth.uid()
    )
);

-- INSERT POLICY
CREATE POLICY "Users can insert their own categories"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (
    (company_id IS NULL AND user_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = categories.company_id
        AND cm.user_id = auth.uid()
    )
);

-- UPDATE POLICY
CREATE POLICY "Users can update their own categories"
ON public.categories FOR UPDATE
TO authenticated
USING (
    (company_id IS NULL AND user_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = categories.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    (company_id IS NULL AND user_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = categories.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- DELETE POLICY
CREATE POLICY "Users can delete their own categories"
ON public.categories FOR DELETE
TO authenticated
USING (
    (company_id IS NULL AND user_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = categories.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);
