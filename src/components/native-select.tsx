import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { fieldClass } from "@/components/form-field";

/** A styled native <select>: phones show their own picker, which is the fastest UI there. */
export function NativeSelect({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={`${fieldClass} appearance-none pr-9 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
