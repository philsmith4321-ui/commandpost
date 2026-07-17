import { Sidebar } from '@/components/sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { GlobalSearch } from '@/components/global-search';
import { CommandPalette } from '@/components/command-palette';
import { QuickAdd } from '@/components/quick-add';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        <div className="flex items-center justify-end gap-3 p-4 pb-0">
          <GlobalSearch />
        </div>
        {children}
      </main>
      <MobileNav />
      <CommandPalette />
      <QuickAdd />
    </div>
  );
}
