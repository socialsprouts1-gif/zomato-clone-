import { NextResponse, type NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/geo/geocode";

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  return NextResponse.json(await reverseGeocode(lat, lng));
}
