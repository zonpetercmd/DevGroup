const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

module.exports = async (req, res) => {
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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // ✅ Find user in database
    const usersRef = db.ref('users');
    const snapshot = await usersRef.orderByChild('username')
      .equalTo(username)
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

    // ✅ Check if passwordHash exists
    if (!userData.passwordHash) {
      console.error(`❌ passwordHash missing for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ✅ Compare password with hash
    const isValid = await bcrypt.compare(password, userData.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ✅ Create custom token
    const token = await admin.auth().createCustomToken(uid, {
      firmId: userData.firmId,
      role: userData.role || 'user'
    });

    res.json({
      success: true,
      token: token,
      user: {
        uid: uid,
        username: userData.username,
        name: userData.name,
        firmId: userData.firmId,
        role: userData.role || 'user'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
