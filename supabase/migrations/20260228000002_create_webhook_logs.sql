CREATE TABLE evo_webhook_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  payload jsonb
);
