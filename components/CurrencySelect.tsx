'use client';

import { CURRENCIES, type CurrencyCode } from '@/utils/currency';

export default function CurrencySelect({
  value,
  onChange,
  id = 'group-currency',
}: {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  id?: string;
}) {
  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>Currency</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as CurrencyCode)}
        className="input-field py-3.5 cursor-pointer"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-slate-900 text-white">
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
