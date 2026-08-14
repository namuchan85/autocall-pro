export class CustomerCodeConflictError extends Error {
  constructor() {
    super('Customer code already exists');
    this.name = 'CustomerCodeConflictError';
  }
}
