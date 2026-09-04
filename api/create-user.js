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
    const { email, password, name, firmId, role } = req.body;

    if (!email || !password || !name || !firmId) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // ✅ Email validation
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // ✅ Check if user already exists (by email)
    const usersRef = db.ref('users');
    const existing = await usersRef.orderByChild('email')
      .equalTo(email)
      .once('value');

    if (existing.exists()) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // ✅ Create password hash
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // ✅ Create user in database
    const newRef = usersRef.push();
    const uid = newRef.key;

    await newRef.set({
      email,
      name,
      firmId,
      role: role || 'user',
      passwordHash: hash,
      createdAt: Date.now()
    });

    // ✅ Create user in Firebase Authentication
    await admin.auth().createUser({
      uid: uid,
      email: email,
      displayName: name,
      password: password,
      disabled: false
    });

    res.json({
      success: true,
      uid: uid,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
