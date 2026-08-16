export function shouldQuitForSecondInstance(gotLock: boolean): boolean {
  return !gotLock;
}

export function focusExistingWindow(
  window: {
    isMinimized(): boolean;
    restore(): void;
    show(): void;
    focus(): void;
  } | null,
): void {
  if (!window) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}
