import { requireAdmin } from '@/auth/session.js';
import * as adminService from '@/services/admin.service.js';

import { PageHeader, Notice } from '@/components/ui/index.jsx';
import { SettingsForm } from '@/components/admin/Settings.jsx';

export const metadata = { title: 'Settings' };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await adminService.getSettings();

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration." />

      <div className="mb-5">
        <Notice tone="caution" title="These change where every milkman sends money">
          Every change here is recorded in the audit log.
        </Notice>
      </div>

      <SettingsForm settings={settings} />
    </>
  );
}
