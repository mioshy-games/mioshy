/**
 * Deterministic Meta event ids — the SAME id is produced on the browser (Pixel)
 * and the server (CAPI) so Meta deduplicates the two layers. Derived purely from
 * an entity id (checkout session / user) so nothing needs to round-trip through
 * Cardcom. Shared (no side effects) so it's safe to import from both sides.
 */
export const metaEventId = {
  purchase: (sessionId: string) => `purchase.${sessionId}`,
  checkout: (sessionId: string) => `checkout.${sessionId}`,
  registration: (userId: string) => `register.${userId}`,
};
