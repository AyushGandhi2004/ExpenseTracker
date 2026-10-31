"use client";

import { Loader2, Search } from "lucide-react";
import { useRef, useState } from "react";
import { fieldClass } from "@/components/form-field";
import type { InstrumentRef } from "@/lib/validators/investments";

/** What a trade form needs to know about the fund/stock it's for. */
export type PickedInstrument = {
  /** Set when it's already one of the user's holdings. */
  instrumentId?: string;
  kind: "mutual_fund" | "stock";
  name: string;
  schemeCode: string | null;
  symbol: string | null;
  exchange: string | null;
};

export function refOf(p: PickedInstrument): InstrumentRef {
  return p.kind === "mutual_fund"
    ? { kind: "mutual_fund", schemeCode: p.schemeCode!, name: p.name }
    : { kind: "stock", symbol: p.symbol!, exchange: p.exchange as "NSE" | "BSE", name: p.name };
}

const segment =
  "flex h-10 flex-1 items-center justify-center rounded-md text-sm aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

type Result = { schemeCode?: string; symbol?: string; exchange?: "NSE" | "BSE"; name: string };

/** Mutual fund / Stock toggle, a debounced search box, and your holdings as quick picks. */
export function InstrumentSearch({
  holdings,
  onPick,
  fundsOnly = false,
}: {
  holdings: PickedInstrument[];
  fundsOnly?: boolean;
  onPick: (p: PickedInstrument) => void;
}) {
  const [kind, setKind] = useState<"mutual_fund" | "stock">("mutual_fund");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);

  function search(text: string, forKind = kind) {
    clearTimeout(timer.current);
    request.current?.abort();
    if (text.trim().length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const res = await fetch(`/api/v1/instruments/search?kind=${forKind}&q=${encodeURIComponent(text.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: Result[] };
        setResults(body.results);
        setStatus("done");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, 300);
  }

  const mine = holdings.filter(
    (h) => h.kind === kind && (!query.trim() || h.name.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-3">
      {!fundsOnly && (
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Type">
          {(["mutual_fund", "stock"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              className={segment}
              onClick={() => {
                setKind(k);
                search(query, k);
              }}
            >
              {k === "mutual_fund" ? "Mutual fund" : "Stock"}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          aria-label={kind === "mutual_fund" ? "Search mutual funds" : "Search stocks"}
          placeholder={kind === "mutual_fund" ? "Fund name, e.g. Parag Parikh Flexi" : "Company or symbol, e.g. TCS"}
          autoComplete="off"
          className={`${fieldClass} pl-9`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
        />
        {status === "loading" && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />
        )}
      </div>

      {mine.length > 0 && (
        <div>
          <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">Your holdings</p>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {mine.map((h) => (
              <li key={h.instrumentId}>
                <button type="button" onClick={() => onPick(h)} className="w-full px-4 py-3 text-left text-sm hover:bg-muted/60">
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Search isn&apos;t available right now. Check your connection and try again.
        </p>
      )}
      {status === "done" && results.length === 0 && <p className="px-1 text-sm text-muted-foreground">No matches.</p>}
      {results.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border" aria-label="Search results">
          {results.map((r) => (
            <li key={r.schemeCode ?? `${r.symbol}.${r.exchange}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                onClick={() => {
                  const existing = holdings.find((h) =>
                    kind === "mutual_fund" ? h.schemeCode === r.schemeCode : h.symbol === r.symbol && h.exchange === r.exchange,
                  );
                  onPick(
                    existing ?? {
                      kind,
                      name: r.name,
                      schemeCode: r.schemeCode ?? null,
                      symbol: r.symbol ?? null,
                      exchange: r.exchange ?? null,
                    },
                  );
                }}
              >
                <span className="min-w-0 flex-1 text-sm">{r.name}</span>
                {r.symbol && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {r.symbol} · {r.exchange}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
