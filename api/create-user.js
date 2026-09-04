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
    const { username, password, name, firmId, role } = req.body;

    if (!username || !password || !name || !firmId) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // ✅ Check if user already exists
    const usersRef = db.ref('users');
    const existing = await usersRef.orderByChild('username')
      .equalTo(username)
      .once('value');

    if (existing.exists()) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // ✅ Create password hash
    const hash = await bcrypt.hash(password, 10);
    const newRef = usersRef.push();
    const uid = newRef.key;

    // ✅ Save to database
    await newRef.set({
      username,
      name,
      firmId,
      role: role || 'user',
      passwordHash: hash,
      createdAt: Date.now()
    });

    // ✅ ✅ ✅ CRITICAL: Create user in Firebase Authentication
    try {
      await admin.auth().createUser({
        uid: uid,
        displayName: name,
        password: password,  // ✅ Password bhi set karein
        disabled: false
      });
      console.log(`✅ User ${username} created in Firebase Auth with UID: ${uid}`);
    } catch (authError) {
      console.error('❌ Firebase Auth error:', authError);
      // Agar auth fail ho toh database se user delete karein
      await newRef.remove();
      return res.status(500).json({ error: 'Failed to create user in authentication: ' + authError.message });
    }

    res.json({
      success: true,
      uid: uid,
      message: 'User created successfully in both Database and Authentication'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
