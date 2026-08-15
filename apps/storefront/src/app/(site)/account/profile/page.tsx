'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, ButtonGold, ButtonOutline, ButtonGhost, Chip } from '@/components/ui';

interface Profile {
  name: string;
  preferredName: string | null;
  avatarUrl: string | null;
  wellnessPreferences: string[];
}

// FR-12: Profile Management — name, photo, wellness-preference personalization.
export default function ProfilePage() {
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [addingInterest, setAddingInterest] = useState(false);
  const [newInterest, setNewInterest] = useState('');

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    authedFetch('/account/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((p: Profile | null) => {
        if (!p) return;
        setName(p.name);
        setPreferredName(p.preferredName ?? '');
        setAvatarUrl(p.avatarUrl ?? '');
        setInterests(p.wellnessPreferences ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function addInterest() {
    const value = newInterest.trim();
    if (value && !interests.includes(value)) setInterests([...interests, value]);
    setNewInterest('');
    setAddingInterest(false);
  }

  function removeInterest(value: string) {
    setInterests(interests.filter((i) => i !== value));
  }

  // Avatar changes save immediately (upload/remove), separately from the
  // Full Name / Preferred Name / Interests fields below, which stay staged
  // until "Save Changes" — matches the wireframe's two distinct cards.
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setAvatarPending(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authedFetch('/account/profile/avatar', { method: 'POST', body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAvatarError(body?.message ?? 'Could not upload photo.');
        return;
      }
      setAvatarUrl(body.avatarUrl ?? '');
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleRemovePhoto() {
    setAvatarPending(true);
    setAvatarError(null);
    try {
      const res = await authedFetch('/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: '' }),
      });
      if (res.ok) setAvatarUrl('');
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await authedFetch('/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, preferredName, wellnessPreferences: interests }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? 'Could not save changes.'));
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-text-2">Loading…</div>;

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> to manage your profile.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Profile Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <Card className="text-center">
          <div
            className="w-24 h-24 mx-auto rounded-full bg-surface-2 border-2 border-gold-dark flex items-center justify-center text-[10px] text-text-2 bg-cover bg-center"
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
          >
            {avatarUrl ? '' : 'Photo'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handlePhotoSelected}
          />
          <ButtonOutline
            className="w-full mt-3"
            disabled={avatarPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPending ? 'Uploading…' : 'Change Photo'}
          </ButtonOutline>
          <ButtonGhost className="w-full mt-2" disabled={avatarPending || !avatarUrl} onClick={handleRemovePhoto}>
            Remove
          </ButtonGhost>
          {avatarError && <p className="text-danger text-[11px] mt-2">{avatarError}</p>}
        </Card>
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Preferred Name</label>
              <input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
            </div>
          </div>
          <div className="border-t border-surface-2 my-4" />
          <div className="text-[10px] uppercase text-text-2 mb-2">Wellness Preferences</div>
          <div className="flex gap-2 flex-wrap items-center">
            {interests.map((interest) => (
              <Chip key={interest} gold className="flex items-center gap-1.5">
                {interest}
                <button onClick={() => removeInterest(interest)} aria-label={`Remove ${interest}`} className="text-gold-dark">
                  ✕
                </button>
              </Chip>
            ))}
            {addingInterest ? (
              <input
                autoFocus
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addInterest()}
                onBlur={addInterest}
                placeholder="New interest…"
                className="text-[10px] bg-white border border-[#CBDCC1] rounded-full px-2.5 py-1 w-28"
              />
            ) : (
              <button onClick={() => setAddingInterest(true)}>
                <Chip>+ Add interest</Chip>
              </button>
            )}
          </div>
          {error && <p className="text-danger text-[11px] mt-3">{error}</p>}
          {saved && <p className="text-gold-dark text-[11px] mt-3">Changes saved.</p>}
          <ButtonGold className="mt-4" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save Changes'}
          </ButtonGold>
        </Card>
      </div>
    </div>
  );
}
