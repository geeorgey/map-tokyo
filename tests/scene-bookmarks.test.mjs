import test from 'node:test';
import assert from 'node:assert/strict';
import {BOOKMARK_KEY,readBookmarks,addBookmark,removeBookmark} from '../src/scene-bookmarks.mjs';
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
const hash='#scene=1,-115,35,-1.5,0.1,1';
test('bookmarks survive a fresh read, preserve pose and names, and delete only the chosen entry',()=>{
 const s=storage();addBookmark(s,{id:'a',name:' 北ドームの夕景 ',hash});addBookmark(s,{id:'b',name:'正面',hash:hash.replace('35','40')});
 assert.equal(readBookmarks(s)[1].name,'北ドームの夕景');assert.equal(readBookmarks(s)[1].hash,hash);
 assert.equal(removeBookmark(s,'a').length,1);assert.equal(readBookmarks(s)[0].id,'b');
});
test('full and duplicate saves never silently overwrite existing bookmarks',()=>{
 const s=storage();for(let i=0;i<5;i++)addBookmark(s,{id:String(i),name:'景色'+i,hash:hash.replace('35',String(35+i))});
 const before=s.getItem(BOOKMARK_KEY);assert.throws(()=>addBookmark(s,{id:'x',name:'追加',hash:hash.replace('35','55')}),/5件/);assert.equal(s.getItem(BOOKMARK_KEY),before);
 assert.throws(()=>addBookmark(s,{id:'x',name:'重複',hash}),/すでに/);
});
test('invalid saved poses are ignored and storage failures do not report a successful save',()=>{
 const s=storage();s.setItem(BOOKMARK_KEY,JSON.stringify([{id:'bad',name:'bad',hash:'#scene=1,NaN,0,0,0,0'}]));assert.deepEqual(readBookmarks(s),[]);
 const blocked={getItem:()=>null,setItem:()=>{throw new Error('quota');}};assert.throws(()=>addBookmark(blocked,{id:'a',name:'景色',hash}),/quota/);
 s.setItem(BOOKMARK_KEY,'not-json');assert.throws(()=>addBookmark(s,{id:'a',name:'景色',hash}));assert.equal(s.getItem(BOOKMARK_KEY),'not-json');
});
