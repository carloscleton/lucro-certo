-- Add automations_module_enabled to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS automations_module_enabled BOOLEAN DEFAULT false;

-- Enable it for existing companies that might already be using it (optional)
-- UPDATE companies SET automations_module_enabled = true WHERE settings->>'automation_financial_reminders' = 'true' OR settings->>'automation_birthday_reminders' = 'true';
