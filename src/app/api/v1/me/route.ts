import { apiRoute } from "@/server/api";

export const GET = apiRoute(async (user) => ({ id: user.id, email: user.email }));
