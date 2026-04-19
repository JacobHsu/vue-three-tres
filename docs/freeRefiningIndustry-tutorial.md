# 低像素煉油廠 3D 場景教學 (freeRefiningIndustry)

> 目標：從零理解 [低像素煉油廠](https://zone3deditor.icegl.cn/#/plugins/zone3Deditor/pluginOne?sceneConfig=freeRefiningIndustry) 的完整實作，掌握 TVT.js 工業場景的核心架構，並學會自行組裝類似場景。

---

## 目錄

1. [場景概述](#場景概述)
2. [檔案結構](#檔案結構)
3. [整體架構圖](#整體架構圖)
4. [Step 1：TresCanvas 主場景設定](#step-1trescanvas-主場景設定)
5. [Step 2：正交攝影機（等距視角）](#step-2正交攝影機等距視角)
6. [Step 3：資源預載 Resource.loadResources](#step-3資源預載-resourceloadresources)
7. [Step 4：GLB 模型批量擺放（glbsList）](#step-4glb-模型批量擺放glbslist)
8. [Step 5：地板與天光](#step-5地板與天光)
9. [Step 6：延伸元件 extendMeshes](#step-6延伸元件-extendmeshes)
10. [Step 7：後處理 tresProcessing](#step-7後處理-tresprocessing)
11. [元件依賴總覽](#元件依賴總覽)
12. [常見問題](#常見問題)

---

## 場景概述

**低像素煉油廠**是基於 TVT.js 區域場景編輯器匯出的完整免費項目，特色：

- 等距（Isometric）正交攝影機視角
- 14 種低多邊形 GLB 工業設備模型
- 動態管線、靜態水面、粒子底座、精靈文字標籤
- 圍牆、矩形漸變區域、RoundedBox 鏡面反射
- PostProcessing Bloom 可開關

| 項目 | 資訊 |
|------|------|
| 插件 | `zoneFreeScene`（免費） |
| 主頁面 | `src/plugins/zoneFreeScene/pages/freeRefiningIndustry.vue` |
| 元件目錄 | `src/plugins/zoneFreeScene/components/freeRefiningIndustry/` |
| 依賴插件 | `basic`, `floor`, `UIdemo`, `industry4`, `water`, `digitalCity` |

---

## 檔案結構

```
src/plugins/zoneFreeScene/
├── pages/
│   └── freeRefiningIndustry.vue     # 主場景入口
└── components/freeRefiningIndustry/
    ├── floor.vue                     # 地板 + 無限格線
    ├── skylight.vue                  # 天空光 + 方向光
    ├── glbsList.vue                  # 所有 GLB 模型擺放
    ├── extendMeshes.vue              # TVT 特殊元件（水、管線、標籤等）
    └── tresProcessing.vue            # PostProcessing 後處理
```

---

## 整體架構圖

```
freeRefiningIndustry.vue
│
├── <loading>              # 載入動畫（等待資源）
├── <TresCanvas>           # Three.js 場景根容器
│   ├── TresOrthographicCamera  # 正交攝影機（等距視角）
│   ├── OrbitControls           # 滑鼠旋轉/縮放
│   ├── TresAmbientLight        # 環境光
│   ├── viewportGizmo           # 右下角方向羅盤
│   │
│   ├── <floor>            # 地板 + GridHelper
│   ├── <skylight>         # 天空光系統
│   ├── <glbsList>         # 14 種 GLB 模型（等資源載完才渲染）
│   ├── <extendMeshes>     # 特殊 TVT 元件
│   └── <tresProcessing>   # Bloom / 色差後處理
│
└── Resource.loadResources([...])  # 預載 14 個 GLB
```

---

## Step 1：TresCanvas 主場景設定

`freeRefiningIndustry.vue` 的 `tcConfig` 控制整個渲染管線：

```ts
const tcConfig = {
    clearColor: '#201919',          // 場景背景色（深棕黑）
    windowSize: true,               // canvas 填滿視窗
    shadows: true,                  // 開啟陰影
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    shadowMapType: THREE.PCFSoftShadowMap,  // 軟陰影
}
```

**重點**：`clearColor: '#201919'` 讓整個場景呈現暗色工業感，搭配低多邊形模型效果最好。

---

## Step 2：正交攝影機（等距視角）

```html
<TresOrthographicCamera
    :position="[-2.82, 8.65, 12.56]"
    :left="-widths"  :right="widths"
    :top="heights"   :bottom="-heights"
    :zoom="108.8"
    :near="-100"     :far="10000"
/>
```

```ts
const widths = 1000
const { width, height } = useWindowSize()
const heights = computed(() => 1000 * height.value / width.value)
```

**原理**：正交攝影機沒有透視縮小效果，`left/right/top/bottom` 定義視錐範圍，`zoom` 控制縮放倍率。`widths=1000` 是固定寬度，`heights` 隨視窗比例動態計算，保持畫面不變形。

**等距視角技巧**：position `[-2.82, 8.65, 12.56]` 搭配 OrbitControls target `[2.53, 1.78, -0.12]`，形成約 30° 俯角的等距感。

---

## Step 3：資源預載 Resource.loadResources

所有 GLB 模型在場景掛載時統一預載：

```ts
Resource.loadResources([
    { functionName: 'GLTFLoader', url: 'https://oss.icegl.cn/.../floor.glb' },
    { functionName: 'GLTFLoader', url: 'https://oss.icegl.cn/.../gasTank.glb' },
    { functionName: 'GLTFLoader', url: 'https://oss.icegl.cn/.../oilTruck.glb' },
    // ...共 14 個模型
])
```

**為什麼要預載？** 場景內同一模型會被複製多次（例如 `gasTank.glb` 用了 11 次），預載後從快取複製，不需重複下載。

**等待載完才渲染**：
```html
<glbsList v-if="Resource.hasAllFinished.value" />
<extendMeshes v-if="Resource.hasAllFinished.value" />
```

---

## Step 4：GLB 模型批量擺放（glbsList）

`glbsList.vue` 是編輯器匯出的核心，展示如何將同一模型複製到不同位置。

### 核心函式：standardizationMeshCopy + syncMeshProp

```ts
import { standardizationMeshCopy } from '@/common/forEditor'

// 1. 從快取取得模型並深度複製
const oneglb1_0 = standardizationMeshCopy(Resource.getItem('gasTank.glb').scene)

// 2. 定義這份複製的屬性（位置、旋轉、縮放、陰影等）
const op1_0 = {
    uuid: '29b4e0f2-...',
    rotation: { x: 0, y: 1.49, z: 0 },
    position: { x: 7.796, y: 0, z: 0.251 },
    scale: { x: 1, y: 1, z: 1 },
    castShadow: true,
    receiveShadow: false,
    visible: true,
    name: 'gasTank',
    actionList: { timeScale: 1, actions: {} }  // 動畫設定
}

// 3. 將屬性同步到複製的模型
syncMeshProp(oneglb1_0, op1_0, Resource.getItem('gasTank.glb').animations)

// 4. 加入場景群組
glbsGroup.add(oneglb1_0)
```

### syncMeshProp 做了什麼？

```ts
const syncMeshProp = (glb, meshProp, animations) => {
    glb.uuid = meshProp.uuid
    glb.rotation.set(x, y, z)
    glb.position.set(x, y, z)
    glb.scale.set(x, y, z)
    glb.visible = meshProp.visible
    glb.castShadow = meshProp.castShadow
    // 遞迴設定所有子 Mesh 的陰影
    setupLightingForModel(glb, meshProp.castShadow, 'castShadow')
    // 若有動畫，啟動動畫播放
    if (animations && meshProp.actionList.actions) {
        const { mixer, actions } = useAnimations(ref(animations), glb)
        // play 各動畫片段
    }
}
```

### 場景中的模型清單

| 模型 | 數量 | 說明 |
|------|------|------|
| `floor.glb` | 7 | 地板區塊（不同縮放拼接） |
| `gasTank.glb` | 11 | 瓦斯槽（排列成儲罐區） |
| `oilTruck.glb` | 3 | 油罐車 |
| `cCringUnit.glb` | 1 | 壓縮機組 |
| `house.glb` | 1 | 廠房建築 |
| `ccUnit.glb` | 1 | 冷卻裝置 |
| `oilHeater.glb` | 1 | 加熱爐 |
| `tower.glb` | 1 | 蒸餾塔 |
| `oilTank.glb` | 2 | 大型儲油槽 |
| `machine.glb` | 1 | 機械設備 |
| `srUnit.glb` | 1 | 脫硫裝置 |
| `tank2.glb` | 1 | 小型儲槽 |
| `gtUnit.glb` | 2 | 燃氣輪機組 |
| `flaringDevice.glb` | 1 | 燃燒塔 |

---

## Step 5：地板與天光

### floor.vue

```ts
// 在主場景傳入設定
const fState = {
    color: '#C2C2C2',
    shadowColor: '#8C8C8C',
    receiveShadow: true,
    edge: 0.35,
    scale: 2.93
}
const gridState = {
    cellSize: 0.59,
    cellThickness: 1,
    cellColor: '#404040',
    sectionColor: '#2F2F2F',
    sectionSize: 3.1,
    sectionThickness: 2.38,
    fadeDistance: 22,
    fadeStrength: 1,
    infiniteGrid: true,   // 無限延伸格線
}
```

格線顏色用深灰 `#404040`/`#2F2F2F`，配合深背景色，呈現工業感。

### skylight.vue

```ts
const sState = {
    curTime: 14.2,       // 模擬時間（影響太陽角度）
    direct: 0.5,         // 方向光強度
    intensity: 1,        // 天空光強度
    shadowIntensity: 0.78
}
```

`curTime: 14.2` 代表下午 2 點，陽光從側面打入，形成清晰的方向性陰影。

---

## Step 6：延伸元件 extendMeshes

`extendMeshes.vue` 使用各插件提供的特殊 TVT 元件，每個元件用 `<Suspense>` 包裹（因為是非同步元件）。

### 元件來源對照

```ts
import { staticWater } from 'PLS/water'           // 靜態水面
import { fencePlus, rectangleGlow } from 'PLS/digitalCity'  // 圍牆、矩形漸變
import { particleBase, reflectorRoundedBox } from 'PLS/floor'  // 粒子底座、鏡面
import { bannerLabel } from 'PLS/UIdemo'           // 精靈圖文字標籤
import { flexiblePipe2 } from 'PLS/industry4'     // 伸縮管線
```

### 各元件說明

| 元件 | 外觀效果 | 關鍵參數 |
|------|---------|---------|
| `staticWater` | 靜止水面（鏡面反射） | `waterColor`, `metalness`, `roughness` |
| `fencePlus` | 半透明圍牆 | `width/height/depth`, `opacity`, `num`(列數) |
| `particleBase` | 粒子漂浮底座 | `count`, `size`, `color`, `areaX/Y/Z` |
| `bannerLabel` | 3D 空間文字標籤 | `text`, `fontSize`, `backgroundColor`, `isSprite` |
| `rectangleGlow` | 矩形漸變光暈 | `w/h`, `pColor`, `nNumber`(條紋數) |
| `flexiblePipe2` | 動態流動管線 | `color`, `radius`, `speed`, `bodyLength` |
| `reflectorRoundedBox` | 圓角鏡面方塊 | `width/height/depth`, `radius`, `mix` |

### flexiblePipe2 流動管線範例

```ts
// 藍色流動管線（向左流）
const eMeshState7 = {
    color: '#3759E1',
    uGapColor: '#FFF3F3',
    radius: 0.058,
    bodyLength: 7.6,
    speed: -0.013,       // 負值 = 反向流動
    uStripeScale: 13.8,  // 條紋密度
    metalness: 0.33,
    roughness: 0.39,
}
```

`speed` 正負控制流向，`uStripeScale` 控制條紋間距，`radius` 控制管徑。

### bannerLabel 標籤範例

```ts
// 「原油儲罐區」標籤
const eMeshState11 = {
    isSprite: true,          // 始終面向攝影機
    text: '原油儲罐區',
    fontSize: 48,
    fontColor: '#000000',
    backgroundColor: '#F1EFEFC7',  // 含透明度的白底
    padding: { y: 35, x: 26 },
    align: 'center-bottom',
    scaleFactor: 0.022,
    borderColor: '#000000',
    borderWidth: 1,
    borderRadius: 2,
    dpi: 3.4,
}
```

`isSprite: true` 讓標籤永遠正面朝向攝影機，適合等距視角的區域標示。

---

## Step 7：後處理 tresProcessing

```ts
const pState = {
    isOpenList: {
        Bloom: false,              // Bloom 預設關閉
        chromaticAberration: false // 色差預設關閉
    },
    configList: {
        Bloom: {
            radius: 0.85,
            intensity: 4,
            'luminance-threshold': 0.1,
            'luminance-smoothing': 0.3,
            'mipmap-blur': false
        },
        chromaticAberration: {
            offsetX: 0.07,
            offsetY: 0.07,
            radialModulation: true,
            modulationOffset: 0
        },
    },
}
```

**開啟 Bloom**：把 `isOpenList.Bloom` 改為 `true`，高亮發光物件會產生光暈效果（適合管線、指示燈）。

---

## 元件依賴總覽

```
freeRefiningIndustry
│
├── PLS/resourceManager → Resource（資源管理）
├── PLS/useViewportGizmo → viewportGizmo（方向羅盤）
├── PLS/UIdemo → yangyangLoading, bannerLabel
├── @/common/forEditor → standardizationMeshCopy
│
├── PLS/water → staticWater
├── PLS/digitalCity → fencePlus, rectangleGlow
├── PLS/floor → particleBase, reflectorRoundedBox
├── PLS/industry4 → flexiblePipe2
└── @tresjs/cientos → OrbitControls, useAnimations
```

---

## 常見問題

### Q：場景載入後模型不顯示？

確認 `Resource.hasAllFinished.value` 為 `true`，模型是用 `v-if` 控制，需等所有 GLB 預載完成。

### Q：如何新增一個模型到場景？

1. 在主頁面 `Resource.loadResources([...])` 加入新 GLB URL
2. 在 `glbsList.vue` 中：
   ```ts
   const newModel = standardizationMeshCopy(Resource.getItem('new.glb').scene)
   const newOp = { position: {x:0,y:0,z:0}, scale: {x:1,y:1,z:1}, ... }
   syncMeshProp(newModel, newOp, Resource.getItem('new.glb').animations)
   glbsGroup.add(newModel)
   ```

### Q：如何更改攝影機角度？

調整 `TresOrthographicCamera` 的 `:position` 和 `OrbitControls` 的 `:target`，zoom 越大場景越近。

### Q：管線如何反向流動？

將 `flexiblePipe2` 的 `speed` 設為負值即可。

### Q：如何複製整個場景另作他用？

1. 複製 `components/freeRefiningIndustry/` 整個目錄並重新命名
2. 在 `pages/` 新增對應頁面，修改 `tcConfig` 與預載清單
3. `glbsList.vue` 中逐一調整 `position`/`rotation`，`extendMeshes.vue` 中替換或刪除不需要的特效元件
4. `config.js` 更新路由與 meta 資訊

### Q：Bloom 開啟後畫面太亮怎麼辦？

降低 `intensity`（預設 4）或提高 `luminance-threshold`（預設 0.1），讓只有真正高亮的部分才觸發光暈。

### Q：`staticWater` 沒有反射效果？

確認 `TresCanvas` 的 `shadows: true`，並確保場景內有 `TresDirectionalLight`；`metalness` 建議設在 0.8 以上才有明顯鏡面感。

---

## 自組場景速查清單

快速建立類似場景的最小步驟：

- [ ] `tcConfig`：設定背景色、開陰影、選 ToneMapping
- [ ] `TresOrthographicCamera`：設 position / zoom / 動態 heights
- [ ] `Resource.loadResources`：列出所有 GLB URL
- [ ] `glbsList.vue`：`standardizationMeshCopy` → `syncMeshProp` → `group.add`
- [ ] `floor.vue`：地板色、格線色
- [ ] `skylight.vue`：curTime 控制太陽角度
- [ ] `extendMeshes.vue`：按需引入 staticWater / fencePlus / bannerLabel / flexiblePipe2
- [ ] `tresProcessing.vue`：Bloom 閾值調整

---

## 參考資料

| 資源 | 說明 |
|------|------|
| [TVT.js 官網](https://www.icegl.cn/) | 框架文件與插件市集 |
| [線上示範場景](https://zone3deditor.icegl.cn/#/plugins/zone3Deditor/pluginOne?sceneConfig=freeRefiningIndustry) | 低像素煉油廠完整展示 |
| [TresJS 文件](https://tresjs.org/) | Vue 3 + Three.js 核心封裝 |
| [@tresjs/cientos](https://cientos.tresjs.org/) | OrbitControls、useAnimations 等工具集 |
| [Three.js OrthographicCamera](https://threejs.org/docs/#api/en/cameras/OrthographicCamera) | 正交攝影機 API |
