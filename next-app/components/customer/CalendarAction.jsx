'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/interactive.jsx';
import { VacationModal } from './VacationModal.jsx';

export function CalendarVacationButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/10"
      >
        Plan Vacation / Skip Dates
      </Button>

      <VacationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
