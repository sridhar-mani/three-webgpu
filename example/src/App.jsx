import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import './App.css';
import { OrbitControls, STLLoader } from 'three/examples/jsm/Addons.js';
import WorkerManager from 'three-webgpu-worker';
import workerUrl from 'three-webgpu-worker/dist/workerhyb.js?url';

function App() {
  const normalCanvasRef = useRef(null);
  const workerCanvasRef = useRef(null);
  const initRef = useRef(false);

  const [normalFps, setNormalFps] = useState(0);
  const [workerFps, setWorkerFps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [meshCount, setMeshCount] = useState(0);

  // UI Test States
  const [normalText, setNormalText] = useState('');
  const [workerText, setWorkerText] = useState('');
  const [normalSlider, setNormalSlider] = useState(50);
  const [workerSlider, setWorkerSlider] = useState(50);
  const [normalClicks, setNormalClicks] = useState(0);
  const [workerClicks, setWorkerClicks] = useState(0);

  // Lag detection
  const [normalIsLagging, setNormalIsLagging] = useState(false);
  const [workerIsLagging, setWorkerIsLagging] = useState(false);

  // Input lag measurement
  const [normalInputLag, setNormalInputLag] = useState(0);
  const [workerInputLag, setWorkerInputLag] = useState(0);
  const normalKeyDownTime = useRef(0);
  const workerKeyDownTime = useRef(0);
  const normalLagSamples = useRef([]);
  const workerLagSamples = useRef([]);

  // More instances for visible lag
  const GRID_SIZE = 18;

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let normalAnimId, workerAnimId;

    const setupNormal = async () => {
      if (!normalCanvasRef.current) return;

      const renderer = new THREE.WebGPURenderer({
        canvas: normalCanvasRef.current,
        antialias: true,
      });

      await renderer.init();

      const width = normalCanvasRef.current.clientWidth;
      const height = normalCanvasRef.current.clientHeight;

      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x1a1a2e, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 1, 10000);
      camera.position.set(80, 60, 80);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, normalCanvasRef.current);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.2;

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);
      
      const dirLight2 = new THREE.DirectionalLight(0xef4444, 0.3);
      dirLight2.position.set(-50, -20, -50);
      scene.add(dirLight2);

      const material = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        metalness: 0.4,
        roughness: 0.3,
      });

      try {
        const loader = new STLLoader();
        const geo = await loader.loadAsync('/Menger_sponge_sample.stl');

        geo.center();
        geo.computeBoundingBox();
        const bbox = geo.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const targetSize = 3;
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = targetSize / maxDim;

        const spacing = 5;
        let idx = 0;
        const instanceCount = GRID_SIZE * GRID_SIZE * GRID_SIZE;
        setMeshCount(instanceCount);

        const instancedMesh = new THREE.InstancedMesh(geo, material, instanceCount);

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);

        for (let x = 0; x < GRID_SIZE; x++) {
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
              position.set(
                (x - GRID_SIZE / 2) * spacing,
                (y - GRID_SIZE / 2) * spacing,
                (z - GRID_SIZE / 2) * spacing
              );
              matrix.compose(position, rotation, scale);
              instancedMesh.setMatrixAt(idx, matrix);
              idx++;
            }
          }
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(instancedMesh);

        const gridExtend = (GRID_SIZE * spacing) / 2;
        camera.position.set(gridExtend * 2.5, gridExtend * 2, gridExtend * 2.5);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        setLoading(false);

        let frameCount = 0;
        let lastTime = performance.now();

        function animate() {
          const frameStart = performance.now();
          normalAnimId = requestAnimationFrame(animate);

          controls.update();
          renderer.render(scene, camera);

          const frameEnd = performance.now();
          const frameDuration = frameEnd - frameStart;

          if (frameDuration > 10) {
            setNormalIsLagging(true);
            setTimeout(() => setNormalIsLagging(false), 100);
          }

          frameCount++;
          if (frameCount % 20 === 0) {
            setNormalFps(Math.round(20000 / (frameEnd - lastTime)));
            lastTime = frameEnd;
          }
        }
        animate();
      } catch (err) {
        console.error('Normal setup error:', err);
        setLoading(false);
      }
    };

    const setupWorker = async () => {
      if (!workerCanvasRef.current) return;

      const workerManager = new WorkerManager({
        canvas: workerCanvasRef.current,
      });

      if(import.meta.env.PROD){
        workerManager._workerUrl = workerUrl;
      }

      await workerManager._intializeRendererWorker({
        width: workerCanvasRef.current.clientWidth,
        height: workerCanvasRef.current.clientHeight,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        background: 0x1a1a2e,
      }).then(res => {
        console.log('Worker initialised:', res);
      }).catch(error => {
        console.error('Worker initialization failed:', error);
      });

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        50,
        workerCanvasRef.current.clientWidth / workerCanvasRef.current.clientHeight,
        1,
        10000
      );
      camera.position.set(80, 60, 80);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, workerCanvasRef.current);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.2;

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);
      
      const dirLight2 = new THREE.DirectionalLight(0x10b981, 0.3);
      dirLight2.position.set(-50, -20, -50);
      scene.add(dirLight2);

      const material = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        metalness: 0.4,
        roughness: 0.3,
      });

      try {
        const loader = new STLLoader();
        const geo = await loader.loadAsync('/Menger_sponge_sample.stl');

        geo.center();
        geo.computeBoundingBox();
        const bbox = geo.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const targetSize = 3;
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = targetSize / maxDim;

        const spacing = 5;
        let idx = 0;
        const instanceCount = GRID_SIZE * GRID_SIZE * GRID_SIZE;

        const instancedMesh = new THREE.InstancedMesh(geo, material, instanceCount);

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);

        for (let x = 0; x < GRID_SIZE; x++) {
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
              position.set(
                (x - GRID_SIZE / 2) * spacing,
                (y - GRID_SIZE / 2) * spacing,
                (z - GRID_SIZE / 2) * spacing
              );
              matrix.compose(position, rotation, scale);
              instancedMesh.setMatrixAt(idx, matrix);
              idx++;
            }
          }
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(instancedMesh);

        instancedMesh.userData.instanceMatrices = Array.from(instancedMesh.instanceMatrix.array);

        const gridExtend = (GRID_SIZE * spacing) / 2;
        camera.position.set(gridExtend * 2.5, gridExtend * 2, gridExtend * 2.5);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        await workerManager.loadScene({
          sc: scene,
          cam: camera,
          bgColor: 0x1a1a2e,
        });

        let frameCount = 0;
        let lastTime = performance.now();

        function animate() {
          const frameStart = performance.now();
          workerAnimId = requestAnimationFrame(animate);

          controls.update();
          workerManager.updateCamera(camera);

          const frameEnd = performance.now();
          const frameDuration = frameEnd - frameStart;

          if (frameDuration > 10) {
            setWorkerIsLagging(true);
            setTimeout(() => setWorkerIsLagging(false), 100);
          }

          frameCount++;
          if (frameCount % 20 === 0) {
            setWorkerFps(Math.round(20000 / (frameEnd - lastTime)));
            lastTime = frameEnd;
          }
        }
        animate();
      } catch (err) {
        console.error('Worker setup error:', err);
      }
    };

    setupNormal().catch(console.error);
    setupWorker().catch(console.error);

    return () => {
      if (normalAnimId) cancelAnimationFrame(normalAnimId);
      if (workerAnimId) cancelAnimationFrame(workerAnimId);
    };
  }, []);

  return (
    <div className="app">
      {loading && (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading {meshCount.toLocaleString()} meshes...</p>
        </div>
      )}

      <header className="header">
        <div className="header-content">
          <h1>three-webgpu-worker</h1>
          <p>{meshCount.toLocaleString()} instances • WebGPU rendering comparison</p>
        </div>
      </header>

      <div className="demo-container">
        {/* LEFT SIDE - MAIN THREAD */}
        <div className="demo-side">
          <div className="canvas-area">
            <canvas ref={normalCanvasRef} />
          </div>

          <div className="side-header">
            <div className="badge badge-red">Main Thread</div>
            <div className={`status-light ${normalIsLagging ? 'lagging' : ''}`}></div>
          </div>

          <div className="test-panel">
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">FPS</span>
                <span className="metric-value danger">{normalFps}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Input Lag</span>
                <span className="metric-value danger">{normalInputLag} <span className="metric-unit">ms</span></span>
              </div>
              <div className="metric">
                <span className="metric-label">Clicks</span>
                <span className="metric-value">{normalClicks}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Chars</span>
                <span className="metric-value">{normalText.length}</span>
              </div>
            </div>
            
            <div className="test-row">
              <div className="test-group">
                <label>Type here (measures lag)</label>
                <input
                  type="text"
                  value={normalText}
                  onKeyDown={() => {
                    normalKeyDownTime.current = performance.now();
                  }}
                  onChange={(e) => {
                    const now = performance.now();
                    if (normalKeyDownTime.current > 0) {
                      const lag = now - normalKeyDownTime.current;
                      normalLagSamples.current.push(lag);
                      if (normalLagSamples.current.length > 10) normalLagSamples.current.shift();
                      const avgLag = normalLagSamples.current.reduce((a, b) => a + b, 0) / normalLagSamples.current.length;
                      setNormalInputLag(avgLag.toFixed(1));
                    }
                    setNormalText(e.target.value);
                  }}
                  placeholder="Feel the lag..."
                  className="test-input"
                />
              </div>
            </div>

            <div className="test-row">
              <div className="test-group">
                <label>Drag slider</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={normalSlider}
                    onChange={(e) => setNormalSlider(Number(e.target.value))}
                    className="test-slider"
                  />
                  <span className="slider-value">{normalSlider}</span>
                </div>
              </div>
              <button
                onClick={() => setNormalClicks(c => c + 1)}
                className="test-button"
              >
                +1
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - WEB WORKER */}
        <div className="demo-side">
          <div className="canvas-area">
            <canvas ref={workerCanvasRef} />
          </div>

          <div className="side-header">
            <div className="badge badge-green">Worker Thread</div>
            <div className={`status-light status-light-green ${workerIsLagging ? 'lagging' : ''}`}></div>
          </div>

          <div className="test-panel">
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">FPS</span>
                <span className="metric-value success">{workerFps}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Input Lag</span>
                <span className="metric-value success">{workerInputLag} <span className="metric-unit">ms</span></span>
              </div>
              <div className="metric">
                <span className="metric-label">Clicks</span>
                <span className="metric-value">{workerClicks}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Chars</span>
                <span className="metric-value">{workerText.length}</span>
              </div>
            </div>
            
            <div className="test-row">
              <div className="test-group">
                <label>Type here (measures lag)</label>
                <input
                  type="text"
                  value={workerText}
                  onKeyDown={() => {
                    workerKeyDownTime.current = performance.now();
                  }}
                  onChange={(e) => {
                    const now = performance.now();
                    if (workerKeyDownTime.current > 0) {
                      const lag = now - workerKeyDownTime.current;
                      workerLagSamples.current.push(lag);
                      if (workerLagSamples.current.length > 10) workerLagSamples.current.shift();
                      const avgLag = workerLagSamples.current.reduce((a, b) => a + b, 0) / workerLagSamples.current.length;
                      setWorkerInputLag(avgLag.toFixed(1));
                    }
                    setWorkerText(e.target.value);
                  }}
                  placeholder="Smooth!"
                  className="test-input"
                />
              </div>
            </div>

            <div className="test-row">
              <div className="test-group">
                <label>Drag slider</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={workerSlider}
                    onChange={(e) => setWorkerSlider(Number(e.target.value))}
                    className="test-slider"
                  />
                  <span className="slider-value">{workerSlider}</span>
                </div>
              </div>
              <button
                onClick={() => setWorkerClicks(c => c + 1)}
                className="test-button"
              >
                +1
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;