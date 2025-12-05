import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { OrbitControls, STLLoader } from "three/examples/jsm/Addons.js";
import WorkerManager from "three-webgpu-worker";
import "./App.css";

const GRID = 14;
const HISTORY_LEN = 60;

async function createScene(geometry, color) {
  const scene = new THREE.Scene();

  const material = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.3,
    roughness: 0.4,
    vertexColors: true,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, GRID ** 3);

  // Explicitly create instanceColor attribute
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(GRID ** 3 * 3),
    3
  );

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  let i = 0;
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      for (let z = 0; z < GRID; z++) {
        dummy.position.set(
          (x - GRID / 2) * 6,
          (y - GRID / 2) * 6,
          (z - GRID / 2) * 6
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.setHSL(Math.random(), 0.7, 0.5));
        i++;
      }
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(50, 50, 50);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x4488ff, 0.3);
  dirLight2.position.set(-50, -20, -50);
  scene.add(dirLight2);

  return { scene, mesh, count: GRID ** 3 };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [stress, setStress] = useState(false);
  const [objectCount, setObjectCount] = useState(0);
  const [mainFps, setMainFps] = useState(0);
  const [workerFps, setWorkerFps] = useState(0);
  const [mainLag, setMainLag] = useState(0);
  const [workerLag, setWorkerLag] = useState(0);
  const [mainHistory, setMainHistory] = useState(() =>
    Array(HISTORY_LEN).fill(16)
  );
  const [workerHistory, setWorkerHistory] = useState(() =>
    Array(HISTORY_LEN).fill(16)
  );

  const mainCanvasRef = useRef(null);
  const workerCanvasRef = useRef(null);
  const mainSceneRef = useRef(null);
  const workerManagerRef = useRef(null);
  const workerCameraRef = useRef(null);
  const workerControlsRef = useRef(null);
  const geometryRef = useRef(null);
  const keyTimeRef = useRef({ main: 0, worker: 0 });
  const mainRendererRef = useRef(null);
  const mainCameraRef = useRef(null);
  const mainControlsRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let animId = null;

    async function init() {
      if (!mainCanvasRef.current || !workerCanvasRef.current) return;

      const w = Math.floor(window.innerWidth / 2);
      const h = window.innerHeight - 48;
      const pixelRatio = Math.min(window.devicePixelRatio, 2);

      const loader = new STLLoader();
      const geometry = await loader.loadAsync("/Menger_sponge_sample.stl");
      if (!mounted) return;

      geometry.center();
      geometry.computeVertexNormals();
      geometryRef.current = geometry;

      const { scene: mainScene, count: c1 } = await createScene(
        geometry,
        0xdc2626
      );
      if (!mounted) return;

      mainSceneRef.current = mainScene;

      const mainCamera = new THREE.PerspectiveCamera(50, w / h, 1, 10000);
      mainCamera.position.set(80, 60, 80);
      mainCameraRef.current = mainCamera;

      const mainRenderer = new THREE.WebGPURenderer({
        canvas: mainCanvasRef.current,
        antialias: true,
      });
      mainRenderer.setSize(w, h);
      mainRenderer.setPixelRatio(pixelRatio);
      mainRenderer.setClearColor(0xf5f5f5, 1);
      await mainRenderer.init();
      if (!mounted) return;

      mainRendererRef.current = mainRenderer;

      const mainControls = new OrbitControls(mainCamera, mainCanvasRef.current);
      mainControls.enableDamping = true;
      mainControls.dampingFactor = 0.05;
      mainControls.enablePan = false;
      mainControls.autoRotate = true;
      mainControls.autoRotateSpeed = 1.0;
      mainControlsRef.current = mainControls;

      const { scene: workerScene } = await createScene(geometry, 0x10b981);
      if (!mounted) return;

      const workerManager = new WorkerManager({
        canvas: workerCanvasRef.current,
      });
      workerManagerRef.current = workerManager;

      await workerManager._intializeRendererWorker({
        width: w,
        height: h,
        pixelRatio: pixelRatio,
        background: 0xf5f5f5,
        antialias: true,
      });
      if (!mounted) return;

      const workerCamera = new THREE.PerspectiveCamera(50, w / h, 1, 10000);
      workerCamera.position.set(80, 60, 80);
      workerCameraRef.current = workerCamera;

      await workerManager.loadScene({
        sc: workerScene,
        cam: workerCamera,
        bgColor: 0xf5f5f5,
      });
      if (!mounted) return;

      const workerControls = new OrbitControls(
        workerCamera,
        workerCanvasRef.current
      );
      workerControls.enableDamping = true;
      workerControls.dampingFactor = 0.05;
      workerControls.enablePan = false;
      workerControls.autoRotate = true;
      workerControls.autoRotateSpeed = 1.0;
      workerControlsRef.current = workerControls;

      setObjectCount(c1 * 2);
      setLoading(false);

      let lastMain = performance.now();
      let frameCount = 0;
      let lastFpsTime = performance.now();
      let workerFrameCount = 0;
      let lastWorkerFpsTime = performance.now();

      function loop() {
        if (!mounted) return;

        const now = performance.now();
        const dt = now - lastMain;
        lastMain = now;

        frameCount++;
        if (now - lastFpsTime >= 1000) {
          setMainFps(frameCount);
          frameCount = 0;
          lastFpsTime = now;
        }

        workerFrameCount++;
        if (now - lastWorkerFpsTime >= 1000) {
          setWorkerFps(workerFrameCount);
          workerFrameCount = 0;
          lastWorkerFpsTime = now;
        }

        setMainHistory((prev) => [...prev.slice(1), dt]);
        setWorkerHistory((prev) => [...prev.slice(1), dt]);

        mainControls.update();
        workerControls.update();
        workerManager.updateCamera(workerCamera);

        mainRenderer.render(mainScene, mainCamera);
        animId = requestAnimationFrame(loop);
      }
      loop();

      const onResize = () => {
        const nw = Math.floor(window.innerWidth / 2);
        const nh = window.innerHeight - 48;
        mainCamera.aspect = nw / nh;
        mainCamera.updateProjectionMatrix();
        mainRenderer.setSize(nw, nh);
        workerCamera.aspect = nw / nh;
        workerCamera.updateProjectionMatrix();
        workerManager.setSize(nw, nh);
      };
      window.addEventListener("resize", onResize);
    }

    init();

    return () => {
      mounted = false;
      if (animId) cancelAnimationFrame(animId);
      mainRendererRef.current?.dispose();
      workerManagerRef.current?.stopRenderLoop();
    };
  }, []);

  useEffect(() => {
    if (!stress || !mainSceneRef.current || !geometryRef.current) return;

    const interval = setInterval(async () => {
      const geo = geometryRef.current;
      const count = 200;
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();

      const mainMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        metalness: 0.3,
        roughness: 0.4,
        vertexColors: true,
      });
      const mainMesh = new THREE.InstancedMesh(geo, mainMat, count);

      // Explicitly create instanceColor attribute
      mainMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(count * 3),
        3
      );

      for (let i = 0; i < count; i++) {
        dummy.position.set(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        );
        dummy.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        dummy.updateMatrix();
        mainMesh.setMatrixAt(i, dummy.matrix);
        mainMesh.setColorAt(i, color.setHSL(Math.random(), 0.7, 0.5));
      }

      mainMesh.instanceMatrix.needsUpdate = true;
      mainMesh.instanceColor.needsUpdate = true;
      mainSceneRef.current.add(mainMesh);

      if (workerManagerRef.current) {
        const workerMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          metalness: 0.3,
          roughness: 0.4,
          vertexColors: true,
        });
        const workerMesh = new THREE.InstancedMesh(geo, workerMat, count);

        // Explicitly create instanceColor attribute
        workerMesh.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(count * 3),
          3
        );

        for (let i = 0; i < count; i++) {
          dummy.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
          );
          dummy.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          );
          dummy.updateMatrix();
          workerMesh.setMatrixAt(i, dummy.matrix);
          workerMesh.setColorAt(i, color.setHSL(Math.random(), 0.7, 0.5));
        }

        workerMesh.instanceMatrix.needsUpdate = true;
        workerMesh.instanceColor.needsUpdate = true;

        try {
          await workerManagerRef.current.addObj(workerMesh);
        } catch (err) {
          console.error("Failed to add object to worker:", err);
        }
      }

      setObjectCount((prev) => prev + count * 2);
    }, 500);

    return () => clearInterval(interval);
  }, [stress]);

  const addObjects = async (n) => {
    if (!geometryRef.current) return;
    const geo = geometryRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    if (mainSceneRef.current) {
      const mainMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        metalness: 0.3,
        roughness: 0.4,
        vertexColors: true,
      });
      const mainMesh = new THREE.InstancedMesh(geo, mainMat, n);

      // Explicitly create instanceColor attribute
      mainMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(n * 3),
        3
      );

      for (let i = 0; i < n; i++) {
        dummy.position.set(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        );
        dummy.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        dummy.updateMatrix();
        mainMesh.setMatrixAt(i, dummy.matrix);
        mainMesh.setColorAt(i, color.setHSL(Math.random(), 0.7, 0.5));
      }

      mainMesh.instanceMatrix.needsUpdate = true;
      mainMesh.instanceColor.needsUpdate = true;
      mainSceneRef.current.add(mainMesh);
    }

    if (workerManagerRef.current) {
      const workerMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        metalness: 0.3,
        roughness: 0.4,
        vertexColors: true,
      });
      const workerMesh = new THREE.InstancedMesh(geo, workerMat, n);

      // Explicitly create instanceColor attribute
      workerMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(n * 3),
        3
      );

      for (let i = 0; i < n; i++) {
        dummy.position.set(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        );
        dummy.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        dummy.updateMatrix();
        workerMesh.setMatrixAt(i, dummy.matrix);
        workerMesh.setColorAt(i, color.setHSL(Math.random(), 0.7, 0.5));
      }

      workerMesh.instanceMatrix.needsUpdate = true;
      workerMesh.instanceColor.needsUpdate = true;

      console.log(
        "Calling workerManager.addObj with mesh:",
        workerMesh.type,
        "count:",
        n
      );

      try {
        await workerManagerRef.current.addObj(workerMesh);
        console.log("Successfully added object to worker");
      } catch (err) {
        console.error("Failed to add object to worker:", err);
      }
    }

    setObjectCount((prev) => prev + n * 2);
  };

  const handleKeyDown = (side) => () => {
    keyTimeRef.current[side] = performance.now();
  };

  const handleChange = (side) => () => {
    const start = keyTimeRef.current[side];
    if (start) {
      const lag = performance.now() - start;
      if (side === "main") setMainLag(Math.round(lag));
      else setWorkerLag(Math.round(lag));
    }
  };

  const getBarColor = (ms) => {
    if (ms < 17) return "#10b981";
    if (ms < 33) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="app">
      {loading && (
        <div className="loading">
          <div className="spinner" />
        </div>
      )}

      <div className="toolbar">
        <div className="brand">Three.js WebGPU Worker Demo</div>
        <div className="controls">
          <button onClick={() => addObjects(500)}>+500</button>
          <button onClick={() => addObjects(1000)}>+1K</button>
          <button onClick={() => addObjects(2000)}>+2K</button>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={stress}
            onChange={(e) => setStress(e.target.checked)}
          />
          Auto Stress
        </label>
        <div className="count">{objectCount.toLocaleString()} objects</div>
      </div>

      <div className="panels">
        <div className="panel">
          <div className="panel-label red">Main Thread</div>
          <div className="stats">
            <div className="stat">
              <span className={`val ${mainFps < 30 ? "red" : "green"}`}>
                {mainFps}
              </span>
              <span className="label">FPS</span>
            </div>
            <div className="stat">
              <span className={`val ${mainLag > 50 ? "red" : "green"}`}>
                {mainLag}
              </span>
              <span className="label">Input ms</span>
            </div>
          </div>
          <canvas ref={mainCanvasRef} />
          <div className="frame-graph">
            {mainHistory.map((ms, i) => (
              <div
                key={i}
                className="bar"
                style={{
                  height: `${Math.min((ms / 50) * 100, 100)}%`,
                  background: getBarColor(ms),
                }}
              />
            ))}
          </div>
          <div className="inputs">
            <input
              type="text"
              placeholder="Type here..."
              onKeyDown={handleKeyDown("main")}
              onChange={handleChange("main")}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-label green">Worker Thread</div>
          <div className="stats">
            <div className="stat">
              <span className={`val ${workerFps < 30 ? "red" : "green"}`}>
                {workerFps}
              </span>
              <span className="label">FPS</span>
            </div>
            <div className="stat">
              <span className={`val ${workerLag > 50 ? "red" : "green"}`}>
                {workerLag}
              </span>
              <span className="label">Input ms</span>
            </div>
          </div>
          <canvas ref={workerCanvasRef} />
          <div className="frame-graph">
            {workerHistory.map((ms, i) => (
              <div
                key={i}
                className="bar"
                style={{
                  height: `${Math.min((ms / 50) * 100, 100)}%`,
                  background: getBarColor(ms),
                }}
              />
            ))}
          </div>
          <div className="inputs">
            <input
              type="text"
              placeholder="Type here..."
              onKeyDown={handleKeyDown("worker")}
              onChange={handleChange("worker")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
