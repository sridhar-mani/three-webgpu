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

  const [testInput, setTestInput] = useState('');
  const [sliderValue, setSliderValue] = useState(50);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let normalAnimId, workerAnimId;

    // ============================================
    // NORMAL THREE.JS (LEFT)
    // ============================================
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
      renderer.setClearColor(0x0f0f1a, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 1, 10000);
      camera.position.set(30, 25, 30);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, normalCanvasRef.current);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false;

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);

      const material = new THREE.MeshStandardMaterial({
        color: 0xff4455,
        metalness: 0.7,
        roughness: 0.3,
      });

      const wireframeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
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

        const gridSize = 14; // 16×16×16 = 4,096 instances
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

        const gridExtend = (gridSize * spacing) / 2;
        camera.position.set(gridExtend * 1.5, gridExtend * 1.2, gridExtend * 1.5);
        camera.lookAt(0, 0, 0);

        setLoading(false);

        // Performance tracking
        let frameCount = 0;
        let lastTime = performance.now();
        let cpuTimes = [];

        function animate() {
          const frameStart = performance.now();
          normalAnimId = requestAnimationFrame(animate);

          controls.update();
          renderer.render(scene, camera);

          const frameEnd = performance.now();
          const cpuTime = frameEnd - frameStart;
          cpuTimes.push(cpuTime);
          if (cpuTimes.length > 30) cpuTimes.shift();

          frameCount++;
          if (frameCount % 20 === 0) {
            const avgCpu = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
            setNormalCpu(avgCpu.toFixed(1));
            
            const fps = Math.round(20000 / (frameEnd - lastTime));
            setNormalFps(fps);
            lastTime = frameEnd;
          }
        }
        animate();
      } catch (err) {
        console.error('Normal setup error:', err);
        setLoading(false);
      }
    };

    // ============================================
    // WORKER THREE.JS (RIGHT)
    // ============================================
    const setupWorker = async () => {
      if (!workerCanvasRef.current) return;

      const workerManager = new WorkerManager({
        canvas: workerCanvasRef.current,
      });

      await workerManager._intializeRendererWorker({
        width: workerCanvasRef.current.clientWidth,
        height: workerCanvasRef.current.clientHeight,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        background: 0x0f0f1a,
      });

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        40,
        workerCanvasRef.current.clientWidth / workerCanvasRef.current.clientHeight,
        1,
        10000
      );
      camera.position.set(30, 25, 30);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, workerCanvasRef.current);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enablePan = false;

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);

      const material = new THREE.MeshStandardMaterial({
        color: 0x44ff88,
        metalness: 0.7,
        roughness: 0.3,
      });

      const wireframeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
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

        const gridSize = 14; // 16×16×16 = 4,096 instances
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
        camera.position.set(gridExtend * 1.5, gridExtend * 1.2, gridExtend * 1.5);
        camera.lookAt(0, 0, 0);

        await workerManager.loadScene({
          sc: scene,
          cam: camera,
          bgColor: 0x0f0f1a,
        });

        // Performance tracking
        let frameCount = 0;
        let lastTime = performance.now();
        let cpuTimes = [];

        function animate() {
          const frameStart = performance.now();
          workerAnimId = requestAnimationFrame(animate);

          controls.update();
          workerManager.updateCamera(camera);

          const frameEnd = performance.now();
          const cpuTime = frameEnd - frameStart;
          cpuTimes.push(cpuTime);
          if (cpuTimes.length > 30) cpuTimes.shift();

          frameCount++;
          if (frameCount % 20 === 0) {
            const avgCpu = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
            setWorkerCpu(avgCpu.toFixed(1));
            
            const fps = Math.round(20000 / (frameEnd - lastTime));
            setWorkerFps(fps);
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
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Simple Header */}
      <div style={{
        background: '#15151f',
        borderBottom: '1px solid #25252f',
        padding: '12px 20px'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '16px', 
          fontWeight: '600',
          color: '#e0e0e0' 
        }}>
          WebGPU Worker Performance Demo
        </h1>
        <p style={{ 
          margin: '4px 0 0 0', 
          fontSize: '13px', 
          color: '#808080'
        }}>
          4,096 Menger Sponge instances (16×16×16 grid)
        </p>
      </div>

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          zIndex: 1000
        }}>
          Loading scene...
        </div>
      )}

      {/* Main Canvas Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        gap: '1px',
        background: '#000',
        overflow: 'hidden'
      }}>
        {/* LEFT */}
        <div style={{ flex: 1, position: 'relative', background: '#0f0f1a' }}>
          <canvas
            ref={normalCanvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          
          {/* Stats Overlay */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 68, 85, 0.3)',
            minWidth: '140px'
          }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#ff4455',
              fontWeight: '600',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Normal Thread
            </div>
            <div style={{ fontSize: '12px', color: '#d0d0d0', marginBottom: '3px' }}>
              FPS: <span style={{ color: '#ffffff', fontWeight: '500' }}>{normalFps}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#d0d0d0' }}>
              Main CPU: <span style={{ color: '#ff4455', fontWeight: '500' }}>{normalCpu}ms</span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1, position: 'relative', background: '#0f0f1a' }}>
          <canvas
            ref={workerCanvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          
          {/* Stats Overlay */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(68, 255, 136, 0.3)',
            minWidth: '140px'
          }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#44ff88',
              fontWeight: '600',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Web Worker
            </div>
            <div style={{ fontSize: '12px', color: '#d0d0d0', marginBottom: '3px' }}>
              FPS: <span style={{ color: '#ffffff', fontWeight: '500' }}>{workerFps}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#d0d0d0' }}>
              Main CPU: <span style={{ color: '#44ff88', fontWeight: '500' }}>{workerCpu}ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{
        background: '#15151f',
        borderTop: '1px solid #25252f',
        padding: '16px 20px'
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '16px',
          alignItems: 'end'
        }}>
          {/* Input */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '12px', 
              color: '#909090',
              fontWeight: '500'
            }}>
              Test Input
            </label>
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Type here to test responsiveness..."
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                background: '#0f0f1a',
                border: '1px solid #2a2a3a',
                borderRadius: '4px',
                color: '#e0e0e0',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#4a4a5a'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a3a'}
            />
          </div>

          {/* Slider */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '12px', 
              color: '#909090',
              fontWeight: '500'
            }}>
              Test Slider: {sliderValue}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => setSliderValue(e.target.value)}
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                outline: 'none',
                background: '#2a2a3a',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Info */}
          <div style={{
            fontSize: '12px',
            color: '#909090',
            lineHeight: '1.5'
          }}>
            The left side may lag when you interact.<br/>
            Notice how the right stays smooth.
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;