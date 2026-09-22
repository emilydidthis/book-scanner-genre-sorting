import { NextRequest, NextResponse } from "next/server";
import { lookupISBN } from "@/lib/square";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const isbn = body.isbn as string;

  if (!isbn || typeof isbn !== "string" || isbn.trim().length === 0) {
    return NextResponse.json({ error: "No ISBN provided" }, { status: 400 });
  }

  const accessToken = request.cookies.get("square_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await lookupISBN(accessToken, isbn.trim());
  return NextResponse.json(result);
}
