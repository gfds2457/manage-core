<template>
  <div>
    <el-card>
      <el-table style="width: 100%" border :data=" menuList " row-key="id">
        <el-table-column label="名称" prop="name" />
        <el-table-column label="权限值" prop="code" />
        <el-table-column label="修改时间" prop="updateTime" />
        <el-table-column label="操作" fixed="right" width="300">
          <template #default=" { row } ">
            <el-button :type=" row.type === 1 ? 'primary' : 'info' " size="small" style="margin-right: 5px"
              v-hasBtn="PERM.PERMISSION_MENU_WRITE" @click="addMenu( row )">{{ row.type === 1 ?
                "添加菜单" : "添加权限" }}</el-button>
            <el-button type="warning" size="small" style="margin-right: 5px" v-hasBtn="PERM.PERMISSION_MENU_WRITE"
              @click="editMenu( row )" :disabled=" row.type === 1 ">编辑</el-button>
            <el-button type="danger" size="small" v-hasBtn="PERM.PERMISSION_MENU_WRITE" @click="deleteMenu( row )"
              :disabled=" row.type === 1 ">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog :title=" dialogTitle " v-model=" dialogVisible ">
      <el-form label-width="80px" style="margin-top: 20px" :model=" menuForm " :rules=" rules " ref="menuFormRef">
        <el-form-item label="名称" prop="name">
          <el-input placeholder="请输入名称" v-model=" menuForm.name " required />
        </el-form-item>
        <el-form-item label="权限值" prop="code">
          <el-input placeholder="请输入权限值" v-model=" menuForm.code " required />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click=" saveOrUpdateMenu ">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions( {
  name: "MenuList",
} );
import { ref, computed, onMounted } from "vue";
import { getPermission } from "@/API/role";
import { AddPermission, UpdatePermission, DeletePermission } from "@/API/menu";
import { ElMessage } from "element-plus";
import { getMessage } from "@/composables/useRecycleBin";
import { PERM } from "@/utils/permission";
// 菜单列表所有数据
const menuList = ref( [] );
// 添加弹窗是否显示
const dialogVisible = ref( false );
// 表单数据。id 与 pid 必须分开存：
// id 是「正在编辑的节点自身 id」（新增时为 undefined），
// pid 才是「新节点挂到哪个父级下」。
// 之前只有一个 id 字段同时承担这两个语义，编辑时 Object.assign 把 row.pid 灌进来，
// 保存时就变成拿节点自己的 id 当父级 id，层级直接错乱
const menuForm = ref( {
  id: undefined as number | undefined,
  pid: undefined as number | undefined,
  name: "",
  code: "",
  type: null as number | null,
} );
// 弹窗标题：编辑态显示「编辑权限」，新增态按 type 区分菜单/权限
const dialogTitle = computed( () =>
{
  if ( menuForm.value.id !== undefined )
  {
    return menuForm.value.type === 1 ? "编辑菜单" : "编辑权限";
  }
  return menuForm.value.type === 1 ? "添加菜单" : "添加权限";
} );
const rules = ref( {} );
// 获得菜单列表所有数据
const getMenuList = async () =>
{
  const res: any = await getPermission();
  if ( res.code === 200 )
  {
    menuList.value = res.data[ 0 ].children;
  }
};
// 组件挂载时获得菜单列表所有数据
onMounted( () =>
{
  getMenuList();
} );
// 添加菜单：新节点与当前行同级，所以父级取当前行的 pid
const addMenu = ( row: any ) =>
{
  // 清空表单数据
  menuForm.value.name = '';
  menuForm.value.code = '';
  dialogVisible.value = true;
  // 新增没有自身 id
  menuForm.value.id = undefined;
  // 父级 id 取当前行的 pid（点击的这行挂在哪，新节点就挂在哪）
  menuForm.value.pid = row.pid;
  menuForm.value.type = row.type === 1 ? 1 : 2;
};
// 编辑菜单：只挑表单需要的字段，不能整个 row 覆盖，
// 否则 row 里的 pid / updateTime 会一起灌进表单
const editMenu = ( row: any ) =>
{
  dialogVisible.value = true;
  menuForm.value.id = row.id;
  menuForm.value.pid = row.pid;
  menuForm.value.name = row.name;
  menuForm.value.code = row.code;
  menuForm.value.type = row.type;
};
// 删除菜单
// 后端按权限自身 id 删除（只会从父节点的 children 里摘掉），传 pid 会误删父级或404
const deleteMenu = async ( row: any ) =>
{
  const res: any = await DeletePermission( row.id );
  if ( res.code === 200 )
  {
    getMenuList();
  }
  else
  {
    ElMessage.error( getMessage( res, "删除失败" ) );
  }
};
// 新增或编辑菜单：有 id 走更新接口，没有则走新增
const saveOrUpdateMenu = async () =>
{
  const isEdit = menuForm.value.id !== undefined;
  const res: any = isEdit
    ? await UpdatePermission( {
      id: menuForm.value.id,
      name: menuForm.value.name,
      code: menuForm.value.code,
    } )
    : await AddPermission( {
      name: menuForm.value.name,
      code: menuForm.value.code,
      pid: menuForm.value.pid,
      type: menuForm.value.type as number,
    } );
  if ( res.code === 200 )
  {
    dialogVisible.value = false;
    getMenuList();
    ElMessage.success( isEdit ? "修改成功" : "添加成功" );
  }
  else
  {
    ElMessage.error( getMessage( res, isEdit ? "修改失败" : "添加失败" ) );
  }
};
</script>

<style scoped></style>