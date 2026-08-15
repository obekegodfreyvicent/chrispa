'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Status, Chip, ButtonGold, ButtonGhost, ButtonOutline } from '@/components/ui';

interface Period {
  id: string;
  month: string;
  type: 'REGULAR' | 'THIRTEENTH_MONTH';
  status: 'DRAFT' | 'COMPUTED' | 'FINALIZED';
  finalizedAt: string | null;
  _count: { payslips: number };
}
interface Payslip {
  id: string;
  employeeId: string;
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
  employee: { firstName: string; lastName: string; employeeNumber: string; jobTitle: string };
}
interface Adjustment {
  id: string;
  employeeId: string;
  type: 'BONUS' | 'PENALTY' | 'OVERTIME' | 'OTHER_EARNING' | 'OTHER_DEDUCTION';
  label: string;
  amountUgx: number;
  taxable: boolean;
  employee: { firstName: string; lastName: string; employeeNumber: string };
}
interface PeriodDetail extends Period {
  payslips: Payslip[];
  adjustments: Adjustment[];
}
interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}
interface OvertimeRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  computedOvertimeHours: number;
  computedPayUgx: number;
  confirmedPayUgx: number | null;
}

const STATUS_VARIANT = { DRAFT: 'pending', COMPUTED: 'pending', FINALIZED: 'ok' } as const;
const ADJUSTMENT_TYPES = ['BONUS', 'PENALTY', 'OVERTIME', 'OTHER_EARNING', 'OTHER_DEDUCTION'];

function ugx(n: number) {
  return `UGX ${n.toLocaleString()}`;
}

// HR Phase 4 — Payroll. PAYE/NSSF figures come from
// apps/api/.../hr/payroll/paye-nssf.util.ts — real financial figures,
// hard-coded from currently-published Uganda rates; treat any discrepancy
// as a rates question for an accountant, not a frontend bug. Overtime shown
// here is a *computed suggestion* from clock-in/out data — nothing is paid
// until it's confirmed as an adjustment below.
export default function PayrollPage() {
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [selected, setSelected] = useState<PeriodDetail | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [month, setMonth] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [addingAdjustment, setAddingAdjustment] = useState(false);
  const [adjForm, setAdjForm] = useState({ employeeId: '', type: 'BONUS', label: '', amountUgx: '', taxable: true });

  const [overtimeRows, setOvertimeRows] = useState<OvertimeRow[] | null>(null);
  const [overtimeAmounts, setOvertimeAmounts] = useState<Record<string, string>>({});

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/payroll/periods').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setPeriods);
    authedFetch('/hr/employees').then((r) => (r.ok ? r.json() : [])).then(setEmployees);
  }

  useRefetchOnFocus(load);

  async function loadDetail(id: string) {
    const r = await authedFetch(`/hr/payroll/periods/${id}`);
    if (r.ok) setSelected(await r.json());
    setOvertimeRows(null);
  }

  async function createPeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!month) return;
    const r = await authedFetch('/hr/payroll/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: `${month}-01` }),
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      alert(body?.message ?? 'Could not create payroll period.');
      return;
    }
    setAdding(false);
    setMonth('');
    load();
  }

  async function runThirteenthMonth() {
    const year = prompt('Run 13th-month pay for which year?', String(new Date().getFullYear()));
    if (!year) return;
    setBusy(true);
    const r = await authedFetch(`/hr/payroll/thirteenth-month/${year}`, { method: 'POST' });
    setBusy(false);
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      alert(body?.message ?? 'Could not run 13th-month pay.');
      return;
    }
    setSelected(body);
    load();
  }

  async function run(id: string) {
    setBusy(true);
    const r = await authedFetch(`/hr/payroll/periods/${id}/run`, { method: 'POST' });
    setBusy(false);
    if (r.ok) {
      setSelected(await r.json());
      load();
    }
  }

  async function finalize(id: string) {
    if (!confirm('Finalize this payroll period? It can no longer be re-run after this.')) return;
    setBusy(true);
    const r = await authedFetch(`/hr/payroll/periods/${id}/finalize`, { method: 'POST' });
    setBusy(false);
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      alert(body?.message ?? 'Could not finalize.');
      return;
    }
    loadDetail(id);
    load();
  }

  async function addAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !adjForm.employeeId) return;
    const r = await authedFetch(`/hr/payroll/periods/${selected.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...adjForm, amountUgx: Number(adjForm.amountUgx) }),
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      alert(body?.message ?? 'Could not add adjustment.');
      return;
    }
    setAddingAdjustment(false);
    setAdjForm({ employeeId: '', type: 'BONUS', label: '', amountUgx: '', taxable: true });
    loadDetail(selected.id);
  }

  async function removeAdjustment(id: string) {
    if (!selected) return;
    await authedFetch(`/hr/payroll/adjustments/${id}`, { method: 'DELETE' });
    loadDetail(selected.id);
  }

  async function loadOvertimePreview() {
    if (!selected) return;
    const r = await authedFetch(`/hr/payroll/periods/${selected.id}/overtime-preview`);
    if (r.ok) {
      const rows: OvertimeRow[] = await r.json();
      setOvertimeRows(rows);
      const amounts: Record<string, string> = {};
      for (const row of rows) amounts[row.employeeId] = String(row.confirmedPayUgx ?? row.computedPayUgx);
      setOvertimeAmounts(amounts);
    }
  }

  async function confirmOvertime(row: OvertimeRow) {
    if (!selected) return;
    const amountUgx = Number(overtimeAmounts[row.employeeId] ?? row.computedPayUgx);
    if (!amountUgx || amountUgx <= 0) return;
    await authedFetch(`/hr/payroll/periods/${selected.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: row.employeeId,
        type: 'OVERTIME',
        label: `Confirmed overtime — ${row.computedOvertimeHours}h computed`,
        amountUgx,
      }),
    });
    loadDetail(selected.id);
    loadOvertimePreview();
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.</p></Card>;
  }
  if (forbidden) {
    return <Card><p className="text-sm text-text-2">Owner or HR Manager role required.</p></Card>;
  }

  const totals = selected?.payslips.reduce(
    (acc, p) => ({
      gross: acc.gross + p.grossPayUgx,
      paye: acc.paye + p.payeTaxUgx,
      nssfEmployee: acc.nssfEmployee + p.nssfEmployeeUgx,
      nssfEmployer: acc.nssfEmployer + p.nssfEmployerUgx,
      net: acc.net + p.netPayUgx,
    }),
    { gross: 0, paye: 0, nssfEmployee: 0, nssfEmployer: 0, net: 0 },
  );

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Payroll</h1>
        <div className="flex gap-2">
          <ButtonOutline disabled={busy} onClick={runThirteenthMonth}>Run 13th Month Pay</ButtonOutline>
          <ButtonGold onClick={() => setAdding(true)}>+ New Payroll Period</ButtonGold>
        </div>
      </div>

      {adding && (
        <Card className="mb-4 max-w-sm">
          <form onSubmit={createPeriod} className="space-y-2.5">
            <label className="text-[10px] text-text-2 block">Month</label>
            <input required type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <div className="flex gap-2">
              <ButtonGold type="submit">Create</ButtonGold>
              <ButtonGhost type="button" onClick={() => setAdding(false)}>Cancel</ButtonGhost>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-4">
        <Card className="p-0 overflow-hidden self-start">
          {!periods ? (
            <p className="text-sm text-text-2 p-4">Loading…</p>
          ) : periods.length === 0 ? (
            <p className="text-sm text-text-2 p-4">No payroll periods yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-gold-dark text-[10px] uppercase">
                  <th className="p-2.5">Period</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Payslips</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className={`border-t border-surface-2 cursor-pointer ${selected?.id === p.id ? 'bg-surface-2' : ''}`} onClick={() => loadDetail(p.id)}>
                    <td className="p-2.5">
                      {new Date(p.month).toLocaleDateString(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' })}
                      {p.type === 'THIRTEENTH_MONTH' && <div className="text-[9.5px] text-gold-dark uppercase">13th Month</div>}
                    </td>
                    <td className="p-2.5"><Status variant={STATUS_VARIANT[p.status]}>{p.status}</Status></td>
                    <td className="p-2.5">{p._count.payslips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        <div>
          {!selected ? (
            <Card><p className="text-sm text-text-2">Select a payroll period.</p></Card>
          ) : (
            <>
              <Card className="mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-text-2 mb-1">
                      {new Date(selected.month).toLocaleDateString(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' })}
                      {selected.type === 'THIRTEENTH_MONTH' && ' · 13th Month'}
                    </div>
                    <Status variant={STATUS_VARIANT[selected.status]}>{selected.status}</Status>
                  </div>
                  <div className="flex gap-2">
                    {selected.type === 'REGULAR' && selected.status !== 'FINALIZED' && (
                      <ButtonOutline onClick={loadOvertimePreview}>Compare Overtime</ButtonOutline>
                    )}
                    {selected.status !== 'FINALIZED' && (
                      <ButtonOutline disabled={busy} onClick={() => run(selected.id)}>
                        {selected.status === 'DRAFT' ? 'Run Payroll' : 'Re-run Payroll'}
                      </ButtonOutline>
                    )}
                    {selected.status === 'COMPUTED' && (
                      <ButtonGold disabled={busy} onClick={() => finalize(selected.id)}>Finalize</ButtonGold>
                    )}
                  </div>
                </div>
              </Card>

              {overtimeRows && (
                <Card className="mb-3 p-0 overflow-hidden">
                  <div className="text-[10px] uppercase text-text-2 p-2.5 pb-0">
                    Overtime — computed from clock-in/out vs. confirmed amount
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <tbody>
                      {overtimeRows.filter((r) => r.computedOvertimeHours > 0 || r.confirmedPayUgx !== null).map((row) => (
                        <tr key={row.employeeId} className="border-t border-surface-2">
                          <td className="p-2.5">{row.firstName} {row.lastName}</td>
                          <td className="p-2.5 text-text-2">{row.computedOvertimeHours}h computed → {ugx(row.computedPayUgx)}</td>
                          <td className="p-2.5">
                            <input
                              type="number" min={0}
                              value={overtimeAmounts[row.employeeId] ?? ''}
                              onChange={(e) => setOvertimeAmounts({ ...overtimeAmounts, [row.employeeId]: e.target.value })}
                              className="w-28 bg-white border border-[#CBDCC1] rounded-md px-2 py-1.5 text-[11px]"
                            />
                          </td>
                          <td className="p-2.5">
                            <ButtonGold onClick={() => confirmOvertime(row)}>
                              {row.confirmedPayUgx !== null ? 'Update' : 'Confirm'}
                            </ButtonGold>
                          </td>
                        </tr>
                      ))}
                      {overtimeRows.every((r) => r.computedOvertimeHours === 0 && r.confirmedPayUgx === null) && (
                        <tr><td className="p-2.5 text-text-2">No overtime detected from clock-in/out data this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </Card>
              )}

              {selected.status !== 'FINALIZED' && (
                <Card className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] uppercase text-text-2">Adjustments (bonus, penalty, other)</div>
                    <button onClick={() => setAddingAdjustment(!addingAdjustment)} className="text-[11px] text-gold-light">+ Add</button>
                  </div>
                  {addingAdjustment && (
                    <form onSubmit={addAdjustment} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 bg-surface-2 p-2.5 rounded-md">
                      <select required value={adjForm.employeeId} onChange={(e) => setAdjForm({ ...adjForm, employeeId: e.target.value })}
                        className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2">
                        <option value="">Select employee…</option>
                        {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNumber})</option>)}
                      </select>
                      <select value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}
                        className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                        {ADJUSTMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                      </select>
                      <input required type="number" min={1} placeholder="Amount (UGX)" value={adjForm.amountUgx}
                        onChange={(e) => setAdjForm({ ...adjForm, amountUgx: e.target.value })}
                        className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                      <input required placeholder="Label / reason" value={adjForm.label} onChange={(e) => setAdjForm({ ...adjForm, label: e.target.value })}
                        className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2" />
                      <ButtonGold type="submit" className="col-span-2">Save</ButtonGold>
                    </form>
                  )}
                  {selected.adjustments.length === 0 ? (
                    <p className="text-sm text-text-2">No adjustments yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selected.adjustments.map((a) => (
                        <li key={a.id} className="flex justify-between items-center text-[11.5px] border-b border-surface-2 pb-1.5 last:border-0">
                          <span>
                            <Chip>{a.type.replace('_', ' ')}</Chip>{' '}
                            {a.employee.firstName} {a.employee.lastName} — {a.label}
                          </span>
                          <span className="flex items-center gap-2">
                            {ugx(a.amountUgx)}
                            <button onClick={() => removeAdjustment(a.id)} className="text-danger">Remove</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {totals && selected.payslips.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
                  <Card><div className="text-[10px] uppercase text-text-2 mb-1">Gross</div><div className="text-sm">{ugx(totals.gross)}</div></Card>
                  <Card><div className="text-[10px] uppercase text-text-2 mb-1">PAYE</div><div className="text-sm">{ugx(totals.paye)}</div></Card>
                  <Card><div className="text-[10px] uppercase text-text-2 mb-1">NSSF (Emp.)</div><div className="text-sm">{ugx(totals.nssfEmployee)}</div></Card>
                  <Card><div className="text-[10px] uppercase text-text-2 mb-1">NSSF (Empl.)</div><div className="text-sm">{ugx(totals.nssfEmployer)}</div></Card>
                  <Card><div className="text-[10px] uppercase text-text-2 mb-1">Net Pay</div><div className="text-sm text-gold-light">{ugx(totals.net)}</div></Card>
                </div>
              )}

              <Card className="p-0 overflow-hidden">
                {selected.payslips.length === 0 ? (
                  <p className="text-sm text-text-2 p-4">No payslips yet — run payroll for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="text-left text-gold-dark text-[10px] uppercase">
                          <th className="p-2.5">Employee</th>
                          <th className="p-2.5">Gross</th>
                          <th className="p-2.5">PAYE</th>
                          <th className="p-2.5">NSSF (Emp.)</th>
                          <th className="p-2.5">Net Pay</th>
                          <th className="p-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.payslips.map((p) => (
                          <Fragment key={p.id}>
                            <tr className="border-t border-surface-2">
                              <td className="p-2.5">
                                {p.employee.firstName} {p.employee.lastName}
                                <div className="text-[10px] text-text-2">{p.employee.employeeNumber} · {p.employee.jobTitle}</div>
                              </td>
                              <td className="p-2.5">{ugx(p.grossPayUgx)}</td>
                              <td className="p-2.5">{ugx(p.payeTaxUgx)}</td>
                              <td className="p-2.5">{ugx(p.nssfEmployeeUgx)}</td>
                              <td className="p-2.5 text-gold-light">{ugx(p.netPayUgx)}</td>
                              <td className="p-2.5">
                                <button className="text-gold-light text-[11px] underline" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                                  {expanded === p.id ? 'Hide' : 'Breakdown'}
                                </button>
                              </td>
                            </tr>
                            {expanded === p.id && (
                              <tr className="border-t border-surface-2 bg-surface-2">
                                <td colSpan={6} className="p-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                    <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Basic Salary</div>{ugx(p.basicSalaryUgx)}</div>
                                    <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Allowances (taxable)</div>{ugx(p.taxableAllowancesUgx)}</div>
                                    <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Allowances (non-taxable)</div>{ugx(p.nonTaxableAllowancesUgx)}</div>
                                    <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Overtime</div>{ugx(p.overtimeUgx)}</div>
                                    <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">Bonus</div>{ugx(p.bonusUgx)}</div>
                                    <div><div className="text-text-2 uppercase text-[9.5px] mb-0.5">PAYE Tax</div>{ugx(p.payeTaxUgx)}</div>
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
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
