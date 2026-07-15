const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Basic email check — used for login (existing users keep any valid email). */
export function validateLoginEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_FORMAT.test(trimmed)) return 'Please enter a valid email address.';
  return null;
}

/** Stricter email rules for new sign-ups only. */
export function validateSignupEmail(email: string): string | null {
  const basic = validateLoginEmail(email);
  if (basic) return basic;

  const localPart = email.trim().split('@')[0] ?? '';

  if (!/^[A-Z]/.test(localPart)) {
    return 'Email must start with a capital letter (e.g. John.doe@example.com).';
  }

  if (!/[a-zA-Z]/.test(localPart.slice(1))) {
    return 'Email must include letters after the first capital letter.';
  }

  if (!/[^a-zA-Z0-9]/.test(localPart)) {
    return 'Email must include at least one special character before @ (e.g. . _ - +).';
  }

  return null;
}

/** Professional password rules for new sign-ups. */
export function validateSignupPassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character (e.g. ! @ # $).';
  }
  return null;
}

export const SIGNUP_PASSWORD_HINT =
  'Min 8 characters, 1 uppercase, 1 lowercase, 1 special character.';

export const SIGNUP_EMAIL_HINT =
  'Start with a capital letter and include a special character (e.g. John.doe@mail.com).';
