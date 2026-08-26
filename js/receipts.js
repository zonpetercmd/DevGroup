// js/receipts.js - Receipts Module (Independent)

import { showToast, generateId, getFinancialYear, formatDate, getToday, numberToWords } from './utils.js';
import { ReceiptStorage } from './receipt-storage.js';

class ReceiptsModule {
    constructor(app) {
        this.app = app;
        this.storage = new ReceiptStorage(app.storage);
        this.db = [];
        this.deletedReceipts = [];
        this.receiptCounter = {};
        
        // ✅ Receipts के अपने Data
        this.receiptHeads = {};
        this.receiptParties = [];
        this.receiptSignatories = [];
        
        this.loaded = false;
        
        // ✅ App से नहीं, अपने Data use करेंगे
        this.allFirms = app.allFirms;
        this.bankAccounts = app.bankAccounts;
        this.currentUser = app.currentUser;
        this.currentRole = app.currentRole;
    }

    // ===== LOAD =====
    async load() {
        const data = await this.storage.loadAll();
        this.db = data.receipts || [];
        this.deletedReceipts = data.deletedReceipts || [];
        this.receiptCounter = data.receiptCounter || {};
        this.receiptHeads = data.receiptHeads || {};
        this.receiptParties = data.receiptParties || [];
        this.receiptSignatories = data.receiptSignatories || [];
        this.loaded = true;
        console.log('📋 Receipts loaded:', this.db.length);
        console.log('📋 Receipt Heads:', Object.keys(this.receiptHeads).length);
        console.log('📋 Receipt Parties:', this.receiptParties.length);
        console.log('📋 Receipt Signatories:', this.receiptSignatories.length);
        this.renderTable();
        this.updateStats();
        return this;
    }

    // ===== GENERATE NUMBER =====
    generateReceiptNo() {
        const firmKey = document.getElementById('r_firm_name_value')?.value || '';
        const firm = this.allFirms[firmKey];
        if (!firm) {
            document.getElementById('r_no').value = 'Select Firm First';
            return;
        }
        const fy = getFinancialYear();
        const count = (this.receiptCounter[firmKey] || 0) + 1;
        document.getElementById('r_no').value = `${firm.short}/RC/${fy}/${String(count).padStart(3, '0')}`;
    }

    // ===== SAVE RECEIPT =====
    async save() {
        const firmKey = document.getElementById('r_firm_name_value').value;
        const head = document.getElementById('r_head_value').value;
        const party = document.getElementById('r_party_value').value;
        const amount = parseFloat(document.getElementById('r_amt').value) || 0;
        const mode = document.getElementById('r_mode_value').value || document.getElementById('r_mode_input')?.value || 'Cash';
        const date = document.getElementById('r_date').value;
        const referenceNo = document.getElementById('r_reference_no').value.trim();
        const signatory = document.getElementById('r_signatory_value').value;
        const narration = document.getElementById('r_narration').value.trim();
        const rno = document.getElementById('r_no').value;
        const editId = document.getElementById('r_edit_id').value;

        if (!firmKey) { showToast('Please select a Firm'); return; }
        if (!head) { showToast('Please select Head'); return; }
        if (!party) { showToast('Please select Party'); return; }
        if (amount <= 0) { showToast('Please enter valid amount'); return; }
        if (!date) { showToast('Please select date'); return; }

        const receipt = {
            id: editId || generateId(),
            rno: rno,
            date: date,
            firmKey: firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            head: head,
            party: party,
            amount: amount,
            mode: mode,
            referenceNo: referenceNo,
            signatory: signatory,
            narration: narration,
            type: 'RC',
            status: 'active',
            createdBy: this.currentUser || 'Admin',
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };

        if (editId) {
            const idx = this.db.findIndex(v => v.id === editId);
            if (idx !== -1) this.db[idx] = receipt;
        } else {
            this.db.push(receipt);
            if (!this.receiptCounter[firmKey]) this.receiptCounter[firmKey] = 0;
            this.receiptCounter[firmKey]++;
        }

        await this.storage.saveReceipts(this.db);
        await this.storage.saveCounter(this.receiptCounter);

        this.renderTable();
        this.updateStats();
        this.resetForm();
        showToast(editId ? '✅ Receipt updated!' : '✅ Receipt saved!');
        setTimeout(() => this.print(receipt), 500);
    }

    // ===== PRINT =====
    async print(receipt) {
        const firm = this.allFirms[receipt.firmKey] || this.allFirms['DevVidyalaya'];
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) { showToast('Please allow popups'); return; }

        const html = `<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>${receipt.rno}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Courier New', monospace; padding:10mm; background:#fff; }
            .receipt { max-width:210mm; margin:0 auto; border:2px solid #000; padding:10mm; }
            .header { text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px; }
            .header img { max-height:60px; }
            .header .name { font-size:24px; font-weight:bold; }
            .title { text-align:center; font-size:18px; font-weight:bold; margin:10px 0; text-decoration:underline; }
            .details { line-height:1.8; font-size:14px; }
            .row { display:flex; justify-content:space-between; padding:2px 0; }
            .amount { font-size:18px; font-weight:bold; border-top:2px solid #000; padding-top:10px; margin-top:10px; }
            .signatures { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:20px; border-top:2px solid #000; padding-top:10px; text-align:center; }
            .footer { text-align:center; font-size:10px; color:#666; margin-top:10px; border-top:1px dashed #999; padding-top:5px; }
            .no-print { text-align:center; margin:20px; }
            .no-print button { padding:12px 30px; cursor:pointer; background:#2563eb; color:white; border:none; border-radius:6px; margin:0 8px; font-size:15px; }
            @media print { body { padding:0; } .no-print { display:none; } }
        </style>
        </head><body>
        <div class="receipt">
            <div class="header">
                <img src="${firm?.logo || 'logo.jpeg'}" onerror="this.style.display='none'">
                <div class="name">${firm?.name || receipt.firmName}</div>
                <div>${firm?.addr || ''}</div>
                <div>📞 ${firm?.mobile || ''} | ✉ ${firm?.email || ''}</div>
            </div>
            <div class="title">🧾 RECEIPT VOUCHER</div>
            <div class="details">
                <div class="row"><span>Receipt No:</span><span>${receipt.rno}</span></div>
                <div class="row"><span>Date:</span><span>${formatDate(receipt.date)}</span></div>
                <div class="row"><span>Head:</span><span>${receipt.head}</span></div>
                <div class="row"><span>Received From:</span><span><strong>${receipt.party}</strong></span></div>
                <div class="row"><span>For:</span><span>${receipt.narration || '-'}</span></div>
                <div class="row"><span>Mode:</span><span>${receipt.mode}</span></div>
                ${receipt.referenceNo ? `<div class="row"><span>Ref No.:</span><span>${receipt.referenceNo}</span></div>` : ''}
                <div class="row"><span>Signatory:</span><span>${receipt.signatory || '-'}</span></div>
            </div>
            <div class="amount">
                <div class="row"><span>TOTAL</span><span>₹ ${receipt.amount.toFixed(2)}</span></div>
                <div style="text-align:right; font-size:14px;">${numberToWords(receipt.amount)} Rupees Only</div>
            </div>
            <div class="signatures">
                <div>Prepared By<br><strong>${receipt.createdBy}</strong><br>___________</div>
                <div>Authorised<br><strong>${receipt.signatory || ''}</strong><br>___________</div>
                <div>Receiver's<br>Signature<br>___________</div>
            </div>
            <div class="footer">Computer Generated | ${new Date().toLocaleString()}</div>
        </div>
        <div class="no-print">
            <button onclick="window.print();setTimeout(()=>window.close(),1000)">🖨️ Print</button>
            <button onclick="window.close()" style="background:#64748b;">✖ Close</button>
        </div>
        <script>window.onload=function(){setTimeout(window.print,700)};<\/script>
        </body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    }

    printById(id) {
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Receipt not found'); return; }
        this.print(v);
    }

    // ===== TABLE =====
    renderTable() {
        const search = document.getElementById('r_search')?.value?.toLowerCase() || '';
        const start = document.getElementById('r_start')?.value || '';
        const end = document.getElementById('r_end')?.value || '';
        const status = document.getElementById('r_status')?.value || 'ALL';

        let dataToShow = [];
        if (status === 'ALL' || status === 'active') {
            dataToShow = dataToShow.concat(this.db.filter(v => v.status !== 'deleted'));
        }
        if (status === 'ALL' || status === 'deleted') {
            dataToShow = dataToShow.concat(this.deletedReceipts);
        }

        const filtered = dataToShow.filter(v => {
            let match = true;
            if (search) {
                match = match && (v.party?.toLowerCase().includes(search) || v.head?.toLowerCase().includes(search) || v.rno?.toLowerCase().includes(search));
            }
            if (start) match = match && v.date >= start;
            if (end) match = match && v.date <= end;
            return match;
        });

        const tbody = document.getElementById('r_list');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:20px;">No receipts found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.slice().reverse().map(v => {
            const isDeleted = v.status === 'deleted';
            let actions = '';
            if (!isDeleted) {
                actions += `<button class="btn-action btn-print" onclick="window.receipts.printById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
                actions += `<button class="btn-action btn-edit" onclick="window.receipts.edit('${v.id}')" title="Edit"><i class="fas fa-edit"></i></button>`;
                actions += `<button class="btn-action btn-del" onclick="window.receipts.deleteReceipt('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
            } else {
                actions = `<button class="btn-action" onclick="window.receipts.recover('${v.id}')" style="background:#8b5cf6; color:white;">↩️ Recover</button>`;
            }
            return `<tr>
                <td>${v.date}</td><td><b>${v.rno}</b></td>
                <td>${v.head}</td><td>${v.party}</td>
                <td>₹${v.amount.toLocaleString()}</td><td>${v.mode}</td>
                <td>${isDeleted ? '<span style="color:red;">Deleted</span>' : '<span style="color:green;">Active</span>'}</td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    }

    updateStats() {
        const today = getToday();
        const active = this.db.filter(v => v.status !== 'deleted');
        document.getElementById('r_stat_today').innerHTML = active.filter(v => v.date === today).length;
        document.getElementById('r_stat_total').innerHTML = active.length;
        document.getElementById('r_stat_amount').innerHTML = '₹ ' + active.reduce((s, v) => s + v.amount, 0).toLocaleString();
        document.getElementById('r_stat_deleted').innerHTML = this.deletedReceipts.length;
    }

    // ===== CRUD =====
    async deleteReceipt(id) {
        if (!confirm('Delete this receipt?')) return;
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Receipt not found'); return; }
        const deleted = { ...v, status: 'deleted', deletedBy: this.currentUser, deletedAt: new Date().toISOString() };
        this.deletedReceipts.push(deleted);
        this.db = this.db.filter(x => x.id !== id);
        await this.storage.saveReceipts(this.db);
        await this.storage.saveDeleted(this.deletedReceipts);
        this.renderTable();
        this.updateStats();
        showToast('✅ Receipt deleted');
    }

    async recover(id) {
        const index = this.deletedReceipts.findIndex(v => v.id === id);
        if (index === -1) { showToast('Not found'); return; }
        const v = this.deletedReceipts[index];
        v.status = 'active';
        delete v.deletedBy;
        delete v.deletedAt;
        this.deletedReceipts.splice(index, 1);
        this.db.push(v);
        await this.storage.saveReceipts(this.db);
        await this.storage.saveDeleted(this.deletedReceipts);
        this.renderTable();
        this.updateStats();
        showToast('✅ Receipt recovered');
    }

    edit(id) {
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Receipt not found'); return; }
        document.getElementById('r_edit_id').value = v.id;
        document.getElementById('r_date').value = v.date;
        document.getElementById('r_head_input').value = v.head;
        document.getElementById('r_head_value').value = v.head;
        document.getElementById('r_firm_name_input').value = v.firmName;
        document.getElementById('r_firm_name_value').value = v.firmKey;
        document.getElementById('r_party_input').value = v.party;
        document.getElementById('r_party_value').value = v.party;
        document.getElementById('r_amt').value = v.amount;
        document.getElementById('r_mode_input').value = v.mode;
        document.getElementById('r_mode_value').value = v.mode;
        document.getElementById('r_reference_no').value = v.referenceNo || '';
        document.getElementById('r_signatory_input').value = v.signatory || '';
        document.getElementById('r_signatory_value').value = v.signatory || '';
        document.getElementById('r_narration').value = v.narration || '';
        document.getElementById('r_no').value = v.rno;
        document.getElementById('r_form_title').innerHTML = '✏️ Edit Receipt: ' + v.rno;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('✏️ Edit mode');
    }

    resetForm() {
        document.getElementById('r_edit_id').value = '';
        document.getElementById('r_head_input').value = '';
        document.getElementById('r_head_value').value = '';
        document.getElementById('r_party_input').value = '';
        document.getElementById('r_party_value').value = '';
        document.getElementById('r_amt').value = '0';
        document.getElementById('r_reference_no').value = '';
        document.getElementById('r_signatory_input').value = '';
        document.getElementById('r_signatory_value').value = '';
        document.getElementById('r_narration').value = '';
        document.getElementById('r_mode_input').value = '';
        document.getElementById('r_mode_value').value = 'Cash';
        document.getElementById('r_date').value = getToday();
        document.getElementById('r_form_title').innerHTML = '🧾 Add Receipt Voucher';
        this.generateReceiptNo();
    }

    // ============================================================
    // ✅ RECEIPTS HEADS - Settings Functions
    // ============================================================

    renderHeadsList() {
        const container = document.getElementById('r_heads_list');
        if (!container) return;
        const heads = Object.keys(this.receiptHeads);
        if (heads.length === 0) {
            container.innerHTML = '<p style="color:#999;">No receipt heads added</p>';
            return;
        }
        container.innerHTML = heads.map(h => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee; align-items:center; flex-wrap:wrap;">
                <span><strong>${h}</strong></span>
                <button class="btn-action btn-del" onclick="window.receipts.deleteReceiptHead('${h.replace(/'/g, "\\'")}')">✖</button>
            </div>
        `).join('');
    }

    async addReceiptHead() {
        const head = document.getElementById('r_new_head_name').value.trim();
        if (!head) { showToast('Enter receipt head name'); return; }
        if (this.receiptHeads[head]) { showToast('Head already exists'); return; }
        this.receiptHeads[head] = [];
        await this.storage.saveReceiptHeads(this.receiptHeads);
        this.renderHeadsList();
        this.populateHeads();
        document.getElementById('r_new_head_name').value = '';
        showToast('✅ Receipt head added');
    }

    async deleteReceiptHead(head) {
        if (!confirm('Delete head: ' + head + '?')) return;
        delete this.receiptHeads[head];
        await this.storage.saveReceiptHeads(this.receiptHeads);
        this.renderHeadsList();
        this.populateHeads();
        showToast('✅ Deleted');
    }

    // ============================================================
    // ✅ RECEIPTS PARTIES - Settings Functions
    // ============================================================

    renderPartiesList() {
        const container = document.getElementById('r_parties_list');
        if (!container) return;
        if (this.receiptParties.length === 0) {
            container.innerHTML = '<p style="color:#999;">No receipt parties added</p>';
            return;
        }
        container.innerHTML = this.receiptParties.map(p => `
            <div class="party-card">
                <div class="party-info">
                    <span><strong>${p.name}</strong></span>
                    ${p.phone ? `<span>📞 ${p.phone}</span>` : ''}
                    ${p.address ? `<span>📍 ${p.address}</span>` : ''}
                </div>
                <div>
                    <button class="btn-action btn-edit" onclick="window.receipts.editReceiptParty('${p.id}')">✏️</button>
                    <button class="btn-action btn-del" onclick="window.receipts.deleteReceiptParty('${p.id}')">✖</button>
                </div>
            </div>
        `).join('');
    }

    openAddReceiptPartyModal() {
        document.getElementById('r_edit_party_id').value = '';
        document.getElementById('r_new_party_name').value = '';
        document.getElementById('r_new_party_phone').value = '';
        document.getElementById('r_new_party_address').value = '';
        document.getElementById('r_party_modal_title').innerHTML = '➕ Add Receipt Party';
        document.getElementById('r_addPartyModal').style.display = 'flex';
    }

    closeAddReceiptPartyModal() {
        document.getElementById('r_addPartyModal').style.display = 'none';
    }

    async saveReceiptParty() {
        const id = document.getElementById('r_edit_party_id').value;
        const name = document.getElementById('r_new_party_name').value.trim();
        if (!name) { showToast('Party name required'); return; }
        
        const party = { 
            id: id || generateId(), 
            name: name, 
            phone: document.getElementById('r_new_party_phone').value.trim(),
            address: document.getElementById('r_new_party_address').value.trim() 
        };
        
        if (id) {
            const idx = this.receiptParties.findIndex(p => p.id === id);
            if (idx !== -1) this.receiptParties[idx] = party;
        } else {
            if (this.receiptParties.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                showToast('Party already exists');
                return;
            }
            this.receiptParties.push(party);
        }
        
        await this.storage.saveReceiptParties(this.receiptParties);
        this.populateParties();
        this.renderPartiesList();
        this.closeAddReceiptPartyModal();
        showToast(id ? '✅ Receipt party updated' : '✅ Receipt party added');
    }

    editReceiptParty(id) {
        const party = this.receiptParties.find(p => p.id === id);
        if (!party) return;
        document.getElementById('r_edit_party_id').value = party.id;
        document.getElementById('r_new_party_name').value = party.name;
        document.getElementById('r_new_party_phone').value = party.phone || '';
        document.getElementById('r_new_party_address').value = party.address || '';
        document.getElementById('r_party_modal_title').innerHTML = '✏️ Edit Receipt Party';
        document.getElementById('r_addPartyModal').style.display = 'flex';
    }

    async deleteReceiptParty(id) {
        if (!confirm('Delete this party?')) return;
        this.receiptParties = this.receiptParties.filter(p => p.id !== id);
        await this.storage.saveReceiptParties(this.receiptParties);
        this.populateParties();
        this.renderPartiesList();
        showToast('✅ Receipt party deleted');
    }

    // ============================================================
    // ✅ RECEIPTS SIGNATORIES - Settings Functions
    // ============================================================

    renderSignatoriesList() {
        const container = document.getElementById('r_signatories_list');
        if (!container) return;
        if (this.receiptSignatories.length === 0) {
            container.innerHTML = '<p style="color:#999;">No receipt signatories added</p>';
            return;
        }
        container.innerHTML = this.receiptSignatories.map(s => `
            <div class="signatory-card">
                <div class="signatory-info">
                    <span><strong>${s.name}</strong></span>
                    ${s.designation ? `<span>📌 ${s.designation}</span>` : ''}
                </div>
                <div>
                    <button class="btn-action btn-edit" onclick="window.receipts.editReceiptSignatory('${s.id}')">✏️</button>
                    <button class="btn-action btn-del" onclick="window.receipts.deleteReceiptSignatory('${s.id}')">✖</button>
                </div>
            </div>
        `).join('');
    }

    openAddReceiptSignatoryModal() {
        document.getElementById('r_edit_signatory_id').value = '';
        document.getElementById('r_new_signatory_name').value = '';
        document.getElementById('r_new_signatory_designation').value = '';
        document.getElementById('r_signatory_modal_title').innerHTML = '✍️ Add Receipt Signatory';
        document.getElementById('r_addSignatoryModal').style.display = 'flex';
    }

    closeAddReceiptSignatoryModal() {
        document.getElementById('r_addSignatoryModal').style.display = 'none';
    }

    async saveReceiptSignatory() {
        const id = document.getElementById('r_edit_signatory_id').value;
        const name = document.getElementById('r_new_signatory_name').value.trim();
        if (!name) { showToast('Signatory name required'); return; }
        
        const signatory = {
            id: id || generateId(),
            name: name,
            designation: document.getElementById('r_new_signatory_designation').value.trim()
        };
        
        if (id) {
            const idx = this.receiptSignatories.findIndex(s => s.id === id);
            if (idx !== -1) this.receiptSignatories[idx] = signatory;
        } else {
            if (this.receiptSignatories.find(s => s.name.toLowerCase() === name.toLowerCase())) {
                showToast('Signatory already exists');
                return;
            }
            this.receiptSignatories.push(signatory);
        }
        
        await this.storage.saveReceiptSignatories(this.receiptSignatories);
        this.populateSignatories();
        this.renderSignatoriesList();
        this.closeAddReceiptSignatoryModal();
        showToast(id ? '✅ Receipt signatory updated' : '✅ Receipt signatory added');
    }

    editReceiptSignatory(id) {
        const sig = this.receiptSignatories.find(s => s.id === id);
        if (!sig) return;
        document.getElementById('r_edit_signatory_id').value = sig.id;
        document.getElementById('r_new_signatory_name').value = sig.name;
        document.getElementById('r_new_signatory_designation').value = sig.designation || '';
        document.getElementById('r_signatory_modal_title').innerHTML = '✏️ Edit Receipt Signatory';
        document.getElementById('r_addSignatoryModal').style.display = 'flex';
    }

    async deleteReceiptSignatory(id) {
        if (!confirm('Delete this signatory?')) return;
        this.receiptSignatories = this.receiptSignatories.filter(s => s.id !== id);
        await this.storage.saveReceiptSignatories(this.receiptSignatories);
        this.populateSignatories();
        this.renderSignatoriesList();
        showToast('✅ Receipt signatory deleted');
    }

    // ============================================================
    // DROPDOWNS - Receipts अपने Data से
    // ============================================================

    populateFirms() {
        const dropdown = document.getElementById('r_firmDropdown');
        const firms = Object.keys(this.allFirms);
        dropdown.innerHTML = firms.map(f => 
            `<div onclick="window.receipts.selectFirm('${f}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${this.allFirms[f]?.name || f}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterFirms(search) {
        const dropdown = document.getElementById('r_firmDropdown');
        if (!search || search.length < 1) { this.populateFirms(); return; }
        const firms = Object.keys(this.allFirms).filter(f => 
            (this.allFirms[f]?.name || f).toLowerCase().includes(search.toLowerCase())
        );
        dropdown.innerHTML = firms.length ? firms.map(f => 
            `<div onclick="window.receipts.selectFirm('${f}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${this.allFirms[f]?.name || f}</div>`
        ).join('') : '<div class="no-result">No firm found</div>';
        dropdown.style.display = 'block';
    }

    selectFirm(firmKey) {
        document.getElementById('r_firm_name_input').value = this.allFirms[firmKey]?.name || firmKey;
        document.getElementById('r_firm_name_value').value = firmKey;
        document.getElementById('r_firmDropdown').style.display = 'none';
        this.generateReceiptNo();
    }

    // ✅ Receipts Heads - अपने Data से
    populateHeads() {
        const dropdown = document.getElementById('r_headDropdown');
        const heads = Object.keys(this.receiptHeads);
        dropdown.innerHTML = heads.length ? heads.map(h => 
            `<div onclick="window.receipts.selectHead('${h.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${h}</div>`
        ).join('') : '<div class="no-result">No receipt heads. Add in Settings.</div>';
        dropdown.style.display = 'block';
    }

    filterHeads(search) {
        const dropdown = document.getElementById('r_headDropdown');
        if (!search || search.length < 1) { this.populateHeads(); return; }
        const heads = Object.keys(this.receiptHeads).filter(h => 
            h.toLowerCase().includes(search.toLowerCase())
        );
        dropdown.innerHTML = heads.length ? heads.map(h => 
            `<div onclick="window.receipts.selectHead('${h.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${h}</div>`
        ).join('') : '<div class="no-result">No head found</div>';
        dropdown.style.display = 'block';
    }

    selectHead(head) {
        document.getElementById('r_head_input').value = head;
        document.getElementById('r_head_value').value = head;
        document.getElementById('r_headDropdown').style.display = 'none';
    }

    // ✅ Receipts Parties - अपने Data से
    populateParties() {
        const dropdown = document.getElementById('r_partyDropdown');
        dropdown.innerHTML = this.receiptParties.length ? this.receiptParties.map(p => 
            `<div onclick="window.receipts.selectParty('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${p.name} ${p.phone ? '📞 ' + p.phone : ''}</div>`
        ).join('') : '<div class="no-result">No receipt parties. Add in Settings.</div>';
        dropdown.style.display = 'block';
    }

    filterParties(search) {
        const dropdown = document.getElementById('r_partyDropdown');
        if (!search || search.length < 1) { this.populateParties(); return; }
        const filtered = this.receiptParties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        dropdown.innerHTML = filtered.length ? filtered.map(p => 
            `<div onclick="window.receipts.selectParty('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${p.name} ${p.phone ? '📞 ' + p.phone : ''}</div>`
        ).join('') : '<div class="no-result">No party found</div>';
        dropdown.style.display = 'block';
    }

    selectParty(name) {
        document.getElementById('r_party_input').value = name;
        document.getElementById('r_party_value').value = name;
        document.getElementById('r_partyDropdown').style.display = 'none';
    }

    // ✅ Receipts Signatories - अपने Data से
    populateSignatories() {
        const dropdown = document.getElementById('r_signatoryDropdown');
        dropdown.innerHTML = this.receiptSignatories.length ? this.receiptSignatories.map(s => 
            `<div onclick="window.receipts.selectSignatory('${s.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${s.name} ${s.designation ? ' - ' + s.designation : ''}</div>`
        ).join('') : '<div class="no-result">No receipt signatories. Add in Settings.</div>';
        dropdown.style.display = 'block';
    }

    filterSignatories(search) {
        const dropdown = document.getElementById('r_signatoryDropdown');
        if (!search || search.length < 1) { this.populateSignatories(); return; }
        const filtered = this.receiptSignatories.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
        dropdown.innerHTML = filtered.length ? filtered.map(s => 
            `<div onclick="window.receipts.selectSignatory('${s.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${s.name} ${s.designation ? ' - ' + s.designation : ''}</div>`
        ).join('') : '<div class="no-result">No signatory found</div>';
        dropdown.style.display = 'block';
    }

    selectSignatory(name) {
        document.getElementById('r_signatory_input').value = name;
        document.getElementById('r_signatory_value').value = name;
        document.getElementById('r_signatoryDropdown').style.display = 'none';
    }

    // ✅ Modes
    populateModes() {
        const dropdown = document.getElementById('r_modeDropdown');
        ['Cash', 'Bank', 'Paytm', 'UPI', 'Cheque'].forEach(m => {
            dropdown.innerHTML += `<div onclick="window.receipts.selectMode('${m}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${m}</div>`;
        });
        dropdown.style.display = 'block';
    }

    filterModes(search) {
        const dropdown = document.getElementById('r_modeDropdown');
        if (!search || search.length < 1) { this.populateModes(); return; }
        const modes = ['Cash', 'Bank', 'Paytm', 'UPI', 'Cheque'].filter(m => m.toLowerCase().includes(search.toLowerCase()));
        dropdown.innerHTML = modes.length ? modes.map(m => 
            `<div onclick="window.receipts.selectMode('${m}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${m}</div>`
        ).join('') : '<div class="no-result">No mode found</div>';
        dropdown.style.display = 'block';
    }

    selectMode(mode) {
        document.getElementById('r_mode_input').value = mode;
        document.getElementById('r_mode_value').value = mode;
        document.getElementById('r_modeDropdown').style.display = 'none';
    }
}

export default ReceiptsModule;
