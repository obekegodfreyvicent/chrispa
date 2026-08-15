import { HTMLAttributes, PropsWithChildren } from 'react';

export function Card({ className = '', children, ...rest }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`bg-surface border border-surface-2 rounded-[10px] p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Chip({
  gold = false,
  className = '',
  children,
  ...rest
}: PropsWithChildren<{ gold?: boolean; className?: string } & React.HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={`text-[10px] px-2.5 py-1 rounded-full border ${
        gold ? 'text-gold-light border-gold-dark' : 'text-text-2 border-[#CBDCC1] bg-surface-2'
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

export function ButtonGold({ className = '', children, ...rest }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold bg-gold text-white disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonOutline({ className = '', children, ...rest }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold bg-transparent border border-gold-dark text-gold-light ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonGhost({ className = '', children, ...rest }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold bg-surface-2 text-foreground disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PlaceholderImage({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center text-[10.5px] tracking-wide text-text-2 border border-dashed border-[#B7CDAC] rounded-lg ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, #EFF5EA, #EFF5EA 8px, #E4EEDD 8px, #E4EEDD 16px)',
      }}
    >
      {label}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`w-8.5 h-4.5 rounded-full relative shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-gold' : 'bg-surface-2'
      }`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function SectionLabel({ children }: PropsWithChildren) {
  return (
    <div className="text-[9.5px] text-gold-dark border-l-2 border-gold-dark pl-2 my-2.5">
      {children}
    </div>
  );
}
