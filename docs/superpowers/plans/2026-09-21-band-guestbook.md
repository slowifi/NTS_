# 밴드 공연 방명록 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공연 당일 하루 운영할, 실시간으로 갱신되는 방명록 웹페이지(작성/조회, 1인 1글)와 밴드 전용 랜덤 뽑기 관리자 페이지(중복 당첨 없음)를 만든다.

**Architecture:** 정적 HTML/CSS/JS 프런트엔드가 브라우저에서 Firebase Firestore SDK로 직접 읽고 쓴다. 백엔드 서버는 없다. 1인 1글은 "이름_전화4자리" 문서 ID + 수정 금지 규칙으로, 중복 당첨 방지는 `picks/{글ID}` 생성 전용 컬렉션으로 서버 단에서 보장한다. 순수 로직은 Node 내장 테스트 러너로 단위 테스트하고, Firestore 연동은 수동 통합 테스트로 검증한다.

**Tech Stack:** 순수 HTML/CSS/JavaScript(ES 모듈), Firebase Firestore(CDN SDK v10.13.2), Vercel(정적 호스팅), Node.js 내장 `node:test`(단위 테스트용, 배포에는 불필요)

**Spec:** `docs/superpowers/specs/2026-09-21-band-guestbook-design.md`

## Global Constraints

- 전체 전화번호는 절대 수집하지 않는다 — 뒤 4자리만 입력받는다.
- 이름 최대 20자(공백 제거 후), `/` 포함 불가. 메시지 최대 200자.
- 이름은 모든 공백을 제거해 저장·비교한다 (`홍 길동` → `홍길동`).
- 글 문서 ID = `공백 제거한 이름 + "_" + 전화4자리` (예: `홍길동_1234`).
- 글/당첨 기록의 수정·삭제 기능은 만들지 않는다 (규칙에서 `update`, `delete` 전면 차단).
- 공개 화면 이름 형식: 첫 글자 + 나머지 글자 수만큼 `x` + ` (전화4자리)`. 예: `홍xx (1234)`.
- 관리자 화면 이름 형식: 실명 그대로 + ` (전화4자리)`. 예: `홍길동 (1234)`.
- 중복 작성 안내 문구: `이미 방명록을 남기셨어요.`
- 관리자 비밀번호는 클라이언트 측 문자열 비교로 충분하다 (실수 방지 목적).
- Firestore SDK는 `https://www.gstatic.com/firebasejs/10.13.2/` CDN에서 ES 모듈로 import.

---

### Task 1: 프로젝트 스캐폴딩 + 이름 마스킹 유틸리티

**Files:**
- Create: `package.json`
- Create: `js/mask.js`
- Test: `tests/mask.test.js`

**Interfaces:**
- Produces: `maskEntry(name: string, phone4: string): string` — Task 5의 공개 목록 렌더링에서 사용.

- [ ] **Step 1: `package.json` 생성**

```json
{
  "name": "band-guestbook",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성 (`tests/mask.test.js`)**

```js
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
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `js/mask.js`를 찾을 수 없다는 에러 (Cannot find module)

- [ ] **Step 4: 최소 구현 작성 (`js/mask.js`)**

```js
export function maskEntry(name, phone4) {
  const trimmed = (name ?? '').trim();
  const surname = trimmed.slice(0, 1);
  const masked = 'x'.repeat(Math.max(trimmed.length - 1, 0));
  return `${surname}${masked} (${phone4})`;
}
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS (4개 통과)

- [ ] **Step 6: 커밋**

```bash
git add package.json js/mask.js tests/mask.test.js
git commit -m "feat: add name masking utility"
```

---

### Task 2: 이름 정규화 + 글 문서 ID 생성

**Files:**
- Create: `js/entry-id.js`
- Test: `tests/entry-id.test.js`

**Interfaces:**
- Produces:
  - `normalizeName(name: string): string` — 모든 공백 제거. Task 3, 5에서 사용.
  - `entryIdFor(name: string, phone4: string): string` — `normalizeName(name) + "_" + phone4`. Task 5에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성 (`tests/entry-id.test.js`)**

```js
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
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `js/entry-id.js`를 찾을 수 없다는 에러

- [ ] **Step 3: 최소 구현 작성 (`js/entry-id.js`)**

```js
export function normalizeName(name) {
  return (name ?? '').replace(/\s+/g, '');
}

export function entryIdFor(name, phone4) {
  return `${normalizeName(name)}_${phone4}`;
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS (누적 9개 통과)

- [ ] **Step 5: 커밋**

```bash
git add js/entry-id.js tests/entry-id.test.js
git commit -m "feat: add name normalization and entry id helper"
```

---

### Task 3: 입력 검증 유틸리티

**Files:**
- Create: `js/validate.js`
- Test: `tests/validate.test.js`

**Interfaces:**
- Consumes: `normalizeName` (Task 2)
- Produces: `validateEntry({ name, phone4, message }): { valid: boolean, errors: { name?: string, phone4?: string, message?: string } }`, `NAME_MAX_LENGTH = 20`, `MESSAGE_MAX_LENGTH = 200` — Task 5의 폼 제출에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성 (`tests/validate.test.js`)**

```js
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
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `js/validate.js`를 찾을 수 없다는 에러

- [ ] **Step 3: 최소 구현 작성 (`js/validate.js`)**

```js
import { normalizeName } from './entry-id.js';

export const NAME_MAX_LENGTH = 20;
export const MESSAGE_MAX_LENGTH = 200;

export function validateEntry({ name, phone4, message }) {
  const errors = {};
  const normalizedName = normalizeName(name);
  const trimmedMessage = (message ?? '').trim();

  if (normalizedName.length === 0) {
    errors.name = '이름을 입력해주세요.';
  } else if (normalizedName.length > NAME_MAX_LENGTH) {
    errors.name = `이름은 ${NAME_MAX_LENGTH}자 이하로 입력해주세요.`;
  } else if (normalizedName.includes('/')) {
    errors.name = '이름에 / 문자는 쓸 수 없어요.';
  }

  if (!/^\d{4}$/.test(phone4 ?? '')) {
    errors.phone4 = '전화번호 뒤 4자리를 숫자 4자리로 입력해주세요.';
  }

  if (trimmedMessage.length === 0) {
    errors.message = '메시지를 입력해주세요.';
  } else if (trimmedMessage.length > MESSAGE_MAX_LENGTH) {
    errors.message = `메시지는 ${MESSAGE_MAX_LENGTH}자 이하로 입력해주세요.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS (누적 17개 통과)

- [ ] **Step 5: 커밋**

```bash
git add js/validate.js tests/validate.test.js
git commit -m "feat: add entry input validation"
```

---

### Task 4: Firebase 설정 모듈 + Firestore 보안 규칙

**Files:**
- Create: `js/firebase-config.js`
- Create: `firestore.rules`

**Interfaces:**
- Produces: `db` (Firestore 인스턴스, named export) — Task 5, 6이 `import { db } from './firebase-config.js'`로 사용.

외부 Firebase 프로젝트가 아직 없으므로 자동 테스트 불가. 실제 키는 Task 7에서 채우고 수동 검증한다.

- [ ] **Step 1: `js/firebase-config.js` 작성 (키는 Task 7에서 교체)**

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱(웹)에서 발급받은 값으로 교체하세요.
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

- [ ] **Step 2: `firestore.rules` 작성**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /entries/{entryId} {
      allow read: if true;
      // 문서 ID를 이름_전화4자리로 강제하고 수정을 막아 1인 1글을 보장한다.
      allow create: if
        request.resource.data.keys().hasOnly(['name', 'phone4', 'message', 'createdAt']) &&
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 20 &&
        !request.resource.data.name.matches('.*/.*') &&
        request.resource.data.phone4 is string &&
        request.resource.data.phone4.matches('^[0-9]{4}$') &&
        request.resource.data.message is string &&
        request.resource.data.message.size() > 0 &&
        request.resource.data.message.size() <= 200 &&
        request.resource.data.createdAt == request.time &&
        entryId == request.resource.data.name + '_' + request.resource.data.phone4;
      allow update, delete: if false;
    }

    match /picks/{entryId} {
      allow read: if true;
      // 같은 글에 대한 두 번째 기록은 update로 간주되어 거부된다 → 중복 당첨 불가.
      allow create: if
        request.resource.data.keys().hasOnly(['pickedAt']) &&
        request.resource.data.pickedAt == request.time &&
        exists(/databases/$(database)/documents/entries/$(entryId));
      allow update, delete: if false;
    }
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add js/firebase-config.js firestore.rules
git commit -m "feat: add firebase config module and firestore security rules"
```

---

### Task 5: 공개 방명록 페이지 (`index.html`)

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/app.js`

**Interfaces:**
- Consumes: `maskEntry` (Task 1), `normalizeName`, `entryIdFor` (Task 2), `validateEntry` (Task 3), `db` (Task 4)
- Produces: `css/style.css`의 클래스(`entry-label`, `entry-message`, `form-message`, `error`, `success`, `picked`, `badge`, `pick-label`, `pick-message`) — Task 6에서 재사용.

- [ ] **Step 1: `css/style.css` 작성**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
}

input, textarea, button {
  font-size: 1rem;
  padding: 8px;
}

.form-message {
  min-height: 1.2em;
  margin: 0;
}

.error {
  color: #c0392b;
}

.success {
  color: #27ae60;
}

#entry-list, #admin-entry-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#entry-list li, #admin-entry-list li {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 12px;
}

#admin-entry-list li.picked {
  opacity: 0.5;
}

.badge {
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  background: #f1c40f;
  color: #000;
}

.entry-label {
  font-weight: bold;
}

.entry-message {
  margin: 4px 0 0;
  white-space: pre-wrap;
}

#pick-result {
  margin-top: 24px;
  padding: 24px;
  border: 2px solid #444;
  border-radius: 12px;
  text-align: center;
}

.pick-label {
  font-size: 1.5rem;
  font-weight: bold;
}

.pick-message {
  font-size: 1.2rem;
  margin-top: 8px;
  white-space: pre-wrap;
}
```

- [ ] **Step 2: `js/app.js` 작성**

```js
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { maskEntry } from './mask.js';
import { normalizeName, entryIdFor } from './entry-id.js';
import { validateEntry } from './validate.js';

const DUPLICATE_MESSAGE = '이미 방명록을 남기셨어요.';

const form = document.getElementById('entry-form');
const submitButton = form.querySelector('button[type="submit"]');
const listEl = document.getElementById('entry-list');
const messageEl = document.getElementById('form-message');

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = `form-message ${kind}`;
}

const entriesQuery = query(collection(db, 'entries'), orderBy('createdAt', 'desc'));

onSnapshot(entriesQuery, (snapshot) => {
  listEl.innerHTML = '';
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement('li');

    const label = document.createElement('span');
    label.className = 'entry-label';
    label.textContent = maskEntry(data.name, data.phone4);

    const message = document.createElement('p');
    message.className = 'entry-message';
    message.textContent = data.message;

    li.append(label, message);
    listEl.appendChild(li);
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('', '');

  const name = form.name.value;
  const phone4 = form.phone4.value;
  const message = form.message.value;

  const { valid, errors } = validateEntry({ name, phone4, message });
  if (!valid) {
    showMessage(Object.values(errors)[0], 'error');
    return;
  }

  const entryRef = doc(db, 'entries', entryIdFor(name, phone4));
  submitButton.disabled = true;

  try {
    const existing = await getDoc(entryRef);
    if (existing.exists()) {
      showMessage(DUPLICATE_MESSAGE, 'error');
      return;
    }

    await setDoc(entryRef, {
      name: normalizeName(name),
      phone4,
      message: message.trim(),
      createdAt: serverTimestamp(),
    });
    form.reset();
    showMessage('방명록이 등록되었어요!', 'success');
  } catch (err) {
    // 존재 확인과 저장 사이에 같은 사람이 먼저 저장하면 규칙이 수정으로 보고 거부한다.
    if (err.code === 'permission-denied') {
      showMessage(DUPLICATE_MESSAGE, 'error');
    } else {
      showMessage('등록에 실패했습니다. 다시 시도해주세요.', 'error');
    }
  } finally {
    submitButton.disabled = false;
  }
});
```

- [ ] **Step 3: `index.html` 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>공연 방명록</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <main>
    <h1>방명록</h1>
    <form id="entry-form">
      <label>
        이름
        <input type="text" name="name" maxlength="30" required />
      </label>
      <label>
        전화번호 뒤 4자리
        <input type="text" name="phone4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required />
      </label>
      <label>
        메시지
        <textarea name="message" maxlength="200" required></textarea>
      </label>
      <p id="form-message" class="form-message"></p>
      <button type="submit">남기기</button>
    </form>

    <ul id="entry-list"></ul>
  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

(이름 `maxlength`를 30으로 둔 이유: 공백 포함 입력을 허용하고, 실제 20자 제한은 공백 제거 후 `validateEntry`가 검사한다.)

- [ ] **Step 4: 수동 확인**

`npx serve .`로 로컬 서버를 띄우고 접속해, 빈 값/잘못된 전화번호 형식/이름에 `/` 입력 시 에러 메시지가 뜨는지 확인한다. (실제 등록·중복 차단은 Task 7 이후 확인)

- [ ] **Step 5: 커밋**

```bash
git add index.html css/style.css js/app.js
git commit -m "feat: add public guestbook page with one-entry-per-person"
```

---

### Task 6: 관리자(밴드) 랜덤 뽑기 페이지 (`admin.html`)

**Files:**
- Create: `js/draw.js`
- Test: `tests/draw.test.js`
- Create: `admin.html`
- Create: `js/admin.js`

**Interfaces:**
- Consumes: `db` (Task 4), `css/style.css` 클래스 (Task 5)
- Produces: `pickRandomUnpicked(entries: Array<{id: string}>, pickedIds: Set<string>, random?: () => number): {id: string, ...} | null`

- [ ] **Step 1: 실패하는 테스트 작성 (`tests/draw.test.js`)**

```js
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
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `js/draw.js`를 찾을 수 없다는 에러

- [ ] **Step 3: 최소 구현 작성 (`js/draw.js`)**

```js
export function pickRandomUnpicked(entries, pickedIds, random = Math.random) {
  const candidates = entries.filter((entry) => !pickedIds.has(entry.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS (누적 21개 통과)

- [ ] **Step 5: `js/admin.js` 작성**

```js
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { pickRandomUnpicked } from './draw.js';

// 공연 당일 실수로 들어오는 것을 막는 용도일 뿐, 높은 보안이 목적이 아니다.
const ADMIN_PASSWORD = 'REPLACE_ME';

const gate = document.getElementById('password-gate');
const passwordForm = document.getElementById('password-form');
const passwordError = document.getElementById('password-error');
const panel = document.getElementById('admin-panel');
const listEl = document.getElementById('admin-entry-list');
const pickButton = document.getElementById('pick-button');
const resultEl = document.getElementById('pick-result');

let entries = [];
let pickedIds = new Set();
let picking = false;

function adminLabel(entry) {
  return `${entry.name} (${entry.phone4})`;
}

function render() {
  listEl.innerHTML = '';
  entries.forEach((entry) => {
    const li = document.createElement('li');
    const isPicked = pickedIds.has(entry.id);
    if (isPicked) li.classList.add('picked');

    const label = document.createElement('span');
    label.className = 'entry-label';
    label.textContent = adminLabel(entry);

    li.appendChild(label);
    if (isPicked) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '당첨됨';
      li.appendChild(badge);
    }

    const message = document.createElement('p');
    message.className = 'entry-message';
    message.textContent = entry.message;
    li.appendChild(message);

    listEl.appendChild(li);
  });

  const remaining = entries.filter((entry) => !pickedIds.has(entry.id)).length;
  pickButton.disabled = picking || remaining === 0;
  pickButton.textContent = `랜덤 뽑기 (남은 후보 ${remaining}개)`;
}

function showResult(entry) {
  resultEl.hidden = false;
  resultEl.innerHTML = '';

  const label = document.createElement('div');
  label.className = 'pick-label';
  label.textContent = adminLabel(entry);

  const message = document.createElement('p');
  message.className = 'pick-message';
  message.textContent = entry.message;

  resultEl.append(label, message);
}

function showResultError(text) {
  resultEl.hidden = false;
  resultEl.textContent = text;
}

passwordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (passwordForm.password.value === ADMIN_PASSWORD) {
    gate.hidden = true;
    panel.hidden = false;
  } else {
    passwordError.textContent = '비밀번호가 올바르지 않습니다.';
  }
});

onSnapshot(query(collection(db, 'entries'), orderBy('createdAt', 'desc')), (snapshot) => {
  entries = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  render();
});

onSnapshot(collection(db, 'picks'), (snapshot) => {
  pickedIds = new Set(snapshot.docs.map((docSnap) => docSnap.id));
  render();
});

pickButton.addEventListener('click', async () => {
  const picked = pickRandomUnpicked(entries, pickedIds);
  if (!picked) return;

  picking = true;
  render();

  try {
    // 기록에 성공한 경우에만 발표한다. 다른 기기가 먼저 기록했다면 규칙이 거부한다.
    await setDoc(doc(db, 'picks', picked.id), { pickedAt: serverTimestamp() });
    showResult(picked);
  } catch (err) {
    showResultError('다른 기기에서 먼저 뽑힌 글이에요. 다시 눌러주세요.');
  } finally {
    picking = false;
    render();
  }
});
```

- [ ] **Step 6: `admin.html` 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>방명록 관리자</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <main>
    <h1>랜덤 뽑기 (관리자)</h1>

    <section id="password-gate">
      <form id="password-form">
        <label>
          비밀번호
          <input type="password" name="password" required />
        </label>
        <p id="password-error" class="form-message error"></p>
        <button type="submit">입장</button>
      </form>
    </section>

    <section id="admin-panel" hidden>
      <button id="pick-button" disabled>랜덤 뽑기</button>
      <div id="pick-result" hidden></div>
      <h2>전체 목록</h2>
      <ul id="admin-entry-list"></ul>
    </section>
  </main>
  <script type="module" src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 7: 수동 확인**

로컬 서버에서 `admin.html`을 열어, 틀린 비밀번호 입력 시 에러가 뜨고 올바른 비밀번호 입력 시 패널이 보이는지 확인한다. (실제 데이터 연동은 Task 7 이후)

- [ ] **Step 8: 커밋**

```bash
git add js/draw.js tests/draw.test.js admin.html js/admin.js
git commit -m "feat: add admin random-pick page excluding already-picked entries"
```

---

### Task 7: Firebase/Vercel 배포 설정 + 통합 검증

**Files:**
- Modify: `js/firebase-config.js` (`REPLACE_ME` → 실제 값)
- Modify: `js/admin.js` (`ADMIN_PASSWORD` → 실제 비밀번호)
- Create: `README.md`

- [ ] **Step 1: Firebase 프로젝트 준비**

1. https://console.firebase.google.com 에서 새 프로젝트 생성
2. "Firestore Database" → "데이터베이스 만들기" → 프로덕션 모드 → 리전 선택(예: `asia-northeast3`)
3. "규칙" 탭에 `firestore.rules` 내용을 붙여넣고 "게시"
4. 프로젝트 설정(톱니바퀴) → "일반" → "내 앱"에서 웹 앱(`</>`) 추가 → `firebaseConfig` 값 복사

- [ ] **Step 2: `js/firebase-config.js`의 `REPLACE_ME` 값을 Step 1에서 복사한 값으로 교체**

- [ ] **Step 3: `js/admin.js`의 `ADMIN_PASSWORD`를 원하는 비밀번호로 교체**

- [ ] **Step 4: `README.md` 작성**

````markdown
# 밴드 공연 방명록

공연 당일 하루만 운영하는 실시간 방명록 페이지.

- `index.html`: 관객용 방명록 (이름+전화 뒤 4자리당 1개)
- `admin.html`: 밴드용 랜덤 뽑기 (한 번 뽑힌 글은 제외)

## 로컬에서 확인하기

```bash
npx serve .
```

## 단위 테스트

```bash
npm test
```

## 배포 (Vercel)

1. https://vercel.com 가입/로그인
2. 이 폴더에서 `npx vercel` 실행 → 안내에 따라 새 프로젝트로 배포
   (빌드 설정 불필요, 정적 파일 그대로 서빙됨)
3. 배포 후 나오는 URL(`https://<프로젝트명>.vercel.app`)을 QR코드로 만들어 공유

## 공연 당일 체크리스트

- [ ] QR 링크로 `index.html` 접속 확인
- [ ] 테스트 글 작성 → 다른 기기에서 바로 보이는지 확인
- [ ] 같은 이름+번호로 다시 작성 시 "이미 방명록을 남기셨어요." 안내 확인
- [ ] `admin.html` 비밀번호 입장, 랜덤 뽑기, 뽑힌 글 "당첨됨" 표시 확인
- [ ] 테스트 데이터는 Firebase 콘솔에서 `entries`, `picks` 문서 직접 삭제
````

- [ ] **Step 5: 통합 검증**

1. `npx serve .` 실행, 탭 2개(또는 폰+PC)로 `index.html` 접속
2. 한쪽에서 글 작성 → 다른 쪽에 새로고침 없이 나타나는지 확인
3. 같은 이름+번호로 재작성 → "이미 방명록을 남기셨어요." 확인. `홍 길동`처럼 공백만 다르게 넣어도 차단되는지 확인
4. `admin.html` 입장 → 실명으로 목록이 보이는지 확인 → "랜덤 뽑기" 반복 클릭 → 뽑힌 글이 "당첨됨"으로 표시되고 다시 뽑히지 않는지, 남은 후보 수가 줄어드는지 확인
5. `admin.html` 새로고침 후에도 "당첨됨" 상태와 남은 후보 수가 유지되는지 확인
6. 모두 뽑히면 버튼이 비활성화되는지 확인
7. `npx vercel` 배포 후 실제 URL로 1~6 재확인 (모바일 포함)

- [ ] **Step 6: 커밋**

```bash
git add js/firebase-config.js js/admin.js README.md
git commit -m "chore: wire up firebase project config and deployment docs"
```

**참고:** `firebaseConfig`의 `apiKey` 등은 Firebase 클라이언트 SDK 특성상 공개되어도 되는 값이다 (실제 접근 제어는 Security Rules가 담당). `ADMIN_PASSWORD`는 클라이언트 코드에 평문으로 존재해 개발자 도구로 확인 가능하다 (스펙의 "알려진 한계" 참고).
