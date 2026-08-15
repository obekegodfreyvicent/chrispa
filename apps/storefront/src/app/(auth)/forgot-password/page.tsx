import Link from 'next/link';
import { Card, ButtonGold } from '@/components/ui';

// FR-10.1: Forgot Password — step 1 of 2. UI only: the API has no
// password-reset endpoint yet (needs an email/SMS delivery channel first).
export default function ForgotPasswordPage() {
  return (
    <Card className="p-7">
      <h1 className="font-serif text-lg text-center mb-1">Reset your password</h1>
      <p className="text-[11.5px] text-text-2 mb-4">
        Enter the email or phone linked to your account and we&apos;ll send a reset link / code.
      </p>
      <label className="text-[10px] uppercase text-text-2 block mb-1">Email or Phone</label>
      <input
        disabled
        placeholder="sarah@email.com"
        className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mb-4"
      />
      <ButtonGold disabled className="w-full">
        Send Reset Link
      </ButtonGold>
      <p className="text-center text-[11px] mt-4">
        <Link href="/login" className="text-gold-light">Back to Log In</Link>
      </p>
    </Card>
  );
}
