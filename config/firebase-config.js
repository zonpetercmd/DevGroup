// ============================================
// config/firebase-config.js
// Firebase Configuration & Initialization
// ============================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDMwE-Vg6Q10VUQi41fQpW-fQGIwNidqqg",
  authDomain: "dev-vidyalaya-erp.firebaseapp.com",
  databaseURL: "https://dev-vidyalaya-erp-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dev-vidyalaya-erp",
  storageBucket: "dev-vidyalaya-erp.firebasestorage.app",
  messagingSenderId: "677011391483",
  appId: "1:677011391483:web:f12522edb952292912815e"
};

export const STORAGE_MODE = {
  current: 'firebase'   // 'firebase' | 'local'
};

// ✅ Auto-initialize Firebase (agar pehle se init nahi hai)
export function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK load nahi hua. Check karein <script> tags.');
    return null;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('✅ Firebase initialized');
  }
  return firebase;
}

// ✅ Helper: Auth instance
export function getAuth() {
  initFirebase();
  return firebase.auth();
}

// ✅ Helper: Realtime Database instance
export function getDb() {
  initFirebase();
  return firebase.database();
}

// ✅ Helper: Storage instance
export function getStorage() {
  initFirebase();
  return firebase.storage();
}
