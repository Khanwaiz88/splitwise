import { LucideIcon } from 'lucide-react';

type InputFieldProps = {
  icon: LucideIcon;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
};

export default function InputField({
  icon: Icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  required,
  autoFocus,
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          className="input-group-field"
        />
      </div>
    </div>
  );
}
