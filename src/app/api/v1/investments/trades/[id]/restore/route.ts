import { z } from "zod";
import { apiRoute } from "@/server/api";
import { restoreTrade } from "@/server/services/investments";

export const POST = apiRoute<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  await restoreTrade(user.id, z.uuid().parse((await params).id));
});
