import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/services/library";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const query = new URL(req.url).searchParams.get("query") ?? "";
    const books = await searchCatalog(query);
    return NextResponse.json({ books });
  } catch (err) {
    return handleApiError(err);
  }
}
