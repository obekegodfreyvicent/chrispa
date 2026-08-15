'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Status } from '@/components/ui';

interface Payslip {
  id: string;
  basicSalaryUgx: number;
  taxableAllowancesUgx: number;
  nonTaxableAllowancesUgx: number;
  overtimeUgx: number;
  bonusUgx: number;
  grossPayUgx: number;
  payeTaxUgx: number;
  nssfEmployeeUgx: number;
  nssfEmployerUgx: number;
  penaltyUgx: number;
  advanceRepaymentUgx: number;
  netPayUgx: number;
  period: { month: string; type: 'REGULAR' | 'THIRTEENTH_MONTH'; status: 'DRAFT' | 'COMPUTED' | 'FINALIZED' };
}

const STATUS_VARIANT = { DRAFT: 'pending', COMPUTED: 'pending', FINALIZED: 'ok' } as const;

function ugx(n: number) {
  return `UGX ${n.toLocaleString()}`;
}

// HR Phase 4 — Self-Service Portal: My Payslips.
export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/payslips').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setPayslips);
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to view your payslips.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">My Payslips</h1>
      <Card className="p-0 overflow-hidden">
        {!payslips ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : payslips.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No payslips yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Period</th>
                <th className="p-2.5">Gross</th>
                <th className="p-2.5">Net Pay</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-surface-2">
                    <td className="p-2.5">
                      {new Date(p.period.month).toLocaleDateString(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' })}
                      {p.period.type === 'THIRTEENTH_MONTH' && <div className="text-[9.5px] text-gold-dark uppercase">13th Month</div>}
                    </td>
                    <td className="p-2.5">{ugx(p.grossPayUgx)}</td>
                    <td className="p-2.5 text-gold-light">{ugx(p.netPayUgx)}</td>
                    <td className="p-2.5"><Status variant={STATUS_VARIANT[p.period.status]}>{p.period.status}</Status></td>
                    <td className="p-2.5">
                      <button className="text-gold-light text-[11px] underline" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                        {expanded === p.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expanded === p.id && (
                    <tr className="border-t border-surface-2 bg-surface-2">
                      <td colSpan={5} className="p-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Basic Salary</div>{ugx(p.basicSalaryUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Allowances (taxable)</div>{ugx(p.taxableAllowancesUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Allowances (non-taxable)</div>{ugx(p.nonTaxableAllowancesUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Overtime</div>{ugx(p.overtimeUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Bonus</div>{ugx(p.bonusUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">PAYE Tax</div>{ugx(p.payeTaxUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">NSSF (Employee 5%)</div>{ugx(p.nssfEmployeeUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">NSSF (Employer 10%)</div>{ugx(p.nssfEmployerUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Penalty</div>{ugx(p.penaltyUgx)}</div>
                          <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Advance Repayment</div>{ugx(p.advanceRepaymentUgx)}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
