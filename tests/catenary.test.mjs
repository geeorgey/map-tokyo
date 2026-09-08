import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Architecture} from '../src/engine/geometry.js';
import {makeCar} from '../src/engine/train-model.js';
import {buildCatenary,CONTACT_HEIGHT} from '../src/engine/catenary.js';
const map=JSON.parse(readFileSync(new URL('../src/data/tokyo-map.json',import.meta.url)));
const profiles=JSON.parse(readFileSync(new URL('../src/data/tokyo-platforms.json',import.meta.url))).tracks;
const a=new Architecture(new THREE.Scene()),{layout,group}=buildCatenary(a,map.rails,profiles);
test('contact wires follow every mapped rail, including the elevated Chuo tracks',()=>{
 const positions=group.children[0].geometry.getAttribute('position');let index=0;
 for(const path of layout.paths)for(let i=1;i<path.points.length;i++)for(const p of [path.points[i-1],path.points[i]]){
  assert(Math.abs(positions.getX(index)-p[0])<1e-4);
  assert(Math.abs(positions.getY(index)-(p[1]+CONTACT_HEIGHT))<1e-4);
  assert(Math.abs(positions.getZ(index)-p[2])<1e-4);index++;
 }
 assert.equal(index,positions.count);assert(layout.paths.some(p=>p.points.some(v=>v[1]>10)));
});
test('portal columns clear all neighboring train envelopes',()=>{
 assert(layout.portals.length>30);
 for(const portal of layout.portals){for(const x of [portal.left,portal.right])for(const p of portal.crossings)assert(Math.abs(x-p[0])>=2.05);
  for(const p of portal.tracks)assert(portal.top-p[1]>CONTACT_HEIGHT+1);
 }
});
test('wire geometry and support transforms are finite',()=>{
 for(const line of group.children)assert(line.geometry.getAttribute('position').array.every(Number.isFinite));
 for(const batch of a.batches.values())for(const m of batch.transforms)assert(m.elements.every(Number.isFinite));
});
console.log('Catenary:',layout.paths.length,'mapped track sections;',layout.portals.length,'portals;',group.children.reduce((n,line)=>n+line.geometry.getAttribute('position').count/2,0),'wire segments');

test('both Shinkansen pantographs reach the shared contact height',()=>{
 for(const type of ['n700','e7']){const {group}=makeCar(type,false,true);const bounds=new THREE.Box3().setFromObject(group);assert(Math.abs(bounds.max.y-CONTACT_HEIGHT)<1e-5);}
});
