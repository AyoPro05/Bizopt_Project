import type { Metadata } from "next";
import { ProofConfirmation } from "@/components/auth/flow-forms";
export const metadata: Metadata = {title:"Reset password | BizOpt",referrer:"no-referrer",robots:{index:false,follow:false}};
export default function Page(){return <ProofConfirmation mode="reset"/>;}
