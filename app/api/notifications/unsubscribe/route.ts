import { z } from "zod";
import { mutationGuard,readJson,AppError } from "@/lib/platform-http";
import { supportError,supportJson } from "@/lib/support-http";
import { verifyUnsubscribeProof } from "@/services/notifications/crypto";
import { setNotificationPreference } from "@/services/notification-access";
export async function POST(req:Request){try{if(req.headers.has("authorization"))throw new AppError("Request authentication is not allowed for this confirmation.",403);mutationGuard(req);const input=z.object({token:z.string().min(1).max(1500)}).strict().parse(await readJson(req,2000));let proof:ReturnType<typeof verifyUnsubscribeProof>;try{proof=verifyUnsubscribeProof(input.token);}catch{throw new AppError("This confirmation link is invalid or expired. Manage your preferences after signing in.",400);}await setNotificationPreference(proof.userId,{channel:"EMAIL",category:proof.category,enabled:false,timezone:"Europe/London",digestFrequency:"off"});return supportJson({ok:true});}catch(error){return supportError(error);}}
