import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// A single building extracted from PLATEAU Chiyoda 2025. The original
// procedural station remains available if the local asset cannot be loaded.
export function loadStationModel(parent, fallback) {
  const root = new THREE.Group();
  root.name = 'Tokyo Station — PLATEAU 2025';
  root.scale.z = 1 / parent.scale.z;
  parent.add(root);
  let disposed = false, night = 0;
  const textures = [], lights = [];
  const ready = new GLTFLoader().loadAsync('/models/tokyo-station/station.glb').then(({scene}) => {
    if (disposed) { disposeAsset(scene); return; }
    const bounds = new THREE.Box3().setFromObject(scene);
    const center = bounds.getCenter(new THREE.Vector3());
    scene.position.set(-51 - center.x, 1.1 - bounds.min.y, -center.z);
    scene.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        mat.roughness = .94; mat.metalness = 0;
        if (mat.map) { mat.map.anisotropy = 8; textures.push(mat.map); }
      }
    });
    root.add(scene);
    // Floodlighting is an artistic approximation; source photos contain daylight.
    for (const z of [-120, -40, 40, 120]) {
      const light = new THREE.SpotLight('#ffcf92', 0, 105, .68, .65, 2);
      light.position.set(-108, 3, z); light.target.position.set(-62, 14, z);
      root.add(light, light.target); lights.push(light);
    }
    fallback.visible = false;
    setNight(night);
  }).catch(error => {
    if (!disposed) console.warn('Station model unavailable; using procedural station.', error);
  });
  function setNight(amount) { night = amount; lights.forEach(light => { light.intensity = amount * 2600; }); }
  return { root, textures, ready, setNight, dispose() { disposed = true; } };
}

function disposeAsset(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
}
