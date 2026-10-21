import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/lib/catalog/search";
import { getPreferences } from "@/lib/preferences";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const prefs = await getPreferences();
  return NextResponse.json(await searchCatalog(q, prefs));
}
