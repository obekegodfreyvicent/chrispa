import { HTMLAttributes, PropsWithChildren } from 'react';

export function Card({ className = '', children, ...rest }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`bg-surface border border-surface-2 rounded-[10px] p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Chip({ gold = false, className = '', children }: PropsWithChildren<{ gold?: boolean; className?: string }>) {
  return (
    <span
      className={`text-[10px] px-2.5 py-1 rounded-full border ${
        gold ? 'text-gold-light border-gold-dark' : 'text-text-2 border-[#CBDCC1] bg-surface-2'
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function Status({ variant, children }: PropsWithChildren<{ variant: 'ok' | 'pending' | 'danger' }>) {
  const styles = {
    ok: 'bg-[rgba(63,125,50,0.14)] text-gold-light',
    pending: 'bg-surface-2 text-text-2',
    danger: 'bg-[rgba(255,68,68,0.12)] text-danger',
  };
  return <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${styles[variant]}`}>{children}</span>;
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

export function ButtonDanger({ className = '', children, ...rest }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold bg-transparent border border-danger text-danger disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Kpi({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <Card>
      <div className="text-[10px] uppercase text-text-2 mb-1">{label}</div>
      <div className="font-serif text-2xl">{value}</div>
      {delta && <div className="text-[10.5px] text-gold-light">{delta}</div>}
    </Card>
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
