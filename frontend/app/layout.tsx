import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRE View — Skyline Financial Intelligence',
  description:
    'Take a photo of a skyline and instantly see cap tables, debt, equity, and financial data for every building in view.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
