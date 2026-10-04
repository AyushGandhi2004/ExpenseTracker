import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";
import { ensureUserDefaults } from "@/server/services/setup";

// Placeholder home until the dashboard (M6) lands.
export default async function Home() {
  const user = await requireUser();
  // Self-heal if seeding failed during sign-in. Moves to the app shell layout in M3.
  await ensureUserDefaults(user.id);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Expense Tracker</h1>
      <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
