// ============================================================
// COMPLETE APP.JS - Updated with Latest Features
// ============================================================

// ===== STORAGE KEYS =====
const STORAGE_KEYS = {
    VOUCHERS: 'expense_vouchers',
    FIRMS: 'firms_data',
    USERS: 'users_data',
    EXPENSE_HEADS: 'expense_heads',
    PARTIES: 'parties_data',
    SIGNATORIES: 'signatories_data',
    BANK_ACCOUNTS: 'bank_accounts',
    PERMISSIONS: 'user_permissions',
    DARK_MODE: 'dark_mode_preference',
    VIEW_PREFERENCES: 'view_preferences'
};

// ===== UTILITY FUNCTIONS =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== STORAGE CLASS =====
class StorageManager {
    constructor() {
        this.listeners = [];
        this.voucherListeners = [];
    }

    async save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            this.notify(key, data);
            return true;
        } catch (e) {
            console.error('Save error:', e);
            return false;
        }
    }

    async get(key, defaultVal = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultVal;
        } catch (e) {
            console.error('Get error:', e);
            return defaultVal;
        }
    }

    async remove(key) {
        localStorage.removeItem(key);
    }

    async saveVoucher(voucher) {
        const vouchers = await this.get(STORAGE_KEYS.VOUCHERS, {});
        vouchers[voucher.id] = voucher;
        await this.save(STORAGE_KEYS.VOUCHERS, vouchers);
        this.notifyVoucherChange(vouchers);
        return voucher;
    }

    async deleteVoucher(id) {
        const vouchers = await this.get(STORAGE_KEYS.VOUCHERS, {});
        delete vouchers[id];
        await this.save(STORAGE_KEYS.VOUCHERS, vouchers);
        this.notifyVoucherChange(vouchers);
        return true;
    }

    async getAllVouchers() {
        const data = await this.get(STORAGE_KEYS.VOUCHERS, {});
        return Object.values(data);
    }

    onVoucherChange(callback) {
        this.voucherListeners.push(callback);
    }

    notifyVoucherChange(vouchers) {
        const data = Object.values(vouchers || {});
        this.voucherListeners.forEach(cb => cb(data));
    }

    notify(key, data) {
        this.listeners.forEach(cb => cb(key, data));
    }
}

// ===== MAIN APP CLASS =====
class App {
    constructor() {
        this.storage = new StorageManager();
        this.db = [];
        this.deletedVouchers = [];
        this.allFirms = {};
        this.allUsers = [];
        this.expenseHeads = {};
        this.parties = [];
        this.signatories = [];
        this.bankAccounts = {};
        this.editLogs = [];
        this.currentUser = null;
        this.currentRole = 'Staff';
        this.currentFirm = null;
        this.userPermissions = {};
        this.currentVoucherId = null;
        this.selectedVouchers = new Set();
        this.currentSort = { field: 'date', direction: 'desc' };
        this.searchQuery = '';
        this.searchFilters = {};
        this.isDarkMode = false;
        this.viewMode = 'table';

        this.init();
    }

    async init() {
        // Load dark mode preference
        this.isDarkMode = await this.storage.get(STORAGE_KEYS.DARK_MODE, false);
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        }

        // Load view preferences
        const prefs = await this.storage.get(STORAGE_KEYS.VIEW_PREFERENCES, {});
        this.viewMode = prefs.viewMode || 'table';
        this.applyViewMode();

        await this.loadData();
        this.setupEventListeners();
        this.setupRealtimeListener();
        this.renderAll();

        // Check for saved session
        const savedUser = await this.storage.get('session_user', null);
        if (savedUser) {
            this.currentUser = savedUser.id;
            this.currentRole = savedUser.role;
            this.currentFirm = savedUser.firm;
            this.userPermissions = savedUser.permissions || {};
            this.showApp();
            this.updateUI();
            this.generateVoucherNo();
            this.updateHeadFilter();
        }
    }

    async loadData() {
        // Load firms
        const firms = await this.storage.get(STORAGE_KEYS.FIRMS, {});
        this.allFirms = {
            DevVidyalaya: { name: 'Dev Vidyalaya', short: 'DVS', logo: 'logo.jpeg', addr: '', mobile: '', email: '', gst: '', pan: '' },
            DevGas: { name: 'Dev Gas', short: 'DVG', logo: 'logo.jpeg', addr: '', mobile: '', email: '', gst: '', pan: '' },
            Rama: { name: 'Rama', short: 'RMA', logo: 'logo.jpeg', addr: '', mobile: '', email: '', gst: '', pan: '' },
            ...firms
        };

        // Load users
        const users = await this.storage.get(STORAGE_KEYS.USERS, {});
        this.allUsers = Object.values(users);
        if (this.allUsers.length === 0) {
            this.allUsers = [
                { id: 'Admin', password: 'admin123', role: 'Admin', firm: null, permissions: {} }
            ];
            await this.storage.save(STORAGE_KEYS.USERS, 
                Object.fromEntries(this.allUsers.map(u => [u.id, u]))
            );
        }

        // Load expense heads
        this.expenseHeads = await this.storage.get(STORAGE_KEYS.EXPENSE_HEADS, {
            'Administrative': ['Office Rent', 'Electricity', 'Water', 'Internet', 'Phone'],
            'Salary': ['Staff Salary', 'Consultant Fee', 'Contractor Payment'],
            'Travel': ['Conveyance', 'Fuel', 'Lodging', 'Food'],
            'Marketing': ['Advertising', 'Promotion', 'Events'],
            'Supplies': ['Stationery', 'Printing', 'Office Supplies'],
            'Maintenance': ['Repair', 'AMC', 'Housekeeping'],
            'Others': ['Miscellaneous']
        });

        // Load parties
        const partiesData = await this.storage.get(STORAGE_KEYS.PARTIES, {});
        this.parties = Object.values(partiesData);

        // Load signatories
        const signatoriesData = await this.storage.get(STORAGE_KEYS.SIGNATORIES, {});
        this.signatories = Object.values(signatoriesData);

        // Load bank accounts
        this.bankAccounts = await this.storage.get(STORAGE_KEYS.BANK_ACCOUNTS, {});

        // Load permissions
        this.userPermissions = await this.storage.get(STORAGE_KEYS.PERMISSIONS, {
            print: false, edit: false, delete: false, whatsapp: false,
            reports: false, view_all: false, party_add: false,
            signatory_add: false, bank_add: false, expense_add: false
        });

        // Load vouchers
        const vouchers = await this.storage.get(STORAGE_KEYS.VOUCHERS, {});
        this.db = Object.values(vouchers).filter(v => v.status !== 'deleted');
        this.deletedVouchers = Object.values(vouchers).filter(v => v.status === 'deleted');

        // Load edit logs
        this.editLogs = await this.storage.get('edit_logs', []);
    }

    // ===== DARK MODE =====
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode');
        this.storage.save(STORAGE_KEYS.DARK_MODE, this.isDarkMode);
        document.querySelector('.dark-mode-toggle')?.classList.toggle('active');
    }

    // ===== VIEW MODE =====
    applyViewMode() {
        const container = document.getElementById('voucher-list');
        if (!container) return;
        if (this.viewMode === 'cards') {
            container.classList.add('card-view');
            container.classList.remove('table-view');
        } else {
            container.classList.add('table-view');
            container.classList.remove('card-view');
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.applyViewMode();
        this.storage.save(STORAGE_KEYS.VIEW_PREFERENCES, { viewMode: mode });
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    // ===== LOGIN =====
    doLogin() {
        const id = document.getElementById('loginId').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        
        if (!id || !pass) {
            showToast('⚠️ Please enter ID and Password');
            return;
        }

        const user = this.allUsers.find(u => u.id === id && u.password === pass);
        if (!user) {
            showToast('❌ Invalid credentials!');
            return;
        }

        this.currentUser = user.id;
        this.currentRole = user.role;
        this.currentFirm = user.firm;
        this.userPermissions = user.permissions || {};

        // Save session
        this.storage.save('session_user', {
            id: user.id,
            role: user.role,
            firm: user.firm,
            permissions: user.permissions
        });

        showToast(`✅ Welcome ${user.id}!`);
        this.showApp();
        this.updateUI();
        this.generateVoucherNo();
        this.updateHeadFilter();
    }

    logout() {
        this.currentUser = null;
        this.currentRole = 'Staff';
        this.currentFirm = null;
        this.userPermissions = {};
        this.storage.remove('session_user');
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        showToast('👋 Logged out');
    }

    showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        this.renderAll();
        this.updateStats();
        this.generateVoucherNo();
        this.updateHeadFilter();
    }

    // ===== UI UPDATES =====
    updateUI() {
        const name = document.getElementById('header_user_name');
        if (name) name.textContent = this.currentUser || 'Guest';

        const role = document.getElementById('header_user_role');
        if (role) role.textContent = this.currentRole || 'Staff';

        let firmName = 'All Firms';
        if (this.currentRole === 'Admin') firmName = 'All Firms (Admin)';
        else if (this.currentFirm && this.allFirms[this.currentFirm]) {
            firmName = this.allFirms[this.currentFirm].name;
        }
        const headerFirm = document.getElementById('header_firm_name');
        if (headerFirm) headerFirm.textContent = firmName;

        // Update permissions in UI
        this.updatePermissionUI();
    }

    updatePermissionUI() {
        const elements = {
            'btn-add-voucher': this.canAddExpense(),
            'btn-edit-voucher': this.userPermissions.edit || this.currentRole === 'Admin',
            'btn-delete-voucher': this.userPermissions.delete || this.currentRole === 'Admin',
            'btn-print-voucher': this.userPermissions.print || this.currentRole === 'Admin',
            'btn-whatsapp': this.userPermissions.whatsapp || this.currentRole === 'Admin',
            'btn-reports': this.userPermissions.reports || this.currentRole === 'Admin',
            'settings-btn': this.currentRole === 'Admin',
            'add-party-btn': this.canAddParty(),
            'add-signatory-btn': this.canAddSignatory(),
            'add-bank-btn': this.canAddBank()
        };

        Object.entries(elements).forEach(([id, visible]) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = visible ? '' : 'none';
            }
        });
    }

    updateStats() {
        const total = this.db.filter(v => v.status !== 'deleted').length;
        const totalAmount = this.db.filter(v => v.status !== 'deleted')
            .reduce((sum, v) => sum + (v.amount || 0), 0);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthVouchers = this.db.filter(v => {
            const d = new Date(v.date);
            return d >= monthStart && v.status !== 'deleted';
        });
        const monthAmount = monthVouchers.reduce((sum, v) => sum + (v.amount || 0), 0);

        document.getElementById('stat-total-vouchers').textContent = total;
        document.getElementById('stat-total-amount').textContent = formatCurrency(totalAmount);
        document.getElementById('stat-month-vouchers').textContent = monthVouchers.length;
        document.getElementById('stat-month-amount').textContent = formatCurrency(monthAmount);
    }

    // ===== HEADER DROPDOWNS =====
    populateExpenseHeads() {
        const input = document.getElementById('expense_head_input');
        if (!input) return;
        const dropdown = document.getElementById('expenseHeadDropdown');
        if (!dropdown) return;
        
        const search = input.value.toLowerCase();
        const heads = Object.keys(this.expenseHeads);
        const filtered = search ? heads.filter(h => h.toLowerCase().includes(search)) : heads;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No head found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = filtered.map(h => 
            `<div onclick="app.selectExpenseHead('${h.replace(/'/g, "\\'")}')" 
                  style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;"
                  onmouseover="this.style.background='#f1f5f9'" 
                  onmouseout="this.style.background=''">
                ${h}
            </div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populateSubHeads(head) {
        const input = document.getElementById('sub_head_input');
        if (!input) return;
        const dropdown = document.getElementById('subHeadDropdown');
        if (!dropdown) return;

        const subHeads = this.expenseHeads[head] || [];
        const search = input.value.toLowerCase();
        const filtered = search ? subHeads.filter(s => s.toLowerCase().includes(search)) : subHeads;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No sub-head found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = filtered.map(sh => 
            `<div onclick="app.selectSubHead('${sh.replace(/'/g, "\\'")}')" 
                  style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;"
                  onmouseover="this.style.background='#f1f5f9'" 
                  onmouseout="this.style.background=''">
                ${sh}
            </div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populateFirmDropdown() {
        const input = document.getElementById('firm_name_input');
        if (!input) return;
        const dropdown = document.getElementById('firmDropdown');
        if (!dropdown) return;

        let firms = [];
        if (this.currentRole === 'Admin') firms = Object.keys(this.allFirms);
        else if (this.currentFirm) firms = [this.currentFirm];

        const search = input.value.toLowerCase();
        const filtered = search ? firms.filter(f => 
            (this.allFirms[f]?.name || f).toLowerCase().includes(search)
        ) : firms;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No firm found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = filtered.map(f => 
            `<div onclick="app.selectFirm('${f}')" 
                  style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;"
                  onmouseover="this.style.background='#f1f5f9'" 
                  onmouseout="this.style.background=''">
                ${this.allFirms[f]?.name || f}
            </div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populatePartyDropdown() {
        const input = document.getElementById('party_input');
        if (!input) return;
        const dropdown = document.getElementById('partyDropdown');
        if (!dropdown) return;

        const search = input.value.toLowerCase();
        const filtered = search ? this.parties.filter(p => 
            p.name.toLowerCase().includes(search) ||
            (p.phone && p.phone.includes(search))
        ) : this.parties;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No party found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = filtered.map(p => 
            `<div onclick="app.selectParty('${p.name.replace(/'/g, "\\'")}')" 
                  style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;"
                  onmouseover="this.style.background='#f1f5f9'" 
                  onmouseout="this.style.background=''">
                ${p.name} ${p.phone ? '📞 ' + p.phone : ''}
            </div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    populateSignatoryDropdown() {
        const input = document.getElementById('signatory_input');
        if (!input) return;
        const dropdown = document.getElementById('signatoryDropdown');
        if (!dropdown) return;

        const search = input.value.toLowerCase();
        const filtered = search ? this.signatories.filter(s => 
            s.name.toLowerCase().includes(search)
        ) : this.signatories;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="no-result">No signatory found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = filtered.map(s => 
            `<div onclick="app.selectSignatory('${s.name.replace(/'/g, "\\'")}')" 
                  style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f1f5f9;"
                  onmouseover="this.style.background='#f1f5f9'" 
                  onmouseout="this.style.background=''">
                ${s.name} ${s.designation ? ' - ' + s.designation : ''}
            </div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    // ===== SELECT FUNCTIONS =====
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

    // ===== VOUCHER CRUD =====
    async addVoucher() {
        const firmKey = document.getElementById('firm_name_value').value;
        const head = document.getElementById('expense_head_value').value;
        const subHead = document.getElementById('sub_head_value').value;
        const party = document.getElementById('party_value').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const date = document.getElementById('voucher_date').value;
        const mode = document.getElementById('payment_mode').value;
        const narration = document.getElementById('narration').value;
        const signatory = document.getElementById('signatory_value').value;
        const bankName = document.getElementById('bank_name').value;
        const bankAccount = document.getElementById('bank_account').value;
        const bankIfsc = document.getElementById('bank_ifsc').value;
        const referenceNo = document.getElementById('reference_no').value;

        if (!firmKey) { showToast('❌ Please select a firm'); return; }
        if (!head) { showToast('❌ Please select expense head'); return; }
        if (!party) { showToast('❌ Please select party'); return; }
        if (!amount || amount <= 0) { showToast('❌ Enter valid amount'); return; }
        if (!date) { showToast('❌ Select date'); return; }

        // Check for duplicate
        if (this.isDuplicateVoucher(date, firmKey, head, party, amount)) {
            showToast('⚠️ Duplicate voucher! Similar entry exists.');
            return;
        }

        const vno = document.getElementById('voucher_no').value || this.generateVoucherNo();

        const voucher = {
            id: generateId(),
            vno: vno,
            date: date,
            firmKey: firmKey,
            firmName: this.allFirms[firmKey]?.name || firmKey,
            head: head,
            subHead: subHead || '',
            party: party,
            amount: amount,
            mode: mode || 'Cash',
            bankName: bankName || '',
            bankAccount: bankAccount || '',
            bankIfsc: bankIfsc || '',
            referenceNo: referenceNo || '',
            signatory: signatory || '',
            narration: narration || '',
            type: 'EXP',
            status: 'active',
            createdBy: this.currentUser,
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };

        await this.storage.saveVoucher(voucher);
        this.db.push(voucher);
        this.renderAll();
        this.updateStats();
        this.generateVoucherNo();
        this.updateHeadFilter();
        this.clearVoucherForm();
        showToast('✅ Voucher added successfully!');
    }

    isDuplicateVoucher(date, firmKey, head, party, amount) {
        const threshold = 0.01;
        return this.db.some(v => 
            v.date === date &&
            v.firmKey === firmKey &&
            v.head === head &&
            v.party === party &&
            Math.abs(v.amount - amount) < threshold &&
            v.status !== 'deleted'
        );
    }

    clearVoucherForm() {
        document.getElementById('party_value').value = '';
        document.getElementById('party_input').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('narration').value = '';
        document.getElementById('signatory_value').value = '';
        document.getElementById('signatory_input').value = '';
        document.getElementById('bank_name').value = '';
        document.getElementById('bank_account').value = '';
        document.getElementById('bank_ifsc').value = '';
        document.getElementById('reference_no').value = '';
        document.getElementById('voucher_date').value = new Date().toISOString().split('T')[0];
        document.getElementById('payment_mode').value = 'Cash';
    }

    async editVoucher(id) {
        const voucher = this.db.find(v => v.id === id);
        if (!voucher) { showToast('Voucher not found'); return; }

        // Check permission
        if (this.currentRole !== 'Admin' && !this.userPermissions.edit) {
            showToast('❌ No permission to edit');
            return;
        }

        // Log edit
        this.editLogs.push({
            voucherId: id,
            editedBy: this.currentUser,
            timestamp: new Date().toISOString(),
            changes: { ...voucher }
        });
        await this.storage.save('edit_logs', this.editLogs);

        // Show edit modal
        document.getElementById('edit_voucher_id').value = id;
        document.getElementById('edit_voucher_vno').value = voucher.vno;
        document.getElementById('edit_voucher_date').value = voucher.date;
        document.getElementById('edit_voucher_firm').value = voucher.firmKey;
        document.getElementById('edit_voucher_head').value = voucher.head;
        document.getElementById('edit_voucher_subhead').value = voucher.subHead || '';
        document.getElementById('edit_voucher_party').value = voucher.party;
        document.getElementById('edit_voucher_amount').value = voucher.amount;
        document.getElementById('edit_voucher_mode').value = voucher.mode || 'Cash';
        document.getElementById('edit_voucher_bank').value = voucher.bankName || '';
        document.getElementById('edit_voucher_account').value = voucher.bankAccount || '';
        document.getElementById('edit_voucher_ifsc').value = voucher.bankIfsc || '';
        document.getElementById('edit_voucher_ref').value = voucher.referenceNo || '';
        document.getElementById('edit_voucher_signatory').value = voucher.signatory || '';
        document.getElementById('edit_voucher_narration').value = voucher.narration || '';

        document.getElementById('editVoucherModal').style.display = 'flex';
    }

    async saveEditVoucher() {
        const id = document.getElementById('edit_voucher_id').value;
        const voucher = this.db.find(v => v.id === id);
        if (!voucher) { showToast('Voucher not found'); return; }

        const newVno = document.getElementById('edit_voucher_vno').value.trim();
        const newDate = document.getElementById('edit_voucher_date').value;
        const newHead = document.getElementById('edit_voucher_head').value.trim();
        const newSubHead = document.getElementById('edit_voucher_subhead').value.trim();
        const newParty = document.getElementById('edit_voucher_party').value.trim();
        const newAmount = parseFloat(document.getElementById('edit_voucher_amount').value);
        const newMode = document.getElementById('edit_voucher_mode').value;
        const newBank = document.getElementById('edit_voucher_bank').value.trim();
        const newAccount = document.getElementById('edit_voucher_account').value.trim();
        const newIfsc = document.getElementById('edit_voucher_ifsc').value.trim();
        const newRef = document.getElementById('edit_voucher_ref').value.trim();
        const newSignatory = document.getElementById('edit_voucher_signatory').value.trim();
        const newNarration = document.getElementById('edit_voucher_narration').value.trim();

        if (!newVno) { showToast('Voucher number required'); return; }
        if (!newDate) { showToast('Date required'); return; }
        if (!newHead) { showToast('Head required'); return; }
        if (!newParty) { showToast('Party required'); return; }
        if (!newAmount || newAmount <= 0) { showToast('Valid amount required'); return; }

        // Update voucher
        voucher.vno = newVno;
        voucher.date = newDate;
        voucher.head = newHead;
        voucher.subHead = newSubHead;
        voucher.party = newParty;
        voucher.amount = newAmount;
        voucher.mode = newMode;
        voucher.bankName = newBank;
        voucher.bankAccount = newAccount;
        voucher.bankIfsc = newIfsc;
        voucher.referenceNo = newRef;
        voucher.signatory = newSignatory;
        voucher.narration = newNarration;
        voucher.updatedAt = new Date().toISOString();

        await this.storage.saveVoucher(voucher);
        this.renderAll();
        this.updateStats();
        document.getElementById('editVoucherModal').style.display = 'none';
        showToast('✅ Voucher updated successfully!');
    }

    async deleteVoucher(id) {
        if (!confirm('Delete this voucher?')) return;
        if (this.currentRole !== 'Admin' && !this.userPermissions.delete) {
            showToast('❌ No permission to delete');
            return;
        }

        const voucher = this.db.find(v => v.id === id);
        if (voucher) {
            voucher.status = 'deleted';
            voucher.deletedAt = new Date().toISOString();
            voucher.deletedBy = this.currentUser;
            this.deletedVouchers.push(voucher);
            this.db = this.db.filter(v => v.id !== id);
            await this.storage.saveVoucher(voucher);
            this.renderAll();
            this.updateStats();
            showToast('🗑️ Voucher deleted');
        }
    }

    async restoreVoucher(id) {
        const voucher = this.deletedVouchers.find(v => v.id === id);
        if (voucher) {
            voucher.status = 'active';
            delete voucher.deletedAt;
            delete voucher.deletedBy;
            this.db.push(voucher);
            this.deletedVouchers = this.deletedVouchers.filter(v => v.id !== id);
            await this.storage.saveVoucher(voucher);
            this.renderAll();
            this.updateStats();
            showToast('↩️ Voucher restored');
        }
    }

    generateVoucherNo() {
        const prefix = this.currentFirm ? 
            (this.allFirms[this.currentFirm]?.short || 'EXP') : 'EXP';
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const count = this.db.filter(v => {
            const d = new Date(v.date);
            return d.getFullYear() === date.getFullYear() &&
                   d.getMonth() === date.getMonth() &&
                   v.status !== 'deleted';
        }).length + 1;
        const vno = `${prefix}/${year}${month}/${String(count).padStart(4, '0')}`;
        const input = document.getElementById('voucher_no');
        if (input) input.value = vno;
        return vno;
    }

    // ===== SEARCH & FILTER =====
    applySearch() {
        const query = document.getElementById('globalSearch')?.value || '';
        this.searchQuery = query.toLowerCase();
        this.renderAll();
    }

    clearSearch() {
        document.getElementById('globalSearch').value = '';
        this.searchQuery = '';
        this.searchFilters = {};
        document.getElementById('filterModal').style.display = 'none';
        this.renderAll();
    }

    openFilterModal() {
        document.getElementById('filterModal').style.display = 'flex';
        // Populate filter options
        this.populateFilterOptions();
    }

    populateFilterOptions() {
        // Populate head filter
        const headSelect = document.getElementById('filter_head');
        if (headSelect) {
            headSelect.innerHTML = '<option value="">All Heads</option>';
            Object.keys(this.expenseHeads).forEach(h => {
                headSelect.innerHTML += `<option value="${h}">${h}</option>`;
            });
        }

        // Populate firm filter
        const firmSelect = document.getElementById('filter_firm');
        if (firmSelect) {
            firmSelect.innerHTML = '<option value="">All Firms</option>';
            Object.keys(this.allFirms).forEach(f => {
                firmSelect.innerHTML += `<option value="${f}">${this.allFirms[f].name}</option>`;
            });
        }

        // Populate mode filter
        const modeSelect = document.getElementById('filter_mode');
        if (modeSelect) {
            modeSelect.innerHTML = '<option value="">All Modes</option>';
            ['Cash', 'Bank', 'UPI', 'Cheque', 'NEFT', 'RTGS', 'IMPS'].forEach(m => {
                modeSelect.innerHTML += `<option value="${m}">${m}</option>`;
            });
        }

        // Populate amount range
        const maxAmount = Math.max(...this.db.map(v => v.amount || 0), 1000);
        document.getElementById('filter_amount_max').max = maxAmount;
        document.getElementById('filter_amount_max').step = 100;
    }

    applyFilters() {
        const filters = {
            head: document.getElementById('filter_head')?.value || '',
            firm: document.getElementById('filter_firm')?.value || '',
            mode: document.getElementById('filter_mode')?.value || '',
            dateFrom: document.getElementById('filter_date_from')?.value || '',
            dateTo: document.getElementById('filter_date_to')?.value || '',
            amountMin: parseFloat(document.getElementById('filter_amount_min')?.value) || 0,
            amountMax: parseFloat(document.getElementById('filter_amount_max')?.value) || Infinity,
            party: document.getElementById('filter_party')?.value.toLowerCase() || '',
            createdBy: document.getElementById('filter_created_by')?.value.toLowerCase() || ''
        };

        this.searchFilters = filters;
        document.getElementById('filterModal').style.display = 'none';
        this.renderAll();
        showToast('🔍 Filters applied');
    }

    // ===== RENDER FUNCTIONS =====
    renderAll() {
        this.renderVoucherList();
        this.renderDeletedList();
        this.updateStats();
        this.updateHeadFilter();
    }

    renderVoucherList() {
        const container = document.getElementById('voucher-list');
        if (!container) return;

        let vouchers = this.db.filter(v => v.status !== 'deleted');

        // Apply search
        if (this.searchQuery) {
            vouchers = vouchers.filter(v => 
                (v.vno || '').toLowerCase().includes(this.searchQuery) ||
                (v.party || '').toLowerCase().includes(this.searchQuery) ||
                (v.head || '').toLowerCase().includes(this.searchQuery) ||
                (v.subHead || '').toLowerCase().includes(this.searchQuery) ||
                (v.firmName || '').toLowerCase().includes(this.searchQuery) ||
                (v.narration || '').toLowerCase().includes(this.searchQuery) ||
                (v.referenceNo || '').toLowerCase().includes(this.searchQuery)
            );
        }

        // Apply filters
        const f = this.searchFilters;
        if (f.head) vouchers = vouchers.filter(v => v.head === f.head);
        if (f.firm) vouchers = vouchers.filter(v => v.firmKey === f.firm);
        if (f.mode) vouchers = vouchers.filter(v => v.mode === f.mode);
        if (f.dateFrom) vouchers = vouchers.filter(v => v.date >= f.dateFrom);
        if (f.dateTo) vouchers = vouchers.filter(v => v.date <= f.dateTo);
        if (f.amountMin) vouchers = vouchers.filter(v => v.amount >= f.amountMin);
        if (f.amountMax && f.amountMax !== Infinity) 
            vouchers = vouchers.filter(v => v.amount <= f.amountMax);
        if (f.party) vouchers = vouchers.filter(v => 
            (v.party || '').toLowerCase().includes(f.party)
        );
        if (f.createdBy) vouchers = vouchers.filter(v => 
            (v.createdBy || '').toLowerCase().includes(f.createdBy)
        );

        // Apply sort
        const { field, direction } = this.currentSort;
        vouchers.sort((a, b) => {
            let valA = a[field] || '';
            let valB = b[field] || '';
            if (field === 'amount') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else if (field === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            }
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        if (vouchers.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center; padding:40px;">
                    <div style="font-size:48px; margin-bottom:16px;">📭</div>
                    <h3>No vouchers found</h3>
                    <p style="color:#999;">${this.searchQuery || Object.keys(this.searchFilters).length > 0 ? 'Try adjusting your search or filters' : 'Add your first voucher'}</p>
                </div>
            `;
            return;
        }

        // Select view mode
        if (this.viewMode === 'cards') {
            container.innerHTML = vouchers.map(v => this._renderCard(v)).join('');
        } else {
            container.innerHTML = this._renderTable(vouchers);
        }
    }

    _renderTable(vouchers) {
        const headers = [
            { key: 'select', label: '☑' },
            { key: 'sno', label: '#' },
            { key: 'date', label: 'Date' },
            { key: 'vno', label: 'Voucher No' },
            { key: 'firmName', label: 'Firm' },
            { key: 'head', label: 'Head' },
            { key: 'subHead', label: 'Sub Head' },
            { key: 'party', label: 'Party' },
            { key: 'amount', label: 'Amount' },
            { key: 'mode', label: 'Mode' },
            { key: 'referenceNo', label: 'Reference' },
            { key: 'signatory', label: 'Signatory' },
            { key: 'actions', label: 'Actions' }
        ];

        let html = `
            <div class="table-responsive">
                <table class="voucher-table">
                    <thead>
                        <tr>
                            ${headers.map(h => `
                                <th onclick="app.sortBy('${h.key}')" style="cursor:pointer;">
                                    ${h.label}
                                    ${this.currentSort.field === h.key ? (this.currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        vouchers.forEach((v, index) => {
            const isSelected = this.selectedVouchers.has(v.id);
            html += `
                <tr class="${isSelected ? 'selected-row' : ''}" 
                    onclick="app.selectVoucher('${v.id}')"
                    style="cursor:pointer;">
                    <td>
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onclick="event.stopPropagation(); app.toggleSelectVoucher('${v.id}')" />
                    </td>
                    <td>${index + 1}</td>
                    <td>${formatDate(v.date)}</td>
                    <td><strong>${v.vno || '-'}</strong></td>
                    <td>${v.firmName || '-'}</td>
                    <td>${v.head || '-'}</td>
                    <td>${v.subHead || '-'}</td>
                    <td>${v.party || '-'}</td>
                    <td><strong>${formatCurrency(v.amount || 0)}</strong></td>
                    <td><span class="mode-badge">${v.mode || 'Cash'}</span></td>
                    <td>${v.referenceNo || '-'}</td>
                    <td>${v.signatory || '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-sm btn-edit" onclick="event.stopPropagation(); app.editVoucher('${v.id}')">✏️</button>
                            <button class="btn-sm btn-del" onclick="event.stopPropagation(); app.deleteVoucher('${v.id}')">🗑️</button>
                            <button class="btn-sm btn-print" onclick="event.stopPropagation(); app.printVoucher('${v.id}')">🖨️</button>
                            ${this.userPermissions.whatsapp || this.currentRole === 'Admin' ? 
                                `<button class="btn-sm btn-whatsapp" onclick="event.stopPropagation(); app.shareVoucher('${v.id}')">💬</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        // Add bulk actions
        if (this.selectedVouchers.size > 0) {
            html += `
                <div class="bulk-actions">
                    <span>${this.selectedVouchers.size} selected</span>
                    <button class="btn-sm" onclick="app.bulkDelete()">🗑️ Delete Selected</button>
                    <button class="btn-sm" onclick="app.bulkExport()">📊 Export Selected</button>
                    <button class="btn-sm" onclick="app.clearSelection()">✖ Clear</button>
                </div>
            `;
        }

        return html;
    }

    _renderCard(voucher) {
        const isSelected = this.selectedVouchers.has(voucher.id);
        return `
            <div class="voucher-card ${isSelected ? 'selected' : ''}" 
                 onclick="app.selectVoucher('${voucher.id}')">
                <div class="card-header">
                    <div>
                        <span class="card-vno">${voucher.vno || '-'}</span>
                        <span class="card-date">${formatDate(voucher.date)}</span>
                    </div>
                    <div>
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onclick="event.stopPropagation(); app.toggleSelectVoucher('${voucher.id}')" />
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-firm">🏢 ${voucher.firmName || '-'}</div>
                    <div class="card-head">📋 ${voucher.head || '-'} ${voucher.subHead ? '→ ' + voucher.subHead : ''}</div>
                    <div class="card-party">👤 ${voucher.party || '-'}</div>
                    <div class="card-amount">${formatCurrency(voucher.amount || 0)}</div>
                    <div class="card-meta">
                        <span class="mode-badge">${voucher.mode || 'Cash'}</span>
                        ${voucher.referenceNo ? `<span>📎 ${voucher.referenceNo}</span>` : ''}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-sm btn-edit" onclick="event.stopPropagation(); app.editVoucher('${voucher.id}')">✏️</button>
                    <button class="btn-sm btn-del" onclick="event.stopPropagation(); app.deleteVoucher('${voucher.id}')">🗑️</button>
                    <button class="btn-sm btn-print" onclick="event.stopPropagation(); app.printVoucher('${voucher.id}')">🖨️</button>
                    ${this.userPermissions.whatsapp || this.currentRole === 'Admin' ? 
                        `<button class="btn-sm btn-whatsapp" onclick="event.stopPropagation(); app.shareVoucher('${voucher.id}')">💬</button>` : ''}
                </div>
            </div>
        `;
    }

    renderDeletedList() {
        const container = document.getElementById('deleted-list');
        if (!container) return;

        if (this.deletedVouchers.length === 0) {
            container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">No deleted vouchers</p>';
            return;
        }

        container.innerHTML = this.deletedVouchers.map(v => `
            <div class="deleted-item" style="padding:10px; border:1px solid #fee2e2; border-radius:6px; margin-bottom:8px; background:#fef2f2; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; gap:15px; flex-wrap:wrap; align-items:center;">
                    <span><strong>${v.vno}</strong></span>
                    <span>${formatDate(v.date)}</span>
                    <span>${v.party || '-'}</span>
                    <span>${formatCurrency(v.amount || 0)}</span>
                    <span style="font-size:12px; color:#999;">Deleted: ${v.deletedBy || 'unknown'}</span>
                </div>
                <div>
                    <button class="btn-sm" onclick="app.restoreVoucher('${v.id}')">↩️ Restore</button>
                    <button class="btn-sm btn-del" onclick="app.permanentDelete('${v.id}')">✖ Permanently</button>
                </div>
            </div>
        `).join('');
    }

    // ===== SELECTION & BULK OPERATIONS =====
    toggleSelectVoucher(id) {
        if (this.selectedVouchers.has(id)) {
            this.selectedVouchers.delete(id);
        } else {
            this.selectedVouchers.add(id);
        }
        this.renderAll();
    }

    selectVoucher(id) {
        // Just toggle selection on click
        this.toggleSelectVoucher(id);
    }

    clearSelection() {
        this.selectedVouchers.clear();
        this.renderAll();
    }

    getSelectedVouchers() {
        return this.db.filter(v => this.selectedVouchers.has(v.id));
    }

    async bulkDelete() {
        const selected = this.getSelectedVouchers();
        if (selected.length === 0) { showToast('No vouchers selected'); return; }
        if (!confirm(`Delete ${selected.length} vouchers?`)) return;
        if (this.currentRole !== 'Admin' && !this.userPermissions.delete) {
            showToast('❌ No permission to delete');
            return;
        }

        for (const v of selected) {
            v.status = 'deleted';
            v.deletedAt = new Date().toISOString();
            v.deletedBy = this.currentUser;
            this.deletedVouchers.push(v);
            this.db = this.db.filter(item => item.id !== v.id);
            await this.storage.saveVoucher(v);
        }
        this.selectedVouchers.clear();
        this.renderAll();
        this.updateStats();
        showToast(`🗑️ ${selected.length} vouchers deleted`);
    }

    async bulkExport() {
        const selected = this.getSelectedVouchers();
        if (selected.length === 0) { showToast('No vouchers selected'); return; }
        this.exportToExcel(selected, 'Selected_Vouchers_Export');
    }

    // ===== SORTING =====
    sortBy(field) {
        if (field === 'select' || field === 'sno' || field === 'actions') return;
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'desc';
        }
        this.renderAll();
    }

    // ===== EXPORT FUNCTIONS =====
    exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') { 
            showToast('Excel library loading...'); 
            return; 
        }
        
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

        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
            { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
            { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 10 },
            { wch: 20 }
        ];

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

    exportFilteredData() {
        let vouchers = this.db.filter(v => v.status !== 'deleted');
        
        // Apply current search and filters
        if (this.searchQuery) {
            vouchers = vouchers.filter(v => 
                (v.vno || '').toLowerCase().includes(this.searchQuery) ||
                (v.party || '').toLowerCase().includes(this.searchQuery) ||
                (v.head || '').toLowerCase().includes(this.searchQuery)
            );
        }
        
        const f = this.searchFilters;
        if (f.head) vouchers = vouchers.filter(v => v.head === f.head);
        if (f.firm) vouchers = vouchers.filter(v => v.firmKey === f.firm);
        if (f.mode) vouchers = vouchers.filter(v => v.mode === f.mode);
        if (f.dateFrom) vouchers = vouchers.filter(v => v.date >= f.dateFrom);
        if (f.dateTo) vouchers = vouchers.filter(v => v.date <= f.dateTo);
        
        if (vouchers.length === 0) {
            showToast('No data to export with current filters');
            return;
        }
        this.exportToExcel(vouchers, 'Filtered_Vouchers_Export');
    }

    // ===== SHARE =====
    shareVoucher(id) {
        if (!this.userPermissions.whatsapp && this.currentRole !== 'Admin') {
            showToast('❌ No permission to share');
            return;
        }
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Voucher not found'); return; }
        
        const message = `*${v.firmName || 'Expense'}*\n` +
                       `Voucher: ${v.vno}\n` +
                       `Date: ${formatDate(v.date)}\n` +
                       `Head: ${v.head}\n` +
                       `Party: ${v.party}\n` +
                       `Amount: ${formatCurrency(v.amount)}\n` +
                       `Mode: ${v.mode || 'Cash'}\n` +
                       (v.referenceNo ? `Reference: ${v.referenceNo}\n` : '') +
                       `\nThank you!`;
        
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }

    shareInvoiceViaWhatsApp() {
        const voucher = this.db[this.db.length - 1];
        if (!voucher) { showToast('No voucher to share'); return; }
        this.shareVoucher(voucher.id);
    }

    // ===== PRINT =====
    printVoucher(id) {
        const v = this.db.find(x => x.id === id);
        if (!v) { showToast('Voucher not found'); return; }
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Voucher - ${v.vno}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                        .voucher-title { font-size: 24px; font-weight: bold; }
                        .voucher-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; margin: 20px 0; }
                        .detail-item { padding: 8px 0; border-bottom: 1px solid #eee; }
                        .detail-label { font-weight: bold; color: #666; }
                        .amount { font-size: 28px; color: #2563eb; text-align: center; padding: 20px; background: #f0f5ff; border-radius: 8px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; font-size: 12px; color: #999; }
                        .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
                        .signature-line { width: 200px; border-top: 1px solid #333; padding-top: 10px; text-align: center; }
                        @media print { body { padding: 20px; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="voucher-title">🧾 Expense Voucher</div>
                        <div>${v.firmName || ''}</div>
                    </div>
                    
                    <div class="voucher-details">
                        <div class="detail-item"><span class="detail-label">Voucher No:</span> ${v.vno}</div>
                        <div class="detail-item"><span class="detail-label">Date:</span> ${formatDate(v.date)}</div>
                        <div class="detail-item"><span class="detail-label">Head:</span> ${v.head}</div>
                        <div class="detail-item"><span class="detail-label">Sub Head:</span> ${v.subHead || '-'}</div>
                        <div class="detail-item"><span class="detail-label">Party:</span> ${v.party}</div>
                        <div class="detail-item"><span class="detail-label">Mode:</span> ${v.mode || 'Cash'}</div>
                        ${v.referenceNo ? `<div class="detail-item"><span class="detail-label">Reference No:</span> ${v.referenceNo}</div>` : ''}
                        ${v.bankName ? `<div class="detail-item"><span class="detail-label">Bank:</span> ${v.bankName}</div>` : ''}
                        ${v.signatory ? `<div class="detail-item"><span class="detail-label">Signatory:</span> ${v.signatory}</div>` : ''}
                    </div>
                    
                    <div class="amount">Amount: ${formatCurrency(v.amount)}</div>
                    
                    ${v.narration ? `<div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 6px;"><strong>Narration:</strong> ${v.narration}</div>` : ''}
                    
                    <div class="signature">
                        <div class="signature-line">Authorized Signatory</div>
                    </div>
                    
                    <div class="footer">
                        Generated on ${new Date().toLocaleString()} | ${v.createdBy || 'System'}
                    </div>
                    
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    // ===== DASHBOARD WIDGETS =====
    renderDashboard() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return;

        const total = this.db.filter(v => v.status !== 'deleted').length;
        const totalAmount = this.db.filter(v => v.status !== 'deleted')
            .reduce((sum, v) => sum + (v.amount || 0), 0);
        
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthVouchers = this.db.filter(v => {
            const d = new Date(v.date);
            return d >= monthStart && v.status !== 'deleted';
        });
        const monthAmount = monthVouchers.reduce((sum, v) => sum + (v.amount || 0), 0);

        // Firm wise breakdown
        const firmData = {};
        this.db.filter(v => v.status !== 'deleted').forEach(v => {
            const key = v.firmKey || 'unknown';
            if (!firmData[key]) firmData[key] = { count: 0, amount: 0 };
            firmData[key].count++;
            firmData[key].amount += v.amount || 0;
        });

        // Head wise breakdown
        const headData = {};
        this.db.filter(v => v.status !== 'deleted').forEach(v => {
            const key = v.head || 'unknown';
            if (!headData[key]) headData[key] = { count: 0, amount: 0 };
            headData[key].count++;
            headData[key].amount += v.amount || 0;
        });

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="widget widget-total">
                    <div class="widget-icon">📊</div>
                    <div class="widget-content">
                        <div class="widget-label">Total Vouchers</div>
                        <div class="widget-value">${total}</div>
                    </div>
                </div>
                <div class="widget widget-amount">
                    <div class="widget-icon">💰</div>
                    <div class="widget-content">
                        <div class="widget-label">Total Amount</div>
                        <div class="widget-value">${formatCurrency(totalAmount)}</div>
                    </div>
                </div>
                <div class="widget widget-month">
                    <div class="widget-icon">📅</div>
                    <div class="widget-content">
                        <div class="widget-label">This Month</div>
                        <div class="widget-value">${monthVouchers.length} | ${formatCurrency(monthAmount)}</div>
                    </div>
                </div>
                <div class="widget widget-firms">
                    <div class="widget-icon">🏢</div>
                    <div class="widget-content">
                        <div class="widget-label">Active Firms</div>
                        <div class="widget-value">${Object.keys(firmData).length}</div>
                    </div>
                </div>
            </div>
            <div class="dashboard-breakdown">
                <div class="breakdown-section">
                    <h4>By Firm</h4>
                    ${Object.entries(firmData).map(([key, data]) => `
                        <div class="breakdown-item">
                            <span>${this.allFirms[key]?.name || key}</span>
                            <span>${data.count} | ${formatCurrency(data.amount)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="breakdown-section">
                    <h4>By Head</h4>
                    ${Object.entries(headData).map(([key, data]) => `
                        <div class="breakdown-item">
                            <span>${key}</span>
                            <span>${data.count} | ${formatCurrency(data.amount)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ===== REPORTS =====
    renderReports() {
        this.renderDashboard();
        this.updateHeadFilter();
        this.renderVoucherList();
    }

    updateHeadFilter() {
        const select = document.getElementById('filter_head');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">All Heads</option>';
        Object.keys(this.expenseHeads).forEach(h => {
            select.innerHTML += `<option value="${h}">${h}</option>`;
        });
        if (currentVal) select.value = currentVal;
    }

    // ===== SETTINGS =====
    openSettings() {
        if (this.currentRole !== 'Admin') {
            showToast('❌ Only Admin can access settings');
            return;
        }
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
    }

    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    // ===== PARTY MANAGEMENT =====
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

    renderPartiesList() {
        const container = document.getElementById('parties_list');
        if (!container) return;
        if (this.parties.length === 0) {
            container.innerHTML = '<p style="color:#999;">No parties added</p>';
            return;
        }
        container.innerHTML = this.parties.map(p => `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; gap:15px; flex-wrap:wrap;">
                    <span><strong>${p.name}</strong></span>
                    ${p.phone ? `<span>📞 ${p.phone}</span>` : ''}
                    ${p.address ? `<span>📍 ${p.address}</span>` : ''}
                </div>
                <div>
                    <button class="btn-sm" onclick="app.editParty('${p.id}')">✏️</button>
                    <button class="btn-sm btn-del" onclick="app.deleteParty('${p.id}')">✖</button>
                </div>
            </div>
        `).join('');
    }

    canAddParty() {
        return this.userPermissions.party_add || this.currentRole === 'Admin';
    }

    // ===== SIGNATORY MANAGEMENT =====
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

    renderSignatoriesList() {
        const container = document.getElementById('signatories_list');
        if (!container) return;
        if (this.signatories.length === 0) {
            container.innerHTML = '<p style="color:#999;">No signatories added</p>';
            return;
        }
        container.innerHTML = this.signatories.map(s => `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; gap:15px; flex-wrap:wrap;">
                    <span><strong>${s.name}</strong></span>
                    ${s.designation ? `<span>📋 ${s.designation}</span>` : ''}
                </div>
                <div>
                    <button class="btn-sm" onclick="app.editSignatory('${s.id}')">✏️</button>
                    <button class="btn-sm btn-del" onclick="app.deleteSignatory('${s.id}')">✖</button>
                </div>
            </div>
        `).join('');
    }

    canAddSignatory() {
        return this.userPermissions.signatory_add || this.currentRole === 'Admin';
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
                        <button class="btn-action btn-edit" onclick="app.editFirm('${f}')">✏️ Edit</button>
                        ${!['DevVidyalaya', 'DevGas', 'Rama'].includes(f) ? 
                            `<button class="btn-action btn-del" onclick="app.deleteFirm('${f}')">✖</button>` : ''}
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
                            `<button class="btn-action btn-del" onclick="app.deleteUser('${u.id}')">✖</button>` : ''}
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

    // ===== EXPENSE HEAD MANAGEMENT =====
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
                <button class="btn-action btn-del" onclick="app.deleteExpenseHead('${h.replace(/'/g, "\\'")}')">✖</button>
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

    canAddExpense() {
        return this.userPermissions.expense_add || this.currentRole === 'Admin';
    }

    // ===== BANK MANAGEMENT =====
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

    canAddBank() {
        return this.userPermissions.bank_add || this.currentRole === 'Admin';
    }

    updateBankDropdown() {
        const firmKey = document.getElementById('firm_name_value')?.value || this.currentFirm;
        if (!firmKey) return;
        const banks = this.bankAccounts[firmKey] || [];
        const select = document.getElementById('bank_name');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Bank --</option>';
        banks.forEach(b => {
            select.innerHTML += `<option value="${b.name}">${b.name} - ${b.account}</option>`;
        });
        if (currentVal) select.value = currentVal;
    }

    // ===== UTILITY HELPERS =====
    updateFirmHeader() {
        const firmKey = document.getElementById('firm_name_value')?.value || this.currentFirm;
        const header = document.getElementById('header_firm_name');
        if (header && firmKey && this.allFirms[firmKey]) {
            header.textContent = this.allFirms[firmKey].name;
        }
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

    updateSettingsRoleDropdown() {
        const select = document.getElementById('new_user_role');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = `
            <option value="Staff">Staff</option>
            <option value="Admin">Admin</option>
        `;
        if (currentVal) select.value = currentVal;
        this.toggleFirmSelect();
    }

    toggleFirmSelect() {
        const role = document.getElementById('new_user_role')?.value;
        const firmGroup = document.getElementById('new_user_firm_group');
        if (firmGroup) {
            firmGroup.style.display = role === 'Admin' ? 'none' : 'block';
        }
    }

    updateLoginRoleDropdown() {
        // Not needed for login
    }

    // ===== IMPORT FUNCTIONS =====
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

    // ===== PERMANENT DELETE =====
    async permanentDelete(id) {
        if (!confirm('⚠️ Permanently delete this voucher? This cannot be undone!')) return;
        this.deletedVouchers = this.deletedVouchers.filter(v => v.id !== id);
        await this.storage.deleteVoucher(id);
        this.renderAll();
        showToast('🗑️ Voucher permanently deleted');
    }

    // ===== SETUP =====
    setupRealtimeListener() {
        this.storage.onVoucherChange((db) => {
            this.db = db;
            this.renderAll();
            this.updateStats();
            this.generateVoucherNo();
            this.updateHeadFilter();
        });
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginBtn')?.addEventListener('click', () => this.doLogin());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (document.getElementById('login-screen')?.style.display !== 'none') {
                    this.doLogin();
                }
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(m => { 
                    m.style.display = 'none'; 
                });
            }
            // Ctrl+F for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('globalSearch')?.focus();
            }
        });

        // Modal close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) this.style.display = 'none';
            });
        });

        // Dark mode toggle
        document.querySelector('.dark-mode-toggle')?.addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Search input
        document.getElementById('globalSearch')?.addEventListener('input', () => {
            this.applySearch();
        });

        // Export filtered data button
        document.getElementById('exportFilteredBtn')?.addEventListener('click', () => {
            this.exportFilteredData();
        });
    }
}

// ===== GLOBAL TOAST FUNCTION =====
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) {
        const div = document.createElement('div');
        div.id = 'toast';
        div.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; 
            background: #1e293b; color: white; padding: 12px 24px;
            border-radius: 8px; font-size: 14px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999; max-width: 400px;
            transition: all 0.3s ease;
            opacity: 0; transform: translateY(20px);
        `;
        document.body.appendChild(div);
    }
    const el = document.getElementById('toast');
    el.textContent = message;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
    }, 3000);
}

// ===== INITIALIZE APP =====
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    // Make app globally accessible
    window.app = app;
});

// ===== EXPORT FOR MODULE =====
export default App;
