import {
  importLiteData,
  ImportValidationError,
  validateLiteImportPayload,
  type LiteImportDatabase,
  type LiteImportTransaction,
} from './import-lite-data';

const CUSTOMER_A = {
  id: 'imported-a',
  customerCode: 'CUST-A',
  name: 'Hong',
  phoneNumber: '+821011111111',
  status: 'ACTIVE',
  doNotCall: false,
};

const CUSTOMER_B = {
  id: 'imported-b',
  customerCode: 'CUST-B',
  name: 'Kim',
  phoneNumber: '010-2222-2222',
  status: 'INACTIVE',
  doNotCall: true,
};

const CALL_A = {
  id: 'call-a',
  customerId: 'imported-a',
  phoneNumber: '+821011111111',
  status: 'STARTED',
  provider: 'ADB_GALAXY',
  deviceId: 'R58M123',
};

function createDb(existingByCode: Map<string, string> = new Map()): {
  db: LiteImportDatabase;
  createdCustomers: string[];
  createdCalls: Array<{ id: string; customerId: string }>;
  failOnCallId?: string;
} {
  const createdCustomers: string[] = [];
  const createdCalls: Array<{ id: string; customerId: string }> = [];
  const state = {
    failOnCallId: undefined as string | undefined,
  };

  const tx: LiteImportTransaction = {
    customer: {
      findUnique: (args) => {
        if (args.where.customerCode) {
          const id = existingByCode.get(args.where.customerCode);
          return Promise.resolve(id ? { id } : null);
        }
        if (args.where.id) {
          const found = [...existingByCode.values()].includes(args.where.id)
            ? { id: args.where.id }
            : createdCustomers.includes(args.where.id)
              ? { id: args.where.id }
              : null;
          return Promise.resolve(found);
        }
        return Promise.resolve(null);
      },
      create: (args) => {
        createdCustomers.push(args.data.id);
        return Promise.resolve({ id: args.data.id });
      },
      update: (args) => Promise.resolve({ id: args.where.id }),
    },
    call: {
      upsert: (args) => {
        if (state.failOnCallId && args.create.id === state.failOnCallId) {
          return Promise.reject(new Error('call insert failed'));
        }
        createdCalls.push({ id: args.create.id, customerId: args.create.customerId });
        return Promise.resolve({ id: args.create.id });
      },
    },
  };

  return {
    get failOnCallId() {
      return state.failOnCallId;
    },
    set failOnCallId(value: string | undefined) {
      state.failOnCallId = value;
    },
    createdCustomers,
    createdCalls,
    db: {
      $transaction: async (fn) => {
        const snapshotCustomers = [...createdCustomers];
        const snapshotCalls = [...createdCalls];
        try {
          return await fn(tx);
        } catch (error) {
          createdCustomers.length = 0;
          createdCalls.length = 0;
          createdCustomers.push(...snapshotCustomers);
          createdCalls.push(...snapshotCalls);
          throw error;
        }
      },
    },
  };
}

describe('importLiteData', () => {
  it('imports customers and calls with customer id mapping', async () => {
    const harness = createDb(new Map([['CUST-A', 'actual-a']]));
    const result = await importLiteData(harness.db, {
      customers: [CUSTOMER_A, CUSTOMER_B],
      calls: [
        CALL_A,
        { ...CALL_A, id: 'call-b', customerId: 'imported-b', phoneNumber: '+821022222222' },
      ],
    });

    expect(result).toEqual({ customersImported: 2, callsImported: 2 });
    expect(harness.createdCustomers).toEqual(['imported-b']);
    expect(harness.createdCalls).toEqual([
      { id: 'call-a', customerId: 'actual-a' },
      { id: 'call-b', customerId: 'imported-b' },
    ]);
  });

  it('rejects duplicate customerCode in the payload', () => {
    expect(() =>
      validateLiteImportPayload({
        customers: [CUSTOMER_A, { ...CUSTOMER_A, id: 'other' }],
        calls: [],
      }),
    ).toThrow(ImportValidationError);
  });

  it('rejects a call that references a missing customerId', () => {
    expect(() =>
      validateLiteImportPayload({
        customers: [CUSTOMER_A],
        calls: [{ ...CALL_A, customerId: 'missing' }],
      }),
    ).toThrow(/unknown customerId/);
  });

  it('rejects a malformed payload', () => {
    expect(() => validateLiteImportPayload('nope')).toThrow(ImportValidationError);
    expect(() =>
      validateLiteImportPayload({
        customers: [{ ...CUSTOMER_A, status: 'WRONG' }],
      }),
    ).toThrow(/status is invalid/);
  });

  it('rolls back the whole import when a later write fails', async () => {
    const harness = createDb();
    harness.failOnCallId = 'call-a';

    await expect(
      importLiteData(harness.db, {
        customers: [CUSTOMER_A],
        calls: [CALL_A],
      }),
    ).rejects.toThrow('call insert failed');
    expect(harness.createdCustomers).toEqual([]);
    expect(harness.createdCalls).toEqual([]);
  });

  it('returns actual imported counts', async () => {
    const harness = createDb();
    const result = await importLiteData(harness.db, {
      customers: [CUSTOMER_A],
      calls: [CALL_A],
    });
    expect(result.customersImported).toBe(harness.createdCustomers.length);
    expect(result.callsImported).toBe(harness.createdCalls.length);
  });
});
