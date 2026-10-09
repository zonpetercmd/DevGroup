// ============================================
// config/constants.js
// Default Data & App Constants
// ============================================

// ---------- Firms ----------
export const DEFAULT_FIRMS = {
  'DevVidyalaya': {
    name: 'D E V विद्यालय',
    short: 'DV',
    logo: 'logo.png',
    addr: 'DEV Vidyalaya, Near RTO Crossing, Sikar, Rajasthan',
    email: 'devvidyalayasikar@gmail.com',
    mobile: '01572-251021'
  },
  'DevGas': {
    name: 'Dev Gas Agency',
    short: 'DG',
    logo: 'logo.png',
    addr: 'Dev Gas Agency, Sikar Rajasthan',
    email: 'info@devgas.com',
    mobile: '9414037764'
  },
  'Rama': {
    name: 'Rama Enterprises',
    short: 'RE',
    logo: 'logo.png',
    addr: 'Rama Enterprises, Sikar Rajasthan',
    email: 'info@rama.com',
    mobile: '9414037764'
  }
};

// ✅ Firm keys jo delete nahi ho sakti
export const PROTECTED_FIRMS = ['DevVidyalaya', 'DevGas', 'Rama'];

// ---------- User Roles ----------
export const USER_ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer'
};

// ---------- Permissions ----------
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

// ---------- Storage Keys ----------
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

// ---------- Payment ----------
export const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque'];
export const UPI_APPS = ['PhonePe', 'GooglePay', 'Paytm', 'AmazonPay', 'Other'];

// ---------- Voucher Types ----------
export const VOUCHER_TYPES = {
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  JOURNAL: 'Journal',
  CONTRA: 'Contra'
};

// ---------- App Info ----------
export const APP_INFO = {
  name: 'Voucher System',
  version: '1.0.0',
  company: 'DEV Vidyalaya',
  supportEmail: 'devvidyalayasikar@gmail.com'
};

// ---------- Session Keys ----------
export const SESSION_KEYS = {
  AUTH: 'auth',
  USER: 'user',
  ROLE: 'role',
  FIRM: 'firm',
  TOKEN: 'firebaseToken'
};
