import "server-only";

import { getPreferences } from "@/lib/preferences";
import { makeTranslator } from "./dictionaries";

export async function getT() {
  const { locale } = await getPreferences();
  return { t: makeTranslator(locale), locale };
}
