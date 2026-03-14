-- Habilita as extensões necessárias para automação
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Agendamento da mineração automática de leads
-- Executa a cada 1 hora. A lógica interna da função 'lead-radar-miner'
-- filtrará quais empresas realmente precisam minerar baseado em sua 'mining_frequency'.
select cron.schedule(
  'lead-radar-miner-job',
  '0 * * * *', -- No início de cada hora
  $$
  select net.http_post(
    url := 'https://oncddbarrtxalsmzravk.supabase.co/functions/v1/lead-radar-miner',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

comment on column public.company_ai_settings.last_mining_at is 'Data/hora da última execução do radar de leads';
