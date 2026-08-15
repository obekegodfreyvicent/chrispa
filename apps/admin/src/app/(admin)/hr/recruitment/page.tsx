'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, Status, ButtonGold, ButtonGhost, ButtonOutline } from '@/components/ui';

interface Department {
  id: string;
  name: string;
}
interface JobPosting {
  id: string;
  title: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'FILLED';
  department: Department | null;
  _count: { applicants: number };
}
interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
  resumeUrl: string | null;
}

const POSTING_STATUS_VARIANT = { DRAFT: 'pending', OPEN: 'ok', CLOSED: 'danger', FILLED: 'ok' } as const;
const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
const STAGE_VARIANT = { APPLIED: 'pending', SCREENING: 'pending', INTERVIEW: 'pending', OFFER: 'ok', HIRED: 'ok', REJECTED: 'danger' } as const;

// HR Phase 3 — Onboarding & Recruitment
export default function RecruitmentPage() {
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [addingPosting, setAddingPosting] = useState(false);
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const [addingApplicant, setAddingApplicant] = useState(false);
  const [appForm, setAppForm] = useState({ firstName: '', lastName: '', email: '', phone: '', resumeUrl: '' });

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/job-postings').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setPostings);
    authedFetch('/hr/departments').then((r) => (r.ok ? r.json() : [])).then(setDepartments);
  }

  useRefetchOnFocus(load);

  function loadApplicants(postingId: string) {
    setSelected(postingId);
    authedFetch(`/hr/applicants?jobPostingId=${postingId}`).then((r) => (r.ok ? r.json() : [])).then(setApplicants);
  }

  async function createPosting(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch('/hr/job-postings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, departmentId: departmentId || undefined }),
    });
    setAddingPosting(false);
    setTitle('');
    setDepartmentId('');
    load();
  }

  async function setPostingStatus(id: string, status: string) {
    await authedFetch(`/hr/job-postings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function createApplicant(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await authedFetch('/hr/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobPostingId: selected, ...appForm, phone: appForm.phone || undefined, resumeUrl: appForm.resumeUrl || undefined }),
    });
    setAddingApplicant(false);
    setAppForm({ firstName: '', lastName: '', email: '', phone: '', resumeUrl: '' });
    loadApplicants(selected);
  }

  async function setStage(id: string, stage: string) {
    await authedFetch(`/hr/applicants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    if (selected) loadApplicants(selected);
  }

  async function convert(id: string) {
    if (!confirm('Convert this applicant into an employee? This creates a real Employee record and marks the posting Filled.')) return;
    const res = await authedFetch(`/hr/applicants/${id}/convert-to-employee`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      alert(body?.message ?? 'Could not convert applicant.');
      return;
    }
    if (selected) loadApplicants(selected);
    load();
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.</p></Card>;
  }
  if (forbidden) {
    return <Card><p className="text-sm text-text-2">Owner or HR Manager role required.</p></Card>;
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Recruitment</h1>
        <ButtonGold onClick={() => setAddingPosting(true)}>+ New Job Posting</ButtonGold>
      </div>

      {addingPosting && (
        <Card className="mb-4 max-w-lg">
          <form onSubmit={createPosting} className="space-y-2.5">
            <input required placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className="flex gap-2">
              <ButtonGold type="submit">Create (Draft)</ButtonGold>
              <ButtonGhost type="button" onClick={() => setAddingPosting(false)}>Cancel</ButtonGhost>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        <Card className="p-0 overflow-hidden self-start">
          {!postings ? (
            <p className="text-sm text-text-2 p-4">Loading…</p>
          ) : postings.length === 0 ? (
            <p className="text-sm text-text-2 p-4">No job postings yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-gold-dark text-[10px] uppercase">
                  <th className="p-2.5">Posting</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Applicants</th>
                </tr>
              </thead>
              <tbody>
                {postings.map((p) => (
                  <tr key={p.id} className={`border-t border-surface-2 cursor-pointer ${selected === p.id ? 'bg-surface-2' : ''}`} onClick={() => loadApplicants(p.id)}>
                    <td className="p-2.5">{p.title}<div className="text-[10px] text-text-2">{p.department?.name ?? '—'}</div></td>
                    <td className="p-2.5"><Status variant={POSTING_STATUS_VARIANT[p.status]}>{p.status}</Status></td>
                    <td className="p-2.5">{p._count.applicants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        <div>
          {!selected ? (
            <Card><p className="text-sm text-text-2">Select a job posting to see its applicants.</p></Card>
          ) : (
            <>
              <Card className="mb-3">
                <div className="text-[10px] uppercase text-text-2 mb-2">Posting Status</div>
                <div className="flex gap-1.5 flex-wrap">
                  {['DRAFT', 'OPEN', 'CLOSED', 'FILLED'].map((s) => (
                    <button key={s} onClick={() => setPostingStatus(selected, s)}>
                      <Chip gold={postings?.find((p) => p.id === selected)?.status === s}>{s}</Chip>
                    </button>
                  ))}
                </div>
              </Card>

              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] uppercase text-text-2">Applicants</div>
                <ButtonOutline onClick={() => setAddingApplicant(!addingApplicant)}>+ Add Applicant</ButtonOutline>
              </div>

              {addingApplicant && (
                <Card className="mb-3">
                  <form onSubmit={createApplicant} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input required placeholder="First name" value={appForm.firstName} onChange={(e) => setAppForm({ ...appForm, firstName: e.target.value })}
                      className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                    <input required placeholder="Last name" value={appForm.lastName} onChange={(e) => setAppForm({ ...appForm, lastName: e.target.value })}
                      className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                    <input required type="email" placeholder="Email" value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })}
                      className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                    <input placeholder="Phone" value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })}
                      className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                    <input placeholder="Resume URL" value={appForm.resumeUrl} onChange={(e) => setAppForm({ ...appForm, resumeUrl: e.target.value })}
                      className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] col-span-2" />
                    <ButtonGold type="submit" className="col-span-2">Save Applicant</ButtonGold>
                  </form>
                </Card>
              )}

              <Card className="p-0 overflow-hidden">
                {!applicants ? (
                  <p className="text-sm text-text-2 p-4">Loading…</p>
                ) : applicants.length === 0 ? (
                  <p className="text-sm text-text-2 p-4">No applicants yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <tbody>
                      {applicants.map((a) => (
                        <tr key={a.id} className="border-t border-surface-2">
                          <td className="p-2.5">
                            {a.firstName} {a.lastName}
                            <div className="text-[10px] text-text-2">{a.email}</div>
                          </td>
                          <td className="p-2.5">
                            <select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)} disabled={a.stage === 'HIRED'}
                              className="bg-white border border-[#CBDCC1] rounded-md px-2 py-1.5 text-[11px]">
                              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="p-2.5"><Status variant={STAGE_VARIANT[a.stage]}>{a.stage}</Status></td>
                          <td className="p-2.5">
                            {a.stage !== 'HIRED' && a.stage !== 'REJECTED' && (
                              <ButtonGold onClick={() => convert(a.id)}>Convert to Employee</ButtonGold>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
