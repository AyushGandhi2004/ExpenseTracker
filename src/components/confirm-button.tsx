"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const RESET_MS = 5000;

/**
 * A destructive button that asks on the page: the first tap arms it and shows `message`, the
 * second tap acts. Native confirm() is avoided because webviews and embedded browsers can
 * block it, which silently makes the action do nothing.
 */
export function ConfirmButton({
  message,
  confirmLabel = "Tap again to confirm",
  onConfirm,
  children,
  wrapperClassName = "flex flex-1 flex-col gap-1",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: ReactNode;
  wrapperClassName?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <div className={wrapperClassName}>
      {/* Before the button: in a bottom sheet this grows upward, so a second tap lands in the same spot. */}
      {armed && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
      <Button
        {...props}
        type="button"
        onClick={() => {
          clearTimeout(timer.current);
          if (armed) {
            setArmed(false);
            onConfirm();
            return;
          }
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), RESET_MS);
        }}
      >
        {armed ? confirmLabel : children}
      </Button>
    </div>
  );
}
