import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { ElMessage } from "element-plus";

// ------------------------------------------------------------------
// happy-dom 环境补齐：Element Plus 依赖这些浏览器 API
// ------------------------------------------------------------------
if ( typeof globalThis.ResizeObserver === "undefined" )
{
  globalThis.ResizeObserver = class
  {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if ( typeof globalThis.IntersectionObserver === "undefined" )
{
  globalThis.IntersectionObserver = class
  {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

if ( typeof window !== "undefined" && typeof window.matchMedia !== "function" )
{
  window.matchMedia = () => ( {
    matches: false,
    media: "",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  } );
}

// ------------------------------------------------------------------
// mock 请求层
// ------------------------------------------------------------------
vi.mock( "@/API/role", () => ( {
  getList: vi.fn(),
  search: vi.fn(),
  saveOrUpdate: vi.fn(),
  deleteRole: vi.fn(),
  getPermission: vi.fn(),
  getRolePermission: vi.fn(),
  updatePermission: vi.fn(),
} ) );

// ------------------------------------------------------------------
// mock 兜底文案工具
// 组件统一用 getMessage(res, 兜底文案) 生成提示，
// 这里按约定语义实现：响应里有 message 用 message，否则回退到兜底文案。
// ------------------------------------------------------------------
vi.mock( "@/composables/useRecycleBin", () => ( {
  getMessage: ( res, fallback ) => ( res && res.message ) || fallback,
} ) );

// ------------------------------------------------------------------
// mock 消息提示（保留其余 Element Plus 导出，组件仍能正常渲染）
// ------------------------------------------------------------------
vi.mock( "element-plus", async ( importOriginal ) =>
{
  const actual = await importOriginal();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
} );

import RoleList from "@/views/permission/role/index.vue";
import {
  getList,
  search,
  saveOrUpdate,
  deleteRole,
  getPermission,
  getRolePermission,
  updatePermission,
} from "@/API/role";

// 列表演示数据
const records = [
  { id: 1, roleName: "超级管理员", createTime: "2024-01-01 10:00:00", updateTime: "2024-01-02 10:00:00" },
  { id: 2, roleName: "运营专员", createTime: "2024-02-01 10:00:00", updateTime: "2024-02-02 10:00:00" },
];

const mountRole = () =>
  mount( RoleList, {
    global: {
      plugins: [ ElementPlus ],
      // v-hasBtn 是项目全局注册的按钮权限指令，测试里用空指令桩代替
      directives: {
        hasBtn: { mounted() {}, updated() {} },
      },
      // el-tree-v2 依赖虚拟列表，测试里不需要，直接打桩
      stubs: { ElTreeV2: true },
    },
  } );

const findButton = ( wrapper, text ) =>
{
  const button = wrapper.findAll( "button" ).find( ( btn ) => btn.text().includes( text ) );
  if ( !button ) throw new Error( `未找到按钮：${ text }` );
  return button;
};

describe( "角色权限页 (views/permission/role/index.vue)", () =>
{
  beforeEach( () =>
  {
    vi.clearAllMocks();

    getList.mockResolvedValue( { code: 200, data: { total: 2, records } } );
    search.mockResolvedValue( { code: 200, data: { total: 1, records: [ records[ 0 ] ] } } );
    saveOrUpdate.mockResolvedValue( { code: 200 } );
    deleteRole.mockResolvedValue( { code: 200 } );
    getPermission.mockResolvedValue( { code: 200, data: [] } );
    // 注意：data[0] 必须是对象，否则组件的递归函数会读 undefined.children 报错
    getRolePermission.mockResolvedValue( { code: 200, data: [ {} ] } );
    updatePermission.mockResolvedValue( { code: 200 } );
  } );

  // ----------------------------------------------------------------
  // 列表渲染（正常场景）
  // ----------------------------------------------------------------
  it( "挂载后按默认分页请求列表并渲染", async () =>
  {
    const wrapper = mountRole();
    await flushPromises();

    expect( getList ).toHaveBeenCalledTimes( 1 );
    expect( getList ).toHaveBeenCalledWith( { current: 1, size: 6 } );

    // 组件内部状态
    expect( wrapper.vm.roleList ).toHaveLength( 2 );
    expect( wrapper.vm.roleList ).toEqual( records );
    expect( wrapper.vm.total4 ).toBe( 2 );

    // 表格数据绑定正确
    const table = wrapper.findComponent( { name: "ElTable" } );
    expect( table.exists() ).toBe( true );
    expect( table.props( "data" ) ).toEqual( records );

    // 表格行渲染
    expect( wrapper.findAll( ".el-table__row" ).length ).toBe( 2 );
  } );

  it( "模板按钮正常渲染（v-hasBtn 指令桩不阻塞渲染）", async () =>
  {
    const wrapper = mountRole();
    await flushPromises();

    expect( findButton( wrapper, "添加职位" ).exists() ).toBe( true );
    expect( findButton( wrapper, "分配权限" ).exists() ).toBe( true );
    expect( findButton( wrapper, "添加编辑" ).exists() ).toBe( true );
    expect( findButton( wrapper, "删除" ).exists() ).toBe( true );
  } );

  // ----------------------------------------------------------------
  // 关键字搜索 / 重置
  // ----------------------------------------------------------------
  it( "输入关键字并点击搜索：调用 search 并更新列表", async () =>
  {
    const wrapper = mountRole();
    await flushPromises();
    getList.mockClear();

    await wrapper.find( "input" ).setValue( "运营" );
    await findButton( wrapper, "搜索" ).trigger( "click" );
    await flushPromises();

    expect( search ).toHaveBeenCalledTimes( 1 );
    expect( search ).toHaveBeenCalledWith( { keyword: "运营" } );

    expect( wrapper.vm.roleList ).toHaveLength( 1 );
    expect( wrapper.vm.roleList ).toEqual( [ records[ 0 ] ] );
    expect( wrapper.vm.total4 ).toBe( 1 );
    // 搜索后清空关键字并回到第一页
    expect( wrapper.vm.keyword ).toBe( "" );
    expect( wrapper.vm.currentPage4 ).toBe( 1 );
  } );

  it( "重置按钮：清空关键字、回到第一页并重新拉取列表", async () =>
  {
    getList.mockResolvedValue( { code: 200, data: { total: 20, records } } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.keyword = "临时关键字";
    wrapper.vm.currentPage4 = 2;
    await flushPromises();

    getList.mockClear();

    await findButton( wrapper, "重置" ).trigger( "click" );
    await flushPromises();

    expect( wrapper.vm.keyword ).toBe( "" );
    expect( wrapper.vm.currentPage4 ).toBe( 1 );
    expect( getList ).toHaveBeenCalledWith( { current: 1, size: 6 } );
  } );

  // ----------------------------------------------------------------
  // 分页切换
  // ----------------------------------------------------------------
  it( "分页切换：点击下一页按新页码重新请求", async () =>
  {
    getList.mockResolvedValue( { code: 200, data: { total: 20, records } } );

    const wrapper = mountRole();
    await flushPromises();
    expect( wrapper.vm.total4 ).toBe( 20 );

    getList.mockClear();

    const nextButton = wrapper.find( ".btn-next" );
    expect( nextButton.exists() ).toBe( true );

    await nextButton.trigger( "click" );
    await flushPromises();

    expect( wrapper.vm.currentPage4 ).toBe( 2 );
    expect( getList ).toHaveBeenCalledWith( { current: 2, size: 6 } );
  } );

  // ----------------------------------------------------------------
  // 删除
  // ----------------------------------------------------------------
  it( "删除角色成功：提示成功并刷新列表", async () =>
  {
    const wrapper = mountRole();
    await flushPromises();
    getList.mockClear();

    await wrapper.vm.roleDelete( 1 );

    expect( deleteRole ).toHaveBeenCalledWith( 1 );
    expect( ElMessage.success ).toHaveBeenCalledWith( "删除成功" );
    expect( getList ).toHaveBeenCalledTimes( 1 );
  } );

  it( "删除角色失败：提示服务端错误信息", async () =>
  {
    deleteRole.mockResolvedValue( { code: 500, message: "删除失败" } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.vm.roleDelete( 1 );

    expect( ElMessage.error ).toHaveBeenCalledWith( "删除失败" );
    expect( ElMessage.success ).not.toHaveBeenCalled();
  } );

  it( "删除角色失败且响应无 message：回退到「删除失败」兜底文案", async () =>
  {
    deleteRole.mockResolvedValue( { code: 500 } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.vm.roleDelete( 1 );

    expect( ElMessage.error ).toHaveBeenCalledWith( "删除失败" );
  } );

  // ----------------------------------------------------------------
  // 新增 / 编辑
  // ----------------------------------------------------------------
  it( "新增角色（id 不存在）成功：提示「新增成功」并关闭弹窗", async () =>
  {
    saveOrUpdate.mockResolvedValue( { code: 200 } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { roleName: "访客" };
    await wrapper.vm.saveOrUpdateRole();

    expect( saveOrUpdate ).toHaveBeenCalledTimes( 1 );
    expect( ElMessage.success ).toHaveBeenCalledWith( "新增成功" );
    expect( wrapper.vm.dialogVisible ).toBe( false );
  } );

  it( "编辑角色（存在 id）成功：提示「更新成功」", async () =>
  {
    saveOrUpdate.mockResolvedValue( { code: 200 } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { id: 7, roleName: "访客" };
    await wrapper.vm.saveOrUpdateRole();

    expect( ElMessage.success ).toHaveBeenCalledWith( "更新成功" );
  } );

  it( "保存角色失败：提示服务端错误信息", async () =>
  {
    saveOrUpdate.mockResolvedValue( { code: 500, message: "保存失败" } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { roleName: "访客" };
    await wrapper.vm.saveOrUpdateRole();

    expect( ElMessage.error ).toHaveBeenCalledWith( "保存失败" );
  } );

  it( "新增角色失败且响应无 message：回退到「新增失败」兜底文案", async () =>
  {
    saveOrUpdate.mockResolvedValue( { code: 500 } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { roleName: "访客" };
    await wrapper.vm.saveOrUpdateRole();

    expect( ElMessage.error ).toHaveBeenCalledWith( "新增失败" );
  } );

  it( "编辑角色失败且响应无 message：回退到「更新失败」兜底文案", async () =>
  {
    saveOrUpdate.mockResolvedValue( { code: 500 } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { id: 7, roleName: "访客" };
    await wrapper.vm.saveOrUpdateRole();

    expect( ElMessage.error ).toHaveBeenCalledWith( "更新失败" );
  } );

  it( "表单校验失败：不发送保存请求，也不抛出未捕获异常", async () =>
  {
    const validateError = new Error( "表单校验失败" );

    const wrapper = mountRole();
    await flushPromises();

    // 让 validate() 直接 reject，模拟校验不通过
    wrapper.vm.roleFormRef = {
      validate: () => Promise.reject( validateError ),
      clearValidate: () => {},
    };
    wrapper.vm.roleForm = { roleName: "" };

    // 内部 try/catch 后应正常结束，不向外抛出异常
    await expect( wrapper.vm.saveOrUpdateRole() ).resolves.not.toThrow();

    expect( saveOrUpdate ).not.toHaveBeenCalled();
    expect( ElMessage.success ).not.toHaveBeenCalled();
    expect( ElMessage.error ).not.toHaveBeenCalled();
  } );

  it( "addRole：打开弹窗并重置表单", async () =>
  {
    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.addRole();
    await flushPromises();

    expect( wrapper.vm.dialogVisible ).toBe( true );
    expect( wrapper.vm.roleForm ).toEqual( {} );
  } );

  it( "editRole：打开弹窗并回填当前行数据", async () =>
  {
    const wrapper = mountRole();
    await flushPromises();

    const row = { id: 3, roleName: "待编辑角色" };
    wrapper.vm.editRole( row );
    await flushPromises();

    expect( wrapper.vm.dialogVisible ).toBe( true );
    expect( wrapper.vm.roleForm ).toStrictEqual( row );
  } );

  // ----------------------------------------------------------------
  // 分配权限
  // ----------------------------------------------------------------
  it( "assignPermission：拉取全部权限与角色已有权限后打开抽屉", async () =>
  {
    const permissionTree = [
      {
        id: 1,
        name: "系统管理",
        children: [
          { id: 11, name: "用户管理" },
          { id: 12, name: "角色管理" },
        ],
      },
    ];
    getPermission.mockResolvedValue( { code: 200, data: permissionTree } );
    getRolePermission.mockResolvedValue( {
      code: 200,
      data: [
        {
          id: 1,
          name: "系统管理",
          children: [
            { id: 11, name: "用户管理", select: true },
            { id: 12, name: "角色管理", select: false },
          ],
        },
      ],
    } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.vm.assignPermission( { id: 9, roleName: "角色" } );
    await flushPromises();

    expect( getPermission ).toHaveBeenCalledTimes( 1 );
    expect( getRolePermission ).toHaveBeenCalledWith( { roleId: 9 } );
    expect( wrapper.vm.permissionData ).toEqual( permissionTree );
    // 只勾选叶子节点中 select 为 true 的项
    expect( wrapper.vm.checkedKeys ).toEqual( [ 11 ] );
    expect( wrapper.vm.drawerVisible ).toBe( true );
  } );

  it( "assignPermission 权限接口异常：提示错误信息", async () =>
  {
    getPermission.mockResolvedValue( { code: 500, message: "权限加载失败" } );
    getRolePermission.mockResolvedValue( { code: 200, data: [ {} ] } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.vm.assignPermission( { id: 9 } );
    await flushPromises();

    expect( ElMessage.error ).toHaveBeenCalledWith( "权限加载失败" );
  } );

  it( "assignPermission 权限接口异常且响应无 message：回退到「获取权限列表失败」兜底文案", async () =>
  {
    getPermission.mockResolvedValue( { code: 500 } );
    getRolePermission.mockResolvedValue( { code: 200, data: [ {} ] } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.vm.assignPermission( { id: 9 } );
    await flushPromises();

    expect( ElMessage.error ).toHaveBeenCalledWith( "获取权限列表失败" );
  } );

  it( "assignPermission 拉取已分配权限失败：只清空勾选、不弹错误提示，仍打开抽屉", async () =>
  {
    const permissionTree = [
      { id: 1, name: "系统管理", children: [ { id: 11, name: "用户管理" } ] },
    ];
    getPermission.mockResolvedValue( { code: 200, data: permissionTree } );
    getRolePermission.mockResolvedValue( { code: 500 } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.vm.assignPermission( { id: 9 } );
    await flushPromises();

    expect( wrapper.vm.checkedKeys ).toEqual( [] );
    expect( wrapper.vm.drawerVisible ).toBe( true );
    expect( ElMessage.error ).not.toHaveBeenCalled();
  } );

  it( "saveEditPermission 成功：提交勾选权限并提示「分配成功」", async () =>
  {
    updatePermission.mockResolvedValue( { code: 200 } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { id: 5, roleName: "角色" };
    wrapper.vm.treeRef = { getCheckedKeys: () => [ 1, 2, 3 ] };

    await wrapper.vm.saveEditPermission();

    expect( updatePermission ).toHaveBeenCalledWith( { roleId: 5, permissionIds: [ 1, 2, 3 ] } );
    expect( ElMessage.success ).toHaveBeenCalledWith( "分配成功" );
    expect( wrapper.vm.drawerVisible ).toBe( false );
  } );

  it( "saveEditPermission 失败：提示服务端错误信息", async () =>
  {
    updatePermission.mockResolvedValue( { code: 500, message: "分配失败" } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { id: 5, roleName: "角色" };
    wrapper.vm.treeRef = { getCheckedKeys: () => [] };

    await wrapper.vm.saveEditPermission();

    expect( ElMessage.error ).toHaveBeenCalledWith( "分配失败" );
  } );

  it( "saveEditPermission 失败且响应无 message：回退到「分配失败」兜底文案", async () =>
  {
    updatePermission.mockResolvedValue( { code: 500 } );

    const wrapper = mountRole();
    await flushPromises();

    wrapper.vm.roleForm = { id: 5, roleName: "角色" };
    wrapper.vm.treeRef = { getCheckedKeys: () => [] };

    await wrapper.vm.saveEditPermission();

    expect( ElMessage.error ).toHaveBeenCalledWith( "分配失败" );
    expect( ElMessage.success ).not.toHaveBeenCalled();
  } );

  // ----------------------------------------------------------------
  // 异常分支：列表接口返回非 200
  // ----------------------------------------------------------------
  it( "列表接口失败：总数归零", async () =>
  {
    getList.mockResolvedValue( { code: 500, message: "加载失败" } );

    const wrapper = mountRole();
    await flushPromises();

    expect( wrapper.vm.total4 ).toBe( 0 );
  } );

  it( "搜索接口失败：总数归零且不抛异常", async () =>
  {
    search.mockResolvedValue( { code: 500, message: "搜索失败" } );

    const wrapper = mountRole();
    await flushPromises();

    await wrapper.find( "input" ).setValue( "x" );
    await findButton( wrapper, "搜索" ).trigger( "click" );
    await flushPromises();

    expect( wrapper.vm.total4 ).toBe( 0 );
    expect( ElMessage.error ).not.toHaveBeenCalled();
  } );
} );
