import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../js/validate.js';

test('이름/전화4자리/메시지가 모두 올바르면 통과한다', () => {
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '1234', message: '축하해요!' });
  assert.equal(valid, true);
  assert.deepEqual(errors, {});
});

test('이름이 공백뿐이면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '   ', phone4: '1234', message: '안녕' });
  assert.equal(valid, false);
  assert.ok(errors.name);
});

test('공백 제거 후 이름이 20자를 넘으면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '가'.repeat(21), phone4: '1234', message: '안녕' });
  assert.equal(valid, false);
  assert.ok(errors.name);
});

test('공백 제거 후 20자 이하면 원본에 공백이 많아도 통과한다', () => {
  const { valid } = validateEntry({ name: '가 '.repeat(20), phone4: '1234', message: '안녕' });
  assert.equal(valid, true);
});

test('이름에 /가 있으면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '홍/길동', phone4: '1234', message: '안녕' });
  assert.equal(valid, false);
  assert.ok(errors.name);
});

test('전화번호 4자리가 숫자 4개가 아니면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '12a4', message: '안녕' });
  assert.equal(valid, false);
  assert.ok(errors.phone4);
});

test('메시지가 비어있으면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '1234', message: '  ' });
  assert.equal(valid, false);
  assert.ok(errors.message);
});

test('메시지가 200자를 넘으면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '1234', message: 'a'.repeat(201) });
  assert.equal(valid, false);
  assert.ok(errors.message);
});
