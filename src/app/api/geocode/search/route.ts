import { NextResponse, type NextRequest } from "next/server";
import { searchAddress } from "@/lib/geo/geocode";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await searchAddress(q.slice(0, 120)));
}
