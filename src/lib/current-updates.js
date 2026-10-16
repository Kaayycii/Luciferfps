const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0,10)) ? String(value).slice(0,10) : null;
export const todayUTC = () => new Date().toISOString().slice(0,10);
export function eventPhase(event, today = todayUTC()) {
  const start = dateOnly(event?.startAt), end = dateOnly(event?.endAt);
  if (!start || !end || end < start) return 'Dated update';
  return today < start ? 'Upcoming' : today > end ? 'Ended' : 'In progress';
}
export function currentPatch(articles = [], today = todayUTC()) {
  return articles.filter(item => item.category === 'patches' && dateOnly(item.effectiveAt || item.publishedAt) && (item.effectiveAt || item.publishedAt).slice(0,10) <= today).sort((a,b) => (b.effectiveAt || b.publishedAt).localeCompare(a.effectiveAt || a.publishedAt))[0] || null;
}
export function displayFacts(facts = [], today = todayUTC()) {
  return facts.filter(item => !item.validUntil || item.validUntil.slice(0,10) >= today || item.event).sort((a,b) => {
    const active = item => item.event && eventPhase(item.event,today) === 'In progress' ? 1 : 0;
    return active(b)-active(a) || (b.effectiveAt || b.publishedAt || '').localeCompare(a.effectiveAt || a.publishedAt || '');
  });
}
