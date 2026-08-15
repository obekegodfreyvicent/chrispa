'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, ButtonGold, ButtonDanger } from '@/components/ui';
import { EmployeeForm, ExistingEmployee } from '../employee-form';

interface HistoryEntry {
  id: string;
  changeType: string;
  previousValue: string | null;
  newValue: string | null;
  effectiveDate: string;
  notes: string | null;
}
interface Document {
  id: string;
  type: string;
  title: string;
  fileUrl: string;
  expiresAt: string | null;
  uploadedAt: string;
}
interface EmployeeDetail extends ExistingEmployee {
  employeeNumber: string;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  department: { id: string; name: string } | null;
  manager: { id: string; firstName: string; lastName: string; jobTitle: string } | null;
  history: HistoryEntry[];
  documents: Document[];
  user: { id: string; email: string; role: string } | null;
}
interface Goal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
}
interface Feedback {
  id: string;
  note: string;
  createdAt: string;
  givenBy: { name: string };
}
interface Review {
  id: string;
  periodStart: string;
  periodEnd: string;
  rating: number | null;
  status: 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';
}
interface Allowance {
  id: string;
  type: string;
  label: string | null;
  amountUgx: number;
  taxable: boolean;
  active: boolean;
}
interface Advance {
  id: string;
  principalUgx: number;
  balanceRemainingUgx: number;
  monthlyInstallmentUgx: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
  issuedAt: string;
  note: string | null;
}

const STATUS_OPTIONS = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'];
const DOC_TYPES = ['CONTRACT', 'ID_DOCUMENT', 'CERTIFICATE', 'PERFORMANCE_NOTE', 'OTHER'];
const ALLOWANCE_TYPES = ['HOUSING', 'TRANSPORT', 'LUNCH', 'MEDICAL', 'HARDSHIP', 'OTHER'];

function ugx(n: number) {
  return `UGX ${n.toLocaleString()}`;
}

export default function EmployeeDetailPage(props: PageProps<'/hr/employees/[id]'>) {
  const { id } = use(props.params);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ type: 'CONTRACT', title: '', fileUrl: '', expiresAt: '' });
  const [addingDoc, setAddingDoc] = useState(false);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [addingReview, setAddingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ periodStart: '', periodEnd: '', rating: '', strengths: '', areasForImprovement: '', overallComments: '' });

  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [addingAllowance, setAddingAllowance] = useState(false);
  const [allowanceForm, setAllowanceForm] = useState({ type: 'TRANSPORT', label: '', amountUgx: '', taxable: true });

  const [advances, setAdvances] = useState<Advance[]>([]);
  const [addingAdvance, setAddingAdvance] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ principalUgx: '', monthlyInstallmentUgx: '', note: '' });

  const [grantingLogin, setGrantingLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', role: 'STORE_MANAGER' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginTempPassword, setLoginTempPassword] = useState<string | null>(null);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    authedFetch(`/hr/employees/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEmployee)
      .finally(() => setLoading(false));
    authedFetch(`/hr/employees/${id}/goals`).then((r) => (r.ok ? r.json() : [])).then(setGoals);
    authedFetch(`/hr/employees/${id}/feedback`).then((r) => (r.ok ? r.json() : [])).then(setFeedback);
    authedFetch(`/hr/employees/${id}/reviews`).then((r) => (r.ok ? r.json() : [])).then(setReviews);
    authedFetch(`/hr/employees/${id}/allowances`).then((r) => (r.ok ? r.json() : [])).then(setAllowances);
    authedFetch(`/hr/employees/${id}/advances`).then((r) => (r.ok ? r.json() : [])).then(setAdvances);
  }

  async function addAllowance(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch(`/hr/employees/${id}/allowances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...allowanceForm, label: allowanceForm.label || undefined, amountUgx: Number(allowanceForm.amountUgx) }),
    });
    setAddingAllowance(false);
    setAllowanceForm({ type: 'TRANSPORT', label: '', amountUgx: '', taxable: true });
    load();
  }

  async function toggleAllowance(allowanceId: string, active: boolean) {
    await authedFetch(`/hr/employees/allowances/${allowanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    load();
  }

  async function removeAllowance(allowanceId: string) {
    if (!confirm('Remove this allowance?')) return;
    await authedFetch(`/hr/employees/allowances/${allowanceId}`, { method: 'DELETE' });
    load();
  }

  async function addAdvance(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch(`/hr/employees/${id}/advances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principalUgx: Number(advanceForm.principalUgx),
        monthlyInstallmentUgx: Number(advanceForm.monthlyInstallmentUgx),
        note: advanceForm.note || undefined,
      }),
    });
    setAddingAdvance(false);
    setAdvanceForm({ principalUgx: '', monthlyInstallmentUgx: '', note: '' });
    load();
  }

  async function cancelAdvance(advanceId: string) {
    if (!confirm('Cancel this salary advance? No further installments will be recovered.')) return;
    await authedFetch(`/hr/advances/${advanceId}/cancel`, { method: 'POST' });
    load();
  }

  async function grantLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await authedFetch(`/hr/employees/${id}/create-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setLoginError(Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? 'Could not create login.'));
      return;
    }
    setLoginTempPassword(body.temporaryPassword);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    setPerfError(null);
    const res = await authedFetch(`/hr/employees/${id}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: goalTitle }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPerfError(body?.message ?? 'Could not add goal.');
      return;
    }
    setAddingGoal(false);
    setGoalTitle('');
    load();
  }

  async function addFeedback(e: React.FormEvent) {
    e.preventDefault();
    setPerfError(null);
    const res = await authedFetch(`/hr/employees/${id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: feedbackNote }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPerfError(body?.message ?? 'Could not add feedback.');
      return;
    }
    setAddingFeedback(false);
    setFeedbackNote('');
    load();
  }

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    setPerfError(null);
    const res = await authedFetch(`/hr/employees/${id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reviewForm, rating: reviewForm.rating ? Number(reviewForm.rating) : undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPerfError(body?.message ?? 'Could not create review.');
      return;
    }
    setAddingReview(false);
    setReviewForm({ periodStart: '', periodEnd: '', rating: '', strengths: '', areasForImprovement: '', overallComments: '' });
    load();
  }

  async function submitReview(reviewId: string) {
    await authedFetch(`/hr/reviews/${reviewId}/submit`, { method: 'POST' });
    load();
  }

  useRefetchOnFocus(load);

  async function setStatus(status: string) {
    setStatusError(null);
    const res = await authedFetch(`/hr/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employmentStatus: status }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setStatusError(body?.message ?? 'Could not update status.');
      return;
    }
    load();
  }

  async function addDocument(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch(`/hr/employees/${id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...docForm, expiresAt: docForm.expiresAt || undefined }),
    });
    setDocForm({ type: 'CONTRACT', title: '', fileUrl: '', expiresAt: '' });
    setAddingDoc(false);
    load();
  }

  async function removeDocument(documentId: string) {
    if (!confirm('Remove this document?')) return;
    await authedFetch(`/hr/employees/documents/${documentId}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <p className="text-sm text-text-2">Loading…</p>;

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.
        </p>
      </Card>
    );
  }
  if (!employee) {
    return (
      <Card>
        <p className="text-sm text-text-2">Employee not found.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="font-serif text-xl">{employee.firstName} {employee.lastName}</h1>
          <p className="text-[11px] text-text-2">{employee.employeeNumber} · {employee.jobTitle}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Chip gold={employee.employmentStatus === 'ACTIVE'}>{employee.employmentStatus.replace('_', ' ')}</Chip>
          <Link href={`/hr/employees/${id}/id-card`}>
            <ButtonGold>Staff ID Card</ButtonGold>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          <EmployeeForm existing={employee} onSaved={load} />

          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-2">Employment History</div>
            {employee.history.length === 0 ? (
              <p className="text-sm text-text-2">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {employee.history.map((h) => (
                  <li key={h.id} className="text-[11.5px] border-b border-surface-2 pb-2 last:border-0">
                    <span className="text-gold-dark">{h.changeType.replace('_', ' ')}</span>
                    {h.previousValue || h.newValue ? (
                      <span className="text-text-2"> — {h.previousValue ?? '—'} → {h.newValue ?? '—'}</span>
                    ) : null}
                    <div className="text-[10px] text-text-2">{new Date(h.effectiveDate).toLocaleDateString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase text-text-2">Documents</div>
              <button onClick={() => setAddingDoc(!addingDoc)} className="text-[11px] text-gold-light">+ Add Document</button>
            </div>
            {addingDoc && (
              <form onSubmit={addDocument} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 bg-surface-2 p-2.5 rounded-md">
                <select value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
                <input required placeholder="Title" value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <input required placeholder="File URL" value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2" />
                <input type="date" placeholder="Expires (optional)" value={docForm.expiresAt} onChange={(e) => setDocForm({ ...docForm, expiresAt: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <ButtonGold type="submit">Save</ButtonGold>
              </form>
            )}
            {employee.documents.length === 0 ? (
              <p className="text-sm text-text-2">No documents yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <tbody>
                  {employee.documents.map((d) => (
                    <tr key={d.id} className="border-t border-surface-2">
                      <td className="py-2"><Chip>{d.type.replace('_', ' ')}</Chip></td>
                      <td className="py-2">{d.title}</td>
                      <td className="py-2 text-text-2">{d.expiresAt ? `Expires ${new Date(d.expiresAt).toLocaleDateString()}` : ''}</td>
                      <td className="py-2"><button onClick={() => removeDocument(d.id)} className="text-danger">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase text-text-2">Allowances</div>
              <button onClick={() => setAddingAllowance(!addingAllowance)} className="text-[11px] text-gold-light">+ Add Allowance</button>
            </div>
            {addingAllowance && (
              <form onSubmit={addAllowance} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 bg-surface-2 p-2.5 rounded-md">
                <select value={allowanceForm.type} onChange={(e) => setAllowanceForm({ ...allowanceForm, type: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                  {ALLOWANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input placeholder="Label (optional)" value={allowanceForm.label} onChange={(e) => setAllowanceForm({ ...allowanceForm, label: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <input required type="number" min={1} placeholder="Amount (UGX)" value={allowanceForm.amountUgx}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, amountUgx: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <label className="flex items-center gap-1.5 text-[11px] text-text-2">
                  <input type="checkbox" checked={allowanceForm.taxable} onChange={(e) => setAllowanceForm({ ...allowanceForm, taxable: e.target.checked })} />
                  Taxable
                </label>
                <ButtonGold type="submit" className="col-span-2">Save</ButtonGold>
              </form>
            )}
            {allowances.length === 0 ? (
              <p className="text-sm text-text-2">No allowances yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <tbody>
                  {allowances.map((a) => (
                    <tr key={a.id} className="border-t border-surface-2">
                      <td className="py-2"><Chip>{a.type}</Chip></td>
                      <td className="py-2">{a.label ?? '—'}</td>
                      <td className="py-2">{ugx(a.amountUgx)}</td>
                      <td className="py-2 text-text-2">{a.taxable ? 'Taxable' : 'Non-taxable'}</td>
                      <td className="py-2">
                        <button onClick={() => toggleAllowance(a.id, !a.active)} className="text-gold-light mr-2">
                          {a.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => removeAllowance(a.id)} className="text-danger">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase text-text-2">Salary Advances</div>
              <button onClick={() => setAddingAdvance(!addingAdvance)} className="text-[11px] text-gold-light">+ Add Advance</button>
            </div>
            {addingAdvance && (
              <form onSubmit={addAdvance} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 bg-surface-2 p-2.5 rounded-md">
                <input required type="number" min={1} placeholder="Principal (UGX)" value={advanceForm.principalUgx}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, principalUgx: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <input required type="number" min={1} placeholder="Monthly installment (UGX)" value={advanceForm.monthlyInstallmentUgx}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, monthlyInstallmentUgx: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <input placeholder="Note (optional)" value={advanceForm.note} onChange={(e) => setAdvanceForm({ ...advanceForm, note: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2" />
                <ButtonGold type="submit" className="col-span-2">Save</ButtonGold>
              </form>
            )}
            {advances.length === 0 ? (
              <p className="text-sm text-text-2">No salary advances yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <tbody>
                  {advances.map((a) => (
                    <tr key={a.id} className="border-t border-surface-2">
                      <td className="py-2">{ugx(a.principalUgx)}</td>
                      <td className="py-2">Balance: {ugx(a.balanceRemainingUgx)}</td>
                      <td className="py-2 text-text-2">{ugx(a.monthlyInstallmentUgx)}/mo</td>
                      <td className="py-2"><Chip gold={a.status === 'ACTIVE'}>{a.status.replace('_', ' ')}</Chip></td>
                      <td className="py-2">
                        {a.status === 'ACTIVE' && <button onClick={() => cancelAdvance(a.id)} className="text-danger">Cancel</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-2">Performance</div>
            {perfError && <p className="text-xs text-danger mb-2">{perfError}</p>}

            <div className="flex justify-between items-center mb-1.5">
              <b className="text-[11px]">Goals</b>
              <button onClick={() => setAddingGoal(!addingGoal)} className="text-[11px] text-gold-light">+ Add</button>
            </div>
            {addingGoal && (
              <form onSubmit={addGoal} className="flex gap-2 mb-2">
                <input required placeholder="Goal title" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)}
                  className="flex-1 bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <ButtonGold type="submit">Save</ButtonGold>
              </form>
            )}
            {goals.length === 0 ? <p className="text-[11px] text-text-2 mb-3">No goals yet.</p> : (
              <ul className="mb-3 space-y-1">
                {goals.map((g) => (
                  <li key={g.id} className="text-[11px] flex justify-between border-b border-surface-2 pb-1">
                    <span>{g.title}</span><span className="text-text-2">{g.progressPercent}%</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-between items-center mb-1.5">
              <b className="text-[11px]">Feedback</b>
              <button onClick={() => setAddingFeedback(!addingFeedback)} className="text-[11px] text-gold-light">+ Add</button>
            </div>
            {addingFeedback && (
              <form onSubmit={addFeedback} className="flex gap-2 mb-2">
                <input required placeholder="Feedback note" value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)}
                  className="flex-1 bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <ButtonGold type="submit">Save</ButtonGold>
              </form>
            )}
            {feedback.length === 0 ? <p className="text-[11px] text-text-2 mb-3">No feedback yet.</p> : (
              <ul className="mb-3 space-y-1">
                {feedback.map((f) => (
                  <li key={f.id} className="text-[11px] text-text-2 border-b border-surface-2 pb-1">&ldquo;{f.note}&rdquo; — {f.givenBy.name}</li>
                ))}
              </ul>
            )}

            <div className="flex justify-between items-center mb-1.5">
              <b className="text-[11px]">Reviews</b>
              <button onClick={() => setAddingReview(!addingReview)} className="text-[11px] text-gold-light">+ New</button>
            </div>
            {addingReview && (
              <form onSubmit={addReview} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 bg-surface-2 p-2.5 rounded-md">
                <input required type="date" value={reviewForm.periodStart} onChange={(e) => setReviewForm({ ...reviewForm, periodStart: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <input required type="date" value={reviewForm.periodEnd} onChange={(e) => setReviewForm({ ...reviewForm, periodEnd: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <input type="number" min={1} max={5} placeholder="Rating (1-5)" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2" />
                <textarea placeholder="Strengths" value={reviewForm.strengths} onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2 h-12" />
                <textarea placeholder="Areas for improvement" value={reviewForm.areasForImprovement} onChange={(e) => setReviewForm({ ...reviewForm, areasForImprovement: e.target.value })}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2 h-12" />
                <ButtonGold type="submit" className="col-span-2">Save Draft</ButtonGold>
              </form>
            )}
            {reviews.length === 0 ? <p className="text-[11px] text-text-2">No reviews yet.</p> : (
              <ul className="space-y-1.5">
                {reviews.map((r) => (
                  <li key={r.id} className="text-[11px] flex justify-between items-center border-b border-surface-2 pb-1.5">
                    <span>{new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1.5">
                      <Chip>{r.status}</Chip>
                      {r.status === 'DRAFT' && <button onClick={() => submitReview(r.id)} className="text-gold-light">Submit</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-2">Status</div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => setStatus(s)} disabled={s === employee.employmentStatus}>
                  <Chip gold={s === employee.employmentStatus}>{s.replace('_', ' ')}</Chip>
                </button>
              ))}
            </div>
            {statusError && <p className="text-xs text-danger">{statusError}</p>}
            {employee.employmentStatus !== 'TERMINATED' && (
              <ButtonDanger className="w-full mt-2" onClick={() => setStatus('TERMINATED')}>
                Terminate Employment
              </ButtonDanger>
            )}
            <small className="block text-[10px] text-text-2 mt-2">
              Terminating never deletes the record — retained for compliance.
            </small>
          </Card>
          {employee.manager && (
            <Card className="mt-4">
              <div className="text-[10px] uppercase text-text-2 mb-1">Reports To</div>
              <div className="text-xs">{employee.manager.firstName} {employee.manager.lastName}</div>
              <div className="text-[11px] text-text-2">{employee.manager.jobTitle}</div>
            </Card>
          )}

          <Card className="mt-4">
            <div className="text-[10px] uppercase text-text-2 mb-2">System Login</div>
            {employee.user ? (
              <>
                <div className="text-xs">{employee.user.email}</div>
                <div className="text-[11px] text-text-2">{employee.user.role.replace('_', ' ')}</div>
              </>
            ) : loginTempPassword ? (
              <>
                <p className="text-[11px] mb-2">
                  Share this one-time password securely — it won&apos;t be shown again. They must set their own on first login.
                </p>
                <div className="bg-surface-2 rounded-md px-2.5 py-2 flex items-center justify-between">
                  <code className="text-[13px] font-semibold tracking-wide">{loginTempPassword}</code>
                  <button type="button" className="text-[11px] text-gold-light" onClick={() => navigator.clipboard?.writeText(loginTempPassword)}>
                    Copy
                  </button>
                </div>
              </>
            ) : grantingLogin ? (
              <form onSubmit={grantLogin} className="space-y-2">
                <input required type="email" placeholder="Login email" value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <select value={loginForm.role} onChange={(e) => setLoginForm({ ...loginForm, role: e.target.value })}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                  <option value="STORE_MANAGER">Store Manager</option>
                  <option value="FULFILLMENT">Fulfillment</option>
                  <option value="SUPPORT_AGENT">Support Agent</option>
                  <option value="HR_MANAGER">HR Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
                {loginError && <p className="text-xs text-danger">{loginError}</p>}
                <ButtonGold type="submit">Create Login</ButtonGold>
              </form>
            ) : (
              <>
                <p className="text-[11px] text-text-2 mb-2">This employee has no system login yet.</p>
                <ButtonGold onClick={() => setGrantingLogin(true)}>Grant System Login</ButtonGold>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
