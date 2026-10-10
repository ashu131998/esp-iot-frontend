import { redirect } from 'next/navigation';

/** Legacy path — use /internal/nodes */
export default function InternalDevicesRedirect() {
  redirect('/internal/nodes');
}
