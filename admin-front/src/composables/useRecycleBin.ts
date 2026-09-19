import { ref, type Ref } from "vue";
import { ElMessage } from "element-plus";

/** 软删除保留期限（天），超过该期限后端将真正销毁数据 */
export const SOFT_DELETE_RETAIN_DAYS = 30;

/** 回收站中的数据结构：至少携带软删除时间 */
export interface DeletedItemInterface {
  deleteTime: string;
}

/** 后端统一响应结构，字段做兼容处理 */
export interface RecycleResInterface {
  code?: number;
  ok?: boolean;
  message?: string;
  msg?: string;
  data?: unknown;
}

// 兼容 ok:true 与 code:200 两种成功标识。
// 提升为模块级导出，给没有回收站、但同样要判断后端响应的页面复用（如商品审核页）
export const isSuccess = (res?: RecycleResInterface) =>
  res?.ok === true || res?.code === 200;

// 取响应里的提示文案，兼容 message / msg 两种字段
export const getMessage = (
  res: RecycleResInterface | undefined,
  fallback: string,
) => res?.message ?? res?.msg ?? fallback;

export interface UseRecycleBinOptions<T extends DeletedItemInterface> {
  /** 拉取回收站列表的请求 */
  fetchList: () => Promise<RecycleResInterface>;
  /** 恢复单条数据的请求 */
  restore: (row: T) => Promise<RecycleResInterface>;
  /** 取每条数据的唯一标识，默认取 row.id；如属性表用 attrId 可自行传入 */
  rowKey?: (row: T) => number | string;
  /** 恢复成功后刷新原列表 */
  onRestored?: () => void;
  /** 恢复成功的提示文案 */
  restoreSuccessTip?: string;
  /** 软删除保留天数，默认 30 天 */
  retainDays?: number;
}

/**
 * 回收站通用逻辑：列表拉取、恢复、剩余保留天数计算等
 * 各页面只需传入自己的「拉取列表 / 恢复」请求函数即可接入
 */
export const useRecycleBin = <T extends DeletedItemInterface>(
  options: UseRecycleBinOptions<T>,
) => {
  const retainDays = options.retainDays ?? SOFT_DELETE_RETAIN_DAYS;
  // 控制回收站对话框的开关
  const recycleBinVisible = ref(false);
  // 回收站中的已软删除数据
  const deletedList = ref([]) as Ref<T[]>;
  // 回收站列表加载中
  const recycleLoading = ref(false);
  // 正在恢复中的数据标识，用于按钮 loading
  const restoringId = ref<number | string | null>(null);

  const getKey = (row: T): number | string =>
    options.rowKey
      ? options.rowKey(row)
      : (row as unknown as { id: number }).id;

  // 拉取回收站数据
  // 兼容 data 为数组、data.records 为数组两种返回结构
  const fetchDeletedList = async () => {
    recycleLoading.value = true;
    try {
      const res = await options.fetchList();
      const payload = res?.data;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { records?: T[] })?.records)
          ? (payload as { records: T[] }).records
          : [];
      deletedList.value = list as T[];
      if (!list.length) {
        ElMessage.warning(
          "回收站为空（如删除后仍为空，请检查后端是否为软删除）",
        );
      }
    } catch (err) {
      console.error("[useRecycleBin] 回收站数据加载失败:", err);
      ElMessage.error("回收站数据加载失败");
    } finally {
      recycleLoading.value = false;
    }
  };

  // 打开回收站并加载已软删除的数据
  const openRecycleBin = async () => {
    recycleBinVisible.value = true;
    await fetchDeletedList();
  };

  // 恢复误删数据：清除软删除标记，使其重新出现在原列表
  const restoreItem = async (row: T) => {
    if (restoringId.value !== null) return;
    const key = getKey(row);
    restoringId.value = key;
    try {
      const res = await options.restore(row);
      if (isSuccess(res)) {
        ElMessage.success(options.restoreSuccessTip ?? "恢复成功");
        // 先从回收站移除，再刷新原列表，保证 UI 立即响应
        deletedList.value = deletedList.value.filter(
          (item) => getKey(item) !== key,
        );
        options.onRestored?.();
      } else {
        ElMessage.error(getMessage(res, "恢复失败"));
      }
    } catch (err) {
      console.error("[useRecycleBin] 恢复失败:", err);
      ElMessage.error("恢复失败");
    } finally {
      restoringId.value = null;
    }
  };

  // 删除成功后调用：若回收站弹窗已打开则同步刷新，避免数据不一致
  const syncIfOpen = () => {
    if (recycleBinVisible.value) fetchDeletedList();
  };

  // 将 ISO 时间字符串格式化为 YYYY-MM-DD HH:mm:ss
  const formatTime = (time: string) => {
    if (!time) return "";
    const date = new Date(time);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  // 计算距离永久销毁还剩余的天数
  const remainDays = (deleteTime: string) => {
    if (!deleteTime) return 0;
    const deletedAt = new Date(deleteTime).getTime();
    const expireAt = deletedAt + retainDays * 24 * 60 * 60 * 1000;
    const diff = expireAt - Date.now();
    return diff <= 0 ? 0 : Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  return {
    recycleBinVisible,
    deletedList,
    recycleLoading,
    restoringId,
    isSuccess,
    getMessage,
    fetchDeletedList,
    openRecycleBin,
    restoreItem,
    syncIfOpen,
    formatTime,
    remainDays,
  };
};
