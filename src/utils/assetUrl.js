// Turns '/assets/...' into a URL that also works when the game is hosted in a sub-folder
// (e.g. https://user.github.io/operation-zero/). Vite sets BASE_URL from `base` in vite.config.js ('./' here).
// Outside Vite (tests / harness) import.meta.env is undefined and the path is left as it was.
export function joinBase(base, p) {
  if (typeof p !== 'string' || /^(?:[a-z]+:)?\/\//i.test(p) || p.startsWith('data:') || p.startsWith('blob:')) return p;
  return (base || '/').replace(/\/?$/, '/') + p.replace(/^\.?\//, '');
}
export function assetUrl(p) {
  let base = '/';
  try { base = (import.meta.env && import.meta.env.BASE_URL) || '/'; } catch (_) { /* not running under Vite */ }
  return base === '/' ? p : joinBase(base, p);
}
