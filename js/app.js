// js/app.js - Main Application (With Search + Dropdown + Recover + Firm-wise)

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
        this.expenseHeads = {};
        this.allUsers = [];
        this.allFirms = {};
        this.voucherCounter = {};
        this.bankAccounts = {};
        this.userPermissions = { ...DEFAULT_PERMISSIONS };
        this.paymentModes = ['Cash', 'Bank', 'UPI', 'Cheque'];
        this.upiApps = ['PhonePe', 'GooglePay', 'Paytm', 'AmazonPay', 'Other'];

        // ✅ NEW: Accounts + Opening Balances
        this.accounts = [];
        this.openingBalances = {};

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
        console.log('✅ Data loaded, firms:', Object.keys(this.allFirms).length);
        this.checkSession();
        this.setupEventListeners();
        this.setupRealtimeListener();
        console.log('✅ App Ready!');
    }

    // ===== LOAD DATA =====
        async loadAllData() {
        const data = await this.storage.loadAllData();
        this.allFirms = data.allFirms || {};
        this.db = data.db || [];
        this.deletedVouchers = data.deletedVouchers || [];
        this.editLogs = data.editLogs || [];
        this.parties = data.parties || [];
        this.expenseHeads = data.expenseHeads || {};
        this.allUsers = data.allUsers || [];
        this.voucherCounter = data.voucherCounter || {};
        this.bankAccounts = data.bankAccounts || {};
        this.userPermissions = data.userPermissions || DEFAULT_PERMISSIONS;

        // ✅ FIX: accounts को array में convert करो
        const acc = data.accounts;
        if (Array.isArray(acc)) {
            this.accounts = acc;
        } else if (acc && typeof acc === 'object') {
            this.accounts = Object.values(acc);
        } else {
            this.accounts = [];
        }

        // ✅ FIX: openingBalances
        this.openingBalances = data.openingBalances || {};

        this.loaded = true;
        console.log('✅ Data loaded. Firms:', Object.keys(this.allFirms).length);
        console.log('✅ Accounts loaded:', this.accounts.length);
    }
    // ===== SESSION =====
    checkSession() {
        if (!this.loaded) {
            console.log('⏳ Data loading in progress, retrying...');
            setTimeout(() => this.checkSession(), 300);
            return;
        }

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

    // ===== SHOW MAIN APP =====
    showMainApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';

        document.getElementById('display_user').innerText = '👤 ' + this.currentUser;
        document.getElementById('display_role').innerText = this.currentRole +
            (this.currentFirm ? ' (' + (this.allFirms[this.currentFirm]?.name || '') + ')' : '');

        const isAdmin = this.currentRole &&
            (this.currentRole.toLowerCase() === 'admin' ||
                this.currentRole === 'Admin' ||
                this.currentRole === 'ADMIN');
        document.getElementById('admin_settings_btn').style.display =
            isAdmin ? 'inline-block' : 'none';

        document.getElementById('v_date').value = getToday();

        // ✅ NEW: 5 Tabs (Contra, Receipt, Cash Book भी)
        let tabs = `<button class="module-tab active" onclick="switchModule('transactions')">📝 Create Voucher</button>`;
        tabs += `<button class="module-tab" onclick="switchModule('contra')">💱 Contra</button>`;
        tabs += `<button class="module-tab" onclick="switchModule('receipt')">🧾 Receipt</button>`;
        tabs += `<button class="module-tab" onclick="switchModule('cashbook')">📊 Cash Book</button>`;
        if (this.userPermissions.reports || isAdmin) {
            tabs += `<button class="module-tab" onclick="switchModule('reports')">📋 Voucher List</button>`;
        }
        document.getElementById('moduleTabsContainer').innerHTML = tabs;

        // ✅ NEW: Date initialize for new forms
        const ctrDate = document.getElementById('ctr_date');
        if (ctrDate) ctrDate.value = getToday();
        const rcpDate = document.getElementById('rcp_date');
        if (rcpDate) rcpDate.value = getToday();
        const cbDate = document.getElementById('cb_date');
        if (cbDate) cbDate.value = getToday();

        this.renderAll();
        this.updateFirmHeader();
        this.generateVoucherNo();
        this.updateFirmDropdownsInSettings();
        this.renderPartiesList();

        // ✅ NEW: Populate Contra + Receipt forms
        this.populateContraAccounts();
        this.generateContraVoucherNo();
        this.generateReceiptVoucherNo();
        this.renderContraList();
        this.renderReceiptList();
    }

    // ===== LOGIN (inline form) =====
    async doLogin() {
        const email = document.getElementById('user_id').value.trim();
        const pass = document.getElementById('user_pass').value.trim();
        const role = document.getElementById('login_role').value;
        const errorDiv = document.getElementById('login_error');

        errorDiv.style.display = 'none';

        if (!email || !pass) {
            errorDiv.innerText = 'Please enter Email and Password';
            errorDiv.style.display = 'block';
            return;
        }
        if (!email.includes('@')) {
            errorDiv.innerText = 'Please enter a valid email address';
            errorDiv.style.display = 'block';
            return;
        }
        if (!role) {
            errorDiv.innerText = 'Please select a Role';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            errorDiv.innerText = '⏳ Logging in...';
            errorDiv.style.color = '#22c55e';
            errorDiv.style.display = 'block';

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signInWithCustomToken(data.token);
            }

            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('firmId', data.user.firmId);

            sessionStorage.setItem('auth', 'ok');
            sessionStorage.setItem('user', data.user.email);
            sessionStorage.setItem('role', role);
            sessionStorage.setItem('firm', data.user.firmId);

            const isAdmin = (role === 'Admin' || data.user.role === 'Admin');
            const permissions = isAdmin
                ? { print: true, edit: true, delete: true, whatsapp: true, reports: true, view_all: true, party_add: true, bank_add: true, expense_add: true, export_import: true, edit_firm: true }
                : (data.user.permissions || { print: true, edit: false, delete: false, whatsapp: true, reports: true, view_all: false, party_add: false, bank_add: false, expense_add: false, export_import: false, edit_firm: false });
            sessionStorage.setItem('permissions', JSON.stringify(permissions));

            this.currentUser = data.user.email;
            this.currentRole = role;
            this.currentFirm = data.user.firmId;

            errorDiv.innerText = '✅ Login successful!';
            errorDiv.style.color = '#22c55e';

            this.showMainApp();
            showToast('✅ Login successful!');

        } catch (error) {
            console.error('❌ Login error:', error);
            errorDiv.innerText = error.message || 'Login failed. Please try again.';
            errorDiv.style.color = '#ef4444';
            errorDiv.style.display = 'block';
        }
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

    // ===== UPDATE LOGIN ROLE DROPDOWN =====
    updateLoginRoleDropdown() {
        const select = document.getElementById('login_role');
        if (!select) return;

        const currentVal = select.value;
        let html = '<option value="">-- Select Role --</option>';
        html += '<option value="Admin">Admin (Full Access)</option>';

        const firms = Object.keys(this.allFirms || {});
        if (firms.length > 0) {
            firms.forEach(f => {
                const firm = this.allFirms[f];
                if (firm && firm.name) {
                    html += `<option value="Staff_${f}">Staff - ${firm.name}</option>`;
                } else if (firm) {
                    html += `<option value="Staff_${f}">Staff - ${f}</option>`;
                }
            });
        } else {
            const fallbackFirms = [
                { key: 'DevVidyalaya', name: 'Dev Vidyalaya' },
                { key: 'DevGas', name: 'Dev Gas Agency' },
                { key: 'Rama', name: 'Rama Enterprises' }
            ];
            fallbackFirms.forEach(f => {
                html += `<option value="Staff_${f.key}">Staff - ${f.name}</option>`;
            });
        }

        select.innerHTML = html;
        if (currentVal) {
            const optionExists = Array.from(select.options).some(opt => opt.value === currentVal);
            if (optionExists) select.value = currentVal;
        }
    }

    updateSettingsRoleDropdown() {
        const select = document.getElementById('new_user_role');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="Admin">Admin</option>';
        Object.keys(this.allFirms).forEach(f => {
            if (this.allFirms[f]) {
                select.innerHTML += `<option value="Staff_${f}">Staff - ${this.allFirms[f].name}</option>`;
            }
        });
        if (currentVal) select.value = currentVal;
    }

    updateFirmSelectInSettings() {
        const select = document.getElementById('new_user_firm');
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

    updateFirmDropdownsInSettings() {
        const firmSelects = ['new_user_firm', 'bank_firm_select', 'expense_head_firm', 'party_firm_filter', 'new_party_firm', 'r_firm_filter', 'import_firm_select', 'ob_firm'];
        firmSelects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- Select Firm --</option>';
            if (id === 'expense_head_firm') {
                select.innerHTML += '<option value="all">🌐 All Firms</option>';
            }
            Object.keys(this.allFirms).forEach(f => {
                if (this.allFirms[f]) {
                    select.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
                }
            });
            if (currentVal) select.value = currentVal;
        });
    }

    // ===== FIRM HEADER =====
    updateFirmHeader() {
        const firmKey = document.getElementById('firm_name_value')?.value || '';
        const firm = this.allFirms[firmKey] || this.allFirms['DevVidyalaya'];
        if (firm) {
            document.getElementById('form_firm_name').innerText = firm.name;
            document.getElementById('form_firm_addr').innerText =
                (firm.addr || '📍 ' + firm.name) + ' | 📞 ' + (firm.mobile || '');
            document.getElementById('form_logo').src = firm.logo || 'logo.png';
        }
        this.updateBankDropdown();
    }

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
        const mode = document.getElementById('v_mode_value').value || 'Cash';
        const bankField = document.getElementById('bank_account_field');
        const upiField = document.getElementById('upi_options_field');
        bankField.style.display = (mode === 'Bank' || mode === 'Cheque') ? 'block' : 'none';
        upiField.style.display = mode === 'UPI' ? 'block' : 'none';
        if (mode === 'Bank' || mode === 'Cheque') this.updateBankDropdown();
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
        const firmVouchers = this.db.filter(v => v.firmKey === firmKey && v.type === 'EXP');
        let count = firmVouchers.length + 1;
        if (this.voucherCounter[firmKey]) count = this.voucherCounter[firmKey] + 1;
        document.getElementById('v_no').value = `${firm.short}/EXP/${fy}/${String(count).padStart(3, '0')}`;
    }

    // ===== SAVE VOUCHER (EXISTING - UNCHANGED) =====
    async saveVoucher() {
        const firmKey = document.getElementById('firm_name_value').value;
        const head = document.getElementById('expense_head_value').value;
        const subHead = document.getElementById('sub_head_value').value;
        const party = document.getElementById('party_value').value;
        const amount = parseFloat(document.getElementById('v_amt').value) || 0;
        const mode = document.getElementById('v_mode_value').value || 'Cash';
        const date = document.getElementById('v_date').value;
        const referenceNo = document.getElementById('reference_no').value.trim();
        const narration = document.getElementById('v_narration').value.trim();
        const vno = document.getElementById('v_no').value;
        const editId = document.getElementById('edit_id').value;

        let bankAccount = '', bankName = '', bankIfsc = '', upiApp = '';

        if (mode === 'Bank' || mode === 'Cheque') {
            const bankVal = document.getElementById('bank_account').value;
            if (bankVal) {
                const parts = bankVal.split('|');
                bankName = parts[0] || '';
                bankAccount = parts[1] || '';
                bankIfsc = parts[2] || '';
            }
        }
        if (mode === 'UPI') {
            upiApp = document.getElementById('upi_app').value || '';
        }

        if (!firmKey) { showToast('Please select a Firm'); return; }
        if (!head) { showToast('Please select Expense Head'); return; }
        if (!party) { showToast('Please select Party'); return; }
        if (amount <= 0) { showToast('Please enter valid amount'); return; }
        if (!date) { showToast('Please select date'); return; }

        const voucher = {
            id: editId || generateId(),
            vno, date, firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            head, subHead, party, amount, mode,
            bankName, bankAccount, bankIfsc, upiApp,
            referenceNo, narration,
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
        showToast(editId ? '✅ Voucher updated!' : '✅ Voucher submitted!');
        this.updateHeadFilter();
        setTimeout(() => this.printVoucher(voucher), 500);
    }

    // ===== PRINT VOUCHER (EXISTING) =====
    async printVoucher(voucher) {
        try {
            if (!voucher) { showToast('❌ Voucher not found'); return; }
            if (!voucher.amount || isNaN(voucher.amount)) voucher.amount = 0;
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
            if (!voucher) { showToast('❌ Voucher not found'); return; }
            await this.printVoucher(voucher);
        } catch (error) {
            console.error('❌ Print error:', error);
            showToast('❌ Print failed: ' + error.message);
        }
    }

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
        document.getElementById('v_narration').value = '';
        document.getElementById('v_mode_input').value = '';
        document.getElementById('v_mode_value').value = 'Cash';
        document.getElementById('modeDropdown').style.display = 'none';
        document.getElementById('bank_account').value = '';
        document.getElementById('bank_account_field').style.display = 'none';
        document.getElementById('upi_options_field').style.display = 'none';
        document.getElementById('upi_app').value = '';
        document.getElementById('v_date').value = getToday();
        document.getElementById('form-title').innerHTML = '📝 Create Payment Voucher';
        this.updateFirmHeader();
        this.generateVoucherNo();
        showToast('🔄 Form reset');
    }

    // ===== EDIT VOUCHER (EXISTING) =====
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
        document.getElementById('v_mode_input').value = v.mode;
        document.getElementById('v_mode_value').value = v.mode;
        document.getElementById('reference_no').value = v.referenceNo || '';
        document.getElementById('v_narration').value = v.narration || '';
        document.getElementById('v_no').value = v.vno;
        document.getElementById('form-title').innerHTML = '✏️ Edit Voucher: ' + v.vno;

        if (v.bankName) {
            const bankVal = v.bankName + '|' + (v.bankAccount || '') + '|' + (v.bankIfsc || '');
            document.getElementById('bank_account').value = bankVal;
            document.getElementById('bank_account_field').style.display = 'block';
        }
        if (v.upiApp) {
            document.getElementById('upi_app').value = v.upiApp;
            document.getElementById('upi_options_field').style.display = 'block';
        }

        this.toggleBankField();
        this.updateFirmHeader();
        this.populateSubHeads(v.head);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('✏️ Edit mode - Modify and submit');
    }

    // ===== DELETE VOUCHER (EXISTING) =====
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

    // ===== RECOVER VOUCHER (EXISTING) =====
    async recoverVoucher(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to recover');
            return;
        }
        if (!confirm('Are you sure you want to recover this voucher?')) return;

        const index = this.deletedVouchers.findIndex(v => v.id === id);
        if (index === -1) { showToast('❌ Deleted voucher not found'); return; }

        const voucher = this.deletedVouchers[index];
        voucher.status = 'active';
        delete voucher.deletedBy;
        delete voucher.deletedAt;

        this.deletedVouchers.splice(index, 1);
        this.db.push(voucher);

        await this.storage.saveVoucher(voucher);
        await this.storage.save(STORAGE_KEYS.DELETED,
            Object.fromEntries(this.deletedVouchers.map(d => [d.id, d]))
        );

        this.renderAll();
        this.updateStats();
        this.generateVoucherNo();
        this.updateHeadFilter();
        showToast(`✅ Voucher ${voucher.vno} recovered successfully!`);
    }

    // ===== RENDER ALL =====
    renderAll() {
        this.renderTable();
        this.updateStats();
        this.renderReports();
    }

    // ===== RENDER TABLE (EXISTING - only EXP type) =====
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
            dataToShow = dataToShow.concat(this.db.filter(v => v.status !== 'deleted' && v.type === 'EXP'));
        }
        if (status === 'ALL' || status === 'deleted') {
            dataToShow = dataToShow.concat(this.deletedVouchers.filter(v => v.type === 'EXP'));
        }

        const seen = new Set();
        dataToShow = dataToShow.filter(v => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
        });

        const filtered = dataToShow.filter(v => {
            let match = true;
            if (this.currentRole !== 'Admin' && this.currentFirm) {
                match = match && v.firmKey === this.currentFirm;
            }
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
                actions = `<button class="btn-action" onclick="app.recoverVoucher('${v.id}')" title="Recover" style="background:#8b5cf6; color:white; padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:11px;">↩️ Recover</button>`;
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
                <td>${v.mode}${v.upiApp ? ' (' + v.upiApp + ')' : ''}</td>
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

    // ===== REPORTS / VOUCHER LIST (EXISTING) =====
    renderReports() {
        const div = document.getElementById('report_content');
        if (!div) return;

        const search = document.getElementById('r_search')?.value?.toLowerCase() || '';
        const start = document.getElementById('r_start')?.value || '';
        const end = document.getElementById('r_end')?.value || '';
        const status = document.getElementById('r_status')?.value || 'ALL';
        const headFilter = document.getElementById('r_head_filter')?.value || '';
        const amountMin = parseFloat(document.getElementById('r_amount_min')?.value) || 0;
        const amountMax = parseFloat(document.getElementById('r_amount_max')?.value) || Infinity;
        const partyFilter = document.getElementById('r_party_filter')?.value?.toLowerCase() || '';
        const modeFilter = document.getElementById('r_mode_filter')?.value || '';
        const firmFilter = document.getElementById('r_firm_filter')?.value || '';

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
            if (this.currentRole !== 'Admin' && this.currentFirm) {
                match = match && v.firmKey === this.currentFirm;
            }
            if (search) {
                match = match && (
                    v.party?.toLowerCase().includes(search) ||
                    v.head?.toLowerCase().includes(search) ||
                    v.narration?.toLowerCase().includes(search) ||
                    v.vno?.toLowerCase().includes(search) ||
                    v.subHead?.toLowerCase().includes(search) ||
                    v.studentName?.toLowerCase().includes(search) ||
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
            if (firmFilter) match = match && v.firmKey === firmFilter;
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
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                <button class="btn-xlsx" onclick="exportAllVouchers()">📎 Export All</button>
                <button class="btn-xlsx" style="background:#10b981;" onclick="exportActiveVouchers()">📎 Export Active</button>
                <button class="btn-xlsx" style="background:#f59e0b;" onclick="exportDeletedVouchers()">📎 Export Deleted</button>
                <button class="btn-xlsx" style="background:#dc2626;" onclick="exportEditedVouchers()">📎 Export Edited</button>
                <button class="btn-xlsx" style="background:#8b5cf6;" onclick="exportFilteredVouchers()">📎 Export Filtered</button>
                <button class="btn-xlsx" style="background:#8b5cf6;" onclick="document.getElementById('importVouchersFile').click()">📥 Import Vouchers</button>
                <button class="btn-xlsx" style="background:#f59e0b;" onclick="app.downloadVoucherTemplate()">📄 Template</button>
                <input type="file" id="importVouchersFile" accept=".csv,.xlsx" style="display:none;" onchange="app.importVouchers()">
            </div>
            <div class="table-res">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Voucher No</th><th>Type</th><th>Firm</th>
                            <th>Head / Student</th><th>Sub Head / Class</th><th>Party</th>
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

                            // ✅ Type badge
                            const typeBadge = v.type === 'CTR' ? '<span style="background:#0891b2; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">💱 CTR</span>' :
                                v.type === 'RCP' ? '<span style="background:#16a34a; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">🧾 RCP</span>' :
                                '<span style="background:#f59e0b; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">📤 EXP</span>';

                            // ✅ Head display for different types
                            let headDisplay = v.head || '-';
                            let subHeadDisplay = v.subHead || '-';
                            let partyDisplay = v.party || '-';

                            if (v.type === 'RCP') {
                                headDisplay = v.studentName ? '🎓 ' + v.studentName : '-';
                                subHeadDisplay = v.studentClass || '-';
                                partyDisplay = v.category || '-';
                            } else if (v.type === 'CTR') {
                                headDisplay = 'From: ' + (v.fromAccount || '-');
                                subHeadDisplay = 'To: ' + (v.toAccount || '-');
                                partyDisplay = '-';
                            }

                            let actions = '';
                            if (!isDeleted) {
                                if (v.type === 'EXP') {
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
                                } else if (v.type === 'CTR') {
                                    actions += `<button class="btn-action btn-print" onclick="app.printContraById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
                                    actions += `<button class="btn-action btn-del" onclick="app.deleteContra('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
                                } else if (v.type === 'RCP') {
                                    actions += `<button class="btn-action btn-print" onclick="app.printReceiptById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
                                    if (v.chequeStatus === 'pending') {
                                        actions += `<button class="btn-action" onclick="app.clearCheque('${v.id}')" title="Clear Cheque" style="background:#16a34a; color:white; padding:4px 8px; border-radius:4px; font-size:11px; border:none; cursor:pointer;">✔</button>`;
                                    }
                                    actions += `<button class="btn-action btn-del" onclick="app.deleteReceipt('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
                                }
                            } else {
                                actions = `<button class="btn-action" onclick="app.recoverVoucher('${v.id}')" title="Recover" style="background:#8b5cf6; color:white; padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:11px;">↩️ Recover</button>`;
                            }

                            return `<tr>
                                <td>${v.date}</td>
                                <td><b>${v.vno}</b></td>
                                <td>${typeBadge}</td>
                                <td>${v.firmName || v.firmKey || '-'}</td>
                                <td>${headDisplay}</td>
                                <td>${subHeadDisplay}</td>
                                <td>${partyDisplay}</td>
                                <td>₹${v.amount.toLocaleString()}</td>
                                <td>${v.mode || '-'}</td>
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

    updateHeadFilter() {
        const headSelects = ['f_head_filter', 'r_head_filter'];
        const heads = [...new Set(this.db.filter(v => v.type === 'EXP').map(v => v.head).filter(Boolean))];
        headSelects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="">All Heads</option>';
            heads.forEach(h => {
                select.innerHTML += `<option value="${h}">${h}</option>`;
            });
            if (currentVal) select.value = currentVal;
        });
    }

    // ===== MODE DROPDOWN =====
    getModeOptions() { return this.paymentModes; }

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
        if (!search || search.length < 1) { this.populateModes(); return; }
        const filtered = this.getModeOptions().filter(m => m.toLowerCase().includes(search.toLowerCase()));
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

    // ===== EXPENSE HEADS =====
    populateExpenseHeads() {
        const dropdown = document.getElementById('expenseHeadDropdown');
        if (!dropdown) return;
        const currentFirmKey = document.getElementById('firm_name_value')?.value || this.currentFirm || '';
        let heads = Object.keys(this.expenseHeads);
        if (currentFirmKey) {
            heads = heads.filter(h => {
                const headFirm = this.expenseHeads[h]?.firm || '';
                return headFirm === '' || headFirm === currentFirmKey;
            });
        }
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
        const subHeads = this.expenseHeads[head]?.subHeads || [];
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

    filterExpenseHeads(search) {
        const dropdown = document.getElementById('expenseHeadDropdown');
        if (!dropdown) return;
        if (!search || search.length < 1) { this.populateExpenseHeads(); return; }
        const currentFirmKey = document.getElementById('firm_name_value')?.value || this.currentFirm || '';
        let heads = Object.keys(this.expenseHeads);
        if (currentFirmKey) {
            heads = heads.filter(h => {
                const headFirm = this.expenseHeads[h]?.firm || '';
                return headFirm === '' || headFirm === currentFirmKey;
            });
        }
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
        const subHeads = this.expenseHeads[head]?.subHeads || [];
        if (!search || search.length < 1) { this.populateSubHeads(head); return; }
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

    // ===== EXPENSE HEADS SETTINGS =====
    renderHeadsList() {
        const container = document.getElementById('heads_list');
        if (!container) return;
        const firm = document.getElementById('expense_head_firm')?.value || '';
        let heads = Object.keys(this.expenseHeads);
        if (firm && firm !== 'all') {
            heads = heads.filter(h => this.expenseHeads[h]?.firm === firm);
        }
        if (heads.length === 0) {
            container.innerHTML = '<p style="color:#999;">No expense heads found</p>';
            return;
        }
        container.innerHTML = heads.map(h => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee; align-items:center; flex-wrap:wrap;">
                <span><strong>${h}</strong> → ${(this.expenseHeads[h]?.subHeads || []).join(', ')}
                ${this.expenseHeads[h]?.firm ? `<span style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-size:10px;">${this.allFirms[this.expenseHeads[h].firm]?.name || this.expenseHeads[h].firm}</span>` : '<span style="background:#8b5cf6; color:white; padding:2px 8px; border-radius:4px; font-size:10px;">All Firms</span>'}</span>
                <button class="btn-action btn-del" onclick="deleteExpenseHead('${h.replace(/'/g, "\\'")}')">✖</button>
            </div>
        `).join('');
    }

    async addExpenseHead() {
        if (!this.canAddExpense()) { showToast('❌ No permission to add expense head'); return; }
        const firm = document.getElementById('expense_head_firm').value;
        const head = document.getElementById('new_head_name').value.trim();
        const subHead = document.getElementById('new_subhead_name').value.trim();

        if (!firm) { showToast('❌ Please select a firm'); return; }
        if (!head) { showToast('Enter expense head name'); return; }

        if (this.expenseHeads[head]) {
            if (subHead && !this.expenseHeads[head].subHeads.includes(subHead)) {
                this.expenseHeads[head].subHeads.push(subHead);
            } else if (!subHead) {
                showToast('✅ Head already exists! Add a Sub Head instead.');
                return;
            }
        } else {
            this.expenseHeads[head] = {
                firm: firm === 'all' ? '' : firm,
                subHeads: subHead ? [subHead] : []
            };
        }

        await this.storage.save(STORAGE_KEYS.EXPENSE_HEADS, this.expenseHeads);
        this.populateExpenseHeads();
        this.renderHeadsList();
        this.updateHeadFilter();
        document.getElementById('new_head_name').value = '';
        document.getElementById('new_subhead_name').value = '';
        showToast('✅ Head added successfully!');
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

    // ===== DROPDOWNS =====
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
        const parties = this.getPartiesForCurrentFirm();
        if (parties.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No parties. Add one.</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = parties.map(p =>
            `<div onclick="selectParty('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${p.name} ${p.phone ? '📞 ' + p.phone : ''}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    filterFirms(search) {
        const dropdown = document.getElementById('firmDropdown');
        if (!dropdown) return;
        if (!search || search.length < 1) { this.populateFirmDropdown(); return; }
        let firms = [];
        if (this.currentRole === 'Admin') firms = Object.keys(this.allFirms);
        else if (this.currentFirm) firms = [this.currentFirm];
        const filtered = firms.filter(f => (this.allFirms[f]?.name || f).toLowerCase().includes(search.toLowerCase()));
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
        if (!search || search.length < 1) { this.populatePartyDropdown(); return; }
        const parties = this.getPartiesForCurrentFirm();
        const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
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

    getPartiesForCurrentFirm() {
        const firmKey = document.getElementById('firm_name_value')?.value || this.currentFirm;
        if (!firmKey) return this.parties;
        return this.parties.filter(p => p.firm === firmKey || !p.firm);
    }

    // ===== PARTY =====
    openAddPartyModal() {
        if (!this.canAddParty()) { showToast('❌ No permission to add party'); return; }
        const firmKey = document.getElementById('firm_name_value')?.value || '';
        document.getElementById('edit_party_id').value = '';
        document.getElementById('edit_party_firm').value = '';
        document.getElementById('new_party_name').value = '';
        document.getElementById('new_party_phone').value = '';
        document.getElementById('new_party_address').value = '';
        document.getElementById('new_party_firm').value = firmKey;
        document.getElementById('partyModalTitle').innerHTML = '➕ Add New Party';
        document.getElementById('addPartyModal').style.display = 'flex';
    }

    openAddPartyModalFromSettings() {
        document.getElementById('edit_party_id').value = '';
        document.getElementById('edit_party_firm').value = '';
        document.getElementById('new_party_name').value = '';
        document.getElementById('new_party_phone').value = '';
        document.getElementById('new_party_address').value = '';
        document.getElementById('partyModalTitle').innerHTML = '➕ Add New Party (Settings)';
        document.getElementById('addPartyModal').style.display = 'flex';
    }

    closeAddPartyModal() {
        document.getElementById('addPartyModal').style.display = 'none';
    }

    async saveParty() {
        if (!this.canAddParty()) { showToast('❌ No permission to add party'); return; }
        const id = document.getElementById('edit_party_id').value;
        const name = document.getElementById('new_party_name').value.trim();
        const firm = document.getElementById('new_party_firm').value || this.currentFirm;
        if (!name) { showToast('Party name required'); return; }

        const party = {
            id: id || generateId(),
            name,
            phone: document.getElementById('new_party_phone').value.trim(),
            address: document.getElementById('new_party_address').value.trim(),
            firm
        };

        if (id) {
            const idx = this.parties.findIndex(p => p.id === id);
            if (idx !== -1) this.parties[idx] = party;
        } else {
            if (this.parties.find(p => p.name.toLowerCase() === name.toLowerCase() && p.firm === firm)) {
                showToast('Party already exists in this firm');
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
        document.getElementById('edit_party_firm').value = party.firm || '';
        document.getElementById('new_party_name').value = party.name;
        document.getElementById('new_party_phone').value = party.phone || '';
        document.getElementById('new_party_address').value = party.address || '';
        document.getElementById('new_party_firm').value = party.firm || '';
        document.getElementById('partyModalTitle').innerHTML = '✏️ Edit Party';
        document.getElementById('addPartyModal').style.display = 'flex';
    }

    async deleteParty(id) {
        const used = this.db.some(v => v.party === this.parties.find(p => p.id === id)?.name);
        if (used) { showToast('❌ Cannot delete: Party is used in vouchers'); return; }
        if (!confirm('Delete this party?')) return;
        this.parties = this.parties.filter(p => p.id !== id);
        await this.storage.save(STORAGE_KEYS.PARTIES,
            Object.fromEntries(this.parties.map(p => [p.id, p]))
        );
        this.populatePartyDropdown();
        this.renderPartiesList();
        showToast('✅ Party deleted');
    }

    renderPartiesList() {
        const container = document.getElementById('parties_list');
        if (!container) return;
        const firmFilter = document.getElementById('party_firm_filter')?.value || '';
        let parties = this.parties;
        if (firmFilter) parties = parties.filter(p => p.firm === firmFilter);
        if (parties.length === 0) {
            container.innerHTML = '<p style="color:#999;">No parties found</p>';
            return;
        }
        container.innerHTML = parties.map(p => `
            <div class="party-card" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:5px; background:#fff; flex-wrap:wrap; gap:5px;">
                <div style="display:flex; gap:15px; flex-wrap:wrap; font-size:13px;">
                    <span><strong>${p.name}</strong></span>
                    ${p.phone ? `<span>📞 ${p.phone}</span>` : ''}
                    ${p.address ? `<span>📍 ${p.address}</span>` : ''}
                    <span style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-size:10px;">${this.allFirms[p.firm]?.name || p.firm || 'No Firm'}</span>
                </div>
                <div>
                    <button class="btn-action btn-edit" onclick="editParty('${p.id}')">✏️</button>
                    <button class="btn-action btn-del" onclick="deleteParty('${p.id}')">✖</button>
                </div>
            </div>
        `).join('');
    }    // ===== SETTINGS =====
    openSettings() {
        const isAdmin = this.currentRole &&
            (this.currentRole.toLowerCase() === 'admin' ||
                this.currentRole === 'Admin' ||
                this.currentRole === 'ADMIN');
        if (!isAdmin) { showToast('❌ Only Admin can access settings'); return; }
        document.getElementById('settings-modal').style.display = 'flex';
        this.renderFirmsList();
        this.renderUsersList();
        this.renderHeadsList();
        this.renderPartiesList();
        this.updateFirmSelectInSettings();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        this.loadBankAccounts();
        this.updateFirmDropdownsInSettings();
        // ✅ NEW
        this.renderAccountsList();
        const obFirmSelect = document.getElementById('ob_firm');
        if (obFirmSelect && !obFirmSelect.value) {
            obFirmSelect.innerHTML = '<option value="">-- Select Firm --</option>';
            Object.keys(this.allFirms).forEach(f => {
                obFirmSelect.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
            });
        }
        const obDateEl = document.getElementById('ob_date');
        if (obDateEl) obDateEl.value = getToday();
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
                        <button class="btn-action btn-del" onclick="deleteFirm('${f}')">✖</button>
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
        const logo = document.getElementById('new_firm_logo').value.trim() || 'logo.png';
        const addr = document.getElementById('new_firm_addr').value.trim();
        const mobile = document.getElementById('new_firm_mobile').value.trim();
        const email = document.getElementById('new_firm_email').value.trim();
        const gst = document.getElementById('new_firm_gst').value.trim();
        const pan = document.getElementById('new_firm_pan').value.trim();

        if (!name) { showToast('Firm name required'); return; }
        if (!short) { showToast('Short code required'); return; }

        const key = name.replace(/\s/g, '');
        if (this.allFirms[key]) { showToast('Firm already exists'); return; }

        this.allFirms[key] = { name, short, logo, addr, mobile, email, gst, pan };

        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => { firmObj[k] = this.allFirms[k]; });
        await this.storage.save(STORAGE_KEYS.FIRMS, firmObj);

        this.renderFirmsList();
        this.populateFirmDropdown();
        this.updateFirmSelectInSettings();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        this.updateFirmDropdownsInSettings();

        document.getElementById('new_firm_name').value = '';
        document.getElementById('new_firm_short').value = '';
        document.getElementById('new_firm_logo').value = '';
        document.getElementById('new_firm_addr').value = '';
        document.getElementById('new_firm_mobile').value = '';
        document.getElementById('new_firm_email').value = '';
        document.getElementById('new_firm_gst').value = '';
        document.getElementById('new_firm_pan').value = '';
        showToast('✅ Firm added');
    }

    editFirm(key) {
        const firm = this.allFirms[key];
        if (!firm) return;

        const newName = prompt('🏢 Firm Name:', firm.name);
        if (newName !== null && newName.trim()) firm.name = newName.trim();

        const newShort = prompt('📛 Short Code:', firm.short);
        if (newShort !== null && newShort.trim()) firm.short = newShort.trim().toUpperCase();

        const newLogo = prompt('🖼️ Logo URL:', firm.logo || 'logo.png');
        if (newLogo !== null) firm.logo = newLogo.trim() || 'logo.png';

        const newAddr = prompt('📍 Address:', firm.addr || '');
        if (newAddr !== null) firm.addr = newAddr.trim();

        const newMobile = prompt('📞 Mobile No:', firm.mobile || '');
        if (newMobile !== null) firm.mobile = newMobile.trim();

        const newEmail = prompt('✉ Email:', firm.email || '');
        if (newEmail !== null) firm.email = newEmail.trim();

        const newGst = prompt('📄 GST No:', firm.gst || '');
        if (newGst !== null) firm.gst = newGst.trim();

        const newPan = prompt('📄 PAN No:', firm.pan || '');
        if (newPan !== null) firm.pan = newPan.trim();

        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => { firmObj[k] = this.allFirms[k]; });
        this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        this.renderFirmsList();
        this.populateFirmDropdown();
        this.updateFirmSelectInSettings();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        this.updateFirmDropdownsInSettings();
        this.updateFirmHeader();
        showToast('✅ Firm updated successfully!');
    }

    async deleteFirm(key) {
        if (!confirm(`Delete firm "${this.allFirms[key]?.name}"?`)) return;
        const hasVouchers = this.db.some(v => v.firmKey === key) || this.deletedVouchers.some(v => v.firmKey === key);
        if (hasVouchers) { showToast('Cannot delete: vouchers exist'); return; }

        delete this.allFirms[key];
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => { firmObj[k] = this.allFirms[k]; });
        await this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        this.renderFirmsList();
        this.populateFirmDropdown();
        this.updateFirmSelectInSettings();
        this.updateLoginRoleDropdown();
        this.updateSettingsRoleDropdown();
        this.updateBankFirmSelect();
        this.updateFirmDropdownsInSettings();
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
            const firmNames = u.firm ? (this.allFirms[u.firm]?.name || u.firm) : '🌐 All Firms';
            const isAdminUser = u.email === 'admin@dev.com' || u.id === 'Admin' || u.username === 'Admin';
            const userKey = u.email || u.id || u.username || '';
            return `
            <div class="user-card" style="padding:10px 15px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; background:#f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                        <span><strong>👤 ${u.email || u.id || u.username}</strong></span>
                        <span><span class="badge" style="background:${u.role === 'Admin' ? '#2563eb' : '#10b981'}">${u.role}</span></span>
                        <span><span class="firm-badge" style="background:#8b5cf6;">${firmNames}</span></span>
                    </div>
                    <div>
                        ${!isAdminUser ?
                            `<button class="btn-action btn-edit" onclick="app.editUser('${userKey}')" title="Edit User" style="background:#f59e0b; color:white; padding:5px 12px; border:none; border-radius:4px; cursor:pointer; margin-right:5px;">✏️ Edit</button>
                             <button class="btn-action btn-del" onclick="app.deleteUser('${userKey}')">✖</button>` :
                            `<span style="color:#94a3b8; font-size:12px;">🔒 Admin (Protected)</span>`
                        }
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-top:5px; font-size:12px; color:#64748b; flex-wrap:wrap;">
                    <span>🖨️ Print: ${perms.print ? '✅' : '❌'}</span>
                    <span>✏️ Edit: ${perms.edit ? '✅' : '❌'}</span>
                    <span>🗑️ Delete: ${perms.delete ? '✅' : '❌'}</span>
                    <span>💬 WhatsApp: ${perms.whatsapp ? '✅' : '❌'}</span>
                    <span>📋 Voucher List: ${perms.reports ? '✅' : '❌'}</span>
                    <span>👁️ View All: ${perms.view_all ? '✅' : '❌'}</span>
                    <span>👤 Add Party: ${perms.party_add ? '✅' : '❌'}</span>
                    <span>🏦 Add Bank: ${perms.bank_add ? '✅' : '❌'}</span>
                    <span>📂 Add Expense: ${perms.expense_add ? '✅' : '❌'}</span>
                    <span>📎 Export/Import: ${perms.export_import ? '✅' : '❌'}</span>
                    <span>✏️ Edit Firm: ${perms.edit_firm ? '✅' : '❌'}</span>
                </div>
            </div>
        `}).join('');
    }

    async addUser() {
        const email = document.getElementById('new_user_id').value.trim();
        const pass = document.getElementById('new_user_pass').value.trim();
        const role = document.getElementById('new_user_role').value;
        const firm = document.getElementById('new_user_firm').value;

        if (!email || !pass) { showToast('❌ Enter Email and Password'); return; }
        if (!email.includes('@')) { showToast('❌ Valid email required'); return; }
        if (this.allUsers.find(u => u.email === email)) { showToast('❌ Email already exists'); return; }
        if (role !== 'Admin' && !firm) { showToast('❌ Please select a firm for Staff'); return; }

        try {
            showToast('⏳ Creating user...');

            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: pass,
                    name: email.split('@')[0],
                    firmId: firm || 'DevVidyalaya',
                    role: role
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to create user');

            const permissions = {
                print: document.getElementById('perm_print')?.checked || false,
                edit: document.getElementById('perm_edit')?.checked || false,
                delete: document.getElementById('perm_delete')?.checked || false,
                whatsapp: document.getElementById('perm_whatsapp')?.checked || false,
                reports: document.getElementById('perm_reports')?.checked || false,
                view_all: document.getElementById('perm_view_all')?.checked || false,
                party_add: document.getElementById('perm_party_add')?.checked || false,
                bank_add: document.getElementById('perm_bank_add')?.checked || false,
                expense_add: document.getElementById('perm_expense_add')?.checked || false,
                export_import: document.getElementById('perm_export_import')?.checked || false,
                edit_firm: document.getElementById('perm_edit_firm')?.checked || false
            };

            const user = {
                email, name: email.split('@')[0], password: pass, role,
                firm: role === 'Admin' ? null : firm,
                permissions
            };

            this.allUsers.push(user);

            const usersObj = {};
            this.allUsers.forEach(u => {
                const safeKey = this.storage.emailToKey(u.email || u.id);
                usersObj[safeKey] = u;
            });
            await this.storage.save(STORAGE_KEYS.USERS, usersObj);

            this.renderUsersList();
            this.updateLoginRoleDropdown();
            this.updateSettingsRoleDropdown();

            document.getElementById('new_user_id').value = '';
            document.getElementById('new_user_pass').value = '';
            document.getElementById('new_user_firm').value = '';

            showToast(`✅ ${role} User "${email}" created successfully!`);

        } catch (error) {
            console.error('❌ Create user error:', error);
            showToast('❌ ' + error.message);
        }
    }

    editUser(identifier) {
        const user = this.allUsers.find(u =>
            u.email === identifier || u.id === identifier || u.username === identifier
        );
        if (!user) { showToast('❌ User not found'); return; }

        document.getElementById('edit_user_identifier').value = identifier;
        document.getElementById('edit_user_email').value = user.email || user.id || user.username;
        document.getElementById('edit_user_password').value = '';
        document.getElementById('edit_user_name').value = user.name || user.email || user.id;
        document.getElementById('edit_user_role').value = user.role || 'Staff';
        document.getElementById('edit_user_firm').value = user.firm || 'DevVidyalaya';

        document.getElementById('edit_perm_print').checked = user.permissions?.print || false;
        document.getElementById('edit_perm_edit').checked = user.permissions?.edit || false;
        document.getElementById('edit_perm_delete').checked = user.permissions?.delete || false;
        document.getElementById('edit_perm_whatsapp').checked = user.permissions?.whatsapp || false;
        document.getElementById('edit_perm_reports').checked = user.permissions?.reports || false;
        document.getElementById('edit_perm_view_all').checked = user.permissions?.view_all || false;
        document.getElementById('edit_perm_party_add').checked = user.permissions?.party_add || false;
        document.getElementById('edit_perm_bank_add').checked = user.permissions?.bank_add || false;
        document.getElementById('edit_perm_expense_add').checked = user.permissions?.expense_add || false;
        document.getElementById('edit_perm_export_import').checked = user.permissions?.export_import || false;
        document.getElementById('edit_perm_edit_firm').checked = user.permissions?.edit_firm || false;

        document.getElementById('editUserModal').style.display = 'flex';
        document.getElementById('editUserModalTitle').innerHTML = `✏️ Edit User: ${user.email || user.id || user.username}`;

        const firmSelect = document.getElementById('edit_user_firm');
        firmSelect.innerHTML = '<option value="">-- Select Firm --</option>';
        Object.keys(this.allFirms).forEach(f => {
            firmSelect.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
        });
        if (user.firm) firmSelect.value = user.firm;
    }

    async updateUser() {
        const identifier = document.getElementById('edit_user_identifier').value;
        const email = document.getElementById('edit_user_email').value.trim();
        const password = document.getElementById('edit_user_password').value.trim();
        const name = document.getElementById('edit_user_name').value.trim();
        const role = document.getElementById('edit_user_role').value;
        const firm = document.getElementById('edit_user_firm').value;

        const userIndex = this.allUsers.findIndex(u =>
            u.email === identifier || u.id === identifier || u.username === identifier
        );
        if (userIndex === -1) { showToast('❌ User not found'); return; }

        try {
            showToast('⏳ Updating user...');

            const permissions = {
                print: document.getElementById('edit_perm_print').checked,
                edit: document.getElementById('edit_perm_edit').checked,
                delete: document.getElementById('edit_perm_delete').checked,
                whatsapp: document.getElementById('edit_perm_whatsapp').checked,
                reports: document.getElementById('edit_perm_reports').checked,
                view_all: document.getElementById('edit_perm_view_all').checked,
                party_add: document.getElementById('edit_perm_party_add').checked,
                bank_add: document.getElementById('edit_perm_bank_add').checked,
                expense_add: document.getElementById('edit_perm_expense_add').checked,
                export_import: document.getElementById('edit_perm_export_import').checked,
                edit_firm: document.getElementById('edit_perm_edit_firm').checked
            };

            this.allUsers[userIndex].email = email;
            this.allUsers[userIndex].name = name;
            this.allUsers[userIndex].role = role;
            this.allUsers[userIndex].firm = role === 'Admin' ? null : firm;
            this.allUsers[userIndex].permissions = permissions;
            if (password) this.allUsers[userIndex].password = password;

            const usersObj = {};
            this.allUsers.forEach(u => {
                const safeKey = this.storage.emailToKey(u.email || u.id);
                usersObj[safeKey] = u;
            });
            await this.storage.save(STORAGE_KEYS.USERS, usersObj);

            this.renderUsersList();
            this.updateLoginRoleDropdown();
            this.updateSettingsRoleDropdown();

            document.getElementById('editUserModal').style.display = 'none';
            showToast(`✅ User "${email}" updated successfully!`);

        } catch (error) {
            console.error('❌ Update user error:', error);
            showToast('❌ ' + error.message);
        }
    }

    closeEditUserModal() {
        document.getElementById('editUserModal').style.display = 'none';
    }

    async deleteUser(identifier) {
        if (identifier === 'Admin' || identifier === 'admin@dev.com') {
            showToast('❌ Cannot delete Admin user');
            return;
        }
        if (!confirm('Delete user: ' + identifier + ' permanently?')) return;

        try {
            showToast('⏳ Deleting user...');
            const user = this.allUsers.find(u =>
                u.email === identifier || u.id === identifier || u.username === identifier
            );
            if (!user) { showToast('❌ User not found'); return; }

            if (this.storage.rtdb) {
                const safeKey = this.storage.emailToKey(user.email || user.id);
                await this.storage.rtdb.ref('users/' + safeKey).remove();
                console.log(`✅ User ${identifier} deleted from database`);
            }

            this.allUsers = this.allUsers.filter(u =>
                (u.email || u.id || u.username) !== identifier
            );

            const usersObj = {};
            this.allUsers.forEach(u => {
                const safeKey = this.storage.emailToKey(u.email || u.id);
                usersObj[safeKey] = u;
            });
            await this.storage.save(STORAGE_KEYS.USERS, usersObj);

            this.renderUsersList();
            this.updateLoginRoleDropdown();
            this.updateSettingsRoleDropdown();
            showToast(`✅ User "${identifier}" deleted successfully!`);

        } catch (error) {
            console.error('❌ Delete user error:', error);
            showToast('❌ ' + error.message);
        }
    }

    // ===== BANK =====
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
        if (!this.canAddBank()) { showToast('❌ No permission to add bank'); return; }
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
            if (this.bankAccounts[firmKey].length === 0) delete this.bankAccounts[firmKey];
        }
        await this.storage.save(STORAGE_KEYS.BANK_ACCOUNTS, this.bankAccounts);
        this.renderBankAccountsList(firmKey);
        this.updateBankDropdown();
        this.updateBankFirmSelect();
        showToast('✅ Bank account deleted');
    }

    // ===== PERMISSIONS =====
    canAddParty() { return this.userPermissions.party_add || this.currentRole === 'Admin'; }
    canAddBank() { return this.userPermissions.bank_add || this.currentRole === 'Admin'; }
    canAddExpense() { return this.userPermissions.expense_add || this.currentRole === 'Admin'; }
    canExportImport() { return this.userPermissions.export_import || this.currentRole === 'Admin'; }
    canEditFirm() { return this.userPermissions.edit_firm || this.currentRole === 'Admin'; }

    // ============================================================
    // ✅ NEW: CONTRA VOUCHER FUNCTIONS
    // ============================================================

        generateContraVoucherNo() {
        // ✅ FIX: Firm dropdown से firm लो, fallback currentFirm
        let firmKey = document.getElementById('ctr_firm')?.value || this.currentFirm || 'DevVidyalaya';
        
        if (!firmKey && this.allFirms) {
            const firms = Object.keys(this.allFirms);
            if (firms.length > 0) firmKey = firms[0];
        }

        const firm = this.allFirms[firmKey];
        const el = document.getElementById('ctr_vno');
        if (!el) return;

        if (!firm) {
            el.value = 'Select Firm First';
            return;
        }

        const fy = getFinancialYear();
        const ctrCount = (this.voucherCounter['CTR_' + firmKey] || 0) + 1;
        el.value = `${firm.short}/CTR/${fy}/${String(ctrCount).padStart(3, '0')}`;
    }
            populateContraAccounts() {
        // ✅ FIX: Firm dropdown से firm लो
        let firmKey = document.getElementById('ctr_firm')?.value || this.currentFirm || 'DevVidyalaya';
        if (!firmKey && this.allFirms) {
            const firms = Object.keys(this.allFirms);
            if (firms.length > 0) firmKey = firms[0];
        }
    // ============================================================
    // ✅ NEW: Firm dropdown functions for Contra + Receipt
    // ============================================================

    populateContraFirms() {
        const select = document.getElementById('ctr_firm');
        if (!select) return;
        select.innerHTML = '<option value="">-- Select Firm --</option>';
        Object.keys(this.allFirms).forEach(f => {
            select.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
        });
        // Auto-select current firm
        if (this.currentFirm) {
            select.value = this.currentFirm;
        } else if (Object.keys(this.allFirms).length > 0) {
            select.value = Object.keys(this.allFirms)[0];
        }
        // Update accounts + voucher no
        this.onContraFirmChange();
    }

    onContraFirmChange() {
        const firmKey = document.getElementById('ctr_firm')?.value;
        if (!firmKey) {
            const fromSel = document.getElementById('ctr_from_account');
            const toSel = document.getElementById('ctr_to_account');
            if (fromSel) fromSel.innerHTML = '<option value="">-- Select Firm First --</option>';
            if (toSel) toSel.innerHTML = '<option value="">-- Select Firm First --</option>';
            const vnoEl = document.getElementById('ctr_vno');
            if (vnoEl) vnoEl.value = 'Select Firm First';
            return;
        }

        // ✅ Accounts load करो
        const banks = this.bankAccounts[firmKey] || [];

        if (!Array.isArray(this.accounts)) {
            const acc = this.accounts;
            if (acc && typeof acc === 'object') this.accounts = Object.values(acc);
            else this.accounts = [];
        }
        const cashAccounts = this.accounts.filter(a => a.type === 'cash' || a.type === 'petty');
        const bankAccounts = this.accounts.filter(a => a.type === 'bank');

        let options = '<option value="">-- Select Account --</option>';
        options += '<option value="Cash">💵 Cash in Hand</option>';
        cashAccounts.forEach(a => {
            options += `<option value="Petty-${a.name}">💵 ${a.name}</option>`;
        });
        banks.forEach(b => {
            options += `<option value="Bank-${b.name}|${b.account}">🏦 ${b.name} - ${b.account}</option>`;
        });
        bankAccounts.forEach(a => {
            options += `<option value="Bank-${a.name}">🏦 ${a.name}</option>`;
        });

        const fromSel = document.getElementById('ctr_from_account');
        const toSel = document.getElementById('ctr_to_account');
        if (fromSel) fromSel.innerHTML = options;
        if (toSel) toSel.innerHTML = options;

        // ✅ Voucher No update
        const firm = this.allFirms[firmKey];
        if (firm) {
            const fy = getFinancialYear();
            const ctrCount = (this.voucherCounter['CTR_' + firmKey] || 0) + 1;
            const vnoEl = document.getElementById('ctr_vno');
            if (vnoEl) vnoEl.value = `${firm.short}/CTR/${fy}/${String(ctrCount).padStart(3, '0')}`;
        }
    }

    populateReceiptFirms() {
        const select = document.getElementById('rcp_firm');
        if (!select) return;
        select.innerHTML = '<option value="">-- Select Firm --</option>';
        Object.keys(this.allFirms).forEach(f => {
            select.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
        });
        // Auto-select current firm
        if (this.currentFirm) {
            select.value = this.currentFirm;
        } else if (Object.keys(this.allFirms).length > 0) {
            select.value = Object.keys(this.allFirms)[0];
        }
        // Update bank + voucher no
        this.onReceiptFirmChange();
    }

    onReceiptFirmChange() {
        const firmKey = document.getElementById('rcp_firm')?.value;
        if (!firmKey) {
            const bankSel = document.getElementById('rcp_bank_account');
            if (bankSel) bankSel.innerHTML = '<option value="">Select Firm First</option>';
            const vnoEl = document.getElementById('rcp_vno');
            if (vnoEl) vnoEl.value = 'Select Firm First';
            return;
        }

        // ✅ Banks load करो
        const banks = this.bankAccounts[firmKey] || [];
        const bankSel = document.getElementById('rcp_bank_account');
        if (bankSel) {
            let options = '<option value="">Select Bank</option>';
            banks.forEach(b => {
                options += `<option value="${b.name}|${b.account}">${b.name} - ${b.account}</option>`;
            });
            bankSel.innerHTML = options;
        }

        // ✅ Voucher No update
        const firm = this.allFirms[firmKey];
        if (firm) {
            const fy = getFinancialYear();
            const rcpCount = (this.voucherCounter['RCP_' + firmKey] || 0) + 1;
            const vnoEl = document.getElementById('rcp_vno');
            if (vnoEl) vnoEl.value = `${firm.short}/RCP/${fy}/${String(rcpCount).padStart(3, '0')}`;
        }
    }
        const banks = this.bankAccounts[firmKey] || [];

        // ✅ ensure array
        if (!Array.isArray(this.accounts)) {
            const acc = this.accounts;
            if (acc && typeof acc === 'object') {
                this.accounts = Object.values(acc);
            } else {
                this.accounts = [];
            }
        }

        const cashAccounts = this.accounts.filter(a => a.type === 'cash' || a.type === 'petty');
        const bankAccounts = this.accounts.filter(a => a.type === 'bank');

        let options = '<option value="">-- Select Account --</option>';
        options += '<option value="Cash">💵 Cash in Hand</option>';

        cashAccounts.forEach(a => {
            options += `<option value="Petty-${a.name}">💵 ${a.name}</option>`;
        });

        banks.forEach(b => {
            options += `<option value="Bank-${b.name}|${b.account}">🏦 ${b.name} - ${b.account}</option>`;
        });

        bankAccounts.forEach(a => {
            options += `<option value="Bank-${a.name}">🏦 ${a.name}</option>`;
        });

        const fromSelect = document.getElementById('ctr_from_account');
        const toSelect = document.getElementById('ctr_to_account');
        if (fromSelect) fromSelect.innerHTML = options;
        if (toSelect) toSelect.innerHTML = options;
    }
        async saveContraVoucher() {
        // ✅ FIX: Firm dropdown से firm लो
        const firmKey = document.getElementById('ctr_firm')?.value || this.currentFirm || 'DevVidyalaya';
        if (!firmKey) { showToast('❌ Please select Firm'); return; }

        const editId = document.getElementById('ctr_edit_id')?.value || '';
        const date = document.getElementById('ctr_date').value;
        const fromAcc = document.getElementById('ctr_from_account').value;
        const toAcc = document.getElementById('ctr_to_account').value;
        const amount = parseFloat(document.getElementById('ctr_amount').value) || 0;
        const reference = document.getElementById('ctr_reference').value.trim();
        const narration = document.getElementById('ctr_narration').value.trim();
        const vno = document.getElementById('ctr_vno').value;

        if (!date) { showToast('❌ Please select date'); return; }
        if (!fromAcc) { showToast('❌ Please select From Account'); return; }
        if (!toAcc) { showToast('❌ Please select To Account'); return; }
        if (fromAcc === toAcc) { showToast('❌ From and To accounts cannot be same'); return; }
        if (amount <= 0) { showToast('❌ Please enter valid amount'); return; }

        const voucher = {
            id: editId || generateId(),
            vno, date, firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            type: 'CTR',
            fromAccount: fromAcc,
            toAccount: toAcc,
            amount, reference, narration,
            status: 'active',
            createdBy: this.currentUser,
            createdAt: editId ? (this.db.find(x => x.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: editId ? new Date().toISOString() : null,
            timestamp: Date.now()
        };

        await this.storage.saveVoucher(voucher);

        if (editId) {
            const idx = this.db.findIndex(x => x.id === editId);
            if (idx !== -1) this.db[idx] = voucher;
            showToast('✅ Contra updated!');
        } else {
            if (!this.voucherCounter['CTR_' + firmKey]) this.voucherCounter['CTR_' + firmKey] = 0;
            this.voucherCounter['CTR_' + firmKey]++;
            await this.storage.save(STORAGE_KEYS.VOUCHER_COUNTER, this.voucherCounter);
            this.db.push(voucher);
            showToast('✅ Contra voucher submitted!');
        }

        this.resetContraForm();
        this.renderContraList();
        setTimeout(() => this.printContraById(voucher.id), 500);
    }

    resetContraForm() {
        const date = document.getElementById('ctr_date');
        if (date) date.value = getToday();
        const from = document.getElementById('ctr_from_account');
        if (from) from.value = '';
        const to = document.getElementById('ctr_to_account');
        if (to) to.value = '';
        const amt = document.getElementById('ctr_amount');
        if (amt) amt.value = '0';
        const ref = document.getElementById('ctr_reference');
        if (ref) ref.value = '';
        const narr = document.getElementById('ctr_narration');
        if (narr) narr.value = '';
        this.generateContraVoucherNo();
        showToast('🔄 Contra form reset');
    }

    renderContraList() {
        const tbody = document.getElementById('ctr_list');
        if (!tbody) return;

        const contraVouchers = this.db.filter(v => v.type === 'CTR' && v.status !== 'deleted');

        if (contraVouchers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#999; padding:20px;">No contra vouchers yet</td></tr>';
            return;
        }

        tbody.innerHTML = contraVouchers.slice().reverse().slice(0, 20).map(v => {
            const fromDisplay = (v.fromAccount || '').replace('Bank-', '🏦 ').replace('Petty-', '💵 ');
            const toDisplay = (v.toAccount || '').replace('Bank-', '🏦 ').replace('Petty-', '💵 ');
            return `<tr>
                <td>${v.date}</td>
                <td><b>${v.vno}</b></td>
                <td>${fromDisplay}</td>
                <td>${toDisplay}</td>
                <td>₹${v.amount.toLocaleString()}</td>
                <td>${v.narration || '-'}</td>
                <td>
                    <button class="btn-action btn-print" onclick="app.printContraById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>
                    <button class="btn-action btn-del" onclick="app.deleteContra('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    async printContraById(id) {
        const voucher = this.db.find(v => v.id === id);
        if (!voucher) { showToast('❌ Contra not found'); return; }
        try {
            const firm = this.allFirms[voucher.firmKey] || {};
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html><head><title>Contra Voucher ${voucher.vno}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .title { font-size: 22px; font-weight: bold; margin: 15px 0; text-align: center; }
                    .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    .table td { padding: 10px; border: 1px solid #ccc; }
                    .label { font-weight: bold; background: #f5f5f5; width: 30%; }
                    .amount { font-size: 18px; font-weight: bold; }
                </style></head>
                <body>
                    <div class="header">
                        <h2>${firm.name || 'Firm'}</h2>
                        <p>${firm.addr || ''} | 📞 ${firm.mobile || ''}</p>
                    </div>
                    <div class="title">CONTRA VOUCHER</div>
                    <table class="table">
                        <tr><td class="label">Voucher No:</td><td>${voucher.vno}</td></tr>
                        <tr><td class="label">Date:</td><td>${voucher.date}</td></tr>
                        <tr><td class="label">From Account:</td><td>${voucher.fromAccount}</td></tr>
                        <tr><td class="label">To Account:</td><td>${voucher.toAccount}</td></tr>
                        <tr><td class="label">Amount:</td><td class="amount">₹ ${voucher.amount.toLocaleString()}</td></tr>
                        <tr><td class="label">Reference:</td><td>${voucher.reference || '-'}</td></tr>
                        <tr><td class="label">Narration:</td><td>${voucher.narration || '-'}</td></tr>
                        <tr><td class="label">Created By:</td><td>${voucher.createdBy}</td></tr>
                    </table>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                        <div>Prepared By: _____________</div>
                        <div>Approved By: _____________</div>
                    </div>
                </body></html>
            `);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        } catch (error) {
            console.error('Print error:', error);
            showToast('❌ Print failed: ' + error.message);
        }
    }

    async deleteContra(id) {
        if (!confirm('Delete this contra voucher?')) return;
        const v = this.db.find(x => x.id === id);
        if (!v) return;
        const deletedV = { ...v, status: 'deleted', deletedBy: this.currentUser, deletedAt: new Date().toISOString() };
        this.deletedVouchers.push(deletedV);
        await this.storage.save(STORAGE_KEYS.DELETED, Object.fromEntries(this.deletedVouchers.map(d => [d.id, d])));
        await this.storage.deleteVoucher(id);
        this.db = this.db.filter(x => x.id !== id);
        this.renderContraList();
        showToast('✅ Contra deleted');
    }

    // ============================================================
    // ✅ NEW: RECEIPT VOUCHER FUNCTIONS
    // ============================================================

    generateReceiptVoucherNo() {
        const firmKey = this.currentFirm || 'DevVidyalaya';
        const firm = this.allFirms[firmKey];
        if (!firm) {
            const el = document.getElementById('rcp_vno');
            if (el) el.value = 'Select Firm First';
            return;
        }
        const fy = getFinancialYear();
        const rcpCount = (this.voucherCounter['RCP_' + firmKey] || 0) + 1;
        const el = document.getElementById('rcp_vno');
        if (el) el.value = `${firm.short}/RCP/${fy}/${String(rcpCount).padStart(3, '0')}`;
    }

    toggleReceiptMode() {
        const mode = document.getElementById('rcp_mode').value;
        const bankField = document.getElementById('rcp_bank_field');
        const upiField = document.getElementById('rcp_upi_field');
        const chequeField = document.getElementById('rcp_cheque_field');

        if (bankField) bankField.style.display = (mode === 'Bank' || mode === 'Cheque') ? 'block' : 'none';
        if (upiField) upiField.style.display = (mode === 'UPI') ? 'block' : 'none';
        if (chequeField) chequeField.style.display = (mode === 'Cheque') ? 'block' : 'none';

        if (mode === 'Bank' || mode === 'Cheque') this.populateReceiptBankDropdown();
    }

    populateReceiptBankDropdown() {
        const firmKey = this.currentFirm || 'DevVidyalaya';
        const banks = this.bankAccounts[firmKey] || [];
        const select = document.getElementById('rcp_bank_account');
        if (!select) return;

        let options = '<option value="">Select Bank</option>';
        banks.forEach(b => {
            options += `<option value="${b.name}|${b.account}">${b.name} - ${b.account}</option>`;
        });
        select.innerHTML = options;
    }

           async saveReceiptVoucher() {
        // ✅ FIX: Firm dropdown से firm लो
        const firmKey = document.getElementById('rcp_firm')?.value || this.currentFirm || 'DevVidyalaya';
        if (!firmKey) { showToast('❌ Please select Firm'); return; }
        const date = document.getElementById('rcp_date').value;
        const studentName = document.getElementById('rcp_student_name').value.trim();
        const fatherName = document.getElementById('rcp_father_name').value.trim();
        const studentClass = document.getElementById('rcp_class').value.trim();
        const roll = document.getElementById('rcp_roll').value.trim();
        const mobile = document.getElementById('rcp_mobile').value.trim();
        const category = document.getElementById('rcp_category').value;
        const amount = parseFloat(document.getElementById('rcp_amount').value) || 0;
        const mode = document.getElementById('rcp_mode').value;
        const bankVal = document.getElementById('rcp_bank_account')?.value || '';
        const upiApp = document.getElementById('rcp_upi_app')?.value || '';
        const chequeNo = document.getElementById('rcp_cheque_no')?.value?.trim() || '';
        const chequeDate = document.getElementById('rcp_cheque_date')?.value || '';
        const chequeBank = document.getElementById('rcp_cheque_bank')?.value?.trim() || '';
        const narration = document.getElementById('rcp_narration').value.trim();
        const vno = document.getElementById('rcp_vno').value;

        if (!date) { showToast('❌ Please select date'); return; }
        if (!studentName) { showToast('❌ Enter student name'); return; }
        if (amount <= 0) { showToast('❌ Enter valid amount'); return; }
        if (mode === 'Cheque' && !chequeNo) { showToast('❌ Enter cheque number'); return; }

        let bankName = '', bankAccount = '';
        if (bankVal) {
            const parts = bankVal.split('|');
            bankName = parts[0] || '';
            bankAccount = parts[1] || '';
        }

        const voucher = {
            id: generateId(),
            vno, date, firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            type: 'RCP',
            studentName, fatherName, studentClass, roll, mobile, category,
            amount, mode,
            bankName, bankAccount, upiApp,
            chequeNo, chequeDate, chequeBank,
            chequeStatus: mode === 'Cheque' ? 'pending' : null,
            narration,
            status: 'active',
            createdBy: this.currentUser,
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };

        await this.storage.saveVoucher(voucher);

        if (!this.voucherCounter['RCP_' + firmKey]) this.voucherCounter['RCP_' + firmKey] = 0;
        this.voucherCounter['RCP_' + firmKey]++;
        await this.storage.save(STORAGE_KEYS.VOUCHER_COUNTER, this.voucherCounter);

        this.db.push(voucher);
        this.resetReceiptForm();
        this.renderReceiptList();
        showToast('✅ Receipt voucher submitted!');
        setTimeout(() => this.printReceiptById(voucher.id), 500);
    }

    resetReceiptForm() {
        const fields = ['rcp_student_name', 'rcp_father_name', 'rcp_class', 'rcp_roll', 'rcp_mobile', 'rcp_cheque_no', 'rcp_cheque_bank', 'rcp_narration'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const dateEl = document.getElementById('rcp_date');
        if (dateEl) dateEl.value = getToday();
        const amt = document.getElementById('rcp_amount');
        if (amt) amt.value = '0';
        const mode = document.getElementById('rcp_mode');
        if (mode) mode.value = 'Cash';
        this.toggleReceiptMode();
        this.generateReceiptVoucherNo();
        showToast('🔄 Receipt form reset');
    }

    renderReceiptList() {
        const tbody = document.getElementById('rcp_list');
        if (!tbody) return;

        const receipts = this.db.filter(v => v.type === 'RCP' && v.status !== 'deleted');

        if (receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:20px;">No receipts yet</td></tr>';
            return;
        }

        tbody.innerHTML = receipts.slice().reverse().slice(0, 20).map(v => {
            let statusBadge = '<span style="background:#16a34a; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">✅ Active</span>';
            if (v.mode === 'Cheque' && v.chequeStatus === 'pending') {
                statusBadge = '<span style="background:#f59e0b; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">⏳ Pending</span>';
            } else if (v.chequeStatus === 'cleared') {
                statusBadge = '<span style="background:#16a34a; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">✅ Cleared</span>';
            } else if (v.chequeStatus === 'bounced') {
                statusBadge = '<span style="background:#dc2626; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">❌ Bounced</span>';
            }

            let chequeBtn = '';
            if (v.mode === 'Cheque' && v.chequeStatus === 'pending') {
                chequeBtn = `<button class="btn-action" onclick="app.clearCheque('${v.id}')" title="Mark as Cleared" style="background:#16a34a; color:white; padding:4px 8px; border:none; border-radius:4px; font-size:11px; cursor:pointer;">✔ Clear</button>`;
            }

            return `<tr>
                <td>${v.date}</td>
                <td><b>${v.vno}</b></td>
                <td>${v.studentName}${v.fatherName ? ' (s/o ' + v.fatherName + ')' : ''}</td>
                <td>${v.studentClass || '-'}</td>
                <td>₹${v.amount.toLocaleString()}</td>
                <td>${v.mode}${v.chequeNo ? ' #' + v.chequeNo : ''}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-action btn-print" onclick="app.printReceiptById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>
                    ${chequeBtn}
                    <button class="btn-action btn-del" onclick="app.deleteReceipt('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    async printReceiptById(id) {
        const voucher = this.db.find(v => v.id === id);
        if (!voucher) { showToast('❌ Receipt not found'); return; }
        try {
            const firm = this.allFirms[voucher.firmKey] || {};
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html><head><title>Receipt ${voucher.vno}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .receipt { max-width: 700px; margin: 0 auto; border: 2px solid #000; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .header h2 { margin: 0; color: #1e293b; }
                    .title { text-align: center; font-size: 20px; font-weight: bold; margin: 10px 0; text-decoration: underline; }
                    .row { display: flex; margin-bottom: 10px; }
                    .row .label { font-weight: bold; width: 180px; }
                    .row .value { flex: 1; }
                    .amount-box { background: #f0f9ff; padding: 12px; border: 1px solid #0284c7; border-radius: 6px; margin: 15px 0; font-size: 18px; text-align: center; font-weight: bold; }
                    .footer { margin-top: 30px; display: flex; justify-content: space-between; }
                    .copy-label { text-align: right; font-size: 12px; color: #666; }
                </style></head>
                <body>
                    <div class="receipt">
                        <div class="header">
                            <h2>${firm.name || 'Firm'}</h2>
                            <p>${firm.addr || ''}<br>📞 ${firm.mobile || ''} | ✉ ${firm.email || ''}</p>
                        </div>
                        <div class="title">FEE RECEIPT</div>
                        <div class="copy-label">Original Copy</div>

                        <div class="row"><span class="label">Receipt No:</span><span class="value">${voucher.vno}</span></div>
                        <div class="row"><span class="label">Date:</span><span class="value">${voucher.date}</span></div>
                        <div class="row"><span class="label">Student Name:</span><span class="value">${voucher.studentName}</span></div>
                        ${voucher.fatherName ? `<div class="row"><span class="label">Father Name:</span><span class="value">${voucher.fatherName}</span></div>` : ''}
                        <div class="row"><span class="label">Class:</span><span class="value">${voucher.studentClass || '-'}${voucher.roll ? ' (Roll: ' + voucher.roll + ')' : ''}</span></div>
                        ${voucher.mobile ? `<div class="row"><span class="label">Mobile:</span><span class="value">${voucher.mobile}</span></div>` : ''}
                        <div class="row"><span class="label">Category:</span><span class="value">${voucher.category}</span></div>
                        <div class="row"><span class="label">Mode:</span><span class="value">${voucher.mode}${voucher.chequeNo ? ' - Cheque #' + voucher.chequeNo + ' (' + (voucher.chequeBank || '') + ')' : ''}${voucher.bankName ? ' - ' + voucher.bankName : ''}${voucher.upiApp ? ' - ' + voucher.upiApp : ''}</span></div>

                        <div class="amount-box">Amount Received: ₹ ${voucher.amount.toLocaleString()}</div>

                        ${voucher.narration ? `<div class="row"><span class="label">Narration:</span><span class="value">${voucher.narration}</span></div>` : ''}

                        <div class="footer">
                            <div>Received By: ${voucher.createdBy}</div>
                            <div>Signature: _____________</div>
                        </div>
                    </div>
                </body></html>
            `);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        } catch (error) {
            console.error('Print error:', error);
            showToast('❌ Print failed: ' + error.message);
        }
    }

    async clearCheque(id) {
        if (!confirm('Mark this cheque as CLEARED?')) return;
        const v = this.db.find(x => x.id === id);
        if (!v) return;
        v.chequeStatus = 'cleared';
        v.clearedAt = new Date().toISOString();
        v.clearedBy = this.currentUser;
        await this.storage.saveVoucher(v);
        this.renderReceiptList();
        showToast('✅ Cheque marked as cleared');
    }

    async deleteReceipt(id) {
        if (!confirm('Delete this receipt?')) return;
        const v = this.db.find(x => x.id === id);
        if (!v) return;
        const deletedV = { ...v, status: 'deleted', deletedBy: this.currentUser, deletedAt: new Date().toISOString() };
        this.deletedVouchers.push(deletedV);
        await this.storage.save(STORAGE_KEYS.DELETED, Object.fromEntries(this.deletedVouchers.map(d => [d.id, d])));
        await this.storage.deleteVoucher(id);
        this.db = this.db.filter(x => x.id !== id);
        this.renderReceiptList();
        showToast('✅ Receipt deleted');
    }
    // ============================================================
    // ✅ PART 3: CONTRA VOUCHER — Edit / Delete / Recover
    // ============================================================

    editContra(id) {
        if (!this.userPermissions.edit && this.currentRole !== 'Admin') {
            showToast('❌ No permission to edit');
            return;
        }
        const v = this.db.find(x => x.id === id);
        if (!v || v.type !== 'CTR') { showToast('Voucher not found'); return; }

        // Form fill करो
        document.getElementById('ctr_edit_id').value = v.id;
        document.getElementById('ctr_date').value = v.date;
        document.getElementById('ctr_from_account').value = v.fromAccount || '';
        document.getElementById('ctr_to_account').value = v.toAccount || '';
        document.getElementById('ctr_amount').value = v.amount;
        document.getElementById('ctr_reference').value = v.reference || '';
        document.getElementById('ctr_narration').value = v.narration || '';
        document.getElementById('ctr_vno').value = v.vno;

        // Button label change
        const submitBtn = document.querySelector('#module-contra .btn-login');
        if (submitBtn) submitBtn.innerHTML = '💾 Update Contra';

        // Module switch करो
        this.switchModule('contra');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('✏️ Edit mode — Modify and submit');
    }

    async saveContraVoucher() {
        // ✅ FIX: Edit + New दोनों handle करो
        const firmKey = this.currentFirm || 'DevVidyalaya';
        const editId = document.getElementById('ctr_edit_id')?.value || '';
        const date = document.getElementById('ctr_date').value;
        const fromAcc = document.getElementById('ctr_from_account').value;
        const toAcc = document.getElementById('ctr_to_account').value;
        const amount = parseFloat(document.getElementById('ctr_amount').value) || 0;
        const reference = document.getElementById('ctr_reference').value.trim();
        const narration = document.getElementById('ctr_narration').value.trim();
        const vno = document.getElementById('ctr_vno').value;

        if (!date) { showToast('❌ Please select date'); return; }
        if (!fromAcc) { showToast('❌ Please select From Account'); return; }
        if (!toAcc) { showToast('❌ Please select To Account'); return; }
        if (fromAcc === toAcc) { showToast('❌ From and To accounts cannot be same'); return; }
        if (amount <= 0) { showToast('❌ Please enter valid amount'); return; }

        const voucher = {
            id: editId || generateId(),
            vno, date, firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            type: 'CTR',
            fromAccount: fromAcc,
            toAccount: toAcc,
            amount, reference, narration,
            status: 'active',
            createdBy: this.currentUser,
            createdAt: editId ? (this.db.find(x => x.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: editId ? new Date().toISOString() : null,
            timestamp: Date.now()
        };

        await this.storage.saveVoucher(voucher);

        if (editId) {
            // ✅ Edit mode — existing update करो
            const idx = this.db.findIndex(x => x.id === editId);
            if (idx !== -1) this.db[idx] = voucher;
            showToast('✅ Contra updated!');
        } else {
            // ✅ New mode — counter बढ़ाओ
            if (!this.voucherCounter['CTR_' + firmKey]) this.voucherCounter['CTR_' + firmKey] = 0;
            this.voucherCounter['CTR_' + firmKey]++;
            await this.storage.save(STORAGE_KEYS.VOUCHER_COUNTER, this.voucherCounter);
            this.db.push(voucher);
            showToast('✅ Contra voucher submitted!');
        }

        this.resetContraForm();
        this.renderContraList();
        setTimeout(() => this.printContraById(voucher.id), 500);
    }

    resetContraForm() {
        const editIdEl = document.getElementById('ctr_edit_id');
        if (editIdEl) editIdEl.value = '';

        const date = document.getElementById('ctr_date');
        if (date) date.value = getToday();
        const from = document.getElementById('ctr_from_account');
        if (from) from.value = '';
        const to = document.getElementById('ctr_to_account');
        if (to) to.value = '';
        const amt = document.getElementById('ctr_amount');
        if (amt) amt.value = '0';
        const ref = document.getElementById('ctr_reference');
        if (ref) ref.value = '';
        const narr = document.getElementById('ctr_narration');
        if (narr) narr.value = '';

        const submitBtn = document.querySelector('#module-contra .btn-login');
        if (submitBtn) submitBtn.innerHTML = '💾 Submit Contra';

        this.generateContraVoucherNo();
    }

    async deleteContra(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to delete');
            return;
        }
        if (!confirm('Delete this contra voucher?')) return;

        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Voucher not found'); return; }

        // ✅ Deleted list में add करो
        const deletedV = { ...v, status: 'deleted', deletedBy: this.currentUser, deletedAt: new Date().toISOString() };
        this.deletedVouchers.push(deletedV);
        await this.storage.save(STORAGE_KEYS.DELETED,
            Object.fromEntries(this.deletedVouchers.map(d => [d.id, d]))
        );

        // ✅ Active से remove
        await this.storage.deleteVoucher(id);
        this.db = this.db.filter(x => x.id !== id);

        this.renderContraList();
        this.renderAll();
        showToast('✅ Contra deleted');
    }

    async recoverContra(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to recover');
            return;
        }
        if (!confirm('Recover this contra voucher?')) return;

        const index = this.deletedVouchers.findIndex(v => v.id === id && v.type === 'CTR');
        if (index === -1) { showToast('❌ Deleted contra not found'); return; }

        const voucher = this.deletedVouchers[index];
        voucher.status = 'active';
        delete voucher.deletedBy;
        delete voucher.deletedAt;

        this.deletedVouchers.splice(index, 1);
        this.db.push(voucher);

        await this.storage.saveVoucher(voucher);
        await this.storage.save(STORAGE_KEYS.DELETED,
            Object.fromEntries(this.deletedVouchers.map(d => [d.id, d]))
        );

        this.renderContraList();
        this.renderAll();
        showToast(`✅ Contra ${voucher.vno} recovered!`);
    }

    // ============================================================
    // ✅ PART 3: RECEIPT VOUCHER — Edit / Delete / Recover
    // ============================================================

    editReceipt(id) {
        if (!this.userPermissions.edit && this.currentRole !== 'Admin') {
            showToast('❌ No permission to edit');
            return;
        }
        const v = this.db.find(x => x.id === id);
        if (!v || v.type !== 'RCP') { showToast('Receipt not found'); return; }

        // Form fill करो
        document.getElementById('rcp_edit_id').value = v.id;
        document.getElementById('rcp_date').value = v.date;
        document.getElementById('rcp_student_name').value = v.studentName || '';
        document.getElementById('rcp_father_name').value = v.fatherName || '';
        document.getElementById('rcp_class').value = v.studentClass || '';
        document.getElementById('rcp_roll').value = v.roll || '';
        document.getElementById('rcp_mobile').value = v.mobile || '';
        document.getElementById('rcp_category').value = v.category || 'Student Fee';
        document.getElementById('rcp_amount').value = v.amount;
        document.getElementById('rcp_mode').value = v.mode || 'Cash';
        document.getElementById('rcp_vno').value = v.vno;
        document.getElementById('rcp_narration').value = v.narration || '';

        // Mode toggle
        this.toggleReceiptMode();

        // Bank select करो
        if (v.bankName && v.bankAccount) {
            const bankVal = v.bankName + '|' + v.bankAccount;
            const bankSel = document.getElementById('rcp_bank_account');
            if (bankSel) bankSel.value = bankVal;
        }
        if (v.upiApp) {
            const upiSel = document.getElementById('rcp_upi_app');
            if (upiSel) upiSel.value = v.upiApp;
        }
        if (v.mode === 'Cheque') {
            document.getElementById('rcp_cheque_no').value = v.chequeNo || '';
            document.getElementById('rcp_cheque_date').value = v.chequeDate || '';
            document.getElementById('rcp_cheque_bank').value = v.chequeBank || '';
        }

        // Button label change
        const submitBtn = document.querySelector('#module-receipt .btn-login');
        if (submitBtn) submitBtn.innerHTML = '💾 Update Receipt';

        // Module switch करो
        this.switchModule('receipt');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('✏️ Edit mode — Modify and submit');
    }

    async saveReceiptVoucher() {
        // ✅ FIX: Edit + New दोनों handle करो
        const firmKey = this.currentFirm || 'DevVidyalaya';
        const editId = document.getElementById('rcp_edit_id')?.value || '';
        const date = document.getElementById('rcp_date').value;
        const studentName = document.getElementById('rcp_student_name').value.trim();
        const fatherName = document.getElementById('rcp_father_name').value.trim();
        const studentClass = document.getElementById('rcp_class').value.trim();
        const roll = document.getElementById('rcp_roll').value.trim();
        const mobile = document.getElementById('rcp_mobile').value.trim();
        const category = document.getElementById('rcp_category').value;
        const amount = parseFloat(document.getElementById('rcp_amount').value) || 0;
        const mode = document.getElementById('rcp_mode').value;
        const bankVal = document.getElementById('rcp_bank_account')?.value || '';
        const upiApp = document.getElementById('rcp_upi_app')?.value || '';
        const chequeNo = document.getElementById('rcp_cheque_no')?.value?.trim() || '';
        const chequeDate = document.getElementById('rcp_cheque_date')?.value || '';
        const chequeBank = document.getElementById('rcp_cheque_bank')?.value?.trim() || '';
        const narration = document.getElementById('rcp_narration').value.trim();
        const vno = document.getElementById('rcp_vno').value;

        if (!date) { showToast('❌ Please select date'); return; }
        if (!studentName) { showToast('❌ Enter student name'); return; }
        if (amount <= 0) { showToast('❌ Enter valid amount'); return; }
        if (mode === 'Cheque' && !chequeNo) { showToast('❌ Enter cheque number'); return; }

        let bankName = '', bankAccount = '';
        if (bankVal) {
            const parts = bankVal.split('|');
            bankName = parts[0] || '';
            bankAccount = parts[1] || '';
        }

        const oldVoucher = editId ? this.db.find(x => x.id === editId) : null;

        const voucher = {
            id: editId || generateId(),
            vno, date, firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            type: 'RCP',
            studentName, fatherName, studentClass, roll, mobile, category,
            amount, mode,
            bankName, bankAccount, upiApp,
            chequeNo, chequeDate, chequeBank,
            chequeStatus: mode === 'Cheque' ? (oldVoucher?.chequeStatus || 'pending') : null,
            narration,
            status: 'active',
            createdBy: this.currentUser,
            createdAt: oldVoucher?.createdAt || new Date().toISOString(),
            updatedAt: editId ? new Date().toISOString() : null,
            timestamp: Date.now()
        };

        await this.storage.saveVoucher(voucher);

        if (editId) {
            const idx = this.db.findIndex(x => x.id === editId);
            if (idx !== -1) this.db[idx] = voucher;
            showToast('✅ Receipt updated!');
        } else {
            if (!this.voucherCounter['RCP_' + firmKey]) this.voucherCounter['RCP_' + firmKey] = 0;
            this.voucherCounter['RCP_' + firmKey]++;
            await this.storage.save(STORAGE_KEYS.VOUCHER_COUNTER, this.voucherCounter);
            this.db.push(voucher);
            showToast('✅ Receipt voucher submitted!');
        }

        this.resetReceiptForm();
        this.renderReceiptList();
        setTimeout(() => this.printReceiptById(voucher.id), 500);
    }

    resetReceiptForm() {
        const editIdEl = document.getElementById('rcp_edit_id');
        if (editIdEl) editIdEl.value = '';

        const fields = ['rcp_student_name', 'rcp_father_name', 'rcp_class', 'rcp_roll', 'rcp_mobile', 'rcp_cheque_no', 'rcp_cheque_bank', 'rcp_narration'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const dateEl = document.getElementById('rcp_date');
        if (dateEl) dateEl.value = getToday();
        const amt = document.getElementById('rcp_amount');
        if (amt) amt.value = '0';
        const mode = document.getElementById('rcp_mode');
        if (mode) mode.value = 'Cash';

        const submitBtn = document.querySelector('#module-receipt .btn-login');
        if (submitBtn) submitBtn.innerHTML = '💾 Submit Receipt';

        this.toggleReceiptMode();
        this.generateReceiptVoucherNo();
    }

    async deleteReceipt(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to delete');
            return;
        }
        if (!confirm('Delete this receipt?')) return;

        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Receipt not found'); return; }

        const deletedV = { ...v, status: 'deleted', deletedBy: this.currentUser, deletedAt: new Date().toISOString() };
        this.deletedVouchers.push(deletedV);
        await this.storage.save(STORAGE_KEYS.DELETED,
            Object.fromEntries(this.deletedVouchers.map(d => [d.id, d]))
        );

        await this.storage.deleteVoucher(id);
        this.db = this.db.filter(x => x.id !== id);

        this.renderReceiptList();
        this.renderAll();
        showToast('✅ Receipt deleted');
    }

    async recoverReceipt(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to recover');
            return;
        }
        if (!confirm('Recover this receipt?')) return;

        const index = this.deletedVouchers.findIndex(v => v.id === id && v.type === 'RCP');
        if (index === -1) { showToast('❌ Deleted receipt not found'); return; }

        const voucher = this.deletedVouchers[index];
        voucher.status = 'active';
        delete voucher.deletedBy;
        delete voucher.deletedAt;

        this.deletedVouchers.splice(index, 1);
        this.db.push(voucher);

        await this.storage.saveVoucher(voucher);
        await this.storage.save(STORAGE_KEYS.DELETED,
            Object.fromEntries(this.deletedVouchers.map(d => [d.id, d]))
        );

        this.renderReceiptList();
        this.renderAll();
        showToast(`✅ Receipt ${voucher.vno} recovered!`);
    }

    // ============================================================
    // ✅ PART 3: UPDATED renderContraList (with Edit + Delete + Print)
    // ============================================================

    renderContraList() {
        const tbody = document.getElementById('ctr_list');
        if (!tbody) return;

        const contraVouchers = this.db.filter(v => v.type === 'CTR' && v.status !== 'deleted');

        if (contraVouchers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#999; padding:20px;">No contra vouchers yet</td></tr>';
            return;
        }

        tbody.innerHTML = contraVouchers.slice().reverse().slice(0, 50).map(v => {
            const fromDisplay = (v.fromAccount || '').replace('Bank-', '🏦 ').replace('Petty-', '💵 ');
            const toDisplay = (v.toAccount || '').replace('Bank-', '🏦 ').replace('Petty-', '💵 ');

            let actions = '';
            if (this.userPermissions.print || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-print" onclick="app.printContraById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
            }
            if (this.userPermissions.edit || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-edit" onclick="app.editContra('${v.id}')" title="Edit"><i class="fas fa-edit"></i></button>`;
            }
            if (this.userPermissions.delete || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-del" onclick="app.deleteContra('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
            }

            return `<tr>
                <td>${v.date}</td>
                <td><b>${v.vno}</b></td>
                <td>${fromDisplay}</td>
                <td>${toDisplay}</td>
                <td>₹${v.amount.toLocaleString()}</td>
                <td>${v.narration || '-'}</td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    }

    // ============================================================
    // ✅ PART 3: UPDATED renderReceiptList (with Edit + Delete + Print + Clear)
    // ============================================================

    renderReceiptList() {
        const tbody = document.getElementById('rcp_list');
        if (!tbody) return;

        const receipts = this.db.filter(v => v.type === 'RCP' && v.status !== 'deleted');

        if (receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:20px;">No receipts yet</td></tr>';
            return;
        }

        tbody.innerHTML = receipts.slice().reverse().slice(0, 50).map(v => {
            let statusBadge = '<span style="background:#16a34a; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">✅ Active</span>';
            if (v.mode === 'Cheque' && v.chequeStatus === 'pending') {
                statusBadge = '<span style="background:#f59e0b; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">⏳ Pending</span>';
            } else if (v.chequeStatus === 'cleared') {
                statusBadge = '<span style="background:#16a34a; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">✅ Cleared</span>';
            } else if (v.chequeStatus === 'bounced') {
                statusBadge = '<span style="background:#dc2626; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">❌ Bounced</span>';
            }

            let actions = '';
            if (this.userPermissions.print || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-print" onclick="app.printReceiptById('${v.id}')" title="Print"><i class="fas fa-print"></i></button>`;
            }
            if (v.mode === 'Cheque' && v.chequeStatus === 'pending') {
                actions += `<button class="btn-action" onclick="app.clearCheque('${v.id}')" title="Mark as Cleared" style="background:#16a34a; color:white; padding:4px 8px; border:none; border-radius:4px; font-size:11px; cursor:pointer;">✔</button>`;
            }
            if (this.userPermissions.edit || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-edit" onclick="app.editReceipt('${v.id}')" title="Edit"><i class="fas fa-edit"></i></button>`;
            }
            if (this.userPermissions.whatsapp || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-whatsapp-small" onclick="app.shareReceipt('${v.id}')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>`;
            }
            if (this.userPermissions.delete || this.currentRole === 'Admin') {
                actions += `<button class="btn-action btn-del" onclick="app.deleteReceipt('${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>`;
            }

            return `<tr>
                <td>${v.date}</td>
                <td><b>${v.vno}</b></td>
                <td>${v.studentName}${v.fatherName ? ' (s/o ' + v.fatherName + ')' : ''}</td>
                <td>${v.studentClass || '-'}</td>
                <td>₹${v.amount.toLocaleString()}</td>
                <td>${v.mode}${v.chequeNo ? ' #' + v.chequeNo : ''}</td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    }

    // ============================================================
    // ✅ PART 3: WhatsApp Share for Receipt
    // ============================================================

    shareReceipt(id) {
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Receipt not found'); return; }
        const message = `*${v.firmName}*\n\n🎓 *Fee Receipt*\nReceipt No: ${v.vno}\nDate: ${v.date}\nStudent: ${v.studentName}\nClass: ${v.studentClass || '-'}\nAmount: ₹${v.amount.toFixed(2)}\nCategory: ${v.category || '-'}\nMode: ${v.mode}\n\nThank you!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
    // ============================================================
    // ✅ NEW: DAILY CASH BOOK
    // ============================================================

    async renderCashBook() {
        const container = document.getElementById('cashbook_content');
        if (!container) return;

        const date = document.getElementById('cb_date')?.value || getToday();
        const firmKey = document.getElementById('cb_firm')?.value || this.currentFirm || 'DevVidyalaya';
        const firm = this.allFirms[firmKey];

        if (!firm) {
            container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Please select a firm</p>';
            return;
        }

        const dayVouchers = this.db.filter(v =>
            v.date === date && v.firmKey === firmKey && v.status !== 'deleted'
        );

        const receipts = dayVouchers.filter(v => v.type === 'RCP');
        const expenses = dayVouchers.filter(v => v.type === 'EXP');
        const contras = dayVouchers.filter(v => v.type === 'CTR');

        const cashInFromReceipts = receipts.filter(v => v.mode === 'Cash' && v.chequeStatus !== 'pending');
        const cashInFromContra = contras.filter(v => v.toAccount === 'Cash');
        const cashOutFromExpenses = expenses.filter(v => v.mode === 'Cash');
        const cashOutFromContra = contras.filter(v => v.fromAccount === 'Cash');

        const totalCashIn = cashInFromReceipts.reduce((s, v) => s + v.amount, 0) + cashInFromContra.reduce((s, v) => s + v.amount, 0);
        const totalCashOut = cashOutFromExpenses.reduce((s, v) => s + v.amount, 0) + cashOutFromContra.reduce((s, v) => s + v.amount, 0);

        const ob = (this.openingBalances && this.openingBalances[firmKey]) || { cash: 0, banks: {} };

        container.innerHTML = `
            <div style="background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
                <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:15px;">
                    <h2 style="margin:0;">${firm.name}</h2>
                    <p style="margin:5px 0; color:#64748b;">${firm.addr || ''}</p>
                    <h3 style="margin:10px 0;">Daily Cash Book — ${date}</h3>
                </div>

                <div style="margin-bottom:15px; padding:10px; background:#f0f9ff; border-radius:6px;">
                    <strong>OPENING BALANCE:</strong> ₹ ${(ob.cash || 0).toLocaleString()}
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
                    <thead>
                        <tr style="background:#dcfce7;">
                            <th style="padding:8px; border:1px solid #cbd5e1; text-align:left;">💰 CASH IN (Receipts / जमा)</th>
                            <th style="padding:8px; border:1px solid #cbd5e1; text-align:right; width:120px;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cashInFromReceipts.map(v => `
                            <tr>
                                <td style="padding:6px; border:1px solid #e2e8f0;">
                                    ${v.vno} - ${v.studentName || '-'} (${v.studentClass || '-'}) - ${v.category || '-'}
                                </td>
                                <td style="padding:6px; border:1px solid #e2e8f0; text-align:right;">₹ ${v.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        ${cashInFromContra.map(v => `
                            <tr>
                                <td style="padding:6px; border:1px solid #e2e8f0;">
                                    ${v.vno} - ${v.fromAccount} → ${v.toAccount} (Contra)
                                </td>
                                <td style="padding:6px; border:1px solid #e2e8f0; text-align:right;">₹ ${v.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        ${(cashInFromReceipts.length + cashInFromContra.length) === 0 ? '<tr><td colspan="2" style="text-align:center; color:#999; padding:10px;">No Cash In</td></tr>' : ''}
                        <tr style="background:#dcfce7; font-weight:bold;">
                            <td style="padding:8px; border:1px solid #cbd5e1;">TOTAL CASH IN</td>
                            <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">₹ ${totalCashIn.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
                    <thead>
                        <tr style="background:#fee2e2;">
                            <th style="padding:8px; border:1px solid #cbd5e1; text-align:left;">💸 CASH OUT (Payments / खर्च)</th>
                            <th style="padding:8px; border:1px solid #cbd5e1; text-align:right; width:120px;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cashOutFromExpenses.map(v => `
                            <tr>
                                <td style="padding:6px; border:1px solid #e2e8f0;">
                                    ${v.vno} - ${v.head || '-'} → ${v.party || '-'}
                                </td>
                                <td style="padding:6px; border:1px solid #e2e8f0; text-align:right;">₹ ${v.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        ${cashOutFromContra.map(v => `
                            <tr>
                                <td style="padding:6px; border:1px solid #e2e8f0;">
                                    ${v.vno} - ${v.fromAccount} → ${v.toAccount} (Contra)
                                </td>
                                <td style="padding:6px; border:1px solid #e2e8f0; text-align:right;">₹ ${v.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        ${(cashOutFromExpenses.length + cashOutFromContra.length) === 0 ? '<tr><td colspan="2" style="text-align:center; color:#999; padding:10px;">No Cash Out</td></tr>' : ''}
                        <tr style="background:#fee2e2; font-weight:bold;">
                            <td style="padding:8px; border:1px solid #cbd5e1;">TOTAL CASH OUT</td>
                            <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">₹ ${totalCashOut.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="margin-top:15px; padding:12px; background:#f0fdf4; border-radius:6px; border:2px solid #16a34a;">
                    <strong>CLOSING BALANCE:</strong> ₹ ${((ob.cash || 0) + totalCashIn - totalCashOut).toLocaleString()}
                </div>
            </div>
        `;
    }

    async printCashBook() {
        const date = document.getElementById('cb_date')?.value || getToday();
        const firmKey = document.getElementById('cb_firm')?.value || this.currentFirm || 'DevVidyalaya';
        const firm = this.allFirms[firmKey];
        if (!firm) { showToast('❌ Select a firm'); return; }

        const printWindow = window.open('', '_blank');
        const content = document.getElementById('cashbook_content').innerHTML;
        printWindow.document.write(`
            <html><head><title>Cash Book - ${date}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 6px; border: 1px solid #ccc; font-size: 13px; }
                h2, h3 { margin: 5px 0; }
                @media print { button { display: none !important; } }
            </style></head>
            <body>${content}</body></html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    }

    // ============================================================
    // ✅ NEW: ACCOUNTS MANAGEMENT
    // ============================================================

        renderAccountsList() {
        const container = document.getElementById('accounts_list');
        if (!container) return;

        // ✅ FIX: ensure array
        if (!Array.isArray(this.accounts)) {
            const acc = this.accounts;
            if (acc && typeof acc === 'object') {
                this.accounts = Object.values(acc);
            } else {
                this.accounts = [];
            }
        }

        const accounts = this.accounts;
        console.log('🎨 Rendering accounts:', accounts);

        if (accounts.length === 0) {
            container.innerHTML = '<p style="color:#999; font-size:12px;">No accounts added. Add Cash, Petty Cash, or Bank accounts.</p>';
            return;
        }

        container.innerHTML = accounts.map(a => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:5px; background:#fff;">
                <div style="display:flex; gap:15px; align-items:center;">
                    <span>${a.type === 'cash' ? '💵' : a.type === 'petty' ? '💵' : '🏦'}</span>
                    <strong>${a.name}</strong>
                    <span style="font-size:11px; background:#e2e8f0; padding:2px 8px; border-radius:4px;">${a.type}</span>
                </div>
                <button class="btn-action btn-del" onclick="app.deleteAccount('${a.id}')" title="Delete">✖</button>
            </div>
        `).join('');
    }

        async addAccount() {
        const typeEl = document.getElementById('new_account_type');
        const nameEl = document.getElementById('new_account_name');
        if (!typeEl || !nameEl) { 
            showToast('❌ Form fields not found'); 
            return; 
        }

        const type = typeEl.value;
        const name = nameEl.value.trim();

        if (!name) { showToast('❌ Enter account name'); return; }

        // ✅ FIX: ensure array
        if (!Array.isArray(this.accounts)) {
            this.accounts = [];
        }

        // Duplicate check
        const existing = this.accounts.find(a => 
            a.name && a.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
            showToast('⚠️ Account already exists');
            return;
        }

        const newAccount = {
            id: generateId(),
            name: name,
            type: type,
            createdAt: new Date().toISOString()
        };

        this.accounts.push(newAccount);
        console.log('📝 New account:', newAccount);
        console.log('📋 All accounts:', this.accounts);

        try {
            // ✅ Save
            await this.storage.save('accounts', this.accounts);
            console.log('✅ Account saved');

            this.renderAccountsList();
            if (typeof this.populateContraAccounts === 'function') {
                this.populateContraAccounts();
            }
            
            nameEl.value = '';
            showToast('✅ Account "' + name + '" added');
        } catch (err) {
            console.error('❌ Save error:', err);
            showToast('❌ Save failed: ' + err.message);
        }
    }

    async deleteAccount(id) {
        if (!confirm('Delete this account?')) return;
        this.accounts = this.accounts.filter(a => a.id !== id);
        await this.storage.save(STORAGE_KEYS.ACCOUNTS, this.accounts);
        this.renderAccountsList();
        showToast('✅ Account deleted');
    }

    // ============================================================
    // ✅ NEW: OPENING BALANCES
    // ============================================================

    loadOpeningBalances() {
        const firmKey = document.getElementById('ob_firm')?.value;
        const container = document.getElementById('opening_balances_list');
        if (!container || !firmKey) {
            if (container) container.innerHTML = '<p style="color:#999; font-size:12px;">Select a firm</p>';
            return;
        }

        const ob = (this.openingBalances && this.openingBalances[firmKey]) || { cash: 0, banks: {} };
        const banks = this.bankAccounts[firmKey] || [];

        let html = `
            <div style="margin-bottom:10px;">
                <label style="font-size:12px;">Cash in Hand (₹)</label>
                <input type="number" id="ob_cash" value="${ob.cash || 0}" style="padding:8px; border-radius:6px; border:1px solid #cbd5e1; width:200px;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="font-size:12px;">Petty Cash Total (₹)</label>
                <input type="number" id="ob_petty" value="${ob.petty || 0}" style="padding:8px; border-radius:6px; border:1px solid #cbd5e1; width:200px;">
            </div>
        `;

        banks.forEach(b => {
            const bankKey = b.name + '_' + b.account;
            const val = (ob.banks && ob.banks[bankKey]) || 0;
            const inputId = 'ob_bank_' + bankKey.replace(/[^a-zA-Z0-9]/g, '_');
            html += `
                <div style="margin-bottom:10px;">
                    <label style="font-size:12px;">🏦 ${b.name} - ${b.account} (₹)</label>
                    <input type="number" id="${inputId}" value="${val}" style="padding:8px; border-radius:6px; border:1px solid #cbd5e1; width:200px;">
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async saveOpeningBalances() {
        const firmKey = document.getElementById('ob_firm')?.value;
        const date = document.getElementById('ob_date')?.value;
        if (!firmKey) { showToast('❌ Select a firm'); return; }

        const cash = parseFloat(document.getElementById('ob_cash')?.value) || 0;
        const petty = parseFloat(document.getElementById('ob_petty')?.value) || 0;
        const banks = {};

        const bankList = this.bankAccounts[firmKey] || [];
        bankList.forEach(b => {
            const bankKey = b.name + '_' + b.account;
            const inputId = 'ob_bank_' + bankKey.replace(/[^a-zA-Z0-9]/g, '_');
            const val = parseFloat(document.getElementById(inputId)?.value) || 0;
            banks[bankKey] = val;
        });

        if (!this.openingBalances) this.openingBalances = {};
        this.openingBalances[firmKey] = { cash, petty, banks, asOnDate: date || getToday() };

        await this.storage.save(STORAGE_KEYS.OPENING_BALANCES, this.openingBalances);
        showToast('✅ Opening balances saved');
    }

    // ===== IMPORT/EXPORT =====
    async importExpenseHeads() {
        if (!this.canExportImport()) { showToast('❌ No permission to import'); return; }
        const fileInput = document.getElementById('importHeadsFile');
        if (!fileInput.files || !fileInput.files[0]) { showToast('❌ Please select a file'); return; }
        try {
            const data = await this._readFile(fileInput.files[0]);
            const firm = document.getElementById('expense_head_firm').value || this.currentFirm;
            if (!firm) { showToast('❌ Please select a firm'); return; }
            let count = 0;
            data.forEach(row => {
                const head = row.Head || row[0];
                const subHead = row.SubHead || row[1];
                if (head) {
                    if (!this.expenseHeads[head]) {
                        this.expenseHeads[head] = { firm: firm === 'all' ? '' : firm, subHeads: [] };
                    }
                    if (subHead && !this.expenseHeads[head].subHeads.includes(subHead)) {
                        this.expenseHeads[head].subHeads.push(subHead);
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
        if (!this.canExportImport()) { showToast('❌ No permission to import'); return; }
        const fileInput = document.getElementById('importPartiesFile');
        if (!fileInput.files || !fileInput.files[0]) { showToast('❌ Please select a file'); return; }
        try {
            const data = await this._readFile(fileInput.files[0]);
            const firm = document.getElementById('party_firm_filter')?.value || this.currentFirm;
            let count = 0;
            data.forEach(row => {
                const name = row.PartyName || row[0];
                const phone = row.Phone || row[1] || '';
                const address = row.Address || row[2] || '';
                if (name && !this.parties.find(p => p.name.toLowerCase() === name.toLowerCase() && p.firm === firm)) {
                    this.parties.push({ id: generateId(), name, phone, address, firm: firm || '' });
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
        if (!this.canExportImport()) { showToast('❌ No permission to import'); return; }
        const fileInput = document.getElementById('importVouchersFile');
        if (!fileInput.files || !fileInput.files[0]) { showToast('❌ Please select a file'); return; }
        const firmSelect = document.getElementById('import_firm_select');
        if (!firmSelect) { showToast('❌ Please select a firm first'); return; }
        const firmKey = firmSelect.value;
        if (!firmKey) { showToast('❌ Please select a firm for import'); return; }
        const firm = this.allFirms[firmKey];
        if (!firm) { showToast('❌ Invalid firm selected'); return; }

        try {
            const data = await this._readFile(fileInput.files[0]);
            let count = 0, skipped = 0;
            for (const row of data) {
                const date = row.Date || row.date || getToday();
                const head = row.Head || row.head || '';
                const subHead = row.SubHead || row.subHead || '';
                const party = row.Party || row.party || '';
                const amount = parseFloat(row.Amount || row.amount || 0);
                const mode = row.Mode || row.mode || 'Cash';
                const referenceNo = row.ReferenceNo || row.referenceNo || '';
                const narration = row.Narration || row.narration || '';
                const createdBy = row.CreatedBy || row.createdBy || this.currentUser;

                if (!head || !party || amount <= 0) { skipped++; continue; }

                const vno = `${firm.short}/EXP/${getFinancialYear()}/${String(this.db.filter(v => v.firmKey === firmKey && v.type === 'EXP').length + 1).padStart(3, '0')}`;

                const voucher = {
                    id: generateId(), vno, date, firmKey, firmName: firm.name,
                    head, subHead, party, amount, mode, referenceNo, narration,
                    type: 'EXP', status: 'active', createdBy,
                    createdAt: new Date().toISOString(), timestamp: Date.now()
                };

                this.db.push(voucher);
                await this.storage.saveVoucher(voucher);

                if (!this.voucherCounter[firmKey]) this.voucherCounter[firmKey] = 0;
                this.voucherCounter[firmKey]++;
                count++;
            }

            await this.storage.save(STORAGE_KEYS.VOUCHER_COUNTER, this.voucherCounter);
            this.renderAll();
            this.updateStats();
            this.updateHeadFilter();
            showToast(`✅ ${count} vouchers imported! ${skipped > 0 ? '⚠️ ' + skipped + ' skipped' : ''}`);
        } catch (error) {
            console.error('❌ Import error:', error);
            showToast('❌ Import failed: ' + error.message);
        }
    }

    downloadPartyTemplate() {
        const headers = ['PartyName', 'Phone', 'Address', 'Firm'];
        const csv = headers.join(',') + '\n' + 'Example Party,9876543210,Jaipur,DevVidyalaya';
        this._downloadFile(csv, 'Party_Import_Template.csv');
        showToast('📎 Template downloaded!');
    }

    downloadExpenseHeadTemplate() {
        const headers = ['Head', 'SubHead', 'Firm'];
        const csv = headers.join(',') + '\n' + 'Tea & Canteen,Rashan Exp,DevVidyalaya';
        this._downloadFile(csv, 'ExpenseHead_Import_Template.csv');
        showToast('📎 Template downloaded!');
    }

    downloadVoucherTemplate() {
        const headers = ['Date', 'Head', 'SubHead', 'Party', 'Amount', 'Mode', 'ReferenceNo', 'Narration', 'CreatedBy'];
        const csv = headers.join(',') + '\n' + '2026-08-27,Tea & Canteen,Rashan Exp,SHREE RAM RASHAN WALA,5000,Cash,BILL123,Payment for canteen,Admin';
        this._downloadFile(csv, 'Voucher_Import_Template.csv');
        showToast('📎 Template downloaded!');
    }

    _downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    exportExpenseHeads() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        const data = Object.keys(this.expenseHeads).map(head => ({
            Head: head,
            SubHead: (this.expenseHeads[head]?.subHeads || []).join(', '),
            Firm: this.allFirms[this.expenseHeads[head]?.firm]?.name || this.expenseHeads[head]?.firm || 'All Firms'
        }));
        this.exportToExcel(data, 'Expense_Heads_Export');
    }

    exportParties() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        const data = this.parties.map(p => ({
            PartyName: p.name,
            Phone: p.phone || '',
            Address: p.address || '',
            Firm: this.allFirms[p.firm]?.name || p.firm || ''
        }));
        this.exportToExcel(data, 'Parties_Export');
    }

    exportToExcel(data, filename) {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        if (typeof XLSX === 'undefined') { showToast('Excel library loading...'); return; }
        const ws = XLSX.utils.json_to_sheet(data.map(v => ({
            'Date': v.date || v.Date || '',
            'Voucher No': v.vno || v['Voucher No'] || '',
            'Type': v.type || '',
            'Firm': v.firmName || v.Firm || v.firmKey || '',
            'Head': v.head || v.Head || v.studentName || '',
            'Sub Head': v.subHead || v['Sub Head'] || v.studentClass || '',
            'Party': v.party || v.Party || '',
            'Amount': v.amount || v.Amount || 0,
            'Mode': v.mode || v.Mode || '',
            'Status': v.status || v.Status || 'active'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
        XLSX.writeFile(wb, filename + '.xlsx');
        showToast('📎 Exported: ' + filename);
    }

    exportAllVouchers() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        const allVouchers = [...this.db.filter(v => v.status !== 'deleted'), ...this.deletedVouchers];
        const unique = [];
        const seen = new Set();
        allVouchers.forEach(v => { if (!seen.has(v.id)) { seen.add(v.id); unique.push(v); } });
        this.exportToExcel(unique, 'All_Vouchers_Report');
    }

    exportActiveVouchers() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        this.exportToExcel(this.db.filter(v => v.status !== 'deleted'), 'Active_Vouchers');
    }

    exportDeletedVouchers() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        this.exportToExcel(this.deletedVouchers, 'Deleted_Vouchers');
    }

    exportEditedVouchers() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        const editedIds = new Set(this.editLogs.map(e => e.voucherId));
        const editedVouchers = this.db.filter(v => editedIds.has(v.id));
        this.exportToExcel(editedVouchers, 'Edited_Vouchers');
    }

    exportFilteredVouchers() {
        if (!this.canExportImport()) { showToast('❌ No permission to export'); return; }
        const search = document.getElementById('r_search')?.value?.toLowerCase() || '';
        const start = document.getElementById('r_start')?.value || '';
        const end = document.getElementById('r_end')?.value || '';
        const status = document.getElementById('r_status')?.value || 'ALL';
        const headFilter = document.getElementById('r_head_filter')?.value || '';
        const partyFilter = document.getElementById('r_party_filter')?.value?.toLowerCase() || '';
        const modeFilter = document.getElementById('r_mode_filter')?.value || '';
        const firmFilter = document.getElementById('r_firm_filter')?.value || '';
        const amountMin = parseFloat(document.getElementById('r_amount_min')?.value) || 0;
        const amountMax = parseFloat(document.getElementById('r_amount_max')?.value) || Infinity;

        let allVouchers = [];
        if (status === 'ALL' || status === 'active') allVouchers = allVouchers.concat(this.db.filter(v => v.status !== 'deleted'));
        if (status === 'ALL' || status === 'deleted') allVouchers = allVouchers.concat(this.deletedVouchers);

        const seen = new Set();
        allVouchers = allVouchers.filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });

        const filtered = allVouchers.filter(v => {
            let match = true;
            if (search) match = match && (v.party?.toLowerCase().includes(search) || v.head?.toLowerCase().includes(search) || v.narration?.toLowerCase().includes(search) || v.vno?.toLowerCase().includes(search) || v.subHead?.toLowerCase().includes(search) || v.studentName?.toLowerCase().includes(search) || v.createdBy?.toLowerCase().includes(search));
            if (start) match = match && v.date >= start;
            if (end) match = match && v.date <= end;
            if (amountMin > 0) match = match && v.amount >= amountMin;
            if (amountMax < Infinity) match = match && v.amount <= amountMax;
            if (headFilter) match = match && v.head === headFilter;
            if (partyFilter) match = match && v.party?.toLowerCase().includes(partyFilter);
            if (modeFilter) match = match && v.mode === modeFilter;
            if (firmFilter) match = match && v.firmKey === firmFilter;
            return match;
        });
        this.exportToExcel(filtered, 'Filtered_Vouchers_Export');
    }

    shareVoucher(id) {
        if (!this.userPermissions.whatsapp && this.currentRole !== 'Admin') { showToast('❌ No permission to share'); return; }
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

    // ===== SAVE ALL SETTINGS =====
    async saveAllSettings() {
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => { firmObj[k] = this.allFirms[k]; });
        await this.storage.save(STORAGE_KEYS.FIRMS, firmObj);
        await this.storage.save(STORAGE_KEYS.EXPENSE_HEADS, this.expenseHeads);
        await this.storage.save(STORAGE_KEYS.BANK_ACCOUNTS, this.bankAccounts);
        // ✅ NEW
        await this.storage.save(STORAGE_KEYS.ACCOUNTS, this.accounts || []);
        await this.storage.save(STORAGE_KEYS.OPENING_BALANCES, this.openingBalances || {});

        const perms = {
            print: document.getElementById('perm_print').checked,
            edit: document.getElementById('perm_edit').checked,
            delete: document.getElementById('perm_delete').checked,
            whatsapp: document.getElementById('perm_whatsapp').checked,
            reports: document.getElementById('perm_reports').checked,
            view_all: document.getElementById('perm_view_all').checked,
            party_add: document.getElementById('perm_party_add').checked,
            bank_add: document.getElementById('perm_bank_add').checked,
            expense_add: document.getElementById('perm_expense_add').checked,
            export_import: document.getElementById('perm_export_import').checked,
            edit_firm: document.getElementById('perm_edit_firm').checked
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
        this.renderAll();
    }

    // ===== MODULE SWITCH =====
    switchModule(module) {
        document.querySelectorAll('.module-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
        const pane = document.getElementById('module-' + module);
        if (pane) pane.classList.add('active');
        document.querySelectorAll('.module-tab').forEach(t => {
            const text = t.textContent.toLowerCase();
            if (
                (module === 'transactions' && text.includes('create')) ||
                (module === 'reports' && text.includes('list')) ||
                (module === 'contra' && text.includes('contra')) ||
                (module === 'receipt' && text.includes('receipt')) ||
                (module === 'cashbook' && text.includes('cash book'))
            ) {
                t.classList.add('active');
            }
        });

        // ✅ NEW: module-specific render
        if (module === 'reports') this.renderReports();
        if (module === 'contra') { this.populateContraAccounts(); this.generateContraVoucherNo(); this.renderContraList(); }
        if (module === 'receipt') { this.generateReceiptVoucherNo(); this.renderReceiptList(); }
        if (module === 'cashbook') {
            const cbFirm = document.getElementById('cb_firm');
            if (cbFirm && !cbFirm.value) {
                cbFirm.innerHTML = '<option value="">-- Select Firm --</option>';
                Object.keys(this.allFirms).forEach(f => {
                    cbFirm.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
                });
                if (this.currentFirm) cbFirm.value = this.currentFirm;
            }
            const cbDate = document.getElementById('cb_date');
            if (cbDate && !cbDate.value) cbDate.value = getToday();
            this.renderCashBook();
        }
    }

    updateUI() {
        let firmName = 'All Firms (Admin)';
        if (this.currentRole === 'Admin') firmName = 'All Firms (Admin)';
        else if (this.currentFirm && this.allFirms[this.currentFirm]) {
            firmName = this.allFirms[this.currentFirm].name;
        }
        const el = document.getElementById('header_firm_name');
        if (el) el.innerText = firmName;
    }

    // ===== REALTIME =====
    setupRealtimeListener() {
        this.storage.onVoucherChange((db) => {
            this.db = db;
            this.renderAll();
            this.updateStats();
            this.generateVoucherNo();
            this.updateHeadFilter();
            // ✅ NEW
            this.renderContraList();
            this.renderReceiptList();
        });
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.addEventListener('click', () => this.doLogin());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const loginScreen = document.getElementById('login-screen');
                if (loginScreen && loginScreen.style.display !== 'none') {
                    this.doLogin();
                }
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            }
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function (e) {
                if (e.target === this) this.style.display = 'none';
            });
        });

        const modeValue = document.getElementById('v_mode_value');
        if (modeValue) modeValue.addEventListener('change', () => this.toggleBankField());
    }

    // ===== UTILITY - READ FILE =====
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
                                headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                                data.push(row);
                            }
                        }
                        resolve(data);
                    }
                } catch (error) { reject(error); }
            };
            reader.onerror = reject;
            if (file.name.endsWith('.xlsx')) reader.readAsArrayBuffer(file);
            else reader.readAsText(file);
        });
    }
}

export default App;
