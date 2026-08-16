export {};

declare global {
  interface Window {
    desktop?: {
      pickAdbPath: () => Promise<string>;
    };
  }
}
