import { describe, it, expect, vi, beforeEach } from "vitest";

// mock 用户 store：默认导出是一个可被断言的工厂函数
vi.mock("@/store/modules/user", () => ({
  default: vi.fn(),
}));

// mock 兜底常量，保证测试与真实后端解耦
vi.mock("@/API/ai-chat", () => ({
  AI_CHAT_USER_ID: "001",
}));

import useUser from "@/store/modules/user";
import { AI_CHAT_USER_ID } from "@/API/ai-chat";
import { getAiChatUserId } from "@/utils/aiUserId";

describe("getAiChatUserId", () =>
{
  beforeEach(() =>
  {
    useUser.mockReset();
  } );

  it("兜底常量本身是一个字符串", () =>
  {
    expect( typeof AI_CHAT_USER_ID ).toBe( "string" );
  } );

  it("id 为 null 时返回兜底常量 AI_CHAT_USER_ID", () =>
  {
    useUser.mockReturnValue( { id: null } );
    const result = getAiChatUserId();
    expect( useUser ).toHaveBeenCalledTimes( 1 );
    expect( result ).toBe( AI_CHAT_USER_ID );
  } );

  it("id 为 undefined 时返回兜底常量 AI_CHAT_USER_ID", () =>
  {
    useUser.mockReturnValue( { id: undefined } );
    expect( getAiChatUserId() ).toBe( AI_CHAT_USER_ID );
  } );

  it("store 里压根没有 id 字段时同样返回兜底常量", () =>
  {
    useUser.mockReturnValue( {} );
    expect( getAiChatUserId() ).toBe( AI_CHAT_USER_ID );
  } );

  it("id 为 0 时是合法值，返回字符串 '0' 而不是兜底常量", () =>
  {
    useUser.mockReturnValue( { id: 0 } );
    const result = getAiChatUserId();
    expect( result ).toBe( "0" );
    expect( result ).not.toBe( AI_CHAT_USER_ID );
  } );

  it("id 为负数时返回其字符串形式", () =>
  {
    useUser.mockReturnValue( { id: -1 } );
    expect( getAiChatUserId() ).toBe( "-1" );

    useUser.mockReturnValue( { id: -999 } );
    expect( getAiChatUserId() ).toBe( "-999" );
  } );

  it("id 为普通数字时返回 String(id)", () =>
  {
    useUser.mockReturnValue( { id: 42 } );
    expect( getAiChatUserId() ).toBe( "42" );
  } );

  it("返回值恒为字符串类型", () =>
  {
    useUser.mockReturnValue( { id: 123 } );
    expect( typeof getAiChatUserId() ).toBe( "string" );

    useUser.mockReturnValue( { id: null } );
    expect( typeof getAiChatUserId() ).toBe( "string" );
  } );

  it("id 为字符串时原样返回（不会二次转换出错）", () =>
  {
    useUser.mockReturnValue( { id: "abc" } );
    expect( getAiChatUserId() ).toBe( "abc" );
  } );

  it("id 为空字符串（边界）时返回空字符串而非兜底常量", () =>
  {
    useUser.mockReturnValue( { id: "" } );
    expect( getAiChatUserId() ).toBe( "" );
  } );
} );
