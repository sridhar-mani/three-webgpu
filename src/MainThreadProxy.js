import { generateUUID } from 'three/src/math/MathUtils.js';
import * as THREE from 'three/webgpu';
import ALLOWED_METHODS from './expMethods';

class WorkerManager {
    constructor({ canvas}={}){
        this.fW_queue = new Map();
        this.canvas = canvas;
        this.rnW = null;

        return new Proxy(this, {
            get(target, prop){
                if(prop in target){
                    return target[prop];
                }

                if(ALLOWED_METHODS.has(prop)){
                    return function(...args){
                        return target._callRendererMethod(prop,args);
                    };
                }

                return undefined;
            }
        })
    }

    async _intializeRendererWorker(params){
        this.rnW = new Worker(new URL('/workerhyb.js',import.meta.url),{type:'module'});

        console.log(params)

        const offscreen = this.canvas.transferControlToOffscreen();

        this.rnW.postMessage({
            type: 'init_rd',
            data: {
                canvas: offscreen,
                params
            }
        }, [offscreen]);

      return new Promise((res,rej)=>{
          this.rnW.onmessage=(e)=>{
                    const { type } = e.data;
        
        if (type === 'error') {
            console.error('Worker error:', e.data.message);
            rej(new Error(e.data.message));
        }else if(type == 'ready'){
            
        res({
            'status':'success',
            'message':'rendering worker started',
            'data':this.rnW
        })
        }
        }
      })

    }

    render(scene, camera){
           const scDat = scene.toJSON?.() ?? null;

        this.rnW.postMessage({
            type: 'render',
            data: {
                scene: scDat,
                cam: camera.toJSON()
            }
        });

        
    }

    _callRendererMethod(methodName, params){
        if(!this.rnW){
            console.warn(`WorkerManager: Cannot call ${methodName}, worker not initialized`);
            return
        }

        const id = generateUUID();

        this.rnW.postMessage({
            type:'threejs_func',data:{
                name: methodName,
                params: params,
                id:id
            }
        })
    }

    async runCompute({func,args_ar}){
        const id = generateUUID();
        const cmW = {worker:new Worker(new URL('/workerhyb.js',import.meta.url), {type:'module'}),id:id,status: 'started'};

        this.fW_queue.set(id, cmW)

        cmW.worker.postMessage({
            type:'compute',
            data:{
                id: cmW.id,
                func: func.toString(),
                data:args_ar
            }
        })

        cmW.worker.onmessage=(e)=>{
            const {res,type,error,id} = e.data;

            if(type=='error'){
                 console.error('Compute error:', error);
                return {
                     'status':'error',
            'message':'computation failed',
            'data': error,
            'id':id
                }
            }

            console.log('Compute result:', res);

            return {
                
                 'status':'success',
            'message':'computation done success',
            'data':res
            }
        }
    }
}

export default WorkerManager;