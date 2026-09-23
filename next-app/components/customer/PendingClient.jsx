'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/interactive.jsx';
import { quickApproveCustomer } from '@/actions/customer.actions.js';

export function QuickApproveCustomer() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full font-semibold"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await quickApproveCustomer();
          if (result.ok) {
            toast.success('Customer approved! Opening dashboard...');
            window.location.href = '/dashboard';
          } else {
            toast.error(result.message ?? 'Could not approve customer.');
          }
        })
      }
    >
      ⚡ Instant Approve (Dev / Testing Mode)
    </Button>
  );
}
