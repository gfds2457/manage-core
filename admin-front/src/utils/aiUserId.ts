import useUser from "@/store/modules/user";
import { AI_CHAT_USER_ID } from "@/API/ai-chat";

/**
 * 取当前登录用户在 AI 对话服务里的用户标识。
 *
 * 之前各处直接写死 "001"（后收敛为接口层的 AI_CHAT_USER_ID 常量），
 * 结果所有账号共用同一份会话历史：A 用户能在历史列表里看到 B 用户的对话。
 * 这里改成优先用登录态里的用户 id，取不到（如未登录调试）才退回演示常量。
 */
export const getAiChatUserId = (): string =>
{
  const id = useUser().id;
  if ( id === null || id === undefined )
  {
    return AI_CHAT_USER_ID;
  }
  return String( id );
};
