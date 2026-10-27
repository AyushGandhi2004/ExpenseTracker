import { z } from "zod";
import { apiRoute } from "@/server/api";
import { getHolding } from "@/server/services/investments";

/** One holding and its trades. */
export const GET = apiRoute<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) =>
  getHolding(user.id, z.uuid().parse((await params).id)),
);
