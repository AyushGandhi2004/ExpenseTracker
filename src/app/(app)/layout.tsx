import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/server/auth";
import { ensureUserDefaults } from "@/server/services/setup";

/** Signed-in app shell: content column sized for phones, with bottom navigation. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // Self-heals if seeding failed during sign-in; a single indexed lookup otherwise.
  await ensureUserDefaults(user.id);

  return (
    <>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
