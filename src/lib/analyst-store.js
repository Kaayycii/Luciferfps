import { newId, normalizeReport, parseWorkspaceImport, serializeWorkspace } from './analyst.js';
export const ANALYST_STORAGE_KEY = 'lucifer.fps:analyst:v1';
export const ANALYST_CHANGE_EVENT = 'lucifer-analyst-change';
export function readAnalystReports(storage = globalThis.localStorage) {
  const raw = storage.getItem(ANALYST_STORAGE_KEY);
  return raw ? parseWorkspaceImport(raw) : [];
}
export function mergeAnalystReports(current, incoming) {
  const ids = new Set(current.map(report => report.id));
  return [...current, ...incoming.map(input => {
    const report = normalizeReport(input);
    if (ids.has(report.id)) report.id = newId();
    ids.add(report.id);
    return report;
  })];
}
function announce() { globalThis.window?.dispatchEvent(new Event(ANALYST_CHANGE_EVENT)); }
export function attachAnalystBoard(reportId, plan, layoutId, storage = globalThis.localStorage) {
  const reports = readAnalystReports(storage);
  const report = reports.find(row => row.id === reportId);
  if (!report) throw new Error('Open or import the analyst report on this device first.');
  const board = { id: newId(), title: plan.title, mapId: plan.mapId, layoutId: layoutId || plan.layoutId || '', plan: { ...plan, layoutId: layoutId || plan.layoutId }, attachedAt: new Date().toISOString() };
  const next = reports.map(row => row.id === reportId ? normalizeReport({ ...row, boards: [...row.boards, board], updatedAt: new Date().toISOString() }) : row);
  storage.setItem(ANALYST_STORAGE_KEY, serializeWorkspace(next));
  announce();
  return board;
}
export function readAnalystBoard(reportId, boardId, storage = globalThis.localStorage) {
  try { return readAnalystReports(storage).find(report => report.id === reportId)?.boards.find(board => board.id === boardId) || null; }
  catch { return null; }
}
