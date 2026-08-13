import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoCall Pro',
  description: 'AI 기반 텔레마케팅 오토콜 시스템',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
