import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// Errors from /auth/callback (the backup sign-in link in the email).
const ERRORS: Record<string, string> = {
  not_allowed: "This email isn't allowed to use this app.",
  auth_failed: "That sign-in link is invalid or has expired. Request a new code.",
  missing_code: "Sign-in was interrupted. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? (ERRORS[error] ?? ERRORS.auth_failed) : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground">
          ₹
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Expense Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to track your spending.</p>
        </div>
        {message && (
          <p role="alert" className="w-full rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
