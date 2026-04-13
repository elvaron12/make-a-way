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

function hasPdfAutoTablePlugin() {
    const jsPDF = getPDFConstructor();
    return Boolean(
        jsPDF?.API?.autoTable ||
        window.jspdf?.jsPDF?.API?.autoTable ||
        window.jsPDF?.API?.autoTable
    );
}

function waitForPdfLibrary(check, timeoutMs = 1500, intervalMs = 100) {
    return new Promise((resolve) => {
        const startedAt = Date.now();

        function poll() {
            if (check()) {
                resolve(true);
                return;
            }

            if ((Date.now() - startedAt) >= timeoutMs) {
                resolve(Boolean(check()));
                return;
            }

            setTimeout(poll, intervalMs);
        }

        poll();
    });
}

function loadPdfScriptAsset(src) {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
            reject(new Error('Document is not available for loading PDF libraries.'));
            return;
        }

        const script = document.createElement('script');
        const normalizedSrc = String(src || '').trim();
        script.src = normalizedSrc;
        script.async = false;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error(`Could not load ${normalizedSrc}`));
        document.head.appendChild(script);
    });
}

async function loadPdfScriptAssetFromCandidates(candidates = []) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    let lastError = null;

    for (const src of list) {
        const normalizedSrc = String(src || '').trim();
        if (!normalizedSrc) continue;
        try {
            await loadPdfScriptAsset(normalizedSrc);
            return normalizedSrc;
        } catch (error) {
            lastError = error;
            console.warn(`PDF asset load failed for ${normalizedSrc}`, error);
        }
    }

    throw lastError || new Error('Could not load required PDF asset.');
}

let pdfLibrariesReadyPromise = null;

async function ensurePDFLibrariesReady() {
    if (getPDFConstructor() && hasPdfAutoTablePlugin() && typeof window.html2canvas === 'function') {
        return true;
    }

    if (pdfLibrariesReadyPromise) {
        return pdfLibrariesReadyPromise;
    }

    pdfLibrariesReadyPromise = (async () => {
        const jsPdfSources = [
            'libs/jspdf.umd.min.js',
            'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
            'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
        ];
        const autoTableSources = [
            'libs/jspdf.plugin.autotable.min.js',
            'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
            'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
        ];
        const html2canvasSources = [
            'libs/html2canvas.min.js',
            'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
            'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
        ];

        const alreadyLoaded = await waitForPdfLibrary(() => Boolean(getPDFConstructor()), 1200, 120);
        if (!alreadyLoaded) {
            await loadPdfScriptAssetFromCandidates(jsPdfSources);
            const loadedAfterRetry = await waitForPdfLibrary(() => Boolean(getPDFConstructor()), 1800, 120);
            if (!loadedAfterRetry) {
                throw new Error('jsPDF library is still unavailable after retrying local and CDN sources.');
            }
        }

        if (!hasPdfAutoTablePlugin()) {
            try {
                await loadPdfScriptAssetFromCandidates(autoTableSources);
                await waitForPdfLibrary(() => hasPdfAutoTablePlugin(), 1000, 120);
            } catch (error) {
                console.warn('autoTable plugin could not be reloaded. Falling back to simple PDF tables.', error);
            }
        }

        if (typeof window.html2canvas !== 'function') {
            try {
                await loadPdfScriptAssetFromCandidates(html2canvasSources);
            } catch (error) {
                console.warn('html2canvas could not be reloaded.', error);
            }
        }

        return true;
    })().catch((error) => {
        pdfLibrariesReadyPromise = null;
        throw error;
    });

    return pdfLibrariesReadyPromise;
}

function createPDFDocument(options = {}) {
    const jsPDF = getPDFConstructor();
    
    if (!jsPDF) {
        throw new Error('jsPDF library is not loaded. The app will try to reload it automatically on the next export.');
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
let adminSales = [];
let adminSalesCacheLoaded = false;
let customers = [];
let clates = [];
let drinks = [];
let settings = {};
let yearlyArchives = [];
let appMeta = {};
let saleQty = 1;
let selectedCustomerId = null;
let currentSaleType = "normal";
let creditCustomerSearchTerm = '';
let selectedSalesHistoryType = 'all';
let rwandaClockInterval = null;
let rwandaClockSyncInterval = null;
let rwandaClockBaseEpochMs = null;
let rwandaClockBasePerfMs = null;
let rwandaClockLifecycleBound = false;
let autoBackupTimeout = null;
let autoDailySalesPdfTimeout = null;
let autoDailySalesPdfCheckInterval = null;
let connectivityBannerHideTimeout = null;
const AUTO_BACKUP_HOUR = 22;
const DEFAULT_AUTO_DAILY_SALES_PDF_TIME = '21:00';
const CONNECTIVITY_BANNER_HIDE_MS = 3200;
const AUTO_DAILY_SALES_PDF_CHECK_INTERVAL_MS = 30000;
let homeDebtNotificationRenderToken = 0;

const RWANDA_TIME_ZONE = 'Africa/Kigali';
const RWANDA_TIME_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const GLOBAL_DRINKS_KEY = 'global_drinks';
const offlineSyncState = {
    supported: false,
    serviceWorkerRegistered: false,
    syncInFlight: false,
    lastSyncAt: 0,
    lastError: ''
};

// ================= CART SYSTEM =================
let cart = []; // Cart items array
let drinkSelectionModeEnabled = false;
let selectedDrinksDraft = {};
let selectedStockFilter = 'all';
let pendingStockAdjustContext = null;
let selectedAdminUserFilter = 'all';
let selectedAdminStockFilter = 'all';
let activeAdminMainTab = 'accounts';
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
const AI_ASSISTANT_CACHE_TTL_MS = 60000;
const AI_ASSISTANT_RESTOCK_WINDOW_DAYS = 30;
const AI_ASSISTANT_FAST_WINDOW_DAYS = 7;
const AI_ASSISTANT_SLOW_WINDOW_DAYS = 30;
const AI_ASSISTANT_MAX_PRIORITIES = 5;
const ADMIN_AI_EMPTY_MESSAGE = 'No data available yet. Add sales to unlock insights.';
const aiAssistantState = {
    isOpen: false,
    cacheAt: 0,
    cachedAnalysis: null,
    lastDailyReportDate: '',
    voiceRecognition: null,
    voiceActive: false,
    generating: false,
    externalAdviceCache: {},
    externalAdviceCacheAt: {}
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
        adminSearchEmployersPlaceholder: 'Find employers by name or phone',
        adminFilterPrivileged: 'Admin/Owner',
        adminFilterStaff: 'Employees',
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
        adminAccountsExportTitle: 'Exports & Reports',
        adminAccountsExportDesc: 'Keep exports separate from account management actions.',
        adminDataProtectionTitle: 'Data Protection',
        adminDataProtectionDesc: 'Type DELETE before clearing the current user workspace.',
        adminAiTitle: 'AI Assistant',
        adminAiDesc: 'Generate fresh insights first, then review health, summary, alerts, priorities, and quick commands.',
        adminAnalyzeBusiness: 'Generate Insights',
        adminAiPlaceholder: 'Run the AI to get a clear answer, a short explanation, and an action you can take next.',
        adminSummaryTotalAccounts: 'Total Accounts',
        adminSummaryAdminOwner: 'Admin + Owner',
        adminSummaryStaff: 'Employees',
        adminSummaryInactive: 'Inactive',
        adminDailyHeadDate: 'Date',
        adminDailyHeadTransactions: 'Transactions',
        adminDailyHeadCases: 'Cases Sold',
        adminDailyHeadTotal: 'Total Sales',
        adminDailyHeadProfit: 'Profit',
        adminDailyHeadPrint: 'Print',
        adminEmployerAccountsTitle: 'User Management',
        adminNoSalesDataYet: 'No sales data yet.',
        adminNoStockMatch: 'No drinks match this filter.',
        adminNoEmployersMatch: 'No employers match this filter.',
        adminAnalysisRequiresSession: 'Admin session required for analysis.',
        adminExportDayNoSales: 'No sales found for that day.',
        signUp: 'Admin Sign Up',
        fullName: 'Full Name',
        phoneOrEmail: 'Phone Number',
        emailAddress: 'Email Address',
        phoneNumber: 'Phone Number',
        pinLabel: 'Password',
        confirmPin: 'Confirm Password',
        accountType: 'Account Type',
        signupRoleStaff: 'Employee Account',
        signupRoleAdmin: 'Admin Account',
        adminPinLabel: 'Admin Password',
        confirmAdminPin: 'Confirm Admin Password',
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
        forgotPin: 'Forgot Password?',
        resetPin: 'Reset Password',
        resetPinHint: 'Use your phone number to set a new password.',
        resetNewPin: 'New Password',
        resetConfirmPin: 'Confirm New Password', 
        cancel: 'Cancel',
        authSubtitle: 'Business sales, stock, backup, and reporting in one workspace.',
        authModeLoginTitle: 'Staff Login',
        authModeLoginText: 'Use your phone number and password to open today\'s workspace.',
        authModeAdminTitle: 'Admin Session',
        authModeAdminText: 'Admin mode unlocks sales exports, account control, and protected settings.',
        authModeSignupTitle: 'Create Owner Account',
        authModeSignupText: 'Create the first owner account to secure the app before employees start using it.',
        authResetDescription: 'Use the phone number registered on the account, enter the admin reset code, then choose a new password.',
        authResetPreviewEmpty: 'We will match the phone number to an existing account.',
        authResetPreviewFound: 'Account found: {name} ({phone}). Set the new password below.',
        authResetPreviewMissing: 'No saved account matches {phone} yet. Check the number and try again.',
        adminAutoPdfToggle: 'Auto-download the day\'s sales PDF every day',
        adminAutoPdfTimeLabel: 'Export Time',
        adminAutoPdfSave: 'Save Auto Export',
        connectivitySyncNow: 'Sync Now',
        authHintLogin: 'Phone number and password.',
        authHintAdmin: 'Admin access only.',
        authHintSignup: 'Create owner account.',
        authHintReset: 'Enter phone, reset code, and new password.',
        authInvalidCredentials: 'Incorrect phone number or password',
        authAccountInactive: 'This account is inactive. Please contact the owner.',
        authAdminInvalidCredentials: 'Incorrect admin phone number or password',
        authAdminAccessDenied: 'This account does not have admin access',
        authAdminSetupRequiresUserPin: 'Admin password required to continue.',
        authAdminSetupPrompt: 'Set a new Admin Password',
        authAdminConfirmPrompt: 'Confirm Admin Password',
        authSecretCodePrompt: 'Enter the admin reset secret code to continue.',
        authSecretCodeInvalid: 'Secret code is incorrect. Password reset cancelled.',
        authAdminPinMustDiffer: 'Admin password must be different from your main password',
        authAdminSetupCancelled: 'Admin password setup cancelled.',
        authAdminSetupSuccess: 'Admin password created. You can now login as admin.',
        authTooManyAttempts: 'Too many failed attempts. Try again in 1 minute.',
        authNameRequired: 'Please enter your full name',
        authPhoneRequired: 'Please enter a valid phone number',
        authEmailRequired: 'Please enter your email address',
        authEmailInvalid: 'Please enter a valid email address',
        authPhoneExists: 'An account with this phone number already exists',
        authEmailExists: 'An account with this email already exists',
        authPinRules: 'Password must be at least 5 characters',
        authPinMismatch: 'Passwords do not match',
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
        authPinResetSuccess: 'Password reset successfully. You can now log in.',
        authAdminOnlyCreate: 'Only admin accounts can create new users.',
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
        overdue: 'Overdue',
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
        accountSecurity: 'Account & Security',
        businessSettings: 'Business Settings',
        interfaceSettings: 'Appearance, Language & Currency',
        appearancePreferences: 'Appearance & Preferences',
        systemStatus: 'System Status',
        automationsReports: 'Automations & Reports',
        aiAssistantSettings: 'AI Assistant',
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
        savePreferences: 'Save Preferences',
        saveBusinessSettings: 'Save Business Settings',
        saveAutomationSettings: 'Save Automation Settings',
        dataManagement: 'Data Management',
        changePin: 'Change PIN',
        generateResetCode: 'Generate Reset Code',
        logoutLabel: 'Log Out',
        connectionStatusLabel: 'Connection Status',
        lastSyncLabel: 'Last Sync',
        generateInsights: 'Generate Insights',
        quickAnalyze: 'Analyze',
        quickRestock: 'Restock',
        quickProfitInsights: 'Profit Insights',
        downloadLastAutoPdf: 'Download Last Auto PDF',
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
        homeRevenueLabel: "Today's Revenue",
        homeLowStockLabel: 'Low Stock Items',
        homeCreditLabel: 'Outstanding Credit',
        homeSalesOverviewTitle: 'Monthly Sales Overview',
        homeLowStockPanelTitle: 'Low Stock Alert',
        selectedDrinksTitle: 'Selected Drinks',
        addSelectedToCart: 'Add Selected to Cart',
        refreshLabel: 'Refresh',
        allActions: 'All Actions',
        depositsAction: 'Deposits',
        darkModeActive: 'Dark mode active',
        savePreferencesSuccess: 'Preferences saved. Dark mode and language updated.',
        customerActionAddDebt: 'Add Debt',
        customerActionReduceDebt: 'Reduce Debt',
        customerActionClearDebt: 'Clear Debt',
        customerActionExportPdf: 'Export PDF',
        customerActionDelete: 'Delete Customer',
        adminAiLabel: 'AI Advisor',
        adminAiToneHealthy: 'Healthy',
        adminAiToneWatch: 'Watch',
        adminAiToneStable: 'Stable',
        adminAiInsightLabel: 'Insight',
        adminAiReasonLabel: 'Reason',
        adminAiActionLabel: 'Action',
        adminAiSignalsLabel: 'Signals',
        adminAiUpdatedNow: 'Updated now',
        adminAiUpdatedAt: 'Updated {time}',
        adminAiRecommendationSingular: 'recommendation',
        adminAiRecommendationPlural: 'recommendations',
        adminAiDebtCustomerSingular: 'debt customer',
        adminAiDebtCustomerPlural: 'debt customers',
        adminAiOverdueLabel: 'overdue',
        adminAiRealData: 'Real business data',
        adminAiGrowthTipsTitle: 'Growth Tips',
        adminAiActionPlanTitle: 'Action Plan',
        adminAiDebtSectionTitle: 'Customers with Debt',
        adminAiCashflowWatch: 'Cashflow Watch',
        adminAiTotalOwing: 'Total Owing',
        adminAiInDebt: 'In Debt',
        adminAiNoDueDate: 'No due date',
        adminAiNoDebtActive: 'No customer debts are active. Great collection discipline.',
        adminAiNoDataTitle: 'No data yet',
        adminAiInsightFallbackTitle: 'Insight',
        confirmActionTitle: 'Confirm Action',
        confirmActionMessage: 'Are you sure you want to continue?',
        confirmActionButton: 'Confirm',
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
        signUp: 'Iyandikishe nka Admin',
        fullName: 'Amazina yuzuye',
        phoneOrEmail: 'Telefoni',
        emailAddress: 'Imeyili',
        phoneNumber: 'Nimero ya telefone',
        pinLabel: 'Ijambobanga',
        confirmPin: 'Emeza ijambobanga',
        accountType: 'Ubwoko bwa konti',
        signupRoleStaff: 'Konti y\'umukozi',
        signupRoleAdmin: 'Konti ya admin',
        adminPinLabel: 'Ijambobanga rya admin',
        confirmAdminPin: 'Emeza ijambobanga rya admin',
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
        forgotPin: 'Wibagiwe ijambobanga?',
        resetPin: 'Hindura ijambobanga',
        resetPinHint: 'Koresha telefoni yawe kugira ngo ushyireho ijambobanga rishya.',
        resetNewPin: 'Ijambobanga rishya',
        resetConfirmPin: 'Emeza ijambobanga rishya',
        cancel: 'Siba',
        authHintLogin: 'Koresha konti yawe usanzwe ufite kugira ngo ukomeze.',
        authHintAdmin: 'Admin yinjirana nimero ya telefone n\'ijambobanga.',
        authHintSignup: 'Iyandikishe nka admin gusa kugira ngo urinde porogaramu.',
        authHintReset: 'Andika telefone, kode yo gusubiramo, n ijambobanga rishya.',
        authInvalidCredentials: 'Nimero ya telefone cyangwa ijambobanga si byo',
        authAccountInactive: 'Iyi konti ntikora. Vugana na nyiri porogaramu.',
        authAdminInvalidCredentials: 'Nimero ya telefone ya admin cyangwa ijambobanga si byo',
        authAdminAccessDenied: 'Iyi konti nta burenganzira bwa admin ifite',
        authAdminSetupRequiresUserPin: 'Ijambobanga rya admin rirakenewe kugira ngo ukomeze.',
        authAdminSetupPrompt: 'Shyiraho ijambobanga rishya rya admin',
        authAdminConfirmPrompt: 'Emeza ijambobanga rya admin',
        authSecretCodePrompt: 'Shyiramo kode yihariye ya admin yo gukomeza.',
        authSecretCodeInvalid: 'Kode yihariye si yo. Guhindura ijambobanga byahagaritswe.',
        authAdminPinMustDiffer: 'Ijambobanga rya admin rigomba kuba ritandukanye n\'iry\'ibanze',
        authAdminSetupCancelled: 'Gushyiraho ijambobanga rya admin byahagaritswe.',
        authAdminSetupSuccess: 'Ijambobanga rya admin ryashyizweho. Ubu ushobora kwinjira nka admin.',
        authTooManyAttempts: 'Wagerageje inshuro nyinshi. Ongera nyuma y umunota 1.',
        authNameRequired: 'Andika amazina yawe yuzuye',
        authPhoneRequired: 'Andika nimero ya telefone yemewe',
        authEmailRequired: 'Andika imeyili yawe',
        authEmailInvalid: 'Andika imeyili yemewe',
        authPhoneExists: 'Iyi nimero isanzwe ifite konti',
        authEmailExists: 'Iyi imeyili isanzwe ifite konti',
        authPinRules: 'Ijambobanga rigomba kuba nibura inyuguti 5',
        authPinMismatch: 'Ijambobanga n\'iryemeza ntibihura',
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
        authPinResetSuccess: 'Ijambobanga ryahinduwe neza. Ubu ushobora kwinjira.',
        authAdminOnlyCreate: 'Konti za admin ni zo zonyine zishobora gukora konti nshya.',
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
        overdue: 'Byakererewe',
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
        accountSecurity: 'Konti n umutekano',
        businessSettings: "Igenamiterere ry'ubucuruzi",
        interfaceSettings: 'Imigaragarire, ururimi n ifaranga',
        appearancePreferences: 'Imigaragarire n ibyo ukunda',
        systemStatus: 'Imiterere ya sisitemu',
        automationsReports: 'Automatisasiyo na raporo',
        aiAssistantSettings: 'Umufasha wa AI',
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
        savePreferences: 'Bika ibyo ukunda',
        saveBusinessSettings: "Bika igenamiterere ry'ubucuruzi",
        saveAutomationSettings: 'Bika automatisasiyo',
        dataManagement: 'Gucunga amakuru',
        changePin: 'Hindura PIN',
        generateResetCode: 'Kora kode yo gusubiramo',
        logoutLabel: 'Sohoka',
        connectionStatusLabel: 'Imiterere y umuhora',
        lastSyncLabel: 'Iheruka guhuza',
        generateInsights: 'Kora insights',
        quickAnalyze: 'Sesengura',
        quickRestock: 'Ongera sitoki',
        quickProfitInsights: 'Insights ku nyungu',
        downloadLastAutoPdf: 'Kuramo PDF iheruka',
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
        adminRefresh: 'Vugurura',
        adminTabSales: 'Igurisha',
        adminTabAccountManagement: 'Imicungire ya konti',
        adminSubTabDailySales: 'Igurisha rya buri munsi',
        adminSubTabStock: 'Sitoki',
        adminExportAccountsPdf: 'Ohereza PDF ya konti',
        adminSearchEmployersPlaceholder: 'Shakisha abakozi ukoresheje izina cyangwa telefoni',
        adminFilterPrivileged: 'Admin/Nyiri porogaramu',
        adminFilterStaff: 'Abakozi',
        adminFilterInactive: 'Badakora',
        adminDailyExportTitle: 'Kohereza igurisha rya buri munsi',
        adminDailyExportDesc: 'Hitamo umunsi runaka wohereze igurisha ryose rikurikiranye.',
        adminExportDayPdf: 'Ohereza PDF y umunsi',
        adminExportAllSalesPdf: 'Ohereza PDF y igurisha ryose',
        adminStockAuditPdf: 'PDF ya igenzura rya sitoki',
        adminStockSectionTitle: 'Incamake ya sitoki',
        adminStockSectionDesc: 'Kurikirana sitoki nk uko biri kuri page ya stock kandi wohereze raporo.',
        adminStockSummaryTotalDrinks: 'Ibinyobwa byose',
        adminStockSummaryLow: 'Sitoki iri hasi',
        adminStockSummaryOut: 'Byashize',
        adminStockFilterLow: 'Hasi',
        adminStockFilterOut: 'Byashize',
        adminClearCurrentUserData: 'Siba amakuru y uwinjiye ubu',
        adminAccountsExportTitle: 'Kohereza na raporo',
        adminAccountsExportDesc: 'Tandukanya kohereza amakuru n ibikorwa byo gucunga konti.',
        adminDataProtectionTitle: 'Kurinda amakuru',
        adminDataProtectionDesc: 'Andika DELETE mbere yo gusiba amakuru y uwinjiye ubu.',
        adminAiTitle: 'Umujyanama wa AI',
        adminAiDesc: 'Banza ukore insights nshya, ubone kureba health, summary, alerts, priorities na quick commands.',
        adminAnalyzeBusiness: 'Kora Insights',
        adminAiPlaceholder: 'Koresha AI ubone igisubizo gisobanutse, impamvu ngufi, n igikorwa gikurikiraho.',
        adminSummaryTotalAccounts: 'Konti zose',
        adminSummaryAdminOwner: 'Admin + Nyiri porogaramu',
        adminSummaryStaff: 'Abakozi',
        adminSummaryInactive: 'Badakora',
        adminDailyHeadDate: 'Itariki',
        adminDailyHeadTransactions: 'Ibyakozwe',
        adminDailyHeadCases: 'Amakaso yagurishijwe',
        adminDailyHeadTotal: 'Igiteranyo cy igurisha',
        adminDailyHeadProfit: 'Inyungu',
        adminDailyHeadPrint: 'Capisha',
        adminEmployerAccountsTitle: 'Imicungire y abakoresha',
        adminNoSalesDataYet: 'Nta makuru y igurisha arahari.',
        adminNoStockMatch: 'Nta kinyobwa gihuye n iyi filter.',
        adminNoEmployersMatch: 'Nta mukozi uhuye n iyi filter.',
        adminAnalysisRequiresSession: 'Session ya admin irakenewe kugira ngo usesengure.',
        adminExportDayNoSales: 'Nta gurisha ribonetse kuri uwo munsi.',
        authSubtitle: 'Igurisha, sitoki, backup na raporo byose hamwe.',
        authModeLoginTitle: 'Kwinjira k umukozi',
        authModeLoginText: 'Koresha nimero ya telefone n ijambobanga ufungure workspace y uyu munsi.',
        authModeAdminTitle: 'Session ya Admin',
        authModeAdminText: 'Admin mode ifungura exports z igurisha, kugenzura konti n igenamiterere ririnzwe.',
        authModeSignupTitle: 'Fungura konti ya nyiri porogaramu',
        authModeSignupText: 'Fungura konti ya mbere ya nyiri porogaramu kugira ngo urinde porogaramu mbere y uko abakozi bayikoresha.',
        authResetDescription: 'Koresha nimero ya telefone ya konti, andika kode yo gusubiramo ya admin, hanyuma ushyireho ijambobanga rishya.',
        authResetPreviewEmpty: 'Turahuza nimero ya telefone na konti ibitswe.',
        authResetPreviewFound: 'Konti yabonetse: {name} ({phone}). Shyiramo ijambobanga rishya hasi.',
        authResetPreviewMissing: 'Nta konti ibitswe ihuye na {phone}. Reba neza nimero wongere ugerageze.',
        adminAutoPdfToggle: 'Kuramo PDF y igurisha rya buri munsi buri munsi',
        adminAutoPdfTimeLabel: 'Igihe cyo kohereza',
        adminAutoPdfSave: 'Bika auto export',
        connectivitySyncNow: 'Huza nonaha',
        homeRevenueLabel: "Amafaranga yinjijwe uyu munsi",
        homeLowStockLabel: 'Ibintu bya sitoki iri hasi',
        homeCreditLabel: 'Umwenda usigaye',
        homeSalesOverviewTitle: 'Incamake y igurisha rya buri kwezi',
        homeLowStockPanelTitle: 'Iburira rya sitoki iri hasi',
        selectedDrinksTitle: 'Ibinyobwa byatoranyijwe',
        addSelectedToCart: 'Ongeramo byatoranyijwe muri cart',
        refreshLabel: 'Vugurura',
        allActions: 'Ibikorwa byose',
        depositsAction: 'Ubwizigame',
        darkModeActive: 'Dark mode iri gukora',
        savePreferencesSuccess: 'Ibyo ukunda byabitswe. Dark mode n ururimi byavuguruwe.',
        customerActionAddDebt: 'Ongeraho umwenda',
        customerActionReduceDebt: 'Gabanya umwenda',
        customerActionClearDebt: 'Kuraho umwenda',
        customerActionExportPdf: 'Ohereza PDF',
        customerActionDelete: 'Siba umukiriya',
        adminAiLabel: 'Umujyanama wa AI',
        adminAiToneHealthy: 'Bimeze neza',
        adminAiToneWatch: 'Icyitonderwa',
        adminAiToneStable: 'Bihagaze neza',
        adminAiInsightLabel: 'Icyo wabonye',
        adminAiReasonLabel: 'Impamvu',
        adminAiActionLabel: 'Igikorwa',
        adminAiSignalsLabel: 'Ibimenyetso',
        adminAiUpdatedNow: 'Byavuguruwe nonaha',
        adminAiUpdatedAt: 'Byavuguruwe saa {time}',
        adminAiRecommendationSingular: 'inyunganizi',
        adminAiRecommendationPlural: 'inyunganizi',
        adminAiDebtCustomerSingular: 'umukiriya ufite umwenda',
        adminAiDebtCustomerPlural: 'abakiriya bafite imyenda',
        adminAiOverdueLabel: 'byakererewe',
        adminAiRealData: 'Amakuru nyayo y ubucuruzi',
        adminAiGrowthTipsTitle: 'Inama zo kuzamura ubucuruzi',
        adminAiActionPlanTitle: 'Uko ukora',
        adminAiDebtSectionTitle: 'Abakiriya bafite umwenda',
        adminAiCashflowWatch: 'Igenzura ry amafaranga yinjira',
        adminAiTotalOwing: 'Umwenda wose',
        adminAiInDebt: 'Bafite umwenda',
        adminAiNoDueDate: 'Nta tariki yo kwishyura',
        adminAiNoDebtActive: 'Nta mukiriya ufite umwenda uriho. Mwakomeje neza.',
        adminAiNoDataTitle: 'Nta makuru arahari',
        adminAiInsightFallbackTitle: 'Icyo wabonye',
        confirmActionTitle: 'Emeza igikorwa',
        confirmActionMessage: 'Uzi neza ko ushaka gukomeza?',
        confirmActionButton: 'Emeza',
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
signUp: 'Inscription Admin',
fullName: 'Nom complet',
phoneOrEmail: 'Téléphone',
emailAddress: 'Adresse email',
phoneNumber: 'Numéro de téléphone',
pinLabel: 'Mot de passe',
confirmPin: 'Confirmer le mot de passe',
accountType: 'Type de compte',
signupRoleStaff: 'Compte employe',
signupRoleAdmin: 'Compte admin',
adminPinLabel: 'Mot de passe admin',
confirmAdminPin: 'Confirmer le mot de passe admin',
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
forgotPin: 'Mot de passe oublié ?',
resetPin: 'Réinitialiser le mot de passe',
resetPinHint: 'Utilisez votre numéro de téléphone pour définir un nouveau mot de passe.',
resetNewPin: 'Nouveau mot de passe',
resetConfirmPin: 'Confirmer le nouveau mot de passe',
cancel: 'Annuler',
authHintLogin: 'Utilisez votre compte existant pour continuer.',
authHintAdmin: 'L’admin utilise votre numéro de téléphone et votre mot de passe.',
authHintSignup: 'Inscription admin uniquement pour sécuriser l’application.',
authHintReset: 'Entrez le telephone, le code de reinitialisation et le nouveau mot de passe.',
authInvalidCredentials: 'Numéro de téléphone ou mot de passe incorrect',
authAccountInactive: 'Ce compte est inactif. Contactez le propriétaire de l’application.',
authAdminInvalidCredentials: 'Numéro de téléphone admin ou mot de passe incorrect',
authAdminAccessDenied: 'Ce compte n’a pas les droits administrateur',
authAdminSetupRequiresUserPin: 'Mot de passe admin requis pour continuer.',
authAdminSetupPrompt: 'Définissez un nouveau mot de passe admin',
authAdminConfirmPrompt: 'Confirmez le mot de passe admin',
authSecretCodePrompt: 'Entrez le code secret admin pour continuer.',
authSecretCodeInvalid: 'Le code secret est incorrect. Réinitialisation annulée.',
authAdminPinMustDiffer: 'Le mot de passe admin doit être différent du mot de passe principal',
authAdminSetupCancelled: 'Configuration du mot de passe admin annulée.',
authAdminSetupSuccess: 'Mot de passe admin configuré. Vous pouvez maintenant vous connecter en tant qu’admin.',
authTooManyAttempts: 'Trop de tentatives. Réessayez après 1 minute.',
authNameRequired: 'Entrez votre nom complet',
authPhoneRequired: 'Entrez un numéro de téléphone valide',
authEmailRequired: 'Entrez votre email',
authEmailInvalid: 'Entrez un email valide',
authPhoneExists: 'Ce numéro possède déjà un compte',
authEmailExists: 'Cet email possède déjà un compte',
authPinRules: 'Le mot de passe doit contenir au moins 5 caractères',
authPinMismatch: 'Les mots de passe ne correspondent pas',
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
authPinResetSuccess: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
authAdminOnlyCreate: 'Seuls les comptes admin peuvent créer de nouveaux utilisateurs.',
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
overdue: 'En retard',
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
    const localizedMessage = localizeLooseText(message);
    const toast = document.createElement('div');
    toast.className = 'maw-success-toast';
    toast.innerHTML = `<span class="tick">&#10004;</span><span>${escapeHtml(localizedMessage)}</span>`;
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
        title = t('confirmActionTitle'),
        message = t('confirmActionMessage'),
        confirmText = t('confirmActionButton'),
        cancelText = t('cancel')
    } = options;

    const overlay = document.getElementById('uiConfirmOverlay');
    const titleEl = document.getElementById('uiConfirmTitle');
    const messageEl = document.getElementById('uiConfirmMessage');
    const cancelBtn = document.getElementById('uiConfirmCancelBtn');
    const okBtn = document.getElementById('uiConfirmOkBtn');

    if (!overlay || !titleEl || !messageEl || !cancelBtn || !okBtn || !ensureUiConfirmBindings()) {
        return Promise.resolve(window.confirm(String(message)));
    }

    titleEl.textContent = localizeLooseText(String(title));
    messageEl.textContent = localizeLooseText(String(message));
    cancelBtn.textContent = localizeLooseText(String(cancelText));
    okBtn.textContent = localizeLooseText(String(confirmText));

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

function getAutoBackupDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function getAutoBackupStateKey(user = activeUser) {
    const id = getUserStorageId(user);
    return id ? `auto_backup_last__${id}` : '';
}

function getAutoBackupStorageKey(user = activeUser, date = new Date()) {
    const id = getUserStorageId(user);
    return id ? `auto_backup__${id}__${getAutoBackupDateKey(date)}` : '';
}

function getAutoDailySalesPdfCacheKey(user = activeUser) {
    const id = getUserStorageId(user);
    return id ? `auto_daily_sales_pdf__${id}` : '';
}

async function runAutoBackupForUser(user = activeUser, date = new Date()) {
    if (!user) return false;
    const backupKey = getAutoBackupStorageKey(user, date);
    if (!backupKey) return false;

    const dayKey = getAutoBackupDateKey(date);
    const stateKey = getAutoBackupStateKey(user);
    if (stateKey) {
        const lastBackup = readLocalStorageKey(stateKey);
        if (lastBackup === dayKey) return false;
    }

    await waitForPendingSave();
    const payload = buildCurrentSavePayload(user);
    await saveNamedData(backupKey, payload);
    if (stateKey) {
        writeLocalStorageKey(stateKey, dayKey);
    }
    return true;
}

function scheduleAutoBackup() {
    if (autoBackupTimeout) {
        clearTimeout(autoBackupTimeout);
        autoBackupTimeout = null;
    }
    const now = new Date();
    const next = new Date(now);
    next.setHours(AUTO_BACKUP_HOUR, 0, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    const delay = Math.max(1000, next.getTime() - now.getTime());
    autoBackupTimeout = setTimeout(async () => {
        try {
            await runAutoBackupForUser(activeUser, new Date());
        } catch (error) {
            console.warn('Auto backup failed:', error);
        }
        scheduleAutoBackup();
    }, delay);
}

function getDefaultAutoDailySalesPdfTime() {
    return DEFAULT_AUTO_DAILY_SALES_PDF_TIME;
}

function isValidTimeValue(value) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());
}

function getDateAtLocalTime(baseDate = new Date(), timeValue = DEFAULT_AUTO_DAILY_SALES_PDF_TIME) {
    const normalizedTime = isValidTimeValue(timeValue) ? timeValue : DEFAULT_AUTO_DAILY_SALES_PDF_TIME;
    const [hours, minutes] = normalizedTime.split(':').map((part) => Number(part) || 0);
    const target = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate || Date.now());
    target.setHours(hours, minutes, 0, 0);
    return target;
}

function parseDayKeyToDate(dayKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || '').trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatAutoDailySalesPdfLabel(value, withTime = true) {
    const parsed = typeof value === 'string'
        ? (parseDayKeyToDate(value) || new Date(value))
        : new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleString([], withTime
        ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { month: 'short', day: 'numeric', year: 'numeric' });
}

async function cacheAutoDailySalesPdfBackup(blob, filename, dayIso, user = activeUser) {
    const cacheKey = getAutoDailySalesPdfCacheKey(user);
    if (!cacheKey || !(blob instanceof Blob)) return false;
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = bufferToBase64(arrayBuffer);
    await saveNamedData(cacheKey, {
        filename: String(filename || '').trim() || `admin-daily-sales-${dayIso || getTodayISODate()}.pdf`,
        dayIso: String(dayIso || '').trim() || getTodayISODate(),
        mimeType: blob.type || 'application/pdf',
        size: blob.size || 0,
        createdAt: new Date().toISOString(),
        base64
    });
    return true;
}

async function loadCachedAutoDailySalesPdfBackup(user = activeUser) {
    const cacheKey = getAutoDailySalesPdfCacheKey(user);
    if (!cacheKey) return null;
    const cached = await loadNamedData(cacheKey, null);
    if (!cached || typeof cached !== 'object' || !cached.base64) return null;
    return cached;
}

function triggerPdfBlobDownload(blob, filename) {
    const safeFilename = String(filename || '').trim() || `admin-daily-sales-${getTodayISODate()}.pdf`;
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = safeFilename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
        if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
        URL.revokeObjectURL(blobUrl);
    }, 1200);
}

function hasAutoDailySalesPdfPrivileges(user = activeUser) {
    return Boolean(user) && isAdminRoleUser(user);
}

function getAutoDailySalesPdfNextRun(now = new Date()) {
    const scheduled = getDateAtLocalTime(now, settings?.autoDailySalesPdfTime || getDefaultAutoDailySalesPdfTime());
    if (scheduled > now) return scheduled;
    const next = new Date(scheduled);
    next.setDate(next.getDate() + 1);
    return next;
}

function getAutoDailySalesPdfStatusMessage(now = new Date()) {
    const enabled = Boolean(settings?.autoDailySalesPdfEnabled);
    const timeValue = settings?.autoDailySalesPdfTime || getDefaultAutoDailySalesPdfTime();
    const todayKey = toLocalDayKey(now);
    const lastAttemptDate = String(settings?.autoDailySalesPdfLastAttemptDate || '').trim();
    const lastAttemptStatus = String(settings?.autoDailySalesPdfLastAttemptStatus || '').trim();
    const lastExportDate = String(settings?.autoDailySalesPdfLastExportDate || '').trim();

    if (!enabled) {
        return 'Automatic daily PDF export is off.';
    }
    if (!hasAutoDailySalesPdfPrivileges()) {
        return `Automatic export is saved for ${timeValue}, but it only runs while an admin account is open on this device.`;
    }
    if (lastAttemptDate === todayKey && lastAttemptStatus === 'success') {
        return `Today&apos;s PDF backup was prepared. If your browser blocked the download, use Download Last Auto PDF. Next run ${formatAutoDailySalesPdfLabel(getAutoDailySalesPdfNextRun(now))}.`;
    }
    if (lastAttemptDate === todayKey && lastAttemptStatus === 'empty') {
        return `Checked ${timeValue} today. No sales were available to export.`;
    }
    if (lastAttemptDate === todayKey && lastAttemptStatus === 'error') {
        return 'The automatic export tried today but did not finish. Use Export Day PDF or Sync Now to retry.';
    }

    const nextRunLabel = formatAutoDailySalesPdfLabel(getAutoDailySalesPdfNextRun(now));
    const lastExportText = lastExportDate
        ? ` Last prepared PDF: ${formatAutoDailySalesPdfLabel(lastExportDate, false)}.`
        : '';
    return `Next auto-download: ${nextRunLabel}.${lastExportText} Keep the app open and allow automatic downloads in your browser.`;
}

function refreshAutoDailySalesPdfControls() {
    const checkbox = document.getElementById('adminAutoPdfEnabled');
    const timeInput = document.getElementById('adminAutoPdfTime');
    const saveBtn = document.getElementById('saveAdminAutoPdfBtn');
    const downloadBtn = document.getElementById('downloadLastAutoPdfBtn');
    const status = document.getElementById('adminAutoPdfStatus');
    const allowed = canAccessAdminPanel();
    const enabled = Boolean(settings?.autoDailySalesPdfEnabled);
    const timeValue = settings?.autoDailySalesPdfTime || getDefaultAutoDailySalesPdfTime();
    const hasCachedExport = Boolean(String(settings?.autoDailySalesPdfLastExportDate || '').trim());

    if (checkbox) checkbox.checked = enabled;
    if (timeInput) {
        timeInput.value = isValidTimeValue(timeValue) ? timeValue : getDefaultAutoDailySalesPdfTime();
        timeInput.disabled = !allowed || !enabled;
    }
    if (saveBtn) saveBtn.disabled = !allowed;
    if (downloadBtn) {
        const canDownload = allowed && hasCachedExport;
        downloadBtn.disabled = !canDownload;
        downloadBtn.style.opacity = canDownload ? '1' : '0.55';
        downloadBtn.style.cursor = canDownload ? 'pointer' : 'not-allowed';
    }
    if (status) {
        status.innerHTML = allowed
            ? getAutoDailySalesPdfStatusMessage()
            : 'Admin login required to change automation schedules or download the last automatic PDF.';
    }
}

async function rememberAutoDailySalesPdfAttempt(status = '', dayKey = toLocalDayKey(new Date())) {
    settings.autoDailySalesPdfLastAttemptDate = dayKey;
    settings.autoDailySalesPdfLastAttemptStatus = String(status || '').trim();
    if (status === 'success') {
        settings.autoDailySalesPdfLastExportDate = dayKey;
    }
    await optimizedSaveData();
    refreshAutoDailySalesPdfControls();
}

async function maybeRunAutoDailySalesPdfExport(now = new Date(), options = {}) {
    const force = Boolean(options?.force);
    if (!activeUser || !Boolean(settings?.autoDailySalesPdfEnabled) || !hasAutoDailySalesPdfPrivileges()) {
        refreshAutoDailySalesPdfControls();
        return false;
    }

    const todayKey = toLocalDayKey(now);
    const scheduledAt = getDateAtLocalTime(now, settings?.autoDailySalesPdfTime || getDefaultAutoDailySalesPdfTime());
    if (!force && now < scheduledAt) {
        return false;
    }
    if (String(settings?.autoDailySalesPdfLastAttemptDate || '').trim() === todayKey) {
        return false;
    }

    const result = await exportAdminDailySalesPDF(todayKey, {
        silent: true,
        bypassAdminSession: true,
        source: 'auto'
    });
    const status = result?.success ? 'success' : (result?.reason === 'no-sales' ? 'empty' : 'error');
    await rememberAutoDailySalesPdfAttempt(status, todayKey);

    if (result?.success) {
        showSuccessToast(`Automatic PDF backup prepared for ${todayKey}.`);
    }
    return Boolean(result?.success);
}

function scheduleAutoDailySalesPdfExport() {
    if (autoDailySalesPdfTimeout) {
        clearTimeout(autoDailySalesPdfTimeout);
        autoDailySalesPdfTimeout = null;
    }
    if (autoDailySalesPdfCheckInterval) {
        clearInterval(autoDailySalesPdfCheckInterval);
        autoDailySalesPdfCheckInterval = null;
    }

    refreshAutoDailySalesPdfControls();

    if (!activeUser || !Boolean(settings?.autoDailySalesPdfEnabled) || !hasAutoDailySalesPdfPrivileges()) {
        return;
    }

    const now = new Date();
    const todayKey = toLocalDayKey(now);
    const scheduledAt = getDateAtLocalTime(now, settings?.autoDailySalesPdfTime || getDefaultAutoDailySalesPdfTime());
    const alreadyAttemptedToday = String(settings?.autoDailySalesPdfLastAttemptDate || '').trim() === todayKey;
    const nextRun = (!alreadyAttemptedToday && now >= scheduledAt)
        ? new Date(now.getTime() + 1200)
        : getAutoDailySalesPdfNextRun(now);
    const delay = Math.max(1000, nextRun.getTime() - now.getTime());

    autoDailySalesPdfCheckInterval = setInterval(() => {
        void maybeRunAutoDailySalesPdfExport(new Date());
    }, AUTO_DAILY_SALES_PDF_CHECK_INTERVAL_MS);

    autoDailySalesPdfTimeout = setTimeout(async () => {
        try {
            await maybeRunAutoDailySalesPdfExport(new Date(), { force: true });
        } catch (error) {
            console.warn('Auto daily sales PDF export failed:', error);
        }
        scheduleAutoDailySalesPdfExport();
    }, delay);
}

function bindAutoDailySalesPdfLifecycleEvents() {
    if (typeof window === 'undefined' || window.__mawAutoPdfLifecycleBound) return;

    const runCatchupCheck = () => {
        void maybeRunAutoDailySalesPdfExport(new Date());
    };

    window.addEventListener('focus', runCatchupCheck);
    window.addEventListener('pageshow', runCatchupCheck);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            runCatchupCheck();
        }
    });

    window.__mawAutoPdfLifecycleBound = true;
}

// ================= ELECTRON + WEB STORAGE =================
const APP_META_STORAGE_KEY = 'app_meta';
const GLOBAL_CUSTOMERS_KEY = 'global_customers';
const GLOBAL_CLATES_KEY = 'global_clates';
const GLOBAL_LOYAL_CUSTOMERS_KEY = 'global_loyal_customers';

function getDefaultAppMeta() {
    return {
        authUsers: [],
        lastLoginPhone: '',
        activeSessionUserId: '',
        activeSessionLoginMode: '',
        legacyDataMigrated: false,
        passwordResetCodes: []
    };
}

function getDefaultUserSettings() {
    return {
        profitPercentage: 30,
        profitMode: 'percentage',
        maxCustomerDebt: 0,
        theme: 'dark',
        language: 'en',
        currency: 'RWF',
        onboardingDone: true,
        lastOpenPage: 'home',
        autoDailySalesPdfEnabled: false,
        autoDailySalesPdfTime: DEFAULT_AUTO_DAILY_SALES_PDF_TIME,
        autoDailySalesPdfLastExportDate: '',
        autoDailySalesPdfLastAttemptDate: '',
        autoDailySalesPdfLastAttemptStatus: ''
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
    // Theme is locked to dark mode for all accounts.
    next.theme = 'dark';
    // Currency setting is fixed.
    next.currency = 'RWF';
    const parsedMaxDebt = Number(next.maxCustomerDebt);
    next.maxCustomerDebt = Number.isFinite(parsedMaxDebt) && parsedMaxDebt > 0 ? parsedMaxDebt : 0;
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

const DEFAULT_NEW_STOCK_QTY = 0;

function getDefaultNewDrinkStockQty() {
    return DEFAULT_NEW_STOCK_QTY;
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
        hasLegacyStockValue ? 0 : 0
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

function normalizeDrinksList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((drink) => sanitizeDrinkEntry(drink))
        .filter(Boolean);
}

function sanitizeClateEntry(raw, fallbackIndex = 0) {
    if (!raw || typeof raw !== 'object') return null;
    const customerName = String(raw.customerName ?? raw.name ?? '').trim();
    const amountValue = Number(raw.amount ?? raw.value ?? 0);
    const amount = Number.isFinite(amountValue) ? Math.max(0, amountValue) : 0;
    if (!customerName || amount <= 0) return null;

    const description = String(raw.description || 'Bottle deposit').trim() || 'Bottle deposit';
    const dateRaw = raw.date ?? raw.createdAt ?? '';
    const parsedDate = new Date(dateRaw || Date.now());
    const date = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    const returned = Boolean(raw.returned);
    const returnedDateRaw = raw.returnedDate ?? raw.returnDate ?? '';
    const parsedReturnedDate = new Date(returnedDateRaw || Date.now());
    const returnedDate = returned
        ? (Number.isNaN(parsedReturnedDate.getTime()) ? new Date().toISOString() : parsedReturnedDate.toISOString())
        : '';

    const parsedId = Number(raw.id ?? raw.depositId ?? NaN);
    const id = (Number.isFinite(parsedId) && parsedId > 0)
        ? Math.floor(parsedId)
        : (Date.now() + fallbackIndex);

    return {
        id,
        customerName,
        amount,
        description,
        date,
        returned,
        returnedDate
    };
}

function normalizeClatesData() {
    if (!Array.isArray(clates)) {
        clates = [];
        return;
    }
    clates = clates
        .map((entry, index) => sanitizeClateEntry(entry, index))
        .filter(Boolean);
}

function normalizeClatesList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((entry, index) => sanitizeClateEntry(entry, index))
        .filter(Boolean);
}

function getClateMergeKey(entry, fallbackIndex = 0) {
    const id = Number(entry?.id);
    if (Number.isFinite(id) && id > 0) return `id:${Math.floor(id)}`;

    const customerName = String(entry?.customerName || '').trim().toLowerCase();
    const amount = Number(entry?.amount) || 0;
    const date = String(entry?.date || '').trim();
    if (customerName && amount > 0 && date) {
        return `sig:${customerName}|${amount}|${date}`;
    }
    return `idx:${fallbackIndex}`;
}

function mergeClateLists(...lists) {
    const merged = [];
    const keyToIndex = new Map();

    lists.forEach((list) => {
        const normalizedList = normalizeClatesList(list);
        normalizedList.forEach((entry, index) => {
            const mergeKey = getClateMergeKey(entry, index);
            if (keyToIndex.has(mergeKey)) {
                merged[keyToIndex.get(mergeKey)] = entry;
                return;
            }
            keyToIndex.set(mergeKey, merged.length);
            merged.push(entry);
        });
    });

    return merged;
}

const CUSTOMER_TYPE_LABELS = {
    regular: 'Regular Customer',
    loyal: 'Loyal Customer',
    wholesale: 'Wholesale',
    retail: 'Retail',
    hotel: 'Hotel/Restaurant',
    individual: 'Individual'
};

function normalizeCustomerType(value) {
    const normalized = String(value || 'regular').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(CUSTOMER_TYPE_LABELS, normalized)
        ? normalized
        : 'regular';
}

function formatCustomerTypeLabel(value) {
    return CUSTOMER_TYPE_LABELS[normalizeCustomerType(value)] || CUSTOMER_TYPE_LABELS.regular;
}

function normalizeCustomerPromiseDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T23:59`;

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : toLocalMinuteDateTimeKey(parsed);
}

function splitCustomerPromiseDateTime(value) {
    const normalized = normalizeCustomerPromiseDate(value);
    if (!normalized) {
        return { datePart: '', timePart: '' };
    }

    const [datePart = '', timePartRaw = ''] = normalized.split('T');
    const timePart = /^\d{2}:\d{2}$/.test(timePartRaw) ? timePartRaw : '23:59';
    return { datePart, timePart };
}

function combineCustomerPromiseDateTime(dateValue, timeValue) {
    const datePart = String(dateValue || '').trim();
    if (!datePart) return '';
    const rawTime = String(timeValue || '').trim();
    const timePart = /^\d{2}:\d{2}$/.test(rawTime) ? rawTime : '23:59';
    return normalizeCustomerPromiseDate(`${datePart}T${timePart}`);
}

function readCustomerPromiseDateTimeInputs(dateInputId, timeInputId) {
    const dateValue = document.getElementById(dateInputId)?.value || '';
    const timeValue = document.getElementById(timeInputId)?.value || '';
    return combineCustomerPromiseDateTime(dateValue, timeValue);
}

function writeCustomerPromiseDateTimeInputs(dateInputId, timeInputId, value) {
    const dateInput = document.getElementById(dateInputId);
    const timeInput = document.getElementById(timeInputId);
    const { datePart, timePart } = splitCustomerPromiseDateTime(value);
    if (dateInput) dateInput.value = datePart;
    if (timeInput) timeInput.value = timePart;
}

function setCustomerPromiseDateTimeInputsEnabled(dateInputId, timeInputId, enabled) {
    const dateInput = document.getElementById(dateInputId);
    const timeInput = document.getElementById(timeInputId);
    if (dateInput) dateInput.disabled = !enabled;
    if (timeInput) timeInput.disabled = !enabled;
}

function toLocalMinuteDateTimeKey(dateValue) {
    const dt = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(dt.getTime())) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hour = String(dt.getHours()).padStart(2, '0');
    const minute = String(dt.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
}

function parseCustomerPromiseDate(value) {
    const normalized = normalizeCustomerPromiseDate(value);
    if (!normalized) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(normalized);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const hour = Number(match[4]);
        const minute = Number(match[5]);
        const date = new Date(year, month, day, hour, minute, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCustomerDebtOverdueMs(customer, referenceDate = new Date()) {
    const promiseDate = parseCustomerPromiseDate(getCustomerPromiseDate(customer));
    const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (!promiseDate || Number.isNaN(now.getTime())) return 0;
    return Math.max(0, now.getTime() - promiseDate.getTime());
}

function formatOverdueDurationLabel(msValue) {
    const ms = Number(msValue);
    if (!Number.isFinite(ms) || ms <= 0) return 'on time';

    const totalMinutes = Math.max(1, Math.floor(ms / 60000));
    if (totalMinutes < 60) {
        return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'} late`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    if (totalHours < 24) {
        const minutes = totalMinutes % 60;
        return minutes > 0
            ? `${totalHours}h ${minutes}m late`
            : `${totalHours}h late`;
    }

    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return hours > 0
        ? `${days} day${days === 1 ? '' : 's'} ${hours}h late`
        : `${days} day${days === 1 ? '' : 's'} late`;
}

function normalizeCustomerDebtHistory(entries) {
    if (!Array.isArray(entries)) return [];
    return entries
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry, index) => ({
            id: String(entry.id || `${Date.now()}-debt-${index}`),
            type: String(entry.type || 'note').trim() || 'note',
            amount: Number(entry.amount) || 0,
            note: String(entry.note || '').trim(),
            date: typeof entry.date === 'string' ? entry.date : new Date().toISOString()
        }));
}

function sanitizeCustomerEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;
    const owingValue = Number(raw.owing ?? raw.debt ?? 0);
    const owing = Number.isFinite(owingValue) ? Math.max(0, owingValue) : 0;
    const promisedPaybackDate = owing > 0
        ? normalizeCustomerPromiseDate(
            raw.promisedPaybackDate
            ?? raw.promiseDate
            ?? raw.paybackDate
            ?? raw.expectedPaymentDate
        )
        : '';
    return {
        id: raw.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        phone: String(raw.phone || '').trim(),
        location: String(raw.location ?? raw.address ?? '').trim(),
        type: normalizeCustomerType(raw.type),
        notes: String(raw.notes || '').trim(),
        owing,
        promisedPaybackDate,
        debtHistory: normalizeCustomerDebtHistory(raw.debtHistory),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
    };
}

function normalizeCustomersData() {
    if (!Array.isArray(customers)) {
        customers = [];
        return;
    }
    customers = customers
        .map((customer) => sanitizeCustomerEntry(customer))
        .filter(Boolean);
}

function normalizeCustomersList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((customer) => sanitizeCustomerEntry(customer))
        .filter(Boolean);
}

function getCustomerMergeKey(customer, fallbackIndex = 0) {
    const id = String(customer?.id ?? '').trim();
    if (id) return `id:${id}`;

    const phone = normalizePhone(customer?.phone || '');
    const name = String(customer?.name || '').trim().toLowerCase();
    if (phone && name) return `phone:${phone}|name:${name}`;
    if (name) return `name:${name}|idx:${fallbackIndex}`;
    return `idx:${fallbackIndex}`;
}

function mergeCustomerLists(...lists) {
    const merged = [];
    const keyToIndex = new Map();

    lists.forEach((list) => {
        const normalizedList = normalizeCustomersList(list);
        normalizedList.forEach((customer, index) => {
            const mergeKey = getCustomerMergeKey(customer, index);
            if (keyToIndex.has(mergeKey)) {
                merged[keyToIndex.get(mergeKey)] = customer;
                return;
            }
            keyToIndex.set(mergeKey, merged.length);
            merged.push(customer);
        });
    });

    return merged;
}

function getCustomerDebtLimit() {
    const raw = Number(settings?.maxCustomerDebt);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getCustomerByReference(customerRef) {
    if (customerRef === null || customerRef === undefined || customerRef === '') return null;
    const refString = String(customerRef).trim();
    if (refString) {
        const byId = customers.find((customer) => String(customer?.id ?? '').trim() === refString);
        if (byId) return byId;
    }
    const legacyIndex = Number(customerRef);
    if (Number.isInteger(legacyIndex) && legacyIndex >= 0 && customers[legacyIndex]) {
        return customers[legacyIndex];
    }
    return null;
}

function getCustomerIndexByReference(customerRef) {
    if (customerRef === null || customerRef === undefined || customerRef === '') return -1;
    const refString = String(customerRef).trim();
    if (refString) {
        const byIdIndex = customers.findIndex((customer) => String(customer?.id ?? '').trim() === refString);
        if (byIdIndex >= 0) return byIdIndex;
    }
    const legacyIndex = Number(customerRef);
    return Number.isInteger(legacyIndex) && legacyIndex >= 0 && customers[legacyIndex] ? legacyIndex : -1;
}

function getCustomerNameByReference(customerRef, fallback = 'Guest') {
    const customer = getCustomerByReference(customerRef);
    return customer?.name ? customer.name : fallback;
}

function isSaleLinkedToCustomer(sale, customer, customerIndex = -1) {
    if (!sale || !customer) return false;
    const saleRef = sale.customerId;
    if (saleRef === null || saleRef === undefined || saleRef === '') return false;
    const customerId = String(customer.id ?? '').trim();
    if (customerId && String(saleRef).trim() === customerId) return true;
    const legacyIndex = Number(saleRef);
    return Number.isInteger(legacyIndex) && legacyIndex === customerIndex;
}

function adjustCustomerDebtByReference(customerRef, amountDelta = 0) {
    const customer = getCustomerByReference(customerRef);
    if (!customer) return false;
    customer.owing = Math.max(0, (Number(customer.owing) || 0) + (Number(amountDelta) || 0));
    clearCustomerPromiseDateIfSettled(customer);
    return true;
}

function isLoyalCustomer(customer) {
    return normalizeCustomerType(customer?.type) === 'loyal';
}

function shouldUsePromiseDate(customer) {
    return isLoyalCustomer(customer) || Boolean(normalizeCustomerPromiseDate(customer?.promisedPaybackDate));
}

function getCustomerPromiseDate(customer) {
    if (!customer) return '';
    const owing = Number(customer.owing || 0);
    if (owing <= 0) return '';
    return normalizeCustomerPromiseDate(customer.promisedPaybackDate);
}

function clearCustomerPromiseDateIfSettled(customer) {
    if (!customer) return;
    if ((Number(customer.owing) || 0) <= 0) {
        customer.promisedPaybackDate = '';
    }
}

function isCustomerDebtOverdue(customer, referenceDate = new Date()) {
    return getCustomerDebtOverdueMs(customer, referenceDate) > 0;
}

function getCustomerDebtOverdueDays(customer, referenceDate = new Date()) {
    const diffMs = getCustomerDebtOverdueMs(customer, referenceDate);
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function formatCustomerPromiseDate(value) {
    const parsed = parseCustomerPromiseDate(value);
    return parsed
        ? parsed.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : '';
}

function getDebtLimitExceededMessage(customerName, nextOwing, limit) {
    return `${customerName} cannot go above RWF ${limit.toLocaleString()} in debt. This action would make the balance RWF ${nextOwing.toLocaleString()}.`;
}

function getCustomerDebtRaiseError(customer, increaseAmount) {
    const limit = getCustomerDebtLimit();
    if (!customer || limit <= 0) return '';
    const currentOwing = Number(customer.owing || 0);
    const nextOwing = currentOwing + Math.max(0, Number(increaseAmount) || 0);
    return nextOwing > limit
        ? getDebtLimitExceededMessage(customer.name || 'This customer', nextOwing, limit)
        : '';
}

function getCustomerDebtReminderEntries(list, context = {}) {
    const now = new Date();
    return normalizeCustomersList(list)
        .filter((customer) => Number(customer.owing || 0) > 0 && isCustomerDebtOverdue(customer, now))
        .map((customer) => {
            const overdueMs = getCustomerDebtOverdueMs(customer, now);
            return {
                customerName: customer.name,
                owing: Number(customer.owing || 0),
                promisedPaybackDate: getCustomerPromiseDate(customer),
                overdueMs,
                overdueDays: getCustomerDebtOverdueDays(customer, now),
                overdueLabel: formatOverdueDurationLabel(overdueMs),
                accountLabel: String(context.accountLabel || '').trim()
            };
        });
}

function buildCustomerDebtSummaryHtml(customer) {
    const owing = Number(customer.owing || 0);
    const promiseDate = getCustomerPromiseDate(customer);
    const promiseLabel = formatCustomerPromiseDate(promiseDate);
    const isOverdue = isCustomerDebtOverdue(customer);
    const overdueLabel = formatOverdueDurationLabel(getCustomerDebtOverdueMs(customer));
    const metaHtml = promiseDate
        ? `<div class="customer-debt-tag ${isOverdue ? 'overdue' : ''}">${escapeHtml(
            isOverdue
                ? `Promise passed on ${promiseLabel} (${overdueLabel})`
                : `Promised payback: ${promiseLabel}`
        )}</div>`
        : '';
    return `
        <div class="customer-debt-summary ${owing > 0 ? 'owing' : 'cleared'}">
            ${owing > 0 ? `&#128179; Owes: RWF ${owing.toLocaleString()}` : '&#9989; No debt'}
        </div>
        ${metaHtml}
    `;
}

function buildCustomerItemMarkup(customer, index, options = {}) {
    const includeDelete = options.includeDelete !== false;
    const promiseDate = getCustomerPromiseDate(customer);
    const promiseLabel = formatCustomerPromiseDate(promiseDate);
    const overdue = isCustomerDebtOverdue(customer);
    const overdueLabel = formatOverdueDurationLabel(getCustomerDebtOverdueMs(customer));
    const customerIconMarkup = '<div class="customer-icon loyal-avatar" aria-hidden="true"></div>';

    return `
        <div class="customer-square-card">
            ${customerIconMarkup}
            <div class="customer-info-section">
                <div class="customer-name">${escapeHtml(customer.name)}</div>
                <div class="customer-debt">${customer.owing > 0 ? `RWF ${customer.owing.toLocaleString()}` : 'Cleared'}</div>
                ${overdue ? `<div class="customer-overdue-badge">!</div>` : ''}
            </div>
        </div>
        <div class="customer-square-buttons">
            <button onclick="openCustomerDebtDetails(${index})" class="square-btn customer-action-btn action-info" title="View/Edit Debt Details"><span class="square-btn-label">i</span></button>
            <button onclick="openAddDebtForm(${index})" class="square-btn customer-action-btn action-add" title="${escapeHtml(t('customerActionAddDebt'))}"><span class="square-btn-label">+</span></button>
            <button onclick="openReduceDebtForm(${index})" class="square-btn customer-action-btn action-reduce" title="${escapeHtml(t('customerActionReduceDebt'))}"><span class="square-btn-label">-</span></button>
            <button onclick="openClearDebtForm(${index})" class="square-btn customer-action-btn action-clear" title="${escapeHtml(t('customerActionClearDebt'))}"><span class="square-btn-label">✓</span></button>
            <button onclick="exportCustomerDebtPDF(${index})" class="square-btn customer-action-btn action-pdf" title="${escapeHtml(t('customerActionExportPdf'))}"><span class="square-btn-label square-btn-label-pdf">PDF</span></button>
            ${includeDelete ? `<button onclick="deleteCustomer(${index})" class="square-btn customer-action-btn action-delete" title="${escapeHtml(t('customerActionDelete'))}"><span class="square-btn-label">×</span></button>` : ''}
        </div>
    `;
}

async function getAdminHomeDebtReminderEntries() {
    const sharedCustomers = await loadNamedData(GLOBAL_CUSTOMERS_KEY, []);
    let validCustomers = normalizeCustomersList(sharedCustomers);
    if (!validCustomers.length) {
        // Backward compatibility with older installs that stored only loyal customers globally.
        const legacyLoyalCustomers = await loadNamedData(GLOBAL_LOYAL_CUSTOMERS_KEY, []);
        validCustomers = normalizeCustomersList(legacyLoyalCustomers);
    }

    return getCustomerDebtReminderEntries(validCustomers, { accountLabel: 'All Accounts' });
}

async function renderHomeDebtNotifications() {
    const banner = document.getElementById('debtNotificationBanner');
    if (!banner) return;

    const renderToken = ++homeDebtNotificationRenderToken;
    try {
        const adminSession = isAdminSessionActive();
        let reminders = [];

        if (adminSession) {
            reminders = await getAdminHomeDebtReminderEntries();
        } else {
            reminders = getCustomerDebtReminderEntries(customers);
        }

        if (renderToken !== homeDebtNotificationRenderToken) return;

        if (!Array.isArray(reminders) || reminders.length === 0) {
            banner.style.display = 'none';
            banner.innerHTML = '';
            return;
        }

        const totalOwing = reminders.reduce((sum, entry) => sum + (Number(entry.owing) || 0), 0);
        const previewItems = reminders.slice(0, 5);

        banner.innerHTML = `
            <div class="debt-notification-header">
                <strong>${escapeHtml(adminSession ? 'Overdue customer payback reminders across accounts' : 'Overdue customer payback reminders')}</strong>
                <span>${reminders.length} customer(s) | RWF ${totalOwing.toLocaleString()}</span>
            </div>
            <p class="debt-notification-copy">These customers passed the promised payback date and time.</p>
            <div class="debt-notification-list">
                ${previewItems.map((entry) => `
                    <div class="debt-notification-item">
                        <div>
                            <strong>${escapeHtml(entry.customerName)}</strong>
                            <span>${escapeHtml(formatCustomerPromiseDate(entry.promisedPaybackDate))} | ${escapeHtml(entry.overdueLabel || 'late')}</span>
                            ${entry.accountLabel ? `<span>${escapeHtml(entry.accountLabel)}</span>` : ''}
                        </div>
                        <strong>RWF ${Number(entry.owing || 0).toLocaleString()}</strong>
                    </div>
                `).join('')}
            </div>
            ${reminders.length > previewItems.length ? `<div class="debt-notification-more">+${reminders.length - previewItems.length} more overdue customer(s)</div>` : ''}
        `;
        banner.style.display = 'block';
    } catch (error) {
        console.warn('Unable to render debt reminders:', error);
        if (renderToken === homeDebtNotificationRenderToken) {
            banner.style.display = 'none';
            banner.innerHTML = '';
        }
    }
}

async function maybeShowDebtReminderPopup() {
    const sessionKey = getDebtReminderSessionKey(activeUser);
    if (!sessionKey) return;
    if (debtReminderPopupSessionKey !== sessionKey) {
        debtReminderPopupSessionKey = sessionKey;
        debtReminderPopupShownForSession = false;
    }
    if (debtReminderPopupShownForSession) return;
    debtReminderPopupShownForSession = true;

    try {
        const adminSession = isAdminSessionActive();
        const reminders = adminSession
            ? await getAdminHomeDebtReminderEntries()
            : getCustomerDebtReminderEntries(customers);

        if (!Array.isArray(reminders) || reminders.length === 0) return;

        const preview = reminders
            .slice(0, 5)
            .map((entry, index) => {
                const accountLine = entry.accountLabel ? ` | Account: ${entry.accountLabel}` : '';
                return `${index + 1}. ${entry.customerName} | RWF ${Number(entry.owing || 0).toLocaleString()} | Due ${formatCustomerPromiseDate(entry.promisedPaybackDate)} | ${entry.overdueLabel || 'late'}${accountLine}`;
            })
            .join('\n');
        const moreCount = reminders.length > 5 ? `\n+ ${reminders.length - 5} more overdue customer(s)` : '';
        alert(`Payment reminder\n\nThese customers passed their promised payback date and time:\n\n${preview}${moreCount}`);
    } catch (error) {
        console.warn('Unable to show debt reminder popup:', error);
    }
}

async function renderLoginDebtNotifications() {
    const banner = document.getElementById('loginDebtNotifications');
    if (!banner) return;

    try {
        const reminders = getCustomerDebtReminderEntries(customers);
        if (!Array.isArray(reminders) || reminders.length === 0) {
            banner.style.display = 'none';
            return;
        }

        const totalOwing = reminders.reduce((sum, entry) => sum + (Number(entry.owing) || 0), 0);
        banner.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">💰 ${reminders.length} customer${reminders.length > 1 ? 's' : ''} with overdue payments</div>
            <div style="font-size: 0.85rem; opacity: 0.9;">Total: RWF ${totalOwing.toLocaleString()} - Remember to collect payments.</div>
        `;
        banner.style.display = 'block';
    } catch (error) {
        console.warn('Unable to render login debt notifications:', error);
        banner.style.display = 'none';
    }
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

function getEffectiveSalesList() {
    return isAdminSessionActive() ? (Array.isArray(adminSales) ? adminSales : []) : (Array.isArray(sales) ? sales : []);
}

async function refreshAdminSalesCache() {
    if (!isAdminSessionActive()) {
        adminSales = [];
        adminSalesCacheLoaded = false;
        return;
    }

    const users = Array.isArray(getAuthUsers()) ? getAuthUsers() : [];
    const salesRequests = users
        .map((user) => ({ name: userDataKey('sales', user), defaultValue: [] }))
        .filter((item) => item.name);

    if (salesRequests.length === 0) {
        adminSales = [];
        adminSalesCacheLoaded = true;
        return;
    }

    const loaded = await loadManyNamedData(salesRequests);
    adminSales = salesRequests.reduce((allSales, request) => {
        const userSales = Array.isArray(loaded[request.name]) ? loaded[request.name] : [];
        return allSales.concat(userSales);
    }, []);
    adminSalesCacheLoaded = true;
}

function localStorageKey(name) {
    return `makeaway_${name}`;
}

const INDEXED_DB_TIMEOUT_MS = 1800;

async function readIndexedDbKey(name) {
    try {
        const db = await openAppDB();
        return await new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                try {
                    db.close();
                } catch (_) {}
                resolve(value);
            };
            const timeoutId = setTimeout(() => {
                finish(null);
            }, INDEXED_DB_TIMEOUT_MS);
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(name);
            req.onsuccess = () => {
                finish(req.result);
            };
            req.onerror = () => {
                finish(null);
            };
            tx.onabort = () => {
                finish(null);
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
            let settled = false;
            const finish = (success, error = null) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                try {
                    db.close();
                } catch (_) {}
                if (success) {
                    resolve(true);
                    return;
                }
                reject(error || new Error('IndexedDB write failed'));
            };
            const timeoutId = setTimeout(() => {
                finish(false, new Error('IndexedDB write timeout'));
            }, INDEXED_DB_TIMEOUT_MS);
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(value, name);
            tx.oncomplete = () => {
                finish(true);
            };
            tx.onerror = () => {
                finish(false, tx.error);
            };
            tx.onabort = () => {
                finish(false, tx.error);
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
    const drinksKey = GLOBAL_DRINKS_KEY;
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
    const globalCustomersKey = GLOBAL_CUSTOMERS_KEY;
    const globalClatesKey = GLOBAL_CLATES_KEY;
    const clatesKey = userDataKey('clates', user);
    const drinksKey = GLOBAL_DRINKS_KEY;
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
        { name: globalCustomersKey, defaultValue: [] },
        { name: globalClatesKey, defaultValue: [] },
        { name: clatesKey, defaultValue: [] },
        { name: drinksKey, defaultValue: [] },
        { name: settingsKey, defaultValue: {} },
        { name: archivesKey, defaultValue: [] }
    ]);
    const loadedSales = loadedMap[salesKey];
    const loadedCustomers = loadedMap[customersKey];
    const loadedGlobalCustomers = loadedMap[globalCustomersKey];
    const loadedGlobalClates = loadedMap[globalClatesKey];
    const loadedClates = loadedMap[clatesKey];
    const loadedDrinks = loadedMap[drinksKey];
    const loadedSettings = loadedMap[settingsKey];
    const loadedArchives = loadedMap[archivesKey];

    sales = Array.isArray(loadedSales) ? loadedSales : [];
    customers = Array.isArray(loadedGlobalCustomers) ? normalizeCustomersList(loadedGlobalCustomers) : [];
    clates = mergeClateLists(loadedGlobalClates, loadedClates);
    drinks = Array.isArray(loadedDrinks) ? loadedDrinks : [];
    settings = sanitizeUserSettings(loadedSettings);
    yearlyArchives = sanitizeYearArchives(loadedArchives);
    
    // Migrate legacy customer data if shared list is still empty.
    if (customers.length === 0) {
        const legacyCustomersKey = userDataKey('customers', user);
        const legacyCustomers = await loadNamedData(legacyCustomersKey, []);
        if (Array.isArray(legacyCustomers) && legacyCustomers.length > 0) {
            customers = mergeCustomerLists(customers, legacyCustomers);
        }
    }
    if (clates.length === 0) {
        const legacyClatesKey = userDataKey('clates', user);
        const legacyClates = await loadNamedData(legacyClatesKey, []);
        if (Array.isArray(legacyClates) && legacyClates.length > 0) {
            clates = mergeClateLists(clates, legacyClates);
        }
    }

    // Backfill shared customers from all account-scoped customer stores when needed.
    const hasSharedCustomers = Array.isArray(loadedGlobalCustomers) && loadedGlobalCustomers.length > 0;
    if (!hasSharedCustomers) {
        const allAccounts = getAuthUsers();
        const scopedCustomerRequests = (Array.isArray(allAccounts) ? allAccounts : [])
            .map((account) => ({ name: userDataKey('customers', account), defaultValue: [] }))
            .filter((item) => item.name);

        if (scopedCustomerRequests.length > 0) {
            const scopedMap = await loadManyNamedData(scopedCustomerRequests);
            scopedCustomerRequests.forEach((request) => {
                customers = mergeCustomerLists(customers, scopedMap[request.name]);
            });
        }
    }
    // Backfill shared deposits from all account-scoped deposit stores when needed.
    const hasSharedClates = Array.isArray(loadedGlobalClates) && loadedGlobalClates.length > 0;
    if (!hasSharedClates) {
        const allAccounts = getAuthUsers();
        const scopedClateRequests = (Array.isArray(allAccounts) ? allAccounts : [])
            .map((account) => ({ name: userDataKey('clates', account), defaultValue: [] }))
            .filter((item) => item.name);

        if (scopedClateRequests.length > 0) {
            const scopedMap = await loadManyNamedData(scopedClateRequests);
            scopedClateRequests.forEach((request) => {
                clates = mergeClateLists(clates, scopedMap[request.name]);
            });
        }
    }

    if (drinks.length === 0) {
        const legacyDrinksKey = userDataKey('drinks', user);
        const legacyDrinks = await loadNamedData(legacyDrinksKey, []);
        if (Array.isArray(legacyDrinks) && legacyDrinks.length > 0) {
            drinks = legacyDrinks;
            await saveNamedData(GLOBAL_DRINKS_KEY, drinks);
        }
    }
    
    // Backward compatibility: merge the older loyal-only shared customer store.
    const globalLoyalCustomers = await loadNamedData(GLOBAL_LOYAL_CUSTOMERS_KEY, []);
    if (Array.isArray(globalLoyalCustomers) && globalLoyalCustomers.length > 0) {
        customers = mergeCustomerLists(customers, globalLoyalCustomers);
    }
    
    // Merge global drinks
    const globalDrinks = await loadNamedData(GLOBAL_DRINKS_KEY, []);
    if (Array.isArray(globalDrinks)) {
        // Merge with user drinks, avoiding duplicates by name
        const mergedDrinks = [...drinks];
        for (const globalDrink of globalDrinks) {
            const existingIndex = mergedDrinks.findIndex(d => d.name.toLowerCase() === globalDrink.name.toLowerCase());
            if (existingIndex >= 0) {
                mergedDrinks[existingIndex] = globalDrink; // Update with global version
            } else {
                mergedDrinks.push(globalDrink);
            }
        }
        drinks = mergedDrinks;
    }
    
    normalizeCustomersData();
    normalizeClatesData();
    normalizeDrinksData();
    await saveNamedData(GLOBAL_CUSTOMERS_KEY, customers);
    await saveNamedData(GLOBAL_CLATES_KEY, clates);

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
    normalizeCustomersData();
    normalizeClatesData();
    normalizeDrinksData();

    const salesKey = userDataKey('sales', user);
    const customersKey = userDataKey('customers', user);
    const clatesKey = userDataKey('clates', user);
    const drinksKey = GLOBAL_DRINKS_KEY;
    const settingsKey = userDataKey('settings', user);
    const archivesKey = userDataKey('archives', user);
    if (!salesKey || !customersKey || !clatesKey || !drinksKey || !settingsKey || !archivesKey) return payload;

    payload[salesKey] = Array.isArray(sales) ? sales : [];
    payload[GLOBAL_CUSTOMERS_KEY] = Array.isArray(customers) ? customers : [];
    payload[clatesKey] = Array.isArray(clates) ? clates : [];
    payload[GLOBAL_CLATES_KEY] = Array.isArray(clates) ? clates : [];
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

// ============ MONGODB SYNC FUNCTIONS ============

async function syncCustomersToMongoDB(userId) {
    const isAdmin = isAdminSessionActive();
    try {
        if (!customers || customers.length === 0) {
            console.log('⚠️ No customers to sync to MongoDB');
            return;
        }
        
        console.log(`🔄 Syncing ${customers.length} customers to MongoDB for user ${userId}${isAdmin ? ' (ADMIN)' : ''}`);
        
        const response = await fetch('/api/customers/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                customers: customers
            })
        });
        
        if (response.ok) {
            console.log(`✅ Customers synced to MongoDB${isAdmin ? ' (ADMIN)' : ''}`);
        } else {
            console.warn(`❌ Failed to sync customers: ${response.statusText}${isAdmin ? ' (ADMIN)' : ''}`);
        }
    } catch (error) {
        console.error(`❌ MongoDB sync error (customers)${isAdmin ? ' (ADMIN)' : ''}:`, error);
    }
}

async function syncDrinksToMongoDB(userId) {
    try {
        if (!drinks || drinks.length === 0) return;
        
        const response = await fetch('/api/drinks/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                drinks: drinks
            })
        });
        
        if (response.ok) {
            console.log('✅ Drinks synced to MongoDB');
        } else {
            console.warn('⚠️ Failed to sync drinks:', response.statusText);
        }
    } catch (error) {
        console.error('❌ MongoDB sync error (drinks):', error);
    }
}

async function loadCustomersFromMongoDB(userId) {
    const isAdmin = isAdminSessionActive();
    try {
        console.log(`🔄 Loading customers from MongoDB for user ${userId}${isAdmin ? ' (ADMIN)' : ''}`);
        
        const response = await fetch(`/api/customers/load/${userId}`);
        if (response.ok) {
            const data = await response.json();
            const loadedCustomers = Array.isArray(data?.customers) ? normalizeCustomersList(data.customers) : [];
            if (loadedCustomers.length > 0) {
                customers = mergeCustomerLists(customers, loadedCustomers);
                await saveNamedData(GLOBAL_CUSTOMERS_KEY, customers);
                console.log(`✅ Customers loaded from MongoDB: ${customers.length} customers${isAdmin ? ' (ADMIN)' : ''}`);
            } else {
                console.log(`⚠️ No customers found in MongoDB${isAdmin ? ' (ADMIN)' : ''}`);
            }
            return true;
        } else {
            console.warn(`❌ MongoDB load failed: ${response.statusText}${isAdmin ? ' (ADMIN)' : ''}`);
        }
    } catch (error) {
        console.error(`❌ MongoDB load error (customers)${isAdmin ? ' (ADMIN)' : ''}:`, error);
    }
    return false;
}

async function loadDrinksFromMongoDB(userId) {
    try {
        const response = await fetch(`/api/drinks/load/${userId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.drinks && data.drinks.length > 0) {
                drinks = data.drinks;
                console.log('✅ Drinks loaded from MongoDB:', drinks.length);
                return true;
            }
        }
    } catch (error) {
        console.error('❌ MongoDB load error (drinks):', error);
    }
    return false;
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
let debtReminderPopupShownForSession = false;
let debtReminderPopupSessionKey = '';

function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

const PASSWORD_MIN_LENGTH = 5;
const PASSWORD_HASH_PREFIX = 'pbkdf2';
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_RESET_CODE_LENGTH = 6;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;

function normalizePasswordInput(value) {
    return String(value || '').trim();
}

function isPasswordValid(value) {
    return normalizePasswordInput(value).length >= PASSWORD_MIN_LENGTH;
}

function hasWebCrypto() {
    return typeof window !== 'undefined' && window.crypto && window.crypto.subtle;
}

function bufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function safeEqualStrings(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

async function hashPassword(password, options = {}) {
    if (!hasWebCrypto()) {
        throw new Error('Secure password hashing is not available.');
    }
    const normalized = normalizePasswordInput(password);
    if (!isPasswordValid(normalized)) {
        throw new Error(t('authPinRules'));
    }
    const saltBytes = options.salt
        ? base64ToBuffer(options.salt)
        : window.crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
    const iterations = Number(options.iterations) || PASSWORD_HASH_ITERATIONS;
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(normalized),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    const saltEncoded = bufferToBase64(saltBytes);
    const hashEncoded = bufferToBase64(derivedBits);
    return `${PASSWORD_HASH_PREFIX}$${iterations}$${saltEncoded}$${hashEncoded}`;
}

async function verifyPassword(password, storedHash) {
    if (!hasWebCrypto()) return false;
    const normalized = normalizePasswordInput(password);
    if (!normalized || !storedHash) return false;
    const parts = String(storedHash || '').split('$');
    if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_PREFIX) return false;
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expectedHash = parts[3];
    if (!Number.isFinite(iterations) || !salt || !expectedHash) return false;
    try {
        const computed = await hashPassword(normalized, { iterations, salt });
        const computedHash = computed.split('$')[3] || '';
        return safeEqualStrings(computedHash, expectedHash);
    } catch (_) {
        return false;
    }
}

async function verifyUserPassword(user, password) {
    if (!user) return false;
    const normalized = normalizePasswordInput(password);
    if (!normalized) return false;
    if (user.passwordHash) {
        return verifyPassword(normalized, user.passwordHash);
    }

    const legacyPin = String(user.pin || '').trim();
    const matchesLegacy = legacyPin && normalized === legacyPin;
    if (!matchesLegacy) return false;

    try {
        user.passwordHash = await hashPassword(normalized);
        delete user.pin;
        user.authProvider = 'password';
        user.updatedAt = new Date().toISOString();
        appMeta.authUsers = getAuthUsers();
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
    } catch (error) {
        console.warn('Password migration failed:', error);
    }
    return true;
}

async function verifyUserAdminPassword(user, password) {
    if (!user) return false;
    const normalized = normalizePasswordInput(password);
    if (!normalized) return false;

    if (user.adminPasswordHash) {
        return verifyPassword(normalized, user.adminPasswordHash);
    }

    const legacyAdminPin = String(user.adminPin || '').trim();
    if (legacyAdminPin) {
        if (normalized !== legacyAdminPin) return false;
        try {
            user.adminPasswordHash = await hashPassword(normalized);
            delete user.adminPin;
            appMeta.authUsers = getAuthUsers();
            await saveNamedData(APP_META_STORAGE_KEY, appMeta);
        } catch (error) {
            console.warn('Admin password migration failed:', error);
        }
        return true;
    }

    // For owner accounts without admin password, allow login with regular password
    if (isOwnerRoleUser(user) && user.passwordHash) {
        const regularPasswordOk = await verifyPassword(normalized, user.passwordHash);
        if (regularPasswordOk) {
            // Set up admin password to match regular password initially
            try {
                user.adminPasswordHash = user.passwordHash;
                appMeta.authUsers = getAuthUsers();
                await saveNamedData(APP_META_STORAGE_KEY, appMeta);
            } catch (error) {
                console.warn('Admin password setup failed:', error);
            }
            return true;
        }
    }

    return false;
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
    if (normalized === 'employee') return 'staff';
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
        setAuthFeedback(t('authTooManyAttempts'), 'error');
        return;
    }
    setAuthFeedback(t(messageKey), 'error');
}

async function setupAdminPinForUser(user, currentUserPin) {
    if (!user || !isAdminRoleUser(user)) {
        return { success: false, cancelled: false, message: t('authAdminAccessDenied') };
    }
    const currentPassword = normalizePasswordInput(currentUserPin);
    const currentPasswordOk = await verifyUserPassword(user, currentPassword);
    if (!currentPasswordOk) {
        return { success: false, cancelled: false, message: t('authAdminSetupRequiresUserPin') };
    }

    const adminPinRaw = window.prompt(t('authAdminSetupPrompt'), '');
    if (adminPinRaw === null) {
        return { success: false, cancelled: true, message: t('authAdminSetupCancelled') };
    }
    const adminPin = normalizePasswordInput(adminPinRaw);
    if (!isPasswordValid(adminPin)) {
        return { success: false, cancelled: false, message: t('authPinRules') };
    }
    if (adminPin === currentPassword) {
        return { success: false, cancelled: false, message: t('authAdminPinMustDiffer') };
    }

    const confirmRaw = window.prompt(t('authAdminConfirmPrompt'), '');
    if (confirmRaw === null) {
        return { success: false, cancelled: true, message: t('authAdminSetupCancelled') };
    }
    const confirmAdminPin = normalizePasswordInput(confirmRaw);
    if (confirmAdminPin !== adminPin) {
        return { success: false, cancelled: false, message: t('authPinMismatch') };
    }

    user.adminPasswordHash = await hashPassword(adminPin);
    delete user.pin;
    delete user.adminPin;
    user.authProvider = 'password';
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
        setAuthFeedback(t('authAccountInactive'), 'error');
        return;
    }
    if (!isAdminRoleUser(user)) {
        setAuthFeedback(t('authAdminAccessDenied'), 'error');
        return;
    }

    // Check for admin password reset first
    const adminResetData = appMeta.adminPasswordReset;
    if (adminResetData && adminResetData.newAdminPassword) {
        const resetPasswordHash = await hashPassword(adminResetData.newAdminPassword);
        const passwordOk = await verifyPassword(pin, resetPasswordHash);
        if (passwordOk) {
            // Set the user's admin password to the reset password
            user.adminPasswordHash = resetPasswordHash;
            user.updatedAt = new Date().toISOString();
            appMeta.authUsers = users;
            // Clear the reset data
            delete appMeta.adminPasswordReset;
            localStorage.removeItem('adminPasswordReset');
            await saveNamedData(APP_META_STORAGE_KEY, appMeta);
            await completeLoginForUser(user, { loginMode: 'admin' });
            await refreshAdminSalesCache();
            return;
        }
    }

    const passwordOk = await verifyUserAdminPassword(user, pin);
    if (!passwordOk) {
        registerFailedLoginAttempt('authAdminInvalidCredentials');
        return;
    }

    await completeLoginForUser(user, { loginMode: 'admin' });
    await refreshAdminSalesCache();
}

async function completeLoginForUser(user, options = {}) {
    failedLoginAttempts = 0;
    loginLockedUntil = 0;
    debtReminderPopupShownForSession = false;
    debtReminderPopupSessionKey = '';
    setAuthFeedback('');
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
    scheduleAutoBackup();
    scheduleAutoDailySalesPdfExport();
    updateConnectivityUI();
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
                isActive: user.isActive !== false,
                authProvider: user.authProvider || 'password'
            };
        });
}

function resetForgotPinFields() {
    const resetSecretCodeInput = document.getElementById('resetSecretCode');
    const resetNewPinInput = document.getElementById('resetNewPin');
    const resetConfirmPinInput = document.getElementById('resetConfirmPin');
    if (resetSecretCodeInput) resetSecretCodeInput.value = '';
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

function getDebtReminderSessionKey(user = activeUser) {
    const userId = getAuthSessionUserId(user);
    const mode = String(activeLoginMode || 'user').trim().toLowerCase() || 'user';
    return userId ? `${userId}|${mode}` : '';
}

function getStoredPasswordResetCodes() {
    if (!Array.isArray(appMeta.passwordResetCodes)) {
        appMeta.passwordResetCodes = [];
    }
    return appMeta.passwordResetCodes;
}

function cleanupExpiredPasswordResetCodes() {
    const now = Date.now();
    const existing = getStoredPasswordResetCodes();
    const filtered = existing.filter((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const phone = normalizePhone(entry.phone);
        const code = String(entry.code || '').replace(/\D/g, '');
        const expiresAt = Number(entry.expiresAt) || 0;
        return Boolean(phone) && Boolean(code) && !entry.usedAt && expiresAt > now;
    });
    if (filtered.length !== existing.length) {
        appMeta.passwordResetCodes = filtered;
    }
    return appMeta.passwordResetCodes;
}

function generateNumericResetCode() {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const buffer = new Uint32Array(1);
        window.crypto.getRandomValues(buffer);
        return String((buffer[0] % 900000) + 100000).padStart(PASSWORD_RESET_CODE_LENGTH, '0');
    }
    return String(Math.floor(100000 + Math.random() * 900000)).padStart(PASSWORD_RESET_CODE_LENGTH, '0');
}

function issuePasswordResetCodeForPhone(phone, issuedBy = activeUser) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const code = generateNumericResetCode();
    const issuedAt = Date.now();
    const nextEntry = {
        phone: normalizedPhone,
        code,
        issuedAt,
        expiresAt: issuedAt + PASSWORD_RESET_CODE_TTL_MS,
        issuedBy: getAuthSessionUserId(issuedBy),
        issuedByName: issuedBy?.name || issuedBy?.phone || 'Admin'
    };

    const activeCodes = cleanupExpiredPasswordResetCodes()
        .filter((entry) => normalizePhone(entry.phone) !== normalizedPhone);
    activeCodes.push(nextEntry);
    appMeta.passwordResetCodes = activeCodes;
    return nextEntry;
}

function getActivePasswordResetCodeEntry(phone) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;
    return cleanupExpiredPasswordResetCodes()
        .find((entry) => normalizePhone(entry.phone) === normalizedPhone) || null;
}

function validatePasswordResetCode(phone, code) {
    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = String(code || '').replace(/\D/g, '');
    const entry = getActivePasswordResetCodeEntry(normalizedPhone);

    if (!entry) {
        return { ok: false, reason: 'missing' };
    }

    if (normalizedCode.length !== PASSWORD_RESET_CODE_LENGTH) {
        return { ok: false, reason: 'invalid' };
    }

    if (!safeEqualStrings(String(entry.code || ''), normalizedCode)) {
        return { ok: false, reason: 'invalid' };
    }

    return { ok: true, entry };
}

function consumePasswordResetCode(phone, code) {
    const result = validatePasswordResetCode(phone, code);
    if (!result.ok || !result.entry) {
        return result;
    }

    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = String(code || '').replace(/\D/g, '');
    appMeta.passwordResetCodes = cleanupExpiredPasswordResetCodes().filter((entry) => {
        return !(normalizePhone(entry.phone) === normalizedPhone && String(entry.code || '') === normalizedCode);
    });

    return { ok: true, entry: result.entry };
}

function formatPasswordResetExpiry(expiresAt) {
    return formatAutoDailySalesPdfLabel(expiresAt);
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
    scheduleAutoBackup();
    scheduleAutoDailySalesPdfExport();
    updateConnectivityUI();

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

function setAuthFeedback(message = '', tone = 'info') {
    const feedback = document.getElementById('authFeedback');
    if (!feedback) return;
    const text = localizeLooseText(String(message || '').trim());
    if (!text) {
        feedback.style.display = 'none';
        feedback.textContent = '';
        feedback.className = 'auth-status';
        return;
    }

    feedback.textContent = text;
    feedback.className = `auth-status is-${tone === 'error' ? 'error' : (tone === 'success' ? 'success' : 'info')}`;
    feedback.style.display = 'block';
}

function updateAuthModeSummary() {
    const titleEl = document.getElementById('authModeSummaryTitle');
    const textEl = document.getElementById('authModeSummaryText');
    if (!titleEl || !textEl) return;

    if (forgotPinVisible) {
        titleEl.textContent = t('resetPin');
        textEl.textContent = t('authResetDescription');
        return;
    }

    if (authMode === 'signup') {
        titleEl.textContent = t('authModeSignupTitle');
        textEl.textContent = t('authModeSignupText');
        return;
    }

    if (authMode === 'admin') {
        titleEl.textContent = t('authModeAdminTitle');
        textEl.textContent = t('authModeAdminText');
        return;
    }

    titleEl.textContent = t('authModeLoginTitle');
    textEl.textContent = t('authModeLoginText');
}

function isEnterLikeKey(event) {
    return Boolean(
        event &&
        (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter')
    );
}

function bindLoginEnterShortcut() {
    const loginScreen = document.getElementById('loginScreen');
    if (!loginScreen || loginScreen.dataset.enterShortcutBound) return;

    loginScreen.addEventListener('keydown', (event) => {
        if (!isEnterLikeKey(event)) return;
        if (forgotPinVisible) return;
        if (authMode === 'signup') return;

        const target = event.target;
        const targetId = target && typeof target.id === 'string' ? target.id : '';
        if (targetId !== 'phone' && targetId !== 'pin') return;

        event.preventDefault();
        void runLoginFlow();
    }, true);

    loginScreen.dataset.enterShortcutBound = '1';
}

function updateResetAccountPreview() {
    const preview = document.getElementById('resetAccountPreview');
    if (!preview) return;

    const resetPhoneInput = document.getElementById('resetPhone');
    const phoneInput = document.getElementById('phone');
    const rawValue = resetPhoneInput ? resetPhoneInput.value : (phoneInput ? phoneInput.value : '');
    const normalized = normalizePhone(rawValue);
    if (!normalized) {
        preview.textContent = t('authResetPreviewEmpty');
        return;
    }

    const user = findUserByLoginIdentifier(normalized, getAuthUsers());
    if (!user) {
        preview.textContent = t('authResetPreviewMissing').replace('{phone}', normalized);
        return;
    }

    const name = String(user.name || 'Account').trim() || 'Account';
    preview.textContent = t('authResetPreviewFound')
        .replace('{name}', name)
        .replace('{phone}', normalizePhone(user.phone || normalized));
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
    const showAdminPin = false;

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
    if (roleGroup) roleGroup.style.display = 'none';
    if (roleSelect) roleSelect.value = 'admin';

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
    if (forgotPinBtn) forgotPinBtn.style.display = (!forgotPinVisible && authMode === 'admin') ? 'inline-block' : 'none';
    if (loginTab) loginTab.disabled = forgotPinVisible;
    if (adminTab) adminTab.disabled = forgotPinVisible;
    if (signupTab) signupTab.disabled = forgotPinVisible;

    if (forgotPinVisible) {
        const typedIdentifier = phoneInput ? String(phoneInput.value || '').trim() : '';
        const matchedUser = findUserByLoginIdentifier(typedIdentifier, getAuthUsers());
        if (resetPhoneInput) {
            resetPhoneInput.value = normalizePhone(matchedUser?.phone || typedIdentifier || appMeta.lastLoginPhone || '');
        }
        setAuthFeedback(t('authHintReset'), 'info');
    } else {
        resetForgotPinFields();
        setAuthFeedback('');
    }

    updateResetAccountPreview();
    updateAuthModeSummary();
    setAuthHintText();
}

function switchAuthMode(mode) {
    const allowSignup = Array.isArray(getAuthUsers()) && getAuthUsers().length === 0;
    if (mode === 'signup' && !allowSignup) {
        authMode = 'login';
    } else if (mode === 'signup' || mode === 'admin') {
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
    if (forgotPinBtn) forgotPinBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (loginTab) loginTab.classList.toggle('active', !isSignup && !isAdmin);
    if (adminTab) adminTab.classList.toggle('active', isAdmin);
    if (signupTab) signupTab.classList.toggle('active', isSignup);
    if (loginTab) loginTab.disabled = false;
    if (adminTab) adminTab.disabled = false;
    if (signupTab) signupTab.disabled = false;

    syncSignupRoleControls(getAuthUsers());
    updateAuthPrimaryButtons();
    updateAuthModeSummary();
    setAuthFeedback('');
    setAuthHintText();
}

function updateActiveUserBadge() {
    const badge = document.getElementById('activeUserBadge');
    const accountNameEl = document.getElementById('activeAccountName');
    const sidebarNameEl = document.getElementById('sidebarAccountName');
    const sidebarModeEl = document.getElementById('sidebarAccountMode');
    const viewBadgeEl = document.getElementById('activeViewBadge');
    const adminSession = isAdminSessionActive();

    if (!activeUser) {
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '';
        }
        if (accountNameEl) accountNameEl.textContent = t('notLoggedIn');
        if (sidebarNameEl) sidebarNameEl.textContent = t('notLoggedIn');
        if (sidebarModeEl) sidebarModeEl.textContent = localizeLooseText('Guest');
        if (viewBadgeEl) viewBadgeEl.textContent = localizeLooseText('Normal Account');
        return;
    }

    const userLabel = activeUser.name || activeUser.phone || localizeLooseText('User');
    if (badge) {
        badge.textContent = `${t('loggedInAs')}: ${userLabel}`;
        badge.style.display = 'inline-flex';
    }
    if (accountNameEl) accountNameEl.textContent = userLabel;
    if (sidebarNameEl) sidebarNameEl.textContent = userLabel;
    if (sidebarModeEl) sidebarModeEl.textContent = adminSession ? localizeLooseText('Admin') : localizeLooseText('User');
    if (viewBadgeEl) viewBadgeEl.textContent = adminSession ? localizeLooseText('Admin Session') : localizeLooseText('Normal Account');
}

function toggleSidebarCollapsed() {
    const app = document.getElementById('app');
    if (!app) return;
    app.classList.toggle('sidebar-collapsed');
    syncSidebarUtilityButtons();
    enforceSidebarIconState();
}

function syncSidebarUtilityButtons() {
    const app = document.getElementById('app');
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    const switchBtn = document.getElementById('sidebarSwitchBtn');
    const collapsed = Boolean(app && app.classList.contains('sidebar-collapsed'));

    if (switchBtn) {
        const switchLabel = localizeLooseText('Switch Account');
        switchBtn.title = switchLabel;
        switchBtn.setAttribute('aria-label', switchLabel);
        switchBtn.style.display = activeUser ? 'flex' : 'none';
    }

    if (collapseBtn) {
        const label = collapseBtn.querySelector('.nav-label');
        const actionLabel = localizeLooseText(collapsed ? 'Expand' : 'Collapse');
        const sidebarAction = localizeLooseText(collapsed ? 'Expand Sidebar' : 'Collapse Sidebar');
        if (label) {
            label.textContent = actionLabel;
        }
        collapseBtn.title = sidebarAction;
        collapseBtn.setAttribute('aria-label', sidebarAction);
        collapseBtn.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    }
}

function enforceSidebarIconState() {
    const app = document.getElementById('app');
    if (!app) return;

    const collapsed = app.classList.contains('sidebar-collapsed');
    document.querySelectorAll('#app .nav-btn, #app .sidebar-footer-btn, #app .sidebar-brand-toggle').forEach((btn) => {
        const icon = btn.querySelector('.nav-icon');
        const label = btn.querySelector('.nav-label');
        const iconSvg = icon ? icon.querySelector('svg') : null;

        if (collapsed) {
            if (label) label.style.display = 'none';
            if (icon) {
                icon.style.display = 'inline-flex';
                icon.style.visibility = 'visible';
                icon.style.opacity = '1';
                icon.style.width = '20px';
                icon.style.height = '20px';
                icon.style.minWidth = '20px';
                icon.style.minHeight = '20px';
                icon.style.flex = '0 0 20px';
            }
            if (iconSvg) {
                iconSvg.style.display = 'block';
                iconSvg.style.visibility = 'visible';
                iconSvg.style.opacity = '1';
                iconSvg.style.width = '20px';
                iconSvg.style.height = '20px';
                iconSvg.style.transform = 'translateX(0)';
            }
            return;
        }

        if (label) label.style.display = '';
        if (icon) {
            icon.style.display = '';
            icon.style.visibility = '';
            icon.style.opacity = '';
            icon.style.width = '';
            icon.style.height = '';
            icon.style.minWidth = '';
            icon.style.minHeight = '';
            icon.style.flex = '';
        }
        if (iconSvg) {
            iconSvg.style.display = '';
            iconSvg.style.visibility = '';
            iconSvg.style.opacity = '';
            iconSvg.style.width = '';
            iconSvg.style.height = '';
            iconSvg.style.transform = '';
        }
    });
}

function syncSidebarLabels() {
    const adminSession = isAdminSessionActive();
    const labels = adminSession
        ? {
            home: localizeLooseText('Dashboard'),
            adminSales: localizeLooseText('Sales'),
            stockManagement: localizeLooseText('Inventory'),
            customers: localizeLooseText('Customers'),
            salesHistory: localizeLooseText('Activity Log'),
            reports: localizeLooseText('Reports'),
            adminAccounts: localizeLooseText('Admin'),
            addSale: localizeLooseText('Sales'),
            clate: localizeLooseText('Deposits'),
            settings: localizeLooseText('Settings')
        }
        : {
            home: localizeLooseText('Dashboard'),
            addSale: localizeLooseText('Sales'),
            stockManagement: localizeLooseText('Inventory'),
            customers: localizeLooseText('Customers'),
            salesHistory: localizeLooseText('Activity Log'),
            clate: localizeLooseText('Deposits'),
            reports: localizeLooseText('Reports'),
            adminSales: localizeLooseText('Sales'),
            adminAccounts: localizeLooseText('Admin'),
            settings: localizeLooseText('Settings')
        };

    document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
        const page = btn.dataset.page;
        const label = btn.querySelector('.nav-label');
        if (!label || !labels[page]) return;
        label.textContent = labels[page];
        btn.setAttribute('title', labels[page]);
        btn.setAttribute('aria-label', labels[page]);
    });

    syncSidebarUtilityButtons();
    enforceSidebarIconState();
}

async function logoutCurrentUser() {
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
    if (autoDailySalesPdfTimeout) {
        clearTimeout(autoDailySalesPdfTimeout);
        autoDailySalesPdfTimeout = null;
    }
    closeAiAssistantPanel();
    refreshAiAssistantAccessUI();
    closeOnboarding(false);

    const app = document.getElementById('app');
    if (app) {
        app.style.display = 'none';
        app.classList.remove('chrome-hidden');
    }

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.style.visibility = 'visible';
        loginScreen.style.display = 'flex';
    }

    // Show debt notifications on login screen
    void renderLoginDebtNotifications();

    const phoneInput = document.getElementById('phone');
    const pinInput = document.getElementById('pin');
    if (phoneInput) phoneInput.value = appMeta.lastLoginPhone || '';
    if (pinInput) pinInput.value = '';

    const signupName = document.getElementById('signupName');
    const signupRole = document.getElementById('signupRole');
    const signupAdminPin = document.getElementById('signupAdminPin');
    const signupAdminPinConfirm = document.getElementById('signupAdminPinConfirm');
    const confirmPin = document.getElementById('confirmPin');
    const resetPhone = document.getElementById('resetPhone');
    const resetVerificationCode = document.getElementById('resetVerificationCode');
    const resetNewPin = document.getElementById('resetNewPin');
    const resetConfirmPin = document.getElementById('resetConfirmPin');

    if (signupName) signupName.value = '';
    if (signupRole) signupRole.value = 'admin';
    if (signupAdminPin) signupAdminPin.value = '';
    if (signupAdminPinConfirm) signupAdminPinConfirm.value = '';
    if (confirmPin) confirmPin.value = '';
    if (resetPhone) resetPhone.value = '';
    if (resetVerificationCode) resetVerificationCode.value = '';
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
    updateConnectivityUI();
    initializeAuthUI();
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
    setAuthFeedback('');
    if (now < loginLockedUntil) {
        setAuthFeedback(t('authTooManyAttempts'), 'error');
        return;
    }

    const phoneInput = document.getElementById('phone');
    const pinInput = document.getElementById('pin');
    const loginIdentifier = (phoneInput ? phoneInput.value : '').trim();
    const pin = (pinInput ? pinInput.value : '').trim();
    const users = getAuthUsers();

    if (normalizePhone(loginIdentifier).length < 10) {
        setAuthFeedback(t('authPhoneRequired'), 'error');
        return;
    }
    if (!isPasswordValid(pin)) {
        setAuthFeedback(t('authPinRules'), 'error');
        return;
    }

    if (authMode === 'admin') {
        await handleAdminLogin(loginIdentifier, pin, users);
        return;
    }

    const user = findUserByLoginIdentifier(loginIdentifier, users);
    const passwordOk = await verifyUserPassword(user, pin);
    if (!user || !passwordOk) {
        registerFailedLoginAttempt('authInvalidCredentials');
        return;
    }
    if (!isUserAccountActive(user)) {
        setAuthFeedback(t('authAccountInactive'), 'error');
        return;
    }

    await completeLoginForUser(user, { loginMode: 'user' });
}

async function runLoginFlow() {
    try {
        await handleLogin();
    } catch (error) {
        console.error('Login failed unexpectedly:', error);
        setAuthFeedback('Unable to login right now. Please try again.', 'error');
    }
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
    setAuthFeedback('');

    if (!name) {
        setAuthFeedback(t('authNameRequired'), 'error');
        return;
    }
    if (phone.length < 10) {
        setAuthFeedback(t('authPhoneRequired'), 'error');
        return;
    }
    if (!isPasswordValid(pin)) {
        setAuthFeedback(t('authPinRules'), 'error');
        return;
    }
    if (pin !== confirmPin) {
        setAuthFeedback(t('authPinMismatch'), 'error');
        return;
    }

    const users = getAuthUsers();
    if (users.length > 0) {
        setAuthFeedback(t('authAdminOnlyCreate'), 'error');
        return;
    }
    const phoneExists = users.some((u) => normalizePhone(u.phone) === phone);
    if (phoneExists) {
        setAuthFeedback(t('authPhoneExists'), 'error');
        return;
    }
    const requestedRole = 'owner';
    let passwordHash = '';
    try {
        passwordHash = await hashPassword(pin);
    } catch (error) {
        setAuthFeedback(error.message || 'Unable to secure this password.', 'error');
        return;
    }

    const createdUser = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name,
        email: '',
        phone,
        passwordHash,
        role: requestedRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        authProvider: 'password'
    };
    users.push(createdUser);

    appMeta.authUsers = users;
    appMeta.lastLoginPhone = phone;
    await initializeUserStorage({ id: createdUser.id, phone });
    await optimizedSaveData();

    if (confirmInput) confirmInput.value = '';
    if (pinInput) pinInput.value = '';
    if (signupRoleSelect) signupRoleSelect.value = 'admin';
    if (signupAdminPinInput) signupAdminPinInput.value = '';
    if (signupAdminPinConfirmInput) signupAdminPinConfirmInput.value = '';
    updateSignupAdminPinVisibility();
    if (phoneInput) phoneInput.value = phone;
    showSuccessToast(t('authAccountCreated'));
    switchAuthMode('login');
    setAuthFeedback(t('authAccountCreated'), 'success');
}

function openForgotPinPanel() {
    switchAuthMode('login');
    toggleForgotPinPanel(true);
}

async function handleResetPin() {
    const resetSecretCodeInput = document.getElementById('resetSecretCode');
    const resetNewPinInput = document.getElementById('resetNewPin');
    const resetConfirmPinInput = document.getElementById('resetConfirmPin');

    const secretCode = (resetSecretCodeInput ? resetSecretCodeInput.value : '').trim();
    const newPin = (resetNewPinInput ? resetNewPinInput.value : '').trim();
    const confirmPin = (resetConfirmPinInput ? resetConfirmPinInput.value : '').trim();
    const users = getAuthUsers();
    setAuthFeedback('');

    if (secretCode !== 'UMUGWANEZA') {
        setAuthFeedback('Invalid secret code. Access denied.', 'error');
        return;
    }

    if (!isPasswordValid(newPin)) {
        setAuthFeedback(t('authPinRules'), 'error');
        return;
    }
    if (newPin !== confirmPin) {
        setAuthFeedback(t('authPinMismatch'), 'error');
        return;
    }

    try {
        // Reset admin password for all users (or create a global admin password)
        // Since admin passwords are per-user, we'll need to reset for the current context
        // For now, we'll store a global admin reset state
        const adminResetData = {
            newAdminPassword: newPin,
            resetTimestamp: new Date().toISOString()
        };
        
        // Store the reset data temporarily
        localStorage.setItem('adminPasswordReset', JSON.stringify(adminResetData));
        
        appMeta.adminPasswordReset = adminResetData;
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
    } catch (error) {
        setAuthFeedback(error.message || 'Unable to reset admin password.', 'error');
        return;
    }

    toggleForgotPinPanel(false);

    setAuthFeedback('Admin password reset successful. Please login with the new password.', 'success');
    showSuccessToast('Admin password reset successful');
}

function initializeAuthUI() {
    const users = getAuthUsers();
    bindLoginEnterShortcut();
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
    const resetSecretCodeInput = document.getElementById('resetSecretCode');
    const resetNewPinInput = document.getElementById('resetNewPin');
    const resetConfirmPinInput = document.getElementById('resetConfirmPin');

    const canPublicSignup = Array.isArray(users) && users.length === 0;
    if (signupTab) {
        signupTab.style.display = canPublicSignup ? 'inline-flex' : 'none';
    }

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
        loginBtn.addEventListener('click', (event) => {
            event.preventDefault();
            void runLoginFlow();
        });
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
    if (phoneInput && !phoneInput.dataset.boundInput) {
        phoneInput.addEventListener('input', () => {
            if (forgotPinVisible) updateResetAccountPreview();
            if (document.getElementById('authFeedback')?.style.display === 'block') {
                setAuthFeedback('');
            }
        });
        phoneInput.dataset.boundInput = '1';
    }
    if (resetPhoneInput && !resetPhoneInput.dataset.boundInput) {
        resetPhoneInput.addEventListener('input', () => {
            updateResetAccountPreview();
            if (document.getElementById('authFeedback')?.style.display === 'block') {
                setAuthFeedback('');
            }
        });
        resetPhoneInput.dataset.boundInput = '1';
    }
    if (resetSecretCodeInput && !resetSecretCodeInput.dataset.boundInput) {
        resetSecretCodeInput.addEventListener('input', () => {
            if (document.getElementById('authFeedback')?.style.display === 'block') {
                setAuthFeedback('');
            }
        });
        resetSecretCodeInput.dataset.boundInput = '1';
    }
    if (pinInput && !pinInput.dataset.boundEnter) {
        pinInput.addEventListener('keydown', (e) => {
            if (!isEnterLikeKey(e)) return;
            if (e.repeat) return;
            e.preventDefault();
            if (authMode === 'signup') {
                const confirmEl = document.getElementById('confirmPin');
                if (confirmEl) confirmEl.focus();
            } else {
                void runLoginFlow();
            }
        });
        pinInput.dataset.boundEnter = '1';
    }
    if (phoneInput && !phoneInput.dataset.boundEnter) {
        phoneInput.addEventListener('keydown', (e) => {
            if (!isEnterLikeKey(e)) return;
            if (e.repeat) return;
            e.preventDefault();
            const passwordEl = document.getElementById('pin');
            if (passwordEl && !String(passwordEl.value || '').trim()) {
                passwordEl.focus();
                return;
            }
            void runLoginFlow();
        });
        phoneInput.dataset.boundEnter = '1';
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
    if (resetNewPinInput && !resetNewPinInput.dataset.boundEnter) {
        resetNewPinInput.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            const confirmEl = document.getElementById('resetConfirmPin');
            if (confirmEl) confirmEl.focus();
        });
        resetNewPinInput.dataset.boundEnter = '1';
    }
    if (resetVerificationCodeInput && !resetVerificationCodeInput.dataset.boundEnter) {
        resetVerificationCodeInput.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            const nextEl = document.getElementById('resetNewPin');
            if (nextEl) nextEl.focus();
        });
        resetVerificationCodeInput.dataset.boundEnter = '1';
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
    updateAuthModeSummary();
    updateResetAccountPreview();
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
    installLocalizedAlertBridge();
    console.log('Make A Way App Initializing...');
    const loginScreenEl = document.getElementById('loginScreen');
    if (loginScreenEl) {
        // Prevent a login-screen flash while restoring a saved session.
        loginScreenEl.style.visibility = 'hidden';
    }
    
    try {
        // Load data first
        await loadAllData();
        const didRestoreSession = await restoreActiveSessionFromMeta();
        setAppLanguage(settings.language || 'en');
        configureDatePickers();
        setRangeToThisMonth();
        initializeAuthUI();
        initializeMobileChromeAutoHide();
        initializeAdminAutoDailySalesPdfUi();
        bindAutoDailySalesPdfLifecycleEvents();
        if (!didRestoreSession && loginScreenEl) {
            loginScreenEl.style.visibility = 'visible';
            loginScreenEl.style.display = 'flex';
            // Show debt notifications on login screen
            void renderLoginDebtNotifications();
        }
        bindOnboardingControls();
        ensureStockAdjustOverlayBindings();
        ensureClearDataConfirmBindings();
        initializeAiAssistant();
        scheduleAutoBackup();
        scheduleAutoDailySalesPdfExport();
        void registerOfflineSupport();
    } catch (error) {
        console.error('App startup failed:', error);
        try {
            initializeAuthUI();
        } catch (_) {}
        if (loginScreenEl) {
            loginScreenEl.style.visibility = 'visible';
            loginScreenEl.style.display = 'flex';
            // Show debt notifications on login screen
            void renderLoginDebtNotifications();
        }
        setAuthFeedback('Startup took too long. Please refresh and try again.', 'error');
    }

    // Always start the Rwanda clock even if startup data restore fails.
    startRwandaClock();
    
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutCurrentUser);
    }
    
    // Initialize the app
    updateDrinkList();
    updateQuickDrinkSelect();
    updateCustomerDropdown();
    updateCartDisplay();
    updateHome();
    
    // Apply theme and settings (dark mode only)
    settings.theme = 'dark';
    applyTheme('dark');
    updateConnectivityUI();
    
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

    // Credit sale customer search
    const creditCustomerSearch = document.getElementById('creditCustomerSearch');
    if (creditCustomerSearch) {
        creditCustomerSearch.removeEventListener('input', handleCreditCustomerSearch);
        creditCustomerSearch.addEventListener('input', handleCreditCustomerSearch);
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

// Credit sale customer search handler
function handleCreditCustomerSearch(e) {
    filterCreditSaleCustomers(e?.target?.value || '');
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
        if (app) app.style.display = 'grid';
        showAppBackgroundLetters();

        // Apply saved language (theme is fixed to dark)
        settings.theme = 'dark';
        const savedLanguage = settings.language || 'en';
        setAppLanguage(savedLanguage);
        applyTheme('dark');
        updateActiveUserBadge();

        showPage(targetPage);
        void maybeShowDebtReminderPopup();
    };

    if (!overlay) {
        completeLoginTransition();
        return;
    }

    // Re-trigger the animation on every login and randomize angle a bit.
    const randomAngle = 116 + Math.floor(Math.random() * 56);
    const darkActive = true;
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

function getPerfNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function setRwandaClockBase(epochMs) {
    if (!Number.isFinite(epochMs)) return false;
    rwandaClockBaseEpochMs = Number(epochMs);
    rwandaClockBasePerfMs = getPerfNow();
    return true;
}

function ensureRwandaClockBaseline() {
    if (Number.isFinite(rwandaClockBaseEpochMs) && Number.isFinite(rwandaClockBasePerfMs)) {
        return;
    }
    setRwandaClockBase(Date.now());
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
    ensureRwandaClockBaseline();
    if (!Number.isFinite(rwandaClockBaseEpochMs) || !Number.isFinite(rwandaClockBasePerfMs)) return null;
    const elapsedMs = getPerfNow() - rwandaClockBasePerfMs;
    return new Date(rwandaClockBaseEpochMs + elapsedMs);
}

function buildRwandaClockFallbackParts(now, locale) {
    const sourceDate = now instanceof Date ? now : new Date();
    const utcMs = sourceDate.getTime() + (sourceDate.getTimezoneOffset() * 60000);
    const kigaliDate = new Date(utcMs + (2 * 60 * 60000)); // Rwanda is UTC+2 (no DST)

    const pad = (value) => String(Math.max(0, Number(value) || 0)).padStart(2, '0');

    try {
        const dayText = new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            timeZone: 'UTC'
        }).format(kigaliDate);

        const dateText = new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(kigaliDate);

        const timeText = new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        }).format(kigaliDate);

        return { dayText, dateText, timeText };
    } catch (_) {
        const fallbackDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const fallbackMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayText = fallbackDayNames[kigaliDate.getUTCDay()] || 'Rwanda';
        const dateText = `${pad(kigaliDate.getUTCDate())} ${fallbackMonthNames[kigaliDate.getUTCMonth()] || 'Jan'} ${kigaliDate.getUTCFullYear()}`;
        const timeText = `${pad(kigaliDate.getUTCHours())}:${pad(kigaliDate.getUTCMinutes())}:${pad(kigaliDate.getUTCSeconds())}`;
        return { dayText, dateText, timeText };
    }
}

async function syncRwandaClockFromServer() {
    const epochMs = await fetchRwandaEpochMs();
    if (!Number.isFinite(epochMs)) return false;
    return setRwandaClockBase(epochMs);
}

async function syncAndRenderRwandaClock() {
    ensureRwandaClockBaseline();
    const synced = await syncRwandaClockFromServer();
    updateRwandaClock();
    return synced;
}

function updateRwandaClock() {
    const dayEl = document.getElementById('rwClockDay');
    const dateEl = document.getElementById('rwClockDate');
    const timeEl = document.getElementById('rwClockTime');
    if (!dayEl || !dateEl || !timeEl) return;

    const now = getSyncedRwandaDate() || new Date();
    const locale = getClockLocale();
    let parts = null;

    try {
        parts = {
            dayText: new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                timeZone: RWANDA_TIME_ZONE
            }).format(now),
            dateText: new Intl.DateTimeFormat(locale, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: RWANDA_TIME_ZONE
            }).format(now),
            timeText: new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: RWANDA_TIME_ZONE
            }).format(now)
        };
    } catch (_) {
        parts = buildRwandaClockFallbackParts(now, locale);
    }

    dayEl.textContent = parts?.dayText || 'Rwanda';
    dateEl.textContent = parts?.dateText || '--';
    timeEl.textContent = parts?.timeText || '00:00:00';
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

    ensureRwandaClockBaseline();
    updateRwandaClock();

    void syncAndRenderRwandaClock();
    rwandaClockInterval = setInterval(updateRwandaClock, 1000);
    rwandaClockSyncInterval = setInterval(() => {
        void syncAndRenderRwandaClock();
    }, RWANDA_TIME_SYNC_INTERVAL_MS);

    if (!rwandaClockLifecycleBound) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            void syncAndRenderRwandaClock();
        });
        window.addEventListener('online', () => {
            void syncAndRenderRwandaClock();
        });
        rwandaClockLifecycleBound = true;
    }
}

function configureDatePickers() {
    const todayIso = getTodayISODate();
    const pickerIds = ['salesHistoryDate', 'dailyReportDate', 'rangeStartDate', 'rangeEndDate', 'adminSalesExportDate', 'adminRangeStartDate', 'adminRangeEndDate'];

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

        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            callback(value);
        };
        const req = indexedDB.open(DB_NAME, 1);
        const timeoutId = setTimeout(() => {
            finish(reject, new Error('IndexedDB open timeout'));
        }, INDEXED_DB_TIMEOUT_MS);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
        };
        req.onsuccess = () => finish(resolve, req.result);
        req.onerror = () => finish(reject, req.error || new Error('IndexedDB open failed'));
        req.onblocked = () => finish(reject, new Error('IndexedDB open blocked'));
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
    const adminVisiblePages = new Set(['home', 'reports', 'adminSales', 'adminAccounts', 'adminHub', 'settings', 'stockManagement', 'customers', 'salesHistory']);
    if (document.body) {
        document.body.classList.toggle('admin-session', adminSession);
    }

    document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
        const page = btn.dataset.page;
        if (page === 'settings') {
            btn.style.display = activeUser ? 'flex' : 'none';
            return;
        }
        if (adminSession) {
            btn.style.display = adminVisiblePages.has(page) ? 'flex' : 'none';
            return;
        }
        if (page === 'adminPanel' || page === 'adminHub' || page === 'adminSales' || page === 'adminAccounts') {
            btn.style.display = 'none';
            return;
        }
        if (page === 'reports') {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'flex';
    });

    const topSettingsBtn = document.getElementById('topSettingsBtn');
    if (topSettingsBtn) {
        topSettingsBtn.style.display = 'none';
    }

    const switchBtn = document.getElementById('sidebarSwitchBtn');
    if (switchBtn) {
        switchBtn.style.display = activeUser ? 'flex' : 'none';
    }

    const reportsNavLabel = document.querySelector('.nav-btn[data-page="reports"] .nav-label');
    if (reportsNavLabel) {
        reportsNavLabel.textContent = adminSession ? localizeLooseText('Reports') : t('reports');
    }

    syncSidebarLabels();
    enforceSidebarIconState();
    updateActiveUserBadge();
    setReportsPageModeForRole();
    refreshProfitVisibilityUI();
    refreshAiAssistantAccessUI();
    refreshSettingsAccountSecurityUI();
}

function setReportsPageModeForRole() {
    const adminSession = isAdminSessionActive();
    const reportsHeader = document.querySelector('#reports .page-header h2');
    const adminBusinessAnalysis = document.getElementById('adminBusinessAnalysis');
    const reportControls = document.querySelector('#reports .report-controls');
    const reportRangePanel = document.querySelector('#reports .report-range-panel');
    const reportOutput = document.getElementById('reportOutput');

    if (reportsHeader) {
        reportsHeader.textContent = adminSession ? localizeLooseText('Business Analysis') : t('reports');
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
    const todayProfitCard = document.getElementById('homeSecondaryMetricCard') || (todayProfitElement ? todayProfitElement.closest('.stat-card') : null);
    if (todayProfitElement) {
        todayProfitElement.style.display = allowProfit && isAdminSessionActive() ? '' : 'none';
    }
    if (todayProfitCard && todayProfitCard.classList.contains('stat-card')) {
        todayProfitCard.style.display = '';
    }

    const addSaleProfitInput = document.getElementById('newDrinkProfitPerCase');
    if (addSaleProfitInput) {
        addSaleProfitInput.style.display = allowProfit ? '' : 'none';
        addSaleProfitInput.disabled = !allowProfit;
        if (!allowProfit) addSaleProfitInput.value = '';
    }

    const settingsBusinessCard = document.getElementById('settingsBusinessCard');
    const profitInput = document.getElementById('profitPercentage');
    const profitMode = document.getElementById('profitMode');
    const saveBusinessBtn = document.getElementById('saveBusinessSettingsBtn');
    const saveDrinkBtn = document.getElementById('saveDrinkProfitBtn');
    const profitAccessNote = document.getElementById('profitAccessNote');
    if (settingsBusinessCard) {
        settingsBusinessCard.style.display = allowProfit ? '' : 'none';
    }

    if (profitInput) profitInput.disabled = !allowProfit;
    if (profitMode) profitMode.disabled = !allowProfit;
    if (saveBusinessBtn) {
        saveBusinessBtn.disabled = !allowProfit;
        saveBusinessBtn.style.opacity = allowProfit ? '1' : '0.6';
    }
    if (saveDrinkBtn) {
        saveDrinkBtn.disabled = !allowProfit;
        saveDrinkBtn.style.opacity = allowProfit ? '1' : '0.6';
    }
    document.querySelectorAll('#drinkProfitList .drink-profit-input').forEach((input) => {
        input.disabled = !allowProfit;
    });
    if (profitAccessNote) {
        profitAccessNote.style.display = allowProfit ? 'none' : 'block';
    }
}

function refreshDataManagementAccessUI() {
    const clearBtn = document.getElementById('clearUserDataBtn');
    const clearQuickBtn = document.getElementById('adminClearDataQuickBtn');
    const dangerInput = document.getElementById('adminDangerDeleteInput');
    const warningText = document.getElementById('clearWarningText');
    const archivePanel = document.getElementById('archiveYearPanel');
    const adminAutomationCard = document.getElementById('settingsAdminAutomationCard');
    const archiveYearSelect = document.getElementById('archiveYearSelect');
    const archiveYearBtn = document.getElementById('archiveYearBtn');
    const archiveYearInfo = document.getElementById('archiveYearInfo');
    const autoPdfCheckbox = document.getElementById('adminAutoPdfEnabled');
    const autoPdfTime = document.getElementById('adminAutoPdfTime');
    const autoPdfSaveBtn = document.getElementById('saveAdminAutoPdfBtn');
    const autoPdfDownloadBtn = document.getElementById('downloadLastAutoPdfBtn');
    const autoPdfStatus = document.getElementById('adminAutoPdfStatus');
    const allowed = isAdminSessionActive();
    const allowedYears = getArchiveAllowedYears();
    const hasAllowedArchive = allowedYears.length > 0;

    if (adminAutomationCard) {
        adminAutomationCard.style.display = 'block';
    }

    if (archivePanel) {
        archivePanel.style.display = 'block';
    }

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
        clearQuickBtn.title = allowed ? '' : t('clearDataRequiresAdminLogin');
    }

    if (dangerInput) {
        if (!allowed) {
            dangerInput.value = '';
        }
        dangerInput.disabled = !allowed;
        dangerInput.style.opacity = allowed ? '1' : '0.55';
        dangerInput.style.cursor = allowed ? 'text' : 'not-allowed';
    }

    if (archiveYearSelect) {
        const hasYearValue = Boolean(String(archiveYearSelect.value || '').trim());
        const disabled = !allowed || !hasAllowedArchive || !hasYearValue;
        archiveYearSelect.disabled = disabled;
        archiveYearSelect.style.opacity = disabled ? '0.6' : '1';
    }

    if (archiveYearBtn) {
        const hasYearValue = Boolean(String(archiveYearSelect?.value || '').trim());
        const disabled = !allowed || !hasAllowedArchive || !hasYearValue;
        archiveYearBtn.disabled = disabled;
        archiveYearBtn.style.opacity = disabled ? '0.55' : '1';
        archiveYearBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        archiveYearBtn.title = !allowed ? t('clearDataRequiresAdminLogin') : '';
    }

    if (archiveYearInfo) {
        if (!allowed) {
            archiveYearInfo.textContent = t('clearDataRequiresAdminLogin');
        } else if (!hasAllowedArchive) {
            const nextYear = new Date().getFullYear() + 1;
            archiveYearInfo.textContent = localizeLooseText(`Archive opens after Jan 1, ${nextYear}.`);
        } else {
            archiveYearInfo.textContent = localizeLooseText('Moves selected year sales and deposit records into archive and removes them from active workspace.');
        }
    }

    if (autoPdfCheckbox) {
        autoPdfCheckbox.disabled = !allowed;
    }

    if (autoPdfTime) {
        autoPdfTime.disabled = !allowed || !Boolean(autoPdfCheckbox?.checked);
    }

    if (autoPdfSaveBtn) {
        autoPdfSaveBtn.disabled = !allowed;
        autoPdfSaveBtn.style.opacity = allowed ? '1' : '0.6';
    }

    if (autoPdfDownloadBtn) {
        autoPdfDownloadBtn.disabled = !allowed;
        autoPdfDownloadBtn.style.opacity = allowed ? '1' : '0.6';
    }

    if (autoPdfStatus && !allowed) {
        autoPdfStatus.textContent = localizeLooseText('Admin login required to change automation schedules or download the last automatic PDF.');
    }

    refreshAutoDailySalesPdfControls();
    handleAdminDangerDeleteInput();
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

function getArchiveAllowedYears(referenceDate = new Date()) {
    const currentYear = referenceDate.getFullYear();
    return getArchiveCandidateYears().filter((year) => Number(year) < currentYear);
}

function isArchiveAllowedForYear(year, referenceDate = new Date()) {
    const currentYear = referenceDate.getFullYear();
    return Number.isFinite(Number(year)) && Number(year) < currentYear;
}

function renderArchiveYearOptions() {
    const select = document.getElementById('archiveYearSelect');
    if (!select) return;

    const years = getArchiveAllowedYears();
    const previousValue = String(select.value || '').trim();
    select.innerHTML = '';

    if (!years.length) {
        const option = document.createElement('option');
        option.value = '';
        const nextYear = new Date().getFullYear() + 1;
        option.textContent = `Archive available after Jan 1, ${nextYear}`;
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
    if (!isArchiveAllowedForYear(selectedYear)) {
        alert('Archive is only available after the year ends.');
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
    if (role === 'owner') return localizeLooseText('Owner');
    if (role === 'admin') return localizeLooseText('Admin');
    return localizeLooseText('Employee');
}

function refreshSettingsAccountSecurityUI() {
    const nameEl = document.getElementById('activeAccountName');
    const metaEl = document.getElementById('activeAccountMeta');
    const roleEl = document.getElementById('activeAccountRole');
    const changeBtn = document.getElementById('changePinBtn');
    const resetBtn = document.getElementById('generateResetCodeBtn');
    const resetStatusEl = document.getElementById('resetCodeStatusText');

    if (nameEl) {
        nameEl.textContent = activeUser ? (activeUser.name || activeUser.phone || 'User') : t('notLoggedIn');
    }

    if (metaEl) {
        if (!activeUser) {
            metaEl.textContent = localizeLooseText('Phone login is required for every session.');
        } else {
            const phone = normalizePhone(activeUser.phone || '') || localizeLooseText('No phone saved');
            metaEl.textContent = `${phone} | ${isAdminSessionActive() ? localizeLooseText('Admin session unlocked') : localizeLooseText('Standard account access')}`;
        }
    }

    if (roleEl) {
        roleEl.textContent = activeUser ? normalizeUserRoleLabel(activeUser.role) : localizeLooseText('Guest');
    }

    if (changeBtn) {
        changeBtn.disabled = !activeUser;
    }

    if (resetBtn) {
        resetBtn.style.display = canAccessAdminPanel() ? 'block' : 'none';
    }

    if (resetStatusEl) {
        resetStatusEl.textContent = canAccessAdminPanel()
            ? 'Generate a one-time reset code for any saved phone account. Each code expires in 10 minutes.'
            : 'PIN reset codes can only be generated from an active admin session.';
    }
}

async function changePinFromSettings() {
    if (!activeUser) {
        alert('No active account is signed in.');
        return;
    }

    const currentPinRaw = window.prompt('Enter your current PIN:', '');
    if (currentPinRaw === null) return;
    const currentPin = normalizePasswordInput(currentPinRaw);
    if (!currentPin) {
        alert('Current PIN is required.');
        return;
    }

    const currentPinOk = await verifyUserPassword(activeUser, currentPin);
    if (!currentPinOk) {
        alert('Current PIN is incorrect.');
        return;
    }

    const nextPinRaw = window.prompt('Enter your new PIN:', '');
    if (nextPinRaw === null) return;
    const nextPin = normalizePasswordInput(nextPinRaw);
    if (!isPasswordValid(nextPin)) {
        alert(t('authPinRules'));
        return;
    }

    const confirmPinRaw = window.prompt('Confirm your new PIN:', '');
    if (confirmPinRaw === null) return;
    const confirmPin = normalizePasswordInput(confirmPinRaw);
    if (nextPin !== confirmPin) {
        alert(t('authPinMismatch'));
        return;
    }

    const users = getAuthUsers();
    const activeId = getAuthSessionUserId(activeUser);
    const target = users.find((user) => getAuthSessionUserId(user) === activeId);
    if (!target) {
        alert('Could not find the active account.');
        return;
    }

    try {
        target.passwordHash = await hashPassword(nextPin);
        delete target.pin;
        delete target.adminPin;
        target.authProvider = 'password';
        target.updatedAt = new Date().toISOString();
        appMeta.authUsers = users;
        activeUser = target;
        await saveNamedData(APP_META_STORAGE_KEY, appMeta);
        refreshSettingsAccountSecurityUI();
        renderAdminPanel();
        showSuccessToast('PIN updated successfully.');
    } catch (error) {
        alert(error.message || 'Unable to update PIN right now.');
    }
}

async function generateResetCodeFromSettings() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can generate a reset code.');
        return;
    }

    const defaultPhone = normalizePhone(activeUser?.phone || appMeta.lastLoginPhone || '');
    const phoneRaw = window.prompt('Enter the phone number for the account that needs a reset code:', defaultPhone);
    if (phoneRaw === null) return;

    const phone = normalizePhone(phoneRaw);
    if (phone.length < 10) {
        alert(t('authPhoneRequired'));
        return;
    }

    const users = getAuthUsers();
    const target = users.find((user) => normalizePhone(user.phone) === phone);
    if (!target) {
        alert(t('authUserNotFound'));
        return;
    }

    if (!canManageAdminAccounts() && isAdminRoleUser(target)) {
        alert('Only the owner can issue reset codes for admin or owner accounts.');
        return;
    }

    const entry = issuePasswordResetCodeForPhone(phone, activeUser);
    if (!entry) {
        alert('Could not generate a reset code right now.');
        return;
    }

    await saveNamedData(APP_META_STORAGE_KEY, appMeta);
    refreshSettingsAccountSecurityUI();

    const accountLabel = target.name || target.phone || 'this user';
    alert(
        `Reset code for ${accountLabel}: ${entry.code}\n` +
        `Expires: ${formatPasswordResetExpiry(entry.expiresAt)}`
    );
    showSuccessToast('Reset code generated successfully.');
}

function logoutFromSettings() {
    void logoutCurrentUser();
}

function getAuthProviderLabel(user) {
    const provider = String(user?.authProvider || '').trim().toLowerCase();
    return provider === 'google' ? 'Google' : 'Password';
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

    getEffectiveSalesList().forEach((sale) => {
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
    return getEffectiveSalesList()
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
    getEffectiveSalesList().forEach((sale) => {
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
    getEffectiveSalesList().forEach((sale) => {
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

function getAdminAiEmptyStateHtml(title = '') {
    const displayTitle = String(title || '').trim() || t('adminAiNoDataTitle');
    return `
        <div class="advisor-empty-state">
            <strong>${escapeHtml(localizeLooseText(displayTitle))}</strong>
            <p>${escapeHtml(localizeLooseText(ADMIN_AI_EMPTY_MESSAGE))}</p>
        </div>
    `;
}

function getAdminAiResponseTone(response) {
    const text = [
        response?.title,
        response?.insight,
        response?.reason,
        response?.action
    ].map((item) => String(item || '').toLowerCase()).join(' ');

    if (/(risk|overdue|low stock|decline|down|warning|attention|leak|pressure|slow|no data|fallback)/.test(text)) {
        return 'warning';
    }
    if (/(up|growth|healthy|strong|improv|best|momentum|safe|good)/.test(text)) {
        return 'positive';
    }
    return 'neutral';
}

function getAdminAiSalesRecordCount(analysis) {
    return Array.isArray(analysis?.stats30?.list) ? analysis.stats30.list.length : 0;
}

function hasAdminAiData(analysis) {
    return getAdminAiSalesRecordCount(analysis) > 0;
}

function dedupeAdminAiText(items, maxItems = 6) {
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .filter((item) => {
            const key = item.toLowerCase().replace(/\s+/g, ' ');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, maxItems);
}

function formatAdminAiSentenceList(items, maxItems = 3) {
    return dedupeAdminAiText(items, maxItems)
        .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))
        .join(' ');
}

function buildAdminAiGrowthTips(analysis) {
    if (!analysis) return ['Generate insights after recording sales to unlock tailored tips.'];

    const growth = Number(analysis?.growthAnalysis?.growthPercent) || 0;
    const bestProduct = analysis?.topProducts?.[0];
    const slowProduct = analysis?.slowProducts?.[0];
    const restockAlert = analysis?.restockAlerts?.[0];
    const creditShare = Number(analysis?.growthAnalysis?.creditSharePercent) || 0;
    const slowDay = analysis?.growthAnalysis?.slowestWeekday?.name || '';
    const debtInsights = analysis?.debtInsights || {};
    const topDebt = Array.isArray(debtInsights.topCustomers) ? debtInsights.topCustomers[0] : null;

    const tips = [];
    const addTip = (tip) => {
        const normalized = String(tip || '').trim();
        if (normalized) tips.push(normalized);
    };

    if (growth < -1 && bestProduct?.name) {
        addTip(`Run a 3-day promo around ${bestProduct.name} to recover this week's sales dip.`);
    } else if (bestProduct?.name) {
        addTip(`Keep ${bestProduct.name} near checkout and bundle it to raise basket size.`);
    }

    if (slowProduct?.name) {
        addTip(`Move ${slowProduct.name} with a combo or limited-time offer to clear slower stock.`);
    }

    if (restockAlert?.name) {
        addTip(`Restock ${restockAlert.name} first so peak-day demand is not missed.`);
    }

    if ((debtInsights.overdueCount || 0) > 0) {
        addTip(`Call overdue customers today. ${debtInsights.overdueCount} account(s) are already past promise date.`);
    } else if ((debtInsights.customerCount || 0) > 0) {
        addTip('Assign clear payback dates to every customer with debt to protect cash flow.');
    }

    if (topDebt?.name && Number(topDebt.owing) > 0) {
        addTip(`Start follow-up with ${topDebt.name} for ${formatAiCurrency(topDebt.owing)} to recover cash faster.`);
    }

    if (creditShare > 35) {
        addTip('Offer a same-day payment reward to reduce high credit exposure.');
    }

    if (slowDay) {
        addTip(`Use ${slowDay} for loyalty offers, reminder calls, and customer comeback campaigns.`);
    }

    if (!tips.length) {
        addTip('Keep recording daily sales so advisor recommendations stay sharp.');
    }

    return dedupeAdminAiText(tips, 5);
}

function buildAdminAiSpotlightHtml(analysis) {
    if (!analysis) return '';

    const growthTips = buildAdminAiGrowthTips(analysis);
    const debtInsights = analysis.debtInsights || {
        customerCount: 0,
        overdueCount: 0,
        dueCount: 0,
        loyalCount: 0,
        totalOwing: 0,
        topCustomers: []
    };
    const debtCustomers = Array.isArray(debtInsights.topCustomers) ? debtInsights.topCustomers.slice(0, 4) : [];
    const topDebt = debtCustomers[0];
    const debtFollowUpLine = topDebt
        ? `Highest follow-up: ${topDebt.name} (${formatAiCurrency(topDebt.owing)}).`
        : 'No customer debts are pending right now.';

    return `
        <div class="admin-ai-strategy-grid">
            <article class="admin-ai-strategy-card growth">
                <div class="admin-ai-strategy-head">
                    <h5>${escapeHtml(t('adminAiGrowthTipsTitle'))}</h5>
                    <span class="admin-ai-strategy-pill">${escapeHtml(t('adminAiActionPlanTitle'))}</span>
                </div>
                <ul class="admin-ai-tip-list">
                    ${growthTips.map((tip) => `<li>${escapeHtml(localizeLooseText(tip))}</li>`).join('')}
                </ul>
            </article>
            <article class="admin-ai-strategy-card debt">
                <div class="admin-ai-strategy-head">
                    <h5>${escapeHtml(t('adminAiDebtSectionTitle'))}</h5>
                    <span class="admin-ai-strategy-pill warning">${escapeHtml(t('adminAiCashflowWatch'))}</span>
                </div>
                <div class="admin-ai-debt-metrics">
                    <article class="admin-ai-debt-metric">
                        <span>${escapeHtml(t('adminAiTotalOwing'))}</span>
                        <strong>${escapeHtml(formatAiCurrency(debtInsights.totalOwing || 0))}</strong>
                    </article>
                    <article class="admin-ai-debt-metric">
                        <span>${escapeHtml(t('adminAiInDebt'))}</span>
                        <strong>${Number(debtInsights.customerCount || 0).toLocaleString()}</strong>
                    </article>
                    <article class="admin-ai-debt-metric">
                        <span>${escapeHtml(t('adminAiOverdueLabel'))}</span>
                        <strong>${Number(debtInsights.overdueCount || 0).toLocaleString()}</strong>
                    </article>
                </div>
                <p class="admin-ai-debt-summary-line">${escapeHtml(localizeLooseText(debtFollowUpLine))}</p>
                ${debtCustomers.length ? `
                    <div class="admin-ai-debt-list">
                        ${debtCustomers.map((customer) => `
                            <article class="admin-ai-debt-item status-${escapeHtml(customer.status || 'open')}">
                                <div class="admin-ai-debt-main">
                                    <strong>${escapeHtml(customer.name || 'Customer')}</strong>
                                    <span>${escapeHtml(formatAiCurrency(customer.owing || 0))}</span>
                                </div>
                                <span class="admin-ai-debt-status ${escapeHtml(customer.status || 'open')}">${escapeHtml(localizeLooseText(customer.statusLabel || t('adminAiNoDueDate')))}</span>
                            </article>
                        `).join('')}
                    </div>
                ` : `<p class="admin-ai-debt-empty">${escapeHtml(t('adminAiNoDebtActive'))}</p>`}
            </article>
        </div>
    `;
}

function buildAdminAiResponseCard(response) {
    const supporting = dedupeAdminAiText(response?.supporting || [], 4);
    const tone = getAdminAiResponseTone(response);
    const toneLabel = tone === 'positive' ? t('adminAiToneHealthy') : (tone === 'warning' ? t('adminAiToneWatch') : t('adminAiToneStable'));
    const responseTitle = localizeLooseText(response?.title || t('adminAiInsightFallbackTitle'));
    const responseInsight = localizeLooseText(response?.insight || ADMIN_AI_EMPTY_MESSAGE);
    const responseReason = localizeLooseText(response?.reason || 'No explanation available yet.');
    const responseAction = localizeLooseText(response?.action || 'Review your latest business data and try again.');
    return `
        <article class="admin-ai-response-card tone-${tone}">
            <div class="admin-ai-response-head">
                <span class="admin-ai-response-eyebrow">${escapeHtml(t('adminAiLabel'))}</span>
                <span class="admin-ai-response-tone ${tone}">${escapeHtml(toneLabel)}</span>
            </div>
            <h4>${escapeHtml(responseTitle)}</h4>
            <div class="admin-ai-response-row">
                <span>${escapeHtml(t('adminAiInsightLabel'))}</span>
                <strong>${escapeHtml(responseInsight)}</strong>
            </div>
            <div class="admin-ai-response-row">
                <span>${escapeHtml(t('adminAiReasonLabel'))}</span>
                <p>${escapeHtml(responseReason)}</p>
            </div>
            <div class="admin-ai-response-row">
                <span>${escapeHtml(t('adminAiActionLabel'))}</span>
                <p>${escapeHtml(responseAction)}</p>
            </div>
            ${supporting.length ? `
                <p class="admin-ai-response-support-title">${escapeHtml(t('adminAiSignalsLabel'))}</p>
                <ul class="admin-ai-response-list">
                    ${supporting.map((item) => `<li>${escapeHtml(localizeLooseText(item))}</li>`).join('')}
                </ul>
            ` : ''}
        </article>
    `;
}

function buildAdminAiOutputHtml(responses, metaLabel = '', analysis = null) {
    const cards = Array.isArray(responses) ? responses : [];
    const normalizedCards = cards.length ? cards : [getAdminAiFallbackResponse()];
    const debtCount = Number(analysis?.debtInsights?.customerCount) || 0;
    const overdueCount = Number(analysis?.debtInsights?.overdueCount) || 0;
    const displayMeta = String(metaLabel || '').trim() || t('adminAiUpdatedNow');
    const recommendationLabel = normalizedCards.length === 1 ? t('adminAiRecommendationSingular') : t('adminAiRecommendationPlural');
    const debtLabel = debtCount === 1 ? t('adminAiDebtCustomerSingular') : t('adminAiDebtCustomerPlural');
    return `
        <div class="advisor-meta-row admin-ai-response-meta">
            <span class="advisor-meta-pill">${escapeHtml(localizeLooseText(displayMeta))}</span>
            <span class="advisor-meta-pill neutral">${normalizedCards.length} ${escapeHtml(recommendationLabel)}</span>
            <span class="advisor-meta-pill neutral">${debtCount} ${escapeHtml(debtLabel)}</span>
            ${overdueCount > 0 ? `<span class="advisor-meta-pill warning">${overdueCount} ${escapeHtml(t('adminAiOverdueLabel'))}</span>` : ''}
            <span class="advisor-meta-pill neutral">${escapeHtml(t('adminAiRealData'))}</span>
        </div>
        ${buildAdminAiSpotlightHtml(analysis)}
        <div class="admin-ai-response-grid">
            ${normalizedCards.map((item) => buildAdminAiResponseCard(item)).join('')}
        </div>
    `;
}

function getAdminAiFallbackResponse() {
    return {
        title: 'No data yet',
        insight: ADMIN_AI_EMPTY_MESSAGE,
        reason: 'There are no saved sales records in this workspace yet.',
        action: 'Add sales, then generate insights again.'
    };
}

function buildAdminAiHealthResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const priorities = dedupeAdminAiText(analysis?.priorities || [], AI_ASSISTANT_MAX_PRIORITIES);
    return {
        title: 'Business Health Score',
        insight: `Business health score is ${analysis.healthScore.score}/100.`,
        reason: formatAdminAiSentenceList(analysis.healthScore.notes, 2) || 'Recent activity is being tracked across sales, stock, and profit signals.',
        action: priorities[0] || analysis.dailySummary.recommendation || 'Work through the top issue and refresh insights again.',
        supporting: analysis.healthScore.notes
    };
}

function buildAdminAiSummaryResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const summary = analysis.dailySummary || {};
    const todaySales = getSalesForSpecificDay(getTodayISODate());
    return {
        title: "Today's Summary",
        insight: `Today's sales total ${formatAiCurrency(summary.totalSales || 0)}.`,
        reason: formatAdminAiSentenceList([
            `Best product: ${summary.bestProduct || '--'}`,
            `Slow product: ${summary.slowProduct || '--'}`,
            `${todaySales.length} sale record(s) were captured today`
        ], 3),
        action: summary.recommendation || 'Keep recording sales today for a stronger recommendation.',
        supporting: [
            `Total sales: ${formatAiCurrency(summary.totalSales || 0)}`,
            `Best product: ${summary.bestProduct || '--'}`,
            `Slow product: ${summary.slowProduct || '--'}`
        ]
    };
}

function buildAdminAiRestockResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const alert = analysis.restockAlerts[0];
    const bestSeller = analysis.topProducts[0];
    if (!alert) {
        return {
            title: 'Smart Restock Alerts',
            insight: 'Stock levels are healthy right now.',
            reason: 'No product is currently flagged as low based on stock on hand and recent sales movement.',
            action: `Keep a safety buffer for ${bestSeller?.name || 'your best seller'} before the next rush.`,
            supporting: bestSeller?.name ? [`Best seller to protect: ${bestSeller.name}`] : []
        };
    }

    return {
        title: 'Smart Restock Alerts',
        insight: `${alert.name} needs restocking soon.`,
        reason: `${alert.name} has ${alert.stockQty} case(s) left and recent sales suggest only ${formatDaysRemaining(alert.daysRemaining)} of cover remaining.`,
        action: `Reorder ${alert.name} now and keep extra stock ready before the next busy day.`,
        supporting: analysis.restockAlerts.slice(0, 3).map((item) => `${item.name}: ${item.stockQty} case(s), ${formatDaysRemaining(item.daysRemaining)} left`)
    };
}

function buildAdminAiTopProductsResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const top = analysis.topProducts[0];
    const slow = analysis.slowProducts[0];
    if (!top) {
        return {
            title: 'Top Products',
            insight: ADMIN_AI_EMPTY_MESSAGE,
            reason: 'Sales need to be recorded before product rankings can be calculated.',
            action: 'Add today\'s sales and run this command again.'
        };
    }

    return {
        title: 'Top Products',
        insight: `${top.name} is your best-selling product right now.`,
        reason: `${top.name} sold ${top.qty} case(s) in the last ${analysis.windowDays} days${analysis.dailySummary.bestProduct === top.name ? ' and it also leads today\'s sales' : ''}.`,
        action: `Keep ${top.name} visible and bundle it with ${slow?.name || 'slower items'} to lift total basket size.`,
        supporting: analysis.topProducts.slice(0, 3).map((item) => `${item.name}: ${item.qty} case(s) sold`)
    };
}

function buildAdminAiProfitResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const trend = analysis.profitTrend;
    const firstLeak = analysis.profitLeaks[0];
    if (!trend?.allowed) {
        return {
            title: 'Profit Insights',
            insight: 'Profit values are not available for this view.',
            reason: 'Profit visibility depends on admin-level access and saved profit settings.',
            action: 'Open the admin session and review your profit settings to unlock exact profit insights.'
        };
    }

    const insight = trend.deltaPercent > 2
        ? `Profit is up ${trend.deltaPercent.toFixed(1)}% this week.`
        : (trend.deltaPercent < -2
            ? `Profit is down ${Math.abs(trend.deltaPercent).toFixed(1)}% this week.`
            : 'Profit is flat this week.');
    const reason = firstLeak
        ? firstLeak
        : (trend.deltaPercent < 1
            ? 'No strong high-margin sales are lifting profit right now.'
            : 'High-performing products are helping profit stay healthy.');
    const action = firstLeak
        ? 'Fix the leak first, then promote your highest-margin drink to recover profit faster.'
        : 'Promote your highest-margin drink this week and track whether profit improves after the campaign.';

    return {
        title: 'Profit Insights',
        insight,
        reason,
        action,
        supporting: [
            `Weekly profit change: ${formatSignedPercent(trend.deltaPercent)}`,
            ...analysis.profitLeaks.slice(0, 2)
        ]
    };
}

function buildAdminAiPrioritiesResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const priorities = dedupeAdminAiText(
        analysis.priorities.length ? analysis.priorities : buildAiAssistantActionPlan(analysis),
        AI_ASSISTANT_MAX_PRIORITIES
    );
    const topPriority = priorities[0];
    const nextPriority = priorities[1];
    if (!topPriority) {
        return {
            title: "Today's Priorities",
            insight: 'No urgent priorities are showing right now.',
            reason: 'Current sales and stock data do not show a critical bottleneck.',
            action: analysis.dailySummary.recommendation || 'Keep logging sales and refresh insights later today.'
        };
    }

    return {
        title: "Today's Priorities",
        insight: `Your top priority today is ${topPriority}.`,
        reason: 'This recommendation is based on current sales movement, stock levels, and recent business trends.',
        action: nextPriority
            ? `Complete "${topPriority}" first, then move to "${nextPriority}".`
            : 'Complete the top priority first, then refresh insights for the next action.',
        supporting: priorities
    };
}

function buildAdminAiGeneralResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const growth = Number(analysis.growthAnalysis?.growthPercent) || 0;
    const bestProduct = analysis.topProducts[0];
    const slowProduct = analysis.slowProducts[0];
    const trendLine = growth > 1
        ? `Sales are up ${growth.toFixed(1)}% over the last ${analysis.windowDays} days.`
        : (growth < -1
            ? `Sales are down ${Math.abs(growth).toFixed(1)}% over the last ${analysis.windowDays} days.`
            : 'Sales are stable across the current period.');

    return {
        title: 'Business Snapshot',
        insight: `Business health is ${analysis.healthScore.score}/100. ${trendLine}`,
        reason: formatAdminAiSentenceList([
            analysis.healthScore.notes[0],
            bestProduct?.name ? `${bestProduct.name} is leading product movement` : '',
            slowProduct?.name ? `${slowProduct.name} is underperforming` : ''
        ], 3),
        action: analysis.priorities[0] || analysis.dailySummary.recommendation || 'Review today\'s sales and focus on the next bottleneck.',
        supporting: [
            `Total sales today: ${formatAiCurrency(analysis.dailySummary.totalSales || 0)}`,
            `Best product: ${analysis.dailySummary.bestProduct || '--'}`,
            `Slow product: ${analysis.dailySummary.slowProduct || '--'}`
        ]
    };
}

function buildAdminAiRiskResponse(analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();
    const alert = analysis.restockAlerts[0];
    const firstLeak = analysis.profitLeaks[0];
    const debtFollowUp = analysis.growthAnalysis?.topDebtFollowUp;

    if (alert) {
        return buildAdminAiRestockResponse(analysis);
    }
    if (firstLeak) {
        return buildAdminAiProfitResponse(analysis);
    }
    if (debtFollowUp?.name && Number(debtFollowUp.owing) > 0) {
        return {
            title: 'Risk Watch',
            insight: `${debtFollowUp.name} is the top follow-up account right now.`,
            reason: `${debtFollowUp.name} still owes ${formatAiCurrency(debtFollowUp.owing)} and late collections can squeeze cash flow.`,
            action: `Contact ${debtFollowUp.name} today and agree on a payment date.`,
            supporting: [`Outstanding debt: ${formatAiCurrency(analysis.growthAnalysis?.outstandingDebtTotal || 0)}`]
        };
    }
    return {
        title: 'Risk Watch',
        insight: 'No major operational risk is showing right now.',
        reason: 'Stock, debt, and product movement look stable in the latest saved data.',
        action: analysis.dailySummary.recommendation || 'Keep monitoring sales and rerun insights after the next sync.'
    };
}

function buildAdminAiDebtResponse(analysis) {
    const debtInsights = analysis?.debtInsights || {
        customerCount: 0,
        overdueCount: 0,
        dueCount: 0,
        loyalCount: 0,
        totalOwing: 0,
        topCustomers: []
    };
    const topDebt = Array.isArray(debtInsights.topCustomers) ? debtInsights.topCustomers[0] : null;

    if ((debtInsights.customerCount || 0) <= 0) {
        return {
            title: 'Debt Watchlist',
            insight: 'No customer debt is active right now.',
            reason: 'All recorded customer balances appear settled.',
            action: 'Keep using clear payment terms to protect cash flow.'
        };
    }

    return {
        title: 'Debt Watchlist',
        insight: `${debtInsights.customerCount} customer account(s) owe ${formatAiCurrency(debtInsights.totalOwing || 0)}.`,
        reason: debtInsights.overdueCount > 0
            ? `${debtInsights.overdueCount} account(s) are overdue and need immediate follow-up.`
            : `${debtInsights.dueCount || 0} account(s) have promised dates tracked in the system.`,
        action: topDebt?.name
            ? `Start with ${topDebt.name} (${formatAiCurrency(topDebt.owing || 0)}) and log the next payment date.`
            : 'Review debt accounts and schedule collection follow-ups.',
        supporting: (debtInsights.topCustomers || []).slice(0, 3).map((item) => `${item.name}: ${formatAiCurrency(item.owing || 0)} (${item.statusLabel || 'No due date'})`)
    };
}

function buildAdminAiOverviewResponses(analysis) {
    return [
        buildAdminAiHealthResponse(analysis),
        buildAdminAiSummaryResponse(analysis),
        buildAdminAiDebtResponse(analysis),
        buildAdminAiRiskResponse(analysis)
    ];
}

function getAdminAiStructuredResponse(prompt, analysis) {
    if (!hasAdminAiData(analysis)) return getAdminAiFallbackResponse();

    const query = normalizeAiAssistantQuery(prompt);
    if (aiQueryHasAny(query, ['priority', 'priorities', 'next step'])) {
        return buildAdminAiPrioritiesResponse(analysis);
    }
    if (aiQueryHasAny(query, ['health', 'score', 'status'])) {
        return buildAdminAiHealthResponse(analysis);
    }
    if (aiQueryHasAny(query, ['restock', 'stock', 'inventory'])) {
        return buildAdminAiRestockResponse(analysis);
    }
    if (aiQueryHasAny(query, ['profit', 'margin', 'leak'])) {
        return buildAdminAiProfitResponse(analysis);
    }
    if (aiQueryHasAny(query, ['debt', 'owing', 'overdue', 'credit'])) {
        return buildAdminAiDebtResponse(analysis);
    }
    if (aiQueryHasAny(query, ['sell the most', 'best seller', 'best-selling', 'top', 'most', 'popular'])) {
        return buildAdminAiTopProductsResponse(analysis);
    }
    if (aiQueryHasAny(query, ['summary', 'report', 'overview', 'today'])) {
        return buildAdminAiSummaryResponse(analysis);
    }
    return buildAdminAiGeneralResponse(analysis);
}

function renderAdminAiPanel(force = false) {
    const panel = document.querySelector('#reports #adminBusinessAnalysis .admin-ai-advisor-card')
        || document.querySelector('#adminPanel .admin-ai-panel');
    const output = document.getElementById('businessAiAdvisorOutput');
    if (!panel || !output) return null;
    const scoreValue = document.getElementById('adminAiHealthScoreValue');
    const explanation = document.getElementById('adminAiHealthExplanation');
    const totalEl = document.getElementById('adminAiTotalSales');
    const bestEl = document.getElementById('adminAiBestProduct');
    const slowEl = document.getElementById('adminAiSlowProduct');
    const recommendationEl = document.getElementById('adminAiRecommendationText');
    const restockList = document.getElementById('adminAiRestockAlertsList');
    const leakList = document.getElementById('adminAiProfitLeakList');
    const prioritiesList = document.getElementById('adminAiPrioritiesList');

    if (!activeUser || !canAccessAdminPanel()) {
        if (scoreValue) scoreValue.textContent = '--';
        if (explanation) explanation.textContent = localizeLooseText('Admin access is required to unlock AI insights.');
        if (totalEl) totalEl.textContent = '--';
        if (bestEl) bestEl.textContent = '--';
        if (slowEl) slowEl.textContent = '--';
        if (recommendationEl) recommendationEl.textContent = localizeLooseText('Sign in with admin access to unlock insights.');
        if (restockList) restockList.innerHTML = `<li>${escapeHtml(localizeLooseText('Admin access is required to unlock AI insights.'))}</li>`;
        if (leakList) leakList.innerHTML = `<li>${escapeHtml(localizeLooseText('Admin access is required to unlock AI insights.'))}</li>`;
        if (prioritiesList) prioritiesList.innerHTML = `<li>${escapeHtml(localizeLooseText('Admin access is required to unlock AI insights.'))}</li>`;
        if (output && !output.classList.contains('is-generating')) {
            output.innerHTML = getAdminAiEmptyStateHtml(localizeLooseText('Admin access required'));
        }
        return null;
    }

    const analysis = getAiAssistantAnalysis(force);
    const hasData = hasAdminAiData(analysis);
    const healthResponse = hasData ? buildAdminAiHealthResponse(analysis) : getAdminAiFallbackResponse();
    const summary = analysis.dailySummary || {};

    if (scoreValue) scoreValue.textContent = hasData ? `${analysis.healthScore.score}/100` : '--';
    if (explanation) explanation.textContent = localizeLooseText(hasData ? formatAdminAiSentenceList([healthResponse.reason, healthResponse.action], 2) : ADMIN_AI_EMPTY_MESSAGE);
    if (totalEl) totalEl.textContent = hasData ? formatAiCurrency(summary.totalSales || 0) : '--';
    if (bestEl) bestEl.textContent = hasData ? (summary.bestProduct || '--') : '--';
    if (slowEl) slowEl.textContent = hasData ? (summary.slowProduct || '--') : '--';
    if (recommendationEl) recommendationEl.textContent = localizeLooseText(hasData ? (summary.recommendation || 'No recommendation available yet.') : ADMIN_AI_EMPTY_MESSAGE);

    if (restockList) {
        const restockItems = hasData
            ? analysis.restockAlerts.slice(0, 4).map((item) => localizeLooseText(`${item.name}: ${item.stockQty} case(s), ${formatDaysRemaining(item.daysRemaining)} left`))
            : [ADMIN_AI_EMPTY_MESSAGE];
        restockList.innerHTML = buildAiListItemsHtml(restockItems, ADMIN_AI_EMPTY_MESSAGE);
    }

    if (leakList) {
        const leakItems = hasData
            ? (analysis.profitLeaks.length ? analysis.profitLeaks : [localizeLooseText('No obvious profit leaks detected.')])
            : [ADMIN_AI_EMPTY_MESSAGE];
        leakList.innerHTML = buildAiListItemsHtml(leakItems, ADMIN_AI_EMPTY_MESSAGE);
    }

    if (prioritiesList) {
        const priorityItems = hasData
            ? dedupeAdminAiText(
                analysis.priorities.length ? analysis.priorities : buildAiAssistantActionPlan(analysis),
                AI_ASSISTANT_MAX_PRIORITIES
            )
            : [ADMIN_AI_EMPTY_MESSAGE];
        prioritiesList.innerHTML = buildAiListItemsHtml(priorityItems, ADMIN_AI_EMPTY_MESSAGE);
    }

    if (!hasData && !output.classList.contains('is-generating')) {
        output.innerHTML = getAdminAiEmptyStateHtml();
    }

    return analysis;
}

async function runBusinessAiAdvisor(silent = false) {
    const output = document.getElementById('businessAiAdvisorOutput');
    const trigger = document.getElementById('runBusinessAiAdvisorBtn');

    if (!canAccessAdminPanel()) {
        if (output) {
            output.innerHTML = getAdminAiEmptyStateHtml(localizeLooseText('Permission denied'));
        }
        if (!silent) {
            alert(localizeLooseText('Permission Denied'));
        }
        return localizeLooseText('Permission Denied');
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
        trigger.dataset.defaultLabel = trigger.dataset.defaultLabel || trigger.textContent || localizeLooseText('Generate Insights');
        trigger.textContent = localizeLooseText('Generating...');
    }

    await new Promise((resolve) => setTimeout(resolve, 420));

    const analysis = renderAdminAiPanel(true);
    const responses = analysis && hasAdminAiData(analysis)
        ? buildAdminAiOverviewResponses(analysis)
        : [getAdminAiFallbackResponse()];
    if (output) {
        const updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        output.innerHTML = localizeHtmlLooseText(buildAdminAiOutputHtml(responses, `Updated ${updatedAt}`, analysis));
        output.classList.remove('is-generating');
    }
    if (trigger) {
        trigger.disabled = false;
        trigger.classList.remove('is-generating');
        trigger.textContent = trigger.dataset.defaultLabel || localizeLooseText('Generate Insights');
    }

    if (!silent) {
        showSuccessToast('AI insights updated.');
    }
    return responses;
}

async function runAdminAiQuickCommand(prompt) {
    const output = document.getElementById('businessAiAdvisorOutput');
    if (!canAccessAdminPanel()) {
        if (output) {
            output.innerHTML = getAdminAiEmptyStateHtml(localizeLooseText('Permission denied'));
        }
        alert(localizeLooseText('Permission Denied'));
        return getAdminAiFallbackResponse();
    }

    if (output) {
        output.classList.add('is-generating');
        output.innerHTML = `
            <div class="advisor-loading">
                <div class="advisor-loading-line w50"></div>
                <div class="advisor-loading-line w85"></div>
                <div class="advisor-loading-line w70"></div>
            </div>
        `;
    }

    await new Promise((resolve) => setTimeout(resolve, 240));

    const analysis = renderAdminAiPanel(true);
    const response = analysis
        ? getAdminAiStructuredResponse(prompt, analysis)
        : getAdminAiFallbackResponse();

    if (output) {
        output.innerHTML = localizeHtmlLooseText(buildAdminAiOutputHtml([response], String(prompt || localizeLooseText('Quick command')).trim() || localizeLooseText('Quick command'), analysis));
        output.classList.remove('is-generating');
    }

    return response;
}

function getAdminGrowthInsights() {
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(recentStart.getDate() - 29);
    recentStart.setHours(0, 0, 0, 0);

    const prevStart = new Date(recentStart);
    prevStart.setDate(prevStart.getDate() - 30);
    const prevEnd = new Date(recentStart);

    const recentSales = getEffectiveSalesList().filter((sale) => {
        const dt = getSaleDateTimeOrNull(sale);
        return dt && dt >= recentStart && dt <= now;
    });
    const previousSales = getEffectiveSalesList().filter((sale) => {
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
            ${insights.map((line) => `<li>${escapeHtml(localizeLooseText(line))}</li>`).join('')}
        </ul>
    `;

    if (!silent) {
        showSuccessToast('AI growth analysis updated.');
    }
}

async function exportAdminDailySalesPDF(dayIsoOverride = '', options = {}) {
    const runtimeOptions = (typeof dayIsoOverride === 'object' && dayIsoOverride !== null)
        ? dayIsoOverride
        : options;
    const silent = Boolean(runtimeOptions?.silent);
    const bypassAdminSession = Boolean(runtimeOptions?.bypassAdminSession);
    const source = String(runtimeOptions?.source || 'manual').trim();

    const hasPermission = bypassAdminSession ? hasAutoDailySalesPdfPrivileges() : canAccessAdminPanel();
    if (!hasPermission) {
        if (!silent) {
            alert('Only an active admin session can export daily sales.');
        }
        return { success: false, reason: 'auth' };
    }

    const dateInput = document.getElementById('adminSalesExportDate');
    const selectedDate = String(
        (typeof dayIsoOverride === 'string' ? dayIsoOverride : runtimeOptions?.dayIso) ||
        dateInput?.value ||
        getTodayISODate()
    ).trim() || getTodayISODate();
    if (dateInput) dateInput.value = selectedDate;

    const daySales = getSalesForSpecificDay(selectedDate);
    if (!daySales.length) {
        if (!silent) {
            alert(t('adminExportDayNoSales'));
        }
        return { success: false, reason: 'no-sales', date: selectedDate };
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
        await ensurePDFLibrariesReady();
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
            const unitPrice = Number(sale.unitPrice ?? sale.price) || 0;
            return [
                saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                String(sale.drinkName || 'Unknown'),
                String(Number(sale.quantity) || 0),
                `RWF ${unitPrice.toLocaleString()}`,
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
        const filename = `admin-daily-sales-${selectedDate}.pdf`;
        let pdfBlob = null;
        try {
            pdfBlob = doc.output('blob');
        } catch (blobError) {
            pdfBlob = null;
        }

        if (pdfBlob instanceof Blob) {
            if (source === 'auto') {
                await cacheAutoDailySalesPdfBackup(pdfBlob, filename, selectedDate);
            }
            triggerPdfBlobDownload(pdfBlob, filename);
        } else {
            doc.save(filename);
        }
        if (!silent) {
            showSuccessToast(`Daily sales PDF exported for ${selectedDate}.`);
        } else if (source === 'auto') {
            console.info(`Automatic daily sales PDF prepared for ${selectedDate}.`);
        }
        return { success: true, reason: 'exported', date: selectedDate };
    } catch (error) {
        console.error('Admin daily sales export failed:', error);
        if (!silent) {
            alert(`Could not export day PDF: ${error.message}`);
        }
        return { success: false, reason: 'error', date: selectedDate, error };
    }
}

async function exportAdminAllSalesPDF() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export sales.');
        return;
    }

    const allSales = getEffectiveSalesList()
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
        await ensurePDFLibrariesReady();
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
            const unitPrice = Number(sale.unitPrice ?? sale.price) || 0;
            return [
                dayIso ? formatPdfDate(dayIso) : '-',
                saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                String(sale.drinkName || 'Unknown'),
                String(Number(sale.quantity) || 0),
                `RWF ${unitPrice.toLocaleString()}`,
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

async function exportAdminRangeSalesPDF() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export sales.');
        return;
    }

    const startInput = document.getElementById('adminRangeStartDate');
    const endInput = document.getElementById('adminRangeEndDate');
    const startDate = startInput?.value?.trim();
    const endDate = endInput?.value?.trim();

    if (!startDate || !endDate) {
        alert('Please select both start and end dates for the range export.');
        return;
    }

    if (startDate > endDate) {
        alert('Start date cannot be after end date.');
        return;
    }

    const allSales = getEffectiveSalesList()
        .filter((sale) => {
            const saleDate = getSaleDateIso(sale);
            return saleDate && saleDate >= startDate && saleDate <= endDate;
        })
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
        alert(`No sales data found between ${startDate} and ${endDate}.`);
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

    const rangeLabel = `${formatPdfDate(startDate)} - ${formatPdfDate(endDate)}`;

    try {
        await ensurePDFLibrariesReady();
        const doc = createPDFDocument({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const reportTitle = 'Range Sales';
        let y = applyPdfBrandHeaderFirstPageOnly(doc, reportTitle);
        const margin = 14;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(12, 96, 156);
        doc.text(`Range Sales Summary`, margin, y);
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
            const unitPrice = Number(sale.unitPrice ?? sale.price) || 0;
            return [
                dayIso ? formatPdfDate(dayIso) : '-',
                saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                String(sale.drinkName || 'Unknown'),
                String(Number(sale.quantity) || 0),
                `RWF ${unitPrice.toLocaleString()}`,
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
        doc.save(`admin-range-sales-${startDate}-to-${endDate}-${todayIso}.pdf`);
        showSuccessToast(`Range sales PDF exported for ${rangeLabel}.`);
    } catch (error) {
        console.error('Admin range sales export failed:', error);
        alert(`Could not export range sales PDF: ${error.message}`);
    }
}

async function exportAdminStockAuditPDF() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can export stock audit PDF.');
        return;
    }
    await exportStockManagementPDF();
}

function renderAdminPanel() {
    if (isAdminSessionActive() && !adminSalesCacheLoaded) {
        refreshAdminSalesCache().then(() => renderAdminPanel());
        return;
    }

    const body = document.getElementById('adminUsersBody');
    const totalEl = document.getElementById('adminSummaryTotal');
    const privilegedEl = document.getElementById('adminSummaryPrivileged');
    const staffEl = document.getElementById('adminSummaryStaff');
    const inactiveEl = document.getElementById('adminSummaryInactive');
    const createUserCard = document.getElementById('adminCreateUserCard');
    if (!body || !totalEl || !privilegedEl || !staffEl || !inactiveEl) return;

    if (createUserCard) {
        createUserCard.style.display = isAdminSessionActive() ? 'block' : 'none';
    }

    configureDatePickers();
    initializeAdminAutoDailySalesPdfUi();
    refreshAutoDailySalesPdfControls();
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
    renderAdminAiPanel();
    handleAdminDangerDeleteInput();

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
        const canToggleRole = canManage && !isSelf;
        const canToggleStatus = canManage && !isSelf;
        const statusToggleLabel = isActive ? 'Deactivate' : 'Activate';
        const statusButtonClass = isActive ? 'admin-action-btn danger' : 'admin-action-btn secondary';

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
                    <button class="admin-action-btn secondary" onclick="viewUserDataSnapshot(${index})">View Data</button>
                    <button class="admin-action-btn" onclick="adminResetUserPin(${index})" ${canResetPin ? '' : 'disabled'}>Reset Password</button>
                    <button class="admin-action-btn" onclick="toggleUserRole(${index})" ${canToggleRole ? '' : 'disabled'}>Change Role</button>
                    <button class="${statusButtonClass}" onclick="toggleUserActiveStatus(${index})" ${canToggleStatus ? '' : 'disabled'}>${statusToggleLabel}</button>
                </div>
            </td>
        `;
        body.appendChild(row);
    });
}

async function waitForPendingSave() {
    if (!isSaving && !saveTimeout) return;
    await new Promise((resolve) => {
        const check = () => {
            if (!isSaving && !saveTimeout) {
                resolve();
                return;
            }
            setTimeout(check, 50);
        };
        check();
    });
}

async function createUserFromAdminPanel() {
    if (!isAdminSessionActive()) {
        alert('Only an active admin session can create user accounts.');
        return;
    }

    const nameInput = document.getElementById('adminCreateUserName');
    const phoneInput = document.getElementById('adminCreateUserPhone');
    const passwordInput = document.getElementById('adminCreateUserPassword');
    const roleSelect = document.getElementById('adminCreateUserRole');

    const name = String(nameInput ? nameInput.value : '').trim();
    const phone = normalizePhone(phoneInput ? phoneInput.value : '');
    const password = String(passwordInput ? passwordInput.value : '').trim();
    const roleValue = String(roleSelect ? roleSelect.value : '').trim().toLowerCase();
    const role = roleValue === 'admin' ? 'admin' : 'staff';

    if (phone.length < 10) {
        alert(t('authPhoneRequired'));
        return;
    }
    if (!isPasswordValid(password)) {
        alert(t('authPinRules'));
        return;
    }

    const users = getAuthUsers();
    const phoneExists = users.some((user) => normalizePhone(user.phone) === phone);
    if (phoneExists) {
        alert(t('authPhoneExists'));
        return;
    }

    let passwordHash = '';
    try {
        passwordHash = await hashPassword(password);
    } catch (error) {
        alert(error.message || 'Unable to secure this password.');
        return;
    }

    const createdUser = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name || `User ${phone.slice(-4)}`,
        email: '',
        phone,
        passwordHash,
        role,
        isActive: true,
        createdAt: new Date().toISOString(),
        authProvider: 'password'
    };

    users.push(createdUser);
    appMeta.authUsers = users;
    await initializeUserStorage({ id: createdUser.id, phone: createdUser.phone });
    await saveAuthUsersWithFeedback(`Account created for ${createdUser.name || createdUser.phone}.`);

    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (roleSelect) roleSelect.value = 'staff';
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

    const nextRoleLabel = normalizeUserRoleLabel(nextRole);
    const confirmed = await showUiConfirm({
        title: 'Change Role',
        message: `Change ${target.name || target.phone || 'this user'} to ${nextRoleLabel}?`,
        confirmText: 'Change Role',
        cancelText: 'Cancel'
    });
    if (!confirmed) return;

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

    const actionLabel = nextActive ? 'Activate' : 'Deactivate';
    const confirmed = await showUiConfirm({
        title: `${actionLabel} Account`,
        message: `${actionLabel} ${target.name || target.phone || 'this user'}?`,
        confirmText: actionLabel,
        cancelText: 'Cancel'
    });
    if (!confirmed) return;

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
        alert('Only the owner can reset admin/owner passwords.');
        return;
    }

    const codeRaw = window.prompt(t('authSecretCodePrompt'), '');
    if (codeRaw === null) return;
    const code = String(codeRaw || '').trim().toUpperCase();
    if (code !== 'UMUGWANEZA') {
        alert(t('authSecretCodeInvalid'));
        return;
    }

    const pinRaw = window.prompt(`Set a new password for ${target.name || 'this user'}:`, '');
    if (pinRaw === null) return;
    const nextPassword = String(pinRaw || '').trim();
    if (!isPasswordValid(nextPassword)) {
        alert(t('authPinRules'));
        return;
    }

    const confirmRaw = window.prompt('Confirm the new password:', '');
    if (confirmRaw === null) return;
    const confirmPassword = String(confirmRaw || '').trim();
    if (confirmPassword !== nextPassword) {
        alert(t('authPinMismatch'));
        return;
    }

    try {
        target.passwordHash = await hashPassword(nextPassword);
        delete target.pin;
        delete target.adminPin;
        target.authProvider = 'password';
        target.updatedAt = new Date().toISOString();
        appMeta.authUsers = users;
        await saveAuthUsersWithFeedback(`Password reset for ${target.name || 'user'}.`);
    } catch (error) {
        alert(error.message || 'Unable to reset password.');
    }
}

async function adminPromptResetUserPassword() {
    if (!canAccessAdminPanel()) {
        alert('You do not have admin access.');
        return;
    }

    const phoneRaw = window.prompt('Enter the phone number for the account you want to reset:', '');
    if (phoneRaw === null) return;

    const phone = normalizePhone(phoneRaw);
    if (phone.length < 10) {
        alert(t('authPhoneRequired'));
        return;
    }

    const users = getAuthUsers();
    const userIndex = users.findIndex((user) => normalizePhone(user.phone) === phone);
    if (userIndex === -1) {
        alert(t('authUserNotFound'));
        return;
    }

    await adminResetUserPin(userIndex);
}

function handleAdminDangerDeleteInput() {
    const input = document.getElementById('adminDangerDeleteInput');
    const button = document.getElementById('adminClearDataQuickBtn');
    const allowed = isAdminSessionActive();
    const confirmed = allowed && String(input?.value || '').trim() === 'DELETE';

    if (button) {
        button.disabled = !confirmed;
        button.style.opacity = confirmed ? '1' : '0.55';
        button.style.cursor = confirmed ? 'pointer' : 'not-allowed';
    }

    return confirmed;
}

async function clearEmployeeData(index) {
    if (!isAdminSessionActive()) {
        alert('Only an active admin session can clear employee data.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;
    if (getAuthSessionUserId(target) === getAuthSessionUserId(activeUser)) {
        alert('You cannot clear your own data.');
        return;
    }

    const role = normalizeAuthRole(target.role, 'staff');
    if (role !== 'staff') {
        alert('Only employee accounts can be cleared.');
        return;
    }

    const nameLabel = target.name || target.phone || 'this employee';
    const confirmed = await showUiConfirm({
        title: 'Clear Employee Data',
        message: `This will permanently delete ${nameLabel}'s sales, customers, deposits, stock, settings, and archives. Continue?`,
        confirmText: 'Clear Data',
        cancelText: 'Cancel'
    });
    if (!confirmed) return;

    await waitForPendingSave();
    await initializeUserStorage(target);
    showSuccessToast(`Data cleared for ${nameLabel}.`);
}

async function adminResetUserAdminPin(index) {
    if (!canAccessAdminPanel()) {
        alert('You do not have admin access.');
        return;
    }
    const users = getAuthUsers();
    const target = users[index];
    if (!target) return;
    if (!canManageAdminAccounts() && isAdminRoleUser(target)) {
        alert('Only the owner can reset admin/owner passwords.');
        return;
    }

    const adminPinRaw = window.prompt(`Set a new admin password for ${target.name || 'this user'}:`, '');
    if (adminPinRaw === null) return;
    const adminPin = normalizePasswordInput(adminPinRaw);
    if (!isPasswordValid(adminPin)) {
        alert(t('authPinRules'));
        return;
    }

    const sameAsUserPassword = await verifyUserPassword(target, adminPin);
    if (sameAsUserPassword) {
        alert(t('authAdminPinMustDiffer'));
        return;
    }

    try {
        target.adminPasswordHash = await hashPassword(adminPin);
        delete target.adminPin;
        target.updatedAt = new Date().toISOString();
        appMeta.authUsers = users;
        await saveAuthUsersWithFeedback(`Admin password reset for ${target.name || 'user'}.`);
    } catch (error) {
        alert(error.message || 'Unable to reset admin password.');
    }
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
    const drinksKey = GLOBAL_DRINKS_KEY;
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
    const hasPassword = Boolean(String(target.passwordHash || target.pin || target.adminPin || '').trim());

    alert(
        `Employer: ${target.name || 'User'}\n` +
        `Role: ${normalizeUserRoleLabel(target.role)}\n` +
        `Status: ${isUserAccountActive(target) ? 'Active' : 'Inactive'}\n\n` +
        `Password set: ${hasPassword ? 'Yes' : 'No'}\n` +
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
        hasPassword: Boolean(String(user.passwordHash || user.pin || user.adminPin || '').trim())
    }));
}

async function exportAdminUsersPDF() {
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

        await ensurePDFLibrariesReady();
        const doc = createPDFDocument({ orientation: 'portrait', unit: 'mm', format: 'a5' });
        const reportTitle = 'Admin Accounts';
        let y = applyPdfBrandHeader(doc, reportTitle);
        const margin = 10;
        const activeCount = rows.filter((row) => row.status === 'Active').length;
        const privilegedCount = rows.filter((row) => row.role === 'Owner' || row.role === 'Admin').length;
        const clip = (value, maxLength = 20) => {
            const text = String(value || '-').trim() || '-';
            return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}...` : text;
        };

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(12, 96, 156);
        doc.text('Account Summary', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total: ${rows.length}`, margin, y);
        doc.text(`Privileged: ${privilegedCount}`, margin + 36, y);
        doc.text(`Active: ${activeCount}`, margin + 72, y);
        y += 4.5;
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
        y += 4.5;

        const tableBody = rows.map((row) => [
            clip(row.name, 16),
            clip(row.phone || '-', 14),
            clip(row.role, 10),
            clip(row.status, 10),
            clip(row.lastLoginAt, 16)
        ]);

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                head: [['Name', 'Phone', 'Role', 'Status', 'Last Login']],
                body: tableBody,
                theme: 'striped',
                styles: { fontSize: 7.2, cellPadding: 1.4, overflow: 'linebreak' },
                headStyles: { fillColor: [13, 124, 227], textColor: 255, fontSize: 7.4 },
                alternateRowStyles: { fillColor: [245, 250, 255] },
                margin: { left: margin, right: margin },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 24 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 16 },
                    4: { cellWidth: 'auto' }
                }
            });
        } else {
            doc.setFontSize(7.2);
            tableBody.slice(0, 28).forEach((row, rowIndex) => {
                const yy = y + (rowIndex * 4.2);
                doc.text(`${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]}`, margin, yy);
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

function resetVisiblePagePosition(pageElement = null) {
    const pageContainer = document.querySelector('.page-container');
    const targetPage = pageElement && pageElement.nodeType === 1 ? pageElement : null;

    if (pageContainer) {
        pageContainer.scrollTop = 0;
    }
    if (document.body) {
        document.body.scrollTop = 0;
    }
    if (document.documentElement) {
        document.documentElement.scrollTop = 0;
    }
    if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
    }
    if (targetPage && typeof targetPage.scrollIntoView === 'function') {
        targetPage.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
}

function showPage(pageName) {
    refreshAdminAccessUI();
    const adminSession = isAdminSessionActive();
    const adminVisiblePages = new Set(['home', 'reports', 'adminSales', 'adminAccounts', 'adminHub', 'settings', 'stockManagement', 'customers', 'salesHistory']);
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
    syncSidebarUtilityButtons();
    enforceSidebarIconState();

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
    resetVisiblePagePosition(page);
    requestAnimationFrame(() => {
        resetVisiblePagePosition(page);
    });
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
    pdfBtn.textContent = t('exportPdf');
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
        <strong>${escapeHtml(localizeLooseText('Stock Warning:'))}</strong>
        ${escapeHtml(localizeLooseText(`${outOfStockCount} out of stock, ${lowCount} low stock.`))}
        <span>${preview}${remaining}</span>
        <button class="stock-action-btn" style="margin-left: 8px;" onclick="showPage('stockManagement')">${escapeHtml(localizeLooseText('Open Stock Management'))}</button>
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

async function getPersistedDrinksSnapshot() {
    const inMemory = normalizeDrinksList(drinks);
    const globalStored = normalizeDrinksList(await loadNamedData(GLOBAL_DRINKS_KEY, inMemory));
    const scopedKey = activeUser ? userDataKey('drinks', activeUser) : '';
    const scopedStored = scopedKey ? normalizeDrinksList(await loadNamedData(scopedKey, [])) : [];

    const merged = [];
    const byName = new Map();
    const mergeSources = [globalStored, scopedStored, inMemory];

    mergeSources.forEach((sourceList) => {
        sourceList.forEach((drink) => {
            const nameKey = String(drink?.name || '').trim().toLowerCase();
            if (!nameKey) return;
            if (byName.has(nameKey)) {
                merged[byName.get(nameKey)] = drink;
                return;
            }
            byName.set(nameKey, merged.length);
            merged.push(drink);
        });
    });

    return merged;
}

function getLowStockDrinksFromList(drinksList) {
    return drinksList.filter((drink) => getDrinkStockStatus(drink) !== 'ok');
}

async function exportStockManagementPDF() {
    try {
        await optimizedSaveData();
        await waitForPendingSave();
        await ensurePDFLibrariesReady();
        const exportDrinks = await getPersistedDrinksSnapshot();
        if (!exportDrinks.length) {
            alert('No stock data to export.');
            return;
        }

        const doc = createPDFDocument({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const reportTitle = 'Stock Management Report';
        let y = applyPdfBrandHeader(doc, reportTitle);
        const margin = 14;

        const lowStock = getLowStockDrinksFromList(exportDrinks);
        const outOfStock = lowStock.filter((drink) => getDrinkStockStatus(drink) === 'out');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(12, 96, 156);
        doc.text('Stock Summary', margin, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Drinks: ${exportDrinks.length}`, margin, y);
        doc.text(`Low Stock: ${lowStock.filter((drink) => getDrinkStockStatus(drink) === 'low').length}`, margin + 58, y);
        doc.text(`Out of Stock: ${outOfStock.length}`, margin + 108, y);
        y += 7;
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
        y += 6;

        const tableRows = exportDrinks.map((drink) => [
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
        exportDrinks.forEach((drink) => {
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
        metaEl.textContent = localizeLooseText(`RWF ${Number(drink.price || 0).toLocaleString()} | Available now: ${availableQty} case(s)`);
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
        removeBtn.textContent = localizeLooseText('Remove');
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

    const pendingTotalAmount = cart.reduce((sum, item) => {
        return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0));
    }, 0);
    const selectedCustomer = selectedCustomerId !== null ? customers[selectedCustomerId] : null;
    const selectedCustomerRef = selectedCustomer ? selectedCustomer.id : null;
    const creditPromiseDate = readCustomerPromiseDateTimeInputs('creditPromiseDate', 'creditPromiseTime');

    if (currentSaleType === 'credit' && selectedCustomer) {
        const errorMessage = getCustomerDebtRaiseError(selectedCustomer, pendingTotalAmount);
        if (errorMessage) {
            alert(errorMessage);
            return;
        }
        if (shouldUsePromiseDate(selectedCustomer) && !creditPromiseDate && !getCustomerPromiseDate(selectedCustomer)) {
            alert(`Select the payback date and time ${selectedCustomer.name} promised to pay.`);
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
            unitPrice: item.price,
            profitPerCase: Number(item.profitPerCase || getDrinkProfitPerCaseByName(item.drinkName)),
            total: itemTotal,
            type: currentSaleType,
            customerId: currentSaleType === 'credit' ? selectedCustomerRef : null,
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
        if (creditPromiseDate) {
            customers[selectedCustomerId].promisedPaybackDate = creditPromiseDate;
        }
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
    const creditCustomerSearch = document.getElementById('creditCustomerSearch');
    if (creditCustomerSearch) creditCustomerSearch.value = '';
    writeCustomerPromiseDateTimeInputs('creditPromiseDate', 'creditPromiseTime', '');
    creditCustomerSearchTerm = '';
    selectedCustomerId = null;
    currentSaleType = 'normal';
    resetQuickDrinkSelection();
    updateCartDisplay();
    updateQuickDrinkSelect();
    updateDrinkList();
    renderStockManagement();
    updateHome();
    syncCreditPromiseDateVisibility();
    refreshAiAssistantInsights(true);

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

async function saveNewDrink() {
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
    const isNewDrink = existingIndex < 0;
    const stockFallback = isNewDrink ? getDefaultNewDrinkStockQty() : getDrinkStockQty(existingDrink);
    const finalStockQty = rawStockValue === ''
        ? stockFallback
        : normalizeStockValue(parsedStockValue, stockFallback);
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
    
    await optimizedSaveData();
    
    // Save drinks globally for all users so the menu is shared across accounts
    await saveGlobalDrink(isNewDrink ? drinks[drinks.length - 1] : drinks[existingIndex]);
    
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
    const searchInput = document.getElementById('creditCustomerSearch');
    if (container) {
        container.style.display = type === 'credit' ? 'block' : 'none';
    }
    
    if (type === 'credit') {
        creditCustomerSearchTerm = String(searchInput?.value || '').trim();
        updateCustomerDropdown();
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 0);
        }
    } else {
        selectedCustomerId = null;
        creditCustomerSearchTerm = '';
        if (searchInput) searchInput.value = '';
        updateCustomerDropdown();
    }
    syncCreditPromiseDateVisibility();
}

function filterCreditSaleCustomers(value = '') {
    creditCustomerSearchTerm = String(value || '').trim();
    updateCustomerDropdown();
}

function clearCreditCustomerSearch() {
    creditCustomerSearchTerm = '';
    const input = document.getElementById('creditCustomerSearch');
    if (input) input.value = '';
    updateCustomerDropdown();
    if (input) input.focus();
}

function getCreditCustomerSearchEntries(searchTerm = '') {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
    const list = (Array.isArray(customers) ? customers : [])
        .map((customer, index) => ({ customer, index }))
        .filter(({ customer }) => customer && typeof customer === 'object');

    list.sort((a, b) => {
        const loyalDiff = Number(isLoyalCustomer(b.customer)) - Number(isLoyalCustomer(a.customer));
        if (loyalDiff !== 0) return loyalDiff;
        return String(a.customer?.name || '').localeCompare(String(b.customer?.name || ''));
    });

    return list.filter(({ customer }) => {
        if (!normalizedSearch) return true;
        const searchText = [
            customer?.name,
            customer?.phone,
            customer?.location,
            customer?.notes,
            normalizeCustomerType(customer?.type)
        ]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');
        return searchText.includes(normalizedSearch);
    });
}

function formatCreditCustomerOptionLabel(customer, options = {}) {
    if (!customer || typeof customer !== 'object') return localizeLooseText('Unknown customer');
    const keepSelectedHint = Boolean(options?.keepSelectedHint);
    const customerName = String(customer.name || '').trim() || localizeLooseText('Unknown customer');
    const customerOwing = Number(customer.owing) || 0;
    const owingLabel = customerOwing > 0 ? `(Owes: RWF ${customerOwing.toLocaleString()})` : '';
    const promiseDate = getCustomerPromiseDate(customer);
    const promiseLabel = promiseDate
        ? (isCustomerDebtOverdue(customer)
            ? ` | Overdue since ${formatCustomerPromiseDate(promiseDate)}`
            : ` | Promise ${formatCustomerPromiseDate(promiseDate)}`)
        : '';
    const selectedHint = keepSelectedHint ? ' | Selected' : '';
    return `${customerName} ${owingLabel}${promiseLabel}${selectedHint}`;
}

function renderCreditCustomerResults(filteredCustomers) {
    const resultsEl = document.getElementById('creditCustomerResults');
    if (!resultsEl) return;

    const limitedResults = filteredCustomers.slice(0, 80);
    if (!limitedResults.length) {
        const emptyText = creditCustomerSearchTerm
            ? localizeLooseText('No matching customers found.')
            : localizeLooseText('No customers available.');
        resultsEl.innerHTML = `<div class="credit-customer-empty">${escapeHtml(emptyText)}</div>`;
        return;
    }

    resultsEl.innerHTML = limitedResults.map(({ customer, index }) => {
        const isSelected = selectedCustomerId === index;
        const customerName = String(customer?.name || '').trim() || localizeLooseText('Unknown customer');
        const phone = String(customer?.phone || '').trim() || localizeLooseText('No phone');
        const location = String(customer?.location || '').trim() || localizeLooseText('No location');
        const typeLabel = isLoyalCustomer(customer) ? localizeLooseText('Loyal') : localizeLooseText('Regular');
        const debt = Number(customer?.owing) || 0;
        const debtText = debt > 0 ? `RWF ${debt.toLocaleString()}` : localizeLooseText('Cleared');
        const promiseDate = getCustomerPromiseDate(customer);
        const promiseText = promiseDate ? formatCustomerPromiseDate(promiseDate) : '';
        const promiseBadge = promiseText
            ? `<span class="credit-customer-promise ${isCustomerDebtOverdue(customer) ? 'overdue' : ''}">${escapeHtml(localizeLooseText('Payback'))}: ${escapeHtml(promiseText)}</span>`
            : '';

        return `
            <button type="button" class="credit-customer-result-btn ${isSelected ? 'active' : ''}" onclick="selectCreditCustomer(${index})">
                <div class="credit-customer-result-head">
                    <div class="credit-customer-result-title">${escapeHtml(customerName)}</div>
                    ${promiseBadge}
                </div>
                <div class="credit-customer-result-meta">${escapeHtml(typeLabel)} | ${escapeHtml(phone)} | ${escapeHtml(location)} | ${escapeHtml(debtText)}</div>
            </button>
        `;
    }).join('');
}

function renderSelectedCreditCustomerChip() {
    const selectedChip = document.getElementById('creditCustomerSelectedChip');
    if (!selectedChip) return;
    const selectedCustomer = Number.isInteger(selectedCustomerId) ? customers[selectedCustomerId] : null;

    if (!selectedCustomer) {
        selectedChip.textContent = localizeLooseText('No customer selected.');
        return;
    }

    const customerName = String(selectedCustomer.name || '').trim() || localizeLooseText('Unknown customer');
    const debt = Number(selectedCustomer.owing) || 0;
    const debtText = debt > 0 ? `RWF ${debt.toLocaleString()}` : localizeLooseText('Cleared');
    const promiseDate = getCustomerPromiseDate(selectedCustomer);
    const promiseText = promiseDate ? ` | ${localizeLooseText('Payback')}: ${formatCustomerPromiseDate(promiseDate)}` : '';
    selectedChip.textContent = `${localizeLooseText('Selected')}: ${customerName} (${debtText})${promiseText}`;
}

function selectCreditCustomer(index) {
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || !customers[numericIndex]) return;
    selectedCustomerId = numericIndex;
    const select = document.getElementById('customerSelect');
    if (select) select.value = String(numericIndex);
    renderSelectedCreditCustomerChip();
    updateCustomerDropdown();
    syncCreditPromiseDateVisibility();
}

function handleCreditCustomerSearchKeydown(event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    const filteredCustomers = getCreditCustomerSearchEntries(creditCustomerSearchTerm);
    if (filteredCustomers.length > 0) {
        selectCreditCustomer(filteredCustomers[0].index);
    }
}

function updateCustomerDropdown() {
    const select = document.getElementById('customerSelect');
    if (!select) return;
    const searchInput = document.getElementById('creditCustomerSearch');
    
    select.innerHTML = '<option value="">Select Customer</option>';

    const customerEntries = getCreditCustomerSearchEntries('');
    const filteredCustomers = getCreditCustomerSearchEntries(creditCustomerSearchTerm);

    const selectedMissingFromFilter = (
        selectedCustomerId !== null &&
        customerEntries.some(({ index }) => index === selectedCustomerId) &&
        !filteredCustomers.some(({ index }) => index === selectedCustomerId)
    );

    if (selectedMissingFromFilter) {
        const selectedOption = document.createElement('option');
        selectedOption.value = String(selectedCustomerId);
        selectedOption.textContent = formatCreditCustomerOptionLabel(customers[selectedCustomerId], { keepSelectedHint: true });
        select.appendChild(selectedOption);
    }
    
    filteredCustomers.forEach(({ customer, index }) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = formatCreditCustomerOptionLabel(customer);
        select.appendChild(option);
    });

    if (selectedCustomerId !== null && customerEntries.some(({ index }) => index === selectedCustomerId)) {
        select.value = String(selectedCustomerId);
    } else {
        selectedCustomerId = null;
    }

    if (searchInput && searchInput.value !== creditCustomerSearchTerm) {
        searchInput.value = creditCustomerSearchTerm;
    }

    renderSelectedCreditCustomerChip();
    renderCreditCustomerResults(filteredCustomers);
    
    select.onchange = function() {
        selectedCustomerId = this.value ? parseInt(this.value, 10) : null;
        renderSelectedCreditCustomerChip();
        renderCreditCustomerResults(getCreditCustomerSearchEntries(creditCustomerSearchTerm));
        syncCreditPromiseDateVisibility();
    };
}

function syncCustomerPaybackDateVisibility() {
    const typeSelect = document.getElementById('customerType');
    const group = document.getElementById('customerPaybackDateGroup');
    const dateInput = document.getElementById('customerPaybackDate');
    const timeInput = document.getElementById('customerPaybackTime');
    if (!typeSelect || !group || !dateInput || !timeInput) return;

    group.style.display = 'block';
    setCustomerPromiseDateTimeInputsEnabled('customerPaybackDate', 'customerPaybackTime', true);
}

function syncDebtPromiseDateVisibility() {
    const group = document.getElementById('debtPromiseDateGroup');
    const dateInput = document.getElementById('debtPromiseDate');
    const timeInput = document.getElementById('debtPromiseTime');
    const customer = currentCustomerIndex === null ? null : customers[currentCustomerIndex];
    if (!group || !dateInput || !timeInput) return;

    const show = debtAction === 'add' && shouldUsePromiseDate(customer);
    group.style.display = show ? 'block' : 'none';
    setCustomerPromiseDateTimeInputsEnabled('debtPromiseDate', 'debtPromiseTime', show);
    if (show) {
        writeCustomerPromiseDateTimeInputs('debtPromiseDate', 'debtPromiseTime', customer?.promisedPaybackDate);
    } else {
        writeCustomerPromiseDateTimeInputs('debtPromiseDate', 'debtPromiseTime', '');
    }
}

function syncCreditPromiseDateVisibility() {
    const container = document.getElementById('creditPromiseDateContainer');
    const dateInput = document.getElementById('creditPromiseDate');
    const timeInput = document.getElementById('creditPromiseTime');
    const customer = selectedCustomerId === null ? null : customers[selectedCustomerId];
    const show = currentSaleType === 'credit' && shouldUsePromiseDate(customer);

    if (container) {
        container.style.display = show ? 'block' : 'none';
    }
    if (dateInput || timeInput) {
        setCustomerPromiseDateTimeInputsEnabled('creditPromiseDate', 'creditPromiseTime', show);
        if (show) {
            writeCustomerPromiseDateTimeInputs('creditPromiseDate', 'creditPromiseTime', customer?.promisedPaybackDate);
        } else {
            writeCustomerPromiseDateTimeInputs('creditPromiseDate', 'creditPromiseTime', '');
        }
    }
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
    const paybackDateInput = document.getElementById('customerPaybackDate');
    const paybackTimeInput = document.getElementById('customerPaybackTime');
    
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (locationInput) locationInput.value = '';
    if (typeSelect) typeSelect.value = 'regular';
    if (notesInput) notesInput.value = '';
    if (debtInput) debtInput.value = '0';
    if (paybackDateInput) paybackDateInput.value = '';
    if (paybackTimeInput) paybackTimeInput.value = '';
    syncCustomerPaybackDateVisibility();
    
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
    
    if (title) title.textContent = localizeLooseText('Add Debt');
    if (message) message.textContent = localizeLooseText(`Add debt amount for ${customers[index].name} (RWF):`);
    if (amountInput) {
        amountInput.value = '';
        amountInput.readOnly = false;
    }
    syncDebtPromiseDateVisibility();
    
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function openReduceDebtForm(index) {
    currentCustomerIndex = index;
    debtAction = 'reduce';
    const title = document.getElementById('debtFormTitle');
    const message = document.getElementById('debtMessage');
    const amountInput = document.getElementById('debtAmount');
    
    if (title) title.textContent = localizeLooseText('Reduce Debt');
    if (message) message.textContent = localizeLooseText(`Reduce debt amount for ${customers[index].name} (RWF). Current: RWF ${customers[index].owing}`);
    if (amountInput) {
        amountInput.value = '';
        amountInput.readOnly = false;
    }
    syncDebtPromiseDateVisibility();
    
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function openClearDebtForm(index) {
    currentCustomerIndex = index;
    debtAction = 'clear';
    const title = document.getElementById('debtFormTitle');
    const message = document.getElementById('debtMessage');
    const amountInput = document.getElementById('debtAmount');
    
    if (title) title.textContent = localizeLooseText('Clear Debt');
    if (message) message.textContent = localizeLooseText(`Clear all debt for ${customers[index].name}? Current: RWF ${customers[index].owing}`);
    if (amountInput) {
        amountInput.value = customers[index].owing;
        amountInput.readOnly = true;
    }
    syncDebtPromiseDateVisibility();
    
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'block';
}

function closeDebtForm() {
    const overlay = document.getElementById('debtFormOverlay');
    if (overlay) overlay.style.display = 'none';
    const amountInput = document.getElementById('debtAmount');
    if (amountInput) amountInput.readOnly = false;
    writeCustomerPromiseDateTimeInputs('debtPromiseDate', 'debtPromiseTime', '');
    setCustomerPromiseDateTimeInputsEnabled('debtPromiseDate', 'debtPromiseTime', false);
    const promiseGroup = document.getElementById('debtPromiseDateGroup');
    if (promiseGroup) promiseGroup.style.display = 'none';
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
    const type = normalizeCustomerType(document.getElementById('customerType').value);
    const notes = document.getElementById('customerNotes').value.trim();
    const debt = parseFloat(document.getElementById('customerDebt').value) || 0;
    const promisedPaybackDate = readCustomerPromiseDateTimeInputs('customerPaybackDate', 'customerPaybackTime');
    
    if (!name) {
        alert('Please enter customer name');
        return;
    }

    if (debt < 0) {
        alert('Initial debt cannot be negative.');
        return;
    }

    const debtLimit = getCustomerDebtLimit();
    if (debtLimit > 0 && debt > debtLimit) {
        alert(getDebtLimitExceededMessage(name, debt, debtLimit));
        return;
    }

    if (type === 'loyal' && debt > 0 && !promisedPaybackDate) {
        alert(`Select the payback date and time ${name} promised to pay.`);
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
        promisedPaybackDate: debt > 0 ? promisedPaybackDate : '',
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
    
    // Immediately sync to MongoDB so all users can see the new customer
    if (activeUser) {
        const syncUserId = activeUser?.phone || activeUser?.id || activeUser;
        await syncCustomersToMongoDB(syncUserId);
    }
    
    // Save loyal customers globally for all users so loyalty data is shared
    if (type === 'loyal') {
        await saveGlobalLoyalCustomer(customer);
    }
    
    displayCustomers();
    updateHome();
    closeCustomerForm();
    
    showSuccessToast(`Customer added: ${name}`);
}

async function saveGlobalLoyalCustomer(customer) {
    const globalCustomers = await loadNamedData(GLOBAL_LOYAL_CUSTOMERS_KEY, []);
    const existingIndex = globalCustomers.findIndex(c => c.id === customer.id);
    if (existingIndex >= 0) {
        globalCustomers[existingIndex] = customer;
    } else {
        globalCustomers.push(customer);
    }
    await saveNamedData(GLOBAL_LOYAL_CUSTOMERS_KEY, globalCustomers);

    const sharedCustomers = await loadNamedData(GLOBAL_CUSTOMERS_KEY, []);
    const mergedSharedCustomers = mergeCustomerLists(sharedCustomers, [customer]);
    await saveNamedData(GLOBAL_CUSTOMERS_KEY, mergedSharedCustomers);
}

async function saveGlobalDrink(drink) {
    const globalDrinks = await loadNamedData(GLOBAL_DRINKS_KEY, []);
    const existingIndex = globalDrinks.findIndex(d => d.name.toLowerCase() === drink.name.toLowerCase());
    if (existingIndex >= 0) {
        globalDrinks[existingIndex] = drink;
    } else {
        globalDrinks.push(drink);
    }
    await saveNamedData(GLOBAL_DRINKS_KEY, globalDrinks);
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
        id: Date.now() + Math.floor(Math.random() * 1000),
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
    const promisedPaybackDate = readCustomerPromiseDateTimeInputs('debtPromiseDate', 'debtPromiseTime');
    
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
            {
                const errorMessage = getCustomerDebtRaiseError(customer, amount);
                if (errorMessage) {
                    alert(errorMessage);
                    return;
                }
                if (shouldUsePromiseDate(customer) && !promisedPaybackDate && !getCustomerPromiseDate(customer)) {
                    alert(`Select the payback date and time ${customer.name} promised to pay.`);
                    return;
                }
            }
            customer.owing = currentOwing + amount;
            if (promisedPaybackDate) {
                customer.promisedPaybackDate = promisedPaybackDate;
            }
            appendDebtHistory(customer, 'add', amount, 'Debt added manually');
            showSuccessToast(`Debt added for ${customer.name}: RWF ${amount.toLocaleString()}`);
            break;
        case 'reduce':
            {
                const reducedBy = Math.min(amount, currentOwing);
                customer.owing = Math.max(0, currentOwing - amount);
                appendDebtHistory(customer, 'reduce', -reducedBy, 'Debt reduced');
                clearCustomerPromiseDateIfSettled(customer);
                showSuccessToast(`Debt reduced for ${customer.name}: RWF ${reducedBy.toLocaleString()}`);
            }
            break;
        case 'clear':
            appendDebtHistory(customer, 'clear', -currentOwing, 'Debt cleared');
            customer.owing = 0;
            clearCustomerPromiseDateIfSettled(customer);
            showSuccessToast(`Debt cleared for ${customer.name}`);
            break;
    }
    
    await optimizedSaveData();
    displayCustomers();
    updateHome();
    closeDebtForm();
}

// ================= CUSTOMER FUNCTIONS =================
async function displayCustomers() {
    const list = document.getElementById('customerList');
    if (!list) return;
    
    clearElement(list);
    
    if (customers.length === 0) {
        list.innerHTML = '<div class="no-data">No customers yet. Add one above!</div>';
        return;
    }
    
    customers.forEach((customer, index) => {
        const item = document.createElement('div');
        item.className = `customer-item${isCustomerDebtOverdue(customer) ? ' customer-item-overdue' : ''}`;
        item.innerHTML = buildCustomerItemMarkup(customer, index, { includeDelete: true });
        list.appendChild(item);
    });
}

async function refreshCustomers() {
    if (activeUser) {
        console.log('🔄 Manually refreshing customers from MongoDB...');
        await loadCustomersFromMongoDB(activeUser.phone || activeUser);
        displayCustomers();
        showSuccessToast('Customers refreshed from database');
    }
}

function filterCustomers(type, event) {
    const list = document.getElementById('customerList');
    if (!list) return;

    const filterButtons = document.querySelectorAll('#customers .filter-buttons .filter-btn');
    if (filterButtons) {
        filterButtons.forEach((btn) => btn.classList.remove('active'));
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }
    
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
        case 'overdue':
            filtered = customers.filter((customer) => Number(customer.owing || 0) > 0 && isCustomerDebtOverdue(customer));
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
        item.className = `customer-item${isCustomerDebtOverdue(customer) ? ' customer-item-overdue' : ''}`;
        item.innerHTML = buildCustomerItemMarkup(customer, index, { includeDelete: false });
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
        item.className = `customer-item${isCustomerDebtOverdue(customer) ? ' customer-item-overdue' : ''}`;
        item.innerHTML = buildCustomerItemMarkup(customer, index, { includeDelete: false });
        list.appendChild(item);
    });
}, 300);

// ================= CUSTOMER DEBT DETAILS FUNCTIONS =================
function openCustomerDebtDetails(index) {
    currentCustomerIndex = index;
    const customer = customers[index];
    if (!customer) return;

    const modal = document.getElementById('customerDebtDetailsModal');
    const title = document.getElementById('customerDebtDetailsTitle');
    const content = document.getElementById('customerDebtDetailsContent');

    if (!modal || !title || !content) return;

    title.textContent = `Debt Details - ${customer.name}`;

    const promiseDate = getCustomerPromiseDate(customer);
    const overdue = isCustomerDebtOverdue(customer);
    const overdueLabel = overdue ? formatOverdueDurationLabel(getCustomerDebtOverdueMs(customer)) : '';

    content.innerHTML = `
        <div class="debt-details-section">
            <div class="debt-detail-row">
                <label>Current Debt:</label>
                <span class="debt-amount">${customer.owing > 0 ? `RWF ${customer.owing.toLocaleString()}` : 'Cleared'}</span>
            </div>
            <div class="debt-detail-row">
                <label>Status:</label>
                <span class="debt-status ${customer.owing > 0 ? (overdue ? 'overdue' : 'owing') : 'cleared'}">
                    ${customer.owing > 0 ? (overdue ? `Overdue ${overdueLabel}` : 'Owing') : 'Cleared'}
                </span>
            </div>
            <div class="debt-detail-row">
                <label>Promised Payment Date & Time:</label>
                <div class="promise-date-inputs">
                    <input type="date" id="editPromiseDate" value="${promiseDate ? new Date(promiseDate).toISOString().split('T')[0] : ''}">
                    <input type="time" id="editPromiseTime" step="60" value="${promiseDate ? new Date(promiseDate).toTimeString().slice(0, 5) : ''}">
                </div>
            </div>
            <div class="debt-detail-row">
                <label>Customer Type:</label>
                <select id="editCustomerType">
                    <option value="regular" ${customer.type === 'regular' ? 'selected' : ''}>Regular Customer</option>
                    <option value="loyal" ${customer.type === 'loyal' ? 'selected' : ''}>Loyal Customer</option>
                </select>
            </div>
            <div class="debt-detail-row">
                <label>Phone:</label>
                <input type="tel" id="editCustomerPhone" value="${customer.phone || ''}" placeholder="Enter phone number">
            </div>
            <div class="debt-detail-row">
                <label>Location:</label>
                <input type="text" id="editCustomerLocation" value="${customer.location || ''}" placeholder="Enter location">
            </div>
            <div class="debt-detail-row">
                <label>Notes:</label>
                <textarea id="editCustomerNotes" placeholder="Additional notes">${customer.notes || ''}</textarea>
            </div>
        </div>
        <div class="modal-actions">
            <button onclick="saveCustomerDebtDetails()" class="form-submit">Save Changes</button>
            <button onclick="closeCustomerDebtDetailsModal()" class="form-cancel">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function closeCustomerDebtDetailsModal() {
    const modal = document.getElementById('customerDebtDetailsModal');
    if (modal) modal.style.display = 'none';
}

async function saveCustomerDebtDetails() {
    const customer = customers[currentCustomerIndex];
    if (!customer) return;

    const promiseDate = document.getElementById('editPromiseDate').value;
    const promiseTime = document.getElementById('editPromiseTime').value;
    const customerType = document.getElementById('editCustomerType').value;
    const phone = document.getElementById('editCustomerPhone').value.trim();
    const location = document.getElementById('editCustomerLocation').value.trim();
    const notes = document.getElementById('editCustomerNotes').value.trim();

    // Update customer details
    customer.type = customerType;
    customer.phone = phone || undefined;
    customer.location = location || undefined;
    customer.notes = notes || undefined;

    // Update promised payment date/time
    if (promiseDate && promiseTime) {
        customer.promisedPaybackDate = new Date(`${promiseDate}T${promiseTime}`).toISOString();
    } else if (promiseDate) {
        customer.promisedPaybackDate = new Date(`${promiseDate}T00:00`).toISOString();
    } else {
        customer.promisedPaybackDate = '';
    }

    await optimizedSaveData();
    displayCustomers();
    updateHome();
    closeCustomerDebtDetailsModal();
    showSuccessToast(`Customer details updated for ${customer.name}`);
}

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
let dashboardChartResizeTimer = null;
let dashboardChartResizeBound = false;

function getDashboardGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return localizeLooseText('Good Morning');
    if (hour < 18) return localizeLooseText('Good Afternoon');
    return localizeLooseText('Good Evening');
}

function getDashboardDateLabel(date = new Date()) {
    return new Intl.DateTimeFormat(getClockLocale(), {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function formatDashboardCompactValue(value) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
    return String(Math.round(amount));
}

function bindDashboardChartResize() {
    if (dashboardChartResizeBound) return;
    window.addEventListener('resize', () => {
        clearTimeout(dashboardChartResizeTimer);
        dashboardChartResizeTimer = setTimeout(() => {
            renderHomeSalesChart();
        }, 120);
    });
    dashboardChartResizeBound = true;
}

function getCurrentMonthChartSeries() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const revenue = Array(daysInMonth).fill(0);
    const profit = Array(daysInMonth).fill(0);
    const allowProfit = canViewProfitData();

    getEffectiveSalesList().forEach((sale) => {
        const dt = getSaleDateTimeOrNull(sale);
        if (!dt || dt.getFullYear() !== year || dt.getMonth() !== month) return;
        const index = dt.getDate() - 1;
        revenue[index] += Number(sale.total) || 0;
        if (allowProfit) {
            profit[index] += calculateProfitFromSales([sale]);
        }
    });

    const combinedValues = allowProfit ? revenue.concat(profit) : revenue.slice();
    const maxValue = Math.max(1, ...combinedValues);
    return { year, month, daysInMonth, revenue, profit, maxValue, allowProfit };
}

function drawDashboardBars(ctx, x, y, width, height, color) {
    if (height <= 0 || width <= 0) return;
    const radius = Math.min(8, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function renderHomeSalesChart(hoverDayIndex = -1) {
    const canvas = document.getElementById('homeSalesChart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const width = Math.round(wrap.clientWidth || canvas.clientWidth || 0);
    if (!width) return;

    const height = 320;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const chart = getCurrentMonthChartSeries();
    const { revenue, profit, daysInMonth, maxValue, allowProfit } = chart;
    const top = 24;
    const right = 16;
    const bottom = 40;
    const left = 58;
    const plotWidth = Math.max(10, width - left - right);
    const plotHeight = Math.max(10, height - top - bottom);
    const maxTicks = 4;
    const hasActivity = revenue.some((value) => value > 0) || (allowProfit && profit.some((value) => value > 0));
    const previousHoverIndex = Number(canvas._chartData?.hoverDayIndex);
    const requestedHoverIndex = Number(hoverDayIndex);
    const activeHoverDayIndex = Number.isInteger(requestedHoverIndex)
        ? requestedHoverIndex
        : (Number.isInteger(previousHoverIndex) ? previousHoverIndex : -1);
    const normalizedHoverDayIndex = (activeHoverDayIndex >= 0 && activeHoverDayIndex < daysInMonth)
        ? activeHoverDayIndex
        : -1;

    // Store chart data for interactivity
    canvas._chartData = {
        revenue,
        profit,
        daysInMonth,
        maxValue,
        allowProfit,
        top,
        right,
        bottom,
        left,
        plotWidth,
        plotHeight,
        width,
        height,
        hoverDayIndex: normalizedHoverDayIndex
    };

    ctx.strokeStyle = '#e5ebf4';
    ctx.fillStyle = '#7287a1';
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let tick = 0; tick <= maxTicks; tick += 1) {
        const value = (maxValue / maxTicks) * (maxTicks - tick);
        const y = top + (plotHeight / maxTicks) * tick;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();
        ctx.fillText(formatDashboardCompactValue(value), left - 10, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = daysInMonth > 10 ? Math.ceil(daysInMonth / 8) : 1;
    for (let day = 1; day <= daysInMonth; day += 1) {
        if (day !== 1 && day !== daysInMonth && (day - 1) % step !== 0) continue;
        const x = left + ((day - 0.5) / daysInMonth) * plotWidth;
        ctx.fillText(String(day), x, height - bottom + 14);
    }

    if (!hasActivity) {
        ctx.fillStyle = '#8aa0ba';
        ctx.font = '600 15px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No sales recorded this month yet.', left + (plotWidth / 2), top + (plotHeight / 2));
        return;
    }

    const barGroupWidth = plotWidth / daysInMonth;
    const singleBarWidth = allowProfit
        ? Math.max(4, Math.min(10, barGroupWidth * 0.34))
        : Math.max(5, Math.min(14, barGroupWidth * 0.52));
    const revenueColor = '#132b4d';
    const profitColor = '#ff9f1a';

    if (normalizedHoverDayIndex >= 0) {
        const hoverX = left + normalizedHoverDayIndex * barGroupWidth;
        ctx.fillStyle = 'rgba(19, 43, 77, 0.07)';
        ctx.fillRect(hoverX + (barGroupWidth * 0.1), top, barGroupWidth * 0.8, plotHeight);
    }

    for (let index = 0; index < daysInMonth; index += 1) {
        const groupX = left + index * barGroupWidth;
        const revenueHeight = (revenue[index] / maxValue) * plotHeight;
        const isHovered = index === normalizedHoverDayIndex;
        const revenueBarHeight = isHovered ? Math.min(plotHeight, revenueHeight + 3) : revenueHeight;
        const revenueBarColor = isHovered ? '#1d4f86' : revenueColor;
        if (allowProfit) {
            const revenueX = groupX + (barGroupWidth * 0.5) - singleBarWidth - 1;
            const profitX = groupX + (barGroupWidth * 0.5) + 1;
            const profitHeight = (profit[index] / maxValue) * plotHeight;
            const profitBarHeight = isHovered ? Math.min(plotHeight, profitHeight + 3) : profitHeight;
            const profitBarColor = isHovered ? '#ffb545' : profitColor;
            drawDashboardBars(ctx, revenueX, top + plotHeight - revenueBarHeight, singleBarWidth, revenueBarHeight, revenueBarColor);
            drawDashboardBars(ctx, profitX, top + plotHeight - profitBarHeight, singleBarWidth, profitBarHeight, profitBarColor);
        } else {
            const revenueX = groupX + (barGroupWidth * 0.5) - (singleBarWidth / 2);
            drawDashboardBars(ctx, revenueX, top + plotHeight - revenueBarHeight, singleBarWidth, revenueBarHeight, revenueBarColor);
        }
    }

    // Add interactivity
    canvas.style.transition = '';
    canvas.style.boxShadow = '';
    canvas.style.transform = '';
    canvas.style.filter = '';
    canvas.onmousemove = handleHomeSalesChartMouseMove;
    canvas.onmouseout = handleHomeSalesChartMouseOut;
    canvas.onclick = handleHomeSalesChartClick;
}

function handleHomeSalesChartMouseMove(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const data = canvas._chartData;
    if (!data) return;

    const { revenue, profit, daysInMonth, maxValue, allowProfit, top, right, bottom, left, plotWidth, plotHeight, width, height } = data;

    // Check if mouse is in plot area
    if (x < left || x > width - right || y < top || y > height - bottom) {
        hideHomeSalesChartTooltip();
        canvas.style.cursor = 'default';
        if (Number(data.hoverDayIndex) !== -1) {
            renderHomeSalesChart(-1);
        }
        return;
    }

    // Find which day
    const barGroupWidth = plotWidth / daysInMonth;
    const dayIndex = Math.floor((x - left) / barGroupWidth);
    if (dayIndex < 0 || dayIndex >= daysInMonth) {
        hideHomeSalesChartTooltip();
        canvas.style.cursor = 'default';
        if (Number(data.hoverDayIndex) !== -1) {
            renderHomeSalesChart(-1);
        }
        return;
    }
    canvas.style.cursor = 'pointer';
    if (Number(data.hoverDayIndex) !== dayIndex) {
        renderHomeSalesChart(dayIndex);
    }

    const day = dayIndex + 1;
    const rev = revenue[dayIndex] || 0;
    const prof = allowProfit ? (profit[dayIndex] || 0) : 0;

    let tooltipText = `Day ${day}: RWF ${rev.toLocaleString()}`;
    if (allowProfit && prof > 0) {
        tooltipText += ` | Profit: RWF ${prof.toLocaleString()}`;
    }

    showHomeSalesChartTooltip(tooltipText, event.clientX, event.clientY);
}

function handleHomeSalesChartMouseOut() {
    hideHomeSalesChartTooltip();
    const canvas = document.getElementById('homeSalesChart');
    if (canvas && canvas._chartData) {
        const activeHover = Number(canvas._chartData.hoverDayIndex);
        if (activeHover >= 0) {
            renderHomeSalesChart(-1);
        }
        canvas.style.cursor = 'default';
    }
}

function handleHomeSalesChartClick(event) {
    const canvas = event.target;
    if (!canvas || !canvas._chartData) return;
    const currentHover = Number(canvas._chartData.hoverDayIndex);
    if (currentHover >= 0) {
        renderHomeSalesChart(currentHover);
    }
}

function showHomeSalesChartTooltip(text, clientX, clientY) {
    const tooltip = document.getElementById('homeSalesChartTooltip');
    if (!tooltip) return;
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';

    const wrap = tooltip.parentElement;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    let left = clientX - rect.left;
    let top = clientY - rect.top - 10;

    // Adjust position to stay within bounds
    const tooltipRect = tooltip.getBoundingClientRect();
    if (left + tooltip.offsetWidth > wrap.clientWidth) {
        left = wrap.clientWidth - tooltip.offsetWidth - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = clientY - rect.top + 10;
    if (top + tooltip.offsetHeight > wrap.clientHeight) {
        top = wrap.clientHeight - tooltip.offsetHeight - 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function hideHomeSalesChartTooltip() {
    const tooltip = document.getElementById('homeSalesChartTooltip');
    if (tooltip) tooltip.style.display = 'none';
}

function renderDashboardLowStockList(lowStockItems = []) {
    const list = document.getElementById('dashboardLowStockList');
    if (!list) return;

    const alerts = Array.isArray(lowStockItems)
        ? lowStockItems.slice().sort((a, b) => getDrinkStockQty(a) - getDrinkStockQty(b)).slice(0, 4)
        : [];

    if (!alerts.length) {
        list.innerHTML = '<div class="dashboard-alert-empty">All stock levels look healthy right now.</div>';
        return;
    }

    list.innerHTML = alerts.map((drink) => {
        const status = getDrinkStockStatus(drink);
        const qty = getDrinkStockQty(drink);
        const threshold = getDrinkLowStockThreshold(drink);
        return `
            <div class="dashboard-alert-item">
                <div class="dashboard-alert-copy">
                    <strong>${escapeHtml(drink.name || localizeLooseText('Unnamed Drink'))}</strong>
                    <span>${status === 'out' ? localizeLooseText('Out of stock') : localizeLooseText('Low stock alert')}</span>
                </div>
                <div class="dashboard-alert-meta">
                    <strong>${localizeLooseText(`${qty} case(s)`)}</strong>
                    <span>${localizeLooseText(`min: ${threshold}`)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateHomeDashboardChrome(todaySalesList = [], lowStockItems = [], customerDebtCount = 0) {
    const adminSession = isAdminSessionActive();
    const showProfit = adminSession && canViewProfitData();
    const greetingEl = document.getElementById('dashboardGreeting');
    const dateEl = document.getElementById('dashboardDate');
    const eyebrowEl = document.getElementById('homeDashboardEyebrow');
    const secondaryLabelEl = document.getElementById('homeSecondaryMetricLabel');
    const secondaryValueEl = document.getElementById('homeSecondaryMetricValue');
    const secondaryMetaEl = document.getElementById('homeSecondaryMetricMeta');
    const profitValueEl = document.getElementById('todayProfit');
    const profitLegendEl = document.getElementById('dashboardProfitLegend');
    const salesIcon = document.querySelector('.metric-icon-sales');
    const profitIcon = document.querySelector('.metric-icon-profit');
    const revenueMetaEl = document.getElementById('homeRevenueMeta');
    const lowStockMetaEl = document.getElementById('homeLowStockMeta');
    const creditMetaEl = document.getElementById('homeCreditMetricMeta');
    const lowStockCountEl = document.getElementById('homeLowStockCount');

    if (greetingEl) greetingEl.textContent = getDashboardGreeting();
    if (dateEl) dateEl.textContent = getDashboardDateLabel();
    if (eyebrowEl) eyebrowEl.textContent = adminSession ? localizeLooseText('Admin Dashboard') : localizeLooseText('Dashboard');
    if (revenueMetaEl) {
        const label = todaySalesList.length === 1 ? 'sale' : 'sales';
        revenueMetaEl.textContent = localizeLooseText(`${todaySalesList.length} ${label}`);
    }
    if (lowStockCountEl) lowStockCountEl.textContent = String(lowStockItems.length);
    if (lowStockMetaEl) {
        const outCount = lowStockItems.filter((drink) => getDrinkStockStatus(drink) === 'out').length;
        lowStockMetaEl.textContent = outCount > 0
            ? localizeLooseText(`${outCount} out of stock`)
            : localizeLooseText('Need restocking');
    }
    if (creditMetaEl) {
        creditMetaEl.textContent = localizeLooseText(`${customerDebtCount} customer${customerDebtCount === 1 ? '' : 's'}`);
    }

    if (secondaryLabelEl) {
        secondaryLabelEl.textContent = showProfit ? localizeLooseText("Today's Profit") : localizeLooseText("Today's Sales");
    }
    if (secondaryMetaEl) {
        secondaryMetaEl.textContent = showProfit ? localizeLooseText('Net earnings') : localizeLooseText('Transactions');
    }
    if (secondaryValueEl) {
        secondaryValueEl.textContent = String(todaySalesList.length);
        secondaryValueEl.style.display = showProfit ? 'none' : 'block';
    }
    if (profitValueEl) {
        profitValueEl.style.display = showProfit ? 'block' : 'none';
    }
    if (profitLegendEl) {
        profitLegendEl.style.display = showProfit ? 'inline-flex' : 'none';
    }
    if (salesIcon) {
        salesIcon.style.display = showProfit ? 'none' : 'block';
    }
    if (profitIcon) {
        profitIcon.style.display = showProfit ? 'block' : 'none';
    }
}

function openDashboardInventory() {
    showPage('stockManagement');
}

function updateHome() {
    updateHomeDashboard();
}

function updateHomeDashboard() {
    const allowProfit = canViewProfitData();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySales = getEffectiveSalesList().filter((sale) => {
        const saleDate = new Date(sale.date);
        return saleDate >= today;
    });

    const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const todaySalesElement = document.getElementById('todaySales');
    if (todaySalesElement) {
        todaySalesElement.textContent = `RWF ${todayTotal.toLocaleString()}`;
    }

    const todayProfitElement = document.getElementById('todayProfit');
    if (todayProfitElement) {
        const todayProfit = allowProfit ? calculateProfitFromSales(todaySales) : 0;
        todayProfitElement.textContent = `RWF ${todayProfit.toLocaleString()}`;
    }

    const customersInDebt = customers.filter((customer) => Number(customer.owing) > 0);
    const totalDebt = customersInDebt.reduce((sum, customer) => sum + (customer.owing || 0), 0);
    const customersOwingElement = document.getElementById('customersOwing');
    if (customersOwingElement) {
        customersOwingElement.textContent = `RWF ${totalDebt.toLocaleString()}`;
    }

    const pendingDeposits = clates
        .filter((clate) => !clate.returned)
        .reduce((sum, clate) => sum + (clate.amount || 0), 0);

    const clatesPendingElement = document.getElementById('clatesPending');
    if (clatesPendingElement) {
        clatesPendingElement.textContent = `RWF ${pendingDeposits.toLocaleString()}`;
    }

    const lowStockItems = getLowStockDrinks();
    updateHomeDashboardChrome(todaySales, lowStockItems, customersInDebt.length);
    renderDashboardLowStockList(lowStockItems);
    bindDashboardChartResize();
    renderHomeSalesChart();
    renderHomeStockWarning();
    void renderHomeDebtNotifications();
    refreshAiAssistantInsights();
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
    const dailySales = getEffectiveSalesList().filter((sale) => {
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
    return getEffectiveSalesList().filter((sale) => {
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

async function exportCustomRangePDF() {
    const allowProfit = canViewProfitData();
    const selection = getValidatedRangeSelection(true);
    if (!selection) return;

    const rangeSales = getSalesForRange(selection.startDate, selection.endDate);
    if (rangeSales.length === 0) {
        alert(t('rangeNoSales'));
        return;
    }

    try {
        await ensurePDFLibrariesReady();
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
    
    const weeklySales = getEffectiveSalesList().filter(sale => {
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
    
    const monthlySales = getEffectiveSalesList().filter(sale => {
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
    
    const annualSales = getEffectiveSalesList().filter(sale => {
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
    const effectiveSales = getEffectiveSalesList();
    const totalSales = effectiveSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = allowProfit ? calculateProfitFromSales(effectiveSales) : 0;
    const totalCustomers = customers.length;
    const totalDebt = customers.reduce((sum, customer) => sum + (customer.owing || 0), 0);
    const totalDeposits = clates.filter(c => !c.returned).reduce((sum, c) => sum + (c.amount || 0), 0);
    
    // Top drinks
    const drinkSales = {};
    effectiveSales.forEach(sale => {
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
async function exportReportToPDF(reportType = 'full') {
    try {
        await ensurePDFLibrariesReady();
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
async function exportDebtSummaryPDF() {
    try {
        // Filter customers with debt
        const customersWithDebt = customers.filter(c => c.owing > 0);
        
        if (customersWithDebt.length === 0) {
            alert('No customers with outstanding debt.');
            return;
        }
        
        await ensurePDFLibrariesReady();
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
async function exportCustomerDebtPDF(index) {
    try {
        if (!customers[index]) {
            alert('Customer not found');
            return;
        }

        const customer = customers[index];

        // Gather credit sales tied to this customer
        const salesRecords = sales.filter((sale) => sale.type === 'credit' && isSaleLinkedToCustomer(sale, customer, index));

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

        await ensurePDFLibrariesReady();
        const doc = createPDFDocument({ orientation: "portrait", unit: "mm", format: "a4" });
        const reportTitle = 'Customer Debt Report';
        
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - (margin * 2);
        let y = applyPdfBrandHeader(doc, reportTitle);

        y = drawPdfTitleBlock(doc, y, margin, 'Customer Debt Report', [
            `Customer: ${customer.name || 'N/A'}`,
            `Generated: ${new Date().toLocaleString()}`,
            getCustomerPromiseDate(customer)
                ? `Promised payback: ${formatCustomerPromiseDate(getCustomerPromiseDate(customer))}${isCustomerDebtOverdue(customer) ? ' (OVERDUE)' : ''}`
                : 'Promised payback: Not set'
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

        const promiseDate = getCustomerPromiseDate(customer);
        const promiseStatus = promiseDate
            ? `${formatCustomerPromiseDate(promiseDate)}${isCustomerDebtOverdue(customer) ? ' | OVERDUE' : ''}`
            : 'Not set';
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(90, 90, 90);
        doc.text(`Promised payback: ${promiseStatus}`, margin + 10, y + 28);

        y += 40;

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

    const dailySales = getEffectiveSalesList().filter(sale => {
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
    
    const weeklySales = getEffectiveSalesList().filter(sale => {
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
    
    const monthlySales = getEffectiveSalesList().filter(sale => {
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
    
    // LOYAL CUSTOMERS
    const loyalCustomers = customers.filter(c => isLoyalCustomer(c));
    if (loyalCustomers.length > 0) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('LOYAL CUSTOMERS', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Purchases', margin + 100, yPos);
        doc.text('Spent', margin + 140, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        // Calculate for monthly
        const loyalStats = loyalCustomers.map(customer => {
            const customerSales = monthlySales.filter(s => s.customerId === customer.id);
            const totalPurchases = customerSales.length;
            const totalSpent = customerSales.reduce((sum, s) => sum + (s.total || 0), 0);
            return { name: customer.name, purchases: totalPurchases, spent: totalSpent };
        }).filter(stat => stat.purchases > 0).sort((a, b) => b.spent - a.spent).slice(0, 10);
        
        loyalStats.forEach((stat, idx) => {
            if (yPos > pageHeight - 15) {
                doc.addPage();
                yPos = 20;
            }
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
            }
            doc.text(stat.name, margin + 3, yPos);
            doc.text(stat.purchases.toString(), margin + 100, yPos);
            doc.text(`RWF ${stat.spent.toLocaleString()}`, margin + 140, yPos);
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
    
    const annualSales = getEffectiveSalesList().filter(sale => {
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
    
    // LOYAL CUSTOMERS
    const loyalCustomers = customers.filter(c => isLoyalCustomer(c));
    if (loyalCustomers.length > 0) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('LOYAL CUSTOMERS', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Purchases', margin + 100, yPos);
        doc.text('Spent', margin + 140, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        // Calculate for annual
        const loyalStats = loyalCustomers.map(customer => {
            const customerSales = annualSales.filter(s => s.customerId === customer.id);
            const totalPurchases = customerSales.length;
            const totalSpent = customerSales.reduce((sum, s) => sum + (s.total || 0), 0);
            return { name: customer.name, purchases: totalPurchases, spent: totalSpent };
        }).filter(stat => stat.purchases > 0).sort((a, b) => b.spent - a.spent).slice(0, 12);
        
        loyalStats.forEach((stat, idx) => {
            if (yPos > pageHeight - 15) {
                doc.addPage();
                yPos = 20;
            }
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
            }
            doc.text(stat.name, margin + 3, yPos);
            doc.text(stat.purchases.toString(), margin + 100, yPos);
            doc.text(`RWF ${stat.spent.toLocaleString()}`, margin + 140, yPos);
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

function exportFullPDF(doc, startY, margin) {
    const allowProfit = canViewProfitData();
    const effectiveSales = getEffectiveSalesList();
    const totalSales = effectiveSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = allowProfit ? calculateProfitFromSales(effectiveSales) : 0;
    const totalCustomers = customers.length;
    const totalDebt = customers.reduce((sum, c) => sum + (c.owing || 0), 0);
    const cashSales = effectiveSales.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.total || 0), 0);
    const creditSales = effectiveSales.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.total || 0), 0);
    
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
    doc.text(`Records: ${effectiveSales.length} transactions`, pageWidth - margin - 70, yPos);
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
    if (effectiveSales.length > 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOP GOODS SOLD (ALL TIME)', margin, yPos);
        yPos += 7;
        
        const drinkSales = {};
        const drinkValues = {};
        effectiveSales.forEach(sale => {
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
    
    // LOYAL CUSTOMERS
    const loyalCustomers = customers.filter(c => isLoyalCustomer(c));
    if (loyalCustomers.length > 0) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('LOYAL CUSTOMERS', margin, yPos);
        yPos += 7;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(37, 117, 252);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, yPos - 5, tableWidth, 7, 'F');
        doc.text('Customer Name', margin + 3, yPos);
        doc.text('Total Purchases', margin + 100, yPos);
        doc.text('Total Spent', margin + 140, yPos);
        yPos += 8;
        
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        // Calculate purchase counts and totals for loyal customers
        const loyalStats = loyalCustomers.map(customer => {
            const customerSales = effectiveSales.filter(s => s.customerId === customer.id);
            const totalPurchases = customerSales.length;
            const totalSpent = customerSales.reduce((sum, s) => sum + (s.total || 0), 0);
            return { name: customer.name, purchases: totalPurchases, spent: totalSpent };
        }).sort((a, b) => b.spent - a.spent).slice(0, 15);
        
        loyalStats.forEach((stat, idx) => {
            if (yPos > pageHeight - 15) {
                doc.addPage();
                yPos = 20;
            }
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos - 5, tableWidth, 6, 'F');
            }
            doc.text(stat.name, margin + 3, yPos);
            doc.text(stat.purchases.toString(), margin + 100, yPos);
            doc.text(`RWF ${stat.spent.toLocaleString()}`, margin + 140, yPos);
            yPos += 7;
        });
        yPos += 5;
    }
    
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

function getSalesHistorySelectedType() {
    const actionFilter = document.getElementById('salesActionFilter');
    const selected = String(actionFilter?.value || selectedSalesHistoryType || 'all').trim().toLowerCase();
    if (selected === 'normal' || selected === 'credit' || selected === 'deposit') return selected;
    return 'all';
}

function getSalesHistoryFilteredSales() {
    const searchTerm = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
    const selectedDate = document.getElementById('salesHistoryDate')?.value || '';
    const selectedType = getSalesHistorySelectedType();
    const salesList = getEffectiveSalesList();

    return salesList.filter((sale) => {
        if (selectedType !== 'all' && sale.type !== selectedType) return false;

        if (selectedDate) {
            const { dayStart, dayEnd } = getDayRange(selectedDate);
            const saleDate = new Date(sale.date);
            if (!(saleDate >= dayStart && saleDate < dayEnd)) return false;
        }

        if (!searchTerm) return true;
        const customerName = getCustomerNameByReference(sale.customerId, 'Guest');
        return (
            (sale.drinkName && sale.drinkName.toLowerCase().includes(searchTerm)) ||
            (customerName && customerName.toLowerCase().includes(searchTerm)) ||
            (sale.date && new Date(sale.date).toLocaleDateString().toLowerCase().includes(searchTerm))
        );
    });
}

function getSalesHistoryActivityData(filteredSales = null) {
    const rows = Array.isArray(filteredSales) ? filteredSales : getSalesHistoryFilteredSales();
    const selectedType = getSalesHistorySelectedType();
    const searchTerm = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
    const selectedDate = document.getElementById('salesHistoryDate')?.value || '';

    const transactions = {};
    const sortedSales = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));
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

    const transactionList = Object.values(transactions).sort((a, b) => new Date(b.date) - new Date(a.date));

    const salesActivityEntries = transactionList.map((transaction) => {
        const saleDate = new Date(transaction.date);
        const customerName = getCustomerNameByReference(transaction.customerId, 'Guest');
        const itemsText = transaction.items.length > 1 ? `${transaction.items.length} items` : (transaction.items[0]?.drinkName || 'Unknown');
        const totalQty = transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const idsArray = transaction.ids.length > 0 ? transaction.ids : transaction.items.map((item) => item.id).filter((id) => id);
        const encodedItems = JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return {
            kind: 'sale',
            actionLabel: transaction.type === 'credit' ? 'Credit Sale' : 'Cash Sale',
            type: transaction.type,
            date: transaction.date,
            totalQty,
            customerName,
            itemsText,
            saleTypeDisplay: transaction.type === 'credit'
                ? '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>'
                : '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>',
            totalAmount: transaction.totalAmount,
            amount: transaction.totalAmount,
            firstUnitPrice: transaction.items.length > 0 ? Number(transaction.items[0].price || 0) : 0,
            idsArray,
            encodedItems,
            title: transaction.type === 'credit'
                ? `Credit sale to ${customerName} - ${itemsText} for RWF ${transaction.totalAmount.toLocaleString()}`
                : `Sold ${totalQty}x ${itemsText} for RWF ${transaction.totalAmount.toLocaleString()}`,
            meta: `${saleDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} | ${saleDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
            iconClass: transaction.type === 'credit' ? 'credit' : 'cash',
            iconSymbol: transaction.type === 'credit' ? '&#128179;' : '&#128722;'
        };
    });

    const depositEntries = (Array.isArray(clates) ? clates : [])
        .filter((entry) => {
            if (!entry) return false;
            if (selectedType !== 'all' && selectedType !== 'deposit') return false;

            const depositDate = new Date(entry.date || entry.createdAt || Date.now());
            if (Number.isNaN(depositDate.getTime())) return false;

            if (selectedDate) {
                const { dayStart, dayEnd } = getDayRange(selectedDate);
                if (!(depositDate >= dayStart && depositDate < dayEnd)) return false;
            }

            if (!searchTerm) return true;
            const amountText = Number(entry.amount || 0).toLocaleString();
            const haystack = [
                entry.customerName,
                entry.description,
                entry.returned ? 'returned' : 'pending',
                amountText,
                depositDate.toLocaleDateString()
            ].join(' ').toLowerCase();
            return haystack.includes(searchTerm);
        })
        .map((entry) => {
            const amount = Number(entry.amount || 0);
            const depositDate = new Date(entry.date || entry.createdAt || Date.now());
            const customerName = String(entry.customerName || 'Customer');
            const statusLabel = entry.returned ? 'Returned' : 'Pending';
            const description = String(entry.description || '').trim();

            return {
                kind: 'deposit',
                actionLabel: entry.returned ? 'Deposit Returned' : 'Deposit',
                date: depositDate.toISOString(),
                amount,
                customerName,
                statusLabel,
                description,
                title: entry.returned
                    ? `${customerName} marked deposit returned (RWF ${amount.toLocaleString()})`
                    : `${customerName} deposited RWF ${amount.toLocaleString()}`,
                meta: `${depositDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} | ${depositDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${description ? ` | ${description}` : ''}`,
                iconClass: 'deposit',
                iconSymbol: '&#128101;'
            };
        });

    const allActivityEntries = [...salesActivityEntries, ...depositEntries]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return { transactionList, allActivityEntries };
}

function renderSalesHistoryRowsLegacy(filteredSales) {
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
        const customerName = getCustomerNameByReference(transaction.customerId, 'Guest');
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

function renderSalesHistoryRows(filteredSales) {
    const rows = Array.isArray(filteredSales) ? filteredSales : [];
    const tbody = document.getElementById('salesHistoryBody');
    const list = document.getElementById('activityLogList');
    const countLabel = document.getElementById('salesHistoryCountLabel');
    const selectedType = getSalesHistorySelectedType();
    const searchTerm = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
    const selectedDate = document.getElementById('salesHistoryDate')?.value || '';

    if (tbody) clearElement(tbody);
    if (list) clearElement(list);

    const transactions = {};
    const sortedSales = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));
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

    const transactionList = Object.values(transactions).sort((a, b) => new Date(b.date) - new Date(a.date));

    const depositEntries = (Array.isArray(clates) ? clates : [])
        .filter((entry) => {
            if (!entry) return false;
            if (selectedType !== 'all' && selectedType !== 'deposit') return false;

            const depositDate = new Date(entry.date || entry.createdAt || Date.now());
            if (Number.isNaN(depositDate.getTime())) return false;

            if (selectedDate) {
                const { dayStart, dayEnd } = getDayRange(selectedDate);
                if (!(depositDate >= dayStart && depositDate < dayEnd)) return false;
            }

            if (!searchTerm) return true;
            const haystack = [
                entry.customerName,
                entry.description,
                entry.returned ? 'returned' : 'pending',
                depositDate.toLocaleDateString()
            ].join(' ').toLowerCase();
            return haystack.includes(searchTerm);
        })
        .map((entry) => {
            const amount = Number(entry.amount || 0);
            const depositDate = new Date(entry.date || entry.createdAt || Date.now());
            return {
                kind: 'deposit',
                date: depositDate.toISOString(),
                amount,
                title: `${entry.customerName || 'Customer'} deposited RWF ${amount.toLocaleString()}`,
                meta: `${depositDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} | ${depositDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
                iconClass: 'deposit',
                iconSymbol: '&#128101;'
            };
        });

    const salesActivityEntries = transactionList.map((transaction) => {
        const saleDate = new Date(transaction.date);
        const customerName = getCustomerNameByReference(transaction.customerId, 'Guest');
        const itemsText = transaction.items.length > 1 ? `${transaction.items.length} items` : (transaction.items[0]?.drinkName || 'Unknown');
        const totalQty = transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const idsArray = transaction.ids.length > 0 ? transaction.ids : transaction.items.map((item) => item.id).filter((id) => id);
        const encodedItems = JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return {
            kind: 'sale',
            date: transaction.date,
            totalQty,
            customerName,
            itemsText,
            saleTypeDisplay: transaction.type === 'credit'
                ? '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>'
                : '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>',
            totalAmount: transaction.totalAmount,
            firstUnitPrice: transaction.items.length > 0 ? Number(transaction.items[0].price || 0) : 0,
            idsArray,
            encodedItems,
            title: transaction.type === 'credit'
                ? `Credit sale to ${customerName} - ${itemsText} for RWF ${transaction.totalAmount.toLocaleString()}`
                : `Sold ${totalQty}x ${itemsText} for RWF ${transaction.totalAmount.toLocaleString()}`,
            meta: `${saleDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} | ${saleDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
            iconClass: transaction.type === 'credit' ? 'credit' : 'cash',
            iconSymbol: transaction.type === 'credit' ? '&#128179;' : '&#128722;'
        };
    });

    const allActivityEntries = [...salesActivityEntries, ...depositEntries]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const activityCount = allActivityEntries.length;
    if (countLabel) {
        countLabel.textContent = `${activityCount} recorded activit${activityCount === 1 ? 'y' : 'ies'}`;
    }

    if (activityCount === 0) {
        if (list) list.innerHTML = '<div class="activity-log-empty">No activity found</div>';
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">No sales found</td></tr>';
        return;
    }

    if (list) {
        allActivityEntries.forEach((entry) => {
            const amount = Number(entry.totalAmount ?? entry.amount ?? 0);
            const actionsHtml = entry.kind === 'sale'
                ? `
                    <button class="activity-log-btn" type="button" onclick="showTransactionDetails('${entry.encodedItems}')">Details</button>
                    ${entry.idsArray.length > 0 ? `<button class="activity-log-btn delete" type="button" onclick="deleteTransaction([${entry.idsArray.join(',')}])">Delete</button>` : ''}
                `
                : '';
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-log-item';
            activityItem.innerHTML = `
                <span class="activity-log-icon ${entry.iconClass}" aria-hidden="true">${entry.iconSymbol}</span>
                <div class="activity-log-main">
                    <div class="activity-log-title">${escapeHtml(entry.title)}</div>
                    <span class="activity-log-meta">${escapeHtml(entry.meta)}</span>
                </div>
                <div class="activity-log-side">
                    <strong class="activity-log-amount">RWF ${amount.toLocaleString()}</strong>
                    <div class="activity-log-actions">${actionsHtml}</div>
                </div>
            `;
            list.appendChild(activityItem);
        });
    }

    if (tbody) {
        transactionList.forEach((transaction) => {
            const saleDate = new Date(transaction.date);
            const dateStr = saleDate.toLocaleDateString() + ' ' + saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const customerName = getCustomerNameByReference(transaction.customerId, 'Guest');
            const saleTypeDisplay = transaction.type === 'credit'
                ? '<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px;">Credit</span>'
                : '<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">Cash</span>';
            const itemsText = transaction.items.length > 1 ? `${transaction.items.length} items` : (transaction.items[0]?.drinkName || 'Unknown');
            const totalQty = transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const idsArray = transaction.ids.length > 0 ? transaction.ids : transaction.items.map((item) => item.id).filter((id) => id);
            const encodedItems = JSON.stringify(transaction.items).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const detailsButton = `<button onclick="showTransactionDetails('${encodedItems}')" style="padding: 6px 12px; background: #2575fc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-right: 8px;">Details</button>`;
            const deleteButton = idsArray.length > 0
                ? `<button onclick="deleteTransaction([${idsArray.join(',')}])" style="padding: 6px 10px; font-size: 12px; margin: 2px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>`
                : '';

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #e1e5e9';
            row.innerHTML = `
                <td style="padding: 15px;">${dateStr}</td>
                <td style="padding: 15px;"><strong>${escapeHtml(itemsText)}</strong></td>
                <td style="padding: 15px; text-align: center;">${totalQty}</td>
                <td style="padding: 15px; text-align: right;">RWF ${transaction.items.length > 0 ? (transaction.items[0].price || 0).toLocaleString() : '0'}</td>
                <td style="padding: 15px; text-align: right; font-weight: 600; color: #2575fc;">RWF ${transaction.totalAmount.toLocaleString()}</td>
                <td style="padding: 15px; text-align: center;">${saleTypeDisplay}</td>
                <td style="padding: 15px; text-align: center;">${escapeHtml(customerName)}</td>
                <td style="padding: 15px; text-align: center;">${detailsButton}${deleteButton}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

function applySalesHistoryFilters() {
    const actionFilter = document.getElementById('salesActionFilter');
    if (actionFilter) {
        selectedSalesHistoryType = getSalesHistorySelectedType();
    }
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
    
    const salesList = getEffectiveSalesList();
    if (!salesList || salesList.length === 0) {
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
async function requireAdminPasswordForAction(actionLabel = 'continue') {
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return false;
    }
    const input = window.prompt(`Enter admin password to ${actionLabel}:`, '');
    if (input === null) return false;
    const enteredPassword = String(input || '').trim();
    if (!isPasswordValid(enteredPassword)) {
        alert(t('authPinRules'));
        return false;
    }
    const ok = await verifyUserPassword(activeUser, enteredPassword);
    if (!ok) {
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
    if (!(await requireAdminPasswordForAction('delete this transaction'))) return;

    // Remove matching sales and adjust customer owing if needed
    ids.forEach(id => {
        const idx = sales.findIndex(s => s.id === id);
        if (idx !== -1) {
            const deletedSale = sales[idx];
            if (deletedSale.type === 'credit' && deletedSale.customerId !== null) {
                adjustCustomerDebtByReference(deletedSale.customerId, -(Number(deletedSale.total) || 0));
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
    const actionFilter = document.getElementById('salesActionFilter');
    if (actionFilter) {
        actionFilter.value = selectedSalesHistoryType;
    }

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
        if (!(await requireAdminPasswordForAction('delete this sale'))) return;
        const deletedSale = sales[index];
        
        // If it was a credit sale, reduce customer's debt
        if (deletedSale.type === 'credit' && deletedSale.customerId !== null) {
            adjustCustomerDebtByReference(deletedSale.customerId, -(Number(deletedSale.total) || 0));
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
async function exportSalesHistoryPDF() {
    try {
        const filteredSales = getSalesHistoryFilteredSales();
        if (!filteredSales || filteredSales.length === 0) {
            alert("No sales to export");
            return;
        }

        await ensurePDFLibrariesReady();
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
            if (transaction.customerId !== null && transaction.customerId !== undefined && typeof getSafeCustomerName === "function") {
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
    const name = getCustomerNameByReference(customerId, 'Unknown');
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
                statusEl.textContent = result.mode === 'sqlite' ? localizeLooseText('SQLite Database') : localizeLooseText('JSON Files');
                return;
            }
        }

        statusEl.textContent = window.indexedDB ? localizeLooseText('IndexedDB + localStorage') : localizeLooseText('localStorage');
    } catch (error) {
        statusEl.textContent = localizeLooseText('Unknown');
    }
}

function supportsOfflineShellInstall() {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && /^https?:$/i.test(String(window.location.protocol || ''));
}

function isAppOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function setConnectivityBannerState({ visible = false, mode = '', title = '', message = '' } = {}) {
    const banner = document.getElementById('connectivityBanner');
    const titleEl = document.getElementById('connectivityBannerTitle');
    const messageEl = document.getElementById('connectivityBannerMessage');
    if (!banner || !titleEl || !messageEl) return;

    banner.classList.remove('is-syncing', 'is-online');
    if (mode === 'syncing') banner.classList.add('is-syncing');
    if (mode === 'online') banner.classList.add('is-online');
    titleEl.textContent = title;
    messageEl.textContent = message;
    banner.style.display = visible ? 'flex' : 'none';
}

function updateConnectivityUI(options = {}) {
    const flashOnline = Boolean(options?.flashOnline);
    const online = isAppOnline();
    const connectionEl = document.getElementById('connectivityStatusText');
    const syncEl = document.getElementById('syncStatusText');
    const syncButtons = ['syncNowBtn', 'connectivitySyncBtn']
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    if (connectivityBannerHideTimeout) {
        clearTimeout(connectivityBannerHideTimeout);
        connectivityBannerHideTimeout = null;
    }

    if (connectionEl) {
        connectionEl.textContent = offlineSyncState.syncInFlight
            ? localizeLooseText('Online - syncing')
            : (online ? localizeLooseText('Online') : localizeLooseText('Offline'));
    }

    if (syncEl) {
        if (!online) {
            syncEl.textContent = localizeLooseText('Waiting for internet to sync online features.');
        } else if (offlineSyncState.syncInFlight) {
            syncEl.textContent = localizeLooseText('Syncing now...');
        } else if (offlineSyncState.lastError) {
            syncEl.textContent = localizeLooseText(`Last sync needs attention: ${offlineSyncState.lastError}`);
        } else if (offlineSyncState.lastSyncAt) {
            syncEl.textContent = localizeLooseText(`Last synced ${formatAutoDailySalesPdfLabel(offlineSyncState.lastSyncAt)}`);
        } else if (supportsOfflineShellInstall()) {
            syncEl.textContent = localizeLooseText('Ready. Local data already keeps working offline on this device.');
        } else if (isElectron || (typeof window !== 'undefined' && String(window.location.protocol || '') === 'file:')) {
            syncEl.textContent = localizeLooseText('Local storage works offline here. Installable offline caching needs http or https.');
        } else {
            syncEl.textContent = localizeLooseText('Online. Offline caching is limited on this setup.');
        }
    }

    syncButtons.forEach((button) => {
        button.disabled = offlineSyncState.syncInFlight || !online;
    });

    if (!online) {
        setConnectivityBannerState({
            visible: true,
            mode: '',
            title: localizeLooseText('Offline mode active'),
            message: localizeLooseText('Sales still save on this device. When internet comes back, the app will refresh online features and update the offline cache.')
        });
        connectivityBannerHideTimeout = setTimeout(() => {
            setConnectivityBannerState({ visible: false });
        }, CONNECTIVITY_BANNER_HIDE_MS);
        return;
    }

    if (offlineSyncState.syncInFlight) {
        setConnectivityBannerState({
            visible: true,
            mode: 'syncing',
            title: localizeLooseText('Syncing saved work'),
            message: localizeLooseText('Refreshing the Rwanda clock, AI web features, and offline cache.')
        });
        return;
    }

    if (flashOnline) {
        setConnectivityBannerState({
            visible: true,
            mode: 'online',
            title: localizeLooseText('Back online'),
            message: localizeLooseText('The app is connected again. Local changes are saved and online features are refreshed.')
        });
        connectivityBannerHideTimeout = setTimeout(() => {
            setConnectivityBannerState({ visible: false });
        }, CONNECTIVITY_BANNER_HIDE_MS);
        return;
    }

    setConnectivityBannerState({ visible: false });
}

async function syncAppAfterReconnect(options = {}) {
    const silent = Boolean(options?.silent);
    if (!isAppOnline()) {
        updateConnectivityUI();
        return false;
    }
    if (offlineSyncState.syncInFlight) {
        return false;
    }

    offlineSyncState.syncInFlight = true;
    offlineSyncState.lastError = '';
    updateConnectivityUI();

    try {
        await waitForPendingSave();
        if (activeUser) {
            await optimizedSaveData();
        }

        if (supportsOfflineShellInstall()) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && typeof registration.update === 'function') {
                await registration.update().catch(() => {});
            }
        }

        await syncAndRenderRwandaClock().catch(() => false);

        refreshAiAssistantInsights(true);
        scheduleAutoBackup();
        scheduleAutoDailySalesPdfExport();
        offlineSyncState.lastSyncAt = Date.now();

        if (!silent) {
            showSuccessToast('Sync completed. Offline cache and online services are refreshed.');
        }
        return true;
    } catch (error) {
        offlineSyncState.lastError = error?.message || 'Unable to sync right now.';
        console.warn('Reconnect sync failed:', error);
        if (!silent) {
            alert(`Could not finish sync: ${offlineSyncState.lastError}`);
        }
        return false;
    } finally {
        offlineSyncState.syncInFlight = false;
        updateConnectivityUI({ flashOnline: isAppOnline() && !offlineSyncState.lastError });
    }
}

async function triggerManualSync() {
    return syncAppAfterReconnect({ silent: false });
}

async function registerOfflineSupport() {
    offlineSyncState.supported = supportsOfflineShellInstall();

    if (typeof window !== 'undefined' && !window.__mawConnectivityBound) {
        window.addEventListener('online', () => {
            updateConnectivityUI({ flashOnline: true });
            void syncAppAfterReconnect({ silent: true });
        });
        window.addEventListener('offline', () => {
            updateConnectivityUI();
        });
        window.__mawConnectivityBound = true;
    }

    if (offlineSyncState.supported) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
            offlineSyncState.serviceWorkerRegistered = true;
        } catch (error) {
            offlineSyncState.serviceWorkerRegistered = false;
            offlineSyncState.lastError = 'Offline cache could not be installed.';
            console.warn('Service worker registration failed:', error);
        }
    }

    updateConnectivityUI();

    if (isAppOnline()) {
        setTimeout(() => {
            void syncAppAfterReconnect({ silent: true });
        }, 1200);
    }
}

function initializeAdminAutoDailySalesPdfUi() {
    const checkbox = document.getElementById('adminAutoPdfEnabled');
    const timeInput = document.getElementById('adminAutoPdfTime');
    if (checkbox && !checkbox.dataset.boundAutoPdf) {
        checkbox.addEventListener('change', () => {
            if (timeInput) timeInput.disabled = !checkbox.checked;
        });
        checkbox.dataset.boundAutoPdf = '1';
    }
}

async function saveAutoDailySalesPdfSettings() {
    if (!canAccessAdminPanel()) {
        alert('Only an active admin session can update automatic PDF exports.');
        return false;
    }

    const checkbox = document.getElementById('adminAutoPdfEnabled');
    const timeInput = document.getElementById('adminAutoPdfTime');
    const enabled = Boolean(checkbox?.checked);
    const timeValue = String(timeInput?.value || '').trim() || getDefaultAutoDailySalesPdfTime();
    const previousEnabled = Boolean(settings?.autoDailySalesPdfEnabled);
    const previousTime = String(settings?.autoDailySalesPdfTime || '').trim();

    if (!isValidTimeValue(timeValue)) {
        alert('Choose a valid export time.');
        return false;
    }

    if (enabled && (!previousEnabled || previousTime !== timeValue)) {
        const todayKey = toLocalDayKey(new Date());
        if (String(settings?.autoDailySalesPdfLastAttemptDate || '').trim() === todayKey
            && String(settings?.autoDailySalesPdfLastAttemptStatus || '').trim() !== 'success') {
            settings.autoDailySalesPdfLastAttemptDate = '';
            settings.autoDailySalesPdfLastAttemptStatus = '';
        }
    }

    settings.autoDailySalesPdfEnabled = enabled;
    settings.autoDailySalesPdfTime = timeValue;
    await optimizedSaveData();
    refreshAutoDailySalesPdfControls();
    scheduleAutoDailySalesPdfExport();
    await maybeRunAutoDailySalesPdfExport(new Date());
    showSuccessToast('Automatic daily sales PDF schedule saved.');
    return true;
}

async function downloadLastAutoDailySalesPdf() {
    const cached = await loadCachedAutoDailySalesPdfBackup();
    if (!cached?.base64) {
        alert('No saved automatic PDF backup is available yet.');
        return false;
    }

    const blob = new Blob([base64ToBuffer(cached.base64)], { type: cached.mimeType || 'application/pdf' });
    triggerPdfBlobDownload(blob, cached.filename || `admin-daily-sales-${cached.dayIso || getTodayISODate()}.pdf`);
    showSuccessToast('Last automatic PDF backup downloaded.');
    return true;
}

function renderDrinkProfitEditor() {
    const container = document.getElementById('drinkProfitList');
    if (!container) return;
    if (!canViewProfitData()) {
        container.innerHTML = `<div class="drink-profit-empty">Admin session required to view and edit drink profit values.</div>`;
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
    if (addDrinkStockInput && addDrinkStockInput.value === String(30)) {
        addDrinkStockInput.value = '';
    }
    const addDrinkLowStockInput = document.getElementById('newDrinkLowStockThreshold');
    if (addDrinkLowStockInput && !addDrinkLowStockInput.value) {
        addDrinkLowStockInput.value = String(getDefaultLowStockThreshold());
    }
    
    // Load language (theme is fixed to dark)
    const themeInput = document.getElementById('themeMode');
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
    const maxDebtInput = document.getElementById('maxCustomerDebt');
    if (maxDebtInput) {
        const maxDebt = getCustomerDebtLimit();
        maxDebtInput.value = maxDebt > 0 ? String(maxDebt) : '';
    }
    settings.theme = 'dark';
    if (themeInput) themeInput.value = 'dark';
    
    setAppLanguage(language);
    applyTheme('dark');
    refreshStorageStatus();
    renderDrinkProfitEditor();
    renderStockManagement();
    renderHomeStockWarning();
    renderArchiveYearOptions();
    refreshDataManagementAccessUI();
    refreshProfitVisibilityUI();
    initializeAdminAutoDailySalesPdfUi();
    refreshAutoDailySalesPdfControls();
    updateConnectivityUI();
    refreshSettingsAccountSecurityUI();
    renderSettingsAiAssistantSection();
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

async function saveCustomerDebtSettings() {
    const input = document.getElementById('maxCustomerDebt');
    const raw = String(input?.value || '').trim();
    if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
        alert('Enter a valid debt limit. Use 0 or leave it empty for no limit.');
        return;
    }

    const limit = raw === '' ? 0 : Number(raw);
    settings.maxCustomerDebt = limit > 0 ? limit : 0;
    await optimizedSaveData();

    if (input) {
        input.value = settings.maxCustomerDebt > 0 ? String(settings.maxCustomerDebt) : '';
    }

    const overLimitCount = settings.maxCustomerDebt > 0
        ? customers.filter((customer) => Number(customer.owing || 0) > settings.maxCustomerDebt).length
        : 0;
    const summary = settings.maxCustomerDebt > 0
        ? `Customer debt limit saved: RWF ${settings.maxCustomerDebt.toLocaleString()}`
        : 'Customer debt limit cleared.';
    const suffix = overLimitCount > 0
        ? ` ${overLimitCount} customer(s) are already above the new limit.`
        : '';
    showSuccessToast(`${summary}${suffix}`);
}

function setTheme(theme) {
    const normalizedTheme = 'dark';
    const themeInput = document.getElementById('themeMode');
    if (themeInput) themeInput.value = normalizedTheme;
    applyTheme(normalizedTheme);
}

function toggleThemeModeSwitch(isDark) {
    setTheme('dark');
}

function applyTheme(theme) {
    const lightBtn = document.getElementById('lightThemeBtn');
    const darkBtn = document.getElementById('darkThemeBtn');
    const themeToggle = document.getElementById('themeModeToggle');
    const themeSwitchState = document.getElementById('settingsThemeSwitchState');
    
    const forcedTheme = 'dark';
    settings.theme = forcedTheme;
    document.body.classList.add('dark-mode');

    if (lightBtn) {
        const isActive = false;
        lightBtn.classList.toggle('is-active', isActive);
        lightBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    if (darkBtn) {
        const isActive = true;
        darkBtn.classList.toggle('is-active', isActive);
        darkBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    if (themeToggle) {
        themeToggle.checked = true;
        themeToggle.setAttribute('aria-checked', 'true');
    }

    if (themeSwitchState) {
        themeSwitchState.textContent = t('darkModeActive');
    }
}

function setAppLanguage(languageCode) {
    const normalizedLanguage = translations[languageCode] ? languageCode : 'en';
    settings.language = normalizedLanguage;
    currentLanguage = normalizedLanguage;
    document.documentElement.lang = normalizedLanguage;
    updateLanguageUI();
    if (typeof updateAiAssistantVoiceLanguage === 'function') {
        updateAiAssistantVoiceLanguage();
    }
}

function onLanguageChange(event) {
    const selectedLanguage = event && event.target ? event.target.value : 'en';
    setAppLanguage(selectedLanguage);
    optimizedSaveData();
}

function savePreferences() {
    const languageSelect = document.getElementById('language');
    const themeInput = document.getElementById('themeMode');
    
    const language = languageSelect ? languageSelect.value : 'en';
    const theme = 'dark';
    
    settings.currency = 'RWF';
    settings.theme = 'dark';
    if (themeInput) themeInput.value = 'dark';
    setAppLanguage(language);
    applyTheme(theme);
    optimizedSaveData();
    showSuccessToast(t('savePreferencesSuccess'));
    refreshAiAssistantInsights();
}

function saveCurrencyAndLanguage() {
    return savePreferences();
}

// Translation helper function
function t(key) {
    if (translations[currentLanguage] && translations[currentLanguage][key]) {
        return translations[currentLanguage][key];
    }
    return translations['en'][key] || key;
}

function tp(key, values = {}) {
    let template = String(t(key) || '');
    Object.keys(values || {}).forEach((name) => {
        const safeValue = String(values[name] ?? '');
        template = template.split(`{${name}}`).join(safeValue);
    });
    return template;
}

const RW_LOOSE_TEXT_MAP = {
    'Permission Denied': 'Uburenganzira bwanzwe.',
    'Permission denied': 'Uburenganzira bwanzwe.',
    'Dashboard': 'Incamake',
    'Sales': 'Igurisha',
    'Inventory': 'Sitoki',
    'Customers': 'Abakiriya',
    'Activity Log': 'Ibikorwa byabaye',
    'Reports': 'Raporo',
    'Admin': 'Admin',
    'Deposits': 'Ubwizigame',
    'Settings': 'Igenamiterere',
    'Switch Account': 'Hindura konti',
    'Expand': 'Fungura',
    'Collapse': 'Funga',
    'Expand Sidebar': 'Fungura urutonde rwo ku ruhande',
    'Collapse Sidebar': 'Funga urutonde rwo ku ruhande',
    'Guest': 'Umushyitsi',
    'Customer': 'Umukiriya',
    'None': 'Nta na kimwe',
    'No sales yet': 'Nta gurisha rirabaho',
    'User': 'Ukoresha',
    'Normal Account': 'Konti isanzwe',
    'Admin Session': 'Session ya Admin',
    'Business Analysis': 'Isesengura ry ubucuruzi',
    'Admin Dashboard': 'Dashboard ya Admin',
    'Unnamed Drink': 'Ikinyobwa kitazwi',
    'Out of stock': 'Byashize muri sitoki',
    'Low stock alert': 'Iburira rya sitoki iri hasi',
    'Need restocking': 'Bikeneye kongerwa muri sitoki',
    'Stock Warning:': 'Iburira rya Sitoki:',
    'Open Stock Management': 'Fungura Igenzura rya Sitoki',
    'Good Morning': 'Mwaramutse neza',
    'Good Afternoon': 'Mwiriwe neza',
    'Good Evening': 'Mwiriwe',
    'No data available yet. Add sales to unlock insights.': 'Nta makuru ahari ubu. Ongeramo igurisha kugira ngo ubone insights.',
    'No explanation available yet.': 'Nta busobanuro burahari ubu.',
    'Review your latest business data and try again.': 'Reba amakuru yawe aheruka y ubucuruzi wongere ugerageze.',
    'No recommendation available yet.': 'Nta nyunganizi irahari ubu.',
    'No data yet.': 'Nta makuru arahari.',
    'No activity yet.': 'Nta gikorwa kiraba.',
    'No recent sales': 'Nta gurisha rya vuba',
    'Out now': 'Byashize ubu',
    'Less than 1 day': 'Munsi y umunsi 1',
    'All stock looks healthy.': 'Sitoki yose imeze neza.',
    'Profit insights require an admin session.': 'Insights z inyungu zikeneye session ya admin.',
    'No obvious profit leaks detected.': 'Nta hantu hasohokeramo inyungu hagaragaye.',
    'No urgent tasks today.': 'Nta gikorwa cyihutirwa uyu munsi.',
    'Today': 'Uyu munsi',
    'Sign in to generate insights for this account.': 'Injira kugira ngo ukore insights z iyi konti.',
    'Unable to generate a response.': 'Ntibyashobotse gutanga igisubizo.',
    'Sorry, I could not generate a response right now.': 'Mbabarira, ntibyashobotse gutanga igisubizo ubu.',
    'Ask me about stock, sales, or growth. I can summarize your business in seconds.': 'Umbaze kuri sitoki, igurisha cyangwa kuzamuka kw ubucuruzi. Nshobora kuguha incamake mu masegonda.',
    "Today's Summary": 'Incamake y uyu munsi',
    "Tap a command to get instant insights. No typing needed.": 'Kanda command ubone insights ako kanya. Nta kwandika bisabwa.',
    'Open Business AI Assistant': 'Fungura Umujyanama wa AI w ubucuruzi',
    'Business AI Assistant': 'Umufasha wa AI w ubucuruzi',
    'Smart insights for your shop': 'Insights zifasha iduka ryawe',
    'Refresh insights': 'Vugurura insights',
    'Refresh': 'Vugurura',
    'Close assistant': 'Funga umufasha',
    'Close': 'Funga',
    'Business Health Score': 'Amanota y ubuzima bw ubucuruzi',
    'Total Sales': 'Igiteranyo cy igurisha',
    'Best Product': 'Igicuruzwa gikunzwe',
    'Slow Product': 'Igicuruzwa kigenda gake',
    "Generate insights to see today's recommendation.": 'Kora insights kugira ngo ubone inama y uyu munsi.',
    'Smart Restock Alerts': 'Amaburira meza yo kongera sitoki',
    'Profit Leak Detector': 'Igaragaza aho inyungu zisohokera',
    "Today's Priorities": 'Ibyihutirwa by uyu munsi',
    'Top 5': 'Top 5',
    'Quick Commands': 'Amabwiriza yihuse',
    'Analyze my business': 'Sesengura ubucuruzi bwanjye',
    'What should I restock?': 'Ni iki nkwiriye kongera muri sitoki?',
    'Which products sell the most?': 'Ni ibihe bicuruzwa bigurishwa cyane?',
    'How can I increase profit?': 'Nabasha nte kongera inyungu?',
    "Show today's summary report": 'Erekana raporo y incamake y uyu munsi',
    'Show profit leaks': 'Erekana aho inyungu zisohokera',
    'Show business health score': 'Erekana amanota y ubuzima bw ubucuruzi',
    "Show today's priorities": 'Erekana ibyihutirwa by uyu munsi',
    'Business Growth Overview': 'Incamake y izamuka ry ubucuruzi',
    'No trend yet': 'Nta trend iraboneka',
    'Analyze growth from your recent daily sales.': 'Sesengura izamuka rishingiye ku igurisha ryawe rya vuba rya buri munsi.',
    'Growth analysis period': 'Igihe cy isesengura ry izamuka',
    '14 Days': 'Iminsi 14',
    '30 Days': 'Iminsi 30',
    '60 Days': 'Iminsi 60',
    '90 Days': 'Iminsi 90',
    'Drinks': 'Ibinyobwa',
    'Drinks loved by customers (share of cases sold)': 'Ibinyobwa bikunzwe n abakiriya (igipimo cy amakaso yagurishijwe)',
    'Click a bar to view day details.': 'Kanda ku murongo ubone ibisobanuro by uwo munsi.',
    'AI Business Advisor': 'Umujyanama wa AI w ubucuruzi',
    'Action-focused suggestions from your real sales data.': 'Inama zifatika zishingiye ku makuru nyayo y igurisha ryawe.',
    'Generate Suggestions': 'Kora inama',
    'Suggestions are ready': 'Inama ziteguye',
    'Generate ideas to see growth, stock, and sales actions.': 'Kora ibitekerezo ubone ibikorwa by izamuka, sitoki n igurisha.',
    'Generate Insights': 'Kora Insights',
    'Generating...': 'Biri gukorwa...',
    'Quick command': 'Command yihuse',
    'Admin access required': 'Uburenganzira bwa admin burakenewe',
    'Admin access is required to unlock AI insights.': 'Uburenganzira bwa admin burakenewe kugira ngo ufungure AI insights.',
    'Sign in with admin access to unlock insights.': 'Injira ufite uburenganzira bwa admin kugira ngo ufungure insights.',
    'Moves selected year sales and deposit records into archive and removes them from active workspace.': 'Yimurira igurisha n ubwizigame bw umwaka wahisemo mu bubiko kandi ikabikura muri workspace iri gukora.',
    'Admin login required to change automation schedules or download the last automatic PDF.': 'Kwinjira nka admin birakenewe kugira ngo uhindure gahunda za automation cyangwa ukurure PDF ya nyuma yakozwe automatic.',
    'Owner': 'Nyiri porogaramu',
    'Employee': 'Umukozi',
    'Phone login is required for every session.': 'Kwinjira ukoresheje telefone birakenewe kuri buri session.',
    'No phone saved': 'Nta telefone yabitswe',
    'Admin session unlocked': 'Session ya admin yafunguwe',
    'Standard account access': 'Uburenganzira bwa konti isanzwe',
    'SQLite Database': 'Ububiko bwa SQLite',
    'JSON Files': 'Amadosiye ya JSON',
    'IndexedDB + localStorage': 'IndexedDB + localStorage',
    'localStorage': 'localStorage',
    'Unknown': 'Ntabwo bizwi',
    'Online - syncing': 'Online - biri guhuza',
    'Online': 'Online',
    'Offline': 'Offline',
    'Waiting for internet to sync online features.': 'Hategerejwe internet kugira ngo bihuze ibiri online.',
    'Syncing now...': 'Biri guhuza ubu...',
    'Ready. Local data already keeps working offline on this device.': 'Byiteguye. Amakuru yo muri iyi device akomeza gukora no mu gihe nta internet.',
    'Local storage works offline here. Installable offline caching needs http or https.': 'Ububiko bwo muri iyi app bukora offline hano. Offline caching ishobora gushyirwaho ikeneye http cyangwa https.',
    'Online. Offline caching is limited on this setup.': 'Online. Offline caching ifite aho igarukira kuri iyi setup.',
    'Offline mode active': 'Offline mode iri gukora',
    'Sales still save on this device. When internet comes back, the app will refresh online features and update the offline cache.': 'Igurisha riracyabikwa kuri iyi device. Internet yagaruka, app izavugurura ibiri online n offline cache.',
    'Syncing saved work': 'Biri guhuza ibyo wabitse',
    'Refreshing the Rwanda clock, AI web features, and offline cache.': 'Biri kuvugurura isaha y u Rwanda, AI web features na offline cache.',
    'Back online': 'Wongeye kuba online',
    'The app is connected again. Local changes are saved and online features are refreshed.': 'App yongeye guhuza. Impinduka zo muri local zabitswe kandi online features zavuguruwe.',
    'Voice input not supported': 'Kwinjiza ijwi ntibishyigikiwe',
    'There are no saved sales records in this workspace yet.': 'Nta makuru y igurisha yabitswe muri iyi workspace ubu.',
    'Add sales, then generate insights again.': 'Ongeramo igurisha, hanyuma wongere ukore insights.',
    'Recent activity is being tracked across sales, stock, and profit signals.': 'Ibikorwa bya vuba biri gukurikiranwa mu igurisha, sitoki n ibimenyetso by inyungu.',
    'Work through the top issue and refresh insights again.': 'Tangirira ku kibazo cya mbere, hanyuma wongere uvugurure insights.',
    'Keep recording sales today for a stronger recommendation.': 'Komeza kwandika igurisha uyu munsi kugira ngo inama zirusheho gukomera.',
    'Stock levels are healthy right now.': 'Urwego rwa sitoki rumeze neza ubu.',
    'No product is currently flagged as low based on stock on hand and recent sales movement.': 'Nta gicuruzwa kiri kuri low stock hashingiwe ku sitoki ihari n igurisha rya vuba.',
    'Top Products': 'Ibicuruzwa bya mbere',
    'Sales need to be recorded before product rankings can be calculated.': 'Igurisha rigomba kubanza kwandikwa mbere y uko urutonde rw ibicuruzwa rubarwa.',
    "Add today's sales and run this command again.": 'Andika igurisha ry uyu munsi wongere ukoreshe iyi command.',
    'Profit Insights': 'Insights z inyungu',
    'Profit values are not available for this view.': 'Imibare y inyungu ntiboneka kuri iyi view.',
    'Profit visibility depends on admin-level access and saved profit settings.': 'Kureba inyungu bisaba uburenganzira bwa admin n igenamiterere ry inyungu ryabitswe.',
    'Open the admin session and review your profit settings to unlock exact profit insights.': 'Fungura session ya admin urebe igenamiterere ry inyungu kugira ngo ubone insights nyazo z inyungu.',
    'No strong high-margin sales are lifting profit right now.': 'Nta gurisha rikomeye rifite margin nini riri kuzamura inyungu ubu.',
    'High-performing products are helping profit stay healthy.': 'Ibicuruzwa bikora neza biri gufasha inyungu kuguma imeze neza.',
    'Fix the leak first, then promote your highest-margin drink to recover profit faster.': 'Banza ukosore aho inyungu isohokera, hanyuma uzamure ikinyobwa cyawe gifite margin nini kugira ngo inyungu igaruke vuba.',
    'Promote your highest-margin drink this week and track whether profit improves after the campaign.': 'Zamura ikinyobwa cyawe gifite margin nini muri iki cyumweru kandi ukurikirane niba inyungu yiyongereye nyuma ya campaign.',
    'No urgent priorities are showing right now.': 'Nta byihutirwa biragaragara ubu.',
    'Current sales and stock data do not show a critical bottleneck.': 'Amakuru y igurisha na sitoki y ubu ntagaragaza ikibazo gikomeye.',
    'Keep logging sales and refresh insights later today.': 'Komeza kwandika igurisha kandi uvugurure insights nyuma uyu munsi.',
    'This recommendation is based on current sales movement, stock levels, and recent business trends.': 'Iyi nama ishingiye ku buryo igurisha rigenda, urwego rwa sitoki n uburyo ubucuruzi bumeze vuba aha.',
    'Complete the top priority first, then refresh insights for the next action.': 'Banza urangize igikorwa cya mbere, hanyuma uvugurure insights ku gikorwa gikurikira.',
    'Business Snapshot': 'Incamake y ubucuruzi',
    'Sales are stable across the current period.': 'Igurisha rihagaze neza muri iki gihe.',
    "Review today's sales and focus on the next bottleneck.": 'Reba igurisha ry uyu munsi wibande ku kibazo gikurikira.',
    'Risk Watch': 'Igenzura ry ibyago',
    'No major operational risk is showing right now.': 'Nta byago bikomeye by imikorere bigaragara ubu.',
    'Stock, debt, and product movement look stable in the latest saved data.': 'Sitoki, imyenda n imigendekere y ibicuruzwa bimeze neza mu makuru aheruka kubikwa.',
    'Keep monitoring sales and rerun insights after the next sync.': 'Komeza ukurikirane igurisha wongere ukore insights nyuma ya sync ikurikira.',
    'Debt Watchlist': 'Urutonde rw imyenda ikurikiranwa',
    'No customer debt is active right now.': 'Nta mwenda w abakiriya uriho ubu.',
    'All recorded customer balances appear settled.': 'Imyenda yose y abakiriya yanditswe isa n iyaishyuwe.',
    'Keep using clear payment terms to protect cash flow.': 'Komeza gukoresha amabwiriza asobanutse yo kwishyura kugira ngo urinde cash flow.',
    'Review debt accounts and schedule collection follow-ups.': 'Reba konti z imyenda kandi utegure gukurikirana uko kwishyura.',
    'Please type a question so I can help.': 'Andika ikibazo kugira ngo ngufashe.',
    'Sales for today:': 'Igurisha ry uyu munsi:',
    'Sales for last 7 days:': 'Igurisha ry iminsi 7 ishize:',
    'Sales for last 30 days:': 'Igurisha ry iminsi 30 ishize:',
    'Debt and credit snapshot:': 'Incamake y imyenda na credit:',
    'Deposit status:': 'Uko ubwizigame buhagaze:',
    'Top restock alerts:': 'Amaburira ya mbere yo kongera sitoki:',
    'Best sellers:': 'Ibicuruzwa bigurishwa cyane:',
    'Slow movers:': 'Ibicuruzwa bigenda gake:',
    'General profit tips:': 'Inama rusange zo kongera inyungu:',
    'Admin login unlocks profit numbers.': 'Kwinjira nka admin bifungura imibare y inyungu.',
    'Recommended action plan:': 'Uko ukora dusaba:',
    'Growth suggestions based on your data:': 'Inama zo kuzamura ubucuruzi zishingiye ku makuru yawe:',
    'You are offline, so I used the on-device business analysis only.': 'Ubu uri offline, nakoresheje gusa isesengura riri muri app.',
    'Here is the latest business snapshot:': 'Dore incamake ya vuba y ubucuruzi:',
    'I can answer with live business data from this app. Try one of these:': 'Nshobora gusubiza nkoresheje amakuru nyayo y ubucuruzi ari muri iyi app. Gerageza kimwe muri ibi:',
    "Show today's sales summary": 'Erekana incamake y igurisha ry uyu munsi',
    'What should I restock this week?': 'Ni iki nkwiriye kongera muri sitoki iki cyumweru?',
    'Who owes me money right now?': 'Ni nde umfitiye umwenda ubu?',
    'How are deposits looking?': 'Ubwizigame buhagaze gute?',
    'Give me a growth action plan': 'Mpa gahunda y ibikorwa byo kuzamura ubucuruzi',
    'You are offline, so replies use on-device data only.': 'Uri offline, ibisubizo birakoresha gusa amakuru ari muri app.',
    'Please login first.': 'Banza winjire.',
    'Only an active admin session can run AI analysis.': 'Ni session ya admin iri gukora gusa ishobora gukora AI analysis.',
    'Only an active admin session can export daily sales.': 'Ni session ya admin iri gukora gusa ishobora kohereza igurisha rya buri munsi.',
    'Only an active admin session can export sales.': 'Ni session ya admin iri gukora gusa ishobora kohereza igurisha.',
    'Only an active admin session can export stock audit PDF.': 'Ni session ya admin iri gukora gusa ishobora kohereza PDF ya stock audit.',
    'Only an active admin session can export account data.': 'Ni session ya admin iri gukora gusa ishobora kohereza amakuru ya konti.',
    'Only an active admin session can generate a reset code.': 'Ni session ya admin iri gukora gusa ishobora gukora reset code.',
    'Only an active admin session can update automatic PDF exports.': 'Ni session ya admin iri gukora gusa ishobora guhindura automatic PDF exports.',
    'Only an active admin session can clear employee data.': 'Ni session ya admin iri gukora gusa ishobora gusiba amakuru y umukozi.',
    'Only an active admin session can create user accounts.': 'Ni session ya admin iri gukora gusa ishobora gukora konti z abakoresha.',
    'Only admin/owner accounts can open Management.': 'Ni konti za admin/nyirayo gusa zifungura Management.',
    'Only admin/owner accounts can open Admin Panel.': 'Ni konti za admin/nyirayo gusa zifungura Admin Panel.',
    'You do not have admin access.': 'Nta burenganzira bwa admin ufite.',
    'Please choose a valid year to archive.': 'Hitamo umwaka wemewe wo kubika.',
    'Archive is only available after the year ends.': 'Kubika bikorwa gusa umwaka urangiye.',
    'No active account is signed in.': 'Nta konti iri gukora yinjiye.',
    'Current PIN is required.': 'PIN yawe y ubu irakenewe.',
    'Current PIN is incorrect.': 'PIN yawe y ubu si yo.',
    'Could not find the active account.': 'Ntibyashobotse kubona konti iri gukora.',
    'Could not generate a reset code right now.': 'Ntibyashobotse gukora reset code ubu.',
    'Only the owner can issue reset codes for admin or owner accounts.': 'Nyiri porogaramu ni we gusa ushobora gutanga reset code kuri admin cyangwa owner.',
    'Only the owner can reset admin/owner passwords.': 'Nyiri porogaramu ni we gusa ushobora guhindura ijambobanga rya admin/owner.',
    'Only the owner can change account roles.': 'Nyiri porogaramu ni we gusa ushobora guhindura inshingano za konti.',
    'Only the owner can activate or deactivate accounts.': 'Nyiri porogaramu ni we gusa ushobora gukora cyangwa guhagarika konti.',
    'At least one owner account must remain.': 'Nibura konti imwe ya nyiri porogaramu igomba kuguma ikora.',
    'At least one active owner account is required.': 'Nibura konti imwe ya owner ikora irakenewe.',
    'You cannot change your own role while logged in.': 'Ntushobora guhindura inshingano zawe uri kwinjiyemo.',
    'You cannot deactivate your own account.': 'Ntushobora guhagarika konti yawe.',
    'You cannot clear your own data.': 'Ntushobora gusiba amakuru yawe bwite.',
    'Only employee accounts can be cleared.': 'Ni konti z abakozi gusa zishobora gusibwa.',
    'Please select both start and end dates for the range export.': 'Hitamo itariki yo gutangira n iyo kurangiza mbere yo kohereza range.',
    'Start date cannot be after end date.': 'Itariki yo gutangira ntishobora kurenza iyo kurangiza.',
    'No stock data to export.': 'Nta makuru ya sitoki yo kohereza.',
    'No account data to export.': 'Nta makuru ya konti yo kohereza.',
    'No report available to print.': 'Nta raporo ihari yo gucapisha.',
    'Could not open print window.': 'Ntibyashobotse gufungura idirishya ryo gucapisha.',
    'No transaction selected': 'Nta transaction yatoranyijwe.',
    'Error displaying transaction details': 'Habaye ikibazo mu kwerekana amakuru ya transaction.',
    'No sales to export': 'Nta gurisha rihari ryo kohereza.',
    'Choose a valid export time.': 'Hitamo igihe cyemewe cyo kohereza.',
    'No saved automatic PDF backup is available yet.': 'Nta backup ya automatic PDF iraboneka ubu.',
    'Please add items to cart first': 'Banza wongere ibintu muri cart.',
    'Please select at least one drink': 'Banza uhitemo nibura ikinyobwa kimwe.',
    'Please select a customer for credit sale': 'Hitamo umukiriya kuri credit sale.',
    'Please enter valid drink name and price': 'Andika izina ry ikinyobwa n igiciro byemewe.',
    'Please enter customer name': 'Andika izina ry umukiriya.',
    'Please enter a valid amount': 'Andika umubare wemewe.',
    'Please enter a valid deposit amount': 'Andika umubare w ubwizigame wemewe.',
    'Customer not found': 'Umukiriya ntabashije kuboneka.',
    'Deposit not found!': 'Ubwizigame ntibwabashije kuboneka!',
    'Quantity must be at least 1': 'Umubare ugomba kuba nibura 1.',
    'Enter a stock quantity greater than zero.': 'Andika umubare wa stock urenze zero.',
    'Initial stock must be zero or greater.': 'Stock ya mbere igomba kuba zero cyangwa irenze.',
    'Low stock alert level must be zero or greater.': 'Urwego rwa low stock alert rugomba kuba zero cyangwa irenze.',
    'Initial debt cannot be negative.': 'Umwenda wa mbere ntushobora kuba munsi ya zero.',
    'No customers with outstanding debt.': 'Nta bakiriya bafite umwenda usigaye.',
    'Enter a valid debt limit. Use 0 or leave it empty for no limit.': 'Andika debt limit yemewe. Koresha 0 cyangwa usige ubusa niba nta limit.',
    'Type DELETE to confirm this action.': 'Andika DELETE kugira ngo wemeze iki gikorwa.',
    'Unable to login right now. Please try again.': 'Ntibyashobotse kwinjira ubu. Ongera ugerageze.',
    'Startup took too long. Please refresh and try again.': 'Gutangiza porogaramu byafashe igihe kinini. Vugurura wongere ugerageze.',
    'Invalid secret code. Access denied.': 'Secret code si yo. Uburenganzira bwanzwe.',
    'Admin password reset successful. Please login with the new password.': 'Gusubiramo ijambobanga rya admin byakunze. Injira ukoresheje ijambobanga rishya.',
    'AI insights updated.': 'AI insights zavuguruwe.',
    'AI growth analysis updated.': 'AI growth analysis yavuguruwe.',
    'Preferences saved. Dark mode and language updated.': 'Ibyo ukunda byabitswe. Dark mode n ururimi byavuguruwe.',
    'PIN updated successfully.': 'PIN yahinduwe neza.',
    'Reset code generated successfully.': 'Reset code yakozwe neza.',
    'Customers refreshed from database': 'Abakiriya bavuguruwe bavuye muri database.',
    'Sync completed. Offline cache and online services are refreshed.': 'Guhuza byarangiye. Offline cache na serivisi zo kuri internet byavuguruwe.'
};

const RW_LOOSE_TEXT_RULES = [
    [/^Could not export day PDF:\s*(.+)$/i, 'Ntibyashobotse kohereza PDF y umunsi: $1'],
    [/^Could not export all sales PDF:\s*(.+)$/i, 'Ntibyashobotse kohereza PDF y igurisha ryose: $1'],
    [/^Could not export range sales PDF:\s*(.+)$/i, 'Ntibyashobotse kohereza PDF ya range y igurisha: $1'],
    [/^Could not export PDF:\s*(.+)$/i, 'Ntibyashobotse kohereza PDF: $1'],
    [/^Error exporting stock PDF:\s*(.+)$/i, 'Habaye ikibazo mu kohereza PDF ya stock: $1'],
    [/^Error exporting range PDF:\s*(.+)$/i, 'Habaye ikibazo mu kohereza PDF ya range: $1'],
    [/^Error exporting PDF:\s*(.+)$/i, 'Habaye ikibazo mu kohereza PDF: $1'],
    [/^Error exporting customer debt PDF:\s*(.+)$/i, 'Habaye ikibazo mu kohereza PDF y umwenda w umukiriya: $1'],
    [/^Could not finish sync:\s*(.+)$/i, 'Ntibyashobotse kurangiza sync: $1'],
    [/^No transactions found for\s+(.+)\.$/i, 'Nta transactions zabonetse muri $1.'],
    [/^No sales data found between\s+(.+)\s+and\s+(.+)\.$/i, 'Nta makuru y igurisha yabonetse hagati ya $1 na $2.'],
    [/^Only\s+(\d+)\s+case\(s\)\s+available\s+for\s+(.+)\.$/i, '$2 ifite amakaso $1 gusa aboneka.'],
    [/^Select the payback date and time\s+(.+)\s+promised to pay\.$/i, 'Hitamo itariki n igihe $1 yemeye kwishyura.'],
    [/^(\d+)\s+customer account\(s\)\s+owe\s+(.+)\.$/i, 'Konti z abakiriya $1 zifitiye umwenda wa $2.'],
    [/^(\d+)\s+account\(s\)\s+are overdue and need immediate follow-up\.$/i, 'Konti $1 zarakererewe kandi zikeneye gukurikiranwa ako kanya.'],
    [/^(\d+)\s+account\(s\)\s+have promised dates tracked in the system\.$/i, 'Konti $1 zifite amatariki yo kwishyura yakurikiranywe muri sisitemu.'],
    [/^Start with\s+(.+)\s+\((.+)\)\s+and log the next payment date\.$/i, 'Tangira na $1 ($2) kandi wandike itariki ikurikira yo kwishyura.'],
    [/^Archive opens after Jan 1,\s*(\d+)\.$/i, 'Ububiko bufungurwa nyuma ya 1 Mutarama, $1.'],
    [/^(\d+)\s+sale$/i, 'Igurisha $1'],
    [/^(\d+)\s+sales$/i, 'Igurisha $1'],
    [/^(\d+)\s+out of stock$/i, 'Byashize muri sitoki: $1'],
    [/^(\d+)\s+customer$/i, 'Umukiriya $1'],
    [/^(\d+)\s+customers$/i, 'Abakiriya $1'],
    [/^(\d+)\s+case\(s\)$/i, 'Amakaso $1'],
    [/^(\d+)\s+out of stock,\s*(\d+)\s+low stock\.$/i, '$1 byashize muri sitoki, $2 biri hasi'],
    [/^RWF\s+([0-9,]+)\s+\|\s+Available now:\s+(\d+)\s+case\(s\)$/i, 'RWF $1 | Bihari ubu: amakaso $2'],
    [/^min:\s*(\d+)$/i, 'Ntarengwa: $1'],
    [/^Last sync needs attention:\s*(.+)$/i, 'Sync ya nyuma ikeneye kwitabwaho: $1'],
    [/^Last synced\s+(.+)$/i, 'Sync ya nyuma: $1'],
    [/^Add debt amount for\s+(.+)\s+\(RWF\):$/i, 'Ongeraho umubare w umwenda wa $1 (RWF):'],
    [/^Reduce debt amount for\s+(.+)\s+\(RWF\)\.\s+Current:\s+RWF\s+(.+)$/i, 'Gabanya umwenda wa $1 (RWF). Ubu ni: RWF $2'],
    [/^Clear all debt for\s+(.+)\?\s+Current:\s+RWF\s+(.+)$/i, 'Kuraho umwenda wose wa $1? Ubu ni: RWF $2'],
    [/^Updated\s+(.+)$/i, 'Byavuguruwe saa $1'],
    [/^(\d+)\s+days$/i, 'Iminsi $1'],
    [/^(\d+)d overdue$/i, 'Byakererewe iminsi $1'],
    [/^Due\s+(.+)$/i, 'Yishyurwa ku wa $1'],
    [/^(\d+)\s+item\(s\)\s+low or out of stock$/i, 'Ibintu $1 biri hasi cyangwa byashize muri sitoki'],
    [/^(.+)\s+-\s+No recent sales\s+\((\d+)\s+cases\)$/i, '$1 - Nta gurisha rya vuba (amakaso $2)'],
    [/^(.+)\s+-\s+Out now\s+\((\d+)\s+cases\)$/i, '$1 - Byashize ubu (amakaso $2)'],
    [/^(.+)\s+-\s+Less than 1 day\s+\((\d+)\s+cases\)$/i, '$1 - Munsi y umunsi 1 (amakaso $2)'],
    [/^(.+)\s+-\s+(\d+)\s+days\s+\((\d+)\s+cases\)$/i, '$1 - Iminsi $2 (amakaso $3)'],
    [/^Restock\s+(.+)$/i, 'Ongera sitoki ya $1'],
    [/^Confirm supplier for\s+(.+)$/i, 'Emeza supplier wa $1'],
    [/^Reduce or bundle\s+(.+)$/i, 'Gabanya cyangwa uhuze na bundle $1'],
    [/^Follow up\s+(.+)\s+for\s+(.+)$/i, 'Kurikirana $1 ku mafaranga $2'],
    [/^Plan a mid-week offer on\s+(.+)$/i, 'Tegura promo hagati mu cyumweru kuri $1'],
    [/^Feature\s+(.+)\s+near checkout$/i, 'Shyira $1 ahagaragara hafi yo kwishyuriraho'],
    [/^(\d+)\s+customer account\(s\)\s+are overdue by 7\+\s+days$/i, 'Konti z abakiriya $1 zakererewe hejuru y iminsi 7'],
    [/^Top follow-up:\s+(.+)\s+owes\s+(.+)$/i, 'Ukwitabwaho mbere: $1 afitiye umwenda wa $2'],
    [/^Pending deposits:\s+(\d+)$/i, 'Ubwizigame butarasubizwa: $1'],
    [/^Pending deposit value:\s+(.+)$/i, 'Agaciro k ubwizigame butarasubizwa: $1'],
    [/^Returned deposits:\s+(\d+)$/i, 'Ubwizigame bwagaruwe: $1'],
    [/^Latest pending deposit:\s+(.+)$/i, 'Ubwizigame bwa vuba butarasubizwa: $1'],
    [/^(.+)\s+-\s+(\d+)\s+case\(s\)\s+in\s+(\d+)\s+days$/i, '$1 - amakaso $2 mu minsi $3'],
    [/^Profit is up\s+\+?([0-9.]+)%\s+vs last week\.$/i, 'Inyungu yazamutseho $1% ugereranyije n icyumweru gishize.'],
    [/^Profit is down\s+\+?([0-9.]+)%\s+vs last week\.$/i, 'Inyungu yagabanutseho $1% ugereranyije n icyumweru gishize.'],
    [/^Sales are up\s+([0-9.]+)%\s+vs the previous\s+(\d+)\s+days\.$/i, 'Igurisha ryazamutseho $1% ugereranyije n iminsi $2 ishize.'],
    [/^Sales are down\s+([0-9.]+)%\s+vs the previous\s+(\d+)\s+days\.$/i, 'Igurisha ryagabanutseho $1% ugereranyije n iminsi $2 ishize.'],
    [/^(.+)\s+\((\d+)\s+purchases\)$/i, '$1 (yaguze inshuro $2)'],
    [/^(.+)\s+\((\d+)\s+cases\)$/i, '$1 (amakaso $2)'],
    [/^Health score:\s+(\d+)\/100$/i, 'Amanota y ubuzima: $1/100'],
    [/^Top restock alert:\s+(.+)$/i, 'Iburira rya mbere rya sitoki: $1'],
    [/^Best seller:\s+(.+)$/i, 'Igicuruzwa cya mbere: $1'],
    [/^Outstanding debt:\s+(.+)$/i, 'Umwenda usigaye: $1'],
    [/^Total sales:\s+(.+)$/i, 'Igiteranyo cy igurisha: $1'],
    [/^Transactions:\s+(\d+)$/i, 'Ibyakozwe: $1'],
    [/^Cases sold:\s+(\d+)$/i, 'Amakaso yagurishijwe: $1'],
    [/^Cash sales:\s+(.+)$/i, 'Igurisha ry amafaranga: $1'],
    [/^Credit sales:\s+(.+)$/i, 'Igurisha ku mwenda: $1'],
    [/^Credit share of sales:\s+([0-9.]+)%$/i, 'Igipimo cy igurisha ku mwenda: $1%'],
    [/^Best product:\s+(.+)$/i, 'Igicuruzwa cya mbere: $1'],
    [/^Slow product:\s+(.+)$/i, 'Igicuruzwa kigenda gake: $1'],
    [/^Recommendation:\s+(.+)$/i, 'Inama: $1'],
    [/^Weekly profit change:\s+(.+)$/i, 'Impinduka y inyungu y icyumweru: $1'],
    [/^(.+):\s+(\d+)\s+case\(s\)\s+sold$/i, '$1: amakaso $2 yagurishijwe'],
    [/^(.+):\s+(\d+)\s+case\(s\),\s+(.+)\s+left$/i, '$1: amakaso $2, hasigaye $3'],
    [/^(.+):\s+(.+)\s+\((.+)\)$/i, '$1: $2 ($3)'],
    [/^(.+)\s+is your best-selling product right now\.$/i, '$1 ni cyo gicuruzwa cyawe cya mbere ubu.'],
    [/^No sales yet\. Record sales to see top products\.$/i, 'Nta gurisha rirabaho. Andika igurisha ubone ibicuruzwa bya mbere.'],
    [/^No slow products detected in the last\s+(\d+)\s+days\.$/i, 'Nta bicuruzwa bigenda gake byagaragaye mu minsi $1 ishize.'],
    [/^All stock levels look healthy right now\.$/i, 'Ubu sitoki yose imeze neza.'],
    [/^No frequent buyers yet\. Add customer-linked sales to see loyalty insights\.$/i, 'Nta bakiriya bagura kenshi baragaragara. Ongeramo igurisha rifite umukiriya ubone loyalty insights.']
];

function localizeLooseText(message) {
    const text = String(message ?? '');
    if (!text || currentLanguage !== 'rw') return text;

    const en = translations.en || {};
    const rw = translations.rw || {};
    const enKeys = Object.keys(en);
    for (let i = 0; i < enKeys.length; i++) {
        const key = enKeys[i];
        if (en[key] === text && rw[key]) {
            return rw[key];
        }
    }

    if (RW_LOOSE_TEXT_MAP[text]) {
        return RW_LOOSE_TEXT_MAP[text];
    }

    for (let i = 0; i < RW_LOOSE_TEXT_RULES.length; i++) {
        const [pattern, replacement] = RW_LOOSE_TEXT_RULES[i];
        if (pattern.test(text)) {
            return text.replace(pattern, replacement);
        }
    }

    return text;
}

function localizeHtmlLooseText(html) {
    const source = String(html ?? '');
    if (!source || currentLanguage !== 'rw') return source;
    if (typeof document === 'undefined') return localizeLooseText(source);

    const template = document.createElement('template');
    template.innerHTML = source;
    const showText = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4;
    const walker = document.createTreeWalker(template.content, showText);
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }
    textNodes.forEach((node) => {
        const raw = String(node.nodeValue || '');
        const trimmed = raw.trim();
        if (!trimmed) return;
        const localized = localizeLooseText(trimmed);
        if (localized === trimmed) return;
        const leading = raw.match(/^\s*/)?.[0] || '';
        const trailing = raw.match(/\s*$/)?.[0] || '';
        node.nodeValue = `${leading}${localized}${trailing}`;
    });
    return template.innerHTML;
}

function installLocalizedAlertBridge() {
    if (typeof window === 'undefined' || typeof window.alert !== 'function') return;
    if (window.__mawLocalizedAlertBridge) return;
    const nativeAlert = window.alert.bind(window);
    window.alert = (message) => nativeAlert(localizeLooseText(String(message ?? '')));
    window.__mawLocalizedAlertBridge = true;
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
    setText('#authSubtitle', t('authSubtitle'));
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
    setText('#forgotPinDescription', t('authResetDescription'));
    setText('#loginScreen label[for="resetPhone"]', t('phoneNumber'));
    setText('#loginScreen label[for="resetVerificationCode"]', t('verificationCode'));
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
    setPlaceholder('#resetVerificationCode', t('verificationCode'));
    setPlaceholder('#resetNewPin', t('resetNewPin'));
    setPlaceholder('#resetConfirmPin', t('resetConfirmPin'));
    const signupRoleStaffOption = document.querySelector('#signupRole option[value="staff"]');
    const signupRoleAdminOption = document.querySelector('#signupRole option[value="admin"]');
    if (signupRoleStaffOption) signupRoleStaffOption.textContent = t('signupRoleStaff');
    if (signupRoleAdminOption) signupRoleAdminOption.textContent = t('signupRoleAdmin');
    syncSignupRoleControls(getAuthUsers());
    updateAuthModeSummary();
    updateResetAccountPreview();
    setAuthHintText();
    updateActiveUserBadge();
    syncSidebarLabels();

    // Home dashboard
    setText('#homeRevenueLabel', t('homeRevenueLabel'));
    setText('#homeLowStockLabel', t('homeLowStockLabel'));
    setText('#homeCreditLabel', t('homeCreditLabel'));
    setText('#homeSalesOverviewTitle', t('homeSalesOverviewTitle'));
    setText('#homeLowStockPanelTitle', t('homeLowStockPanelTitle'));

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
    setText('#selectedDrinksTitle', t('selectedDrinksTitle'));
    syncDrinkSelectionModeButton();
    setText('#addSelectedToCartBtn', t('addSelectedToCart'));
    setText('#addSale .sale-type label', `${t('saleType')}:`);
    setText('#addSale #customerSelectContainer label', `${t('selectCustomer')}:`);
    setPlaceholder('#creditCustomerSearch', t('searchCustomers'));
    setText('#creditCustomerSearchClearBtn', localizeLooseText('Clear'));
    setText('#addSale .total-display p', t('totalAmount'));
    setText('#addSale .confirm-btn', t('confirmSale'));
    setText('#addSale button[onclick="clearCart()"]', t('clearCart'));
    const saleTypeNormal = document.querySelector('#saleType option[value="normal"]');
    const saleTypeCredit = document.querySelector('#saleType option[value="credit"]');
    if (saleTypeNormal) saleTypeNormal.textContent = t('normalSale');
    if (saleTypeCredit) saleTypeCredit.textContent = t('creditSale');

    // Stock management page
    setText('#stockManagement button[onclick="renderStockManagement()"]', t('refreshLabel'));
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
    setText('#adminAutoPdfEnabled + span', t('adminAutoPdfToggle'));
    setText('.admin-auto-pdf-field label[for="adminAutoPdfTime"]', t('adminAutoPdfTimeLabel'));
    setText('#saveAdminAutoPdfBtn', t('adminAutoPdfSave'));
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
    setText('#adminAiPanelTitle', t('adminAiTitle'));
    setText('#adminAiPanelDesc', t('adminAiDesc'));
    setText('#runBusinessAiAdvisorBtn', t('adminAnalyzeBusiness'));
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
    if (customerFilterBtns[3]) customerFilterBtns[3].textContent = t('overdue');

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
    const salesActionFilter = document.getElementById('salesActionFilter');
    if (salesActionFilter) {
        if (salesActionFilter.options[0]) salesActionFilter.options[0].textContent = t('allActions');
        if (salesActionFilter.options[1]) salesActionFilter.options[1].textContent = t('cash');
        if (salesActionFilter.options[2]) salesActionFilter.options[2].textContent = t('creditSale');
        if (salesActionFilter.options[3]) salesActionFilter.options[3].textContent = t('depositsAction');
    }
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
    setText('#reports #adminBusinessAnalysis .admin-growth-header h3', localizeLooseText('Business Growth Overview'));
    setText('#adminGrowthTrendBadge', localizeLooseText('No trend yet'));
    setText('#adminGrowthSummary', localizeLooseText('Analyze growth from your recent daily sales.'));
    const growthToolbar = document.querySelector('#reports #adminBusinessAnalysis .admin-growth-toolbar');
    if (growthToolbar) growthToolbar.setAttribute('aria-label', localizeLooseText('Growth analysis period'));
    setText('#growthWindow14Btn', localizeLooseText('14 Days'));
    setText('#growthWindow30Btn', localizeLooseText('30 Days'));
    setText('#growthWindow60Btn', localizeLooseText('60 Days'));
    setText('#growthWindow90Btn', localizeLooseText('90 Days'));
    setText('#adminDrinksPieBtn', localizeLooseText('Drinks'));
    setText('#adminDrinksPieContainer .admin-drinks-pie-title', localizeLooseText('Drinks loved by customers (share of cases sold)'));
    setText('#adminGrowthPointDetails .admin-growth-point-empty', localizeLooseText('Click a bar to view day details.'));
    setText('#reports #adminBusinessAnalysis .admin-ai-advisor-title h4', localizeLooseText('AI Business Advisor'));
    setText('#reports #adminBusinessAnalysis .admin-ai-advisor-title p', localizeLooseText('Action-focused suggestions from your real sales data.'));
    setText('#runBusinessAiAdvisorBtn', localizeLooseText('Generate Suggestions'));
    setText('#businessAiAdvisorOutput .advisor-empty-state strong', localizeLooseText('Suggestions are ready'));
    setText('#businessAiAdvisorOutput .advisor-empty-state p', localizeLooseText('Generate ideas to see growth, stock, and sales actions.'));

    // Floating AI assistant
    const aiToggle = document.getElementById('aiAssistantToggle');
    if (aiToggle) aiToggle.setAttribute('aria-label', localizeLooseText('Open Business AI Assistant'));
    setText('#aiAssistantPanel .ai-assistant-header h3', localizeLooseText('Business AI Assistant'));
    setText('#aiAssistantPanel .ai-assistant-header p', localizeLooseText('Smart insights for your shop'));
    setText('#aiAssistantRefresh', localizeLooseText('Refresh'));
    setText('#aiAssistantClose', localizeLooseText('Close'));
    const aiRefreshBtn = document.getElementById('aiAssistantRefresh');
    if (aiRefreshBtn) aiRefreshBtn.setAttribute('title', localizeLooseText('Refresh insights'));
    const aiCloseBtn = document.getElementById('aiAssistantClose');
    if (aiCloseBtn) aiCloseBtn.setAttribute('title', localizeLooseText('Close assistant'));
    setText('#aiAssistantPanel .ai-health-card .ai-card-header span:first-child', localizeLooseText('Business Health Score'));
    setText('#aiAssistantPanel .ai-daily-card .ai-card-header span:first-child', localizeLooseText("Today's Summary"));
    setText('#aiDailyDate', localizeLooseText('Today'));
    setText('#aiAssistantPanel .ai-daily-card .ai-daily-metrics div:nth-of-type(1) small', localizeLooseText('Total Sales'));
    setText('#aiAssistantPanel .ai-daily-card .ai-daily-metrics div:nth-of-type(2) small', localizeLooseText('Best Product'));
    setText('#aiAssistantPanel .ai-daily-card .ai-daily-metrics div:nth-of-type(3) small', localizeLooseText('Slow Product'));
    setText('#aiDailyRecommendation', localizeLooseText("Generate insights to see today's recommendation."));
    setText('#aiAssistantPanel .ai-restock-card .ai-card-header span:first-child', localizeLooseText('Smart Restock Alerts'));
    setText('#aiAssistantPanel .ai-leak-card .ai-card-header span:first-child', localizeLooseText('Profit Leak Detector'));
    setText('#aiAssistantPanel .ai-priority-card .ai-card-header span:first-child', localizeLooseText("Today's Priorities"));
    setText('#aiAssistantPanel .ai-priority-card .ai-card-chip', localizeLooseText('Top 5'));
    setText('#aiAssistantPanel .ai-command-title', localizeLooseText('Quick Commands'));
    const aiCommandButtons = document.querySelectorAll('#aiAssistantPanel .ai-command-btn');
    const aiCommandLabels = [
        'Analyze my business',
        'What should I restock?',
        'Which products sell the most?',
        'How can I increase profit?',
        "Show today's summary report",
        'Show profit leaks',
        'Show business health score',
        "Show today's priorities"
    ];
    aiCommandButtons.forEach((btn, index) => {
        if (!aiCommandLabels[index]) return;
        btn.textContent = localizeLooseText(aiCommandLabels[index]);
    });
    setText('#aiAssistantHint', localizeLooseText('Tap a command to get instant insights. No typing needed.'));

    // Settings page
    setText('#settingsAccountTitle', t('accountSecurity'));
    setText('#settingsBusinessTitle', t('businessSettings'));
    setText('#settingsInterfaceTitle', t('appearancePreferences'));
    setText('#settingsDataTitle', t('dataManagement'));
    setText('#settingsSystemTitle', t('systemStatus'));
    setText('#settingsAutomationTitle', t('automationsReports'));
    setText('#settingsAiTitle', t('aiAssistantSettings'));
    setText('#activeAccountLabel', t('activeAccountLabel'));
    setText('#changePinBtn', t('changePin'));
    setText('#generateResetCodeBtn', t('generateResetCode'));
    setText('#settingsLogoutBtn', t('logoutLabel'));
    setText('#settings label[for="profitPercentage"]', t('profitPercentage'));
    setText('#settings label[for="profitMode"]', t('profitModeLabel'));
    const profitModePercentageOption = document.querySelector('#profitMode option[value="percentage"]');
    const profitModePerCaseOption = document.querySelector('#profitMode option[value="perCase"]');
    if (profitModePercentageOption) profitModePercentageOption.textContent = t('profitModePercentage');
    if (profitModePerCaseOption) profitModePerCaseOption.textContent = t('profitModePerCase');
    setText('#saveBusinessSettingsBtn', t('saveBusinessSettings'));
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
    setText('#saveLanguageCurrencyBtn', t('savePreferences'));
    setText('#connectionStatusLabel', t('connectionStatusLabel'));
    setText('#lastSyncLabel', t('lastSyncLabel'));
    setText('#syncNowBtn', t('connectivitySyncNow'));
    setText('#connectivitySyncBtn', t('connectivitySyncNow'));
    setText('#saveAdminAutoPdfBtn', t('saveAutomationSettings'));
    setText('#downloadLastAutoPdfBtn', t('downloadLastAutoPdf'));
    setText('#generateInsightsBtn', t('generateInsights'));
    setText('#settingsAiAnalyzeBtn', t('quickAnalyze'));
    setText('#settingsAiRestockBtn', t('quickRestock'));
    setText('#settingsAiProfitBtn', t('quickProfitInsights'));
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

    const footerText = document.querySelector('.footer p');
    if (footerText) footerText.textContent = `${t('footerText')} © 2026`;

    // Keep dynamic parts in sync
    updateActiveUserBadge();
    refreshAdminAccessUI();
    refreshDataManagementAccessUI();
    refreshSettingsAccountSecurityUI();
    renderSettingsAiAssistantSection();
    updateConnectivityUI();
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
    submitBtn.disabled = !isClearDataConfirmationValid(normalized);
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
        if (isClearDataConfirmationValid(ok)) {
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

function isClearDataConfirmationValid(value = '') {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'CLEAR USER DATA' || normalized === 'CLEAR ALL DATA';
}

function getFactoryResetDataKeys(usersSnapshot = []) {
    const keys = new Set([
        APP_META_STORAGE_KEY,
        GLOBAL_DRINKS_KEY,
        GLOBAL_CUSTOMERS_KEY,
        GLOBAL_CLATES_KEY,
        GLOBAL_LOYAL_CUSTOMERS_KEY,
        'sales',
        'customers',
        'clates',
        'drinks',
        'settings',
        'archives',
        'debts'
    ]);

    const list = Array.isArray(usersSnapshot) ? usersSnapshot : [];
    list.forEach((user) => {
        ['sales', 'customers', 'clates', 'drinks', 'settings', 'archives'].forEach((base) => {
            const key = userDataKey(base, user);
            if (key) keys.add(key);
        });
    });

    return Array.from(keys);
}

function clearMakeawayLocalStorage(dataKeys = []) {
    if (typeof localStorage === 'undefined') return;
    const keysToRemove = new Set();

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('makeaway_')) {
                keysToRemove.add(key);
            }
        }
    } catch (_) {}

    (Array.isArray(dataKeys) ? dataKeys : []).forEach((name) => {
        if (!name) return;
        keysToRemove.add(localStorageKey(name));
        keysToRemove.add(String(name));
    });

    keysToRemove.forEach((key) => {
        try {
            localStorage.removeItem(key);
        } catch (_) {}
    });
}

async function clearIndexedDbKeys(dataKeys = []) {
    try {
        const db = await openAppDB();
        await new Promise((resolve) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            const store = tx.objectStore(DB_STORE);
            (Array.isArray(dataKeys) ? dataKeys : []).forEach((name) => {
                if (!name) return;
                store.delete(name);
            });
            tx.oncomplete = () => {
                try { db.close(); } catch (_) {}
                resolve(true);
            };
            tx.onerror = () => {
                try { db.close(); } catch (_) {}
                resolve(false);
            };
            tx.onabort = () => {
                try { db.close(); } catch (_) {}
                resolve(false);
            };
        });
        return true;
    } catch (_) {
        return false;
    }
}

async function deleteAppIndexedDatabase() {
    if (typeof indexedDB === 'undefined') return false;

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(value);
        };
        const timeoutId = setTimeout(() => finish(false), 4000);

        try {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => finish(true);
            request.onerror = () => finish(false);
            request.onblocked = () => finish(false);
        } catch (_) {
            finish(false);
        }
    });
}

async function clearOfflineShellData() {
    try {
        if (typeof caches !== 'undefined') {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey).catch(() => false)));
        }
    } catch (_) {}

    try {
        if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
        }
    } catch (_) {}
}

async function clearElectronStoredData(dataKeys = []) {
    if (!isElectron || !window.electronAPI || typeof window.electronAPI.invoke !== 'function') {
        return false;
    }

    const invoke = window.electronAPI.invoke.bind(window.electronAPI);
    const preferredCommands = ['clear-all-data', 'clear-data', 'reset-storage', 'delete-all-data'];

    for (const command of preferredCommands) {
        try {
            const result = await invoke(command);
            if (!result || result.success !== false) {
                return true;
            }
        } catch (_) {}
    }

    const fallbackPayload = {};
    (Array.isArray(dataKeys) ? dataKeys : []).forEach((name) => {
        if (!name) return;
        if (name === APP_META_STORAGE_KEY) {
            fallbackPayload[name] = getDefaultAppMeta();
            return;
        }
        if (name === 'settings' || name.startsWith('settings__')) {
            fallbackPayload[name] = {};
            return;
        }
        fallbackPayload[name] = [];
    });

    try {
        await invoke('save-bulk-data', fallbackPayload);
        await invoke('flush-data').catch(() => {});
        return true;
    } catch (_) {
        return false;
    }
}

async function clearAllUsersDataAndRestart() {
    const usersSnapshot = Array.isArray(getAuthUsers()) ? [...getAuthUsers()] : [];
    const dataKeys = getFactoryResetDataKeys(usersSnapshot);

    await clearElectronStoredData(dataKeys);
    const dbDeleted = await deleteAppIndexedDatabase();
    if (!dbDeleted) {
        await clearIndexedDbKeys(dataKeys);
    }
    clearMakeawayLocalStorage(dataKeys);
    await clearOfflineShellData();

    sales = [];
    customers = [];
    clates = [];
    drinks = [];
    settings = getDefaultUserSettings();
    yearlyArchives = [];
    cart = [];
    adminSales = [];
    adminSalesCacheLoaded = false;
    selectedCustomerId = null;
    currentSaleType = 'normal';
    creditCustomerSearchTerm = '';
    activeUser = null;
    activeLoginMode = 'user';
    appMeta = getDefaultAppMeta();

    if (autoBackupTimeout) {
        clearTimeout(autoBackupTimeout);
        autoBackupTimeout = null;
    }
    if (autoDailySalesPdfTimeout) {
        clearTimeout(autoDailySalesPdfTimeout);
        autoDailySalesPdfTimeout = null;
    }
    if (autoDailySalesPdfCheckInterval) {
        clearInterval(autoDailySalesPdfCheckInterval);
        autoDailySalesPdfCheckInterval = null;
    }
    if (connectivityBannerHideTimeout) {
        clearTimeout(connectivityBannerHideTimeout);
        connectivityBannerHideTimeout = null;
    }
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }

    closeAiAssistantPanel();
    refreshAiAssistantAccessUI();
    closeOnboarding(false);

    const app = document.getElementById('app');
    if (app) {
        app.style.display = 'none';
        app.classList.remove('chrome-hidden');
    }

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.style.visibility = 'visible';
        loginScreen.style.display = 'flex';
    }

    initializeAuthUI();
    switchAuthMode('signup');
    setAuthFeedback('All local data has been reset. Create the owner account to continue.', 'info');

    setTimeout(() => {
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
            window.location.reload();
        }
    }, 180);
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
    const isValid = skipInputValidation || isClearDataConfirmationValid(confirmation);

    if (!isValid) {
        if (errorEl) {
            errorEl.textContent = t('clearDataConfirmMismatch');
            errorEl.style.display = 'block';
        }
        return;
    }

    closeClearDataConfirmForm();
    await clearAllUsersDataAndRestart();
}

function clearAllData() {
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return;
    }
    openClearDataConfirmForm();
}

async function clearCurrentUserDataNow(options = {}) {
    const { showHome = false } = options;

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
    refreshAiAssistantInsights(true);
    renderAdminPanel();
    if (showHome) {
        showPage('home');
    }
    showSuccessToast(t('clearDataConfirmSuccess'));
}

async function adminClearCurrentUserData() {
    if (!activeUser) {
        alert('Please login first.');
        return;
    }
    if (!isAdminSessionActive()) {
        alert(t('clearDataRequiresAdminLogin'));
        return;
    }
    if (!handleAdminDangerDeleteInput()) {
        alert('Type DELETE to confirm this action.');
        return;
    }

    await clearCurrentUserDataNow({ showHome: false });

    const input = document.getElementById('adminDangerDeleteInput');
    if (input) input.value = '';
    handleAdminDangerDeleteInput();
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
window.filterCreditSaleCustomers = filterCreditSaleCustomers;
window.clearCreditCustomerSearch = clearCreditCustomerSearch;
window.selectCreditCustomer = selectCreditCustomer;
window.handleCreditCustomerSearchKeydown = handleCreditCustomerSearchKeydown;
window.saveNewDrink = saveNewDrink;
window.openCustomerForm = openCustomerForm;
window.closeCustomerForm = closeCustomerForm;
window.openDepositForm = openDepositForm;
window.closeDepositForm = closeDepositForm;
window.openAddDebtForm = openAddDebtForm;
window.openReduceDebtForm = openReduceDebtForm;
window.openClearDebtForm = openClearDebtForm;
window.closeDebtForm = closeDebtForm;
window.openCustomerDebtDetails = openCustomerDebtDetails;
window.closeCustomerDebtDetailsModal = closeCustomerDebtDetailsModal;
window.saveCustomerDebtDetails = saveCustomerDebtDetails;
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
window.toggleThemeModeSwitch = toggleThemeModeSwitch;
window.savePreferences = savePreferences;
window.saveCurrencyAndLanguage = saveCurrencyAndLanguage;
window.changePinFromSettings = changePinFromSettings;
window.generateResetCodeFromSettings = generateResetCodeFromSettings;
window.logoutCurrentUser = logoutCurrentUser;
window.logoutFromSettings = logoutFromSettings;
window.generateSettingsAiInsights = generateSettingsAiInsights;
window.runSettingsAiQuickAction = runSettingsAiQuickAction;
window.clearAllData = clearAllData;
window.clearEmployeeData = clearEmployeeData;
window.archiveSelectedYear = archiveSelectedYear;
window.openClearDataConfirmForm = openClearDataConfirmForm;
window.closeClearDataConfirmForm = closeClearDataConfirmForm;
window.confirmClearAllData = confirmClearAllData;
window.showPage = showPage;
window.filterDrinks = filterDrinks;
window.updateLanguageUI = updateLanguageUI;
window.setStockFilter = setStockFilter;
window.renderStockManagement = renderStockManagement;
// ================= AI ASSISTANT =================
function getAiAssistantCurrencySymbol() {
    const raw = String(settings?.currency || 'RWF').trim();
    return raw || 'RWF';
}

function formatAiCurrency(value) {
    const symbol = getAiAssistantCurrencySymbol();
    const amount = Math.round(Number(value) || 0);
    return `${symbol} ${amount.toLocaleString()}`;
}

function clampNumber(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
}

function getAiAssistantDateRange(days, endDate = new Date()) {
    const safeDays = Math.max(1, Number(days) || 1);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const start = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));
    return { start, end, windowDays: safeDays };
}

function getSalesWithinRange(start, end) {
    return getEffectiveSalesList().filter((sale) => {
        const dt = getSaleDateTimeOrNull(sale);
        return dt && dt >= start && dt <= end;
    });
}

function getSalesWindowStats(days, endDate = new Date()) {
    const { start, end, windowDays } = getAiAssistantDateRange(days, endDate);
    const list = getSalesWithinRange(start, end);
    const productStats = new Map();

    list.forEach((sale) => {
        const name = String(sale.drinkName || 'Unknown').trim() || 'Unknown';
        const qty = Number(sale.quantity) || 0;
        const total = Number(sale.total) || 0;
        const saleDate = getSaleDateTimeOrNull(sale);
        if (!productStats.has(name)) {
            productStats.set(name, { name, qty: 0, total: 0, lastSaleAt: null });
        }
        const entry = productStats.get(name);
        entry.qty += qty;
        entry.total += total;
        if (saleDate && (!entry.lastSaleAt || saleDate > entry.lastSaleAt)) {
            entry.lastSaleAt = saleDate;
        }
    });

    const totalSales = list.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const totalQty = list.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);

    return {
        windowDays,
        start,
        end,
        list,
        productStats,
        totalSales,
        totalQty,
        totalTransactions: list.length
    };
}

function getTopProductsFromStats(productStats, limit = 3) {
    return Array.from(productStats.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit);
}

function getDaysSince(dateValue) {
    if (!dateValue || Number.isNaN(new Date(dateValue).getTime())) return Number.POSITIVE_INFINITY;
    const now = new Date();
    const diffMs = now - new Date(dateValue);
    return Math.max(0, Math.round(diffMs / 86400000));
}

function getSlowProducts(productStats, windowDays = AI_ASSISTANT_SLOW_WINDOW_DAYS, limit = 3) {
    const list = (Array.isArray(drinks) ? drinks : []).map((drink) => {
        const name = String(drink?.name || '').trim();
        const stats = productStats.get(name) || { qty: 0, total: 0, lastSaleAt: null };
        const daysSinceSale = getDaysSince(stats.lastSaleAt);
        return {
            name: name || 'Unknown',
            qty: Number(stats.qty) || 0,
            total: Number(stats.total) || 0,
            daysSinceSale,
            stockQty: getDrinkStockQty(drink)
        };
    });

    return list
        .filter((item) => item.qty <= 1 || item.daysSinceSale >= windowDays)
        .sort((a, b) => {
            if (b.daysSinceSale !== a.daysSinceSale) return b.daysSinceSale - a.daysSinceSale;
            return a.qty - b.qty;
        })
        .slice(0, limit);
}

function buildRestockForecast(stats30, stats7, growthAnalysis) {
    const weekendLift = Number(growthAnalysis?.weekendLiftPercent) || 0;
    const weekendAdjust = weekendLift > 0 ? (1 + Math.min(weekendLift, 30) / 100 * 0.2) : 1;
    const restockAll = (Array.isArray(drinks) ? drinks : []).map((drink) => {
        const name = String(drink?.name || '').trim() || 'Unknown';
        const stockQty = getDrinkStockQty(drink);
        const stats30Entry = stats30.productStats.get(name) || { qty: 0 };
        const stats7Entry = stats7.productStats.get(name) || { qty: 0 };
        const avg30 = (Number(stats30Entry.qty) || 0) / Math.max(1, stats30.windowDays);
        const avg7 = (Number(stats7Entry.qty) || 0) / Math.max(1, stats7.windowDays);
        const avgDaily = Math.max(avg30, avg7) * weekendAdjust;
        const daysRemaining = avgDaily > 0
            ? stockQty / avgDaily
            : (stockQty <= 0 ? 0 : Number.POSITIVE_INFINITY);
        return {
            name,
            stockQty,
            avgDaily,
            daysRemaining,
            status: getDrinkStockStatus(drink),
            lowThreshold: getDrinkLowStockThreshold(drink)
        };
    });

    const restockAlerts = restockAll
        .filter((item) => item.status !== 'ok' || (Number.isFinite(item.daysRemaining) && item.daysRemaining <= 7))
        .sort((a, b) => {
            const aDays = Number.isFinite(a.daysRemaining) ? a.daysRemaining : Number.POSITIVE_INFINITY;
            const bDays = Number.isFinite(b.daysRemaining) ? b.daysRemaining : Number.POSITIVE_INFINITY;
            if (aDays !== bDays) return aDays - bDays;
            return a.stockQty - b.stockQty;
        });

    return { restockAlerts, restockAll };
}

function formatDaysRemaining(days) {
    if (!Number.isFinite(days)) return localizeLooseText('No recent sales');
    if (days <= 0) return localizeLooseText('Out now');
    if (days < 1) return localizeLooseText('Less than 1 day');
    return localizeLooseText(`${Math.ceil(days)} days`);
}

function getProfitTrendStats(days = 7) {
    if (!canViewProfitData()) {
        return { allowed: false, currentProfit: 0, previousProfit: 0, delta: 0, deltaPercent: 0 };
    }
    const now = new Date();
    const { start: currentStart, end: currentEnd } = getAiAssistantDateRange(days, now);
    const prevEnd = new Date(currentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const { start: prevStart, end: prevRangeEnd } = getAiAssistantDateRange(days, prevEnd);

    const currentSales = getSalesWithinRange(currentStart, currentEnd);
    const previousSales = getSalesWithinRange(prevStart, prevRangeEnd);
    const currentProfit = calculateProfitFromSales(currentSales);
    const previousProfit = calculateProfitFromSales(previousSales);
    const delta = currentProfit - previousProfit;
    const deltaPercent = previousProfit > 0 ? (delta / previousProfit) * 100 : (currentProfit > 0 ? 100 : 0);

    return { allowed: true, currentProfit, previousProfit, delta, deltaPercent };
}

function getCustomerInsights(salesList, limit = 3) {
    const customerStats = new Map();
    (Array.isArray(salesList) ? salesList : []).forEach((sale) => {
        if (sale.customerId === null || sale.customerId === undefined) return;
        const key = String(sale.customerId);
        if (!customerStats.has(key)) {
            customerStats.set(key, { count: 0, total: 0, customerId: sale.customerId });
        }
        const entry = customerStats.get(key);
        entry.count += 1;
        entry.total += Number(sale.total) || 0;
    });

    const topCustomers = Array.from(customerStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((entry) => ({
            name: typeof getSafeCustomerName === 'function' ? getSafeCustomerName(entry.customerId) : `Customer ${entry.customerId}`,
            count: entry.count,
            total: entry.total
        }));

    return { topCustomers };
}

function getDebtCollectionInsights(limit = 5) {
    const now = new Date();
    const debtCustomers = normalizeCustomersList(customers)
        .map((customer, index) => {
            const owing = Math.max(0, Number(customer?.owing) || 0);
            if (owing <= 0) return null;

            const promiseDateValue = getCustomerPromiseDate(customer);
            const promiseDate = parseCustomerPromiseDate(promiseDateValue);
            const isOverdue = isCustomerDebtOverdue(customer, now);
            const overdueDaysRaw = isOverdue ? getCustomerDebtOverdueDays(customer, now) : 0;
            const overdueDays = isOverdue ? Math.max(1, Number(overdueDaysRaw) || 1) : 0;
            const dueLabel = promiseDate
                ? promiseDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
                : '';
            const status = isOverdue ? 'overdue' : (promiseDate ? 'due' : 'open');
            const statusLabel = isOverdue
                ? `${overdueDays}d overdue`
                : (dueLabel ? `Due ${dueLabel}` : 'No due date');

            return {
                id: String(customer?.id || `debt-${index}`),
                name: String(customer?.name || `Customer ${index + 1}`),
                owing,
                status,
                statusLabel,
                overdueDays,
                isLoyal: isLoyalCustomer(customer)
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            const rank = (entry) => (entry.status === 'overdue' ? 3 : (entry.status === 'due' ? 2 : 1));
            const rankDiff = rank(b) - rank(a);
            if (rankDiff !== 0) return rankDiff;
            if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
            return b.owing - a.owing;
        });

    const totalOwing = debtCustomers.reduce((sum, item) => sum + (Number(item.owing) || 0), 0);
    const overdueCount = debtCustomers.filter((item) => item.status === 'overdue').length;
    const dueCount = debtCustomers.filter((item) => item.status === 'due').length;
    const loyalCount = debtCustomers.filter((item) => item.isLoyal).length;

    return {
        customerCount: debtCustomers.length,
        overdueCount,
        dueCount,
        loyalCount,
        totalOwing,
        topCustomers: debtCustomers.slice(0, Math.max(1, Number(limit) || 5))
    };
}

function buildBusinessHealthScore(context) {
    const totalDrinks = Array.isArray(drinks) ? drinks.length : 0;
    const lowStockCount = getLowStockDrinks().length;
    const stockScore = totalDrinks > 0 ? ((totalDrinks - lowStockCount) / totalDrinks) * 100 : 50;

    const growthPercent = Number(context?.growthAnalysis?.growthPercent) || 0;
    const salesScore = clampNumber(50 + (growthPercent / 25) * 50, 0, 100);

    const movementScore = totalDrinks > 0
        ? ((context?.productsSoldCount || 0) / totalDrinks) * 100
        : 50;

    const profitTrend = context?.profitTrend;
    const profitScore = profitTrend && profitTrend.allowed
        ? clampNumber(50 + (Number(profitTrend.deltaPercent) / 25) * 50, 0, 100)
        : null;

    const components = [salesScore, stockScore, movementScore];
    if (profitScore !== null) components.push(profitScore);
    const score = components.length
        ? Math.round(components.reduce((sum, item) => sum + item, 0) / components.length)
        : 50;

    const notes = [];
    if (Number.isFinite(salesScore)) {
        notes.push(salesScore >= 70 ? 'Strong sales performance' : (salesScore <= 40 ? 'Sales need attention' : 'Sales are stable'));
    }
    if (lowStockCount > 0) {
        notes.push(`${lowStockCount} item(s) low or out of stock`);
    } else if (totalDrinks > 0) {
        notes.push('Stock levels look healthy');
    }
    if (movementScore < 45 && totalDrinks > 0) {
        notes.push('Several products are not moving');
    }
    if (profitScore !== null) {
        notes.push(profitScore >= 65 ? 'Profit trend is positive' : 'Profit trend is slipping');
    }
    if (!notes.length) {
        notes.push('No activity yet. Add sales to unlock insights.');
    }

    return { score, notes: notes.slice(0, 4) };
}

function buildDailySummary(stats30, restockAlerts, slowProducts, topProducts) {
    const todayIso = getTodayISODate();
    const todaySales = getSalesForSpecificDay(todayIso);
    const totalSales = todaySales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const todayTotals = new Map();
    todaySales.forEach((sale) => {
        const name = String(sale.drinkName || 'Unknown').trim() || 'Unknown';
        todayTotals.set(name, (todayTotals.get(name) || 0) + (Number(sale.quantity) || 0));
    });
    const todayBest = Array.from(todayTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    const bestProduct = todayBest ? todayBest[0] : (topProducts[0]?.name || '--');
    const slowProduct = slowProducts[0]?.name || '--';

    let recommendation = 'Log more sales today to unlock recommendations.';
    if (restockAlerts.length > 0) {
        const urgent = restockAlerts[0];
        recommendation = `${urgent.name} may run out in ${formatDaysRemaining(urgent.daysRemaining)}. Consider ordering more.`;
    } else if (bestProduct && bestProduct !== '--') {
        recommendation = `Keep ${bestProduct} visible and stocked to maintain momentum.`;
    }

    return {
        dateLabel: new Date().toLocaleDateString(),
        totalSales,
        bestProduct,
        slowProduct,
        recommendation
    };
}

function buildProfitLeakDetections(stats30, slowProducts) {
    const leaks = [];
    if (slowProducts.length > 0) {
        const slow = slowProducts[0];
        leaks.push(`${slow.name} has ${slow.stockQty} cases but only ${slow.qty} sold in ${stats30.windowDays} days. Consider reducing stock or bundling.`);
    }

    const profitCfg = getProfitConfig();
    if (canViewProfitData() && profitCfg.mode === 'perCase') {
        const lowMargin = (Array.isArray(drinks) ? drinks : [])
            .map((drink) => {
                const price = Number(drink.price) || 0;
                const profit = getDrinkProfitPerCaseByName(drink.name);
                const margin = price > 0 ? profit / price : 0;
                return { name: drink.name, margin, profit, price };
            })
            .filter((item) => item.margin > 0 && item.margin < 0.08)
            .sort((a, b) => a.margin - b.margin)[0];
        if (lowMargin && lowMargin.name) {
            leaks.push(`${lowMargin.name} margin is ${(lowMargin.margin * 100).toFixed(1)}%. Consider a small price lift or supplier renegotiation.`);
        }
    } else if (canViewProfitData() && profitCfg.mode === 'percentage' && profitCfg.percentage < 10) {
        leaks.push(`Profit percentage is set to ${profitCfg.percentage}%. Review pricing or costs for better margin.`);
    }

    const idleStock = (Array.isArray(drinks) ? drinks : [])
        .map((drink) => {
            const stats = stats30.productStats.get(String(drink.name || '').trim()) || { lastSaleAt: null };
            return { name: drink.name, daysSinceSale: getDaysSince(stats.lastSaleAt), stockQty: getDrinkStockQty(drink) };
        })
        .filter((item) => item.stockQty > 0 && item.daysSinceSale >= 45)
        .sort((a, b) => b.daysSinceSale - a.daysSinceSale)[0];
    if (idleStock && idleStock.name) {
        leaks.push(`${idleStock.name} has been idle for ${idleStock.daysSinceSale} days. Consider a clearance or bundle offer.`);
    }

    return leaks.slice(0, 3);
}

function buildAiAssistantPriorities(context) {
    const priorities = [];
    const seen = new Set();
    const add = (item) => {
        if (!item || seen.has(item) || priorities.length >= AI_ASSISTANT_MAX_PRIORITIES) return;
        priorities.push(item);
        seen.add(item);
    };

    if (context.restockAlerts.length > 0) {
        const urgent = context.restockAlerts[0];
        add(`Restock ${urgent.name}`);
        if (context.restockAlerts[1]) add(`Confirm supplier for ${context.restockAlerts[1].name}`);
    }
    if (context.slowProducts.length > 0) {
        add(`Reduce or bundle ${context.slowProducts[0].name}`);
    }
    if (context.growthAnalysis?.topDebtFollowUp && Number(context.growthAnalysis.topDebtFollowUp.owing) > 0) {
        add(`Follow up ${context.growthAnalysis.topDebtFollowUp.name} for ${formatAiCurrency(context.growthAnalysis.topDebtFollowUp.owing)}`);
    }
    if (context.profitTrend.allowed && context.profitTrend.deltaPercent < -5) {
        add('Run a short promo to recover profit decline');
    }
    if (Number(context.growthAnalysis?.weekendLiftPercent) > 4) {
        add('Prepare extra stock before the weekend');
    }
    if (context.growthAnalysis?.slowestWeekday?.name) {
        add(`Plan a mid-week offer on ${context.growthAnalysis.slowestWeekday.name}`);
    }
    if (context.topProducts[0]?.name) {
        add(`Feature ${context.topProducts[0].name} near checkout`);
    }

    return priorities;
}

function buildAiAssistantAnalysis() {
    const stats30 = getSalesWindowStats(AI_ASSISTANT_RESTOCK_WINDOW_DAYS);
    const stats7 = getSalesWindowStats(AI_ASSISTANT_FAST_WINDOW_DAYS);
    const growthAnalysis = getAdminBusinessAnalysisData(AI_ASSISTANT_RESTOCK_WINDOW_DAYS);
    const topProducts = getTopProductsFromStats(stats30.productStats, 3);
    const slowProducts = getSlowProducts(stats30.productStats, AI_ASSISTANT_SLOW_WINDOW_DAYS, 3);
    const restock = buildRestockForecast(stats30, stats7, growthAnalysis);
    const profitTrend = getProfitTrendStats(7);
    const customerInsights = getCustomerInsights(stats30.list, 3);
    const debtInsights = getDebtCollectionInsights(6);
    const productsSoldCount = stats30.productStats.size;
    const healthScore = buildBusinessHealthScore({
        growthAnalysis,
        profitTrend,
        productsSoldCount
    });
    const dailySummary = buildDailySummary(stats30, restock.restockAlerts, slowProducts, topProducts);
    const profitLeaks = buildProfitLeakDetections(stats30, slowProducts);
    const priorities = buildAiAssistantPriorities({
        restockAlerts: restock.restockAlerts,
        slowProducts,
        growthAnalysis,
        profitTrend,
        topProducts
    });

    return {
        generatedAt: new Date(),
        windowDays: stats30.windowDays,
        growthAnalysis,
        stats30,
        stats7,
        topProducts,
        slowProducts,
        restockAlerts: restock.restockAlerts,
        restockAll: restock.restockAll,
        profitTrend,
        customerInsights,
        debtInsights,
        healthScore,
        dailySummary,
        profitLeaks,
        priorities
    };
}

function getAiAssistantAnalysis(force = false) {
    const now = Date.now();
    if (!force && aiAssistantState.cachedAnalysis && (now - aiAssistantState.cacheAt) < AI_ASSISTANT_CACHE_TTL_MS) {
        return aiAssistantState.cachedAnalysis;
    }
    const analysis = buildAiAssistantAnalysis();
    aiAssistantState.cachedAnalysis = analysis;
    aiAssistantState.cacheAt = now;
    return analysis;
}

function invalidateAiAssistantCache() {
    aiAssistantState.cacheAt = 0;
}

function buildAiListItemsHtml(items, emptyText = 'No data yet.') {
    if (!Array.isArray(items) || items.length === 0) {
        return `<li>${escapeHtml(localizeLooseText(emptyText))}</li>`;
    }
    return items.map((item) => `<li>${escapeHtml(localizeLooseText(item))}</li>`).join('');
}

function renderAiAssistantDashboard(force = false) {
    const panel = document.getElementById('aiAssistantPanel');
    if (!panel) return;
    const analysis = getAiAssistantAnalysis(force);

    const scoreValue = document.getElementById('aiHealthScoreValue');
    const scoreLabel = document.getElementById('aiHealthScoreLabel');
    const scoreNotes = document.getElementById('aiHealthScoreNotes');
    const scoreWrap = document.querySelector('.ai-health-score');
    if (scoreValue) scoreValue.textContent = String(analysis.healthScore.score);
    if (scoreLabel) scoreLabel.textContent = `${analysis.healthScore.score}/100`;
    if (scoreNotes) {
        scoreNotes.innerHTML = buildAiListItemsHtml(analysis.healthScore.notes, localizeLooseText('No activity yet.'));
    }
    if (scoreWrap) {
        scoreWrap.classList.remove('good', 'warn', 'bad');
        const scoreTone = analysis.healthScore.score >= 75
            ? 'good'
            : (analysis.healthScore.score >= 55 ? 'warn' : 'bad');
        scoreWrap.classList.add(scoreTone);
    }

    const dailyDate = document.getElementById('aiDailyDate');
    const dailyTotal = document.getElementById('aiDailyTotal');
    const dailyBest = document.getElementById('aiDailyBest');
    const dailySlow = document.getElementById('aiDailySlow');
    const dailyRec = document.getElementById('aiDailyRecommendation');
    if (dailyDate) dailyDate.textContent = analysis.dailySummary.dateLabel;
    if (dailyTotal) dailyTotal.textContent = formatAiCurrency(analysis.dailySummary.totalSales);
    if (dailyBest) dailyBest.textContent = analysis.dailySummary.bestProduct || '--';
    if (dailySlow) dailySlow.textContent = analysis.dailySummary.slowProduct || '--';
    if (dailyRec) dailyRec.textContent = analysis.dailySummary.recommendation;

    const restockCount = document.getElementById('aiRestockCount');
    const restockList = document.getElementById('aiRestockAlertsList');
    if (restockCount) restockCount.textContent = String(analysis.restockAlerts.length);
    if (restockList) {
        const alerts = analysis.restockAlerts.slice(0, 5).map((item) => {
            return localizeLooseText(`${item.name} - ${formatDaysRemaining(item.daysRemaining)} (${item.stockQty} cases)`);
        });
        restockList.innerHTML = buildAiListItemsHtml(alerts, localizeLooseText('All stock looks healthy.'));
    }

    const leakCount = document.getElementById('aiLeakCount');
    const leakList = document.getElementById('aiProfitLeakList');
    if (leakCount) leakCount.textContent = String(canViewProfitData() ? analysis.profitLeaks.length : 0);
    if (leakList) {
        if (!canViewProfitData()) {
            leakList.innerHTML = `<li>${escapeHtml(localizeLooseText('Profit insights require an admin session.'))}</li>`;
        } else {
            leakList.innerHTML = buildAiListItemsHtml(analysis.profitLeaks, localizeLooseText('No obvious profit leaks detected.'));
        }
    }

    const prioritiesList = document.getElementById('aiPrioritiesList');
    if (prioritiesList) {
        const items = analysis.priorities.slice(0, AI_ASSISTANT_MAX_PRIORITIES);
        prioritiesList.innerHTML = buildAiListItemsHtml(items, localizeLooseText('No urgent tasks today.'));
    }
}

function refreshAiAssistantInsights(force = false) {
    invalidateAiAssistantCache();
    if (aiAssistantState.isOpen) {
        renderAiAssistantDashboard(force);
    }
    renderSettingsAiAssistantSection(force);
    renderAdminAiPanel(force);
}

function renderSettingsAiAssistantSection(force = false) {
    const card = document.getElementById('settingsAiCard');
    if (!card) return;

    const dateEl = document.getElementById('settingsAiDate');
    const totalEl = document.getElementById('settingsAiTotal');
    const bestEl = document.getElementById('settingsAiBest');
    const slowEl = document.getElementById('settingsAiSlow');
    const recommendationEl = document.getElementById('settingsAiRecommendation');

    if (!activeUser) {
        if (dateEl) dateEl.textContent = localizeLooseText('Today');
        if (totalEl) totalEl.textContent = '--';
        if (bestEl) bestEl.textContent = '--';
        if (slowEl) slowEl.textContent = '--';
        if (recommendationEl) recommendationEl.textContent = localizeLooseText('Sign in to generate insights for this account.');
        return;
    }

    const analysis = getAiAssistantAnalysis(force);
    if (dateEl) dateEl.textContent = analysis.dailySummary.dateLabel;
    if (totalEl) totalEl.textContent = formatAiCurrency(analysis.dailySummary.totalSales);
    if (bestEl) bestEl.textContent = analysis.dailySummary.bestProduct || '--';
    if (slowEl) slowEl.textContent = analysis.dailySummary.slowProduct || '--';
    if (recommendationEl) recommendationEl.textContent = localizeLooseText(analysis.dailySummary.recommendation || 'No recommendation available yet.');
}

function generateSettingsAiInsights() {
    if (!activeUser) return;
    renderSettingsAiAssistantSection(true);
    if (aiAssistantState.isOpen) {
        renderAiAssistantDashboard(true);
    }
    showSuccessToast('AI insights updated.');
}

function runSettingsAiQuickAction(prompt) {
    if (!activeUser) return;
    openAiAssistantPanel();
    void handleAiAssistantPrompt(prompt);
}

function addAiAssistantMessage(role, html, isHtml = true) {
    const log = document.getElementById('aiAssistantChatLog');
    if (!log) return;
    const wrapper = document.createElement('div');
    wrapper.className = `ai-message ${role === 'user' ? 'user' : 'ai'}`;
    const content = isHtml ? localizeHtmlLooseText(html) : localizeLooseText(html);
    wrapper.innerHTML = isHtml ? content : escapeHtml(content);
    log.appendChild(wrapper);
    log.scrollTop = log.scrollHeight;
}

function addAiAssistantTyping() {
    const log = document.getElementById('aiAssistantChatLog');
    if (!log) return null;
    const wrap = document.createElement('div');
    wrap.className = 'ai-message ai ai-typing';
    wrap.innerHTML = `
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot"></span>
    `;
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
}

function buildAiBulletList(items) {
    if (!Array.isArray(items) || items.length === 0) return `<p>${escapeHtml(localizeLooseText('No data yet.'))}</p>`;
    return `<ul>${items.map((item) => `<li>${escapeHtml(localizeLooseText(item))}</li>`).join('')}</ul>`;
}

function shouldUseExternalAdvice(query) {
    return ['marketing', 'price', 'pricing', 'increase', 'grow', 'growth', 'promotion', 'strategy', 'advertise']
        .some((term) => query.includes(term));
}

function normalizeAiAssistantQuery(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function aiQueryHasAny(query, terms = []) {
    return terms.some((term) => query.includes(String(term).toLowerCase()));
}

function getAiSalesRangeSummary(days = 1, label = 'selected period') {
    const { start, end, windowDays } = getAiAssistantDateRange(days, new Date());
    const list = getSalesWithinRange(start, end);
    const totalSales = list.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const totalQty = list.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);
    const cashSales = list
        .filter((sale) => sale.type === 'normal')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const creditSales = list
        .filter((sale) => sale.type === 'credit')
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    return {
        label,
        windowDays,
        list,
        totalSales,
        totalQty,
        transactions: list.length,
        cashSales,
        creditSales
    };
}

function getAiDepositInsights() {
    const pending = (Array.isArray(clates) ? clates : []).filter((item) => !item?.returned);
    const returned = (Array.isArray(clates) ? clates : []).filter((item) => item?.returned);
    const pendingTotal = pending.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
    const latestPending = pending
        .slice()
        .sort((a, b) => new Date(b?.date || b?.createdAt || 0) - new Date(a?.date || a?.createdAt || 0))[0] || null;
    return { pending, returned, pendingTotal, latestPending };
}

function buildAiAssistantActionPlan(analysis) {
    const actionPlan = [];
    if (analysis.restockAlerts[0]) {
        actionPlan.push(`Restock ${analysis.restockAlerts[0].name} before it runs out.`);
    }
    if (analysis.growthAnalysis?.topDebtFollowUp?.name) {
        actionPlan.push(`Follow up ${analysis.growthAnalysis.topDebtFollowUp.name} for ${formatAiCurrency(analysis.growthAnalysis.topDebtFollowUp.owing)}.`);
    }
    if (analysis.slowProducts[0]) {
        actionPlan.push(`Bundle or discount ${analysis.slowProducts[0].name} to move slow stock.`);
    }
    if (analysis.topProducts[0]) {
        actionPlan.push(`Keep ${analysis.topProducts[0].name} visible because it is leading sales.`);
    }
    return actionPlan.slice(0, 4);
}

function getExternalAdviceConfig() {
    const url = String(settings?.aiExternalAdviceUrl || appMeta?.aiExternalAdviceUrl || '').trim();
    const apiKey = String(settings?.aiExternalAdviceKey || appMeta?.aiExternalAdviceKey || '').trim();
    return { url, apiKey };
}

async function fetchExternalBusinessAdvice(question) {
    const config = getExternalAdviceConfig();
    if (!config.url) return null;

    const cacheKey = question.toLowerCase();
    const cachedAt = aiAssistantState.externalAdviceCacheAt[cacheKey];
    if (cachedAt && (Date.now() - cachedAt) < 6 * 60 * 60 * 1000) {
        return aiAssistantState.externalAdviceCache[cacheKey] || null;
    }

    try {
        let payload = null;
        if (config.url.includes('{query}')) {
            const url = config.url.replace('{query}', encodeURIComponent(question));
            payload = await fetchJsonWithTimeout(url, 7000);
        } else {
            const response = await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
                },
                body: JSON.stringify({ question })
            });
            if (!response.ok) {
                payload = null;
            } else {
                payload = await response.json();
            }
        }

        const advice = typeof payload === 'string'
            ? payload
            : (payload?.advice || payload?.answer || payload?.message || (Array.isArray(payload?.tips) ? payload.tips.join(' ') : ''));

        const cleaned = String(advice || '').trim();
        if (!cleaned) return null;
        aiAssistantState.externalAdviceCache[cacheKey] = cleaned;
        aiAssistantState.externalAdviceCacheAt[cacheKey] = Date.now();
        return cleaned;
    } catch (error) {
        return null;
    }
}

async function generateAiAssistantResponse(prompt, analysis) {
    const text = String(prompt || '').trim();
    if (!text) {
        return { html: '<p>Please type a question so I can help.</p>' };
    }
    const query = normalizeAiAssistantQuery(text);
    const asksRestock = aiQueryHasAny(query, ['restock', 'stock', 'inventory', 'out of stock', 'low stock']);
    const asksTopProducts = aiQueryHasAny(query, ['most', 'best', 'top', 'fast', 'popular', 'sell the most', 'best seller']);
    const asksSlowProducts = aiQueryHasAny(query, ['slow', 'not sell', 'unsold', 'dead stock', 'clearance']);
    const asksProfit = aiQueryHasAny(query, ['profit', 'margin', 'leak', 'markup']);
    const asksDrop = aiQueryHasAny(query, ['drop', 'decline', 'down', 'falling', 'decrease']);
    const asksCustomers = aiQueryHasAny(query, ['customer', 'loyal', 'frequent', 'buyer']);
    const asksHealth = aiQueryHasAny(query, ['health', 'status', 'score']);
    const asksPriorities = aiQueryHasAny(query, ['priority', 'priorities', 'action', 'plan', 'next step', 'today']);
    const asksSummary = aiQueryHasAny(query, ['report', 'summary', 'overview', 'snapshot']);
    const asksBusiness = aiQueryHasAny(query, ['analyze', 'insight', 'business', 'performance']);
    const asksDebt = aiQueryHasAny(query, ['debt', 'owing', 'credit', 'collect', 'payment']);
    const asksDeposits = aiQueryHasAny(query, ['deposit', 'clate', 'crate', 'bottle']);
    const asksGrowth = aiQueryHasAny(query, ['growth', 'grow', 'marketing', 'promotion', 'strategy', 'pricing', 'price']);
    const asksSales = aiQueryHasAny(query, ['sales', 'revenue', 'cash', 'income', 'case']);
    const wantsWeek = aiQueryHasAny(query, ['week', 'weekly', '7 day', 'last 7']);
    const wantsMonth = aiQueryHasAny(query, ['month', 'monthly', '30 day', 'last 30']);
    const wantsToday = aiQueryHasAny(query, ['today', 'daily', 'now']);

    if (asksSales && (wantsWeek || wantsMonth || wantsToday || asksSummary)) {
        const windowConfig = wantsMonth
            ? { days: 30, label: 'last 30 days' }
            : (wantsWeek ? { days: 7, label: 'last 7 days' } : { days: 1, label: 'today' });
        const salesSummary = getAiSalesRangeSummary(windowConfig.days, windowConfig.label);
        return {
            html: `<p>Sales for ${escapeHtml(salesSummary.label)}:</p>${buildAiBulletList([
                `Total sales: ${formatAiCurrency(salesSummary.totalSales)}`,
                `Transactions: ${salesSummary.transactions}`,
                `Cases sold: ${salesSummary.totalQty}`,
                `Cash sales: ${formatAiCurrency(salesSummary.cashSales)}`,
                `Credit sales: ${formatAiCurrency(salesSummary.creditSales)}`
            ])}`
        };
    }

    if (asksDebt) {
        const topDebt = analysis.growthAnalysis?.topDebtFollowUp;
        const overdueCount = Number(analysis.growthAnalysis?.overdueDebtCount) || 0;
        const totalDebt = Number(analysis.growthAnalysis?.outstandingDebtTotal) || 0;
        const creditShare = Number(analysis.growthAnalysis?.creditSharePercent) || 0;
        const lines = [
            `Outstanding debt: ${formatAiCurrency(totalDebt)}`,
            `Credit share of sales: ${creditShare.toFixed(1)}%`,
            `${overdueCount} customer account(s) are overdue by 7+ days`
        ];
        if (topDebt?.name) {
            lines.push(`Top follow-up: ${topDebt.name} owes ${formatAiCurrency(topDebt.owing)}`);
        }
        return { html: `<p>Debt and credit snapshot:</p>${buildAiBulletList(lines)}` };
    }

    if (asksDeposits) {
        const depositInsights = getAiDepositInsights();
        const lines = [
            `Pending deposits: ${depositInsights.pending.length}`,
            `Pending deposit value: ${formatAiCurrency(depositInsights.pendingTotal)}`,
            `Returned deposits: ${depositInsights.returned.length}`
        ];
        if (depositInsights.latestPending?.customerName || depositInsights.latestPending?.name) {
            const label = depositInsights.latestPending.customerName || depositInsights.latestPending.name;
            lines.push(`Latest pending deposit: ${label}`);
        }
        return { html: `<p>Deposit status:</p>${buildAiBulletList(lines)}` };
    }

    if (asksRestock) {
        const alerts = analysis.restockAlerts.slice(0, 5);
        if (!alerts.length) {
            return { html: '<p>All stock levels look healthy right now.</p>' };
        }
        const lines = alerts.map((item) => `${item.name} - ${formatDaysRemaining(item.daysRemaining)} (${item.stockQty} cases)`);
        return { html: `<p>Top restock alerts:</p>${buildAiBulletList(lines)}` };
    }

    if (asksTopProducts) {
        const topProducts = analysis.topProducts;
        if (!topProducts.length) {
            return { html: '<p>No sales yet. Record sales to see top products.</p>' };
        }
        const lines = topProducts.map((item) => `${item.name} (${item.qty} cases)`);
        return { html: `<p>Best sellers:</p>${buildAiBulletList(lines)}` };
    }

    if (asksSlowProducts) {
        const slow = analysis.slowProducts;
        if (!slow.length) {
            return { html: '<p>No slow products detected in the last 30 days.</p>' };
        }
        const lines = slow.map((item) => `${item.name} - ${item.qty} case(s) in ${analysis.windowDays} days`);
        return { html: `<p>Slow movers:</p>${buildAiBulletList(lines)}` };
    }

    if (asksProfit) {
        if (!analysis.profitTrend.allowed) {
            const tips = [
                'Keep best sellers fully stocked to protect revenue.',
                'Bundle slow items with top sellers to move inventory.',
                'Focus promotions on high-demand days to lift margin.'
            ];
            return {
                html: `<p>General profit tips:</p>${buildAiBulletList(tips)}<p>Admin login unlocks profit numbers.</p>`
            };
        }
        const trend = analysis.profitTrend;
        const trendLine = `Profit is ${trend.delta >= 0 ? 'up' : 'down'} ${trend.delta >= 0 ? '+' : ''}${trend.deltaPercent.toFixed(1)}% vs last week.`;
        const leaks = analysis.profitLeaks.length
            ? buildAiBulletList(analysis.profitLeaks)
            : '<p>No obvious profit leaks detected.</p>';
        return { html: `<p>${escapeHtml(trendLine)}</p>${leaks}` };
    }

    if (asksDrop) {
        const growth = Number(analysis.growthAnalysis?.growthPercent) || 0;
        const line = growth >= 0
            ? `Sales are up ${growth.toFixed(1)}% vs the previous ${analysis.windowDays} days.`
            : `Sales are down ${Math.abs(growth).toFixed(1)}% vs the previous ${analysis.windowDays} days.`;
        const suggestions = getBusinessAiAdvisorSuggestions(analysis.growthAnalysis).slice(0, 3);
        const lines = suggestions.map((item) => `${item.title}: ${item.detail}`);
        return { html: `<p>${escapeHtml(line)}</p>${buildAiBulletList(lines)}` };
    }

    if (asksCustomers) {
        const topCustomers = analysis.customerInsights.topCustomers || [];
        if (!topCustomers.length) {
            return { html: '<p>No frequent buyers yet. Add customer-linked sales to see loyalty insights.</p>' };
        }
        const lines = topCustomers.map((item) => `${item.name} (${item.count} purchases)`);
        return { html: `<p>Frequent buyers:</p>${buildAiBulletList(lines)}<p>Consider a small loyalty reward for top customers.</p>` };
    }

    if (asksHealth) {
        const score = analysis.healthScore;
        return { html: `<p>Business Health Score: <strong>${score.score}/100</strong></p>${buildAiBulletList(score.notes)}` };
    }

    if (asksPriorities) {
        const priorities = buildAiAssistantActionPlan(analysis);
        return { html: `<p>Recommended action plan:</p>${buildAiBulletList(priorities.length ? priorities : analysis.priorities.slice(0, AI_ASSISTANT_MAX_PRIORITIES))}` };
    }

    if (asksSummary) {
        const summary = analysis.dailySummary;
        return {
            html: `<p>Today's Summary</p>${buildAiBulletList([
                `Total sales: ${formatAiCurrency(summary.totalSales)}`,
                `Best product: ${summary.bestProduct}`,
                `Slow product: ${summary.slowProduct}`,
                `Recommendation: ${summary.recommendation}`
            ])}`
        };
    }

    if (asksGrowth) {
        let externalAdvice = null;
        if (shouldUseExternalAdvice(query) && isAppOnline()) {
            externalAdvice = await fetchExternalBusinessAdvice(text);
        }
        const suggestions = getBusinessAiAdvisorSuggestions(analysis.growthAnalysis).slice(0, 4);
        const lines = suggestions.map((item) => `${item.title}: ${item.detail}`);
        let html = `<p>Growth suggestions based on your data:</p>${buildAiBulletList(lines)}`;
        if (externalAdvice) {
            html += `<p>${escapeHtml(externalAdvice)}</p>`;
        } else if (!isAppOnline()) {
            html += '<p>You are offline, so I used the on-device business analysis only.</p>';
        }
        return { html };
    }

    if (asksBusiness) {
        const suggestions = getBusinessAiAdvisorSuggestions(analysis.growthAnalysis).slice(0, 4);
        const lines = suggestions.map((item) => `${item.title}: ${item.detail}`);
        return {
            html: `<p>Here is the latest business snapshot:</p>${buildAiBulletList([
                `Health score: ${analysis.healthScore.score}/100`,
                `Top restock alert: ${analysis.restockAlerts[0]?.name || 'None'}`,
                `Best seller: ${analysis.topProducts[0]?.name || 'No sales yet'}`,
                `Outstanding debt: ${formatAiCurrency(analysis.growthAnalysis?.outstandingDebtTotal || 0)}`
            ])}${buildAiBulletList(lines)}`
        };
    }

    let externalAdvice = null;
    if (shouldUseExternalAdvice(query) && isAppOnline()) {
        externalAdvice = await fetchExternalBusinessAdvice(text);
    }

    if (externalAdvice) {
        return { html: `<p>${escapeHtml(externalAdvice)}</p>` };
    }

    return {
        html: `<p>I can answer with live business data from this app. Try one of these:</p>${buildAiBulletList([
            'Show today\'s sales summary',
            'What should I restock this week?',
            'Who owes me money right now?',
            'How are deposits looking?',
            'Give me a growth action plan'
        ])}${!isAppOnline() ? '<p>You are offline, so replies use on-device data only.</p>' : ''}`
    };
}

async function handleAiAssistantPrompt(prompt) {
    if (aiAssistantState.generating) return;
    const input = document.getElementById('aiAssistantInput');
    const text = String(prompt || input?.value || '').trim();
    if (!text) return;
    if (input) input.value = '';

    aiAssistantState.generating = true;
    addAiAssistantMessage('user', text, false);
    const typing = addAiAssistantTyping();
    try {
        const analysis = getAiAssistantAnalysis();
        const response = await generateAiAssistantResponse(text, analysis);
        if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
        addAiAssistantMessage('ai', response.html || '<p>Unable to generate a response.</p>', true);
    } catch (error) {
        if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
        addAiAssistantMessage('ai', '<p>Sorry, I could not generate a response right now.</p>', true);
    } finally {
        aiAssistantState.generating = false;
    }
}

function ensureAiAssistantGreeting() {
    const log = document.getElementById('aiAssistantChatLog');
    if (!log || log.children.length > 0) return;
    addAiAssistantMessage('ai', '<p>Ask me about stock, sales, or growth. I can summarize your business in seconds.</p>');
}

function maybePostDailyReport(analysis) {
    const todayKey = getTodayISODate();
    if (aiAssistantState.lastDailyReportDate === todayKey) return;
    aiAssistantState.lastDailyReportDate = todayKey;
    const summary = analysis.dailySummary;
    addAiAssistantMessage('ai', `<p>Today's Summary</p>${buildAiBulletList([
        `Total sales: ${formatAiCurrency(summary.totalSales)}`,
        `Best product: ${summary.bestProduct}`,
        `Slow product: ${summary.slowProduct}`,
        `Recommendation: ${summary.recommendation}`
    ])}`);
}

function openAiAssistantPanel() {
    const root = document.getElementById('aiAssistantRoot');
    const panel = document.getElementById('aiAssistantPanel');
    const backdrop = document.getElementById('aiAssistantBackdrop');
    if (!panel) return;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.classList.add('show');
    if (root) root.classList.add('open');
    aiAssistantState.isOpen = true;
    renderAiAssistantDashboard(true);
    ensureAiAssistantGreeting();
    maybePostDailyReport(getAiAssistantAnalysis());
    const input = document.getElementById('aiAssistantInput');
    if (input) input.focus();
}

function closeAiAssistantPanel() {
    const root = document.getElementById('aiAssistantRoot');
    const panel = document.getElementById('aiAssistantPanel');
    const backdrop = document.getElementById('aiAssistantBackdrop');
    if (panel) {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.classList.remove('show');
    if (root) root.classList.remove('open');
    aiAssistantState.isOpen = false;
    if (aiAssistantState.voiceRecognition && aiAssistantState.voiceActive) {
        aiAssistantState.voiceRecognition.stop();
    }
}

function toggleAiAssistantPanel() {
    if (aiAssistantState.isOpen) {
        closeAiAssistantPanel();
    } else {
        openAiAssistantPanel();
    }
}

function updateAiAssistantVoiceLanguage() {
    if (!aiAssistantState.voiceRecognition) return;
    const localeMap = { en: 'en-US', fr: 'fr-FR', rw: 'rw-RW' };
    aiAssistantState.voiceRecognition.lang = localeMap[currentLanguage] || 'en-US';
}

function initializeAiAssistantVoice() {
    const voiceBtn = document.getElementById('aiAssistantVoice');
    if (!voiceBtn) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.disabled = true;
        voiceBtn.title = localizeLooseText('Voice input not supported');
        return;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'en-US';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    aiAssistantState.voiceRecognition = recognizer;
    updateAiAssistantVoiceLanguage();

    recognizer.onstart = () => {
        aiAssistantState.voiceActive = true;
        voiceBtn.classList.add('listening');
    };
    recognizer.onend = () => {
        aiAssistantState.voiceActive = false;
        voiceBtn.classList.remove('listening');
    };
    recognizer.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
            const input = document.getElementById('aiAssistantInput');
            if (input) input.value = transcript;
            void handleAiAssistantPrompt(transcript);
        }
    };

    voiceBtn.addEventListener('click', () => {
        if (!aiAssistantState.voiceRecognition) return;
        if (aiAssistantState.voiceActive) {
            aiAssistantState.voiceRecognition.stop();
        } else {
            updateAiAssistantVoiceLanguage();
            aiAssistantState.voiceRecognition.start();
        }
    });
}

function initializeAiAssistant() {
    const root = document.getElementById('aiAssistantRoot');
    if (!root || root.dataset.bound) return;

    const toggle = document.getElementById('aiAssistantToggle');
    const closeBtn = document.getElementById('aiAssistantClose');
    const refreshBtn = document.getElementById('aiAssistantRefresh');
    const sendBtn = document.getElementById('aiAssistantSend');
    const input = document.getElementById('aiAssistantInput');
    const backdrop = document.getElementById('aiAssistantBackdrop');

    if (toggle) toggle.addEventListener('click', toggleAiAssistantPanel);
    if (closeBtn) closeBtn.addEventListener('click', closeAiAssistantPanel);
    if (backdrop) backdrop.addEventListener('click', closeAiAssistantPanel);
    if (refreshBtn) refreshBtn.addEventListener('click', () => renderAiAssistantDashboard(true));
    if (sendBtn) sendBtn.addEventListener('click', () => handleAiAssistantPrompt());
    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleAiAssistantPrompt();
            }
        });
    }

    document.querySelectorAll('.ai-command-btn, .ai-suggestion-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const prompt = btn.getAttribute('data-prompt') || btn.textContent || '';
            handleAiAssistantPrompt(prompt);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && aiAssistantState.isOpen) {
            closeAiAssistantPanel();
        }
    });

    initializeAiAssistantVoice();
    refreshAiAssistantAccessUI();
    root.dataset.bound = '1';
}

function refreshAiAssistantAccessUI() {
    const root = document.getElementById('aiAssistantRoot');
    const backdrop = document.getElementById('aiAssistantBackdrop');
    if (!root) return;
    const allowed = Boolean(activeUser);
    root.style.display = allowed ? 'block' : 'none';
    if (backdrop) backdrop.style.display = allowed ? 'block' : 'none';
    if (allowed) {
        invalidateAiAssistantCache();
    }
    if (!allowed) {
        aiAssistantState.cachedAnalysis = null;
        aiAssistantState.cacheAt = 0;
        aiAssistantState.lastDailyReportDate = '';
        const log = document.getElementById('aiAssistantChatLog');
        if (log) log.innerHTML = '';
        closeAiAssistantPanel();
    }
}
// When user submits a new product
async function addProduct(productName, price, category, stock) {
    const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: productName,
            price: price,
            category: category,
            stock: stock
        })
    });
    const result = await response.json();
    console.log('Product added:', result);
}

// When user makes a sale
async function recordSale(productName, quantity, totalPrice, paymentMethod) {
    const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product: productName,
            quantity: quantity,
            total_price: totalPrice,
            payment_method: paymentMethod
        })
    });
    const result = await response.json();
    console.log('Sale recorded:', result);
}

// Display products on your website
async function loadProducts() {
    const response = await fetch('/api/products');
    const products = await response.json();
    // Display products in your HTML
    console.log('Products:', products);
}

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
window.createUserFromAdminPanel = createUserFromAdminPanel;
window.toggleUserRole = toggleUserRole;
window.toggleUserActiveStatus = toggleUserActiveStatus;
window.adminResetUserPin = adminResetUserPin;
window.adminPromptResetUserPassword = adminPromptResetUserPassword;
window.adminResetUserAdminPin = adminResetUserAdminPin;
window.handleAdminDangerDeleteInput = handleAdminDangerDeleteInput;
window.adminClearCurrentUserData = adminClearCurrentUserData;
window.viewUserDataSnapshot = viewUserDataSnapshot;
window.exportAdminUsersPDF = exportAdminUsersPDF;
window.saveAdminStockValues = saveAdminStockValues;
window.runAdminGrowthAnalysis = runAdminGrowthAnalysis;
window.runBusinessAiAdvisor = runBusinessAiAdvisor;
window.runAdminAiQuickCommand = runAdminAiQuickCommand;
window.renderAdminBusinessAnalysisTab = renderAdminBusinessAnalysisTab;
window.renderAdminAiPanel = renderAdminAiPanel;
window.toggleAdminDrinksPieChart = toggleAdminDrinksPieChart;
window.setAdminGrowthWindow = setAdminGrowthWindow;
window.selectAdminGrowthPoint = selectAdminGrowthPoint;
window.exportAdminDailySalesPDF = exportAdminDailySalesPDF;
window.exportAdminAllSalesPDF = exportAdminAllSalesPDF;
window.exportAdminRangeSalesPDF = exportAdminRangeSalesPDF;
window.exportAdminStockAuditPDF = exportAdminStockAuditPDF;
window.saveAutoDailySalesPdfSettings = saveAutoDailySalesPdfSettings;
window.downloadLastAutoDailySalesPdf = downloadLastAutoDailySalesPdf;
window.triggerManualSync = triggerManualSync;
