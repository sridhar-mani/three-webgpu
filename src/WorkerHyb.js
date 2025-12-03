import { ObjectLoader } from 'three';
import * as THREE from 'three/webgpu';
import ALLOWED_METHODS from './expMethods.js';

const threeObjs = {
    renderer: null,
    device: null,
    objLoader: new ObjectLoader(),
    scene: null,
    camera: null,
    isRendering: false
}




self.onmessage  =async(e)=>{
    const {type, data} = e.data;

    try{

        switch(type){
            case 'init_rd':
                await init_rnd(data);
                break;
            case 'load_scene':
                loadScene(data)
                break;
            case 'update_camera':
                updateCamera(data);
                break;
            case 'update_transform':
                updateTransform(data);
                break;
            case 'render':
                renderOnce(data)
                break;
            case 'compute':
                await runComp(data);
                break;
            case 'threejs_func':
                call_func(data)
                break;
            case 'stop_loop':
                threeObjs.isRendering = false
                break;
            default:
                throw new Error(`Unknown msg type:${type}`);
        }
    }catch(err){
        self.postMessage({type:'error',message: err.message});
    }
}

async function init_rnd({canvas,params}) {
    try{
            threeObjs.renderer =  new THREE.WebGPURenderer({canvas});

    await threeObjs.renderer.init();
    console.log('Worker: renderer.init() complete');

            const width = params.width || 800;
        const height = params.height || 600;
        const pixelRatio = params.pixelRatio || 1;

    threeObjs.renderer.setSize(width, height, false );
    threeObjs.renderer.setPixelRatio(pixelRatio );
    threeObjs.device = threeObjs.renderer.backend?.device ?? null;
    console.log('Worker: posting ready message');
        self.postMessage({ type: 'ready', message: 'Renderer initialized' });
    }catch(err){
        self.postMessage({ type: 'error', message: `Renderer initialization failed: ${err.message}` });
    }

}

function call_func({name, params, id}) {

    try{
        if(!threeObjs.renderer){
            throw new Error('Renderer not initialized');
        }

        if(!ALLOWED_METHODS.has(name)){
            throw new Error('Function not allowed')
        }

        if(typeof threeObjs.renderer[name] !== 'function'){
            throw new Error(`Method '${name}' does not exist on renderer`);
        }

        const res = threeObjs.renderer[name](...params);

        if(id){
            self.postMessage({
                type: 'success',
                id,
                result: res !== undefined? res: null
            })
        }

    }catch(err){
        self.postMessage({
            type:'error',
            id,
            message: err.message,
            method:name
        })
    }
    
}

function loadScene(data){
    threeObjs.scene = threeObjs.objLoader.parse(data.scene)
    threeObjs.camera = threeObjs.objLoader.parse(data.cam)

    startInternalLoop();

    self.postMessage({type:'scene_loaded'})
}

function updateCamera(data){
    if(!threeObjs.camera) return;


    if(data.position) threeObjs.camera.position.fromArray(data.position)
    if(data.quaternion) threeObjs.camera.quaternion.fromArray(data.quaternion)

    threeObjs.camera.updateMatrixWorld();
}

function updateTransform(data){
    if(!threeObjs.scene) return
    
    const obj = threeObjs.scene.getObjectByName(data.name);
    if(!obj) return;
    if(data.pos) obj.position.fromArray(data.pos);
            if(data.rot) obj.rotation.fromArray(data.rot);
                if(data.scale) obj.scale.fromArray(data.scale);
}

function startInternalLoop(){
    if(threeObjs.isRendering) return
    threeObjs.isRendering = true;

    function loop(){
        if(!threeObjs.isRendering) return


    if(threeObjs.renderer && threeObjs.camera && threeObjs.scene) threeObjs.renderer.render(threeObjs.scene,threeObjs.camera)

        requestAnimationFrame(loop)

    }
    loop()
}

function renderOnce({scene,cam}){
    const rmtSc = threeObjs.objLoader.parse(scene);
    const rmtCam = threeObjs.objLoader.parse(cam);


    threeObjs.renderer.render(rmtSc,rmtCam);
}

async function runComp({id, func,data}) {
    try{
        const usrFunc = new Function(`return ${func}`)();

        const res = await Promise.resolve(usrFunc(data, threeObjs.device))
        self.postMessage({type:'result', id, res})
    }catch(err){
        self.postMessage({type:'error', id, error: err.message})
    }
}