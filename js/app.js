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
        this.loaded = true;
        console.log('✅ Data loaded. Firms:', Object.keys(this.allFirms).length);
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

    // ===== SHOW MAIN APP - FIXED =====
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
        
        let tabs = `<button class="module-tab active" onclick="switchModule('transactions')">📝 Create Voucher</button>`;
        if (this.userPermissions.reports || isAdmin) {
            tabs += `<button class="module-tab" onclick="switchModule('reports')">📋 Voucher List</button>`;
        }
        document.getElementById('moduleTabsContainer').innerHTML = tabs;
        
        this.renderAll();
        this.updateFirmHeader();
        this.generateVoucherNo();
        this.updateFirmDropdownsInSettings();
        this.renderPartiesList();
    }

    // ===== LOGIN =====
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

        try {
            errorDiv.innerText = '⏳ Logging in...';
            errorDiv.style.color = '#22c55e';
            errorDiv.style.display = 'block';

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: userId, password: pass })
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
            sessionStorage.setItem('user', data.user.username);
            sessionStorage.setItem('role', data.user.role || 'user');
            sessionStorage.setItem('firm', data.user.firmId);

            this.currentUser = data.user.username;
            this.currentRole = data.user.role || 'user';
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
        if (!select) {
            console.warn('⚠️ login_role element not found');
            return;
        }
        
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
            if (optionExists) {
                select.value = currentVal;
            }
        }
    }

    updateSettingsRoleDropdown() {
        const select = document.getElementById('new_user_role');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        select.innerHTML += '<option value="Admin">Admin</option>';
        
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

    updateFirmSelectInSettings() {
        const select = document.getElementById('new_user_firm');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Firm --</option>';
        
        const firms = Object.keys(this.allFirms);
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
    }

    updateFirmDropdownsInSettings() {
        const firmSelects = ['new_user_firm', 'bank_firm_select', 'expense_head_firm', 'party_firm_filter', 'new_party_firm', 'r_firm_filter', 'import_firm_select'];
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

    // ===== BANK DROPDOWN =====
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

    // ===== TOGGLE BANK FIELD =====
    toggleBankField() {
        const mode = document.getElementById('v_mode_value').value || 'Cash';
        const bankField = document.getElementById('bank_account_field');
        const upiField = document.getElementById('upi_options_field');
        
        bankField.style.display = (mode === 'Bank' || mode === 'Cheque') ? 'block' : 'none';
        upiField.style.display = mode === 'UPI' ? 'block' : 'none';
        
        if (mode === 'Bank' || mode === 'Cheque') {
            this.updateBankDropdown();
        }
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

    // ===== SAVE VOUCHER =====
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
        
        let bankAccount = '';
        let bankName = '';
        let bankIfsc = '';
        let upiApp = '';
        
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
            upiApp: upiApp,
            referenceNo: referenceNo,
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
        showToast(editId ? '✅ Voucher updated!' : '✅ Voucher submitted!');
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

    // ===== RESET FORM =====
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

    // ===== EDIT VOUCHER =====
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

    // ===== RECOVER VOUCHER =====
    async recoverVoucher(id) {
        if (!this.userPermissions.delete && this.currentRole !== 'Admin') {
            showToast('❌ No permission to recover');
            return;
        }
        
        if (!confirm('Are you sure you want to recover this voucher?')) return;
        
        const index = this.deletedVouchers.findIndex(v => v.id === id);
        if (index === -1) {
            showToast('❌ Deleted voucher not found');
            return;
        }
        
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

    // ===== RENDER TABLE =====
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
                actions = `
                    <button class="btn-action" onclick="app.recoverVoucher('${v.id}')" title="Recover" style="background:#8b5cf6; color:white; padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:11px;">↩️ Recover</button>
                `;
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
                <td>${v.mode}${v.upiApp ? ' ('+v.upiApp+')' : ''}</td>
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

    // ===== REPORTS / VOUCHER LIST =====
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
                                actions = `
                                    <button class="btn-action" onclick="app.recoverVoucher('${v.id}')" title="Recover" style="background:#8b5cf6; color:white; padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:11px;">↩️ Recover</button>
                                `;
                            }
                            
                            return `<tr>
                                <td>${v.date}</td>
                                <td><b>${v.vno}</b></td>
                                <td>${v.firmName || v.firmKey || '-'}</td>
                                <td>${v.head}</td>
                                <td>${v.subHead || '-'}</td>
                                <td>${v.party || '-'}</td>
                                <td>₹${v.amount.toLocaleString()}</td>
                                <td>${v.mode}${v.upiApp ? ' ('+v.upiApp+')' : ''}</td>
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
        const headSelects = ['f_head_filter', 'r_head_filter'];
        const heads = [...new Set(this.db.map(v => v.head).filter(Boolean))];
        
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

    // ============================================================
    // MODE DROPDOWN FUNCTIONS
    // ============================================================

    getModeOptions() {
        return this.paymentModes;
    }

    populateModes() {
        const dropdown = document.getElementById('modeDropdown');
        if (!dropdown) return;
        const modes = this.getModeOptions();
        dropdown.innerHTML = modes.map(m => 
            `<div onclick="selectMode('${m}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${m}</div>`
        ).join('');
        dropdown.style.display = 'block';
        const firstItem = dropdown.querySelector('div');
        if (firstItem) firstItem.classList.add('selected');
    }

    filterModes(search) {
        const dropdown = document.getElementById('modeDropdown');
        if (!dropdown) return;
        if (!search || search.length < 1) {
            this.populateModes();
            return;
        }
        const modes = this.getModeOptions();
        const filtered = modes.filter(m => m.toLowerCase().includes(search.toLowerCase()));
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
    // EXPENSE HEADS - FIRM WISE (UPDATED)
    // ============================================================

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
        const firstItem = dropdown.querySelector('div');
        if (firstItem) firstItem.classList.add('selected');
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
        const firstItem = dropdown.querySelector('div');
        if (firstItem) firstItem.classList.add('selected');
    }

    filterExpenseHeads(search) {
        const dropdown = document.getElementById('expenseHeadDropdown');
        if (!dropdown) return;
        if (!search || search.length < 1) {
            this.populateExpenseHeads();
            return;
        }
        
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

    // ============================================================
    // EXPENSE HEADS - SETTINGS (UPDATED)
    // ============================================================

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
        if (!this.canAddExpense()) {
            showToast('❌ No permission to add expense head');
            return;
        }
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

    // ============================================================
    // POPULATE FUNCTIONS - SEARCH + DROPDOWN
    // ============================================================

    populateFirmDropdown() {
        const dropdown = document.getElementById('firmDropdown');
        if (!dropdown) return;
        let firms = [];
        
        if (this.currentRole === 'Admin') {
            firms = Object.keys(this.allFirms);
        } else if (this.currentFirm) {
            firms = [this.currentFirm];
        }
        
        if (firms.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No firms available</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = firms.map(f => 
            `<div onclick="selectFirm('${f}')" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;">${this.allFirms[f]?.name || f}</div>`
        ).join('');
        dropdown.style.display = 'block';
        const firstItem = dropdown.querySelector('div');
        if (firstItem) firstItem.classList.add('selected');
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
        const firstItem = dropdown.querySelector('div');
        if (firstItem) firstItem.classList.add('selected');
    }

    // ============================================================
    // FILTER FUNCTIONS
    // ============================================================

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
        const parties = this.getPartiesForCurrentFirm();
        const filtered = parties.filter(p => 
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

    // ============================================================
    // FIRM-WISE HELPERS
    // ============================================================

    getPartiesForCurrentFirm() {
        const firmKey = document.getElementById('firm_name_value')?.value || this.currentFirm;
        if (!firmKey) return this.parties;
        return this.parties.filter(p => p.firm === firmKey || !p.firm);
    }

    // ============================================================
    // PARTY FUNCTIONS
    // ============================================================

    openAddPartyModal() {
        if (!this.canAddParty()) {
            showToast('❌ No permission to add party');
            return;
        }
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
        if (!this.canAddParty()) {
            showToast('❌ No permission to add party');
            return;
        }
        const id = document.getElementById('edit_party_id').value;
        const name = document.getElementById('new_party_name').value.trim();
        const firm = document.getElementById('new_party_firm').value || this.currentFirm;
        if (!name) { showToast('Party name required'); return; }
        
        const party = { 
            id: id || generateId(), 
            name: name, 
            phone: document.getElementById('new_party_phone').value.trim(),
            address: document.getElementById('new_party_address').value.trim(),
            firm: firm
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
        if (used) {
            showToast('❌ Cannot delete: Party is used in vouchers');
            return;
        }
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
        if (firmFilter) {
            parties = parties.filter(p => p.firm === firmFilter);
        }
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
    }

    // ============================================================
    // SETTINGS
    // ============================================================

    openSettings() {
        const isAdmin = this.currentRole && 
            (this.currentRole.toLowerCase() === 'admin' || 
             this.currentRole === 'Admin' || 
             this.currentRole === 'ADMIN');
        
        if (!isAdmin) {
            showToast('❌ Only Admin can access settings');
            return;
        }
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
    }

    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    // ============================================================
    // FIRM MANAGEMENT - UPDATED (All firms editable & deletable)
    // ============================================================

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
        Object.keys(this.allFirms).forEach(k => {
            firmObj[k] = this.allFirms[k];
        });
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
        Object.keys(this.allFirms).forEach(k => {
            firmObj[k] = this.allFirms[k];
        });
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
        
        const hasVouchers = this.db.some(v => v.firmKey === key) || 
                           this.deletedVouchers.some(v => v.firmKey === key);
        if (hasVouchers) {
            showToast('Cannot delete: vouchers exist');
            return;
        }
        delete this.allFirms[key];
        
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => {
            firmObj[k] = this.allFirms[k];
        });
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

    // ============================================================
    // USER MANAGEMENT - FIXED (API se user create)
    // ============================================================

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
            return `
            <div class="user-card" style="padding:10px 15px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; background:#f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                        <span><strong>👤 ${u.id}</strong></span>
                        <span>🔒 ${u.password}</span>
                        <span><span class="badge" style="background:${u.role === 'Admin' ? '#2563eb' : '#10b981'}">${u.role}</span></span>
                        <span><span class="firm-badge" style="background:#8b5cf6;">${firmNames}</span></span>
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

    // ✅ FIXED: API se user create karein (passwordHash automatically add hoga)
    async addUser() {
        const id = document.getElementById('new_user_id').value.trim();
        const pass = document.getElementById('new_user_pass').value.trim();
        const role = document.getElementById('new_user_role').value;
        const firm = document.getElementById('new_user_firm').value;
        
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
        
        try {
            showToast('⏳ Creating user...');
            
            // ✅ ✅ ✅ API SE USER CREATE (passwordHash automatically add hoga)
            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: id,
                    password: pass,
                    name: id,
                    firmId: firm || 'DevVidyalaya',
                    role: role
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to create user');
            }
            
            // ✅ User ko local array mein add karein (UI update ke liye)
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
                id, 
                password: pass, 
                role, 
                firm: role === 'Admin' ? null : firm, 
                permissions 
            };
            
            this.allUsers.push(user);
            
            // ✅ Database mein bhi save karein (backup)
            await this.storage.save(STORAGE_KEYS.USERS,
                Object.fromEntries(this.allUsers.map(u => [u.id, u]))
            );
            
            this.renderUsersList();
            this.updateLoginRoleDropdown();
            this.updateSettingsRoleDropdown();
            
            document.getElementById('new_user_id').value = '';
            document.getElementById('new_user_pass').value = '';
            document.getElementById('new_user_firm').value = '';
            
            showToast(`✅ ${role} User "${id}" created successfully!`);
            
        } catch (error) {
            console.error('❌ Create user error:', error);
            showToast('❌ ' + error.message);
        }
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

    // ============================================================
    // BANK MANAGEMENT
    // ============================================================

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

    // ============================================================
    // PERMISSION CHECKS
    // ============================================================

    canAddParty() {
        return this.userPermissions.party_add || this.currentRole === 'Admin';
    }

    canAddBank() {
        return this.userPermissions.bank_add || this.currentRole === 'Admin';
    }

    canAddExpense() {
        return this.userPermissions.expense_add || this.currentRole === 'Admin';
    }

    canExportImport() {
        return this.userPermissions.export_import || this.currentRole === 'Admin';
    }

    canEditFirm() {
        return this.userPermissions.edit_firm || this.currentRole === 'Admin';
    }

    // ============================================================
    // IMPORT/EXPORT FUNCTIONS
    // ============================================================

    async importExpenseHeads() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to import');
            return;
        }
        const fileInput = document.getElementById('importHeadsFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showToast('❌ Please select a file');
            return;
        }
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
        if (!this.canExportImport()) {
            showToast('❌ No permission to import');
            return;
        }
        const fileInput = document.getElementById('importPartiesFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showToast('❌ Please select a file');
            return;
        }
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

    // ============================================================
    // BULK VOUCHER IMPORT
    // ============================================================

    async importVouchers() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to import');
            return;
        }
        const fileInput = document.getElementById('importVouchersFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showToast('❌ Please select a file');
            return;
        }
        
        const firmSelect = document.getElementById('import_firm_select');
        if (!firmSelect) {
            showToast('❌ Please select a firm first');
            return;
        }
        const firmKey = firmSelect.value;
        if (!firmKey) {
            showToast('❌ Please select a firm for import');
            return;
        }
        const firm = this.allFirms[firmKey];
        if (!firm) {
            showToast('❌ Invalid firm selected');
            return;
        }
        
        try {
            const data = await this._readFile(fileInput.files[0]);
            let count = 0;
            let skipped = 0;
            
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
                
                if (!head || !party || amount <= 0) {
                    skipped++;
                    continue;
                }
                
                const vno = `${firm.short}/EXP/${getFinancialYear()}/${String(this.db.filter(v => v.firmKey === firmKey).length + 1).padStart(3, '0')}`;
                
                const voucher = {
                    id: generateId(),
                    vno: vno,
                    date: date,
                    firmKey: firmKey,
                    firmName: firm.name,
                    head: head,
                    subHead: subHead,
                    party: party,
                    amount: amount,
                    mode: mode,
                    referenceNo: referenceNo,
                    narration: narration,
                    type: 'EXP',
                    status: 'active',
                    createdBy: createdBy,
                    createdAt: new Date().toISOString(),
                    timestamp: Date.now()
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

    // ============================================================
    // DOWNLOAD TEMPLATES
    // ============================================================

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
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        const data = Object.keys(this.expenseHeads).map(head => ({
            Head: head,
            SubHead: (this.expenseHeads[head]?.subHeads || []).join(', '),
            Firm: this.allFirms[this.expenseHeads[head]?.firm]?.name || this.expenseHeads[head]?.firm || 'All Firms'
        }));
        this.exportToExcel(data, 'Expense_Heads_Export');
    }

    exportParties() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        const data = this.parties.map(p => ({
            PartyName: p.name,
            Phone: p.phone || '',
            Address: p.address || '',
            Firm: this.allFirms[p.firm]?.name || p.firm || ''
        }));
        this.exportToExcel(data, 'Parties_Export');
    }

    // ============================================================
    // VOUCHER EXPORT FUNCTIONS
    // ============================================================

    exportToExcel(data, filename) {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        if (typeof XLSX === 'undefined') { showToast('Excel library loading...'); return; }
        const ws = XLSX.utils.json_to_sheet(data.map(v => ({
            'Date': v.date || v.Date || '',
            'Voucher No': v.vno || v['Voucher No'] || '',
            'Firm': v.firmName || v.Firm || v.firmKey || '',
            'Head': v.head || v.Head || '',
            'Sub Head': v.subHead || v['Sub Head'] || '',
            'Party': v.party || v.Party || '',
            'Amount': v.amount || v.Amount || 0,
            'Mode': v.mode || v.Mode || '',
            'UPI App': v.upiApp || v['UPI App'] || '',
            'Bank Name': v.bankName || v['Bank Name'] || '',
            'Bank Account': v.bankAccount || v['Bank Account'] || '',
            'IFSC': v.bankIfsc || v.IFSC || '',
            'Reference No': v.referenceNo || v['Reference No'] || '',
            'Narration': v.narration || v.Narration || '',
            'Created By': v.createdBy || v['Created By'] || '',
            'Status': v.status || v.Status || 'active'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
        XLSX.writeFile(wb, filename + '.xlsx');
        showToast('📎 Exported: ' + filename);
    }

    exportAllVouchers() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        const allVouchers = [...this.db.filter(v => v.status !== 'deleted'), ...this.deletedVouchers];
        const unique = [];
        const seen = new Set();
        allVouchers.forEach(v => {
            if (!seen.has(v.id)) { seen.add(v.id); unique.push(v); }
        });
        this.exportToExcel(unique, 'All_Vouchers_Report');
    }

    exportActiveVouchers() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        this.exportToExcel(this.db.filter(v => v.status !== 'deleted'), 'Active_Vouchers');
    }

    exportDeletedVouchers() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        this.exportToExcel(this.deletedVouchers, 'Deleted_Vouchers');
    }

    exportEditedVouchers() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
        const editedIds = new Set(this.editLogs.map(e => e.voucherId));
        const editedVouchers = this.db.filter(v => editedIds.has(v.id));
        this.exportToExcel(editedVouchers, 'Edited_Vouchers');
    }

    exportFilteredVouchers() {
        if (!this.canExportImport()) {
            showToast('❌ No permission to export');
            return;
        }
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
            if (headFilter) match = match && v.head === headFilter;
            if (partyFilter) match = match && v.party?.toLowerCase().includes(partyFilter);
            if (modeFilter) match = match && v.mode === modeFilter;
            if (firmFilter) match = match && v.firmKey === firmFilter;
            return match;
        });
        this.exportToExcel(filtered, 'Filtered_Vouchers_Export');
    }

    // ============================================================
    // SHARE VOUCHER
    // ============================================================

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

    // ============================================================
    // SAVE ALL SETTINGS
    // ============================================================

    async saveAllSettings() {
        const firmObj = {};
        Object.keys(this.allFirms).forEach(k => {
            firmObj[k] = this.allFirms[k];
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

    // ============================================================
    // MODULE SWITCH
    // ============================================================

    switchModule(module) {
        document.querySelectorAll('.module-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
        const pane = document.getElementById('module-' + module);
        if (pane) pane.classList.add('active');
        document.querySelectorAll('.module-tab').forEach(t => {
            if (t.textContent.toLowerCase().includes(module === 'transactions' ? 'create' : 'list')) {
                t.classList.add('active');
            }
        });
        if (module === 'reports') this.renderReports();
    }

    // ============================================================
    // UI UPDATE
    // ============================================================

    updateUI() {
        let firmName = 'All Firms (Admin)';
        if (this.currentRole === 'Admin') firmName = 'All Firms (Admin)';
        else if (this.currentFirm && this.allFirms[this.currentFirm]) {
            firmName = this.allFirms[this.currentFirm].name;
        }
        document.getElementById('header_firm_name').innerText = firmName;
    }

    // ============================================================
    // REAL-TIME LISTENER
    // ============================================================

    setupRealtimeListener() {
        this.storage.onVoucherChange((db) => {
            this.db = db;
            this.renderAll();
            this.updateStats();
            this.generateVoucherNo();
            this.updateHeadFilter();
        });
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

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

        document.getElementById('v_mode_value')?.addEventListener('change', () => this.toggleBankField());
    }

    // ============================================================
    // UTILITY - READ FILE
    // ============================================================

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
}

export default App;
