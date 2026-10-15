import type { Metadata } from "next";
import { UnsubscribeConfirmation } from "@/components/notifications/unsubscribe-confirmation";
export const metadata:Metadata={title:"Notification preferences | BizOpt",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function UnsubscribePage(){return <UnsubscribeConfirmation/>;}
