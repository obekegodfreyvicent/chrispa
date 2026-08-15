'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, ButtonGold, ButtonGhost } from '@/components/ui';

type PaymentMethodType = 'MOBILE_MONEY' | 'CARD' | 'PAYPAL';

interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  maskedIdentifier: string;
  isDefault: boolean;
}

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Visa Card',
  PAYPAL: 'PayPal',
};

// FR-16: Saved Payment Methods. Only Mobile Money can actually be saved —
// Card needs a PCI-DSS gateway integration and PayPal needs a registered
// PayPal Developer app, neither of which is connected yet, so those forms
// are disabled rather than pretending to link a real account.
export default function PaymentsPage() {
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addType, setAddType] = useState<PaymentMethodType>('MOBILE_MONEY');
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    authedFetch('/account/payment-methods').then((r) => (r.ok ? r.json() : [])).then(setMethods);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch('/account/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: addType, identifier: phone }),
      });
      if (res.ok) {
        setAdding(false);
        setPhone('');
        load();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? 'Could not save this payment method.');
      }
    } finally {
      setPending(false);
    }
  }

  async function makeDefault(id: string) {
    await authedFetch(`/account/payment-methods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remove this payment method?')) return;
    await authedFetch(`/account/payment-methods/${id}`, { method: 'DELETE' });
    load();
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> to manage saved payment methods.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Saved Payment Methods</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods?.map((m) => (
          <Card key={m.id}>
            <div className="flex justify-between">
              <b className="text-xs">{TYPE_LABELS[m.type]}</b>
              {m.isDefault && <Chip gold>Default</Chip>}
            </div>
            <p className="text-xs text-text-2 my-2.5">{m.maskedIdentifier}</p>
            <div className="flex gap-2">
              {!m.isDefault && <ButtonGhost onClick={() => makeDefault(m.id)}>Make Default</ButtonGhost>}
              <button onClick={() => remove(m.id)} className="text-danger text-xs">Remove</button>
            </div>
          </Card>
        ))}
        <Card className="flex flex-col items-center justify-center text-text-2 cursor-pointer" onClick={() => setAdding(true)}>
          <div className="text-2xl">＋</div>
          <small className="text-[10px]">Add Payment Method</small>
        </Card>
      </div>

      {adding && (
        <Card className="mt-4 max-w-sm">
          <div className="text-[10px] uppercase text-text-2 mb-2">Payment Type</div>
          <div className="flex gap-2 mb-3">
            {(Object.keys(TYPE_LABELS) as PaymentMethodType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setAddType(type); setError(null); }}
                className={`text-[10px] px-2.5 py-1 rounded-full border ${
                  addType === type ? 'text-white bg-gold border-gold' : 'text-text-2 border-[#CBDCC1] bg-surface-2'
                }`}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {addType === 'MOBILE_MONEY' ? (
            <form onSubmit={handleAdd} className="space-y-2.5">
              <div className="text-[10px] uppercase text-text-2">Mobile Money Number</div>
              <input required placeholder="+256 7XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <ButtonGold type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</ButtonGold>
                <ButtonGhost type="button" onClick={() => setAdding(false)}>Cancel</ButtonGhost>
              </div>
            </form>
          ) : (
            <>
              <p className="text-[11px] text-text-2">
                {addType === 'CARD'
                  ? "Saved cards aren't available yet — that needs a PCI-DSS payment gateway integration."
                  : "Connecting a PayPal account isn't available yet — that needs a registered PayPal Developer app."}
              </p>
              <ButtonGhost type="button" className="mt-3" onClick={() => setAdding(false)}>Cancel</ButtonGhost>
            </>
          )}
        </Card>
      )}

      <small className="block text-[10px] text-text-2 mt-2.5">
        🔒 Mobile Money numbers are masked before storage — ChrisPa never stores full card numbers.
      </small>
    </div>
  );
}
