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
  PERMISSIONS: 'userPermissions',
  // ✅ NEW: Opening balances
  OPENING_BALANCES: 'openingBalances',
  // ✅ NEW: Accounts (Cash/Bank/Petty)
  ACCOUNTS: 'accounts'
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

// ============================================
// ✅ NEW ADDITIONS - Contra, Receipt, Cash Book
// (पुराना कुछ भी नहीं बदला)
// ============================================

// ✅ Voucher Type Codes (voucher number के लिए)
// EXP = Expense (Payment) — existing
// CTR = Contra — new
// RCP = Receipt — new
export const VOUCHER_TYPE_CODES = {
  EXPENSE: 'EXP',
  CONTRA: 'CTR',
  RECEIPT: 'RCP'
};

// ✅ Account Types (Cash / Bank / Petty Cash)
export const ACCOUNT_TYPES = {
  CASH: 'cash',
  BANK: 'bank',
  PETTY: 'petty'
};

// ✅ Receipt Voucher Modes (Cheque भी शामिल)
export const RECEIPT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque'];

// ✅ Cheque Status (Receipt के लिए)
export const CHEQUE_STATUS = {
  PENDING: 'pending',     // अभी clear नहीं हुआ
  CLEARED: 'cleared',     // clear हो गया
  BOUNCED: 'bounced'      // bounce हो गया
};

// ✅ Default Accounts (अगर कोई accounts नहीं बनाए)
export const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: 'Cash in Hand', type: 'cash', firm: '' },
  { id: 'petty-1', name: 'Petty Cash 1', type: 'petty', firm: '' },
  { id: 'petty-2', name: 'Petty Cash 2', type: 'petty', firm: '' }
];

// ✅ Receipt Categories (Student Fee + Others)
export const RECEIPT_CATEGORIES = [
  'Student Fee',
  'Admission Fee',
  'Exam Fee',
  'Transport Fee',
  'Hostel Fee',
  'Donation',
  'Other'
];

// ✅ Student Classes (Dropdown के लिए)
export const STUDENT_CLASSES = [
  'Nursery', 'LKG', 'UKG',
  '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10',
  '11', '12'
];

// ✅ Class Sections
export const CLASS_SECTIONS = ['A', 'B', 'C', 'D', 'E'];

// ---------- App Info ----------
export const APP_INFO = {
  name: 'Voucher System',
  version: '2.0.0',                        // ✅ Updated
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
