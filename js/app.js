import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit, // 새로 추가
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { maskEntry } from './mask.js';
import { validateEntry } from './validate.js';

const form = document.getElementById('entry-form');
const listEl = document.getElementById('entry-list');
const errorEl = document.getElementById('form-error');

const entriesRef = collection(db, 'entries');
// 최신 글 15개까지만 가져오도록 쿼리 수정
const entriesQuery = query(entriesRef, orderBy('createdAt', 'desc'), limit(15));

onSnapshot(entriesQuery, (snapshot) => {
  listEl.innerHTML = '';
  
  // 이미 배치된 카드들의 좌표를 저장할 배열
  const placedPositions = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement('li');

    // 겹침 방지 배치 로직
    let randomX, randomY;
    let isOverlapping = true;
    let attempts = 0;

    // 빈 공간을 찾을 때까지 최대 50번 반복해서 랜덤 좌표 생성
    while (isOverlapping && attempts < 50) {
      randomX = Math.floor(Math.random() * 60); // 가로 0~60%
      randomY = Math.floor(Math.random() * 75); // 세로 0~75%

      // 기존 카드들과의 거리 체크 (가로 35%, 세로 15% 이내로 가까우면 겹친 것으로 판단)
      isOverlapping = placedPositions.some(pos => 
        Math.abs(pos.x - randomX) < 35 && Math.abs(pos.y - randomY) < 15
      );
      attempts++;
    }
    
    // 최종 결정된 좌표를 저장해 다음 카드 배치 때 참고
    placedPositions.push({ x: randomX, y: randomY });

    li.style.left = `${randomX}%`;
    li.style.top = `${randomY}%`;

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
    console.error(err);
    errorEl.textContent = '등록에 실패했습니다. 다시 시도해주세요.';
  }
});