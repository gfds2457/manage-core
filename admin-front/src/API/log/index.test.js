import { describe, it, expect, vi, beforeEach } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/utils/request", () => ({
  default: {
    get: getMock,
  },
}));

import { getOperationLogs } from "./index";

describe("getOperationLogs", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("不传 limit 时，按默认 limit=8 请求 /admin/operation/logs", () => {
    getMock.mockResolvedValue({ data: [] });

    getOperationLogs();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/admin/operation/logs", {
      params: { limit: 8 },
    });
  });

  it("显式传入 limit 时，按传入值透传", () => {
    getMock.mockResolvedValue({ data: [] });

    getOperationLogs(20);

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/admin/operation/logs", {
      params: { limit: 20 },
    });
  });

  it("返回 request.get 的返回值本身，不做解包", () => {
    const response = { code: 200, data: { records: [] } };
    getMock.mockReturnValue(response);

    const result = getOperationLogs(8);

    expect(getMock).toHaveBeenCalledWith("/admin/operation/logs", {
      params: { limit: 8 },
    });
    // 引用相等：证明返回的就是原对象，而非 response.data 之类的解包结果
    expect(result).toBe(response);
  });
});
