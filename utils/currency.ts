export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)', short: '$' },
  { code: 'PKR', label: 'Pakistani Rupee (Rs)', short: 'Rs' },
  { code: 'EUR', label: 'Euro (€)', short: '€' },
  { code: 'INR', label: 'Indian Rupee (₹)', short: '₹' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  USD: 'en-US',
  PKR: 'en-PK',
  EUR: 'de-DE',
  INR: 'en-IN',
};

export function isValidCurrency(code: string | null | undefined): code is CurrencyCode {
  return CURRENCIES.some((c) => c.code === code);
}

export function normalizeCurrency(code: string | null | undefined): CurrencyCode {
  return isValidCurrency(code) ? code : DEFAULT_CURRENCY;
}

export function formatMoney(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function currencyShortLabel(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.short ?? code;
}
