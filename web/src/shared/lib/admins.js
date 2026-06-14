/**
 * Operator/admin allowlist — the single source of truth for who may publish or
 * manage plan templates from the client. This MUST stay in sync with the
 * `isAdmin()` function in web/firestore.rules, which enforces the same boundary
 * server-side (the client check is UX only; the rules are the real gate).
 */
export const ADMIN_EMAILS = ['manish28june@gmail.com', 'manishsaraan@gmail.com'];

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
