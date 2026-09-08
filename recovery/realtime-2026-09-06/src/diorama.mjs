import { DioramaBase, Vector3, sampleRoute } from '../vendor/scene-runtime.js';
import { createEnvelope, trainState } from './schedule.mjs';

export class ScheduledDiorama extends DioramaBase {
  constructor(host, onFrame, clock) {
    super(host, onFrame);
    this.clock = clock;
    this.events = [];
    this.lanes = Array.from({ length: this.world.trains.length }, () => []);
    this.envelopes = this.world.trains.map(createEnvelope);
    this.activeTrains = [];
    this.uiTick = 0;
    this.scheduled = true;
  }
  setEvents(events) {
    this.events = events;
    this.lanes = this.world.trains.map((_, lane) => events.filter(event => event.lane === lane));
  }
  setFollow(enabled) {
    this.followTrain = null;
    this.followCamera.stop();
    if (!enabled) return false;
    const train = this.world.trains.find(candidate => candidate.type === 'n700');
    if (!train || !train.cars[0].visible) return false;
    this.followTrain = train;
    this.transition = null;
    this.controls.autoRotate = false;
    this.followCamera.start(train.cars[0].position, performance.now(), matchMedia('(prefers-reduced-motion: reduce)').matches);
    return true;
  }
  animate(frame) {
    if (this.disposed) return;
    const delta = Math.min((frame - this.lastTime) / 1000, 0.1);
    this.lastTime = frame;
    const timestamp = this.clock.now();
    this.time = timestamp / 1000;
    this.activeTrains = [];
    this.world.trains.forEach((train, lane) => {
      const state = trainState(this.lanes[lane], timestamp, this.envelopes[lane]);
      train.currentState = state;
      if (state.visible) this.activeTrains.push({ lane, status: state.status, event: state.event });
      train.cars.forEach((car, index) => {
        car.visible = state.visible;
        if (!state.visible) return;
        const offset = train.offsets ? train.offsets[index] : ((train.cars.length - 1) / 2 - index) * 12.4 * state.direction;
        const distance = state.center + offset;
        const a = sampleRoute(train.route.points, train.route.lengths, distance - 4).position;
        const b = sampleRoute(train.route.points, train.route.lengths, distance + 4).position;
        const tangent = b.clone().sub(a).normalize();
        const orientation = train.offsets ? 1 : state.direction;
        car.position.copy(a).add(b).multiplyScalar(0.5);
        car.rotation.set(-Math.atan2(tangent.y * orientation, Math.hypot(tangent.x, tangent.z)), Math.atan2(tangent.x * orientation, tangent.z * orientation), 0, 'YXZ');
        if (car.userData.lampMaterial) {
          const color = car.userData.end === state.direction ? '#fff0bd' : '#e64b45';
          car.userData.lampMaterial.color.set(color);
          car.userData.lampMaterial.emissive.set(color);
        }
      });
    });
    for (const car of this.world.cars) {
      const { route, direction } = car;
      const distance = ((this.time * 8 + car.offset) % route.total + route.total) % route.total;
      const { position, tangent } = sampleRoute(route.points, route.lengths, direction === 1 ? distance : route.total - distance);
      const offset = route.road.oneway ? 0 : Math.min(2, route.road.width * 0.2) * direction;
      position.x -= tangent.z * offset;
      position.z += tangent.x * offset;
      car.model.position.copy(position);
      car.model.rotation.y = Math.atan2(tangent.x * direction, tangent.z * direction);
    }
    if (this.followTrain?.cars[0].visible) this.followCamera.update(this.followTrain.cars[0].position, frame);
    if (this.transition) {
      const fraction = Math.min((frame - this.transition.start) / 1250, 1);
      const easing = fraction * fraction * (3 - 2 * fraction);
      this.camera.position.lerpVectors(this.transition.from, this.transition.to, easing);
      this.controls.target.lerpVectors(this.transition.targetFrom, this.transition.targetTo, easing);
      if (fraction === 1) this.transition = null;
    }
    this.controls.update(delta);
    this.controls.target.clamp(new Vector3(-730, 0, -840), new Vector3(710, 240, 850));
    const radius = this.camera.position.distanceTo(this.controls.target) < 360 ? 270 : 850;
    if (this.shadowRadius !== radius) {
      this.shadowRadius = radius;
      Object.assign(this.sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius });
      this.sun.shadow.camera.updateProjectionMatrix();
      this.sun.shadow.normalBias = radius < 400 ? 0.12 : 0.7;
    }
    this.renderer.render(this.scene, this.camera);
    this.frameCount++;
    if (frame - this.measureTime > 600) {
      this.fps = Math.round(this.frameCount * 1000 / (frame - this.measureTime));
      this.measureTime = frame;
      this.frameCount = 0;
    }
    if (frame - this.uiTick > 200) {
      this.uiTick = frame;
      const labels = this.labelsVisible ? this.world.labels.map(label => {
        this.projector.copy(label.position).project(this.camera);
        return { name: label.name, x: (this.projector.x * 0.5 + 0.5) * this.host.clientWidth, y: (-0.5 * this.projector.y + 0.5) * this.host.clientHeight, visible: Math.abs(this.projector.x) < 0.94 && Math.abs(this.projector.y) < 0.94 && this.projector.z < 1 };
      }) : [];
      this.onFrame({ labels, heading: this.controls.getAzimuthalAngle() * 180 / Math.PI, fps: this.fps, activeTrains: this.activeTrains });
    }
    this.animation = requestAnimationFrame(this.animate);
  }
}
