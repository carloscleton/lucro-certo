-- Agendamento do Dispatcher de Automações (WhatsApp Reminders)
-- Executa a cada 1 hora para processar agendamentos de todas as empresas
-- Garante que o pg_cron chame a Edge Function automation-dispatcher

SELECT cron.schedule(
  'automation-dispatcher-job',
  '0 * * * *', -- No início de cada hora
  $$
  SELECT net.http_post(
    url := 'https://oncddbarrtxalsmzravk.supabase.co/functions/v1/automation-dispatcher',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

COMMENT ON JOB 'automation-dispatcher-job' IS 'Orquestrador de automações de WhatsApp (Resumo Financeiro, Aniversários, Atrasos)';
