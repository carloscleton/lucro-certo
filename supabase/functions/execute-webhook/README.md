# Supabase Edge Function: execute-webhook

This Edge Function executes webhooks server-side, bypassing CORS issues.

## Deploy

```bash
supabase functions deploy execute-webhook
```

## Environment Variables

The function uses these environment variables (automatically provided by Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Usage

The function is called automatically by the webhook service when triggering webhooks.
