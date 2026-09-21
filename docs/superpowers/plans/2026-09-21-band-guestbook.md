# 밴드 공연 방명록 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공연 당일 하루 운영할, 실시간으로 갱신되는 방명록 웹페이지(작성/조회)와 밴드 전용 랜덤 뽑기 관리자 페이지를 만든다.

**Architecture:** 정적 HTML/CSS/JS 프런트엔드가 브라우저에서 Firebase Firestore SDK로 직접 읽고 쓴다. 백엔드 서버는 없다. 순수 로직(마스킹, 입력 검증)은 Node 내장 테스트 러너로 단위 테스트하고, Firestore 연동은 수동 통합 테스트로 검증한다.

**Tech Stack:** 순수 HTML/CSS/JavaScript(ES 모듈), Firebase Firestore(CDN SDK v10), Vercel(정적 호스팅), Node.js 내장 `node:test`(단위 테스트 실행용, 배포에는 불필요)

**Spec:** `docs/superpowers/specs/2026-09-21-band-guestbook-design.md`

## Global Constraints

- 전체 전화번호는 절대 수집하지 않는다 — 뒤 4자리만 입력받는다.
- 이름 최대 20자, 메시지 최대 200자.
- 글 수정/삭제 기능은 만들지 않는다 (Firestore 규칙에서 `update`, `delete`를 전면 차단).
- 관리자 비밀번호는 클라이언트 측 문자열 비교로 충분하다 (실수 방지 목적, 고보안 요구 아님).
- 마스킹 형식: 이름 첫 글자 + 나머지 글자 수만큼 `x` + ` (전화4자리)`. 예: `홍길동`/`1234` → `홍xx (1234)`.

---

### Task 1: 프로젝트 스캐폴딩 + 이름 마스킹 유틸리티

**Files:**
- Create: `package.json`
- Create: `js/mask.js`
- Test: `tests/mask.test.js`

**Interfaces:**
- Produces: `maskEntry(name: string, phone4: string): string` — 이후 Task 4, 5의 렌더링 코드가 이 함수를 사용한다.

- [ ] **Step 1: `package.json` 생성**

```json
{
  "name": "band-guestbook",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
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

Run: `node --test tests/`
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

Run: `node --test tests/`
Expected: PASS (4개 테스트 모두 통과)

- [ ] **Step 6: 커밋**

```bash
git add package.json js/mask.js tests/mask.test.js
git commit -m "feat: add name masking utility"
```

---

### Task 2: 입력 검증 유틸리티

**Files:**
- Create: `js/validate.js`
- Test: `tests/validate.test.js`

**Interfaces:**
- Produces: `validateEntry({ name, phone4, message }): { valid: boolean, errors: { name?: string, phone4?: string, message?: string } }`, `NAME_MAX_LENGTH: number`, `MESSAGE_MAX_LENGTH: number` — Task 4의 폼 제출 처리에서 사용.

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

test('이름이 비어있으면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '   ', phone4: '1234', message: '안녕' });
  assert.equal(valid, false);
  assert.ok(errors.name);
});

test('전화번호 4자리가 숫자 4개가 아니면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '12a4', message: '안녕' });
  assert.equal(valid, false);
  assert.ok(errors.phone4);
});

test('메시지가 비어있으면 실패한다', () => {
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '1234', message: '' });
  assert.equal(valid, false);
  assert.ok(errors.message);
});

test('메시지가 200자를 넘으면 실패한다', () => {
  const longMessage = 'a'.repeat(201);
  const { valid, errors } = validateEntry({ name: '홍길동', phone4: '1234', message: longMessage });
  assert.equal(valid, false);
  assert.ok(errors.message);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/`
Expected: FAIL — `js/validate.js`를 찾을 수 없다는 에러

- [ ] **Step 3: 최소 구현 작성 (`js/validate.js`)**

```js
export const NAME_MAX_LENGTH = 20;
export const MESSAGE_MAX_LENGTH = 200;

export function validateEntry({ name, phone4, message }) {
  const errors = {};
  const trimmedName = (name ?? '').trim();
  const trimmedMessage = (message ?? '').trim();

  if (trimmedName.length === 0) {
    errors.name = '이름을 입력해주세요.';
  } else if (trimmedName.length > NAME_MAX_LENGTH) {
    errors.name = `이름은 ${NAME_MAX_LENGTH}자 이하로 입력해주세요.`;
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

Run: `node --test tests/`
Expected: PASS (Task 1 테스트 포함 총 9개 통과)

- [ ] **Step 5: 커밋**

```bash
git add js/validate.js tests/validate.test.js
git commit -m "feat: add entry input validation"
```

---

### Task 3: Firebase 설정 모듈 + Firestore 보안 규칙

**Files:**
- Create: `js/firebase-config.js`
- Create: `firestore.rules`

**Interfaces:**
- Produces: `db` (Firestore 인스턴스, named export) — Task 4, 5가 `import { db } from './firebase-config.js'`로 사용.
- Consumes: 없음 (외부 Firebase 프로젝트 설정 값 필요 — Task 6에서 실제 값 채워 넣음)

이 태스크는 자동 테스트가 불가능하다 (외부 Firebase 프로젝트가 아직 없음). Firebase 콘솔에서 프로젝트를 만든 뒤 Task 6에서 실제 키를 채워 넣고 수동으로 검증한다.

- [ ] **Step 1: `js/firebase-config.js` 작성 (플레이스홀더 키 포함)**

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
      allow create: if
        request.resource.data.keys().hasOnly(['name', 'phone4', 'message', 'createdAt']) &&
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 20 &&
        request.resource.data.phone4 is string &&
        request.resource.data.phone4.matches('^[0-9]{4}$') &&
        request.resource.data.message is string &&
        request.resource.data.message.size() > 0 &&
        request.resource.data.message.size() <= 200 &&
        request.resource.data.createdAt == request.time;
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

### Task 4: 공개 방명록 페이지 (`index.html`)

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/app.js`

**Interfaces:**
- Consumes: `maskEntry` (Task 1), `validateEntry` (Task 2), `db` (Task 3)
- Produces: `css/style.css`의 클래스들(`entry-list`, `entry-label`, `entry-message`, `error` 등) — Task 5의 admin 페이지가 재사용.

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

.error {
  color: #c0392b;
  min-height: 1.2em;
  margin: 0;
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
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { maskEntry } from './mask.js';
import { validateEntry } from './validate.js';

const form = document.getElementById('entry-form');
const listEl = document.getElementById('entry-list');
const errorEl = document.getElementById('form-error');

const entriesRef = collection(db, 'entries');
const entriesQuery = query(entriesRef, orderBy('createdAt', 'desc'));

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
  errorEl.textContent = '';

  const name = form.name.value;
  const phone4 = form.phone4.value;
  const message = form.message.value;

  const { valid, errors } = validateEntry({ name, phone4, message });
  if (!valid) {
    errorEl.textContent = Object.values(errors)[0];
    return;
  }

  try {
    await addDoc(entriesRef, {
      name: name.trim(),
      phone4,
      message: message.trim(),
      createdAt: serverTimestamp(),
    });
    form.reset();
  } catch (err) {
    errorEl.textContent = '등록에 실패했습니다. 다시 시도해주세요.';
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
        <input type="text" name="name" maxlength="20" required />
      </label>
      <label>
        전화번호 뒤 4자리
        <input type="text" name="phone4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required />
      </label>
      <label>
        메시지
        <textarea name="message" maxlength="200" required></textarea>
      </label>
      <p id="form-error" class="error"></p>
      <button type="submit">남기기</button>
    </form>

    <ul id="entry-list"></ul>
  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: 수동 확인**

`npx serve .`로 로컬 서버를 띄우고 브라우저로 접속해, 폼에 빈 값/잘못된 전화번호 형식을 넣었을 때 에러 메시지가 뜨는지 확인한다. (Firestore 키가 아직 플레이스홀더라 실제 등록은 Task 6 이후에 확인)

- [ ] **Step 5: 커밋**

```bash
git add index.html css/style.css js/app.js
git commit -m "feat: add public guestbook page"
```

---

### Task 5: 관리자(밴드) 랜덤 뽑기 페이지 (`admin.html`)

**Files:**
- Create: `admin.html`
- Create: `js/admin.js`

**Interfaces:**
- Consumes: `maskEntry` (Task 1), `db` (Task 3), `css/style.css`의 기존 클래스 (Task 4)

- [ ] **Step 1: `js/admin.js` 작성**

```js
import { db } from './firebase-config.js';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { maskEntry } from './mask.js';

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

passwordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (passwordForm.password.value === ADMIN_PASSWORD) {
    gate.hidden = true;
    panel.hidden = false;
  } else {
    passwordError.textContent = '비밀번호가 올바르지 않습니다.';
  }
});

const entriesQuery = query(collection(db, 'entries'), orderBy('createdAt', 'desc'));

onSnapshot(entriesQuery, (snapshot) => {
  entries = snapshot.docs.map((docSnap) => docSnap.data());

  listEl.innerHTML = '';
  entries.forEach((data) => {
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

  pickButton.disabled = entries.length === 0;
});

pickButton.addEventListener('click', () => {
  if (entries.length === 0) return;

  const index = Math.floor(Math.random() * entries.length);
  const picked = entries[index];

  resultEl.hidden = false;
  resultEl.innerHTML = '';

  const label = document.createElement('div');
  label.className = 'pick-label';
  label.textContent = maskEntry(picked.name, picked.phone4);

  const message = document.createElement('p');
  message.className = 'pick-message';
  message.textContent = picked.message;

  resultEl.append(label, message);
});
```

- [ ] **Step 2: `admin.html` 작성**

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
        <p id="password-error" class="error"></p>
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

- [ ] **Step 3: 수동 확인**

로컬 서버에서 `admin.html`을 열어, 틀린 비밀번호 입력 시 에러가 뜨고 올바른 비밀번호 입력 시 패널이 보이는지 확인한다. (실제 데이터 연동 확인은 Task 6 이후)

- [ ] **Step 4: 커밋**

```bash
git add admin.html js/admin.js
git commit -m "feat: add admin random-pick page"
```

---

### Task 6: Firebase/Vercel 배포 설정 + 통합 검증

**Files:**
- Modify: `js/firebase-config.js` (플레이스홀더 값을 실제 값으로 교체)
- Modify: `js/admin.js` (`ADMIN_PASSWORD` 실제 값으로 교체)
- Create: `README.md`

**Interfaces:** 없음 (배포/운영 문서화 태스크)

- [ ] **Step 1: Firebase 프로젝트 준비**

1. https://console.firebase.google.com 에서 새 프로젝트 생성
2. 왼쪽 메뉴 "Firestore Database" → "데이터베이스 만들기" → 프로덕션 모드 → 리전 선택(예: `asia-northeast3`)
3. "규칙" 탭에 `firestore.rules` 내용을 붙여넣고 "게시" 클릭
4. 프로젝트 설정(톱니바퀴) → "일반" 탭 → 하단 "내 앱"에서 웹 앱(`</>`) 추가 → 표시되는 `firebaseConfig` 객체 값을 복사

- [ ] **Step 2: `js/firebase-config.js`의 `REPLACE_ME` 값을 Step 1에서 복사한 실제 값으로 교체**

(코드 구조는 Task 3에서 작성한 그대로, 값만 교체)

- [ ] **Step 3: `js/admin.js`의 `ADMIN_PASSWORD`를 원하는 비밀번호 문자열로 교체**

- [ ] **Step 4: `README.md` 작성**

```markdown
# 밴드 공연 방명록

공연 당일 하루만 운영하는 실시간 방명록 페이지.

## 로컬에서 확인하기

\`\`\`bash
npx serve .
\`\`\`

## 단위 테스트

\`\`\`bash
npm test
\`\`\`

## 배포 (Vercel)

1. https://vercel.com 가입/로그인
2. 이 폴더에서: \`npx vercel\` 실행 → 안내에 따라 새 프로젝트로 배포
   (빌드 설정 불필요, 정적 파일 그대로 서빙됨)
3. 배포 완료 후 나오는 URL(`https://<프로젝트명>.vercel.app`)을 QR코드로 만들어 공유

## 공연 당일 체크리스트

- [ ] `index.html` 링크(QR)가 정상 접속되는지 확인
- [ ] 테스트 글 작성 후 다른 기기/탭에서 바로 보이는지 확인
- [ ] `admin.html`에 비밀번호로 입장되는지, 랜덤 뽑기가 동작하는지 확인
```

- [ ] **Step 5: 통합 검증**

1. `npx serve .`로 로컬 서버 실행
2. 브라우저 탭 2개(또는 폰+PC)로 `index.html` 접속, 한쪽에서 글 작성 → 다른 쪽에 새로고침 없이 나타나는지 확인
3. `admin.html`에서 방금 만든 비밀번호로 입장 → 같은 글 목록이 보이는지 확인 → "랜덤 뽑기" 클릭 → 마스킹된 이름+전화4자리+메시지가 크게 표시되는지 확인
4. `npx vercel`로 배포 후, 실제 배포 URL로 위 1~3 과정 재확인 (모바일 브라우저 포함)

- [ ] **Step 6: 커밋**

```bash
git add js/firebase-config.js js/admin.js README.md
git commit -m "chore: wire up firebase project config and deployment docs"
```

**참고:** `js/firebase-config.js`의 `apiKey` 등은 Firebase 클라이언트 SDK 특성상 공개되어도 되는 값이다 (실제 접근 제어는 Firestore Security Rules가 담당). 다만 `ADMIN_PASSWORD`는 클라이언트 코드에 평문으로 존재하므로, 브라우저 개발자 도구로 보면 누구나 알아낼 수 있다는 점은 감안한다 (본 설계에서 합의된 트레이드오프).
