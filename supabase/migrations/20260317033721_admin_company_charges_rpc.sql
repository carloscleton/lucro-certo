-- Function to get company charges by admin
CREATE Or REPLACE FUNCTION public.get_admin_company_charges(target_company_id UUID)
RETURNS TABLE (
    id UUID,
    provider VARCHAR(50),
    amount DECIMAL(10,2),
    description TEXT,
    payment_method VARCHAR(50),
    status VARCHAR(20),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is the super admin
    IF auth.email() != 'carloscleton.nat@gmail.com' THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT 
        cc.id,
        cc.provider,
        cc.amount,
        cc.description,
        cc.payment_method,
        cc.status,
        cc.paid_at,
        cc.created_at
    FROM public.company_charges cc
    WHERE cc.company_id = target_company_id
    ORDER BY cc.created_at DESC;
END;
$$;
