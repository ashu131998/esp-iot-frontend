import { redirect } from 'next/navigation';

export default function InternalSettingsRedirect() {
  redirect('/internal/health');
}
