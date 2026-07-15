const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Standard email check for login and sign-up. */
export function validateLoginEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_FORMAT.test(trimmed)) return 'Please enter a valid email address.';
  return null;
}

/** Sign-up password: at least one capital letter and one special character. */
export function validateSignupPassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one capital letter.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character (e.g. ! @ #).';
  }
  return null;
}

export const SIGNUP_PASSWORD_HINT =
  'Include 1 capital letter and 1 special character (e.g. ! @ #).';
