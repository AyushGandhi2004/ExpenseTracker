import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { todayIst } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { UserError } from "@/server/errors";
import { getHolding, listHoldings } from "@/server/services/investments";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { HoldingDetail } from "./holding-detail";

export const metadata: Metadata = { title: "Holding" };

export default async function HoldingPage({ params }: PageProps<"/invest/[id]">) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const detail = await getHolding(user.id, id.data).catch((error: unknown) => {
    if (error instanceof UserError) notFound();
    throw error;
  });
  const [options, holdings] = await Promise.all([getQuickAddOptions(user.id), listHoldings(user.id)]);
  return <HoldingDetail detail={detail} options={options} holdings={[...holdings.open, ...holdings.closed]} today={todayIst()} />;
}
