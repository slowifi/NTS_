import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit, // 새로 추가
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { maskEntry } from './mask.js';
import { normalizeName, entryIdFor } from './entry-id.js';
import { validateEntry } from './validate.js';
import { layoutCards } from './layout.js';

const DUPLICATE_MESSAGE = '이미 방명록을 남기셨어요.';
const MY_ENTRY_KEY = 'myEntryId';

const form = document.getElementById('entry-form');
const submitButton = form.querySelector('button[type="submit"]');
const listEl = document.getElementById('entry-list');
const errorEl = document.getElementById('form-error');

let latestEntries = [];
let myEntry = null;
let lastWidth = 0;

function loadMyEntryId() {
  try {
    return localStorage.getItem(MY_ENTRY_KEY);
  } catch {
    return null;
  }
}

function saveMyEntryId(id) {
  try {
    if (id) localStorage.setItem(MY_ENTRY_KEY, id);
    else localStorage.removeItem(MY_ENTRY_KEY);
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에선 이번 방문 동안만 고정된다.
  }
}

function createCard(entry, isMine) {
  const li = document.createElement('li');
  if (isMine) li.classList.add('mine');

  const label = document.createElement('span');
  label.className = 'entry-label';
  label.textContent = maskEntry(entry.name, entry.phone4);

  const message = document.createElement('p');
  message.className = 'entry-message';
  message.textContent = entry.message;

  li.append(label, message);
  return li;
}

function render({ scrollToMine = false } = {}) {
  const others = latestEntries.filter((entry) => entry.id !== myEntry?.id);
  const cards = myEntry ? [myEntry, ...others] : others;

  listEl.innerHTML = '';
  // 실제 크기를 재야 겹침 없이 배치할 수 있으므로, 숨긴 채로 먼저 그린다.
  const items = cards.map((entry) => {
    const li = createCard(entry, entry === myEntry);
    li.style.visibility = 'hidden';
    listEl.appendChild(li);
    return li;
  });

  const { positions, height } = layoutCards(
    items.map((li) => ({ width: li.offsetWidth, height: li.offsetHeight })),
    {
      containerWidth: listEl.clientWidth,
      minHeight: parseFloat(getComputedStyle(listEl).minHeight) || 0,
      pinnedIndex: myEntry ? 0 : -1,
    },
  );

  items.forEach((li, i) => {
    li.style.left = `${positions[i].x}px`;
    li.style.top = `${positions[i].y}px`;
    li.style.visibility = '';
  });
  listEl.style.height = `${height}px`;
  lastWidth = listEl.clientWidth;

  if (scrollToMine && myEntry) {
    items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

const entriesRef = collection(db, 'entries');
// 최신 글 15개까지만 가져오도록 쿼리 수정
const entriesQuery = query(entriesRef, orderBy('createdAt', 'desc'), limit(15));

onSnapshot(entriesQuery, (snapshot) => {
  latestEntries = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  render();
});

// 내 글은 최신 15개에서 밀려나도 계속 보이도록 따로 불러온다.
const storedId = loadMyEntryId();
if (storedId) {
  getDoc(doc(db, 'entries', storedId))
    .then((snap) => {
      if (snap.exists()) {
        myEntry = { id: snap.id, ...snap.data() };
        render();
      } else {
        saveMyEntryId(null);
      }
    })
    .catch((err) => console.error(err));
}

// 모바일은 스크롤할 때 주소창이 접히면서 높이만 바뀌므로, 폭이 바뀔 때만 다시 배치한다.
window.addEventListener('resize', () => {
  if (listEl.clientWidth !== lastWidth) render();
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

  // 같은 이름+번호는 같은 문서 ID가 되고, 보안 규칙이 덮어쓰기를 막아 1인 1글이 된다.
  const entryRef = doc(db, 'entries', entryIdFor(name, phone4));
  const newEntry = {
    name: normalizeName(name),
    phone4,
    message: message.trim(),
  };
  const previousMyEntry = myEntry;
  submitButton.disabled = true;

  try {
    const existing = await getDoc(entryRef);
    if (existing.exists()) {
      errorEl.textContent = DUPLICATE_MESSAGE;
      return;
    }

    // 저장 직후 실시간 목록이 먼저 갱신되므로, 그 전에 내 글로 지정해야 카드가 튀지 않는다.
    myEntry = { id: entryRef.id, ...newEntry };
    await setDoc(entryRef, { ...newEntry, createdAt: serverTimestamp() });
    saveMyEntryId(entryRef.id);
    form.reset();
    render({ scrollToMine: true });
  } catch (err) {
    console.error(err);
    myEntry = previousMyEntry;
    render();
    // 확인과 저장 사이에 같은 사람이 먼저 저장하면 규칙이 덮어쓰기로 보고 거부한다.
    errorEl.textContent = err.code === 'permission-denied'
      ? DUPLICATE_MESSAGE
      : '등록에 실패했습니다. 다시 시도해주세요.';
  } finally {
    submitButton.disabled = false;
  }
});
