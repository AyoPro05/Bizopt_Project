import { beforeEach, describe, expect, it, vi } from "vitest";
const { db,emitEvent }=vi.hoisted(()=>({db:{socialAccount:{updateMany:vi.fn()},platformAccount:{updateMany:vi.fn()},orgMember:{findMany:vi.fn()},$transaction:vi.fn()},emitEvent:vi.fn()}));
vi.mock("@/lib/db",()=>({db}));vi.mock("@/services/automation/events",()=>({emitEvent}));
import { disconnectPlatform } from "@/lib/platform-accounts";
describe("connection notification intent",()=>{
 beforeEach(()=>{vi.resetAllMocks();db.$transaction.mockImplementation((fn:(tx:typeof db)=>unknown)=>fn(db));db.orgMember.findMany.mockResolvedValue([{userId:"owner"}]);});
 it("commits both account projections and a reconnect notice in the same transaction",async()=>{db.socialAccount.updateMany.mockResolvedValue({count:1});db.platformAccount.updateMany.mockResolvedValue({count:1});await disconnectPlatform("org","linkedin","external");expect(emitEvent).toHaveBeenCalledWith(db,expect.objectContaining({eventType:"connection.reconnect_required",userId:"owner",orgId:"org"}));});
 it("does not create a new notice when the connection was already disconnected",async()=>{db.socialAccount.updateMany.mockResolvedValue({count:0});db.platformAccount.updateMany.mockResolvedValue({count:0});await disconnectPlatform("org","linkedin","external");expect(emitEvent).not.toHaveBeenCalled();});
});
