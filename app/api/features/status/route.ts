import { NextResponse } from "next/server";
import { checkEnvStatus } from "@/lib/env-check";

export async function GET() {
    
  const status = checkEnvStatus();
  return NextResponse.json(status);
}
export const dynamic = "force-dynamic";
