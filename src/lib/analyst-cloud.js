export const ANALYST_CLOUD_TABLE = 'analyst_workspaces';
export const MAX_CLOUD_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_CLOUD_REPORTS = 500;
const BACKUP_COLUMNS = 'payload,updated_at,revision';
let clientPromise;

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validationError = message => Object.assign(new Error(message), { isAnalystValidation: true });

function browserKey(key) {
  if (key.startsWith('sb_secret_')) return false;
  // Legacy anon keys are JWTs. Reject privileged JWTs without logging their contents.
  const part = key.split('.')[1];
  if (!part) return true;
  try {
    const decoded = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.role !== 'service_role';
  } catch { return true; }
}

export function getAnalystCloudConfig(env = import.meta.env || {}) {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const key = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (env.VITE_ANALYST_CLOUD_ENABLED !== 'true' || !url || !key || !browserKey(key)) return { enabled: false };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) return { enabled: false };
  } catch { return { enabled: false }; }
  return { enabled: true, url, key };
}

export async function getAnalystCloudClient() {
  const config = getAnalystCloudConfig();
  if (!config.enabled) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'lucifer-analyst-auth' },
    })).catch(error => { clientPromise = undefined; throw error; });
  }
  return clientPromise;
}

export function validateCloudPayload(value) {
  if (!record(value) || value.schema !== 'lucifer-analyst' || value.version !== 1 || !Array.isArray(value.reports) || value.reports.length > MAX_CLOUD_REPORTS || !value.reports.every(record)) {
    throw validationError('This backup is not a supported analyst workspace.');
  }
  let json;
  try { json = JSON.stringify(value); } catch { throw validationError('The backup could not be read as JSON.'); }
  if (new TextEncoder().encode(json).byteLength > MAX_CLOUD_BACKUP_BYTES) throw validationError('This backup exceeds the 5 MiB cloud limit. Export it to a file instead.');
  return value;
}

export function createCloudPayload(reports) {
  // Snapshot the click-time reports; later local edits must not change a pending upload.
  const value = { schema: 'lucifer-analyst', version: 1, reports };
  validateCloudPayload(value);
  return validateCloudPayload(JSON.parse(JSON.stringify(value)));
}

export function analystCloudError(error) {
  if (error?.code === 'ANALYST_CONFLICT' || error?.code === '23505') return 'The cloud backup changed on another device. Choose Upload backup or Delete cloud backup again to review the latest version.';
  if (['42P01', 'PGRST205', '42501'].includes(error?.code)) return 'Private cloud backup needs owner configuration. Ask the site owner to check the backup table and access rules.';
  if (error?.code === '23514') return 'The cloud backup was rejected. Check that it is a supported workspace under the 5 MiB limit.';
  if (['otp_expired', 'access_denied', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error?.code)) return 'Your sign-in link or session expired. Request a new sign-in link.';
  if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') return 'Too many sign-in requests. Wait a little before requesting another link.';
  // Do not echo server messages: they can include URLs, email addresses or report text.
  if (error?.isAnalystValidation) return error.message;
  return 'Cloud request failed. Check your connection and try again. If it continues, ask the site owner to check the cloud configuration.';
}

function requireUser(userId) {
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Sign in before using cloud backup.');
}

function conflict() {
  return Object.assign(new Error('Cloud backup changed.'), { code: 'ANALYST_CONFLICT' });
}

function requireReviewedVersion(revision, updatedAt) {
  if (!Number.isSafeInteger(revision) || revision < 1 || typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) throw conflict();
}

function readBackupRow(row) {
  if (!row) return null;
  validateCloudPayload(row.payload);
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) throw validationError('The cloud backup metadata is invalid.');
  return row;
}

export async function readAnalystBackup(client, userId) {
  requireUser(userId);
  const { data, error } = await client.from(ANALYST_CLOUD_TABLE).select(BACKUP_COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return readBackupRow(data);
}

export async function uploadAnalystBackup(client, userId, payload, expectedRevision = null, expectedUpdatedAt) {
  requireUser(userId);
  validateCloudPayload(payload);
  let query = client.from(ANALYST_CLOUD_TABLE);
  if (expectedRevision === null) query = query.insert({ user_id: userId, payload });
  else {
    requireReviewedVersion(expectedRevision, expectedUpdatedAt);
    query = query.update({ payload }).eq('user_id', userId).eq('revision', expectedRevision).eq('updated_at', expectedUpdatedAt);
  }
  const { data, error } = await query.select(BACKUP_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw conflict();
  return readBackupRow(data);
}

export async function deleteAnalystBackup(client, userId, expectedRevision, expectedUpdatedAt) {
  requireUser(userId);
  requireReviewedVersion(expectedRevision, expectedUpdatedAt);
  const { data, error } = await client.from(ANALYST_CLOUD_TABLE).delete().eq('user_id', userId).eq('revision', expectedRevision).eq('updated_at', expectedUpdatedAt).select('user_id').maybeSingle();
  if (error) throw error;
  if (!data) throw conflict();
}
