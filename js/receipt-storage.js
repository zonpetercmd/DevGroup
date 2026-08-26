// js/receipt-storage.js - Receipts Storage Helper

export class ReceiptStorage {
    constructor(storage) {
        this.storage = storage;
        this.KEYS = {
            RECEIPTS: 'receipts',
            RECEIPT_COUNTER: 'receiptCounter',
            DELETED_RECEIPTS: 'deletedReceipts',
            RECEIPT_HEADS: 'receiptHeads',
            RECEIPT_PARTIES: 'receiptParties',
            RECEIPT_SIGNATORIES: 'receiptSignatories'
        };
    }

    async loadAll() {
        const data = await this.storage.loadAllData();
        return {
            receipts: data[this.KEYS.RECEIPTS] ? Object.values(data[this.KEYS.RECEIPTS]) : [],
            deletedReceipts: data[this.KEYS.DELETED_RECEIPTS] ? Object.values(data[this.KEYS.DELETED_RECEIPTS]) : [],
            receiptCounter: data[this.KEYS.RECEIPT_COUNTER] || {},
            receiptHeads: data[this.KEYS.RECEIPT_HEADS] || {},
            receiptParties: data[this.KEYS.RECEIPT_PARTIES] ? Object.values(data[this.KEYS.RECEIPT_PARTIES]) : [],
            receiptSignatories: data[this.KEYS.RECEIPT_SIGNATORIES] ? Object.values(data[this.KEYS.RECEIPT_SIGNATORIES]) : []
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

    // ✅ Receipts Settings Save
    async saveReceiptHeads(heads) {
        await this.storage.save(this.KEYS.RECEIPT_HEADS, heads);
    }

    async saveReceiptParties(parties) {
        const obj = {};
        parties.forEach(p => { obj[p.id] = p; });
        await this.storage.save(this.KEYS.RECEIPT_PARTIES, obj);
    }

    async saveReceiptSignatories(signatories) {
        const obj = {};
        signatories.forEach(s => { obj[s.id] = s; });
        await this.storage.save(this.KEYS.RECEIPT_SIGNATORIES, obj);
    }
}
