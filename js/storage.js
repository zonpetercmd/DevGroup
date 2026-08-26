// js/storage.js - Firebase + Local Storage

import { FIREBASE_CONFIG, STORAGE_MODE } from '../config/firebase-config.js';
import { DEFAULT_FIRMS, STORAGE_KEYS } from '../config/constants.js';

class Storage {
    constructor() {
        this.mode = STORAGE_MODE.current || 'local';
        this.rtdb = null;
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

    async _getFirebase(key) {
        if (!this.rtdb) return {};
        try {
            const snap = await this.rtdb.ref(key).once('value');
            return snap.val() || {};
        } catch (error) {
            console.error(`❌ Firebase load error (${key}):`, error);
            return {};
        }
    }

    async _setFirebase(key, data) {
        if (!this.rtdb) return data;
        try {
            await this.rtdb.ref(key).set(data);
            console.log(`✅ Firebase saved: ${key}`);
            return data;
        } catch (error) {
            console.error(`❌ Firebase save error (${key}):`, error);
            return data;
        }
    }

    async _removeFirebase(key) {
        if (!this.rtdb) return true;
        try {
            await this.rtdb.ref(key).remove();
            return true;
        } catch {
            return true;
        }
    }

    async load(key) {
        if (this.mode === 'firebase') {
            return await this._getFirebase(key);
        }
        return this._getLocal(key);
    }

    async save(key, data) {
        if (this.mode === 'firebase') {
            return await this._setFirebase(key, data);
        }
        return this._setLocal(key, data);
    }

    async remove(key) {
        if (this.mode === 'firebase') {
            return await this._removeFirebase(key);
        }
        return this._removeLocal(key);
    }

    async loadAllData() {
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
            console.log(`📥 Loaded ${key}:`, Object.keys(results[key]).length);
        }

        return {
            allFirms: { ...DEFAULT_FIRMS, ...results[STORAGE_KEYS.FIRMS] },
            db: Object.values(results[STORAGE_KEYS.VOUCHERS] || {}).filter(v => v.status !== 'deleted'),
            deletedVouchers: Object.values(results[STORAGE_KEYS.DELETED] || {}),
            editLogs: Object.values(results[STORAGE_KEYS.EDIT_LOGS] || {}),
            parties: Object.values(results[STORAGE_KEYS.PARTIES] || {}),
            signatories: Object.values(results[STORAGE_KEYS.SIGNATORIES] || {}),
            expenseHeads: results[STORAGE_KEYS.EXPENSE_HEADS] || {},
            allUsers: Object.values(results[STORAGE_KEYS.USERS] || {}),
            voucherCounter: results[STORAGE_KEYS.VOUCHER_COUNTER] || {},
            bankAccounts: results[STORAGE_KEYS.BANK_ACCOUNTS] || {},
            userPermissions: results[STORAGE_KEYS.PERMISSIONS] || {}
        };
    }

    async saveVoucher(voucher) {
        const key = STORAGE_KEYS.VOUCHERS;
        const data = await this.load(key);
        data[voucher.id] = voucher;
        await this.save(key, data);
        return voucher;
    }

    async deleteVoucher(id) {
        const key = STORAGE_KEYS.VOUCHERS;
        const data = await this.load(key);
        delete data[id];
        await this.save(key, data);
        return true;
    }

    onVoucherChange(callback) {
        if (this.mode === 'firebase' && this.rtdb) {
            console.log('🔥 Firebase Realtime Listener started');
            this.rtdb.ref(STORAGE_KEYS.VOUCHERS).on('value', (snap) => {
                const data = snap.val() || {};
                const db = Object.values(data).filter(v => v.status !== 'deleted');
                callback(db);
            });
        } else {
            let lastData = '';
            setInterval(() => {
                const current = this._getLocal(STORAGE_KEYS.VOUCHERS);
                const currentStr = JSON.stringify(current);
                if (currentStr !== lastData) {
                    lastData = currentStr;
                    const db = Object.values(current).filter(v => v.status !== 'deleted');
                    callback(db);
                }
            }, 3000);
        }
    }
}

export default Storage;
