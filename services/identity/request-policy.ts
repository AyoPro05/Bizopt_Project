import { createHash } from "node:crypto";
import { AppError } from "@/services/platform/errors";
import { identityTransaction, lockIdentity } from "./database";
type LimitRule = {scope:string;value:string;maximum:number;windowMs:number};
export async function consumeIdentityLimits(rules: LimitRule[]) {
  const now = new Date();
  const entries = rules.map(rule=>({...rule,key:createHash("sha256").update(`identity-rate:${rule.scope}:${rule.value}`).digest("hex")})).sort((a,b)=>a.key.localeCompare(b.key));
  return identityTransaction(async tx=>{
    let retryAfterSec=0;
    for(const rule of entries) {
      await lockIdentity(tx,`rate:${rule.key}`);
      const old = await tx.identityRateLimit.findUnique({where:{key:rule.key}});
      const expired = !old || +old.windowStartedAt + rule.windowMs <= +now;
      const attempts = expired ? 1 : Math.min(old.attempts+1,rule.maximum+1);
      const windowStartedAt = expired ? now : old.windowStartedAt;
      if(old) await tx.identityRateLimit.update({where:{key:rule.key},data:{attempts,windowStartedAt}});
      else await tx.identityRateLimit.create({data:{key:rule.key,attempts,windowStartedAt}});
      if(attempts>rule.maximum) retryAfterSec=Math.max(retryAfterSec,Math.ceil((+windowStartedAt+rule.windowMs - +now)/1000));
    }
    return {ok:retryAfterSec===0,retryAfterSec};
  });
}
export async function requestLimits(kind:string,email:string,ip:string) {
  const ipBudget = await consumeIdentityLimits([{scope:`${kind}:ip`,value:ip,maximum:30,windowMs:3600000}]);
  if(!ipBudget.ok) return ipBudget;
  return consumeIdentityLimits([{scope:`${kind}:email`,value:email,maximum:5,windowMs:3600000},{scope:`${kind}:cooldown`,value:email,maximum:1,windowMs:60000}]);
}
export async function proofLimits(kind:string,id:string,ip:string) {
  const ipBudget = await consumeIdentityLimits([{scope:`${kind}:ip`,value:ip,maximum:30,windowMs:600000}]);
  if(!ipBudget.ok) throw new AppError("Too many attempts. Please wait before trying again.",429);
  const proofBudget = await consumeIdentityLimits([{scope:`${kind}:proof`,value:id,maximum:10,windowMs:600000}]);
  if(!proofBudget.ok) throw new AppError("Too many attempts. Please wait before trying again.",429);
}

// Equal minimum request latency obscures the account lookup/issuance difference; never delay inside a transaction.
export async function publicResponseDelay(startedAt:number) {
  const remaining = 500 - (performance.now()-startedAt);
  if(remaining>0) await new Promise(resolve=>setTimeout(resolve,remaining));
}
