import axios from "axios"
export const frontList = ["phoneBrand_card"]
export const toolList = [
  {
    type: "function",
    function: {
      name: "get_weather",//函数名称,模型根据这个名字调用我们写的函数
      description: "获取指定城市的天气信息，当用户询问天气时调用该函数",//描述,帮助模型理解何时调用
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "城市名称,例如:北京,上海"
          }
        },
        required: ["city"], //必填参数
      }
    }
  },
  {
    type: "function",
    function: {
      name: "phoneBrand_card",//函数名称,模型根据这个名字调用我们写的函数
      description: "当用户需要查看手机品牌信息时，调用此工具可以让前端展示一个手机品牌的信息卡片",//描述,帮助模型理解何时调用
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "手机品牌名，例如：小米，华为，OPPO等"
          }
        },
        required: ["phone"], //必填参数
      }
    }
  }
]
export const toolHandleMap = {
  async get_weather(args) {
    const { city } = args
    const API_key = "fab18cf429d5168687d6024dbeaa3020"
    try {
      const res = await axios.get(`https://restapi.amap.com/v3/weather/weatherInfo`,
        { params: { key: API_key, city, extensions: "base" } })
      console.log(res)
      if (res.data.status !== "1") {
        return `查询${city}天气失败:${res.data.info}`
      }
      const weather = res.data.lives[0]
      // 把返回信息整理成通顺文字
      return `${city}的天气是${weather.weather},温度是${weather.temperature}摄氏度,风向是${weather.winddirection}`
    } catch (err) {
      return "天气接口请求异常，请稍后重试"
    }
  }
}