import { BottomNav } from "@/components/bottom-nav";
import { MoneySheetsProvider } from "@/components/money/money-sheets";
import { QuickAddFab } from "@/components/quick-add/quick-add-fab";
import { QuickAddProvider } from "@/components/quick-add/quick-add-provider";
import { requireUser } from "@/server/auth";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { ensureUserDefaults } from "@/server/services/setup";

/** Signed-in app shell: content column sized for phones, bottom navigation, and quick add. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // Self-heals if seeding failed during sign-in; a single indexed lookup otherwise.
  await ensureUserDefaults(user.id);
  const quickAddOptions = await getQuickAddOptions(user.id);

  return (
    <QuickAddProvider options={quickAddOptions}>
      <MoneySheetsProvider options={quickAddOptions}>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <QuickAddFab />
        <BottomNav />
      </MoneySheetsProvider>
    </QuickAddProvider>
  );
}
