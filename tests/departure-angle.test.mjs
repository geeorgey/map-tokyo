import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3, PerspectiveCamera } from 'three';
import { departureOffset } from '../src/departure-angle.mjs';
import { FollowCamera } from '../src/engine/follow-camera.js';
test('front exterior view follows the chosen car orientation in either direction without changing it', () => {
  for (const yaw of [0, Math.PI, Math.PI / 3]) {
    const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw), before=q.clone();
    const offset=departureOffset('front',q), forward=new Vector3(0,0,1).applyQuaternion(q);
    assert.ok(offset.dot(forward)>31.99);assert.equal(offset.y,24);assert.ok(q.equals(before));
    const camera=new PerspectiveCamera(), controls={target:new Vector3()}, follow=new FollowCamera(camera,controls);
    const anchor=new Vector3(10,4,20);follow.start(anchor,0,true,offset);
    const moved=anchor.clone().add(new Vector3(2,0,3));follow.update(moved,100);
    assert.ok(camera.position.clone().sub(controls.target).distanceTo(offset)<1e-8);
  }
  assert.equal(departureOffset('unknown',new Quaternion()),null);
});
