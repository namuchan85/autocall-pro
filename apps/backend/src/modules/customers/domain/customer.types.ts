export const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_OUTCOMES = [
  'SMS_REQUESTED',
  'NOT_INTERESTED',
  'DO_NOT_CALL',
  'CALL_AGAIN',
] as const;
export type CustomerOutcome = (typeof CUSTOMER_OUTCOMES)[number];

export interface LatestCallSummary {
  status: string;
  provider: string;
  observedActive: boolean;
}

export interface CustomerRecord {
  id: string;
  customerCode: string;
  name: string;
  phoneNumber: string;
  company: string | null;
  memo: string | null;
  status: CustomerStatus;
  doNotCall: boolean;
  lastOutcome: CustomerOutcome | null;
  latestCall: LatestCallSummary | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCustomer {
  customerCode?: string;
  name: string;
  phoneNumber: string;
  company?: string;
  memo?: string;
  status?: CustomerStatus;
  doNotCall?: boolean;
}

export interface CustomerPatch {
  customerCode?: string;
  name?: string;
  phoneNumber?: string;
  company?: string | null;
  memo?: string | null;
  status?: CustomerStatus;
  doNotCall?: boolean;
  lastOutcome?: CustomerOutcome | null;
}

export interface CustomerListQuery {
  page: number;
  limit: number;
  keyword?: string;
  status?: CustomerStatus;
  doNotCall?: boolean;
}

export interface CustomerListResult {
  items: CustomerRecord[];
  total: number;
}
