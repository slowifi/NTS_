import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRandomUnpicked } from '../js/draw.js';

const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('이미 뽑힌 글은 후보에서 제외된다', () => {
  const picked = pickRandomUnpicked(entries, new Set(['a', 'c']), () => 0);
  assert.equal(picked.id, 'b');
});

test('남은 후보 중 random 값에 따라 고른다', () => {
  assert.equal(pickRandomUnpicked(entries, new Set(), () => 0).id, 'a');
  assert.equal(pickRandomUnpicked(entries, new Set(), () => 0.99).id, 'c');
});

test('모두 뽑혔으면 null을 반환한다', () => {
  assert.equal(pickRandomUnpicked(entries, new Set(['a', 'b', 'c'])), null);
});

test('글이 없으면 null을 반환한다', () => {
  assert.equal(pickRandomUnpicked([], new Set()), null);
});
