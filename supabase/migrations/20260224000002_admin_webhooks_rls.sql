-- Add RLS policy allowing the platform admin to view ALL webhooks
-- This is much simpler than using an RPC with SECURITY DEFINER
CREATE POLICY "Admin can view all webhooks"
    ON webhooks FOR SELECT
    USING (
        (SELECT email FROM auth.users WHERE id = auth.uid()) = 'carloscleton.nat@gmail.com'
    );
