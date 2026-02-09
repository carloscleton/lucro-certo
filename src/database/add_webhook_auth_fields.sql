-- Add authentication fields to webhooks table
ALTER TABLE webhooks 
ADD COLUMN IF NOT EXISTS auth_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS auth_password VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN webhooks.auth_username IS 'Username for Basic Auth authentication';
COMMENT ON COLUMN webhooks.auth_password IS 'Password for Basic Auth authentication (stored in plain text - consider encryption for production)';
