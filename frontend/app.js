(function () {
  const connectBtn = document.getElementById("connect-account-btn");
  const runAuditBtn = document.getElementById("run-audit-btn");

  if (!connectBtn || !runAuditBtn) {
    return;
  }

  const brokerServerInput = document.getElementById("broker-server");
  const accountLoginInput = document.getElementById("account-login");
  const investorPasswordInput = document.getElementById("investor-password");
  const dateFromInput = document.getElementById("date-from");
  const dateToInput = document.getElementById("date-to");

  const accountStatusValue = document.getElementById("account-status-value");
  const selectedRangeValue = document.getElementById("selected-range-value");
  const totalTradesValue = document.getElementById("total-trades-value");

  const winRateValue = document.getElementById("win-rate-value");
  const profitFactorValue = document.getElementById("profit-factor-value");
  const maxDrawdownValue = document.getElementById("max-drawdown-value");

  const earlyExitsValue = document.getElementById("early-exits-value");
  const slViolationsValue = document.getElementById("sl-violations-value");
  const overtradingRiskValue = document.getElementById("overtrading-risk-value");
  const auditNotesValue = document.getElementById("audit-notes-value");

  connectBtn.addEventListener("click", function () {
    const hasRequiredFields =
      brokerServerInput &&
      brokerServerInput.value.trim() &&
      accountLoginInput &&
      accountLoginInput.value.trim() &&
      investorPasswordInput &&
      investorPasswordInput.value.trim();

    if (accountStatusValue) {
      accountStatusValue.textContent = hasRequiredFields
        ? "Connected (Demo)"
        : "Missing Required Fields";
    }
  });

  runAuditBtn.addEventListener("click", function () {
    const dateFrom = dateFromInput ? dateFromInput.value : "";
    const dateTo = dateToInput ? dateToInput.value : "";

    if (dateFrom && dateTo) {
      if (selectedRangeValue) {
        selectedRangeValue.textContent = dateFrom + " \u2192 " + dateTo;
      }

      if (totalTradesValue) {
        totalTradesValue.textContent = "24";
      }

      if (winRateValue) {
        winRateValue.textContent = "46%";
      }
      if (profitFactorValue) {
        profitFactorValue.textContent = "1.34";
      }
      if (maxDrawdownValue) {
        maxDrawdownValue.textContent = "8.7%";
      }

      if (earlyExitsValue) {
        earlyExitsValue.textContent = "3";
      }
      if (slViolationsValue) {
        slViolationsValue.textContent = "1";
      }
      if (overtradingRiskValue) {
        overtradingRiskValue.textContent = "Low";
      }

      if (auditNotesValue) {
        auditNotesValue.textContent =
          "Demo audit completed. Account performance looks stable, but early exits should be reviewed.";
      }
    } else {
      if (selectedRangeValue) {
        selectedRangeValue.textContent = "Invalid date range";
      }
      if (auditNotesValue) {
        auditNotesValue.textContent =
          "Please select both Date From and Date To before running audit.";
      }
    }
  });
})();
