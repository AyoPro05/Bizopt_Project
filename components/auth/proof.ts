export type CapturedProof = {id:string;token:string;purpose:"verification"|"email-change"};
export function captureIdentityProof(location:{href:string},history:{replaceState:(data:unknown,title:string,url?:string|URL|null)=>void}):CapturedProof|null {
  const url=new URL(location.href);const fragment=new URLSearchParams(url.hash.slice(1));
  // Strip fragment and obsolete query secrets before rendering any user interaction.
  url.searchParams.delete("token");url.searchParams.delete("id");url.hash="";
  history.replaceState(null,"",`${url.pathname}${url.search}`);
  const id=fragment.get("id");const token=fragment.get("token");const purpose=fragment.get("purpose");
  if(fragment.getAll("id").length!==1 || fragment.getAll("token").length!==1 || !id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !token || !/^[a-f0-9]{64}$/.test(token) || (purpose && purpose!=="email-change")) return null;
  return {id,token,purpose:purpose === "email-change" ? "email-change" : "verification"};
}
