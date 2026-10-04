"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const ACTION_WIDTH = 72;
const OPEN_OFFSET = -ACTION_WIDTH * 2;
const OPEN_EVENT = "swipe-row-open";

/**
 * A row that swipes left to reveal Edit and Delete. Tapping the row (or Enter) runs `onTap`.
 * Vertical scrolling keeps working (touch-action: pan-y); only horizontal drags move the row.
 * Opening one row closes any other open row.
 */
export function SwipeRow({
  children,
  onTap,
  onEdit,
  onDelete,
  label,
}: {
  children: ReactNode;
  onTap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) {
  const id = useId();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; start: number; axis: "x" | "y" | null } | null>(null);

  useEffect(() => {
    const onOtherOpen = (e: Event) => (e as CustomEvent<string>).detail !== id && setOffset(0);
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen);
  }, [id]);

  function settle(next: number) {
    setOffset(next);
    if (next !== 0) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, start: offset, axis: null };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis && Math.hypot(dx, dy) > 8) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (d.axis === "x") setOffset(Math.max(OPEN_OFFSET, Math.min(0, d.start + dx)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.axis === "x") return settle(offset < OPEN_OFFSET / 2 ? OPEN_OFFSET : 0);
    if (d.axis === null) {
      // A tap: close if open, otherwise open the transaction.
      if (offset !== 0) setOffset(0);
      else onTap();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  }

  const actionClass = "flex h-full flex-col items-center justify-center gap-1 text-xs font-medium";
  return (
    <div className="relative overflow-hidden">
      {/* Hidden at rest so the red action never bleeds through row borders. */}
      <div
        className={`absolute inset-y-0 right-0 flex ${offset === 0 && !dragging ? "invisible" : ""}`}
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          tabIndex={offset === 0 ? -1 : 0}
          onClick={() => {
            setOffset(0);
            onEdit();
          }}
          className={`${actionClass} bg-muted text-foreground`}
          style={{ width: ACTION_WIDTH }}
        >
          <Pencil className="size-4" aria-hidden />
          Edit
        </button>
        <button
          type="button"
          tabIndex={offset === 0 ? -1 : 0}
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
          className={`${actionClass} bg-destructive text-white`}
          style={{ width: ACTION_WIDTH }}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          settle(offset < OPEN_OFFSET / 2 ? OPEN_OFFSET : 0);
        }}
        onKeyDown={onKeyDown}
        className={`relative cursor-pointer touch-pan-y bg-background select-none hover:bg-muted/40 ${
          dragging ? "" : "transition-transform duration-200"
        }`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
