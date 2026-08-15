'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/auth-client';
import { Card, ButtonGold } from '@/components/ui';

interface Department {
  id: string;
  name: string;
}

export interface ExistingEmployee {
  id: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  personalPhone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationalIdNumber: string | null;
  address: string | null;
  departmentId: string | null;
  jobTitle: string;
  employmentType: string;
  hireDate: string;
  baseSalaryUgx: number | null;
  nssfNumber: string | null;
  tinNumber: string | null;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

const STAFF_ROLES = [
  { value: 'STORE_MANAGER', label: 'Store Manager' },
  { value: 'FULFILLMENT', label: 'Fulfillment' },
  { value: 'SUPPORT_AGENT', label: 'Support Agent' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'OWNER', label: 'Owner' },
];

export function EmployeeForm({ existing, onSaved }: { existing?: ExistingEmployee; onSaved?: () => void }) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [personalEmail, setPersonalEmail] = useState(existing?.personalEmail ?? '');
  const [personalPhone, setPersonalPhone] = useState(existing?.personalPhone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(toDateInput(existing?.dateOfBirth ?? null));
  const [gender, setGender] = useState(existing?.gender ?? '');
  const [nationalIdNumber, setNationalIdNumber] = useState(existing?.nationalIdNumber ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [departmentId, setDepartmentId] = useState(existing?.departmentId ?? '');
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle ?? '');
  const [employmentType, setEmploymentType] = useState(existing?.employmentType ?? 'FULL_TIME');
  const [hireDate, setHireDate] = useState(toDateInput(existing?.hireDate ?? null) || new Date().toISOString().slice(0, 10));
  const [baseSalaryUgx, setBaseSalaryUgx] = useState(existing?.baseSalaryUgx?.toString() ?? '');
  const [nssfNumber, setNssfNumber] = useState(existing?.nssfNumber ?? '');
  const [tinNumber, setTinNumber] = useState(existing?.tinNumber ?? '');

  const [createLogin, setCreateLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginRole, setLoginRole] = useState('STORE_MANAGER');

  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  useEffect(() => {
    authedFetch('/hr/departments').then((r) => (r.ok ? r.json() : [])).then(setDepartments);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body = {
      firstName,
      lastName,
      personalEmail: personalEmail || undefined,
      personalPhone: personalPhone || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      nationalIdNumber: nationalIdNumber || undefined,
      address: address || undefined,
      departmentId: departmentId || undefined,
      jobTitle,
      employmentType,
      hireDate,
      baseSalaryUgx: baseSalaryUgx ? Number(baseSalaryUgx) : undefined,
      nssfNumber: nssfNumber || undefined,
      tinNumber: tinNumber || undefined,
      ...(!existing && createLogin ? { loginEmail, loginRole } : {}),
    };
    try {
      const res = await authedFetch(existing ? `/hr/employees/${existing.id}` : '/hr/employees', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => null);
      if (!res.ok) {
        setError(Array.isArray(resBody?.message) ? resBody.message.join(', ') : (resBody?.message ?? 'Could not save employee.'));
        return;
      }
      if (existing) {
        onSaved?.();
      } else if (resBody.temporaryPassword) {
        // Shown once — never retrievable again — so hold here instead of
        // navigating away immediately.
        setCreatedEmployeeId(resBody.id);
        setTemporaryPassword(resBody.temporaryPassword);
      } else {
        router.push(`/hr/employees/${resBody.id}`);
      }
    } finally {
      setPending(false);
    }
  }

  if (temporaryPassword && createdEmployeeId) {
    return (
      <Card>
        <div className="text-[10px] uppercase text-gold-dark mb-2">System Login Created</div>
        <p className="text-[11.5px] mb-3">
          Share this one-time password with {firstName} {lastName} through a secure channel — it won&apos;t be shown again.
          They&apos;ll be required to set their own password the moment they log in.
        </p>
        <div className="bg-surface-2 rounded-md px-3 py-2.5 mb-3 flex items-center justify-between">
          <code className="text-sm font-semibold tracking-wide">{temporaryPassword}</code>
          <button
            type="button"
            className="text-[11px] text-gold-light"
            onClick={() => navigator.clipboard?.writeText(temporaryPassword)}
          >
            Copy
          </button>
        </div>
        <ButtonGold onClick={() => router.push(`/hr/employees/${createdEmployeeId}`)}>
          Continue to Employee Profile
        </ButtonGold>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="text-[10px] uppercase text-text-2">Personal Information</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="Personal email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="Personal phone" value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <div>
            <label className="text-[10px] text-text-2 block mb-1">Date of birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          </div>
          <select value={gender} onChange={(e) => setGender(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
            <option value="">Gender — prefer not to say</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
          <input placeholder="National ID number" value={nationalIdNumber} onChange={(e) => setNationalIdNumber(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
        </div>

        <div className="text-[10px] uppercase text-text-2 pt-2">Employment</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input required placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </select>
          <div>
            <label className="text-[10px] text-text-2 block mb-1">Hire date</label>
            <input required type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          </div>
        </div>

        <div className="text-[10px] uppercase text-text-2 pt-2">Payroll</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input placeholder="Base salary (UGX)" type="number" min={0} value={baseSalaryUgx} onChange={(e) => setBaseSalaryUgx(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="NSSF number" value={nssfNumber} onChange={(e) => setNssfNumber(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="TIN" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
        </div>

        {!existing && (
          <>
            <label className="flex items-center gap-2 text-[11px] text-text-2 pt-2">
              <input type="checkbox" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} />
              Create a system login for this employee
            </label>
            {createLogin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-surface-2 p-2.5 rounded-md">
                <input required type="email" placeholder="Login email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
                <select value={loginRole} onChange={(e) => setLoginRole(e.target.value)}
                  className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                  {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <p className="text-[10.5px] text-text-2 col-span-2">
                  A one-time password will be generated — you&apos;ll see it once, right after saving, to pass on securely.
                  They must set their own password on first login.
                </p>
              </div>
            )}
          </>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
        <ButtonGold type="submit" disabled={pending}>
          {pending ? 'Saving…' : existing ? 'Save Changes' : 'Create Employee'}
        </ButtonGold>
      </form>
    </Card>
  );
}
