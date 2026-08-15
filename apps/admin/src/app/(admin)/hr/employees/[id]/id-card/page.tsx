'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, ButtonGold } from '@/components/ui';

interface EmployeeCardData {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl: string | null;
  department: { name: string } | null;
  hireDate: string;
}

// HR Phase 1: Generate Staff Identification cards. CR80 card-size layout
// (3.375in × 2.125in) with browser print — no PDF-generation library or
// physical card-printer integration.
export default function IdCardPage(props: PageProps<'/hr/employees/[id]/id-card'>) {
  const { id } = use(props.params);
  const [employee, setEmployee] = useState<EmployeeCardData | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch(`/hr/employees/${id}`).then((r) => (r.ok ? r.json() : null)).then(setEmployee);
  }, [id]);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.
        </p>
      </Card>
    );
  }
  if (!employee) return <p className="text-sm text-text-2">Loading…</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Link href={`/hr/employees/${id}`} className="text-[11px] text-gold-light">← Back to profile</Link>
        <ButtonGold onClick={() => window.print()}>Print ID Card</ButtonGold>
      </div>

      <div
        id="id-card"
        className="bg-white border-2 border-gold rounded-xl overflow-hidden"
        style={{ width: '3.375in', height: '2.125in' }}
      >
        <div className="h-full flex flex-col p-3" style={{ background: 'linear-gradient(180deg, #F5F9F1, #FFFFFF)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <svg viewBox="0 0 100 100" style={{ width: 22, height: 22 }}>
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1B5E20" strokeWidth="4" />
              <text x="50" y="65" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="50" fill="#3F7D32">C</text>
            </svg>
            <div className="leading-tight">
              <div className="font-serif italic text-gold-light" style={{ fontSize: 9 }}>ChrisPa Scents and Soaps</div>
              <div className="text-text-2" style={{ fontSize: 6, letterSpacing: '0.15em' }}>STAFF IDENTIFICATION</div>
            </div>
          </div>

          <div className="flex gap-2.5 flex-1">
            <div
              className="flex-none bg-surface-2 border border-[#CBDCC1] rounded-md flex items-center justify-center text-text-2"
              style={{ width: 56, height: 68, fontSize: 8 }}
            >
              {employee.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={employee.photoUrl} alt="" className="w-full h-full object-cover rounded-md" />
              ) : (
                'Photo'
              )}
            </div>
            <div className="flex-1 leading-tight">
              <div className="font-semibold" style={{ fontSize: 11 }}>{employee.firstName} {employee.lastName}</div>
              <div className="text-text-2" style={{ fontSize: 8.5 }}>{employee.jobTitle}</div>
              <div className="text-text-2" style={{ fontSize: 8 }}>{employee.department?.name ?? 'ChrisPa Scents and Soaps'}</div>
              <div className="text-gold-light mt-1.5" style={{ fontSize: 8, letterSpacing: '0.05em' }}>{employee.employeeNumber}</div>
              <div className="text-text-2" style={{ fontSize: 6.5 }}>
                Since {new Date(employee.hireDate).toLocaleDateString('en-UG', { year: 'numeric', month: 'short' })}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-[1.5px] mt-1" style={{ height: 18 }} aria-hidden>
            {employee.employeeNumber.split('').map((ch, i) => (
              <div key={i} style={{ width: 2, height: (ch.charCodeAt(0) % 12) + 6, background: '#1B5E20' }} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #id-card, #id-card * { visibility: visible; }
          #id-card { position: fixed; top: 20px; left: 20px; }
        }
      `}</style>
    </div>
  );
}
