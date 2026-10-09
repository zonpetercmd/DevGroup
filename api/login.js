// ============================================
// api/login.js — Login Endpoint (Fixed)
// ============================================
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

// ✅ सिर्फ एक बार Firebase initialize करो
function initFirebase() {
  if (admin.apps.length > 0) {
    return; // पहले से initialized है
  }
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase init failed:', err.message);
    throw err;
  }
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // सिर्फ POST allow करो
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ पहले Firebase init करो
    initFirebase();

    // ✅ अब db लो
    const db = admin.database();

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // ✅ Email से user खोजो
    const snapshot = await db.ref('users')
      .orderByChild('email')
      .equalTo(email)
      .once('value');

    if (!snapshot.exists()) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let userData = null;
    let uid = null;

    snapshot.forEach((child) => {
      userData = child.val();
      uid = child.key;
    });

    if (!userData || !userData.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ✅ Password verify करो
    const isValid = await bcrypt.compare(password, userData.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ✅ Custom Token बनाओ
    const token = await admin.auth().createCustomToken(uid, {
      firmId: userData.firmId || '',
      role: userData.role || 'user'
    });

    res.json({
      success: true,
      token: token,
      user: {
        uid: uid,
        email: userData.email,
        name: userData.name || '',
        firmId: userData.firmId || '',
        role: userData.role || 'user'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
