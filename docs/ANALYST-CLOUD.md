# Optional private analyst cloud backup

The analyst workbench works locally without an account. The cloud option stores **one personal backup per authenticated user**. It is manual backup and restore, not team sharing, continuous sync, collaboration, or version history. It is disabled unless the separate analyst opt-in and both public Supabase configuration values are present. Existing drawing-room configuration does not enable analyst storage.

## Owner setup

1. Use a Supabase project you control. In its SQL Editor, run [`../supabase/analyst-workspaces.sql`](../supabase/analyst-workspaces.sql). The script is transactional and can be rerun without deleting backups. It creates the dedicated table, constraints, metadata trigger and owner policies. If an incompatible table with this name already exists, resolve the conflict before enabling this feature.
2. Enable the Email auth provider and email sign-in links. Configure a working email sender for the deployment. The client uses `signInWithOtp` with `shouldCreateUser: true`, so a first sign-in can create an account if project signup settings permit it. Keep the email template's magic-link confirmation URL; this UI does not ask for a numeric code.
3. In Supabase Authentication URL Configuration, set Site URL to the deployed site origin and add the exact `https://your-site.example/analyst` URL to the redirect allowlist. Add `http://localhost:5173/analyst` and/or `http://127.0.0.1:5173/analyst` only when needed for local development. SPA hosting must return the app for `/analyst`, including email-link callbacks.
4. Set these build environment variables in your host's environment settings:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   VITE_ANALYST_CLOUD_ENABLED=true
   ```

   These `VITE_` values are public in the browser bundle. Use only an anon/publishable key. Never put a service-role key, secret key, database password, or SMTP credential in them. The client rejects recognized service-role/secret keys, but this is a guard against configuration mistakes, not a substitute for correct key management. Do not commit filled-in environment files.
5. Rebuild and deploy. Open `/analyst`, sign in with an email link on the same device, and run the acceptance checks below before making the feature available to users.

Disable cloud by removing `VITE_ANALYST_CLOUD_ENABLED` or changing it to `false`, then rebuild. This hides cloud controls and leaves previously stored cloud rows intact.

## User behavior

- Sign-in is kept in memory with `persistSession: false`; tokens are not saved in local storage. A reload or a new tab needs another sign-in link. Navigating within the same running app can keep the session. Supabase automatically refreshes an active in-memory session. “Sign out” signs out this browser session, not other devices.
- Nothing uploads on sign-in, report editing, or report import. **Upload backup** captures the current local reports. If no cloud row exists, the click creates it. If a backup exists, the user sees its saved time and report count and must choose **Replace cloud backup**. Changes made locally while that confirmation is open are not included in the captured upload.
- Replacement is conditional on the reviewed revision and server timestamp. Another device's intervening update or delete-and-recreate causes a conflict; the user must review the latest backup again. An initial-upload race does not overwrite the other device's row.
- **Load backup** validates the envelope and passes the JSON to the local workspace importer. That importer validates report content and merges reports while retaining local reports; it does not replace the browser's workspace. Its duplicate policy also applies to cloud imports.
- **Delete cloud backup** shows the saved time and count and requires an explicit confirmation. It also checks the reviewed revision and server timestamp. Deletion leaves local reports intact.
- Signing out does not clear the local workspace. On a shared device, export any needed reports and use the local workspace controls to remove private reports when finished. Cloud storage is access-controlled by the database; it is not end-to-end encrypted, and project administrators can access backups.

The payload envelope is `{ "schema": "lucifer-analyst", "version": 1, "reports": [] }`. The client and database cap it at 500 reports and 5 MiB; individual report validation and workspace limits also apply on import. PostgreSQL checks its JSONB text representation, which can be slightly larger than compact browser JSON. A payload very near the limit can therefore be rejected by the server and should be exported to a file instead. The cloud row contains no separate team membership or sharing token.

## Access rules and concurrency

`public.analyst_workspaces.user_id` is a primary key referencing `auth.users(id)` with cascading deletion when the account is deleted. Authenticated users can select, insert, update and delete only rows whose `user_id` equals `(select auth.uid())`. Updates have both `USING` and `WITH CHECK`; users cannot move a row to another owner. An additional restrictive owner policy prevents older permissive authenticated policies from widening access. The script revokes table privileges from `anon` and `PUBLIC` and grants the four required operations to `authenticated`. It enables and forces RLS. Database administrators and privileged service roles still have their normal administrative access.

The database checks the schema marker, numeric version, reports array, count and byte bound. A trigger assigns `updated_at` and increments `revision`; browser-provided metadata cannot bypass the revision check. Client mutations use `user_id` plus the expected revision and timestamp and never use unconditional upsert. There is no realtime subscription and no automatic last-write-wins overwrite.

## Acceptance checks in a configured project

Local helper tests use fake clients; no live Supabase project, email delivery, SQL deployment, or RLS isolation is established by those tests. Run these checks in your project:

1. With the feature flag absent, open the workbench and confirm the owner-configuration message appears, local features work, and no analyst auth/database requests are made. Existing drawing-room variables alone must not enable it.
2. With the feature enabled, request an email link, open it on the intended device, and confirm the account appears. Verify bad/expired links, send-rate limits, offline requests and a missing table produce useful errors without crashing. Reload and confirm the session is not persisted.
3. Sign in as user A, upload a small valid workspace and load it into another signed-in A device. Confirm local reports are retained and duplicates follow the importer policy. Confirm sign-in/editing alone never writes the row.
4. Review an overwrite on device A1, upload a changed backup from A2, then confirm replacement on A1. It must show a conflict and preserve A2's backup. Repeat with a pending delete. Also test two first uploads racing: only the first may create a row.
5. Use **two real signed-in accounts A and B**, each with its own authenticated browser client. As B, attempt to select A's row by UUID: no row must return. Attempt update/delete of A's row: no rows may change. Attempt insert with A's UUID or update B's row to A's UUID: it must be denied. Recheck A's backup as A. Do not use SQL Editor's privileged role or a service key for these isolation tests, since they bypass normal browser permissions.
6. Using an unauthenticated public client, attempt all four operations. None may access or change backups. Confirm missing markers, string version `"1"`, non-array reports, 501 reports and JSON over 5 MiB are rejected by database constraints with a signed-in owner client.
7. Confirm cloud deletion requires confirmation and leaves local reports. Sign out and verify upload/load controls disappear. Ensure an operation completing after leaving the page or changing auth does not import data into another account's view.

Relevant Supabase primary documentation: [email OTP / magic-link sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [session persistence](https://supabase.com/docs/reference/javascript/auth), [auth state subscription](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [local sign-out scope](https://supabase.com/docs/reference/javascript/auth-signout), and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
