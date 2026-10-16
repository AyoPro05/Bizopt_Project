import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureIdentityProof } from "@/components/auth/proof";
import { ProofConfirmation, ForgotPasswordForm, ResendVerificationForm } from "@/components/auth/flow-forms";
const roots:ReturnType<typeof createRoot>[]=[];
afterEach(()=>{for(const root of roots.splice(0))act(()=>root.unmount());vi.unstubAllGlobals();});
describe("accessible scanner-safe identity UI",()=>{
 it("captures a fragment proof into memory and removes it without putting it in a query or persistent storage",()=>{
  const token="a".repeat(64);const replaceState=vi.fn();
  const proof=captureIdentityProof({href:`https://app.example.com/verify-email?callbackUrl=%2Fbilling#id=proof&token=${token}`},{replaceState});
  expect(proof).toEqual({id:"proof",token,purpose:"verification"});
  expect(replaceState).toHaveBeenCalledWith(null,"","/verify-email?callbackUrl=%2Fbilling");
  expect(JSON.stringify(replaceState.mock.calls)).not.toContain(token);
 });
 it("discards raw legacy query proofs and rejects malformed fragments",()=>{
  const replaceState=vi.fn();
  expect(captureIdentityProof({href:"https://app.example.com/verify-email?token=legacy#id=proof&token=short"},{replaceState})).toBeNull();
  expect(replaceState).toHaveBeenCalledWith(null,"","/verify-email");
 });
 it("does not consume proofs when the confirmation page mounts",async()=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  window.history.replaceState(null,"","/verify-email#id=proof&token="+"a".repeat(64));
  const host=document.createElement("div");const root=createRoot(host);roots.push(root);
  await act(async()=>root.render(React.createElement(ProofConfirmation,{mode:"verification"})));
  expect(fetch).not.toHaveBeenCalled();expect(host.textContent).toContain("Confirm email");expect(window.location.hash).toBe("");
 });
 it("submits the in-memory proof only after an explicit confirmation and preserves a safe sign-in callback",async()=>{
  const token="b".repeat(64);const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,message:"Email verified. Sign in to continue."})});vi.stubGlobal("fetch",fetch);
  window.history.replaceState(null,"","/verify-email?callbackUrl=%2Fbilling%3Fplan%3Dteam#id=proof&token="+token);
  const host=document.createElement("div");const root=createRoot(host);roots.push(root);
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(ProofConfirmation,{mode:"verification"}))));
  expect(fetch).not.toHaveBeenCalled();expect(window.location.hash).toBe("");
  await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  expect(fetch).toHaveBeenCalledWith("/api/auth/verification/confirm",expect.objectContaining({method:"POST",referrerPolicy:"no-referrer",body:JSON.stringify({id:"proof",token})}));
  expect(host.textContent).toContain("Email verified");expect(host.querySelector("a")?.getAttribute("href")).toBe("/login?callbackUrl=%2Fbilling%3Fplan%3Dteam");
  expect(window.location.href).not.toContain(token);
 });
 it("renders named email inputs, cooldown status and explicit reset confirmation",()=>{
  for(const form of [React.createElement(ForgotPasswordForm,{key:"reset"}),React.createElement(ResendVerificationForm,{key:"verify"})]) {
   const html=renderToStaticMarkup(form);expect(html).toContain('type="email"');expect(html).toContain('autoComplete="email"');expect(html).toContain('role="status"');expect(html).toContain('<label');
  }
  const reset=renderToStaticMarkup(React.createElement(ProofConfirmation,{mode:"reset"}));expect(reset).not.toContain("automatically signed");
 });
});
