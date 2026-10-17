/** The user must type their own email to delete the account. Empty never matches. */
export function emailConfirmationMatches(input: string, email: string): boolean {
  const typed = input.trim().toLowerCase();
  return typed !== "" && email.trim() !== "" && typed === email.trim().toLowerCase();
}
