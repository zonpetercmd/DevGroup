// js/storage.js - Firebase + Local Storage

import { FIREBASE_CONFIG, STORAGE_MODE } from '../config/firebase-config.js';
import { DEFAULT_FIRMS, STORAGE_KEYS, PROTECTED_FIRMS } from '../config/constants.js';

class Storage {
    constructor() {
        this.mode = STORAGE_MODE.current || 'firebase';  // ✅ Firebase mode
        this.rtdb = null;
        this.currentUser = null;
        this.currentFirmId = null;
        this._initFirebase();
        console.log(`📦 Storage initialized with ${this.mode} mode`);
    }

    _initFirebase() {
        if (this.mode === 'firebase' && typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
                console.log('🔥 Firebase initialized');
            }
            this.rtdb = firebase.database();
        }
    }

    // ==========================================
    // 🔐 AUTHENTICATION FUNCTIONS (CLASS KE ANDAR)
    // ==========================================

    // 🔐 LOGIN - Backend API call
    async login(username, password) {
        try {
            console.log('🔐 Attempting login for:', username);
            
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Firebase Custom Token se sign in
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signInWithCustomToken(data.token);
            }

            // Store user data
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('firmId', data.user.firmId);
            
            this.currentUser = data.user;
            this.currentFirmId = data.user.firmId;

            console.log('✅ Login successful:', data.user.username);
            return data.user;

        } catch (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
    }

    // 👤 GET CURRENT USER
    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch {
            return null;
        }
    }

    // 🏢 GET CURRENT FIRM ID
    getCurrentFirmId() {
        const user = this.getCurrentUser();
        return user?.firmId || localStorage.getItem('firmId') || 'DevVidyalaya';
    }

    // 🔒 AUTH CHECK
    requireAuth() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated. Please login.');
        }
        return user;
    }

    // 🚪 LOGOUT
    async logout() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
            }
        } catch (e) {
            console.warn('Firebase logout warning:', e);
        }
        localStorage.removeItem('user');
        localStorage.removeItem('firmId');
        this.currentUser = null;
        this.currentFirmId = null;
        console.log('👋 Logged out');
        window.location.href = 'login.html';
    }

    // 👤 CREATE USER (Admin only)
    async createUser(userData) {
        try {
            console.log('👤 Creating user:', userData.username);
            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create user');
            }
            console.log('✅ User created:', data.uid);
            return data;
        } catch (error) {
            console.error('❌ Create user error:', error);
            throw error;
        }
    }

    // ---------- FIRMWISE PATH HELPER ----------
    _getFirmPath(key) {
        const firmId = this.getCurrentFirmId();
        return `${key}/${firmId}`;
    }

    // ===== LOCAL STORAGE =====
    _getLocal(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch {
            return {};
        }
    }

    _setLocal(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    }

    _removeLocal(key) {
        localStorage.removeItem(key);
        return true;
    }

    // ===== FIREBASE =====
    async _getFirebase(key) {
        if (!this.rtdb) return {};
        try {
            // Agar key firm-wise hai toh path add karein
            const path = this._getFirmPath(key);
            const snap = await this.rtdb.ref(path).once('value');
            return snap.val() || {};
        } catch (error) {
            console.error(`❌ Firebase load error (${key}):`, error);
            return {};
        }
    }

    async _setFirebase(key, data) {
        if (!this.rtdb) return data;
        try {
            const path = this._getFirmPath(key);
            await this.rtdb.ref(path).set(data);
            console.log(`✅ Firebase saved: ${path}`);
            return data;
        } catch (error) {
            console.error(`❌ Firebase save error (${key}):`, error);
            return data;
        }
    }

    async _removeFirebase(key) {
        if (!this.rtdb) return true;
        try {
            const path = this._getFirmPath(key);
            await this.rtdb.ref(path).remove();
            return true;
        } catch {
            return true;
        }
    }

    // ===== PUBLIC METHODS =====
    async load(key) {
        // Public keys - bina firm path ke
        const publicKeys = ['users', 'firms', 'userPermissions'];
        if (publicKeys.includes(key)) {
            if (this.mode === 'firebase') {
                return await this._getFirebasePublic(key);
            }
            return this._getLocal(key);
        }

        if (this.mode === 'firebase') {
            return await this._getFirebase(key);
        }
        return this._getLocal(key);
    }

    async _getFirebasePublic(key) {
        if (!this.rtdb) return {};
        try {
            const snap = await this.rtdb.ref(key).once('value');
            return snap.val() || {};
        } catch (error) {
            console.error(`❌ Firebase load error (${key}):`, error);
            return {};
        }
    }

    async save(key, data) {
        const publicKeys = ['users', 'firms', 'userPermissions'];
        if (publicKeys.includes(key)) {
            if (this.mode === 'firebase') {
                return await this._setFirebasePublic(key, data);
            }
            return this._setLocal(key, data);
        }

        if (this.mode === 'firebase') {
            return await this._setFirebase(key, data);
        }
        return this._setLocal(key, data);
    }

    async _setFirebasePublic(key, data) {
        if (!this.rtdb) return data;
        try {
            await this.rtdb.ref(key).set(data);
            console.log(`✅ Firebase saved (public): ${key}`);
            return data;
        } catch (error) {
            console.error(`❌ Firebase save error (${key}):`, error);
            return data;
        }
    }

    async remove(key) {
        if (this.mode === 'firebase') {
            return await this._removeFirebase(key);
        }
        return this._removeLocal(key);
    }

    // ===== LOAD ALL DATA =====
    async loadAllData() {
        // Check authentication
        try {
            this.requireAuth();
        } catch (e) {
            console.warn('⚠️ Not authenticated, returning empty data');
            return this._getEmptyData();
        }

        const keys = [
            STORAGE_KEYS.FIRMS,
            STORAGE_KEYS.VOUCHERS,
            STORAGE_KEYS.DELETED,
            STORAGE_KEYS.EDIT_LOGS,
            STORAGE_KEYS.PARTIES,
            STORAGE_KEYS.SIGNATORIES,
            STORAGE_KEYS.EXPENSE_HEADS,
            STORAGE_KEYS.USERS,
            STORAGE_KEYS.VOUCHER_COUNTER,
            STORAGE_KEYS.BANK_ACCOUNTS,
            STORAGE_KEYS.PERMISSIONS
        ];

        const results = {};
        for (const key of keys) {
            results[key] = await this.load(key);
            console.log(`📥 Loaded ${key}:`, Object.keys(results[key] || {}).length);
        }

        // ✅ Expense Heads - Format
        const expenseHeads = results[STORAGE_KEYS.EXPENSE_HEADS] || {};
        const formattedExpenseHeads = {};
        Object.keys(expenseHeads).forEach(key => {
            const value = expenseHeads[key];
            if (Array.isArray(value)) {
                formattedExpenseHeads[key] = {
                    firm: this.getCurrentFirmId(),
                    subHeads: value
                };
            } else if (typeof value === 'object' && value.subHeads !== undefined) {
                formattedExpenseHeads[key] = value;
            } else {
                formattedExpenseHeads[key] = {
                    firm: this.getCurrentFirmId(),
                    subHeads: []
                };
            }
        });

        const allFirms = { ...DEFAULT_FIRMS, ...results[STORAGE_KEYS.FIRMS] };

        return {
            allFirms: allFirms,
            db: Object.values(results[STORAGE_KEYS.VOUCHERS] || {}).filter(v => v && v.status !== 'deleted'),
            deletedVouchers: Object.values(results[STORAGE_KEYS.DELETED] || {}),
            editLogs: Object.values(results[STORAGE_KEYS.EDIT_LOGS] || {}),
            parties: Object.values(results[STORAGE_KEYS.PARTIES] || {}),
            signatories: Object.values(results[STORAGE_KEYS.SIGNATORIES] || {}),
            expenseHeads: formattedExpenseHeads,
            allUsers: Object.values(results[STORAGE_KEYS.USERS] || {}),
            voucherCounter: results[STORAGE_KEYS.VOUCHER_COUNTER] || {},
            bankAccounts: results[STORAGE_KEYS.BANK_ACCOUNTS] || {},
            userPermissions: results[STORAGE_KEYS.PERMISSIONS] || {}
        };
    }

    _getEmptyData() {
        return {
            allFirms: DEFAULT_FIRMS,
            db: [],
            deletedVouchers: [],
            editLogs: [],
            parties: [],
            signatories: [],
            expenseHeads: {},
            allUsers: [],
            voucherCounter: {},
            bankAccounts: {},
            userPermissions: {}
        };
    }

    // ===== VOUCHER OPERATIONS =====
    async saveVoucher(voucher) {
        this.requireAuth();
        const key = STORAGE_KEYS.VOUCHERS;
        const data = await this.load(key);
        data[voucher.id] = voucher;
        await this.save(key, data);
        return voucher;
    }

    async deleteVoucher(id) {
        this.requireAuth();
        const key = STORAGE_KEYS.VOUCHERS;
        const data = await this.load(key);
        delete data[id];
        await this.save(key, data);
        return true;
    }

    async getVoucher(id) {
        this.requireAuth();
        const key = STORAGE_KEYS.VOUCHERS;
        const data = await this.load(key);
        return data[id] || null;
    }

    async getAllVouchers() {
        this.requireAuth();
        const key = STORAGE_KEYS.VOUCHERS;
        const data = await this.load(key);
        return Object.values(data);
    }

    // ===== REAL-TIME LISTENER =====
    onVoucherChange(callback) {
        if (this.mode === 'firebase' && this.rtdb) {
            try {
                this.requireAuth();
                const path = this._getFirmPath(STORAGE_KEYS.VOUCHERS);
                console.log('🔥 Firebase Realtime Listener started:', path);
                this.rtdb.ref(path).on('value', (snap) => {
                    const data = snap.val() || {};
                    const db = Object.values(data).filter(v => v && v.status !== 'deleted');
                    callback(db);
                });
            } catch (e) {
                console.warn('⚠️ Cannot start listener (not authenticated)');
            }
        } else {
            // Local Storage polling
            let lastData = '';
            const interval = setInterval(() => {
                const current = this._getLocal(STORAGE_KEYS.VOUCHERS);
                const currentStr = JSON.stringify(current);
                if (currentStr !== lastData) {
                    lastData = currentStr;
                    const db = Object.values(current).filter(v => v && v.status !== 'deleted');
                    callback(db);
                }
            }, 3000);
            
            return () => clearInterval(interval);
        }
    }

    // ===== REMOVE LISTENERS =====
    removeListeners() {
        if (this.rtdb) {
            try {
                const path = this._getFirmPath(STORAGE_KEYS.VOUCHERS);
                this.rtdb.ref(path).off();
            } catch (e) {
                // Ignore
            }
        }
    }

    // ===== EXPORT DATA =====
    async exportAllData() {
        this.requireAuth();
        const data = {
            firms: await this.load(STORAGE_KEYS.FIRMS),
            vouchers: await this.load(STORAGE_KEYS.VOUCHERS),
            deleted: await this.load(STORAGE_KEYS.DELETED),
            editLogs: await this.load(STORAGE_KEYS.EDIT_LOGS),
            parties: await this.load(STORAGE_KEYS.PARTIES),
            signatories: await this.load(STORAGE_KEYS.SIGNATORIES),
            expenseHeads: await this.load(STORAGE_KEYS.EXPENSE_HEADS),
            users: await this.load(STORAGE_KEYS.USERS),
            voucherCounter: await this.load(STORAGE_KEYS.VOUCHER_COUNTER),
            bankAccounts: await this.load(STORAGE_KEYS.BANK_ACCOUNTS),
            permissions: await this.load(STORAGE_KEYS.PERMISSIONS)
        };
        return data;
    }

    // ===== IMPORT DATA =====
    async importAllData(data) {
        this.requireAuth();
        const keys = [
            STORAGE_KEYS.FIRMS,
            STORAGE_KEYS.VOUCHERS,
            STORAGE_KEYS.DELETED,
            STORAGE_KEYS.EDIT_LOGS,
            STORAGE_KEYS.PARTIES,
            STORAGE_KEYS.SIGNATORIES,
            STORAGE_KEYS.EXPENSE_HEADS,
            STORAGE_KEYS.USERS,
            STORAGE_KEYS.VOUCHER_COUNTER,
            STORAGE_KEYS.BANK_ACCOUNTS,
            STORAGE_KEYS.PERMISSIONS
        ];
        for (const key of keys) {
            if (data[key]) {
                await this.save(key, data[key]);
            }
        }
        return true;
    }

    // ===== SET FIRM ID =====
    setFirmId(firmId) {
        this.currentFirmId = firmId;
        localStorage.setItem('firmId', firmId);
        console.log('🏢 Switched to firm:', firmId);
    }
}

export default Storage;
