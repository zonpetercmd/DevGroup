// js/storage.js - LOCAL STORAGE ONLY (Firebase disabled for now)
import { DEFAULT_FIRMS, STORAGE_KEYS } from '../config/constants.js';

class Storage {
    constructor() {
        this.mode = 'local'; // Only Local Storage
        console.log('📦 Storage initialized with LOCAL mode');
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

    // ===== MAIN METHODS =====
    async load(key) {
        return this._getLocal(key);
    }

    async save(key, data) {
        return this._setLocal(key, data);
    }

    async remove(key) {
        return this._removeLocal(key);
    }

    // ===== LOAD ALL DATA =====
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

    // ===== SAVE VOUCHER =====
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

    // ===== REAL-TIME LISTENER (Local Storage Polling) =====
    onVoucherChange(callback) {
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

export default Storage;
