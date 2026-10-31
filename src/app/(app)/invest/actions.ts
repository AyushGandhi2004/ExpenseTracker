"use server";

import { z } from "zod";
import { convertExpenseInput, manualPriceInput, tradeInput, tradeUpdate } from "@/lib/validators/investments";
import { runAction } from "@/server/action-result";
import { requireUser } from "@/server/auth";
import * as investments from "@/server/services/investments";
import { refreshPrices } from "@/server/services/prices";

const id = z.uuid();

export async function recordTrade(raw: unknown) {
  return runAction((user) => investments.recordTrade(user.id, tradeInput.parse(raw)));
}

export async function updateTrade(tradeId: string, raw: unknown) {
  return runAction((user) => investments.updateTrade(user.id, id.parse(tradeId), tradeUpdate.parse(raw)));
}

export async function deleteTrade(tradeId: string) {
  return runAction((user) => investments.deleteTrade(user.id, id.parse(tradeId)));
}

export async function restoreTrade(tradeId: string) {
  return runAction((user) => investments.restoreTrade(user.id, id.parse(tradeId)));
}

export async function setManualPrice(instrumentId: string, raw: unknown) {
  return runAction((user) => {
    const { price, priceDate } = manualPriceInput.parse(raw);
    return investments.setManualPrice(user.id, id.parse(instrumentId), price, priceDate);
  });
}

export async function setArchived(instrumentId: string, archived: boolean) {
  return runAction((user) => investments.setInstrumentArchived(user.id, id.parse(instrumentId), z.boolean().parse(archived)));
}

export async function convertExpense(raw: unknown) {
  return runAction((user) => investments.convertExpense(user.id, convertExpenseInput.parse(raw)));
}

/** Refresh button: returns counts so the UI can say "prices unavailable" on failure. */
export async function refreshAllPrices(): Promise<{ checked: number; updated: number; failed: number }> {
  const user = await requireUser();
  let result = { checked: 0, updated: 0, failed: 0 };
  const outcome = await runAction(async () => {
    await investments.finalizeEstimatedUnits(user.id);
    result = await refreshPrices(user.id);
  });
  return outcome.ok ? result : { ...result, failed: result.failed || 1 };
}
