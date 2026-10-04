import { PageHeader } from "@/components/page-header";

// Placeholder home until quick add (M4) and the dashboard (M6) land.
export default function Home() {
  return (
    <>
      <PageHeader title="Expense Tracker" />
      <p className="py-12 text-center text-sm text-muted-foreground">
        Quick add and your spending dashboard are coming next.
      </p>
    </>
  );
}
