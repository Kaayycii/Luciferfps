import React, { useEffect, useRef, useState } from 'react';
import { Cloud, Download, LogOut, Upload } from 'lucide-react';
import { analystCloudError, createCloudPayload, deleteAnalystBackup, getAnalystCloudClient, getAnalystCloudConfig, readAnalystBackup, uploadAnalystBackup } from '../lib/analyst-cloud.js';

const dateLabel = value => new Date(value).toLocaleString();
const countLabel = count => `${count} report${count === 1 ? '' : 's'}`;

export function AnalystCloud({ reports = [], importReports }) {
  const [enabled] = useState(() => getAnalystCloudConfig().enabled);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState(null), [email, setEmail] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(null);
  const clientRef = useRef(null), sessionRef = useRef(null), mounted = useRef(false), busyRef = useRef(false);
  const confirmationRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return () => { mounted.current = false; };
    setReady(false); setError('');
    let active = true, subscription;
    const acceptSession = next => {
      if (!active) return;
      if (sessionRef.current?.user?.id !== next?.user?.id) {
        setPending(null); setNotice(''); setError('');
      }
      sessionRef.current = next;
      setSession(next);
    };
    (async () => {
      try {
        const client = await getAnalystCloudClient();
        if (!active) return;
        if (!client) throw new Error('Cloud configuration is unavailable.');
        clientRef.current = client;
        subscription = client.auth.onAuthStateChange((_event, next) => acceptSession(next)).data.subscription;
        const { data, error: authError } = await client.auth.getSession();
        if (authError) throw authError;
        acceptSession(data.session);
      } catch (failure) { if (active) setError(analystCloudError(failure)); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; mounted.current = false; subscription?.unsubscribe(); clientRef.current = null; };
  }, [enabled, attempt]);

  useEffect(() => { if (pending) confirmationRef.current?.focus(); }, [pending]);

  async function run(label, task) {
    if (busyRef.current || !clientRef.current) return;
    busyRef.current = true;
    setBusy(label); setNotice(''); setError('');
    try { await task(clientRef.current); }
    catch (failure) { if (mounted.current) { setPending(null); setError(analystCloudError(failure)); } }
    finally { busyRef.current = false; if (mounted.current) setBusy(''); }
  }

  function sameUser(userId) {
    return mounted.current && sessionRef.current?.user?.id === userId;
  }

  function sendLink(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    void run('Sending sign-in link…', async client => {
      const { error: authError } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/analyst` } });
      if (authError) throw authError;
      if (mounted.current) setNotice('Check your email for a sign-in link. Open it on this device to continue.');
    });
  }

  function upload() {
    const userId = sessionRef.current?.user?.id;
    if (!userId) return;
    void run('Checking cloud backup…', async client => {
      let payload;
      try { payload = createCloudPayload(reports); }
      catch (failure) { failure.isAnalystValidation = true; throw failure; }
      const remote = await readAnalystBackup(client, userId);
      if (!sameUser(userId)) return;
      if (remote) { setPending({ kind: 'upload', remote, payload, userId }); return; }
      const saved = await uploadAnalystBackup(client, userId, payload);
      if (sameUser(userId)) setNotice(`Uploaded ${countLabel(payload.reports.length)}. Saved ${dateLabel(saved.updated_at)}.`);
    });
  }

  function load() {
    const userId = sessionRef.current?.user?.id;
    if (!userId) return;
    setPending(null);
    void run('Loading backup…', async client => {
      const remote = await readAnalystBackup(client, userId);
      if (!sameUser(userId)) return;
      if (!remote) { setNotice('There is no cloud backup for this account yet.'); return; }
      // The local importer validates each report and merges without replacing local reports.
      let added;
      try { added = await importReports(JSON.stringify(remote.payload)); }
      catch { throw Object.assign(new Error('The backup could not be imported. Its reports may be invalid or the local workspace may be full.'), { isAnalystValidation: true }); }
      if (sameUser(userId)) setNotice(`Loaded cloud backup from ${dateLabel(remote.updated_at)}. ${Number.isInteger(added) ? `${countLabel(added)} added. ` : ''}Existing local reports were kept.`);
    });
  }

  function reviewDelete() {
    const userId = sessionRef.current?.user?.id;
    if (!userId) return;
    setPending(null);
    void run('Checking cloud backup…', async client => {
      const remote = await readAnalystBackup(client, userId);
      if (!sameUser(userId)) return;
      if (remote) setPending({ kind: 'delete', remote, userId });
      else setNotice('There is no cloud backup for this account to delete.');
    });
  }

  function confirm() {
    const action = pending;
    if (!action || !sameUser(action.userId)) return;
    void run(action.kind === 'upload' ? 'Uploading backup…' : 'Deleting backup…', async client => {
      if (action.kind === 'upload') {
        const saved = await uploadAnalystBackup(client, action.userId, action.payload, action.remote.revision, action.remote.updated_at);
        if (sameUser(action.userId)) setNotice(`Uploaded ${countLabel(action.payload.reports.length)}. Saved ${dateLabel(saved.updated_at)}.`);
      } else {
        await deleteAnalystBackup(client, action.userId, action.remote.revision, action.remote.updated_at);
        if (sameUser(action.userId)) setNotice('Cloud backup deleted. Your local reports are still here.');
      }
      if (mounted.current) setPending(null);
    });
  }

  function signOut() {
    setPending(null);
    void run('Signing out…', async client => {
      const { error: authError } = await client.auth.signOut({ scope: 'local' });
      if (authError) throw authError;
      if (mounted.current) { sessionRef.current = null; setSession(null); setEmail(''); setNotice('Signed out on this device. Local reports remain in this browser.'); }
    });
  }

  return <section className="analyst-cloud panel" aria-label="Private cloud backup" aria-busy={!!busy}>
    <div className="analyst-section-heading"><div><span className="eyebrow"><Cloud size={14} aria-hidden="true"/> PRIVATE CLOUD BACKUP</span><h2>Your reports, across devices.</h2></div></div>
    <p className="fineprint">Keep one personal backup for your account. Upload and load it when you choose. This backup does not share reports with teammates.</p>
    {!enabled ? <p className="fineprint">Private cloud backup needs owner configuration. You can keep working locally and use file exports in the meantime.</p> : <>
      {!ready ? <p role="status">Checking sign-in…</p> : session ? <>
        <p className="fineprint">Signed in as <strong>{session.user.email || 'your account'}</strong>. Sign-in lasts for this page session.</p>
        <div className="analyst-actions"><button type="button" className="btn" disabled={!!busy || !!pending} onClick={upload}><Upload size={14} aria-hidden="true"/> Upload backup</button><button type="button" className="btn" disabled={!!busy || !!pending || typeof importReports !== 'function'} onClick={load}><Download size={14} aria-hidden="true"/> Load backup</button><button type="button" className="btn" disabled={!!busy || !!pending} onClick={reviewDelete}>Delete cloud backup</button><button type="button" className="btn" disabled={!!busy} onClick={signOut}><LogOut size={14} aria-hidden="true"/> Sign out</button></div>
        <p className="fineprint">Load backup merges reports into this browser. Existing reports are kept. Export a file before clearing browser data or using a shared device.</p>
      </> : <form className="analyst-form-grid" onSubmit={sendLink}>
        <label>Email address<input className="field" type="email" name="analyst-cloud-email" autoComplete="email" required maxLength={254} value={email} disabled={!!busy || !clientRef.current} onChange={event => setEmail(event.target.value)}/></label>
        <button type="submit" className="btn" disabled={!!busy || !clientRef.current}>Email me a sign-in link</button>
        <p className="fineprint">New accounts can sign in by email. Reloading this page requires a new sign-in link. Your reports stay local until you choose Upload backup.</p>
      </form>}
      {pending && <div className="analyst-cloud-confirm" role="group" aria-label={pending.kind === 'upload' ? 'Confirm cloud backup replacement' : 'Confirm cloud backup deletion'} ref={confirmationRef} tabIndex={-1}>
        <h3>{pending.kind === 'upload' ? 'Replace your cloud backup?' : 'Delete your cloud backup?'}</h3>
        <p>The current backup has {countLabel(pending.remote.payload.reports.length)}, saved {dateLabel(pending.remote.updated_at)}.</p>
        <p>{pending.kind === 'upload' ? `Replace it with the ${countLabel(pending.payload.reports.length)} captured when you chose Upload backup. The previous cloud copy will be removed.` : 'This removes your only cloud copy. Local reports in this browser will remain.'}</p>
        <div className="analyst-actions"><button type="button" className="btn" disabled={!!busy} onClick={confirm}>{pending.kind === 'upload' ? 'Replace cloud backup' : 'Confirm delete cloud backup'}</button><button type="button" className="btn" disabled={!!busy} onClick={() => { setPending(null); setNotice('Cloud operation cancelled.'); }}>Cancel</button></div>
      </div>}
      {busy && <p role="status">{busy}</p>}
      {ready && !clientRef.current && <button type="button" className="btn" onClick={() => setAttempt(value => value + 1)}>Retry cloud connection</button>}
      {notice && <p className="fineprint" role="status">{notice}</p>}
      {error && <p className="analyst-error" role="alert">{error}</p>}
    </>}
  </section>;
}

export default AnalystCloud;
