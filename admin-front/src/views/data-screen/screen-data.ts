/**
 * 数据大屏演示数据。
 *
 * 为什么单独放一个文件：
 * 大屏上的全部指标（实时游客数、男女比例、年龄分布、景区排行、客流趋势、
 * 年度对比、预约渠道、地图客流）在 request.md 里没有需求，后端
 * admin-mock-backend / admin-ai-backend 也没有对应接口，属于纯展示型大屏。
 * 这些数字原先散落在 8 个组件的模板与 echarts option 里，同一个值往往在
 * 「文字标签」和「图表数据」两处各写一遍（如男女比例 60/40），改一处就对不上。
 * 现在统一收敛到这里，并在大屏顶部挂「演示数据」标识，接入真实接口时只需替换本文件。
 */
/** 大屏数据是否来自真实接口。当前没有接口，恒为 true，接入后改成 false 即可 */
export const SCREEN_DATA_IS_DEMO = true;

/** 实时游客统计 */
export const TOURIST_STAT = {
  /** 当前实时游客数 */
  count: 2159088,
  /** 可预约总量（人） */
  reserveTotal: 999999,
  /** 水球图两层波浪的填充比例 */
  fillLevels: [ 0.65, 0.55 ],
};

/** 男女比例（百分比，两者相加为 100） */
export const GENDER_RATIO = {
  male: 60,
  female: 40,
};

/** 年龄分布：饼图与右侧图例共用同一份，保证两处永远一致 */
export const AGE_DISTRIBUTION = [
  { name: "10岁以下", value: 16, color: "#FFC107" },
  { name: "10-18岁", value: 8, color: "#FF8F00" },
  { name: "18-30岁", value: 12, color: "#00C6FF" },
  { name: "30-40岁", value: 24, color: "#007AFF" },
  { name: "40-60岁", value: 20, color: "#00BFA5" },
  { name: "60岁以上", value: 20, color: "#CE93D8" },
];

/** 热门景区排行 */
export const SCENIC_RANKING = [
  { name: "峨眉山", value: 80000, rate: 80, rank: "NO.1", rankColor: "#ff6b6b" },
  { name: "峨眉山", value: 60000, rate: 60, rank: "NO.1", rankColor: "#ff6b6b" },
  { name: "青城山", value: 60000, rate: 60, rank: "NO.2", rankColor: "#ffa502" },
  { name: "九寨沟", value: 50000, rate: 50, rank: "NO.3", rankColor: "#4ecdc4" },
  { name: "九寨沟", value: 50000, rate: 50, rank: "NO.3", rankColor: "#4ecdc4" },
];

/** 未来 30 天游客量趋势 */
export const TREND = {
  dates: [
    "05/05", "05/06", "05/07", "05/08", "05/09", "05/10", "05/11", "05/12",
    "05/13", "05/14", "05/15", "05/16", "05/17", "05/18", "05/19", "05/20",
    "05/21", "05/22", "05/23", "05/24", "05/25", "05/26", "05/27", "05/28",
    "05/29", "05/30", "05/31", "06/01", "06/02", "06/03",
  ],
  visitors: [
    7000, 5000, 12000, 9000, 8000, 6000, 18000, 12000,
    5000, 14000, 16000, 8000, 17000, 14000, 16000, 13000,
    15000, 18000, 11000, 9000, 18000, 15000, 6000, 9000,
    12000, 8000, 16000, 18000, 13000, 7000,
  ],
  /** Y 轴上限 */
  maxVisitors: 21000,
};

/** 年度游客量对比 */
export const YEAR_COMPARISON = {
  months: [ "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12" ],
  series: [
    {
      name: "2021年",
      color: "#ffa502",
      data: [ 80, 60, 90, 70, 120, 80, 100, 110, 90, 130, 150, 120 ],
    },
    {
      name: "2022年",
      color: "#45b7d1",
      data: [ 450, 400, 350, 200, 300, 500, 200, 250, 300, 200, 500, 400 ],
    },
    {
      name: "2023年",
      color: "#ff6b9d",
      data: [ 500, 400, 300, 100, 150, 450, 150, 200, 250, 150, 450, 350 ],
    },
  ],
  /** Y 轴上限与刻度间隔 */
  maxValue: 600,
  interval: 100,
};

/** 预约渠道数据统计 */
export const RESERVE_CHANNELS = [
  { name: "智旅文旅平台", value: 40, gradient: [ "#45b7d1", "#2e86de" ] },
  { name: "携程", value: 10, gradient: [ "#ffa502", "#ff7f50" ] },
  { name: "飞猪", value: 20, gradient: [ "#e056fd", "#be2edd" ] },
  { name: "其他渠道", value: 30, gradient: [ "#ff6b6b", "#ee5a24" ] },
];

/** 地图实时客流：预警条数与城市间客流线 */
export const MAP_FLOW = {
  warningCount: 2,
  /** 客流线两端坐标 [经度, 纬度]，label 仅供代码阅读时辨认城市 */
  lines: [
    { label: "北京 → 福州", coords: [ [ 116.46, 39.92 ], [ 118.06, 24.47 ] ] },
    { label: "北京 → 上海", coords: [ [ 116.46, 39.92 ], [ 121.48, 31.22 ] ] },
    { label: "成都 → 武汉", coords: [ [ 104.06, 30.57 ], [ 114.31, 30.52 ] ] },
    { label: "北京 → 成都", coords: [ [ 116.46, 39.92 ], [ 104.06, 30.57 ] ] },
  ],
};

