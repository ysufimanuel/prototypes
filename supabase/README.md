# Supabase migration

This directory contains the staged migration from Firebase to Supabase.

## Current stage

`0001_initial_schema.sql` creates the schema foundation only. Firebase remains the active backend.

Do **not** remove Firebase or switch the frontend yet.

## Migration order

1. Create/apply schema in the Supabase project.
2. Add the Firebase-backup reader and transformer.
3. Dry-run the transformed data and validate tenant/relationship integrity.
4. Import core/auth-linked data.
5. Migrate application modules one by one.
6. Migrate Website Manager and public-site projection.
7. Migrate realtime subscriptions where needed.
8. Run full regression/security validation.
9. Only then remove Firebase dependencies.

## ID strategy

Domain rows keep legacy Firebase IDs through `legacy_id` where a direct numeric relational ID cannot be preserved safely. Do not blindly replace relational IDs with UUIDs during the migration.

`auth.users.id` remains Supabase Auth UUID and `profiles.id` references it.

## Security strategy

Internal tables use RLS and derive tenant scope from `profiles.church_id` for `auth.uid()`.

The public website reads only the `public_sites`, `public_site_pages`, `public_site_events`, and `site_slugs` projection. It must not query private member/user/finance tables directly.

## Deployment rule

Migration commits are normal commits. The repository's deployment workflow requires the final intentional deployment commit to contain the word `deploy` in its commit message. Do not use that word in migration commits until the migration is ready for deployment.
