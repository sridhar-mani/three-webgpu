import * as THREE from 'three/webgpu'
import WorkerManager from './MainThreadProxy.js'


THREE.WebGPURenderer =  WorkerManager


export {
    THREE
}
