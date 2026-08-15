import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-14 flex-none flex items-center px-6 border-b border-surface-2">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 100 100" className="w-6.5 h-6.5">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#1B5E20" strokeWidth="3" />
            <text x="50" y="63" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="46" fill="#3F7D32">
              C
            </text>
          </svg>
          <span className="font-serif italic text-gold-light text-[13px]">ChrisPa Scents and Soaps</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
