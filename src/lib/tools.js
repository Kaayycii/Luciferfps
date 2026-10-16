import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

const PREFIX = 'lucifer.fps:tools:v1:';
const validReferenceImage = value => value === undefined || (typeof value === 'string' && value.length <= 2_000_000 && /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value));
export const validDraft = d => !!(d && typeof d.title === 'string' && d.title.length <= 1000 && ['tournament', 'ranked'].includes(d.preset) && ['mapId', 'enemyTeamId', 'mode'].every(key => d[key] === undefined || typeof d[key] === 'string') && ['blue', 'red'].every(side => d[side] && Array.isArray(d[side].timeline) && d[side].timeline.length === 7 && Array.isArray(d[side].comp) && d[side].comp.length === 6 && [...d[side].timeline, ...d[side].comp].every(v => v === null || typeof v === 'string') && typeof d[side].notes === 'string'));
export const validTier = value => !!(value && typeof value.title === 'string' && Array.isArray(value.rows) && value.rows.length <= 20 && value.rows.every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && typeof row.color === 'string' && Array.isArray(row.items) && row.items.every(id => typeof id === 'string')) && Array.isArray(value.custom) && value.custom.every(item => item && typeof item.id === 'string' && typeof item.name === 'string'));
export const validBingo = value => !!(value && typeof value.title === 'string' && [3, 4, 5, 6, 7].includes(value.size) && typeof value.free === 'boolean' && Array.isArray(value.cells) && value.cells.length === 49 && value.cells.every(cell => typeof cell === 'string') && Array.isArray(value.marks) && value.marks.every(mark => Number.isInteger(mark) && mark >= 0 && mark < 49));
export const validPlan = value => !!(value && typeof value.title === 'string' && value.title.length <= 1000 && typeof value.mapId === 'string' && (value.layoutId === undefined || typeof value.layoutId === 'string') && (value.referenceMode === undefined || ['floorplan', 'art'].includes(value.referenceMode)) && validReferenceImage(value.referenceImage) && (value.referenceName === undefined || (typeof value.referenceName === 'string' && value.referenceName.length <= 120)) && Array.isArray(value.objects) && value.objects.length <= 2000 && value.objects.every(object => object && typeof object.id === 'string' && ['hero', 'text', 'pen', 'arrow', 'line', 'highlight', 'zone'].includes(object.type) && Number.isFinite(object.x) && Number.isFinite(object.y) && (object.color === undefined || /^#[0-9a-f]{6}$/i.test(object.color)) && (object.text === undefined || typeof object.text === 'string') && (object.label === undefined || typeof object.label === 'string') && (object.abilityId === undefined || typeof object.abilityId === 'string') && (object.width === undefined || Number.isFinite(object.width)) && (!['line', 'arrow', 'zone'].includes(object.type) || (Number.isFinite(object.x2) && Number.isFinite(object.y2))) && (!['pen', 'highlight'].includes(object.type) || (Array.isArray(object.points) && object.points.length <= 20000 && object.points.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))))));
export function resizeBingo(state, size) {
  if (![3, 4, 5, 6, 7].includes(size)) throw new RangeError('Bingo sizes must be from 3 to 7.');
  return { ...state, size };
}
export function fitMapImage(width, height, canvasWidth = 1200, canvasHeight = 760) {
  if (![width, height, canvasWidth, canvasHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(canvasWidth / width, canvasHeight / height);
  return { x: (canvasWidth - width * scale) / 2, y: (canvasHeight - height * scale) / 2, width: width * scale, height: height * scale, scale };
}
export function projectMapPoint(at, frame) {
  if (!frame || !Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)) return null;
  return { x: frame.x + at[0] * frame.width, y: frame.y + at[1] * frame.height };
}
export function createHistoryState(initial) { return { present: initial, past: [], future: [] }; }
export function historyCommit(state, next) {
  const resolved = typeof next === 'function' ? next(state.present) : next;
  return JSON.stringify(state.present) === JSON.stringify(resolved) ? state : { present: resolved, past: [...state.past.slice(-59), state.present], future: [] };
}
export function historyUndo(state) {
  return state.past.length ? { present: state.past.at(-1), past: state.past.slice(0, -1), future: [...state.future, state.present] } : state;
}
export function historyRedo(state) {
  return state.future.length ? { present: state.future.at(-1), past: [...state.past, state.present], future: state.future.slice(0, -1) } : state;
}
export function safeRead(key, fallback, validate = () => true) {
  try {
    const value = JSON.parse(localStorage.getItem(PREFIX + key));
    return value && validate(value) ? value : fallback;
  } catch { return fallback; }
}
export function useStoredState(key, initial, validate) {
  const [value, setValue] = useState(() => safeRead(key, typeof initial === 'function' ? initial() : initial, validate));
  useEffect(() => { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ } }, [key, value]);
  return [value, setValue];
}
export function useHistory(initial, key, validate = () => true) {
  const [value, setValue] = useStoredState(key, initial, validate);
  const stack = useRef(createHistoryState(value));
  const [revision, refresh] = useState(0);
  const apply = useCallback(next => {
    if (next === stack.current) return;
    stack.current = next; setValue(next.present); refresh(v => v + 1);
  }, [setValue]);
  const commit = useCallback(next => {
    apply(historyCommit(stack.current, next));
  }, [apply]);
  const undo = useCallback(() => apply(historyUndo(stack.current)), [apply]);
  const redo = useCallback(() => apply(historyRedo(stack.current)), [apply]);
  return { value, commit, undo, redo, canUndo: !!stack.current.past.length, canRedo: !!stack.current.future.length, revision };
}
export function uniqueId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function encodeSnapshot(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = ''; bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function decodeSnapshot(value) {
  if (!value || value.length > 60000) return null;
  try {
    const encoded = value.replaceAll('-', '+').replaceAll('_', '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))));
  } catch { return null; }
}
export async function copySnapshot(key, value) {
  const url = new URL(window.location.href); url.searchParams.delete('room'); url.searchParams.set(key, encodeSnapshot(value));
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url.href); return 'Link copied to clipboard'; } } catch { /* Keep a selectable link when clipboard permissions are unavailable. */ }
  return `Copy this link: ${url.href}`;
}
export function readSnapshot(key, validate) {
  return snapshotFromSearch(window.location.search, key, validate);
}
export function snapshotFromSearch(search, key, validate) {
  const raw = new URLSearchParams(search).get(key);
  const value = decodeSnapshot(raw);
  return value && validate(value) ? value : null;
}
export async function downloadImage(node, filename) {
  if (!node) throw new Error('The export area is unavailable.');
  await document.fonts?.ready;
  await Promise.all([...node.querySelectorAll('img')].map(async image => {
    image.loading = 'eager';
    try { await image.decode(); } catch { if (image.isConnected && !image.naturalWidth) throw new Error('An image has not loaded yet. Wait for it to load before exporting.'); }
  }));
  const url = await toPng(node, { pixelRatio: 2, backgroundColor: '#0c0d11', cacheBust: false, filter: el => !el.classList?.contains('tool-export-hide') });
  const link = document.createElement('a'); link.download = `${filename}.png`; link.href = url; link.click();
  return url;
}
export function getDragId(event) {
  return event.dataTransfer.getData('application/x-lucifer-item') || event.dataTransfer.getData('text/plain');
}
export function setDragId(event, id) {
  event.dataTransfer.setData('application/x-lucifer-item', id); event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move';
}
export function cleanFilename(text) { return (text || 'lucifer-fps').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70); }
