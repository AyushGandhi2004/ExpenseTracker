import { apiRoute } from "@/server/api";
import { getQuickAddOptions } from "@/server/services/quick-add";

/** Categories, payment methods and accounts for building entry forms. */
export const GET = apiRoute((user) => getQuickAddOptions(user.id));
