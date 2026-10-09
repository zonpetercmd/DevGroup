// ============================================
// api/create-user.js — Create User Endpoint
// ============================================
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

// ✅ सिर्फ एक बार Firebase initialize करो (multiple init error से बचने के लिए)
function initFirebase() {
  if (admin.apps.length > 0) return;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log('✅ Firebase Admin initialized');
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ पहले Firebase init करो
    initFirebase();
    const db = admin.database();

    const { email, password, name, firmId, role } = req.body || {};

    // ✅ Validation
    if (!email || !password || !name || !firmId) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // ✅ Check if user already exists (by email) in Realtime DB
    const usersRef = db.ref('users');
    const existing = await usersRef.orderByChild('email')
      .equalTo(email)
      .once('value');

    if (existing.exists()) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // ✅ Password hash बनाओ
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // ✅ Realtime DB में user बनाओ
    const newRef = usersRef.push();
    const uid = newRef.key;

    await newRef.set({
      email: email,
      name: name,
      firmId: firmId,
      role: role || 'user',
      passwordHash: hash,
      createdAt: Date.now()
    });

    // ✅ Firebase Authentication में user बनाओ
    // अगर पहले से है तो skip करो, वरना error देगा
    try {
      await admin.auth().createUser({
        uid: uid,
        email: email,
        displayName: name,
        password: password,
        disabled: false
      });
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-exists') {
        console.warn('⚠️ Firebase Auth user already exists, skipping:', email);
      } else {
        console.warn('⚠️ Firebase Auth create failed (non-fatal):', authErr.message);
      }
      // यहाँ throw नहीं करेंगे — क्योंकि Realtime DB में user बन गया है
    }

    res.json({
      success: true,
      uid: uid,
      message: 'User created successfully',
      user: {
        uid: uid,
        email: email,
        name: name,
        firmId: firmId,
        role: role || 'user'
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
