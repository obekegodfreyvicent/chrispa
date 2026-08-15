'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, ButtonGold, ButtonGhost } from '@/components/ui';

interface Address {
  id: string;
  label: string;
  recipient: string;
  line1: string;
  city: string;
  phone: string;
  type: 'SHIPPING' | 'BILLING';
  isDefault: boolean;
}

type AddressForm = { label: string; recipient: string; line1: string; city: string; phone: string; type: 'SHIPPING' | 'BILLING'; isDefault: boolean };
const emptyForm: AddressForm = { label: '', recipient: '', line1: '', city: 'Kampala', phone: '', type: 'SHIPPING', isDefault: false };

// FR-13: Address Book
export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);

  function load() {
    authedFetch('/account/addresses').then((r) => (r.ok ? r.json() : [])).then(setAddresses);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    load();
  }, []);

  function startEdit(address: Address | 'new') {
    setEditing(address);
    setForm(address === 'new' ? emptyForm : { ...address });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await authedFetch(editing === 'new' ? '/account/addresses' : `/account/addresses/${(editing as Address).id}`, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(null);
        load();
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this address?')) return;
    await authedFetch(`/account/addresses/${id}`, { method: 'DELETE' });
    load();
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> to manage your addresses.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Address Book</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {addresses?.map((a) => (
          <Card key={a.id}>
            <div className="flex justify-between">
              <b className="text-xs">{a.label}</b>
              {a.isDefault ? <Chip gold>Default {a.type === 'SHIPPING' ? 'Shipping' : 'Billing'}</Chip> : <Chip>{a.type === 'SHIPPING' ? 'Shipping' : 'Billing'}</Chip>}
            </div>
            <p className="text-[11.5px] text-text-2 my-2">
              {a.recipient}<br />{a.line1}<br />{a.city}, Uganda<br />{a.phone}
            </p>
            <div className="flex gap-2">
              <ButtonGhost onClick={() => startEdit(a)}>Edit</ButtonGhost>
              <button onClick={() => remove(a.id)} className="text-danger text-xs">Delete</button>
            </div>
          </Card>
        ))}
        <Card className="flex flex-col items-center justify-center text-text-2 cursor-pointer" onClick={() => startEdit('new')}>
          <div className="text-2xl">＋</div>
          <small className="text-[10px]">Add New Address</small>
        </Card>
      </div>

      {editing && (
        <Card className="mt-4 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input required placeholder="Label (e.g. Home)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'SHIPPING' | 'BILLING' })}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                <option value="SHIPPING">Shipping</option>
                <option value="BILLING">Billing</option>
              </select>
            </div>
            <input required placeholder="Recipient name" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input required placeholder="Address" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-text-2">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Set as default {form.type === 'SHIPPING' ? 'shipping' : 'billing'} address
            </label>
            <div className="flex gap-2">
              <ButtonGold type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save Address'}</ButtonGold>
              <ButtonGhost type="button" onClick={() => setEditing(null)}>Cancel</ButtonGhost>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
