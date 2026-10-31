import type { HoldingView } from "@/server/services/investments";
import type { PickedInstrument } from "./instrument-search";

export const pickedOf = (h: HoldingView): PickedInstrument => ({
  instrumentId: h.id,
  kind: h.kind,
  name: h.name,
  schemeCode: h.schemeCode,
  symbol: h.symbol,
  exchange: h.exchange,
});
