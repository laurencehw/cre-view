import type { Metadata } from 'next';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/lib/auth';
import NavBar from '@/components/NavBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRE View — Skyline Financial Intelligence',
  description:
    'Take a photo of a skyline and instantly see cap tables, debt, equity, and financial data for every building in view.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <ErrorBoundary>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <NavBar />
              <div className="flex-1 overflow-auto">{children}</div>
            </div>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
