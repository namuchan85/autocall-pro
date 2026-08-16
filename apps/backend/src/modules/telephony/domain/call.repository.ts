import type { CallHistoryItem, CallRecord, CallStatusPatch, NewCall } from './telephony.types';

export const CALL_REPOSITORY = Symbol('CALL_REPOSITORY');

export interface CallRepository {
  create(input: NewCall): Promise<CallRecord>;
  updateStatus(id: string, patch: CallStatusPatch): Promise<CallRecord | null>;
  listRecent(limit: number): Promise<CallHistoryItem[]>;
}
