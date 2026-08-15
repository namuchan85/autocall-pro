export function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
