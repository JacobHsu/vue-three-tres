# 真實水面模擬教學 (realWater)

> 目標：從零開始在空白 Vue 3 + TresJS 專案中，重現 [realWater Demo](https://jacobhsu.github.io/vue-three-tres/#/plugins/water/realWater) 的互動水面效果，並理解背後原理。

---

## 目錄

1. [前置知識：讀這篇前你需要知道的事](#前置知識讀這篇前你需要知道的事)
2. [效果說明](#效果說明)
3. [原理概覽](#原理概覽)
4. [技術架構圖](#技術架構圖)
5. [環境準備](#環境準備)
6. [Step 1：建立 Vue 3 + TresJS 專案](#step-1建立-vue-3--tresjs-專案)
7. [Step 2：水面模擬核心（GPU 波紋）](#step-2水面模擬核心gpu-波紋)
8. [Step 3：焦散光效（Caustics）](#step-3焦散光效caustics)
9. [Step 4：泳池牆壁（Pool）](#step-4泳池牆壁pool)
10. [Step 5：水面網格（Water Surface）](#step-5水面網格water-surface)
11. [Step 6：組合所有元件](#step-6組合所有元件)
12. [Step 7：UI 控制（Tweakpane）](#step-7ui-控制tweakpane)
13. [原理深度解析](#原理深度解析)
14. [常見問題](#常見問題)

---

## 前置知識：讀這篇前你需要知道的事


### 1. Three.js 是什麼？

Three.js 是一個讓你在瀏覽器裡畫 3D 的 JS 函式庫。你可以把它想成：

```
瀏覽器原生 WebGL（非常底層，要寫幾百行才能畫一個三角形）
         ↓ Three.js 包裝成更好用的 API
你只需要描述「放一顆球在哪裡、什麼顏色」
```

**TresJS** 則是把 Three.js 再包成 Vue 元件的框架，讓你用 `<TresMesh>` 這樣的寫法操作 3D 物件。

---

### 2. GPU 是什麼？它和 CPU 有什麼不同？

| | CPU | GPU |
|--|-----|-----|
| 核心數 | 少（4～16 核） | 多（數千核） |
| 擅長 | 複雜邏輯、一次一件事 | 同時做幾千件「一樣的事」 |
| 舉例 | 你的 JS 程式碼 | 同時計算畫面上每一個像素的顏色 |

這個水面範例的波紋計算，每幀要更新 256×256 = 65536 個點的高度，用 CPU 做很慢，改用 GPU 同時算就很快。

---

### 3. Shader（著色器）是什麼？

Shader 就是**跑在 GPU 上的程式**，用 GLSL 語言寫。你可以把它想成：

```js
// 你平常寫的 JS（跑在 CPU，一次處理一件事）
pixels.forEach(pixel => {
  pixel.color = computeColor(pixel)
})

// Shader 的概念（跑在 GPU，同時處理所有像素）
// 你只需要寫「一個像素怎麼算」，GPU 自動對全部像素執行
void main() {
  gl_FragColor = computeColor(coord); // 這個像素的顏色
}
```

有兩種 Shader：

| 種類 | 執行時機 | 負責什麼 |
|------|---------|---------|
| **Vertex Shader**（頂點著色器）| 每個頂點執行一次 | 決定頂點在螢幕上的位置 |
| **Fragment Shader**（片段著色器）| 每個像素執行一次 | 決定這個像素的顏色 |

---

### 4. `.glsl` 檔是什麼？

就是存 Shader 程式碼的文字檔，副檔名 `.glsl`。

```
你的 JS 檔  →  import 進來當字串  →  丟給 Three.js 的 ShaderMaterial
```

瀏覽器本身不認識 `.glsl`，所以需要 **`vite-plugin-glsl`** 在打包時把它轉成字串：

```ts
// vite.config.ts 加上這個 plugin
import glsl from 'vite-plugin-glsl'

// 之後就能這樣用
import myShader from './water.frag.glsl'
// myShader 就是一個普通的 JS 字串，內容是 GLSL 程式碼
```

---

### 5. WebGLRenderTarget（離屏渲染）是什麼？

通常你渲染出來的畫面會直接顯示在 `<canvas>` 上。但 `WebGLRenderTarget` 讓你把渲染結果**存成一張紋理（Texture）**，不顯示，留著下一步用。

```
一般渲染：  Three.js → 顯示在畫面上
離屏渲染：  Three.js → 存成紋理 → 給下一個 Shader 當輸入
```

這個水面範例用離屏渲染的地方：
- **波紋模擬** → 結果存成高度圖紋理
- **焦散計算** → 結果存成焦散紋理
- 最後才把這兩張紋理傳給水面 Shader，顯示在畫面上

---

### 6. Uniform 是什麼？

Uniform 是從 JS 傳資料給 Shader 的方式，一旦傳進去這一幀所有像素都共用同一個值：

```ts
// JS 端（CPU）設定
material.uniforms['light'].value = [1.0, 1.0, 0.0]

// Shader 端（GPU）接收
uniform vec3 light; // 聲明接收
void main() {
  // 直接用 light 變數
}
```

類比：Shader 的 `uniform` ≈ Vue 元件的 `props`，只是跨越 CPU → GPU 的邊界。

---

### 7. 架構圖中的 `[Shader]` 是什麼意思？

```
waterSimulation.vue
    ├── [Shader] drop_fragment.glsl      ← 這個
```

架構圖裡標 `[Shader]` 的，表示那是一個 `.glsl` 檔，不是 Vue 元件。它被 `waterSimulation.vue` 用 `import` 載入，再傳給 `RawShaderMaterial` 使用：

```ts
// waterSimulation.vue 裡
import dropFragmentShader from '../../shaders/simulation/drop_fragment.glsl'

const dropMaterial = new THREE.RawShaderMaterial({
  fragmentShader: dropFragmentShader, // ← 就是這樣用的
})
```

---

### 8. 這個範例的資料流總覽

用 JS 思維理解整個系統：

```
每一幀（requestAnimationFrame）執行：

1. GPU 計算波紋
   input:  上一幀的高度圖（紋理 A）
   output: 新的高度圖（紋理 B）← 存在 WebGLRenderTarget，不顯示

2. GPU 計算焦散
   input:  步驟 1 的高度圖 + 法向量
   output: 焦散光斑紋理 ← 存在 WebGLRenderTarget，不顯示

3. GPU 最終渲染
   input:  高度圖 + 焦散紋理 + 磁磚紋理 + 天空盒
   output: 顯示在畫面上的游泳池畫面
```

---

看完以上概念，就可以繼續往下讀了。

---

## 效果說明

這個範例模擬了一個充水游泳池，具備：

- **GPU 驅動的波紋物理**：點擊按鈕或移動滑鼠都能在水面製造真實的波形擴散
- **焦散光效**：光線穿過水面折射，在泳池底部產生明暗閃爍光斑
- **反射/折射**：水面同時顯示天空盒反射與水底透視
- **即時互動**：每幀都在 GPU 上計算，效能佳

---

## 原理概覽

整個系統分為 **三個 GPU 渲染通道**，每幀依序執行：

```
[1] 水面模擬 (Simulation Pass)
    ├── Drop Pass   → 在指定位置加入一滴水（改變高度圖）
    ├── Update Pass → 用波動方程更新全部頂點高度與速度
    └── Normal Pass → 由高度差計算法向量

        ↓ 輸出：高度圖 + 法向量紋理 (WebGLRenderTarget)

[2] 焦散通道 (Caustics Pass)
    └── 根據水面法向量，模擬光線折射落點密度
    
        ↓ 輸出：焦散紋理 (WebGLRenderTarget)

[3] 最終渲染 (Final Render)
    ├── 正面：水底視角（含焦散光斑）
    └── 背面：水上視角（含反射天空盒 + 折射水底）
```

---

## 技術架構圖

```
realWater.vue (場景入口)
└── waterSimulation.vue (核心：管理模擬 + 暴露 addDrop/mouseEvent)
    ├── [Shader] drop_fragment.glsl      ← 加水滴
    ├── [Shader] update_fragment.glsl    ← 波動更新
    ├── [Shader] normal_fragment.glsl    ← 法向量計算
    └── caustics.vue (焦散)
        ├── [Shader] caustics/vertex.glsl
        ├── [Shader] caustics/fragment.glsl
        └── water.vue (水面網格)
            ├── [Shader] water/vertex.glsl
            ├── [Shader] water/fragment.glsl
            └── pool.vue (泳池牆壁)
                ├── [Shader] pool/vertex.glsl
                └── [Shader] pool/fragment.glsl
```

---

## 環境準備

| 套件 | 版本 | 用途 |
|------|------|------|
| vue | ^3.5 | 框架 |
| three | ^0.180 | WebGL 核心 |
| @tresjs/core | ^5.2 | Vue 3 的 Three.js 整合 |
| @tresjs/cientos | ^5.2 | 提供 OrbitControls 等工具元件 |
| tweakpane | ^4 | UI 控制面板 |
| lodash | ^4 | throttle 節流 |
| vite-plugin-glsl | ^1.5 | 讓 Vite 直接 import .glsl 檔 |

---

## Step 1：建立 Vue 3 + TresJS 專案

這個範例和參考專案一樣，使用 **FesJS** 框架。FesJS 是基於 Vite 的整合框架，用 `.fes.js` 取代 `vite.config.ts`。

### 1-1 安裝 FesJS 並建立專案

```bash
npm create @fesjs/fes@latest my-water-demo
cd my-water-demo
```

建立時選擇模板：選 `pc`（桌面應用）即可。

### 1-2 安裝套件

```bash
npm install three @tresjs/core @tresjs/cientos tweakpane lodash
npm install -D vite-plugin-glsl @types/three @types/lodash
```

### 1-3 設定 `.fes.js`

專案根目錄的 `.fes.js` 是 FesJS 的主設定檔（等同於其他專案的 `vite.config.ts`）。加入 `vite-plugin-glsl` 和 TresJS 的 Vue 編譯選項：

```js
// .fes.js
import { defineBuildConfig } from '@fesjs/fes'
import { templateCompilerOptions } from '@tresjs/core'
import glsl from 'vite-plugin-glsl'

export default defineBuildConfig({
  // 讓 Vue 編譯器認識 TresJS 的自訂元件（如 <TresMesh>）
  viteVuePlugin: {
    template: {
      compilerOptions: {
        isCustomElement: templateCompilerOptions.template.compilerOptions.isCustomElement,
      },
    },
  },
  viteOption: {
    plugins: [
      glsl(), // 讓 Vite 能 import .glsl 檔
    ],
  },
})
```

> **為什麼需要 `templateCompilerOptions`？**
> TresJS 的元件名稱（`<TresMesh>`、`<TresCanvas>` 等）不是原生 HTML 標籤，Vue 編譯器預設會警告。這個設定告訴編譯器「這些是合法的自訂元素，不要報錯」。

### 1-4 啟動開發伺服器

```bash
npm run dev
```

FesJS 預設在 `http://localhost:8080` 啟動。

---

## Step 2：水面模擬核心（GPU 波紋）

這是整個系統的心臟。它使用 **Ping-Pong 渲染**：交替使用兩個 `WebGLRenderTarget`（TextureA / TextureB），每幀將上一幀的結果當輸入，輸出到另一個，避免讀寫衝突。

### 關鍵資料結構

紋理的 RGBA 四個通道各有意義：

| 通道 | 意義 |
|------|------|
| R | 頂點高度（height） |
| G | 頂點速度（velocity） |
| B | 法向量 X 分量 |
| A | 法向量 Z 分量 |

### 建立 Shader：`shaders/simulation/vertex.glsl`

```glsl
attribute vec3 position;
varying vec2 coord;

void main() {
  coord = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position, 1.0);
}
```

> 這個頂點 Shader 很簡單：把 [-1,1] 的頂點座標轉換成 [0,1] 的 UV 座標，傳給 Fragment Shader。

### 建立 Shader：`shaders/simulation/drop_fragment.glsl`

```glsl
precision highp float;
const float PI = 3.141592653589793;
uniform sampler2D texture;
uniform vec2 center;   // 水滴落點（-1 到 1 的座標空間）
uniform float radius;  // 水滴影響半徑
uniform float strength;// 正數 = 向上凸起，負數 = 向下凹陷
varying vec2 coord;

void main() {
  vec4 info = texture2D(texture, coord);
  float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
  drop = 0.5 - cos(drop * PI) * 0.5; // 用 cosine 讓邊緣平滑
  info.r += drop * strength;          // 修改高度通道
  gl_FragColor = info;
}
```

> **原理**：計算目前像素到水滴中心的距離，越近越強，用 cosine 曲線讓邊緣柔和。

### 建立 Shader：`shaders/simulation/update_fragment.glsl`

```glsl
precision highp float;
uniform sampler2D texture;
uniform vec2 delta; // [1/256, 1/256]
varying vec2 coord;

void main() {
  vec4 info = texture2D(texture, coord);
  
  vec2 dx = vec2(delta.x, 0.0);
  vec2 dy = vec2(0.0, delta.y);
  
  // 計算四個鄰居的平均高度
  float average = (
    texture2D(texture, coord - dx).r +
    texture2D(texture, coord - dy).r +
    texture2D(texture, coord + dx).r +
    texture2D(texture, coord + dy).r
  ) * 0.25;
  
  info.g += (average - info.r) * 2.0; // 速度朝平均值加速
  info.g *= 0.995;                     // 衰減（模擬能量損失）
  info.r += info.g;                    // 高度 += 速度
  
  gl_FragColor = info;
}
```

> **原理**：這是離散化的 **波動方程（Wave Equation）**。每個像素的速度受到周圍像素高度的影響，0.995 衰減模擬水的阻尼，讓波浪最終平靜下來。

### 建立 Shader：`shaders/simulation/normal_fragment.glsl`

```glsl
precision highp float;
uniform sampler2D texture;
uniform vec2 delta;
varying vec2 coord;

void main() {
  vec4 info = texture2D(texture, coord);
  
  vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);
  vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);
  info.ba = normalize(cross(dy, dx)).xz; // 法向量存入 BA 通道
  
  gl_FragColor = info;
}
```

> **原理**：用相鄰像素高度差計算切向量，cross product 得到法向量。這個法向量之後會用來做光線折射與反射計算。

### 建立元件：`components/waterSimulation.vue`

```vue
<template>
  <caustics :lightFrontGeometry="_geometry" :waterTexture="texture.texture" :light="light" />
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { ref } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import { throttle } from 'lodash'
import vertexShader from '../shaders/simulation/vertex.glsl'
import dropFragmentShader from '../shaders/simulation/drop_fragment.glsl'
import normalFragmentShader from '../shaders/simulation/normal_fragment.glsl'
import updateFragmentShader from '../shaders/simulation/update_fragment.glsl'
import caustics from './caustics.vue'

const props = defineProps<{ light: Array<number> }>()

// Ping-Pong 雙緩衝區
const _camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 2000)
const _geometry = new THREE.PlaneGeometry(2, 2)
const _textureA = new THREE.WebGLRenderTarget(256, 256, { type: THREE.FloatType })
const _textureB = new THREE.WebGLRenderTarget(256, 256, { type: THREE.FloatType })

// 三個 Shader Pass 的材質
const dropMaterial = new THREE.RawShaderMaterial({
  uniforms: {
    center: { value: [0, 0] },
    radius: { value: 0 },
    strength: { value: 0 },
    texture: { value: null },
  },
  vertexShader,
  fragmentShader: dropFragmentShader,
})

const normalMaterial = new THREE.RawShaderMaterial({
  uniforms: {
    delta: { value: [1 / 256, 1 / 256] },
    texture: { value: null },
  },
  vertexShader,
  fragmentShader: normalFragmentShader,
})

const updateMaterial = new THREE.RawShaderMaterial({
  uniforms: {
    delta: { value: [1 / 256, 1 / 256] },
    texture: { value: null },
  },
  vertexShader,
  fragmentShader: updateFragmentShader,
})

const _dropMesh = new THREE.Mesh(_geometry, dropMaterial)
const _normalMesh = new THREE.Mesh(_geometry, normalMaterial)
const _updateMesh = new THREE.Mesh(_geometry, updateMaterial)

// Ping-Pong 交換邏輯
let texture = _textureA
const _render = (renderer: any, mesh: any) => {
  const oldTexture = texture
  const newTexture = texture === _textureA ? _textureB : _textureA
  mesh.material.uniforms.texture.value = oldTexture.texture
  renderer.setRenderTarget(newTexture)
  renderer.render(mesh, _camera)
  texture = newTexture
}

const { renderer, camera } = useTres() as any
renderer.autoClear = false

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  _render(renderer, _updateMesh) // 更新波動
  _render(renderer, _normalMesh) // 更新法向量
})

// 外部呼叫：加入水滴
const addDrop = (x: number, y: number, radius: number, strength: number) => {
  dropMaterial.uniforms['center'].value = [x, y]
  dropMaterial.uniforms['radius'].value = radius
  dropMaterial.uniforms['strength'].value = strength
  _render(renderer, _dropMesh)
}

// 外部呼叫：開關滑鼠波紋
const mouse = new THREE.Vector2()
const raycaster = ref(new THREE.Raycaster())
const targetGeometry = new THREE.PlaneGeometry(2, 2)
// 將水平面旋轉：PlaneGeometry 預設是 XY 平面，需要轉成 XZ 平面
const position = targetGeometry.attributes.position
for (let i = 0; i < position.count; i++) {
  const z = -position.getY(i)
  position.setY(i, 0)
  position.setZ(i, z)
}
position.needsUpdate = true
const targetMesh = new THREE.Mesh(targetGeometry)

const onMouseMove = (event: MouseEvent) => {
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) * 2) / rect.width - 1
  mouse.y = (-(event.clientY - rect.top) * 2) / rect.height + 1
  raycaster.value.setFromCamera(mouse, camera.value)
  const intersects = raycaster.value.intersectObject(targetMesh)
  for (const intersect of intersects) {
    addDrop(intersect.point.x, intersect.point.z, 0.03, 0.04)
  }
}

const mouseEvent = (isOn: boolean) => {
  if (isOn) {
    renderer.domElement.addEventListener('mousemove', throttle(onMouseMove, 30))
  } else {
    renderer.domElement.removeEventListener('mousemove', onMouseMove)
  }
}

defineExpose({ addDrop, mouseEvent })
</script>
```

---

## Step 3：焦散光效（Caustics）

焦散（Caustics）是光線穿過水面折射後，在底部形成明暗變化的光斑效果。

**原理**：把水面網格的頂點沿著折射後的光線方向「投影」到底部，三角形面積越小代表光越集中，越亮。

### `shaders/caustics/vertex.glsl`

```glsl
precision highp float;
attribute vec3 position;
uniform sampler2D water;
uniform vec3 light; // 光線方向

varying vec3 oldPos; // 折射前的位置
varying vec3 newPos; // 折射後投影位置
varying vec3 ray;

// 工具函式（折射計算）
const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

void main() {
  vec4 info = texture2D(water, position.xy * 0.5 + 0.5);
  
  // 從高度圖取出法向量
  vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);
  
  // 水面頂點位置（含水面高低起伏）
  vec3 pos = vec3(position.x, position.y + info.r, position.z); // 注意 XZ 平面
  
  // 計算折射光線
  vec3 refractedLight = refract(normalize(-light), normal, IOR_AIR / IOR_WATER);
  
  ray = refractedLight;
  oldPos = pos;
  
  // 找折射光線打到底部（y = -1）的點
  float t = (-1.0 - pos.y) / refractedLight.y;
  newPos = pos + refractedLight * t;
  
  gl_Position = vec4(newPos.xz, 0.0, 1.0);
}
```

### `shaders/caustics/fragment.glsl`

```glsl
precision highp float;
varying vec3 oldPos;
varying vec3 newPos;

void main() {
  float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
  float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
  // 面積變小 → 光線聚焦 → 更亮
  gl_FragColor = vec4(oldArea / newArea * 0.2, 1.0, 0.0, 0.0);
}
```

### `components/caustics.vue`

```vue
<template>
  <Suspense>
    <water :waterTexture="waterTexture" :causticsTexture="texture.texture" :light="light" :geometry="_geometry" />
  </Suspense>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { useLoop, useTres } from '@tresjs/core'
import vertexShader from '../shaders/caustics/vertex.glsl'
import fragmentShader from '../shaders/caustics/fragment.glsl'
import water from './water.vue'

const props = defineProps<{
  lightFrontGeometry: THREE.BufferGeometry
  waterTexture: THREE.Texture
  light: Array<number>
}>()

const _camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 2000)
const _geometry = new THREE.PlaneGeometry(2, 2, 200, 200) // 高解析度水面
const texture = new THREE.WebGLRenderTarget(1024, 1024)

const material = new THREE.ShaderMaterial({
  uniforms: {
    light: { value: props.light },
    water: { value: null },
  },
  vertexShader,
  fragmentShader,
})

const _causticMesh = new THREE.Mesh(_geometry, material)
const black = new THREE.Color('black')
const { renderer } = useTres()

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  material.uniforms['water'].value = props.waterTexture
  renderer.setRenderTarget(texture)
  renderer.setClearColor(black, 0)
  renderer.clear()
  renderer.render(_causticMesh, _camera)
})
</script>
```

---

## Step 4：泳池牆壁（Pool）

泳池是一個正方體，顯示水底磁磚紋理與焦散光斑。

### `components/pool.vue`

```vue
<template></template>

<script lang="ts" setup>
import * as THREE from 'three'
import { useTres, useLoop } from '@tresjs/core'
import vertexShader from '../shaders/pool/vertex.glsl'
import fragmentShader from '../shaders/pool/fragment.glsl'

const props = defineProps<{
  waterTexture: THREE.Texture
  causticsTexture: THREE.Texture
  tiles: THREE.Texture
  light: Array<number>
}>()

// 手動定義一個正方體（只有底部和四面，沒有頂蓋）
const _geometry = new THREE.BufferGeometry()
const vertices = new Float32Array([
  // 底面
  -1, -1, -1,  -1, -1,  1,  -1,  1, -1,  -1,  1,  1,
   1, -1, -1,   1,  1, -1,   1, -1,  1,   1,  1,  1,
  // 四面（略）
  -1, -1, -1,   1, -1, -1,  -1, -1,  1,   1, -1,  1,
  -1,  1, -1,  -1,  1,  1,   1,  1, -1,   1,  1,  1,
  -1, -1, -1,  -1,  1, -1,   1, -1, -1,   1,  1, -1,
  -1, -1,  1,   1, -1,  1,  -1,  1,  1,   1,  1,  1,
])
const indices = new Uint32Array([
  0, 1, 2,  2, 1, 3,
  4, 5, 6,  6, 5, 7,
  12, 13, 14, 14, 13, 15,
  16, 17, 18, 18, 17, 19,
  20, 21, 22, 22, 21, 23,
])
_geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
_geometry.setIndex(new THREE.BufferAttribute(indices, 1))

const _material = new THREE.RawShaderMaterial({
  uniforms: {
    light: { value: props.light },
    tiles: { value: props.tiles },
    water: { value: null },
    causticTex: { value: null },
  },
  vertexShader,
  fragmentShader,
  side: THREE.FrontSide,
})

const _mesh = new THREE.Mesh(_geometry, _material)
const { renderer, camera } = useTres() as any

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  _material.uniforms['water'].value = props.waterTexture
  _material.uniforms['causticTex'].value = props.causticsTexture
  renderer.render(_mesh, camera.value)
}, -1) // 優先度 -1，確保最先渲染
</script>
```

---

## Step 5：水面網格（Water Surface）

水面同時從兩個角度渲染：水下看（正面），水上看（背面）。

### `components/water.vue`

```vue
<template>
  <pool :tiles="tilesTexture" :light="light" :waterTexture="waterTexture" :causticsTexture="causticsTexture" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import * as THREE from 'three'
import { useLoop, useTres } from '@tresjs/core'
import vertexShader from '../shaders/water/vertex.glsl'
import fragmentShader from '../shaders/water/fragment.glsl'
import pool from './pool.vue'

const props = defineProps<{
  waterTexture: THREE.Texture
  causticsTexture: THREE.Texture
  geometry: THREE.BufferGeometry
  light: Array<number>
}>()

// 載入磁磚紋理
const textureLoader = new THREE.TextureLoader()
const tilesTexture = textureLoader.load('/images/tiles.jpg')

// 載入天空盒（反射用）
// 六張圖從公開 CDN 載入，不需要自備圖檔
// 檔名固定：pos-x / neg-x / pos-y / neg-y / pos-z / neg-z 代表正方體六個面
const cubetextureloader = new THREE.CubeTextureLoader()
const textureCube = cubetextureloader
  .setPath('https://opensource.cdn.icegl.cn/images/skyBox/6jpg/')
  .load(['pos-x.jpg', 'neg-x.jpg', 'pos-y.jpg', 'neg-y.jpg', 'pos-z.jpg', 'neg-z.jpg'])

const material = new THREE.RawShaderMaterial({
  uniforms: {
    light: { value: props.light },
    tiles: { value: tilesTexture },
    sky: { value: textureCube },
    water: { value: null },
    causticTex: { value: null },
    underwater: { value: false },
  },
  vertexShader,
  fragmentShader,
})

const mesh = new THREE.Mesh(props.geometry, material)
const white = new THREE.Color('white')
const { renderer, camera } = useTres() as any

const { onRender } = useLoop()
onRender(() => {
  renderer.setRenderTarget(null)
  renderer.setClearColor(white, 1)
  renderer.clear()

  material.uniforms['water'].value = props.waterTexture
  material.uniforms['causticTex'].value = props.causticsTexture

  // 水下視角（正面）
  material.side = THREE.FrontSide
  material.uniforms['underwater'].value = true
  renderer.render(mesh, camera.value)

  // 水面視角（背面）
  material.side = THREE.BackSide
  material.uniforms['underwater'].value = false
  renderer.render(mesh, camera.value)
})
</script>
```

---

## Step 6：組合所有元件

### `pages/realWater.vue`（場景入口）

```vue
<template>
  <TresCanvas v-bind="state">
    <TresPerspectiveCamera :position="[0.426, 0.677, -2.095]" :fov="75" :near="0.01" :far="1000" />
    <OrbitControls />
    <waterSimulation :light="light" ref="waterSimulationRef" />
  </TresCanvas>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { Pane } from 'tweakpane'
import waterSimulation from '../components/waterSimulation.vue'

const state = reactive({
  alpha: true,
  antialias: true,
  windowSize: true,
  clearAlpha: 0,
  renderMode: 'manual', // 手動控制渲染，避免 TresJS 自動 clear 打亂順序
})

// 光線方向（單位向量，斜向照射）
const light = [0.7559289460184544, 0.7559289460184544, -0.3779644730092272]

const waterSimulationRef = ref<any>(null)
</script>
```

---

## Step 7：UI 控制（Tweakpane）

在 `realWater.vue` 的 `<script setup>` 中加入：

```ts
const paneControl = new Pane()

// 按鈕：隨機加入 10 個水滴
paneControl
  .addButton({ label: '點擊按鈕', title: '隨機增加波紋' })
  .on('click', () => {
    for (let i = 0; i < 10; i++) {
      waterSimulationRef.value.addDrop(
        Math.random() * 2 - 1, // x: -1 到 1
        Math.random() * 2 - 1, // y: -1 到 1
        0.03,                   // 半徑
        i & 1 ? 0.02 : -0.02   // 交替凸起/凹陷
      )
    }
  })

// 開關：滑鼠產生波紋
const mouseE = ref(false)
paneControl
  .addBinding(mouseE, 'value', { label: '滑鼠波紋' })
  .on('change', (e: any) => {
    waterSimulationRef.value.mouseEvent(e.value)
  })
```

---

## 原理深度解析

### 為何使用 `renderMode: 'manual'`？

TresJS 預設每幀自動 clear 畫面，但我們的系統需要精確控制渲染順序（先畫泳池、再畫水面）。`manual` 模式讓我們自己在 `onRender` / `onBeforeRender` 中控制。

### Ping-Pong 渲染是什麼？

GPU 無法在讀取一張紋理的同時寫入它（讀寫衝突）。Ping-Pong 方案使用兩張紋理輪流：
- 奇數幀：讀 A，寫 B
- 偶數幀：讀 B，寫 A

每幀結束後 `texture` 變數指向最新結果，供下游 Pass 使用。

### `WebGLRenderTarget` 的 `FloatType` 有什麼用？

預設紋理精度是 8-bit（0～255），不夠存儲精確的高度和速度。`FloatType` 讓每個通道有 32-bit 浮點精度，波紋計算才不會因精度不足而快速衰減或產生鋸齒。

### `renderMode: 'manual'` 搭配 `renderer.autoClear = false`

設定 `autoClear = false` 讓 renderer 不會在每次 render call 前自動清空畫面，這樣我們才能分兩次渲染水面（正面 + 背面）而不互相干擾。

### 光線方向的選擇

```ts
const light = [0.7559289460184544, 0.7559289460184544, -0.3779644730092272]
```

這是一個單位向量（長度 = 1），表示光從右上方斜射入水。你可以調整這三個值改變光線角度，但記得要保持總長度為 1（`Math.sqrt(x²+y²+z²) === 1`）。

---

## 常見問題

### Q: 畫面全黑或只有白色

- 確認 `renderMode: 'manual'` 已設定
- 確認 `renderer.autoClear = false` 已設定
- 確認渲染順序：pool → water surface（pool 必須先畫）

### Q: 波紋出現後立刻消失

- 確認 `_textureA` 和 `_textureB` 的 `type` 是 `THREE.FloatType`
- 確認 Ping-Pong 交換邏輯正確（`texture` 指向最新的那張）

### Q: 焦散光效不顯示

- 確認 `causticTex` uniform 有被正確更新
- 確認 pool shader 中有用到 `causticTex`

### Q: 滑鼠互動沒有波紋

- 確認 `targetMesh` 的頂點已旋轉（Y→Z）
- 確認 raycaster 的 intersect 結果使用了 `point.x` 和 `point.z`（不是 `point.y`）

### Q: 效能不好，畫面掉幀

- 模擬解析度降低：把 `256` 改成 `128`（`_textureA / _textureB` 的尺寸）
- 焦散解析度降低：把 `1024` 改成 `512`
- 水面網格精細度降低：`PlaneGeometry(2, 2, 200, 200)` 改成 `(2, 2, 100, 100)`
- 滑鼠事件節流時間增加：`throttle(onMouseMove, 30)` 改成 `throttle(onMouseMove, 60)`

---

## 完整專案結構參考

```
src/
├── pages/
│   └── realWater.vue          ← 場景入口
├── components/
│   ├── waterSimulation.vue    ← 核心：波紋 + 暴露 API
│   ├── caustics.vue           ← 焦散渲染
│   ├── water.vue              ← 水面網格
│   └── pool.vue               ← 泳池牆壁
└── shaders/
    ├── simulation/
    │   ├── vertex.glsl
    │   ├── drop_fragment.glsl
    │   ├── update_fragment.glsl
    │   └── normal_fragment.glsl
    ├── caustics/
    │   ├── vertex.glsl
    │   └── fragment.glsl
    ├── water/
    │   ├── vertex.glsl
    │   └── fragment.glsl
    └── pool/
        ├── vertex.glsl
        └── fragment.glsl
```

---

> 這個範例的靈感與 Shader 設計來自 Evan Wallace 的 [WebGL Water](https://madebyevan.com/webgl-water/) 專案（MIT License），透過 TresJS 重新整合進 Vue 3 生態。
