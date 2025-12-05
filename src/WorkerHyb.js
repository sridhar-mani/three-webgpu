import * as THREE from "three/webgpu";

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

// Forward console logs from worker to main thread
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function (...args) {
  originalLog.apply(console, args);
  self.postMessage({ type: "console", level: "log", args: args });
};

console.error = function (...args) {
  originalError.apply(console, args);
  self.postMessage({ type: "console", level: "error", args: args });
};

console.warn = function (...args) {
  originalWarn.apply(console, args);
  self.postMessage({ type: "console", level: "warn", args: args });
};

const threeObjs = {
  renderer: null,
  device: null,
  objLoader: new THREE.ObjectLoader(),
  scene: null,
  camera: null,
  isRendering: false,
  cameraSharedArr: null,
};

self.onmessage = async (e) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case "init_rd":
        await init_rnd(data);
        break;
      case "load_scene":
        loadScene(data);
        break;
      case "update_camera":
        updateCamera(data);
        break;
      case "update_transform":
        updateTransform(data);
        break;
      case "render":
        renderOnce(data);
        break;
      case "compute":
        await runComp(data);
        break;
      case "threejs_func":
        call_func(data);
        break;
      case "stop_loop":
        threeObjs.isRendering = false;
        break;
      case "update_material":
        updateMaterial(data);
        break;
      case "add_object":
        console.log("Worker received add_object:", e.data.id);
        addObj(data, e.data.id);
        break;
      case "remove_object":
        removeObj(data);
        break;
      default:
        throw new Error(`Unknown msg type: ${type}`);
    }
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};

function updateMaterial(data) {
  if (!threeObjs.scene) return;
  const obj = threeObjs.scene.getObjectByName(data.name);
  if (!obj || !obj.material) return;

  Object.entries(data.props).forEach(([key, value]) => {
    if (key == "color") {
      obj.material.color.setHex(value);
    } else if (key in obj.material) {
      obj.material[key] = value;
    }
  });
  obj.material.needsUpdate = true;
}

function addObj(data, id) {
  console.log("Worker addObj called with:", {
    id,
    type: data.type,
    isInstancedMesh: data.isInstancedMesh,
    name: data.name,
    count: data.count,
    hasGeometry: !!data.geometry,
    hasMaterial: !!data.material,
    hasInstanceMatrices: !!data.instanceMatrices,
    hasInstanceColors: !!data.instanceColors,
  });

  try {
    let obj;
    const geometry = threeObjs.objLoader.parseGeometries([data.geometry])[
      data.geometry.uuid
    ];
    const material = threeObjs.objLoader.parseMaterials([data.material])[
      data.material.uuid
    ];

    console.log("Worker parsed geometry and material:", {
      geometry: geometry?.type,
      material: material?.type,
      materialVertexColors: material?.vertexColors,
    });

    // Ensure vertexColors is enabled for instance colors
    if (material && data.instanceColors) {
      material.vertexColors = true;
      console.log("Worker enabled vertexColors on material");
    }

    // Check isInstancedMesh flag, not type string
    if (data.isInstancedMesh) {
      obj = new THREE.InstancedMesh(geometry, material, data.count);
      console.log("Worker created InstancedMesh with count:", data.count);

      if (data.instanceMatrices) {
        obj.instanceMatrix.array.set(data.instanceMatrices);
        obj.instanceMatrix.needsUpdate = true;
        console.log("Worker set instance matrices");
      }
      if (data.instanceColors) {
        obj.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(data.instanceColors),
          3
        );
        obj.instanceColor.needsUpdate = true;
        console.log(
          "Worker set instance colors, length:",
          data.instanceColors.length
        );
      }
    } else {
      obj = new THREE.Mesh(geometry, material);
      console.log("Worker created Mesh");
    }

    obj.name = data.name;
    obj.matrix.fromArray(data.matrix);
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);

    console.log("Worker adding object to scene:", {
      name: obj.name,
      type: obj.type,
      isInstancedMesh: obj.isInstancedMesh,
      hasInstanceColor: !!obj.instanceColor,
    });

    threeObjs.scene.add(obj);

    console.log(
      "Worker scene now has",
      threeObjs.scene.children.length,
      "children"
    );

    // Ensure render loop is running
    if (
      !threeObjs.isRendering &&
      threeObjs.renderer &&
      threeObjs.camera &&
      threeObjs.scene
    ) {
      console.log("Worker starting render loop");
      startInternalLoop();
    } else {
      console.log("Worker render loop already running:", threeObjs.isRendering);
    }

    self.postMessage({ type: "object_added", id, name: data.name });
    console.log("Worker sent object_added message");
  } catch (er) {
    console.error("Worker addObj error:", er.message, er.stack);
    self.postMessage({
      type: "error",
      id,
      message: `addObject failed: ${er.message}`,
    });
  }
}

function removeObj(data) {
  if (!threeObjs.scene) return;
  const obj = threeObjs.scene.getObjectByName(data.name);
  if (obj) {
    obj.geometry?.dispose();
    obj.material?.dispose();
    threeObjs.scene.remove(obj);
  }
}

async function init_rnd({ canvas, cameraBuffer, params }) {
  try {
    if (!canvas) {
      throw new Error("Canvas is undefined - transfer failed");
    }
    if (!(canvas instanceof OffscreenCanvas)) {
      throw new Error(
        `Expected OffscreenCanvas, got ${canvas.constructor.name}`
      );
    }
    if (cameraBuffer) {
      threeObjs.cameraSharedArr = new Float32Array(cameraBuffer);
    }

    const width = params.width || 800;
    const height = params.height || 600;
    const pixelRatio = params.pixelRatio || 1;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    threeObjs.renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: params.antialias ?? true,
      alpha: params.alpha ?? false,
    });

    await threeObjs.renderer.init();

    threeObjs.renderer.setSize(width, height, false);
    threeObjs.renderer.setPixelRatio(pixelRatio);
    threeObjs.renderer.setClearColor(params.background, 1);
    threeObjs.device = threeObjs.renderer.backend?.device ?? null;

    if (threeObjs.scene) {
      threeObjs.scene.background = new THREE.Color(params.background);
    }

    self.postMessage({ type: "ready", message: "Renderer initialized" });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: `Renderer initialization failed: ${err.message}`,
    });
  }
}

function call_func({ name, params, id }) {
  try {
    if (!threeObjs.renderer) {
      throw new Error("Renderer not initialized");
    }
    if (!ALLOWED_METHODS.has(name)) {
      throw new Error("Function not allowed");
    }
    if (typeof threeObjs.renderer[name] !== "function") {
      throw new Error(`Method '${name}' does not exist on renderer`);
    }

    const res = threeObjs.renderer[name](...params);

    if (id) {
      self.postMessage({
        type: "success",
        id,
        result: res !== undefined ? res : null,
      });
    }
  } catch (err) {
    self.postMessage({ type: "error", id, message: err.message, method: name });
  }
}

function loadScene(data) {
  try {
    threeObjs.scene = threeObjs.objLoader.parse(data.scene);
    threeObjs.camera = threeObjs.objLoader.parse(data.cam);
    threeObjs.scene.background = new THREE.Color(data.bgColor);

    threeObjs.scene.traverse((obj) => {
      if (obj.isInstancedMesh && obj.userData.instanceMatrices) {
        obj.instanceMatrix.array.set(obj.userData.instanceMatrices);
        obj.instanceMatrix.needsUpdate = true;
      }
    });

    threeObjs.camera.updateProjectionMatrix();
    threeObjs.camera.updateMatrixWorld();

    startInternalLoop();
    self.postMessage({ type: "scene_loaded" });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: `loadScene failed: ${err.message}`,
    });
  }
}

function updateCamera(data) {
  if (!threeObjs.camera) return;
  if (data.position) threeObjs.camera.position.fromArray(data.position);
  if (data.quaternion) threeObjs.camera.quaternion.fromArray(data.quaternion);
  threeObjs.camera.updateMatrixWorld();
}

function updateTransform(data) {
  if (!threeObjs.scene) return;
  const obj = threeObjs.scene.getObjectByName(data.name);
  if (!obj) return;
  if (data.pos) obj.position.fromArray(data.pos);
  if (data.rot) obj.rotation.fromArray(data.rot);
  if (data.scale) obj.scale.fromArray(data.scale);
}

function startInternalLoop() {
  if (threeObjs.isRendering) return;
  threeObjs.isRendering = true;

  function loop() {
    if (!threeObjs.isRendering) return;

    if (threeObjs.renderer && threeObjs.camera && threeObjs.scene) {
      if (threeObjs.cameraSharedArr && threeObjs.camera) {
        threeObjs.camera.position.set(
          threeObjs.cameraSharedArr[0],
          threeObjs.cameraSharedArr[1],
          threeObjs.cameraSharedArr[2]
        );
        threeObjs.camera.quaternion.set(
          threeObjs.cameraSharedArr[3],
          threeObjs.cameraSharedArr[4],
          threeObjs.cameraSharedArr[5],
          threeObjs.cameraSharedArr[6]
        );
        threeObjs.camera.updateMatrixWorld();
      }
      threeObjs.renderer.render(threeObjs.scene, threeObjs.camera);
    }

    requestAnimationFrame(loop);
  }
  loop();
}

function renderOnce({ scene, cam }) {
  const rmtSc = threeObjs.objLoader.parse(scene);
  const rmtCam = threeObjs.objLoader.parse(cam);
  threeObjs.renderer.render(rmtSc, rmtCam);
}

async function runComp({ id, func, data }) {
  try {
    const usrFunc = new Function(`return ${func}`)();
    const res = await Promise.resolve(usrFunc(data, threeObjs.device));
    self.postMessage({ type: "result", id, res });
  } catch (err) {
    self.postMessage({ type: "error", id, error: err.message });
  }
}
