export {};

declare global {
  interface Window {
    desktop?: {
      pickAdbPath: () => Promise<string>;
      getDesktopBuildInfo: () => Promise<{ buildAt: string; gitSha: string; version: string }>;
    };
  }
}
