// ============================================================
// SepsisPulse — app.js
// Features: SHAP explainability, PDF report, threshold sim,
//           physiological validation, patient history
// ============================================================

// --- Physiological validation config ---
const VALIDATION_RULES = {
    gestational_age_weeks: { min: 20, max: 45, label: 'Gestational Age', unit: 'wks',
        warn: [23, 43], warnMsg: 'Unusual range — please verify.' },
    birth_weight_kg: { min: 0.3, max: 6, label: 'Birth Weight', unit: 'kg',
        warn: [0.5, 5], warnMsg: 'Extreme value — double-check entry.' },
    maternal_age: { min: 10, max: 60, label: 'Maternal Age', unit: 'yrs',
        warn: [13, 55], warnMsg: 'Uncommon maternal age — please verify.' },
    apgar_1min: { min: 0, max: 10, label: 'Apgar 1 min', unit: '',
        warn: null, warnMsg: '' },
    apgar_5min: { min: 0, max: 10, label: 'Apgar 5 min', unit: '',
        warn: null, warnMsg: '' },
};

// --- Store last prediction for threshold sim ---
let lastProbability = null;

document.addEventListener("DOMContentLoaded", () => {

    // Feature 4: Real-time physiological validation
    Object.entries(VALIDATION_RULES).forEach(([fieldId, rules]) => {
        const input = document.getElementById(fieldId);
        const warnSpan = document.getElementById(`warn-${fieldId}`);
        if (!input || !warnSpan) return;

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            input.classList.remove('warn-border', 'error-border');
            warnSpan.textContent = '';

            if (isNaN(v) || input.value === '') return;

            if (v < rules.min || v > rules.max) {
                input.classList.add('error-border');
                warnSpan.textContent = `⚠ Outside physiological range (${rules.min}–${rules.max} ${rules.unit})`;
            } else if (rules.warn && (v < rules.warn[0] || v > rules.warn[1])) {
                input.classList.add('warn-border');
                warnSpan.textContent = `ⓘ ${rules.warnMsg}`;
            }
        });
    });

    // Form submission
    const form = document.getElementById("prediction-form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById("submit-btn");
        const loader = document.getElementById("btn-loader");
        const btnText = submitBtn.querySelector("span");
        const errorText = document.getElementById("form-error");

        errorText.textContent = "";

        const payload = {
            gestational_age_weeks: parseFloat(document.getElementById("gestational_age_weeks").value),
            birth_weight_kg: parseFloat(document.getElementById("birth_weight_kg").value),
            low_birth_weight: document.getElementById("low_birth_weight").checked,
            very_low_birth_weight: document.getElementById("very_low_birth_weight").checked,
            maternal_age: parseFloat(document.getElementById("maternal_age").value),
            young_mother: document.getElementById("young_mother").checked,
            prom: document.getElementById("prom").checked,
            maternal_infection: document.getElementById("maternal_infection").checked,
            delivery_mode: document.getElementById("delivery_mode").value,
            apgar_1min: parseInt(document.getElementById("apgar_1min").value, 10),
            apgar_5min: parseInt(document.getElementById("apgar_5min").value, 10),
            resuscitation_needed: document.getElementById("resuscitation_needed").checked,
        };

        submitBtn.disabled = true;
        btnText.style.display = "none";
        loader.style.display = "block";

        try {
            const response = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                errorText.textContent = `Error: ${data.error}`;
            } else {
                displayResults(data);
                saveAssessment(data, payload);
                showScreen("results");
            }

        } catch (err) {
            errorText.textContent = "Failed to connect to the server. Please ensure it is running.";
            console.error(err);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = "inline";
            loader.style.display = "none";
        }
    });
});

// --- Screen Navigation ---
window.showScreen = function(screenId) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) target.classList.add("active");

    if (screenId === 'history-screen') renderHistory();
};

// --- Feature 1: Display results with SHAP impact ---
function displayResults(data) {
    const riskStatus = document.getElementById("risk-status");
    const riskBadge = document.getElementById("risk-badge");
    const riskCircle = document.getElementById("risk-display-circle");
    const probPercentageText = document.getElementById("prob-percentage");

    lastProbability = data.risk_probability;
    const percentage = (data.risk_probability * 100).toFixed(1);
    const degrees = (data.risk_probability * 360).toFixed(0);
    const color = data.is_high_risk ? "#ef4444" : "#10b981";

    riskCircle.style.background = `conic-gradient(${color} ${degrees}deg, rgba(0,0,0,0.08) 0deg)`;

    let currentVal = 0;
    const interval = setInterval(() => {
        if (currentVal >= percentage) {
            probPercentageText.textContent = percentage + "%";
            clearInterval(interval);
        } else {
            currentVal += 1;
            probPercentageText.textContent = Math.min(currentVal, percentage).toFixed(0) + "%";
        }
    }, 15);

    if (data.is_high_risk) {
        riskStatus.textContent = "High Sepsis Risk Detected";
        riskStatus.style.color = "#ef4444";
        riskBadge.className = "risk-badge high";
        riskBadge.textContent = "High Risk";
    } else {
        riskStatus.textContent = "Low Risk Assessment";
        riskStatus.style.color = "#10b981";
        riskBadge.className = "risk-badge low";
        riskBadge.textContent = "Minimal Risk";
    }

    // Render SHAP impact bars
    renderImpactBars(data.contributions || []);

    // Set print timestamp
    const ts = document.getElementById('print-timestamp');
    if (ts) ts.textContent = `Generated: ${new Date().toLocaleString()}`;
}

// --- Feature 1: SHAP Bar Renderer ---
function renderImpactBars(contributions) {
    const list = document.getElementById('impact-list');
    const box = document.getElementById('impact-analysis');
    if (!list) return;

    list.innerHTML = '';

    if (!contributions || contributions.length === 0) {
        box.style.display = 'none';
        return;
    }

    box.style.display = 'block';
    const maxAbs = Math.max(...contributions.map(c => Math.abs(c.value)), 0.01);

    setTimeout(() => {
        contributions.forEach(c => {
            const isRisk = c.value > 0;
            const pct = Math.round((Math.abs(c.value) / maxAbs) * 100);
            const color = isRisk ? 'risk' : 'safe';
            const sign = isRisk ? '+' : '−';
            const valStr = `${sign}${Math.abs(c.value).toFixed(3)}`;

            const row = document.createElement('div');
            row.className = 'impact-bar-row';
            row.innerHTML = `
                <span class="impact-bar-label">${c.feature}</span>
                <div class="impact-bar-track">
                    <div class="impact-bar-fill ${color}" style="width:0%" data-pct="${pct}"></div>
                </div>
                <span class="impact-bar-val" style="color:${isRisk ? '#ef4444' : '#10b981'}">${valStr}</span>
            `;
            list.appendChild(row);
        });

        // Animate bars after DOM paint
        requestAnimationFrame(() => {
            list.querySelectorAll('.impact-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.pct + '%';
            });
        });
    }, 300);
}

// --- Feature 2: Print Report ---
window.printReport = function() {
    const ts = document.getElementById('print-timestamp');
    if (ts) ts.textContent = `Generated: ${new Date().toLocaleString()}`;
    window.print();
};

// --- Feature 5: Save Assessment to localStorage ---
function saveAssessment(data, inputs) {
    const history = JSON.parse(localStorage.getItem('sepsisPulse_history') || '[]');
    history.unshift({
        timestamp: new Date().toISOString(),
        probability: data.risk_probability,
        is_high_risk: data.is_high_risk,
        gestational_age_weeks: inputs.gestational_age_weeks,
        birth_weight_kg: inputs.birth_weight_kg,
        delivery_mode: inputs.delivery_mode,
    });
    localStorage.setItem('sepsisPulse_history', JSON.stringify(history.slice(0, 5)));
}

// --- Feature 5: Render History Screen ---
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem('sepsisPulse_history') || '[]');
    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = `
            <div class="history-empty glass">
                <i class="fa-solid fa-folder-open"></i>
                <p>No assessments yet.<br>Run your first prediction to see it here.</p>
            </div>`;
        return;
    }

    history.forEach((item, idx) => {
        const riskClass = item.is_high_risk ? 'high' : 'low';
        const riskLabel = item.is_high_risk ? 'High Risk' : 'Minimal Risk';
        const pct = (item.probability * 100).toFixed(1);
        const date = new Date(item.timestamp).toLocaleString();
        const card = document.createElement('div');
        card.className = `history-card glass ${riskClass}`;
        card.innerHTML = `
            <div>
                <strong>Assessment #${idx + 1}</strong>
                <div class="history-meta">GA: ${item.gestational_age_weeks}w · BW: ${item.birth_weight_kg}kg · ${item.delivery_mode}</div>
                <div class="history-meta">${date}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:1.5rem;font-weight:800;">${pct}%</div>
                <span class="history-risk-badge ${riskClass}">${riskLabel}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- Feature 5: Clear History ---
window.clearHistory = function() {
    localStorage.removeItem('sepsisPulse_history');
    renderHistory();
};

// --- Tab Switcher ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
    const btn = document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`);
    if (btn) btn.classList.add('active');
};

// --- Reset App ---
window.resetApp = function() {
    document.getElementById("prediction-form").reset();
    lastProbability = null;
    Object.keys(VALIDATION_RULES).forEach(id => {
        const input = document.getElementById(id);
        const warn = document.getElementById(`warn-${id}`);
        if (input) input.classList.remove('warn-border', 'error-border');
        if (warn) warn.textContent = '';
    });
    const riskCircle = document.getElementById("risk-display-circle");
    if (riskCircle) riskCircle.style.background = `conic-gradient(var(--primary) 0deg, rgba(0,0,0,0.08) 0deg)`;
    showScreen('assessment');
};
