import type { CustomerRecord } from '../../customers/domain/customer.types';

export function callEligibilityMessage(
  customer: Pick<CustomerRecord, 'status' | 'doNotCall'>,
): string | null {
  if (customer.doNotCall) {
    return 'Customer is on the do-not-call list';
  }
  if (customer.status === 'INACTIVE') {
    return 'Customer is inactive';
  }
  if (customer.status === 'BLOCKED') {
    return 'Customer is blocked';
  }
  if (customer.status !== 'ACTIVE') {
    return 'Customer is not eligible to call';
  }
  return null;
}
