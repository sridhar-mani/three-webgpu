import { useEffect, useRef } from 'react'
import * as THREE from 'three/webgpu'
import './App.css'
import { OrbitControls, STLLoader } from 'three/examples/jsm/Addons.js';
import WorkerManager from 'three-webgpu-worker';

function App() {
  const canvasRef = useRef(null);
  const initRef = useRef(false);
 

  useEffect(()=>{     
         const threejsObs = {
    renderer: null,
    cam:null,
    sc:null,
    workerManager:null
  }
       if (initRef.current) return;

    if(!canvasRef.current) return 
    initRef.current = true;

      threejsObs.workerManager = new WorkerManager({canvas:canvasRef.current});
   
    let animatId;


    const ani =async ()=>{
    const result = await threejsObs.workerManager._intializeRendererWorker({
            width: canvasRef.current.clientWidth,
        height: canvasRef.current.clientHeight,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
    })

    console.log(result)

    
    
    threejsObs.sc = new THREE.Scene();
  threejsObs.cam = new THREE.PerspectiveCamera(40, canvasRef.current.clientWidth/canvasRef.current.clientHeight, 1,10000);
    threejsObs.cam.position.set(20,20,20)
    threejsObs.cam.lookAt(0, 0, 0)


    const ctrls = new OrbitControls(threejsObs.cam, canvasRef.current);
    ctrls.target.set(0, 0, 0);
    ctrls.enablePan = false
    threejsObs.sc.add(new THREE.AmbientLight(0xffffff, 1));

    const dLight = new THREE.DirectionalLight(0xffffff,1);
    dLight.position.set(10,10,10)
    threejsObs.sc.add(dLight)
  

    //    const material = new THREE.MeshPhongNodeMaterial( {
    //     color: 0x00ff, 
    //     flatShading: false,
    //     transparent: true,
    //     opacity: 1,
    //     shininess:300,
    //     specular: 0xffffff,
    //     metalness:0.9,
    //     roughness:0.1,
    //     reflectivity: 1.0,
    //     clearcoat: 1.0,
    //     clearcoatRoughness: 0.1,
    // } );

    // const wMat = new THREE.MeshBasicMaterial(
    //   {
    //     color: 0xffffff,
    //     wireframe:true,
    //     transparent: true,
    //     opacity: 0.8
    //   }
    // )




    // const loader = new STLLoader();
    // loader.loadAsync('/Menger_sponge_sample.stl').then((geo)=>{
   
    //   geo.center()
    //     geo.computeBoundingBox();
    //     const bbox = geo.boundingBox;


    //     const size = new THREE.Vector3();
    //     bbox.getSize(size);

    //     const targetSize = 3;
    //     const maxDim = Math.max(size.x, size.y, size.z);
    //     const scaleFactor = targetSize/maxDim;

    //     const gridSize = Math.ceil(Math.cbrt(200));
    //     const spacing = 5;
    //     let count = 0;
        
    //         for(let x = 0; x < gridSize && count < 200; x++){
    //           for(let y = 0; y < gridSize && count < 200; y++){
    //             for(let z = 0; z < gridSize && count < 200; z++){
    //   const mesh = new THREE.Mesh( geo, material );
    //   mesh.scale.setScalar(scaleFactor);
    //   mesh.position.set(
    //     (x-gridSize/2)*spacing,(y-gridSize/2)*spacing,(z-gridSize/2)*spacing
    //   )
    //     threejsObs.sc.add( mesh );

        
    //     const wireframeMesh = new THREE.Mesh(geo, wMat);
    //     wireframeMesh.scale.setScalar(scaleFactor);
    //     wireframeMesh.position.copy(mesh.position);
    //     threejsObs.sc.add(wireframeMesh);

    //     count++
    //             }
    //           }
    //         }

    //         const gridExtend = (gridSize * spacing)/2
    //         threejsObs.cam.position.set(gridExtend * 1.5, gridExtend * 1.2, gridExtend * 1.5);
    //         threejsObs.cam.lookAt(0,0,0);


    // }).catch((err)=>{
    //   console.error('Failed to load stl:', err);
      
    // })
     const geometry = new THREE.BoxGeometry(5, 5, 5);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
        const cube = new THREE.Mesh(geometry, material);
        cube.name = 'cube';
        threejsObs.sc.add(cube);

        
        await threejsObs.workerManager.loadScene({
          sc: threejsObs.sc,
          cam: threejsObs.cam
        })

    function animate(){
      animatId = requestAnimationFrame(animate)
      ctrls.update();
    threejsObs.workerManager.updateCamera( threejsObs.cam)

    }
    animate()

    }

    ani()

    return ()=>{
      if(animatId) cancelAnimationFrame(animatId)
      
      if(threejsObs.workerManager) threejsObs.workerManager.stopRenderLoop();
    }
  },[])

  return (
    <canvas style={{width:'100vw',height:'100vh'}} ref={canvasRef}>
    </canvas>
  )
}

export default App
