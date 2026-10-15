import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCards } from '../js/layout.js';

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function overlapDepth(a, b) {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { x, y };
}

function assertNoDeepOverlap(sizes, positions, maxOverlap) {
  const rects = sizes.map((size, i) => ({ ...size, ...positions[i] }));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const depth = overlapDepth(rects[i], rects[j]);
      assert.ok(
        depth.x <= maxOverlap || depth.y <= maxOverlap,
        `카드 ${i}와 ${j}가 ${depth.x}x${depth.y}px 겹침`,
      );
    }
  }
}

const sizes = Array.from({ length: 15 }, (_, i) => ({ width: 220, height: 90 + (i % 4) * 40 }));

test('어떤 두 카드도 가로·세로 모두 10px 넘게 겹치지 않는다', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { positions } = layoutCards(sizes, {
      containerWidth: 448,
      minHeight: 400,
      random: seededRandom(seed),
    });
    assertNoDeepOverlap(sizes, positions, 10);
  }
});

test('random이 항상 0이어도(빈자리 탐색 실패) 겹치지 않게 아래로 쌓는다', () => {
  const { positions } = layoutCards(sizes, { containerWidth: 448, minHeight: 400, random: () => 0 });
  assertNoDeepOverlap(sizes, positions, 10);
});

test('모든 카드는 컨테이너 가로 범위 안에 놓인다', () => {
  const { positions } = layoutCards(sizes, { containerWidth: 448, random: seededRandom(7) });
  positions.forEach((pos, i) => {
    assert.ok(pos.x >= 0 && pos.x + sizes[i].width <= 448, `카드 ${i} x=${pos.x}`);
    assert.ok(pos.y >= 0);
  });
});

test('컨테이너 높이는 최소 높이 이상이고 모든 카드를 담는다', () => {
  const { positions, height } = layoutCards(sizes, { containerWidth: 448, minHeight: 300, random: seededRandom(3) });
  assert.ok(height >= 300);
  positions.forEach((pos, i) => assert.ok(pos.y + sizes[i].height <= height));
});

test('고정 카드는 맨 위 가운데에 놓인다', () => {
  const { positions } = layoutCards(sizes, {
    containerWidth: 448,
    pinnedIndex: 4,
    random: seededRandom(5),
  });
  assert.deepEqual(positions[4], { x: 114, y: 0 });
  assertNoDeepOverlap(sizes, positions, 10);
});

test('카드가 컨테이너보다 넓으면 왼쪽에 붙인다', () => {
  const { positions } = layoutCards([{ width: 300, height: 100 }], { containerWidth: 200, pinnedIndex: 0 });
  assert.deepEqual(positions[0], { x: 0, y: 0 });
});
