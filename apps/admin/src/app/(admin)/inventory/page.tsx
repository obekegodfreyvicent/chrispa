'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Kpi, Status } from '@/components/ui';

interface InventoryRecord {
  id: string;
  qtyOnHand: number;
  reorderPoint: number;
  batchLot: string | null;
  product: { name: string };
  warehouse: { name: string };
}

// FR-24: Inventory & Warehouse (read side, real). Purchase orders, transfers,
// cycle counts, and FIFO/LIFO costing are follow-up work.
export default function InventoryPage() {
  const [records, setRecords] = useState<InventoryRecord[] | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/admin/inventory')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecords);
  }, []);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner, Store Manager, or Fulfillment staff.
        </p>
      </Card>
    );
  }

  const lowStock = records?.filter((r) => r.qtyOnHand <= r.reorderPoint).length ?? 0;

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">Inventory &amp; Warehouse</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <Kpi label="Total Records" value={records ? String(records.length) : '—'} />
        <Kpi label="Low Stock Alerts" value={String(lowStock)} />
        <Kpi label="Warehouses" value={String(new Set(records?.map((r) => r.warehouse.name)).size || 0)} />
      </div>
      <Card className="p-0 overflow-hidden">
        {!records ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No inventory records yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">SKU</th>
                <th className="p-2.5">Warehouse</th>
                <th className="p-2.5">Batch/Lot</th>
                <th className="p-2.5">On Hand</th>
                <th className="p-2.5">Reorder Pt.</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-surface-2">
                  <td className="p-2.5">{r.product.name}</td>
                  <td className="p-2.5">{r.warehouse.name}</td>
                  <td className="p-2.5">{r.batchLot ?? '—'}</td>
                  <td className="p-2.5">{r.qtyOnHand}</td>
                  <td className="p-2.5">{r.reorderPoint}</td>
                  <td className="p-2.5">
                    {r.qtyOnHand <= r.reorderPoint ? <Status variant="danger">Low</Status> : <Status variant="ok">OK</Status>}
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
