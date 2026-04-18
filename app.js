document.addEventListener("DOMContentLoaded", () => {
    // Navigation handling
    const startBtn = document.getElementById("start-btn");
    startBtn.addEventListener("click", () => {
        showScreen("assessment");
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

        // Collect inputs
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

        // Loading State
        submitBtn.disabled = true;
        btnText.style.display = "none";
        loader.style.display = "block";

        try {
            const response = await fetch("/api/predict", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                errorText.textContent = `Error: ${data.error}`;
            } else {
                displayResults(data);
                showScreen("results");
            }
            
        } catch (err) {
            errorText.textContent = "Failed to connect to the server.";
            console.error(err);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = "inline";
            loader.style.display = "none";
        }
    });
});

window.showScreen = function(screenId) {
    document.querySelectorAll(".screen").forEach(el => {
        el.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
};

function displayResults(data) {
    const riskStatus = document.getElementById("risk-status");
    const riskBadge = document.getElementById("risk-badge");
    const riskIcon = document.getElementById("risk-icon");
    const probFill = document.getElementById("prob-fill");
    const probPercentage = document.getElementById("prob-percentage");
    const probContainer = document.querySelector(".prob-container");

    const percentage = (data.risk_probability * 100).toFixed(1);
    
    // Animate percentage text and bar
    setTimeout(() => {
        probFill.style.width = percentage + "%";
        probPercentage.textContent = percentage + "%";
    }, 100);

    probContainer.className = "prob-container"; // reset
    riskBadge.className = "risk-badge";

    if (data.is_high_risk) {
        riskStatus.textContent = "High Risk of Sepsis Detected";
        riskStatus.style.color = "var(--danger)";
        riskBadge.classList.add("high");
        riskIcon.className = "fa-solid fa-triangle-exclamation";
        probContainer.classList.add("high-risk-segment");
    } else {
        riskStatus.textContent = "Low Risk / Negative";
        riskStatus.style.color = "var(--success)";
        riskBadge.classList.add("low");
        riskIcon.className = "fa-solid fa-check";
        probContainer.classList.add("low-risk-segment");
    }
}

window.resetApp = function() {
    document.getElementById("prediction-form").reset();
    document.getElementById("prob-fill").style.width = "0%";
    showScreen('assessment');
};
