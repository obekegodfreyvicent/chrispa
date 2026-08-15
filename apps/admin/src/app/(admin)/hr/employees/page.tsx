'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, ButtonGold, Status } from '@/components/ui';

interface Department {
  id: string;
  name: string;
}
interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  department: Department | null;
}

const STATUS_VARIANT = { ACTIVE: 'ok', ON_LEAVE: 'pending', SUSPENDED: 'danger', TERMINATED: 'danger' } as const;

// HR Phase 1: Centralized Employee Profiles
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (departmentId) params.set('departmentId', departmentId);
    if (status) params.set('status', status);
    authedFetch(`/hr/employees?${params}`).then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setEmployees);
    authedFetch('/hr/departments').then((r) => (r.ok ? r.json() : [])).then(setDepartments);
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.
        </p>
      </Card>
    );
  }
  if (forbidden) {
    return (
      <Card>
        <p className="text-sm text-text-2">Owner or HR Manager role required.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Employees</h1>
        <Link href="/hr/employees/new">
          <ButtonGold>+ Add Employee</ButtonGold>
        </Link>
      </div>
      <div className="flex gap-2 mb-3.5">
        <input
          placeholder="Search name, ID, title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-56"
        />
        <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setTimeout(load, 0); }}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
          <option value="">Department: All</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setTimeout(load, 0); }}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
          <option value="">Status: All</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="TERMINATED">Terminated</option>
        </select>
        <button onClick={load} className="text-[11px] text-gold-light">Search</button>
      </div>
      <Card className="p-0 overflow-hidden">
        {!employees ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No employees found.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Employee</th>
                <th className="p-2.5">ID</th>
                <th className="p-2.5">Job Title</th>
                <th className="p-2.5">Department</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-surface-2">
                  <td className="p-2.5">{e.firstName} {e.lastName}</td>
                  <td className="p-2.5">{e.employeeNumber}</td>
                  <td className="p-2.5">{e.jobTitle}</td>
                  <td className="p-2.5">{e.department?.name ?? '—'}</td>
                  <td className="p-2.5">
                    <Status variant={STATUS_VARIANT[e.employmentStatus]}>{e.employmentStatus.replace('_', ' ')}</Status>
                  </td>
                  <td className="p-2.5">
                    <Link href={`/hr/employees/${e.id}`} className="text-gold-light">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
