import { z } from "zod";
import { tradeUpdate } from "@/lib/validators/investments";
import { apiRoute } from "@/server/api";
import { deleteTrade, updateTrade } from "@/server/services/investments";

type Ctx = { params: Promise<{ id: string }> };
const id = z.uuid();

/** Update a trade (its cash side follows). */
export const PATCH = apiRoute<Ctx>(async (user, request, { params }) => {
  await updateTrade(user.id, id.parse((await params).id), tradeUpdate.parse(await request.json()));
});

/** Soft delete the trade and its cash side (restorable via POST /restore). */
export const DELETE = apiRoute<Ctx>(async (user, _request, { params }) => {
  await deleteTrade(user.id, id.parse((await params).id));
});
