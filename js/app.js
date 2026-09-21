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