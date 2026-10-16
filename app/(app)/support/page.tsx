import { AppTopbar } from "@/components/shell/app-topbar";
import { SupportWorkspace } from "@/components/support/support-workspace";
export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const workflow = typeof params.workflow === "string" ? params.workflow.split(/[?#]/, 1)[0].slice(0, 100) : "General";
  return <div><AppTopbar /><SupportWorkspace security={params.security === "1"} issue={params.issue === "1" || params.report === "1"} workflow={workflow || "General"} /></div>;
}
