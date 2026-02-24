-- Fix: use auth.jwt() instead of auth.users (not accessible in RLS context)
-- Drop old broken policy first
DROP POLICY IF EXISTS "Admin can view all webhooks" ON webhooks;

-- Recreate with auth.jwt() which reads email directly from the JWT token
CREATE POLICY "Admin can view all webhooks"
    ON webhooks FOR SELECT
    USING (
        (auth.jwt() ->> 'email') = 'carloscleton.nat@gmail.com'
    );
