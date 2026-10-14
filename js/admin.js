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
const ADMIN_PASSWORD = 'admin';

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

// 당첨 기록은 원본 글을 지우지 않고 picks/{글 ID}에 따로 남긴다.
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
    // 기록에 성공해야만 발표한다. 다른 기기가 먼저 기록했다면 규칙이 거부한다.
    await setDoc(doc(db, 'picks', picked.id), { pickedAt: serverTimestamp() });
    showResult(picked);
  } catch (err) {
    console.error(err);
    resultEl.hidden = false;
    resultEl.textContent = '기록에 실패했어요. 다시 눌러주세요.';
  } finally {
    picking = false;
    render();
  }
});
