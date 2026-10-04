"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

// The stored theme is only known in the browser; render neutral on the server.
const subscribe = () => () => {};
const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

export function AppearancePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mounted && theme === value}
          onClick={() => setTheme(value)}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-sm aria-checked:bg-background aria-checked:font-medium aria-checked:shadow-sm"
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
