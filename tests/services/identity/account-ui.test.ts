import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountSecurityForm } from "@/components/auth/account-security-form";
describe("account security controls",()=>{
 it("shows current-password reauthentication and independent email/password actions",()=>{
  const html=renderToStaticMarkup(React.createElement(AccountSecurityForm,{emailVerified:true,email:"person@example.com"}));
  expect(html).toContain("Change password");expect(html).toContain("Change email");expect(html).toContain('autoComplete="current-password"');expect(html).toContain('autoComplete="new-password"');expect(html).toContain("All browser and mobile sessions");expect(html).toContain("current email stays active");
 });
 it("gates sensitive actions until existing email is verified",()=>{
  const html=renderToStaticMarkup(React.createElement(AccountSecurityForm,{emailVerified:false,email:"person@example.com"}));
  expect(html).toContain("Verify your email");expect(html).not.toContain('autoComplete="current-password"');expect(html).toContain("Resend verification email");
 });
});
