'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, ButtonGold, ButtonGhost, ButtonOutline } from '@/components/ui';

type Resource =
  | 'PRODUCTS' | 'ORDERS' | 'INVENTORY' | 'CUSTOMERS' | 'MARKETING' | 'CMS' | 'SETTINGS'
  | 'HR_DASHBOARD' | 'HR_EMPLOYEES' | 'HR_ATTENDANCE' | 'HR_LEAVE' | 'HR_SHIFTS' | 'HR_RECRUITMENT' | 'HR_PAYROLL' | 'HR_PERFORMANCE';

interface Permission {
  resource: Resource;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExecute: boolean;
}
interface Department {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number };
  permissions: Permission[];
}

const ACTIONS: { key: keyof Omit<Permission, 'resource'>; label: string }[] = [
  { key: 'canView', label: 'View' },
  { key: 'canCreate', label: 'Create' },
  { key: 'canUpdate', label: 'Update' },
  { key: 'canDelete', label: 'Delete' },
  { key: 'canExecute', label: 'Execute' },
];

const RESOURCE_GROUPS: { title: string; resources: { key: Resource; label: string }[] }[] = [
  {
    title: 'Admin / Backend',
    resources: [
      { key: 'PRODUCTS', label: 'Product Manager' },
      { key: 'ORDERS', label: 'Order Management' },
      { key: 'INVENTORY', label: 'Inventory' },
      { key: 'CUSTOMERS', label: 'Customers (CRM)' },
      { key: 'MARKETING', label: 'Marketing & Promos' },
      { key: 'CMS', label: 'CMS / Site Builder' },
      { key: 'SETTINGS', label: 'Users & Settings' },
    ],
  },
  {
    title: 'Human Resources',
    resources: [
      { key: 'HR_DASHBOARD', label: 'HR Dashboard' },
      { key: 'HR_EMPLOYEES', label: 'Employees' },
      { key: 'HR_ATTENDANCE', label: 'Attendance' },
      { key: 'HR_LEAVE', label: 'Leave Requests' },
      { key: 'HR_SHIFTS', label: 'Shift Scheduling' },
      { key: 'HR_RECRUITMENT', label: 'Recruitment' },
      { key: 'HR_PAYROLL', label: 'Payroll' },
      { key: 'HR_PERFORMANCE', label: 'Performance' },
    ],
  },
];

// HR Phase 1 (Departments) + policy/permissions extension: each department
// carries a stored, editable permission matrix — what it's "meant to
// operate" — surfaced here. This is a policy record for documentation and
// admin configuration; the API's actual access control is still the
// tested @Roles()/RolesGuard checks on UserRole (see CLAUDE.md).
export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<Resource, Permission> | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/departments').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setDepartments);
  }

  useRefetchOnFocus(load);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch('/hr/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined }),
      });
      if (res.ok) {
        setAdding(false);
        setName('');
        setDescription('');
        load();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? 'Could not create department.');
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(dept: Department) {
    if (!confirm(`Delete "${dept.name}"?`)) return;
    const res = await authedFetch(`/hr/departments/${dept.id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.message ?? 'Could not delete department.');
    }
  }

  function openPermissions(dept: Department) {
    if (editingId === dept.id) {
      setEditingId(null);
      setDraft(null);
      return;
    }
    setEditingId(dept.id);
    setDraft(Object.fromEntries(dept.permissions.map((p) => [p.resource, p])) as Record<Resource, Permission>);
  }

  function toggle(resource: Resource, action: keyof Omit<Permission, 'resource'>) {
    if (!draft) return;
    setDraft({ ...draft, [resource]: { ...draft[resource], [action]: !draft[resource][action] } });
  }

  async function savePermissions(deptId: string) {
    if (!draft) return;
    setSavingPermissions(true);
    const res = await authedFetch(`/hr/departments/${deptId}/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: Object.values(draft) }),
    });
    setSavingPermissions(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(body?.message ?? 'Could not save permissions.');
      return;
    }
    setEditingId(null);
    setDraft(null);
    load();
  }

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
        <h1 className="font-serif text-xl">Departments</h1>
        <ButtonGold onClick={() => setAdding(true)}>+ Add Department</ButtonGold>
      </div>

      {adding && (
        <Card className="mb-4 max-w-lg">
          <form onSubmit={handleAdd} className="space-y-2.5">
            <input required placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <p className="text-[10.5px] text-text-2">
              New departments start with no permissions granted — configure its policy below after creating it.
            </p>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <ButtonGold type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</ButtonGold>
              <ButtonGhost type="button" onClick={() => setAdding(false)}>Cancel</ButtonGhost>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {!departments ? (
          <p className="text-sm text-text-2">Loading…</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-text-2">No departments yet.</p>
        ) : (
          departments.map((d) => (
            <Card key={d.id}>
              <div className="flex justify-between items-start">
                <div>
                  <b className="text-xs">{d.name}</b>
                  <p className="text-[11px] text-text-2 my-1.5">{d.description ?? '—'}</p>
                  <small className="text-[10px] text-text-2">{d._count.employees} employee(s)</small>
                </div>
                <div className="flex gap-2">
                  <ButtonOutline onClick={() => openPermissions(d)}>
                    {editingId === d.id ? 'Close' : 'Policy & Permissions'}
                  </ButtonOutline>
                  <button onClick={() => handleDelete(d)} className="text-danger text-xs">Delete</button>
                </div>
              </div>

              {editingId === d.id && draft && (
                <div className="mt-3.5 pt-3.5 border-t border-surface-2">
                  {RESOURCE_GROUPS.map((group) => (
                    <div key={group.title} className="mb-4 last:mb-0">
                      <div className="text-[10px] uppercase text-gold-dark mb-1.5">{group.title}</div>
                      <div className="overflow-x-auto">
                        <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-text-2">
                              <th className="py-1 pr-2 font-normal">Resource</th>
                              {ACTIONS.map((a) => <th key={a.key} className="py-1 px-2 font-normal text-center">{a.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {group.resources.map((r) => (
                              <tr key={r.key} className="border-t border-surface-2">
                                <td className="py-1.5 pr-2">{r.label}</td>
                                {ACTIONS.map((a) => (
                                  <td key={a.key} className="py-1.5 px-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={draft[r.key]?.[a.key] ?? false}
                                      onChange={() => toggle(r.key, a.key)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  ))}
                  <ButtonGold disabled={savingPermissions} onClick={() => savePermissions(d.id)}>
                    {savingPermissions ? 'Saving…' : 'Save Permissions'}
                  </ButtonGold>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
