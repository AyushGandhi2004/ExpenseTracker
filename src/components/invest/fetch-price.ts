import type { PickedInstrument } from "./instrument-search";

export type FetchedPrice = { price: string; date: string; estimated: boolean };

/** NAV/price for a trade on `date` via /api/v1/instruments/price; null when unavailable. */
export async function fetchTradePrice(inst: PickedInstrument, date: string): Promise<FetchedPrice | null> {
  const params = new URLSearchParams({ kind: inst.kind, date });
  if (inst.kind === "mutual_fund") params.set("schemeCode", inst.schemeCode!);
  else {
    params.set("symbol", inst.symbol!);
    params.set("exchange", inst.exchange!);
  }
  try {
    const res = await fetch(`/api/v1/instruments/price?${params}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { price: string | null; date?: string; estimated?: boolean };
    return body.price ? { price: body.price, date: body.date!, estimated: !!body.estimated } : null;
  } catch {
    return null;
  }
}
