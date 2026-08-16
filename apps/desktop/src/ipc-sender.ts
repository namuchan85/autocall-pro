import { FRONTEND_ORIGIN, isAllowedFrontendUrl } from './frontend-url';

export function isAllowedIpcSenderUrl(url: string): boolean {
  if (!isAllowedFrontendUrl(url)) {
    return false;
  }
  return url.startsWith(FRONTEND_ORIGIN);
}

export function isTrustedIpcSender(input: {
  senderUrl: string | undefined;
  isMainFrame: boolean;
  senderWebContentsId: number;
  mainWindowWebContentsId: number;
}): boolean {
  if (!input.isMainFrame) {
    return false;
  }
  if (input.senderWebContentsId !== input.mainWindowWebContentsId) {
    return false;
  }
  if (!input.senderUrl) {
    return false;
  }
  return isAllowedIpcSenderUrl(input.senderUrl);
}
