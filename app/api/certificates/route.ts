import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { requestCertificate, CertificateType } from "@/lib/services/documents";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await requestCertificate(ctx, undefined, (body.type as CertificateType) ?? "bonafide", body.purpose ?? "General purpose", "web");
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
