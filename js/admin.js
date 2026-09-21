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