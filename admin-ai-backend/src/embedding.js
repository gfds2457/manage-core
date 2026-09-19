/**
 * 知识库入库脚本（手动执行）
 *
 * 用法：
 *   node src/embedding.js            # 增量同步（首次运行自动全量）
 *   node src/embedding.js --full     # 强制全量重建
 *   node src/embedding.js --stats    # 仅查看知识库统计
 *
 * 说明：服务启动时（src/index.js）已会自动执行一次增量同步，
 * 本脚本用于在不重启服务的情况下手动触发或强制重建。
 */
import { validateConfig } from "./env.js";
import { syncKnowledgeBase, getKnowledgeStats } from "./rag/index.js";
import { countRows } from "./rag/vectorStore.js";

const args = process.argv.slice(2);
const isFull = args.includes("--full");
const isStats = args.includes("--stats");

async function main() {
  try {
    validateConfig();
  } catch (err) {
    console.error(`\n❌ ${err.message}\n`);
    process.exit(1);
  }

  if (isStats) {
    const stats = await getKnowledgeStats();
    const rows = await countRows().catch(() => -1);
    console.log("知识库统计:", JSON.stringify({ ...stats, vectorChunks: rows }, null, 2));
    return;
  }

  console.log(isFull ? "开始全量重建知识库..." : "开始增量同步知识库...");
  const result = await syncKnowledgeBase({ force: isFull });

  console.log("\n===== 同步结果 =====");
  console.log(`模式        : ${result.mode === "full" ? "全量" : "增量"}`);
  console.log(`知识条目    : ${result.total}`);
  console.log(`本次写入    : ${result.upserted}`);
  console.log(`本次删除    : ${result.deleted}`);
  console.log(`未变化跳过  : ${result.unchanged}`);
  console.log(`写入片段数  : ${result.chunkCount}`);
  console.log(`失败条目    : ${result.failed.length}`);
  console.log(`耗时        : ${result.durationMs}ms`);

  if (result.failed.length > 0) {
    console.log("\n失败明细:");
    for (const item of result.failed) {
      console.log(`  - docId=${item.docId} ${item.code || ""} ${item.message}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ 知识库同步异常: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
