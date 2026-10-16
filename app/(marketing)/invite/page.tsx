import type { Metadata } from "next";
import { InviteAcceptance } from "@/components/workspace/invite-acceptance";

export const metadata: Metadata = { title: "Workspace invitation | BizOptz", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function InvitePage() { return <InviteAcceptance/>; }
