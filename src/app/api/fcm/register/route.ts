import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";

export const runtime = "nodejs";

// Store an FCM token under the user. Token string is the doc id so re-registering
// the same browser is idempotent.
export async function POST(req: Request) {
  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, userAgent } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const id = Buffer.from(token).toString("base64url").slice(0, 200);
  await adminDb
    .collection("users")
    .doc(decoded.uid)
    .collection("fcmTokens")
    .doc(id)
    .set({ token, userAgent: userAgent ?? "", createdAt: Date.now() }, { merge: true });

  return NextResponse.json({ ok: true });
}
