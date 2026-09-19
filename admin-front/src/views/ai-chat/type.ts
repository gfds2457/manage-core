export interface ItemChatInterface
{
  list: { role: string; content: string }[],
  title: string,
  /** 会话 ID：切换历史会话后继续提问必须落回该会话 */
  convertId?: string,
  id?: string
}

/**
 * 知识库检索来源。
 * 字段与后端 /chat 流中推送的 rag_sources 事件保持一致，
 * 行号与摘要为可选：后端未提供时界面只展示已有字段，不做占位造假数据。
 */
export interface RagSourceInterface
{
  /** 片段在向量库中的自增 ID */
  id?: number | string;
  /** 片段标题（通常为文件名） */
  title?: string;
  /** 来源类型，如 md / sql / csv */
  source?: string;
  /** 文档条目 ID */
  docId?: number | string;
  /** 文档类型 */
  docType?: string;
  /** 相似度得分，0~1 */
  score?: number;
  /** 片段正文摘要，用于在引用面板中预览 */
  preview?: string;
  /** 片段在原文中的起始行，后端提供时才展示「第 X-Y 行」 */
  startLine?: number;
  /** 片段在原文中的结束行 */
  endLine?: number;
}
