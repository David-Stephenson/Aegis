# Aegis

SvelteKit application that authenticates users with Authentik, resolves the caller's public IP, and updates Caddy allowlists through the Caddy Admin API.

## What it does

- Sign-in via Authentik (OIDC).
- Map Authentik groups to allowed services via app-side policy.
- Allowlist or revoke the current client IP for permitted services.
- Persist state and audit history in SQLite.
- Expose an admin audit view for users in the `admin` group.

## Prerequisites

- Node.js 20+
- Caddy with Admin API enabled
- Authentik configured as OIDC provider

## Environment

Copy `.env.example` to `.env` and set values:

- `AUTH_SECRET`
- `AUTH_AUTHENTIK_ISSUER`
- `AUTH_AUTHENTIK_CLIENT_ID`
- `AUTH_AUTHENTIK_CLIENT_SECRET`
- `AUTHENTIK_API_BASE_URL`
- `AUTHENTIK_API_TOKEN`
- `CADDY_API_BASE_URL`
- `CADDY_API_TOKEN`
- `TRUSTED_PROXY_CIDRS`
- `DB_PATH`
- `GROUP_SERVICE_MAP_JSON`

`AUTHENTIK_API_TOKEN` should be a read-only token that can list users from the Authentik admin API.

### Group and service config

`GROUP_SERVICE_MAP_JSON` controls what services each Authentik group can manage.

## Run locally

```bash
npm install
npm run dev
```

Visit:

- `/` landing page
- `/login` start Authentik sign-in
- `/verify` allowlist/revoke
- `/admin` audit log (requires `admin` group)

## Test and checks

```bash
npm run check
npm run test
```

## Caddy integration assumptions

- Service allowlisting is implemented via `remote_ip` matchers in Caddy.
- Services are discovered from Caddy Admin API route config at runtime.
- Caddy API credentials remain server-side only.
- Authentik tokens must include a `groups` claim for policy evaluation.

## Security notes

- Same-origin + CSRF token checks are enforced for mutation requests.
- Mutations are rate-limited per user.
- IP extraction supports trusted proxy chains via `X-Forwarded-For`.
