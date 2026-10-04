import { z } from "zod";
import { dashboardPeriod, todayIst } from "@/lib/dates";
import { apiRoute, queryOf } from "@/server/api";
import { getDashboard } from "@/server/services/analytics";

const params = z.object({
  period: z.enum(["week", "month"]).default("month"),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Same numbers as the Home dashboard. ?period=week|month&anchor=YYYY-MM-DD */
export const GET = apiRoute(async (user, request) => {
  const { period: kind, anchor } = params.parse(queryOf(request));
  const today = todayIst();
  const period = dashboardPeriod(kind, anchor && anchor <= today ? anchor : today, today);
  const data = await getDashboard(user.id, period);
  return { period, ...data, daily: Object.fromEntries(data.daily) };
});
