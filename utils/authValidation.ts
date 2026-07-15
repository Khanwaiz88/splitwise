const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Basic email check — used for login (existing users keep any valid email). */
export function validateLoginEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_FORMAT.test(trimmed)) return 'Please enter a valid email address.';
  return null;
}

/** Sign-up email: capital letter first, local part letters only (A–Z, a–z). */
export function validateSignupEmail(email: string): string | null {
  const basic = validateLoginEmail(email);
  if (basic) return basic;

  const localPart = email.trim().split('@')[0] ?? '';

  if (!/^[A-Z][a-zA-Z]*$/.test(localPart)) {
    return 'Email must start with a capital letter and use only letters before @ (e.g. John@gmail.com).';
  }

  return null;
}

/** Sign-up password: min 8 characters + at least one special character. */
export function validateSignupPassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character (e.g. ! @ # $).';
  }
  return null;
}

export const SIGNUP_PASSWORD_HINT =
  'Min 8 characters and at least 1 special character (e.g. ! @ #).';

export const SIGNUP_EMAIL_HINT =
  'Start with a capital letter; only letters before @ (e.g. John@gmail.com).';
