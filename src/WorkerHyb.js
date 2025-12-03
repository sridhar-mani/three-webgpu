import { ObjectLoader } from 'three';
import * as THREE from 'three/webgpu';
import ALLOWED_METHODS from './expMethods';

const threeObjs = {
    renderer: null,
    device: null,
    objLoader: new ObjectLoader()
}




self.onmessage  =async(e)=>{
    const {type, data} = e.data;

    try{

        switch(type){
            case 'init_rd':
                await init_rnd(data);
                break;
            case 'render':
                render(data)
                break;
            case 'compute':
                await runComp(data);
                break;
            case 'threejs_func':
                call_func(data)
                break;
            default:
                throw new Error(`Unknown msg type:${type}`);
        }
    }catch(err){
        self.postMessage({type:'error',message: err.message});
    }
}

async function init_rnd({canvas,params}) {
    threeObjs.renderer =  new THREE.WebGPURenderer({canvas,...params});
    await threeObjs.renderer.init();
    threeObjs.device = threeObjs.renderer.backend?.device ?? null;
    self.postMessage({type:'ready'})
}

function call_func({name, params, id}) {

    try{
        if(!threeObjs.renderer){
            throw new Error('Renderer not initialized');
        }

        if(!ALLOWED_METHODS.has(name)){
            throw new Error('Function not allowed')
        }

        if(typeof threeObjs.renderer[name](...params)){
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

function render({scene,cam}){
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