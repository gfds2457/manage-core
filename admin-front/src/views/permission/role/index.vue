<template>
  <div>
    <!-- 搜索角色卡片 -->
    <el-card style="margin-bottom: 5px">
      <el-form :inline=" true " class="search-form" @submit.native.prevent>
        <el-form-item label="职位搜索" v-model=" keyword ">
          <el-input placeholder="请输入搜索职位关键字" @keyup.enter=" searchRoleList " v-model=" keyword " />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="margin-left: -5px" @click=" searchRoleList ">搜索</el-button>
          <el-button @click=" resetRoleList ">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <!-- 角色列表卡片 -->
    <el-card>
      <div style=" margin-bottom: 10px">
            <el-button type="primary" icon="Plus" v-hasBtn="PERM.PERMISSION_ROLE_WRITE" @click=" addRole ">添加职位</el-button>
  </div>
  <el-table style="width: 100%" border :data=" roleList ">
    <el-table-column label="#" width="60" type="index" />
    <el-table-column label="ID" prop="id" width="80" />
    <el-table-column label="职位名称" prop="roleName" />
    <el-table-column label="创建时间" prop="createTime" />
    <el-table-column label="更新时间" prop="updateTime" />
    <el-table-column label="操作" fixed="right" width="300">
      <template #default=" { row } ">
        <el-button type="primary" size="small" style="margin-right: 5px" v-hasBtn="PERM.PERMISSION_ROLE_WRITE"
          @click="assignPermission( row )">分配权限</el-button>
        <el-button type="warning" size="small" style="margin-right: 5px" v-hasBtn="PERM.PERMISSION_ROLE_WRITE"
          @click=" editRole( row )">添加编辑</el-button>
        <el-button type="danger" size="small" v-hasBtn="PERM.PERMISSION_ROLE_WRITE"
          @click=" roleDelete( row.id )">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
  <div style="margin-top: 20px; text-align: center">
    <el-pagination v-model:current-page=" currentPage4 " v-model:page-size=" pageSize4 " background
      layout="prev, pager, next, jumper, ->, sizes, total" :total=" total4 " :page-sizes=" [ 3, 6, 9, 12, 18 ] "
      @current-change=" getRoleList "
      @size-change=" getRoleList "
      style="margin-top: 15px" />
  </div>
  </el-card>
  <!-- 添加编辑角色抽屉卡片 -->
  <el-dialog title="添加职位" v-model=" dialogVisible " style="height: 200px">
    <el-form label-width="80px" style="margin-top: 20px" :model=" roleForm " :rules=" rules " ref="roleFormRef">
      <el-form-item label=" 职位名称" prop="roleName">
        <el-input placeholder="请输入职位名称" v-model=" roleForm.roleName " required />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" @click=" saveOrUpdateRole ">确定</el-button>
      <el-button @click=" dialogVisible = false">取消</el-button>
    </template>
  </el-dialog>
  <!-- 分配权限抽屉卡片 -->
  <el-drawer v-model=" drawerVisible " title="分配权限" :with-header=" false ">
    <el-tree-v2 v-if=" drawerVisible " style="max-width: 600px;" :data=" permissionData " :props=" props " show-checkbox
      :height=" 500 " :default-expanded-keys=" defaultExpandedKeys " :default-checked-keys=" checkedKeys "
      ref="treeRef" />
    <template #footer>
      <el-button type="primary" @click=" saveEditPermission ">确定</el-button>
      <el-button @click=" drawerVisible = false">取消</el-button>
    </template>
  </el-drawer>
  </div>
</template>

<script setup lang="ts">
defineOptions( {
  name: "RoleList",
} );
import type { FormInstance } from "element-plus";
import { ElMessage } from "element-plus";
import { onMounted, nextTick } from "vue";
import { getList, search, saveOrUpdate, deleteRole, getPermission, getRolePermission, updatePermission } from "@/API/role";
import type { RoleSaveOrUpdateBody } from "@/API/role/type";
import { getMessage } from "@/composables/useRecycleBin";
import { PERM } from "@/utils/permission";
import { ref } from "vue";
// 数据
// 当前页码
const currentPage4 = ref( 1 );
// 每页条数
const pageSize4 = ref( 6 );
// 总条数
const total4 = ref( 10 );
// 角色列表
const roleList = ref( [] );
// 搜索职位名称
const keyword = ref( "" );
// 添加职位弹窗是否显示
const dialogVisible = ref( false );
// 分配权限抽屉是否显示
const drawerVisible = ref( false );
// 角色表单数据
const roleForm = ref( {} as RoleSaveOrUpdateBody );
// 角色表单实例
const roleFormRef = ref<FormInstance>();
// 分配权限树数据
const permissionData = ref( [] );
// 分配权限树选中节点
const checkedKeys = ref<number[]>( [] );
// 分配权限树属性
const props = {
  // 子节点数组名
  children: "children",
  // 节点名称
  label: "name",
  // 节点唯一标识
  value: "id",
};
// 分配权限树默认展开节点
const defaultExpandedKeys = ref<number[]>( [] );
// 分配权限树实例
const treeRef = ref<any>();
// 角色表单验证规则
const rules = {
  roleName: [ {
    required: true, trigger: "blur", validator: ( _rule: any, value: any, callback: any ) =>
    {
      if ( !value || value.trim() === "" )
      {
        callback( new Error( "请输入职位名称" ) );
      }
      else
      {
        callback();
      }
    }
  } ],
};
// 方法 
// 分页查询角色列表
const getRoleList = async () =>
{
  const res: any = await getList( { current: currentPage4.value, size: pageSize4.value } );
  if ( res.code === 200 )
  {
    total4.value = res.data.total;
    roleList.value = res.data.records;
  }
  else
  {
    total4.value = 0;
  }
};
// 搜索角色
const searchRoleList = async () =>
{
  const res: any = await search( { keyword: keyword.value } );

  if ( res.code === 200 )
  {
    total4.value = res.data.total;
    roleList.value = res.data.records;
    currentPage4.value = 1;
    // 清空搜索框
    keyword.value = "";
  }
  else
  {
    total4.value = 0;
  }
};
// 重置搜索条件：清空关键字、回到第一页并重新拉取列表
const resetRoleList = async () =>
{
  keyword.value = "";
  currentPage4.value = 1;
  await getRoleList();
};
// 页面加载时获取角色列表
onMounted( () =>
{
  getRoleList();
} );
// 新增或更新角色
const saveOrUpdateRole = async () =>
{
  // 提交前进行全表单验证。校验不通过时 validate() 会 reject，
  // 之前没接住，这里是未捕获的 promise 异常，表单红字以外没有任何反应
  try
  {
    await roleFormRef.value?.validate();
  }
  catch ( err )
  {
    return;
  }
  const res: any = await saveOrUpdate( roleForm.value );
  if ( res.code === 200 )
  {
    dialogVisible.value = false;
    getRoleList();
    ElMessage.success( roleForm.value.id ? "更新成功" : "新增成功" );
  }
  else
  {
    ElMessage.error( getMessage( res, roleForm.value.id ? "更新失败" : "新增失败" ) );
  }
};
// 新增角色
const addRole = async () =>
{
  dialogVisible.value = true;
  roleForm.value = {} as RoleSaveOrUpdateBody;
  nextTick( () =>
  {
    roleFormRef.value?.clearValidate();
  } );
};
// 编辑角色
const editRole = async ( row: RoleSaveOrUpdateBody ) =>
{
  dialogVisible.value = true;
  roleForm.value = row;
  nextTick( () =>
  {
    roleFormRef.value?.clearValidate();
  } );
};
// 删除角色
const roleDelete = async ( id: number ) =>
{
  const res: any = await deleteRole( id );
  if ( res.code === 200 )
  {
    getRoleList();
    ElMessage.success( "删除成功" );
  }
  else
  {
    ElMessage.error( getMessage( res, "删除失败" ) );
  }
};
// 分配权限
const assignPermission = async ( row: RoleSaveOrUpdateBody ) =>
{
  // 清空选中节点
  permissionData.value = [];
  checkedKeys.value = [];
  defaultExpandedKeys.value = [];
  roleForm.value = row;
  // 获取所有权限
  const res: any = await getPermission();
  if ( res.code === 200 )
  {
    permissionData.value = res.data;
    defaultExpandedKeys.value = permissionData.value.map( ( item: any ) => item.id );
  }
  else
  {
    ElMessage.error( getMessage( res, "获取权限列表失败" ) );
  }
  // 获取角色已分配权限
  const rolePermissionRes: any = await getRolePermission( { roleId: row.id as number } );
  if ( rolePermissionRes.code === 200 )
  {
    const keys: number[] = [];
    filterCheckedKeys( rolePermissionRes.data[ 0 ], keys );
    checkedKeys.value = keys;
    defaultExpandedKeys.value = keys;
  }
  else
  {
    // 拉不到已分配权限时只清空勾选、不弹错误：
    // 抽屉紧接着还是要打开的，此时再叠一条「获取失败」会盖住上面那条权限树提示
    checkedKeys.value = [];
  }
  // 确保数据准备好后再打开抽屉
  drawerVisible.value = true;
};
const filterCheckedKeys = ( data: any, keys: number[] ) =>
{
  // 重复寻找看有没有子节点
  if ( data.children && data.children.length > 0 )
  {
    data.children.forEach( ( item: any ) =>
    {
      filterCheckedKeys( item, keys );
    } );
  }
  else
  // 找到最底层节点，判断是否选中
  {
    if ( data.select )
    {
      keys.push( data.id );
    }
  }
};
// 保存修改分配权限
const saveEditPermission = async () =>
{
  // 提交前进行全表单验证
  checkedKeys.value = await treeRef.value?.getCheckedKeys();
  const res: any = await updatePermission( { roleId: roleForm.value.id as number, permissionIds: checkedKeys.value } );

  if ( res.code === 200 )
  {
    drawerVisible.value = false;
    getRoleList();
    ElMessage.success( "分配成功" );

  }
  else
  {
    ElMessage.error( getMessage( res, "分配失败" ) );
  }
};
</script>

<style scoped></style>
