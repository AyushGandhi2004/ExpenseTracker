import { z } from "zod";
import { apiRoute } from "@/server/api";
import { restoreTransaction } from "@/server/services/transactions";

export const POST = apiRoute<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  await restoreTransaction(user.id, z.uuid().parse((await params).id));
});
