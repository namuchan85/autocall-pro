import {
  CALL_PROVIDERS,
  CALL_STATUSES,
  type CallProvider,
  type CallStatus,
} from '../telephony/domain/telephony.types';
import { CUSTOMER_STATUSES, type CustomerStatus } from '../customers/domain/customer.types';
import { isE164PhoneNumber, normalizePhoneNumber } from '../customers/validation/phone-number';

const CUSTOMER_CODE_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportValidationError';
  }
}

export interface ImportLiteResult {
  customersImported: number;
  callsImported: number;
}

export interface ValidatedImportCustomer {
  id: string;
  customerCode: string;
  name: string;
  phoneNumber: string;
  company: string | null;
  memo: string | null;
  status: CustomerStatus;
  doNotCall: boolean;
}

export interface ValidatedImportCall {
  id: string;
  customerId: string;
  phoneNumber: string;
  status: CallStatus;
  provider: CallProvider;
  deviceId: string;
  errorMessage: string | null;
}

export interface ValidatedLiteImport {
  customers: ValidatedImportCustomer[];
  calls: ValidatedImportCall[];
}

export interface LiteImportTransaction {
  customer: {
    findUnique: (args: {
      where: { id?: string; customerCode?: string };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: ValidatedImportCustomer }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: Omit<ValidatedImportCustomer, 'id' | 'customerCode'>;
    }) => Promise<{ id: string }>;
  };
  call: {
    upsert: (args: {
      where: { id: string };
      update: Record<string, never>;
      create: ValidatedImportCall;
    }) => Promise<{ id: string }>;
  };
}

export interface LiteImportDatabase {
  $transaction: <T>(fn: (tx: LiteImportTransaction) => Promise<T>) => Promise<T>;
}

export function validateLiteImportPayload(payload: unknown): ValidatedLiteImport {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ImportValidationError('Import payload must be an object');
  }
  const record = payload as Record<string, unknown>;
  const customers = parseArray(record.customers, 'customers').map((item, index) =>
    parseCustomer(item, index),
  );
  const calls = parseArray(record.calls, 'calls').map((item, index) => parseCall(item, index));

  assertUnique(
    customers.map((item) => item.id),
    'duplicate customer id',
  );
  assertUnique(
    customers.map((item) => item.customerCode),
    'duplicate customerCode',
  );
  assertUnique(
    calls.map((item) => item.id),
    'duplicate call id',
  );

  const customerIds = new Set(customers.map((item) => item.id));
  if (customers.length > 0) {
    for (const call of calls) {
      if (!customerIds.has(call.customerId)) {
        throw new ImportValidationError(`Call ${call.id} references unknown customerId`);
      }
    }
  }

  return { customers, calls };
}

export async function importLiteData(
  db: LiteImportDatabase,
  payload: unknown,
): Promise<ImportLiteResult> {
  const parsed = validateLiteImportPayload(payload);
  if (parsed.customers.length === 0 && parsed.calls.length === 0) {
    return { customersImported: 0, callsImported: 0 };
  }

  return db.$transaction(async (tx) => {
    const customerIds = new Map<string, string>();
    for (const customer of parsed.customers) {
      const existing = await tx.customer.findUnique({
        where: { customerCode: customer.customerCode },
      });
      if (existing) {
        await tx.customer.update({
          where: { id: existing.id },
          data: {
            name: customer.name,
            phoneNumber: customer.phoneNumber,
            company: customer.company,
            memo: customer.memo,
            status: customer.status,
            doNotCall: customer.doNotCall,
          },
        });
        customerIds.set(customer.id, existing.id);
      } else {
        const created = await tx.customer.create({ data: customer });
        customerIds.set(customer.id, created.id);
      }
    }

    for (const call of parsed.calls) {
      const mappedId = customerIds.get(call.customerId);
      const actualCustomerId =
        mappedId ?? (await tx.customer.findUnique({ where: { id: call.customerId } }))?.id;
      if (!actualCustomerId) {
        throw new ImportValidationError(`Call ${call.id} references unknown customerId`);
      }
      await tx.call.upsert({
        where: { id: call.id },
        update: {},
        create: {
          ...call,
          customerId: actualCustomerId,
        },
      });
    }

    return {
      customersImported: parsed.customers.length,
      callsImported: parsed.calls.length,
    };
  });
}

function parseArray(value: unknown, field: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ImportValidationError(`${field} must be an array`);
  }
  return value;
}

function parseCustomer(value: unknown, index: number): ValidatedImportCustomer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImportValidationError(`customers[${index}] must be an object`);
  }
  const record = value as Record<string, unknown>;
  const id = requiredString(record.id, `customers[${index}].id`);
  const customerCode = requiredString(record.customerCode, `customers[${index}].customerCode`);
  if (!CUSTOMER_CODE_PATTERN.test(customerCode)) {
    throw new ImportValidationError(`customers[${index}].customerCode is invalid`);
  }
  const phoneNumber = normalizePhoneNumber(
    requiredString(record.phoneNumber, `customers[${index}].phoneNumber`),
  );
  if (!isE164PhoneNumber(phoneNumber)) {
    throw new ImportValidationError(`customers[${index}].phoneNumber is invalid`);
  }
  const status = record.status;
  if (typeof status !== 'string' || !isCustomerStatus(status)) {
    throw new ImportValidationError(`customers[${index}].status is invalid`);
  }
  if (typeof record.doNotCall !== 'boolean') {
    throw new ImportValidationError(`customers[${index}].doNotCall is invalid`);
  }
  return {
    id,
    customerCode,
    name: requiredString(record.name, `customers[${index}].name`),
    phoneNumber,
    company: optionalNullableString(record.company, `customers[${index}].company`),
    memo: optionalNullableString(record.memo, `customers[${index}].memo`),
    status,
    doNotCall: record.doNotCall,
  };
}

function parseCall(value: unknown, index: number): ValidatedImportCall {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImportValidationError(`calls[${index}] must be an object`);
  }
  const record = value as Record<string, unknown>;
  const phoneNumber = normalizePhoneNumber(
    requiredString(record.phoneNumber, `calls[${index}].phoneNumber`),
  );
  if (!isE164PhoneNumber(phoneNumber)) {
    throw new ImportValidationError(`calls[${index}].phoneNumber is invalid`);
  }
  const status = record.status;
  if (typeof status !== 'string' || !isCallStatus(status)) {
    throw new ImportValidationError(`calls[${index}].status is invalid`);
  }
  const provider = record.provider ?? 'ADB_GALAXY';
  if (typeof provider !== 'string' || !isCallProvider(provider)) {
    throw new ImportValidationError(`calls[${index}].provider is invalid`);
  }
  return {
    id: requiredString(record.id, `calls[${index}].id`),
    customerId: requiredString(record.customerId, `calls[${index}].customerId`),
    phoneNumber,
    status,
    provider,
    deviceId: requiredString(record.deviceId, `calls[${index}].deviceId`),
    errorMessage: optionalNullableString(record.errorMessage, `calls[${index}].errorMessage`),
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ImportValidationError(`${field} is required`);
  }
  return value.trim();
}

function optionalNullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ImportValidationError(`${field} is invalid`);
  }
  return value;
}

function assertUnique(values: string[], message: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ImportValidationError(message);
    }
    seen.add(value);
  }
}

function isCustomerStatus(value: string): value is CustomerStatus {
  return (CUSTOMER_STATUSES as readonly string[]).includes(value);
}

function isCallStatus(value: string): value is CallStatus {
  return (CALL_STATUSES as readonly string[]).includes(value);
}

function isCallProvider(value: string): value is CallProvider {
  return (CALL_PROVIDERS as readonly string[]).includes(value);
}
