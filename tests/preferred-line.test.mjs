import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreferredLine, savePreferredLine, clearPreferredLine } from '../src/preferred-line.mjs';
const storage = () => { const values=new Map(); return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
test('an explicitly saved route is restored on a later visit and can be cleared',()=>{
 const store=storage(); assert.equal(readPreferredLine(store),null);
 savePreferredLine(store,'shinkansen'); assert.equal(readPreferredLine(store),'shinkansen');
 savePreferredLine(store,'chuo'); assert.equal(readPreferredLine(store),'chuo');
 clearPreferredLine(store); assert.equal(readPreferredLine(store),null);
});
test('unknown routes and all cannot overwrite the saved route',()=>{
 const store=storage(); savePreferredLine(store,'yamanote');
 for(const id of ['all','removed-line','',null,'<script>']) assert.throws(()=>savePreferredLine(store,id));
 assert.equal(readPreferredLine(store),'yamanote');
});
test('corrupt or unavailable storage does not prevent opening the app',()=>{
 for(const value of ['bad','null','{}','{"version":2,"lineId":"chuo"}','{"version":1,"lineId":"unknown"}']) assert.equal(readPreferredLine({getItem:()=>value}),null);
 assert.equal(readPreferredLine({getItem:()=>{throw Error('denied');}}),null);
 const denied={setItem:()=>{throw Error('denied');},removeItem:()=>{throw Error('denied');}};
 assert.throws(()=>savePreferredLine(denied,'chuo'));
 assert.throws(()=>clearPreferredLine(denied));
});
