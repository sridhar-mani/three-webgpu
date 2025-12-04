# three-webgpu-worker

Offload Three.js WebGPU rendering to a Web Worker using OffscreenCanvas.

Your main thread stays responsive for UI, controls, and React — the worker handles all the GPU work.

---

## Why?

Three.js WebGPU is powerful but can block the main thread on heavy scenes. This library moves the entire renderer to a worker, so your app stays smooth even with thousands of objects.

Built to address [Three.js Issue #30560](https://github.com/mrdoob/three.js/issues/30560).

---

## Features

- WebGPU renderer running in a Web Worker
- OffscreenCanvas for worker-based rendering
- Scene and camera sync via JSON serialization
- Camera updates without re-sending the whole scene
- Works with React, vanilla JS, or any framework
- Example app included

---

## Install

```bash
npm install three-webgpu-worker
```

Or for local dev:

```bash
npm run build
cd example
npm install
npm run dev
```

---

## Usage

```jsx
import { WorkerManager } from "three-webgpu-worker";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as THREE from "three/webgpu";
import { useRef, useEffect } from "react";

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const manager = new WorkerManager({ canvas });

    const init = async () => {
      await manager._intializeRendererWorker({
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        pixelRatio: window.devicePixelRatio,
        background: 0x000000
      });

      // build your scene on main thread
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));

      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(10, 10, 10);
      scene.add(light);

      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(5, 5, 5),
        new THREE.MeshStandardMaterial({ color: 0x00ff88 })
      );
      scene.add(cube);

      const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 1, 10000);
      camera.position.set(20, 20, 20);
      camera.lookAt(0, 0, 0);

      // send it to the worker — rendering starts automatically
      await manager.loadScene({ sc: scene, cam: camera, bgColor: 0xffffff });

      // controls run on main thread, just sync the camera
      const controls = new OrbitControls(camera, canvas);

      function animate() {
        requestAnimationFrame(animate);
        controls.update();
        manager.updateCamera(camera);
      }
      animate();
    };

    init();

    return () => manager.stopRenderLoop();
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />;
}
```

---

## API

### WorkerManager

```js
const manager = new WorkerManager({ canvas });
```

| Method | What it does |
|--------|--------------|
| `_intializeRendererWorker(params)` | Start the worker and create the WebGPU renderer |
| `loadScene({ sc, cam, bgColor })` | Send scene + camera to worker, starts render loop |
| `updateCamera(camera)` | Sync camera position/rotation each frame |
| `updateTransform(name, pos, rot, scale)` | Move/rotate/scale an object by name |
| `stopRenderLoop()` | Stop rendering |

### Init params

```js
await manager._intializeRendererWorker({
  width: 800,
  height: 600,
  pixelRatio: 2,
  background: 0x000000,
  antialias: true,
  alpha: false
});
```

---

## How it works

1. Main thread creates a `WorkerManager` and transfers the canvas to a worker via `transferControlToOffscreen()`
2. Worker initializes `WebGPURenderer` on the OffscreenCanvas
3. You build your scene normally on main thread, then call `loadScene()` — scene gets serialized to JSON and sent to worker
4. Worker deserializes with `ObjectLoader` and starts a render loop
5. Each frame, you call `updateCamera()` to sync camera changes

The worker owns the canvas and renderer. Main thread just manages the scene graph and sends updates.

---

## Project structure

```
src/
  index.js              - exports
  MainThreadProxy.js    - WorkerManager class
  WorkerHyb.js          - the actual worker code
  expMethods.js         - allowed renderer methods

example/
  src/App.jsx           - React demo
```

---

## Requirements

- Chrome 113+ or Edge 113+ (WebGPU support)
- WebGPU flag enabled: `chrome://flags/#enable-unsafe-webgpu`

---

## Troubleshooting

**Black screen?**  
Check if worker logs show `Worker: rendering frame 0`. If yes, camera is probably pointing the wrong way. If no, WebGPU didn't init.

**Grey/dark materials?**  
High `metalness` without an environment map looks dark. Try `metalness: 0.3`.

**"materialLib[type] is not a constructor"?**  
`ObjectLoader` doesn't support Node Materials. Stick to `MeshStandardMaterial`, `MeshPhysicalMaterial`, etc.

---

## License

MIT
