/**
 * Removed — was the temporary DEV bypass that wrote a fake "active"
 * subscription row directly. Restored to the real Cardcom flow per
 * user request. If you find this stub in a future commit, it's safe
 * to delete the file entirely.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "endpoint_removed" },
    { status: 410 },
  );
}
