'use client';

import { Loader2, Save, X } from 'lucide-react';
import { useTransition } from 'react';
import { saveDebt } from '@/app/actions';
import type { DebtSchedule } from '@/lib/domain/types';

export function LoanForm({ debt, onDone }: { debt?: DebtSchedule; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(form) =>
        startTransition(async () => {
          await saveDebt(form);
          onDone();
        })
      }
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-6"
    >
      <input type="hidden" name="id" value={debt?.id ?? 0} />
      <label className="col-span-2 sm:col-span-3">
        <span className="label">Loan name</span>
        <input name="name" required defaultValue={debt?.name} className="field" />
      </label>
      <label className="col-span-2 sm:col-span-3">
        <span className="label">Lender</span>
        <input name="lender" defaultValue={debt?.lender} className="field" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Monthly ₱</span>
        <input name="monthlyAmount" type="number" step="0.01" min="0.01" required defaultValue={debt?.monthlyAmount} className="field-money" />
      </label>
      <label>
        <span className="label">Due day</span>
        <input name="dueDay" type="number" min="1" max="31" required defaultValue={debt?.dueDay ?? 1} className="field-money" />
      </label>
      <label>
        <span className="label">Paid</span>
        <input name="paidInstallments" type="number" min="0" required defaultValue={debt?.paidInstallments ?? 0} className="field-money" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Total installments</span>
        <input name="totalInstallments" type="number" min="1" required defaultValue={debt?.totalInstallments ?? 12} className="field-money" />
      </label>
      <label className="col-span-2 sm:col-span-6">
        <span className="label">Notes</span>
        <input name="notes" defaultValue={debt?.notes} className="field" />
      </label>
      <div className="col-span-2 flex justify-end gap-2 sm:col-span-6">
        <button type="button" className="btn-neutral" onClick={onDone} disabled={isPending}>
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {debt ? 'Save loan' : 'Add loan'}
        </button>
      </div>
    </form>
  );
}
