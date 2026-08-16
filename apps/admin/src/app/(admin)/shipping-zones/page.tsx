'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, ButtonGold, ButtonOutline, ButtonGhost } from '@/components/ui';

interface ShippingZoneDto {
  id: string;
  name: string;
  towns: string[];
  isDefault: boolean;
  standardFeeUgx: number | null;
  expressFeeUgx: number | null;
  sameDayFeeUgx: number | null;
  sortOrder: number;
}

interface FormState {
  name: string;
  townsText: string;
  isDefault: boolean;
  standardFeeUgx: string;
  expressFeeUgx: string;
  sameDayFeeUgx: string;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  townsText: '',
  isDefault: false,
  standardFeeUgx: '',
  expressFeeUgx: '',
  sameDayFeeUgx: '',
  sortOrder: '0',
};

function errorMessage(data: unknown, fallback: string) {
  const message = (data as { message?: unknown } | null)?.message;
  return Array.isArray(message) ? message.join(', ') : (typeof message === 'string' ? message : fallback);
}

function fmtFee(feeUgx: number | null) {
  if (feeUgx == null) return 'Not offered';
  return feeUgx === 0 ? 'Free' : `UGX ${feeUgx.toLocaleString()}`;
}

// Parses a fee field's text back to what the API expects: '' -> null (not
// offered, per the schema comment on ShippingZone), otherwise the integer.
function parseFee(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toForm(zone: ShippingZoneDto): FormState {
  return {
    name: zone.name,
    townsText: zone.towns.join(', '),
    isDefault: zone.isDefault,
    standardFeeUgx: zone.standardFeeUgx?.toString() ?? '',
    expressFeeUgx: zone.expressFeeUgx?.toString() ?? '',
    sameDayFeeUgx: zone.sameDayFeeUgx?.toString() ?? '',
    sortOrder: zone.sortOrder.toString(),
  };
}

const inputClass = 'bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]';

// Admin-managed shipping pricing (per user decision, not in the original
// SRS) — CheckoutService prices every order by matching the shipping
// address's city against a zone's `towns` list, then applying that zone's
// per-delivery-method fee (see ShippingZonesService). Editing rates here
// takes effect on the next checkout immediately, no deploy needed.
export default function ShippingZonesPage() {
  const [authed, setAuthed] = useState(true);
  const [zones, setZones] = useState<ShippingZoneDto[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    authedFetch('/admin/shipping-zones').then((r) => (r.ok ? r.json() : [])).then(setZones);
  }

  useEffect(() => {
    setAuthed(!!getAccessToken());
    load();
  }, []);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: (zones?.length ?? 0) === 0, sortOrder: (zones?.length ?? 0).toString() });
    setError(null);
  }

  function startEdit(zone: ShippingZoneDto) {
    setEditingId(zone.id);
    setForm(toForm(zone));
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) {
      setError('Zone name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        towns: form.townsText.split(',').map((t) => t.trim()).filter(Boolean),
        isDefault: form.isDefault,
        standardFeeUgx: parseFee(form.standardFeeUgx),
        expressFeeUgx: parseFee(form.expressFeeUgx),
        sameDayFeeUgx: parseFee(form.sameDayFeeUgx),
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = await authedFetch(editingId ? `/admin/shipping-zones/${editingId}` : '/admin/shipping-zones', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, 'Could not save this zone.'));
        return;
      }
      setForm(null);
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(zone: ShippingZoneDto) {
    if (!confirm(`Remove the "${zone.name}" shipping zone?`)) return;
    const res = await authedFetch(`/admin/shipping-zones/${zone.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(errorMessage(data, 'Could not remove this zone.'));
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-1">Shipping Zones</h1>
      <p className="text-xs text-text-2 mb-3.5">
        Shipping is charged automatically by destination + delivery method — a customer&apos;s City is matched
        against each zone&apos;s town list below; unmatched cities fall back to whichever zone is marked Default.
        Leave a fee blank to switch that delivery method off for a zone.
      </p>

      {!authed && (
        <Card className="mb-4">
          <p className="text-sm text-text-2">
            <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager to manage shipping zones.
          </p>
        </Card>
      )}

      {authed && (
        <Card className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-[10px] uppercase text-text-2">Zones</div>
            {!form && <ButtonGold onClick={startAdd} className="px-2.5 py-1.5">+ Add Zone</ButtonGold>}
          </div>

          {form && (
            <form onSubmit={save} className="flex flex-col gap-2.5 mb-4 border border-[#CBDCC1] rounded-md p-3">
              <input required placeholder="Zone name (e.g. Kampala Metro)" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              <div>
                <label className="text-[10px] uppercase text-text-2 mb-1 block">Towns / cities (comma-separated)</label>
                <textarea placeholder="Kampala, Nakawa, Kawempe, Ntinda…" value={form.townsText} rows={2}
                  onChange={(e) => setForm({ ...form, townsText: e.target.value })}
                  className={`${inputClass} w-full resize-none`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] uppercase text-text-2 mb-1 block">Standard fee (UGX)</label>
                  <input placeholder="Not offered" value={form.standardFeeUgx}
                    onChange={(e) => setForm({ ...form, standardFeeUgx: e.target.value })} className={`${inputClass} w-full`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-text-2 mb-1 block">Express fee (UGX)</label>
                  <input placeholder="Not offered" value={form.expressFeeUgx}
                    onChange={(e) => setForm({ ...form, expressFeeUgx: e.target.value })} className={`${inputClass} w-full`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-text-2 mb-1 block">Same-day fee (UGX)</label>
                  <input placeholder="Not offered" value={form.sameDayFeeUgx}
                    onChange={(e) => setForm({ ...form, sameDayFeeUgx: e.target.value })} className={`${inputClass} w-full`} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-text-2">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
                  Default zone (fallback for unmatched cities)
                </label>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] uppercase text-text-2">Sort order</label>
                  <input value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className={`${inputClass} w-16`} />
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <ButtonGold type="submit" disabled={saving} className="px-3 py-1.5">
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Zone'}
                </ButtonGold>
                <ButtonGhost type="button" onClick={() => { setForm(null); setEditingId(null); setError(null); }}>
                  Cancel
                </ButtonGhost>
              </div>
            </form>
          )}

          {!zones ? (
            <p className="text-sm text-text-2">Loading…</p>
          ) : zones.length === 0 ? (
            <p className="text-sm text-text-2">No shipping zones configured yet — checkout can&apos;t price delivery until at least one exists.</p>
          ) : (
            <div className="space-y-2.5">
              {zones.map((zone) => (
                <div key={zone.id} className="border border-[#CBDCC1] rounded-md p-3">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{zone.name}</span>
                      {zone.isDefault && <Chip gold>Default</Chip>}
                    </div>
                    <div className="flex gap-1.5">
                      <ButtonOutline onClick={() => startEdit(zone)} className="px-2 py-1 text-[11px]">Edit</ButtonOutline>
                      <ButtonOutline onClick={() => remove(zone)} className="px-2 py-1 text-[11px] !text-danger !border-danger">Remove</ButtonOutline>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-2 mb-2">
                    {zone.towns.length > 0 ? zone.towns.join(', ') : <em>No towns listed — only matches as the default fallback</em>}
                  </div>
                  <div className="flex gap-4 text-[11.5px]">
                    <span>Standard: <b>{fmtFee(zone.standardFeeUgx)}</b></span>
                    <span>Express: <b>{fmtFee(zone.expressFeeUgx)}</b></span>
                    <span>Same-day: <b>{fmtFee(zone.sameDayFeeUgx)}</b></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
