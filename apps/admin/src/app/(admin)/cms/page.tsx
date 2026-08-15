'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, ButtonGold, ButtonOutline, ButtonGhost } from '@/components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface CmsPageDto {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: 'DRAFT' | 'PUBLISHED';
}
interface BannerDto {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}
interface SocialLink {
  id: string;
  platform: string;
  url: string;
  isActive: boolean;
  sortOrder: number;
}

function errorMessage(data: unknown, fallback: string) {
  const message = (data as { message?: unknown } | null)?.message;
  return Array.isArray(message) ? message.join(', ') : (typeof message === 'string' ? message : fallback);
}

// FR-27: CMS / Site Builder. Published Pages, Active Banners, and Social
// Media Accounts (FR-19.2/FR-1.6) all have real admin write sides — a
// drag-and-drop section builder and a separate cross-page publish
// *workflow* remain follow-up work (each item's own Draft/Published or
// Active/Hidden state is real, per-item publish control already).
export default function CmsPage() {
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    setAuthed(!!getAccessToken());
  }, []);

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">CMS / Site Builder</h1>
      {!authed && (
        <Card className="mb-4">
          <p className="text-sm text-text-2">
            <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager to manage pages, banners, or social accounts.
          </p>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PagesSection authed={authed} />
        <BannersSection authed={authed} />
      </div>
      <SocialLinksSection authed={authed} />
      <Card className="mt-4">
        <p className="text-sm text-text-2">
          A drag-and-drop homepage builder and a cross-page publish workflow are follow-up work — see
          docs/SRS.md FR-27.
        </p>
      </Card>
    </div>
  );
}

const EMPTY_PAGE_FORM = { title: '', slug: '', body: '', status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' };

function PagesSection({ authed }: { authed: boolean }) {
  const [pages, setPages] = useState<CmsPageDto[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY_PAGE_FORM | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (authed) {
      authedFetch('/admin/pages').then((r) => (r.ok ? r.json() : [])).then(setPages);
    } else {
      fetch(`${API_BASE_URL}/cms/pages`).then((r) => r.json()).then(setPages).catch(() => setPages([]));
    }
  }

  useEffect(load, [authed]);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_PAGE_FORM });
    setError(null);
  }

  function startEdit(page: CmsPageDto) {
    setEditingId(page.id);
    setForm({ title: page.title, slug: page.slug, body: page.body, status: page.status });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      const res = await authedFetch(editingId ? `/admin/pages/${editingId}` : '/admin/pages', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, slug: form.slug || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, 'Could not save.'));
        return;
      }
      setForm(null);
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(page: CmsPageDto) {
    await authedFetch(`/admin/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: page.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }),
    });
    load();
  }

  async function remove(page: CmsPageDto) {
    if (!confirm(`Delete "${page.title}"?`)) return;
    await authedFetch(`/admin/pages/${page.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <div className="text-[10px] uppercase text-text-2">Published Pages</div>
        {authed && !form && <ButtonGold onClick={startAdd} className="px-2.5 py-1.5">+ Add Page</ButtonGold>}
      </div>

      {authed && form && (
        <form onSubmit={save} className="flex flex-col gap-2 mb-3">
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <input
            placeholder="Slug (auto-generated from title if left blank)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <textarea
            required
            placeholder="Page content"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-20"
          />
          <div className="flex gap-2 items-center">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'DRAFT' | 'PUBLISHED' })}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
            <ButtonGold type="submit" disabled={saving} className="px-2.5 py-1.5">{saving ? 'Saving…' : 'Save'}</ButtonGold>
            <ButtonGhost type="button" onClick={() => { setForm(null); setEditingId(null); }} className="px-2.5 py-1.5">Cancel</ButtonGhost>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {!pages?.length ? (
        <p className="text-sm text-text-2">No pages yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1.5 border-t border-surface-2 text-[11.5px]">
              {authed ? (
                <button type="button" onClick={() => toggleStatus(p)} title="Click to toggle Draft/Published">
                  <Chip gold={p.status === 'PUBLISHED'}>{p.status === 'PUBLISHED' ? 'Published' : 'Draft'}</Chip>
                </button>
              ) : (
                <Chip gold>Published</Chip>
              )}
              <span className="flex-1 truncate">{p.title}</span>
              {authed && (
                <>
                  <ButtonOutline type="button" onClick={() => startEdit(p)} className="px-2.5 py-1">Edit</ButtonOutline>
                  <ButtonGhost type="button" onClick={() => remove(p)} className="px-2.5 py-1 text-danger">Delete</ButtonGhost>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const EMPTY_BANNER_FORM = { imageUrl: '', linkUrl: '', sortOrder: 0 };

function BannersSection({ authed }: { authed: boolean }) {
  const [banners, setBanners] = useState<BannerDto[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY_BANNER_FORM | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function load() {
    if (authed) {
      authedFetch('/admin/banners').then((r) => (r.ok ? r.json() : [])).then(setBanners);
    } else {
      fetch(`${API_BASE_URL}/cms/banners`).then((r) => r.json()).then(setBanners).catch(() => setBanners([]));
    }
  }

  useEffect(load, [authed]);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_BANNER_FORM, sortOrder: banners?.length ?? 0 });
    setError(null);
  }

  function startEdit(banner: BannerDto) {
    setEditingId(banner.id);
    setForm({ imageUrl: banner.imageUrl, linkUrl: banner.linkUrl ?? '', sortOrder: banner.sortOrder });
    setError(null);
  }

  // Same upload endpoint the Product Manager's photo upload uses — no
  // separate banner-image upload endpoint needed.
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !form) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authedFetch('/admin/products/media/upload', { method: 'POST', body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not upload image.');
        return;
      }
      setForm({ ...form, imageUrl: body.url });
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.imageUrl) {
      setError('Upload an image first.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await authedFetch(editingId ? `/admin/banners/${editingId}` : '/admin/banners', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, linkUrl: form.linkUrl || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, 'Could not save.'));
        return;
      }
      setForm(null);
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(banner: BannerDto) {
    await authedFetch(`/admin/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !banner.isActive }),
    });
    load();
  }

  async function remove(banner: BannerDto) {
    if (!confirm('Remove this banner?')) return;
    await authedFetch(`/admin/banners/${banner.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <div className="text-[10px] uppercase text-text-2">Active Banners</div>
        {authed && !form && <ButtonGold onClick={startAdd} className="px-2.5 py-1.5">+ Add Banner</ButtonGold>}
      </div>

      {authed && form && (
        <form onSubmit={save} className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-2">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="h-12 w-20 object-cover rounded-md border border-[#CBDCC1]" />
            ) : (
              <div className="h-12 w-20 rounded-md border border-dashed border-[#CBDCC1] flex items-center justify-center text-[9px] text-text-2">No image</div>
            )}
            <label>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} className="hidden" />
              <span className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-semibold bg-transparent border border-gold-dark text-gold-light cursor-pointer">
                {uploading ? 'Uploading…' : form.imageUrl ? 'Replace Image' : 'Upload Image'}
              </span>
            </label>
          </div>
          <input
            placeholder="Link URL (optional — e.g. /shop/candles)"
            value={form.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="Order"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-20"
            />
            <ButtonGold type="submit" disabled={saving || uploading} className="px-2.5 py-1.5">{saving ? 'Saving…' : 'Save'}</ButtonGold>
            <ButtonGhost type="button" onClick={() => { setForm(null); setEditingId(null); }} className="px-2.5 py-1.5">Cancel</ButtonGhost>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {!banners?.length ? (
        <p className="text-sm text-text-2">No banners yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-2 py-1.5 border-t border-surface-2 text-[11.5px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt="" className="h-8 w-12 object-cover rounded shrink-0 border border-[#CBDCC1]" />
              {authed ? (
                <button type="button" onClick={() => toggleActive(b)} title={b.isActive ? 'Active — click to hide' : 'Hidden — click to show'}>
                  <Chip gold={b.isActive}>{b.isActive ? 'Active' : 'Hidden'}</Chip>
                </button>
              ) : (
                <Chip gold>Active</Chip>
              )}
              <span className="flex-1 truncate text-text-2">{b.linkUrl ?? '—'}</span>
              {authed && (
                <>
                  <ButtonOutline type="button" onClick={() => startEdit(b)} className="px-2.5 py-1">Edit</ButtonOutline>
                  <ButtonGhost type="button" onClick={() => remove(b)} className="px-2.5 py-1 text-danger">Remove</ButtonGhost>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const EMPTY_SOCIAL_FORM = { platform: '', url: '', sortOrder: 0 };

// FR-19.2/FR-1.6: adding, editing, or deleting one here — or just toggling
// it inactive — is reflected immediately on the storefront footer and
// Account → Connected & Social, since both read the same public
// GET /cms/social-links live.
function SocialLinksSection({ authed }: { authed: boolean }) {
  const [links, setLinks] = useState<SocialLink[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY_SOCIAL_FORM | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (authed) {
      authedFetch('/admin/social-links').then((r) => (r.ok ? r.json() : [])).then(setLinks);
    } else {
      fetch(`${API_BASE_URL}/cms/social-links`).then((r) => r.json()).then(setLinks).catch(() => setLinks([]));
    }
  }

  useEffect(load, [authed]);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_SOCIAL_FORM, sortOrder: links?.length ?? 0 });
    setError(null);
  }

  function startEdit(link: SocialLink) {
    setEditingId(link.id);
    setForm({ platform: link.platform, url: link.url, sortOrder: link.sortOrder });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      const res = await authedFetch(editingId ? `/admin/social-links/${editingId}` : '/admin/social-links', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(data, 'Could not save.'));
        return;
      }
      setForm(null);
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(link: SocialLink) {
    await authedFetch(`/admin/social-links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !link.isActive }),
    });
    load();
  }

  async function remove(link: SocialLink) {
    if (!confirm(`Remove ${link.platform}? It will immediately disappear from the storefront.`)) return;
    await authedFetch(`/admin/social-links/${link.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Card className="mt-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-[10px] uppercase text-text-2">Social Media Accounts</div>
          <p className="text-[10.5px] text-text-2 mt-0.5">
            Shown on the storefront footer and Account → Connected &amp; Social. Add, edit, or remove one —
            or just switch it off — and it appears or disappears there immediately.
          </p>
        </div>
        {authed && !form && <ButtonGold onClick={startAdd}>+ Add Account</ButtonGold>}
      </div>

      {authed && form && (
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_100px_auto_auto] gap-2 mb-3 items-start">
          <input
            required
            placeholder="Platform (e.g. Instagram)"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <input
            required
            type="url"
            placeholder="https://instagram.com/chrispa..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <input
            type="number"
            placeholder="Order"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
            className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <ButtonGold type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</ButtonGold>
          <ButtonGhost type="button" onClick={() => { setForm(null); setEditingId(null); }}>Cancel</ButtonGhost>
        </form>
      )}
      {error && <p className="text-xs text-danger mb-3">{error}</p>}

      {!links?.length ? (
        <p className="text-sm text-text-2">No social accounts added yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2.5 py-1.5 border-t border-surface-2 text-[11.5px]">
              {authed ? (
                <button type="button" onClick={() => toggleActive(link)} title={link.isActive ? 'Active — click to hide' : 'Hidden — click to show'}>
                  <Chip gold={link.isActive}>{link.isActive ? 'Active' : 'Hidden'}</Chip>
                </button>
              ) : (
                <Chip gold>Active</Chip>
              )}
              <span className="w-24 shrink-0">{link.platform}</span>
              <a href={link.url} target="_blank" rel="noreferrer" className="flex-1 text-gold-light truncate">
                {link.url}
              </a>
              <span className="text-text-2 w-12 shrink-0">#{link.sortOrder}</span>
              {authed && (
                <>
                  <ButtonOutline type="button" onClick={() => startEdit(link)} className="px-2.5 py-1">Edit</ButtonOutline>
                  <ButtonGhost type="button" onClick={() => remove(link)} className="px-2.5 py-1 text-danger">Remove</ButtonGhost>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
