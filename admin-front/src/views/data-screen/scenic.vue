<template>
  <div class="scenic-module">
    <div class="module-header">
      <div class="header-left">
        <div class="tag-icon"></div>
        <span class="header-title">热门景区排行</span>
      </div>
    </div>
    <div class="table-container">
      <div class="table-header">
        <span class="col-rank">排名</span>
        <span class="col-name">景区</span>
        <span class="col-reserve">预约数量</span>
      </div>
      <div class="table-body">
        <div class="table-row" v-for=" ( item, index ) in scenicData " :key=" index ">
          <span class="rank-badge" :style=" { background: item.rankColor } ">{{ item.rank }}</span>
          <span class="scenic-name">{{ item.name }}</span>
          <div class="progress-wrapper">
            <div class="progress-bar" :style=" { width: item.rate + '%', background: item.rankColor } "></div>
            <span class="progress-text">{{ item.rate }}%</span>
          </div>
          <span class="reserve-count">{{ ( item.value / 10000 ).toFixed( 2 ) }}w</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 大屏数据统一来源，当前为演示数据
import { SCENIC_RANKING as scenicData } from './screen-data';
</script>

<style scoped lang="scss">
.scenic-module {
  width: 80%;
  height: 95%;
  margin-left: 20%;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.8) 0%, rgba(0, 30, 80, 0.9) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  pointer-events: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-icon {
  width: 10px;
  height: 20px;
  background: linear-gradient(180deg, #ff9900 0%, #ff6600 100%);
  border-radius: 0 4px 4px 0;
}

.header-title {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 8px rgba(255, 153, 0, 0.6);
}

.table-container {
  width: 100%;
  height: 100%;
  padding-top: 45px;
  padding-left: 15px;
  padding-right: 15px;
  padding-bottom: 10px;
  box-sizing: border-box;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 80, 180, 0.4);
  border-radius: 4px 4px 0 0;
  margin-bottom: 8px;
}

.col-rank {
  width: 60px;
  color: #ff9900;
  font-weight: bold;
  font-size: 13px;
}

.col-name {
  flex: 1;
  color: #ff9900;
  font-weight: bold;
  font-size: 13px;
}

.col-reserve {
  width: 80px;
  text-align: right;
  color: #ff9900;
  font-weight: bold;
  font-size: 13px;
}

.table-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 50, 120, 0.3);
  border-radius: 4px;
}

.rank-badge {
  width: 50px;
  height: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  margin-right: 12px;
}

.scenic-name {
  width: 60px;
  color: #fff;
  font-size: 12px;
  margin-right: 10px;
}

.progress-wrapper {
  flex: 1;
  height: 16px;
  background: rgba(0, 80, 180, 0.5);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  margin-right: 10px;
}

.progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #fff;
  font-size: 11px;
}

.reserve-count {
  width: 70px;
  text-align: right;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
}
</style>
