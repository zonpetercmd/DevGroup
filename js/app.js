// js/app.js - Main Application (With Search + Dropdown for All Fields)

import Storage from './storage.js';
import PrintEngine from './print.js';
import { 
    showToast, generateId, getFinancialYear, 
    formatDate, formatCurrency, getToday 
} from './utils.js';
import { DEFAULT_PERMISSIONS, STORAGE_KEYS } from '../config/constants.js';

class App {
    constructor() {
        this.storage = new Storage();
        this.printEngine = new PrintEngine();
        
        // Data
        this.db = [];
        this.deletedVouchers = [];
        this.editLogs = [];
        this.parties = [];
        this.signatories = [];
        this.expenseHeads = {};
        this.allUsers = [];
        this.allFirms = {};
        this.voucherCounter = {};
        this.bankAccounts = {};
        this.userPermissions = { ...DEFAULT_PERMISSIONS };
        
        // Session
        this.currentUser = '';
        this.currentRole = '';
        this.currentFirm = '';
        this.loaded = false;
    }

    // ===== INIT =====
    async init() {
        console.log('🚀 App Initializing...');
        await this.loadAllData();
        this.checkSession();
        this.setupEventListeners();
        this.setupRealtimeListener();
        console.log('✅ App Ready!');
    }

    // ===== LOAD DATA =====
    async loadAllData() {
        const data = await this.storage.loadAllData();
        this.allFirms = data.allFirms;
        this.db = data.db;
        this.deletedVouchers = data.deletedVouchers;
        this.editLogs = data.editLogs;
        this.parties = data.parties;
        this.signatories = data.signatories;
        this.expenseHeads = data.expenseHeads;
        this.allUsers = data.allUsers;
        this.voucherCounter = data.voucherCounter;
        this.bankAccounts = data.bankAccounts || {};
        this.userPermissions = data.userPermissions || DEFAULT_PERMISSIONS;
        this.loaded = true;
        console.log('✅ Data loaded. Firms:', Object.keys(this.allFirms).length);
        console.log('🏢 Firms:', Object.keys(this.allFirms));
    }

    // ===== SESSION =====
    checkSession() {
        this.updateLoginRoleDropdown();
        
        if (sessionStorage.getItem('auth') === 'ok') {
            this.currentUser = sessionStorage.getItem('user') || 'Admin';
            this.currentRole = sessionStorage.getItem('role') || 'Admin';
            this.currentFirm = sessionStorage.getItem('firm') || '';
            try {
                this.userPermissions = JSON.parse(sessionStorage.getItem('permissions') || '{}');
            } catch {
                this.userPermissions = { ...DEFAULT_PERMISSIONS };
            }
            this.showMainApp();
        } else {
            this.showLogin();
        }
    }

    showLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        document.getElementById('display_user').innerText = '👤 ' + this.currentUser;
        document.getElementById('display_role').innerText = this.currentRole + 
            (this.currentFirm ? ' (' + (this.allFirms[this.currentFirm]?.name || '') + ')' : '');
        
        document.getElementById('admin_settings_btn').style.display = 
            this.currentRole === 'Admin' ? 'inline-block' : 'none';
        
        document.getElementById('v_date').value = getToday();
        
        let tabs = `<button class="module-tab active" onclick="switchModule('transactions')">📋 Transactions</button>`;
        if (this.userPermissions.reports || this.currentRole === 'Admin') {
            tabs += `<button class="module-tab" onclick="switchModule('reports')">📊 Reports</button>`;
        }
        document.getElementById('moduleTabsContainer').innerHTML = tabs;
        
        this.renderAll();
        this.updateFirmHeader();
        this.generateVoucherNo();
    }

    // ===== LOGIN - FIXED FOR STAFF =====
    async doLogin() {
        const userId = document.getElementById('user_id').value.trim();
        const pass = document.getElementById('user_pass').value.trim();
        const role = document.getElementById('login_role').value;
        const errorDiv = document.getElementById('login_error');
        
        errorDiv.style.display = 'none';
        
        if (!userId || !pass) {
            errorDiv.innerText = 'Please enter User ID and Password';
            errorDiv.style.display = 'block';
            return;
        }
        if (!role) {
            errorDiv.innerText = 'Please select a Role';
            errorDiv.style.display = 'block';
            return;
        }

        let actualRole = role;
        let staffFirm = '';
        if (role.startsWith('Staff_')) {
            staffFirm = role.replace('Staff_', '');
            actualRole = 'Staff';
        }

        let foundUser = this.allUsers.find(u => {
            if (actualRole === 'Staff') {
                return u.id === userId && u.password === pass && u.role === role && u.firm === staffFirm;
            }
            return u.id === userId && u.password === pass && u.role === role;
        });
        
        if (!foundUser) {
            if (userId === 'Admin' && pass === '1811' && role === 'Admin') {
                foundUser = { id: 'Admin', role: 'Admin', firm: null, permissions: { ...DEFAULT_PERMISSIONS } };
            } else {
                errorDiv.innerText = 'Invalid credentials or role mismatch';
                errorDiv.style.display = 'block';
                return;
            }
        }
        
        this.currentUser = foundUser.id;
        this.currentRole = foundUser.role;
        this.currentFirm = foundUser.firm || '';
        this.userPermissions = foundUser.permissions || { ...DEFAULT_PERMISSIONS };
        
        sessionStorage.setItem('auth', 'ok');
        sessionStorage.setItem('user', this.currentUser);
        sessionStorage.setItem('role', this.currentRole);
        sessionStorage.setItem('firm', this.currentFirm);
        sessionStorage.setItem('permissions', JSON.stringify(this.userPermissions));
        
        this.showMainApp();
        showToast('✅ Login successful!');
    }

    // ===== LOGOUT =====
    logout() {
        sessionStorage.clear();
        this.currentUser = '';
        this.currentRole = '';
        this.currentFirm = '';
        this.showLogin();
        showToast('👋 Logged out');
    }

    // ===== UPDATE DROPDOWNS =====
    updateLoginRoleDropdown() {
        const select = document.getElementById('login_role');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Role --</option>';
        select.innerHTML += '<option value="Admin">Admin (Full Access)</option>';
        
        const firms = Object.keys(this.allFirms);
        if (firms.length > 0) {
            firms.forEach(f => {
                if (this.allFirms[f]) {
                    select.innerHTML += `<option value="Staff_${f}">Staff - ${this.allFirms[f].name}</option>`;
                }
            });
        }
        if (currentVal) select.value = currentVal;
    }

    updateSettingsRoleDropdown() {
        const select = document.getElementById('new_user_role');
        if (!select) {
            console.warn('⚠️ new_user_role element not found');
            return;
        }
        const currentVal = select.value;
        
        select.innerHTML = '';
        select.innerHTML += '<option value="Admin">Admin</option>';
        
        const firms = Object.keys(this.allFirms);
        console.log('🏢 Updating settings roles with firms:', firms);
        
        if (firms.length > 0) {
            firms.forEach(f => {
                if (this.allFirms[f]) {
                    select.innerHTML += `<option value="Staff_${f}">Staff - ${this.allFirms[f].name}</option>`;
                }
            });
        }
        
        if (currentVal) {
            select.value = currentVal;
        }
        console.log('✅ Settings Role dropdown updated. Options:', select.options.length);
    }

    updateFirmSelectInSettings() {
        const select = document.getElementById('new_user_firm');
        if (!select) {
            console.warn('⚠️ new_user_firm element not found');
            return;
        }
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Firm --</option>';
        
        const firms = Object.keys(this.allFirms);
        console.log('🏢 Loading firms for settings:', firms);
        
        if (firms.length === 0) {
            select.innerHTML += '<option value="" disabled>No firms available</option>';
            return;
        }
        
        firms.forEach(f => {
            if (this.allFirms[f]) {
                select.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
            }
        });
        
        if (currentVal) select.value = currentVal;
        console.log('✅ Firm dropdown updated with', firms.length, 'firms');
    }

    // ===== FIRM HEADER =====
    updateFirmHeader() {
        const firmKey = document.getElementById('firm_name_value')?.value || '';
        const firm = this.allFirms[firmKey] || this.allFirms['DevVidyalaya'];
        if (firm) {
            document.getElementById('form_firm_name').innerText = firm.name;
            document.getElementById('form_firm_addr').innerText = 
                (firm.addr || '📍 ' + firm.name) + ' | 📞 ' + (firm.mobile || '');
            document.getElementById('form_logo').src = firm.logo || 'logo.jpeg';
        }
        this.updateBankDropdown();
    }

    // ===== BANK DROPDOWN - FIRM WISE =====
    updateBankDropdown() {
        const firmKey = document.getElementById('firm_name_value')?.value || '';
        const select = document.getElementById('bank_account');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select Bank</option>';
        
        const banks = this.bankAccounts[firmKey] || [];
        banks.forEach(b => {
            select.innerHTML += `<option value="${b.name}|${b.account}|${b.ifsc || ''}">${b.name} - ${b.account}</option>`;
        });
        if (currentVal) select.value = currentVal;
    }

    toggleBankField() {
        const mode = document.getElementById('v_mode_value')?.value || document.getElementById('v_mode')?.value || 'Cash';
        document.getElementById('bank_account_field').style.display = 
            (mode === 'Bank' || mode === 'Cheque') ? 'block' : 'none';
    }

    // ===== VOUCHER NUMBER =====
    generateVoucherNo() {
        const firmKey = document.getElementById('firm_name_value')?.value || '';
        const firm = this.allFirms[firmKey];
        if (!firm) {
            document.getElementById('v_no').value = 'Select Firm First';
            return;
        }
        const fy = getFinancialYear();
        const firmVouchers = this.db.filter(v => v.firmKey === firmKey);
        let count = firmVouchers.length + 1;
        if (this.voucherCounter[firmKey]) count = this.voucherCounter[firmKey] + 1;
        document.getElementById('v_no').value = `${firm.short}/EXP/${fy}/${String(count).padStart(3, '0')}`;
    }

    // ===== SAVE VOUCHER (Updated for Search Dropdowns) =====
    async saveVoucher() {
        const firmKey = document.getElementById('firm_name_value').value;
        const head = document.getElementById('expense_head_value').value;
        const subHead = document.getElementById('sub_head_value').value;
        const party = document.getElementById('party_value').value;
        const amount = parseFloat(document.getElementById('v_amt').value) || 0;
        
        // ✅ Mode - Search Dropdown से Value लें
        const mode = document.getElementById('v_mode_value').value || document.getElementById('v_mode_input')?.value || 'Cash';
        
        const date = document.getElementById('v_date').value;
        const referenceNo = document.getElementById('reference_no').value.trim();
        const signatory = document.getElementById('signatory_value').value;
        const narration = document.getElementById('v_narration').value.trim();
        const vno = document.getElementById('v_no').value;
        const editId = document.getElementById('edit_id').value;
        
        let bankAccount = '';
        let bankName = '';
        let bankIfsc = '';
        if (mode === 'Bank' || mode === 'Cheque') {
            const bankVal = document.getElementById('bank_account').value;
            if (bankVal) {
                const parts = bankVal.split('|');
                bankName = parts[0] || '';
                bankAccount = parts[1] || '';
                bankIfsc = parts[2] || '';
            }
        }
        
        if (!firmKey) { showToast('Please select a Firm'); return; }
        if (!head) { showToast('Please select Expense Head'); return; }
        if (!party) { showToast('Please select Party'); return; }
        if (amount <= 0) { showToast('Please enter valid amount'); return; }
        if (!date) { showToast('Please select date'); return; }
        
        const voucher = {
            id: editId || generateId(),
            vno: vno,
            date: date,
            firmKey: firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            head: head,
            subHead: subHead,
            party: party,
            amount: amount,
            mode: mode,
            bankName: bankName,
            bankAccount: bankAccount,
            bankIfsc: bankIfsc,
            referenceNo: referenceNo,
            signatory: signatory,
            narration: narration,
            type: 'EXP',
            status: 'active',
            createdBy: this.currentUser,
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };
        
        if (editId) {
            const oldVoucher = this.db.find(v => v.id === editId);
            if (oldVoucher) {
                const logEntry = {
                    id: generateId(),
                    voucherId: editId,
                    vno: oldVoucher.vno,
                    oldData: JSON.stringify(oldVoucher),
                    newData: JSON.stringify(voucher),
                    editedBy: this.currentUser,
                    editedAt: new Date().toISOString(),
                    changes: 'Voucher edited'
                };
                this.editLogs.push(logEntry);
                await this.storage.save(STORAGE_KEYS.EDIT_LOGS, 
                    Object.fromEntries(this.editLogs.map(e => [e.id, e]))
                );
            }
        }
        
        await this.storage.saveVoucher(voucher);
        
        if (!editId) {
            if (!this.voucherCounter[firmKey]) this.voucherCounter[firmKey] = 0;
            this.voucherCounter[firmKey]++;
            await this.storage.save(STORAGE_KEYS.VOUCHER_COUNTER, this.voucherCounter);
        }
        
        if (editId) {
            const idx = this.db.findIndex(v => v.id === editId);
            if (idx !== -1) this.db[idx] = voucher;
        } else {
            this.db.push(voucher);
        }
        
        this.renderAll();
        this.resetForm();
        showToast(editId ? '✅ Voucher updated!' : '✅ Voucher saved!');
        this.updateHeadFilter();
        
        setTimeout(() => this.printVoucher(voucher), 500);
    }

    // ===== PRINT VOUCHER =====
    async printVoucher(voucher) {
        try {
            if (!voucher) {
                showToast('❌ Voucher not found');
                return;
            }
            if (!voucher.amount || isNaN(voucher.amount)) {
                voucher.amount = 0;
            }
            console.log('🖨️ Printing voucher:', voucher.vno, 'Amount:', voucher.amount);
            await this.printEngine.print(voucher, this.allFirms);
        } catch (error) {
            console.error('❌ Print error:', error);
            showToast('❌ Print failed: ' + error.message);
        }
    }

    async printVoucherById(id) {
        try {
            const voucher = this.db.find(v => v.id === id);
            if (!voucher) {
                showToast('❌ Voucher not found');
                return;
            }
            await this.printVoucher(voucher);
        } catch (error) {
            console.error('❌ Print error:', error);
            showToast('❌ Print failed: ' + error.message);
        }
    }

    // ===== RESET FORM (Updated) =====
    resetForm() {
        document.getElementById('edit_id').value = '';
        document.getElementById('expense_head_input').value = '';
        document.getElementById('expense_head_value').value = '';
        document.getElementById('sub_head_input').value = '';
        document.getElementById('sub_head_value').value = '';
        document.getElementById('firm_name_input').value = '';
        document.getElementById('firm_name_value').value = '';
        document.getElementById('party_input').value = '';
        document.getElementById('party_value').value = '';
        document.getElementById('v_amt').value = '0';
        document.getElementById('reference_no').value = '';
        document.getElementById('signatory_input').value = '';
        document.getElementById('signatory_value').value = '';
        document.getElementById('v_narration').value = '';
        
        // ✅ Mode Reset
        document.getElementById('v_mode_input').value = '';
        document.getElementById('v_mode_value').value = 'Cash';
        document.getElementById('modeDropdown').style.display = 'none';
        
        document.getElementById('bank_account').value = '';
        document.getElementById('bank_account_field').style.display = 'none';
        document.getElementById('v_date').value = getToday();
        document.getElementById('form-title').innerHTML = '📝 Add Payment Voucher';
        this.updateFirmHeader();
        this.generateVoucherNo();
        showToast('🔄 Form reset');
    }

    // ===== EDIT VOUCHER (Updated) =====
    editVoucher(id) {
        if (!this.userPermissions.edit && this.currentRole !== 'Admin') {
            showToast('❌ No permission to edit');
            return;
        }
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Voucher not found'); return; }
        
        document.getElementById('edit_id').value = v.id;
        document.getElementById('v_date').value = v.date;
        document.getElementById('expense_head_input').value = v.head;
        document.getElementById('expense_head_value').value = v.head;
        document.getElementById('sub_head_input').value = v.subHead || '';
        document.getElementById('sub_head_value').value = v.subHead || '';
        document.getElementById('firm_name_input').value = v.firmName;
        document.getElementById('firm_name_value').value = v.firmKey;
        document.getElementById('party_input').value = v.party;
        document.getElementById('party_value').value = v.party;
        document.getElementById('v_amt').value = v.amount;
        
        // ✅ Mode Set
        document.getElementById('v_mode_input').value = v.mode;
        document.getElementById('v_mode_value').value = v.mode;
        
        document.getElementById('reference_no').value = v.referenceNo || '';
        document.getElementById('signatory_input').value = v.signatory || '';
        document.getElementById('signatory_value').value = v.signatory || '';
        document.getElementById('v_narration').value = v.narration || '';
        document.getElementById('v_no').value = v.vno;
        document.getElementById('form-title').innerHTML = '✏️ Edit Voucher: ' + v.vno;
        
        if (v.bankName) {
            const bankVal = v.bankName + '|' + (v.bankAccount || '') + '|' + (v.bankIfsc || '');
            document.getElementById('bank_account').value = bankVal;
            document.getElementById('bank_account_field').style.display = 'block';
        }
        
        this.toggleBankField();
        this.updateFirmHeader();
        this.populateSubHeads(v.head);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('✏️ Edit mode - Modify and save');
    }

    // ===== DELETE VOUCHER =====
    async deleteVoucher(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to delete');
            return;
        }
        if (!confirm('Delete this voucher permanently?')) return;
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Voucher not found'); return; }
        
        const deletedV = { ...v, status: 'deleted', deletedBy: this.currentUser, deletedAt: new Date().toISOString() };
        this.deletedVouchers.push(deletedV);
        
        await this.storage.save(STORAGE_KEYS.DELETED, 
            Object.fromEntries(this.deletedVouchers.map(d => [d.id, d]))
        );
        await this.storage.deleteVoucher(id);
        
        this.db = this.db.filter(x => x.id !== id);
        this.renderAll();
        this.generateVoucherNo();
        this.updateHeadFilter();
        showToast('✅ Voucher deleted');
    }

    // ===== RENDER ALL =====
    renderAll() {
        this.renderTable();
        this.updateStats();
        this.renderReports();
    }

    // ===== RENDER TABLE - WITH ENHANCED FILTERS =====
    renderTable() {
        const search = document.getElementById('f_search')?.value?.toLowerCase() || '';
        const start = document.getElementById('f_start')?.value || '';
        const end = document.getElementById('f_end')?.value || '';
        const status = document.getElementById('f_status')?.value || 'ALL';
        
        const amountMin = parseFloat(document.getElementById('f_amount_min')?.value) || 0;
        const amountMax = parseFloat(document.getElementById('f_amount_max')?.value) || Infinity;
        const headFilter = document.getElementById('f_head_filter')?.value || '';
        const partyFilter = document.getElementById('f_party_filter')?.value?.toLowerCase() || '';
        const modeFilter = document.getElementById('f_mode_filter')?.value || '';
        
        let dataToShow = [];
        if (status === 'ALL' || status === 'active') {
            dataToShow = dataToShow.concat(this.db.filter(v => v.status !== 'deleted'));
        }
        if (status === 'ALL' || status === 'deleted') {
            dataToShow = dataToShow.concat(this.deletedVouchers);
        }
        
        const seen = new Set();
        dataToShow = dataToShow.filter(v => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
        });
        
        const filtered = dataToShow.filter(v => {
            let match = true;
            
            if (search) {
                match = match && (
                    v.party?.toLowerCase().includes(search) ||
                    v.head?.toLowerCase().includes(search) ||
                    v.narration?.toLowerCase().includes(search) ||
                    v.vno?.toLowerCase().includes(search) ||
                    v.subHead?.toLowerCase().includes(search) ||
                    v.createdBy?.toLowerCase().includes(search)
                );
            }
            
            if (start) match = match && v.date >= start;
            if (end) match = match && v.date <= end;
            
            if (amountMin > 0) match = match && v.amount >= amountMin;
            if (amountMax < Infinity) match = match && v.amount <= amountMax;
            
            if (headFilter) match = match && v.head === headFilter;
            if (partyFilter) match = match && v.party?.toLowerCase().includes(partyFilter);
            if (modeFilter) match = match && v.mode === modeFilter;
            
            return match;
        });
        
        const tbody = document.getElementById('v_list');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#999; padding:20px;">No vouchers found</td></tr>';
            return;
        }
        
        tbody.innerHTML = filtered.slice().reverse().map(v => {
            const isDeleted = v.status === 'deleted';
            const isEdited = this.editLogs.some(e => e.voucherId === v.id);
            const statusClass = isDeleted ? 'status-deleted' : (isEdited ? 'status-edited' : 'status-active');
            const statusText = isDeleted ? '🗑️ Deleted' : (isEdited ? '✏️ Edited' : '✅ Active');
            
            let actions = '';
            if (!isDeleted) {
                if (this.userPermissions.print || this.currentRole === 'Admin') {
                    actions += `<button class="btn-action btn-print" onclick="app.printVoucherById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
                }
                if (this.userPermissions.whatsapp || this.currentRole === 'Admin') {
                    actions += `<button class="btn-action btn-whatsapp-small" onclick="shareVoucher('${v.id}')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>`;
                }
                if (this.userPermissions.edit || this.currentRole === 'Admin') {
                    actions += `<button class="btn-action btn-edit" onclick="editVoucher('${v.id}')" title="Edit"><i class="fas fa-edit"></i></button>`;
                }
                if (this.userPermissions.delete || this.currentRole === 'Admin') {
                    actions += `<button class="btn-action btn-del" onclick="deleteVoucher('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
                }
            } else {
                actions = `<span style="color:#999; font-size:11px;">Deleted</span>`;
            }
            
            const createdBy = v.createdBy || 'Unknown';
            const creatorBadge = this.currentRole === 'Admin' ? 
                `<span style="background:#2563eb; color:white; padding:2px 8px; border-radius:12px; font-size:10px;">${createdBy}</span>` :
                `<span style="font-size:11px; color:#64748b;">${createdBy}</span>`;
            
            return `<tr>
                <td>${v.date}</td>
                <td><b>${v.vno}</b></td>
                <td>${v.head}</td>
                <td>${v.subHead || '-'}</td>
                <td>${v.party || '-'}</td>
                <td>₹${v.amount.toLocaleString()}</td>
                <td>${v.mode}</td>
                <td>${creatorBadge}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    }

    updateStats() {
        const today = getToday();
        const active = this.db.filter(v => v.status !== 'deleted');
        const todayVouchers = active.filter(v => v.date === today);
        const totalAmount = active.reduce((sum, v) => sum + v.amount, 0);
        
        document.getElementById('stat_today').innerHTML = todayVouchers.length;
        document.getElementById('stat_total').innerHTML = active.length;
        document.getElementById('stat_active').innerHTML = active.length;
        document.getElementById('stat_deleted').innerHTML = this.deletedVouchers.length;
        document.getElementById('stat_edited').innerHTML = this.editLogs.length;
        document.getElementById('stat_amount').innerHTML = '₹ ' + totalAmount.toLocaleString();
    }

    // ===== REPORTS - WITH ENHANCED FILTERS =====
    renderReports() {
        const div = document.getElementById('report_content');
        if (!div) return;
        
        const search = document.getElementById('r_search')?.value?.toLowerCase() || '';
        const start = document.getElementById('r_start')?.value || '';
        const end = document.getElementById('r_end')?.value || '';
        const status = document.getElementById('r_status')?.value || 'ALL';
        const headFilter = document.getElementById('r_head_filter')?.value || '';
        const headFilterOld = document.getElementById('r_head')?.value || '';
        
        const amountMin = parseFloat(document.getElementById('r_amount_min')?.value) || 0;
        const amountMax = parseFloat(document.getElementById('r_amount_max')?.value) || Infinity;
        const partyFilter = document.getElementById('r_party_filter')?.value?.toLowerCase() || '';
        const modeFilter = document.getElementById('r_mode_filter')?.value || '';
        
        const finalHeadFilter = headFilter || headFilterOld;
        
        let allVouchers = [];
        if (status === 'ALL' || status === 'active') {
            allVouchers = allVouchers.concat(this.db.filter(v => v.status !== 'deleted'));
        }
        if (status === 'ALL' || status === 'deleted') {
            allVouchers = allVouchers.concat(this.deletedVouchers);
        }
        
        const seen = new Set();
        allVouchers = allVouchers.filter(v => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
        });
        
        const filtered = allVouchers.filter(v => {
            let match = true;
            
            if (search) {
                match = match && (
                    v.party?.toLowerCase().includes(search) ||
                    v.head?.toLowerCase().includes(search) ||
                    v.narration?.toLowerCase().includes(search) ||
                    v.vno?.toLowerCase().includes(search) ||
                    v.subHead?.toLowerCase().includes(search) ||
                    v.createdBy?.toLowerCase().includes(search)
                );
            }
            
            if (start) match = match && v.date >= start;
            if (end) match = match && v.date <= end;
            
            if (amountMin > 0) match = match && v.amount >= amountMin;
            if (amountMax < Infinity) match = match && v.amount <= amountMax;
            
            if (finalHeadFilter) match = match && v.head === finalHeadFilter;
            if (partyFilter) match = match && v.party?.toLowerCase().includes(partyFilter);
            if (modeFilter) match = match && v.mode === modeFilter;
            
            return match;
        });
        
        if (filtered.length === 0) {
            div.innerHTML = '<p style="color:#999; text-align:center; padding:40px;">No vouchers found</p>';
            return;
        }
        
        div.innerHTML = `
            <div style="margin-bottom:10px; font-size:13px; color:#64748b; display:flex; gap:20px; flex-wrap:wrap;">
                <span>Total: <strong>${filtered.length}</strong></span>
                <span>Active: <strong style="color:var(--success)">${filtered.filter(v => v.status !== 'deleted').length}</strong></span>
                <span>Deleted: <strong style="color:var(--danger)">${filtered.filter(v => v.status === 'deleted').length}</strong></span>
                <span>Edited: <strong style="color:var(--warning)">${filtered.filter(v => this.editLogs.some(e => e.voucherId === v.id)).length}</strong></span>
            </div>
            <div class="table-res">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Voucher No</th><th>Firm</th>
                            <th>Head</th><th>Sub Head</th><th>Party</th>
                            <th>Amount</th><th>Mode</th>
                            <th>Created By</th>
                            <th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.slice().reverse().map(v => {
                            const isDeleted = v.status === 'deleted';
                            const isEdited = this.editLogs.some(e => e.voucherId === v.id);
                            const statusText = isDeleted ? '🗑️ Deleted' : (isEdited ? '✏️ Edited' : '✅ Active');
                            const createdBy = v.createdBy || 'Unknown';
                            
                            let actions = '';
                            if (!isDeleted) {
                                if (this.userPermissions.print || this.currentRole === 'Admin') {
                                    actions += `<button class="btn-action btn-print" onclick="app.printVoucherById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
                                }
                                if (this.userPermissions.edit || this.currentRole === 'Admin') {
                                    actions += `<button class="btn-action btn-edit" onclick="editVoucher('${v.id}')" title="Edit"><i class="fas fa-edit"></i></button>`;
                                }
                                if (this.userPermissions.delete || this.currentRole === 'Admin') {
                                    actions += `<button class="btn-action btn-del" onclick="deleteVoucher('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
                                }
                                if (this.userPermissions.whatsapp || this.currentRole === 'Admin') {
                                    actions += `<button class="btn-action btn-whatsapp-small" onclick="shareVoucher('${v.id}')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>`;
                                }
                            } else {
                                actions = `<span style="color:#999; font-size:11px;">Deleted</span>`;
                            }
                            
                            return `<tr>
                                <td>${v.date}</td>
                                <td><b>${v.vno}</b></td>
                                <td>${v.firmName || v.firmKey || '-'}</td>
                                <td>${v.head}</td>
                                <td>${v.subHead || '-'}</td>
                                <td>${v.party || '-'}</td>
                                <td>₹${v.amount.toLocaleString()}</td>
                                <td>${v.mode}</td>
                                <td><span style="background:#2563eb; color:white; padding:2px 8px; border-radius:12px; font-size:10px;">${createdBy}</span></td>
                                <td>${statusText}</td>
                                <td>${actions}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ${this.editLogs.length > 0 ? `
            <div style="margin-top:20px;">
                <h5>📝 Edit Logs</h5>
                <div class="table-res">
                    <table>
                        <thead><tr><th>Voucher</th><th>Edited By</th><th>Edited At</th></tr></thead>
                        <tbody>
                            ${this.editLogs.slice().reverse().map(log => `
                                <tr>
                                    <td>${log.vno}</td>
                                    <td><span style="background:#f59e0b; color:white; padding:2px 8px; border-radius:12px; font-size:10px;">${log.editedBy}</span></td>
                                    <td>${new Date(log.editedAt).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        `;
    }

    // ===== UPDATE HEAD FILTER =====
    updateHeadFilter() {
        // 1️⃣ Report Head Filter (पुराना - r_head)
        const select = document.getElementById('r_head');
        if (select) {
            const currentVal = select.value;
            const heads = [...new Set(this.db.map(v => v.head).filter(Boolean))];
            select.innerHTML = '<option value="">All Heads</option>';
            heads.forEach(h => {
                select.innerHTML += `<option value="${h}">${h}</option>`;
            });
            if (currentVal) select.value = currentVal;
        }
        
        // 2️⃣ Transaction Head Filter (नया - f_head_filter)
        const selectFilter = document.getElementById('f_head_filter');
        if (selectFilter) {
            const currentVal = selectFilter.value;
            const heads = [...new Set(this.db.map(v => v.head).filter(Boolean))];
            selectFilter.innerHTML = '<option value="">All Heads</option>';
            heads.forEach(h => {
                selectFilter.innerHTML += `<option value="${h}">${h}</option>`;
            });
            if (currentVal) selectFilter.value = currentVal;
        }
        
        // 3️⃣ Report Head Filter (नया - r_head_filter)
        const selectR = document.getElementById('r_head_filter');
        if (selectR) {
            const currentVal = selectR.value;
            const heads = [...new Set(this.db.map(v => v.head).filter(Boolean))];
            selectR.innerHTML = '<option value="">All Heads</option>';
            heads.forEach(h => {
                selectR.innerHTML += `<option value="${h}">${h}</option>`;
            });
            if (currentVal) selectR.value = currentVal;
        }
    }

    // ============================================================
    // MODE DROPDOWN FUNCTIONS (Payment Mode - Search + Dropdown)
    // ============================================================

    getModeOptions() {
        return ['Cash', 'Bank', 'Paytm', 'UPI', 'Cheque'];
    }

    populateModes() {
        const dropdown = document.getElementById('modeDropdown');
        if (!dropdown) return;
        
        const modes = this.getModeOptions();
        dropdown.innerHTML = modes.map(m => 
            `<div onclick="selectMode('${m}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${m}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterModes(search) {
        const dropdown = document.getElementById('modeDropdown');
        if (!dropdown) return;
        
        if (!search || search.length < 1) { 
            this.populateModes();
            return; 
        }
        
        const modes = this.getModeOptions();
        const filtered = modes.filter(m => 
            m.toLowerCase().includes(search.toLowerCase())
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No mode found</div>';
            dropdown.style.display = 'block';
            return;
        }
        
        dropdown.innerHTML = filtered.map(m => 
            `<div onclick="selectMode('${m}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${m}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    selectMode(mode) {
        document.getElementById('v_mode_input').value = mode;
        document.getElementById('v_mode_value').value = mode;
        document.getElementById('modeDropdown').style.display = 'none';
        this.toggleBankField();
    }

    // ============================================================
    // POPULATE FUNCTIONS - SEARCH + DROPDOWN (All Fields)
    // ============================================================

    populateExpenseHeads() {
        const dropdown = document.getElementById('expenseHeadDropdown');
        if (!dropdown) return;
        const heads = Object.keys(this.expenseHeads);
        if (heads.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No heads added. Add in Settings.</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = heads.map(h => 
            `<div onclick="selectExpenseHead('${h.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${h}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populateSubHeads(head) {
        const dropdown = document.getElementById('subHeadDropdown');
        if (!dropdown) return;
        const subHeads = this.expenseHeads[head] || [];
        if (subHeads.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No sub heads available</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = subHeads.map(sh => 
            `<div onclick="selectSubHead('${sh.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${sh}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populateFirmDropdown() {
        const dropdown = document.getElementById('firmDropdown');
        if (!dropdown) return;
        let firms = [];
        if (this.currentRole === 'Admin') firms = Object.keys(this.allFirms);
        else if (this.currentFirm) firms = [this.currentFirm];
        
        if (firms.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No firms available</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = firms.map(f => 
            `<div onclick="selectFirm('${f}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${this.allFirms[f]?.name || f}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populatePartyDropdown() {
        const dropdown = document.getElementById('partyDropdown');
        if (!dropdown) return;
        if (this.parties.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No parties. Add one.</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = this.parties.map(p => 
            `<div onclick="selectParty('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${p.name} ${p.phone ? '📞 ' + p.phone : ''}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populateSignatoryDropdown() {
        const dropdown = document.getElementById('signatoryDropdown');
        if (!dropdown) return;
        if (this.signatories.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No signatories. Add one.</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = this.signatories.map(s => 
            `<div onclick="selectSignatory('${s.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${s.name} ${s.designation ? ' - ' + s.designation : ''}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    // ============================================================
    // FILTER FUNCTIONS - SEARCH + DROPDOWN (All Fields)
    // ============================================================

    filterExpenseHeads(search) {
        const dropdown = document.getElementById('expenseHeadDropdown');
        if (!dropdown) return;
        
        if (!search || search.length < 1) { 
            this.populateExpenseHeads();
            return; 
        }
        
        const heads = Object.keys(this.expenseHeads);
        const filtered = heads.filter(h => h.toLowerCase().includes(search.toLowerCase()));
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No head found</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = filtered.map(h => 
            `<div onclick="selectExpenseHead('${h.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${h}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterSubHeads(search) {
        const dropdown = document.getElementById('subHeadDropdown');
        if (!dropdown) return;
        const head = document.getElementById('expense_head_value').value;
        if (!head) {
            dropdown.innerHTML = '<div class="no-result">Select a head first</div>';
            dropdown.style.display = 'block';
            return;
        }
        const subHeads = this.expenseHeads[head] || [];
        
        if (!search || search.length < 1) {
            this.populateSubHeads(head);
            return;
        }
        
        const filtered = subHeads.filter(sh => sh.toLowerCase().includes(search.toLowerCase()));
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No sub head found</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = filtered.map(sh => 
            `<div onclick="selectSubHead('${sh.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${sh}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterFirms(search) {
        const dropdown = document.getElementById('firmDropdown');
        if (!dropdown) return;
        
        if (!search || search.length < 1) { 
            this.populateFirmDropdown();
            return; 
        }
        
        let firms = [];
        if (this.currentRole === 'Admin') firms = Object.keys(this.allFirms);
        else if (this.currentFirm) firms = [this.currentFirm];
        
        const filtered = firms.filter(f => 
            (this.allFirms[f]?.name || f).toLowerCase().includes(search.toLowerCase())
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No firm found</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = filtered.map(f => 
            `<div onclick="selectFirm('${f}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${this.allFirms[f]?.name || f}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterParties(search) {
        const dropdown = document.getElementById('partyDropdown');
        if (!dropdown) return;
        
        if (!search || search.length < 1) { 
            this.populatePartyDropdown();
            return; 
        }
        
        const filtered = this.parties.filter(p => 
            p.name.toLowerCase().includes(search.toLowerCase())
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No party found</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = filtered.map(p => 
            `<div onclick="selectParty('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${p.name} ${p.phone ? '📞 ' + p.phone : ''}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterSignatories(search) {
        const dropdown = document.getElementById('signatoryDropdown');
        if (!dropdown) return;
        
        if (!search || search.length < 1) { 
            this.populateSignatoryDropdown();
            return; 
        }
        
        const filtered = this.signatories.filter(s => 
            s.name.toLowerCase().includes(search.toLowerCase())
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No signatory found</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = filtered.map(s => 
            `<div onclick="selectSignatory('${s.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${s.name} ${s.designation ? ' - ' + s.designation : ''}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    // ============================================================
    // SELECT FUNCTIONS
    // ============================================================

    selectExpenseHead(head) {
        document.getElementById('expense_head_input').value = head;
        document.getElementById('expense_head_value').value = head;
        document.getElementById('expenseHeadDropdown').style.display = 'none';
        this.populateSubHeads(head);
    }

    selectSubHead(subHead) {
        document.getElementById('sub_head_input').value = subHead;
        document.getElementById('sub_head_value').value = subHead;
        document.getElementById('subHeadDropdown').style.display = 'none';
    }

    selectFirm(firmKey) {
        document.getElementById('firm_name_input').value = this.allFirms[firmKey]?.name || firmKey;
        document.getElementById('firm_name_value').value = firmKey;
        document.getElementById('firmDropdown').style.display = 'none';
        this.updateFirmHeader();
        this.generateVoucherNo();
        this.updateBankDropdown();
    }

    selectParty(name) {
        document.getElementById('party_input').value = name;
        document.getElementById('party_value').value = name;
        document.getElementById('partyDropdown').style.display = 'none';
    }

    selectSignatory(name) {
        document.getElementById('signatory_input').value = name;
        document.getElementById('signatory_value').value = name;
        document.getElementById('signatoryDropdown').style.display = 'none';
    }

    // ===== EXPORT FUNCTIONS =====
    exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') { showToast('Excel library loading...'); return; }
        const ws = XLSX.utils.json_to_sheet(data.map(v => ({
            'Date': v.date,
            'Voucher No': v.vno,
            'Firm': v.firmName || v.firmKey || '',
            'Head': v.head,
            'Sub Head': v.subHead || '',
            'Party': v.party || '',
            'Amount': v.amount,
            'Mode': v.mode,
            'Bank Name': v.bankName || '',
            'Bank Account': v.bankAccount || '',
            'IFSC': v.bankIfsc || '',
            'Reference No': v.referenceNo || '',
            'Signatory': v.signatory || '',
            'Narration': v.narration || '',
            'Created By': v.createdBy || '',
            'Status': v.status || 'active',
            'Created At': v.createdAt || ''
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
        XLSX.writeFile(wb, filename + '.xlsx');
        showToast('📎 Exported: ' + filename);
    }

    exportAllVouchers() {
        const allVouchers = [...this.db.filter(v => v.status !== 'deleted'), ...this.deletedVouchers];
        const unique = [];
        const seen = new Set();
        allVouchers.forEach(v => {
            if (!seen.has(v.id)) { seen.add(v.id); unique.push(v); }
        });
        this.exportToExcel(unique, 'All_Vouchers_Report');
    }

    exportActiveVouchers() {
        this.exportToExcel(this.db.filter(v => v.status !== 'deleted'), 'Active_Vouchers');
    }

    exportDeletedVouchers() {
        this.exportToExcel(this.deletedVouchers, 'Deleted_Vouchers');
    }

    exportEditedVouchers() {
        const editedIds = new Set(this.editLogs.map(e => e.voucherId));
        const editedVouchers = this.db.filter(v => editedIds.has(v.id));
        this.exportToExcel(editedVouchers, 'Edited_Vouchers');
    }

    // ===== SHARE VOUCHER =====
    shareVoucher(id) {
        if (!this.userPermissions.whatsapp && this.currentRole !== 'Admin') {
            showToast('❌ No permission to share');
            return;
        }
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Voucher not found'); return; }
        const message = `*${v.firmName}*\nVoucher: ${v.vno}\nDate: ${v.date}\nHead: ${v.head}\nParty: ${v.party}\nAmount: ₹${v.amount.toFixed(2)}\n\nThank you!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }

    shareInvoiceViaWhatsApp() {
        const voucher = this.db[this.db.length - 1];
        if (!voucher) { showToast('No voucher to share'); return; }
        this.shareVoucher(voucher.id);
    }

    // ===== PARTY FUNCTIONS =====
    openAddPartyModal() {
        if (!this.canAddParty()) {
            showToast('❌ No permission to add party');
            return;
        }
        document.getElementById('edit_party_id').value = '';
        document.getElementById('new_party_name').value = '';
        document.getElementById('new_party_phone').value = '';
        document.getElementById('new_party_address').value = '';
        document.getElementById('partyModalTitle').innerHTML = '➕ Add New Party';
        document.getElementById('addPartyModal').style.display = 'flex';
    }

    closeAddPartyModal() {
        document.getElementById('addPartyModal').style.display = 'none';
    }

    async saveParty() {
        if (!this.canAddParty()) {
            showToast('❌ No permission to add party');
            return;
        }
        const id = document.getElementById('edit_party_id').value;
        const name = document.getElementById('new_party_name').value.trim();
        if (!name) { showToast('Party name required'); return; }
        
        const party = { 
            id: id || generateId(), 
            name: name, 
            phone: document.getElementById('new_party_phone').value.trim(),
            address: document.getElementById('new_party_address').value.trim() 
        };
        
        if (id) {
            const idx = this.parties.findIndex(p => p.id === id);
            if (idx !== -1) this.parties[idx] = party;
        } else {
            if (this.parties.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                showToast('Party already exists');
                return;
            }
            this.parties.push(party);
        }
        
        await this.storage.save(STORAGE_KEYS.PARTIES, 
            Object.fromEntries(this.parties.map(p => [p.id, p]))
        );
        
        this.populatePartyDropdown();
        this.renderPartiesList();
        this.closeAddPartyModal();
        showToast(id ? '✅ Party updated' : '✅ Party added');
    }

    editParty(id) {
        const party = this.parties.find(p => p.id === id);
        if (!party) return;
        document.getElementById('edit_party_id').value = party.id;
        document.getElementById('new_party_name').value = party.name;
        document.getElementById('new_party_phone').value = party.phone || '';
        document.getElementById('new_party_address').value = party.address || '';
        document.getElementById('partyModalTitle').innerHTML = '✏️ Edit Party';
        document.getElementById('addPartyModal').style.display = 'flex';
    }

    async deleteParty(id) {
        if (!confirm('Delete this party?')) return;
        this.parties = this.parties.filter(p => p.id !== id);
        await this.storage.save(STORAGE_KEYS.PARTIES, 
            Object.fromEntries(this.parties.map(p => [p.id, p]))
        );
        this.populatePartyDropdown();
        this.renderPartiesList();
        showToast('✅ Party deleted');
    }

    // ===== SIGNATORY FUNCTIONS =====
    openAddSignatoryModal() {
        if (!this.canAddSignatory()) {
            showToast('❌ No permission to add signatory');
            return;
        }
        document.getElementById('edit_signatory_id').value = '';
        document.getElementById('new_signatory_name').value = '';
        document.getElementById('new_signatory_designation').value = '';
        document.getElementById('signatoryModalTitle').innerHTML = '✍️ Add New Signatory';
        document.getElementById('addSignatoryModal').style.display = 'flex';
    }

    closeAddSignatoryModal() {
        document.getElementById('addSignatoryModal').style.display = 'none';
    }

    async saveSignatory() {
        if (!this.canAddSignatory()) {
            showToast('❌ No permission to add signatory');
            return;
        }
        const id = document.getElementById('edit_signatory_id').value;
        const name = document.getElementById('new_signatory_name').value.trim();
        if (!name) { showToast('Signatory name required'); return; }
        
        const signatory = {
            id: id || generateId(),
            name: name,
            designation: document.getElementById('new_signatory_designation').value.trim()
        };
        
        if (id) {
            const idx = this.signatories.findIndex(s => s.id === id);
            if (idx !== -1) this.signatories[idx] = signatory;
        } else {
            if (this.signatories.find(s => s.name.toLowerCase() === name.toLowerCase())) {
                showToast('Signatory already exists');
                return;
            }
            this.signatories.push(signatory);
        }
        
        await this.storage.save(STORAGE_KEYS.SIGNATORIES,
            Object.fromEntries(this.signatories.map(s => [s.id, s]))
        );
        
        this.populateSignatoryDropdown();
        this.renderSignatoriesList();
        this.closeAddSignatoryModal();
        showToast(id ? '✅ Signatory updated' : '✅ Signatory added');
    }

    editSignatory(id) {
        const sig = this.signatories.find(s => s.id === id);
        if (!sig) return;
        document.getElementById('edit_signatory_id').value = sig.id;
        document.getElementById('new_signatory_name').value = sig.name;
        document.getElementById('new_signatory_designation').value = sig.designation || '';
        document.getElementById('signatoryModalTitle').innerHTML = '✏️ Edit Signatory';
        document.getElementById('addSignatoryModal').style.display = 'flex';
    }

    async deleteSignatory(id) {
        if (!confirm('Delete this signatory?')) return;
        this.signatories = this.signatories.filter(s => s.id !== id);
        await this.storage.save(STORAGE_KEYS.SIGNATORIES,
            Object.fromEntries(this.signatories.map(s => [s.id, s]))
        );
        this.populateSignatoryDropdown();
        this.renderSignatoriesList();
        showToast('✅ Signatory deleted');
    }

    // ===== SETTINGS =====
    openSettings() {
        if (this.currentRole !== 'Admin') {
            showToast('❌ Only Admin can access settings');
            return;
        }
        
        console.log('⚙️ Opening Settings...');
        document.getElementById('settings-modal').style.display = 'flex';
        
        this.renderFirmsList();
        this.renderUsersList();
        this.renderHeadsList();
        this.renderPartiesList();
        this.renderSignatoriesList();
        
        this.updateFirmSelectInSettings();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        this.loadBankAccounts();
        
        console.log('✅ Settings opened successfully');
    }

    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    // ===== FIRM MANAGEMENT =====
    renderFirmsList() {
        const container = document.getElementById('firms_list');
        if (!container) return;
        const firms = Object.keys(this.allFirms);
        if (firms.length === 0) {
            container.innerHTML = '<p style="color:#999;">No firms added</p>';
            return;
        }
        container.innerHTML = firms.map(f => `
            <div class="firm-card" style="padding:12px 15px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; background:#f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                        <span><strong>🏢 ${this.allFirms[f].name}</strong></span>
                        <span>📛 ${this.allFirms[f].short}</span>
                        <span>🔑 ${f}</span>
                        ${this.allFirms[f].logo ? `<span><img src="${this.allFirms[f].logo}" height="25" onerror="this.style.display='none'" style="border-radius:4px;"></span>` : ''}
                    </div>
                    <div>
                        <button class="btn-action btn-edit" onclick="editFirm('${f}')">✏️ Edit</button>
                        ${!['DevVidyalaya', 'DevGas', 'Rama'].includes(f) ? 
                            `<button class="btn-action btn-del" onclick="deleteFirm('${f}')">✖</button>` : ''}
                    </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:15px; margin-top:5px; font-size:12px; color:#64748b;">
                    ${this.allFirms[f].addr ? `<span>📍 ${this.allFirms[f].addr}</span>` : ''}
                    ${this.allFirms[f].mobile ? `<span>📞 ${this.allFirms[f].mobile}</span>` : ''}
                    ${this.allFirms[f].email ? `<span>✉ ${this.allFirms[f].email}</span>` : ''}
                    ${this.allFirms[f].gst ? `<span>📄 GST: ${this.allFirms[f].gst}</span>` : ''}
                    ${this.allFirms[f].pan ? `<span>📄 PAN: ${this.allFirms[f].pan}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    async addFirm() {
        const name = document.getElementById('new_firm_name').value.trim();
        const short = document.getElementById('new_firm_short').value.trim().toUpperCase();
        const logo = document.getElementById('new_firm_logo').value.trim() || 'logo.jpeg';
        
        if (!name) { showToast('Firm name required'); return; }
        if (!short) { showToast('Short code required'); return; }
        
        const key = name.replace(/\s/g, '');
        if (this.allFirms[key]) { showToast('Firm already exists'); return; }
        
        this.allFirms[key] = { name, short, logo, addr: name, mobile: '', email: '', gst: '', pan: '' };
        
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => {
            if (!['DevVidyalaya', 'DevGas', 'Rama'].includes(k)) {
                firmObj[k] = this.allFirms[k];
            }
        });
        await this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        
        this.renderFirmsList();
        this.populateFirmDropdown();
        this.updateFirmSelectInSettings();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        document.getElementById('new_firm_name').value = '';
        document.getElementById('new_firm_short').value = '';
        document.getElementById('new_firm_logo').value = '';
        showToast('✅ Firm added');
    }

    editFirm(key) {
        const firm = this.allFirms[key];
        if (!firm) return;
        
        const newName = prompt('🏢 Firm Name:', firm.name);
        if (newName !== null && newName.trim()) firm.name = newName.trim();
        
        const newShort = prompt('📛 Short Code:', firm.short);
        if (newShort !== null && newShort.trim()) firm.short = newShort.trim().toUpperCase();
        
        const newLogo = prompt('🖼️ Logo URL (logo.jpeg):', firm.logo || 'logo.jpeg');
        if (newLogo !== null) firm.logo = newLogo.trim() || 'logo.jpeg';
        
        const newAddr = prompt('📍 Address:', firm.addr || '');
        if (newAddr !== null) firm.addr = newAddr.trim();
        
        const newMobile = prompt('📞 Mobile No:', firm.mobile || '');
        if (newMobile !== null) firm.mobile = newMobile.trim();
        
        const newEmail = prompt('✉ Email:', firm.email || '');
        if (newEmail !== null) firm.email = newEmail.trim();
        
        const newGst = prompt('📄 GST No (optional):', firm.gst || '');
        if (newGst !== null) firm.gst = newGst.trim();
        
        const newPan = prompt('📄 PAN No (optional):', firm.pan || '');
        if (newPan !== null) firm.pan = newPan.trim();
        
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => {
            if (!['DevVidyalaya', 'DevGas', 'Rama'].includes(k)) {
                firmObj[k] = this.allFirms[k];
            }
        });
        this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        this.renderFirmsList();
        this.populateFirmDropdown();
        this.updateFirmSelectInSettings();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        this.updateFirmHeader();
        showToast('✅ Firm updated successfully!');
    }

    async deleteFirm(key) {
        if (!confirm(`Delete firm "${this.allFirms[key]?.name}"?`)) return;
        if (['DevVidyalaya', 'DevGas', 'Rama'].includes(key)) {
            showToast('Cannot delete default firm');
            return;
        }
        
        const hasVouchers = this.db.some(v => v.firmKey === key) || 
                           this.deletedVouchers.some(v => v.firmKey === key);
        if (hasVouchers) {
            showToast('Cannot delete: vouchers exist');
            return;
        }
        
        delete this.allFirms[key];
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => {
            if (!['DevVidyalaya', 'DevGas', 'Rama'].includes(k)) {
                firmObj[k] = this.allFirms[k];
            }
        });
        await this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        
        this.renderFirmsList();
        this.populateFirmDropdown();
        this.updateFirmSelectInSettings();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        showToast('✅ Firm deleted');
    }

    // ===== USER MANAGEMENT =====
    renderUsersList() {
        const container = document.getElementById('users_list');
        if (!container) return;
        if (this.allUsers.length === 0) {
            container.innerHTML = '<p style="color:#999;">No users added</p>';
            return;
        }
        container.innerHTML = this.allUsers.map(u => {
            const perms = u.permissions || {};
            return `
            <div class="user-card" style="padding:10px 15px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; background:#f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                        <span><strong>👤 ${u.id}</strong></span>
                        <span>🔒 ${u.password}</span>
                        <span><span class="badge" style="background:${u.role === 'Admin' ? '#2563eb' : '#10b981'}">${u.role}</span></span>
                        <span><span class="firm-badge">${u.firm ? this.allFirms[u.firm]?.name || u.firm : '🌐 All Firms'}</span></span>
                    </div>
                    <div>
                        ${u.id !== 'Admin' ? 
                            `<button class="btn-action btn-del" onclick="deleteUser('${u.id}')">✖</button>` : ''}
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-top:5px; font-size:12px; color:#64748b; flex-wrap:wrap;">
                    <span>🖨️ Print: ${perms.print ? '✅' : '❌'}</span>
                    <span>✏️ Edit: ${perms.edit ? '✅' : '❌'}</span>
                    <span>🗑️ Delete: ${perms.delete ? '✅' : '❌'}</span>
                    <span>💬 WhatsApp: ${perms.whatsapp ? '✅' : '❌'}</span>
                    <span>📊 Reports: ${perms.reports ? '✅' : '❌'}</span>
                    <span>👁️ View All: ${perms.view_all ? '✅' : '❌'}</span>
                    <span>👤 Add Party: ${perms.party_add ? '✅' : '❌'}</span>
                    <span>✍️ Add Signatory: ${perms.signatory_add ? '✅' : '❌'}</span>
                    <span>🏦 Add Bank: ${perms.bank_add ? '✅' : '❌'}</span>
                    <span>📂 Add Expense: ${perms.expense_add ? '✅' : '❌'}</span>
                </div>
            </div>
        `}).join('');
    }

    async addUser() {
        const id = document.getElementById('new_user_id').value.trim();
        const pass = document.getElementById('new_user_pass').value.trim();
        const role = document.getElementById('new_user_role').value;
        const firm = document.getElementById('new_user_firm').value;
        
        console.log('👤 Adding User:', { id, role, firm });
        
        if (!id || !pass) { 
            showToast('❌ Enter ID and Password'); 
            return; 
        }
        
        if (this.allUsers.find(u => u.id === id)) { 
            showToast('❌ User already exists'); 
            return; 
        }
        
        if (role !== 'Admin' && !firm) { 
            showToast('❌ Please select a firm for Staff'); 
            return; 
        }
        
        const permissions = {
            print: document.getElementById('perm_print').checked,
            edit: document.getElementById('perm_edit').checked,
            delete: document.getElementById('perm_delete').checked,
            whatsapp: document.getElementById('perm_whatsapp').checked,
            reports: document.getElementById('perm_reports').checked,
            view_all: document.getElementById('perm_view_all').checked,
            party_add: document.getElementById('perm_party_add').checked,
            signatory_add: document.getElementById('perm_signatory_add').checked,
            bank_add: document.getElementById('perm_bank_add').checked,
            expense_add: document.getElementById('perm_expense_add').checked
        };
        
        const user = { 
            id, 
            password: pass, 
            role, 
            firm: role === 'Admin' ? null : firm, 
            permissions 
        };
        
        this.allUsers.push(user);
        
        await this.storage.save(STORAGE_KEYS.USERS,
            Object.fromEntries(this.allUsers.map(u => [u.id, u]))
        );
        
        this.renderUsersList();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        
        document.getElementById('new_user_id').value = '';
        document.getElementById('new_user_pass').value = '';
        document.getElementById('new_user_firm').value = '';
        
        showToast(`✅ ${role} User "${id}" added successfully!`);
        console.log('✅ User added:', user);
    }

    async deleteUser(id) {
        if (id === 'Admin') { showToast('Cannot delete Admin'); return; }
        if (!confirm('Delete user: ' + id + '?')) return;
        this.allUsers = this.allUsers.filter(u => u.id !== id);
        await this.storage.save(STORAGE_KEYS.USERS,
            Object.fromEntries(this.allUsers.map(u => [u.id, u]))
        );
        this.renderUsersList();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        showToast('✅ User deleted');
    }

    // ===== EXPENSE HEADS =====
    renderHeadsList() {
        const container = document.getElementById('heads_list');
        if (!container) return;
        const heads = Object.keys(this.expenseHeads);
        if (heads.length === 0) {
            container.innerHTML = '<p style="color:#999;">No expense heads added</p>';
            return;
        }
        container.innerHTML = heads.map(h => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee; align-items:center; flex-wrap:wrap;">
                <span><strong>${h}</strong> → ${(this.expenseHeads[h] || []).join(', ')}</span>
                <button class="btn-action btn-del" onclick="deleteExpenseHead('${h.replace(/'/g, "\\'")}')">✖</button>
            </div>
        `).join('');
    }

    async addExpenseHead() {
        if (!this.canAddExpense()) {
            showToast('❌ No permission to add expense head');
            return;
        }
        const head = document.getElementById('new_head_name').value.trim();
        const subHead = document.getElementById('new_subhead_name').value.trim();
        if (!head) { showToast('Enter expense head name'); return; }
        if (!this.expenseHeads[head]) this.expenseHeads[head] = [];
        if (subHead && !this.expenseHeads[head].includes(subHead)) {
            this.expenseHeads[head].push(subHead);
        }
        await this.storage.save(STORAGE_KEYS.EXPENSE_HEADS, this.expenseHeads);
        this.populateExpenseHeads();
        this.renderHeadsList();
        this.updateHeadFilter();
        document.getElementById('new_head_name').value = '';
        document.getElementById('new_subhead_name').value = '';
        showToast('✅ Head added');
    }

    async deleteExpenseHead(head) {
        if (!confirm('Delete head: ' + head + '?')) return;
        delete this.expenseHeads[head];
        await this.storage.save(STORAGE_KEYS.EXPENSE_HEADS, this.expenseHeads);
        this.populateExpenseHeads();
        this.renderHeadsList();
        this.updateHeadFilter();
        showToast('✅ Deleted');
    }

    // ===== BANK MANAGEMENT - FIRM WISE =====
    updateBankFirmSelect() {
        const select = document.getElementById('bank_firm_select');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Firm --</option>';
        
        Object.keys(this.allFirms).forEach(f => {
            if (this.allFirms[f]) {
                select.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
            }
        });
        if (currentVal) select.value = currentVal;
    }

    loadBankAccounts() {
        const firmKey = document.getElementById('bank_firm_select')?.value;
        if (!firmKey) {
            const container = document.getElementById('bank_accounts_list');
            if (container) container.innerHTML = '<p style="color:#999;">Select a firm to view banks</p>';
            return;
        }
        this.renderBankAccountsList(firmKey);
    }

    renderBankAccountsList(firmKey) {
        const container = document.getElementById('bank_accounts_list');
        if (!container) return;
        
        const banks = this.bankAccounts[firmKey] || [];
        if (banks.length === 0) {
            container.innerHTML = '<p style="color:#999;">No bank accounts added for this firm</p>';
            return;
        }
        
        container.innerHTML = banks.map((b, index) => `
            <div class="bank-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:5px; background:#fff;">
                <div style="display:flex; gap:15px; flex-wrap:wrap; font-size:13px;">
                    <span><strong>🏦 ${b.name}</strong></span>
                    <span>🔢 ${b.account}</span>
                    <span>🏛️ ${b.ifsc || 'N/A'}</span>
                </div>
                <button class="btn-action btn-del" onclick="app.deleteBankAccount('${firmKey}', ${index})" title="Delete Bank">✖</button>
            </div>
        `).join('');
    }

    async addBankAccount() {
        if (!this.canAddBank()) {
            showToast('❌ No permission to add bank');
            return;
        }
        
        const firmKey = document.getElementById('bank_firm_select').value;
        const name = document.getElementById('new_bank_name').value.trim();
        const account = document.getElementById('new_bank_account').value.trim();
        const ifsc = document.getElementById('new_bank_ifsc').value.trim();
        
        if (!firmKey) { showToast('❌ Please select a firm first'); return; }
        if (!name) { showToast('❌ Please enter bank name'); return; }
        if (!account) { showToast('❌ Please enter account number'); return; }
        
        if (!this.bankAccounts[firmKey]) this.bankAccounts[firmKey] = [];
        this.bankAccounts[firmKey].push({ name, account, ifsc });
        
        await this.storage.save(STORAGE_KEYS.BANK_ACCOUNTS, this.bankAccounts);
        
        this.renderBankAccountsList(firmKey);
        this.updateBankDropdown();
        this.updateBankFirmSelect();
        
        document.getElementById('new_bank_name').value = '';
        document.getElementById('new_bank_account').value = '';
        document.getElementById('new_bank_ifsc').value = '';
        
        showToast('✅ Bank account added successfully!');
    }

    async deleteBankAccount(firmKey, index) {
        if (!confirm('Delete this bank account?')) return;
        
        if (this.bankAccounts[firmKey]) {
            this.bankAccounts[firmKey].splice(index, 1);
            if (this.bankAccounts[firmKey].length === 0) {
                delete this.bankAccounts[firmKey];
            }
        }
        
        await this.storage.save(STORAGE_KEYS.BANK_ACCOUNTS, this.bankAccounts);
        
        this.renderBankAccountsList(firmKey);
        this.updateBankDropdown();
        this.updateBankFirmSelect();
        showToast('✅ Bank account deleted');
    }

    // ===== PERMISSION CHECKS =====
    canAddParty() {
        return this.userPermissions.party_add || this.currentRole === 'Admin';
    }

    canAddSignatory() {
        return this.userPermissions.signatory_add || this.currentRole === 'Admin';
    }

    canAddBank() {
        return this.userPermissions.bank_add || this.currentRole === 'Admin';
    }

    canAddExpense() {
        return this.userPermissions.expense_add || this.currentRole === 'Admin';
    }

    // ===== BULK IMPORT FUNCTIONS =====
    async importExpenseHeads() {
        const fileInput = document.getElementById('importHeadsFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showToast('❌ Please select a file');
            return;
        }
        
        try {
            const data = await this._readFile(fileInput.files[0]);
            let count = 0;
            data.forEach(row => {
                const head = row.Head || row[0];
                const subHead = row.SubHead || row[1];
                if (head) {
                    if (!this.expenseHeads[head]) this.expenseHeads[head] = [];
                    if (subHead && !this.expenseHeads[head].includes(subHead)) {
                        this.expenseHeads[head].push(subHead);
                        count++;
                    }
                }
            });
            await this.storage.save(STORAGE_KEYS.EXPENSE_HEADS, this.expenseHeads);
            this.populateExpenseHeads();
            this.renderHeadsList();
            this.updateHeadFilter();
            showToast(`✅ ${count} Sub-Heads imported!`);
        } catch (error) {
            showToast('❌ Import failed: ' + error.message);
        }
    }

    async importParties() {
        const fileInput = document.getElementById('importPartiesFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showToast('❌ Please select a file');
            return;
        }
        
        try {
            const data = await this._readFile(fileInput.files[0]);
            let count = 0;
            data.forEach(row => {
                const name = row.PartyName || row[0];
                const phone = row.Phone || row[1] || '';
                const address = row.Address || row[2] || '';
                if (name && !this.parties.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                    this.parties.push({ id: generateId(), name, phone, address });
                    count++;
                }
            });
            await this.storage.save(STORAGE_KEYS.PARTIES, 
                Object.fromEntries(this.parties.map(p => [p.id, p]))
            );
            this.populatePartyDropdown();
            this.renderPartiesList();
            showToast(`✅ ${count} Parties imported!`);
        } catch (error) {
            showToast('❌ Import failed: ' + error.message);
        }
    }

    async importVouchers() {
        const fileInput = document.getElementById('importVouchersFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showToast('❌ Please select a file');
            return;
        }
        
        try {
            const data = await this._readFile(fileInput.files[0]);
            let count = 0;
            for (const row of data) {
                const date = row.Date || row[0];
                const vno = row.VoucherNo || row[1];
                const head = row.Head || row[2];
                const party = row.Party || row[3];
                const amount = parseFloat(row.Amount || row[4]) || 0;
                const mode = row.Mode || row[5] || 'Cash';
                const narration = row.Narration || row[6] || '';
                
                if (date && head && party && amount > 0) {
                    const voucher = {
                        id: generateId(),
                        vno: vno || `IMP/${String(count+1).padStart(4,'0')}`,
                        date: date,
                        firmKey: this.currentFirm || 'DevVidyalaya',
                        firmName: this.allFirms[this.currentFirm]?.name || 'Dev Vidyalaya',
                        head: head,
                        subHead: row.SubHead || row[7] || '',
                        party: party,
                        amount: amount,
                        mode: mode,
                        bankName: row.BankName || row[8] || '',
                        bankAccount: row.BankAccount || row[9] || '',
                        bankIfsc: row.IFSC || row[10] || '',
                        referenceNo: row.ReferenceNo || row[11] || '',
                        signatory: row.Signatory || row[12] || '',
                        narration: narration,
                        type: 'EXP',
                        status: 'active',
                        createdBy: this.currentUser,
                        createdAt: new Date().toISOString(),
                        timestamp: Date.now()
                    };
                    await this.storage.saveVoucher(voucher);
                    this.db.push(voucher);
                    count++;
                }
            }
            this.renderAll();
            this.updateStats();
            this.generateVoucherNo();
            this.updateHeadFilter();
            showToast(`✅ ${count} Vouchers imported!`);
        } catch (error) {
            showToast('❌ Import failed: ' + error.message);
        }
    }

    async _readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (file.name.endsWith('.xlsx')) {
                        const workbook = XLSX.read(e.target.result, { type: 'array' });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        const data = XLSX.utils.sheet_to_json(sheet);
                        resolve(data);
                    } else {
                        const lines = e.target.result.split('\n');
                        const headers = lines[0].split(',').map(h => h.trim());
                        const data = [];
                        for (let i = 1; i < lines.length; i++) {
                            if (lines[i].trim()) {
                                const values = lines[i].split(',').map(v => v.trim());
                                const row = {};
                                headers.forEach((h, idx) => {
                                    row[h] = values[idx] || '';
                                });
                                data.push(row);
                            }
                        }
                        resolve(data);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            
            if (file.name.endsWith('.xlsx')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    // ===== SAVE ALL SETTINGS =====
    async saveAllSettings() {
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => {
            if (!['DevVidyalaya', 'DevGas', 'Rama'].includes(k)) {
                firmObj[k] = this.allFirms[k];
            }
        });
        await this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        await this.storage.save(STORAGE_KEYS.EXPENSE_HEADS, this.expenseHeads);
        await this.storage.save(STORAGE_KEYS.BANK_ACCOUNTS, this.bankAccounts);
        
        await this.storage.save(STORAGE_KEYS.USERS,
            Object.fromEntries(this.allUsers.map(u => [u.id, u]))
        );
        
        const perms = {
            print: document.getElementById('perm_print').checked,
            edit: document.getElementById('perm_edit').checked,
            delete: document.getElementById('perm_delete').checked,
            whatsapp: document.getElementById('perm_whatsapp').checked,
            reports: document.getElementById('perm_reports').checked,
            view_all: document.getElementById('perm_view_all').checked,
            party_add: document.getElementById('perm_party_add').checked,
            signatory_add: document.getElementById('perm_signatory_add').checked,
            bank_add: document.getElementById('perm_bank_add').checked,
            expense_add: document.getElementById('perm_expense_add').checked
        };
        await this.storage.save(STORAGE_KEYS.PERMISSIONS, perms);
        this.userPermissions = perms;
        
        showToast('✅ All settings saved!');
        this.closeSettings();
        this.populateFirmDropdown();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateHeadFilter();
        this.updateUI();
    }

    // ===== MODULE SWITCH =====
    switchModule(module) {
        document.querySelectorAll('.module-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
        const pane = document.getElementById('module-' + module);
        if (pane) pane.classList.add('active');
        document.querySelectorAll('.module-tab').forEach(t => {
            if (t.textContent.toLowerCase().includes(module)) t.classList.add('active');
        });
        if (module === 'reports') this.renderReports();
    }

    // ===== UI UPDATE =====
    updateUI() {
        let firmName = 'All Firms (Admin)';
        if (this.currentRole === 'Admin') firmName = 'All Firms (Admin)';
        else if (this.currentFirm && this.allFirms[this.currentFirm]) {
            firmName = this.allFirms[this.currentFirm].name;
        }
        document.getElementById('header_firm_name').innerText = firmName;
    }

    // ===== REAL-TIME LISTENER =====
    setupRealtimeListener() {
        this.storage.onVoucherChange((db) => {
            this.db = db;
            this.renderAll();
            this.updateStats();
            this.generateVoucherNo();
            this.updateHeadFilter();
        });
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        document.getElementById('loginBtn').addEventListener('click', () => this.doLogin());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (document.getElementById('login-screen').style.display !== 'none') {
                    this.doLogin();
                }
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            }
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) this.style.display = 'none';
            });
        });
    }
}

export default App;
