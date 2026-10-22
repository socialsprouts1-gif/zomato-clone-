import { NextResponse, type NextRequest } from "next/server";
import { advanceDemo } from "@/lib/admin/demo";
import { getSessionUser } from "@/lib/auth/session";

/** Polled every ~2 s by the "Run full demo" panel: advances the demo order and returns its progress. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.profile.is_blocked || user.profile.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("order");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Missing order" }, { status: 400 });
  const progress = await advanceDemo(id);
  if (!progress) return NextResponse.json({ error: "Not a demo order" }, { status: 404 });
  return NextResponse.json(progress);
}
