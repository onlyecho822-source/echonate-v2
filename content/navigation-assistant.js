/**
 * EchoNate v2.0 - Navigation Assistant Content Script
 * Handles page-level automation and user assistance
 */

class NavigationAssistant {
    constructor() {
        this.mode = 'standard';
        this.config = {};
        this.activeAssistance = new Set();
        
        this.initialize();
    }
    
    async initialize() {
        // Get current mode and config from background
        const status = await this.sendMessage('GET_STATUS');
        this.mode = status.status.mode;
        this.config = status.status.config;
        
        // Set up page observers
        this.setupObservers();
        
        // Inject page context script if needed
        if (this.mode !== 'standard') {
            this.injectPageContext();
        }
        
        console.log('🧭 Navigation Assistant Active');
    }
    
    setupObservers() {
        // Observe DOM for forms, challenges, CAPTCHAs
        const observer = new MutationObserver((mutations) => {
            this.handleDOMMutations(mutations);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Listen for form submissions
        document.addEventListener('submit', (e) => this.handleFormSubmit(e), true);
        
        // Listen for CAPTCHA detection
        this.detectCaptchas();
        
        // Listen for security challenges
        this.detectChallenges();
    }
    
    handleDOMMutations(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check for forms
                    if (node.tagName === 'FORM' || node.querySelector('form')) {
                        this.handleNewForm(node.tagName === 'FORM' ? node : node.querySelector('form'));
                    }
                    
                    // Check for CAPTCHAs
                    if (this.isCaptcha(node)) {
                        this.handleCaptchaDetected(node);
                    }
                    
                    // Check for challenges
                    if (this.isChallenge(node)) {
                        this.handleChallengeDetected(node);
                    }
                }
            }
        }
    }
    
    async handleNewForm(form) {
        if (this.mode === 'standard') {
            // Just highlight the form
            this.highlightElement(form, 'Form detected');
            return;
        }
        
        // Offer to fill form if we have data
        const formType = this.identifyFormType(form);
        
        if (formType && this.hasDataForForm(formType)) {
            this.showAssistanceOffer(form, `Auto-fill ${formType} form?`);
        }
    }
    
    identifyFormType(form) {
        const fields = Array.from(form.elements).map(el => el.name || el.id);
        
        // Common form patterns
        if (fields.some(f => f.includes('email') || f.includes('username')) &&
            fields.some(f => f.includes('password'))) {
            return 'login';
        }
        
        if (fields.some(f => f.includes('address')) &&
            fields.some(f => f.includes('city')) &&
            fields.some(f => f.includes('zip'))) {
            return 'address';
        }
        
        if (fields.some(f => f.includes('card') || f.includes('credit'))) {
            return 'payment';
        }
        
        return 'generic';
    }
    
    hasDataForForm(formType) {
        // Check if we have stored data for this form type
        // This would check against user's data vault
        return false; // Placeholder
    }
    
    async handleFormSubmit(event) {
        const form = event.target;
        
        // Log form submission
        await this.sendMessage('FILL_FORM', {
            formData: this.extractFormData(form),
            autoSubmit: false
        });
        
        // If auto-submit is disabled, let it proceed normally
        if (!this.config.formAutoSubmit) {
            return;
        }
        
        // If confirmation is required, prevent and ask user
        if (this.config.userConfirmation) {
            event.preventDefault();
            
            const confirmed = await this.confirmAction(
                'Submit this form?',
                this.extractFormData(form)
            );
            
            if (confirmed) {
                form.submit();
            }
        }
    }
    
    extractFormData(form) {
        const data = {};
        
        for (const element of form.elements) {
            if (element.name) {
                data[element.name] = element.value;
            }
        }
        
        return data;
    }
    
    detectCaptchas() {
        // Common CAPTCHA selectors
        const captchaSelectors = [
            '.g-recaptcha',
            '.h-captcha',
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            'iframe[src*="funcaptcha"]',
            '#captcha',
            '.captcha-container'
        ];
        
        setInterval(() => {
            for (const selector of captchaSelectors) {
                const captcha = document.querySelector(selector);
                if (captcha && !this.activeAssistance.has(captcha)) {
                    this.handleCaptchaDetected(captcha);
                }
            }
        }, 2000);
    }
    
    async handleCaptchaDetected(element) {
        this.activeAssistance.add(element);
        
        const captchaType = this.identifyCaptchaType(element);
        
        console.log(`🔍 CAPTCHA detected: ${captchaType}`);
        
        // Notify background
        const response = await this.sendMessage('SOLVE_CAPTCHA', {
            type: captchaType,
            provider: '2captcha' // Default provider
        });
        
        if (response.action === 'notify_user') {
            this.showNotification('CAPTCHA Detected', response.message);
            this.highlightElement(element, 'Please complete this CAPTCHA');
        }
        
        if (response.action === 'request_confirmation') {
            const confirmed = await this.confirmAction(
                response.message,
                { provider: response.provider, cost: `$${response.cost}` }
            );
            
            if (confirmed) {
                // Request actual solving
                // Implementation would go here
            }
        }
    }
    
    identifyCaptchaType(element) {
        const html = element.outerHTML.toLowerCase();
        
        if (html.includes('recaptcha')) return 'recaptcha';
        if (html.includes('hcaptcha')) return 'hcaptcha';
        if (html.includes('funcaptcha')) return 'funcaptcha';
        
        return 'unknown';
    }
    
    isCaptcha(element) {
        if (!element.querySelector) return false;
        
        const captchaIndicators = [
            'recaptcha',
            'hcaptcha',
            'funcaptcha',
            'captcha'
        ];
        
        const className = element.className || '';
        const id = element.id || '';
        
        return captchaIndicators.some(indicator =>
            className.includes(indicator) || id.includes(indicator)
        );
    }
    
    detectChallenges() {
        // Detect security challenges (Cloudflare, etc.)
        const challengeIndicators = [
            'Checking your browser',
            'Just a moment',
            'Please wait while we verify',
            'Security check',
            'DDoS protection'
        ];
        
        setInterval(() => {
            const bodyText = document.body.innerText;
            
            for (const indicator of challengeIndicators) {
                if (bodyText.includes(indicator)) {
                    this.handleChallengeDetected(document.body);
                    break;
                }
            }
        }, 3000);
    }
    
    async handleChallengeDetected(element) {
        if (this.activeAssistance.has('challenge')) return;
        this.activeAssistance.add('challenge');
        
        const challengeType = this.identifyChallengeType();
        
        console.log(`🛡️  Security challenge detected: ${challengeType}`);
        
        const response = await this.sendMessage('HANDLE_CHALLENGE', {
            url: window.location.href,
            challengeType: challengeType
        });
        
        if (response.action === 'notify_user') {
            this.showNotification('Security Challenge', response.message);
        }
        
        if (response.action === 'inject_patterns') {
            this.injectHumanPatterns();
        }
    }
    
    identifyChallengeType() {
        const bodyText = document.body.innerText.toLowerCase();
        const html = document.documentElement.outerHTML.toLowerCase();
        
        if (html.includes('cloudflare') || bodyText.includes('cloudflare')) {
            return 'cloudflare';
        }
        
        if (html.includes('akamai')) {
            return 'akamai';
        }
        
        if (html.includes('datadome')) {
            return 'datadome';
        }
        
        return 'unknown';
    }
    
    isChallenge(element) {
        if (!element.innerText) return false;
        
        const text = element.innerText.toLowerCase();
        const challengeKeywords = [
            'checking your browser',
            'just a moment',
            'security check',
            'verify you are human'
        ];
        
        return challengeKeywords.some(keyword => text.includes(keyword));
    }
    
    injectHumanPatterns() {
        // Inject human-like mouse movements and timing
        // This is for challenge assistance in advanced mode
        
        if (this.mode === 'standard') return;
        
        console.log('🖱️  Injecting human-like patterns');
        
        // Random mouse movements
        this.simulateMouseMovement();
        
        // Random scrolling
        this.simulateScrolling();
        
        // Random delays
        this.simulateHumanTiming();
    }
    
    simulateMouseMovement() {
        const moveCount = Math.floor(Math.random() * 5) + 3;
        
        for (let i = 0; i < moveCount; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                
                const event = new MouseEvent('mousemove', {
                    clientX: x,
                    clientY: y,
                    bubbles: true
                });
                
                document.dispatchEvent(event);
            }, i * 200 + Math.random() * 300);
        }
    }
    
    simulateScrolling() {
        const scrollAmount = Math.floor(Math.random() * 500) + 100;
        
        setTimeout(() => {
            window.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
            });
        }, Math.random() * 1000);
    }
    
    simulateHumanTiming() {
        // Add random delays to appear more human
        // This is used in advanced/research modes
    }
    
    injectPageContext() {
        // Inject script into page context for deeper access
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject/page-context.js');
        (document.head || document.documentElement).appendChild(script);
    }
    
    // ===== UI HELPERS =====
    
    highlightElement(element, message) {
        element.style.outline = '2px solid #4CAF50';
        element.style.outlineOffset = '2px';
        
        if (message) {
            this.showTooltip(element, message);
        }
        
        setTimeout(() => {
            element.style.outline = '';
        }, 3000);
    }
    
    showTooltip(element, message) {
        const tooltip = document.createElement('div');
        tooltip.textContent = message;
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
        `;
        
        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.top - 40}px`;
        tooltip.style.left = `${rect.left}px`;
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => tooltip.remove(), 3000);
    }
    
    showNotification(title, message) {
        // Create notification UI
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">${title}</div>
            <div style="font-size: 14px; color: #666;">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }
    
    showAssistanceOffer(element, message) {
        const offer = document.createElement('div');
        offer.style.cssText = `
            position: absolute;
            background: #2196F3;
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 10000;
        `;
        offer.textContent = message;
        
        const rect = element.getBoundingClientRect();
        offer.style.top = `${rect.top - 50}px`;
        offer.style.left = `${rect.left}px`;
        
        offer.onclick = () => {
            // Handle assistance acceptance
            offer.remove();
        };
        
        document.body.appendChild(offer);
        
        setTimeout(() => offer.remove(), 10000);
    }
    
    async confirmAction(message, details) {
        // Create confirmation dialog
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 8px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 10001;
                min-width: 400px;
            `;
            
            dialog.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">
                    ${message}
                </div>
                <div style="font-size: 14px; color: #666; margin-bottom: 20px;">
                    ${JSON.stringify(details, null, 2)}
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="confirm" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Confirm
                    </button>
                </div>
            `;
            
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
            `;
            
            document.body.appendChild(overlay);
            document.body.appendChild(dialog);
            
            dialog.querySelector('#confirm').onclick = () => {
                overlay.remove();
                dialog.remove();
                resolve(true);
            };
            
            dialog.querySelector('#cancel').onclick = () => {
                overlay.remove();
                dialog.remove();
                resolve(false);
            };
        });
    }
    
    // ===== MESSAGING =====
    
    async sendMessage(action, data = {}) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { action, ...data },
                (response) => resolve(response)
            );
        });
    }
}

// Initialize
const assistant = new NavigationAssistant();
