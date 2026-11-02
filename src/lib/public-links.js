// Public navigation is limited to Lucifer's contact profiles and this site.
// Research provenance remains in the data, independently of presentation.
const contacts = new Set([
  'x.com/luciferfps2', 'twitter.com/luciferfps2',
  'twitch.tv/luciferfps2', 'liquipedia.net/marvelrivals/user:luciferfps2'
]);
export function permittedPublicLink(href) {
  if (typeof href !== 'string' || !href || /[\u0000-\u0020\\]/.test(href)) return false;
  if (href.startsWith('#') || /^\/(?!\/)/.test(href)) return true;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (url.hostname === 'lucifer-fps.vercel.app') return true;
    return !url.search && !url.hash && contacts.has(url.hostname.replace(/^www\./,'') + url.pathname.replace(/\/$/,'').toLowerCase());
  } catch { return false; }
}
