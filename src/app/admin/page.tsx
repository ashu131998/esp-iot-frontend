import { redirect } from 'next/navigation';

/** Legacy route — middleware also redirects /admin → /internal */
export default function AdminLegacyPage() {
  redirect('/internal');
}
