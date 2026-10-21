import { useCallback, useEffect, useRef, useState } from 'react';
import { createReport, newId, normalizeReport, parseWorkspaceImport, serializeWorkspace } from './analyst.js';

import { ANALYST_STORAGE_KEY, ANALYST_CHANGE_EVENT, readAnalystReports, readAnalystState, mergeAnalystReports } from './analyst-store.js';
export { attachAnalystBoard, readAnalystBoard } from './analyst-store.js';
const CHANGE_EVENT = ANALYST_CHANGE_EVENT;
function announce() { window.dispatchEvent(new Event(CHANGE_EVENT)); }
const SELECT_KEY = 'lucifer.fps:analyst:selected';
const memory = { reports: null, error: '', baseRaw: undefined };
const failure = error => `Changes are only in memory: ${error?.message || 'browser storage is unavailable'}. Export a JSON backup before leaving.`;
export function useAnalystWorkspace() {
  const boot = useRef(null);
  if (!boot.current) {
    try { boot.current = readAnalystState(localStorage, memory.reports ? memory : null); }
    catch (error) { boot.current = { reports: memory.reports || [], error: `Existing browser data could not be opened: ${error.message}. It has not been replaced. Export or recover that browser data before clearing it.` }; }
  }
  const [reports, setReports] = useState(boot.current.reports), ref = useRef(reports);
  const [storageError, setStorageError] = useState(boot.current.error);
  const [selectedId, setSelectedId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('report');
    try { return fromUrl || sessionStorage.getItem(SELECT_KEY) || reports[0]?.id || ''; } catch { return fromUrl || reports[0]?.id || ''; }
  });
  const commit = useCallback(transform => {
    let base = ref.current, baseRaw;
    // Read the current snapshot before editing so separate tabs do not erase unrelated reports.
    try { const latest = readAnalystState(localStorage, memory.reports ? memory : null); base = latest.reports; baseRaw = latest.raw; }
    catch (error) { setStorageError(failure(error)); }
    let next, serialized;
    try { next = transform(base); serialized = serializeWorkspace(next); }
    catch(error) { setStorageError(`Change was not saved: ${error.message}`); return false; }
    ref.current = next; setReports(next); if (!memory.reports) memory.baseRaw = baseRaw; memory.reports = next;
    try {
      // Do not overwrite a corrupt existing backup with an empty fallback.
      const raw = localStorage.getItem(ANALYST_STORAGE_KEY);
      if (raw) parseWorkspaceImport(raw);
      if (memory.baseRaw !== undefined && raw !== memory.baseRaw) throw new Error('Another tab saved a different version. Back up all, reload, then import your backup to retain both versions');
      localStorage.setItem(ANALYST_STORAGE_KEY, serialized);
      memory.reports = null; memory.error = ''; memory.baseRaw = undefined; setStorageError(''); announce();
    } catch (error) { memory.error = failure(error); setStorageError(memory.error); }
    return next;
  }, []);
  useEffect(() => {
    const sync = event => {
      if (event.type === 'storage' && event.key !== ANALYST_STORAGE_KEY) return;
      try { const next = readAnalystState(localStorage, memory.reports ? memory : null); ref.current = next.reports; setReports(next.reports); setStorageError(next.error); }
      catch (error) { setStorageError(failure(error)); }
    };
    window.addEventListener('storage', sync); window.addEventListener(CHANGE_EVENT, sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(CHANGE_EVENT, sync); };
  }, []);
  const selectReport = useCallback(id => { setSelectedId(id); try { sessionStorage.setItem(SELECT_KEY, id); } catch {} }, []);
  const create = useCallback(type => { const report = createReport(type); if (commit(rows => [...rows, report]) === false) return null; selectReport(report.id); return report; }, [commit, selectReport]);
  const update = useCallback((id, patch) => commit(rows => rows.map(row => row.id === id ? normalizeReport({ ...row, ...(typeof patch === 'function' ? patch(row) : patch), id: row.id, createdAt: row.createdAt, updatedAt: new Date().toISOString() }) : row)), [commit]);
  const remove = useCallback(id => { const next = commit(rows => rows.filter(row => row.id !== id)); if (next !== false && selectedId === id) selectReport(next[0]?.id || ''); }, [commit, selectedId, selectReport]);
  const duplicate = useCallback(id => {
    const original = ref.current.find(row => row.id === id); if (!original) return;
    const report = normalizeReport({ ...original, id: newId(), title: `${original.title.slice(0, 293)} (copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    if (commit(rows => [...rows, report]) === false) return null; selectReport(report.id); return report;
  }, [commit, selectReport]);
  const importReports = useCallback(text => { const incoming = parseWorkspaceImport(text); if (commit(rows => mergeAnalystReports(rows, incoming)) === false) throw new Error('The import exceeds workspace limits. Existing reports were kept.'); if (incoming.length) selectReport(ref.current.at(-incoming.length)?.id || ''); return incoming.length; }, [commit, selectReport]);
  const exportAll = useCallback(() => serializeWorkspace(ref.current), []);
  return { reports, selectedId, selectReport, create, update, remove, duplicate, importReports, exportAll, storageError, status: storageError ? 'Backup needed' : 'Saved on this device', cloud: null };
}
