# واجهات الوحدات (مولَّد آلياً — لا تعدّله يدوياً)

لتحديثه: `node tools/gen-api.js`

## books-level.js  (141 سطر)
- **يصدّر:** `fbRender`، `fbRefresh`
- **يستورد:**
  - ./util.js ← $, f3, numOrNull, toast, say
  - ./state.js ← ST, CFG, flags
  - ./job.js ← ptById, trueRL, saveState
  - ./world.js ← holder
  - ./instrument.js ← * as I

## books-tt.js  (192 سطر)
- **يصدّر:** `ttRender`، `ttRefresh`، `updK`
- **يستورد:**
  - ./util.js ← DEG, $, dms, TAU, wrapPi, numOrNull, f3, toast, say, setTxt
  - ./instrument.js ← * as I
  - ./state.js ← ST, CFG, flags
  - ./job.js ← setupById, ptById, zOf, crd, saveState
  - ./survey-math.js ← * as SM
  - ./world.js ← holder

## ctx.js  (18 سطر)
- **يصدّر:** `FOV`، `cam`، `scopeCam`، `cv`، `elSheet`، `sideLayout`، `isTT`، `eyeIdeal`، `mapOpen`
- **يستورد:**
  - three ← * as THREE
  - ./util.js ← $
  - ./scopefx.js ← createScopeFX
  - ./world.js ← renderer
  - ./instrument.js ← * as I

## custom.js  (35 سطر)
- **يستورد:**
  - three ← * as THREE
  - /three/examples/jsm/loaders/GLTFLoader.js ← GLTFLoader
  - ./instrument.js ← * as I

## drone-config.js  (85 سطر)
- **يصدّر:** `DEF`، `SOUND_KEYS`، `PAY`، `payloadMass`، `hasPart`، `DC`، `soundCfg`، `setCfg`، `resetCfg`، `buildCfg`

## drone-sound.js  (443 سطر)
- (سكربت عادي بلا وحدات)

## drone-worklet.js  (468 سطر)
- (سكربت عادي بلا وحدات)

## drone.js  (356 سطر)
- **يصدّر:** `droneRender`، `openDrone`، `exitDrone`
- **يستورد:**
  - three ← * as THREE
  - ./world.js ← renderer, scene, instPos, groundH, isWater, riverInfo, houseCollide
  - ./instrument.js ← * as I
  - ./drone-config.js ← DC, soundCfg, payloadMass, PAY, buildCfg
- **يضيف إلى window.NIVO:** `droneActive: () => D.on, droneRender, openDrone, exitDrone, drone: { pos: () => (D.on && D.armed ? { x: D.x, y: D.y, z: D.z`

## extras.js  (71 سطر)
- **يستورد:**
  - ./instrument.js ← * as I
  - ./targets.js ← setStaffTilt
  - ./world.js ← wetness, groundH, holder

## help.js  (247 سطر)
- (سكربت عادي بلا وحدات)

## instrument.js  (536 سطر)
- **يصدّر:** `R`، `TYPES`، `type`، `TY`، `SCREWS`، `LEGA`، `ERR`، `setErrors`، `errArc`، `staffZero`، `edmErr`، `errReport`، `st`، `headTiltDeg`، `rigPos`، `parts`، `partsFor`، `custom`، `getTilt`، `indexBubble`، `update`، `scopePose`، `readings`، `setType`، `setRig`، `setHeight`، `setLeg`، `setLegLock`، `setExplode`، `setMounted`، `setClamp`، `nudgeIdx`، `turnScrew`، `levelLegsNow`، `levelScrewsNow`، `mount`، `quickMount`، `quickLevel`، `reset`
- **يستورد:**
  - three ← * as THREE
  - ./world.js ← scene, groundH, mulberry32, renderer

## job.js  (51 سطر)
- **يصدّر:** `ptById`، `setupById`، `trueRL`، `zOf`، `crd`، `nextId`، `nextSetup`، `saveState`، `loadSaved`، `randomJob`
- **يستورد:**
  - ./state.js ← ST
  - ./world.js ← groundH, mulberry32, isWater, houseList, inHouse, riverInfo, dryNear

## leveling.js  (94 سطر)
- **يصدّر:** `LC`، `drawLevel`، `drawHead`
- **يستورد:**
  - ./util.js ← $, clamp, cap, wrapPi, TAU, toast, $$
  - ./instrument.js ← * as I
  - ./state.js ← ST

## logbook.js  (208 سطر)
- **يستورد:**
  - ./instrument.js ← * as I
  - ./world.js ← holder, instPos, mapImage
- **يضيف إلى window.NIVO:** `logbook: { event: ev, open`

## main.js  (727 سطر)
- **يستورد:**
  - ./world.js ← renderer, scene, holder, instPos, sendTo, placeHolderAt, faceInstrument, updateHolder, groundH, setStaffStyle, setQuality, regen, mapImage, setMarkers, setVegDensity, isWater, inHouse, wetness, riverPath, houseList, bridgeList
  - ./instrument.js ← * as I
  - ./targets.js ← setTarget, setPrismHeight, getPrismHeight, setStaffZero
  - ./util.js ← $, $$, clamp, V3, DEG, TAU, wrapPi, cap, numOrNull, dms, showErr, toast, openTab, setTxt, setCl, say
  - ./state.js ← CFG, saveCfg, ST, flags
  - ./steps.js ← renderSteps
  - ./job.js ← saveState, loadSaved, randomJob, crd, ptById, setupById, nextId, trueRL, nextSetup
  - ./books-level.js ← fbRender, fbRefresh
  - ./books-tt.js ← ttRender, ttRefresh, updK
  - ./ctx.js ← cam, cv, elSheet, scopeEl, lblBox, fx, sideLayout, mapBox, mapOpen, isTT, scopeCam, FOV, eyeIdeal, jogT, elT1, elLegs
  - ./sight.js ← sightInfo, _t
  - ./leveling.js ← LC, drawLevel, drawHead
- **يضيف إلى window.NIVO:** `toast, onJobChanged, placeInstrument | job: () => ST.job, half: () => HALF`

## scopefx.js  (72 سطر)
- **يصدّر:** `createScopeFX`
- **يستورد:**
  - three ← * as THREE

## sight.js  (36 سطر)
- **يصدّر:** `rc`، `sightInfo`
- **يستورد:**
  - three ← * as THREE
  - ./util.js ← V3, clamp
  - ./instrument.js ← * as I
  - ./world.js ← holder
  - ./ctx.js ← scopeCam
  - ./targets.js ← prismFace, getPrismHeight

## state.js  (31 سطر)
- **يصدّر:** `CFG`، `saveCfg`، `ST`، `flags`

## steps.js  (59 سطر)
- **يصدّر:** `renderSteps`
- **يستورد:**
  - ./instrument.js ← * as I
  - ./state.js ← ST, flags
  - ./util.js ← $

## survey-math.js  (41 سطر)
- **يصدّر:** `DEG`، `wrapPi`، `dms`، `zenith`، `elev`، `azimuth`، `coords`، `kTheory`، `levelHI`، `levelRL`، `leanErr`، `curvRef`، `stadiaClassic`، `stadiaReduced`، `totalStation`، `twoFace`

## tabs.js  (11 سطر)
- **يستورد:**
  - ./util.js ← $$, $
  - ./ctx.js ← elSheet

## targets.js  (46 سطر)
- **يصدّر:** `prismFace`، `setPrismHeight`، `getPrismHeight`، `setTarget`، `setStaffZero`، `setStaffTilt`، `getStaffTilt`
- **يستورد:**
  - three ← * as THREE
  - ./world.js ← holder

## util.js  (24 سطر)
- **يصدّر:** `$`، `clamp`، `V3`، `wrapPi`، `cap`، `numOrNull`، `f3`، `dms`، `showErr`، `toast`، `openTab`، `setTxt`، `setCl`، `say`
- **يستورد:**
  - three ← * as THREE
  - ./survey-math.js ← * as SM

## world-config.js  (30 سطر)
- **يصدّر:** `WDEF`، `WC`

## world.js  (822 سطر)
- **يصدّر:** `renderer`، `setQuality`، `scene`، `mulberry32`، `cylBetween`، `P`، `roadX`، `riverInfo`، `setWorldQuality`، `groundH`، `bridgeInfo`، `bridgeList`، `isWater`، `wetness`، `inHouse`، `houseList`، `houseCollide`، `riverPath`، `dryNear`، `regen`، `vegK`، `setVegDensity`، `clearVeg`، `mapImage`، `setMarkers`، `instPos`، `holder`، `setStaffStyle`، `faceInstrument`، `placeHolderAt`، `sendTo`، `updateHolder`
- **يستورد:**
  - three ← * as THREE
