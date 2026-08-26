// js/receipt-storage.js - Receipts Storage Helper

export class ReceiptStorage {
    constructor(storage) {
        this.storage = storage;
        this.KEYS = {
            RECEIPTS: 'receipts',
            RECEIPT_COUNTER: 'receiptCounter',
            DELETED_RECEIPTS: 'deletedReceipts'
        };
    }

    async loadAll() {
        const data = await this.storage.loadAllData();
        return {
            receipts: data[this.KEYS.RECEIPTS] ? Object.values(data[this.KEYS.RECEIPTS]) : [],
            deletedReceipts: data[this.KEYS.DELETED_RECEIPTS] ? Object.values(data[this.KEYS.DELETED_RECEIPTS]) : [],
            receiptCounter: data[this.KEYS.RECEIPT_COUNTER] || {}
        };
    }

    async saveReceipts(receipts) {
        const obj = {};
        receipts.forEach(r => { obj[r.id] = r; });
        await this.storage.save(this.KEYS.RECEIPTS, obj);
    }

    async saveDeleted(deleted) {
        const obj = {};
        deleted.forEach(r => { obj[r.id] = r; });
        await this.storage.save(this.KEYS.DELETED_RECEIPTS, obj);
    }

    async saveCounter(counter) {
        await this.storage.save(this.KEYS.RECEIPT_COUNTER, counter);
    }

    async deleteReceipt(id) {
        const data = await this.storage.load(this.KEYS.RECEIPTS);
        if (data) delete data[id];
        await this.storage.save(this.KEYS.RECEIPTS, data);
    }
}
