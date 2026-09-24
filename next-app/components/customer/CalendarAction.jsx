'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/interactive.jsx';
import { VacationIcon } from '@/components/ui/Icons.jsx';
import { VacationModal } from './VacationModal.jsx';

export function CalendarVacationButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/10"
      >
        <VacationIcon className="h-4 w-4" />
        <span>Plan Vacation / Skip Dates</span>
      </Button>

      <VacationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
