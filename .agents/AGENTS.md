# Project-Scoped Rules

## Fiscal Providers Independence

- **Independent Implementations**: Keep integrations, payload builders, endpoints, and configurations for different fiscal providers (e.g., TecnoSpeed/PlugNotas, NFe.io, Custom Webhooks, etc.) strictly isolated and independent.
- **No Cross-Impact**: Any modifications, fixes, or settings updates made for one provider must not affect or modify the logic, endpoints, schemas, or behaviors of another provider.
- **Provider-Specific Validation**: Verify changes individually against the specific provider's API specifications without altering global/shared models or general properties unless absolutely necessary and thoroughly tested across all integrations.
