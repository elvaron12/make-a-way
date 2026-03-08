// ================= PDF HELPER FUNCTION =================
function getPDFConstructor() {
    // Try multiple ways to get jsPDF constructor
    if (window.jspdf?.jsPDF) {
        return window.jspdf.jsPDF;
    }
    if (window.jsPDF) {
        return window.jsPDF;
    }
    // Fallback check for different library versions
    if (typeof jsPDF !== 'undefined') {
        return jsPDF;
    }
    return null;
}

function createPDFDocument(options = {}) {
    const jsPDF = getPDFConstructor();
    
    if (!jsPDF) {
        throw new Error('jsPDF library is not loaded. Please refresh the app.');
    }
    
    try {
        return new jsPDF(options);
    } catch (e) {
        console.error('Error creating PDF:', e);
        throw new Error('Failed to create PDF document: ' + e.message);
    }
}

function applyPdfBrandHeader(doc, reportTitle = '') {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerHeight = 24;
    const sidePadding = 12;
    const title = String(reportTitle || '').trim();
    const primary = [21, 109, 214];
    const secondary = [12, 72, 161];

    const drawHeader = () => {
        doc.setFillColor(...secondary);
        doc.rect(0, 0, pageWidth, headerHeight, 'F');
        doc.setFillColor(...primary);
        doc.rect(0, headerHeight - 5, pageWidth, 5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text('MAKE A WAY', sidePadding, 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Business Tracking & Sales Reporting', sidePadding, 16);

        if (title) {
            const badgeWidth = Math.min(96, Math.max(48, title.length * 2.8));
            const badgeX = pageWidth - sidePadding - badgeWidth;
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(badgeX, 5, badgeWidth, 10, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.8);
            doc.setTextColor(...secondary);
            doc.text(title.toUpperCase().slice(0, 32), badgeX + badgeWidth / 2, 11.5, { align: 'center' });
        }

        // Soft watermark to keep all pages visually unified.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(64);
        doc.setTextColor(236, 245, 255);
        doc.text('MAW', pageWidth / 2, pageHeight / 2, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
    };

    drawHeader();

    if (!doc.__mawHeaderWrapped) {
        const originalAddPage = doc.addPage.bind(doc);
        doc.addPage = (...args) => {
            originalAddPage(...args);
            drawHeader();
            return doc;
        };
        doc.__mawHeaderWrapped = true;
    }

    return headerHeight + 8;
}

function applyPdfBrandHeaderFirstPageOnly(doc, reportTitle = '') {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerHeight = 24;
    const sidePadding = 12;
    const title = String(reportTitle || '').trim();
    const primary = [21, 109, 214];
    const secondary = [12, 72, 161];

    doc.setFillColor(...secondary);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    doc.setFillColor(...primary);
    doc.rect(0, headerHeight - 5, pageWidth, 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('MAKE A WAY', sidePadding, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Business Tracking & Sales Reporting', sidePadding, 16);

    if (title) {
        const badgeWidth = Math.min(96, Math.max(48, title.length * 2.8));
        const badgeX = pageWidth - sidePadding - badgeWidth;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(badgeX, 5, badgeWidth, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(...secondary);
        doc.text(title.toUpperCase().slice(0, 32), badgeX + badgeWidth / 2, 11.5, { align: 'center' });
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    return headerHeight + 8;
}

function applyPdfBrandFooter(doc, reportTitle = '') {
    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const sidePadding = 12;
    const generatedAt = new Date().toLocaleString();
    const footerLabel = reportTitle
        ? `MAKE A WAY - ${String(reportTitle).toUpperCase()}`
        : 'MAKE A WAY';

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(210, 223, 242);
        doc.setLineWidth(0.3);
        doc.line(sidePadding, pageHeight - 14, pageWidth - sidePadding, pageHeight - 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(110, 120, 140);
        doc.text(footerLabel, sidePadding, pageHeight - 8);
        doc.text(`Generated: ${generatedAt}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - sidePadding, pageHeight - 8, { align: 'right' });
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
}

function parsePdfDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toPdfDateKey(value) {
    const date = parsePdfDate(value);
    if (!date) return 'unknown';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toPdfMinuteKey(value) {
    const date = parsePdfDate(value);
    if (!date) return 'unknown';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${toPdfDateKey(date)} ${hh}:${mm}`;
}

function formatPdfDate(value, options = {}) {
    const date = parsePdfDate(value);
    return date ? date.toLocaleDateString('en-US', options) : 'N/A';
}

function formatPdfTime(value, options = { hour: '2-digit', minute: '2-digit' }) {
    const date = parsePdfDate(value);
    return date ? date.toLocaleTimeString('en-US', options) : 'N/A';
}

function formatPdfDateTime(value) {
    const date = parsePdfDate(value);
    return date
        ? `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'N/A';
}

function formatPdfCurrency(value, prefix = 'RWF') {
    const amount = Number(value) || 0;
    return `${prefix} ${amount.toLocaleString()}`;
}

function drawPdfTitleBlock(doc, startY, margin, title, lines = []) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    const lineCount = Math.max(1, Array.isArray(lines) ? lines.length : 1);
    const blockHeight = 16 + (lineCount * 5);

    doc.setFillColor(243, 249, 255);
    doc.setDrawColor(203, 224, 245);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, startY - 7, contentWidth, blockHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(20, 103, 200);
    doc.text(String(title || 'REPORT').toUpperCase(), margin + 5, startY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 112, 140);
    (lines || []).forEach((line, idx) => {
        doc.text(String(line || ''), margin + 5, startY + 5 + (idx * 4.8));
    });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    return startY + blockHeight + 1;
}

// ================= PDF LIBRARY CHECK =================
// Ensure jsPDF and autoTable are available
(function ensurePDFLibraries() {
    let checkCount = 0;
    const maxChecks = 15; // Check for up to 15 seconds
    
    function checkLibraries() {
        checkCount++;
        const hasJsPDF = (typeof window.jspdf !== 'undefined' && window.jspdf?.jsPDF) || 
                        typeof window.jsPDF !== 'undefined';
        
        if (hasJsPDF) {
            console.log('PDF libraries loaded successfully:', {
                jspdf: typeof window.jspdf,
                jsPDF: typeof window.jsPDF
            });
            return true;
        }
        
        if (checkCount < maxChecks) {
            console.warn(`Waiting for PDF libraries to load... (attempt ${checkCount}/${maxChecks})`);
            setTimeout(checkLibraries, 1000);
        } else {
            console.error('PDF libraries failed to load after 15 seconds');
        }
        return false;
    }
    
    // Check immediately on script load
    if (!checkLibraries()) {
        // Will keep checking via timeout
    }
})();
document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash');
  const splashContent = document.getElementById('splash-content');
  const app = document.getElementById('app');

  if (splash && splashContent && app) {
    setTimeout(() => {
      splashContent.classList.add('slide-left');
      setTimeout(() => {
        splash.style.display = 'none';
        app.classList.remove('hidden');
      }, 900);
    }, 1200);
  }
});

// ================= DATA MANAGEMENT =================
let sales = [];
let customers = [];
let clates = [];
let drinks = [];
let settings = {};
let yearlyArchives = [];
let appMeta = {};
let saleQty = 1;
let selectedCustomerId = null;
let currentSaleType = "normal";
let selectedSalesHistoryType = 'all';
let rwandaClockInterval = null;
let rwandaClockSyncInterval = null;
let rwandaClockBaseEpochMs = null;
let rwandaClockBasePerfMs = null;

const RWANDA_TIME_ZONE = 'Africa/Kigali';
const RWANDA_TIME_SYNC_INTERVAL_MS = 5 * 60 * 1000;

// ================= CART SYSTEM =================
let cart = []; // Cart items array
let drinkSelectionModeEnabled = false;
let selectedDrinksDraft = {};
let selectedStockFilter = 'all';
let pendingStockAdjustContext = null;
let selectedAdminUserFilter = 'all';
let selectedAdminStockFilter = 'all';
let activeAdminMainTab = 'sales';
let activeAdminSalesSubTab = 'daily';
let selectedAdminGrowthWindowDays = 30;
let selectedAdminGrowthPointIndex = -1;
let adminGrowthPreviewPointIndex = -1;
let cachedAdminGrowthAnalysis = null;
const ADMIN_DRINKS_PIE_COLORS = ['#1565c0', '#2e7d32', '#c62828', '#f9a825', '#6a1b9a', '#00838f', '#ef6c00', '#37474f', '#7b1fa2', '#00695c'];
const adminDrinksPieState = {
    data: [],
    slices: [],
    hoverIndex: -1,
    pinnedIndex: -1
};

// ================= TRANSLATION SYSTEM =================
let currentLanguage = 'en';

const translations = {
    en: {
        home: 'Home',
        addSale: 'Add Sale',
        stockManagement: 'Stock Management',
        customers: 'Customers',
        clate: 'Clate/Deposit',
        salesHistory: 'Sales History',
        reports: 'Reports',
        settings: 'Settings',
        login: 'Login',
        admin: 'Admin',
        adminLogin: 'Admin Login',
        adminPanel: 'Admin Panel',
        adminPanelTitle: 'Owner Admin Panel',
        adminPanelDescription: 'Find employers, manage account roles, and control who can access this app.',
        adminRefresh: 'Refresh',
        adminTabSales: 'Sales',
        adminTabAccountManagement: 'Account Management',
        adminSubTabDailySales: 'Daily Sales',
        adminSubTabStock: 'Stock',
        adminExportAccountsPdf: 'Export Accounts PDF',
        adminSearchEmployersPlaceholder: 'Find employers by name, phone, or email...',
        adminFilterPrivileged: 'Admin/Owner',
        adminFilterStaff: 'Staff',
        adminFilterInactive: 'Inactive',
        adminDailyExportTitle: 'Daily Sales Export',
        adminDailyExportDesc: 'Select a specific day and export all sales in ordered time.',
        adminExportDayPdf: 'Export Day PDF',
        adminExportAllSalesPdf: 'Export All Sales PDF',
        adminStockAuditPdf: 'Stock Audit PDF',
        adminStockSectionTitle: 'Stock Overview',
        adminStockSectionDesc: 'Track stock exactly like the user stock page and print reports.',
        adminStockSummaryTotalDrinks: 'Total Drinks',
        adminStockSummaryLow: 'Low Stock',
        adminStockSummaryOut: 'Out of Stock',
        adminStockFilterLow: 'Low',
        adminStockFilterOut: 'Out',
        adminClearCurrentUserData: 'Clear Current User Data',
        adminAccountsExportTitle: 'Account Exports',
        adminAccountsExportDesc: 'Download employer/account data in PDF.',
        adminDataProtectionTitle: 'Data Protection',
        adminDataProtectionDesc: 'Only admin login can clear current user data.',
        adminAiTitle: 'Mini AI Growth Strategy',
        adminAiDesc: 'AI-style analysis based on your real sales, stock, and credit trends.',
        adminAnalyzeBusiness: 'Analyze Business',
        adminAiPlaceholder: 'Run analysis to generate growth strategies.',
        adminSummaryTotalAccounts: 'Total Accounts',
        adminSummaryAdminOwner: 'Admin + Owner',
        adminSummaryStaff: 'Staff',
        adminSummaryInactive: 'Inactive',
        adminDailyHeadDate: 'Date',
        adminDailyHeadTransactions: 'Transactions',
        adminDailyHeadCases: 'Cases Sold',
        adminDailyHeadTotal: 'Total Sales',
        adminDailyHeadProfit: 'Profit',
        adminDailyHeadPrint: 'Print',
        adminEmployerAccountsTitle: 'Employer Accounts',
        adminNoSalesDataYet: 'No sales data yet.',
        adminNoStockMatch: 'No drinks match this filter.',
        adminNoEmployersMatch: 'No employers match this filter.',
        adminAnalysisRequiresSession: 'Admin session required for analysis.',
        adminExportDayNoSales: 'No sales found for that day.',
        signUp: 'Sign Up',
        fullName: 'Full Name',
        phoneOrEmail: 'Phone Number',
        emailAddress: 'Email Address',
        phoneNumber: 'Phone Number',
        pinLabel: '5-digit PIN',
        confirmPin: 'Confirm PIN',
        accountType: 'Account Type',
        signupRoleStaff: 'Staff Account',
        signupRoleAdmin: 'Admin Account',
        adminPinLabel: 'Admin PIN (5-digit)',
        confirmAdminPin: 'Confirm Admin PIN',
        createAccount: 'Create Account',
        continueWithGoogle: 'Continue with Google',
        googleEmailPrompt: 'Enter your Google email',
        googleClientIdPrompt: 'Enter Google OAuth Client ID',
        googleClientIdLooksWrong: 'This does not look like a Google Web Client ID. It should end with .apps.googleusercontent.com',
        googleInvalidClient: 'Google rejected this client ID (invalid_client). Use a valid Google OAuth Web Client ID and add this page URL as an authorized redirect URI.',
        googleLoginFailed: 'Google login failed. Please try again.',
        googleServiceUnavailable: 'Google login service is not available right now.',
        verificationCode: 'Verification Code',
        sendCode: 'Send Code',
        forgotPin: 'Forgot PIN?',
        resetPin: 'Reset PIN',
        resetPinHint: 'Use your phone number to set a new PIN.',
        resetNewPin: 'New 5-digit PIN',
        resetConfirmPin: 'Confirm New PIN', 
        cancel: 'Cancel',
        authHintLogin: 'Welcome back to Make A Way!',
        authHintAdmin: 'Admin login uses your phone number with a separate admin PIN.',
        authHintSignup: 'Create your account to secure this app.',
        authHintReset: 'Reset your PIN with your registered phone number.',
        authInvalidCredentials: 'Incorrect phone number or PIN',
        authAccountInactive: 'This account is inactive. Please contact the owner.',
        authAdminInvalidCredentials: 'Incorrect admin phone number or admin PIN',
        authAdminAccessDenied: 'This account does not have admin access',
        authAdminSetupRequiresUserPin: 'To create admin PIN, enter your normal user PIN first.',
        authAdminSetupPrompt: 'Set a new 5-digit Admin PIN',
        authAdminConfirmPrompt: 'Confirm Admin PIN',
        authAdminPinMustDiffer: 'Admin PIN must be different from your normal PIN',
        authAdminSetupCancelled: 'Admin PIN setup cancelled.',
        authAdminSetupSuccess: 'Admin PIN created. You can now login as admin.',
        authTooManyAttempts: 'Too many failed attempts. Try again in 1 minute.',
        authNameRequired: 'Please enter your full name',
        authPhoneRequired: 'Please enter a valid phone number',
        authEmailRequired: 'Please enter your email address',
        authEmailInvalid: 'Please enter a valid email address',
        authPhoneExists: 'An account with this phone number already exists',
        authEmailExists: 'An account with this email already exists',
        authPinRules: 'PIN must be exactly 5 digits',
        authPinMismatch: 'PIN and confirmation PIN do not match',
        authVerificationCodeRequired: 'Please enter the verification code',
        authVerificationCodeInvalid: 'Verification code is incorrect',
        authVerificationCodeExpired: 'Verification code expired. Request a new code.',
        authVerificationSendFirst: 'Send a verification code first.',
        authCodeSent: 'Verification code sent to {email}.',
        authCodeFallback: 'Email not configured yet. Use this code now: {code}',
        authEmailServiceUnavailable: 'Email service is not configured. Set EmailJS keys in index.html and reload the page.',
        authEmailSendFailed: 'Could not send verification email. Please try again.',
        authEmailRateLimited: 'Please wait 30 seconds before requesting another code.',
        authEmailSetupPrompt: 'Email service is not configured. Configure EmailJS now?',
        authEmailPublicKeyPrompt: 'Enter EmailJS Public Key',
        authEmailServiceIdPrompt: 'Enter EmailJS Service ID',
        authEmailTemplateIdPrompt: 'Enter EmailJS Template ID',
        authEmailFromNamePrompt: 'Enter Email sender name',
        authEmailConfigSaved: 'Email configuration saved.',
        authEmailConfigIncomplete: 'Email configuration is incomplete.',
        authAccountCreated: 'Account created successfully. You can now log in.',
        authUserNotFound: 'No account matches this phone number',
        authResetEmailMismatch: 'The email does not match this account',
        authPinResetSuccess: 'PIN reset successfully. You can now log in.',
        loggedInAs: 'Logged in as',
        todaySales: "Today's Sales",
        todayProfit: "Today's Profit",
        customersOwing: 'Customers Owing',
        pendingDeposits: 'Pending Deposits',
        availableDrinks: 'Available Drinks',
        cartItems: 'Sale Items',
        quickAdd: 'Quick Add Drink',
        selectDrink: 'Select Drink',
        quantity: 'Quantity',
        saleType: 'Sale Type',
        selectCustomer: 'Select Customer',
        confirmSale: 'Confirm Sale',
        clearCart: 'Clear Cart',
        normalSale: 'Normal Sale (Cash)',
        creditSale: 'Credit Sale',
        dailyTotal: 'Daily total',
        addNewDrink: 'Add New Drink',
        drinkName: 'Drink Name',
        drinkPricePlaceholder: 'Price (RWF)',
        newDrinkProfitPerCase: 'Profit/Case (RWF)',
        newDrinkStockQty: 'Initial Stock (Cases)',
        newDrinkLowStockThreshold: 'Low Stock Alert Level',
        saveDrink: 'Save Drink',
        currentSale: 'Current Sale',
        searchDrinks: 'Search drinks...',
        noItemsYet: 'No items added yet',
        chooseDrink: 'Choose a drink...',
        enterQuantity: 'Enter quantity',
        addToCart: 'Add to Cart',
        totalAmount: 'Total Amount',
        remove: 'Remove',
        all: 'All',
        owing: 'Owing',
        cleared: 'Cleared',
        addCustomer: 'Add Customer',
        exportDebtSummary: 'Export Debt Summary',
        searchCustomers: 'Search customers by name, phone, or details...',
        addDeposit: 'Add Deposit',
        trackDeposits: 'Track bottle deposits and refunds.',
        searchDeposits: 'Search deposits by customer name, description, or status...',
        pending: 'Pending',
        returned: 'Returned',
        exportPdf: 'Export PDF',
        searchSales: 'Search sales by drink, customer, or date...',
        cash: 'Cash',
        dateTime: 'Date & Time',
        items: 'Item(s)',
        unitPrice: 'Unit Price',
        total: 'Total',
        type: 'Type',
        actions: 'Actions',
        noSalesYet: 'No sales recorded yet',
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        annual: 'Annual',
        fullReport: 'Full Report',
        reportsHelp: 'Use quick reports (daily/weekly/monthly/annual) or choose a custom date range below.',
        runTutorial: 'Run Tutorial',
        tutorialSkipAll: 'Skip All',
        tutorialBack: 'Back',
        tutorialNext: 'Next',
        tutorialDone: 'Done',
        tutorialStepLabel: 'Step {current} of {total}',
        tutorial1Title: 'Welcome to Make A Way',
        tutorial1Text: 'This tutorial quickly shows where to start, sell, and report your business data.',
        tutorial2Title: 'Start with Drinks',
        tutorial2Text: 'Open Add Sale, add your own drinks and prices, then save them. New accounts start empty.',
        tutorial3Title: 'Record Sales',
        tutorial3Text: 'Use Sale Items and Quick Add to record daily transactions. Credit sales can be linked to customers.',
        tutorial4Title: 'Track Customers and Deposits',
        tutorial4Text: 'Use Customers for debt tracking and Clate/Deposit for bottle/deposit records.',
        tutorial5Title: 'Reports and Date Range',
        tutorial5Text: 'Use Reports for daily/weekly/monthly/annual views, or choose a custom date range and export PDF.',
        tutorial6Title: 'Settings and Backups',
        tutorial6Text: 'Adjust profit, language, and currency in Settings, and export/import your user data for backup.',
        customRangeReport: 'Custom Date Range Report',
        startDate: 'Start Date',
        endDate: 'End Date',
        fullMonth: 'Full Month',
        thisMonth: 'This Month',
        useSelectedMonth: 'Use Selected Month',
        loadRangeReport: 'Load Range Report',
        exportRangePdf: 'Export Range PDF',
        rangeNote: 'Choose past or present dates only. Future dates are disabled.',
        rangeValidation: 'Please choose valid start and end dates',
        rangeEndBeforeStart: 'End date cannot be before start date',
        rangeFutureNotAllowed: 'Future dates are not allowed',
        rangeNoSales: 'No sales were found in the selected date range',
        rangeReportTitle: 'Date Range Report',
        rangeSummary: 'Range Summary',
        settingsPreferences: 'Settings & Preferences',
        businessSettings: 'Business Settings',
        interfaceSettings: 'Appearance, Language & Currency',
        profitPercentage: 'Profit Percentage (%)',
        profitModeLabel: 'Profit Calculation Mode',
        profitModePercentage: 'Percentage of sale total',
        profitModePerCase: 'Per-drink case profit',
        profitPerCaseLabel: 'Default Profit Per Case (RWF)',
        drinkProfitManagerTitle: 'Per-Drink Profit Per Case',
        saveDrinkProfits: 'Save Drink Profits',
        drinkProfitInfo: 'Set and edit profit per case for each drink.',
        noDrinksForProfitEditor: 'No drinks yet. Add drinks in Add Sale first.',
        drinkProfitSaved: 'Drink profits saved',
        save: 'Save',
        profitInfo: 'Used to calculate profit in reports and dashboards',
        profitSaved: 'Profit settings saved',
        profitPercentRangeError: 'Profit percentage must be between 0 and 100',
        profitPerCaseError: 'Profit per case cannot be negative',
        profitLabelPerCase: 'Profit (RWF {amount} per case)',
        profitLabelPerDrinkCase: 'Profit (per-drink case rates)',
        profitLabelPercentage: 'Profit ({value}%)',
        appearance: 'Appearance',
        themeMode: 'Theme Mode',
        lightMode: 'Light Mode',
        darkMode: 'Dark Mode',
        language: 'Language',
        selectLanguage: 'Select Language',
        languageInfo: 'Language preference for the app interface',
        currency: 'Currency',
        currencySymbol: 'Currency Symbol',
        currencyInfo: 'Default currency symbol (e.g., RWF, $, EUR)',
        saveLanguageCurrency: 'Save Language & Currency',
        dataManagement: 'Data Management',
        exportData: 'Export Data (JSON)',
        importData: 'Import Data',
        clearAllData: 'Clear User Data',
        warningClearData: 'Warning: clears only the currently logged-in user data.',
        clearDataConfirmTitle: 'Clear User Data',
        clearDataConfirmLabel: 'Confirmation Text',
        clearDataConfirmInstruction: 'Type CLEAR USER DATA (all caps) to confirm.',
        clearDataConfirmPlaceholder: 'Type CLEAR USER DATA',
        clearDataConfirmAction: 'Clear User Data',
        clearDataConfirmMismatch: 'Text does not match. Type CLEAR USER DATA exactly.',
        clearDataConfirmCancelled: 'Data clear cancelled.',
        clearDataConfirmSuccess: 'Current user data cleared.',
        clearDataRequiresAdminLogin: 'Admin login required to clear user data.',
        storageLabel: 'Storage:',
        activeAccountLabel: 'Active Account:',
        notLoggedIn: 'Not logged in',
        appInformation: 'App Information',
        appName: 'App Name:',
        version: 'Version:',
        purpose: 'Purpose:',
        appPurposeValue: 'Business Tracking & Sales Management System',
        rightsReserved: '2026 Make A Way. All rights reserved.',
        footerText: 'MAKE A WAY - Business Tracking System'
    },
    rw: {
        home: 'Ahabanza',
        addSale: 'Kongeramo Igurisha',
        stockManagement: 'Igenzura rya Sitoki',
        customers: 'Abakiriya',
        clate: 'Ingwate/Ubwizigame',
        salesHistory: "Amateka y'Igurisha",
        reports: 'Raporo',
        settings: 'Igenamiterere',
        login: 'Injira',
        admin: 'Admin',
        adminLogin: 'Injira nka Admin',
        adminPanel: 'Admin Panel',
        adminPanelTitle: 'Urubuga rw Ubuyobozi',
        adminPanelDescription: 'Shakisha abakozi, uhindure inshingano za konti, kandi ucunge abafite uburenganzira bwo gukoresha porogaramu.',
        signUp: 'Iyandikishe',
        fullName: 'Amazina yuzuye',
        phoneOrEmail: 'Telefoni',
        emailAddress: 'Imeyili',
        phoneNumber: 'Nimero ya telefone',
        pinLabel: 'PIN y imibare 5',
        confirmPin: 'Emeza PIN',
        accountType: 'Ubwoko bwa konti',
        signupRoleStaff: 'Konti isanzwe',
        signupRoleAdmin: 'Konti ya admin',
        adminPinLabel: 'PIN ya admin (imibare 5)',
        confirmAdminPin: 'Emeza PIN ya admin',
        createAccount: 'Fungura konti',
        continueWithGoogle: 'Komeza na Google',
        googleEmailPrompt: 'Andika imeyili ya Google',
        googleClientIdPrompt: 'Andika Google OAuth Client ID',
        googleClientIdLooksWrong: 'Iyi ntabwo isa na Google Web Client ID. Igomba kurangira na .apps.googleusercontent.com',
        googleInvalidClient: 'Google yanze client ID (invalid_client). Koresha Google OAuth Web Client ID nyayo kandi wongere iyi URL ya page muri authorized redirect URIs.',
        googleLoginFailed: 'Kwinjira ukoresheje Google ntibyakunze. Ongera ugerageze.',
        googleServiceUnavailable: 'Serivisi ya Google login ntabwo iboneka ubu.',
        verificationCode: 'Kode y\'iyemeza',
        sendCode: 'Ohereza kode',
        forgotPin: 'Wibagiwe PIN?',
        resetPin: 'Hindura PIN',
        resetPinHint: 'Koresha telefoni yawe kugira ngo ushyireho PIN nshya.',
        resetNewPin: 'PIN nshya y\'imibare 5',
        resetConfirmPin: 'Emeza PIN nshya',
        cancel: 'Siba',
        authHintLogin: 'Koresha konti yawe usanzwe ufite kugira ngo ukomeze.',
        authHintAdmin: 'Admin yinjirana nimero ya telefone kandi ikoresha PIN ya admin itandukanye.',
        authHintSignup: 'Banza ufungure konti kugira ngo urinde porogaramu.',
        authHintReset: 'Hindura PIN ukoresheje nimero ya telefone wandikishijeho konti.',
        authInvalidCredentials: 'Nimero ya telefone cyangwa PIN si byo',
        authAccountInactive: 'Iyi konti ntikora. Vugana na nyiri porogaramu.',
        authAdminInvalidCredentials: 'Nimero ya telefone ya admin cyangwa PIN ya admin si byo',
        authAdminAccessDenied: 'Iyi konti nta burenganzira bwa admin ifite',
        authAdminSetupRequiresUserPin: 'Kugira ngo ushyireho PIN ya admin, banza winjize PIN yawe isanzwe.',
        authAdminSetupPrompt: 'Shyiraho PIN nshya ya admin y imibare 5',
        authAdminConfirmPrompt: 'Emeza PIN ya admin',
        authAdminPinMustDiffer: 'PIN ya admin igomba kuba itandukanye na PIN isanzwe',
        authAdminSetupCancelled: 'Gushyiraho PIN ya admin byahagaritswe.',
        authAdminSetupSuccess: 'PIN ya admin yashyizweho. Ubu ushobora kwinjira nka admin.',
        authTooManyAttempts: 'Wagerageje inshuro nyinshi. Ongera nyuma y umunota 1.',
        authNameRequired: 'Andika amazina yawe yuzuye',
        authPhoneRequired: 'Andika nimero ya telefone yemewe',
        authEmailRequired: 'Andika imeyili yawe',
        authEmailInvalid: 'Andika imeyili yemewe',
        authPhoneExists: 'Iyi nimero isanzwe ifite konti',
        authEmailExists: 'Iyi imeyili isanzwe ifite konti',
        authPinRules: 'PIN igomba kuba imibare 5',
        authPinMismatch: 'PIN na PIN yo kwemeza ntibihura',
        authVerificationCodeRequired: 'Andika kode y\'iyemeza',
        authVerificationCodeInvalid: 'Kode y\'iyemeza si yo',
        authVerificationCodeExpired: 'Kode yararangiye. Saba indi kode.',
        authVerificationSendFirst: 'Banza wohereze kode y\'iyemeza.',
        authCodeSent: 'Kode y\'iyemeza yoherejwe kuri {email}.',
        authCodeFallback: 'Email ntabwo yateguwe neza. Koresha iyi kode nonaha: {code}',
        authEmailServiceUnavailable: 'Serivisi ya email ntabwo yateguwe. Shyiraho EmailJS keys muri index.html hanyuma usubiremo page.',
        authEmailSendFailed: 'Ntibyakunze kohereza kode kuri email. Ongera ugerageze.',
        authEmailRateLimited: 'Tegereza amasegonda 30 mbere yo kongera gusaba kode.',
        authEmailSetupPrompt: 'Serivisi ya email ntabwo yateguwe. Ushaka gushyiraho EmailJS nonaha?',
        authEmailPublicKeyPrompt: 'Andika EmailJS Public Key',
        authEmailServiceIdPrompt: 'Andika EmailJS Service ID',
        authEmailTemplateIdPrompt: 'Andika EmailJS Template ID',
        authEmailFromNamePrompt: 'Andika izina rizagaragara kuri email',
        authEmailConfigSaved: 'Igenamiterere rya email ryabitswe.',
        authEmailConfigIncomplete: 'Igenamiterere rya email ntiryuzuye.',
        authAccountCreated: 'Konti yakozwe neza. Ubu ushobora kwinjira.',
        authUserNotFound: 'Nta konti ifite iyi nimero ya telefone',
        authResetEmailMismatch: 'Imeyili ntabwo ihuye n\'iyi konti',
        authPinResetSuccess: 'PIN yahinduwe neza. Ubu ushobora kwinjira.',
        loggedInAs: 'Uwinjiye',
        todaySales: "Igurisha ry'uyu munsi",
        todayProfit: "Inyungu y'uyu munsi",
        customersOwing: 'Abakiriya bafite umwenda',
        pendingDeposits: 'Ingwate zitarasubizwa',
        availableDrinks: 'Ibinyobwa bihari',
        cartItems: "Ibyaguzwe",
        quickAdd: 'Ongeramo vuba',
        selectDrink: 'Hitamo ikinyobwa',
        quantity: 'Ingano',
        saleType: "Ubwoko bw'igurisha",
        selectCustomer: 'Hitamo umukiriya',
        confirmSale: 'Emeza igurisha',
        clearCart: 'Siba ibyaguzwe',
        normalSale: "Igurisha ry'amafaranga",
        creditSale: "Igurisha ry'umwenda",
        dailyTotal: "Igiteranyo cy'uyu munsi",
        addNewDrink: 'Kongeramo ikinyobwa gishya',
        drinkName: "Izina ry'ikinyobwa",
        drinkPricePlaceholder: 'Igiciro (RWF)',
        newDrinkProfitPerCase: 'Inyungu/Kaso (RWF)',
        newDrinkStockQty: 'Sitoki ya mbere (amasanduku)',
        newDrinkLowStockThreshold: 'Urwego rwo kuburira sitoki nkeya',
        saveDrink: 'Bika ikinyobwa',
        currentSale: 'Igurisha riri gukorwa',
        searchDrinks: 'Shakisha ibinyobwa...',
        noItemsYet: 'Nta kintu kirongerwamo',
        chooseDrink: 'Hitamo ikinyobwa...',
        enterQuantity: 'Andika ingano',
        addToCart: 'Ongeramo mu byaguzwe',
        totalAmount: 'Amafaranga yose',
        remove: 'Kuramo',
        all: 'Byose',
        owing: 'Bafite umwenda',
        cleared: 'Bishyuwe',
        addCustomer: 'Kongeramo umukiriya',
        exportDebtSummary: "Ohereza raporo y'imyenda",
        searchCustomers: 'Shakisha umukiriya ukoresheje izina, telefone cyangwa ibisobanuro...',
        addDeposit: 'Kongeramo ingwate',
        trackDeposits: "Kurikirana ingwate n'izasubijwe.",
        searchDeposits: "Shakisha ingwate ukoresheje izina ry'umukiriya, ibisobanuro cyangwa status...",
        pending: 'Bitegereje',
        returned: 'Byasubijwe',
        exportPdf: 'Ohereza PDF',
        searchSales: 'Shakisha igurisha ukoresheje ikinyobwa, umukiriya cyangwa itariki...',
        cash: 'Amafaranga',
        dateTime: 'Itariki n isaha',
        items: 'Ibintu',
        unitPrice: "Igiciro cy'ikintu",
        total: 'Igiteranyo',
        type: 'Ubwoko',
        actions: 'Ibikorwa',
        noSalesYet: 'Nta gurisha rirabikwa',
        daily: 'Buri munsi',
        weekly: 'Buri cyumweru',
        monthly: 'Buri kwezi',
        annual: 'Buri mwaka',
        fullReport: 'Raporo yuzuye',
        reportsHelp: 'Koresha raporo zihuse (umunsi/icyumweru/ukwezi/umwaka) cyangwa uhitemo itariki yihariye hepfo.',
        runTutorial: 'Tangiza inyigisho',
        tutorialSkipAll: 'Simbuka byose',
        tutorialBack: 'Subira inyuma',
        tutorialNext: 'Komeza',
        tutorialDone: 'Rarangije',
        tutorialStepLabel: 'Intambwe {current} kuri {total}',
        tutorial1Title: 'Murakaza neza kuri Make A Way',
        tutorial1Text: 'Iyi nyigisho irakwereka aho utangirira, uko ugurisha, n uko ubika amakuru y ubucuruzi.',
        tutorial2Title: 'Tangira ushyiramo ibinyobwa',
        tutorial2Text: 'Jya kuri Add Sale, wongeremo ibinyobwa n ibiciro byawe, ubibike. Konti nshya itangira nta kintu kirimo.',
        tutorial3Title: 'Andika amagurisha',
        tutorial3Text: 'Koresha Sale Items na Quick Add wandike amagurisha ya buri munsi. Umwenda ushobora kuwihuza n umukiriya.',
        tutorial4Title: 'Kurikirana abakiriya n ingwate',
        tutorial4Text: 'Koresha Customers gukurikirana imyenda na Clate/Deposit gukurikirana ingwate.',
        tutorial5Title: 'Raporo n itariki yihariye',
        tutorial5Text: 'Koresha Reports urebe umunsi/icyumweru/ukwezi/umwaka, cyangwa uhitemo itariki yihariye wohereze PDF.',
        tutorial6Title: 'Igenamiterere na backup',
        tutorial6Text: 'Hindura inyungu, ururimi n ifaranga muri Settings, kandi wohereze/winjize amakuru nk ububiko.',
        customRangeReport: 'Raporo y itariki yihariye',
        startDate: 'Itariki yo gutangira',
        endDate: 'Itariki yo kurangiza',
        fullMonth: 'Ukwezi kose',
        thisMonth: 'Uku kwezi',
        useSelectedMonth: 'Koresha ukwezi wahisemo',
        loadRangeReport: 'Fungura raporo y itariki',
        exportRangePdf: 'Ohereza PDF y itariki',
        rangeNote: 'Hitamo itariki yo hambere cyangwa iy uyu munsi gusa. Iy ejo ntibyemewe.',
        rangeValidation: 'Hitamo neza itariki yo gutangira n iyo kurangiza',
        rangeEndBeforeStart: 'Itariki yo kurangiza ntigomba kuba mbere yo gutangira',
        rangeFutureNotAllowed: 'Itariki yo mu gihe kizaza ntibyemewe',
        rangeNoSales: 'Nta gurisha ryabonetse muri iyi tariki wahisemo',
        rangeReportTitle: 'Raporo y itariki wahisemo',
        rangeSummary: 'Incamake y itariki',
        settingsPreferences: 'Igenamiterere',
        businessSettings: "Igenamiterere ry'ubucuruzi",
        interfaceSettings: 'Imigaragarire, ururimi n ifaranga',
        profitPercentage: 'Ijanisha ry inyungu (%)',
        profitModeLabel: "Uburyo bwo kubara inyungu",
        profitModePercentage: "Ijanisha ku giteranyo cy'igurisha",
        profitModePerCase: 'Inyungu kuri buri kinyobwa ku kaso',
        profitPerCaseLabel: 'Inyungu isanzwe kuri buri kaso (RWF)',
        drinkProfitManagerTitle: 'Inyungu kuri buri kinyobwa',
        saveDrinkProfits: 'Bika inyungu z ibinyobwa',
        drinkProfitInfo: 'Hindura inyungu kuri buri kaso kuri buri kinyobwa.',
        noDrinksForProfitEditor: 'Nta kinyobwa kirimo. Banza wongere ibinyobwa muri Add Sale.',
        drinkProfitSaved: "Inyungu z'ibinyobwa zabitswe",
        save: 'Bika',
        profitInfo: "Bikoreshwa kubara inyungu muri raporo na dashboard",
        profitSaved: "Igenamiterere ry'inyungu ryabitswe",
        profitPercentRangeError: "Ijanisha ry'inyungu rigomba kuba hagati ya 0 na 100",
        profitPerCaseError: "Inyungu kuri buri kaso ntishobora kuba munsi ya zero",
        profitLabelPerCase: 'Inyungu (RWF {amount} kuri buri kaso)',
        profitLabelPerDrinkCase: 'Inyungu (igipimo cya buri kinyobwa)',
        profitLabelPercentage: 'Inyungu ({value}%)',
        appearance: 'Imigaragarire',
        themeMode: 'Uburyo bw isura',
        lightMode: 'Isura y umucyo',
        darkMode: 'Isura y umwijima',
        language: 'Ururimi',
        selectLanguage: 'Hitamo ururimi',
        languageInfo: 'Ururimi ruzakoreshwa muri porogaramu',
        currency: 'Ifaranga',
        currencySymbol: 'Ikimenyetso cy ifaranga',
        currencyInfo: 'Ikimenyetso gisanzwe cy ifaranga (urugero: RWF, $, EUR)',
        saveLanguageCurrency: 'Bika ururimi n ifaranga',
        dataManagement: 'Gucunga amakuru',
        exportData: 'Ohereza amakuru (JSON)',
        importData: 'Injiza amakuru',
        clearAllData: 'Siba amakuru y uwinjiye',
        warningClearData: 'Iburira: bisiba gusa amakuru y uwinjiye ubu.',
        clearDataConfirmTitle: 'Siba amakuru y uwinjiye',
        clearDataConfirmLabel: 'Inyandiko yo kwemeza',
        clearDataConfirmInstruction: 'Andika CLEAR USER DATA (inyuguti nkuru zose) kugira ngo wemeze.',
        clearDataConfirmPlaceholder: 'Andika CLEAR USER DATA',
        clearDataConfirmAction: 'Siba amakuru',
        clearDataConfirmMismatch: 'Inyandiko ntiyahuye. Andika CLEAR USER DATA neza.',
        clearDataConfirmCancelled: 'Gusiba amakuru byahagaritswe.',
        clearDataConfirmSuccess: 'Amakuru y uwinjiye yasibwe.',
        clearDataRequiresAdminLogin: 'Kwinjira nka admin ni ngombwa kugira ngo usibe amakuru y uwinjiye.',
        storageLabel: 'Ububiko:',
        activeAccountLabel: 'Konti iri gukoresha:',
        notLoggedIn: 'Nta winjiye',
        appInformation: 'Amakuru ya porogaramu',
        appName: 'Izina rya porogaramu:',
        version: 'Verisiyo:',
        purpose: 'Intego:',
        appPurposeValue: "Gukurikirana ubucuruzi no gucunga ibyagurishijwe",
        rightsReserved: '2026 Make A Way. Uburenganzira bwose bwihariwe.',
        footerText: 'MAKE A WAY - Sisitemu yo gukurikirana ubucuruzi'
    },
    fr: {
        home: 'Accueil',
addSale: 'Ajouter une vente',
stockManagement: 'Gestion du stock',
customers: 'Clients',
clate: 'Caution/Dépôt',
salesHistory: "Historique des ventes",
reports: 'Rapports',
settings: 'Paramètres',
login: 'Connexion',
admin: 'Admin',
adminLogin: 'Connexion Admin',
adminPanel: 'Panneau Admin',
adminPanelTitle: 'Panneau d’administration',
adminPanelDescription: 'Rechercher des employés, modifier les rôles des comptes et gérer les autorisations d’accès à l’application.',
signUp: 'S’inscrire',
fullName: 'Nom complet',
phoneOrEmail: 'Téléphone',
emailAddress: 'Adresse email',
phoneNumber: 'Numéro de téléphone',
pinLabel: 'PIN à 5 chiffres',
confirmPin: 'Confirmer le PIN',
accountType: 'Type de compte',
signupRoleStaff: 'Compte employe',
signupRoleAdmin: 'Compte admin',
adminPinLabel: 'PIN admin (5 chiffres)',
confirmAdminPin: 'Confirmer le PIN admin',
createAccount: 'Créer un compte',
continueWithGoogle: 'Continuer avec Google',
googleEmailPrompt: 'Entrez l’email Google',
googleClientIdPrompt: 'Entrez le Google OAuth Client ID',
googleClientIdLooksWrong: 'Cela ne ressemble pas à un Google Web Client ID. Il doit se terminer par .apps.googleusercontent.com',
googleInvalidClient: 'Google a rejeté le client ID (invalid_client). Utilisez un Google OAuth Web Client ID valide et ajoutez cette URL dans les redirect URIs autorisées.',
googleLoginFailed: 'La connexion avec Google a échoué. Veuillez réessayer.',
googleServiceUnavailable: 'Le service de connexion Google est actuellement indisponible.',
verificationCode: 'Code de vérification',
sendCode: 'Envoyer le code',
forgotPin: 'PIN oublié ?',
resetPin: 'Réinitialiser le PIN',
resetPinHint: 'Utilisez votre numéro de téléphone pour définir un nouveau PIN.',
resetNewPin: 'Nouveau PIN à 5 chiffres',
resetConfirmPin: 'Confirmer le nouveau PIN',
cancel: 'Annuler',
authHintLogin: 'Utilisez votre compte existant pour continuer.',
authHintAdmin: 'L’admin utilise votre numéro de téléphone avec un PIN admin différent.',
authHintSignup: 'Créez d’abord un compte pour sécuriser l’application.',
authHintReset: 'Réinitialisez le PIN avec votre numéro de téléphone enregistré.',
authInvalidCredentials: 'Numéro de téléphone ou PIN incorrect',
authAccountInactive: 'Ce compte est inactif. Contactez le propriétaire de l’application.',
authAdminInvalidCredentials: 'Numéro de téléphone admin ou PIN admin incorrect',
authAdminAccessDenied: 'Ce compte n’a pas les droits administrateur',
authAdminSetupRequiresUserPin: 'Pour configurer le PIN admin, entrez d’abord votre PIN utilisateur.',
authAdminSetupPrompt: 'Définissez un nouveau PIN admin à 5 chiffres',
authAdminConfirmPrompt: 'Confirmez le PIN admin',
authAdminPinMustDiffer: 'Le PIN admin doit être différent du PIN utilisateur',
authAdminSetupCancelled: 'Configuration du PIN admin annulée.',
authAdminSetupSuccess: 'PIN admin configuré. Vous pouvez maintenant vous connecter en tant qu’admin.',
authTooManyAttempts: 'Trop de tentatives. Réessayez après 1 minute.',
authNameRequired: 'Entrez votre nom complet',
authPhoneRequired: 'Entrez un numéro de téléphone valide',
authEmailRequired: 'Entrez votre email',
authEmailInvalid: 'Entrez un email valide',
authPhoneExists: 'Ce numéro possède déjà un compte',
authEmailExists: 'Cet email possède déjà un compte',
authPinRules: 'Le PIN doit contenir 5 chiffres',
authPinMismatch: 'Les PIN ne correspondent pas',
authVerificationCodeRequired: 'Entrez le code de vérification',
authVerificationCodeInvalid: 'Code de vérification incorrect',
authVerificationCodeExpired: 'Code expiré. Demandez-en un nouveau.',
authVerificationSendFirst: 'Envoyez d’abord le code de vérification.',
authCodeSent: 'Le code de vérification a été envoyé à {email}.',
authCodeFallback: 'Le service email n’est pas configuré. Utilisez ce code maintenant : {code}',
authEmailServiceUnavailable: 'Le service email n’est pas configuré. Configurez les clés EmailJS dans index.html puis rechargez la page.',
authEmailSendFailed: 'Échec de l’envoi du code par email. Réessayez.',
authEmailRateLimited: 'Attendez 30 secondes avant de demander un nouveau code.',
authEmailSetupPrompt: 'Le service email n’est pas configuré. Voulez-vous configurer EmailJS maintenant ?',
authEmailPublicKeyPrompt: 'Entrez la clé publique EmailJS',
authEmailServiceIdPrompt: 'Entrez le Service ID EmailJS',
authEmailTemplateIdPrompt: 'Entrez le Template ID EmailJS',
authEmailFromNamePrompt: 'Entrez le nom affiché dans l’email',
authEmailConfigSaved: 'Configuration email enregistrée.',
authEmailConfigIncomplete: 'Configuration email incomplète.',
authAccountCreated: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
authUserNotFound: 'Aucun compte trouvé avec ce numéro',
authResetEmailMismatch: 'L’email ne correspond pas à ce compte',
authPinResetSuccess: 'PIN réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
loggedInAs: 'Connecté en tant que',
todaySales: "Ventes d’aujourd’hui",
todayProfit: "Bénéfice d’aujourd’hui",
customersOwing: 'Clients débiteurs',
pendingDeposits: 'Dépôts en attente',
availableDrinks: 'Boissons disponibles',
cartItems: 'Articles dans le panier',
quickAdd: 'Ajout rapide',
selectDrink: 'Sélectionner une boisson',
quantity: 'Quantité',
saleType: 'Type de vente',
selectCustomer: 'Sélectionner un client',
confirmSale: 'Confirmer la vente',
clearCart: 'Vider le panier',
normalSale: 'Vente au comptant',
creditSale: 'Vente à crédit',
dailyTotal: "Total du jour",
addNewDrink: 'Ajouter une nouvelle boisson',
drinkName: 'Nom de la boisson',
drinkPricePlaceholder: 'Prix (RWF)',
newDrinkProfitPerCase: 'Bénéfice/Caisse (RWF)',
newDrinkStockQty: 'Stock initial (caisses)',
newDrinkLowStockThreshold: 'Seuil d’alerte de stock faible',
saveDrink: 'Enregistrer la boisson',
currentSale: 'Vente en cours',
searchDrinks: 'Rechercher des boissons...',
noItemsYet: 'Aucun article ajouté',
chooseDrink: 'Choisir une boisson...',
enterQuantity: 'Entrer la quantité',
addToCart: 'Ajouter au panier',
totalAmount: 'Montant total',
remove: 'Supprimer',
all: 'Tous',
owing: 'Débiteurs',
cleared: 'Payés',
addCustomer: 'Ajouter un client',
exportDebtSummary: 'Exporter le rapport des dettes',
searchCustomers: 'Rechercher un client par nom, téléphone ou description...',
addDeposit: 'Ajouter un dépôt',
trackDeposits: 'Suivre les dépôts et retours.',
searchDeposits: 'Rechercher un dépôt par client, description ou statut...',
pending: 'En attente',
returned: 'Retourné',
exportPdf: 'Exporter en PDF',
searchSales: 'Rechercher une vente par boisson, client ou date...',
cash: 'Espèces',
dateTime: 'Date et heure',
items: 'Articles',
unitPrice: 'Prix unitaire',
total: 'Total',
type: 'Type',
actions: 'Actions',
noSalesYet: 'Aucune vente enregistrée',
daily: 'Quotidien',
weekly: 'Hebdomadaire',
monthly: 'Mensuel',
annual: 'Annuel',
fullReport: 'Rapport complet',
reportsHelp: 'Utilisez les rapports rapides (jour/semaine/mois/année) ou sélectionnez une période personnalisée.',
runTutorial: 'Lancer le tutoriel',
tutorialSkipAll: 'Tout passer',
tutorialBack: 'Retour',
tutorialNext: 'Suivant',
tutorialDone: 'Terminé',
tutorialStepLabel: 'Étape {current} sur {total}',
tutorial1Title: 'Bienvenue sur Make A Way',
tutorial1Text: 'Ce tutoriel vous montre comment démarrer, enregistrer les ventes et gérer votre activité.',
tutorial2Title: 'Ajoutez d’abord des boissons',
tutorial2Text: 'Allez dans Ajouter une vente, ajoutez vos boissons et prix puis enregistrez-les.',
tutorial3Title: 'Enregistrez les ventes',
tutorial3Text: 'Utilisez Sale Items et Quick Add pour enregistrer les ventes quotidiennes.',
tutorial4Title: 'Gérez clients et dépôts',
tutorial4Text: 'Utilisez Clients pour suivre les dettes et Dépôt pour suivre les cautions.',
tutorial5Title: 'Rapports personnalisés',
tutorial5Text: 'Utilisez Rapports pour voir jour/semaine/mois/année ou exporter un PDF.',
tutorial6Title: 'Paramètres et sauvegarde',
tutorial6Text: 'Modifiez bénéfice, langue et devise dans Paramètres.',
rightsReserved: '2026 Make A Way. Tous droits réservés.',
footerText: 'MAKE A WAY - Système de gestion commerciale'
    }
};

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

// Default drinks for first-time setup
const defaultDrinks = [];

// Form state management
let currentCustomerIndex = null;
let debtAction = ''; // 'add', 'reduce', or 'clear'

// ================= PERFORMANCE OPTIMIZATIONS =================
let saveTimeout = null;
let searchTimeout = null;
let autoSaveInterval = null;
let isSaving = false;
let pendingUiConfirmResolver = null;

// Debounce function for better performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimized DOM clearing
function clearElement(element) {
    if (!element) return;
    element.innerHTML = '';
}

// Global escape helper (used by UI renderers)
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'maw-success-toast';
    toast.innerHTML = `<span class="tick">&#10004;</span><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 220);
    }, 2300);
}

function closeUiConfirm(result = false) {
    const overlay = document.getElementById('uiConfirmOverlay');
    if (overlay) overlay.style.display = 'none';
    const resolver = pendingUiConfirmResolver;
    pendingUiConfirmResolver = null;
    if (typeof resolver === 'function') {
        resolver(Boolean(result));
    }
}

function ensureUiConfirmBindings() {
    const overlay = document.getElementById('uiConfirmOverlay');
    const cancelBtn = document.getElementById('uiConfirmCancelBtn');
    const okBtn = document.getElementById('uiConfirmOkBtn');
    if (!overlay || !cancelBtn || !okBtn) return false;

    if (!overlay.dataset.bound) {
        cancelBtn.addEventListener('click', () => closeUiConfirm(false));
        okBtn.addEventListener('click', () => closeUiConfirm(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeUiConfirm(false);
        });
        overlay.dataset.bound = '1';
    }

    return true;
}

function showUiConfirm(options = {}) {
    const {
        title = 'Confirm Action',
        message = 'Are you sure you want to continue?',
        confirmText = 'Confirm',
        cancelText = 'Cancel'
    } = options;

    const overlay = document.getElementById('uiConfirmOverlay');
    const titleEl = document.getElementById('uiConfirmTitle');
    const messageEl = document.getElementById('uiConfirmMessage');
    const cancelBtn = document.getElementById('uiConfirmCancelBtn');
    const okBtn = document.getElementById('uiConfirmOkBtn');

    if (!overlay || !titleEl || !messageEl || !cancelBtn || !okBtn || !ensureUiConfirmBindings()) {
        return Promise.resolve(window.confirm(String(message)));
    }

    titleEl.textContent = String(title);
    messageEl.textContent = String(message);
    cancelBtn.textContent = String(cancelText);
    okBtn.textContent = String(confirmText);

    overlay.style.display = 'block';
    return new Promise((resolve) => {
        pendingUiConfirmResolver = resolve;
    });
}

// Optimized save function with batching
async function optimizedSaveData() {
    if (isSaving) return;
    
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    return new Promise((resolve) => {
        saveTimeout = setTimeout(async () => {
            isSaving = true;
            try {
                await saveData();
            } catch (error) {
                console.error('Save error:', error);
            } finally {
                isSaving = false;
                saveTimeout = null;
                resolve();
            }
        }, 500);
    });
}

// ================= ELECTRON + WEB STORAGE =================
const APP_META_STORAGE_KEY = 'app_meta';

function getDefaultAppMeta() {
    return {
        authUsers: [],
        lastLoginPhone: '',
        activeSessionUserId: '',
        activeSessionLoginMode: '',
        legacyDataMigrated: false
    };
}

function getDefaultUserSettings() {
    return {
        profitPercentage: 30,
        profitMode: 'percentage',
        theme: 'light',
        language: 'en',
        currency: 'RWF',
        onboardingDone: true,
        lastOpenPage: 'home'
    };
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeUserSettings(raw) {
    const next = isPlainObject(raw) ? { ...raw } : {};
    delete next.authUsers;
    delete next.lastLoginPhone;
    delete next.activeSessionUserId;
    delete next.activeSessionLoginMode;
    delete next.legacyMigratedUsers;
    delete next.legacyDataMigrated;
    delete next.profitPerCase;
    return { ...getDefaultUserSettings(), ...next };
}

function sanitizeYearArchives(raw) {
    if (!Array.isArray(raw)) return [];

    const normalized = raw
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
            const year = Number(entry.year);
            if (!Number.isFinite(year)) return null;
            const archivedAtDate = new Date(entry.archivedAt || entry.createdAt || Date.now());
            const archivedAt = Number.isNaN(archivedAtDate.getTime())
                ? new Date().toISOString()
                : archivedAtDate.toISOString();
            const salesItems = Array.isArray(entry.sales) ? entry.sales : [];
            const clatesItems = Array.isArray(entry.clates) ? entry.clates : [];
            const summary = entry.summary && typeof entry.summary === 'object'
                ? {
                    salesCount: Number(entry.summary.salesCount) || salesItems.length,
                    clatesCount: Number(entry.summary.clatesCount) || clatesItems.length,
                    salesTotal: Number(entry.summary.salesTotal) || salesItems.reduce((sum, sale) => sum + (Number(sale?.total) || 0), 0)
                }
                : {
                    salesCount: salesItems.length,
                    clatesCount: clatesItems.length,
                    salesTotal: salesItems.reduce((sum, sale) => sum + (Number(sale?.total) || 0), 0)
                };

            return {
                year: Math.trunc(year),
                archivedAt,
                sales: salesItems,
                clates: clatesItems,
                summary
            };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.year) - Number(a.year));

    return normalized;
}

function getDefaultDrinkProfitPerCase() {
    return 700;
}

function getDefaultLowStockThreshold() {
    return 5;
}

function normalizeStockValue(value, fallback = 0) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0) return Math.max(0, Math.floor(Number(fallback) || 0));
    return parsed;
}

function sanitizeStockHistoryEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const action = String(raw.action || '').toLowerCase();
    if (action !== 'add' && action !== 'remove') return null;

    const quantity = normalizeStockValue(raw.quantity ?? raw.qty, 0);
    if (quantity <= 0) return null;
    const beforeQty = normalizeStockValue(raw.beforeQty ?? raw.before, 0);
    const afterQty = normalizeStockValue(raw.afterQty ?? raw.after, 0);
    const parsedTimestamp = new Date(raw.timestamp || raw.createdAt || Date.now());
    const timestamp = Number.isNaN(parsedTimestamp.getTime())
        ? new Date().toISOString()
        : parsedTimestamp.toISOString();
    const reason = String(raw.reason || raw.note || '').trim().slice(0, 160);

    return {
        timestamp,
        action,
        quantity,
        beforeQty,
        afterQty,
        reason
    };
}

function normalizeStockHistoryEntries(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];
    return rawHistory
        .map((entry) => sanitizeStockHistoryEntry(entry))
        .filter(Boolean)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getDrinkStockHistory(drink) {
    if (!drink || typeof drink !== 'object') return [];
    if (!Array.isArray(drink.stockHistory)) return [];
    return normalizeStockHistoryEntries(drink.stockHistory);
}

function recordDrinkStockEvent(drink, eventPayload = {}) {
    if (!drink || typeof drink !== 'object') return;
    const event = sanitizeStockHistoryEntry({
        timestamp: new Date().toISOString(),
        action: eventPayload.action,
        quantity: eventPayload.quantity,
        beforeQty: eventPayload.beforeQty,
        afterQty: eventPayload.afterQty,
        reason: eventPayload.reason
    });
    if (!event) return;

    const nextHistory = getDrinkStockHistory(drink);
    nextHistory.unshift(event);
    drink.stockHistory = nextHistory.slice(0, 600);
}

function sanitizeDrinkEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;
    const parsedPrice = Number(raw.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return null;
    const parsedProfitPerCase = Number(raw.profitPerCase);
    const hasLegacyStockValue =
        Object.prototype.hasOwnProperty.call(raw, 'stockQty') ||
        Object.prototype.hasOwnProperty.call(raw, 'stock') ||
        Object.prototype.hasOwnProperty.call(raw, 'quantityOnHand');
    const parsedStockQty = normalizeStockValue(
        raw.stockQty ?? raw.stock ?? raw.quantityOnHand,
        hasLegacyStockValue ? 0 : 30
    );
    const parsedLowStockThreshold = normalizeStockValue(
        raw.lowStockThreshold ?? raw.lowStockLimit ?? raw.reorderLevel,
        getDefaultLowStockThreshold()
    );
    return {
        name,
        price: parsedPrice,
        profitPerCase: (Number.isFinite(parsedProfitPerCase) && parsedProfitPerCase >= 0)
            ? parsedProfitPerCase
            : getDefaultDrinkProfitPerCase(),
        stockQty: parsedStockQty,
        lowStockThreshold: parsedLowStockThreshold,
        lastStockUpdatedAt: typeof raw.lastStockUpdatedAt === 'string' ? raw.lastStockUpdatedAt : '',
        stockHistory: normalizeStockHistoryEntries(raw.stockHistory || raw.stockMovements || raw.stockLogs)
    };
}

function normalizeDrinksData() {
    if (!Array.isArray(drinks)) {
        drinks = [];
        return;
    }
    drinks = drinks
        .map((drink) => sanitizeDrinkEntry(drink))
        .filter(Boolean);
}

function getDrinkProfitPerCaseByName(drinkName) {
    const target = String(drinkName || '').toLowerCase().trim();
    const match = drinks.find((drink) => String(drink.name || '').toLowerCase() === target);
    if (match && Number.isFinite(Number(match.profitPerCase))) {
        return Math.max(0, Number(match.profitPerCase));
    }
    return getDefaultDrinkProfitPerCase();
}

function getDrinkByName(drinkName) {
    const target = String(drinkName || '').toLowerCase().trim();
    if (!target) return null;
    return drinks.find((drink) => String(drink.name || '').toLowerCase().trim() === target) || null;
}

function getDrinkStockQty(drink) {
    if (!drink || typeof drink !== 'object') return 0;
    return normalizeStockValue(drink.stockQty, 0);
}

function getDrinkLowStockThreshold(drink) {
    if (!drink || typeof drink !== 'object') return getDefaultLowStockThreshold();
    return normalizeStockValue(drink.lowStockThreshold, getDefaultLowStockThreshold());
}

function getDrinkStockStatus(drink) {
    const stockQty = getDrinkStockQty(drink);
    if (stockQty <= 0) return 'out';
    if (stockQty <= getDrinkLowStockThreshold(drink)) return 'low';
    return 'ok';
}

function getLowStockDrinks() {
    return drinks.filter((drink) => getDrinkStockStatus(drink) !== 'ok');
}

function getStockStatusLabel(status) {
    if (status === 'out') return 'Out of Stock';
    if (status === 'low') return 'Low Stock';
    return 'Healthy';
}

function getUserStorageId(user = activeUser) {
    if (!user) return '';
    const normalized = normalizePhone(user.phone);
    if (normalized) return normalized;
    return String(user.id || '');
}

function userDataKey(base, user = activeUser) {
    const id = getUserStorageId(user);
    return id ? `${base}__${id}` : '';
}

function localStorageKey(name) {
    return `makeaway_${name}`;
}

async function readIndexedDbKey(name) {
    try {
        const db = await openAppDB();
        return await new Promise((resolve) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(name);
            req.onsuccess = () => {
                db.close();
                resolve(req.result);
            };
            req.onerror = () => {
                db.close();
                resolve(null);
            };
        });
    } catch (_) {
        return null;
    }
}

async function writeIndexedDbKey(name, value) {
    try {
        const db = await openAppDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(value, name);
            tx.oncomplete = () => {
                db.close();
                resolve(true);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
        return true;
    } catch (_) {
        return false;
    }
}

function readLocalStorageKey(name) {
    try {
        const raw = localStorage.getItem(localStorageKey(name));
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function writeLocalStorageKey(name, value) {
    try {
        localStorage.setItem(localStorageKey(name), JSON.stringify(value));
        return true;
    } catch (_) {
        return false;
    }
}

async function loadNamedData(name, defaultValue) {
    if (!name) return defaultValue;

    if (isElectron) {
        try {
            const result = await window.electronAPI.invoke('load-data', name);
            if (result && result.success) return result.data;
        } catch (_) {}
    }

    const fromDb = await readIndexedDbKey(name);
    if (fromDb !== null && fromDb !== undefined) return fromDb;

    const fromLs = readLocalStorageKey(name);
    if (fromLs !== null && fromLs !== undefined) return fromLs;

    return defaultValue;
}

async function saveNamedData(name, value) {
    if (!name) return false;

    if (isElectron) {
        try {
            const result = await window.electronAPI.invoke('save-data', name, value);
            if (result && result.success) {
                return true;
            }
        } catch (_) {}
    }

    const dbSaved = await writeIndexedDbKey(name, value);
    const lsSaved = writeLocalStorageKey(name, value);
    return dbSaved || lsSaved;
}

async function loadManyNamedData(requests) {
    const validRequests = Array.isArray(requests)
        ? requests.filter((item) => item && item.name)
        : [];
    if (validRequests.length === 0) return {};

    if (isElectron) {
        try {
            const names = validRequests.map((item) => item.name);
            const result = await window.electronAPI.invoke('load-bulk-data', names);
            if (result && result.success && result.data && typeof result.data === 'object') {
                const output = {};
                validRequests.forEach(({ name, defaultValue }) => {
                    const hasKey = Object.prototype.hasOwnProperty.call(result.data, name);
                    const value = hasKey ? result.data[name] : defaultValue;
                    output[name] = value === undefined || value === null ? defaultValue : value;
                });
                return output;
            }
        } catch (_) {}
    }

    const fallback = {};
    await Promise.all(validRequests.map(async ({ name, defaultValue }) => {
        fallback[name] = await loadNamedData(name, defaultValue);
    }));
    return fallback;
}

async function saveManyNamedData(entries) {
    const validEntries = Array.isArray(entries)
        ? entries.filter((item) => item && item.name)
        : [];
    if (validEntries.length === 0) return false;

    if (isElectron) {
        try {
            const payload = {};
            validEntries.forEach(({ name, value }) => {
                payload[name] = value;
            });
            const result = await window.electronAPI.invoke('save-bulk-data', payload);
            if (result && result.success) return true;
        } catch (_) {}
    }

    const results = await Promise.all(validEntries.map(({ name, value }) => saveNamedData(name, value)));
    return results.some(Boolean);
}

async function initializeUserStorage(user = activeUser) {
    const salesKey = userDataKey('sales', user);
    const customersKey = userDataKey('customers', user);
    const clatesKey = userDataKey('clates', user);
    const drinksKey = userDataKey('drinks', user);
    const settingsKey = userDataKey('settings', user);
    const archivesKey = userDataKey('archives', user);
    if (!salesKey || !customersKey || !clatesKey || !drinksKey || !settingsKey || !archivesKey) return;

    await saveManyNamedData([
        { name: salesKey, value: [] },
        { name: customersKey, value: [] },
        { name: clatesKey, value: [] },
        { name: drinksKey, value: [] },
        { name: settingsKey, value: getDefaultUserSettings() },
        { name: archivesKey, value: [] }
    ]);
}

async function migrateLegacyDataIfNeeded() {
    if (appMeta.legacyDataMigrated) return;

    if (Array.isArray(appMeta.authUsers) && appMeta.authUsers.length > 1) {
        appMeta.legacyDataMigrated = true;
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
        return;
    }

    const hasScopedData = sales.length > 0 || customers.length > 0 || clates.length > 0 || drinks.length > 0;
    if (hasScopedData) {
        appMeta.legacyDataMigrated = true;
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
        return;
    }

    const legacySales = await loadNamedData('sales', []);
    const legacyCustomers = await loadNamedData('customers', []);
    const legacyClates = await loadNamedData('clates', []);
    const legacyDrinks = await loadNamedData('drinks', []);
    const legacySettingsRaw = await loadNamedData('settings', {});
    const legacySettings = sanitizeUserSettings(legacySettingsRaw);

    const legacyHasData =
        (Array.isArray(legacySales) && legacySales.length > 0) ||
        (Array.isArray(legacyCustomers) && legacyCustomers.length > 0) ||
        (Array.isArray(legacyClates) && legacyClates.length > 0) ||
        (Array.isArray(legacyDrinks) && legacyDrinks.length > 0);

    if (legacyHasData) {
        sales = Array.isArray(legacySales) ? legacySales : [];
        customers = Array.isArray(legacyCustomers) ? legacyCustomers : [];
        clates = Array.isArray(legacyClates) ? legacyClates : [];
        drinks = Array.isArray(legacyDrinks) ? legacyDrinks : [];
        settings = legacySettings;
        await saveData();
    } else {
        settings = sanitizeUserSettings(settings);
    }

    appMeta.legacyDataMigrated = true;
    await saveNamedData(APP_META_STORAGE_KEY, appMeta);
}

async function loadActiveUserData(user = activeUser) {
    const salesKey = userDataKey('sales', user);
    const customersKey = userDataKey('customers', user);
    const clatesKey = userDataKey('clates', user);
    const drinksKey = userDataKey('drinks', user);
    const settingsKey = userDataKey('settings', user);
    const archivesKey = userDataKey('archives', user);

    if (!salesKey || !customersKey || !clatesKey || !drinksKey || !settingsKey || !archivesKey) {
        sales = [];
        customers = [];
        clates = [];
        drinks = [];
        settings = getDefaultUserSettings();
        yearlyArchives = [];
        return;
    }

    const loadedMap = await loadManyNamedData([
        { name: salesKey, defaultValue: [] },
        { name: customersKey, defaultValue: [] },
        { name: clatesKey, defaultValue: [] },
        { name: drinksKey, defaultValue: [] },
        { name: settingsKey, defaultValue: {} },
        { name: archivesKey, defaultValue: [] }
    ]);
    const loadedSales = loadedMap[salesKey];
    const loadedCustomers = loadedMap[customersKey];
    const loadedClates = loadedMap[clatesKey];
    const loadedDrinks = loadedMap[drinksKey];
    const loadedSettings = loadedMap[settingsKey];
    const loadedArchives = loadedMap[archivesKey];

    sales = Array.isArray(loadedSales) ? loadedSales : [];
    customers = Array.isArray(loadedCustomers) ? loadedCustomers : [];
    clates = Array.isArray(loadedClates) ? loadedClates : [];
    drinks = Array.isArray(loadedDrinks) ? loadedDrinks : [];
    settings = sanitizeUserSettings(loadedSettings);
    yearlyArchives = sanitizeYearArchives(loadedArchives);
    normalizeDrinksData();

    await migrateLegacyDataIfNeeded();
}

async function loadAllData() {
    const loadedMeta = await loadNamedData(APP_META_STORAGE_KEY, getDefaultAppMeta());
    appMeta = isPlainObject(loadedMeta) ? { ...getDefaultAppMeta(), ...loadedMeta } : getDefaultAppMeta();

    // One-time compatibility: pull auth users from old shared settings if present.
    const legacySettings = await loadNamedData('settings', {});
    let metaChanged = false;
    if ((!Array.isArray(appMeta.authUsers) || appMeta.authUsers.length === 0) && Array.isArray(legacySettings?.authUsers)) {
        appMeta.authUsers = legacySettings.authUsers;
        metaChanged = true;
    }
    if (!appMeta.lastLoginPhone && legacySettings?.lastLoginPhone) {
        appMeta.lastLoginPhone = legacySettings.lastLoginPhone;
        metaChanged = true;
    }
    if (typeof appMeta.legacyDataMigrated !== 'boolean') {
        appMeta.legacyDataMigrated = Array.isArray(appMeta.legacyMigratedUsers)
            ? appMeta.legacyMigratedUsers.length > 0
            : false;
        metaChanged = true;
    }
    if (metaChanged) await saveNamedData(APP_META_STORAGE_KEY, appMeta);

    // Login screen should not carry previous user's in-memory data.
    sales = [];
    customers = [];
    clates = [];
    drinks = [];
    settings = getDefaultUserSettings();
    yearlyArchives = [];
}

function buildCurrentSavePayload(user = activeUser) {
    const payload = {
        [APP_META_STORAGE_KEY]: appMeta
    };

    if (!user) return payload;
    normalizeDrinksData();

    const salesKey = userDataKey('sales', user);
    const customersKey = userDataKey('customers', user);
    const clatesKey = userDataKey('clates', user);
    const drinksKey = userDataKey('drinks', user);
    const settingsKey = userDataKey('settings', user);
    const archivesKey = userDataKey('archives', user);
    if (!salesKey || !customersKey || !clatesKey || !drinksKey || !settingsKey || !archivesKey) return payload;

    payload[salesKey] = Array.isArray(sales) ? sales : [];
    payload[customersKey] = Array.isArray(customers) ? customers : [];
    payload[clatesKey] = Array.isArray(clates) ? clates : [];
    payload[drinksKey] = Array.isArray(drinks) ? drinks : [];
    payload[settingsKey] = sanitizeUserSettings(settings);
    payload[archivesKey] = sanitizeYearArchives(yearlyArchives);
    return payload;
}

function flushDataSyncOnExit(user = activeUser) {
    if (!isElectron || !window.electronAPI || typeof window.electronAPI.saveAllSync !== 'function') return;
    try {
        const payload = buildCurrentSavePayload(user);
        window.electronAPI.saveAllSync(payload);
        if (typeof window.electronAPI.invoke === 'function') {
            window.electronAPI.invoke('flush-data').catch(() => {});
        }
    } catch (error) {
        console.warn('Sync save on exit failed:', error);
    }
}

// Save current context
async function saveData() {
    const payload = buildCurrentSavePayload(activeUser);
    const entries = Object.entries(payload).map(([name, value]) => ({ name, value }));
    await saveManyNamedData(entries);
}

// ================= LOGIN / SIGNUP SYSTEM =================
let authMode = 'login';
let activeUser = null;
let activeLoginMode = 'user';
let failedLoginAttempts = 0;
let loginLockedUntil = 0;
let onboardingStepIndex = 0;
let onboardingVisible = false;
let pendingOnboardingStart = false;
let forgotPinVisible = false;

function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function findUserByLoginIdentifier(identifierValue, users = getAuthUsers()) {
    const raw = String(identifierValue || '').trim();
    if (!raw) return null;
    const phone = normalizePhone(raw);
    if (!phone) return null;
    return users.find((u) => normalizePhone(u.phone) === phone) || null;
}

function isAdminRoleUser(user) {
    const role = String(user?.role || '').trim().toLowerCase();
    return role === 'owner' || role === 'admin';
}

function isOwnerRoleUser(user) {
    return String(user?.role || '').trim().toLowerCase() === 'owner';
}

function normalizeAuthRole(roleValue, fallback = 'staff') {
    const normalized = String(roleValue || '').trim().toLowerCase();
    if (normalized === 'owner' || normalized === 'admin' || normalized === 'staff') return normalized;
    return fallback;
}

function isUserAccountActive(user) {
    return Boolean(user) && user.isActive !== false;
}

function isAdminSessionActive(user = activeUser) {
    return activeLoginMode === 'admin' && isAdminRoleUser(user) && isUserAccountActive(user);
}

function canAccessAdminPanel(user = activeUser) {
    return isAdminSessionActive(user);
}

function canViewProfitData(user = activeUser) {
    return canAccessAdminPanel(user);
}

function canManageAdminAccounts(user = activeUser) {
    return isAdminSessionActive(user) && isOwnerRoleUser(user);
}

function formatAppDateTime(value, fallback = 'Never') {
    if (!value) return fallback;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return fallback;
    return dt.toLocaleString();
}

function registerFailedLoginAttempt(messageKey = 'authInvalidCredentials') {
    failedLoginAttempts += 1;
    if (failedLoginAttempts >= 5) {
        failedLoginAttempts = 0;
        loginLockedUntil = Date.now() + 60 * 1000;
        alert(t('authTooManyAttempts'));
        return;
    }
    alert(t(messageKey));
}

async function setupAdminPinForUser(user, currentUserPin) {
    if (!user || !isAdminRoleUser(user)) {
        return { success: false, cancelled: false, message: t('authAdminAccessDenied') };
    }
    if (!/^\d{5}$/.test(String(currentUserPin || '').trim()) || String(user.pin || '').trim() !== String(currentUserPin || '').trim()) {
        return { success: false, cancelled: false, message: t('authAdminSetupRequiresUserPin') };
    }

    const adminPinRaw = window.prompt(t('authAdminSetupPrompt'), '');
    if (adminPinRaw === null) {
        return { success: false, cancelled: true, message: t('authAdminSetupCancelled') };
    }
    const adminPin = String(adminPinRaw || '').trim();
    if (!/^\d{5}$/.test(adminPin)) {
        return { success: false, cancelled: false, message: t('authPinRules') };
    }
    if (adminPin === String(user.pin || '').trim()) {
        return { success: false, cancelled: false, message: t('authAdminPinMustDiffer') };
    }

    const confirmRaw = window.prompt(t('authAdminConfirmPrompt'), '');
    if (confirmRaw === null) {
        return { success: false, cancelled: true, message: t('authAdminSetupCancelled') };
    }
    const confirmAdminPin = String(confirmRaw || '').trim();
    if (confirmAdminPin !== adminPin) {
        return { success: false, cancelled: false, message: t('authPinMismatch') };
    }

    user.adminPin = adminPin;
    user.updatedAt = new Date().toISOString();
    appMeta.authUsers = getAuthUsers();
    await optimizedSaveData();
    showSuccessToast(t('authAdminSetupSuccess'));
    return { success: true, cancelled: false, message: '' };
}

async function handleAdminLogin(identifier, pin, users = getAuthUsers()) {
    const user = findUserByLoginIdentifier(identifier, users);
    if (!user) {
        registerFailedLoginAttempt('authAdminInvalidCredentials');
        return;
    }
    if (!isUserAccountActive(user)) {
        alert(t('authAccountInactive'));
        return;
    }
    if (!isAdminRoleUser(user)) {
        alert(t('authAdminAccessDenied'));
        return;
    }

    let adminPin = String(user.adminPin || '').trim();
    if (!/^\d{5}$/.test(adminPin)) {
        const setupResult = await setupAdminPinForUser(user, pin);
        if (!setupResult.success) {
            if (!setupResult.cancelled) {
                alert(setupResult.message || t('authAdminInvalidCredentials'));
            }
            return;
        }
        adminPin = String(user.adminPin || '').trim();
    }

    if (adminPin !== pin) {
        registerFailedLoginAttempt('authAdminInvalidCredentials');
        return;
    }

    await completeLoginForUser(user, { loginMode: 'admin' });
}

async function completeLoginForUser(user, options = {}) {
    failedLoginAttempts = 0;
    loginLockedUntil = 0;
    user.role = normalizeAuthRole(user.role, 'staff');
    user.isActive = user.isActive !== false;
    user.lastLoginAt = new Date().toISOString();
    const requestedMode = String(options?.loginMode || '').trim().toLowerCase();
    activeLoginMode = (requestedMode === 'admin' && isAdminRoleUser(user)) ? 'admin' : 'user';
    activeUser = user;
    appMeta.lastLoginPhone = user.phone || '';
    appMeta.activeSessionUserId = getAuthSessionUserId(user);
    appMeta.activeSessionLoginMode = activeLoginMode;
    await loadActiveUserData(user);
    pendingOnboardingStart = false;
    await optimizedSaveData();
    updateActiveUserBadge();
    refreshAdminAccessUI();
    refreshDataManagementAccessUI();
    const startPage = String(options?.startPage || '').trim() || 'home';
    showWelcomeAnimation(startPage);
}

function normalizeAuthUsersData() {
    if (!appMeta || typeof appMeta !== 'object') appMeta = getDefaultAppMeta();
    if (!Array.isArray(appMeta.authUsers)) appMeta.authUsers = [];

    appMeta.authUsers = appMeta.authUsers
        .filter((user) => user && typeof user === 'object')
        .map((user, index) => {
            const fallbackRole = index === 0 ? 'owner' : 'staff';
            const normalizedRole = normalizeAuthRole(user.role, fallbackRole);
            return {
                ...user,
                role: normalizedRole,
                isActive: user.isActive !== false
            };
        });
}

function resetForgotPinFields() {
    const resetPhoneInput = document.getElementById('resetPhone');
    const resetNewPinInput = document.getElementById('resetNewPin');
    const resetConfirmPinInput = document.getElementById('resetConfirmPin');
    if (resetPhoneInput) resetPhoneInput.value = '';
    if (resetNewPinInput) resetNewPinInput.value = '';
    if (resetConfirmPinInput) resetConfirmPinInput.value = '';
}

function getAuthUsers() {
    normalizeAuthUsersData();
    return appMeta.authUsers;
}

function getAuthSessionUserId(user) {
    if (!user || typeof user !== 'object') return '';
    const scopedId = String(getUserStorageId(user) || '').trim();
    if (scopedId) return scopedId;
    const fallbackId = String(user.id || '').trim();
    if (fallbackId) return fallbackId;
    return normalizePhone(user.phone || '');
}

async function restoreActiveSessionFromMeta() {
    const sessionUserId = String(appMeta?.activeSessionUserId || '').trim();
    if (!sessionUserId) return false;

    const users = getAuthUsers();
    const user = users.find((candidate) => getAuthSessionUserId(candidate) === sessionUserId);
    if (!user) {
        appMeta.activeSessionUserId = '';
        appMeta.activeSessionLoginMode = '';
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
        return false;
    }
    if (!isUserAccountActive(user)) {
        appMeta.activeSessionUserId = '';
        appMeta.activeSessionLoginMode = '';
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
        return false;
    }

    const savedLoginMode = String(appMeta?.activeSessionLoginMode || '').trim().toLowerCase();
    activeLoginMode = (savedLoginMode === 'admin' && isAdminRoleUser(user)) ? 'admin' : 'user';
    activeUser = user;
    failedLoginAttempts = 0;
    loginLockedUntil = 0;
    pendingOnboardingStart = false;
    appMeta.lastLoginPhone = user.phone || appMeta.lastLoginPhone || '';
    appMeta.activeSessionLoginMode = activeLoginMode;

    await loadActiveUserData(user);
    updateActiveUserBadge();
    refreshAdminAccessUI();
    refreshDataManagementAccessUI();

    const loginScreen = document.getElementById('loginScreen');
    const app = document.getElementById('app');
    if (loginScreen) loginScreen.style.display = 'none';
    if (app) app.style.display = 'none';

    const rememberedPage = getRememberedOpenPage(user);
    showWelcomeAnimation(rememberedPage);
    return true;
}

function setAuthHintText() {
    const hint = document.getElementById('authHint');
    if (!hint) return;
    if (forgotPinVisible) {
        hint.textContent = t('authHintReset');
        return;
    }
    if (authMode === 'signup') {
        hint.textContent = t('authHintSignup');
        return;
    }
    if (authMode === 'admin') {
        hint.textContent = t('authHintAdmin');
        return;
    }
    hint.textContent = t('authHintLogin');
}

function updateAuthPrimaryButtons() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    if (loginBtn) {
        loginBtn.textContent = authMode === 'admin' ? t('adminLogin') : t('login');
    }
    if (signupBtn) {
        signupBtn.textContent = t('createAccount');
    }
}

function updateSignupAdminPinVisibility() {
    const roleSelect = document.getElementById('signupRole');
    const adminPinGroup = document.getElementById('signupAdminPinGroup');
    const adminPinConfirmGroup = document.getElementById('signupAdminPinConfirmGroup');
    const adminPinInput = document.getElementById('signupAdminPin');
    const adminPinConfirmInput = document.getElementById('signupAdminPinConfirm');
    const users = getAuthUsers();
    const canPickRole = Array.isArray(users) && users.length > 0;
    const showAdminPin = authMode === 'signup' && canPickRole && roleSelect && roleSelect.value === 'admin';

    if (adminPinGroup) adminPinGroup.style.display = showAdminPin ? 'block' : 'none';
    if (adminPinConfirmGroup) adminPinConfirmGroup.style.display = showAdminPin ? 'block' : 'none';

    if (!showAdminPin) {
        if (adminPinInput) adminPinInput.value = '';
        if (adminPinConfirmInput) adminPinConfirmInput.value = '';
    }
}

function syncSignupRoleControls(users = getAuthUsers()) {
    const roleGroup = document.getElementById('signupRoleGroup');
    const roleSelect = document.getElementById('signupRole');
    const canPickRole = Array.isArray(users) && users.length > 0;
    const shouldShowRole = authMode === 'signup' && canPickRole;

    if (roleGroup) roleGroup.style.display = shouldShowRole ? 'block' : 'none';
    if (roleSelect) {
        if (!canPickRole) {
            roleSelect.value = 'staff';
        } else if (roleSelect.value !== 'admin' && roleSelect.value !== 'staff') {
            roleSelect.value = 'staff';
        }
    }

    updateSignupAdminPinVisibility();
}

function toggleForgotPinPanel(show) {
    forgotPinVisible = Boolean(show);

    const panel = document.getElementById('forgotPinPanel');
    const forgotPinBtn = document.getElementById('forgotPinBtn');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const loginTab = document.getElementById('authLoginTab');
    const adminTab = document.getElementById('authAdminTab');
    const signupTab = document.getElementById('authSignupTab');
    const resetPhoneInput = document.getElementById('resetPhone');
    const phoneInput = document.getElementById('phone');

    if (panel) panel.style.display = forgotPinVisible ? 'block' : 'none';
    if (loginBtn) loginBtn.style.display = (!forgotPinVisible && authMode === 'login') ? 'block' : 'none';
    if (signupBtn) signupBtn.style.display = (!forgotPinVisible && authMode === 'signup') ? 'block' : 'none';
    if (forgotPinBtn) forgotPinBtn.style.display = (!forgotPinVisible && authMode === 'login') ? 'inline-block' : 'none';
    if (loginTab) loginTab.disabled = forgotPinVisible;
    if (adminTab) adminTab.disabled = forgotPinVisible;
    if (signupTab) signupTab.disabled = forgotPinVisible;

    if (forgotPinVisible) {
        const typedIdentifier = phoneInput ? String(phoneInput.value || '').trim() : '';
        const matchedUser = findUserByLoginIdentifier(typedIdentifier, getAuthUsers());
        if (resetPhoneInput) {
            resetPhoneInput.value = normalizePhone(matchedUser?.phone || typedIdentifier || appMeta.lastLoginPhone || '');
        }
    } else {
        resetForgotPinFields();
    }

    setAuthHintText();
}

function switchAuthMode(mode) {
    if (mode === 'signup' || mode === 'admin') {
        authMode = mode;
    } else {
        authMode = 'login';
    }
    const isSignup = authMode === 'signup';
    const isAdmin = authMode === 'admin';

    const signupNameGroup = document.getElementById('signupNameGroup');
    const confirmPinGroup = document.getElementById('confirmPinGroup');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const loginTab = document.getElementById('authLoginTab');
    const adminTab = document.getElementById('authAdminTab');
    const signupTab = document.getElementById('authSignupTab');
    const forgotPinBtn = document.getElementById('forgotPinBtn');

    if (forgotPinVisible) {
        toggleForgotPinPanel(false);
    }

    if (signupNameGroup) signupNameGroup.style.display = isSignup ? 'block' : 'none';
    if (confirmPinGroup) confirmPinGroup.style.display = isSignup ? 'block' : 'none';
    if (loginBtn) loginBtn.style.display = isSignup ? 'none' : 'block';
    if (signupBtn) signupBtn.style.display = isSignup ? 'block' : 'none';
    if (forgotPinBtn) forgotPinBtn.style.display = (!isSignup && !isAdmin) ? 'inline-block' : 'none';
    if (loginTab) loginTab.classList.toggle('active', !isSignup && !isAdmin);
    if (adminTab) adminTab.classList.toggle('active', isAdmin);
    if (signupTab) signupTab.classList.toggle('active', isSignup);
    if (loginTab) loginTab.disabled = false;
    if (adminTab) adminTab.disabled = false;
    if (signupTab) signupTab.disabled = false;

    syncSignupRoleControls(getAuthUsers());
    updateAuthPrimaryButtons();
    setAuthHintText();
}

function updateActiveUserBadge() {
    const badge = document.getElementById('activeUserBadge');
    const accountNameEl = document.getElementById('activeAccountName');

    if (!activeUser) {
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '';
        }
        if (accountNameEl) accountNameEl.textContent = t('notLoggedIn');
        return;
    }

    const userLabel = activeUser.name || activeUser.phone || 'User';
    if (badge) {
        badge.textContent = `${t('loggedInAs')}: ${userLabel}`;
        badge.style.display = 'inline-flex';
    }
    if (accountNameEl) accountNameEl.textContent = userLabel;
}

function getOnboardingSteps() {
    return [
        { title: t('tutorial1Title'), text: t('tutorial1Text'), page: 'home' },
        { title: t('tutorial2Title'), text: t('tutorial2Text'), page: 'addSale' },
        { title: t('tutorial3Title'), text: t('tutorial3Text'), page: 'addSale' },
        { title: t('tutorial4Title'), text: t('tutorial4Text'), page: 'customers' },
        { title: t('tutorial5Title'), text: t('tutorial5Text'), page: 'reports' },
        { title: t('tutorial6Title'), text: t('tutorial6Text'), page: 'settings' }
    ];
}

function renderOnboardingStep() {
    const overlay = document.getElementById('onboardingOverlay');
    const titleEl = document.getElementById('onboardingTitle');
    const textEl = document.getElementById('onboardingText');
    const stepLabelEl = document.getElementById('onboardingStepLabel');
    const progressBarEl = document.getElementById('onboardingProgressBar');
    const prevBtn = document.getElementById('onboardingPrevBtn');
    const nextBtn = document.getElementById('onboardingNextBtn');
    if (!overlay || !titleEl || !textEl || !stepLabelEl || !nextBtn || !prevBtn) return;

    const steps = getOnboardingSteps();
    const step = steps[onboardingStepIndex];
    if (!step) return;

    if (step.page) showPage(step.page);

    const label = t('tutorialStepLabel')
        .replace('{current}', String(onboardingStepIndex + 1))
        .replace('{total}', String(steps.length));
    stepLabelEl.textContent = label;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    if (progressBarEl) {
        const progressPercent = ((onboardingStepIndex + 1) / steps.length) * 100;
        progressBarEl.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
    }
    prevBtn.disabled = onboardingStepIndex === 0;
    nextBtn.textContent = onboardingStepIndex === steps.length - 1 ? t('tutorialDone') : t('tutorialNext');
}

async function closeOnboarding(markDone = true) {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.style.display = 'none';
    onboardingVisible = false;
    pendingOnboardingStart = false;
    if (markDone && activeUser) {
        settings.onboardingDone = true;
        await optimizedSaveData();
    }
}

function bindOnboardingControls() {
    const skipBtn = document.getElementById('onboardingSkipBtn');
    const prevBtn = document.getElementById('onboardingPrevBtn');
    const nextBtn = document.getElementById('onboardingNextBtn');

    if (skipBtn && !skipBtn.dataset.bound) {
        skipBtn.addEventListener('click', () => { closeOnboarding(true); });
        skipBtn.dataset.bound = '1';
    }
    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.addEventListener('click', () => {
            if (onboardingStepIndex > 0) {
                onboardingStepIndex -= 1;
                renderOnboardingStep();
            }
        });
        prevBtn.dataset.bound = '1';
    }
    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.addEventListener('click', async () => {
            const steps = getOnboardingSteps();
            if (onboardingStepIndex >= steps.length - 1) {
                await closeOnboarding(true);
                return;
            }
            onboardingStepIndex += 1;
            renderOnboardingStep();
        });
        nextBtn.dataset.bound = '1';
    }
}

function startOnboardingTutorial(force = false) {
    void force;
    pendingOnboardingStart = false;
    onboardingVisible = false;
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.style.display = 'none';
}

async function handleLogin() {
    const now = Date.now();
    if (now < loginLockedUntil) {
        alert(t('authTooManyAttempts'));
        return;
    }

    const phoneInput = document.getElementById('phone');
    const pinInput = document.getElementById('pin');
    const loginIdentifier = (phoneInput ? phoneInput.value : '').trim();
    const pin = (pinInput ? pinInput.value : '').trim();
    const users = getAuthUsers();

    if (!/^\d{5}$/.test(pin)) {
        alert(t('authPinRules'));
        return;
    }

    if (authMode === 'admin') {
        await handleAdminLogin(loginIdentifier, pin, users);
        return;
    }

    const user = findUserByLoginIdentifier(loginIdentifier, users);

    if (!user || String(user.pin) !== pin) {
        registerFailedLoginAttempt('authInvalidCredentials');
        return;
    }
    if (!isUserAccountActive(user)) {
        alert(t('authAccountInactive'));
        return;
    }

    await completeLoginForUser(user, { loginMode: 'user' });
}

async function handleSignup() {
    const nameInput = document.getElementById('signupName');
    const phoneInput = document.getElementById('phone');
    const pinInput = document.getElementById('pin');
    const confirmInput = document.getElementById('confirmPin');
    const signupRoleSelect = document.getElementById('signupRole');
    const signupAdminPinInput = document.getElementById('signupAdminPin');
    const signupAdminPinConfirmInput = document.getElementById('signupAdminPinConfirm');

    const name = (nameInput ? nameInput.value : '').trim();
    const phone = normalizePhone(phoneInput ? phoneInput.value : '');
    const pin = (pinInput ? pinInput.value : '').trim();
    const confirmPin = (confirmInput ? confirmInput.value : '').trim();

    if (!name) {
        alert(t('authNameRequired'));
        return;
    }
    if (phone.length < 10) {
        alert(t('authPhoneRequired'));
        return;
    }
    if (!/^\d{5}$/.test(pin)) {
        alert(t('authPinRules'));
        return;
    }
    if (pin !== confirmPin) {
        alert(t('authPinMismatch'));
        return;
    }

    const users = getAuthUsers();
    const phoneExists = users.some((u) => normalizePhone(u.phone) === phone);
    if (phoneExists) {
        alert(t('authPhoneExists'));
        return;
    }

    const requestedRole = users.length === 0
        ? 'owner'
        : (signupRoleSelect && signupRoleSelect.value === 'admin' ? 'admin' : 'staff');

    const adminPin = (signupAdminPinInput ? signupAdminPinInput.value : '').trim();
    const confirmAdminPin = (signupAdminPinConfirmInput ? signupAdminPinConfirmInput.value : '').trim();
    if (requestedRole === 'admin') {
        if (!/^\d{5}$/.test(adminPin)) {
            alert(t('authPinRules'));
            return;
        }
        if (!/^\d{5}$/.test(confirmAdminPin)) {
            alert(t('authPinRules'));
            return;
        }
        if (adminPin !== confirmAdminPin) {
            alert(t('authPinMismatch'));
            return;
        }
        if (adminPin === pin) {
            alert(t('authAdminPinMustDiffer'));
            return;
        }
    }

    const createdUser = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name,
        email: '',
        phone,
        pin,
        role: requestedRole,
        adminPin: requestedRole === 'admin' ? adminPin : '',
        isActive: true,
        createdAt: new Date().toISOString()
    };
    users.push(createdUser);

    appMeta.authUsers = users;
    appMeta.lastLoginPhone = phone;
    await initializeUserStorage({ id: createdUser.id, phone });
    await optimizedSaveData();

    if (confirmInput) confirmInput.value = '';
    if (pinInput) pinInput.value = '';
    if (signupRoleSelect) signupRoleSelect.value = 'staff';
    if (signupAdminPinInput) signupAdminPinInput.value = '';
    if (signupAdminPinConfirmInput) signupAdminPinConfirmInput.value = '';
    updateSignupAdminPinVisibility();
    if (phoneInput) phoneInput.value = phone;
    showSuccessToast(t('authAccountCreated'));
    switchAuthMode('login');
}

function openForgotPinPanel() {
    switchAuthMode('login');
    toggleForgotPinPanel(true);
}

async function handleResetPin() {
    const resetPhoneInput = document.getElementById('resetPhone');
    const resetNewPinInput = document.getElementById('resetNewPin');
    const resetConfirmPinInput = document.getElementById('resetConfirmPin');

    const phone = normalizePhone(resetPhoneInput ? resetPhoneInput.value : '');
    const newPin = (resetNewPinInput ? resetNewPinInput.value : '').trim();
    const confirmPin = (resetConfirmPinInput ? resetConfirmPinInput.value : '').trim();
    const users = getAuthUsers();

    if (phone.length < 10) {
        alert(t('authPhoneRequired'));
        return;
    }
    if (!/^\d{5}$/.test(newPin)) {
        alert(t('authPinRules'));
        return;
    }
    if (newPin !== confirmPin) {
        alert(t('authPinMismatch'));
        return;
    }

    const user = users.find((u) => normalizePhone(u.phone) === phone);
    if (!user) {
        alert(t('authUserNotFound'));
        return;
    }

    user.pin = newPin;
    user.updatedAt = new Date().toISOString();
    appMeta.authUsers = users;
    appMeta.lastLoginPhone = phone;
    await saveNamedData(APP_META_STORAGE_KEY, appMeta);

    toggleForgotPinPanel(false);

    const phoneInput = document.getElementById('phone');
    const pinInput = document.getElementById('pin');
    if (phoneInput) phoneInput.value = phone;
    if (pinInput) pinInput.value = '';
    showSuccessToast(t('authPinResetSuccess'));
}

function initializeAuthUI() {
    const users = getAuthUsers();
    const loginTab = document.getElementById('authLoginTab');
    const adminTab = document.getElementById('authAdminTab');
    const signupTab = document.getElementById('authSignupTab');
    const phoneInput = document.getElementById('phone');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const pinInput = document.getElementById('pin');
    const confirmInput = document.getElementById('confirmPin');
    const signupRoleSelect = document.getElementById('signupRole');
    const signupAdminPinInput = document.getElementById('signupAdminPin');
    const signupAdminPinConfirmInput = document.getElementById('signupAdminPinConfirm');
    const forgotPinBtn = document.getElementById('forgotPinBtn');
    const resetPinBtn = document.getElementById('resetPinBtn');
    const cancelResetPinBtn = document.getElementById('cancelResetPinBtn');
    const resetConfirmPinInput = document.getElementById('resetConfirmPin');

    if (loginTab && !loginTab.dataset.bound) {
        loginTab.addEventListener('click', () => switchAuthMode('login'));
        loginTab.dataset.bound = '1';
    }
    if (adminTab && !adminTab.dataset.bound) {
        adminTab.addEventListener('click', () => switchAuthMode('admin'));
        adminTab.dataset.bound = '1';
    }
    if (signupTab && !signupTab.dataset.bound) {
        signupTab.addEventListener('click', () => switchAuthMode('signup'));
        signupTab.dataset.bound = '1';
    }
    if (loginBtn && !loginBtn.dataset.bound) {
        loginBtn.addEventListener('click', handleLogin);
        loginBtn.dataset.bound = '1';
    }
    if (signupBtn && !signupBtn.dataset.bound) {
        signupBtn.addEventListener('click', handleSignup);
        signupBtn.dataset.bound = '1';
    }
    if (signupRoleSelect && !signupRoleSelect.dataset.bound) {
        signupRoleSelect.addEventListener('change', updateSignupAdminPinVisibility);
        signupRoleSelect.dataset.bound = '1';
    }
    if (forgotPinBtn && !forgotPinBtn.dataset.bound) {
        forgotPinBtn.addEventListener('click', openForgotPinPanel);
        forgotPinBtn.dataset.bound = '1';
    }
    if (resetPinBtn && !resetPinBtn.dataset.bound) {
        resetPinBtn.addEventListener('click', handleResetPin);
        resetPinBtn.dataset.bound = '1';
    }
    if (cancelResetPinBtn && !cancelResetPinBtn.dataset.bound) {
        cancelResetPinBtn.addEventListener('click', () => toggleForgotPinPanel(false));
        cancelResetPinBtn.dataset.bound = '1';
    }
    if (pinInput && !pinInput.dataset.boundEnter) {
        pinInput.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            if (authMode === 'signup') {
                const confirmEl = document.getElementById('confirmPin');
                if (confirmEl) confirmEl.focus();
            } else {
                handleLogin();
            }
        });
        pinInput.dataset.boundEnter = '1';
    }
    if (confirmInput && !confirmInput.dataset.boundEnter) {
        confirmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSignup();
        });
        confirmInput.dataset.boundEnter = '1';
    }
    if (signupAdminPinInput && !signupAdminPinInput.dataset.boundEnter) {
        signupAdminPinInput.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            const adminConfirm = document.getElementById('signupAdminPinConfirm');
            if (adminConfirm) adminConfirm.focus();
        });
        signupAdminPinInput.dataset.boundEnter = '1';
    }
    if (signupAdminPinConfirmInput && !signupAdminPinConfirmInput.dataset.boundEnter) {
        signupAdminPinConfirmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSignup();
        });
        signupAdminPinConfirmInput.dataset.boundEnter = '1';
    }
    if (resetConfirmPinInput && !resetConfirmPinInput.dataset.boundEnter) {
        resetConfirmPinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleResetPin();
        });
        resetConfirmPinInput.dataset.boundEnter = '1';
    }

    if (phoneInput && appMeta.lastLoginPhone) {
        phoneInput.value = String(appMeta.lastLoginPhone);
    }

    toggleForgotPinPanel(false);
    switchAuthMode(users.length === 0 ? 'signup' : 'login');
    syncSignupRoleControls(users);
    if (!activeUser) {
        activeLoginMode = 'user';
    }
    updateActiveUserBadge();
    refreshAdminAccessUI();
    refreshDataManagementAccessUI();
}

let mobileChromeAutoHideBound = false;

function initializeMobileChromeAutoHide() {
    if (mobileChromeAutoHideBound) return;
    const app = document.getElementById('app');
    if (!app) return;

    let lastScrollY = window.scrollY || 0;
    let ticking = false;

    const canAutoHide = () => {
        if (typeof window.matchMedia !== 'function') return false;
        const isMobileViewport = window.matchMedia('(max-width: 900px)').matches;
        return isMobileViewport && app.style.display !== 'none';
    };

    const applyChromeVisibility = () => {
        ticking = false;
        if (!canAutoHide()) {
            app.classList.remove('chrome-hidden');
            lastScrollY = window.scrollY || 0;
            return;
        }

        const currentY = window.scrollY || 0;
        const delta = currentY - lastScrollY;
        if (currentY > 90 && delta > 6) {
            app.classList.add('chrome-hidden');
        } else if (delta < -4 || currentY < 48) {
            app.classList.remove('chrome-hidden');
        }
        lastScrollY = currentY;
    };

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(applyChromeVisibility);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', applyChromeVisibility);
    document.addEventListener('visibilitychange', applyChromeVisibility);

    mobileChromeAutoHideBound = true;
    applyChromeVisibility();
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Make A Way App Initializing...');
    const loginScreenEl = document.getElementById('loginScreen');
    if (loginScreenEl) {
        // Prevent a login-screen flash while restoring a saved session.
        loginScreenEl.style.visibility = 'hidden';
    }
    
    // Load data first
    await loadAllData();
    const didRestoreSession = await restoreActiveSessionFromMeta();
    setAppLanguage(settings.language || 'en');
    configureDatePickers();
    setRangeToThisMonth();
    initializeAuthUI();
    initializeMobileChromeAutoHide();
    if (!didRestoreSession && loginScreenEl) {
        loginScreenEl.style.visibility = 'visible';
        loginScreenEl.style.display = 'flex';
    }
    startRwandaClock();
    bindOnboardingControls();
    ensureStockAdjustOverlayBindings();
    ensureClearDataConfirmBindings();
    
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            const userAtLogout = activeUser;
            if (userAtLogout) {
                const payload = buildCurrentSavePayload(userAtLogout);
                const entries = Object.entries(payload).map(([name, value]) => ({ name, value }));
                await saveManyNamedData(entries);
                flushDataSyncOnExit(userAtLogout);
            }
            const appLetters = document.getElementById('appBgLetters');
            if (appLetters) {
                appLetters.style.display = 'none';
                appLetters.style.opacity = '0';
            }
            
            activeUser = null;
            activeLoginMode = 'user';
            appMeta.activeSessionUserId = '';
            appMeta.activeSessionLoginMode = '';
            await saveNamedData(APP_META_STORAGE_KEY, appMeta);
            failedLoginAttempts = 0;
            loginLockedUntil = 0;
            pendingOnboardingStart = false;
            updateActiveUserBadge();
            refreshAdminAccessUI();
            refreshDataManagementAccessUI();
            closeOnboarding(false);

            document.getElementById('app').style.display = 'none';
            document.getElementById('app').classList.remove('chrome-hidden');
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) {
                loginScreen.style.visibility = 'visible';
                loginScreen.style.display = 'flex';
            }
            document.getElementById('phone').value = appMeta.lastLoginPhone || '';
            document.getElementById('pin').value = '';
            const signupName = document.getElementById('signupName');
            const signupRole = document.getElementById('signupRole');
            const signupAdminPin = document.getElementById('signupAdminPin');
            const signupAdminPinConfirm = document.getElementById('signupAdminPinConfirm');
            const confirmPin = document.getElementById('confirmPin');
            const resetPhone = document.getElementById('resetPhone');
            const resetNewPin = document.getElementById('resetNewPin');
            const resetConfirmPin = document.getElementById('resetConfirmPin');
            if (signupName) signupName.value = '';
            if (signupRole) signupRole.value = 'staff';
            if (signupAdminPin) signupAdminPin.value = '';
            if (signupAdminPinConfirm) signupAdminPinConfirm.value = '';
            if (confirmPin) confirmPin.value = '';
            if (resetPhone) resetPhone.value = '';
            if (resetNewPin) resetNewPin.value = '';
            if (resetConfirmPin) resetConfirmPin.value = '';
            updateSignupAdminPinVisibility();
            toggleForgotPinPanel(false);
            sales = [];
            customers = [];
            clates = [];
            drinks = [];
            settings = getDefaultUserSettings();
            cart = [];
            yearlyArchives = [];
            switchAuthMode(getAuthUsers().length === 0 ? 'signup' : 'login');
        });
    }
    
    // Initialize the app
    updateDrinkList();
    updateQuickDrinkSelect();
    updateCustomerDropdown();
    updateCartDisplay();
    updateHome();
    
    // Apply theme and settings
    const currentTheme = settings.theme || 'light';
    applyTheme(currentTheme);
    
    // Setup search listeners after DOM is ready
    setTimeout(setupSearchListeners, 100);
    
    // Auto-save every 30 seconds
    autoSaveInterval = setInterval(async () => {
        await optimizedSaveData();
    }, 30000);
    
    console.log('App initialized successfully');
});

// Setup search listeners - CRITICAL for search to work
function setupSearchListeners() {
    // Drink search
    const drinkSearch = document.getElementById('drinkSearch');
    if (drinkSearch) {
        drinkSearch.removeEventListener('input', handleDrinkSearch);
        drinkSearch.addEventListener('input', handleDrinkSearch);
    }
    
    // Customer search
    const customerSearch = document.querySelector('.search-input[placeholder*="Search customers"]');
    if (customerSearch) {
        customerSearch.removeEventListener('input', handleCustomerSearch);
        customerSearch.addEventListener('input', handleCustomerSearch);
    }
    
    // Deposit search
    const depositSearch = document.getElementById('depositSearch');
    if (depositSearch) {
        depositSearch.removeEventListener('input', handleDepositSearch);
        depositSearch.addEventListener('input', handleDepositSearch);
    }
    
    // Sales history search
    const salesSearch = document.getElementById('salesSearch');
    if (salesSearch) {
        salesSearch.removeEventListener('input', handleSalesSearch);
        salesSearch.addEventListener('input', handleSalesSearch);
    }
}

// Drink search handler
function handleDrinkSearch(e) {
    filterDrinks();
}

// Customer search handler
function handleCustomerSearch(e) {
    debouncedFilterCustomers(e.target.value);
}

// Deposit search handler
function handleDepositSearch(e) {
    debouncedFilterDeposits(e.target.value);
}

// Sales history search handler
function handleSalesSearch(e) {
    filterSalesHistory(e.target.value);
}

// Show app background letters after login
function showAppBackgroundLetters() {
    const appLetters = document.getElementById('appBgLetters');
    if (appLetters) {
        appLetters.style.display = 'flex';
        
        // Fade in effect
        setTimeout(() => {
            appLetters.style.transition = 'opacity 1s';
            appLetters.style.opacity = '0.26';
        }, 100);
    }
}

// Welcome animation
function showWelcomeAnimation(startPage = 'home') {
    const overlay = document.getElementById('welcomeOverlay');
    const targetPage = String(startPage || '').trim() || 'home';
    const completeLoginTransition = () => {
        if (overlay) {
            overlay.classList.remove('show');
            overlay.style.display = 'none';
        }
        const loginScreen = document.getElementById('loginScreen');
        const app = document.getElementById('app');
        if (loginScreen) loginScreen.style.display = 'none';
        if (app) app.style.display = 'block';
        showAppBackgroundLetters();

        // Apply saved theme and language
        const savedTheme = settings.theme || 'light';
        const savedLanguage = settings.language || 'en';
        setAppLanguage(savedLanguage);
        applyTheme(savedTheme);
        updateActiveUserBadge();

        showPage(targetPage);
    };

    if (!overlay) {
        completeLoginTransition();
        return;
    }

    // Re-trigger the animation on every login and randomize angle a bit.
    const randomAngle = 116 + Math.floor(Math.random() * 56);
    const darkActive = (settings.theme || 'light') === 'dark' || document.body.classList.contains('dark-mode');
    overlay.classList.toggle('loader-dark', darkActive);
    overlay.style.setProperty('--maw-loader-angle', `${randomAngle}deg`);
    overlay.classList.remove('show');
    overlay.style.display = 'flex';
    void overlay.offsetWidth;
    overlay.classList.add('show');

    // Hide overlay and show app after animation finishes.
    setTimeout(() => {
        completeLoginTransition();
    }, 1750);
}

const DB_NAME = 'makeaway_db';
const DB_STORE = 'app_state';

function getTodayISODate() {
    return new Date().toISOString().split('T')[0];
}

function getDayRange(dateValue) {
    const dayStart = new Date(dateValue);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return { dayStart, dayEnd };
}

function getClockLocale() {
    const localeMap = {
        en: 'en-US',
        rw: 'rw-RW',
        fr: 'fr-FR'
    };
    return localeMap[currentLanguage] || 'en-US';
}

async function fetchJsonWithTimeout(url, timeoutMs = 6000) {
    if (typeof fetch !== 'function') return null;
    const hasAbort = typeof AbortController !== 'undefined';
    const controller = hasAbort ? new AbortController() : null;
    let timeoutHandle = null;

    try {
        if (controller) {
            timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        }
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }
}

function parseRwandaEpochMs(payload) {
    if (!payload || typeof payload !== 'object') return null;

    if (Number.isFinite(payload.unixtime)) {
        return Number(payload.unixtime) * 1000;
    }

    if (typeof payload.datetime === 'string') {
        const parsed = Date.parse(payload.datetime);
        if (Number.isFinite(parsed)) return parsed;
    }

    if (typeof payload.dateTime === 'string') {
        const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(payload.dateTime);
        const normalized = hasOffset ? payload.dateTime : `${payload.dateTime}+02:00`;
        const parsed = Date.parse(normalized);
        if (Number.isFinite(parsed)) return parsed;
    }

    const year = Number(payload.year);
    const month = Number(payload.month);
    const day = Number(payload.day);
    const hour = Number(payload.hour);
    const minute = Number(payload.minute);
    const seconds = Number(payload.seconds);
    const milliSeconds = Number(payload.milliSeconds || 0);
    if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        Number.isFinite(seconds)
    ) {
        const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(Math.max(0, milliSeconds)).padStart(3, '0')}+02:00`;
        const parsed = Date.parse(iso);
        if (Number.isFinite(parsed)) return parsed;
    }

    return null;
}

async function fetchRwandaEpochMs() {
    const sources = [
        'https://timeapi.io/api/Time/current/zone?timeZone=Africa/Kigali',
        'https://worldtimeapi.org/api/timezone/Africa/Kigali'
    ];

    for (const url of sources) {
        const payload = await fetchJsonWithTimeout(url, 6000);
        const epochMs = parseRwandaEpochMs(payload);
        if (Number.isFinite(epochMs)) return epochMs;
    }

    return null;
}

function getSyncedRwandaDate() {
    if (!Number.isFinite(rwandaClockBaseEpochMs) || !Number.isFinite(rwandaClockBasePerfMs)) {
        return null;
    }
    const elapsedMs = performance.now() - rwandaClockBasePerfMs;
    return new Date(rwandaClockBaseEpochMs + elapsedMs);
}

async function syncRwandaClockFromServer() {
    const epochMs = await fetchRwandaEpochMs();
    if (!Number.isFinite(epochMs)) return false;

    rwandaClockBaseEpochMs = epochMs;
    rwandaClockBasePerfMs = performance.now();
    return true;
}

function updateRwandaClock() {
    const dayEl = document.getElementById('rwClockDay');
    const dateEl = document.getElementById('rwClockDate');
    const timeEl = document.getElementById('rwClockTime');
    if (!dayEl || !dateEl || !timeEl) return;

    const now = getSyncedRwandaDate();
    if (!now) {
        dayEl.textContent = 'Syncing';
        dateEl.textContent = 'Rwanda time';
        timeEl.textContent = '--:--:--';
        return;
    }

    const locale = getClockLocale();

    const dayText = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        timeZone: RWANDA_TIME_ZONE
    }).format(now);

    const dateText = new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: RWANDA_TIME_ZONE
    }).format(now);

    const timeText = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: RWANDA_TIME_ZONE
    }).format(now);

    dayEl.textContent = dayText;
    dateEl.textContent = dateText;
    timeEl.textContent = timeText;
}

function startRwandaClock() {
    if (rwandaClockInterval) {
        clearInterval(rwandaClockInterval);
        rwandaClockInterval = null;
    }
    if (rwandaClockSyncInterval) {
        clearInterval(rwandaClockSyncInterval);
        rwandaClockSyncInterval = null;
    }

    updateRwandaClock();

    const syncAndRender = async () => {
        const synced = await syncRwandaClockFromServer();
        if (!synced) return;
        updateRwandaClock();
    };

    void syncAndRender();
    rwandaClockInterval = setInterval(updateRwandaClock, 1000);
    rwandaClockSyncInterval = setInterval(() => {
        void syncAndRender();
    }, RWANDA_TIME_SYNC_INTERVAL_MS);
}

function configureDatePickers() {
    const todayIso = getTodayISODate();
    const pickerIds = ['salesHistoryDate', 'dailyReportDate', 'rangeStartDate', 'rangeEndDate', 'adminSalesExportDate'];

    pickerIds.forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;

        input.max = todayIso;
        input.setAttribute('inputmode', 'none');

        if (!input.dataset.pickerBound) {
            input.addEventListener('keydown', (e) => e.preventDefault());
            input.addEventListener('paste', (e) => e.preventDefault());
            input.addEventListener('drop', (e) => e.preventDefault());
            input.addEventListener('focus', () => {
                if (typeof input.showPicker === 'function') input.showPicker();
            });
            input.addEventListener('click', () => {
                if (typeof input.showPicker === 'function') input.showPicker();
            });
            input.dataset.pickerBound = '1';
        }
    });

    const monthInput = document.getElementById('rangeMonth');
    if (monthInput) {
        monthInput.max = todayIso.slice(0, 7);
        if (!monthInput.value) monthInput.value = todayIso.slice(0, 7);
        monthInput.setAttribute('inputmode', 'none');
        if (!monthInput.dataset.pickerBound) {
            monthInput.addEventListener('keydown', (e) => e.preventDefault());
            monthInput.addEventListener('paste', (e) => e.preventDefault());
            monthInput.addEventListener('drop', (e) => e.preventDefault());
            monthInput.addEventListener('focus', () => {
                if (typeof monthInput.showPicker === 'function') monthInput.showPicker();
            });
            monthInput.addEventListener('click', () => {
                if (typeof monthInput.showPicker === 'function') monthInput.showPicker();
            });
            monthInput.dataset.pickerBound = '1';
        }
    }

    const adminSalesDateInput = document.getElementById('adminSalesExportDate');
    if (adminSalesDateInput) {
        adminSalesDateInput.max = todayIso;
        if (!adminSalesDateInput.value) adminSalesDateInput.value = todayIso;
        if (!adminSalesDateInput.dataset.bound) {
            adminSalesDateInput.addEventListener('change', () => {
                if (!adminSalesDateInput.value) adminSalesDateInput.value = todayIso;
            });
            adminSalesDateInput.dataset.bound = '1';
        }
    }
}

function openAppDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveToIndexedDB() {
    const db = await openAppDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.put(sales, 'sales');
        store.put(customers, 'customers');
        store.put(clates, 'clates');
        store.put(drinks, 'drinks');
        store.put(settings, 'settings');
        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

async function loadFromIndexedDB() {
    try {
        const db = await openAppDB();
        const readKey = (key) => new Promise((resolve) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });

        const dbSales = await readKey('sales');
        const dbCustomers = await readKey('customers');
        const dbClates = await readKey('clates');
        const dbDrinks = await readKey('drinks');
        const dbSettings = await readKey('settings');
        db.close();

        if (!dbSales && !dbCustomers && !dbClates && !dbDrinks && !dbSettings) {
            return false;
        }

        sales = Array.isArray(dbSales) ? dbSales : [];
        customers = Array.isArray(dbCustomers) ? dbCustomers : [];
        clates = Array.isArray(dbClates) ? dbClates : [];
        drinks = Array.isArray(dbDrinks) ? dbDrinks : defaultDrinks;
        settings = (dbSettings && typeof dbSettings === 'object') ? dbSettings : {};
        normalizeDrinksData();
        return true;
    } catch (error) {
        console.warn('IndexedDB load failed:', error);
        return false;
    }
}

function refreshAdminAccessUI() {
    const adminSession = isAdminSessionActive();
    const adminPanelAllowed = canAccessAdminPanel();
    const adminVisiblePages = new Set(['home', 'reports', 'adminSales', 'adminAccounts', 'adminHub', 'settings']);
    if (document.body) {
        document.body.classList.toggle('admin-session', adminSession);
    }

    document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
        const page = btn.dataset.page;
        if (adminSession) {
            btn.style.display = adminVisiblePages.has(page) ? 'inline-flex' : 'none';
            return;
        }
        if (page === 'adminPanel' || page === 'adminHub' || page === 'adminSales' || page === 'adminAccounts') {
            btn.style.display = adminPanelAllowed ? 'inline-flex' : 'none';
            return;
        }
        if (page === 'settings') {
            btn.style.display = 'none';
            return;
        }
        if (page === 'reports') {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'inline-flex';
    });

    const topSettingsBtn = document.getElementById('topSettingsBtn');
    if (topSettingsBtn) {
        topSettingsBtn.style.display = adminSession ? 'none' : 'inline-flex';
    }

    const reportsNavLabel = document.querySelector('.nav-btn[data-page="reports"] .nav-label');
    if (reportsNavLabel) {
        reportsNavLabel.textContent = adminSession ? 'Business Analysis' : t('reports');
    }

    setReportsPageModeForRole();
    refreshProfitVisibilityUI();
}

function setReportsPageModeForRole() {
    const adminSession = isAdminSessionActive();
    const reportsHeader = document.querySelector('#reports .page-header h2');
    const adminBusinessAnalysis = document.getElementById('adminBusinessAnalysis');
    const reportControls = document.querySelector('#reports .report-controls');
    const reportRangePanel = document.querySelector('#reports .report-range-panel');
    const reportOutput = document.getElementById('reportOutput');

    if (reportsHeader) {
        reportsHeader.textContent = adminSession ? 'Business Analysis' : t('reports');
    }
    if (adminBusinessAnalysis) {
        adminBusinessAnalysis.style.display = adminSession ? 'block' : 'none';
    }
    if (reportControls) {
        reportControls.style.display = adminSession ? 'none' : '';
    }
    if (reportRangePanel) {
        reportRangePanel.style.display = adminSession ? 'none' : '';
    }
    if (reportOutput) {
        reportOutput.style.display = adminSession ? 'none' : '';
    }
}

function refreshProfitVisibilityUI() {
    const allowProfit = canViewProfitData();

    const todayProfitElement = document.getElementById('todayProfit');
    const todayProfitCard = todayProfitElement ? todayProfitElement.closest('.stat-card') : null;
    if (todayProfitCard) {
        todayProfitCard.style.display = allowProfit ? '' : 'none';
    }

    const addSaleProfitInput = document.getElementById('newDrinkProfitPerCase');
    if (addSaleProfitInput) {
        addSaleProfitInput.style.display = allowProfit ? '' : 'none';
        addSaleProfitInput.disabled = !allowProfit;
        if (!allowProfit) addSaleProfitInput.value = '';
    }

    const settingsBusinessCard = document.getElementById('settingsBusinessCard');
    if (settingsBusinessCard) {
        settingsBusinessCard.style.display = allowProfit ? '' : 'none';
    }
}

function refreshDataManagementAccessUI() {
    const clearBtn = document.getElementById('clearUserDataBtn');
    const clearQuickBtn = document.getElementById('adminClearDataQuickBtn');
    const warningText = document.getElementById('clearWarningText');
    const archiveYearSelect = document.getElementById('archiveYearSelect');
    const archiveYearBtn = document.getElementById('archiveYearBtn');
    const allowed = isAdminSessionActive();

    if (clearBtn) {
        clearBtn.disabled = !allowed;
        clearBtn.style.opacity = allowed ? '1' : '0.55';
        clearBtn.style.cursor = allowed ? 'pointer' : 'not-allowed';
        clearBtn.title = allowed ? '' : t('clearDataRequiresAdminLogin');
    }

    if (warningText) {
        warningText.textContent = allowed ? t('warningClearData') : t('clearDataRequiresAdminLogin');
    }

    if (clearQuickBtn) {
        clearQuickBtn.disabled = !allowed;
        clearQuickBtn.style.opacity = allowed ? '1' : '0.55';
        clearQuickBtn.style.cursor = allowed ? 'pointer' : 'not-allowed';
        clearQuickBtn.title = allowed ? '' : t('clearDataRequiresAdminLogin');
    }

    if (archiveYearSelect) {
        const hasYearValue = Boolean(String(archiveYearSelect.value || '').trim());
        archiveYearSelect.disabled = !allowed || !hasYearValue;
        archiveYearSelect.style.opacity = (!allowed || !hasYearValue) ? '0.6' : '1';
    }

    if (archiveYearBtn) {
        const hasYearValue = Boolean(String(archiveYearSelect?.value || '').trim());
        archiveYearBtn.disabled = !allowed || !hasYearValue;
        archiveYearBtn.style.opacity = (!allowed || !hasYearValue) ? '0.55' : '1';
        archiveYearBtn.style.cursor = (!allowed || !hasYearValue) ? 'not-allowed' : 'pointer';
        archiveYearBtn.title = !allowed ? t('clearDataRequiresAdminLogin') : '';
    }
}

function extractYearFromDateValue(value) {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.getFullYear();
}

function getArchiveYearFromSale(sale) {
    return extractYearFromDateValue(sale?.date || sale?.createdAt || sale?.timestamp);
}

function getArchiveYearFromClate(item) {
    return extractYearFromDateValue(item?.date || item?.createdAt || item?.updatedAt || item?.returnedDate || item?.returnDate);
}

function getArchiveCandidateYears() {
    const years = new Set();

    (Array.isArray(sales) ? sales : []).forEach((sale) => {
        const year = getArchiveYearFromSale(sale);
        if (Number.isFinite(year)) years.add(year);
    });

    (Array.isArray(clates) ? clates : []).forEach((item) => {
        const year = getArchiveYearFromClate(item);
        if (Number.isFinite(year)) years.add(year);
    });

    return Array.from(years).sort((a, b) => b - a);
}

function renderArchiveYearOptions() {
    const select = document.getElementById('archiveYearSelect');
    if (!select) return;

    const years = getArchiveCandidateYears();
    const previousValue = String(select.value || '').trim();
    select.innerHTML = '';

    if (!years.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No year available';
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    years.forEach((year) => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        select.appendChild(option);
    });

    if (previousValue && years.includes(Number(previousValue))) {
        select.value = previousValue;
    } else {
        select.value = String(years[0]);
    }
}

async function archiveSelectedYear() {
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return;
    }

    const select = document.getElementById('archiveYearSelect');
    const selectedYear = Number(select ? select.value : '');
    if (!Number.isFinite(selectedYear)) {
        alert('Please choose a valid year to archive.');
        return;
    }

    const salesToArchive = (Array.isArray(sales) ? sales : []).filter((sale) => getArchiveYearFromSale(sale) === selectedYear);
    const clatesToArchive = (Array.isArray(clates) ? clates : []).filter((item) => getArchiveYearFromClate(item) === selectedYear);

    if (!salesToArchive.length && !clatesToArchive.length) {
        alert(`No transactions found for ${selectedYear}.`);
        renderArchiveYearOptions();
        refreshDataManagementAccessUI();
        return;
    }

    const confirmed = await showUiConfirm({
        title: 'Archive Year',
        message: `Archive ${selectedYear} data and remove it from active workspace?`,
        confirmText: 'Archive',
        cancelText: 'Cancel'
    });
    if (!confirmed) return;

    const archivedEntry = {
        year: selectedYear,
        archivedAt: new Date().toISOString(),
        sales: salesToArchive,
        clates: clatesToArchive,
        summary: {
            salesCount: salesToArchive.length,
            clatesCount: clatesToArchive.length,
            salesTotal: salesToArchive.reduce((sum, sale) => sum + (Number(sale?.total) || 0), 0)
        }
    };

    yearlyArchives = sanitizeYearArchives([
        ...yearlyArchives.filter((entry) => Number(entry?.year) !== selectedYear),
        archivedEntry
    ]);

    sales = sales.filter((sale) => getArchiveYearFromSale(sale) !== selectedYear);
    clates = clates.filter((item) => getArchiveYearFromClate(item) !== selectedYear);

    await optimizedSaveData();
    updateHome();
    displaySalesHistory();
    displayKosiyo();
    renderArchiveYearOptions();
    refreshDataManagementAccessUI();

    showSuccessToast(`Year ${selectedYear} archived. Active workspace now starts fresh for new records.`);
}

function normalizeUserRoleLabel(roleValue) {
    const role = normalizeAuthRole(roleValue, 'staff');
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    return 'Staff';
}

function getAuthProviderLabel(user) {
    const provider = String(user?.authProvider || '').trim().toLowerCase();
    return provider === 'google' ? 'Google' : 'PIN';
}

function setAdminMainTab(tab, event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    activeAdminMainTab = tab === 'accounts' ? 'accounts' : 'sales';

    const salesBtn = document.getElementById('adminMainTabSalesBtn');
    const accountsBtn = document.getElementById('adminMainTabAccountsBtn');
    const salesPanel = document.getElementById('adminMainTabSales');
    const accountsPanel = document.getElementById('adminMainTabAccounts');

    if (salesBtn) salesBtn.classList.toggle('active', activeAdminMainTab === 'sales');
    if (accountsBtn) accountsBtn.classList.toggle('active', activeAdminMainTab === 'accounts');
    if (salesPanel) salesPanel.style.display = activeAdminMainTab === 'sales' ? 'block' : 'none';
    if (accountsPanel) accountsPanel.style.display = activeAdminMainTab === 'accounts' ? 'block' : 'none';

    if (activeAdminMainTab === 'sales') {
        setAdminSalesSubTab(activeAdminSalesSubTab);
    }
}

function setAdminSalesSubTab(tab, event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    activeAdminSalesSubTab = tab === 'stock' ? 'stock' : 'daily';

    const dailyBtn = document.getElementById('adminSalesSubTabDailyBtn');
    const stockBtn = document.getElementById('adminSalesSubTabStockBtn');
    const dailyPanel = document.getElementById('adminSalesSubTabDaily');
    const stockPanel = document.getElementById('adminSalesSubTabStock');

    if (dailyBtn) dailyBtn.classList.toggle('active', activeAdminSalesSubTab === 'daily');
    if (stockBtn) stockBtn.classList.toggle('active', activeAdminSalesSubTab === 'stock');
    if (dailyPanel) dailyPanel.style.display = activeAdminSalesSubTab === 'daily' ? 'block' : 'none';
    if (stockPanel) stockPanel.style.display = activeAdminSalesSubTab === 'stock' ? 'block' : 'none';

    if (activeAdminSalesSubTab === 'stock') {
        renderAdminSalesStockManagement();
        return;
    }
    renderAdminDailySalesSummary();
}

function setAdminUserFilter(filter, event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const allowedFilters = new Set(['all', 'privileged', 'staff', 'inactive']);
    selectedAdminUserFilter = allowedFilters.has(filter) ? filter : 'all';

    const mapping = {
        all: document.getElementById('adminFilterAll'),
        privileged: document.getElementById('adminFilterPrivileged'),
        staff: document.getElementById('adminFilterStaff'),
        inactive: document.getElementById('adminFilterInactive')
    };
    Object.entries(mapping).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('active', key === selectedAdminUserFilter);
    });

    renderAdminPanel();
}

function getFilteredAdminUserEntries() {
    const searchInput = document.getElementById('adminUserSearch');
    const searchValue = String(searchInput ? searchInput.value : '').trim().toLowerCase();
    const users = getAuthUsers();

    return users
        .map((user, index) => ({ user, index }))
        .filter(({ user }) => {
            const role = normalizeAuthRole(user.role, 'staff');
            const active = isUserAccountActive(user);

            if (selectedAdminUserFilter === 'privileged' && role === 'staff') return false;
            if (selectedAdminUserFilter === 'staff' && role !== 'staff') return false;
            if (selectedAdminUserFilter === 'inactive' && active) return false;

            if (!searchValue) return true;
            const nameText = String(user.name || '').toLowerCase();
            const phoneText = String(user.phone || '').toLowerCase();
            const emailText = String(user.email || '').toLowerCase();
            return nameText.includes(searchValue) || phoneText.includes(searchValue) || emailText.includes(searchValue);
        });
}

function getSaleDateTimeOrNull(sale) {
    if (!sale || typeof sale !== 'object') return null;
    const parsed = new Date(sale.date || sale.createdAt || '');
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function getSaleDateIso(sale) {
    const parsed = getSaleDateTimeOrNull(sale);
    return parsed ? parsed.toISOString().slice(0, 10) : '';
}

function getDailySalesRowsOrdered() {
    const grouped = new Map();

    (Array.isArray(sales) ? sales : []).forEach((sale) => {
        const dayIso = getSaleDateIso(sale);
        if (!dayIso) return;

        if (!grouped.has(dayIso)) {
            grouped.set(dayIso, []);
        }
        grouped.get(dayIso).push(sale);
    });

    return Array.from(grouped.entries())
        .map(([dayIso, daySales]) => ({
            dayIso,
            transactions: daySales.length,
            cases: daySales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0),
            total: daySales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0),
            profit: calculateProfitFromSales(daySales)
        }))
        .sort((a, b) => b.dayIso.localeCompare(a.dayIso));
}

function renderAdminDailySalesSummary() {
    const body = document.getElementById('adminDailySummaryBody');
    if (!body) return;

    const rows = getDailySalesRowsOrdered();
    if (!rows.length) {
        body.innerHTML = `<tr><td id="adminDailyNoDataCell" colspan="6" style="padding: 28px; text-align: center; color: #789;">${escapeHtml(t('adminNoSalesDataYet'))}</td></tr>`;
        return;
    }

    body.innerHTML = rows
        .map((row) => `
            <tr>
                <td>${escapeHtml(formatPdfDate(row.dayIso))}</td>
                <td>${Number(row.transactions).toLocaleString()}</td>
                <td>${Number(row.cases).toLocaleString()}</td>
                <td>RWF ${Number(row.total).toLocaleString()}</td>
                <td>RWF ${Number(row.profit).toLocaleString()}</td>
                <td>
                    <button type="button" class="add-btn" style="padding: 6px 10px; font-size: 12px;" onclick="exportAdminDailySalesPDF('${String(row.dayIso).replace(/'/g, "\\'")}')">PDF</button>
                </td>
            </tr>
        `)
        .join('');
}

function getSalesForSpecificDay(dayIso) {
    const { dayStart, dayEnd } = getDayRange(dayIso);
    return (Array.isArray(sales) ? sales : [])
        .filter((sale) => {
            const saleDate = getSaleDateTimeOrNull(sale);
            return saleDate && saleDate >= dayStart && saleDate < dayEnd;
        })
        .sort((a, b) => {
            const aDate = getSaleDateTimeOrNull(a);
            const bDate = getSaleDateTimeOrNull(b);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });
}

function toLocalDayKey(dateValue) {
    const dt = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(dt.getTime())) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function trimCompactNumber(value) {
    return String(value)
        .replace(/(\.\d*?[1-9])0+$/, '$1')
        .replace(/\.0+$/, '');
}

function formatCompactRwf(value) {
    const amount = Number(value) || 0;
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (absolute >= 1000000) {
        const display = absolute / 1000000;
        const digits = display >= 10 ? 0 : 1;
        return `${sign}${trimCompactNumber(display.toFixed(digits))}M`;
    }
    if (absolute >= 1000) {
        const display = absolute / 1000;
        const digits = display >= 10 ? 0 : 1;
        return `${sign}${trimCompactNumber(display.toFixed(digits))}K`;
    }
    return `${sign}${Math.round(absolute).toLocaleString()}`;
}

function formatRwf(value) {
    return `RWF ${Math.round(Number(value) || 0).toLocaleString()}`;
}

function formatSignedRwf(value) {
    const amount = Number(value) || 0;
    const sign = amount > 0 ? '+' : (amount < 0 ? '-' : '');
    return `${sign}${formatRwf(Math.abs(amount))}`;
}

function formatSignedPercent(value, digits = 1) {
    const amount = Number(value) || 0;
    const sign = amount > 0 ? '+' : '';
    return `${sign}${amount.toFixed(digits)}%`;
}

function getAdminGrowthPointTone(point, previousPoint) {
    if (!point || Number(point.total) <= 0) {
        return { key: 'zero', label: 'No sales recorded' };
    }
    if (!previousPoint) {
        return { key: 'flat', label: 'Start of selected period' };
    }
    const delta = Number(point.total) - Number(previousPoint.total);
    if (delta > 0) {
        return { key: 'up', label: 'Sales improved vs previous day' };
    }
    if (delta < 0) {
        return { key: 'down', label: 'Sales declined vs previous day' };
    }
    return { key: 'flat', label: 'Same as previous day' };
}

function updateAdminGrowthWindowButtons() {
    const mapping = {
        14: 'growthWindow14Btn',
        30: 'growthWindow30Btn',
        60: 'growthWindow60Btn',
        90: 'growthWindow90Btn'
    };
    Object.entries(mapping).forEach(([dayValue, elementId]) => {
        const btn = document.getElementById(elementId);
        if (!btn) return;
        btn.classList.toggle('active', Number(dayValue) === Number(selectedAdminGrowthWindowDays));
    });
}

function getAdminBusinessAnalysisData(days = 30) {
    const windowDays = Math.max(7, Number(days) || 30);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (windowDays - 1));
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - windowDays);

    const series = [];
    const seriesByDay = new Map();
    for (let i = 0; i < windowDays; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + i);
        const dayIso = toLocalDayKey(dayDate);
        const point = {
            dayDate,
            dayIso,
            label: dayDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            total: 0,
            transactions: 0,
            quantity: 0,
            creditTotal: 0,
            movingAverage: 0,
            vsMovingPercent: 0,
            deltaPercent: 0,
            delta: 0
        };
        series.push(point);
        seriesByDay.set(dayIso, point);
    }

    let previousTotal = 0;
    let previousTransactions = 0;
    const productTotals = new Map();
    const latestCreditByCustomerIndex = new Map();
    (Array.isArray(sales) ? sales : []).forEach((sale) => {
        const saleDate = getSaleDateTimeOrNull(sale);
        if (!saleDate) return;

        const saleTotal = Number(sale.total) || 0;
        if (saleDate >= previousStart && saleDate < startDate) {
            previousTotal += saleTotal;
            previousTransactions += 1;
        }

        const dayKey = toLocalDayKey(saleDate);
        const point = seriesByDay.get(dayKey);
        if (!point) return;

        point.total += saleTotal;
        point.transactions += 1;
        point.quantity += Number(sale.quantity) || 0;
        if (sale.type === 'credit') {
            point.creditTotal += saleTotal;
            const customerIndex = Number(sale.customerId);
            if (Number.isInteger(customerIndex) && customerIndex >= 0) {
                const currentLatest = latestCreditByCustomerIndex.get(customerIndex);
                if (!currentLatest || saleDate > currentLatest) {
                    latestCreditByCustomerIndex.set(customerIndex, saleDate);
                }
            }
        }

        const drinkName = String(sale.drinkName || 'Unknown').trim() || 'Unknown';
        if (!productTotals.has(drinkName)) {
            productTotals.set(drinkName, { name: drinkName, qty: 0, total: 0 });
        }
        const stats = productTotals.get(drinkName);
        stats.qty += Number(sale.quantity) || 0;
        stats.total += saleTotal;
    });

    series.forEach((point, index) => {
        const previousPoint = index > 0 ? series[index - 1] : null;
        point.delta = previousPoint ? (point.total - previousPoint.total) : 0;
        point.deltaPercent = previousPoint && previousPoint.total > 0
            ? (point.delta / previousPoint.total) * 100
            : (point.total > 0 ? 100 : 0);

        const movingStart = Math.max(0, index - 6);
        const movingWindow = series.slice(movingStart, index + 1);
        const movingTotal = movingWindow.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0);
        point.movingAverage = movingWindow.length ? (movingTotal / movingWindow.length) : 0;
        point.vsMovingPercent = point.movingAverage > 0
            ? ((point.total - point.movingAverage) / point.movingAverage) * 100
            : (point.total > 0 ? 100 : 0);
    });

    const currentTotal = series.reduce((sum, point) => sum + point.total, 0);
    const growthPercent = previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : (currentTotal > 0 ? 100 : 0);

    const averageDaily = currentTotal / windowDays;
    const previousAverageDaily = previousTotal / windowDays;
    const zeroSalesDays = series.filter((point) => point.total <= 0).length;
    const activeDays = series.filter((point) => point.total > 0).length;
    const consistencyPercent = windowDays > 0 ? (activeDays / windowDays) * 100 : 0;
    const positiveDays = series.filter((point, index) => index > 0 && point.total > series[index - 1].total).length;
    const negativeDays = series.filter((point, index) => index > 0 && point.total < series[index - 1].total).length;
    const currentTransactions = series.reduce((sum, point) => sum + (Number(point.transactions) || 0), 0);
    const currentCreditTotal = series.reduce((sum, point) => sum + (Number(point.creditTotal) || 0), 0);
    const creditSharePercent = currentTotal > 0 ? (currentCreditTotal / currentTotal) * 100 : 0;

    const topProducts = Array.from(productTotals.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 3);
    const totalQuantity = series.reduce((sum, point) => sum + (Number(point.quantity) || 0), 0);
    const favoriteDrinkSharePercent = (topProducts[0] && totalQuantity > 0)
        ? ((Number(topProducts[0].qty) || 0) / totalQuantity) * 100
        : 0;

    let declineStreak = 0;
    for (let i = series.length - 1; i > 0; i--) {
        if (series[i].total < series[i - 1].total) {
            declineStreak += 1;
            continue;
        }
        break;
    }

    const weekdayBuckets = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
    series.forEach((point) => {
        const weekday = point.dayDate.getDay();
        weekdayBuckets[weekday].total += point.total;
        weekdayBuckets[weekday].days += 1;
    });

    const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayAverages = weekdayBuckets
        .map((entry, index) => ({
            name: weekdayName[index],
            average: entry.days > 0 ? (entry.total / entry.days) : 0
        }))
        .filter((entry) => Number.isFinite(entry.average));
    const slowestWeekday = weekdayAverages.slice().sort((a, b) => a.average - b.average)[0] || null;

    const weekendAverage = (() => {
        const saturday = weekdayBuckets[6];
        const sunday = weekdayBuckets[0];
        const days = saturday.days + sunday.days;
        const total = saturday.total + sunday.total;
        return days > 0 ? total / days : 0;
    })();
    const weekdayAverage = (() => {
        const weekdays = weekdayBuckets.slice(1, 6);
        const days = weekdays.reduce((sum, item) => sum + item.days, 0);
        const total = weekdays.reduce((sum, item) => sum + item.total, 0);
        return days > 0 ? total / days : 0;
    })();
    const weekendLiftPercent = weekdayAverage > 0
        ? ((weekendAverage - weekdayAverage) / weekdayAverage) * 100
        : 0;

    const bestDay = series.slice().sort((a, b) => b.total - a.total)[0] || null;
    const worstDay = series.slice().sort((a, b) => a.total - b.total)[0] || null;
    const lowStockCount = getLowStockDrinks().length;
    const debtFollowUps = [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    (Array.isArray(customers) ? customers : []).forEach((customer, index) => {
        const owing = Number(customer?.owing) || 0;
        if (owing <= 0) return;

        let latestDebtDate = latestCreditByCustomerIndex.get(index) || null;
        const debtHistory = Array.isArray(customer?.debtHistory) ? customer.debtHistory : [];
        debtHistory.forEach((entry) => {
            const ts = entry?.timestamp || entry?.date || entry?.time || entry?.createdAt;
            const dt = ts ? new Date(ts) : null;
            if (!dt || Number.isNaN(dt.getTime())) return;
            if (!latestDebtDate || dt > latestDebtDate) {
                latestDebtDate = dt;
            }
        });

        let daysOutstanding = null;
        if (latestDebtDate && !Number.isNaN(latestDebtDate.getTime())) {
            const debtDate = new Date(latestDebtDate);
            debtDate.setHours(0, 0, 0, 0);
            daysOutstanding = Math.max(0, Math.round((todayStart - debtDate) / 86400000));
        }

        debtFollowUps.push({
            name: String(customer?.name || `Customer ${index + 1}`),
            owing,
            daysOutstanding,
            lastDebtDate: latestDebtDate || null
        });
    });

    debtFollowUps.sort((a, b) => {
        const aDays = Number.isFinite(a.daysOutstanding) ? Number(a.daysOutstanding) : -1;
        const bDays = Number.isFinite(b.daysOutstanding) ? Number(b.daysOutstanding) : -1;
        if (bDays !== aDays) return bDays - aDays;
        return Number(b.owing) - Number(a.owing);
    });

    const topDebtFollowUp = debtFollowUps[0] || null;
    const overdueDebtCount = debtFollowUps.filter((item) => Number(item.daysOutstanding) >= 7).length;
    const outstandingDebtTotal = debtFollowUps.reduce((sum, item) => sum + (Number(item.owing) || 0), 0);

    return {
        windowDays,
        series,
        previousTotal,
        currentTotal,
        previousAverageDaily,
        growthPercent,
        averageDaily,
        zeroSalesDays,
        activeDays,
        consistencyPercent,
        positiveDays,
        negativeDays,
        declineStreak,
        currentTransactions,
        previousTransactions,
        creditSharePercent,
        topProducts,
        totalQuantity,
        favoriteDrinkSharePercent,
        slowestWeekday,
        weekendLiftPercent,
        bestDay,
        worstDay,
        lowStockCount,
        topDebtFollowUp,
        overdueDebtCount,
        outstandingDebtTotal
    };
}

function renderAdminGrowthPointDetails(analysis) {
    const details = document.getElementById('adminGrowthPointDetails');
    if (!details) return;

    const series = Array.isArray(analysis?.series) ? analysis.series : [];
    if (!series.length) {
        details.innerHTML = '<div class="admin-growth-point-empty">No daily sales data yet.</div>';
        return;
    }

    const previewIndex = Number(adminGrowthPreviewPointIndex);
    const usePreview = Number.isFinite(previewIndex) && previewIndex >= 0 && previewIndex < series.length;
    const selectedIndex = Math.max(0, Math.min(series.length - 1, Number(selectedAdminGrowthPointIndex)));
    const displayIndex = usePreview ? previewIndex : selectedIndex;
    const point = series[displayIndex];
    const previousPoint = displayIndex > 0 ? series[displayIndex - 1] : null;
    const tone = getAdminGrowthPointTone(point, previousPoint);

    const toneClass = tone.key === 'up' ? 'positive' : (tone.key === 'down' ? 'negative' : 'flat');
    const movingToneClass = point.vsMovingPercent > 0.5 ? 'positive' : (point.vsMovingPercent < -0.5 ? 'negative' : 'flat');
    const deltaNote = previousPoint
        ? `${formatSignedRwf(point.delta)} (${formatSignedPercent(point.deltaPercent)})`
        : 'Start of selected period';
    const movingNote = `${formatSignedPercent(point.vsMovingPercent)} vs 7-day average`;
    const fullDate = point.dayDate.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    details.innerHTML = `
        <div class="admin-growth-point-head">
            <div>
                <h5>${escapeHtml(fullDate)}</h5>
                <p>${escapeHtml(tone.label)}</p>
            </div>
            <span class="admin-growth-point-chip ${toneClass}">${escapeHtml(formatSignedPercent(point.deltaPercent))}</span>
        </div>
        <div class="admin-growth-point-grid">
            <article class="admin-growth-stat-card">
                <span>Sales</span>
                <strong>${escapeHtml(formatRwf(point.total))}</strong>
            </article>
            <article class="admin-growth-stat-card">
                <span>Transactions</span>
                <strong>${Number(point.transactions || 0).toLocaleString()}</strong>
            </article>
            <article class="admin-growth-stat-card">
                <span>Cases Sold</span>
                <strong>${Number(point.quantity || 0).toLocaleString()}</strong>
            </article>
            <article class="admin-growth-stat-card">
                <span>Credit Sales</span>
                <strong>${escapeHtml(formatRwf(point.creditTotal || 0))}</strong>
            </article>
            <article class="admin-growth-stat-card">
                <span>7-Day Average</span>
                <strong>${escapeHtml(formatRwf(point.movingAverage || 0))}</strong>
            </article>
            <article class="admin-growth-stat-card">
                <span>Change vs Previous Day</span>
                <strong class="${toneClass}">${escapeHtml(deltaNote)}</strong>
            </article>
        </div>
        <div class="admin-growth-point-note ${movingToneClass}">
            ${escapeHtml(movingNote)}
        </div>
    `;
}

function hideAdminGrowthTooltip() {
    const tooltip = document.getElementById('adminGrowthTooltip');
    if (tooltip) tooltip.style.display = 'none';
}

function showAdminGrowthTooltip(point, clientX, clientY) {
    const tooltip = document.getElementById('adminGrowthTooltip');
    const wrap = document.querySelector('#adminGrowthChart .admin-growth-canvas');
    if (!tooltip || !wrap || !point) return;

    tooltip.textContent = `${point.label}: ${formatRwf(point.total)} | ${Number(point.transactions || 0)} tx | ${Number(point.quantity || 0)} cases`;
    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';

    const wrapRect = wrap.getBoundingClientRect();
    const maxLeft = Math.max(8, wrap.clientWidth - tooltip.offsetWidth - 8);
    const maxTop = Math.max(8, wrap.clientHeight - tooltip.offsetHeight - 8);
    const left = Math.min(maxLeft, Math.max(8, clientX - wrapRect.left + 12));
    const top = Math.min(maxTop, Math.max(8, clientY - wrapRect.top + 12));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function renderAdminGrowthChart(analysis) {
    const container = document.getElementById('adminGrowthChart');
    if (!container) return;

    const series = Array.isArray(analysis?.series) ? analysis.series : [];
    if (!series.length) {
        container.innerHTML = '<p style="margin:0; color:#5f7392;">No sales data yet to render growth.</p>';
        return;
    }

    const width = Math.max(920, series.length * 34);
    const height = 360;
    const padding = { top: 26, right: 18, bottom: 58, left: 96 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const chartBottom = height - padding.bottom;

    const values = series.flatMap((point) => [Number(point.total) || 0, Number(point.movingAverage) || 0]);
    const minValueRaw = Math.min(...values, 0);
    const maxValueRaw = Math.max(...values, 1);
    const spread = maxValueRaw - minValueRaw;
    const yPadding = spread > 0 ? spread * 0.14 : 1;
    const yMin = Math.max(0, minValueRaw - yPadding * 0.25);
    const yMax = maxValueRaw + yPadding;
    const ySpan = Math.max(1, yMax - yMin);
    const toY = (value) => padding.top + ((yMax - value) / ySpan) * chartHeight;

    const stepX = chartWidth / series.length;
    const barWidth = Math.max(6, Math.min(26, stepX * 0.72));
    const points = series.map((point, index) => {
        const x = padding.left + (stepX * index) + ((stepX - barWidth) / 2);
        const y = toY(Number(point.total) || 0);
        const movingY = toY(Number(point.movingAverage) || 0);
        const heightValue = Math.max(1, chartBottom - y);
        return {
            ...point,
            x,
            y,
            movingY,
            centerX: x + (barWidth / 2),
            barWidth,
            barHeight: heightValue
        };
    });

    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
        const ratio = index / tickCount;
        const value = yMax - (ratio * ySpan);
        const y = padding.top + (ratio * chartHeight);
        return { value, y };
    });

    const selectedIndex = Math.max(0, Math.min(points.length - 1, Number(selectedAdminGrowthPointIndex)));
    const previewRaw = Number(adminGrowthPreviewPointIndex);
    const previewIndex = Number.isFinite(previewRaw) && previewRaw >= 0 && previewRaw < points.length
        ? previewRaw
        : -1;
    const focusIndex = previewIndex >= 0 ? previewIndex : selectedIndex;
    const selectedPoint = points[focusIndex] || points[points.length - 1];

    const movingAveragePath = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.centerX.toFixed(2)} ${point.movingY.toFixed(2)}`)
        .join(' ');

    const barRects = points.map((point, index) => {
        const previous = index > 0 ? points[index - 1] : null;
        const tone = getAdminGrowthPointTone(point, previous).key;
        const toneClass = tone === 'up' ? 'up' : (tone === 'down' ? 'down' : (tone === 'zero' ? 'zero' : 'flat'));
        const activeClass = index === selectedIndex ? ' active' : '';
        const title = `${point.label}: ${formatRwf(point.total)} | ${point.transactions} tx | ${point.quantity} cases`;
        return `
            <rect
                class="growth-bar growth-bar-${toneClass}${activeClass}"
                x="${point.x.toFixed(2)}"
                y="${point.y.toFixed(2)}"
                width="${point.barWidth.toFixed(2)}"
                height="${point.barHeight.toFixed(2)}"
                rx="3"
                ry="3"
                data-point-index="${index}"
                tabindex="0"
            >
                <title>${escapeHtml(title)}</title>
            </rect>
        `;
    }).join('');

    const movingAveragePoints = points.map((point, index) => `
        <circle
            class="growth-moving-point${index === selectedIndex ? ' active' : ''}"
            cx="${point.centerX.toFixed(2)}"
            cy="${point.movingY.toFixed(2)}"
            r="${index === selectedIndex ? '4.2' : '3'}"
        ></circle>
    `).join('');

    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    const xLabels = points
        .filter((_, index) => index % labelStep === 0 || index === points.length - 1)
        .map((point) => `<text class="growth-x-label" x="${point.centerX.toFixed(2)}" y="${(height - 14).toFixed(2)}" text-anchor="middle">${escapeHtml(point.label)}</text>`)
        .join('');

    container.innerHTML = `
        <div class="admin-growth-legend">
            <span><i class="legend-dot up"></i>Up vs previous day</span>
            <span><i class="legend-dot down"></i>Down vs previous day</span>
            <span><i class="legend-dot avg"></i>7-day moving average</span>
        </div>
        <div class="admin-growth-canvas">
            <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMinYMin meet" class="admin-growth-svg" role="img" aria-label="Business growth chart">
            ${yTicks.map((tick) => `
                <line class="growth-grid-line" x1="${padding.left}" y1="${tick.y.toFixed(2)}" x2="${(width - padding.right).toFixed(2)}" y2="${tick.y.toFixed(2)}"></line>
                <text class="growth-y-label" x="${(padding.left - 10).toFixed(2)}" y="${(tick.y + 4).toFixed(2)}" text-anchor="end">RWF ${formatCompactRwf(tick.value)}</text>
            `).join('')}
            <line class="growth-axis-line" x1="${padding.left}" y1="${chartBottom.toFixed(2)}" x2="${(width - padding.right).toFixed(2)}" y2="${chartBottom.toFixed(2)}"></line>
            ${barRects}
            <line class="growth-selected-line" x1="${selectedPoint.centerX.toFixed(2)}" y1="${padding.top}" x2="${selectedPoint.centerX.toFixed(2)}" y2="${chartBottom.toFixed(2)}"></line>
            <path class="growth-moving-average-line" d="${movingAveragePath}"></path>
            ${movingAveragePoints}
            ${xLabels}
            </svg>
            <div id="adminGrowthTooltip" class="admin-growth-tooltip" style="display:none;"></div>
        </div>
    `;

    container.querySelectorAll('.growth-bar[data-point-index]').forEach((bar) => {
        const pointIndex = Number(bar.getAttribute('data-point-index'));
        if (!Number.isFinite(pointIndex)) return;

        const point = points[pointIndex];
        if (!point) return;

        const selectPoint = () => {
            adminGrowthPreviewPointIndex = -1;
            hideAdminGrowthTooltip();
            selectAdminGrowthPoint(pointIndex);
        };

        const previewPoint = () => {
            if (adminGrowthPreviewPointIndex !== pointIndex) {
                adminGrowthPreviewPointIndex = pointIndex;
                renderAdminGrowthPointDetails(analysis);
            }
        };

        const clearPreview = () => {
            if (adminGrowthPreviewPointIndex !== -1) {
                adminGrowthPreviewPointIndex = -1;
                renderAdminGrowthPointDetails(analysis);
            }
            hideAdminGrowthTooltip();
        };

        bar.addEventListener('mouseenter', (event) => {
            previewPoint();
            showAdminGrowthTooltip(point, event.clientX, event.clientY);
        });
        bar.addEventListener('mousemove', (event) => {
            showAdminGrowthTooltip(point, event.clientX, event.clientY);
        });
        bar.addEventListener('mouseleave', clearPreview);
        bar.addEventListener('focus', previewPoint);
        bar.addEventListener('blur', clearPreview);
        bar.addEventListener('click', selectPoint);
        bar.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectPoint();
            }
        });
    });
}

function setAdminGrowthWindow(days) {
    if (!canAccessAdminPanel()) {
        return 'Permission Denied';
    }
    const allowed = new Set([14, 30, 60, 90]);
    const parsed = Number(days);
    selectedAdminGrowthWindowDays = allowed.has(parsed) ? parsed : 30;
    selectedAdminGrowthPointIndex = -1;
    adminGrowthPreviewPointIndex = -1;
    hideAdminGrowthTooltip();
    renderAdminBusinessAnalysisTab();
    return selectedAdminGrowthWindowDays;
}

function selectAdminGrowthPoint(index) {
    if (!canAccessAdminPanel()) {
        return 'Permission Denied';
    }
    const analysis = cachedAdminGrowthAnalysis;
    const series = Array.isArray(analysis?.series) ? analysis.series : [];
    if (!series.length) {
        return renderAdminBusinessAnalysisTab();
    }
    adminGrowthPreviewPointIndex = -1;
    hideAdminGrowthTooltip();
    selectedAdminGrowthPointIndex = Math.max(0, Math.min(series.length - 1, Number(index) || 0));
    renderAdminGrowthChart(analysis);
    renderAdminGrowthPointDetails(analysis);
    return selectedAdminGrowthPointIndex;
}

function renderAdminBusinessAnalysisTab() {
    if (!canAccessAdminPanel()) {
        return 'Permission Denied';
    }

    setReportsPageModeForRole();
    const analysis = getAdminBusinessAnalysisData(selectedAdminGrowthWindowDays);
    cachedAdminGrowthAnalysis = analysis;

    const seriesLength = Array.isArray(analysis.series) ? analysis.series.length : 0;
    if (seriesLength === 0) {
        selectedAdminGrowthPointIndex = -1;
        adminGrowthPreviewPointIndex = -1;
    } else if (selectedAdminGrowthPointIndex < 0 || selectedAdminGrowthPointIndex >= seriesLength) {
        const lastNonZeroIndex = [...analysis.series]
            .map((point, idx) => ({ idx, total: point.total }))
            .reverse()
            .find((entry) => Number(entry.total) > 0);
        selectedAdminGrowthPointIndex = lastNonZeroIndex ? lastNonZeroIndex.idx : (seriesLength - 1);
    }
    if (adminGrowthPreviewPointIndex < 0 || adminGrowthPreviewPointIndex >= seriesLength) {
        adminGrowthPreviewPointIndex = -1;
    }

    const growthBadge = document.getElementById('adminGrowthTrendBadge');
    const growthSummary = document.getElementById('adminGrowthSummary');
    updateAdminGrowthWindowButtons();

    if (growthBadge) {
        const growth = Number(analysis.growthPercent) || 0;
        growthBadge.textContent = `${formatSignedPercent(growth)} vs previous ${analysis.windowDays} days`;
        growthBadge.classList.remove('positive', 'negative', 'flat');
        if (growth > 0.1) {
            growthBadge.classList.add('positive');
        } else if (growth < -0.1) {
            growthBadge.classList.add('negative');
        } else {
            growthBadge.classList.add('flat');
        }
    }

    if (growthSummary) {
        const bestDayText = analysis.bestDay ? `${analysis.bestDay.label} (${formatRwf(analysis.bestDay.total)})` : 'N/A';
        const activeText = `${analysis.activeDays}/${analysis.windowDays} active days`;
        growthSummary.textContent = `${analysis.windowDays}-day sales: ${formatRwf(analysis.currentTotal)} (avg ${formatRwf(analysis.averageDaily)}/day). ${activeText}. Best day: ${bestDayText}.`;
    }

    hideAdminGrowthTooltip();
    renderAdminGrowthChart(analysis);
    renderAdminGrowthPointDetails(analysis);
    const pieContainer = document.getElementById('adminDrinksPieContainer');
    if (pieContainer && pieContainer.style.display !== 'none') {
        renderAdminDrinksPieChart();
    }
    return analysis;
}

function getAdminDrinksPieData() {
    const byDrink = new Map();
    (Array.isArray(sales) ? sales : []).forEach((sale) => {
        const name = String(sale.drinkName || 'Unknown').trim() || 'Unknown';
        const qty = Number(sale.quantity) || 0;
        if (qty <= 0) return;
        byDrink.set(name, (byDrink.get(name) || 0) + qty);
    });
    const total = Array.from(byDrink.values()).reduce((s, n) => s + n, 0);
    return Array.from(byDrink.entries())
        .map(([name, qty]) => ({ name, qty, share: total > 0 ? (qty / total) * 100 : 0 }))
        .sort((a, b) => b.qty - a.qty);
}

function getAdminDrinksPieFocusIndex() {
    if (adminDrinksPieState.pinnedIndex >= 0 && adminDrinksPieState.pinnedIndex < adminDrinksPieState.data.length) {
        return adminDrinksPieState.pinnedIndex;
    }
    if (adminDrinksPieState.hoverIndex >= 0 && adminDrinksPieState.hoverIndex < adminDrinksPieState.data.length) {
        return adminDrinksPieState.hoverIndex;
    }
    return -1;
}

function hideAdminDrinksPieTooltip() {
    const tooltip = document.getElementById('adminDrinksPieTooltip');
    if (tooltip) tooltip.style.display = 'none';
}

function showAdminDrinksPieTooltip(item, clientX, clientY) {
    const tooltip = document.getElementById('adminDrinksPieTooltip');
    const wrap = document.querySelector('#adminDrinksPieContainer .admin-drinks-pie-wrap');
    if (!tooltip || !wrap || !item) return;

    tooltip.textContent = `${item.name}: ${item.qty.toLocaleString()} cases (${item.share.toFixed(1)}%)`;
    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';

    const wrapRect = wrap.getBoundingClientRect();
    const maxLeft = Math.max(8, wrap.clientWidth - tooltip.offsetWidth - 8);
    const maxTop = Math.max(8, wrap.clientHeight - tooltip.offsetHeight - 8);
    const left = Math.min(maxLeft, Math.max(8, clientX - wrapRect.left + 12));
    const top = Math.min(maxTop, Math.max(8, clientY - wrapRect.top + 12));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function getAdminDrinksPieHitIndex(x, y) {
    const slices = Array.isArray(adminDrinksPieState.slices) ? adminDrinksPieState.slices : [];
    for (let i = 0; i < slices.length; i += 1) {
        const slice = slices[i];
        if (!slice) continue;
        const dx = x - slice.cx;
        const dy = y - slice.cy;
        const distance = Math.sqrt((dx * dx) + (dy * dy));
        if (distance > slice.radius) continue;

        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        if (angle >= slice.startAngle && angle <= slice.endAngle) return i;
    }
    return -1;
}

function drawAdminDrinksPieChart() {
    const canvas = document.getElementById('adminDrinksPieCanvas');
    const legendEl = document.getElementById('adminDrinksPieLegend');
    if (!canvas || !legendEl) return;

    const ctx = canvas.getContext('2d');
    const data = adminDrinksPieState.data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    adminDrinksPieState.slices = [];

    if (!data.length) {
        legendEl.innerHTML = '<p style="margin:0;color:#789;">No sales data yet.</p>';
        canvas.style.cursor = 'default';
        hideAdminDrinksPieTooltip();
        return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = Math.min(cx, cy) - 12;
    const focusIndex = getAdminDrinksPieFocusIndex();
    const pinnedIndex = adminDrinksPieState.pinnedIndex;
    let startAngle = -Math.PI / 2;

    data.forEach((item, i) => {
        const sliceAngle = (item.share / 100) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;
        const midAngle = startAngle + (sliceAngle / 2);
        const isFocused = focusIndex === i;
        const isMuted = pinnedIndex >= 0 && pinnedIndex !== i;
        const offset = isFocused ? 10 : 0;
        const sliceRadius = baseRadius + (isFocused ? 3 : 0);
        const sliceCx = cx + (Math.cos(midAngle) * offset);
        const sliceCy = cy + (Math.sin(midAngle) * offset);

        ctx.save();
        ctx.globalAlpha = isMuted ? 0.28 : 1;
        ctx.beginPath();
        ctx.moveTo(sliceCx, sliceCy);
        ctx.arc(sliceCx, sliceCy, sliceRadius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = ADMIN_DRINKS_PIE_COLORS[i % ADMIN_DRINKS_PIE_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = isFocused ? 2.8 : 1.5;
        ctx.stroke();
        ctx.restore();

        adminDrinksPieState.slices.push({
            startAngle,
            endAngle,
            radius: sliceRadius,
            cx: sliceCx,
            cy: sliceCy
        });
        startAngle = endAngle;
    });

    legendEl.innerHTML = data
        .map((item, i) => {
            const isFocused = focusIndex === i;
            const isMuted = pinnedIndex >= 0 && pinnedIndex !== i;
            const classes = [
                'pie-legend-item',
                isFocused ? 'is-active' : '',
                isMuted ? 'is-muted' : ''
            ].filter(Boolean).join(' ');
            const color = ADMIN_DRINKS_PIE_COLORS[i % ADMIN_DRINKS_PIE_COLORS.length];
            return `<button type="button" class="${classes}" data-index="${i}" aria-pressed="${pinnedIndex === i ? 'true' : 'false'}"><span class="pie-legend-dot" style="background:${color}"></span><span>${escapeHtml(item.name)}: ${item.qty.toLocaleString()} cases (${item.share.toFixed(1)}%)</span></button>`;
        })
        .join('');
}

function bindAdminDrinksPieInteractions() {
    const canvas = document.getElementById('adminDrinksPieCanvas');
    const legendEl = document.getElementById('adminDrinksPieLegend');
    if (!canvas || !legendEl) return;

    if (!canvas.dataset.bound) {
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
            const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
            const hitIndex = getAdminDrinksPieHitIndex(x, y);
            if (hitIndex !== adminDrinksPieState.hoverIndex) {
                adminDrinksPieState.hoverIndex = hitIndex;
                drawAdminDrinksPieChart();
            }
            canvas.style.cursor = hitIndex >= 0 ? 'pointer' : 'default';
            if (hitIndex >= 0) {
                showAdminDrinksPieTooltip(adminDrinksPieState.data[hitIndex], event.clientX, event.clientY);
            } else {
                hideAdminDrinksPieTooltip();
            }
        });

        canvas.addEventListener('mouseleave', () => {
            if (adminDrinksPieState.hoverIndex !== -1) {
                adminDrinksPieState.hoverIndex = -1;
                drawAdminDrinksPieChart();
            }
            canvas.style.cursor = 'default';
            hideAdminDrinksPieTooltip();
        });

        canvas.addEventListener('click', (event) => {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
            const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
            const hitIndex = getAdminDrinksPieHitIndex(x, y);
            adminDrinksPieState.pinnedIndex = adminDrinksPieState.pinnedIndex === hitIndex ? -1 : hitIndex;
            drawAdminDrinksPieChart();
        });

        canvas.dataset.bound = '1';
    }

    if (!legendEl.dataset.bound) {
        legendEl.addEventListener('mouseover', (event) => {
            const target = event.target instanceof Element ? event.target.closest('.pie-legend-item') : null;
            if (!target) return;
            const index = Number(target.getAttribute('data-index'));
            if (!Number.isFinite(index)) return;
            adminDrinksPieState.hoverIndex = index;
            drawAdminDrinksPieChart();
        });

        legendEl.addEventListener('mouseout', (event) => {
            const leavingItem = event.target instanceof Element ? event.target.closest('.pie-legend-item') : null;
            if (!leavingItem) return;
            const enteringItem = event.relatedTarget instanceof Element ? event.relatedTarget.closest('.pie-legend-item') : null;
            if (enteringItem) return;
            adminDrinksPieState.hoverIndex = -1;
            drawAdminDrinksPieChart();
            hideAdminDrinksPieTooltip();
        });

        legendEl.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target.closest('.pie-legend-item') : null;
            if (!target) return;
            event.preventDefault();
            const index = Number(target.getAttribute('data-index'));
            if (!Number.isFinite(index)) return;
            adminDrinksPieState.pinnedIndex = adminDrinksPieState.pinnedIndex === index ? -1 : index;
            drawAdminDrinksPieChart();
        });

        legendEl.dataset.bound = '1';
    }
}

function renderAdminDrinksPieChart() {
    const container = document.getElementById('adminDrinksPieContainer');
    const canvas = document.getElementById('adminDrinksPieCanvas');
    const legendEl = document.getElementById('adminDrinksPieLegend');
    if (!container || !canvas || !legendEl) return;

    adminDrinksPieState.data = getAdminDrinksPieData();
    if (adminDrinksPieState.pinnedIndex >= adminDrinksPieState.data.length) {
        adminDrinksPieState.pinnedIndex = -1;
    }
    if (adminDrinksPieState.hoverIndex >= adminDrinksPieState.data.length) {
        adminDrinksPieState.hoverIndex = -1;
    }

    bindAdminDrinksPieInteractions();
    drawAdminDrinksPieChart();
}

function toggleAdminDrinksPieChart() {
    const container = document.getElementById('adminDrinksPieContainer');
    if (!container) return;
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
    if (isVisible) {
        adminDrinksPieState.hoverIndex = -1;
        hideAdminDrinksPieTooltip();
        return;
    }
    renderAdminDrinksPieChart();
}

function getBusinessAiAdvisorSuggestions(analysis) {
    const suggestions = [];
    const growth = Number(analysis?.growthPercent) || 0;
    const topProducts = Array.isArray(analysis?.topProducts) ? analysis.topProducts : [];
    const totalQuantity = Number(analysis?.totalQuantity) || 0;
    const growthTone = growth > 1 ? 'positive' : (growth < -1 ? 'negative' : 'neutral');
    const growthHeadline = growth >= 0
        ? `Revenue is trending up. Keep pressure on high-converting days.`
        : `Revenue is trending down. Trigger a short recovery campaign this week.`;
    suggestions.push({
        title: 'Revenue Momentum',
        metric: formatSignedPercent(growth),
        tone: growthTone,
        detail: `${growthHeadline} Period total is ${formatRwf(analysis.currentTotal)} over ${analysis.windowDays} days.`
    });

    const consistencyTone = analysis.consistencyPercent >= 70 ? 'positive' : (analysis.consistencyPercent >= 45 ? 'warning' : 'negative');
    suggestions.push({
        title: 'Sales Consistency',
        metric: `${analysis.activeDays}/${analysis.windowDays} days`,
        tone: consistencyTone,
        detail: `You had sales activity on ${analysis.consistencyPercent.toFixed(0)}% of days. Focus outreach on zero-sales days.`
    });

    const creditShare = Number(analysis.creditSharePercent) || 0;
    const creditTone = creditShare > 35 ? 'warning' : 'positive';
    suggestions.push({
        title: 'Credit Exposure',
        metric: `${creditShare.toFixed(1)}%`,
        tone: creditTone,
        detail: creditShare > 35
            ? 'Credit share is high. Encourage same-day payment incentives for risky accounts.'
            : 'Credit share is healthy. Continue balancing credit and cash sales.'
    });

    if (topProducts.length > 0) {
        const bestSeller = topProducts[0];
        const bestSellerQty = Number(bestSeller.qty) || 0;
        const bestSellerShare = totalQuantity > 0
            ? (bestSellerQty / totalQuantity) * 100
            : (Number(analysis?.favoriteDrinkSharePercent) || 0);
        suggestions.push({
            title: 'Customer Favorite',
            metric: `${bestSellerShare.toFixed(0)}%`,
            tone: bestSellerShare >= 45 ? 'positive' : 'neutral',
            detail: `${bestSeller.name} is loved by ${bestSellerShare.toFixed(0)}% of sold cases (${bestSellerQty.toLocaleString()} of ${Math.max(1, Math.round(totalQuantity)).toLocaleString()}). Keep it fully stocked.`
        });
        suggestions.push({
            title: 'Best Seller Focus',
            metric: `${bestSeller.qty} cases`,
            tone: 'positive',
            detail: `${bestSeller.name} leads volume. Keep buffer stock and bundle it with slower drinks.`
        });
    }

    if (analysis?.topDebtFollowUp && Number(analysis.topDebtFollowUp.owing) > 0) {
        const days = Number.isFinite(analysis.topDebtFollowUp.daysOutstanding)
            ? Math.max(0, Number(analysis.topDebtFollowUp.daysOutstanding))
            : null;
        const daysLabel = days === null
            ? 'for a while'
            : `for ${days} day${days === 1 ? '' : 's'}`;
        suggestions.push({
            title: 'Debt Follow-up',
            metric: days === null ? formatRwf(analysis.topDebtFollowUp.owing) : `${days} days`,
            tone: days !== null && days >= 14 ? 'negative' : 'warning',
            detail: `Tell ${analysis.topDebtFollowUp.name} to pay back ${formatRwf(analysis.topDebtFollowUp.owing)}. This balance has been pending ${daysLabel}.`
        });
    }

    if ((Number(analysis?.overdueDebtCount) || 0) > 0) {
        const overdueCount = Number(analysis.overdueDebtCount) || 0;
        suggestions.push({
            title: 'Overdue Debt Queue',
            metric: `${overdueCount} overdue`,
            tone: overdueCount >= 3 ? 'warning' : 'neutral',
            detail: `${overdueCount} customer account(s) are over 7 days old, totaling ${formatRwf(analysis.outstandingDebtTotal || 0)}. Plan reminder calls today.`
        });
    }

    if (analysis && Number.isFinite(analysis.weekendLiftPercent)) {
        const weekendTone = analysis.weekendLiftPercent > 4 ? 'positive' : 'neutral';
        suggestions.push({
            title: 'Weekend Pattern',
            metric: formatSignedPercent(analysis.weekendLiftPercent),
            tone: weekendTone,
            detail: analysis.weekendLiftPercent > 4
                ? 'Weekends are stronger than weekdays. Increase Friday stock and staffing.'
                : 'Weekend effect is weak. Run targeted weekend promotions to lift demand.'
        });
    }

    if (analysis?.slowestWeekday?.name) {
        suggestions.push({
            title: 'Slow Day Recovery',
            metric: analysis.slowestWeekday.name,
            tone: 'warning',
            detail: `Use ${analysis.slowestWeekday.name} for combo offers, call-backs, and debt follow-ups to recover volume.`
        });
    }

    if ((analysis?.lowStockCount || 0) > 0) {
        suggestions.push({
            title: 'Stock Pressure',
            metric: `${analysis.lowStockCount} low`,
            tone: 'warning',
            detail: 'Low-stock items can break momentum. Prioritize restock before next peak day.'
        });
    }

    return suggestions.slice(0, 9);
}

async function runBusinessAiAdvisor(silent = false) {
    const output = document.getElementById('businessAiAdvisorOutput');
    const trigger = document.getElementById('runBusinessAiAdvisorBtn');

    if (!canAccessAdminPanel()) {
        if (output) {
            output.innerHTML = '<p style="margin: 0; color: #c64545;">Permission Denied</p>';
        }
        if (!silent) {
            alert('Permission Denied');
        }
        return 'Permission Denied';
    }

    const refreshedAnalysis = renderAdminBusinessAnalysisTab();
    const analysis = (refreshedAnalysis && typeof refreshedAnalysis === 'object')
        ? refreshedAnalysis
        : (cachedAdminGrowthAnalysis || getAdminBusinessAnalysisData(selectedAdminGrowthWindowDays));
    if (!analysis || typeof analysis !== 'object') {
        return 'Permission Denied';
    }

    if (output) {
        output.classList.add('is-generating');
        output.innerHTML = `
            <div class="advisor-loading">
                <div class="advisor-loading-line w50"></div>
                <div class="advisor-loading-line w85"></div>
                <div class="advisor-loading-line w70"></div>
                <div class="advisor-loading-line w92"></div>
            </div>
        `;
    }
    if (trigger) {
        trigger.disabled = true;
        trigger.classList.add('is-generating');
        trigger.dataset.defaultLabel = trigger.dataset.defaultLabel || trigger.textContent || 'Generate Suggestions';
        trigger.textContent = 'Generating...';
    }

    await new Promise((resolve) => setTimeout(resolve, 760));

    const suggestions = getBusinessAiAdvisorSuggestions(analysis);
    if (output) {
        const generatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        output.innerHTML = `
            <div class="advisor-meta-row">
                <span class="advisor-meta-pill">Updated ${escapeHtml(generatedAt)}</span>
                <span class="advisor-meta-pill neutral">${analysis.windowDays}-day model</span>
            </div>
            <div class="advisor-insight-grid">
                ${suggestions.map((item) => `
                    <article class="advisor-insight-card ${escapeHtml(item.tone || 'neutral')}">
                        <div class="advisor-insight-head">
                            <h5>${escapeHtml(item.title || 'Suggestion')}</h5>
                            <span class="advisor-insight-metric">${escapeHtml(String(item.metric || ''))}</span>
                        </div>
                        <p>${escapeHtml(item.detail || '')}</p>
                    </article>
                `).join('')}
            </div>
        `;
        output.classList.remove('is-generating');
    }
    if (trigger) {
        trigger.disabled = false;
        trigger.classList.remove('is-generating');
        trigger.textContent = trigger.dataset.defaultLabel || 'Generate Suggestions';
    }

    if (!silent) {
        showSuccessToast('Business advisor updated.');
    }
    return suggestions;
}

function getAdminGrowthInsights() {
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(recentStart.getDate() - 29);
    recentStart.setHours(0, 0, 0, 0);

    const prevStart = new Date(recentStart);
    prevStart.setDate(prevStart.getDate() - 30);
    const prevEnd = new Date(recentStart);

    const recentSales = (Array.isArray(sales) ? sales : []).filter((sale) => {
        const dt = getSaleDateTimeOrNull(sale);
        return dt && dt >= recentStart && dt <= now;
    });
    const previousSales = (Array.isArray(sales) ? sales : []).filter((sale) => {
        const dt = getSaleDateTimeOrNull(sale);
        return dt && dt >= prevStart && dt < prevEnd;
    });

    const recentTotal = recentSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const previousTotal = previousSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const growthRate = previousTotal > 0
        ? ((recentTotal - previousTotal) / previousTotal) * 100
        : (recentTotal > 0 ? 100 : 0);

    const recentCredit = recentSales
        .filter((sale) => sale.type === 'credit')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const creditShare = recentTotal > 0 ? (recentCredit / recentTotal) * 100 : 0;

    const drinkTotals = new Map();
    recentSales.forEach((sale) => {
        const key = String(sale.drinkName || 'Unknown').trim();
        if (!key) return;
        if (!drinkTotals.has(key)) {
            drinkTotals.set(key, { qty: 0, total: 0 });
        }
        const current = drinkTotals.get(key);
        current.qty += Number(sale.quantity) || 0;
        current.total += Number(sale.total) || 0;
    });
    const topDrinks = Array.from(drinkTotals.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 3)
        .map(([name, stats]) => `${name} (${stats.qty} cases)`);

    const lowStockItems = getLowStockDrinks();
    const unsoldDrinks = drinks
        .filter((drink) => !drinkTotals.has(String(drink.name || '').trim()))
        .slice(0, 3)
        .map((drink) => String(drink.name || '').trim())
        .filter(Boolean);

    const insights = [];
    insights.push(
        growthRate >= 0
            ? `Sales growth is +${growthRate.toFixed(1)}% vs previous 30 days. Keep pushing best sellers with bundle deals.`
            : `Sales growth is ${growthRate.toFixed(1)}% vs previous 30 days. Run a 7-day promo on high-margin drinks.`
    );
    if (topDrinks.length > 0) {
        insights.push(`Top movers: ${topDrinks.join(', ')}. Keep these in priority stock and near checkout.`);
    } else {
        insights.push('No recent sales detected. Start with a small launch offer and daily customer follow-up.');
    }
    if (creditShare > 35) {
        insights.push(`Credit sales are ${creditShare.toFixed(1)}% of revenue. Tighten credit terms and increase cash incentives.`);
    } else {
        insights.push(`Credit sales are controlled at ${creditShare.toFixed(1)}%. Offer small discounts for same-day cash payment.`);
    }
    if (lowStockItems.length > 0) {
        const names = lowStockItems.slice(0, 3).map((drink) => drink.name).join(', ');
        insights.push(`Restock alert: ${lowStockItems.length} item(s) low/out. Prioritize: ${names}.`);
    }
    if (unsoldDrinks.length > 0) {
        insights.push(`Slow movers this month: ${unsoldDrinks.join(', ')}. Consider a combo with top sellers or reduce reorder quantity.`);
    }

    return insights;
}

function runAdminGrowthAnalysis(silent = false) {
    const output = document.getElementById('adminAiInsights');
    if (!output) return;

    if (!canAccessAdminPanel()) {
        if (!silent) alert('Only an active admin session can run AI analysis.');
        output.innerHTML = `<p style="margin: 0; color: #6f8ca7;">${escapeHtml(t('adminAnalysisRequiresSession'))}</p>`;
        return;
    }

    const insights = getAdminGrowthInsights();
    output.innerHTML = `
        <ul>
            ${insights.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
    `;

    if (!silent) {
        showSuccessToast('AI growth analysis updated.');
    }
}

function exportAdminDailySalesPDF(dayIsoOverride = '') {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export daily sales.');
        return;
    }

    const dateInput = document.getElementById('adminSalesExportDate');
    const selectedDate = String(dayIsoOverride || dateInput?.value || getTodayISODate()).trim() || getTodayISODate();
    if (dateInput) dateInput.value = selectedDate;

    const daySales = getSalesForSpecificDay(selectedDate);
    if (!daySales.length) {
        alert(t('adminExportDayNoSales'));
        return;
    }

    const totalSales = daySales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const cashSales = daySales
        .filter((sale) => sale.type === 'normal')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const creditSales = daySales
        .filter((sale) => sale.type === 'credit')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const totalProfit = calculateProfitFromSales(daySales);

    try {
        const doc = createPDFDocument({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const reportTitle = `Daily Sales ${selectedDate}`;
        let y = applyPdfBrandHeader(doc, reportTitle);
        const margin = 14;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(12, 96, 156);
        doc.text(`Daily Sales Summary - ${formatPdfDate(selectedDate)}`, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`Transactions: ${daySales.length}`, margin, y);
        doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 54, y);
        doc.text(`Profit: RWF ${totalProfit.toLocaleString()}`, margin + 124, y);
        y += 5;
        doc.text(`Cash: RWF ${cashSales.toLocaleString()}`, margin, y);
        doc.text(`Credit: RWF ${creditSales.toLocaleString()}`, margin + 54, y);
        y += 6;

        const tableRows = daySales.map((sale) => {
            const saleDate = getSaleDateTimeOrNull(sale);
            const customerName = sale.type === 'credit'
                ? (typeof getSafeCustomerName === 'function' ? getSafeCustomerName(sale.customerId) : 'Customer')
                : 'Guest';
            return [
                saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                String(sale.drinkName || 'Unknown'),
                String(Number(sale.quantity) || 0),
                `RWF ${Number(sale.unitPrice || 0).toLocaleString()}`,
                `RWF ${Number(sale.total || 0).toLocaleString()}`,
                sale.type === 'credit' ? 'Credit' : 'Cash',
                String(customerName || 'Guest')
            ];
        });

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                head: [['Time', 'Drink', 'Qty', 'Unit Price', 'Total', 'Type', 'Customer']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 8.8, cellPadding: 2.4 },
                headStyles: { fillColor: [13, 124, 227], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 250, 255] }
            });
        } else {
            doc.setFontSize(9);
            tableRows.slice(0, 28).forEach((row, idx) => {
                const yy = y + (idx * 5);
                doc.text(`${row[0]} | ${row[1]} | ${row[2]} | ${row[4]} | ${row[5]}`, margin, yy);
            });
        }

        applyPdfBrandFooter(doc, reportTitle);
        doc.save(`admin-daily-sales-${selectedDate}.pdf`);
        showSuccessToast(`Daily sales PDF exported for ${selectedDate}.`);
    } catch (error) {
        console.error('Admin daily sales export failed:', error);
        alert(`Could not export day PDF: ${error.message}`);
    }
}

function exportAdminAllSalesPDF() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export sales.');
        return;
    }

    const allSales = (Array.isArray(sales) ? sales : [])
        .filter((sale) => !!getSaleDateTimeOrNull(sale))
        .slice()
        .sort((a, b) => {
            const aDate = getSaleDateTimeOrNull(a);
            const bDate = getSaleDateTimeOrNull(b);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });

    if (!allSales.length) {
        alert(t('adminNoSalesDataYet'));
        return;
    }

    const totalSales = allSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const cashSales = allSales
        .filter((sale) => sale.type === 'normal')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const creditSales = allSales
        .filter((sale) => sale.type === 'credit')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const totalProfit = calculateProfitFromSales(allSales);

    const firstDay = getSaleDateIso(allSales[0]);
    const lastDay = getSaleDateIso(allSales[allSales.length - 1]);
    const rangeLabel = firstDay && lastDay ? `${formatPdfDate(firstDay)} - ${formatPdfDate(lastDay)}` : 'All time';

    try {
        const doc = createPDFDocument({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const reportTitle = 'All Sales';
        let y = applyPdfBrandHeaderFirstPageOnly(doc, reportTitle);
        const margin = 14;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(12, 96, 156);
        doc.text(`All Sales Summary`, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`Range: ${rangeLabel}`, margin, y);
        y += 5;
        doc.text(`Transactions: ${allSales.length}`, margin, y);
        doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 54, y);
        doc.text(`Profit: RWF ${totalProfit.toLocaleString()}`, margin + 124, y);
        y += 5;
        doc.text(`Cash: RWF ${cashSales.toLocaleString()}`, margin, y);
        doc.text(`Credit: RWF ${creditSales.toLocaleString()}`, margin + 54, y);
        y += 7;

        const tableRows = allSales.map((sale) => {
            const saleDate = getSaleDateTimeOrNull(sale);
            const dayIso = saleDate ? saleDate.toISOString().slice(0, 10) : '';
            const customerName = sale.type === 'credit'
                ? (typeof getSafeCustomerName === 'function' ? getSafeCustomerName(sale.customerId) : 'Customer')
                : 'Guest';
            return [
                dayIso ? formatPdfDate(dayIso) : '-',
                saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                String(sale.drinkName || 'Unknown'),
                String(Number(sale.quantity) || 0),
                `RWF ${Number(sale.unitPrice || 0).toLocaleString()}`,
                `RWF ${Number(sale.total || 0).toLocaleString()}`,
                sale.type === 'credit' ? 'Credit' : 'Cash',
                String(customerName || 'Guest')
            ];
        });

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                head: [['Date', 'Time', 'Drink', 'Qty', 'Unit Price', 'Total', 'Type', 'Customer']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 8.4, cellPadding: 2.2 },
                headStyles: { fillColor: [13, 124, 227], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 250, 255] }
            });
        } else {
            doc.setFontSize(8.5);
            tableRows.slice(0, 26).forEach((row, idx) => {
                const yy = y + (idx * 4.8);
                doc.text(`${row[0]} ${row[1]} | ${row[2]} | ${row[3]} | ${row[5]} | ${row[6]}`, margin, yy);
            });
        }

        applyPdfBrandFooter(doc, reportTitle);
        const todayIso = new Date().toISOString().slice(0, 10);
        doc.save(`admin-all-sales-${todayIso}.pdf`);
        showSuccessToast('All sales PDF exported.');
    } catch (error) {
        console.error('Admin all sales export failed:', error);
        alert(`Could not export all sales PDF: ${error.message}`);
    }
}

function exportAdminStockAuditPDF() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export stock audit PDF.');
        return;
    }
    exportStockManagementPDF();
}

function renderAdminPanel() {
    const body = document.getElementById('adminUsersBody');
    const totalEl = document.getElementById('adminSummaryTotal');
    const privilegedEl = document.getElementById('adminSummaryPrivileged');
    const staffEl = document.getElementById('adminSummaryStaff');
    const inactiveEl = document.getElementById('adminSummaryInactive');
    if (!body || !totalEl || !privilegedEl || !staffEl || !inactiveEl) return;

    configureDatePickers();
    renderAdminDailySalesSummary();
    renderAdminSalesStockManagement();
    setAdminMainTab(activeAdminMainTab);
    if (activeAdminMainTab === 'sales') {
        setAdminSalesSubTab(activeAdminSalesSubTab);
    }

    const tabsBar = document.getElementById('adminMainTabsBar');
    if (tabsBar) {
        tabsBar.style.display = isAdminSessionActive() ? 'none' : '';
    }

    const users = getAuthUsers();
    const privilegedCount = users.filter((user) => isAdminRoleUser(user)).length;
    const staffCount = users.filter((user) => normalizeAuthRole(user.role, 'staff') === 'staff').length;
    const inactiveCount = users.filter((user) => !isUserAccountActive(user)).length;

    totalEl.textContent = String(users.length);
    privilegedEl.textContent = String(privilegedCount);
    staffEl.textContent = String(staffCount);
    inactiveEl.textContent = String(inactiveCount);

    if (!canAccessAdminPanel()) {
        body.innerHTML = '<tr><td colspan="6" style="padding: 30px; text-align: center; color: #789;">Only admin/owner accounts can view this page.</td></tr>';
        return;
    }

    const entries = getFilteredAdminUserEntries();
    clearElement(body);

    if (entries.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: #789;">${escapeHtml(t('adminNoEmployersMatch'))}</td></tr>`;
        return;
    }

    const canManage = canManageAdminAccounts();
    const activeId = getAuthSessionUserId(activeUser);

    entries.forEach(({ user, index }) => {
        const role = normalizeAuthRole(user.role, 'staff');
        const roleLabel = normalizeUserRoleLabel(role);
        const roleClass = role === 'owner' ? 'admin-role-owner' : (role === 'admin' ? 'admin-role-admin' : 'admin-role-staff');
        const isActive = isUserAccountActive(user);
        const statusClass = isActive ? 'admin-status-active' : 'admin-status-inactive';
        const statusLabel = isActive ? 'Active' : 'Inactive';
        const isSelf = getAuthSessionUserId(user) === activeId;

        const canResetPin = canManage || (!canManage && !isAdminRoleUser(user));
        const canResetAdminPin = canManage && isAdminRoleUser(user);
        const canToggleRole = canManage && !isSelf;
        const canToggleStatus = canManage && !isSelf;
        const roleToggleLabel = role === 'staff' ? 'Make Admin' : 'Make Staff';
        const statusToggleLabel = isActive ? 'Deactivate' : 'Activate';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${escapeHtml(user.name || 'Unnamed User')}</strong>
                <div class="admin-contact-line">${escapeHtml(user.phone || '-')}</div>
                <div class="admin-contact-line">${escapeHtml(user.email || '-')}</div>
            </td>
            <td><span class="admin-pill ${roleClass}">${roleLabel}</span></td>
            <td><span class="admin-pill ${statusClass}">${statusLabel}</span></td>
            <td>${escapeHtml(getAuthProviderLabel(user))}</td>
            <td>${escapeHtml(formatAppDateTime(user.lastLoginAt, 'Never'))}</td>
            <td>
                <div class="admin-action-row">
                    <button class="admin-action-btn secondary" onclick="viewUserDataSnapshot(${index})">Data</button>
                    <button class="admin-action-btn" onclick="adminResetUserPin(${index})" ${canResetPin ? '' : 'disabled'}>Reset PIN</button>
                    <button class="admin-action-btn" onclick="adminResetUserAdminPin(${index})" ${canResetAdminPin ? '' : 'disabled'}>Reset Admin PIN</button>
                    <button class="admin-action-btn" onclick="toggleUserRole(${index})" ${canToggleRole ? '' : 'disabled'}>${roleToggleLabel}</button>
                    <button class="admin-action-btn danger" onclick="toggleUserActiveStatus(${index})" ${canToggleStatus ? '' : 'disabled'}>${statusToggleLabel}</button>
                </div>
            </td>
        `;
        body.appendChild(row);
    });
}

async function saveAuthUsersWithFeedback(successMessage = '') {
    normalizeAuthUsersData();
    await saveNamedData(APP_META_STORAGE_KEY, appMeta);
    refreshAdminAccessUI();
    refreshDataManagementAccessUI();
    renderAdminPanel();
    if (successMessage) showSuccessToast(successMessage);
}

async function toggleUserRole(index) {
    if (!canManageAdminAccounts()) {
        alert('Only the owner can change account roles.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;
    if (getAuthSessionUserId(target) === getAuthSessionUserId(activeUser)) {
        alert('You cannot change your own role while logged in.');
        return;
    }

    const currentRole = normalizeAuthRole(target.role, 'staff');
    const nextRole = currentRole === 'staff' ? 'admin' : 'staff';
    if (currentRole === 'owner') {
        const ownerCount = users.filter((user) => normalizeAuthRole(user.role, 'staff') === 'owner').length;
        if (ownerCount <= 1) {
            alert('At least one owner account must remain.');
            return;
        }
    }

    target.role = nextRole;
    if (nextRole === 'staff') {
        target.adminPin = '';
    }
    target.updatedAt = new Date().toISOString();
    appMeta.authUsers = users;
    await saveAuthUsersWithFeedback(`Role updated for ${target.name || 'user'}.`);
}

async function toggleUserActiveStatus(index) {
    if (!canManageAdminAccounts()) {
        alert('Only the owner can activate or deactivate accounts.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;
    if (getAuthSessionUserId(target) === getAuthSessionUserId(activeUser)) {
        alert('You cannot deactivate your own account.');
        return;
    }

    const role = normalizeAuthRole(target.role, 'staff');
    const nextActive = !isUserAccountActive(target);
    if (!nextActive && role === 'owner') {
        const activeOwners = users.filter(
            (user) => normalizeAuthRole(user.role, 'staff') === 'owner' && isUserAccountActive(user)
        ).length;
        if (activeOwners <= 1) {
            alert('At least one active owner account is required.');
            return;
        }
    }

    target.isActive = nextActive;
    target.updatedAt = new Date().toISOString();
    appMeta.authUsers = users;
    await saveAuthUsersWithFeedback(`${target.name || 'User'} is now ${nextActive ? 'active' : 'inactive'}.`);
}

async function adminResetUserPin(index) {
    if (!canAccessAdminPanel()) {
        alert('You do not have admin access.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;
    if (!canManageAdminAccounts() && isAdminRoleUser(target)) {
        alert('Only the owner can reset admin/owner PINs.');
        return;
    }

    const pinRaw = window.prompt(`Set a new 5-digit PIN for ${target.name || 'this user'}:`, '');
    if (pinRaw === null) return;
    const nextPin = String(pinRaw || '').trim();
    if (!/^\d{5}$/.test(nextPin)) {
        alert(t('authPinRules'));
        return;
    }

    target.pin = nextPin;
    target.updatedAt = new Date().toISOString();
    appMeta.authUsers = users;
    await saveAuthUsersWithFeedback(`PIN reset for ${target.name || 'user'}.`);
}

async function adminResetUserAdminPin(index) {
    if (!canManageAdminAccounts()) {
        alert('Only the owner can reset admin PINs.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;
    if (!isAdminRoleUser(target)) {
        alert('This user does not have admin privileges.');
        return;
    }

    const pinRaw = window.prompt(`Set a new 5-digit Admin PIN for ${target.name || 'this user'}:`, '');
    if (pinRaw === null) return;
    const nextPin = String(pinRaw || '').trim();
    if (!/^\d{5}$/.test(nextPin)) {
        alert(t('authPinRules'));
        return;
    }
    if (nextPin === String(target.pin || '').trim()) {
        alert(t('authAdminPinMustDiffer'));
        return;
    }

    const confirmRaw = window.prompt('Confirm the new Admin PIN:', '');
    if (confirmRaw === null) return;
    const confirmPin = String(confirmRaw || '').trim();
    if (confirmPin !== nextPin) {
        alert(t('authPinMismatch'));
        return;
    }

    target.adminPin = nextPin;
    target.updatedAt = new Date().toISOString();
    appMeta.authUsers = users;
    await saveAuthUsersWithFeedback(`Admin PIN reset for ${target.name || 'user'}.`);
}

async function viewUserDataSnapshot(index) {
    if (!canAccessAdminPanel()) {
        alert('You do not have admin access.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;

    const salesKey = userDataKey('sales', target);
    const customersKey = userDataKey('customers', target);
    const clatesKey = userDataKey('clates', target);
    const drinksKey = userDataKey('drinks', target);
    if (!salesKey || !customersKey || !clatesKey || !drinksKey) {
        alert('Could not resolve this user data scope.');
        return;
    }

    const loaded = await loadManyNamedData([
        { name: salesKey, defaultValue: [] },
        { name: customersKey, defaultValue: [] },
        { name: clatesKey, defaultValue: [] },
        { name: drinksKey, defaultValue: [] }
    ]);

    const userSales = Array.isArray(loaded[salesKey]) ? loaded[salesKey] : [];
    const userCustomers = Array.isArray(loaded[customersKey]) ? loaded[customersKey] : [];
    const userClates = Array.isArray(loaded[clatesKey]) ? loaded[clatesKey] : [];
    const userDrinks = Array.isArray(loaded[drinksKey]) ? loaded[drinksKey] : [];
    const totalSalesAmount = userSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);

    alert(
        `Employer: ${target.name || 'User'}\n` +
        `Role: ${normalizeUserRoleLabel(target.role)}\n` +
        `Status: ${isUserAccountActive(target) ? 'Active' : 'Inactive'}\n\n` +
        `Sales records: ${userSales.length}\n` +
        `Sales total: RWF ${totalSalesAmount.toLocaleString()}\n` +
        `Customers: ${userCustomers.length}\n` +
        `Deposits: ${userClates.length}\n` +
        `Drinks configured: ${userDrinks.length}`
    );
}

function getAdminExportUserRows() {
    return getAuthUsers().map((user) => ({
        id: user.id || '',
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        role: normalizeUserRoleLabel(user.role),
        status: isUserAccountActive(user) ? 'Active' : 'Inactive',
        provider: getAuthProviderLabel(user),
        createdAt: formatAppDateTime(user.createdAt, 'Unknown'),
        lastLoginAt: formatAppDateTime(user.lastLoginAt, 'Never'),
        hasAdminPin: Boolean(String(user.adminPin || '').trim())
    }));
}

function exportAdminUsersPDF() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export account data.');
        return;
    }

    try {
        const rows = getAdminExportUserRows();
        if (!rows.length) {
            alert('No account data to export.');
            return;
        }

        const doc = createPDFDocument({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const reportTitle = 'Admin Accounts';
        let y = applyPdfBrandHeader(doc, reportTitle);
        const margin = 12;
        const activeCount = rows.filter((row) => row.status === 'Active').length;
        const privilegedCount = rows.filter((row) => row.role === 'Owner' || row.role === 'Admin').length;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(12, 96, 156);
        doc.text('Account Summary', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Accounts: ${rows.length}`, margin, y);
        doc.text(`Privileged: ${privilegedCount}`, margin + 52, y);
        doc.text(`Active: ${activeCount}`, margin + 90, y);
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 130, y);
        y += 6;

        const tableBody = rows.map((row) => [
            String(row.name),
            String(row.phone || '-'),
            String(row.email || '-'),
            String(row.role),
            String(row.status),
            String(row.provider),
            String(row.lastLoginAt),
            row.hasAdminPin ? 'Yes' : 'No'
        ]);

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                head: [['Name', 'Phone', 'Email', 'Role', 'Status', 'Provider', 'Last Login', 'Admin PIN']],
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 8.2, cellPadding: 2.1 },
                headStyles: { fillColor: [13, 124, 227], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 250, 255] }
            });
        } else {
            doc.setFontSize(8.5);
            tableBody.slice(0, 22).forEach((row, rowIndex) => {
                const yy = y + (rowIndex * 4.8);
                doc.text(`${row[0]} | ${row[3]} | ${row[4]} | ${row[6]}`, margin, yy);
            });
        }

        applyPdfBrandFooter(doc, reportTitle);
        doc.save(`admin-accounts-${new Date().toISOString().split('T')[0]}.pdf`);
        showSuccessToast('Admin accounts PDF exported.');
    } catch (error) {
        console.error('Admin PDF export failed:', error);
        alert(`Could not export PDF: ${error.message}`);
    }
}

// ================= PAGE NAVIGATION =================
function getLastOpenPageCacheKey(user = activeUser) {
    const userId = getUserStorageId(user);
    return userId ? `last_open_page__${userId}` : '';
}

function getRememberedOpenPage(user = activeUser) {
    let remembered = String(settings?.lastOpenPage || '').trim();
    const cacheKey = getLastOpenPageCacheKey(user);
    if (cacheKey) {
        const cached = readLocalStorageKey(cacheKey);
        if (typeof cached === 'string' && String(cached).trim()) {
            remembered = String(cached).trim();
        }
    }
    return remembered || 'home';
}

function rememberOpenPage(pageName, user = activeUser) {
    if (!user) return;
    const normalized = String(pageName || 'home').trim() || 'home';
    settings.lastOpenPage = normalized;
    const cacheKey = getLastOpenPageCacheKey(user);
    if (cacheKey) {
        writeLocalStorageKey(cacheKey, normalized);
    }
}

function showPage(pageName) {
    refreshAdminAccessUI();
    const adminSession = isAdminSessionActive();
    const adminVisiblePages = new Set(['home', 'reports', 'adminSales', 'adminAccounts', 'adminHub', 'settings']);
    let requestedPage = pageName;
    let targetPage = pageName;

    if (adminSession) {
        if (!adminVisiblePages.has(requestedPage)) {
            requestedPage = 'home';
        }
        if (requestedPage === 'adminSales') {
            activeAdminMainTab = 'sales';
            targetPage = 'adminPanel';
        } else if (requestedPage === 'adminAccounts') {
            activeAdminMainTab = 'accounts';
            targetPage = 'adminPanel';
        } else {
            targetPage = requestedPage === 'adminHub' ? 'adminPanel' : requestedPage;
        }
    } else {
        if (requestedPage === 'reports') {
            requestedPage = 'home';
            targetPage = 'home';
        }
        if (requestedPage === 'adminHub') {
            alert('Only admin/owner accounts can open Management.');
            requestedPage = 'home';
            targetPage = 'home';
        }
    }

    if (targetPage === 'adminPanel' && !canAccessAdminPanel()) {
        alert('Only admin/owner accounts can open Admin Panel.');
        requestedPage = 'home';
        targetPage = 'home';
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    // Show selected page
    const page = document.getElementById(targetPage);
    if (page) {
        page.style.display = 'block';
    }
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = btn.dataset.page === requestedPage;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    });
    const topSettingsBtn = document.getElementById('topSettingsBtn');
    if (topSettingsBtn) {
        const isSettingsPage = requestedPage === 'settings';
        topSettingsBtn.classList.toggle('active', isSettingsPage);
        topSettingsBtn.setAttribute('aria-pressed', isSettingsPage ? 'true' : 'false');
    }

    if (activeUser) rememberOpenPage(requestedPage, activeUser);
    
    // Load page-specific data
    switch(targetPage) {
        case 'home':
            updateHome();
            break;
        case 'addSale':
            updateDrinkList();
            updateQuickDrinkSelect();
            updateCustomerDropdown();
            updateCartDisplay();
            break;
        case 'stockManagement':
            renderStockManagement();
            break;
        case 'adminPanel':
            renderAdminPanel();
            break;
        case 'customers':
            displayCustomers();
            break;
        case 'clate':
            displayKosiyo();
            break;
        case 'salesHistory':
            displaySalesHistory();
            break;
        case 'reports':
            if (adminSession) {
                renderAdminBusinessAnalysisTab();
            } else {
                showDailyReport();
                addExportImportButtons();
                if (!document.getElementById('rangeStartDate')?.value || !document.getElementById('rangeEndDate')?.value) {
                    setRangeToThisMonth();
                }
            }
            break;
        case 'settings':
            loadSettings();
            break;
    }
    
    // Re-setup search listeners when switching pages
    setTimeout(setupSearchListeners, 50);
    configureDatePickers();
}

// Add export/import buttons to reports page
function addExportImportButtons() {
    const reportControls = document.querySelector('.report-controls');
    if (!reportControls) return;
    
    // Remove existing data management buttons
    const existingButtons = reportControls.querySelectorAll('.data-mgmt-btn');
    existingButtons.forEach(btn => btn.remove());
    
    // PDF Export button for current report
    const pdfBtn = document.createElement('button');
    pdfBtn.className = 'report-btn data-mgmt-btn';
    pdfBtn.textContent = 'Export PDF';
    pdfBtn.onclick = function() {
        const reportType = getCurrentReportType();
        console.log('Exporting report type:', reportType);
        exportReportToPDF(reportType);
    };
    
    reportControls.appendChild(pdfBtn);
}

// Helper function to determine current report type
function getCurrentReportType() {
    const reportOutput = document.getElementById('reportOutput');
    if (!reportOutput) return 'full';
    
    const text = reportOutput.innerText;
    if (text.includes('Daily Report')) return 'daily';
    if (text.includes('Weekly Report')) return 'weekly';
    if (text.includes('Monthly Report')) return 'monthly';
    if (text.includes('Annual Report')) return 'annual';
    return 'full';
}

function renderHomeStockWarning() {
    const banner = document.getElementById('stockWarningBanner');
    if (!banner) return;

    const lowStock = getLowStockDrinks();
    if (!lowStock.length) {
        banner.style.display = 'none';
        banner.textContent = '';
        return;
    }

    const outOfStockCount = lowStock.filter((drink) => getDrinkStockStatus(drink) === 'out').length;
    const lowCount = lowStock.length - outOfStockCount;
    const preview = lowStock
        .slice(0, 3)
        .map((drink) => `${escapeHtml(drink.name)} (${getDrinkStockQty(drink)})`)
        .join(', ');
    const remaining = lowStock.length > 3 ? ` +${lowStock.length - 3} more` : '';

    banner.innerHTML = `
        <strong>Stock Warning:</strong>
        ${outOfStockCount} out of stock, ${lowCount} low stock.
        <span>${preview}${remaining}</span>
        <button class="stock-action-btn" style="margin-left: 8px;" onclick="showPage('stockManagement')">Open Stock Management</button>
    `;
    banner.style.display = 'block';
}

function setStockFilter(filter, event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    selectedStockFilter = (filter === 'low' || filter === 'out') ? filter : 'all';

    const mapping = {
        all: document.getElementById('stockFilterAll'),
        low: document.getElementById('stockFilterLow'),
        out: document.getElementById('stockFilterOut')
    };
    Object.entries(mapping).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('active', key === selectedStockFilter);
    });

    renderStockManagement();
}

function setAdminStockFilter(filter, event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    selectedAdminStockFilter = (filter === 'low' || filter === 'out') ? filter : 'all';

    const mapping = {
        all: document.getElementById('adminStockFilterAll'),
        low: document.getElementById('adminStockFilterLow'),
        out: document.getElementById('adminStockFilterOut')
    };
    Object.entries(mapping).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('active', key === selectedAdminStockFilter);
    });

    renderAdminSalesStockManagement();
}

function getFilteredAdminStockDrinkEntries() {
    const searchInput = document.getElementById('adminStockSearch');
    const searchValue = String(searchInput ? searchInput.value : '').trim().toLowerCase();

    return drinks
        .map((drink, index) => ({ drink, index }))
        .filter(({ drink }) => {
            const status = getDrinkStockStatus(drink);
            if (selectedAdminStockFilter === 'low' && status !== 'low') return false;
            if (selectedAdminStockFilter === 'out' && status !== 'out') return false;
            if (!searchValue) return true;
            return String(drink.name || '').toLowerCase().includes(searchValue);
        });
}

function renderAdminSalesStockManagement() {
    const body = document.getElementById('adminStockManagementBody');
    const totalEl = document.getElementById('adminStockSummaryTotal');
    const lowEl = document.getElementById('adminStockSummaryLow');
    const outEl = document.getElementById('adminStockSummaryOut');
    if (!body || !totalEl || !lowEl || !outEl) return;

    normalizeDrinksData();
    const lowStockAll = getLowStockDrinks();
    const outStockAll = lowStockAll.filter((drink) => getDrinkStockStatus(drink) === 'out');

    totalEl.textContent = String(drinks.length);
    lowEl.textContent = String(lowStockAll.filter((drink) => getDrinkStockStatus(drink) === 'low').length);
    outEl.textContent = String(outStockAll.length);

    const entries = getFilteredAdminStockDrinkEntries();
    clearElement(body);

    if (entries.length === 0) {
        body.innerHTML = `<tr><td id="adminStockNoDataCell" colspan="6" style="padding: 30px; text-align: center; color: #789;">${escapeHtml(t('adminNoStockMatch'))}</td></tr>`;
        return;
    }

    entries.forEach(({ drink, index }) => {
        const stockQty = getDrinkStockQty(drink);
        const lowThreshold = getDrinkLowStockThreshold(drink);
        const status = getDrinkStockStatus(drink);
        const statusClass = status === 'out' ? 'stock-status-out' : (status === 'low' ? 'stock-status-low' : 'stock-status-ok');
        const statusLabel = getStockStatusLabel(status);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${escapeHtml(drink.name)}</strong>
                <div style="font-size: 12px; color: #6d8aa4;">Updated: ${drink.lastStockUpdatedAt ? new Date(drink.lastStockUpdatedAt).toLocaleString() : 'Never'}</div>
            </td>
            <td>RWF ${Number(drink.price || 0).toLocaleString()}</td>
            <td>
                <strong>${stockQty}</strong> case(s)
            </td>
            <td>
                <input id="adminStockThresholdInput_${index}" type="number" min="0" step="1" value="${lowThreshold}">
            </td>
            <td>
                <span class="stock-status-badge ${statusClass}">${statusLabel}</span>
            </td>
            <td>
                <div class="stock-edit-row">
                    <button class="stock-action-btn" onclick="openStockAdjustForm(${index}, 'add')">+ Add</button>
                    <button class="stock-action-btn danger" onclick="openStockAdjustForm(${index}, 'remove')">- Remove</button>
                    <button class="stock-action-btn" onclick="saveAdminStockValues(${index})">Save Alert</button>
                </div>
            </td>
        `;
        body.appendChild(row);
    });
}

function getFilteredStockDrinkEntries() {
    const searchInput = document.getElementById('stockSearch');
    const searchValue = String(searchInput ? searchInput.value : '').trim().toLowerCase();

    return drinks
        .map((drink, index) => ({ drink, index }))
        .filter(({ drink }) => {
            const status = getDrinkStockStatus(drink);
            if (selectedStockFilter === 'low' && status !== 'low') return false;
            if (selectedStockFilter === 'out' && status !== 'out') return false;
            if (!searchValue) return true;
            return String(drink.name || '').toLowerCase().includes(searchValue);
        });
}

function renderStockManagement() {
    const body = document.getElementById('stockManagementBody');
    const totalEl = document.getElementById('stockSummaryTotal');
    const lowEl = document.getElementById('stockSummaryLow');
    const outEl = document.getElementById('stockSummaryOut');
    if (!body || !totalEl || !lowEl || !outEl) return;

    normalizeDrinksData();
    const lowStockAll = getLowStockDrinks();
    const outStockAll = lowStockAll.filter((drink) => getDrinkStockStatus(drink) === 'out');

    totalEl.textContent = String(drinks.length);
    lowEl.textContent = String(lowStockAll.filter((drink) => getDrinkStockStatus(drink) === 'low').length);
    outEl.textContent = String(outStockAll.length);

    const entries = getFilteredStockDrinkEntries();
    clearElement(body);

    if (entries.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="padding: 30px; text-align: center; color: #789;">No drinks match this filter.</td></tr>';
        return;
    }

    entries.forEach(({ drink, index }) => {
        const stockQty = getDrinkStockQty(drink);
        const lowThreshold = getDrinkLowStockThreshold(drink);
        const status = getDrinkStockStatus(drink);
        const statusClass = status === 'out' ? 'stock-status-out' : (status === 'low' ? 'stock-status-low' : 'stock-status-ok');
        const statusLabel = getStockStatusLabel(status);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${escapeHtml(drink.name)}</strong>
                <div style="font-size: 12px; color: #6d8aa4;">Updated: ${drink.lastStockUpdatedAt ? new Date(drink.lastStockUpdatedAt).toLocaleString() : 'Never'}</div>
            </td>
            <td>RWF ${Number(drink.price || 0).toLocaleString()}</td>
            <td>
                <strong>${stockQty}</strong> case(s)
            </td>
            <td>
                <input id="stockThresholdInput_${index}" type="number" min="0" step="1" value="${lowThreshold}">
            </td>
            <td>
                <span class="stock-status-badge ${statusClass}">${statusLabel}</span>
            </td>
            <td>
                <div class="stock-edit-row">
                    <button class="stock-action-btn" onclick="openStockAdjustForm(${index}, 'add')">+ Add</button>
                    <button class="stock-action-btn danger" onclick="openStockAdjustForm(${index}, 'remove')">- Remove</button>
                    <button class="stock-action-btn" onclick="saveStockValues(${index})">Save Alert</button>
                </div>
            </td>
        `;
        body.appendChild(row);
    });
}

function ensureStockAdjustOverlayBindings() {
    const overlay = document.getElementById('stockAdjustOverlay');
    if (!overlay) return;
    if (overlay.dataset.bound) return;
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeStockAdjustForm();
    });
    overlay.dataset.bound = '1';
}

async function saveStockValues(index) {
    const drink = drinks[index];
    if (!drink) return;

    const thresholdInput = document.getElementById(`stockThresholdInput_${index}`);
    const lowStockThreshold = normalizeStockValue(
        thresholdInput ? thresholdInput.value : drink.lowStockThreshold,
        getDrinkLowStockThreshold(drink)
    );

    drink.lowStockThreshold = lowStockThreshold;
    drink.lastStockUpdatedAt = new Date().toISOString();

    await optimizedSaveData();
    updateQuickDrinkSelect();
    updateDrinkList();
    updateCartDisplay();
    updateHome();
    renderStockManagement();
    renderAdminSalesStockManagement();
    showSuccessToast(`Low stock alert updated for ${drink.name}.`);
}

async function saveAdminStockValues(index) {
    const drink = drinks[index];
    if (!drink) return;

    const thresholdInput = document.getElementById(`adminStockThresholdInput_${index}`);
    const lowStockThreshold = normalizeStockValue(
        thresholdInput ? thresholdInput.value : drink.lowStockThreshold,
        getDrinkLowStockThreshold(drink)
    );

    drink.lowStockThreshold = lowStockThreshold;
    drink.lastStockUpdatedAt = new Date().toISOString();

    await optimizedSaveData();
    updateQuickDrinkSelect();
    updateDrinkList();
    updateCartDisplay();
    updateHome();
    renderStockManagement();
    renderAdminSalesStockManagement();
    showSuccessToast(`Low stock alert updated for ${drink.name}.`);
}

function openStockAdjustForm(index, direction) {
    const drink = drinks[index];
    if (!drink) return;

    pendingStockAdjustContext = {
        index,
        direction: direction === 'remove' ? 'remove' : 'add'
    };

    const overlay = document.getElementById('stockAdjustOverlay');
    const titleEl = document.getElementById('stockAdjustTitle');
    const infoEl = document.getElementById('stockAdjustDrinkInfo');
    const qtyInput = document.getElementById('stockAdjustQtyInput');
    const noteInput = document.getElementById('stockAdjustNoteInput');
    const submitBtn = document.getElementById('stockAdjustSubmitBtn');

    if (titleEl) titleEl.textContent = pendingStockAdjustContext.direction === 'remove' ? 'Remove Stock' : 'Add Stock';
    if (infoEl) {
        infoEl.textContent = `${drink.name} | Current stock: ${getDrinkStockQty(drink)} case(s)`;
    }
    if (qtyInput) qtyInput.value = '1';
    if (noteInput) noteInput.value = '';
    if (submitBtn) submitBtn.textContent = pendingStockAdjustContext.direction === 'remove' ? 'Remove' : 'Add';
    if (overlay) overlay.style.display = 'block';
    if (qtyInput) qtyInput.focus();
}

function closeStockAdjustForm() {
    const overlay = document.getElementById('stockAdjustOverlay');
    if (overlay) overlay.style.display = 'none';
    pendingStockAdjustContext = null;
}

async function confirmStockAdjustment() {
    if (!pendingStockAdjustContext) return;
    const qtyInput = document.getElementById('stockAdjustQtyInput');
    const noteInput = document.getElementById('stockAdjustNoteInput');
    const qty = normalizeStockValue(qtyInput ? qtyInput.value : 0, 0);
    if (qty <= 0) {
        alert('Enter a stock quantity greater than zero.');
        return;
    }
    const applied = await applyStockAdjustment(
        pendingStockAdjustContext.index,
        pendingStockAdjustContext.direction,
        qty,
        noteInput ? String(noteInput.value || '').trim() : ''
    );
    if (applied) closeStockAdjustForm();
}

async function applyStockAdjustment(index, direction, qtyInputValue = null, note = '') {
    const drink = drinks[index];
    if (!drink) return false;

    const qty = normalizeStockValue(qtyInputValue, 0);
    if (qty <= 0) {
        alert('Enter a stock quantity greater than zero.');
        return false;
    }

    const currentQty = getDrinkStockQty(drink);
    if (direction === 'remove' && qty > currentQty) {
        alert(`Cannot remove ${qty}. Only ${currentQty} case(s) available.`);
        return false;
    }

    const normalizedDirection = direction === 'remove' ? 'remove' : 'add';
    const nextQty = normalizedDirection === 'remove'
        ? Math.max(0, currentQty - qty)
        : currentQty + qty;
    const cleanNote = String(note || '').trim().slice(0, 160);

    drink.stockQty = nextQty;
    recordDrinkStockEvent(drink, {
        action: normalizedDirection,
        quantity: qty,
        beforeQty: currentQty,
        afterQty: nextQty,
        reason: cleanNote
    });
    drink.lastStockUpdatedAt = new Date().toISOString();

    await optimizedSaveData();
    updateQuickDrinkSelect();
    updateDrinkList();
    updateCartDisplay();
    updateHome();
    renderStockManagement();
    renderAdminSalesStockManagement();
    const noteText = cleanNote ? ` (${cleanNote})` : '';
    showSuccessToast(`${drink.name} stock ${normalizedDirection === 'remove' ? 'reduced' : 'increased'} by ${qty}${noteText}.`);
    return true;
}

function exportStockManagementPDF() {
    try {
        normalizeDrinksData();
        if (!drinks.length) {
            alert('No stock data to export.');
            return;
        }

        const doc = createPDFDocument({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const reportTitle = 'Stock Management Report';
        let y = applyPdfBrandHeader(doc, reportTitle);
        const margin = 14;

        const lowStock = getLowStockDrinks();
        const outOfStock = lowStock.filter((drink) => getDrinkStockStatus(drink) === 'out');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(12, 96, 156);
        doc.text('Stock Summary', margin, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Drinks: ${drinks.length}`, margin, y);
        doc.text(`Low Stock: ${lowStock.filter((drink) => getDrinkStockStatus(drink) === 'low').length}`, margin + 58, y);
        doc.text(`Out of Stock: ${outOfStock.length}`, margin + 108, y);
        y += 7;
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
        y += 6;

        const tableRows = drinks.map((drink) => [
            String(drink.name || ''),
            `RWF ${Number(drink.price || 0).toLocaleString()}`,
            String(getDrinkStockQty(drink)),
            String(getDrinkLowStockThreshold(drink)),
            getStockStatusLabel(getDrinkStockStatus(drink))
        ]);

        let tableEndY = y;
        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                head: [['Drink', 'Price', 'In Stock', 'Low Alert', 'Status']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 2.6 },
                headStyles: { fillColor: [13, 124, 227], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 250, 255] }
            });
            tableEndY = (doc.lastAutoTable?.finalY || y) + 8;
        } else {
            doc.setFontSize(9);
            tableRows.slice(0, 28).forEach((row, rowIndex) => {
                const yy = y + (rowIndex * 5);
                doc.text(`${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]}`, margin, yy);
            });
            tableEndY = y + (Math.min(tableRows.length, 28) * 5) + 8;
        }

        const stockHistoryEntries = [];
        drinks.forEach((drink) => {
            const drinkName = String(drink.name || '');
            const history = getDrinkStockHistory(drink);
            history.forEach((entry) => {
                stockHistoryEntries.push({
                    ts: new Date(entry.timestamp).getTime(),
                    row: [
                        formatPdfDateTime(entry.timestamp),
                        drinkName,
                        entry.action === 'remove' ? 'Removed' : 'Added',
                        String(entry.quantity),
                        String(entry.beforeQty),
                        String(entry.afterQty),
                        entry.reason || '-'
                    ]
                });
            });
        });
        stockHistoryEntries.sort((a, b) => b.ts - a.ts);
        const stockHistoryRows = stockHistoryEntries.map((entry) => entry.row);

        const pageHeight = doc.internal.pageSize.getHeight();
        if (tableEndY > pageHeight - 32) {
            doc.addPage();
            tableEndY = 32;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(12, 96, 156);
        doc.text('Stock Adjustment History', margin, tableEndY);
        tableEndY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        if (!stockHistoryRows.length) {
            doc.text('No add/remove stock history recorded yet.', margin, tableEndY);
        } else if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: tableEndY,
                head: [['Date & Time', 'Drink', 'Action', 'Qty', 'Before', 'After', 'Reason']],
                body: stockHistoryRows,
                theme: 'grid',
                styles: { fontSize: 8.4, cellPadding: 2.1 },
                headStyles: { fillColor: [32, 163, 124], textColor: 255 },
                alternateRowStyles: { fillColor: [246, 252, 249] },
                columnStyles: {
                    0: { cellWidth: 31 },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 11 },
                    4: { cellWidth: 14 },
                    5: { cellWidth: 14 },
                    6: { cellWidth: 62 }
                }
            });
        } else {
            stockHistoryRows.slice(0, 22).forEach((row, rowIndex) => {
                const yy = tableEndY + (rowIndex * 4.5);
                doc.text(`${row[0]} | ${row[1]} | ${row[2]} ${row[3]} | ${row[6]}`, margin, yy);
            });
        }

        applyPdfBrandFooter(doc, reportTitle);
        const fileDate = new Date().toISOString().split('T')[0];
        doc.save(`stock-management-${fileDate}.pdf`);
        showSuccessToast('Stock report PDF exported successfully.');
    } catch (error) {
        console.error('Stock PDF export failed:', error);
        alert(`Error exporting stock PDF: ${error.message}`);
    }
}

// ================= ADD SALE FUNCTIONS =================
function updateDrinkList() {
    const drinkList = document.getElementById('drinkList');
    if (!drinkList) return;
    const allowProfit = canViewProfitData();
    const searchInput = document.getElementById('drinkSearch');
    const search = searchInput ? String(searchInput.value || '').toLowerCase().trim() : '';

    sanitizeSelectedDrinksDraft();
    syncDrinkSelectionModeButton();
    clearElement(drinkList);

    if (!Array.isArray(drinks) || drinks.length === 0) {
        drinkList.innerHTML = '<div class="no-data">No drinks saved yet. Add one below!</div>';
        return;
    }

    const visibleDrinks = drinks
        .map((drink, index) => ({ drink, index }))
        .filter(({ drink }) => String(drink?.name || '').toLowerCase().includes(search));

    if (!visibleDrinks.length) {
        drinkList.innerHTML = '<div class="no-data">No drinks found</div>';
        return;
    }

    visibleDrinks.forEach(({ drink, index }) => {
        const drinkProfit = getDrinkProfitPerCaseByName(drink.name);
        const profitMeta = allowProfit ? `<span>Profit/Case: RWF ${drinkProfit.toLocaleString()}</span>` : '';
        const stockQty = getDrinkStockQty(drink);
        const stockStatus = getDrinkStockStatus(drink);
        const stockLabel = getStockStatusLabel(stockStatus);
        const stockClass = stockStatus === 'out' ? 'stock-status-out' : (stockStatus === 'low' ? 'stock-status-low' : 'stock-status-ok');
        const disableSelect = stockStatus === 'out' || getAvailableStockForDrinkIndex(index) <= 0;
        const isSelected = Object.prototype.hasOwnProperty.call(selectedDrinksDraft, drink.name);

        const item = document.createElement('div');
        item.className = 'drink-item';
        item.innerHTML = `
            <div class="drink-item-main">
                ${drinkSelectionModeEnabled ? `
                    <label class="drink-select-inline">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} ${disableSelect ? 'disabled' : ''} aria-label="Select ${escapeHtml(drink.name)}">
                    </label>
                ` : ''}
                <div class="drink-item-content">
                    <strong>${escapeHtml(drink.name)}</strong>
                    <div class="drink-meta">
                        <span class="drink-price">RWF ${Number(drink.price || 0).toLocaleString()}</span>
                        ${profitMeta}
                        <span>Stock: ${stockQty} case(s)</span>
                        <span class="stock-status-badge ${stockClass}">${stockLabel}</span>
                    </div>
                </div>
            </div>
            <div class="drink-actions">
                <button class="select-drink-btn" onclick="selectDrink(${index})" ${disableSelect ? 'disabled title="Out of stock"' : ''}>${disableSelect ? 'Out' : 'Select'}</button>
                <button onclick="deleteDrink(${index})" class="delete-drink-btn" aria-label="Delete ${escapeHtml(drink.name)}">&#128465;</button>
            </div>
        `;

        if (drinkSelectionModeEnabled) {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', (event) => {
                    toggleDrinkDraftSelection(drink.name, Boolean(event.target.checked));
                });
            }
        }

        drinkList.appendChild(item);
    });
}

function filterDrinks() {
    updateDrinkList();
}

function syncDrinkSelectionModeButton() {
    const toggleBtn = document.getElementById('toggleDrinkSelectModeBtn');
    if (!toggleBtn) return;
    toggleBtn.textContent = drinkSelectionModeEnabled ? 'Done' : 'Select';
    toggleBtn.setAttribute('aria-pressed', drinkSelectionModeEnabled ? 'true' : 'false');
}

function sanitizeSelectedDrinksDraft() {
    const normalized = {};
    Object.entries(selectedDrinksDraft || {}).forEach(([drinkName, qty]) => {
        const drink = drinks.find((entry) => entry && entry.name === drinkName);
        if (!drink) return;
        if (getDrinkStockStatus(drink) === 'out') return;
        const normalizedQty = Math.max(1, normalizeStockValue(qty, 1));
        normalized[drinkName] = normalizedQty;
    });
    selectedDrinksDraft = normalized;
}

function getAvailableStockForDrinkIndex(drinkIndex) {
    const drink = drinks[drinkIndex];
    if (!drink) return 0;
    const totalStock = getDrinkStockQty(drink);
    const reservedQty = cart.reduce((sum, item) => {
        if (item.drinkIndex !== drinkIndex) return sum;
        return sum + (Number(item.quantity) || 0);
    }, 0);
    return Math.max(0, totalStock - reservedQty);
}

function getSelectedDraftItems() {
    sanitizeSelectedDrinksDraft();
    const selectedItems = [];
    drinks.forEach((drink, index) => {
        if (!drink || !Object.prototype.hasOwnProperty.call(selectedDrinksDraft, drink.name)) return;
        selectedItems.push({
            drink,
            drinkIndex: index,
            quantity: Math.max(1, normalizeStockValue(selectedDrinksDraft[drink.name], 1))
        });
    });
    return selectedItems;
}

function toggleDrinkSelectionMode() {
    drinkSelectionModeEnabled = !drinkSelectionModeEnabled;
    syncDrinkSelectionModeButton();
    updateDrinkList();
}

function toggleDrinkDraftSelection(drinkName, selected) {
    const drink = drinks.find((entry) => entry && entry.name === drinkName);
    if (!drink) {
        delete selectedDrinksDraft[drinkName];
        updateQuickDrinkSelect();
        updateDrinkList();
        return;
    }
    if (selected && getDrinkStockStatus(drink) !== 'out') {
        selectedDrinksDraft[drinkName] = Math.max(1, normalizeStockValue(selectedDrinksDraft[drinkName], 1));
    } else {
        delete selectedDrinksDraft[drinkName];
    }
    updateQuickDrinkSelect();
    updateDrinkList();
}

function updateDrinkDraftQuantity(drinkName, value) {
    if (!Object.prototype.hasOwnProperty.call(selectedDrinksDraft, drinkName)) return;
    selectedDrinksDraft[drinkName] = Math.max(1, normalizeStockValue(value, 1));
    updateQuickDrinkSelect();
}

function selectDrink(index) {
    const drink = drinks[index];
    if (!drink) return;
    if (getDrinkStockStatus(drink) === 'out') {
        alert(`${drink.name} is out of stock.`);
        return;
    }
    selectedDrinksDraft[drink.name] = Math.max(1, normalizeStockValue(selectedDrinksDraft[drink.name], 1));
    updateQuickDrinkSelect();
    updateDrinkList();
}

// ================= NEW CART FUNCTIONS =================
function updateQuickDrinkSelectedCount() {
    const countEl = document.getElementById('quickDrinkSelectedCount');
    if (!countEl) return;
    const count = Object.keys(selectedDrinksDraft || {}).length;
    const suffix = count === 1 ? '' : 's';
    countEl.textContent = `${count} drink${suffix} selected`;
}

function updateQuickDrinkSelect() {
    const container = document.getElementById('quickDrinkSelect');
    if (!container) return;

    clearElement(container);
    const selectedItems = getSelectedDraftItems();
    if (!selectedItems.length) {
        container.innerHTML = '<div class="quick-drink-empty">No drinks selected.</div>';
        updateQuickDrinkSelectedCount();
        const addBtn = document.getElementById('addSelectedToCartBtn');
        if (addBtn) addBtn.disabled = true;
        return;
    }

    selectedItems.forEach(({ drink, drinkIndex, quantity }) => {
        const availableQty = getAvailableStockForDrinkIndex(drinkIndex);
        const row = document.createElement('div');
        row.className = 'selected-drink-row';

        const info = document.createElement('div');
        info.className = 'selected-drink-info';
        const nameEl = document.createElement('span');
        nameEl.className = 'quick-drink-name';
        nameEl.textContent = drink.name;
        const metaEl = document.createElement('span');
        metaEl.className = 'quick-drink-meta';
        metaEl.textContent = `RWF ${Number(drink.price || 0).toLocaleString()} | Available now: ${availableQty} case(s)`;
        info.appendChild(nameEl);
        info.appendChild(metaEl);

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.step = '1';
        qtyInput.value = String(quantity);
        qtyInput.className = 'selected-drink-qty';
        qtyInput.addEventListener('change', () => {
            updateDrinkDraftQuantity(drink.name, qtyInput.value);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'selected-drink-remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
            toggleDrinkDraftSelection(drink.name, false);
        });

        row.appendChild(info);
        row.appendChild(qtyInput);
        row.appendChild(removeBtn);
        container.appendChild(row);
    });

    updateQuickDrinkSelectedCount();
    const addBtn = document.getElementById('addSelectedToCartBtn');
    if (addBtn) addBtn.disabled = false;
}

function resetQuickDrinkSelection() {
    selectedDrinksDraft = {};
    updateQuickDrinkSelect();
    updateDrinkList();
}

function addToCart() {
    const selectedItems = getSelectedDraftItems();
    if (!selectedItems.length) {
        alert('Please select at least one drink');
        return;
    }

    const warnings = [];
    let addedCount = 0;

    selectedItems.forEach(({ drink, drinkIndex, quantity }) => {
        const availableQty = getAvailableStockForDrinkIndex(drinkIndex);
        if (availableQty <= 0) {
            warnings.push(`${drink.name} is out of stock.`);
            return;
        }
        if (quantity > availableQty) {
            warnings.push(`Only ${availableQty} case(s) of ${drink.name} available right now.`);
            return;
        }

        const existingItem = cart.findIndex(item => item.drinkIndex === drinkIndex);
        if (existingItem >= 0) {
            cart[existingItem].quantity += quantity;
        } else {
            cart.push({
                drinkIndex,
                drinkName: drink.name,
                price: drink.price,
                profitPerCase: getDrinkProfitPerCaseByName(drink.name),
                quantity
            });
        }
        addedCount += 1;
    });

    if (addedCount === 0) {
        alert(warnings[0] || 'No drinks were added to cart.');
        return;
    }

    updateCartDisplay();
    resetQuickDrinkSelection();
    if (warnings.length > 0) {
        showSuccessToast(`Added ${addedCount} drink(s). Some items were skipped.`);
    } else {
        showSuccessToast(`Added ${addedCount} drink(s) to cart.`);
    }
    updateHome();
}

function updateCartDisplay() {
    const cartContainer = document.getElementById('cartItems');
    if (!cartContainer) return;
    
    clearElement(cartContainer);
    
    if (cart.length === 0) {
        cartContainer.innerHTML = `<div class="empty-cart-message">${t('noItemsYet')}</div>`;
        updateCartTotal();
        return;
    }
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.drinkName}</div>
                <div class="cart-item-details">RWF ${item.price.toLocaleString()} each</div>
            </div>
            <div class="cart-item-qty">
                <input type="number" value="${item.quantity}" min="1" onchange="updateCartItemQty(${index}, this.value)">
            </div>
            <div style="text-align: right; min-width: 120px;">
                <div style="font-weight: bold; color: #2575fc;">RWF ${itemTotal.toLocaleString()}</div>
            </div>
            <div class="cart-item-actions">
                <button onclick="removeFromCart(${index})">${t('remove')}</button>
            </div>
        `;
        cartContainer.appendChild(cartItem);
    });
    
    updateCartTotal();
}

function updateCartItemQty(index, newQty) {
    const qty = parseInt(newQty) || 1;
    if (qty < 1) {
        alert('Quantity must be at least 1');
        return;
    }

    const item = cart[index];
    if (!item) return;
    const drink = drinks[item.drinkIndex];
    const totalStock = getDrinkStockQty(drink);
    const otherReservedQty = cart.reduce((sum, entry, entryIndex) => {
        if (entryIndex === index) return sum;
        if (entry.drinkIndex !== item.drinkIndex) return sum;
        return sum + (Number(entry.quantity) || 0);
    }, 0);
    const maxAllowed = Math.max(0, totalStock - otherReservedQty);
    if (qty > maxAllowed) {
        alert(`Only ${maxAllowed} case(s) available for ${item.drinkName}.`);
        updateCartDisplay();
        return;
    }

    cart[index].quantity = qty;
    updateCartDisplay();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

function clearCart() {
    if (confirm('Clear all items from cart?')) {
        cart = [];
        updateCartDisplay();
        resetQuickDrinkSelection();
        showSuccessToast('Cart cleared.');
    }
}

function updateCartTotal() {
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
    });
    const totalElement = document.getElementById('saleTotal');
    if (totalElement) {
        totalElement.textContent = `RWF ${total.toLocaleString()}`;
    }
}

async function confirmSale() {
    if (cart.length === 0) {
        alert('Please add items to cart first');
        return;
    }
    
    if (currentSaleType === 'credit' && selectedCustomerId === null) {
        alert('Please select a customer for credit sale');
        return;
    }

    for (const item of cart) {
        const drink = drinks[item.drinkIndex] || getDrinkByName(item.drinkName);
        const stockQty = getDrinkStockQty(drink);
        if (!drink || stockQty < item.quantity) {
            const availableText = drink ? `${stockQty}` : '0';
            alert(`Insufficient stock for ${item.drinkName}. Available: ${availableText} case(s).`);
            return;
        }
    }
    
    let totalAmount = 0;
    const saleItems = [];
    const nowIso = new Date().toISOString();
    const transactionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    
    // Create sale entries for each item
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        totalAmount += itemTotal;
        
        saleItems.push({
            drinkName: item.drinkName,
            quantity: item.quantity,
            price: item.price,
            subtotal: itemTotal
        });
        
        const sale = {
            id: Date.now() + Math.random(),
            transactionId,
            drinkName: item.drinkName,
            quantity: item.quantity,
            price: item.price,
            profitPerCase: Number(item.profitPerCase || getDrinkProfitPerCaseByName(item.drinkName)),
            total: itemTotal,
            type: currentSaleType,
            customerId: currentSaleType === 'credit' ? selectedCustomerId : null,
            date: nowIso
        };
        
        sales.push(sale);

        const drink = drinks[item.drinkIndex] || getDrinkByName(item.drinkName);
        if (drink) {
            drink.stockQty = Math.max(0, getDrinkStockQty(drink) - item.quantity);
            drink.lastStockUpdatedAt = nowIso;
        }
    });
    
    // Update customer debt if credit sale
    if (currentSaleType === 'credit' && selectedCustomerId !== null && customers[selectedCustomerId]) {
        customers[selectedCustomerId].owing = (customers[selectedCustomerId].owing || 0) + totalAmount;
    }
    
    await optimizedSaveData();
    
    const toastSummary = currentSaleType === 'credit'
        ? (() => {
            const customerName = selectedCustomerId !== null && customers[selectedCustomerId]
                ? customers[selectedCustomerId].name
                : 'Unknown';
            return `Sale confirmed. Total: RWF ${totalAmount.toLocaleString()} (added to ${customerName}'s debt).`;
        })()
        : `Sale confirmed. Total: RWF ${totalAmount.toLocaleString()} (paid in cash).`;
    showSuccessToast(toastSummary);
    
    // Reset form
    cart = [];
    const saleTypeSelect = document.getElementById('saleType');
    if (saleTypeSelect) saleTypeSelect.value = 'normal';
    const customerSelectContainer = document.getElementById('customerSelectContainer');
    if (customerSelectContainer) customerSelectContainer.style.display = 'none';
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) customerSelect.value = '';
    selectedCustomerId = null;
    currentSaleType = 'normal';
    resetQuickDrinkSelection();
    updateCartDisplay();
    updateQuickDrinkSelect();
    updateDrinkList();
    renderStockManagement();
    updateHome();

    const lowStock = getLowStockDrinks();
    if (lowStock.length > 0) {
        const preview = lowStock
            .slice(0, 2)
            .map((drink) => `${drink.name} (${getDrinkStockQty(drink)})`)
            .join(', ');
        showSuccessToast(`Stock alert: ${lowStock.length} item(s) need attention. ${preview}`);
    }
}

async function deleteDrink(index) {
    const drink = drinks[index];
    
    if (!confirm(`Delete "${drink.name}" from drink list?`)) {
        return;
    }
    
    drinks.splice(index, 1);
    cart = cart
        .filter((item) => item.drinkIndex !== index)
        .map((item) => ({
            ...item,
            drinkIndex: item.drinkIndex > index ? item.drinkIndex - 1 : item.drinkIndex
        }));
    await optimizedSaveData();
    updateDrinkList();
    updateQuickDrinkSelect();
    updateCartDisplay();
    renderStockManagement();
    updateHome();
    renderDrinkProfitEditor();
    
    showSuccessToast(`Drink deleted: ${drink.name}`);
}

function saveNewDrink() {
    const name = document.getElementById('newDrinkName').value.trim();
    const price = parseFloat(document.getElementById('newDrinkPrice').value);
    const canEditProfit = canViewProfitData();
    const profitPerCaseInput = document.getElementById('newDrinkProfitPerCase');
    const stockQtyInput = document.getElementById('newDrinkStockQty');
    const lowStockThresholdInput = document.getElementById('newDrinkLowStockThreshold');
    const existingIndex = drinks.findIndex(d => d.name.toLowerCase() === name.toLowerCase());
    const existingDrink = existingIndex >= 0 ? drinks[existingIndex] : null;
    const rawProfitValue = (canEditProfit && profitPerCaseInput) ? String(profitPerCaseInput.value || '').trim() : '';
    const parsedProfitValue = rawProfitValue === '' ? NaN : parseFloat(rawProfitValue);
    const rawStockValue = stockQtyInput ? String(stockQtyInput.value || '').trim() : '';
    const rawLowStockValue = lowStockThresholdInput ? String(lowStockThresholdInput.value || '').trim() : '';
    const parsedStockValue = rawStockValue === '' ? NaN : Number(rawStockValue);
    const parsedLowStockValue = rawLowStockValue === '' ? NaN : Number(rawLowStockValue);
    
    if (!name || isNaN(price) || price <= 0) {
        alert('Please enter valid drink name and price');
        return;
    }
    if (canEditProfit && rawProfitValue !== '' && (!Number.isFinite(parsedProfitValue) || parsedProfitValue < 0)) {
        alert(t('profitPerCaseError'));
        return;
    }
    if (rawStockValue !== '' && (!Number.isFinite(parsedStockValue) || parsedStockValue < 0)) {
        alert('Initial stock must be zero or greater.');
        return;
    }
    if (rawLowStockValue !== '' && (!Number.isFinite(parsedLowStockValue) || parsedLowStockValue < 0)) {
        alert('Low stock alert level must be zero or greater.');
        return;
    }
    const defaultProfit = Number.isFinite(Number(existingDrink?.profitPerCase))
        ? Math.max(0, Number(existingDrink.profitPerCase))
        : getDefaultDrinkProfitPerCase();
    const finalProfitPerCase = canEditProfit
        ? (rawProfitValue === '' ? defaultProfit : parsedProfitValue)
        : defaultProfit;
    const finalStockQty = rawStockValue === ''
        ? getDrinkStockQty(existingDrink)
        : normalizeStockValue(parsedStockValue, 0);
    const finalLowStockThreshold = rawLowStockValue === ''
        ? getDrinkLowStockThreshold(existingDrink)
        : normalizeStockValue(parsedLowStockValue, getDefaultLowStockThreshold());
    if (existingIndex >= 0) {
        drinks[existingIndex].price = price;
        drinks[existingIndex].profitPerCase = finalProfitPerCase;
        drinks[existingIndex].stockQty = finalStockQty;
        drinks[existingIndex].lowStockThreshold = finalLowStockThreshold;
        drinks[existingIndex].lastStockUpdatedAt = new Date().toISOString();
    } else {
        drinks.push({
            name,
            price,
            profitPerCase: finalProfitPerCase,
            stockQty: finalStockQty,
            lowStockThreshold: finalLowStockThreshold,
            lastStockUpdatedAt: new Date().toISOString()
        });
    }
    
    optimizedSaveData();
    updateDrinkList();
    updateQuickDrinkSelect();
    renderStockManagement();
    updateHome();
    renderDrinkProfitEditor();
    document.getElementById('newDrinkName').value = '';
    document.getElementById('newDrinkPrice').value = '';
    if (profitPerCaseInput) profitPerCaseInput.value = '';
    if (stockQtyInput) stockQtyInput.value = '';
    if (lowStockThresholdInput) lowStockThresholdInput.value = String(getDefaultLowStockThreshold());
    
    showSuccessToast(`Drink saved: ${name} | Stock ${Number(finalStockQty).toLocaleString()} | Low alert ${Number(finalLowStockThreshold).toLocaleString()}`);
}

function changeQty(change) {
    saleQty += change;
    if (saleQty < 1) saleQty = 1;
    const qtyElement = document.getElementById('qty');
    if (qtyElement) qtyElement.textContent = saleQty;
    updateSaleTotal();
}

function updateSaleTotal() {
    const price = parseFloat(document.getElementById('selectedDrinkPrice').value) || 0;
    const total = price * saleQty;
    const totalElement = document.getElementById('saleTotal');
    if (totalElement) {
        totalElement.textContent = `RWF ${total.toLocaleString()}`;
    }
}

function changeSaleType(type) {
    currentSaleType = type;
    const container = document.getElementById('customerSelectContainer');
    if (container) {
        container.style.display = type === 'credit' ? 'block' : 'none';
    }
    
    if (type === 'credit') {
        updateCustomerDropdown();
    } else {
        selectedCustomerId = null;
    }
}

function updateCustomerDropdown() {
    const select = document.getElementById('customerSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Customer</option>';
    
    customers.forEach((customer, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${customer.name} ${customer.owing > 0 ? `(Owes: RWF ${customer.owing.toLocaleString()})` : ''}`;
        select.appendChild(option);
    });
    
    select.onchange = function() {
        selectedCustomerId = this.value ? parseInt(this.value) : null;
    };
}

// ================= FORM MANAGEMENT FUNCTIONS =================
function openCustomerForm() {
    // Clear form
    const nameInput = document.getElementById('customerName');
    const phoneInput = document.getElementById('customerPhone');
    const locationInput = document.getElementById('customerLocation');
    const typeSelect = document.getElementById('customerType');
    const notesInput = document.getElementById('customerNotes');
    const debtInput = document.getElementById('customerDebt');
    
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (locationInput) locationInput.value = '';
    if (typeSelect) typeSelect.value = 'regular';
    if (notesInput) notesInput.value = '';
    if (debtInput) debtInput.value = '0';
    
    const overlay = document.getElementById('customerFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function closeCustomerForm() {
    const overlay = document.getElementById('customerFormOverlay');
    if (overlay) overlay.style.display = 'none';
}

function openDepositForm() {
    const nameInput = document.getElementById('depositName');
    const amountInput = document.getElementById('depositAmount');
    const descInput = document.getElementById('depositDescription');
    
    if (nameInput) nameInput.value = '';
    if (amountInput) amountInput.value = '';
    if (descInput) descInput.value = 'Bottle deposit';
    
    const overlay = document.getElementById('depositFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function closeDepositForm() {
    const overlay = document.getElementById('depositFormOverlay');
    if (overlay) overlay.style.display = 'none';
}

function openAddDebtForm(index) {
    currentCustomerIndex = index;
    debtAction = 'add';
    const title = document.getElementById('debtFormTitle');
    const message = document.getElementById('debtMessage');
    const amountInput = document.getElementById('debtAmount');
    
    if (title) title.textContent = 'Add Debt';
    if (message) message.textContent = `Add debt amount for ${customers[index].name} (RWF):`;
    if (amountInput) {
        amountInput.value = '';
        amountInput.readOnly = false;
    }
    
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function openReduceDebtForm(index) {
    currentCustomerIndex = index;
    debtAction = 'reduce';
    const title = document.getElementById('debtFormTitle');
    const message = document.getElementById('debtMessage');
    const amountInput = document.getElementById('debtAmount');
    
    if (title) title.textContent = 'Reduce Debt';
    if (message) message.textContent = `Reduce debt amount for ${customers[index].name} (RWF). Current: RWF ${customers[index].owing}`;
    if (amountInput) {
        amountInput.value = '';
        amountInput.readOnly = false;
    }
    
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function openClearDebtForm(index) {
    currentCustomerIndex = index;
    debtAction = 'clear';
    const title = document.getElementById('debtFormTitle');
    const message = document.getElementById('debtMessage');
    const amountInput = document.getElementById('debtAmount');
    
    if (title) title.textContent = 'Clear Debt';
    if (message) message.textContent = `Clear all debt for ${customers[index].name}? Current: RWF ${customers[index].owing}`;
    if (amountInput) {
        amountInput.value = customers[index].owing;
        amountInput.readOnly = true;
    }
    
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function closeDebtForm() {
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'none';
    const amountInput = document.getElementById('debtAmount');
    if (amountInput) amountInput.readOnly = false;
}

function appendDebtHistory(customer, type, amount, note = '') {
    if (!customer) return;
    if (!Array.isArray(customer.debtHistory)) customer.debtHistory = [];
    customer.debtHistory.push({
        id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        type,
        amount: Number(amount) || 0,
        note,
        date: new Date().toISOString()
    });
}

async function saveCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const location = document.getElementById('customerLocation').value.trim();
    const type = document.getElementById('customerType').value;
    const notes = document.getElementById('customerNotes').value.trim();
    const debt = parseFloat(document.getElementById('customerDebt').value) || 0;
    
    if (!name) {
        alert('Please enter customer name');
        return;
    }
    
    const customer = {
        id: Date.now(),
        name,
        phone,
        location,
        type,
        notes,
        owing: debt,
        debtHistory: debt > 0 ? [{
            id: `${Date.now()}-initial`,
            type: 'initial',
            amount: debt,
            note: 'Initial debt',
            date: new Date().toISOString()
        }] : [],
        createdAt: new Date().toISOString()
    };
    
    customers.push(customer);
    await optimizedSaveData();
    displayCustomers();
    updateHome();
    closeCustomerForm();
    
    showSuccessToast(`Customer added: ${name}`);
}

async function saveDeposit() {
    const name = document.getElementById('depositName').value.trim();
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const description = document.getElementById('depositDescription').value.trim();
    
    if (!name) {
        alert('Please enter customer name');
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid deposit amount');
        return;
    }
    
    const clate = {
        id: Date.now(),
        customerName: name,
        amount,
        description: description || 'Bottle deposit',
        date: new Date().toISOString(),
        returned: false
    };
    
    clates.push(clate);
    await optimizedSaveData();
    displayKosiyo();
    updateHome();
    closeDepositForm();
    
    showSuccessToast(`Deposit recorded: ${name} - RWF ${amount.toLocaleString()}`);
}

async function confirmDebt() {
    const amount = parseFloat(document.getElementById('debtAmount').value);
    
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    if (currentCustomerIndex === null || !customers[currentCustomerIndex]) {
        alert('Customer not found');
        return;
    }
    
    const customer = customers[currentCustomerIndex];
    const currentOwing = Number(customer.owing || 0);

    switch(debtAction) {
        case 'add':
            customer.owing = currentOwing + amount;
            appendDebtHistory(customer, 'add', amount, 'Debt added manually');
            showSuccessToast(`Debt added for ${customer.name}: RWF ${amount.toLocaleString()}`);
            break;
        case 'reduce':
            {
                const reducedBy = Math.min(amount, currentOwing);
                customer.owing = Math.max(0, currentOwing - amount);
                appendDebtHistory(customer, 'reduce', -reducedBy, 'Debt reduced');
                showSuccessToast(`Debt reduced for ${customer.name}: RWF ${reducedBy.toLocaleString()}`);
            }
            break;
        case 'clear':
            appendDebtHistory(customer, 'clear', -currentOwing, 'Debt cleared');
            customer.owing = 0;
            showSuccessToast(`Debt cleared for ${customer.name}`);
            break;
    }
    
    await optimizedSaveData();
    displayCustomers();
    updateHome();
    closeDebtForm();
}

// ================= CUSTOMER FUNCTIONS =================
function displayCustomers() {
    const list = document.getElementById('customerList');
    if (!list) return;
    
    clearElement(list);
    
    if (customers.length === 0) {
        list.innerHTML = '<div class="no-data">No customers yet. Add one above!</div>';
        return;
    }
    
    customers.forEach((customer, index) => {
        const item = document.createElement('div');
        item.className = 'customer-item';
        item.innerHTML = `
            <div class="customer-info">
                <strong>${escapeHtml(customer.name)}</strong>
                <div class="customer-details">
                    ${customer.phone ? `<div class="customer-detail-item">&#128222; Phone: ${escapeHtml(customer.phone)}</div>` : ''}
                    ${customer.location ? `<div class="customer-detail-item">&#128205; Location: ${escapeHtml(customer.location)}</div>` : ''}
                    ${customer.type ? `<div class="customer-detail-item">&#127991; Type: ${escapeHtml(customer.type)}</div>` : ''}
                    ${customer.notes ? `<div class="customer-detail-item">&#128221; Notes: ${escapeHtml(customer.notes)}</div>` : ''}
                </div>
                <div style="color: ${customer.owing > 0 ? '#ff4757' : '#2ed573'}; font-weight: bold; margin-top: 10px;">
                    ${customer.owing > 0 ? `&#128179; Owes: RWF ${customer.owing.toLocaleString()}` : '&#9989; No debt'}
                </div>
            </div>
            <div class="customer-actions">
                <button onclick="openAddDebtForm(${index})">&#10133; Add Debt</button>
                <button onclick="openReduceDebtForm(${index})">&#10134; Reduce Debt</button>
                <button onclick="openClearDebtForm(${index})">&#10060; Clear Debt</button>
                <button onclick="exportCustomerDebtPDF(${index})" style="background: #ffa502;">PDF</button>
                <button onclick="deleteCustomer(${index})" style="background: #ff4757;">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function deleteCustomer(index) {
    if (!customers[index]) return;
    
    if (confirm(`Delete customer "${customers[index].name}"? This cannot be undone.`)) {
        const removedName = customers[index].name;
        customers.splice(index, 1);
        await optimizedSaveData();
        displayCustomers();
        updateHome();
        showSuccessToast(`Customer deleted: ${removedName}`);
    }
}

function filterCustomers(type) {
    const list = document.getElementById('customerList');
    if (!list) return;
    
    clearElement(list);
    
    let filtered = [];
    switch(type) {
        case 'all':
            filtered = customers;
            break;
        case 'owing':
            filtered = customers.filter(c => c.owing > 0);
            break;
        case 'cleared':
            filtered = customers.filter(c => c.owing === 0);
            break;
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-data">No customers found</div>';
        return;
    }
    
    filtered.forEach((customer) => {
        const index = customers.findIndex(c => c.id === customer.id);
        if (index === -1) return;
        
        const item = document.createElement('div');
        item.className = 'customer-item';
        item.innerHTML = `
            <div class="customer-info">
                <strong>${escapeHtml(customer.name)}</strong>
                <div class="customer-details">
                    ${customer.phone ? `<div class="customer-detail-item">&#128222; Phone: ${escapeHtml(customer.phone)}</div>` : ''}
                    ${customer.location ? `<div class="customer-detail-item">&#128205; Location: ${escapeHtml(customer.location)}</div>` : ''}
                    ${customer.type ? `<div class="customer-detail-item">&#127991; Type: ${escapeHtml(customer.type)}</div>` : ''}
                    ${customer.notes ? `<div class="customer-detail-item">&#128221; Notes: ${escapeHtml(customer.notes)}</div>` : ''}
                </div>
                <div style="color: ${customer.owing > 0 ? '#ff4757' : '#2ed573'}; font-weight: bold; margin-top: 10px;">
                    ${customer.owing > 0 ? `&#128179; Owes: RWF ${customer.owing.toLocaleString()}` : '&#9989; No debt'}
                </div>
            </div>
            <div class="customer-actions">
                <button onclick="openAddDebtForm(${index})">&#10133; Add Debt</button>
                <button onclick="openReduceDebtForm(${index})">&#10134; Reduce Debt</button>
                <button onclick="openClearDebtForm(${index})">&#10060; Clear Debt</button>
                <button onclick="exportCustomerDebtPDF(${index})" style="background: #ffa502;">PDF</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Debounced version for customer search
const debouncedFilterCustomers = debounce(function(value) {
    const list = document.getElementById('customerList');
    if (!list) return;
    
    clearElement(list);
    
    const searchTerm = value.toLowerCase();
    const filtered = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        (customer.location && customer.location.toLowerCase().includes(searchTerm)) ||
        (customer.notes && customer.notes.toLowerCase().includes(searchTerm)) ||
        (customer.type && customer.type.toLowerCase().includes(searchTerm))
    );
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-data">No customers found</div>';
        return;
    }
    
    filtered.forEach((customer) => {
        const index = customers.findIndex(c => c.id === customer.id);
        if (index === -1) return;
        
        const item = document.createElement('div');
        item.className = 'customer-item';
        item.innerHTML = `
            <div class="customer-info">
                <strong>${escapeHtml(customer.name)}</strong>
                <div class="customer-details">
                    ${customer.phone ? `<div class="customer-detail-item">&#128222; Phone: ${escapeHtml(customer.phone)}</div>` : ''}
                    ${customer.location ? `<div class="customer-detail-item">&#128205; Location: ${escapeHtml(customer.location)}</div>` : ''}
                    ${customer.type ? `<div class="customer-detail-item">&#127991; Type: ${escapeHtml(customer.type)}</div>` : ''}
                    ${customer.notes ? `<div class="customer-detail-item">&#128221; Notes: ${escapeHtml(customer.notes)}</div>` : ''}
                </div>
                <div style="color: ${customer.owing > 0 ? '#ff4757' : '#2ed573'}; font-weight: bold; margin-top: 10px;">
                    ${customer.owing > 0 ? `&#128179; Owes: RWF ${customer.owing.toLocaleString()}` : '&#9989; No debt'}
                </div>
            </div>
            <div class="customer-actions">
                <button onclick="openAddDebtForm(${index})">&#10133; Add Debt</button>
                <button onclick="openReduceDebtForm(${index})">&#10134; Reduce Debt</button>
                <button onclick="openClearDebtForm(${index})">&#10060; Clear Debt</button>
                <button onclick="exportCustomerDebtPDF(${index})" style="background: #ffa502;">PDF</button>
            </div>
        `;
        list.appendChild(item);
    });
}, 300);

// ================= CLATE/DEPOSIT FUNCTIONS =================
async function returnKosiyo(id) {
    const index = clates.findIndex(clate => clate.id === id);
    if (index === -1) {
        alert('Deposit not found!');
        return;
    }

    const customerName = clates[index].customerName;
    const amount = Number(clates[index].amount || 0);
    const shouldMarkReturned = await showUiConfirm({
        title: 'Mark Deposit Returned',
        message: `Mark deposit from ${customerName} as returned?\nAmount: RWF ${amount.toLocaleString()}`,
        confirmText: 'Mark Returned',
        cancelText: 'Cancel'
    });
    if (!shouldMarkReturned) return;

    clates[index].returned = true;
    clates[index].returnedDate = new Date().toISOString();
    await optimizedSaveData();
    displayKosiyo();
    updateHome();
    showSuccessToast(`Deposit returned: ${customerName} - RWF ${amount.toLocaleString()}`);
}

async function deleteKosiyo(id) {
    const index = clates.findIndex(clate => clate.id === id);
    if (index === -1) {
        alert('Deposit not found!');
        return;
    }
    
    if (confirm(`Delete this deposit record?\n${clates[index].customerName} - RWF ${clates[index].amount}`)) {
        const customerName = clates[index].customerName;
        const amount = Number(clates[index].amount || 0);
        clates.splice(index, 1);
        await optimizedSaveData();
        displayKosiyo();
        updateHome();
        showSuccessToast(`Deposit deleted: ${customerName} - RWF ${amount.toLocaleString()}`);
    }
}

function displayKosiyo() {
    const list = document.getElementById('kosiyoList');
    if (!list) return;
    
    clearElement(list);
    
    if (clates.length === 0) {
        list.innerHTML = '<div class="no-data">No deposits recorded yet</div>';
        return;
    }
    
    // Reset filter buttons to "All" when showing all
    const filterButtons = document.querySelectorAll('.filter-buttons .filter-btn');
    if (filterButtons && filterButtons.length > 0) {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        if (filterButtons[0]) {
            filterButtons[0].classList.add('active');
        }
    }
    
    // Clear search input
    const searchInput = document.getElementById('depositSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    
    clates.forEach((clate) => {
        const item = document.createElement('div');
        item.className = 'deposit-item';
        item.style.opacity = clate.returned ? '0.6' : '1';
        item.innerHTML = `
            <div class="deposit-info">
                <strong>${escapeHtml(clate.customerName)}</strong>
                <div>${escapeHtml(clate.description)}</div>
                <div class="deposit-amount">RWF ${clate.amount.toLocaleString()}</div>
                <div class="deposit-date">${new Date(clate.date).toLocaleDateString()}</div>
                ${clate.returned ? 
                    `<div style="color: #2ed573; font-weight: bold;">Returned on ${clate.returnedDate ? new Date(clate.returnedDate).toLocaleDateString() : 'Date unknown'}</div>` : 
                    '<div style="color: #ffa502; font-weight: bold;">Pending Return</div>'
                }
            </div>
            <div class="deposit-actions">
                ${!clate.returned ? `
                    <button onclick="returnKosiyo(${clate.id})">Mark Returned</button>
                ` : ''}
                <button onclick="deleteKosiyo(${clate.id})" style="background: #ff4757;">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// ================= DEPOSIT SEARCH FUNCTIONS =================
const debouncedFilterDeposits = debounce(function(value) {
    filterDepositsBySearch(value);
}, 300);

function filterDepositsBySearch(searchTerm) {
    const list = document.getElementById('kosiyoList');
    if (!list) return;
    
    clearElement(list);
    
    const searchLower = searchTerm.toLowerCase();
    const filtered = clates.filter(deposit => 
        deposit.customerName.toLowerCase().includes(searchLower) ||
        (deposit.description && deposit.description.toLowerCase().includes(searchLower)) ||
        (deposit.returned && searchLower.includes('returned')) ||
        (!deposit.returned && searchLower.includes('pending')) ||
        (searchLower.includes('rwf') && deposit.amount.toString().includes(searchTerm.replace(/\D/g, '')))
    );
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-data">No deposits found</div>';
        return;
    }
    
    filtered.forEach((deposit) => {
        const item = document.createElement('div');
        item.className = 'deposit-item';
        item.style.opacity = deposit.returned ? '0.6' : '1';
        item.innerHTML = `
            <div class="deposit-info">
                <strong>${escapeHtml(deposit.customerName)}</strong>
                <div>${escapeHtml(deposit.description)}</div>
                <div class="deposit-amount">RWF ${deposit.amount.toLocaleString()}</div>
                <div class="deposit-date">${new Date(deposit.date).toLocaleDateString()}</div>
                ${deposit.returned ? 
                    `<div style="color: #2ed573; font-weight: bold;">Returned on ${deposit.returnedDate ? new Date(deposit.returnedDate).toLocaleDateString() : 'Date unknown'}</div>` : 
                    '<div style="color: #ffa502; font-weight: bold;">Pending Return</div>'
                }
            </div>
            <div class="deposit-actions">
                ${!deposit.returned ? `
                    <button onclick="returnKosiyo(${deposit.id})">Mark Returned</button>
                ` : ''}
                <button onclick="deleteKosiyo(${deposit.id})" style="background: #ff4757;">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function filterDeposits(type, event) {
    const list = document.getElementById('kosiyoList');
    if (!list) return;
    
    // Update active filter button
    const filterButtons = document.querySelectorAll('.filter-buttons .filter-btn');
    if (filterButtons) {
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }
    
    clearElement(list);
    
    let filtered = [];
    switch(type) {
        case 'all':
            filtered = clates;
            break;
        case 'pending':
            filtered = clates.filter(d => !d.returned);
            break;
        case 'returned':
            filtered = clates.filter(d => d.returned);
            break;
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-data">No deposits found</div>';
        return;
    }
    
    filtered.forEach((deposit) => {
        const item = document.createElement('div');
        item.className = 'deposit-item';
        item.style.opacity = deposit.returned ? '0.6' : '1';
        item.innerHTML = `
            <div class="deposit-info">
                <strong>${escapeHtml(deposit.customerName)}</strong>
                <div>${escapeHtml(deposit.description)}</div>
                <div class="deposit-amount">RWF ${deposit.amount.toLocaleString()}</div>
                <div class="deposit-date">${new Date(deposit.date).toLocaleDateString()}</div>
                ${deposit.returned ? 
                    `<div style="color: #2ed573; font-weight: bold;">Returned on ${deposit.returnedDate ? new Date(deposit.returnedDate).toLocaleDateString() : 'Date unknown'}</div>` : 
                    '<div style="color: #ffa502; font-weight: bold;">Pending Return</div>'
                }
            </div>
            <div class="deposit-actions">
                ${!deposit.returned ? `
                    <button onclick="returnKosiyo(${deposit.id})">Mark Returned</button>
                ` : ''}
                <button onclick="deleteKosiyo(${deposit.id})" style="background: #ff4757;">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// ================= DASHBOARD FUNCTIONS =================
function updateHome() {
    const allowProfit = canViewProfitData();
    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= today;
    });
    
    const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const todaySalesElement = document.getElementById('todaySales');
    if (todaySalesElement) {
        todaySalesElement.textContent = `RWF ${todayTotal.toLocaleString()}`;
    }
    
    const todayProfitElement = document.getElementById('todayProfit');
    const todayProfitCard = todayProfitElement ? todayProfitElement.closest('.stat-card') : null;
    if (todayProfitCard) {
        todayProfitCard.style.display = allowProfit ? '' : 'none';
    }
    if (allowProfit && todayProfitElement) {
        const todayProfit = calculateProfitFromSales(todaySales);
        todayProfitElement.textContent = `RWF ${todayProfit.toLocaleString()}`;
    }
    
    // Total customer debt
    const totalDebt = customers.reduce((sum, customer) => sum + (customer.owing || 0), 0);
    const customersOwingElement = document.getElementById('customersOwing');
    if (customersOwingElement) {
        customersOwingElement.textContent = `RWF ${totalDebt.toLocaleString()}`;
    }
    
    // Pending deposits
    const pendingDeposits = clates
        .filter(clate => !clate.returned)
        .reduce((sum, clate) => sum + (clate.amount || 0), 0);
    
    const clatesPendingElement = document.getElementById('clatesPending');
    if (clatesPendingElement) {
        clatesPendingElement.textContent = `RWF ${pendingDeposits.toLocaleString()}`;
    }

    renderHomeStockWarning();
}

function getProfitConfig() {
    const mode = settings.profitMode === 'perCase' ? 'perCase' : 'percentage';
    const percentage = Number.isFinite(Number(settings.profitPercentage)) ? Number(settings.profitPercentage) : 30;
    return {
        mode,
        percentage: Math.max(0, percentage)
    };
}

function getSaleProfitPerCase(sale) {
    const fromSale = Number(sale && sale.profitPerCase);
    if (Number.isFinite(fromSale) && fromSale >= 0) return fromSale;
    const fromDrink = getDrinkProfitPerCaseByName(sale && sale.drinkName);
    if (Number.isFinite(fromDrink) && fromDrink >= 0) return fromDrink;
    return getDefaultDrinkProfitPerCase();
}

function calculateProfitFromSales(salesList) {
    const list = Array.isArray(salesList) ? salesList : [];
    const cfg = getProfitConfig();
    if (cfg.mode === 'perCase') {
        const totalPerDrinkProfit = list.reduce((sum, sale) => {
            const qty = Number(sale.quantity) || 0;
            return sum + (qty * getSaleProfitPerCase(sale));
        }, 0);
        return Math.round(totalPerDrinkProfit);
    }
    const totalAmount = list.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    return Math.round(totalAmount * (cfg.percentage / 100));
}

function getProfitDescriptor() {
    const cfg = getProfitConfig();
    return cfg.mode === 'perCase'
        ? t('profitLabelPerDrinkCase')
        : t('profitLabelPercentage').replace('{value}', cfg.percentage);
}

// ================= REPORT FUNCTIONS =================
function showDailyReport(dateValue = null) {
    const allowProfit = canViewProfitData();
    const dateInput = document.getElementById('dailyReportDate');
    const selectedDate = dateValue || (dateInput && dateInput.value) || getTodayISODate();
    if (dateInput) dateInput.value = selectedDate;

    const { dayStart, dayEnd } = getDayRange(selectedDate);
    const dailySales = sales.filter((sale) => {
        const saleDate = new Date(sale.date);
        return saleDate >= dayStart && saleDate < dayEnd;
    });

    const total = dailySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const cashSales = dailySales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = dailySales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(dailySales) : 0;
    const profitLabel = allowProfit ? getProfitDescriptor() : '';

    const drinksSold = {};
    dailySales.forEach(sale => {
        drinksSold[sale.drinkName] = (drinksSold[sale.drinkName] || 0) + (sale.quantity || 0);
    });

    const drinksTable = Object.entries(drinksSold)
        .map(([name, qty]) => `<tr><td>${escapeHtml(name)}</td><td>${qty}</td></tr>`)
        .join('');

    const customersInDebt = customers.filter(c => c.owing > 0);
    const debtTable = customersInDebt
        .map(c => `<tr><td>${escapeHtml(c.name)}</td><td>RWF ${c.owing.toLocaleString()}</td></tr>`)
        .join('');
    const totalDebt = customersInDebt.reduce((sum, c) => sum + (c.owing || 0), 0);

    const reportOutput = document.getElementById('reportOutput');
    if (reportOutput) {
        reportOutput.innerHTML = `
            <h3>Daily Report - ${dayStart.toLocaleDateString()}</h3>
            
            <h4>Sales Summary</h4>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Sales</td>
                    <td>RWF ${total.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Cash Sales</td>
                    <td>RWF ${cashSales.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Credit Sales</td>
                    <td>RWF ${creditSales.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Number of Transactions</td>
                    <td>${dailySales.length}</td>
                </tr>
                ${allowProfit ? `
                <tr style="background-color: #e8f4f8;">
                    <td><strong>${profitLabel}</strong></td>
                    <td><strong>RWF ${profit.toLocaleString()}</strong></td>
                </tr>
                ` : ''}
            </table>
            
            ${drinksTable ? `
            <h4 style="margin-top: 25px;">Drinks Sold</h4>
            <table>
                <tr>
                    <th>Drink Name</th>
                    <th>Quantity</th>
                </tr>
                ${drinksTable}
            </table>
            ` : ''}
            
            ${debtTable ? `
            <h4 style="margin-top: 25px;">Customers in Debt</h4>
            <table>
                <tr>
                    <th>Customer Name</th>
                    <th>Amount Owed</th>
                </tr>
                ${debtTable}
                <tr style="background-color: #fff3cd;">
                    <td><strong>Total Debt</strong></td>
                    <td><strong>RWF ${totalDebt.toLocaleString()}</strong></td>
                </tr>
            </table>
            ` : '<p style="color: #666;">No customers in debt</p>'}
            
            <div style="margin-top: 30px; color: #666; font-size: 12px;">
                Report generated on ${new Date().toLocaleString()}
            </div>
        `;
    }
}

function setDailyReportToday() {
    const todayIso = getTodayISODate();
    const dateInput = document.getElementById('dailyReportDate');
    if (dateInput) dateInput.value = todayIso;
    showDailyReport(todayIso);
}

function printCurrentReport() {
    const reportOutput = document.getElementById('reportOutput');
    if (!reportOutput || !reportOutput.innerHTML.trim()) {
        alert('No report available to print.');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        alert('Could not open print window.');
        return;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Report Print</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 16px; }
                table { border-collapse: collapse; width: 100%; margin-top: 12px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f2f5fb; }
            </style>
        </head>
        <body>${reportOutput.innerHTML}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

function setRangeDateInputs(startDate, endDate) {
    const startInput = document.getElementById('rangeStartDate');
    const endInput = document.getElementById('rangeEndDate');
    if (startInput) startInput.value = startDate.toISOString().split('T')[0];
    if (endInput) endInput.value = endDate.toISOString().split('T')[0];
}

function setRangeToThisMonth() {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    setRangeDateInputs(monthStart, today);

    const monthInput = document.getElementById('rangeMonth');
    if (monthInput) monthInput.value = today.toISOString().slice(0, 7);
}

function setRangeToSelectedMonth() {
    const monthInput = document.getElementById('rangeMonth');
    if (!monthInput || !monthInput.value) {
        setRangeToThisMonth();
        return;
    }

    const [yearStr, monthStr] = monthInput.value.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        alert(t('rangeValidation'));
        return;
    }

    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate > today) endDate.setTime(today.getTime());
    setRangeDateInputs(startDate, endDate);
}

function getValidatedRangeSelection(showErrors = true) {
    const startInput = document.getElementById('rangeStartDate');
    const endInput = document.getElementById('rangeEndDate');
    if (!startInput || !endInput || !startInput.value || !endInput.value) {
        if (showErrors) alert(t('rangeValidation'));
        return null;
    }

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        if (showErrors) alert(t('rangeValidation'));
        return null;
    }
    if (endDate < startDate) {
        if (showErrors) alert(t('rangeEndBeforeStart'));
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate > today || endDate > today) {
        if (showErrors) alert(t('rangeFutureNotAllowed'));
        return null;
    }

    return {
        startDate,
        endDate,
        startIso: startInput.value,
        endIso: endInput.value
    };
}

function getSalesForRange(startDate, endDate) {
    const endExclusive = new Date(endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);
    return sales.filter((sale) => {
        const saleDate = new Date(sale.date);
        return saleDate >= startDate && saleDate < endExclusive;
    });
}

function showCustomRangeReport() {
    const allowProfit = canViewProfitData();
    const selection = getValidatedRangeSelection(true);
    if (!selection) return;

    const rangeSales = getSalesForRange(selection.startDate, selection.endDate);
    const total = rangeSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const cashSales = rangeSales.filter((s) => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = rangeSales.filter((s) => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(rangeSales) : 0;
    const profitLabel = allowProfit ? getProfitDescriptor() : '';

    const drinksSold = {};
    const salesByDay = {};
    rangeSales.forEach((sale) => {
        drinksSold[sale.drinkName] = (drinksSold[sale.drinkName] || 0) + (sale.quantity || 0);
        const dayKey = new Date(sale.date).toISOString().split('T')[0];
        salesByDay[dayKey] = (salesByDay[dayKey] || 0) + (sale.total || 0);
    });

    const topDrinksRows = Object.entries(drinksSold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, qty]) => `<tr><td>${escapeHtml(name)}</td><td>${qty}</td></tr>`)
        .join('');

    const salesByDayRows = Object.entries(salesByDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dayIso, dayTotal]) => `<tr><td>${new Date(dayIso).toLocaleDateString()}</td><td>RWF ${dayTotal.toLocaleString()}</td></tr>`)
        .join('');

    const reportOutput = document.getElementById('reportOutput');
    if (!reportOutput) return;

    if (rangeSales.length === 0) {
        reportOutput.innerHTML = `
            <h3>${t('rangeReportTitle')}</h3>
            <p style="margin-top: 12px; color: #666;">${t('rangeNoSales')}</p>
            <p style="margin-top: 8px; color: #666;">
                ${selection.startDate.toLocaleDateString()} - ${selection.endDate.toLocaleDateString()}
            </p>
        `;
        return;
    }

    reportOutput.innerHTML = `
        <h3>${t('rangeReportTitle')} - ${selection.startDate.toLocaleDateString()} to ${selection.endDate.toLocaleDateString()}</h3>
        <h4>${t('rangeSummary')}</h4>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Sales</td><td>RWF ${total.toLocaleString()}</td></tr>
            <tr><td>Cash Sales</td><td>RWF ${cashSales.toLocaleString()}</td></tr>
            <tr><td>Credit Sales</td><td>RWF ${creditSales.toLocaleString()}</td></tr>
            <tr><td>Number of Transactions</td><td>${rangeSales.length}</td></tr>
            ${allowProfit ? `
            <tr style="background-color: #e8f4f8;">
                <td><strong>${profitLabel}</strong></td>
                <td><strong>RWF ${profit.toLocaleString()}</strong></td>
            </tr>
            ` : ''}
        </table>
        ${salesByDayRows ? `
        <h4 style="margin-top: 24px;">Sales by Day</h4>
        <table>
            <tr><th>Date</th><th>Total</th></tr>
            ${salesByDayRows}
        </table>
        ` : ''}
        ${topDrinksRows ? `
        <h4 style="margin-top: 24px;">Top Drinks in Range</h4>
        <table>
            <tr><th>Drink Name</th><th>Quantity Sold</th></tr>
            ${topDrinksRows}
        </table>
        ` : ''}
        <div style="margin-top: 20px; color: #666; font-size: 12px;">
            Report generated on ${new Date().toLocaleString()}
        </div>
    `;
}

function exportCustomRangePDF() {
    const allowProfit = canViewProfitData();
    const selection = getValidatedRangeSelection(true);
    if (!selection) return;

    const rangeSales = getSalesForRange(selection.startDate, selection.endDate);
    if (rangeSales.length === 0) {
        alert(t('rangeNoSales'));
        return;
    }

    try {
        const doc = createPDFDocument();
        const reportTitle = 'Date Range Report';
        const margin = 15;
        const startY = applyPdfBrandHeader(doc, reportTitle);
        const pageWidth = doc.internal.pageSize.width;
        const tableWidth = pageWidth - margin * 2;
        const pageHeight = doc.internal.pageSize.height;
        let y = startY;

        const total = rangeSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const cashSales = rangeSales.filter((s) => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
        const creditSales = rangeSales.filter((s) => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
        const profit = allowProfit ? calculateProfitFromSales(rangeSales) : 0;

        const drinksSold = {};
        rangeSales.forEach((sale) => {
            drinksSold[sale.drinkName] = (drinksSold[sale.drinkName] || 0) + (sale.quantity || 0);
        });
        const topDrinks = Object.entries(drinksSold).sort((a, b) => b[1] - a[1]).slice(0, 12);

        const salesByDay = {};
        rangeSales.forEach((sale) => {
            const key = toPdfDateKey(sale.date);
            salesByDay[key] = (salesByDay[key] || 0) + (sale.total || 0);
        });
        const dayRows = Object.entries(salesByDay).sort((a, b) => a[0].localeCompare(b[0]));

        y = drawPdfTitleBlock(doc, y, margin, 'Date Range Report', [
            `Period: ${formatPdfDate(selection.startDate)} to ${formatPdfDate(selection.endDate)}`,
            `Generated: ${new Date().toLocaleString()}`
        ]);

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 3, tableWidth, 24, 'F');
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`Total Sales: RWF ${total.toLocaleString()}`, margin + 4, y + 3);
        doc.text(`Cash: RWF ${cashSales.toLocaleString()}`, margin + 4, y + 10);
        doc.text(`Credit: RWF ${creditSales.toLocaleString()}`, margin + 4, y + 17);
        doc.text(`Transactions: ${rangeSales.length}`, margin + 95, y + 3);
        if (allowProfit) {
            doc.text(`Profit: RWF ${profit.toLocaleString()}`, margin + 95, y + 10);
        }
        y += 30;

        const drawTopDrinksHeader = () => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(25, 86, 170);
            doc.text('Top Drinks', margin, y);
            y += 7;
            doc.setFontSize(10);
            doc.setFillColor(37, 117, 252);
            doc.setTextColor(255, 255, 255);
            doc.rect(margin, y - 5, tableWidth, 7, 'F');
            doc.text('Drink Name', margin + 3, y);
            doc.text('Qty', margin + 120, y);
            y += 8;
            doc.setTextColor(0);
            doc.setFont(undefined, 'normal');
        };

        drawTopDrinksHeader();
        topDrinks.forEach(([drink, qty], idx) => {
            if (y > pageHeight - 16) {
                doc.addPage();
                y = startY;
                drawTopDrinksHeader();
            }
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, y - 5, tableWidth, 6, 'F');
            }
            doc.text(String(drink).slice(0, 45), margin + 3, y);
            doc.text(String(qty), margin + 120, y);
            y += 6;
        });
        y += 8;

        if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
        }

        const drawDailyBreakdownHeader = () => {
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.setTextColor(25, 86, 170);
            doc.text('Daily Breakdown', margin, y);
            y += 7;
            doc.setFontSize(10);
            doc.setFillColor(37, 117, 252);
            doc.setTextColor(255, 255, 255);
            doc.rect(margin, y - 5, tableWidth, 7, 'F');
            doc.text('Date', margin + 3, y);
            doc.text('Total (RWF)', margin + 120, y);
            y += 8;
            doc.setTextColor(0);
            doc.setFont(undefined, 'normal');
        };

        drawDailyBreakdownHeader();
        dayRows.forEach(([dayIso, dayTotal], idx) => {
            if (y > pageHeight - 16) {
                doc.addPage();
                y = startY;
                drawDailyBreakdownHeader();
            }
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, y - 5, tableWidth, 6, 'F');
            }
            doc.text(formatPdfDate(dayIso), margin + 3, y);
            doc.text(Number(dayTotal || 0).toLocaleString(), margin + 120, y);
            y += 6;
        });

        applyPdfBrandFooter(doc, reportTitle);
        doc.save(`report-range-${selection.startIso}-to-${selection.endIso}.pdf`);
        showSuccessToast('Range PDF exported successfully.');
    } catch (error) {
        console.error('Range PDF export error:', error);
        alert('Error exporting range PDF: ' + error.message);
    }
}

function showWeeklyReport() {
    const allowProfit = canViewProfitData();
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weeklySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= weekAgo;
    });
    
    const total = weeklySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(weeklySales) : 0;
    const dailyAverage = Math.round(total / 7);
    
    // Sales by day
    const salesByDay = {};
    weeklySales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString();
        salesByDay[date] = (salesByDay[date] || 0) + (sale.total || 0);
    });
    
    const dayTable = Object.entries(salesByDay)
        .map(([date, total]) => `<tr><td>${date}</td><td>RWF ${total.toLocaleString()}</td></tr>`)
        .join('');
    
    // Top drinks this week
    const drinksSold = {};
    weeklySales.forEach(sale => {
        drinksSold[sale.drinkName] = (drinksSold[sale.drinkName] || 0) + (sale.quantity || 0);
    });
    
    const topDrinks = Object.entries(drinksSold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => `<tr><td>${escapeHtml(name)}</td><td>${qty}</td></tr>`)
        .join('');
    
    const reportOutput = document.getElementById('reportOutput');
    if (reportOutput) {
        reportOutput.innerHTML = `
            <h3>Weekly Report (Last 7 Days)</h3>
            
            <h4>Weekly Summary</h4>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Sales</td>
                    <td>RWF ${total.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Number of Transactions</td>
                    <td>${weeklySales.length}</td>
                </tr>
                <tr>
                    <td>Daily Average</td>
                    <td>RWF ${dailyAverage.toLocaleString()}</td>
                </tr>
                ${allowProfit ? `
                <tr style="background-color: #e8f4f8;">
                    <td><strong>Weekly Profit</strong></td>
                    <td><strong>RWF ${profit.toLocaleString()}</strong></td>
                </tr>
                ` : ''}
            </table>
            
            ${dayTable ? `
            <h4 style="margin-top: 25px;">Sales by Day</h4>
            <table>
                <tr>
                    <th>Date</th>
                    <th>Daily Total</th>
                </tr>
                ${dayTable}
            </table>
            ` : ''}
            
            ${topDrinks ? `
            <h4 style="margin-top: 25px;">Top 5 Drinks This Week</h4>
            <table>
                <tr>
                    <th>Drink Name</th>
                    <th>Quantity Sold</th>
                </tr>
                ${topDrinks}
            </table>
            ` : ''}
            
            <div style="margin-top: 30px; color: #666; font-size: 12px;">
                Report generated on ${new Date().toLocaleString()}
            </div>
        `;
    }
}

function showMonthlyReport() {
    const allowProfit = canViewProfitData();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthlySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= firstDay;
    });
    
    const total = monthlySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(monthlySales) : 0;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyAverage = Math.round(total / daysInMonth);
    
    // Sales by day
    const salesByDay = {};
    monthlySales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString();
        salesByDay[date] = (salesByDay[date] || 0) + (sale.total || 0);
    });
    
    const dayTable = Object.entries(salesByDay)
        .map(([date, total]) => `<tr><td>${date}</td><td>RWF ${total.toLocaleString()}</td></tr>`)
        .join('');
    
    // Top drinks this month
    const drinksSold = {};
    monthlySales.forEach(sale => {
        drinksSold[sale.drinkName] = (drinksSold[sale.drinkName] || 0) + (sale.quantity || 0);
    });
    
    const topDrinks = Object.entries(drinksSold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => `<tr><td>${escapeHtml(name)}</td><td>${qty}</td></tr>`)
        .join('');
    
    const reportOutput = document.getElementById('reportOutput');
    if (reportOutput) {
        reportOutput.innerHTML = `
            <h3>Monthly Report - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            
            <h4>Monthly Summary</h4>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Sales</td>
                    <td>RWF ${total.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Number of Transactions</td>
                    <td>${monthlySales.length}</td>
                </tr>
                <tr>
                    <td>Daily Average</td>
                    <td>RWF ${dailyAverage.toLocaleString()}</td>
                </tr>
                ${allowProfit ? `
                <tr style="background-color: #e8f4f8;">
                    <td><strong>Monthly Profit</strong></td>
                    <td><strong>RWF ${profit.toLocaleString()}</strong></td>
                </tr>
                ` : ''}
            </table>
            
            ${dayTable ? `
            <h4 style="margin-top: 25px;">Sales by Day</h4>
            <table>
                <tr>
                    <th>Date</th>
                    <th>Daily Total</th>
                </tr>
                ${dayTable}
            </table>
            ` : ''}
            
            ${topDrinks ? `
            <h4 style="margin-top: 25px;">Top 5 Drinks This Month</h4>
            <table>
                <tr>
                    <th>Drink Name</th>
                    <th>Quantity Sold</th>
                </tr>
                ${topDrinks}
            </table>
            ` : ''}
            
            <div style="margin-top: 30px; color: #666; font-size: 12px;">
                Report generated on ${new Date().toLocaleString()}
            </div>
        `;
    }
}

function showAnnualReport() {
    const allowProfit = canViewProfitData();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1);
    
    const annualSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= firstDay;
    });
    
    const total = annualSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(annualSales) : 0;
    const daysInYear = (today.getFullYear() % 4 === 0) ? 366 : 365;
    const dailyAverage = Math.round(total / daysInYear);
    
    // Sales by month
    const salesByMonth = {};
    annualSales.forEach(sale => {
        const month = new Date(sale.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        salesByMonth[month] = (salesByMonth[month] || 0) + (sale.total || 0);
    });
    
    const monthTable = Object.entries(salesByMonth)
        .map(([month, total]) => `<tr><td>${month}</td><td>RWF ${total.toLocaleString()}</td></tr>`)
        .join('');
    
    // Top drinks this year
    const drinksSold = {};
    annualSales.forEach(sale => {
        drinksSold[sale.drinkName] = (drinksSold[sale.drinkName] || 0) + (sale.quantity || 0);
    });
    
    const topDrinks = Object.entries(drinksSold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => `<tr><td>${escapeHtml(name)}</td><td>${qty}</td></tr>`)
        .join('');
    
    const reportOutput = document.getElementById('reportOutput');
    if (reportOutput) {
        reportOutput.innerHTML = `
            <h3>Annual Report - ${today.getFullYear()}</h3>
            
            <h4>Annual Summary</h4>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Sales</td>
                    <td>RWF ${total.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Number of Transactions</td>
                    <td>${annualSales.length}</td>
                </tr>
                <tr>
                    <td>Daily Average</td>
                    <td>RWF ${dailyAverage.toLocaleString()}</td>
                </tr>
                ${allowProfit ? `
                <tr style="background-color: #e8f4f8;">
                    <td><strong>Annual Profit</strong></td>
                    <td><strong>RWF ${profit.toLocaleString()}</strong></td>
                </tr>
                ` : ''}
            </table>
            
            ${monthTable ? `
            <h4 style="margin-top: 25px;">Sales by Month</h4>
            <table>
                <tr>
                    <th>Month</th>
                    <th>Monthly Total</th>
                </tr>
                ${monthTable}
            </table>
            ` : ''}
            
            ${topDrinks ? `
            <h4 style="margin-top: 25px;">Top 5 Drinks This Year</h4>
            <table>
                <tr>
                    <th>Drink Name</th>
                    <th>Quantity Sold</th>
                </tr>
                ${topDrinks}
            </table>
            ` : ''}
            
            <div style="margin-top: 30px; color: #666; font-size: 12px;">
                Report generated on ${new Date().toLocaleString()}
            </div>
        `;
    }
}

function showFullReport() {
    const allowProfit = canViewProfitData();
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = allowProfit ? calculateProfitFromSales(sales) : 0;
    const totalCustomers = customers.length;
    const totalDebt = customers.reduce((sum, customer) => sum + (customer.owing || 0), 0);
    const totalDeposits = clates.filter(c => !c.returned).reduce((sum, c) => sum + (c.amount || 0), 0);
    
    // Top drinks
    const drinkSales = {};
    sales.forEach(sale => {
        drinkSales[sale.drinkName] = (drinkSales[sale.drinkName] || 0) + (sale.quantity || 0);
    });
    
    const topDrinks = Object.entries(drinkSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, quantity]) => `<tr><td>${escapeHtml(name)}</td><td>${quantity}</td></tr>`)
        .join('');
    
    const reportOutput = document.getElementById('reportOutput');
    if (reportOutput) {
        reportOutput.innerHTML = `
            <h3>Full Business Report</h3>
            
            <h4>Overall Summary</h4>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Sales (All Time)</td>
                    <td>RWF ${totalSales.toLocaleString()}</td>
                </tr>
                ${allowProfit ? `
                <tr>
                    <td>Estimated Total Profit</td>
                    <td>RWF ${totalProfit.toLocaleString()}</td>
                </tr>
                ` : ''}
                <tr>
                    <td>Total Customers</td>
                    <td>${totalCustomers}</td>
                </tr>
                <tr>
                    <td>Total Amount Owed</td>
                    <td>RWF ${totalDebt.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Pending Deposits</td>
                    <td>RWF ${totalDeposits.toLocaleString()}</td>
                </tr>
            </table>
            
            ${topDrinks ? `
            <h4 style="margin-top: 30px;">Top 5 Selling Drinks</h4>
            <table>
                <tr>
                    <th>Drink Name</th>
                    <th>Quantity Sold</th>
                </tr>
                ${topDrinks}
            </table>
            ` : ''}
            
            <div style="margin-top: 30px; color: #666; font-size: 12px;">
                Report generated on ${new Date().toLocaleString()}
            </div>
        `;
    }
}

// ================= PDF EXPORT FUNCTIONS =================
function exportReportToPDF(reportType = 'full') {
    try {
        const doc = createPDFDocument();
        const reportTitleMap = {
            daily: 'Daily Report',
            weekly: 'Weekly Report',
            monthly: 'Monthly Report',
            annual: 'Annual Report',
            full: 'Full Business Report'
        };
        const reportTitle = reportTitleMap[reportType] || reportTitleMap.full;
        const margin = 15;
        const yPos = applyPdfBrandHeader(doc, reportTitle);
        
        if (reportType === 'daily') {
            exportDailyPDF(doc, yPos, margin);
        } else if (reportType === 'weekly') {
            exportWeeklyPDF(doc, yPos, margin);
        } else if (reportType === 'monthly') {
            exportMonthlyPDF(doc, yPos, margin);
        } else if (reportType === 'annual') {
            exportAnnualPDF(doc, yPos, margin);
        } else {
            exportFullPDF(doc, yPos, margin);
        }
        
        applyPdfBrandFooter(doc, reportTitle);
        doc.save(`report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`);
        showSuccessToast('PDF exported successfully.');
        console.log('PDF exported successfully');
    } catch (error) {
        console.error('PDF export error:', error);
        alert('Error exporting PDF: ' + error.message);
    }
}

// ================= DEBT SUMMARY PDF EXPORT =================
function exportDebtSummaryPDF() {
    try {
        // Filter customers with debt
        const customersWithDebt = customers.filter(c => c.owing > 0);
        
        if (customersWithDebt.length === 0) {
            alert('No customers with outstanding debt.');
            return;
        }
        
        const doc = createPDFDocument();
        const reportTitle = 'Debt Summary Report';
        const margin = 15;
        const startY = applyPdfBrandHeader(doc, reportTitle);
        const pageWidth = doc.internal.pageSize.width;
        let yPos = startY;

        yPos = drawPdfTitleBlock(doc, yPos, margin, 'Debt Summary Report', [
            `Generated: ${new Date().toLocaleString()}`,
            `Customers with outstanding balances: ${customersWithDebt.length}`
        ]);
        
        // Total debt
        const totalDebt = customersWithDebt.reduce((sum, c) => sum + c.owing, 0);
        doc.setFontSize(12);
        doc.setTextColor(37, 117, 252);
        doc.text(`Total Outstanding Debt: ${formatPdfCurrency(totalDebt)}`, margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 12;
        
        // Table headers
        const headers = ['Customer', 'Phone', 'Location', 'Owing (RWF)'];
        const colWidth = (pageWidth - 2 * margin) / 4;

        const drawDebtTableHeader = () => {
            doc.setFillColor(37, 117, 252);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(10);

            headers.forEach((header, i) => {
                doc.rect(margin + i * colWidth, yPos, colWidth, 8, 'F');
                doc.text(header, margin + i * colWidth + 2, yPos + 6);
            });

            yPos += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
        };

        drawDebtTableHeader();
        
        // Draw table rows
        customersWithDebt.forEach((customer, idx) => {
            if (yPos > doc.internal.pageSize.height - 20) {
                doc.addPage();
                yPos = startY;
                drawDebtTableHeader();
            }
            
            const rowData = [
                customer.name || 'N/A',
                customer.phone || 'N/A',
                customer.location || 'N/A',
                formatPdfCurrency(customer.owing)
            ];
            
            // Alternate row background
            if (idx % 2 === 1) {
                doc.setFillColor(245, 248, 250);
                doc.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
            }
            
            rowData.forEach((text, i) => {
                doc.text(text, margin + i * colWidth + 2, yPos + 5);
            });
            
            yPos += 7;
        });
        
        // Save PDF
        applyPdfBrandFooter(doc, reportTitle);
        doc.save(`debt-summary-${new Date().toISOString().split('T')[0]}.pdf`);
        showSuccessToast('Debt summary PDF exported successfully.');
    } catch (error) {
        console.error('Debt PDF export error:', error);
        alert('Error exporting PDF: ' + error.message);
    }
}

// Export detailed debt history for a single customer
function exportCustomerDebtPDF(index) {
    try {
        if (!customers[index]) {
            alert('Customer not found');
            return;
        }

        const customer = customers[index];

        // Gather credit sales tied to this customer
        const salesRecords = sales.filter(s => s.type === 'credit' && (s.customerId === index || s.customerId === customer.id));

        // Also include legacy "debts" entries
        const manualDebtEntries = (typeof debts !== 'undefined' ? debts.filter(d => d.customer && d.customer.toLowerCase() === customer.name.toLowerCase()) : []);
        const debtAdjustments = Array.isArray(customer.debtHistory) ? customer.debtHistory : [];

        const events = [];

        salesRecords.forEach(s => {
            events.push({
                date: s.date || '',
                source: 'Credit Sale',
                description: s.drinkName || (s.items || ''),
                qty: s.quantity || s.qty || '',
                amount: s.total || s.amount || 0
            });
        });

        manualDebtEntries.forEach(d => {
            events.push({
                date: d.date || '',
                source: 'Manual Debt Entry',
                description: d.item || '',
                qty: d.qty || '',
                amount: d.amount || ''
            });
        });

        debtAdjustments.forEach((entry) => {
            const type = String(entry.type || '').toLowerCase();
            let source = 'Debt Adjustment';
            if (type === 'reduce') source = 'Debt Reduction';
            if (type === 'clear') source = 'Debt Cleared';
            if (type === 'add') source = 'Manual Debt Added';
            if (type === 'initial') source = 'Initial Debt';
            events.push({
                date: entry.date || '',
                source,
                description: entry.note || '',
                qty: '',
                amount: Number(entry.amount || 0)
            });
        });

        if (events.length === 0) {
            alert('No debt history records found for ' + customer.name);
            return;
        }

        // Sort by date when available
        events.sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(a.date) - new Date(b.date);
        });

        const doc = createPDFDocument({ orientation: "portrait", unit: "mm", format: "a4" });
        const reportTitle = 'Customer Debt Report';
        
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - (margin * 2);
        let y = applyPdfBrandHeader(doc, reportTitle);

        y = drawPdfTitleBlock(doc, y, margin, 'Customer Debt Report', [
            `Customer: ${customer.name || 'N/A'}`,
            `Generated: ${new Date().toLocaleString()}`
        ]);

        function safe(value, max = 30) {
            if (!value) return "";
            return String(value).substring(0, max);
        }

        // ================= CUSTOMER INFO CARD =================
        doc.setFillColor(240, 247, 255);
        doc.setDrawColor(37, 117, 252);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, contentWidth, 25, 3, 3, "FD");

        // Customer name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(37, 117, 252);
        doc.text(customer.name, margin + 10, y + 10);

        // Current owing amount
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Current Owing:", margin + 10, y + 20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 117, 252);
        doc.text(formatPdfCurrency(customer.owing), margin + contentWidth - 10, y + 20, { align: "right" });

        y += 35;

        // ================= TABLE HEADER =================
        function drawTableHeader() {
            doc.setFillColor(37, 117, 252);
            doc.rect(margin, y, contentWidth, 8, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);

            doc.text("Date", margin + 3, y + 5);
            doc.text("Source", margin + 45, y + 5);
            doc.text("Description", margin + 90, y + 5);
            doc.text("Qty", margin + 150, y + 5);
            doc.text("Amount (RWF)", margin + 170, y + 5);

            y += 10;
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
        }

        drawTableHeader();

        // ================= DEBT EVENTS =================
        events.forEach((event, index) => {
            // Check if we need a new page
            if (y + 15 > pageHeight - 25) {
                doc.addPage();
                y = 30;
                drawTableHeader();
            }

            // Light background for alternating rows
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, y - 2, contentWidth, 12, "F");
            }

            // Event row
            doc.setFontSize(9);
            
            // Date
            doc.setFont("helvetica", "normal");
            const dateStr = formatPdfDateTime(event.date);
            doc.text(dateStr, margin + 3, y + 3);
            
            // Source with color coding
            if (event.source.includes('Credit')) {
                doc.setTextColor(200, 0, 0);
            } else if (event.source.includes('Reduction') || event.source.includes('Cleared')) {
                doc.setTextColor(34, 139, 34);
            } else {
                doc.setTextColor(150, 100, 0);
            }
            doc.text(safe(event.source, 15), margin + 45, y + 3);
            
            // Description
            doc.setTextColor(80, 80, 80);
            doc.text(safe(event.description, 25), margin + 90, y + 3);
            
            // Quantity
            doc.setTextColor(0, 0, 0);
            doc.text(event.qty ? event.qty.toString() : '-', margin + 152, y + 3);
            
            // Amount
            doc.setFont("helvetica", "bold");
            if (event.amount > 0) {
                doc.setTextColor(200, 0, 0);
            } else if (event.amount < 0) {
                doc.setTextColor(34, 139, 34);
            } else {
                doc.setTextColor(37, 117, 252);
            }
            doc.text(formatPdfCurrency(event.amount), margin + 170, y + 3);
            
            y += 10;
            
            // Add item details for credit sales if available
            if (event.source.includes('Credit') && event.description && event.description.length > 25) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);
                doc.text("- " + event.description, margin + 15, y - 2);
                y += 4;
            }
        });

        // ================= SUMMARY SECTION =================
        y += 8;

        // Check if we need a new page for summary
        if (y + 30 > pageHeight - 20) {
            doc.addPage();
            y = 30;
        }

        // Summary card
        doc.setFillColor(240, 247, 255);
        doc.setDrawColor(37, 117, 252);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, contentWidth, 36, 3, 3, "FD");

        // Calculate totals
        const totalFromSales = salesRecords.reduce((s, r) => s + (Number(r.total || r.amount || 0)), 0);
        const totalManual = manualDebtEntries.reduce((s, r) => s + (Number(r.amount || 0)), 0);
        const totalReductions = debtAdjustments
            .filter((entry) => Number(entry.amount || 0) < 0)
            .reduce((s, entry) => s + Math.abs(Number(entry.amount || 0)), 0);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(37, 117, 252);
        doc.text("DEBT SUMMARY", margin + 10, y + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        
        let summaryY = y + 15;
        
        doc.text("Credit Sales Total:", margin + 10, summaryY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 0, 0);
        doc.text(formatPdfCurrency(totalFromSales), margin + contentWidth - 10, summaryY, { align: "right" });
        
        summaryY += 6;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text("Manual Entries Total:", margin + 10, summaryY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(150, 100, 0);
        doc.text(formatPdfCurrency(totalManual), margin + contentWidth - 10, summaryY, { align: "right" });
        
        summaryY += 6;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text("Debt Reductions Total:", margin + 10, summaryY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(34, 139, 34);
        doc.text(formatPdfCurrency(totalReductions), margin + contentWidth - 10, summaryY, { align: "right" });

        summaryY += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(37, 117, 252);
        doc.text("GRAND TOTAL OWING:", margin + 10, summaryY);
        doc.setFontSize(12);
        doc.text(formatPdfCurrency(customer.owing), margin + contentWidth - 10, summaryY, { align: "right" });

        y = summaryY + 15;

        // Save the PDF
        const filename = customer.name.replace(/\s+/g, '_') + "-debt-history-" + new Date().toISOString().split('T')[0] + ".pdf";
        applyPdfBrandFooter(doc, reportTitle);
        doc.save(filename);
        
        showSuccessToast('Customer debt history PDF exported successfully.');
        
    } catch (err) {
        console.error('exportCustomerDebtPDF error', err);
        alert('Error exporting customer debt PDF: ' + (err.message || err));
    }
}

function exportDailyPDF(doc, startY, margin) {
    const allowProfit = canViewProfitData();
    const selectedDate = (document.getElementById('dailyReportDate')?.value) || getTodayISODate();
    const { dayStart: today, dayEnd } = getDayRange(selectedDate);

    const dailySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= today && saleDate < dayEnd;
    });
    
    let yPos = startY;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const tableWidth = pageWidth - (2 * margin);
    
    yPos = drawPdfTitleBlock(doc, yPos, margin, 'Daily Report', [
        `Date: ${formatPdfDate(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
        `Generated: ${new Date().toLocaleString()}`
    ]);
    
    const totalSales = dailySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const cashSales = dailySales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = dailySales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(dailySales) : 0;
    
    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 18, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 5, yPos + 3);
    doc.text(`Transactions: ${dailySales.length}`, margin + 80, yPos + 3);
    if (allowProfit) {
        doc.setTextColor(0, 100, 200);
        doc.text(`Profit: RWF ${profit.toLocaleString()}`, margin + 140, yPos + 3);
    }
    doc.setTextColor(0);
    yPos += 25;
    
    // DRINKS SOLD TABLE
    if (dailySales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('GOODS SOLD', margin, yPos);
        yPos += 7;
        
        const drinkSales = {};
        const drinkValues = {};
        dailySales.forEach(sale => {
            if (!drinkSales[sale.drinkName]) {
                drinkSales[sale.drinkName] = 0;
                drinkValues[sale.drinkName] = 0;
            }
            drinkSales[sale.drinkName] += (sale.quantity || 0);
            drinkValues[sale.drinkName] += (sale.total || 0);
        });
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Drink Name', margin + 3, yPos);
        doc.text('Qty', margin + 120, yPos);
        doc.text('Amount', margin + 150, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        Object.entries(drinkSales)
            .sort((a, b) => b[1] - a[1])
            .forEach(([drink, qty], idx) => {
                if (idx % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(drink, margin + 3, yPos);
                doc.text(qty.toString(), margin + 125, yPos);
                doc.text(`RWF ${drinkValues[drink].toLocaleString()}`, margin + 150, yPos);
                yPos += 7;
            });
        yPos += 3;
    }
    
    // TRANSACTIONS SECTION
    if (dailySales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('RECENT TRANSACTIONS', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Time', margin + 3, yPos);
        doc.text('Item', margin + 30, yPos);
        doc.text('Qty', margin + 120, yPos);
        doc.text('Type', margin + 140, yPos);
        doc.text('Amount', margin + 165, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        dailySales.slice(-10).reverse().forEach((sale, idx) => {
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = 20;
            }
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos - 4, tableWidth, 5, 'F');
            }
            const time = new Date(sale.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            doc.text(time, margin + 3, yPos);
            doc.text(sale.drinkName.substring(0, 18), margin + 30, yPos);
            doc.text((sale.quantity || 0).toString(), margin + 120, yPos);
            doc.text(sale.type === 'normal' ? 'Cash' : 'Credit', margin + 140, yPos);
            doc.text(`RWF ${(sale.total || 0).toLocaleString()}`, margin + 165, yPos);
            yPos += 5;
        });
        yPos += 5;
    }
    
    // CUSTOMERS IN DEBT TABLE
    const customersInDebt = customers.filter(c => c.owing > 0);
    if (customersInDebt.length > 0) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('CUSTOMERS IN DEBT', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(230, 76, 76);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Amount Owed', margin + 130, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const totalDebt = customersInDebt.reduce((sum, c) => sum + (c.owing || 0), 0);
        
        customersInDebt
            .sort((a, b) => b.owing - a.owing)
            .forEach((customer, idx) => {
                if (yPos > pageHeight - 15) {
                    doc.addPage();
                    yPos = 20;
                }
                if (idx % 2 === 0) {
                    doc.setFillColor(255, 240, 240);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(customer.name, margin + 3, yPos);
                doc.text(`RWF ${customer.owing.toLocaleString()}`, margin + 130, yPos);
                yPos += 7;
            });
        
        // Total debt line
        yPos += 2;
        doc.setFillColor(240, 200, 200);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL DEBT:', margin + 3, yPos);
        doc.text(`RWF ${totalDebt.toLocaleString()}`, margin + 130, yPos);
    }
}

function exportWeeklyPDF(doc, startY, margin) {
    const allowProfit = canViewProfitData();
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weeklySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= weekAgo;
    });
    
    let yPos = startY;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const tableWidth = pageWidth - (2 * margin);
    
    yPos = drawPdfTitleBlock(doc, yPos, margin, 'Weekly Report', [
        `Period: ${formatPdfDate(weekAgo)} to ${formatPdfDate(today)}`,
        `Generated: ${new Date().toLocaleString()}`
    ]);
    
    const totalSales = weeklySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(weeklySales) : 0;
    const cashSales = weeklySales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = weeklySales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    
    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 18, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 5, yPos + 3);
    doc.text(`Transactions: ${weeklySales.length}`, margin + 80, yPos + 3);
    if (allowProfit) {
        doc.setTextColor(0, 100, 200);
        doc.text(`Profit: RWF ${profit.toLocaleString()}`, margin + 140, yPos + 3);
    }
    doc.setTextColor(0);
    yPos += 25;
    
    // TOP DRINKS TABLE
    if (weeklySales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOP GOODS SOLD (WEEKLY)', margin, yPos);
        yPos += 7;
        
        const drinkSales = {};
        const drinkValues = {};
        weeklySales.forEach(sale => {
            if (!drinkSales[sale.drinkName]) {
                drinkSales[sale.drinkName] = 0;
                drinkValues[sale.drinkName] = 0;
            }
            drinkSales[sale.drinkName] += (sale.quantity || 0);
            drinkValues[sale.drinkName] += (sale.total || 0);
        });
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Product', margin + 3, yPos);
        doc.text('Qty', margin + 120, yPos);
        doc.text('Revenue', margin + 150, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        Object.entries(drinkSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([drink, qty], idx) => {
                if (idx % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(drink, margin + 3, yPos);
                doc.text(qty.toString(), margin + 125, yPos);
                doc.text(`RWF ${drinkValues[drink].toLocaleString()}`, margin + 150, yPos);
                yPos += 7;
            });
        yPos += 5;
    }
    
    // SALES BY DAY
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DAILY BREAKDOWN', margin, yPos);
    yPos += 7;
    
    const salesByDay = {};
    weeklySales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString();
        if (!salesByDay[date]) salesByDay[date] = 0;
        salesByDay[date] += (sale.total || 0);
    });
    
    // Table headers
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(37, 117, 252);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
    doc.text('Date', margin + 3, yPos);
    doc.text('Sales Count', margin + 80, yPos);
    doc.text('Total Amount', margin + 130, yPos);
    yPos += 8;
    
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    Object.entries(salesByDay)
        .sort()
        .forEach((entry, idx) => {
            const dayCount = weeklySales.filter(s => new Date(s.date).toLocaleDateString() === entry[0]).length;
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
            }
            doc.text(entry[0], margin + 3, yPos);
            doc.text(dayCount.toString(), margin + 80, yPos);
            doc.text(`RWF ${entry[1].toLocaleString()}`, margin + 130, yPos);
            yPos += 6;
        });
    yPos += 5;
    
    // PAYMENT BREAKDOWN
    if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PAYMENT METHOD BREAKDOWN', margin, yPos);
    yPos += 7;
    
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 14, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    const cashPercent = totalSales > 0 ? Math.round(cashSales / totalSales * 100) : 0;
    const creditPercent = totalSales > 0 ? Math.round(creditSales / totalSales * 100) : 0;
    doc.text(`Cash Sales: RWF ${cashSales.toLocaleString()} (${cashPercent}%)`, margin + 5, yPos + 2);
    doc.text(`Credit Sales: RWF ${creditSales.toLocaleString()} (${creditPercent}%)`, margin + 5, yPos + 8);
}

function exportMonthlyPDF(doc, startY, margin) {
    const allowProfit = canViewProfitData();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthlySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= firstDay;
    });
    
    let yPos = startY;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const tableWidth = pageWidth - (2 * margin);
    
    yPos = drawPdfTitleBlock(doc, yPos, margin, 'Monthly Report', [
        `Month: ${formatPdfDate(today, { month: 'long', year: 'numeric' })}`,
        `Generated: ${new Date().toLocaleString()}`
    ]);
    
    const totalSales = monthlySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(monthlySales) : 0;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const cashSales = monthlySales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = monthlySales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    
    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 18, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 5, yPos + 3);
    doc.text(`Transactions: ${monthlySales.length}`, margin + 80, yPos + 3);
    if (allowProfit) {
        doc.setTextColor(0, 100, 200);
        doc.text(`Profit: RWF ${profit.toLocaleString()}`, margin + 140, yPos + 3);
    }
    doc.setTextColor(0);
    yPos += 25;
    
    // TOP GOODS TABLE
    if (monthlySales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOP GOODS SOLD (MONTHLY)', margin, yPos);
        yPos += 7;
        
        const drinkSales = {};
        const drinkValues = {};
        monthlySales.forEach(sale => {
            if (!drinkSales[sale.drinkName]) {
                drinkSales[sale.drinkName] = 0;
                drinkValues[sale.drinkName] = 0;
            }
            drinkSales[sale.drinkName] += (sale.quantity || 0);
            drinkValues[sale.drinkName] += (sale.total || 0);
        });
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Product', margin + 3, yPos);
        doc.text('Qty', margin + 120, yPos);
        doc.text('Revenue', margin + 150, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        Object.entries(drinkSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([drink, qty], idx) => {
                if (idx % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(drink, margin + 3, yPos);
                doc.text(qty.toString(), margin + 125, yPos);
                doc.text(`RWF ${drinkValues[drink].toLocaleString()}`, margin + 150, yPos);
                yPos += 7;
            });
        yPos += 5;
    }
    
    // CUSTOMERS IN DEBT
    const customersInDebt = customers.filter(c => c.owing > 0);
    if (customersInDebt.length > 0) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('CUSTOMERS IN DEBT', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(230, 76, 76);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Amount Owed', margin + 130, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const totalDebt = customersInDebt.reduce((sum, c) => sum + (c.owing || 0), 0);
        
        customersInDebt
            .sort((a, b) => b.owing - a.owing)
            .forEach((customer, idx) => {
                if (yPos > pageHeight - 15) {
                    doc.addPage();
                    yPos = 20;
                }
                if (idx % 2 === 0) {
                    doc.setFillColor(255, 240, 240);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(customer.name, margin + 3, yPos);
                doc.text(`RWF ${customer.owing.toLocaleString()}`, margin + 130, yPos);
                yPos += 7;
            });
        
        yPos += 2;
        doc.setFillColor(240, 200, 200);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL DEBT:', margin + 3, yPos);
        doc.text(`RWF ${totalDebt.toLocaleString()}`, margin + 130, yPos);
    }
}

function exportAnnualPDF(doc, startY, margin) {
    const allowProfit = canViewProfitData();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1);
    
    const annualSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= firstDay;
    });
    
    let yPos = startY;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const tableWidth = pageWidth - (2 * margin);
    
    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(37, 117, 252);
    doc.text('ANNUAL REPORT', margin, yPos);
    doc.setTextColor(0);
    yPos += 12;
    
    // Year info
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Year: ${today.getFullYear()}`, margin, yPos);
    doc.text(`Generated: ${new Date().toLocaleTimeString()}`, pageWidth - margin - 50, yPos);
    yPos += 12;
    
    // Divider
    doc.setDrawColor(37, 117, 252);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    const totalSales = annualSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(annualSales) : 0;
    const cashSales = annualSales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = annualSales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    
    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 18, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 5, yPos + 3);
    doc.text(`Transactions: ${annualSales.length}`, margin + 80, yPos + 3);
    if (allowProfit) {
        doc.setTextColor(0, 100, 200);
        doc.text(`Profit: RWF ${profit.toLocaleString()}`, margin + 140, yPos + 3);
    }
    doc.setTextColor(0);
    yPos += 25;
    
    // TOP GOODS TABLE
    if (annualSales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOP GOODS SOLD (ANNUAL)', margin, yPos);
        yPos += 7;
        
        const drinkSales = {};
        const drinkValues = {};
        annualSales.forEach(sale => {
            if (!drinkSales[sale.drinkName]) {
                drinkSales[sale.drinkName] = 0;
                drinkValues[sale.drinkName] = 0;
            }
            drinkSales[sale.drinkName] += (sale.quantity || 0);
            drinkValues[sale.drinkName] += (sale.total || 0);
        });
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Product', margin + 3, yPos);
        doc.text('Qty Sold', margin + 100, yPos);
        doc.text('Total Revenue', margin + 140, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        Object.entries(drinkSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .forEach(([drink, qty], idx) => {
                if (idx % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(drink, margin + 3, yPos);
                doc.text(qty.toString(), margin + 100, yPos);
                doc.text(`RWF ${drinkValues[drink].toLocaleString()}`, margin + 140, yPos);
                yPos += 7;
            });
        yPos += 5;
    }
    
    // MONTHLY BREAKDOWN
    if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('MONTHLY BREAKDOWN', margin, yPos);
    yPos += 7;
    
    const salesByMonth = {};
    annualSales.forEach(sale => {
        const month = new Date(sale.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!salesByMonth[month]) salesByMonth[month] = 0;
        salesByMonth[month] += (sale.total || 0);
    });
    
    // Table headers
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(37, 117, 252);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
    doc.text('Month', margin + 3, yPos);
    doc.text('Sales Count', margin + 80, yPos);
    doc.text('Total Amount', margin + 130, yPos);
    yPos += 8;
    
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    Object.entries(salesByMonth).forEach((entry, idx) => {
        const monthCount = annualSales.filter(s => new Date(s.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) === entry[0]).length;
        if (idx % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
        }
        doc.text(entry[0], margin + 3, yPos);
        doc.text(monthCount.toString(), margin + 80, yPos);
        doc.text(`RWF ${entry[1].toLocaleString()}`, margin + 130, yPos);
        yPos += 6;
    });
    yPos += 5;
    
    // CUSTOMERS IN DEBT
    const customersInDebt = customers.filter(c => c.owing > 0);
    if (customersInDebt.length > 0) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('CUSTOMERS IN DEBT', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(230, 76, 76);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Amount Owed', margin + 130, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const totalDebt = customersInDebt.reduce((sum, c) => sum + (c.owing || 0), 0);
        
        customersInDebt
            .sort((a, b) => b.owing - a.owing)
            .forEach((customer, idx) => {
                if (yPos > pageHeight - 15) {
                    doc.addPage();
                    yPos = 20;
                }
                if (idx % 2 === 0) {
                    doc.setFillColor(255, 240, 240);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(customer.name, margin + 3, yPos);
                doc.text(`RWF ${customer.owing.toLocaleString()}`, margin + 130, yPos);
                yPos += 7;
            });
        
        yPos += 2;
        doc.setFillColor(240, 200, 200);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL DEBT:', margin + 3, yPos);
        doc.text(`RWF ${totalDebt.toLocaleString()}`, margin + 130, yPos);
    }
}

function exportFullPDF(doc, startY, margin) {
    const allowProfit = canViewProfitData();
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(sales) : 0;
    const totalCustomers = customers.length;
    const totalDebt = customers.reduce((sum, c) => sum + (c.owing || 0), 0);
    const cashSales = sales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = sales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    
    let yPos = startY;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const tableWidth = pageWidth - (2 * margin);
    
    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(37, 117, 252);
    doc.text('FULL BUSINESS REPORT', margin, yPos);
    doc.setTextColor(0);
    yPos += 12;
    
    // Date generated
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    doc.text(`Records: ${sales.length} transactions`, pageWidth - margin - 70, yPos);
    yPos += 12;
    
    // Divider
    doc.setDrawColor(37, 117, 252);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    // Overall Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 18, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Sales: RWF ${totalSales.toLocaleString()}`, margin + 5, yPos + 3);
    doc.text(`Total Customers: ${totalCustomers}`, margin + 80, yPos + 3);
    if (allowProfit) {
        doc.setTextColor(0, 100, 200);
        doc.text(`Profit: RWF ${profit.toLocaleString()}`, margin + 140, yPos + 3);
    }
    doc.setTextColor(0);
    yPos += 25;
    
    // TOP GOODS (ALL TIME)
    if (sales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOP GOODS SOLD (ALL TIME)', margin, yPos);
        yPos += 7;
        
        const drinkSales = {};
        const drinkValues = {};
        sales.forEach(sale => {
            if (!drinkSales[sale.drinkName]) {
                drinkSales[sale.drinkName] = 0;
                drinkValues[sale.drinkName] = 0;
            }
            drinkSales[sale.drinkName] += (sale.quantity || 0);
            drinkValues[sale.drinkName] += (sale.total || 0);
        });
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Product', margin + 3, yPos);
        doc.text('Total Qty', margin + 100, yPos);
        doc.text('Total Revenue', margin + 140, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        Object.entries(drinkSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .forEach(([drink, qty], idx) => {
                if (idx % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(drink, margin + 3, yPos);
                doc.text(qty.toString(), margin + 100, yPos);
                doc.text(`RWF ${drinkValues[drink].toLocaleString()}`, margin + 140, yPos);
                yPos += 7;
            });
        yPos += 5;
    }
    
    // SALES SUMMARY BY TYPE
    if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PAYMENT METHOD ANALYSIS', margin, yPos);
    yPos += 7;
    
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 2, tableWidth, 14, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    const cashPercent = totalSales > 0 ? Math.round(cashSales / totalSales * 100) : 0;
    const creditPercent = totalSales > 0 ? Math.round(creditSales / totalSales * 100) : 0;
    doc.text(`Cash Sales: RWF ${cashSales.toLocaleString()} (${cashPercent}%)`, margin + 5, yPos + 2);
    doc.text(`Credit Sales: RWF ${creditSales.toLocaleString()} (${creditPercent}%)`, margin + 5, yPos + 8);
    yPos += 20;
    
    // CUSTOMERS IN DEBT
    const customersInDebt = customers.filter(c => c.owing > 0);
    if (customersInDebt.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('CUSTOMERS IN DEBT', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(230, 76, 76);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Amount Owed', margin + 130, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        const totalDebtAmount = customersInDebt.reduce((sum, c) => sum + (c.owing || 0), 0);
        
        customersInDebt
            .sort((a, b) => b.owing - a.owing)
            .slice(0, 20)
            .forEach((customer, idx) => {
                if (yPos > pageHeight - 15) {
                    doc.addPage();
                    yPos = 20;
                }
                if (idx % 2 === 0) {
                    doc.setFillColor(255, 240, 240);
                    doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
                }
                doc.text(customer.name, margin + 3, yPos);
                doc.text(`RWF ${customer.owing.toLocaleString()}`, margin + 130, yPos);
                yPos += 6;
            });
        
        yPos += 2;
        doc.setFillColor(240, 200, 200);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('TOTAL DEBT:', margin + 3, yPos);
        doc.text(`RWF ${totalDebtAmount.toLocaleString()}`, margin + 130, yPos);
    } else {
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text('No customers in debt - Excellent!', margin, yPos);
    }
}

// Auto-save before page unload
window.addEventListener('beforeunload', () => {
    flushDataSyncOnExit(activeUser);
    if (!isElectron) {
        void optimizedSaveData();
    }
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
});

// ================= SALES HISTORY FUNCTIONS =================
function getSalesTransactionGroupKey(sale) {
    if (sale && sale.transactionId) {
        return `txn:${String(sale.transactionId)}`;
    }
    const saleDate = new Date(sale?.date);
    const legacyDateKey = Number.isNaN(saleDate.getTime())
        ? String(sale?.date || 'unknown-date')
        : saleDate.toISOString();
    const customerKey = (sale?.customerId === null || sale?.customerId === undefined)
        ? 'guest'
        : String(sale.customerId);
    const typeKey = String(sale?.type || 'normal');
    return `legacy:${legacyDateKey}|${customerKey}|${typeKey}`;
}

function getSalesHistoryFilteredSales() {
    const searchTerm = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
    const selectedDate = document.getElementById('salesHistoryDate')?.value || '';

    return sales.filter((sale) => {
        if (selectedSalesHistoryType !== 'all' && sale.type !== selectedSalesHistoryType) return false;

        if (selectedDate) {
            const { dayStart, dayEnd } = getDayRange(selectedDate);
            const saleDate = new Date(sale.date);
            if (!(saleDate >= dayStart && saleDate < dayEnd)) return false;
        }

        if (!searchTerm) return true;
        const customerName = sale.customerId !== null && customers[sale.customerId] ? customers[sale.customerId].name : 'Guest';
        return (
            (sale.drinkName && sale.drinkName.toLowerCase().includes(searchTerm)) ||
            (customerName && customerName.toLowerCase().includes(searchTerm)) ||
            (sale.date && new Date(sale.date).toLocaleDateString().toLowerCase().includes(searchTerm))
        );
    });
}

function renderSalesHistoryRows(filteredSales) {
    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;
    clearElement(tbody);

    if (!filteredSales || filteredSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">No sales found</td></tr>';
        return;
    }

    const transactions = {};
    const sortedSales = [...filteredSales].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedSales.forEach((sale) => {
        const timeKey = getSalesTransactionGroupKey(sale);
        if (!transactions[timeKey]) {
            transactions[timeKey] = {
                date: sale.date,
                customerId: sale.customerId,
                type: sale.type,
                items: [],
                totalAmount: 0,
                ids: []
            };
        }
        transactions[timeKey].items.push(sale);
        transactions[timeKey].totalAmount += (sale.total || 0);
        if (sale.id) transactions[timeKey].ids.push(sale.id);
    });

    Object.values(transactions).forEach((transaction) => {
        const saleDate = new Date(transaction.date);
        const dateStr = saleDate.toLocaleDateString() + ' ' + saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const customerName = transaction.customerId !== null && customers[transaction.customerId] ? customers[transaction.customerId].name : 'Guest';
        const saleTypeDisplay = transaction.type === 'credit'
            ? '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>'
            : '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>';
        const itemsText = transaction.items.length > 1 ? `${transaction.items.length} items` : (transaction.items[0]?.drinkName || 'Unknown');
        const idsArray = transaction.ids.length > 0 ? transaction.ids : transaction.items.map(i => i.id).filter(id => id);

        const detailsButton = `<button onclick="showTransactionDetails('${JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" style="padding: 6px 12px; background: #2575fc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-right: 8px;">📋 Details</button>`;
        const deleteButton = idsArray.length > 0
            ? `<button onclick="deleteTransaction([${idsArray.join(',')}])" style="padding: 6px 10px; font-size: 12px; margin: 2px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>`
            : '';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e1e5e9';
        row.innerHTML = `
            <td style="padding: 15px;">${dateStr}</td>
            <td style="padding: 15px;"><strong>${escapeHtml(itemsText)}</strong></td>
            <td style="padding: 15px; text-align: center;">${transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
            <td style="padding: 15px; text-align: right;">RWF ${transaction.items.length > 0 ? (transaction.items[0].price || 0).toLocaleString() : '0'}</td>
            <td style="padding: 15px; text-align: right; font-weight: 600; color: #2575fc;">RWF ${transaction.totalAmount.toLocaleString()}</td>
            <td style="padding: 15px; text-align: center;">${saleTypeDisplay}</td>
            <td style="padding: 15px; text-align: center;">${escapeHtml(customerName)}</td>
            <td style="padding: 15px; text-align: center;">${detailsButton}${deleteButton}</td>
        `;
        tbody.appendChild(row);
    });
}

function applySalesHistoryFilters() {
    renderSalesHistoryRows(getSalesHistoryFilteredSales());
}

function goToTodaySalesHistory() {
    const dateInput = document.getElementById('salesHistoryDate');
    if (dateInput) dateInput.value = getTodayISODate();
    applySalesHistoryFilters();
}

function displaySalesHistory() {
    applySalesHistoryFilters();
    return;
    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;
    
    clearElement(tbody);
    
    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">No sales recorded yet</td></tr>';
        return;
    }
    
    // Group sales by transaction (using date and customer as key)
    const transactions = {};
    const sortedSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedSales.forEach((sale) => {
        // Create a unique key for the transaction - group by time (minute) and customer
        const saleDate = new Date(sale.date);
        const timeKey = getSalesTransactionGroupKey(sale);
        
        if (!transactions[timeKey]) {
            transactions[timeKey] = {
                date: sale.date,
                customerId: sale.customerId,
                type: sale.type,
                items: [],
                totalAmount: 0,
                ids: []
            };
        }
        transactions[timeKey].items.push(sale);
        transactions[timeKey].totalAmount += (sale.total || 0);
        if (sale.id) {
            transactions[timeKey].ids.push(sale.id);
        }
    });
    
    // Display consolidated transactions
    Object.values(transactions).forEach((transaction) => {
        const saleDate = new Date(transaction.date);
        const dateStr = saleDate.toLocaleDateString() + ' ' + saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const customerName = transaction.customerId !== null && customers[transaction.customerId] ? 
            customers[transaction.customerId].name : 'Guest';
        const saleTypeDisplay = transaction.type === 'credit' ? 
            '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>' : 
            '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>';
        
        const itemsText = transaction.items.length > 1 ? 
            `${transaction.items.length} items` : 
            (transaction.items[0]?.drinkName || 'Unknown');
        
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e1e5e9';
        
        // Create IDs array for deletion
        const idsArray = transaction.ids.length > 0 ? transaction.ids : 
            transaction.items.map(i => i.id).filter(id => id);
        
        const detailsButton = `<button onclick="showTransactionDetails('${JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" style="padding: 6px 12px; background: #2575fc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-right: 8px;">Details</button>`;
        
        let deleteButton = '';
        if (idsArray.length > 0) {
            deleteButton = `<button onclick="deleteTransaction([${idsArray.join(',')}])" style="padding: 6px 10px; font-size: 12px; margin: 2px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>`;
        }
        
        row.innerHTML = `
            <td style="padding: 15px;">${dateStr}</td>
            <td style="padding: 15px;"><strong>${escapeHtml(itemsText)}</strong></td>
            <td style="padding: 15px; text-align: center;">${transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
            <td style="padding: 15px; text-align: right;">RWF ${transaction.items.length > 0 ? (transaction.items[0].price || 0).toLocaleString() : '0'}</td>
            <td style="padding: 15px; text-align: right; font-weight: 600; color: #2575fc;">RWF ${transaction.totalAmount.toLocaleString()}</td>
            <td style="padding: 15px; text-align: center;">${saleTypeDisplay}</td>
            <td style="padding: 15px; text-align: center;">${escapeHtml(customerName)}</td>
            <td style="padding: 15px; text-align: center;">
                ${detailsButton}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Delete an entire transaction by array of sale ids
function requireAdminPasswordForAction(actionLabel = 'continue') {
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return false;
    }

    const configuredAdminPin = String(activeUser?.adminPin || '').trim();
    if (!/^\d{5}$/.test(configuredAdminPin)) {
        alert(t('authAdminAccessDenied'));
        return false;
    }

    const input = window.prompt(`Enter admin password to ${actionLabel}:`, '');
    if (input === null) return false;

    const enteredPin = String(input || '').trim();
    if (!/^\d{5}$/.test(enteredPin)) {
        alert(t('authPinRules'));
        return false;
    }

    if (enteredPin !== configuredAdminPin) {
        alert(t('authAdminInvalidCredentials'));
        return false;
    }
    return true;
}

async function deleteTransaction(ids) {
    if (!ids || ids.length === 0) {
        alert('No transaction selected');
        return;
    }
    
    if (!confirm('Delete this transaction and all its items? This cannot be undone.')) return;
    if (!requireAdminPasswordForAction('delete this transaction')) return;

    // Remove matching sales and adjust customer owing if needed
    ids.forEach(id => {
        const idx = sales.findIndex(s => s.id === id);
        if (idx !== -1) {
            const deletedSale = sales[idx];
            if (deletedSale.type === 'credit' && deletedSale.customerId !== null && customers[deletedSale.customerId]) {
                customers[deletedSale.customerId].owing = Math.max(0, (customers[deletedSale.customerId].owing || 0) - (deletedSale.total || 0));
            }
            sales.splice(idx, 1);
        }
    });

    await optimizedSaveData();
    displaySalesHistory();
    updateHome();
    renderArchiveYearOptions();
    showSuccessToast('Transaction deleted successfully.');
}

function showTransactionDetails(itemsJson) {
    // Parse the items
    let items = itemsJson;
    if (typeof itemsJson === 'string') {
        try {
            items = JSON.parse(itemsJson.replace(/&quot;/g, '"'));
        } catch (e) {
            console.error('Error parsing transaction details:', e);
            alert('Error displaying transaction details');
            return;
        }
    }
    
    // Try to use modal if available
    const modal = document.getElementById('transactionModal');
    const modalBody = document.getElementById('transactionModalBody');
    
    if (!modal || !modalBody) {
        // Fallback to alert
        let detailsText = 'Transaction Items:\n\n';
        let totalQty = 0;
        let totalAmount = 0;
        items.forEach((item, idx) => {
            detailsText += `${idx + 1}. ${item.drinkName || 'Unknown'}\n   Qty: ${item.quantity || 0} x RWF ${Number(item.price || 0).toLocaleString()} = RWF ${Number(item.total || 0).toLocaleString()}\n\n`;
            totalQty += (item.quantity || 0);
            totalAmount += (item.total || 0);
        });
        detailsText += `\nTotal Items: ${totalQty}\nTotal Amount: RWF ${totalAmount.toLocaleString()}`;
        showSuccessToast(detailsText);
        return;
    }

    // Build HTML for modal
    let html = `<h3 style="margin-top:0;color:#2575fc;">Transaction Details</h3>`;
    html += '<div style="margin-top:8px;">';
    let totalQty = 0;
    let totalAmount = 0;
    items.forEach((item, idx) => {
        html += `<div style="padding:10px 0;border-bottom:1px solid #eee;">`;
        html += `<div style="font-weight:700;">${idx + 1}. ${escapeHtml(item.drinkName || 'Unknown')}</div>`;
        html += `<div style="color:#666;margin-top:6px;">Qty: ${item.quantity || 0} x RWF ${Number(item.price || 0).toLocaleString()} = <strong>RWF ${Number(item.total || 0).toLocaleString()}</strong></div>`;
        html += `</div>`;
        totalQty += (item.quantity || 0);
        totalAmount += (item.total || 0);
    });
    html += `</div>`;
    html += `<div style="margin-top:12px;font-weight:700;">Total Items: ${totalQty}</div>`;
    html += `<div style="margin-top:6px;font-weight:700;color:#2575fc;">Total Amount: RWF ${totalAmount.toLocaleString()}</div>`;
    modalBody.innerHTML = html;

    // Show modal
    modal.classList.add('show');

    // Attach close handlers
    if (!modal._closeAttached) {
        modal.addEventListener('click', function(e) {
            if (e.target.id === 'transactionModal' || e.target.classList.contains('modal-close') || e.target.classList.contains('modal-backdrop')) {
                modal.classList.remove('show');
            }
        });
        modal._closeAttached = true;
    }
}

function filterSalesByType(type, event) {
    selectedSalesHistoryType = type || 'all';

    // Add active state to sales-history filter buttons only
    const filterButtons = document.querySelectorAll('#salesHistory .filter-buttons .filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    applySalesHistoryFilters();
    return;

    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;
    
    clearElement(tbody);
    
    let filtered = sales;
    if (type === 'normal') {
        filtered = sales.filter(s => s.type === 'normal');
    } else if (type === 'credit') {
        filtered = sales.filter(s => s.type === 'credit');
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">No sales found</td></tr>';
        return;
    }
    
    // Consolidate filtered sales into transactions
    const transactions = {};
    const sortedSales = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedSales.forEach((sale) => {
        const saleDate = new Date(sale.date);
        const timeKey = getSalesTransactionGroupKey(sale);
        
        if (!transactions[timeKey]) {
            transactions[timeKey] = {
                date: sale.date,
                customerId: sale.customerId,
                type: sale.type,
                items: [],
                totalAmount: 0,
                ids: []
            };
        }
        transactions[timeKey].items.push(sale);
        transactions[timeKey].totalAmount += (sale.total || 0);
        if (sale.id) {
            transactions[timeKey].ids.push(sale.id);
        }
    });
    
    // Display consolidated transactions
    Object.values(transactions).forEach((transaction) => {
        const saleDate = new Date(transaction.date);
        const dateStr = saleDate.toLocaleDateString() + ' ' + saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const customerName = transaction.customerId !== null && customers[transaction.customerId] ? 
            customers[transaction.customerId].name : 'Guest';
        const saleTypeDisplay = transaction.type === 'credit' ? 
            '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>' : 
            '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>';
        
        const itemsText = transaction.items.length > 1 ? 
            `${transaction.items.length} items` : 
            (transaction.items[0]?.drinkName || 'Unknown');
        
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e1e5e9';
        
        const idsArray = transaction.ids.length > 0 ? transaction.ids : 
            transaction.items.map(i => i.id).filter(id => id);
        
        const detailsButton = `<button onclick="showTransactionDetails('${JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" style="padding: 6px 12px; background: #2575fc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-right: 8px;">Details</button>`;
        
        let deleteButton = '';
        if (idsArray.length > 0) {
            deleteButton = `<button onclick="deleteTransaction([${idsArray.join(',')}])" style="padding: 6px 10px; font-size: 12px; margin: 2px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>`;
        }
        
        row.innerHTML = `
            <td style="padding: 15px;">${dateStr}</td>
            <td style="padding: 15px;"><strong>${escapeHtml(itemsText)}</strong></td>
            <td style="padding: 15px; text-align: center;">${transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
            <td style="padding: 15px; text-align: right;">RWF ${transaction.items.length > 0 ? (transaction.items[0].price || 0).toLocaleString() : '0'}</td>
            <td style="padding: 15px; text-align: right; font-weight: 600; color: #2575fc;">RWF ${transaction.totalAmount.toLocaleString()}</td>
            <td style="padding: 15px; text-align: center;">${saleTypeDisplay}</td>
            <td style="padding: 15px; text-align: center;">${escapeHtml(customerName)}</td>
            <td style="padding: 15px; text-align: center;">
                ${detailsButton}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterSalesHistory(searchTerm) {
    applySalesHistoryFilters();
    return;
    const tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;
    
    clearElement(tbody);
    
    if (!searchTerm || searchTerm.trim() === '') {
        displaySalesHistory();
        return;
    }
    
    const search = searchTerm.toLowerCase();
    const filtered = sales.filter(sale => {
        const customerName = sale.customerId !== null && customers[sale.customerId] ? customers[sale.customerId].name : 'Guest';
        return (sale.drinkName && sale.drinkName.toLowerCase().includes(search)) ||
               (customerName && customerName.toLowerCase().includes(search)) ||
               (sale.date && new Date(sale.date).toLocaleDateString().toLowerCase().includes(search));
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">No sales found</td></tr>';
        return;
    }
    
    // Group filtered results
    const transactions = {};
    filtered.forEach((sale) => {
        const saleDate = new Date(sale.date);
        const timeKey = getSalesTransactionGroupKey(sale);
        
        if (!transactions[timeKey]) {
            transactions[timeKey] = {
                date: sale.date,
                customerId: sale.customerId,
                type: sale.type,
                items: [],
                totalAmount: 0,
                ids: []
            };
        }
        transactions[timeKey].items.push(sale);
        transactions[timeKey].totalAmount += (sale.total || 0);
        if (sale.id) {
            transactions[timeKey].ids.push(sale.id);
        }
    });
    
    // Display
    Object.values(transactions).sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((transaction) => {
        const saleDate = new Date(transaction.date);
        const dateStr = saleDate.toLocaleDateString() + ' ' + saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const customerName = transaction.customerId !== null && customers[transaction.customerId] ? 
            customers[transaction.customerId].name : 'Guest';
        const saleTypeDisplay = transaction.type === 'credit' ? 
            '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>' : 
            '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>';
        
        const itemsText = transaction.items.length > 1 ? 
            `${transaction.items.length} items` : 
            (transaction.items[0]?.drinkName || 'Unknown');
        
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e1e5e9';
        
        const idsArray = transaction.ids.length > 0 ? transaction.ids : 
            transaction.items.map(i => i.id).filter(id => id);
        
        const detailsButton = `<button onclick="showTransactionDetails('${JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" style="padding: 6px 12px; background: #2575fc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-right: 8px;">Details</button>`;
        
        let deleteButton = '';
        if (idsArray.length > 0) {
            deleteButton = `<button onclick="deleteTransaction([${idsArray.join(',')}])" style="padding: 6px 10px; font-size: 12px; margin: 2px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>`;
        }
        
        row.innerHTML = `
            <td style="padding: 15px;">${dateStr}</td>
            <td style="padding: 15px;"><strong>${escapeHtml(itemsText)}</strong></td>
            <td style="padding: 15px; text-align: center;">${transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
            <td style="padding: 15px; text-align: right;">RWF ${transaction.items.length > 0 ? (transaction.items[0].price || 0).toLocaleString() : '0'}</td>
            <td style="padding: 15px; text-align: right; font-weight: 600; color: #2575fc;">RWF ${transaction.totalAmount.toLocaleString()}</td>
            <td style="padding: 15px; text-align: center;">${saleTypeDisplay}</td>
            <td style="padding: 15px; text-align: center;">${escapeHtml(customerName)}</td>
            <td style="padding: 15px; text-align: center;">
                ${detailsButton}
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteSale(index) {
    if (index < 0 || index >= sales.length) return;
    
    if (confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
        if (!requireAdminPasswordForAction('delete this sale')) return;
        const deletedSale = sales[index];
        
        // If it was a credit sale, reduce customer's debt
        if (deletedSale.type === 'credit' && deletedSale.customerId !== null && customers[deletedSale.customerId]) {
            customers[deletedSale.customerId].owing = Math.max(0, (customers[deletedSale.customerId].owing || 0) - (deletedSale.total || 0));
        }
        
        sales.splice(index, 1);
        await optimizedSaveData();
        displaySalesHistory();
        updateHome();
        renderArchiveYearOptions();
        
        showSuccessToast('Sale deleted successfully.');
    }
}

// ================= SALES HISTORY PDF EXPORT - WITH SPECIAL CHARACTER FIX =================
function exportSalesHistoryPDF() {
    try {
        const filteredSales = getSalesHistoryFilteredSales();
        if (!filteredSales || filteredSales.length === 0) {
            alert("No sales to export");
            return;
        }

        const doc = createPDFDocument({ orientation: "portrait", unit: "mm", format: "a4" });
        const reportTitle = 'Sales History Report';

        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - (margin * 2);
        let y = applyPdfBrandHeader(doc, reportTitle);

        function safe(value, max = 30) {
            if (!value) return "";
            return String(value).substring(0, max);
        }

        // Group transactions by date, customer, and type
        const transactions = {};
        let grandTotal = 0;

        filteredSales.forEach(sale => {
            const d = new Date(sale.date);
            const key = getSalesTransactionGroupKey(sale);

            if (!transactions[key]) {
                transactions[key] = {
                    date: sale.date,
                    type: sale.type,
                    customerId: sale.customerId,
                    items: [],
                    total: 0
                };
            }

            transactions[key].items.push(sale);
            transactions[key].total += sale.total || 0;
            grandTotal += sale.total || 0;
        });

        const transactionList = Object.values(transactions)
            .sort((a,b) => new Date(b.date) - new Date(a.date));

        // ================= GRAND TOTAL =================
        doc.setFillColor(240, 247, 255);
        doc.setDrawColor(37, 117, 252);
        doc.setLineWidth(0.5);
        doc.rect(margin, y, contentWidth, 15, "FD");

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 117, 252);
        doc.text("TOTAL SALES:", margin + 10, y + 10);
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("RWF " + grandTotal.toLocaleString(), margin + contentWidth - 10, y + 10, { align: "right" });

        y += 25;

        // ================= GENERATION INFO =================
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Generated on: " + new Date().toLocaleString(), margin, y);
        y += 10;

        // ================= TABLE HEADER =================
        function drawTableHeader() {
            doc.setFillColor(37, 117, 252);
            doc.rect(margin, y, contentWidth, 8, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);

            doc.text("Date & Time", margin + 3, y + 5);
            doc.text("Type", margin + 45, y + 5);
            doc.text("Customer", margin + 70, y + 5);
            doc.text("Total (RWF)", margin + 150, y + 5);

            y += 10;
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
        }

        drawTableHeader();

        // ================= TRANSACTIONS =================
        transactionList.forEach((transaction, index) => {
            // Check if we need a new page
            if (y + 30 > pageHeight - 20) {
                doc.addPage();
                y = 30;
                drawTableHeader();
            }

            // Light background for alternating rows
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, y - 2, contentWidth, 10, "F");
            }

            // Transaction main row
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            
            const dateStr = new Date(transaction.date).toLocaleDateString() + ' ' + 
                           new Date(transaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const type = transaction.type === "credit" ? "Credit" : "Cash";
            
            // Get customer name safely
            let customerName = "Guest";
            if (transaction.customerId && typeof getSafeCustomerName === "function") {
                customerName = getSafeCustomerName(transaction.customerId) || "Guest";
            }
            customerName = safe(customerName, 20);

            doc.text(dateStr, margin + 3, y + 3);
            
            // Type with color
            if (transaction.type === "credit") {
                doc.setTextColor(200, 0, 0);
            } else {
                doc.setTextColor(0, 150, 0);
            }
            doc.text(type, margin + 45, y + 3);
            
            doc.setTextColor(0, 0, 0);
            doc.text(customerName, margin + 70, y + 3);
            
            doc.setFont("helvetica", "bold");
            doc.setTextColor(37, 117, 252);
            doc.text("RWF " + transaction.total.toLocaleString(), margin + 150, y + 3);
            
            y += 8;

            // Items
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);

            transaction.items.forEach(item => {
                if (y + 5 > pageHeight - 20) {
                    doc.addPage();
                    y = 30;
                }

                const itemText = "- " + safe(item.drinkName, 25) + 
                                " (Qty: " + (item.quantity || 0) + 
                                " x RWF " + (item.price || 0).toLocaleString() + 
                                " = RWF " + (item.total || 0).toLocaleString() + ")";

                doc.text(itemText, margin + 15, y + 3);
                y += 5;
            });

            y += 3; // Space between transactions
        });

        // Save the PDF
        const filename = "sales-history-" + new Date().toISOString().split("T")[0] + ".pdf";
        applyPdfBrandFooter(doc, reportTitle);
        doc.save(filename);
        
        showSuccessToast('Sales history PDF exported successfully.');
        
    } catch (error) {
        console.error('Sales history PDF export error:', error);
        alert('Error exporting PDF: ' + error.message);
    }
}

// ========== HELPER FUNCTIONS FOR SPECIAL CHARACTERS ==========

/**
 * Safely encodes text to prevent special character corruption
 */
function safeText(text, maxLength = 30) {
    if (!text) return '';
    
    // Convert to string and remove/replace problematic characters
    let safe = String(text)
        .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
        .replace(/[Ã˜Ã¸]/g, 'O')         // Replace Ã˜ with O
        .replace(/[ÃœÃ¼]/g, 'U')         // Replace Ãœ with U
        .replace(/[Ã‰Ã©ÃŠÃªÃˆÃ¨]/g, 'E')     // Replace accented E with E
        .replace(/[ÃÃ¡Ã‚Ã¢Ã€Ã ]/g, 'A')     // Replace accented A with A
        .replace(/[ÃÃ­ÃŽÃ®ÃŒÃ¬]/g, 'I')     // Replace accented I with I
        .replace(/[Ã“Ã³Ã”Ã´Ã’Ã²]/g, 'O')     // Replace accented O with O
        .replace(/[ÃšÃºÃ›Ã»Ã™Ã¹]/g, 'U')     // Replace accented U with U
        .replace(/[Ã‡Ã§]/g, 'C')         // Replace Ã‡ with C
        .replace(/[Ã‘Ã±]/g, 'N')         // Replace Ã‘ with N
        .replace(/[ÃŸ]/g, 'ss')         // Replace ÃŸ with ss
        .trim();
    
    // Truncate if too long
    if (safe.length > maxLength) {
        safe = safe.substring(0, maxLength - 3) + '...';
    }
    
    return safe || '-';
}

/**
 * Safely get customer name with fallback
 */
function getSafeCustomerName(customerId) {
    if (customerId === null || customerId === undefined) return 'Guest';
    if (!customers[customerId]) return 'Unknown';
    
    const name = customers[customerId].name;
    return safeText(name, 15);
}

/**
 * Alternative export function if special characters persist
 */
function exportSalesHistorySimplePDF() {
    // Your existing simple PDF function here
    // This serves as fallback
}
// ================= SETTINGS FUNCTIONS =================
async function refreshStorageStatus() {
    const statusEl = document.getElementById('storageStatus');
    if (!statusEl) return;

    try {
        if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
            const result = await window.electronAPI.invoke('get-storage-status');
            if (result && result.success) {
                statusEl.textContent = result.mode === 'sqlite' ? 'SQLite Database' : 'JSON Files';
                return;
            }
        }

        statusEl.textContent = window.indexedDB ? 'IndexedDB + localStorage' : 'localStorage';
    } catch (error) {
        statusEl.textContent = 'Unknown';
    }
}

function renderDrinkProfitEditor() {
    const container = document.getElementById('drinkProfitList');
    if (!container) return;
    if (!canViewProfitData()) {
        clearElement(container);
        return;
    }

    clearElement(container);
    normalizeDrinksData();

    if (drinks.length === 0) {
        container.innerHTML = `<div class="drink-profit-empty">${t('noDrinksForProfitEditor')}</div>`;
        return;
    }

    drinks.forEach((drink, index) => {
        const row = document.createElement('div');
        row.className = 'drink-profit-row';
        row.innerHTML = `
            <div class="drink-profit-name">${escapeHtml(drink.name)}</div>
            <input class="drink-profit-input" type="number" min="0" step="1" data-drink-index="${index}" value="${Number(getDrinkProfitPerCaseByName(drink.name)).toString()}">
        `;
        container.appendChild(row);
    });
}

async function saveDrinkProfitsFromSettings() {
    if (!canViewProfitData()) {
        alert('Permission Denied');
        return 'Permission Denied';
    }

    const inputs = document.querySelectorAll('#drinkProfitList .drink-profit-input');
    if (!inputs.length) {
        alert(t('noDrinksForProfitEditor'));
        return;
    }

    for (const input of inputs) {
        const index = Number(input.dataset.drinkIndex);
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0 || !drinks[index]) {
            alert(t('profitPerCaseError'));
            return;
        }
        drinks[index].profitPerCase = value;
    }

    await optimizedSaveData();
    updateDrinkList();
    updateQuickDrinkSelect();
    updateHome();
    renderDrinkProfitEditor();
    showSuccessToast(t('drinkProfitSaved'));
}

function loadSettings() {
    const allowProfit = canViewProfitData();
    // Load profit percentage
    const profitPercentage = settings.profitPercentage || 30;
    const profitInput = document.getElementById('profitPercentage');
    if (profitInput) profitInput.value = profitPercentage;
    const profitModeInput = document.getElementById('profitMode');
    if (profitModeInput) profitModeInput.value = settings.profitMode || 'percentage';
    const addDrinkProfitInput = document.getElementById('newDrinkProfitPerCase');
    if (addDrinkProfitInput) {
        if (allowProfit && !addDrinkProfitInput.value) {
            addDrinkProfitInput.value = Number(getDefaultDrinkProfitPerCase());
        }
        if (!allowProfit) {
            addDrinkProfitInput.value = '';
        }
    }
    const addDrinkStockInput = document.getElementById('newDrinkStockQty');
    if (addDrinkStockInput && !addDrinkStockInput.value) {
        addDrinkStockInput.value = '0';
    }
    const addDrinkLowStockInput = document.getElementById('newDrinkLowStockThreshold');
    if (addDrinkLowStockInput && !addDrinkLowStockInput.value) {
        addDrinkLowStockInput.value = String(getDefaultLowStockThreshold());
    }
    
    // Load theme and language
    const currentTheme = settings.theme || 'light';
    const language = settings.language || 'en';
    const langSelect = document.getElementById('language');
    if (langSelect) {
        langSelect.value = language;
        if (!langSelect.dataset.boundLanguageChange) {
            langSelect.addEventListener('change', onLanguageChange);
            langSelect.dataset.boundLanguageChange = '1';
        }
    }
    
    const currencySelect = document.getElementById('currency');
    if (currencySelect) currencySelect.value = settings.currency || 'RWF';
    
    setAppLanguage(language);
    applyTheme(currentTheme);
    refreshStorageStatus();
    renderDrinkProfitEditor();
    renderStockManagement();
    renderHomeStockWarning();
    renderArchiveYearOptions();
    refreshDataManagementAccessUI();
    refreshProfitVisibilityUI();
}

function saveProfitPercentage() {
    if (!canViewProfitData()) {
        alert('Permission Denied');
        return 'Permission Denied';
    }

    const profit = parseFloat(document.getElementById('profitPercentage').value) || 30;
    const profitModeInput = document.getElementById('profitMode');
    const profitMode = profitModeInput ? profitModeInput.value : 'percentage';
    
    if (profit < 0 || profit > 100) {
        alert(t('profitPercentRangeError'));
        return;
    }
    
    settings.profitPercentage = profit;
    settings.profitMode = profitMode;
    optimizedSaveData();
    updateHome();
    renderDrinkProfitEditor();
    const modeSummary = profitMode === 'perCase'
        ? t('profitLabelPerDrinkCase')
        : t('profitLabelPercentage').replace('{value}', profit);
    showSuccessToast(`${t('profitSaved')}: ${modeSummary}`);
}

function setTheme(theme) {
    settings.theme = theme;
    optimizedSaveData();
    applyTheme(theme);
}

function applyTheme(theme) {
    const lightBtn = document.getElementById('lightThemeBtn');
    const darkBtn = document.getElementById('darkThemeBtn');
    
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (darkBtn) darkBtn.style.borderColor = '#2575fc';
        if (lightBtn) lightBtn.style.borderColor = '#333';
    } else {
        document.body.classList.remove('dark-mode');
        if (lightBtn) lightBtn.style.borderColor = '#2575fc';
        if (darkBtn) darkBtn.style.borderColor = '#333';
    }
}

function setAppLanguage(languageCode) {
    const normalizedLanguage = translations[languageCode] ? languageCode : 'en';
    settings.language = normalizedLanguage;
    currentLanguage = normalizedLanguage;
    document.documentElement.lang = normalizedLanguage;
    updateLanguageUI();
}

function onLanguageChange(event) {
    const selectedLanguage = event && event.target ? event.target.value : 'en';
    setAppLanguage(selectedLanguage);
    optimizedSaveData();
}

function saveCurrencyAndLanguage() {
    const languageSelect = document.getElementById('language');
    const currencySelect = document.getElementById('currency');
    
    const language = languageSelect ? languageSelect.value : 'en';
    const currency = currencySelect ? currencySelect.value : 'RWF';
    
    settings.currency = currency;
    setAppLanguage(language);
    optimizedSaveData();
    showSuccessToast('Settings saved. Language and currency updated.');
}

// Translation helper function
function t(key) {
    if (translations[currentLanguage] && translations[currentLanguage][key]) {
        return translations[currentLanguage][key];
    }
    return translations['en'][key] || key;
}

// Update entire UI when language changes
function updateLanguageUI() {
    const setText = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    };

    const setPlaceholder = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.placeholder = value;
    };

    // Navigation
    const navKeyByPage = {
        home: 'home',
        addSale: 'addSale',
        stockManagement: 'stockManagement',
        adminPanel: 'adminPanel',
        adminSales: 'adminTabSales',
        adminAccounts: 'adminTabAccountManagement',
        customers: 'customers',
        clate: 'clate',
        salesHistory: 'salesHistory',
        reports: 'reports',
        settings: 'settings'
    };
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
        const key = navKeyByPage[btn.dataset.page];
        if (!key) return;
        const label = btn.querySelector('.nav-label');
        if (label) {
            label.textContent = t(key);
        } else {
            btn.textContent = t(key);
        }
    });
    const topSettingsBtn = document.getElementById('topSettingsBtn');
    if (topSettingsBtn) {
        topSettingsBtn.title = t('settings');
        topSettingsBtn.setAttribute('aria-label', t('settings'));
    }

    // Page headers
    setText('#addSale .page-header h2', t('addSale'));
    setText('#stockManagement .page-header h2', t('stockManagement'));
    setText('#adminPanelTitle', t('adminPanelTitle'));
    setText('#adminPanelDescription', t('adminPanelDescription'));
    setText('#customers .page-header h2', t('customers'));
    setText('#clate .page-header h2', t('clate'));
    setText('#salesHistory .page-header h2', t('salesHistory'));
    setText('#reports .page-header h2', t('reports'));
    setText('#settings .page-header h2', t('settingsPreferences'));

    // Login / signup UI
    setText('#authLoginTab', t('login'));
    setText('#authAdminTab', t('admin'));
    setText('#authSignupTab', t('signUp'));
    setText('#loginScreen label[for="signupName"]', t('fullName'));
    setText('#loginScreen label[for="phone"]', t('phoneNumber'));
    setText('#loginScreen label[for="pin"]', t('pinLabel'));
    setText('#loginScreen label[for="confirmPin"]', t('confirmPin'));
    setText('#loginScreen label[for="signupRole"]', t('accountType'));
    setText('#loginScreen label[for="signupAdminPin"]', t('adminPinLabel'));
    setText('#loginScreen label[for="signupAdminPinConfirm"]', t('confirmAdminPin'));
    updateAuthPrimaryButtons();
    setText('#forgotPinBtn', t('forgotPin'));
    setText('#forgotPinTitle', t('resetPin'));
    setText('#loginScreen label[for="resetPhone"]', t('phoneNumber'));
    setText('#loginScreen label[for="resetNewPin"]', t('resetNewPin'));
    setText('#loginScreen label[for="resetConfirmPin"]', t('resetConfirmPin'));
    setText('#resetPinBtn', t('resetPin'));
    setText('#cancelResetPinBtn', t('cancel'));
    setPlaceholder('#signupName', t('fullName'));
    setPlaceholder('#phone', t('phoneNumber'));
    setPlaceholder('#pin', t('pinLabel'));
    setPlaceholder('#confirmPin', t('confirmPin'));
    setPlaceholder('#signupAdminPin', t('adminPinLabel'));
    setPlaceholder('#signupAdminPinConfirm', t('confirmAdminPin'));
    setPlaceholder('#resetPhone', t('phoneNumber'));
    setPlaceholder('#resetNewPin', t('resetNewPin'));
    setPlaceholder('#resetConfirmPin', t('resetConfirmPin'));
    const signupRoleStaffOption = document.querySelector('#signupRole option[value="staff"]');
    const signupRoleAdminOption = document.querySelector('#signupRole option[value="admin"]');
    if (signupRoleStaffOption) signupRoleStaffOption.textContent = t('signupRoleStaff');
    if (signupRoleAdminOption) signupRoleAdminOption.textContent = t('signupRoleAdmin');
    syncSignupRoleControls(getAuthUsers());
    setAuthHintText();
    updateActiveUserBadge();

    // Home dashboard
    setText('#home .dashboard-card h3', t('todaySales'));
    setText('#home .dashboard-card p', t('dailyTotal'));
    const homeStatLabels = document.querySelectorAll('#home .stat-card h4');
    if (homeStatLabels[0]) homeStatLabels[0].textContent = t('todayProfit');
    if (homeStatLabels[1]) homeStatLabels[1].textContent = t('customersOwing');
    if (homeStatLabels[2]) homeStatLabels[2].textContent = t('pendingDeposits');

    // Add Sale page
    const saleLeftTitles = document.querySelectorAll('#addSale .sale-left h3');
    if (saleLeftTitles[0]) saleLeftTitles[0].textContent = t('availableDrinks');
    if (saleLeftTitles[1]) saleLeftTitles[1].textContent = t('addNewDrink');
    setPlaceholder('#drinkSearch', t('searchDrinks'));
    setPlaceholder('#newDrinkName', t('drinkName'));
    setPlaceholder('#newDrinkPrice', t('drinkPricePlaceholder'));
    setPlaceholder('#newDrinkProfitPerCase', t('newDrinkProfitPerCase'));
    setPlaceholder('#newDrinkStockQty', t('newDrinkStockQty'));
    setPlaceholder('#newDrinkLowStockThreshold', t('newDrinkLowStockThreshold'));
    setText('#addSale button[onclick="saveNewDrink()"]', t('saveDrink'));
    setText('#addSale .sale-right > h3', t('currentSale'));
    setText('#addSale .sale-right > div:nth-of-type(1) h4', t('cartItems'));
    setText('#selectedDrinksTitle', 'Selected Drinks');
    syncDrinkSelectionModeButton();
    setText('#addSelectedToCartBtn', 'Add Selected to Cart');
    setText('#addSale .sale-type label', `${t('saleType')}:`);
    setText('#addSale #customerSelectContainer label', `${t('selectCustomer')}:`);
    setText('#addSale .total-display p', t('totalAmount'));
    setText('#addSale .confirm-btn', t('confirmSale'));
    setText('#addSale button[onclick="clearCart()"]', t('clearCart'));
    const saleTypeNormal = document.querySelector('#saleType option[value="normal"]');
    const saleTypeCredit = document.querySelector('#saleType option[value="credit"]');
    if (saleTypeNormal) saleTypeNormal.textContent = t('normalSale');
    if (saleTypeCredit) saleTypeCredit.textContent = t('creditSale');

    // Stock management page
    setText('#stockManagement button[onclick="renderStockManagement()"]', 'Refresh');
    setText('#stockManagement button[onclick="exportStockManagementPDF()"]', t('exportPdf'));
    setPlaceholder('#stockSearch', t('searchDrinks'));

    // Admin panel
    setText('#adminRefreshBtn', t('adminRefresh'));
    setText('#adminMainTabSalesBtn', t('adminTabSales'));
    setText('#adminMainTabAccountsBtn', t('adminTabAccountManagement'));
    setText('#adminSalesSubTabDailyBtn', t('adminSubTabDailySales'));
    setText('#adminSalesSubTabStockBtn', t('adminSubTabStock'));
    setText('#adminExportUsersPdfBtn', t('adminExportAccountsPdf'));
    setPlaceholder('#adminUserSearch', t('adminSearchEmployersPlaceholder'));
    setText('#adminDailyExportTitle', t('adminDailyExportTitle'));
    setText('#adminDailyExportDesc', t('adminDailyExportDesc'));
    setText('#adminExportDayPdfBtn', t('adminExportDayPdf'));
    setText('#adminExportAllSalesPdfBtn', t('adminExportAllSalesPdf'));
    setText('#adminStockAuditPdfBtn', t('adminStockAuditPdf'));
    setText('#adminStockSectionTitle', t('adminStockSectionTitle'));
    setText('#adminStockSectionDesc', t('adminStockSectionDesc'));
    setText('#adminStockSummaryTotalLabel', t('adminStockSummaryTotalDrinks'));
    setText('#adminStockSummaryLowLabel', t('adminStockSummaryLow'));
    setText('#adminStockSummaryOutLabel', t('adminStockSummaryOut'));
    setPlaceholder('#adminStockSearch', t('searchDrinks'));
    setText('#adminStockFilterAll', t('all'));
    setText('#adminStockFilterLow', t('adminStockFilterLow'));
    setText('#adminStockFilterOut', t('adminStockFilterOut'));
    setText('#adminStockNoDataCell', t('adminNoStockMatch'));
    setText('#adminAccountsExportTitle', t('adminAccountsExportTitle'));
    setText('#adminAccountsExportDesc', t('adminAccountsExportDesc'));
    setText('#adminDataProtectionTitle', t('adminDataProtectionTitle'));
    setText('#adminDataProtectionDesc', t('adminDataProtectionDesc'));
    setText('#adminClearDataQuickBtn', t('adminClearCurrentUserData'));
    setText('#adminAiTitle', t('adminAiTitle'));
    setText('#adminAiDesc', t('adminAiDesc'));
    setText('#adminRunAiBtn', t('adminAnalyzeBusiness'));
    setText('#adminAiPlaceholder', t('adminAiPlaceholder'));
    setText('#adminSummaryTotalLabel', t('adminSummaryTotalAccounts'));
    setText('#adminSummaryPrivilegedLabel', t('adminSummaryAdminOwner'));
    setText('#adminSummaryStaffLabel', t('adminSummaryStaff'));
    setText('#adminSummaryInactiveLabel', t('adminSummaryInactive'));
    setText('#adminDailyHeadDate', t('adminDailyHeadDate'));
    setText('#adminDailyHeadTransactions', t('adminDailyHeadTransactions'));
    setText('#adminDailyHeadCases', t('adminDailyHeadCases'));
    setText('#adminDailyHeadTotal', t('adminDailyHeadTotal'));
    setText('#adminDailyHeadProfit', t('adminDailyHeadProfit'));
    setText('#adminDailyHeadPrint', t('adminDailyHeadPrint'));
    setText('#adminDailyNoDataCell', t('adminNoSalesDataYet'));
    setText('#adminEmployerAccountsTitle', t('adminEmployerAccountsTitle'));
    setText('#adminFilterAll', t('all'));
    setText('#adminFilterPrivileged', t('adminFilterPrivileged'));
    setText('#adminFilterStaff', t('adminFilterStaff'));
    setText('#adminFilterInactive', t('adminFilterInactive'));

    // Customers page
    setText('#customers button[onclick="openCustomerForm()"]', `+ ${t('addCustomer')}`);
    setText('#customers button[onclick="exportDebtSummaryPDF()"]', t('exportDebtSummary'));
    setPlaceholder('#customers .customer-controls .search-input', t('searchCustomers'));
    const customerFilterBtns = document.querySelectorAll('#customers .filter-buttons .filter-btn');
    if (customerFilterBtns[0]) customerFilterBtns[0].textContent = t('all');
    if (customerFilterBtns[1]) customerFilterBtns[1].textContent = t('owing');
    if (customerFilterBtns[2]) customerFilterBtns[2].textContent = t('cleared');

    // Clate/Deposit page
    setText('#clate button[onclick="openDepositForm()"]', `+ ${t('addDeposit')}`);
    setText('#clate .page-description', t('trackDeposits'));
    setPlaceholder('#depositSearch', t('searchDeposits'));
    const depositFilterBtns = document.querySelectorAll('#clate .filter-buttons .filter-btn');
    if (depositFilterBtns[0]) depositFilterBtns[0].textContent = t('all');
    if (depositFilterBtns[1]) depositFilterBtns[1].textContent = t('pending');
    if (depositFilterBtns[2]) depositFilterBtns[2].textContent = t('returned');

    // Sales history page
    setText('#salesHistory button[onclick="exportSalesHistoryPDF()"]', t('exportPdf'));
    setPlaceholder('#salesSearch', t('searchSales'));
    const saleTypeFilterBtns = document.querySelectorAll('#salesHistory .filter-buttons .filter-btn');
    if (saleTypeFilterBtns[0]) saleTypeFilterBtns[0].textContent = t('all');
    if (saleTypeFilterBtns[1]) saleTypeFilterBtns[1].textContent = t('cash');
    if (saleTypeFilterBtns[2]) saleTypeFilterBtns[2].textContent = t('creditSale');
    const historyHeaders = document.querySelectorAll('#salesHistoryTable thead th');
    if (historyHeaders[0]) historyHeaders[0].textContent = t('dateTime');
    if (historyHeaders[1]) historyHeaders[1].textContent = t('items');
    if (historyHeaders[2]) historyHeaders[2].textContent = t('quantity');
    if (historyHeaders[3]) historyHeaders[3].textContent = t('unitPrice');
    if (historyHeaders[4]) historyHeaders[4].textContent = t('total');
    if (historyHeaders[5]) historyHeaders[5].textContent = t('type');
    if (historyHeaders[6]) historyHeaders[6].textContent = t('customers');
    if (historyHeaders[7]) historyHeaders[7].textContent = t('actions');
    const noSalesCell = document.querySelector('#salesHistoryBody td[colspan="8"]');
    if (noSalesCell) noSalesCell.textContent = t('noSalesYet');

    // Reports page
    const reportBtns = document.querySelectorAll('#reports .report-controls .report-btn');
    if (reportBtns[0]) reportBtns[0].textContent = t('daily');
    if (reportBtns[1]) reportBtns[1].textContent = t('weekly');
    if (reportBtns[2]) reportBtns[2].textContent = t('monthly');
    if (reportBtns[3]) reportBtns[3].textContent = t('annual');
    if (reportBtns[4]) reportBtns[4].textContent = t('fullReport');
    setText('#reports .reports-help', t('reportsHelp'));
    setText('#reports .range-panel-title', t('customRangeReport'));
    setText('#reports label[for="rangeStartDate"]', t('startDate'));
    setText('#reports label[for="rangeEndDate"]', t('endDate'));
    setText('#reports label[for="rangeMonth"]', t('fullMonth'));
    setText('#reports button[onclick="setRangeToThisMonth()"]', t('thisMonth'));
    setText('#reports button[onclick="setRangeToSelectedMonth()"]', t('useSelectedMonth'));
    setText('#reports button[onclick="showCustomRangeReport()"]', t('loadRangeReport'));
    setText('#reports button[onclick="exportCustomRangePDF()"]', t('exportRangePdf'));
    setText('#reports .range-note', t('rangeNote'));

    // Settings page
    setText('#settingsBusinessTitle', t('businessSettings'));
    setText('#settingsInterfaceTitle', t('interfaceSettings'));
    setText('#settingsDataTitle', t('dataManagement'));
    setText('#settingsSystemTitle', t('appInformation'));
    setText('#settings label[for="profitPercentage"]', t('profitPercentage'));
    setText('#settings label[for="profitMode"]', t('profitModeLabel'));
    const profitModePercentageOption = document.querySelector('#profitMode option[value="percentage"]');
    const profitModePerCaseOption = document.querySelector('#profitMode option[value="perCase"]');
    if (profitModePercentageOption) profitModePercentageOption.textContent = t('profitModePercentage');
    if (profitModePerCaseOption) profitModePerCaseOption.textContent = t('profitModePerCase');
    setText('#settings button[onclick="saveProfitPercentage()"]', t('save'));
    setText('#profitInfoText', t('profitInfo'));
    setText('#drinkProfitManagerTitle', t('drinkProfitManagerTitle'));
    setText('#saveDrinkProfitBtn', t('saveDrinkProfits'));
    setText('#drinkProfitInfoText', t('drinkProfitInfo'));
    setText('#settings label[for="themeMode"]', t('themeMode'));
    setText('#lightThemeBtn', t('lightMode'));
    setText('#darkThemeBtn', t('darkMode'));
    setText('#settings label[for="language"]', t('selectLanguage'));
    setText('#languageInfoText', t('languageInfo'));
    setText('#settings label[for="currency"]', t('currencySymbol'));
    setText('#currencyInfoText', t('currencyInfo'));
    setText('#saveLanguageCurrencyBtn', t('saveLanguageCurrency'));
    setText('#settings button[onclick="clearAllData()"]', t('clearAllData'));
    setText('#clearUserDataBtn', t('clearAllData'));
    setText('#clearWarningText', t('warningClearData'));
    setText('#clearDataConfirmTitle', t('clearDataConfirmTitle'));
    setText('#clearDataConfirmInstruction', t('clearDataConfirmInstruction'));
    setText('#clearDataConfirmLabel', t('clearDataConfirmLabel'));
    setText('#clearDataConfirmCancelBtn', t('cancel'));
    setText('#clearDataConfirmSubmitBtn', t('clearDataConfirmAction'));
    setPlaceholder('#clearDataConfirmInput', t('clearDataConfirmPlaceholder'));
    setText('#clearDataConfirmError', t('clearDataConfirmMismatch'));

    // App info and footer
    const appNameRow = document.getElementById('appNameRow');
    if (appNameRow) appNameRow.innerHTML = `<strong>${t('appName')}</strong> Make A Way`;
    const versionRow = document.getElementById('versionRow');
    if (versionRow) versionRow.innerHTML = `<strong>${t('version')}</strong> 2.0`;
    const purposeRow = document.getElementById('purposeRow');
    if (purposeRow) purposeRow.innerHTML = `<strong>${t('purpose')}</strong> ${t('appPurposeValue')}`;
    const storageRow = document.getElementById('storageRow');
    if (storageRow) storageRow.innerHTML = `<strong>${t('storageLabel')}</strong> <span id="storageStatus">${document.getElementById('storageStatus')?.textContent || 'Checking...'}</span>`;
    const accountRow = document.getElementById('accountRow');
    if (accountRow) accountRow.innerHTML = `<strong>${t('activeAccountLabel')}</strong> <span id="activeAccountName">${activeUser ? (activeUser.name || activeUser.phone) : t('notLoggedIn')}</span>`;
    const footerText = document.querySelector('.footer p');
    if (footerText) footerText.textContent = `${t('footerText')} © 2026`;

    // Keep dynamic parts in sync
    refreshStorageStatus();
    updateActiveUserBadge();
    refreshAdminAccessUI();
    refreshDataManagementAccessUI();
    if (onboardingVisible) renderOnboardingStep();
    updateQuickDrinkSelect();
    updateCartDisplay();
    renderDrinkProfitEditor();
    renderAdminPanel();
}

function ensureClearDataConfirmBindings() {
    const overlay = document.getElementById('clearDataConfirmOverlay');
    const input = document.getElementById('clearDataConfirmInput');
    const cancelBtn = document.getElementById('clearDataConfirmCancelBtn');
    const submitBtn = document.getElementById('clearDataConfirmSubmitBtn');
    if (!overlay || !input || !cancelBtn || !submitBtn) return false;
    if (overlay.dataset.bound) return true;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeClearDataConfirmForm();
    });
    input.addEventListener('input', handleClearDataConfirmInput);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !submitBtn.disabled) {
            event.preventDefault();
            void confirmClearAllData();
        }
    });
    cancelBtn.addEventListener('click', closeClearDataConfirmForm);
    overlay.dataset.bound = '1';
    return true;
}

function handleClearDataConfirmInput() {
    const input = document.getElementById('clearDataConfirmInput');
    const submitBtn = document.getElementById('clearDataConfirmSubmitBtn');
    const errorEl = document.getElementById('clearDataConfirmError');
    if (!input || !submitBtn) return;

    const normalized = String(input.value || '').trim();
    submitBtn.disabled = normalized !== 'CLEAR USER DATA';
    if (errorEl) errorEl.style.display = 'none';
}

function openClearDataConfirmForm() {
    if (!activeUser) {
        alert('Please login first.');
        return;
    }
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return;
    }
    if (!ensureClearDataConfirmBindings()) {
        const ok = window.prompt('Type CLEAR USER DATA to confirm:');
        if (ok === 'CLEAR USER DATA') {
            void confirmClearAllData(true);
        }
        return;
    }

    const overlay = document.getElementById('clearDataConfirmOverlay');
    const input = document.getElementById('clearDataConfirmInput');
    const submitBtn = document.getElementById('clearDataConfirmSubmitBtn');
    const errorEl = document.getElementById('clearDataConfirmError');

    if (input) input.value = '';
    if (submitBtn) submitBtn.disabled = true;
    if (errorEl) {
        errorEl.textContent = t('clearDataConfirmMismatch');
        errorEl.style.display = 'none';
    }
    if (overlay) overlay.style.display = 'block';
    if (input) input.focus();
}

function closeClearDataConfirmForm() {
    const overlay = document.getElementById('clearDataConfirmOverlay');
    const input = document.getElementById('clearDataConfirmInput');
    const errorEl = document.getElementById('clearDataConfirmError');
    const submitBtn = document.getElementById('clearDataConfirmSubmitBtn');
    if (overlay) overlay.style.display = 'none';
    if (input) input.value = '';
    if (submitBtn) submitBtn.disabled = true;
    if (errorEl) errorEl.style.display = 'none';
}

async function confirmClearAllData(skipInputValidation = false) {
    if (!activeUser) {
        alert('Please login first.');
        closeClearDataConfirmForm();
        return;
    }
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        closeClearDataConfirmForm();
        return;
    }

    const confirmationInput = document.getElementById('clearDataConfirmInput');
    const errorEl = document.getElementById('clearDataConfirmError');
    const confirmation = String(confirmationInput ? confirmationInput.value : '').trim();
    const isValid = skipInputValidation || confirmation === 'CLEAR USER DATA';

    if (!isValid) {
        if (errorEl) {
            errorEl.textContent = t('clearDataConfirmMismatch');
            errorEl.style.display = 'block';
        }
        return;
    }

    sales = [];
    customers = [];
    clates = [];
    drinks = [];
    settings = getDefaultUserSettings();
    cart = [];
    yearlyArchives = [];

    await optimizedSaveData();
    updateHome();
    updateDrinkList();
    updateQuickDrinkSelect();
    updateCustomerDropdown();
    updateCartDisplay();
    renderStockManagement();
    renderArchiveYearOptions();
    showPage('home');
    closeClearDataConfirmForm();
    showSuccessToast(t('clearDataConfirmSuccess'));
}

function clearAllData() {
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return;
    }
    openClearDataConfirmForm();
}

// Make functions available globally
window.selectDrink = selectDrink;
window.toggleDrinkSelectionMode = toggleDrinkSelectionMode;
window.toggleDrinkDraftSelection = toggleDrinkDraftSelection;
window.resetQuickDrinkSelection = resetQuickDrinkSelection;
window.deleteDrink = deleteDrink;
window.addToCart = addToCart;
window.updateCartItemQty = updateCartItemQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.confirmSale = confirmSale;
window.changeQty = changeQty;
window.changeSaleType = changeSaleType;
window.saveNewDrink = saveNewDrink;
window.openCustomerForm = openCustomerForm;
window.closeCustomerForm = closeCustomerForm;
window.openDepositForm = openDepositForm;
window.closeDepositForm = closeDepositForm;
window.openAddDebtForm = openAddDebtForm;
window.openReduceDebtForm = openReduceDebtForm;
window.openClearDebtForm = openClearDebtForm;
window.closeDebtForm = closeDebtForm;
window.saveCustomer = saveCustomer;
window.saveDeposit = saveDeposit;
window.confirmDebt = confirmDebt;
window.deleteCustomer = deleteCustomer;
window.filterCustomers = filterCustomers;
window.returnKosiyo = returnKosiyo;
window.deleteKosiyo = deleteKosiyo;
window.filterDeposits = filterDeposits;
window.showDailyReport = showDailyReport;
window.setDailyReportToday = setDailyReportToday;
window.printCurrentReport = printCurrentReport;
window.setRangeToThisMonth = setRangeToThisMonth;
window.setRangeToSelectedMonth = setRangeToSelectedMonth;
window.showCustomRangeReport = showCustomRangeReport;
window.exportCustomRangePDF = exportCustomRangePDF;
window.showWeeklyReport = showWeeklyReport;
window.showMonthlyReport = showMonthlyReport;
window.showAnnualReport = showAnnualReport;
window.showFullReport = showFullReport;
window.exportReportToPDF = exportReportToPDF;
window.exportDebtSummaryPDF = exportDebtSummaryPDF;
window.exportCustomerDebtPDF = exportCustomerDebtPDF;
window.displaySalesHistory = displaySalesHistory;
window.applySalesHistoryFilters = applySalesHistoryFilters;
window.goToTodaySalesHistory = goToTodaySalesHistory;
window.filterSalesByType = filterSalesByType;
window.deleteTransaction = deleteTransaction;
window.showTransactionDetails = showTransactionDetails;
window.deleteSale = deleteSale;
window.exportSalesHistoryPDF = exportSalesHistoryPDF;
window.loadSettings = loadSettings;
window.saveProfitPercentage = saveProfitPercentage;
window.saveDrinkProfitsFromSettings = saveDrinkProfitsFromSettings;
window.setTheme = setTheme;
window.saveCurrencyAndLanguage = saveCurrencyAndLanguage;
window.clearAllData = clearAllData;
window.archiveSelectedYear = archiveSelectedYear;
window.openClearDataConfirmForm = openClearDataConfirmForm;
window.closeClearDataConfirmForm = closeClearDataConfirmForm;
window.confirmClearAllData = confirmClearAllData;
window.showPage = showPage;
window.filterDrinks = filterDrinks;
window.updateLanguageUI = updateLanguageUI;
window.setStockFilter = setStockFilter;
window.renderStockManagement = renderStockManagement;
window.saveStockValues = saveStockValues;
window.applyStockAdjustment = applyStockAdjustment;
window.openStockAdjustForm = openStockAdjustForm;
window.closeStockAdjustForm = closeStockAdjustForm;
window.confirmStockAdjustment = confirmStockAdjustment;
window.exportStockManagementPDF = exportStockManagementPDF;
window.setAdminUserFilter = setAdminUserFilter;
window.setAdminMainTab = setAdminMainTab;
window.setAdminSalesSubTab = setAdminSalesSubTab;
window.setAdminStockFilter = setAdminStockFilter;
window.renderAdminPanel = renderAdminPanel;
window.renderAdminSalesStockManagement = renderAdminSalesStockManagement;
window.toggleUserRole = toggleUserRole;
window.toggleUserActiveStatus = toggleUserActiveStatus;
window.adminResetUserPin = adminResetUserPin;
window.adminResetUserAdminPin = adminResetUserAdminPin;
window.viewUserDataSnapshot = viewUserDataSnapshot;
window.exportAdminUsersPDF = exportAdminUsersPDF;
window.saveAdminStockValues = saveAdminStockValues;
window.runAdminGrowthAnalysis = runAdminGrowthAnalysis;
window.runBusinessAiAdvisor = runBusinessAiAdvisor;
window.renderAdminBusinessAnalysisTab = renderAdminBusinessAnalysisTab;
window.toggleAdminDrinksPieChart = toggleAdminDrinksPieChart;
window.setAdminGrowthWindow = setAdminGrowthWindow;
window.selectAdminGrowthPoint = selectAdminGrowthPoint;
window.exportAdminDailySalesPDF = exportAdminDailySalesPDF;
window.exportAdminAllSalesPDF = exportAdminAllSalesPDF;
window.exportAdminStockAuditPDF = exportAdminStockAuditPDF;


