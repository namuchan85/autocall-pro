import type {
  CustomerListQuery,
  CustomerListResult,
  CustomerPatch,
  CustomerRecord,
  NewCustomer,
} from './customer.types';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepository {
  create(input: NewCustomer): Promise<CustomerRecord>;
  findById(id: string): Promise<CustomerRecord | null>;
  list(query: CustomerListQuery): Promise<CustomerListResult>;
  update(id: string, patch: CustomerPatch): Promise<CustomerRecord | null>;
  softDelete(id: string): Promise<boolean>;
}
