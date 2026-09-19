import mysql from "mysql2/promise";
import { withTimeout } from "./rag/errors.js";
import { getRaw } from "./env.js";

/**
 * 数据库连接参数，业务池与探测池共用同一份。
 *
 * 从配置中心读取（src/.env，该文件不入库）：此前写死在源码里，
 * 一来把 root 口令提交进了版本库，二来换一套部署环境就得改源码重新发版，
 * 与 env.js 建立的「配置只有一个来源」约定相悖。
 * 默认值保持与迁移前完全一致，未配置的环境行为不变。
 */
function readDbPort() {
  const raw = getRaw("DB_PORT");
  if (raw === undefined) return 3306;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`配置项 DB_PORT 必须为 1~65535 的整数，当前值: ${raw}`);
  }
  return parsed;
}

const DB_CONFIG = {
  host: getRaw("DB_HOST", "localhost"),
  port: readDbPort(),
  user: getRaw("DB_USER", "root"),
  password: getRaw("DB_PASSWORD", "123456"),
  database: getRaw("DB_NAME", "manage_core"),
};

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,// 8个全部占满，新来请求：开启排队
  connectionLimit: 8,//最多同时跟8条信息通道打交道，一个前端请求就要占用一个通道
  queueLimit: 0,// 排队最多允许多少人？queueLimit:0 →不限制，随便排。
});

/**
 * 健康探测专用连接池。
 *
 * 与业务池隔离的理由：业务池只有 8 个连接，且队列不设上限。
 * 一旦 MySQL 处于「卡住但不断开」的状态，探测请求会一直占着连接不释放，
 * 反复探测最终能把 8 个连接全部吃光，把正常问答一起拖死 ——
 * 这正好是「健康检查把服务查挂」的经典事故。
 * 探测池单独限容，即使探测自己卡死，业务池也不受影响。
 */
const probePool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 2,
  // 探测请求不排队：拿不到连接就立刻失败。
  // 业务池的 queueLimit:0（无限排队）不适合探测场景，会让请求无限堆积
  queueLimit: 1,
});

export async function query(sql, values) {
  const [results] = await pool.execute(sql, values);
  return results;
}

/**
 * 数据库连通性探测（只读、可中断）。
 *
 * 走独立连接池，因此不会占用业务连接；
 * 超时后主动销毁该连接，而不是归还池中 ——
 * 卡住的连接已不可信，归还后下一个探测会拿到同一个坏连接，永远探测不出恢复。
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<void>} 探测失败（含超时）时抛出
 */
export async function probe({ timeoutMs = 3000 } = {}) {
  let connection = null;
  let timedOut = false;

  try {
    await withTimeout(
      (async () => {
        connection = await probePool.getConnection();
        // 超时可能发生在「等待取连接」期间：此时 onTimeout 看到的 connection 还是 null
        // （destroy 打空），而 finally 又因为 timedOut 跳过 release，
        // 这条连接一到手就既不会被归还也不会被销毁，永久占着探测池。
        // 探测池容量只有 2，两次这样的泄漏就会让健康检查永远报「数据库不可用」——
        // 正是引入独立探测池要避免的那个故障。
        if (timedOut) {
          connection.destroy();
          return;
        }
        await connection.query("SELECT 1 AS ok");
      })(),
      timeoutMs,
      "数据库",
      () => {
        timedOut = true;
        connection?.destroy();
      },
    );
  } finally {
    // 超时分支里连接已被 destroy，再 release 会报错
    if (connection && !timedOut) connection.release();
  }
}
// 创建数据库表
export async function initTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS chat_session (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        convert_id VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(100) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS chat_message (
        id INT AUTO_INCREMENT PRIMARY KEY,
        convert_id VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content LONGTEXT,
        tool_call_id VARCHAR(100) DEFAULT NULL,
        card_name VARCHAR(100) DEFAULT NULL,
        arguments LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_convert_id (convert_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await query(`
      ALTER TABLE chat_message MODIFY COLUMN content LONGTEXT;
    `).catch(() => { });
    await query(`
      ALTER TABLE chat_message MODIFY COLUMN arguments LONGTEXT;
    `).catch(() => { });
    console.log("数据库表初始化成功");
  } catch (error) {
    console.error("数据库表初始化失败:", error?.message || error);
    // 必须抛出：此前只打一行日志就返回，调用方无从得知建表失败，
    // 「表不存在」与「启动成功」在日志里长得一模一样 ——
    // 接下来每个接口都会以 "Table 'manage_core.chat_session' doesn't exist"
    // 这种看不出根因的报错失败。交由调用方决定是否终止启动。
    throw error;
  }
}