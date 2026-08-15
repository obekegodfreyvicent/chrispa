'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, ButtonGold } from '@/components/ui';

interface Profile {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  personalEmail: string | null;
  personalPhone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  department: { name: string } | null;
}

// HR Phase 3 — Self-Service Portal: profile. Job title/department/salary
// stay HR-controlled (see EmployeesController); payslips live on their own
// page (/my-hr/payslips, Phase 4), not here.
export default function MyProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ personalEmail: '', personalPhone: '', address: '', dateOfBirth: '', gender: '' });

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/profile').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return null;
      }
      return r.ok ? r.json() : null;
    }).then((p: Profile | null) => {
      if (p) {
        setProfile(p);
        setForm({
          personalEmail: p.personalEmail ?? '',
          personalPhone: p.personalPhone ?? '',
          address: p.address ?? '',
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
          gender: p.gender ?? '',
        });
      }
    });
  }

  useRefetchOnFocus(load);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const res = await authedFetch('/hr/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, dateOfBirth: form.dateOfBirth || undefined }),
    });
    if (res.ok) {
      setSaved(true);
      load();
    }
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to view your profile.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }
  if (!profile) return <p className="text-sm text-text-2">Loading…</p>;

  return (
    <div>
      <h1 className="font-serif text-xl mb-1">My Profile</h1>
      <p className="text-[11px] text-text-2 mb-3.5">
        {profile.employeeNumber} · {profile.jobTitle} · {profile.department?.name ?? 'No department'}
      </p>

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="text-[10px] uppercase text-text-2">
            Job title, department, and salary are managed by HR — contact them for changes there.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input placeholder="Personal email" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Personal phone" value={form.personalPhone} onChange={(e) => setForm({ ...form, personalPhone: e.target.value })}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          </div>
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-text-2 block mb-1">Date of birth</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mt-auto">
              <option value="">Gender — prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {saved && <p className="text-xs text-gold-light">Saved.</p>}
          <ButtonGold type="submit">Save Changes</ButtonGold>
        </form>
      </Card>
    </div>
  );
}
