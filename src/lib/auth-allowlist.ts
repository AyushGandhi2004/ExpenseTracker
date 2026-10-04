/** Only the configured Google account may use the app. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && !!email && email.trim().toLowerCase() === allowed;
}
