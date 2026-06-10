import { adminAuth } from "./firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

/** Verify the Bearer ID token from a request. Returns the decoded token or null. */
export async function verifyRequest(req: Request): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await adminAuth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}
