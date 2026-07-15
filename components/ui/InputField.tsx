import { LucideIcon } from 'lucide-react';

type InputFieldProps = {
  icon: LucideIcon;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  name?: string;
};

export default function InputField({
  icon: Icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  required,
  autoFocus,
  autoComplete,
  name,
}: InputFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-violet-300/80 uppercase tracking-wider pl-0.5">
        {label}
      </label>
      <div className={`input-group ${disabled ? 'opacity-60' : ''}`}>
        <span className="input-group-icon" aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="input-group-field"
        />
      </div>
    </div>
  );
}
