/**
 * EchoNate v2.0 - Dashboard UI Controller
 */

let currentStatus = null;

// Initialize dashboard
async function initialize() {
    // Get current status from background
    const response = await sendMessage('GET_STATUS');
    
    if (response.success) {
        currentStatus = response.status;
        updateUI();
        
        // Check if terms accepted
        if (!currentStatus.termsAccepted) {
            showTermsNotice();
        } else {
            showMainContent();
        }
    }
    
    // Set up event listeners
    setupEventListeners();
}

function updateUI() {
    if (!currentStatus) return;
    
    // Update status display
    document.getElementById('current-mode').textContent = 
        currentStatus.mode.charAt(0).toUpperCase() + currentStatus.mode.slice(1);
    
    document.getElementById('audit-count').textContent = currentStatus.auditLogSize;
    
    // Update safety level
    const safetyBadge = document.getElementById('safety-level');
    safetyBadge.textContent = currentStatus.safetyLevel;
    safetyBadge.className = `safety-badge ${currentStatus.safetyLevel}`;
    
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === currentStatus.mode) {
            btn.classList.add('active');
        }
    });
}

function setupEventListeners() {
    // Mode change buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const newMode = btn.dataset.mode;
            
            // Confirm mode change for advanced/research
            if (newMode !== 'standard') {
                const confirmed = await confirmModeChange(newMode);
                if (!confirmed) return;
            }
            
            // Change mode
            const response = await sendMessage('CHANGE_MODE', {
                newMode: newMode,
                justification: `User requested ${newMode} mode`
            });
            
            if (response.success) {
                currentStatus.mode = response.mode;
                currentStatus.safetyLevel = response.safetyLevel;
                updateUI();
                showNotification(`Mode changed to ${newMode}`);
            }
        });
    });
}

async function confirmModeChange(mode) {
    const messages = {
        advanced: `
            <strong>Advanced Mode</strong><br><br>
            This mode enables enhanced automation capabilities including:
            <ul style="text-align: left; margin: 10px 0;">
                <li>Challenge assistance</li>
                <li>CAPTCHA solving (with confirmation)</li>
                <li>Intelligent timing optimization</li>
            </ul>
            <strong>You are responsible for ensuring you have authorization to use these features.</strong><br><br>
            Continue?
        `,
        research: `
            <strong>Research Mode</strong><br><br>
            This mode provides full automation capabilities for security research.<br><br>
            <strong style="color: #F44336;">WARNING:</strong> Use only on systems you own or have written authorization to test.<br><br>
            <strong>Misuse may result in criminal prosecution.</strong><br><br>
            All actions will be logged for audit purposes.<br><br>
            Continue?
        `
    };
    
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 8px;
            max-width: 350px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;
        
        dialog.innerHTML = `
            <div style="margin-bottom: 20px; line-height: 1.5;">
                ${messages[mode]}
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="cancel-btn" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                    Cancel
                </button>
                <button id="confirm-btn" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Accept
                </button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        dialog.querySelector('#confirm-btn').onclick = () => {
            overlay.remove();
            resolve(true);
        };
        
        dialog.querySelector('#cancel-btn').onclick = () => {
            overlay.remove();
            resolve(false);
        };
    });
}

function showTermsNotice() {
    document.getElementById('terms-notice').style.display = 'block';
    document.getElementById('main-content').style.display = 'none';
}

function showMainContent() {
    document.getElementById('terms-notice').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
}

async function showTerms() {
    // Open terms in new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('TERMS_OF_SERVICE.md')
    });
    
    // Show acceptance dialog
    setTimeout(async () => {
        const accepted = await confirmTerms();
        if (accepted) {
            const response = await sendMessage('ACCEPT_TERMS', { accepted: true });
            if (response.success) {
                currentStatus.termsAccepted = true;
                showMainContent();
                showNotification('Terms accepted. Welcome to EchoNate!');
            }
        }
    }, 1000);
}

async function confirmTerms() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 8px;
            max-width: 350px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;
        
        dialog.innerHTML = `
            <div style="margin-bottom: 20px;">
                <strong style="font-size: 16px;">Accept Terms of Service?</strong><br><br>
                By accepting, you agree to:
                <ul style="text-align: left; margin: 10px 0; font-size: 13px;">
                    <li>Use EchoNate only for authorized purposes</li>
                    <li>Comply with all applicable laws</li>
                    <li>Respect website Terms of Service</li>
                    <li>Accept full responsibility for your actions</li>
                </ul>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="decline-btn" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                    Decline
                </button>
                <button id="accept-btn" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Accept
                </button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        dialog.querySelector('#accept-btn').onclick = () => {
            overlay.remove();
            resolve(true);
        };
        
        dialog.querySelector('#decline-btn').onclick = () => {
            overlay.remove();
            resolve(false);
        };
    });
}

function openSettings() {
    chrome.runtime.openOptionsPage();
}

async function exportAudit() {
    const response = await sendMessage('EXPORT_AUDIT');
    
    if (response.success) {
        // Create download
        const blob = new Blob([JSON.stringify(response.auditLog, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `echonate-audit-${Date.now()}.json`;
        a.click();
        
        showNotification('Audit log exported');
    } else {
        showNotification('Audit logging is disabled', 'error');
    }
}

function viewTerms() {
    chrome.tabs.create({
        url: chrome.runtime.getURL('TERMS_OF_SERVICE.md')
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#4CAF50' : '#F44336'};
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 2000;
        font-size: 14px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

async function sendMessage(action, data = {}) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action, ...data },
            (response) => resolve(response)
        );
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initialize);
