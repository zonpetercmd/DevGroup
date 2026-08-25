// config/firebase-config.js
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDMwE-Vg6Q10VUQi41fQpW-fQGIwNidqqg",
    authDomain: "dev-vidyalaya-erp.firebaseapp.com",
    databaseURL: "https://dev-vidyalaya-erp-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dev-vidyalaya-erp",
    storageBucket: "dev-vidyalaya-erp.firebasestorage.app",
    messagingSenderId: "677011391483",
    appId: "1:677011391483:web:f12522edb952292912815e"
};

// 🔴 अभी LOCAL STORAGE use कर रहे हैं
// 🟢 Firebase पर Switch करने के लिए 'firebase' करें
export const STORAGE_MODE = {
    current: 'local'  // 'local' या 'firebase'
};
