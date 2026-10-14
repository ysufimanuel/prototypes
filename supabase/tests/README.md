# Supabase security tests

These tests are designed to run against the Supabase database after migrations are applied.

## Prerequisites

- Supabase CLI installed and authenticated, or a local Supabase stack.
- Migrations `0001` through the latest migration applied.
- Test users/profiles for at least:
  - superadmin in church A
  - admin in church A
  - user in church A
  - user in church B

## Run

From the repository root:

```bash
supabase test db
```

The suite focuses on tenant isolation, role permissions, cross-tenant relational integrity, finance approval rules, public-site exposure, and narrow read-state RPCs.

Do not use production credentials in tests.
