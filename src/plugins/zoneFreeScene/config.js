/*
 * @Description:
 * @Version: 1.668
 * @Autor: 地虎降天龙
 * @Date: 2025-09-11 08:59:53
 * @LastEditors: 地虎降天龙
 * @LastEditTime: 2025-12-08 12:25:17
 */

export default {
    name: 'zoneFreeScene',
    title: '編輯器直出免費項目',
    intro: `這裡都是基於TVT區域場景編輯器直接編輯匯出的場景，包含了全部原始碼、模型、編輯器配置等，方便大家快速二次開發和學習。<br>
    1、低像素煉油廠<br>
    全套項目原始碼：<a style="color: #5384ff;" href="https://gitee.com/ice-gl/icegl-three-vue-tres/blob/master/src/plugins/zoneFreeScene/pages/freeRefiningIndustry.vue" target="_blank">gitee原始碼跳轉</a><br>
    基於編輯器的配置，用於二次編輯使用：<a style="color: #5384ff;" href="https://opensource.icegl.cn/plugins/zoneFreeScene/config/freeRefiningIndustry.json" target="_blank">freeRefiningIndustry.json</a><br>
    線上編輯器再次編輯後免費匯出原始碼項目二次開發：<a style="color: #ef4035;" href="https://zone3deditor.icegl.cn/#/plugins/zone3Deditor/index?sceneConfig=freeRefiningIndustry" target="_blank">zone3Deditor頁面跳轉</a><br>
    2、TvT.js技術棧<br>
    全套項目原始碼：<a style="color: #5384ff;" href="https://gitee.com/ice-gl/icegl-three-vue-tres/blob/master/src/plugins/zoneFreeScene/pages/freeTvtStack.vue" target="_blank">gitee原始碼跳轉</a><br>
    基於編輯器的配置，用於二次編輯使用：<a style="color: #5384ff;" href="https://opensource.icegl.cn/plugins/zoneFreeScene/config/freeTvtStack.json" target="_blank">freeTvtStack.json</a><br>
    線上編輯器再次編輯後免費匯出原始碼項目二次開發：<a style="color: #ef4035;" href="https://zone3deditor.icegl.cn/#/plugins/zone3Deditor/index?sceneConfig=freeTvtStack" target="_blank">zone3Deditor頁面跳轉</a><br>
    3、海洋船運<br>
    全套項目原始碼：<a style="color: #5384ff;" href="https://gitee.com/ice-gl/icegl-three-vue-tres/blob/master/src/plugins/zoneFreeScene/pages/freeShipSea.vue" target="_blank">gitee原始碼跳轉</a><br>
    基於編輯器的配置，用於二次編輯使用：<a style="color: #5384ff;" href="https://opensource.icegl.cn/plugins/zoneFreeScene/config/freeShipSea.json" target="_blank">freeShipSea.json</a><br>
    線上編輯器再次編輯後免費匯出原始碼項目二次開發：<a style="color: #ef4035;" href="https://zone3deditor.icegl.cn/#/plugins/zone3Deditor/index?sceneConfig=freeShipSea" target="_blank">zone3Deditor頁面跳轉</a><br>
     QA問答:<br>
    1、此插件包依賴免費插件，請前往下載安裝： <a style="color: #5384ff;" href="https://www.icegl.cn/tvtstore/useViewportGizmo" target="_blank">ViewportGizmo插件</a><br>
    `,
    version: '2.1.0',
    author: '地虎降天龙',
    website: 'https://gitee.com/hawk86104',
    state: 'active',
    creatTime: '2025-09-11',
    updateTime: '2025-11-17',
    require: [],
    tvtstore: 'FREE',
    preview: [
        { src: './plugins/zoneFreeScene/preview/freeRefiningIndustry.png', type: 'img', name: 'freeRefiningIndustry', title: '低像素煉油廠', disableFPSGraph: false, disableSrcBtn: false },
        { src: './plugins/zoneFreeScene/preview/freeTvtStack.png', type: 'img', name: 'freeTvtStack', title: 'TvT.js技術棧', disableFPSGraph: false, disableSrcBtn: false },
        { src: './plugins/zoneFreeScene/preview/freeShipSea.png', type: 'img', name: 'freeShipSea', title: '海洋船運', disableFPSGraph: false, disableSrcBtn: false }
    ],
}
