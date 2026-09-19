import { defineStore } from "pinia";
const mainData = defineStore("mainData", {
  state: () => {
    return {
      collapse: false,
      flag: true, // 控制刷新
    };
  },
});
export default mainData;
