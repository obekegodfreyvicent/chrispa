'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, ButtonGold, ButtonOutline, ButtonGhost, Status } from '@/components/ui';

interface Entity {
  id: string;
  name: string;
  code: string;
  functionalCurrency: string;
  currentGroupFxRate: string;
  parentEntityId: string | null;
}
interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  isIntercompany: boolean;
}
interface JournalLine {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  account: Account;
}
interface JournalEntry {
  id: string;
  entryNumber: number;
  date: string;
  description: string;
  fxRateToGroupCurrency: string;
  intercompanyGroupId: string | null;
  lines: JournalLine[];
}
interface ReportLine {
  code: string;
  name: string;
  balance: string;
}
interface BalanceSheet {
  totalAssets: string;
  assets: ReportLine[];
  totalLiabilities: string;
  liabilities: ReportLine[];
  totalEquity: string;
  equity: ReportLine[];
  balanced: boolean;
  consolidated: boolean;
  intercompanyEliminations: { receivablesEliminated: string; payablesEliminated: string } | null;
}
interface IncomeStatement {
  revenue: ReportLine[];
  totalRevenue: string;
  expenses: ReportLine[];
  totalExpenses: string;
  netIncome: string;
}
interface CashFlow {
  netIncome: string;
  operatingActivities: string;
  investingActivities: string;
  financingActivities: string;
  netChangeInCash: string;
  actualCashMovement: string;
  reconciles: boolean;
}

const TABS = ['Entities', 'Chart of Accounts', 'Journal Entries', 'Reports', 'Intercompany', 'Vendors', 'Expenses'] as const;
const fmt = (n: string) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// FIN-FR-1..5 (docs/SRS.md §20): Financial & Accounting Management. OWNER
// only — see EntitiesController's Access Control note for why financial
// data is scoped tighter than any single operational admin role.
export default function FinancePage() {
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Entities');
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [consolidated, setConsolidated] = useState(false);

  function loadEntities() {
    authedFetch('/admin/finance/entities').then((r) => {
      if (r.status === 403) { setForbidden(true); return; }
      return r.ok ? r.json() : [];
    }).then((data: Entity[] | undefined) => {
      if (!data) return;
      setEntities(data);
      if (!selectedEntityId && data.length > 0) {
        setSelectedEntityId(data.find((e) => !e.parentEntityId)?.id ?? data[0].id);
      }
    });
  }

  useEffect(() => {
    if (!getAccessToken()) { setAuthed(false); return; }
    loadEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as Owner.</p></Card>;
  }
  if (forbidden) {
    return <Card><p className="text-sm text-text-2">Financial & Accounting Management is Owner-only.</p></Card>;
  }

  const rootEntity = entities?.find((e) => !e.parentEntityId);
  const selectedEntity = entities?.find((e) => e.id === selectedEntityId);

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2.5">
        <h1 className="font-serif text-xl">Financial &amp; Accounting Management</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          >
            {entities?.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.functionalCurrency})</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[11.5px] text-text-2">
            <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} />
            Consolidated (group)
          </label>
        </div>
      </div>

      <div className="flex gap-2 mb-3.5 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            <Chip gold={tab === t}>{t}</Chip>
          </button>
        ))}
      </div>

      {tab === 'Entities' && <EntitiesTab entities={entities} onChanged={loadEntities} />}
      {tab === 'Chart of Accounts' && selectedEntityId && <AccountsTab entityId={selectedEntityId} />}
      {tab === 'Journal Entries' && selectedEntityId && (
        <JournalTab entityId={selectedEntityId} entityName={selectedEntity?.name ?? ''} />
      )}
      {tab === 'Reports' && rootEntity && (
        <ReportsTab
          entityId={selectedEntityId}
          consolidatedRootId={consolidated ? rootEntity.id : undefined}
          consolidated={consolidated}
        />
      )}
      {tab === 'Intercompany' && entities && rootEntity && <IntercompanyTab entities={entities} rootEntity={rootEntity} />}
      {tab === 'Vendors' && <VendorsTab />}
      {tab === 'Expenses' && selectedEntityId && <ExpensesTab entityId={selectedEntityId} />}
    </div>
  );
}

function EntitiesTab({ entities, onChanged }: { entities: Entity[] | null; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [parentEntityId, setParentEntityId] = useState('');
  const [fxRate, setFxRate] = useState('1');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    const res = await authedFetch('/admin/finance/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, functionalCurrency: currency, parentEntityId: parentEntityId || undefined, currentGroupFxRate: Number(fxRate) }),
    });
    if (!res.ok) { setError((await res.json()).message ?? 'Failed to create entity'); return; }
    setShowForm(false);
    setName(''); setCode(''); setCurrency('UGX'); setParentEntityId(''); setFxRate('1');
    onChanged();
  }

  return (
    <div>
      <div className="flex justify-end mb-2.5">
        <ButtonGold onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New Legal Entity'}</ButtonGold>
      </div>
      {showForm && (
        <Card className="mb-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input placeholder="Legal name" value={name} onChange={(e) => setName(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Code (e.g. CHRISPA-KE)" value={code} onChange={(e) => setCode(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Functional currency (e.g. KES)" value={currency} onChange={(e) => setCurrency(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <select value={parentEntityId} onChange={(e) => setParentEntityId(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
              <option value="">No parent (group root)</option>
              {entities?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input placeholder="Rate to group currency (1 unit = ? group ccy)" value={fxRate} onChange={(e) => setFxRate(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          </div>
          {error && <p className="text-[11px] text-danger mt-2">{error}</p>}
          <div className="mt-2.5"><ButtonOutline onClick={submit}>Create Entity</ButtonOutline></div>
        </Card>
      )}
      <Card className="p-0 overflow-hidden">
        {!entities ? <p className="text-sm text-text-2 p-4">Loading…</p> : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-gold-dark text-[10px] uppercase">
              <th className="p-2.5">Entity</th><th className="p-2.5">Code</th><th className="p-2.5">Currency</th><th className="p-2.5">FX → Group</th><th className="p-2.5">Parent</th>
            </tr></thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-t border-surface-2">
                  <td className="p-2.5">{e.name}{!e.parentEntityId && <Chip gold className="ml-2">Group Root</Chip>}</td>
                  <td className="p-2.5 font-mono text-[10.5px]">{e.code}</td>
                  <td className="p-2.5">{e.functionalCurrency}</td>
                  <td className="p-2.5">{e.currentGroupFxRate}</td>
                  <td className="p-2.5 text-text-2">{entities.find((p) => p.id === e.parentEntityId)?.name ?? '—'}</td>
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

function AccountsTab({ entityId }: { entityId: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  useEffect(() => {
    setAccounts(null);
    authedFetch(`/admin/finance/accounts?entityId=${entityId}`).then((r) => (r.ok ? r.json() : [])).then(setAccounts);
  }, [entityId]);

  return (
    <Card className="p-0 overflow-hidden">
      {!accounts ? <p className="text-sm text-text-2 p-4">Loading…</p> : (
        <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-left text-gold-dark text-[10px] uppercase">
            <th className="p-2.5">Code</th><th className="p-2.5">Account</th><th className="p-2.5">Type</th><th className="p-2.5">Intercompany</th>
          </tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t border-surface-2">
                <td className="p-2.5 font-mono text-[10.5px]">{a.code}</td>
                <td className="p-2.5">{a.name}</td>
                <td className="p-2.5"><Chip>{a.type}</Chip></td>
                <td className="p-2.5">{a.isIntercompany ? <Status variant="pending">Intercompany</Status> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  );
}

function JournalTab({ entityId, entityName }: { entityId: string; entityName: string }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
  const [error, setError] = useState('');

  function load() {
    authedFetch(`/admin/finance/journal-entries?entityId=${entityId}`).then((r) => (r.ok ? r.json() : [])).then(setEntries);
    authedFetch(`/admin/finance/accounts?entityId=${entityId}`).then((r) => (r.ok ? r.json() : [])).then(setAccounts);
  }
  useEffect(() => { setEntries(null); load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const debitTotal = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const creditTotal = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const rowsBalanced = rows.some((r) => r.accountId) && debitTotal === creditTotal && debitTotal > 0;

  async function submit() {
    setError('');
    const lines = rows.filter((r) => r.accountId && (Number(r.debit) || Number(r.credit))).map((r) => ({
      accountId: r.accountId,
      debitAmount: Number(r.debit) || 0,
      creditAmount: Number(r.credit) || 0,
    }));
    const res = await authedFetch('/admin/finance/journal-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, date, description, lines }),
    });
    if (!res.ok) { setError((await res.json()).message ?? 'Failed to post entry'); return; }
    setShowForm(false);
    setDescription('');
    setRows([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2.5">
        <p className="text-[11.5px] text-text-2">Journal for {entityName}</p>
        <ButtonGold onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ Post Journal Entry'}</ButtonGold>
      </div>
      {showForm && (
        <Card className="mb-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr,110px,110px] gap-2.5 mb-2">
              <select value={row.accountId} onChange={(e) => setRows((rs) => rs.map((r, ri) => ri === i ? { ...r, accountId: e.target.value } : r))} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                <option value="">Select account…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
              <input placeholder="Debit" value={row.debit} onChange={(e) => setRows((rs) => rs.map((r, ri) => ri === i ? { ...r, debit: e.target.value, credit: '' } : r))} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <input placeholder="Credit" value={row.credit} onChange={(e) => setRows((rs) => rs.map((r, ri) => ri === i ? { ...r, credit: e.target.value, debit: '' } : r))} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
          ))}
          <ButtonGhost onClick={() => setRows((rs) => [...rs, { accountId: '', debit: '', credit: '' }])} className="mb-2.5">+ Add line</ButtonGhost>
          <p className="text-[11px] text-text-2">
            Debits {debitTotal.toLocaleString()} · Credits {creditTotal.toLocaleString()} —{' '}
            {rowsBalanced ? <span className="text-gold-light">balanced</span> : <span className="text-danger">not balanced</span>}
          </p>
          {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
          <div className="mt-2.5"><ButtonOutline onClick={submit} disabled={!rowsBalanced}>Post Entry</ButtonOutline></div>
        </Card>
      )}
      <Card className="p-0 overflow-hidden">
        {!entries ? <p className="text-sm text-text-2 p-4">Loading…</p> : entries.length === 0 ? <p className="text-sm text-text-2 p-4">No journal entries yet.</p> : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-gold-dark text-[10px] uppercase">
              <th className="p-2.5">#</th><th className="p-2.5">Date</th><th className="p-2.5">Description</th><th className="p-2.5">Lines</th><th className="p-2.5">Amount</th>
            </tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-surface-2 align-top">
                  <td className="p-2.5">{e.entryNumber}</td>
                  <td className="p-2.5 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="p-2.5">{e.description}{e.intercompanyGroupId && <Chip gold className="ml-2">Intercompany</Chip>}</td>
                  <td className="p-2.5 text-text-2">
                    {e.lines.map((l) => (
                      <div key={l.id}>{l.account.code} {Number(l.debitAmount) > 0 ? `Dr ${fmt(l.debitAmount)}` : `Cr ${fmt(l.creditAmount)}`}</div>
                    ))}
                  </td>
                  <td className="p-2.5">{fmt(e.lines.reduce((s, l) => s + Number(l.debitAmount), 0).toString())}</td>
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

function ReportsTab({ entityId, consolidatedRootId, consolidated }: { entityId: string; consolidatedRootId?: string; consolidated: boolean }) {
  const [statement, setStatement] = useState<'Balance Sheet' | 'Income Statement' | 'Cash Flow'>('Balance Sheet');
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const scopeParams = consolidated ? `consolidatedRootId=${consolidatedRootId}` : `entityId=${entityId}`;

  useEffect(() => {
    setBalanceSheet(null); setIncomeStatement(null); setCashFlow(null);
    authedFetch(`/admin/finance/reports/balance-sheet?${scopeParams}&asOf=${to}`).then((r) => (r.ok ? r.json() : null)).then(setBalanceSheet);
    authedFetch(`/admin/finance/reports/income-statement?${scopeParams}&from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then(setIncomeStatement);
    authedFetch(`/admin/finance/reports/cash-flow?${scopeParams}&from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then(setCashFlow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, consolidatedRootId, consolidated, from, to]);

  return (
    <div>
      <div className="flex gap-2 mb-2.5 flex-wrap items-center">
        {(['Balance Sheet', 'Income Statement', 'Cash Flow'] as const).map((s) => (
          <button key={s} onClick={() => setStatement(s)}><Chip gold={statement === s}>{s}</Chip></button>
        ))}
        <span className="text-[11px] text-text-2 ml-2">Period:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2 py-1.5 text-[11px]" />
        <span className="text-[11px] text-text-2">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2 py-1.5 text-[11px]" />
      </div>

      {statement === 'Balance Sheet' && (
        !balanceSheet ? <Card><p className="text-sm text-text-2">Loading…</p></Card> : (
          <Card>
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="font-serif text-base">Balance Sheet {consolidated && '(Consolidated)'}</h3>
              <Status variant={balanceSheet.balanced ? 'ok' : 'danger'}>{balanceSheet.balanced ? 'Balanced' : 'Out of balance'}</Status>
            </div>
            <ReportSection title="Assets" lines={balanceSheet.assets} total={balanceSheet.totalAssets} />
            <ReportSection title="Liabilities" lines={balanceSheet.liabilities} total={balanceSheet.totalLiabilities} />
            <ReportSection title="Equity" lines={balanceSheet.equity} total={balanceSheet.totalEquity} />
            {balanceSheet.intercompanyEliminations && (
              <p className="text-[11px] text-text-2 mt-2.5">
                Intercompany eliminations — receivables: {fmt(balanceSheet.intercompanyEliminations.receivablesEliminated)},
                payables: {fmt(balanceSheet.intercompanyEliminations.payablesEliminated)}
              </p>
            )}
          </Card>
        )
      )}

      {statement === 'Income Statement' && (
        !incomeStatement ? <Card><p className="text-sm text-text-2">Loading…</p></Card> : (
          <Card>
            <h3 className="font-serif text-base mb-2.5">Income Statement {consolidated && '(Consolidated)'}</h3>
            <ReportSection title="Revenue" lines={incomeStatement.revenue} total={incomeStatement.totalRevenue} />
            <ReportSection title="Expenses" lines={incomeStatement.expenses} total={incomeStatement.totalExpenses} />
            <div className="flex justify-between mt-3.5 pt-2.5 border-t border-surface-2 font-semibold text-[12.5px]">
              <span>Net Income</span><span>{fmt(incomeStatement.netIncome)}</span>
            </div>
          </Card>
        )
      )}

      {statement === 'Cash Flow' && (
        !cashFlow ? <Card><p className="text-sm text-text-2">Loading…</p></Card> : (
          <Card>
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="font-serif text-base">Cash Flow Statement (Indirect Method) {consolidated && '(Consolidated)'}</h3>
              <Status variant={cashFlow.reconciles ? 'ok' : 'danger'}>{cashFlow.reconciles ? 'Reconciles' : 'Does not reconcile'}</Status>
            </div>
            <div className="space-y-1.5 text-[11.5px]">
              <div className="flex justify-between"><span>Net Income</span><span>{fmt(cashFlow.netIncome)}</span></div>
              <div className="flex justify-between"><span>Operating Activities</span><span>{fmt(cashFlow.operatingActivities)}</span></div>
              <div className="flex justify-between"><span>Investing Activities</span><span>{fmt(cashFlow.investingActivities)}</span></div>
              <div className="flex justify-between"><span>Financing Activities</span><span>{fmt(cashFlow.financingActivities)}</span></div>
              <div className="flex justify-between font-semibold pt-2 border-t border-surface-2"><span>Net Change in Cash</span><span>{fmt(cashFlow.netChangeInCash)}</span></div>
              <div className="flex justify-between text-text-2"><span>Actual Cash Movement</span><span>{fmt(cashFlow.actualCashMovement)}</span></div>
            </div>
          </Card>
        )
      )}
    </div>
  );
}

function ReportSection({ title, lines, total }: { title: string; lines: ReportLine[]; total: string }) {
  return (
    <div className="mb-3.5">
      <div className="text-[10px] uppercase text-gold-dark mb-1.5">{title}</div>
      {lines.length === 0 ? <p className="text-[11px] text-text-2">None</p> : lines.map((l) => (
        <div key={l.code} className="flex justify-between text-[11.5px] py-0.5">
          <span className="text-text-2">{l.code} — {l.name}</span><span>{fmt(l.balance)}</span>
        </div>
      ))}
      <div className="flex justify-between text-[11.5px] font-semibold pt-1 mt-1 border-t border-surface-2">
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  );
}

function IntercompanyTab({ entities, rootEntity }: { entities: Entity[]; rootEntity: Entity }) {
  const [dueToDueFrom, setDueToDueFrom] = useState<{ counterparty: { name: string }; accountType: string; balance: string }[] | null>(null);
  const [amount, setAmount] = useState('');
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    authedFetch(`/admin/finance/intercompany/due-to-due-from?entityId=${rootEntity.id}`).then((r) => (r.ok ? r.json() : [])).then(setDueToDueFrom);
  }
  useEffect(load, [rootEntity.id]);

  const subsidiaries = entities.filter((e) => e.id !== rootEntity.id);

  async function submitFee() {
    setError(''); setSuccess('');
    const res = await authedFetch('/admin/finance/intercompany/management-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentEntityId: rootEntity.id, subsidiaryEntityId: subsidiaryId, amount: Number(amount), date, description }),
    });
    if (!res.ok) { setError((await res.json()).message ?? 'Failed to allocate fee'); return; }
    setSuccess('Management fee posted to both entities.');
    setAmount(''); setDescription('');
    load();
  }

  return (
    <div>
      <Card className="mb-3.5">
        <h3 className="font-serif text-base mb-2.5">Allocate Management Fee ({rootEntity.name} → subsidiary)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          <select value={subsidiaryId} onChange={(e) => setSubsidiaryId(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
            <option value="">Select subsidiary…</option>
            {subsidiaries.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="Amount (group reporting currency)" value={amount} onChange={(e) => setAmount(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
        </div>
        {error && <p className="text-[11px] text-danger mb-2">{error}</p>}
        {success && <p className="text-[11px] text-gold-light mb-2">{success}</p>}
        <ButtonOutline onClick={submitFee} disabled={!subsidiaryId || !amount}>Allocate Fee</ButtonOutline>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-2.5 text-[10px] uppercase text-gold-dark">Due-to / Due-from — {rootEntity.name}</div>
        {!dueToDueFrom ? <p className="text-sm text-text-2 p-4">Loading…</p> : dueToDueFrom.length === 0 ? <p className="text-sm text-text-2 p-4">No intercompany balances yet.</p> : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-gold-dark text-[10px] uppercase">
              <th className="p-2.5">Counterparty</th><th className="p-2.5">Type</th><th className="p-2.5">Balance</th>
            </tr></thead>
            <tbody>
              {dueToDueFrom.map((d, i) => (
                <tr key={i} className="border-t border-surface-2">
                  <td className="p-2.5">{d.counterparty.name}</td>
                  <td className="p-2.5"><Chip gold={d.accountType === 'ASSET'}>{d.accountType === 'ASSET' ? 'Due From' : 'Due To'}</Chip></td>
                  <td className="p-2.5">{fmt(d.balance)}</td>
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

interface Vendor {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  payoutMobileMoneyNumber: string | null;
  commissionRatePercent: string;
  status: string;
  _count: { products: number };
}
interface VendorPayout {
  id: string;
  vendorId: string;
  periodStart: string;
  periodEnd: string;
  grossSalesUgx: number;
  commissionUgx: number;
  payoutUgx: number;
  status: string;
  vendor?: { name: string };
}

// MKT-FR-1/2 (docs/SRS.md §21): vendor directory + commission payouts.
function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [payouts, setPayouts] = useState<VendorPayout[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [momo, setMomo] = useState('');
  const [rate, setRate] = useState('20');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [periodStart, setPeriodStart] = useState('2026-01-01');
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [payoutError, setPayoutError] = useState('');

  function load() {
    authedFetch('/admin/vendors').then((r) => (r.ok ? r.json() : [])).then(setVendors);
    authedFetch('/admin/vendors/payouts/all').then((r) => (r.ok ? r.json() : [])).then(setPayouts);
  }
  useEffect(load, []);

  async function submitVendor() {
    setError('');
    const res = await authedFetch('/admin/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contactEmail: email || undefined, contactPhone: phone || undefined, payoutMobileMoneyNumber: momo || undefined, commissionRatePercent: Number(rate) }),
    });
    if (!res.ok) { setError((await res.json()).message ?? 'Failed to create vendor'); return; }
    setShowForm(false);
    setName(''); setEmail(''); setPhone(''); setMomo(''); setRate('20');
    load();
  }

  async function computePayout() {
    setPayoutError('');
    const res = await authedFetch(`/admin/vendors/${selectedVendorId}/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart, periodEnd }),
    });
    if (!res.ok) { setPayoutError((await res.json()).message ?? 'Failed to compute payout'); return; }
    load();
  }

  async function markPaid(payoutId: string) {
    await authedFetch(`/admin/vendors/payouts/${payoutId}/mark-paid`, { method: 'POST' });
    load();
  }

  return (
    <div>
      <div className="flex justify-end mb-2.5">
        <ButtonGold onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New Vendor'}</ButtonGold>
      </div>
      {showForm && (
        <Card className="mb-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input placeholder="Vendor / business name" value={name} onChange={(e) => setName(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Contact email" value={email} onChange={(e) => setEmail(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Contact phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Payout Mobile Money number" value={momo} onChange={(e) => setMomo(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <input placeholder="Platform commission %" value={rate} onChange={(e) => setRate(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          </div>
          {error && <p className="text-[11px] text-danger mt-2">{error}</p>}
          <div className="mt-2.5"><ButtonOutline onClick={submitVendor} disabled={!name}>Create Vendor</ButtonOutline></div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden mb-3.5">
        {!vendors ? <p className="text-sm text-text-2 p-4">Loading…</p> : vendors.length === 0 ? <p className="text-sm text-text-2 p-4">No vendors yet.</p> : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-gold-dark text-[10px] uppercase">
              <th className="p-2.5">Vendor</th><th className="p-2.5">Commission</th><th className="p-2.5">Products</th><th className="p-2.5">Status</th>
            </tr></thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-t border-surface-2">
                  <td className="p-2.5">{v.name}<div className="text-text-2">{v.contactEmail}</div></td>
                  <td className="p-2.5">{v.commissionRatePercent}%</td>
                  <td className="p-2.5">{v._count.products}</td>
                  <td className="p-2.5"><Chip gold={v.status === 'ACTIVE'}>{v.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <Card className="mb-3.5">
        <h3 className="font-serif text-base mb-2.5">Compute Vendor Payout</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
            <option value="">Select vendor…</option>
            {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
        </div>
        {payoutError && <p className="text-[11px] text-danger mt-2">{payoutError}</p>}
        <p className="text-[11px] text-text-2 mt-2">Only recognizes DELIVERED sales not yet included in a prior payout run.</p>
        <div className="mt-2.5"><ButtonOutline onClick={computePayout} disabled={!selectedVendorId}>Compute Payout</ButtonOutline></div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {!payouts ? <p className="text-sm text-text-2 p-4">Loading…</p> : payouts.length === 0 ? <p className="text-sm text-text-2 p-4">No payout runs yet.</p> : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-gold-dark text-[10px] uppercase">
              <th className="p-2.5">Vendor</th><th className="p-2.5">Period</th><th className="p-2.5">Gross</th><th className="p-2.5">Commission</th><th className="p-2.5">Payout</th><th className="p-2.5">Status</th><th className="p-2.5"></th>
            </tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-surface-2">
                  <td className="p-2.5">{p.vendor?.name}</td>
                  <td className="p-2.5">{new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}</td>
                  <td className="p-2.5">{p.grossSalesUgx.toLocaleString()}</td>
                  <td className="p-2.5">{p.commissionUgx.toLocaleString()}</td>
                  <td className="p-2.5">{p.payoutUgx.toLocaleString()}</td>
                  <td className="p-2.5"><Status variant={p.status === 'PAID' ? 'ok' : 'pending'}>{p.status}</Status></td>
                  <td className="p-2.5">{p.status === 'PENDING' && <ButtonGhost onClick={() => markPaid(p.id)}>Mark Paid</ButtonGhost>}</td>
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

// FIN-FR-9 (Expense Tracking, docs/SRS.md §21): a thin recording form over
// the same journal engine every other Finance write path uses.
function ExpensesTab({ entityId }: { entityId: string }) {
  const [categories, setCategories] = useState<{ code: string; label: string }[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [category, setCategory] = useState('');
  const [paidFromAccountId, setPaidFromAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    authedFetch('/admin/finance/expenses/categories').then((r) => (r.ok ? r.json() : [])).then(setCategories);
    authedFetch(`/admin/finance/accounts?entityId=${entityId}`).then((r) => (r.ok ? r.json() : [])).then((accts: Account[]) => {
      setAccounts(accts);
      setPaidFromAccountId((prev) => prev || accts.find((a) => a.code === '1000')?.id || '');
    });
  }, [entityId]);

  async function submit() {
    setError(''); setSuccess('');
    const res = await authedFetch('/admin/finance/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, expenseAccountCode: category, paidFromAccountId, amountUgx: Number(amount), date, description }),
    });
    if (!res.ok) { setError((await res.json()).message ?? 'Failed to record expense'); return; }
    setSuccess('Expense recorded — see Journal Entries or Reports → Income Statement.');
    setAmount(''); setDescription('');
  }

  return (
    <Card>
      <h3 className="font-serif text-base mb-2.5">Record an Expense</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
          <option value="">Select category…</option>
          {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <select value={paidFromAccountId} onChange={(e) => setPaidFromAccountId(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
          <option value="">Paid from…</option>
          {accounts.filter((a) => a.type === 'ASSET' || a.type === 'LIABILITY').map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
        <input placeholder="Amount (UGX)" value={amount} onChange={(e) => setAmount(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] sm:col-span-2" />
      </div>
      {error && <p className="text-[11px] text-danger mt-2">{error}</p>}
      {success && <p className="text-[11px] text-gold-light mt-2">{success}</p>}
      <div className="mt-2.5"><ButtonOutline onClick={submit} disabled={!category || !paidFromAccountId || !amount}>Record Expense</ButtonOutline></div>
    </Card>
  );
}
