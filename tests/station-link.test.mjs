import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStationLink, parseStationLink } from '../src/station-link.mjs';

test('station place and fractional light survive a fresh link without sender query or clock', () => {
  const url = new URL(makeStationLink('https://train.lvnsk.jp/?private=example', 'north', 1.234));
  assert.equal(url.search, '');
  assert.equal(url.pathname, '/');
  assert.deepEqual(parseStationLink(url.hash), { id: 'north', light: 1.234 });
  for (const id of ['central', 'north', 'south']) assert.equal(parseStationLink(new URL(makeStationLink(url.origin, id, 2)).hash).id, id);
});

test('malformed, conflicting and non-finite station links cannot change the scene', () => {
  for (const hash of ['#station=2,north,2', '#station=1,inside,2', '#station=1,south,3', '#station=1,south,-1', '#station=1,north,NaN', '#station=1,north,Infinity', '#station=1,north,', '#station=1,north,2,extra', '#station=1,north,2&station=1,south,1', '#station=1,north,2&scene=1', '#station=1,north,2&departure=1']) assert.equal(parseStationLink(hash), null, hash);
  assert.equal(makeStationLink('https://train.lvnsk.jp', 'inside', 0), null);
});
