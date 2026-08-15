import { Card, ButtonGold } from '@/components/ui';

// FR-10.2: Reset Password — step 2 of 2. UI only, see forgot-password/page.tsx.
export default function ResetPasswordPage() {
  return (
    <Card className="p-7">
      <h1 className="font-serif text-lg text-center mb-4">Choose a new password</h1>
      <label className="text-[10px] uppercase text-text-2 block mb-1">New Password</label>
      <input
        disabled
        type="password"
        className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mb-3"
      />
      <label className="text-[10px] uppercase text-text-2 block mb-1">Confirm New Password</label>
      <input
        disabled
        type="password"
        className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mb-4"
      />
      <ButtonGold disabled className="w-full">
        Update Password
      </ButtonGold>
    </Card>
  );
}
