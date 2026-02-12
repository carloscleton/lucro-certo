-- 1. Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Owners and admins can view payment gateways" ON public.company_payment_gateways;

-- 2. Create a more inclusive SELECT policy for all active members
-- This allows anyone who is an active member of the company to see the gateways
-- configured for that company, so they can use them to generate payment links.
CREATE POLICY "Active members can view payment gateways"
ON public.company_payment_gateways
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_payment_gateways.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);
