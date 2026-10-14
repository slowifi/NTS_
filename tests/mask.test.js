import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskEntry } from '../js/mask.js';

test('3글자 이름은 첫 글자만 남고 나머지는 x로 마스킹된다', () => {
  assert.equal(maskEntry('홍길동', '1234'), '홍xx (1234)');
});

test('1글자 이름은 마스킹할 글자가 없다', () => {
  assert.equal(maskEntry('김', '5678'), '김 (5678)');
});

test('2글자 성씨는 근사치로 첫 글자만 성으로 인식한다', () => {
  assert.equal(maskEntry('남궁민수', '0000'), '남xxx (0000)');
});

test('이름 앞뒤 공백은 마스킹 전에 제거된다', () => {
  assert.equal(maskEntry('  홍길동  ', '1234'), '홍xx (1234)');
});
