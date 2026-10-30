# واجهات الوحدات (مولَّد آلياً — لا تعدّله يدوياً)

لتحديثه: `node tools/gen-api.js`

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

## logbook.js  (208 سطر)
- **يستورد:**
  - ./instrument.js ← * as I
  - ./world.js ← holder, instPos, mapImage
- **يضيف إلى window.NIVO:** `logbook: { event: ev, open`

## main.js  (1306 سطر)
- **يستورد:**
  - three ← * as THREE
  - ./world.js ← renderer, scene, holder, instPos, sendTo, placeHolderAt, faceInstrument, updateHolder, groundH, setStaffStyle, setQuality, regen, mapImage, setMarkers, mulberry32, setVegDensity, isWater, inHouse, wetness, riverPath, houseList, bridgeInfo, bridgeList, dryNear, riverInfo
  - ./instrument.js ← * as I
  - ./survey-math.js ← * as SM
  - ./scopefx.js ← createScopeFX
  - ./targets.js ← prismFace, setTarget, setPrismHeight, getPrismHeight, setStaffZero
  - ./util.js ← $, $$, clamp, V3, DEG, TAU, wrapPi, cap, numOrNull, f3, dms, showErr, toast, openTab, setTxt, setCl
  - ./state.js ← CFG, saveCfg, ST
- **يضيف إلى window.NIVO:** `toast, onJobChanged, placeInstrument | job: () => ST.job, half: () => HALF`

## scopefx.js  (72 سطر)
- **يصدّر:** `createScopeFX`
- **يستورد:**
  - three ← * as THREE

## state.js  (29 سطر)
- **يصدّر:** `CFG`، `saveCfg`، `ST`

## survey-math.js  (41 سطر)
- **يصدّر:** `DEG`، `wrapPi`، `dms`، `zenith`، `elev`، `azimuth`، `coords`، `kTheory`، `levelHI`، `levelRL`، `leanErr`، `curvRef`، `stadiaClassic`، `stadiaReduced`، `totalStation`، `twoFace`

## targets.js  (46 سطر)
- **يصدّر:** `prismFace`، `setPrismHeight`، `getPrismHeight`، `setTarget`، `setStaffZero`، `setStaffTilt`، `getStaffTilt`
- **يستورد:**
  - three ← * as THREE
  - ./world.js ← holder

## util.js  (22 سطر)
- **يصدّر:** `$`، `clamp`، `V3`، `wrapPi`، `cap`، `numOrNull`، `f3`، `dms`، `showErr`، `toast`، `openTab`، `setTxt`، `setCl`
- **يستورد:**
  - three ← * as THREE
  - ./survey-math.js ← * as SM

## world-config.js  (30 سطر)
- **يصدّر:** `WDEF`، `WC`

## world.js  (812 سطر)
- **يصدّر:** `renderer`، `setQuality`، `scene`، `mulberry32`، `cylBetween`، `P`، `roadX`، `riverInfo`، `setWorldQuality`، `groundH`، `bridgeInfo`، `bridgeList`، `isWater`، `wetness`، `inHouse`، `houseList`، `houseCollide`، `riverPath`، `dryNear`، `regen`، `vegK`، `setVegDensity`، `clearVeg`، `mapImage`، `setMarkers`، `instPos`، `holder`، `setStaffStyle`، `faceInstrument`، `placeHolderAt`، `sendTo`، `updateHolder`
- **يستورد:**
  - three ← * as THREE
