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

export const DEFAULT_PERMISSIONS = {
    print: true,
    edit: true,
    delete: true,
    whatsapp: true,
    reports: true,
    view_all: true,
    party_add: true,
    signatory_add: true,
    bank_add: true,
    expense_add: true,
    multi_firm: false
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

// ✅ Added exports for storage.js and app.js
export const PROTECTED_FIRMS = ['DevVidyalaya', 'DevGas', 'Rama'];
export const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque'];
export const UPI_APPS = ['PhonePe', 'GooglePay', 'Paytm', 'AmazonPay', 'Other'];
