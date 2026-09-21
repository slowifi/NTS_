import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱(웹)에서 발급받은 값으로 교체하세요.
const firebaseConfig = {
  apiKey: "AIzaSyC6gTJYKj6oANYa7jr9lle-kdw76PDK5bE",
  authDomain: "nts2026.firebaseapp.com",
  projectId: "nts2026",
  storageBucket: "nts2026.firebasestorage.app",
  messagingSenderId: "618068905368",
  appId: "1:618068905368:web:c0234229b2722dbb9fefed"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);