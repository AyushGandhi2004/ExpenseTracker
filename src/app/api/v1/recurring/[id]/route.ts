import { z } from "zod";
import { recurringUpdate } from "@/lib/validators/recurring";
import { apiRoute } from "@/server/api";
import { deleteRecurring, setRecurringPaused, updateRecurring } from "@/server/services/recurring";

type Ctx = { params: Promise<{ id: string }> };
const id = z.uuid();
const patchBody = z.union([z.object({ paused: z.boolean() }).strict(), recurringUpdate]);

/** Update fields (applies from the next payment), or `{ "paused": true|false }`. */
export const PATCH = apiRoute<Ctx>(async (user, request, { params }) => {
  const ruleId = id.parse((await params).id);
  const body = patchBody.parse(await request.json());
  if ("paused" in body) await setRecurringPaused(user.id, ruleId, body.paused);
  else await updateRecurring(user.id, ruleId, body);
});

/** Delete the schedule; payments already recorded are kept. */
export const DELETE = apiRoute<Ctx>(async (user, _request, { params }) => {
  await deleteRecurring(user.id, id.parse((await params).id));
});
