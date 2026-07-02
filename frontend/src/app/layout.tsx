import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Providers from '@/lib/providers';

export const metadata: Metadata = {
  title: 'Turbo Short Video SaaS - MoneyPrinterTurbo',
  description: 'Nền tảng sinh video ngắn tự động bằng AI sử dụng MoneyPrinterTurbo Engine',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full bg-zinc-950 text-zinc-100">
      <body className="h-full flex overflow-hidden">
        <Providers>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
