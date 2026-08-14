export const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export interface CustomerRecord {
  id: string;
  customerCode: string;
  name: string;
  phoneNumber: string;
  company: string | null;
  memo: string | null;
  status: CustomerStatus;
  doNotCall: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCustomer {
  customerCode: string;
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
