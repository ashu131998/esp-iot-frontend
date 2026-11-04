import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

/** Staff accounts: the same link by email, no factory. */
export default function InternalForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      title="Internal ops"
      subtitle="We will email you a link to set a new staff password."
      staff
    />
  );
}
