// For choosing a NEW password only. Existing credentials must still reach Auth.
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_LENGTH_HINT = `At least ${MIN_PASSWORD_LENGTH} characters`;
export function newPasswordError(password) {
  return typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH
    ? `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    : '';
}
