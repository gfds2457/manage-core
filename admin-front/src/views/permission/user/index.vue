<template>
  <div>
    <!-- 搜索用户卡片 -->
    <el-card>
      <el-form :inline=" true " class="search-form" @submit.native.prevent>
        <el-form-item label="用户名">
          <el-input placeholder="请输入用户名" v-model=" searchKeyword " @keyup.enter=" searchUser " />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="margin-left: -5px" @click=" searchUser ">搜索</el-button>
          <el-button @click=" refresh ">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <!-- 用户列表卡片 -->
    <el-card style="margin-top: 5px">
      <div style="margin-bottom: 15px">
        <el-button type="primary" icon="Plus" v-hasBtn="PERM.PERMISSION_USER_WRITE"
          @click=" addUser ">添加用户</el-button>
        <el-button type="danger" icon="Delete" v-hasBtn="PERM.PERMISSION_USER_WRITE" @click=" deleteCheckedUsers "
          :disabled=" checkedUsers.length == 0 ">批量删除</el-button>
      </div>
      <el-table style="width: 100%" border :data=" userData " @selection-change=" handleSelectionChange ">
        <el-table-column type="selection" width="55" />
        <el-table-column label="#" width="60" type="index" />
        <el-table-column label="id" prop="id" width="80" />
        <el-table-column label="用户名字" prop="username" />
        <el-table-column label="用户名称" prop="name" />
        <el-table-column label="用户角色" prop="roleName" />
        <el-table-column label="创建时间" prop="createTime" />
        <el-table-column label="更新时间" prop="updateTime" />
        <el-table-column label="操作" fixed="right" width="300">
          <template #default=" { row } ">
            <el-button type="primary" size="small" style="margin-right: 5px"
              v-hasBtn="PERM.PERMISSION_USER_WRITE" @click=" assignRole( row )">分配角色</el-button>
            <el-button type="warning" size="small" style="margin-right: 5px" v-hasBtn="PERM.PERMISSION_USER_WRITE"
              @click=" editUser( row )">编辑</el-button>
            <el-popconfirm title="您确定删除吗？" @confirm=" deleteUser( row )">
              <template #reference>
                <el-button size="small" type="danger" v-hasBtn="PERM.PERMISSION_USER_WRITE">删除</el-button>
              </template>
            </el-popconfirm>
            <el-button size="small">重置</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 20px; text-align: center">
        <el-pagination v-model:current-page=" currentPage4 " v-model:page-size=" pageSize4 "
          :page-sizes=" [ 3, 5, 7, 9 ] " background layout=" prev, pager, next, jumper, -> , sizes ,total"
          :total=" totalPages " style="margin-top: 15px" @current-change=" getUserAll " @size-change=" getUserAll " />
      </div>
    </el-card>
    <!-- 添加编辑用户抽屉卡片 -->
    <el-drawer :title=" drawerForm.id ? '编辑用户' : '添加用户' " direction="rtl" size="30%" v-model=" drawerVisible ">
      <el-form label-width="80px" :model=" drawerForm " style="margin-top: -10px" :rules=" rules " ref="drawerFormRef">
        <el-form-item label="用户姓名" prop="username">
          <el-input placeholder=" 请输入用户姓名" v-model=" drawerForm.username " />
        </el-form-item>
        <el-form-item label="用户昵称" prop="nickname">
          <el-input placeholder=" 请输入用户昵称" v-model=" drawerForm.nickname " />
        </el-form-item>
        <el-form-item label="用户密码" prop="password">
          <el-input placeholder=" 请输入用户密码" type="password" v-model=" drawerForm.password " />
        </el-form-item>
        <el-form-item label="用户角色" prop="roleNames">
          <el-select placeholder="请选择用户角色" multiple style="width: 100%" v-model=" drawerForm.roleNames ">
            <el-option v-for=" role in roles " :key=" role " :label=" role " :value=" role " />
          </el-select>
        </el-form-item>
      </el-form>
      <el-button type="primary" style="margin-top: 20px" @click=" saveUser ">添加保存</el-button>
      <el-button @click=" drawerVisible = false" style="margin-top: 20px">取消</el-button>
    </el-drawer>
    <!-- 分配角色抽屉卡片 -->
    <el-drawer title="分配角色给用户" direction="rtl" size="30%" v-model=" roleDrawerVisible ">
      <el-form label-width="80px">
        <el-form-item label="用户姓名">
          <el-input placeholder="请输入用户姓名" v-model=" drawerForm.username " />
        </el-form-item>
        <el-form-item label="角色列表">
          <el-checkbox v-model=" checkAll " :indeterminate=" isIndeterminate " @change=" handleCheckAllChange ">
            全选
          </el-checkbox>
          <el-checkbox-group v-model=" checkedRoles " @change=" handleCheckedRolesChange ">
            <el-checkbox v-for=" role in roles " :key=" role " :label=" role " :value=" role ">
              {{ role }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click=" roleDrawerVisible = false">取消</el-button>
        <el-button type="primary" @click=" saveUserRole ">确定</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
defineOptions( {
  name: "UserManage",
} )
import { ref, onBeforeMount, nextTick } from "vue";
import { reUserInfo, reAddOrUpdateUser, reUserList, reUpdateUserRole, reDeleteUserRole, reSearchUser } from "@/API/user";
import { ElMessage } from "element-plus";
import useUser from "@/store/modules/user";
// getMessage 用来把后端返回的 message 显示出来。直接写死「xxx失败」会把
// 403 的「无权限执行该操作（当前角色：产品）」这句关键提示吞掉，
// 用户只看到「删除用户失败」，既不知道原因也不知道该怎么办
import { getMessage } from "@/composables/useRecycleBin";
import { PERM, parseRoles } from "@/utils/permission";
import type { UserAllResInterface, UserItemInterface } from "./type";
const userStore = useUser();
// 数据
// 当前页码
const currentPage4 = ref( 1 );
// 每页条数
const pageSize4 = ref( 5 );
// 总条数
const totalPages = ref( 10 );
// 用户列表
const userData = ref<UserItemInterface[]>( [] );
// 抽屉是否显示
const drawerVisible = ref( false );
// 角色抽屉是否显示
const roleDrawerVisible = ref( false );
// 抽屉表单数据
const drawerForm = ref( {
  id: null as number | null,
  username: "",
  nickname: "",
  password: "",
  // 新增/编辑账号必须指定角色，账号权限跟随角色自动生效
  roleNames: [] as string[],
} );
// 控制角色全选状态
const checkAll = ref( false );
// 控制角色半选状态
const isIndeterminate = ref( false );
// 抽屉表单实例
const drawerFormRef = ref();
// 角色列表
const roles = ref<string[]>( [] );
// checkbox里所有选中的label值,即角色
const checkedRoles = ref<string[]>( [] );
// 多选框选中的用户
const checkedUsers = ref<UserItemInterface[]>( [] );
// 搜索关键词
const searchKeyword = ref( "" );
// 抽屉表单验证规则
const rules = ref( {
  username: [ {
    required: true, trigger: "blur", validator: ( _rule: any, value: string, callback: any ) =>
    {
      if ( value.trim().length < 1 || value.trim().length > 10 )
        callback( new Error( "用户名长度必须在1到10个字符之间" ) );
      else
        callback();
    }
  } ],
  nickname: [ {
    required: true, trigger: "blur", validator: ( _rule: any, value: string, callback: any ) => 
    {
      if ( value.trim().length < 2 || value.trim().length > 10 )
        callback( new Error( "用户昵称长度必须在2到10个字符之间" ) );
      else
        callback();
    }
  } ],
  password: [ {
    required: true, trigger: "blur", validator: ( _rule: any, value: string, callback: any ) =>
    {
      if ( value.trim().length < 6 || value.trim().length > 12 )
        callback( new Error( "用户密码长度必须在6到12个字符之间" ) );
      else
        callback();
    }
  } ],
  // 校验器单独写一个数组分支：value 是 string[]，套用上面那套 value.trim() 会直接抛错
  roleNames: [ {
    required: true, trigger: "change", validator: ( _rule: any, value: string[], callback: any ) =>
    {
      if ( !Array.isArray( value ) || value.length < 1 )
        callback( new Error( "请至少为用户分配一个角色" ) );
      else
        callback();
    }
  } ],
} );
// 方法
// 依据当前勾选数量刷新「全选」框的选中/半选态。
// 抽出来是因为三个入口（勾选角色、点全选、打开抽屉回填）都要算这套状态，
// 之前只在两个 change 事件里各写了一遍，回填那条路径就漏了
const syncCheckAllState = () =>
{
  const picked = checkedRoles.value.length;
  const total = roles.value.length;
  checkAll.value = total > 0 && picked === total;
  isIndeterminate.value = picked > 0 && picked < total;
}
// 处理选中角色变化,多选框选中后触发该函数
const handleCheckedRolesChange = ( val: string[] ) =>
{
  // val 是选中的角色数组
  // 响应式数据更新略晚于change事件调用,因此手动更新checkedRoles.value
  // 能避免快速点击全选/半选/取消全选/取消半选时,checkedRoles.value未更新导致的问题
  checkedRoles.value = val;
  syncCheckAllState();
}
// 处理全选状态变化,全选框选中后触发该函数
const handleCheckAllChange = ( val: boolean ) =>
{
  // val 是全选框的选中状态
  // 响应式数据更新略晚于change事件调用,因此手动更新checkedRoles.value
  // 能避免快速点击全选/半选/取消全选/取消半选时,checkedRoles.value未更新导致的问题
  checkedRoles.value = val ? [ ...roles.value ] : [];
  syncCheckAllState();
}
// 封装获取用户列表全部数据请求
const getUserAll = async () =>
{
  const res: UserAllResInterface = await reUserInfo( currentPage4.value, pageSize4.value );
  if ( res.code == 200 )
  {
    userData.value = res.data.records;
    totalPages.value = res.data.total;
  }
};
// 拉取全部角色名，供新增/编辑抽屉与分配角色抽屉共用。
// 返回成功与否，调用方按结果决定要不要继续往下走
const loadRoles = async (): Promise<boolean> =>
{
  try
  {
    const res: any = await reUserList();
    if ( res.code == 200 && Array.isArray( res.data ) )
    {
      roles.value = res.data.map( ( item: any ) => item.roleName );
      return true;
    }
  }
  catch ( err )
  {
    // 落到下面的统一提示；不往外抛是因为这是个前置数据请求，
    // 抛出去只会让调用方的 await 中断，弹窗都打不开
  }
  ElMessage.error( "获取角色列表失败" );
  return false;
};
// 页面挂载发送获取用户列表全部数据请求
onBeforeMount( async () =>
{
  getUserAll()
  // 角色列表要在抽屉打开之前就绪，否则「用户角色」下拉是空的，
  // 用户会以为是没权限而不是没加载
  await loadRoles();
} )
// 添加用户
const addUser = () =>
{
  // 添加用户前,先清空错误提示
  nextTick( () =>
  {
    drawerFormRef.value.clearValidate();
  } )
  // 添加用户前，先清空抽屉表单数据
  drawerForm.value = {
    id: null as number | null,
    username: "",
    nickname: "",
    password: "",
    roleNames: [],
  };
  drawerVisible.value = true;
}
// 添加保存用户
const saveUser = async () =>
{
  // 验证抽屉表单所有数据是否符合要求。
  // 校验不通过时 validate() 会 reject，之前没接住，页面上只有控制台一条报错，
  // 现在吞掉异常直接返回，让表单自己的红字提示说话
  try
  {
    await drawerFormRef.value.validate();
  }
  catch ( err )
  {
    return;
  }
  const res: any = await reAddOrUpdateUser( {
    ...drawerForm.value,
    // 后端按 roleNames 落库，同时把 roleName 拼成逗号串存给列表显示
    roleNames: drawerForm.value.roleNames,
  } );
  if ( res.code == 200 && res.data )
  {
    ElMessage.success( drawerForm.value.id ? "编辑用户成功" : "添加用户成功" );
    drawerVisible.value = false;
    getUserAll();
    // 如果编辑的是当前用户，需要重新登录
    if ( drawerForm.value.id && drawerForm.value.id === userStore.id )
    {
      // 清空当前用户数据
      userStore.userLogout();
      // 刷新页面重新登录
      location.reload();
    }
  }
  else
  {
    ElMessage.error( getMessage( res, drawerForm.value.id ? "编辑用户失败" : "添加用户失败" ) );
  }
}
// 编辑用户
const editUser = ( row: UserItemInterface ) =>
{
  // 编辑用户前,先清空错误提示
  nextTick( () =>
  {
    drawerFormRef.value.clearValidate();
  } )
  // 编辑用户时，将用户信息赋值给抽屉表单数据
  drawerForm.value = {
    id: row.id as number,
    username: row.username,
    nickname: row.name,
    password: row.password,
    // 未分配角色的账号 roleName 是空串，split(",") 会得到 [""]，
    // 让一个空角色名混进下拉框的选中项里，所以用 parseRoles 统一拆
    roleNames: parseRoles( row.roleName ),
  };
  drawerVisible.value = true;
}
// 分配角色给用户
const assignRole = async ( row: UserItemInterface ) =>
{
  // 分配角色给用户前,先获取用户全部职位列表
  await loadRoles();
  // 将角色已有职位选中,并赋值给checkedRoles.value。
  // 空 roleName 走 parseRoles 得 []，而不是 [""]——否则「没角色的账号」
  // 一进抽屉就显示选中了一格，保存后还会把空角色名提交上去
  checkedRoles.value = parseRoles( row.roleName );
  // 同步全选/半选态，否则上一次打开抽屉留下的勾选状态会串到下一个人身上
  syncCheckAllState();
  // 打开角色抽屉表单
  roleDrawerVisible.value = true;
  // 分配角色给用户时，将用户信息赋值给抽屉表单数据
  Object.assign( drawerForm.value, row );
}
// 保存用户角色
const saveUserRole = async () =>
{
  // 验证抽屉表单所有数据是否符合要求
  nextTick( () =>
  {
    drawerFormRef.value.validate();
  } )
  // 没有选择角色时,提示用户选择角色
  if ( checkedRoles.value.length == 0 )
  {
    ElMessage.error( "请选择用户角色" );
    return;
  }
  const res: any = await reUpdateUserRole( {
    id: drawerForm.value.id as number,
    roleNames: checkedRoles.value,
  } );
  if ( res.code == 200 && res.data )
  {
    ElMessage.success( "更新用户角色成功" );
    roleDrawerVisible.value = false;
    getUserAll();
  }
  else
  {
    ElMessage.error( getMessage( res, "更新用户角色失败" ) );
  }
}
// 删除用户
const deleteUser = async ( row: UserItemInterface ) =>
{
  const res: any = await reDeleteUserRole( {
    ids: [ row.id as number ],
  } );
  if ( res.code == 200 && res.data )
  {
    ElMessage.success( "删除用户成功" );
    getUserAll();
  }
  else
  {
    ElMessage.error( getMessage( res, "删除用户失败" ) );
  }
}
// 勾选用户，处理选择变化
const handleSelectionChange = ( val: any ) =>
{
  checkedUsers.value = val;
}
// 批量删除用户按钮
const deleteCheckedUsers = async () =>
{
  if ( checkedUsers.value.length == 0 )
  {
    ElMessage.error( "请选择要删除的用户" );
    return;
  }
  const res: any = await reDeleteUserRole( {
    // 把选中的用户id转换为数组,并赋值给ids
    ids: checkedUsers.value.map( ( item: any ) => item.id as number ),
  } );
  if ( res.code == 200 && res.data )
  {
    ElMessage.success( "删除选中用户成功" );
    // 删除成功后,清空选中的用户
    checkedUsers.value = [];
    // 刷新用户列表
    getUserAll();
  }
  else
  {
    ElMessage.error( getMessage( res, "删除选中用户失败" ) );
  }
}
// 搜索用户
const searchUser = async () =>
{
  const res: any = await reSearchUser( {
    keyword: searchKeyword.value,
  } );
  if ( res.code == 200 && res.data )
  {
    userData.value = res.data.records;
    totalPages.value = res.data.total;
    // 搜索成功后,清空搜索框内容
    searchKeyword.value = "";
    // 搜索成功后,将currentPage.value赋值为1
    currentPage4.value = 1;
  }
  else
  {
    ElMessage.error( getMessage( res, "搜索用户失败" ) );
  }
}

// 重置搜索条件：清空关键字、回到第一页并重新拉取用户列表。
// 之前这里改的是 mainData().flag 的值拷贝（刷新开关存在 pinia 里），
// 改局部变量不会写回 store，等于什么都没做，所以按钮点了没反应
const refresh = async () =>
{
  searchKeyword.value = "";
  currentPage4.value = 1;
  await getUserAll();
};
</script>

<style lang="scss" scoped></style>
