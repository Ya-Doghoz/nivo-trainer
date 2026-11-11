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

## camera.js  (57 سطر)
- **يصدّر:** `orb`، `setMode`، `snapCam`، `updCam`
- **يستورد:**
  - ./util.js ← V3, clamp, $$, cap
  - ./world.js ← holder
  - ./instrument.js ← * as I
  - ./state.js ← ST
  - ./ctx.js ← cam, cv
  - ./hooks.js ← H

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

## device.js  (87 سطر)
- **يصدّر:** `applyInstType`، `drawReadWin`، `drawIdx`، `updLabels`
- **يستورد:**
  - ./ctx.js ← lblBox, fx, cam
  - ./util.js ← $, $$, openTab, toast, DEG, clamp, V3
  - ./instrument.js ← * as I
  - ./mount.js ← doMount
  - ./camera.js ← orb, setMode
  - ./state.js ← CFG, saveCfg, flags, ST
  - ./errors.js ← applyErr
  - ./targets.js ← setTarget
  - ./transfer.js ← placeInstrument
  - ./books-tt.js ← ttRender
  - ./books-level.js ← fbRender
  - ./hooks.js ← H

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

## errors.js  (38 سطر)
- **يصدّر:** `applyErr`، `lanRefresh`
- **يستورد:**
  - ./util.js ← $, toast
  - ./state.js ← CFG, ST, saveCfg
  - ./instrument.js ← * as I
  - ./targets.js ← setStaffZero
  - ./books-tt.js ← ttRefresh
  - ./world.js ← setVegDensity
  - ./transfer.js ← newWorld

## extras.js  (71 سطر)
- **يستورد:**
  - ./instrument.js ← * as I
  - ./targets.js ← setStaffTilt
  - ./world.js ← wetness, groundH, holder

## help.js  (247 سطر)
- (سكربت عادي بلا وحدات)

## hooks.js  (3 سطر)
- **يصدّر:** `H`

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

## loop.js  (120 سطر)
- **يصدّر:** `step`، `render`، `resize`
- **يستورد:**
  - ./util.js ← $, setTxt, setCl, dms, $$, DEG, wrapPi, clamp
  - ./instrument.js ← * as I
  - ./ctx.js ← isTT, mapOpen, eyeIdeal, scopeCam, fx, jogT, sideLayout, elSheet, elT1, elLegs, cam, scopeEl
  - ./state.js ← flags, ST
  - ./world.js ← holder, updateHolder, scene, renderer
  - ./mount.js ← updLegLabels
  - ./map.js ← drawMap, sizeMap
  - ./pointing.js ← bearingToStaff, setHeading, setVz
  - ./steps.js ← renderSteps
  - ./camera.js ← updCam
  - ./sight.js ← sightInfo, _t
  - ./books-tt.js ← updK
  - ./leveling.js ← drawLevel, drawHead
  - ./device.js ← drawReadWin, drawIdx, updLabels

## main.js  (42 سطر)
- **يستورد:**
  - ./world.js ← setStaffStyle, setQuality, setVegDensity
  - ./instrument.js ← * as I
  - ./util.js ← showErr, toast, say
  - ./state.js ← CFG, ST
  - ./ctx.js ← mapOpen
  - ./transfer.js ← placeInstrument, randSeed, onJobChanged, doNewWorld
  - ./map.js ← HALF
  - ./errors.js ← lanRefresh
  - ./loop.js ← resize, step, render
- **يضيف إلى window.NIVO:** `toast, onJobChanged, placeInstrument | job: () => ST.job, half: () => HALF`

## map.js  (201 سطر)
- **يصدّر:** `HALF`، `sizeMap`، `closeMap`، `drawMap`، `reach`
- **يستورد:**
  - ./util.js ← $, $$, toast, cap, clamp
  - ./ctx.js ← sideLayout, mapBox, mapOpen, isTT
  - ./transfer.js ← newJob, newWorld, randSeed, onJobChanged, placeInstrument
  - ./state.js ← ST
  - ./world.js ← mapImage, riverPath, bridgeList, houseList, instPos, holder, groundH, wetness, sendTo, isWater, inHouse, placeHolderAt
  - ./hooks.js ← H
  - ./instrument.js ← * as I
  - ./job.js ← crd, ptById, setupById, saveState, nextId, trueRL, nextSetup
  - ./books-level.js ← fbRefresh
  - ./books-tt.js ← ttRefresh

## mount.js  (53 سطر)
- **يصدّر:** `updLegLabels`، `updClampUI`، `afterChange`، `doMount`
- **يستورد:**
  - ./util.js ← $$, $, toast, openTab
  - ./leveling.js ← LC
  - ./instrument.js ← * as I
  - ./ctx.js ← scopeEl
  - ./state.js ← ST
  - ./camera.js ← setMode

## pointing.js  (107 سطر)
- **يصدّر:** `setHeading`، `setVz`، `bearingToStaff`
- **يستورد:**
  - ./instrument.js ← * as I
  - ./util.js ← TAU, $, toast, cap, DEG, $$, openTab
  - ./world.js ← holder, instPos
  - ./mount.js ← updClampUI
  - ./ctx.js ← isTT, scopeCam, mapOpen, scopeEl, FOV
  - ./targets.js ← getPrismHeight
  - ./map.js ← reach, closeMap
  - ./state.js ← ST
  - ./hooks.js ← H

## scopefx.js  (72 سطر)
- **يصدّر:** `createScopeFX`
- **يستورد:**
  - three ← * as THREE

## settings-ui.js  (39 سطر)
- **يستورد:**
  - ./util.js ← $, toast
  - ./state.js ← CFG, saveCfg, ST
  - ./device.js ← applyInstType
  - ./world.js ← setStaffStyle, setQuality
  - ./loop.js ← resize
  - ./books-level.js ← fbRender
  - ./books-tt.js ← ttRender
  - ./transfer.js ← newWorld, randSeed, placeInstrument
  - ./instrument.js ← * as I
  - ./mount.js ← doMount

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

## transfer.js  (59 سطر)
- **يصدّر:** `placeInstrument`، `onJobChanged`، `newWorld`، `doNewWorld`، `randSeed`، `newJob`
- **يستورد:**
  - ./instrument.js ← * as I
  - ./world.js ← instPos, faceInstrument, setMarkers, regen, placeHolderAt
  - ./state.js ← CFG, flags, ST, saveCfg
  - ./mount.js ← afterChange
  - ./camera.js ← setMode, snapCam
  - ./util.js ← toast, $, showErr, setTxt
  - ./books-level.js ← fbRender
  - ./books-tt.js ← ttRender
  - ./job.js ← saveState, loadSaved, randomJob
  - ./hooks.js ← H

## tt-tools.js  (22 سطر)
- **يستورد:**
  - ./util.js ← $, toast, TAU, numOrNull
  - ./instrument.js ← * as I
  - ./pointing.js ← setHeading, setVz
  - ./ctx.js ← scopeCam
  - ./targets.js ← setPrismHeight

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
