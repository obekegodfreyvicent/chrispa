'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { apiGet, SocialLink } from '@/lib/api';
import { Card, ButtonOutline, ButtonGhost, Chip } from '@/components/ui';

interface AccountNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

// FR-26.4: in-app side of "Compose Newsletter" — every Notification a
// customer sees today comes from that flow (NotificationType.NEWSLETTER is
// the only type in use), but the list/mark-read UI here is written against
// the generic Notification shape so future notification types (order
// updates, etc.) don't need a new page.
export default function AccountNotificationsPage() {
  const [items, setItems] = useState<AccountNotification[] | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [authed, setAuthed] = useState(true);

  function load() {
    authedFetch('/account/notifications').then((r) => (r.ok ? r.json() : [])).then(setItems);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    load();
    apiGet<SocialLink[]>('/cms/social-links').then(setSocialLinks).catch(() => setSocialLinks([]));
  }, []);

  async function markRead(id: string) {
    await authedFetch(`/account/notifications/${id}/read`, { method: 'POST' });
    load();
  }

  async function markAllRead() {
    await authedFetch('/account/notifications/read-all', { method: 'POST' });
    load();
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> to view your notifications.
        </p>
      </Card>
    );
  }

  const unreadCount = items?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl">Notifications</h1>
        {!!unreadCount && (
          <ButtonGhost onClick={markAllRead}>Mark all read</ButtonGhost>
        )}
      </div>

      {!items ? (
        <p className="text-sm text-text-2">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-text-2">
            No notifications yet. We&apos;ll let you know here when there&apos;s a new ChrisPa newsletter to review.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((n) => (
            <Card key={n.id} className={!n.readAt ? 'border-gold-dark' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{n.title}</span>
                    {!n.readAt && <Chip gold>New</Chip>}
                  </div>
                  <p className="text-[12.5px] text-text-2 whitespace-pre-wrap">{n.body}</p>
                  <div className="text-[10.5px] text-text-2 mt-2">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {!n.readAt && (
                  <ButtonOutline className="shrink-0" onClick={() => markRead(n.id)}>
                    Mark read
                  </ButtonOutline>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!!socialLinks.length && (
        <Card className="mt-4">
          <div className="text-[10px] uppercase text-text-2 mb-2">Follow ChrisPa Scents and Soaps</div>
          <div className="flex gap-2 flex-wrap">
            {socialLinks.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                <Chip gold>{s.platform}</Chip>
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
