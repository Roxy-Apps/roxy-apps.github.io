// Language translations
const translations = {
    en: {},
    tr: {}
};

// Load translations
async function loadTranslations() {
    try {
        const enResponse = await fetch('translations/en.json');
        const trResponse = await fetch('translations/tr.json');
        translations.en = await enResponse.json();
        translations.tr = await trResponse.json();
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

// Get current language from localStorage or default to 'en'
let currentLang = localStorage.getItem('language') || 'en';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations();
    updateLanguage(currentLang);
    setupEventListeners();
    updateYear();
});

// Update language
function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    
    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const translation = getNestedTranslation(translations[lang], key);
        if (translation) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
    
    // Update App Store badge
    const appStoreBadge = document.getElementById('appStoreBadge');
    if (appStoreBadge) {
        appStoreBadge.src = `resources/${lang}/appstore.svg`;
        appStoreBadge.alt = lang === 'en' ? 'Download on the App Store' : 'App Store\'dan İndir';
    }
    
    // Update screenshots based on language
    const screenshot1 = document.getElementById('screenshot1');
    const screenshot2 = document.getElementById('screenshot2');
    const screenshot3 = document.getElementById('screenshot3');
    
    if (screenshot1) screenshot1.src = `resources/${lang}/dreamviewer/screenshot-1.png`;
    if (screenshot2) screenshot2.src = `resources/${lang}/dreamviewer/screenshot-2.png`;
    if (screenshot3) screenshot3.src = `resources/${lang}/dreamviewer/screenshot-3.png`;
    
    // Update language button
    const langBtn = document.getElementById('currentLang');
    if (langBtn) {
        langBtn.textContent = lang.toUpperCase();
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update page title
    const titleKey = `meta.title`;
    const title = getNestedTranslation(translations[lang], titleKey);
    if (title) {
        document.title = title;
    }
}

// Get nested translation value
function getNestedTranslation(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

// Setup event listeners
function setupEventListeners() {
    // Language switcher
    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'tr' : 'en';
            updateLanguage(currentLang);
        });
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            });
        });
    }
    
    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// Update copyright year
function updateYear() {
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

