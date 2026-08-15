import { apiGet, SocialLink } from '@/lib/api';
import { Card, Chip, ButtonGhost } from '@/components/ui';

// FR-19: Connected Accounts & Social.
// - Linked Login Providers: needs a registered OAuth app (Client ID/Secret +
//   redirect URI) per provider — Google Cloud Console, Meta Developer app,
//   Apple "Sign in with Apple" service. None of that exists yet, so
//   "Connect" is disabled with an explanation rather than silently doing
//   nothing when clicked.
// - Follow ChrisPa (FR-19.2): real, admin-managed links — GET
//   /cms/social-links, the same public source the storefront footer reads.
//   A server component, so this can just `await` the fetch directly.
export default async function SocialPage() {
  const socialLinks = await apiGet<SocialLink[]>('/cms/social-links').catch(() => [] as SocialLink[]);

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Connected Accounts &amp; Social</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Linked Login Providers</div>
          {['Google', 'Facebook', 'Apple'].map((provider) => (
            <div key={provider} className="flex justify-between items-center py-2.5 border-b border-[#E3EDDB] text-xs last:border-0">
              <span>{provider}</span>
              <ButtonGhost disabled title={`Connecting a ${provider} account isn't available yet — that needs a registered ${provider} OAuth app, which isn't connected.`}>
                Connect
              </ButtonGhost>
            </div>
          ))}
          <p className="text-[10.5px] text-text-2 mt-2">
            Social login needs a registered OAuth app per provider — not connected yet.
          </p>
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Follow ChrisPa Scents and Soaps</div>
          {socialLinks.length === 0 ? (
            <p className="text-[10.5px] text-text-2">No social accounts published yet.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {socialLinks.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                  <Chip gold>{s.platform}</Chip>
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
