// config/constants.js - Default Data

export const DEFAULT_FIRMS = {
    'DevVidyalaya': {
        name: 'Dev Vidyalaya',
        short: 'DV',
        logo: 'logo.jpeg',
        addr: 'Dev Vidyalaya, Sikar Rajasthan',
        email: 'info@dev.edu.in',
        mobile: '9414037764'
    },
    'DevGas': {
        name: 'Dev Gas Agency',
        short: 'DG',
        logo: 'logo.jpeg',
        addr: 'Dev Gas Agency, Sikar Rajasthan',
        email: 'info@devgas.com',
        mobile: '9414037764'
    },
    'Rama': {
        name: 'Rama Enterprises',
        short: 'RE',
        logo: 'logo.jpeg',
        addr: 'Rama Enterprises, Sikar Rajasthan',
        email: 'info@rama.com',
        mobile: '9414037764'
    }
};

// ✅ Updated Permissions - New Options Added
export const DEFAULT_PERMISSIONS = {
    print: true,
    edit: true,
    delete: true,
    whatsapp: true,
    reports: true,
    view_all: true,
    party_add: true,        // 👤 Add Party
    signatory_add: true,    // ✍️ Add Signatory
    bank_add: true,         // 🏦 Add Bank
    expense_add: true       // 📂 Add Expense Head
};

export const STORAGE_KEYS = {
    FIRMS: 'firms',
    VOUCHERS: 'vouchers',
    DELETED: 'deletedVouchers',
    EDIT_LOGS: 'editLogs',
    PARTIES: 'parties',
    SIGNATORIES: 'signatories',
    EXPENSE_HEADS: 'expenseHeads',
    USERS: 'users',
    VOUCHER_COUNTER: 'voucherCounter',
    BANK_ACCOUNTS: 'bankAccounts',
    PERMISSIONS: 'userPermissions'
};
