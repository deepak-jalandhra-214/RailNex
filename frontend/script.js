const API_BASE = 'http://127.0.0.1:8000';

// Ring constants — circumference of r=80 circle
const RING_CIRCUMFERENCE = 2 * Math.PI * 80; // ~502.65

// DOM Elements
const screens = {
    verify: document.getElementById('verify-section'),
    plan: document.getElementById('plan-section'),
    active: document.getElementById('active-section'),
    expired: document.getElementById('expired-section')
};

const elements = {
    pnrInput: document.getElementById('pnr-input'),
    verifyBtn: document.getElementById('verify-btn'),
    verifyError: document.getElementById('verify-error'),
    
    planSource: document.getElementById('plan-source'),
    planDestination: document.getElementById('plan-destination'),
    planDistance: document.getElementById('plan-distance'),
    planPrice: document.getElementById('plan-price'),
    planValidity: document.getElementById('plan-validity'),
    activateBtn: document.getElementById('activate-btn'),
    
    activeSource: document.getElementById('active-source'),
    activeDestination: document.getElementById('active-destination'),
    countdownTimer: document.getElementById('countdown-timer'),
    extendActiveBtn: document.getElementById('extend-active-btn'),
    
    extendExpiredBtn: document.getElementById('extend-expired-btn'),
    
    paymentModal: document.getElementById('payment-modal'),
    paymentAmountDisplay: document.getElementById('payment-amount-display'),
    confirmPaymentBtn: document.getElementById('confirm-payment-btn'),
    cancelPaymentBtn: document.getElementById('cancel-payment-btn'),
    paymentLoader: document.getElementById('payment-loader')
};

// State
let currentPNR = null;
let currentPrice = 0;
let currentAction = null; // 'activate' or 'extend'
let timerInterval = null;
let sessionTotalSeconds = 0; // tracks original session duration for ring

// Initialize
function init() {
    // Check localStorage for active session
    const savedPNR = localStorage.getItem('railnex_pnr');
    if (savedPNR) {
        currentPNR = savedPNR;
        checkStatus();
    }

    // Event Listeners
    elements.verifyBtn.addEventListener('click', handleVerify);
    elements.activateBtn.addEventListener('click', () => initiatePayment(currentPrice, 'activate'));
    elements.extendActiveBtn.addEventListener('click', () => initiatePayment(10, 'extend'));
    elements.extendExpiredBtn.addEventListener('click', () => initiatePayment(10, 'extend'));
    
    elements.confirmPaymentBtn.addEventListener('click', processPayment);
    elements.cancelPaymentBtn.addEventListener('click', closePaymentModal);

    // Demo chip click-to-fill
    document.querySelectorAll('.demo-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            elements.pnrInput.value = chip.dataset.pnr;
            elements.pnrInput.focus();
        });
    });
}

// Show specific screen and hide others
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active', 'hidden'));
    Object.values(screens).forEach(screen => {
        if(screen !== screens[screenName]) screen.classList.add('hidden');
    });
    screens[screenName].classList.add('active');
}

// API Calls
async function handleVerify() {
    const pnr = elements.pnrInput.value.trim();
    if (!pnr) {
        showError('Please enter a valid PNR');
        return;
    }

    elements.verifyBtn.textContent = 'VERIFYING...';
    elements.verifyBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/verify-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pnr })
        });
        
        const data = await res.json();
        
        if (data.valid) {
            currentPNR = pnr;
            currentPrice = data.price;
            
            elements.planSource.textContent = data.source;
            elements.planDestination.textContent = data.destination;
            elements.planDistance.textContent = `${data.distance} km`;
            elements.planPrice.textContent = `₹${data.price}`;
            elements.planValidity.textContent = `${data.validity_minutes} minutes`;
            
            elements.verifyError.classList.add('hidden');
            
            // Check if it's already active before showing plan screen
            await checkStatus();
            
        } else {
            showError(data.message || 'Verification failed');
        }
    } catch (error) {
        showError('Network error. Ensure backend is running.');
    } finally {
        elements.verifyBtn.textContent = 'VERIFY TICKET';
        elements.verifyBtn.disabled = false;
    }
}

async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/status?pnr=${currentPNR}`);
        const data = await res.json();
        
        if (data.status === 'active') {
            startTimer(data.expiry_time);
            
            // Try fetching journey info if we just loaded from localStorage
            if(!elements.activeSource.textContent || elements.activeSource.textContent === 'Delhi') {
                await fetchJourneyInfo();
            }
            showScreen('active');
        } else if (data.status === 'expired') {
            showScreen('expired');
        } else {
            showScreen('plan');
        }
    } catch (error) {
        console.error("Status check failed", error);
        // Fallback: If offline but we have data, we might show cached data, 
        // but for this prototype, we just go to verify screen on fail if no active timer is running.
        if(!timerInterval) {
            showScreen('verify');
        }
    }
}

async function fetchJourneyInfo() {
    try {
        const res = await fetch(`${API_BASE}/verify-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pnr: currentPNR })
        });
        const data = await res.json();
        if(data.valid) {
            elements.activeSource.textContent = data.source;
            elements.activeDestination.textContent = data.destination;
        }
    } catch(e) {
        console.error("Failed to fetch journey info for active plan", e);
    }
}

// Payment Flow
function initiatePayment(amount, action) {
    currentAction = action;
    
    // Free plan bypasses payment
    if (amount === 0 && action === 'activate') {
        executeAction();
        return;
    }
    
    elements.paymentAmountDisplay.textContent = `₹${amount}`;
    elements.paymentModal.classList.remove('hidden');
}

function closePaymentModal() {
    elements.paymentModal.classList.add('hidden');
    elements.paymentLoader.classList.add('hidden');
    elements.confirmPaymentBtn.classList.remove('hidden');
}

async function processPayment() {
    elements.confirmPaymentBtn.classList.add('hidden');
    elements.paymentLoader.classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_BASE}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                pnr: currentPNR,
                amount: currentAction === 'extend' ? 10 : currentPrice
            })
        });
        const data = await res.json();
        
        if (data.success) {
            await executeAction();
        } else {
            alert('Payment failed');
        }
    } catch (error) {
        alert('Network error during payment');
    } finally {
        closePaymentModal();
    }
}

async function executeAction() {
    const endpoint = currentAction === 'activate' ? '/activate' : '/extend';
    
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pnr: currentPNR })
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('railnex_pnr', currentPNR);
            
            if (currentAction === 'activate') {
                // Copy journey details to active screen
                elements.activeSource.textContent = elements.planSource.textContent;
                elements.activeDestination.textContent = elements.planDestination.textContent;
            }
            
            startTimer(data.expiry_time || data.new_expiry_time);
            showScreen('active');
        }
    } catch (error) {
        alert('Failed to apply plan');
    }
}

// Timer Logic
function startTimer(expiryTimestamp) {
    if (timerInterval) clearInterval(timerInterval);

    // Capture total session seconds for ring animation
    const now = Math.floor(Date.now() / 1000);
    sessionTotalSeconds = Math.max(expiryTimestamp - now, 1);
    setRingProgress(1); // start full
    
    updateTimerDisplay(expiryTimestamp);
    
    timerInterval = setInterval(() => {
        const isExpired = updateTimerDisplay(expiryTimestamp);
        if (isExpired) {
            clearInterval(timerInterval);
            timerInterval = null;
            setRingProgress(0);
            showScreen('expired');
            checkStatus();
        }
    }, 1000);
}

// Update SVG ring progress (fraction 0–1)
function setRingProgress(fraction) {
    const ring = document.getElementById('timer-ring');
    if (!ring) return;
    const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    ring.style.strokeDashoffset = offset;
    ring.style.strokeDasharray = RING_CIRCUMFERENCE;
}

function updateTimerDisplay(expiryTimestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = expiryTimestamp - now;
    
    if (diff <= 0) {
        elements.countdownTimer.textContent = '00:00:00';
        return true; // Expired
    }
    
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(diff % 60).toString().padStart(2, '0');
    
    elements.countdownTimer.textContent = `${h}:${m}:${s}`;

    // Update ring
    if (sessionTotalSeconds > 0) {
        setRingProgress(diff / sessionTotalSeconds);
    }

    return false; // Still active
}

function showError(msg) {
    elements.verifyError.textContent = msg;
    elements.verifyError.classList.remove('hidden');
}

// Start app
init();
