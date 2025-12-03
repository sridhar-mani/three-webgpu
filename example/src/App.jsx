import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import './App.css'
import { OrbitControls, STLLoader } from 'three/examples/jsm/Addons.js';
import WorkerManager from 'three-webgpu-worker';

function App() {
  const canvasRef = useRef(null);
 

  useEffect(()=>{
    let animatId;
     const threejsObs = {
    renderer: null,
    cam:null,
    sc:null,
    workerManager:null
  }


    const ani =async ()=>{
      if(!canvasRef.current.firstChild) return 
      threejsObs.workerManager = new WorkerManager({canvas:canvasRef.current.firstChild});
      await threejsObs.workerManager._intializeRendererWorker({canvas:canvasRef.current.firstChild})

    threejsObs.workerManager.setSize(canvasRef.current.clientWidth,canvasRef.current.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1,2)
    threejsObs.workerManager.setPixelRatio(dpr);
    await threejsObs.workerManager.init()
    
    threejsObs.sc = new THREE.Scene();
  threejsObs.cam = new THREE.PerspectiveCamera(40, window.innerWidth/window.innerHeight, 1,10000);
    threejsObs.cam.position.set(20,20,20)
    const ctrls = new OrbitControls(threejsObs.cam, threejsObs.renderer.domElement);
    ctrls.enablePan = false
    threejsObs.sc.add(new THREE.AmbientLight(0xffffff, 1));

    const dLight = new THREE.DirectionalLight(0xffffff,1);
    dLight.position.set(10,10,10)
    threejsObs.sc.add(dLight)
  

       const material = new THREE.MeshPhongNodeMaterial( {
        color: 0x00ff, 
        flatShading: false,
        transparent: true,
        opacity: 1,
        shininess:300,
        specular: 0xffffff,
        metalness:0.9,
        roughness:0.1,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
    } );

    const wMat = new THREE.MeshBasicMaterial(
      {
        color: 0xffffff,
        wireframe:true,
        transparent: true,
        opacity: 0.8
      }
    )




    const loader = new STLLoader();
    loader.loadAsync('/Menger_sponge_sample.stl').then((geo)=>{
   
      geo.center()
        geo.computeBoundingBox();
        const bbox = geo.boundingBox;


        const size = new THREE.Vector3();
        bbox.getSize(size);

        const targetSize = 3;
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = targetSize/maxDim;

        const gridSize = Math.ceil(Math.cbrt(200));
        const spacing = 5;
        let count = 0;
        
            for(let x = 0; x < gridSize && count < 200; x++){
              for(let y = 0; y < gridSize && count < 200; y++){
                for(let z = 0; z < gridSize && count < 200; z++){
      const mesh = new THREE.Mesh( geo, material );
      mesh.scale.setScalar(scaleFactor);
      mesh.position.set(
        (x-gridSize/2)*spacing,(y-gridSize/2)*spacing,(z-gridSize/2)*spacing
      )
        threejsObs.sc.add( mesh );

        
        const wireframeMesh = new THREE.Mesh(geo, wMat);
        wireframeMesh.scale.setScalar(scaleFactor);
        wireframeMesh.position.copy(mesh.position);
        threejsObs.sc.add(wireframeMesh);

        count++
                }
              }
            }

            const gridExtend = (gridSize * spacing)/2
            threejsObs.cam.position.set(gridExtend * 1.5, gridExtend * 1.2, gridExtend * 1.5);
            threejsObs.cam.lookAt(0,0,0);


    }).catch((err)=>{
      console.error('Failed to load stl:', err);
      
    })

    // for(let i=0;i< 20000;i++){

    // }    

    function animate(){
      animatId = requestAnimationFrame(animate)
      ctrls.update();
    threejsObs.renderer.render(threejsObs.sc, threejsObs.cam)

    }
    animate()

    }

    ani()

    return ()=>{
      if(animatId) cancelAnimationFrame(animatId)
      if(canvasRef.current) canvasRef.current.removeChild(threejsObs.renderer.domElement)
      if(threejsObs.renderer) threejsObs.renderer.dispose()
    }
  },[])

  return (
    <div style={{width:'100vw',height:'100vh'}} ref={canvasRef}>
    </div>
  )
}

export default App
