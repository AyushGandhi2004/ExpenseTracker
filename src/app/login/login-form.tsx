"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendCode, verifyCode, type LoginState } from "./actions";

const inputClass =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function LoginForm() {
  // Restarting the flow remounts the forms with fresh state.
  const [attempt, setAttempt] = useState(0);
  return <LoginSteps key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}

function LoginSteps({ onRestart }: { onRestart: () => void }) {
  const [sent, send, sending] = useActionState<LoginState, FormData>(sendCode, { step: "email" });
  const [verified, verify, verifying] = useActionState<LoginState, FormData>(verifyCode, {
    step: "email",
  });

  // Once a code is sent, the verify form owns the flow (and its errors).
  const email = verified.step === "code" ? verified.email : sent.step === "code" ? sent.email : null;

  if (!email) {
    return (
      <form key="email" action={send} className="flex w-full flex-col gap-3 text-left">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={sent.step === "email" ? sent.email : undefined}
          className={inputClass}
        />
        {sent.error && <p role="alert" className="text-sm text-destructive">{sent.error}</p>}
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={sending}>
          {sending ? "Sending…" : "Email me a code"}
        </Button>
      </form>
    );
  }

  const error = verified.step === "code" ? verified.error : sent.step === "code" ? sent.error : undefined;
  return (
    <form key="code" action={verify} className="flex w-full flex-col gap-3 text-left">
      <p className="text-sm text-muted-foreground">
        We sent a code to <span className="font-medium text-foreground">{email}</span>. You can also tap
        the link in that email.
      </p>
      <input type="hidden" name="email" value={email} />
      <label htmlFor="code" className="text-sm font-medium">
        Code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6,10}"
        maxLength={10}
        required
        autoFocus
        className={`${inputClass} text-center text-xl tracking-[0.4em]`}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={verifying}>
        {verifying ? "Verifying…" : "Sign in"}
      </Button>
      <Button type="button" variant="ghost" onClick={onRestart}>
        Use a different email
      </Button>
    </form>
  );
}
