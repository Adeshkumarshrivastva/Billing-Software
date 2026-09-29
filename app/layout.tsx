import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { LocalOnlyGuard } from '@/components/local-only-guard';
import { BillingProvider } from '@/lib/store';
import { ToastProvider } from '@/lib/toast';

export const metadata: Metadata = {
  title: 'PMC | Tech Billing Software',
  description: 'PMC Tech Billing Software — patient registration, service billing, payments and reports for clinics.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LocalOnlyGuard />
        <ToastProvider>
          <BillingProvider>
            <AppShell>{children}</AppShell>
          </BillingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
