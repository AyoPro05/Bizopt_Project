import { NextResponse } from "next/server";
import { getEnabledPlatforms } from "@/services/platforms/registry";

export async function GET() {
  const platforms = await getEnabledPlatforms();
  return NextResponse.json({ platforms });
}
