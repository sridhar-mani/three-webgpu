import { generateUUID } from "three/src/math/MathUtils.js";

const ALLOWED_METHODS = new Set([
  "setSize",
  "setPixelRatio",
  "setClearColor",
  "clear",
  "compile",
  "dispose",
  "setScissorTest",
  "setViewport",
  "setRenderTarget",
]);

class WorkerManager {
  constructor({ canvas } = {}) {
    if (!canvas) {
      throw new Error("WorkerManager requires a 'canvas' element");
    }
    this.fW_queue = new Map();
    this.canvas = canvas;
    this.rnW = null;
    this.isReady = false;
    this._cameraBuffer = new SharedArrayBuffer(
      7 * Float32Array.BYTES_PER_ELEMENT
    );
    this._cameraArray = new Float32Array(this._cameraBuffer);

    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        if (ALLOWED_METHODS.has(prop)) {
          return function (...args) {
            return target._callRendererMethod(prop, args);
          };
        }
        return undefined;
      },
    });
  }

  async _intializeRendererWorker(params) {
    this.rnW = new Worker(new URL("./workerhyb.js", import.meta.url), {
      type: "module",
    });

    this.rnW.onmessage = (e) => {
      const { type, message, data } = e.data;

      switch (type) {
        case "console":
          // Forward worker console messages to main thread console
          const prefix = `[Worker]`;
          if (e.data.level === "log") {
            console.log(prefix, ...e.data.args);
          } else if (e.data.level === "error") {
            console.error(prefix, ...e.data.args);
          } else if (e.data.level === "warn") {
            console.warn(prefix, ...e.data.args);
          }
          break;
        case "ready":
          this.isReady = true;
          if (this._readyResolver) {
            this._readyResolver({
              status: "success",
              message: "Worker initialized",
              data: this.rnW,
            });
            this._readyResolver = null;
          }
          break;
        case "scene_loaded":
          break;
        case "error":
          if (this._readyResolver) {
            this._readyResolver = null;
            this._readyRejecter(new Error(message));
            this._readyRejecter = null;
          }
          break;
        case "success":
        case "result":
          break;

        case "object_added":
          break;
      }
    };

    this.rnW.onerror = (err) => {
      console.error("Worker error event:", err);
      console.error("Error details:", {
        message: err.message,
        filename: err.filename,
        lineno: err.lineno,
        colno: err.colno,
      });

      if (this._readyRejecter) {
        this._readyRejecter(
          new Error(
            `Worker error: ${err.message} at ${err.filename}:${err.lineno}`
          )
        );
        this._readyRejecter = null;
      }
    };

    const offscreen = this.canvas.transferControlToOffscreen();

    return new Promise((resolve, reject) => {
      this._readyResolver = resolve;
      this._readyRejecter = reject;

      this.rnW.postMessage(
        {
          type: "init_rd",
          data: {
            canvas: offscreen,
            cameraBuffer: this._cameraBuffer,
            params: {
              width: params.width || this.canvas.clientWidth || 800,
              height: params.height || this.canvas.clientHeight || 600,
              pixelRatio: params.pixelRatio || window.devicePixelRatio || 1,
              antialias: params.antialias ?? true,
              alpha: params.alpha ?? false,
            },
          },
        },
        [offscreen]
      );
    });
  }

  async loadScene({ sc, cam, bgColor }) {
    const sceneJSON = sc.toJSON();
    const camJSON = cam.toJSON();
    this.rnW.postMessage({
      type: "load_scene",
      data: {
        scene: sceneJSON,
        cam: camJSON,
        bgColor: bgColor || null,
      },
    });
  }

  updateCamera(camera) {
    if (!this.isReady) return;
    this._cameraArray[0] = camera.position.x;
    this._cameraArray[1] = camera.position.y;
    this._cameraArray[2] = camera.position.z;
    this._cameraArray[3] = camera.quaternion.x;
    this._cameraArray[4] = camera.quaternion.y;
    this._cameraArray[5] = camera.quaternion.z;
    this._cameraArray[6] = camera.quaternion.w;
  }

  updateTransform(name, pos, rot, scale) {
    if (!this.isReady) return;
    this.rnW.postMessage({
      type: "update_transform",
      data: { name, pos: pos || null, rot: rot || null, scale: scale || null },
    });
  }

  async addObj(object, options = {}) {
    const objDat = {
      type: object.type,
      geometry: object.geometry.toJSON(),
      material: object.material.toJSON(),
      matrix: object.matrix.toArray(),
      name: options.name || object.name || generateUUID(),
      count: object.count || undefined,
      instanceMatrices: object.instanceMatrix
        ? Array.from(object.instanceMatrix.array)
        : undefined,
      instanceColors: object.instanceColor
        ? Array.from(object.instanceColor.array)
        : undefined,
    };

    console.log("MainThreadProxy.addObj - objDat:", {
      type: objDat.type,
      name: objDat.name,
      count: objDat.count,
      hasGeometry: !!objDat.geometry,
      hasMaterial: !!objDat.material,
      hasInstanceMatrices: !!objDat.instanceMatrices,
      instanceMatricesLength: objDat.instanceMatrices?.length,
      hasInstanceColors: !!objDat.instanceColors,
      instanceColorsLength: objDat.instanceColors?.length,
    });

    return new Promise((res, rej) => {
      const id = generateUUID();
      console.log(
        "MainThreadProxy: Sending add_object message to worker, id:",
        id,
        "name:",
        objDat.name
      );
      this.rnW.postMessage({ type: "add_object", id, data: objDat });

      const handler = (e) => {
        if (e.data.type === "object_added" && e.data.id === id) {
          this.rnW.removeEventListener("message", handler);
          res({ name: objDat.name, id });
        }
      };
      this.rnW.addEventListener("message", handler);

      setTimeout(() => {
        this.rnW.removeEventListener("message", handler);
        rej(new Error("Object Timeout"));
      }, 5000);
    });
  }

  removeObject(name) {
    if (!this.isReady) return;
    this.rnW.postMessage({ type: "remove_object", data: { name } });
  }

  updateMaterial(objectName, materialProps) {
    if (!this.isReady) return;
    this.rnW.postMessage({
      type: "update_material",
      data: { name: objectName, props: materialProps },
    });
  }

  render(scene, camera) {
    if (!this.isReady) return;
    this.rnW.postMessage({
      type: "render",
      data: { scene: scene.toJSON?.() ?? null, cam: camera.toJSON() },
    });
  }

  stopRenderLoop() {
    if (!this.rnW) return;
    this.rnW.postMessage({ type: "stop_loop" });
  }

  _callRendererMethod(methodName, params) {
    if (!this.rnW) return;
    const id = generateUUID();
    this.rnW.postMessage({
      type: "threejs_func",
      data: { name: methodName, params: params, id: id },
    });
  }

  async runCompute({ func, args_ar }) {
    const id = generateUUID();
    const cmW = {
      worker: new Worker(new URL("./workerhyb.js", import.meta.url), {
        type: "module",
      }),
      id: id,
      status: "started",
    };

    this.fW_queue.set(id, cmW);

    cmW.worker.postMessage({
      type: "compute",
      data: { id: cmW.id, func: func.toString(), data: args_ar },
    });

    return new Promise((resolve, rej) => {
      cmW.worker.onmessage = (e) => {
        const { res, type, error, id } = e.data;
        if (type == "error") {
          rej({
            status: "error",
            message: "computation failed",
            data: error,
            id: id,
          });
        } else {
          resolve({
            status: "success",
            message: "computation done",
            data: res,
          });
        }
        cmW.worker.terminate();
        this.fW_queue.delete(id);
      };

      cmW.worker.onerror = (err) => {
        rej({ status: "error", message: err.message });
        cmW.worker.terminate();
        this.fW_queue.delete(id);
      };
    });
  }
}

export default WorkerManager;
