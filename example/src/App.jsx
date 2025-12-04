import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import './App.css';
import { OrbitControls, STLLoader } from 'three/examples/jsm/Addons.js';
import WorkerManager from 'three-webgpu-worker';

function App() {
  const normalCanvasRef = useRef(null);
  const workerCanvasRef = useRef(null);
  const initRef = useRef(false);

  const [normalFps, setNormalFps] = useState(0);
  const [workerFps, setWorkerFps] = useState(0);
  const [normalCpu, setNormalCpu] = useState(0);
  const [workerCpu, setWorkerCpu] = useState(0);
  const [loading, setLoading] = useState(true);
  const [meshCount, setMeshCount] = useState(0);

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
      renderer.setClearColor(0xf5f5f5, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 1, 10000);
      camera.position.set(80, 60, 80);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, normalCanvasRef.current);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);
      
      const dirLight2 = new THREE.DirectionalLight(0x4466ff, 0.3);
      dirLight2.position.set(-50, -20, -50);
      scene.add(dirLight2);

      const material = new THREE.MeshStandardMaterial({
        color: 0xe74c3c,
        metalness: 0.4,
        roughness: 0.3,
      });

      const wireframeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
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

        const gridSize = 14;
        const spacing = 5;
        let idx = 0;
        const instanceCount = gridSize * gridSize * gridSize;
        setMeshCount(instanceCount);

        const instancedMesh = new THREE.InstancedMesh(geo, material, instanceCount);
        const instancedWireframe = new THREE.InstancedMesh(geo, wireframeMat, instanceCount);

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);

        for (let x = 0; x < gridSize; x++) {
          for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
              position.set(
                (x - gridSize / 2) * spacing,
                (y - gridSize / 2) * spacing,
                (z - gridSize / 2) * spacing
              );
              matrix.compose(position, rotation, scale);
              instancedMesh.setMatrixAt(idx, matrix);
              instancedWireframe.setMatrixAt(idx, matrix);
              idx++;
            }
          }
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedWireframe.instanceMatrix.needsUpdate = true;

        scene.add(instancedMesh);
        scene.add(instancedWireframe);

        const gridExtend = (gridSize * spacing) / 2;
        camera.position.set(gridExtend * 2.5, gridExtend * 2, gridExtend * 2.5);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        setLoading(false);

        let frameCount = 0;
        let lastTime = performance.now();
        let cpuTimes = [];

        function animate() {
          const frameStart = performance.now();
          normalAnimId = requestAnimationFrame(animate);

          controls.update();
          renderer.render(scene, camera);

          const frameEnd = performance.now();
          cpuTimes.push(frameEnd - frameStart);
          if (cpuTimes.length > 30) cpuTimes.shift();

          frameCount++;
          if (frameCount % 20 === 0) {
            const avgCpu = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
            setNormalCpu(avgCpu.toFixed(1));
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

      await workerManager._intializeRendererWorker({
        width: workerCanvasRef.current.clientWidth,
        height: workerCanvasRef.current.clientHeight,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        background: 0xf5f5f5,
      }).then(res=>{
        console.log('Worker initialised:',res);
      }).catch(error => {
    console.error('Worker initialization failed:', error);
    console.error('Error stack:', error.stack);
  });;

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
      controls.autoRotateSpeed = 0.5;

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);
      
      const dirLight2 = new THREE.DirectionalLight(0x4466ff, 0.3);
      dirLight2.position.set(-50, -20, -50);
      scene.add(dirLight2);

      const material = new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        metalness: 0.4,
        roughness: 0.3,
      });

      const wireframeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
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

        const gridSize = 14;
        const spacing = 5;
        let idx = 0;
        const instanceCount = gridSize * gridSize * gridSize;

        const instancedMesh = new THREE.InstancedMesh(geo, material, instanceCount);
        const instancedWireframe = new THREE.InstancedMesh(geo, wireframeMat, instanceCount);

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);

        for (let x = 0; x < gridSize; x++) {
          for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
              position.set(
                (x - gridSize / 2) * spacing,
                (y - gridSize / 2) * spacing,
                (z - gridSize / 2) * spacing
              );
              matrix.compose(position, rotation, scale);
              instancedMesh.setMatrixAt(idx, matrix);
              instancedWireframe.setMatrixAt(idx, matrix);
              idx++;
            }
          }
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedWireframe.instanceMatrix.needsUpdate = true;

        scene.add(instancedMesh);
        scene.add(instancedWireframe);

        instancedMesh.userData.instanceMatrices = Array.from(instancedMesh.instanceMatrix.array);
        instancedWireframe.userData.instanceMatrices = Array.from(instancedWireframe.instanceMatrix.array);

        const gridExtend = (gridSize * spacing) / 2;
        camera.position.set(gridExtend * 2.5, gridExtend * 2, gridExtend * 2.5);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        await workerManager.loadScene({
          sc: scene,
          cam: camera,
          bgColor: 0xf5f5f5,
        });

        let frameCount = 0;
        let lastTime = performance.now();
        let cpuTimes = [];

        function animate() {
          const frameStart = performance.now();
          workerAnimId = requestAnimationFrame(animate);

          controls.update();
          workerManager.updateCamera(camera);

          const frameEnd = performance.now();
          cpuTimes.push(frameEnd - frameStart);
          if (cpuTimes.length > 30) cpuTimes.shift();

          frameCount++;
          if (frameCount % 20 === 0) {
            const avgCpu = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
            setWorkerCpu(avgCpu.toFixed(1));
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
    <div className="app-container">
      {loading && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <span>Loading {meshCount.toLocaleString()} instances...</span>
        </div>
      )}

      <div className="canvas-container">
        <div className="canvas-wrapper">
          <canvas ref={normalCanvasRef} />
          <div className="label label-left">
            <span className="label-tag red">MAIN THREAD</span>
            <div className="stats">
              <div className="stat-row">
                <span className="stat-label">FPS</span>
                <span className="stat-value">{normalFps}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">CPU</span>
                <span className="stat-value red">{normalCpu}ms</span>
              </div>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="canvas-wrapper">
          <canvas ref={workerCanvasRef} />
          <div className="label label-right">
            <span className="label-tag green">WEB WORKER</span>
            <div className="stats">
              <div className="stat-row">
                <span className="stat-label">FPS</span>
                <span className="stat-value">{workerFps}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">CPU</span>
                <span className="stat-value green">{workerCpu}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="info-section">
          <h1>three-webgpu-worker</h1>
          <p>{meshCount.toLocaleString()} Menger Sponges • WebGPU • OffscreenCanvas</p>
        </div>
        <div className="comparison">
          <div className="comparison-item">
            <span className="dot red"></span>
            <span>Main thread blocks UI during render</span>
          </div>
          <div className="comparison-item">
            <span className="dot green"></span>
            <span>Worker keeps UI responsive</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;