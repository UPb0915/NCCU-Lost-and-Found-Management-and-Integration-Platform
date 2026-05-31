let currentUser = null;
let latestReports = [];
let authMode = "login";
let lastRecommendations = [];
let isAdmin = false;
let currentConversation = null;
let currentDetailReport = null;
let currentDetailRecommendations = [];
let currentDetailFromMine = false;
let latestNotifications = [];
let adminUserPanelMode = "suspicious";
let locationAreas = [];
let locationDetailsByArea = {};
const APP_BASE_URL = (() => {
  const origin = window.location.origin;
  if (origin && origin !== "null") {
    return origin;
  }

  return "http://127.0.0.1:5000";
})();

let globalLoadingCount = 0;

function ensureGlobalLoadingOverlay() {
  let overlay = document.getElementById("globalLoadingOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "globalLoadingOverlay";
    overlay.className = "global-loading-overlay";
    overlay.innerHTML = `
      <div class="global-loading-box" role="status" aria-live="polite">
        <div class="global-loading-spinner"></div>
        <div id="globalLoadingText" class="global-loading-text">處理中，請稍後...</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  return overlay;
}

function showGlobalLoading(message = "處理中，請稍後...") {
  globalLoadingCount += 1;

  const overlay = ensureGlobalLoadingOverlay();
  const text = document.getElementById("globalLoadingText");

  if (text) {
    text.textContent = message;
  }

  overlay.classList.add("show");
}

function hideGlobalLoading() {
  globalLoadingCount = Math.max(0, globalLoadingCount - 1);

  if (globalLoadingCount > 0) {
    return;
  }

  const overlay = document.getElementById("globalLoadingOverlay");

  if (overlay) {
    overlay.classList.remove("show");
  }
}

function flashButton(button) {
  if (!button) {
    return;
  }

  button.classList.remove("button-flash");
  void button.offsetWidth;
  button.classList.add("button-flash");

  window.setTimeout(() => {
    button.classList.remove("button-flash");
  }, 600);
}

function handleGlobalButtonFlash(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button, .btn");

  if (!button || button.id === "reloadBtn" || ("disabled" in button && button.disabled)) {
    return;
  }

  if (event.type === "click" && button.classList.contains("button-flash")) {
    return;
  }

  flashButton(button);
}

function setupGlobalButtonFeedback() {
  document.addEventListener("pointerdown", handleGlobalButtonFlash);
  document.addEventListener("click", handleGlobalButtonFlash);
}

async function runWithLoading(callback, options = {}) {
  const {
    message = "處理中，請稍後...",
    button = null,
    useOverlay = true,
  } = options;

  flashButton(button);

  if (button) {
    button.classList.add("is-loading");
  }

  if (useOverlay) {
    showGlobalLoading(message);
  }

  try {
    return await callback();
  } finally {
    if (button) {
      button.classList.remove("is-loading");
    }

    if (useOverlay) {
      hideGlobalLoading();
    }
  }
}

function bindLoadingClick(buttonId, handler, options = {}) {
  const button = document.getElementById(buttonId);

  if (!button) {
    return;
  }

  button.addEventListener("click", async (event) => {
    await runWithLoading(
      () => handler(event),
      {
        button: event.currentTarget,
        ...options,
      }
    );
  });
}

function bindLoadingSubmit(formId, handler, options = {}) {
  const form = document.getElementById(formId);

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    await runWithLoading(
      () => handler(event),
      {
        button: event.submitter || form.querySelector('button[type="submit"]'),
        ...options,
      }
    );
  });
}

function roleLabel(role) {
  if (role === "student") return "本校學生";
  if (role === "staff") return "教職員";
  if (role === "outsider") return "外校人士";
  return "使用者";
}

function typeLabel(type) {
  if (type === "F") return "拾獲物";
  if (type === "L") return "遺失物";
  return type || "未知類型";
}

function getReportLocationDisplay(report) {
  const areaName = report?.area_name || "";
  const detailName = report?.detail_name || "";
  const locationName = report?.location_name || "";

  if (areaName && detailName) {
    return `${areaName} / ${detailName}`;
  }

  if (areaName) {
    return areaName;
  }

  return locationName || "未填寫地點";
}

const BUSINESS_DETAIL_AREAS = [
  { key: "main_gate", name: "大門", left: 50.5, top: 93.5, width: 18.5, height: 5.5 },
  { key: "management_room", name: "管理員室", left: 35.0, top: 93.5, width: 11.0, height: 5.5 },
  { key: "260101", name: "260101", left: 7.0, top: 93.2, width: 11.5, height: 5.8 },
  { key: "260102", name: "260102", left: 18.8, top: 93.2, width: 12.5, height: 5.8 },
  { key: "260105", name: "260105", left: 18.8, top: 82.0, width: 12.5, height: 6.8 },
  { key: "260106", name: "260106", left: 7.0, top: 82.0, width: 11.5, height: 6.8 },
  { key: "260201", name: "260201", left: 7.0, top: 70.5, width: 11.5, height: 6.6 },
  { key: "260202", name: "260202", left: 18.8, top: 70.5, width: 12.5, height: 6.6 },
  { key: "260204", name: "260204", left: 82.0, top: 57.8, width: 15.0, height: 8.0 },
  { key: "260205", name: "260205", left: 82.0, top: 46.8, width: 15.0, height: 7.2 },
  { key: "260206", name: "260206", left: 18.8, top: 46.8, width: 12.5, height: 7.2 },
  { key: "260207", name: "260207", left: 7.0, top: 46.8, width: 11.5, height: 7.2 },
  { key: "260209", name: "260209", left: 18.8, top: 57.8, width: 12.5, height: 8.0 },
  { key: "260210", name: "260210", left: 7.0, top: 57.8, width: 11.5, height: 8.0 },
  { key: "teacher_lounge_2f", name: "教師休息室", left: 7.0, top: 53.5, width: 11.5, height: 4.0 },
  { key: "260301", name: "260301", left: 7.0, top: 36.3, width: 11.5, height: 7.0 },
  { key: "260302", name: "260302", left: 18.8, top: 36.3, width: 12.5, height: 7.0 },
  { key: "260303", name: "260303 & EMBA", left: 43.5, top: 36.3, width: 12.5, height: 7.0 },
  { key: "260304", name: "260304", left: 56.5, top: 36.3, width: 14.5, height: 7.0 },
  { key: "260305", name: "260305", left: 82.0, top: 36.3, width: 15.0, height: 7.0 },
  { key: "260306", name: "260306", left: 91.5, top: 25.8, width: 5.8, height: 14.0 },
  { key: "260307", name: "260307", left: 82.0, top: 25.2, width: 15.0, height: 7.5 },
  { key: "260308", name: "260308", left: 56.5, top: 25.2, width: 14.5, height: 7.5 },
  { key: "260309", name: "260309", left: 43.5, top: 25.2, width: 12.5, height: 7.5 },
  { key: "260310", name: "260310", left: 82.0, top: 14.4, width: 15.0, height: 8.0 },
  { key: "260311", name: "260311", left: 82.0, top: 5.2, width: 15.0, height: 8.2 },
  { key: "260312", name: "260312", left: 18.8, top: 5.2, width: 12.5, height: 8.2 },
  { key: "260313", name: "260313", left: 7.0, top: 5.2, width: 11.5, height: 8.2 },
  { key: "260314", name: "260314", left: 7.0, top: 14.8, width: 11.5, height: 9.0 },
  { key: "260315", name: "260315", left: 18.8, top: 14.8, width: 12.5, height: 9.0 },
  { key: "260316", name: "260316", left: 7.0, top: 25.2, width: 24.2, height: 7.5 },
  { key: "office_12f", name: "院系辦公室及研究室", left: 18.8, top: 0.5, width: 78.0, height: 4.8 },
];

function findBusinessDetailArea(detailKey) {
  return BUSINESS_DETAIL_AREAS.find((area) => area.key === detailKey) || null;
}

function resolveReportBuildingArea(report) {
  if (!report) {
    return null;
  }

  if (report.area_key) {
    const matchedArea = BUILDING_AREAS.find((area) => area.key === report.area_key);
    if (matchedArea) {
      return matchedArea;
    }
  }

  return findBuildingAreaByLocation(`${report.location_name || ""} ${report.building || ""} ${report.note || ""}`);
}

function getBusinessMarkerPosition(detailKey, index, total) {
  const area = findBusinessDetailArea(detailKey);

  if (!area) {
    return null;
  }

  if (total <= 1) {
    return {
      x: area.left + area.width / 2,
      y: area.top + area.height / 2,
    };
  }

  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const xGap = area.width / (cols + 1);
  const yGap = area.height / (rows + 1);

  return {
    x: area.left + xGap * (col + 1),
    y: area.top + yGap * (row + 1),
  };
}

function renderBusinessDetailAreas() {
  return BUSINESS_DETAIL_AREAS.map((area) => {
    return `
      <button
        type="button"
        class="business-detail-area"
        style="left: ${area.left}%; top: ${area.top}%; width: ${area.width}%; height: ${area.height}%;"
        title="${escapeHtml(area.name)}"
      >
        <span>${escapeHtml(area.name)}</span>
      </button>
    `;
  }).join("");
}

function renderBusinessMapMarkers(businessReports) {
  const grouped = {};

  businessReports.forEach((report) => {
    const detailKey = report.detail_key && report.detail_key !== "all" ? report.detail_key : "main_gate";

    if (!grouped[detailKey]) {
      grouped[detailKey] = [];
    }

    grouped[detailKey].push(report);
  });

  return Object.entries(grouped).map(([detailKey, reports]) => {
    return reports.map((report, index) => {
      const position = getBusinessMarkerPosition(detailKey, index, reports.length);

      if (!position) {
        return "";
      }

      const typeClass = report.type === "F" ? "found" : "lost";
      const typeText = report.type === "F" ? "拾" : "遺";

      return `
        <button
          type="button"
          class="business-map-marker map-pin ${typeClass}"
          style="left: ${position.x}%; top: ${position.y}%;"
          title="${escapeHtml(report.item_name || "")}" onclick="openReportFromMap(${report.report_id})">
          ${typeText}
        </button>
      `;
    }).join("");
  }).join("");
}

function openReportFromMap(reportId) {
  const report = latestReports.find((item) => String(item.report_id) === String(reportId));

  if (!report) {
    alert("找不到這筆通報");
    return;
  }

  showDetailView(report);
}

function renderMapPins(reports) {
  const visibleReports = reports.filter(shouldShowReportOnMap);

  renderBuildingAreas(visibleReports);

  const mapPins = document.getElementById("mapPins");
  if (!mapPins) {
    return;
  }

  mapPins.innerHTML = "";

  const groupedReports = groupReportsByArea(visibleReports);

  visibleReports.forEach((report) => {
    const area = resolveReportBuildingArea(report);
    let position;

    if (area) {
      const group = groupedReports[area.key] || [];
      const index = group.findIndex((item) => String(item.report_id) === String(report.report_id));
      position = getDistributedPosition(area, index, group.length);
    } else {
      position = {
        x: report.map_x || 50,
        y: report.map_y || 50,
      };
    }

    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-pin";
    pin.style.left = `${position.x}%`;
    pin.style.top = `${position.y}%`;
    pin.title = `${report.item_name}｜${getReportLocationDisplay(report)}`;
    pin.textContent = report.type === "F" ? "拾" : "遺";

    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      showDetailView(report);
    });

    mapPins.appendChild(pin);
  });
}

function renderBuildingAreas(reports) {
  const mapRegions = document.getElementById("mapRegions");

  if (!mapRegions) {
    return;
  }

  mapRegions.innerHTML = "";

  BUILDING_AREAS.forEach((area) => {
    const relatedReports = reports.filter((report) => {
      const matchedArea = resolveReportBuildingArea(report);
      return matchedArea && matchedArea.key === area.key;
    });

    const regionEl = document.createElement("button");
    regionEl.type = "button";
    regionEl.className = "map-region";
    regionEl.style.left = `${area.left}%`;
    regionEl.style.top = `${area.top}%`;
    regionEl.style.width = `${area.width}%`;
    regionEl.style.height = `${area.height}%`;

    regionEl.innerHTML = `
      <span class="map-region-label">
        ${area.name}｜${relatedReports.length} 筆通報
      </span>
    `;

    regionEl.addEventListener("click", () => {
      showBuildingMapView(area, relatedReports);
    });

    mapRegions.appendChild(regionEl);
  });
}

function groupReportsByArea(reports) {
  const grouped = {};

  reports.forEach((report) => {
    const area = resolveReportBuildingArea(report);

    if (!area) {
      return;
    }

    if (!grouped[area.key]) {
      grouped[area.key] = [];
    }

    grouped[area.key].push(report);
  });

  return grouped;
}

document.addEventListener("DOMContentLoaded", async () => {
  const savedUser = localStorage.getItem("currentUser");

  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (error) {
      localStorage.removeItem("currentUser");
    }
  }

  setTodayDate();
  setupGlobalButtonFeedback();
  bindEvents();

  await loadOptions();
  await loadLocationAreas();

  // 首頁通報列表：不套用篩選，所以已處理 / 已認領仍會顯示
  await loadReports(false, false);

  updateLoginUI();
  updateReportTypeFields();
  updateQuickIdentityFields();
  updateAuthIdentityFields();

  if (currentUser) {
    await loadNotifications();
  }
});

function bindEvents() {
  bindLoadingClick("quickLoginBtn", quickLogin, { message: "登入中，請稍後..." });
  document.getElementById("quickIdentity").addEventListener("change", updateQuickIdentityFields);

  document.getElementById("openLoginBtn").addEventListener("click", showAuthView);
  document.getElementById("accountBtn").addEventListener("click", toggleAccountMenu);
  bindLoadingClick("myReportsBtn", showMyReports, { message: "載入我的通報中，請稍後..." });
  const myClaimsBtn = document.getElementById("myClaimsBtn");
  if (myClaimsBtn) {
    myClaimsBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => showMyClaims(), {
        button: event.currentTarget,
        message: "載入我的認領中，請稍後...",
      });
    });
  }

  const receivedClaimsBtn = document.getElementById("receivedClaimsBtn");
  if (receivedClaimsBtn) {
    receivedClaimsBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => showReceivedClaims(), {
        button: event.currentTarget,
        message: "載入收到的認領申請中，請稍後...",
      });
    });
  }

  const myNotificationsBtn = document.getElementById("myNotificationsBtn");
  if (myNotificationsBtn) {
    myNotificationsBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => showMyNotifications(), {
        button: event.currentTarget,
        message: "載入通知中，請稍後...",
      });
    });
  }

  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.getElementById("showLoginTabBtn").addEventListener("click", () => setAuthMode("login"));
  document.getElementById("showRegisterTabBtn").addEventListener("click", () => setAuthMode("register"));
  document.getElementById("authIdentity").addEventListener("change", updateAuthIdentityFields);
  bindLoadingClick("authSubmitBtn", submitAuthForm, { message: "送出中，請稍後..." });

  document.getElementById("reportType").addEventListener("change", updateReportTypeFields);
  const hasVerificationQuestion = document.getElementById("hasVerificationQuestion");
  if (hasVerificationQuestion) {
    hasVerificationQuestion.addEventListener("change", updateVerificationFields);
  }

  bindLoadingClick("searchBtn", handleSearch, { message: "查詢中，請稍後..." });
  const reloadBtn = document.getElementById("reloadBtn");
  reloadBtn.addEventListener("pointerdown", flashReloadButton);
  reloadBtn.addEventListener("click", async (event) => {
    await runWithLoading(() => refreshAllData(), {
      button: event.currentTarget,
      message: "重新整理中，請稍後...",
    });
  });
  bindLoadingSubmit("reportForm", submitReport, { message: "通報送出中，請稍後..." });

  const reportAreaSelect = document.getElementById("reportAreaSelect");
  if (reportAreaSelect) {
    reportAreaSelect.addEventListener("change", () => {
      renderDetailSelectOptions("reportAreaSelect", "reportDetailSelect", "全部");
    });
  }

  const filterAreaSelect = document.getElementById("filterAreaSelect");
  if (filterAreaSelect) {
    filterAreaSelect.addEventListener("change", () => {
      renderDetailSelectOptions("filterAreaSelect", "filterDetailSelect", "全部小地點");
    });
  }

  document.getElementById("homeBtn").addEventListener("click", showHomeView);
  document.getElementById("brandHomeBtn").addEventListener("click", showHomeView);

  document.getElementById("adminLoginBtn").addEventListener("click", showAdminLoginView);
  bindLoadingClick("adminSubmitBtn", adminLogin, { message: "管理員登入中，請稍後..." });
  document.getElementById("adminLogoutBtn").addEventListener("click", adminLogout);

  bindLoadingClick("sendMessageBtn", sendChatMessage, { message: "送出訊息中，請稍後...", useOverlay: false });
  bindLoadingClick("trustUserBtn", trustCurrentChatUser, { message: "處理信任設定中，請稍後..." });

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("accountMenu");
    const accountBtn = document.getElementById("accountBtn");

    if (!menu.contains(event.target) && event.target !== accountBtn) {
      menu.classList.add("hidden");
    }
  });
}

function setTodayDate() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("eventDate").value = today;
}

function updateLoginUI() {
  const loginCard = document.getElementById("loginCard");
  const accountBtn = document.getElementById("accountBtn");
  const openLoginBtn = document.getElementById("openLoginBtn");

  if (currentUser) {
    const userRole = currentUser.role || (currentUser.outsider ? "outsider" : "student");
    const identityText = roleLabel(userRole);

    loginCard.classList.add("hidden");
    openLoginBtn.classList.add("hidden");

    accountBtn.textContent = `${currentUser.name} 已登入（${identityText}）`;
    accountBtn.classList.add("logged-in");
  } else {
    loginCard.classList.remove("hidden");
    openLoginBtn.classList.remove("hidden");

    accountBtn.textContent = "尚未登入";
    accountBtn.classList.remove("logged-in");
    document.getElementById("accountMenu").classList.add("hidden");
  }
}

function toggleAccountMenu() {
  if (!currentUser) {
    showAuthView();
    return;
  }

  document.getElementById("accountMenu").classList.toggle("hidden");
}

function logout() {
  currentUser = null;
  lastRecommendations = [];
  currentConversation = null;

  localStorage.removeItem("currentUser");

  updateLoginUI();
  showHomeView();
  loadNotifications();

  alert("已登出");
}

function updateReportTypeFields() {
  const reportType = document.getElementById("reportType").value;
  const storageBlock = document.getElementById("storageLocationBlock");
  const locationLabel = document.getElementById("locationLabel");

  if (reportType === "F") {
    storageBlock.classList.remove("hidden");
    locationLabel.textContent = "拾獲地點";
  } else {
    storageBlock.classList.add("hidden");
    document.getElementById("storageLocation").value = "";
    locationLabel.textContent = "遺失地點";
  }

  updateVerificationFields();
}

function updateVerificationFields() {
  const reportType = document.getElementById("reportType")?.value;
  const checked = document.getElementById("hasVerificationQuestion")?.checked;
  const verificationSection = document.getElementById("verificationSection");
  const verificationFields = document.getElementById("verificationFields");

  if (verificationSection) {
    verificationSection.classList.toggle("hidden", reportType !== "F");
  }

  if (verificationFields) {
    verificationFields.classList.toggle("hidden", reportType !== "F" || !checked);
  }
}

function updateQuickIdentityFields() {
  const identity = document.getElementById("quickIdentity").value;

  document.getElementById("quickStudentFields").classList.add("hidden");
  document.getElementById("quickStaffFields").classList.add("hidden");
  document.getElementById("quickOutsiderFields").classList.add("hidden");

  const nameLabel = document.getElementById("quickNameLabel");

  if (nameLabel) {
    nameLabel.textContent = identity === "staff" ? "教師名稱" : "姓名";
  }

  if (identity === "student") {
    document.getElementById("quickStudentFields").classList.remove("hidden");
  }

  if (identity === "staff") {
    document.getElementById("quickStaffFields").classList.remove("hidden");
  }

  if (identity === "outsider") {
    document.getElementById("quickOutsiderFields").classList.remove("hidden");
  }
}

function updateAuthIdentityFields() {
  const identity = document.getElementById("authIdentity").value;

  document.getElementById("authStudentFields").classList.add("hidden");
  document.getElementById("authStaffFields").classList.add("hidden");
  document.getElementById("authOutsiderFields").classList.add("hidden");

  const nameLabel = document.getElementById("authNameLabel");

  if (nameLabel) {
    nameLabel.textContent = identity === "staff" ? "教師名稱" : "姓名";
  }

  if (identity === "student") {
    document.getElementById("authStudentFields").classList.remove("hidden");
  }

  if (identity === "staff") {
    document.getElementById("authStaffFields").classList.remove("hidden");
  }

  if (identity === "outsider") {
    document.getElementById("authOutsiderFields").classList.remove("hidden");
  }
}

async function loadOptions() {
  const categoryResult = await apiGet("/categories");

  fillSelect("categoryFilter", categoryResult.categories, "category_id", "category_name", "全部類別");
  fillSelect("reportCategory", categoryResult.categories, "category_id", "category_name");
}

async function loadLocationAreas() {
  const result = await apiGet("/location-areas");

  if (!result.success) {
    console.error("讀取大地點失敗：", result.message);
    return;
  }

  locationAreas = result.areas || [];

  renderAreaSelectOptions("reportAreaSelect", "選擇大地點");
  renderAreaSelectOptions("filterAreaSelect", "全部大地點");
}

async function loadLocationDetails(areaId) {
  if (!areaId) {
    return [];
  }

  if (locationDetailsByArea[areaId]) {
    return locationDetailsByArea[areaId];
  }

  const result = await apiGet(`/location-areas/${areaId}/details`);

  if (!result.success) {
    console.error("讀取小地點失敗：", result.message);
    return [];
  }

  locationDetailsByArea[areaId] = result.details || [];
  return locationDetailsByArea[areaId];
}

function renderAreaSelectOptions(selectId, firstOptionText) {
  const select = document.getElementById(selectId);

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">${firstOptionText}</option>
    ${locationAreas.map((area) => `
      <option value="${area.area_id}" data-area-key="${area.area_key}">${escapeHtml(area.area_name)}</option>
    `).join("")}
  `;
}

async function renderDetailSelectOptions(areaSelectId, detailSelectId, firstOptionText = "全部") {
  const areaSelect = document.getElementById(areaSelectId);
  const detailSelect = document.getElementById(detailSelectId);

  if (!areaSelect || !detailSelect) {
    return;
  }

  const areaId = areaSelect.value;

  if (!areaId) {
    detailSelect.innerHTML = `<option value="">${firstOptionText}</option>`;
    detailSelect.classList.add("hidden");
    return;
  }

  const details = await loadLocationDetails(areaId);

  detailSelect.innerHTML = details.length
    ? details.map((detail) => `
        <option value="${detail.detail_id}" data-detail-key="${detail.detail_key}">${escapeHtml(detail.detail_name)}</option>
      `).join("")
    : `<option value="">${firstOptionText}</option>`;

  detailSelect.classList.remove("hidden");
}

function fillSelect(elementId, items, valueKey, textKey, defaultText = null) {
  const select = document.getElementById(elementId);
  select.innerHTML = "";

  if (defaultText !== null) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = defaultText;
    select.appendChild(option);
  }

  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item[valueKey];
    option.textContent = item[textKey];
    select.appendChild(option);
  });
}

async function quickLogin() {
  const payload = getIdentityPayload("quick");

  if (!payload.valid) {
    alert(payload.message);
    return;
  }

  const result = await apiPostJson("/login", payload.data);

  if (result.success) {
    setCurrentUser(result.user);
    alert(result.message || "登入成功");
  } else {
    alert(result.message || "登入失敗");
  }
}

function showAuthView() {
  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("authView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "登入 / 註冊";

  setAuthMode("login");
  updateAuthIdentityFields();
}

function setAuthMode(mode) {
  authMode = mode;

  const loginBtn = document.getElementById("showLoginTabBtn");
  const registerBtn = document.getElementById("showRegisterTabBtn");
  const heading = document.getElementById("authHeading");
  const hint = document.getElementById("authHint");
  const submitBtn = document.getElementById("authSubmitBtn");

  loginBtn.classList.remove("active");
  registerBtn.classList.remove("active");

  if (mode === "login") {
    loginBtn.classList.add("active");
    heading.textContent = "登入";
    hint.textContent = "請輸入已註冊的使用者資料。";
    submitBtn.textContent = "登入";
  } else {
    registerBtn.classList.add("active");
    heading.textContent = "註冊新使用者";
    hint.textContent = "請建立新使用者，註冊成功後會自動登入。";
    submitBtn.textContent = "註冊並登入";
  }
}

async function submitAuthForm() {
  const payload = getIdentityPayload("auth");

  if (!payload.valid) {
    alert(payload.message);
    return;
  }

  const path = authMode === "login" ? "/login" : "/register";
  const result = await apiPostJson(path, payload.data);

  if (result.success) {
    setCurrentUser(result.user);
    alert(result.message || "成功");
    showHomeView();
  } else {
    alert(result.message || "操作失敗");
  }
}

function getIdentityPayload(prefix) {
  const name = document.getElementById(`${prefix}Name`).value.trim();
  const identity = document.getElementById(`${prefix}Identity`).value;

  if (!name) {
    return {
      valid: false,
      message: "請輸入姓名"
    };
  }

  if (!identity) {
    return {
      valid: false,
      message: "請選擇身分"
    };
  }

  if (identity === "student") {
    const studentId = document.getElementById(`${prefix}StudentId`).value.trim();
    const phone = document.getElementById(`${prefix}StudentPhone`).value.trim();

    if (!studentId) {
      return {
        valid: false,
        message: "本校學生請輸入學號"
      };
    }

    if (!phone) {
      return {
        valid: false,
        message: "本校學生請輸入電話"
      };
    }

    return {
      valid: true,
      data: {
        role: "student",
        name,
        student_id: studentId,
        staff_id: null,
        phone_number: phone,
        outsider: false,
      }
    };
  }

  if (identity === "staff") {
    const staffId = document.getElementById(`${prefix}StaffId`).value.trim();
    const phone = document.getElementById(`${prefix}StaffPhone`).value.trim();

    if (!staffId) {
      return {
        valid: false,
        message: "教職員請輸入教師編號"
      };
    }

    if (!phone) {
      return {
        valid: false,
        message: "教職員請輸入電話"
      };
    }

    return {
      valid: true,
      data: {
        role: "staff",
        name,
        student_id: null,
        staff_id: staffId,
        phone_number: phone,
        outsider: false,
      }
    };
  }

  const phone = document.getElementById(`${prefix}OutsiderPhone`).value.trim();

  if (!phone) {
    return {
      valid: false,
      message: "外校人士請輸入電話"
    };
  }

  return {
    valid: true,
    data: {
      role: "outsider",
      name,
      student_id: null,
      staff_id: null,
      phone_number: phone,
      outsider: true,
    }
  };
}

function setCurrentUser(user) {
  currentUser = user;
  isAdmin = false;

  localStorage.setItem("currentUser", JSON.stringify(user));

  updateLoginUI();
  loadNotifications();
  showHomeView();
}

async function refreshAllData() {
  await loadOptions();
  await loadReports(false, false);

  if (currentUser) {
    await loadNotifications();
  }

  showHomeView();
  alert("重新整理完成");
}

function flashReloadButton() {
  const reloadBtn = document.getElementById("reloadBtn");

  if (!reloadBtn) {
    return;
  }

  reloadBtn.classList.remove("reload-flash");
  void reloadBtn.offsetWidth;
  reloadBtn.classList.add("reload-flash");

  window.setTimeout(() => {
    reloadBtn.classList.remove("reload-flash");
  }, 600);
}

async function handleSearch() {
  // 篩選結果：search=true，所以已處理 / 已認領不會出現
  const reports = await loadReports(false, true);
  showListView(reports, "篩選結果", false);
}

async function loadReports(renderHome = true, useFilters = false) {
  const params = new URLSearchParams();

  if (useFilters) {
    params.append("search", "true");

    const keyword = document.getElementById("keywordInput").value.trim();
    const categoryId = document.getElementById("categoryFilter").value;
    const type = document.getElementById("typeFilter").value;
    const status = document.getElementById("statusFilter").value;
    const areaId = document.getElementById("filterAreaSelect")?.value || "";
    const detailId = document.getElementById("filterDetailSelect")?.value || "";

    if (keyword) params.append("keyword", keyword);
    if (categoryId) params.append("category_id", categoryId);
    if (type) params.append("type", type);
    if (status) params.append("status", status);
    if (areaId) params.append("area_id", areaId);
    if (detailId) params.append("detail_id", detailId);
  }

  const path = params.toString() ? `/reports?${params.toString()}` : "/reports";
  const result = await apiGet(path);

  latestReports = result.reports || [];

  renderHomeReports(latestReports);
  renderMapPins(latestReports);

  if (renderHome) {
    showHomeView();
  }

  return latestReports;
}

async function showMyReports() {
  if (!currentUser) {
    alert("請先登入");
    return;
  }

  document.getElementById("accountMenu").classList.add("hidden");

  const result = await apiGet(`/reports?mine=true&user_id=${currentUser.user_id}`);
  if (!result.success) {
    alert(result.message || "讀取我的通報失敗");
    return;
  }

  const reports = result.reports || [];

  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "我的通報";

  const detailContent = document.getElementById("detailContent");
  detailContent.innerHTML = `
    <section class="card">
      <h2>我的通報</h2>
      <div class="claim-list">
        ${
          reports.length
            ? reports.map(renderMyReportCard).join("")
            : `<p class="muted-text">目前沒有通報資料。</p>`
        }
      </div>
    </section>
  `;

  reports.forEach((report) => {
    const detailBtn = document.getElementById(`myReportDetail-${report.report_id}`);
    if (detailBtn) {
      detailBtn.addEventListener("click", () => showDetailView(report, [], true));
    }

    const processBtn = document.getElementById(`processLost-${report.report_id}`);
    if (processBtn) {
      processBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => markLostReportProcessed(report.report_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }
  });
}

function renderMyReportCard(report) {
  const canMarkLostProcessed = report.type === "L" && report.status === "待處理";

  return `
    <div class="claim-card">
      <h3>${escapeHtml(report.item_name || "未命名物品")}</h3>
      <p>${typeLabel(report.type)}｜${escapeHtml(report.status || "")}</p>
      <p>${escapeHtml(report.category_name || "")}｜${escapeHtml(getReportLocationDisplay(report))}</p>
      <p class="muted-text">通報時間：${escapeHtml(formatDateTime(report.created_at))}</p>

      <div class="action-row">
        <button id="myReportDetail-${report.report_id}" class="secondary-btn">查看詳細</button>
        ${
          canMarkLostProcessed
            ? `<button id="processLost-${report.report_id}" class="primary-btn">我已自己找回 / 標記已處理</button>`
            : ""
        }
      </div>
    </div>
  `;
}

async function markLostReportProcessed(reportId) {
  const confirmed = confirm("確認你已經找回這個遺失物，並將此通報標記為已處理？相關未完成認領申請會被取消。");

  if (!confirmed) {
    return;
  }

  const result = await apiPatchJson(`/reports/${reportId}/status`, {
    user_id: currentUser.user_id,
    status: "已處理",
  });

  if (!result.success) {
    alert(result.message || "更新狀態失敗");
    return;
  }

  alert("已標記為已處理。");
  await loadReports(false, false);
  await loadNotifications();
  showMyReports();
}

function renderHomeReports(reports) {
  renderReportsToContainer("homeReportList", reports, false);
}

function showListView(reports, title = "篩選結果", isMine = false) {
  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("listView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = title;
  document.getElementById("listViewHeading").textContent = title;
  document.getElementById("listViewHint").textContent = `共找到 ${reports.length} 筆通報。`;

  const container = document.getElementById("resultReportList");

  if (isMine) {
    container.classList.remove("report-grid");
    container.classList.add("report-list-wide");
  } else {
    container.classList.add("report-grid");
    container.classList.remove("report-list-wide");
  }

  renderReportsToContainer("resultReportList", reports, isMine);
}

function showDetailView(report, recommendations = [], fromMine = false) {
  currentDetailReport = report;
  currentDetailRecommendations = recommendations || [];
  currentDetailFromMine = fromMine;

  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "物品詳細資料";

  renderDetail(report, recommendations, fromMine);
}

function showHomeView() {
  document.body.classList.remove("admin-mode");

  hideAllViews();

  document.getElementById("viewToolbar").classList.add("hidden");
  document.getElementById("homeView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "首頁";

  // 回首頁：不套用篩選，所以已處理 / 已認領仍會顯示
  loadReports(false, false);
}

function showBuildingMapView(area, relatedReports = []) {
  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("buildingMapView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = area.name;

  const buildingMapWrapper = document.querySelector("#buildingMapView .building-map-wrapper");
  if (buildingMapWrapper) {
    buildingMapWrapper.classList.remove("business-map-wrapper");
  }

  const buildingMapHint = document.querySelector("#buildingMapView .muted-text");
  if (buildingMapHint) {
    buildingMapHint.textContent = `這裡先顯示 ${area.name} 相關通報。`;
  }

  const buildingReportList = document.getElementById("buildingReportList");

  if (area.key === "business_college") {
    if (buildingMapWrapper) {
      buildingMapWrapper.classList.remove("hidden");
      buildingMapWrapper.classList.add("business-map-wrapper");
      buildingMapWrapper.innerHTML = `
        <img id="businessCollegeMap" class="business-map-img" src="./assets/maps/business-college-map.png" alt="商院教室配置圖" />
        <div class="business-detail-layer">${renderBusinessDetailAreas()}</div>
        <div class="business-marker-layer">${renderBusinessMapMarkers(relatedReports || [])}</div>
      `;
    }

    const buildingMapTitle = document.getElementById("buildingMapTitle");
    if (buildingMapTitle) {
      buildingMapTitle.textContent = "商學院館細部地圖";
    }

    if (buildingMapHint) {
      buildingMapHint.textContent = "點選框線可辨識教室區域，點圖標可進入原本的物品詳細資料。";
    }

    renderReportsToContainer("buildingReportList", relatedReports || [], false);
    return;
  }

  if (buildingMapWrapper) {
    buildingMapWrapper.classList.add("hidden");
    buildingMapWrapper.innerHTML = `
      <img id="businessCollegeMap" src="./assets/maps/business-college-map.png" alt="商院教室配置圖" />
    `;
  }

  const buildingMapTitle = document.getElementById("buildingMapTitle");
  if (buildingMapTitle) {
    buildingMapTitle.textContent = area.name;
  }

  if (!relatedReports || relatedReports.length === 0) {
    buildingReportList.innerHTML = "<p>目前這個建築沒有相關通報。</p>";
    return;
  }

  renderReportsToContainer("buildingReportList", relatedReports, false);
}

function hideAllViews() {
  document.getElementById("homeView").classList.add("hidden");
  document.getElementById("authView").classList.add("hidden");
  document.getElementById("adminLoginView").classList.add("hidden");
  document.getElementById("adminDashboardView").classList.add("hidden");
  document.getElementById("listView").classList.add("hidden");
  document.getElementById("detailView").classList.add("hidden");
  document.getElementById("buildingMapView").classList.add("hidden");
  document.getElementById("chatView").classList.add("hidden");
}

function renderReportsToContainer(containerId, reports, fromMine = false) {
  const reportList = document.getElementById(containerId);
  reportList.innerHTML = "";

  if (!reports || reports.length === 0) {
    reportList.innerHTML = "<p>目前沒有符合條件的通報。</p>";
    return;
  }

  reports.forEach(report => {
    const card = document.createElement("article");
    card.className = "report-card";

    const typeText = report.type === "F" ? "拾獲物" : "遺失物";
    const typeClass = report.type === "F" ? "found" : "lost";

    const photoHtml = report.item_photo
      ? `<img class="report-card-photo" src="${escapeAttribute(getPhotoUrl(report.item_photo))}" alt="${escapeAttribute(report.item_name)}">`
      : `<div class="report-card-photo placeholder">尚無照片</div>`;

    card.innerHTML = `
      ${photoHtml}
      <div>
        <h3>${escapeHtml(report.item_name)}</h3>
        <div>
          <span class="badge ${typeClass}">${typeText}</span>
          <span class="badge">${escapeHtml(report.status || "未設定")}</span>
          ${report.trusted_user_id ? `<span class="badge trusted-badge">已信任</span>` : ""}
        </div>
        <p class="report-meta">
          類別：${escapeHtml(report.category_name || "")}<br>
          地點：${escapeHtml(getReportLocationDisplay(report))}<br>
          日期：${escapeHtml(report.event_date || "")}<br>
          放置處：${escapeHtml(report.storage_location || "無")}
        </p>
      </div>
    `;

    card.addEventListener("click", () => {
      showDetailView(report, [], fromMine);
    });

    reportList.appendChild(card);
  });
}

function renderDetail(report, recommendations = [], fromMine = false) {
  const detailContent = document.getElementById("detailContent");

  const typeText = report.type === "F" ? "拾獲物" : "遺失物";
  const typeClass = report.type === "F" ? "found" : "lost";

  const photoHtml = report.item_photo
    ? `<img class="detail-photo" src="${escapeAttribute(getPhotoUrl(report.item_photo))}" alt="${escapeAttribute(report.item_name)}">`
    : `<div class="detail-photo-placeholder">尚無照片</div>`;

  const ownerActions = getOwnerActionsHtml(report, fromMine);
  const recommendHtml = getRecommendationsHtml(recommendations);
  const isOwner = currentUser && Number(currentUser.user_id) === Number(report.user_id);
  const canClaim = currentUser && report.type === "F" && report.status === "待認領" && !isOwner;

  detailContent.innerHTML = `
    <div class="detail-header">
      <div>
        <h2>${escapeHtml(report.item_name)}</h2>
        <span class="badge ${typeClass}">${typeText}</span>
        <span class="badge">${escapeHtml(report.status || "未設定")}</span>
        ${report.trusted_user_id ? `<span class="badge trusted-badge">已信任遺失者</span>` : ""}
      </div>
    </div>

    ${photoHtml}
    ${ownerActions}

    ${
      report.has_verification_question
        ? `<p><strong>防冒領：</strong>此拾獲物有設定特徵問題</p>`
        : ""
    }

    <div class="action-row">
      ${
        canClaim
          ? `<button id="claimBtn" class="primary-btn">我要認領</button>`
          : ""
      }
    </div>

    <div class="detail-grid">
      <div class="detail-field"><span>物品名稱</span><strong>${escapeHtml(report.item_name || "未填寫")}</strong></div>
      <div class="detail-field"><span>通報類型</span><strong>${typeText}</strong></div>
      <div class="detail-field"><span>類別</span><strong>${escapeHtml(report.category_name || "未分類")}</strong></div>
      <div class="detail-field"><span>狀態</span><strong>${escapeHtml(report.status || "未設定")}</strong></div>
      <div class="detail-field"><span>日期</span><strong>${escapeHtml(report.event_date || "未填寫")}</strong></div>
      <div class="detail-field"><span>建立時間</span><strong>${escapeHtml(report.created_at || "尚無資料")}</strong></div>
      <div class="detail-field"><span>地點</span><strong>${escapeHtml(getReportLocationDisplay(report))}</strong></div>
      <div class="detail-field"><span>補充位置</span><strong>${escapeHtml(report.location_name || "未填寫")}</strong></div>
      <div class="detail-field"><span>目前放置處</span><strong>${escapeHtml(report.storage_location || "無")}</strong></div>

      <div class="detail-field">
        <span>通報者姓名</span>
        <strong>${escapeHtml(report.submitter_name || "尚無資料")}</strong>
        ${getContactButtonHtml(report)}
      </div>

      <div class="detail-field"><span>通報者電話</span><strong>${escapeHtml(report.submitter_phone || "尚無資料")}</strong></div>
      <div class="detail-field"><span>Report ID</span><strong>${escapeHtml(report.report_id || "尚無")}</strong></div>
    </div>

    <div class="detail-note">
      <span>補充描述</span>
      <strong>${escapeHtml(report.note || "無")}</strong>
    </div>

    ${recommendHtml}
  `;

  const doneBtn = document.getElementById("markDoneBtn");
  const deleteBtn = document.getElementById("deleteReportBtn");
  const contactBtn = document.getElementById("contactSubmitterBtn");
  const claimBtn = document.getElementById("claimBtn");

  if (doneBtn) {
    doneBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => updateMyReportStatus(report), {
        button: event.currentTarget,
        message: "處理中，請稍後...",
      });
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => deleteMyReport(report), {
        button: event.currentTarget,
        message: "處理中，請稍後...",
      });
    });
  }

  if (contactBtn) {
    contactBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => openChatWithSubmitter(report), {
        button: event.currentTarget,
        message: "開啟聊天室中，請稍後...",
      });
    });
  }

  if (claimBtn) {
    claimBtn.addEventListener("click", () => showClaimForm(report));
  }

  recommendations.forEach(item => {
    const btn = document.getElementById(`recommend-${item.report.report_id}`);

    if (btn) {
      btn.addEventListener("click", () => showDetailView(item.report));
    }
  });
}

function getOwnerActionsHtml(report, fromMine) {
  const isOwner = currentUser && String(report.user_id) === String(currentUser.user_id);

  if (!isOwner || !fromMine) {
    return "";
  }

  const canMarkProcessed = report.type === "L" && report.status === "待處理";

  return `
    <div class="action-row">
      ${canMarkProcessed ? `<button id="markDoneBtn" class="secondary-btn">我已自己找回 / 標記已處理</button>` : ""}
      <button id="deleteReportBtn" class="danger-btn">刪除此通報</button>
    </div>
  `;
}

function getContactButtonHtml(report) {
  if (!currentUser) {
    return "";
  }

  if (String(currentUser.user_id) === String(report.user_id)) {
    return "";
  }

  return `<button id="contactSubmitterBtn" class="contact-btn">聯絡</button>`;
}

function getRecommendationsHtml(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <div class="recommend-section">
        <h2>可能相關的物品</h2>
        <p class="muted-text">目前沒有找到接近的通報。</p>
      </div>
    `;
  }

  const cards = recommendations.map(item => {
    const report = item.report;
    const typeText = report.type === "F" ? "拾獲物" : "遺失物";

    return `
      <article class="report-card" id="recommend-${report.report_id}">
        <h3>${escapeHtml(report.item_name)}</h3>
        <span class="badge">${typeText}</span>
        <span class="badge">相似度 ${item.score}</span>
        <p class="report-meta">
          地點：${escapeHtml(getReportLocationDisplay(report))}<br>
          狀態：${escapeHtml(report.status || "")}<br>
          備註：${escapeHtml(report.note || "無")}
        </p>
      </article>
    `;
  }).join("");

  return `
    <div class="recommend-section">
      <h2>可能相關的物品</h2>
      <div class="report-grid">${cards}</div>
    </div>
  `;
}

async function updateMyReportStatus(report) {
  const newStatus = report.type === "F" ? "已認領" : "已處理";

  if (report.type === "F" && !report.trusted_user_id) {
    alert("你尚未信任遺失者，不能把此拾獲物改成已認領。請先在聊天室點選「信任遺失者」。");
    return;
  }

  const result = await apiPatchJson(`/reports/${report.report_id}/status`, {
    status: newStatus,
    user_id: currentUser.user_id
  });

  if (result.success) {
    alert("狀態已更新");

    showDetailView(result.report, [], true);
    await loadReports(false, false);
  } else {
    alert(result.message || "更新失敗");
  }
}

async function deleteMyReport(report) {
  const ok = confirm("確定要刪除此通報嗎？刪除後不會顯示在任何地方。");

  if (!ok) return;

  const result = await apiDeleteJson(`/reports/${report.report_id}`, {
    user_id: currentUser.user_id
  });

  if (result.success) {
    alert("已刪除");
    await showMyReports();
    await loadReports(false, false);
  } else {
    alert(result.message || "刪除失敗");
  }
}

async function submitReport(event) {
  event.preventDefault();

  if (!currentUser) {
    alert("請先登入後再通報。");
    showAuthView();
    return;
  }

  const form = document.getElementById("reportForm");
  const formData = new FormData(form);

  const reportType = formData.get("type");
  const hasVerificationQuestion = document.getElementById("hasVerificationQuestion")?.checked || false;
  const reportAreaSelect = document.getElementById("reportAreaSelect");
  const reportDetailSelect = document.getElementById("reportDetailSelect");
  const manualLocationTextInput = document.getElementById("manualLocationText");

  const areaId = reportAreaSelect?.value || "";
  const detailId = reportDetailSelect?.value || "";
  const manualLocationText = manualLocationTextInput?.value.trim() || "";

  if (!areaId) {
    alert("請先選擇大地點，不能使用預設空白。");
    reportAreaSelect?.focus();
    return;
  }

  const selectedAreaText = reportAreaSelect?.selectedOptions[0]?.textContent.trim() || "";
  const selectedDetailText = reportDetailSelect?.selectedOptions[0]?.textContent.trim() || "";
  const finalLocationText = manualLocationText || [selectedAreaText, selectedDetailText]
    .filter((text) => text && text !== "選擇大地點" && text !== "全部")
    .join(" ");

  formData.append("user_id", currentUser.user_id);
  formData.append("status", reportType === "F" ? "待認領" : "待處理");
  formData.append("area_id", areaId);
  formData.append("detail_id", detailId);
  formData.append("manual_location_text", manualLocationText);
  formData.append("location_name", finalLocationText);
  formData.append("has_verification_question", reportType === "F" && hasVerificationQuestion ? "true" : "false");
  formData.append(
    "verification_question",
    reportType === "F" && hasVerificationQuestion
      ? (document.getElementById("verificationQuestion")?.value || "").trim()
      : ""
  );
  formData.append(
    "verification_answer",
    reportType === "F" && hasVerificationQuestion
      ? (document.getElementById("verificationAnswer")?.value || "").trim()
      : ""
  );

  const result = await apiPostForm("/reports", formData);

  if (result.success) {
    alert(result.message || "通報成功");

    form.reset();
    setTodayDate();
    updateReportTypeFields();

    if (reportAreaSelect) {
      reportAreaSelect.value = "";
    }

    if (reportDetailSelect) {
      reportDetailSelect.innerHTML = '<option value="">全部</option>';
      reportDetailSelect.classList.add("hidden");
    }

    if (manualLocationTextInput) {
      manualLocationTextInput.value = "";
    }

    await loadReports(false, false);
    await loadNotifications();

    const recommendations = result.recommendations || [];

    if (result.report) {
      showDetailView(result.report, recommendations, true);
    }
  } else {
    alert(result.message || "通報失敗");
  }
}

function showClaimForm(report) {
  if (!currentUser) {
    alert("請先登入");
    return;
  }

  currentDetailReport = report;

  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "提出認領申請";

  const detailContent = document.getElementById("detailContent");
  detailContent.innerHTML = `
    <div class="detail-header">
      <div>
        <h2>提出認領申請</h2>
        <p class="muted-text">你正在認領：${escapeHtml(report.item_name || "")}</p>
      </div>
      <button id="backToDetailBtn" class="secondary-btn" type="button">返回詳細資料</button>
    </div>

    <p>目前放置處：${escapeHtml(report.storage_location || "尚未填寫")}</p>

    <label>認領說明</label>
    <textarea
      id="claimMessage"
      placeholder="請說明為什麼這是你的物品，例如遺失時間、外觀特徵、內容物等"
    ></textarea>

    ${
      report.has_verification_question
        ? `
          <div class="question-box">
            <p><strong>特徵問題：</strong>${escapeHtml(report.question_text || "請描述物品特徵")}</p>
          </div>

          <label>你的答案</label>
          <textarea
            id="verificationAnswerInput"
            placeholder="請回答拾獲者設定的特徵問題"
          ></textarea>
        `
        : `<input id="verificationAnswerInput" type="hidden" value="" />`
    }

    <label>如果你有自己的遺失物通報，可填入 report_id；沒有可留空</label>
    <input id="lostReportIdInput" type="number" placeholder="可留空" />

    <div class="action-row">
      <button id="submitClaimBtn" class="primary-btn" type="button">送出認領申請</button>
    </div>
  `;

  document.getElementById("submitClaimBtn").addEventListener("click", async (event) => {
    await runWithLoading(() => submitClaim(report), {
      button: event.currentTarget,
      message: "送出認領申請中，請稍後...",
    });
  });
  document.getElementById("backToDetailBtn").addEventListener("click", () => {
    showDetailView(currentDetailReport, currentDetailRecommendations, currentDetailFromMine);
  });
}

async function submitClaim(report) {
  if (!currentUser) {
    alert("請先登入");
    return;
  }

  const lostReportIdValue = document.getElementById("lostReportIdInput").value;

  const payload = {
    found_report_id: report.report_id,
    lost_report_id: lostReportIdValue ? Number(lostReportIdValue) : null,
    claimant_user_id: currentUser.user_id,
    claim_message: document.getElementById("claimMessage").value.trim(),
    verification_answer: document.getElementById("verificationAnswerInput").value.trim(),
  };

  const result = await apiPostJson("/claims", payload);

  if (!result.success) {
    alert(result.message || "認領申請失敗");
    return;
  }

  alert("認領申請已送出，請等待拾獲者審核。");
  await loadNotifications();
  showMyClaims();
}

async function showMyClaims() {
  if (!currentUser) {
    alert("請先登入");
    return;
  }

  document.getElementById("accountMenu").classList.add("hidden");

  const result = await apiGet(`/claims/mine/${currentUser.user_id}`);

  if (!result.success) {
    alert(result.message || "讀取我的認領申請失敗");
    return;
  }

  const claims = result.claims || [];

  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "我的認領申請";

  const detailContent = document.getElementById("detailContent");
  detailContent.innerHTML = `
    <section class="card">
      <h2>我的認領申請</h2>
      <div class="claim-list">
        ${
          claims.length
            ? claims.map(renderMyClaimCard).join("")
            : `<p class="muted-text">目前沒有認領申請。</p>`
        }
      </div>
    </section>
  `;

  claims.forEach((claim) => {
    const completeBtn = document.getElementById(`completeClaim-${claim.claim_id}`);
    if (completeBtn) {
      completeBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => completeClaim(claim.claim_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }

    const cancelBtn = document.getElementById(`cancelClaim-${claim.claim_id}`);
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => cancelClaim(claim.claim_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }
  });
}

function renderMyClaimCard(claim) {
  return `
    <div class="claim-card">
      <h3>${escapeHtml(claim.found_item_name || "未命名物品")}</h3>
      <p><strong>狀態：</strong>${escapeHtml(claim.status)}</p>
      <p><strong>拾獲者：</strong>${escapeHtml(claim.owner_name || "")}</p>
      <p><strong>拾獲者電話：</strong>${escapeHtml(claim.owner_phone || "")}</p>
      <p><strong>放置處：</strong>${escapeHtml(claim.storage_location || "尚未填寫")}</p>
      <p class="muted-text">建立時間：${escapeHtml(formatDateTime(claim.created_at))}</p>

      ${
        claim.status === "已接受"
          ? `<p class="success-text">申請已通過，請領取後按「我已取回」。</p>`
          : ""
      }

      <div class="action-row">
        ${
          claim.status === "已接受"
            ? `<button id="completeClaim-${claim.claim_id}" class="primary-btn">我已取回</button>`
            : ""
        }

        ${
          claim.status === "待審核" || claim.status === "已接受"
            ? `<button id="cancelClaim-${claim.claim_id}" class="secondary-btn">取消認領</button>`
            : ""
        }
      </div>
    </div>
  `;
}

async function showReceivedClaims() {
  if (!currentUser) {
    alert("請先登入");
    return;
  }

  document.getElementById("accountMenu").classList.add("hidden");

  const result = await apiGet(`/claims/received/${currentUser.user_id}`);

  if (!result.success) {
    alert(result.message || "讀取收到的認領申請失敗");
    return;
  }

  const claims = result.claims || [];

  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "我收到的認領申請";

  const detailContent = document.getElementById("detailContent");
  detailContent.innerHTML = `
    <section class="card">
      <h2>我收到的認領申請</h2>
      <div class="claim-list">
        ${
          claims.length
            ? claims.map(renderReceivedClaimCard).join("")
            : `<p class="muted-text">目前沒有收到認領申請。</p>`
        }
      </div>
    </section>
  `;

  claims.forEach((claim) => {
    const acceptBtn = document.getElementById(`acceptClaim-${claim.claim_id}`);
    if (acceptBtn) {
      acceptBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => acceptClaim(claim.claim_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }

    const rejectBtn = document.getElementById(`rejectClaim-${claim.claim_id}`);
    if (rejectBtn) {
      rejectBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => rejectClaim(claim.claim_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }
  });
}

function renderReceivedClaimCard(claim) {
  return `
    <div class="claim-card">
      <h3>${escapeHtml(claim.found_item_name || "未命名物品")}</h3>
      <p><strong>申請狀態：</strong>${escapeHtml(claim.status)}</p>
      <p><strong>申請者：</strong>${escapeHtml(claim.claimant_name || "")}</p>
      <p><strong>申請者電話：</strong>${escapeHtml(claim.claimant_phone || "")}</p>
      <p><strong>認領說明：</strong>${escapeHtml(claim.claim_message || "無")}</p>

      ${
        claim.lost_item_name
          ? `<p><strong>對應遺失物通報：</strong>${escapeHtml(claim.lost_item_name)}</p>`
          : `<p><strong>對應遺失物通報：</strong>未提供</p>`
      }

      ${
        claim.question_text
          ? `
            <div class="verification-review">
              <p><strong>特徵問題：</strong>${escapeHtml(claim.question_text)}</p>
              <p><strong>申請者答案：</strong>${escapeHtml(claim.verification_answer || "未填寫")}</p>
              <p><strong>參考答案：</strong>${escapeHtml(claim.reference_answer || "")}</p>
            </div>
          `
          : ""
      }

      <div class="action-row">
        ${
          claim.status === "待審核"
            ? `
              <button id="acceptClaim-${claim.claim_id}" class="primary-btn">接受認領</button>
              <button id="rejectClaim-${claim.claim_id}" class="danger-btn">拒絕認領</button>
            `
            : ""
        }
      </div>
    </div>
  `;
}

async function acceptClaim(claimId) {
  const result = await apiPatchJson(`/claims/${claimId}/accept`, {
    owner_user_id: currentUser.user_id,
  });

  if (!result.success) {
    alert(result.message || "接受認領失敗");
    return;
  }

  alert("已接受認領申請。");
  await loadNotifications();
  showReceivedClaims();
}

async function rejectClaim(claimId) {
  const reason = prompt("請輸入拒絕原因，可留空：") || "";

  const result = await apiPatchJson(`/claims/${claimId}/reject`, {
    owner_user_id: currentUser.user_id,
    reject_reason: reason,
  });

  if (!result.success) {
    alert(result.message || "拒絕認領失敗");
    return;
  }

  alert("已拒絕認領申請。");
  await loadNotifications();
  showReceivedClaims();
}

async function cancelClaim(claimId) {
  const reason = prompt("請輸入取消原因，可留空：") || "";

  const result = await apiPatchJson(`/claims/${claimId}/cancel`, {
    claimant_user_id: currentUser.user_id,
    cancel_reason: reason,
  });

  if (!result.success) {
    alert(result.message || "取消認領失敗");
    return;
  }

  alert("已取消認領申請。");
  await loadNotifications();
  showMyClaims();
}

async function completeClaim(claimId) {
  const confirmed = confirm("確認你已經取回物品？確認後系統會自動結案。");
  if (!confirmed) {
    return;
  }

  const result = await apiPatchJson(`/claims/${claimId}/complete`, {
    claimant_user_id: currentUser.user_id,
  });

  if (!result.success) {
    alert(result.message || "完成取回失敗");
    return;
  }

  alert("已完成取回，系統已自動結案。");
  await loadReports(false, false);
  await loadNotifications();
  showMyClaims();
}

async function loadNotifications() {
  const notificationList = document.getElementById("notificationList");

  if (!currentUser) {
    notificationList.textContent = "尚未登入，登入後會顯示通知。";
    return;
  }

  const result = await apiGet(`/notifications/${currentUser.user_id}`);
  const notifications = result.notifications || [];
  latestNotifications = notifications;

  if (notifications.length === 0) {
    notificationList.innerHTML = "<p>目前沒有通知。</p>";
    return;
  }

  notificationList.innerHTML = "";

  notifications.forEach(notification => {
    const item = document.createElement("div");
    item.className = notification.is_read ? "notification-item" : "notification-item unread";

    item.innerHTML = `
      <strong>${notification.is_read ? "已讀" : "未讀"}</strong>
      <p>${escapeHtml(notification.content)}</p>
      <small>${escapeHtml(notification.created_at || "")}</small>
    `;

    item.addEventListener("click", () => {
      if (notification.type === "chat") {
        openConversationFromNotification(notification);
        return;
      }

      handleNotificationClick(notification.type, notification.report_id, notification);
    });

    notificationList.appendChild(item);
  });
}

async function openConversationFromNotification(notification) {
  if (!currentUser) {
    return;
  }

  await apiPatchJson(`/notifications/${notification.notification_id}/read`, {});

  const result = await apiGet(`/chat/${notification.conversation_id}`);

  if (!result.success) {
    alert(result.message || "無法開啟聊天室");
    return;
  }

  showChatView(result.conversation);
  await loadNotifications();
}

async function openReportFromNotification(notification) {
  if (!currentUser) {
    return;
  }

  await apiPatchJson(`/notifications/${notification.notification_id}/read`, {});

  let report = latestReports.find(item => Number(item.report_id) === Number(notification.report_id));

  if (!report) {
    await loadReports(false, false);
    report = latestReports.find(item => Number(item.report_id) === Number(notification.report_id));
  }

  if (!report) {
    alert("找不到通知對應的通報資料");
    return;
  }

  showDetailView(report, [], false);
  await loadNotifications();
}

async function openReportFromNotificationById(reportId) {
  let report = latestReports.find(item => Number(item.report_id) === Number(reportId));

  if (!report) {
    await loadReports(false, false);
    report = latestReports.find(item => Number(item.report_id) === Number(reportId));
  }

  if (!report) {
    alert("找不到通知對應的通報資料");
    return;
  }

  showDetailView(report, [], false);
}

function notificationTypeLabel(type) {
  if (type === "match") return "相似通報通知";
  if (type === "claim") return "認領申請通知";
  if (type === "claim_accept") return "認領通過通知";
  if (type === "claim_reject") return "認領拒絕通知";
  if (type === "claim_complete") return "取回完成通知";
  if (type === "security") return "帳號安全通知";
  if (type === "chat") return "聊天通知";
  if (type === "status") return "狀態通知";
  return "系統通知";
}

function renderNotificationCard(notification) {
  return `
    <div
      class="notification-card"
      data-notification-id="${notification.notification_id || ""}"
      data-type="${notification.type || ""}"
      data-report-id="${notification.report_id || ""}"
    >
      <p><strong>${notificationTypeLabel(notification.type)}</strong></p>
      <p>${escapeHtml(notification.content || "")}</p>
      <p class="muted-text">${escapeHtml(formatDateTime(notification.created_at))}</p>
    </div>
  `;
}

async function handleNotificationClick(type, reportId, notification = null) {
  if (notification && notification.notification_id) {
    await apiPatchJson(`/notifications/${notification.notification_id}/read`, {});
  }

  if (type === "match" && reportId) {
    await openReportFromNotificationById(reportId);
    await loadNotifications();
    return;
  }

  if (type === "claim") {
    showReceivedClaims();
    await loadNotifications();
    return;
  }

  if (type === "claim_accept" || type === "claim_reject") {
    showMyClaims();
    await loadNotifications();
    return;
  }

  if (type === "claim_complete") {
    showMyReports();
    await loadNotifications();
    return;
  }

  if (type === "security") {
    alert("這是帳號安全通知，請依通知內容操作。");
    await loadNotifications();
    return;
  }

  if (reportId) {
    await openReportFromNotificationById(reportId);
    await loadNotifications();
  }
}

async function showMyNotifications() {
  if (!currentUser) {
    alert("請先登入");
    return;
  }

  document.getElementById("accountMenu").classList.add("hidden");
  await loadNotifications();

  document.body.classList.remove("admin-mode");
  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("detailView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "我的通知";

  const detailContent = document.getElementById("detailContent");
  detailContent.innerHTML = `
    <section class="card">
      <h2>我的通知</h2>
      <div class="notification-list">
        ${
          latestNotifications.length
            ? latestNotifications.map(renderNotificationCard).join("")
            : `<p class="muted-text">目前沒有通知。</p>`
        }
      </div>
    </section>
  `;

  document.querySelectorAll(".notification-card").forEach((card) => {
    card.addEventListener("click", () => {
      const type = card.dataset.type || "";
      const reportId = Number(card.dataset.reportId || "0");
      const notificationId = Number(card.dataset.notificationId || "0");
      const matched = latestNotifications.find(item => Number(item.notification_id) === notificationId) || null;
      handleNotificationClick(type, reportId || null, matched);
    });
  });
}

/* =========================
   Admin 功能
========================= */

function showAdminLoginView() {
  hideAllViews();

  document.body.classList.remove("admin-mode");

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("adminLoginView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "管理員登入";
}

async function adminLogin() {
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  const result = await apiPostJson("/admin/login", {
    username,
    password
  });

  if (!result.success) {
    alert(result.message || "Admin 登入失敗");
    return;
  }

  isAdmin = true;
  document.body.classList.add("admin-mode");

  alert("Admin 登入成功");
  await showAdminDashboard();
}

function ensureAdminFilterPanel() {
  const dashboard = document.getElementById("adminDashboardView");
  if (!dashboard || document.getElementById("adminYear")) {
    return;
  }

  const filterPanel = document.createElement("section");
  filterPanel.className = "card";
  filterPanel.id = "adminFilterCard";
  filterPanel.innerHTML = `
    <div class="dashboard-header">
      <div>
        <h2>年月篩選與匯出</h2>
        <p class="muted-text">不填代表查詢全部資料，只填年份代表查詢該年度全部月份。</p>
      </div>
    </div>

    <div class="button-row" style="gap: 12px; flex-wrap: wrap; align-items: end;">
      <div>
        <label>年份</label>
        <input id="adminYear" type="number" min="2000" max="2100" placeholder="例如：2026" />
      </div>

      <div>
        <label>月份</label>
        <select id="adminMonth">
          <option value="">全部月份</option>
          <option value="1">1 月</option>
          <option value="2">2 月</option>
          <option value="3">3 月</option>
          <option value="4">4 月</option>
          <option value="5">5 月</option>
          <option value="6">6 月</option>
          <option value="7">7 月</option>
          <option value="8">8 月</option>
          <option value="9">9 月</option>
          <option value="10">10 月</option>
          <option value="11">11 月</option>
          <option value="12">12 月</option>
        </select>
      </div>

      <div class="button-row" style="gap: 8px; align-items: end;">
        <button id="adminStatsSearchBtn" class="primary-btn" type="button">查詢</button>
        <button id="adminExportCsvBtn" class="secondary-btn" type="button">匯出 CSV</button>
      </div>
    </div>
  `;

  const firstCard = dashboard.querySelector("section.card");
  dashboard.insertBefore(filterPanel, firstCard);

  bindLoadingClick("adminStatsSearchBtn", loadAdminStats, { message: "查詢統計中，請稍後..." });
  bindLoadingClick("adminExportCsvBtn", exportAdminCsv, { message: "匯出中，請稍後..." });

  const currentYear = new Date().getFullYear();
  document.getElementById("adminYear").value = currentYear;
}

function getAdminQueryString() {
  const year = document.getElementById("adminYear")?.value.trim();
  const month = document.getElementById("adminMonth")?.value;

  const params = new URLSearchParams();

  if (year) {
    params.set("year", year);
  }

  if (month) {
    params.set("month", month);
  }

  return params.toString();
}

async function loadAdminStats() {
  const queryString = getAdminQueryString();
  const result = await apiGet(`/admin/stats${queryString ? `?${queryString}` : ""}`);

  if (!result.success) {
    alert(result.message || "讀取管理員統計資料失敗");
    return;
  }

  renderAdminStats(result.stats || {});
  renderBarChart("hotspotChart", result.hotspots || []);
  renderBarChart("categoryChart", result.categories || []);

  const monthlyTrend = (result.monthly_trend || []).map(item => ({
    name: item.month,
    count: item.count,
  }));

  if (!document.getElementById("adminMonthlyTrend")) {
    const recentSection = document.getElementById("adminRecentReports")?.closest("section");
    if (recentSection) {
      recentSection.insertAdjacentHTML(
        "beforebegin",
        `<section class="card"><h2>月份通報趨勢</h2><div id="adminMonthlyTrend" class="bar-chart"></div></section>`
      );
    }
  }

  renderBarChart("adminMonthlyTrend", monthlyTrend);
  renderReportsToContainer("adminRecentReports", result.recent_reports || [], false);
}

function exportAdminCsv() {
  const queryString = getAdminQueryString();
  const url = `${API_BASE_URL}/admin/export${queryString ? `?${queryString}` : ""}`;
  window.open(url, "_blank");
}

async function showAdminDashboard() {
  hideAllViews();

  document.getElementById("viewToolbar").classList.add("hidden");
  document.getElementById("adminDashboardView").classList.remove("hidden");

  ensureAdminFilterPanel();
  await loadAdminStats();
  ensureAdminSecurityPanel();
  await loadSuspiciousUsers();
}

function ensureAdminSecurityPanel() {
  const dashboard = document.getElementById("adminDashboardView");
  if (!dashboard || document.getElementById("suspiciousUsersArea")) {
    return;
  }

  const section = document.createElement("section");
  section.className = "card";
  section.innerHTML = `
    <div class="section-header">
      <h2>可疑使用者 / 封鎖管理</h2>
      <button id="adminUsersBtn" class="secondary-btn" type="button">用戶管理</button>
    </div>
    <div id="suspiciousUsersArea">
      <p class="muted-text">載入中...</p>
    </div>
  `;

  dashboard.appendChild(section);

  const adminUsersBtn = document.getElementById("adminUsersBtn");
  if (adminUsersBtn) {
    adminUsersBtn.addEventListener("click", async (event) => {
      await runWithLoading(() => toggleAdminUsersView(), {
        button: event.currentTarget,
        message: "載入用戶管理中，請稍後...",
      });
    });
  }
}

function renderSuspiciousUserCard(user) {
  return `
    <div class="user-row">
      <div>
        <strong>${escapeHtml(user.name || "")}</strong>
        <p>${roleLabel(user.role)}｜${escapeHtml(user.phone_number || "")}</p>
        <p>最近 24 小時操作數：${escapeHtml(user.recent_activity_count || 0)}</p>
        <p>狀態：${user.is_blocked ? "已封鎖" : "正常"}</p>
        ${
          user.blocked_reason
            ? `<p class="muted-text">封鎖原因：${escapeHtml(user.blocked_reason)}</p>`
            : ""
        }
      </div>

      <div>
        ${
          user.is_blocked
            ? `<button id="unblockUser-${user.user_id}" class="secondary-btn">解除封鎖</button>`
            : `<button id="blockUser-${user.user_id}" class="danger-btn">封鎖</button>`
        }
      </div>
    </div>
  `;
}

async function loadSuspiciousUsers() {
  adminUserPanelMode = "suspicious";
  updateAdminUsersButtonLabel();

  const area = document.getElementById("suspiciousUsersArea");
  if (!area) return;

  const result = await apiGet("/admin/suspicious-users");

  if (!result.success) {
    area.innerHTML = `<p class="muted-text">無法讀取可疑使用者。</p>`;
    return;
  }

  const users = result.users || [];

  area.innerHTML = users.length
    ? users.map(renderSuspiciousUserCard).join("")
    : `<p class="muted-text">目前沒有可疑使用者。</p>`;

  users.forEach((user) => {
    const blockBtn = document.getElementById(`blockUser-${user.user_id}`);
    if (blockBtn) {
      blockBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => blockUser(user.user_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }

    const unblockBtn = document.getElementById(`unblockUser-${user.user_id}`);
    if (unblockBtn) {
      unblockBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => unblockUser(user.user_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }
  });
}

function updateAdminUsersButtonLabel() {
  const adminUsersBtn = document.getElementById("adminUsersBtn");
  if (!adminUsersBtn) return;

  adminUsersBtn.textContent = adminUserPanelMode === "users" ? "可疑使用者" : "用戶管理";
}

function toggleAdminUsersView() {
  if (adminUserPanelMode === "users") {
    loadSuspiciousUsers();
    return;
  }

  showAdminUsers();
}

function renderAdminUserRow(user) {
  const identityValue = user.student_id || user.staff_id || "無";
  const suspiciousText = user.is_suspicious ? "是" : "否";
  const suspiciousClass = user.is_suspicious ? "danger-text" : "success-text";

  return `
    <tr>
      <td>${escapeHtml(user.name || "")}</td>
      <td>${escapeHtml(roleLabel(user.role))}</td>
      <td>${escapeHtml(identityValue)}</td>
      <td>${escapeHtml(user.phone_number || "")}</td>
      <td>${escapeHtml(String(user.total_reports || 0))}</td>
      <td>${escapeHtml(String(user.reports_last_hour || 0))}</td>
      <td class="${suspiciousClass}">
        ${suspiciousText}
        ${user.too_many_reports_in_hour ? "<br><small>一小時超過 10 筆</small>" : ""}
        ${user.has_duplicate_reports ? "<br><small>有重複通報</small>" : ""}
      </td>
      <td>
        ${user.is_blocked
          ? `<span class="status-badge blocked">已封鎖</span><br><small>${escapeHtml(user.blocked_reason || "")}</small>`
          : `<span class="status-badge active">正常</span>`
        }
      </td>
      <td>
        ${user.is_blocked
          ? `<button id="unblockUser-${user.user_id}" class="secondary-btn" type="button">解封</button>`
          : `<button id="blockUser-${user.user_id}" class="danger-btn" type="button">封鎖</button>`
        }
      </td>
    </tr>
  `;
}

async function showAdminUsers() {
  adminUserPanelMode = "users";
  updateAdminUsersButtonLabel();

  const area = document.getElementById("suspiciousUsersArea");
  if (!area) return;

  area.innerHTML = `<p class="muted-text">載入用戶資料中...</p>`;

  const result = await apiGet("/admin/users");

  if (!result.success) {
    area.innerHTML = `<p class="muted-text">無法讀取用戶資料。</p>`;
    return;
  }

  const users = result.users || [];

  area.innerHTML = users.length
    ? `
      <div class="admin-table-wrapper">
        <table class="admin-user-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>身分</th>
              <th>學號 / 教職員編號</th>
              <th>電話</th>
              <th>通報總數</th>
              <th>近 1 小時通報</th>
              <th>是否疑似大量重複通報</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(renderAdminUserRow).join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="muted-text">目前沒有用戶資料。</p>`;

  users.forEach((user) => {
    const blockBtn = document.getElementById(`blockUser-${user.user_id}`);
    if (blockBtn) {
      blockBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => blockUser(user.user_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }

    const unblockBtn = document.getElementById(`unblockUser-${user.user_id}`);
    if (unblockBtn) {
      unblockBtn.addEventListener("click", async (event) => {
        await runWithLoading(() => unblockUser(user.user_id), {
          button: event.currentTarget,
          message: "處理中，請稍後...",
        });
      });
    }
  });
}

async function refreshAdminUserPanel() {
  if (adminUserPanelMode === "users") {
    await showAdminUsers();
    return;
  }

  await loadSuspiciousUsers();
}

async function blockUser(userId) {
  const reason = prompt("請輸入封鎖原因：") || "疑似惡意操作";

  const result = await apiPatchJson(`/admin/users/${userId}/block`, { reason });

  if (!result.success) {
    alert(result.message || "封鎖失敗");
    return;
  }

  alert("已封鎖使用者。");
  await refreshAdminUserPanel();
}

async function unblockUser(userId) {
  const result = await apiPatchJson(`/admin/users/${userId}/unblock`, {});

  if (!result.success) {
    alert(result.message || "解除封鎖失敗");
    return;
  }

  alert("已解除封鎖。");
  await refreshAdminUserPanel();
}

function adminLogout() {
  isAdmin = false;
  document.body.classList.remove("admin-mode");

  document.getElementById("adminUsername").value = "";
  document.getElementById("adminPassword").value = "";

  showHomeView();
}

function renderAdminStats(stats) {
  const container = document.getElementById("adminStats");

  container.innerHTML = `
    <div class="stat-card"><span>總通報數</span><strong>${stats.total_reports}</strong></div>
    <div class="stat-card"><span>遺失物件數</span><strong>${stats.lost_count}</strong></div>
    <div class="stat-card"><span>拾獲物件數</span><strong>${stats.found_count}</strong></div>
    <div class="stat-card"><span>已處理遺失物</span><strong>${stats.processed_lost_count || 0}</strong></div>
    <div class="stat-card"><span>已認領拾獲物</span><strong>${stats.claimed_found_count || 0}</strong></div>
    <div class="stat-card"><span>配對成功 / 已結案</span><strong>${stats.success_count}</strong></div>
    <div class="stat-card"><span>認領申請數</span><strong>${stats.claim_request_count || 0}</strong></div>
    <div class="stat-card"><span>認領完成數</span><strong>${stats.claim_completed_count || 0}</strong></div>
    <div class="stat-card"><span>認領拒絕數</span><strong>${stats.claim_rejected_count || 0}</strong></div>
    <div class="stat-card"><span>處理率</span><strong>${stats.report_rate}</strong></div>
    <div class="stat-card"><span>使用者數</span><strong>${stats.user_count}</strong></div>
    <div class="stat-card"><span>聊天室數</span><strong>${stats.chat_count}</strong></div>
  `;
}

function renderBarChart(containerId, data) {
  const container = document.getElementById(containerId);

  if (!data || data.length === 0) {
    container.innerHTML = "<p>目前沒有資料。</p>";
    return;
  }

  const max = Math.max(...data.map(item => item.count));

  container.innerHTML = data.map(item => {
    const width = max === 0 ? 0 : Math.round((item.count / max) * 100);

    return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(item.name)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${width}%"></div>
        </div>
        <div class="bar-value">${item.count}</div>
      </div>
    `;
  }).join("");
}

/* =========================
   聊天室功能
========================= */

async function openChatWithSubmitter(report) {
  if (!currentUser) {
    alert("請先登入後再聯絡通報者。");
    showAuthView();
    return;
  }

  const result = await apiPostJson("/chat/open", {
    report_id: report.report_id,
    current_user_id: currentUser.user_id,
    other_user_id: report.user_id
  });

  if (!result.success) {
    alert(result.message || "無法開啟聊天室");
    return;
  }

  showChatView(result.conversation, report);
}

function showChatView(conversation, report = null) {
  currentConversation = conversation;

  hideAllViews();

  document.getElementById("viewToolbar").classList.remove("hidden");
  document.getElementById("chatView").classList.remove("hidden");
  document.getElementById("viewTitle").textContent = "聊天室";

  const relatedReport = report || conversation.report;

  document.getElementById("chatTitle").textContent =
    relatedReport ? `關於：${relatedReport.item_name}` : "聊天室";

  document.getElementById("chatHint").textContent =
    relatedReport ? `通報地點：${getReportLocationDisplay(relatedReport)}` : "";

  updateTrustButton(conversation, relatedReport);
  renderChatMessages(conversation);
}

function updateTrustButton(conversation, report) {
  const trustBtn = document.getElementById("trustUserBtn");

  trustBtn.classList.add("hidden");
  trustBtn.disabled = false;

  if (!currentUser || !report) return;

  const isFoundReportOwner =
    report.type === "F" &&
    String(report.user_id) === String(currentUser.user_id);

  if (!isFoundReportOwner) return;

  const otherUserId = conversation.participant_ids.find(id =>
    String(id) !== String(currentUser.user_id)
  );

  if (!otherUserId) return;

  if (String(report.trusted_user_id) === String(otherUserId)) {
    trustBtn.textContent = "已信任此遺失者";
    trustBtn.disabled = true;
  } else {
    trustBtn.textContent = "信任遺失者";
    trustBtn.disabled = false;
  }

  trustBtn.classList.remove("hidden");
}

function renderChatMessages(conversation) {
  const container = document.getElementById("chatMessages");

  if (!conversation.messages || conversation.messages.length === 0) {
    container.innerHTML = "<p class='muted-text'>目前尚無訊息。</p>";
    return;
  }

  container.innerHTML = conversation.messages.map(message => {
    const mine = currentUser && String(message.sender_id) === String(currentUser.user_id);

    return `
      <div class="chat-message ${mine ? "mine" : ""}">
        <strong>${escapeHtml(message.sender_name)}</strong>
        <div>${escapeHtml(message.content)}</div>
        <small>${escapeHtml(message.created_at)}</small>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const content = input.value.trim();

  if (!content) {
    alert("請輸入訊息");
    return;
  }

  if (!currentConversation || !currentUser) {
    alert("聊天室狀態錯誤");
    return;
  }

  const result = await apiPostJson("/chat/send", {
    conversation_id: currentConversation.conversation_id,
    sender_id: currentUser.user_id,
    content
  });

  if (!result.success) {
    alert(result.message || "訊息送出失敗");
    return;
  }

  currentConversation = result.conversation;
  input.value = "";

  renderChatMessages(currentConversation);
  await loadNotifications();
}

async function trustCurrentChatUser() {
  if (!currentConversation || !currentUser) {
    alert("聊天室狀態錯誤");
    return;
  }

  const report = currentConversation.report;

  if (!report) {
    alert("找不到對應通報");
    return;
  }

  const otherUserId = currentConversation.participant_ids.find(id =>
    String(id) !== String(currentUser.user_id)
  );

  const result = await apiPostJson("/chat/trust", {
    report_id: report.report_id,
    owner_user_id: currentUser.user_id,
    trusted_user_id: otherUserId
  });

  if (!result.success) {
    alert(result.message || "信任失敗");
    return;
  }

  alert(result.message);
  updateTrustButton(currentConversation, result.report);
  await loadReports(false, false);
}

/* =========================
   工具 functions
========================= */

function getPhotoUrl(photoPath) {
  if (!photoPath) return "";
  if (photoPath.startsWith("blob:")) return photoPath;
  if (photoPath.startsWith("http")) return photoPath;
  if (photoPath.startsWith("/uploads")) return `${APP_BASE_URL}${photoPath}`;
  return photoPath;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("zh-TW", {
    hour12: false,
  });
}