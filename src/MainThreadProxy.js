import { generateUUID } from 'three/src/math/MathUtils.js';
import * as THREE from 'three/webgpu';
import ALLOWED_METHODS from './expMethods.js';

class WorkerManager {
    constructor({ canvas}={}){

          if (!canvas) {
            throw new Error("WorkerManager requires a 'canvas' element");
        }
        this.fW_queue = new Map();
        this.canvas = canvas;
        this.rnW = null;
          this.isReady = false;
        

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
        this.rnW = new Worker(new URL('./WorkerHyb.js',import.meta.url),{type:'module'});

          this.rnW.onmessage = (e) => {
        const { type, message, data } = e.data;
        
        console.log('Main: Worker message received:', type, e.data);
        
        switch(type) {
            case 'ready':
                this.isReady=true;
                console.log('Main: Worker ready');
                if (this._readyResolver) {
                    this._readyResolver({ status: 'success', message: 'Worker initialized', data: this.rnW });
                    this._readyResolver = null;
                }
                break;
                
            case 'scene_loaded':
                console.log('Main: Scene loaded in worker');
                break;
                
            case 'error':
                console.error('Main: Worker error:', message);
                if (this._readyResolver) {
                    this._readyResolver = null;
                    this._readyRejecter(new Error(message));
                    this._readyRejecter = null;
                }
                break;
                
            case 'success':
            case 'result':
                break;
                
            default:
                console.log('Main: Unhandled worker message type:', type);
        }
    };

    this.rnW.onerror = (err) => {
        console.error('Main: Worker error event:', err);
        if (this._readyRejecter) {
            this._readyRejecter(new Error(err.message));
            this._readyRejecter = null;
        }
    };

    const offscreen = this.canvas.transferControlToOffscreen();

    return new Promise((resolve, reject) => {
        this._readyResolver = resolve;
        this._readyRejecter = reject;

        this.rnW.postMessage({
            type: 'init_rd',
            data: {
                canvas: offscreen,
                params: {
                    width: params.width || this.canvas.clientWidth || 800,
                    height: params.height || this.canvas.clientHeight || 600,
                    pixelRatio: params.pixelRatio || window.devicePixelRatio || 1,
                    antialias: params.antialias ?? true,
                    alpha: params.alpha ?? false
                }
            }
        }, [offscreen]);
    });

    }

    async loadScene({sc,cam}){
        const sceneJSON = sc.toJSON();
        const camJSON = cam.toJSON();
        console.log('MainThread: sending scene to worker', {
            sceneChildren: sc.children.length,
            sceneJSON: sceneJSON,
            camPos: cam.position.toArray()
        });
        this.rnW.postMessage(
            {
                type:'load_scene',
                data:{
                    scene: sceneJSON,
                    cam: camJSON
                }
            }
        )
    }

    updateCamera(camera){
        if(!this.isReady) return;

        this.rnW.postMessage({
            type:'update_camera',
            data:{
                position: camera.position.toArray(),
                quaternion: camera.quaternion.toArray()
            }
        })
    }

    updateTransform(name,pos,rot,scale){
        if(!this.isReady) return;

        this.rnW.postMessage({
            type:'update_transform',
            data:{
                name,
                pos: pos? pos:null,
                rot: rot?rot:null,
                scale: scale? scale:null
            }
        })
    }

    render(scene, camera){
            if (!this.isReady) {
            return;
        }

        const scDat = scene.toJSON?.() ?? null;

        this.rnW.postMessage({
            type: 'render',
            data: {
                scene: scDat,
                cam: camera.toJSON()
            }
        });
    }

    stopRenderLoop(){
        if(!this.rnW) return;
        this.rnW.postMessage({type:'stop_loop'});
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
        const cmW = {worker:new Worker(new URL('./WorkerHyb.js',import.meta.url), {type:'module'}),id:id,status: 'started'};

        this.fW_queue.set(id, cmW)

        cmW.worker.postMessage({
            type:'compute',
            data:{
                id: cmW.id,
                func: func.toString(),
                data:args_ar
            }
        })
        
        return new Promise((resolve,rej)=>{
            cmW.worker.onmessage=(e)=>{
            const {res,type,error,id} = e.data;

            if(type=='error'){
                 console.error('Compute error:', error);
                rej({
                      status: 'error',
                        message: 'computation failed',
                        data: error,
                        id: id
                })
            }else{
                 resolve({
                        status: 'success',
                        message: 'computation done',
                        data: res
                    });
            }
            cmW.worker.terminate();
            this.fW_queue.delete(id);
        }

        cmW.worker.onerror = (err)=>{
            rej({
                status: 'error',
                message: err.message
            })
            cmW.worker.terminate();
            this.fW_queue.delete(id);
        }
        })
    }
}

export default WorkerManager;