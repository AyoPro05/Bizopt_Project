import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing verification token" },
      { status: 400 }
    );
  }

  try {
    // Find and validate token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await db.verificationToken.delete({ where: { token } });
      return NextResponse.json(
        { error: "Verification link has expired. Please sign up again." },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier },
      include: {
        memberships: {
          include: {
            org: {
              include: { entitlement: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Mark email as verified
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    // Activate entitlement for first org
    const firstOrg = user.memberships[0]?.org;
    if (firstOrg?.entitlement) {
      await db.entitlement.update({
        where: { id: firstOrg.entitlement.id },
        data: {
          active: true,
          userFacingState: "trial",
        },
      });
    }

    // Delete verification token
    await db.verificationToken.delete({ where: { token } });

    // Send welcome email
    await sendWelcomeEmail({
      email: user.email,
      userName: user.name || "there",
    });

    // Redirect to home with success message
    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/home`);
    redirectUrl.searchParams.set("verified", "true");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email. Please try again." },
      { status: 500 }
    );
  }
}
