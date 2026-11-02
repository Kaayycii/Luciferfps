export const TEXTURED_REFERENCE_VERSION = 'textured-2026-11-02';
export const isTexturedLayout = layout => layout?.kind === 'textured-overhead';
// Never silently put saved annotations on a replacement with different geometry.
export function resolvePlanLayout(plan, layouts = []) {
  if (plan?.layoutId) return layouts.find(layout => layout.id === plan.layoutId) || null;
  if (plan?.objects?.length && plan.referenceVersion !== TEXTURED_REFERENCE_VERSION) return null;
  return layouts[0] || null;
}
