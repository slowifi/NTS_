import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, entryIdFor } from '../js/entry-id.js';

test('이름의 앞뒤·중간 공백을 모두 제거한다', () => {
  assert.equal(normalizeName('  홍 길 동 '), '홍길동');
});

test('탭/줄바꿈 같은 공백 문자도 제거한다', () => {
  assert.equal(normalizeName('홍\t길\n동'), '홍길동');
});

test('null/undefined는 빈 문자열이 된다', () => {
  assert.equal(normalizeName(undefined), '');
});

test('글 ID는 정규화된 이름과 전화4자리를 _로 잇는다', () => {
  assert.equal(entryIdFor('홍 길동', '1234'), '홍길동_1234');
});

test('공백만 다른 같은 사람은 같은 ID가 된다', () => {
  assert.equal(entryIdFor('홍길동', '1234'), entryIdFor(' 홍 길동 ', '1234'));
});
