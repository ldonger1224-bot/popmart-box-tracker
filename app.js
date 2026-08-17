const STORAGE_KEY = "box-machine-records";
const ACCOUNTS_KEY = "box-machine-account-names";
const ACTIVE_ACCOUNT_KEY = "box-machine-active-account";
const STYLE_MEMORY_KEY = "box-machine-style-memory";
const BACKUP_META_KEY = "box-machine-backup-meta";
const APP_VERSION = "v44";
const ACCOUNT_COUNT = 6;
const SALE_TYPES = [
  { name: "现货", color: "#41bca5" },
  { name: "预售", color: "#ef6f92" },
];
const NON_STYLE_WORDS = /^(点击|状态区域|商品区域|金额区域|时间区域|小盒|端盒|整盒|盲盒|单盒|盒|盒子|一盒|一小盒|商品|金额|商品金额|确认|购买|待付款|待发货|待校对商品)$/;
const STYLE_NAME_CORRECTIONS = new Map([
  ["防征工事", "防御工事"],
]);

const elements = {
  imageInput: document.querySelector("#imageInput"),
  selectButton: document.querySelector("#selectButton"),
  replaceButton: document.querySelector("#replaceButton"),
  scanButton: document.querySelector("#scanButton"),
  batchPanel: document.querySelector("#batchPanel"),
  batchHint: document.querySelector("#batchHint"),
  batchList: document.querySelector("#batchList"),
  batchScanButton: document.querySelector("#batchScanButton"),
  clearBatchButton: document.querySelector("#clearBatchButton"),
  dropZone: document.querySelector("#dropZone"),
  uploadEmpty: document.querySelector("#uploadEmpty"),
  previewWrap: document.querySelector("#previewWrap"),
  previewImage: document.querySelector("#previewImage"),
  statusDot: document.querySelector("#statusDot"),
  scanStatus: document.querySelector("#scanStatus"),
  progressBar: document.querySelector("#progressBar"),
  rawText: document.querySelector("#rawText"),
  parseButton: document.querySelector("#parseButton"),
  installButton: document.querySelector("#installButton"),
  activeAccountSelect: document.querySelector("#activeAccountSelect"),
  headerHint: document.querySelector("#headerHint"),
  formAccountHint: document.querySelector("#formAccountHint"),
  entryForm: document.querySelector("#entryForm"),
  accountInput: document.querySelector("#accountInput"),
  productNameInput: document.querySelector("#productNameInput"),
  styleNameInput: document.querySelector("#styleNameInput"),
  styleSuggestions: document.querySelector("#styleSuggestions"),
  styleReference: document.querySelector("#styleReference"),
  styleReferenceImage: document.querySelector("#styleReferenceImage"),
  quantityInput: document.querySelector("#quantityInput"),
  priceInput: document.querySelector("#priceInput"),
  purchaseTimeInput: document.querySelector("#purchaseTimeInput"),
  saleTypeInput: document.querySelector("#saleTypeInput"),
  salePriceInput: document.querySelector("#salePriceInput"),
  saleTimeInput: document.querySelector("#saleTimeInput"),
  noteInput: document.querySelector("#noteInput"),
  resetButton: document.querySelector("#resetButton"),
  saveButton: document.querySelector("#saveButton"),
  formDeleteButton: document.querySelector("#formDeleteButton"),
  ledgerList: document.querySelector("#ledgerList"),
  monthTotal: document.querySelector("#monthTotal"),
  monthRevenueTotal: document.querySelector("#monthRevenueTotal"),
  entryCount: document.querySelector("#entryCount"),
  exportButton: document.querySelector("#exportButton"),
  backupButton: document.querySelector("#backupButton"),
  importDataButton: document.querySelector("#importDataButton"),
  importDataInput: document.querySelector("#importDataInput"),
  refreshAppButton: document.querySelector("#refreshAppButton"),
  versionText: document.querySelector("#versionText"),
  cleanupBadButton: document.querySelector("#cleanupBadButton"),
  accountFilter: document.querySelector("#accountFilter"),
  accountNameGrid: document.querySelector("#accountNameGrid"),
  accountProductsGrid: document.querySelector("#accountProductsGrid"),
  statusFilter: document.querySelector("#statusFilter"),
  inventorySearchInput: document.querySelector("#inventorySearchInput"),
  soldHistoryToggle: document.querySelector("#soldHistoryToggle"),
  soldHistoryPanel: document.querySelector("#soldHistoryPanel"),
  soldHistoryList: document.querySelector("#soldHistoryList"),
  statePills: document.querySelector("#statePills"),
  stockSearchInput: document.querySelector("#stockSearchInput"),
  stockSearchResults: document.querySelector("#stockSearchResults"),
  stockList: document.querySelector("#stockList"),
  soldList: document.querySelector("#soldList"),
  allAccountSummary: document.querySelector("#allAccountSummary"),
  statsMonthInput: document.querySelector("#statsMonthInput"),
  statsRevenue: document.querySelector("#statsRevenue"),
  statsProfit: document.querySelector("#statsProfit"),
  statsSoldCount: document.querySelector("#statsSoldCount"),
  statsSpend: document.querySelector("#statsSpend"),
  statsReturnRate: document.querySelector("#statsReturnRate"),
  backupReminder: document.querySelector("#backupReminder"),
  sellSheet: document.querySelector("#sellSheet"),
  sellSheetTitle: document.querySelector("#sellSheetTitle"),
  sellSheetMeta: document.querySelector("#sellSheetMeta"),
  sellQuantityInput: document.querySelector("#sellQuantityInput"),
  sellUnitPriceInput: document.querySelector("#sellUnitPriceInput"),
  sellSplitPricesInput: document.querySelector("#sellSplitPricesInput"),
  sellPriceLines: document.querySelector("#sellPriceLines"),
  sellTimeInput: document.querySelector("#sellTimeInput"),
  sellCancelButton: document.querySelector("#sellCancelButton"),
  sellConfirmButton: document.querySelector("#sellConfirmButton"),
  addStockSheet: document.querySelector("#addStockSheet"),
  addStockTitle: document.querySelector("#addStockTitle"),
  addStockMeta: document.querySelector("#addStockMeta"),
  addStockQuantityInput: document.querySelector("#addStockQuantityInput"),
  addStockUnitPriceInput: document.querySelector("#addStockUnitPriceInput"),
  addStockTotal: document.querySelector("#addStockTotal"),
  addStockTimeInput: document.querySelector("#addStockTimeInput"),
  addStockSaleTypeInput: document.querySelector("#addStockSaleTypeInput"),
  addStockCancelButton: document.querySelector("#addStockCancelButton"),
  addStockConfirmButton: document.querySelector("#addStockConfirmButton"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  tabPanels: document.querySelectorAll("[data-tab-panel]"),
};

let currentImageData = "";
let currentProductImageData = "";
let currentOcrImageData = "";
let currentStyleImageData = "";
let entries = readEntries();
let accountNames = readAccountNames();
let styleMemory = readStyleMemory();
let activeAccount = readActiveAccount();
let deferredInstallPrompt = null;
let editingId = "";
let batchFiles = [];
let scanRunId = 0;
let ocrWorkerPromise = null;
let currentOcrProgress = null;
let sellingStockKey = "";
let addingStockKey = "";
let expandedStockKeys = new Set();
let showSoldHistory = false;

function formatMoney(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function nowLocal() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function selectedStatsMonth() {
  return elements.statsMonthInput.value || currentMonth();
}

function setStatus(message, mode = "idle", progress = null) {
  elements.scanStatus.textContent = message;
  elements.statusDot.classList.toggle("active", mode === "active");
  elements.statusDot.classList.toggle("warn", mode === "warn");
  if (progress !== null) {
    elements.progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
}

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function readEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(normalizeEntry);
  } catch {
    return [];
  }
}

function normalizeEntry(entry) {
  const productImage = entry.productImage || entry.image || "";
  return {
    ...entry,
    quantity: normalizedQuantityForEntry(entry),
    price: Number(entry.price || 0),
    salePrice: Number(entry.salePrice || 0),
    productName: cleanStoredName(entry.productName),
    styleName: cleanStoredStyle(entry.styleName),
    purchaseTime: normalizeStoredPurchaseTime(entry),
    saleType: normalizeSaleType(entry.saleType),
    image: "",
    productImage,
    styleImage: shrinkPersistedImage(entry.styleImage, 7000),
  };
}

function normalizeSaleType(value) {
  return value === "预售" ? "预售" : "现货";
}

function cleanStoredName(value) {
  const name = String(value || "").trim();
  return isBadProductName(name) ? "待校对商品" : name;
}

function cleanStoredStyle(value) {
  const style = correctStyleName(String(value || "").trim());
  return isNonStyleWord(style) ? "" : style;
}

function normalizeStoredPurchaseTime(entry) {
  const purchaseTime = String(entry.purchaseTime || "");
  if (!purchaseTime) return purchaseTime;
  if (entry.quantitySource === "manual") return purchaseTime;
  const parsed = new Date(purchaseTime);
  if (Number.isNaN(parsed.getTime())) return purchaseTime;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (parsed <= tomorrow) return purchaseTime;
  return localTimeFromTimestamp(entry.createdAt) || nowLocal();
}

function shrinkPersistedImage(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? "" : text;
}

function normalizedQuantityForEntry(entry) {
  const quantity = safeQuantity(entry.quantity);
  if (entry.quantitySource === "manual") return quantity;
  if (quantity <= 1) return 1;
  if (hasExplicitQuantityText(entry.rawText)) return quantity;
  return 1;
}

function safeQuantity(value) {
  const quantity = Number.parseInt(value, 10);
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  if (quantity > 20) return 1;
  return quantity;
}

function localTimeFromTimestamp(value) {
  const time = Number(value || 0);
  if (!Number.isFinite(time) || time <= 0) return "";
  const date = new Date(time);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function hasExplicitQuantityText(text) {
  return /(?:购买数量|商品数量|数量|件数|qty)[^\d]{0,8}\d{1,2}/i.test(String(text || ""));
}

function saveEntries() {
  entries = entries.map(normalizeEntry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn(error);
    entries = entries.map((entry) => ({
      ...entry,
      image: "",
      styleImage: "",
      productImage: shrinkPersistedImage(entry.productImage, 24000),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

function readAccountNames() {
  const defaults = Array.from({ length: ACCOUNT_COUNT }, (_, index) => `账号 ${index + 1}`);
  try {
    const saved = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    return readFixedAccountNames(saved);
  } catch {
    return defaults;
  }
}

function readFixedAccountNames(values) {
  const defaults = Array.from({ length: ACCOUNT_COUNT }, (_, index) => `账号 ${index + 1}`);
  return defaults.map((fallback, index) => String(values?.[index] || fallback));
}

function saveAccountNames() {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accountNames));
}

function readStyleMemory() {
  try {
    return JSON.parse(localStorage.getItem(STYLE_MEMORY_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStyleMemory() {
  localStorage.setItem(STYLE_MEMORY_KEY, JSON.stringify(styleMemory));
}

function rememberStyle(productName, styleName) {
  const productKey = normalizeMemoryKey(productName);
  const style = String(styleName || "").trim();
  if (!productKey || !style || isNonStyleWord(style)) return;
  const existing = Array.isArray(styleMemory[productKey]) ? styleMemory[productKey] : [];
  styleMemory[productKey] = [style, ...existing.filter((item) => item !== style)].slice(0, 12);
  saveStyleMemory();
}

function rememberedStyles(productName) {
  return (styleMemory[normalizeMemoryKey(productName)] || []).filter((style) => !isNonStyleWord(style));
}

function normalizeMemoryKey(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[【】\[\]（）()]/g, "")
    .trim();
}

function readActiveAccount() {
  const saved = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  return /^account-[1-6]$/.test(saved || "") ? saved : accountId(0);
}

function saveActiveAccount() {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeAccount);
}

function accountId(index) {
  return `account-${index + 1}`;
}

function accountName(id) {
  const index = Number(String(id || "").replace("account-", "")) - 1;
  return accountNames[index] || accountNames[0];
}

function accountIndex(id) {
  const index = Number(String(id || "").replace("account-", "")) - 1;
  return Number.isFinite(index) ? index : 0;
}

function renderAccountControls() {
  const selectedAccount = elements.accountInput.value || activeAccount || accountId(0);
  const selectedFilter = elements.accountFilter.value || "";
  elements.accountInput.innerHTML = "";
  elements.accountFilter.innerHTML = '<option value="">全部账号</option>';
  elements.activeAccountSelect.innerHTML = "";

  accountNames.forEach((name, index) => {
    const id = accountId(index);
    elements.accountInput.append(new Option(name, id));
    elements.accountFilter.append(new Option(name, id));
    elements.activeAccountSelect.append(new Option(name, id));
  });

  elements.accountInput.value = accountNames.some((_, index) => accountId(index) === selectedAccount)
    ? selectedAccount
    : accountId(0);
  elements.accountFilter.value = accountNames.some((_, index) => accountId(index) === selectedFilter)
    ? selectedFilter
    : "";
  elements.activeAccountSelect.value = activeAccount;
  elements.formAccountHint.textContent = `保存到 ${accountName(activeAccount)}`;
}

function renderAccountSettings() {
  elements.accountNameGrid.innerHTML = "";
  accountNames.forEach((name, index) => {
    const label = document.createElement("label");
    label.innerHTML = `
      账号 ${index + 1}
      <input type="text" value="${escapeHtml(name)}" data-account-index="${index}" />
    `;
    label.querySelector("input").addEventListener("input", (event) => {
      accountNames[index] = event.target.value.trim() || `账号 ${index + 1}`;
      saveAccountNames();
      renderAccountControls();
      if (batchFiles.length) renderBatchList();
      renderLedger();
    });
    elements.accountNameGrid.append(label);
  });
}

function saleTypeColor(type) {
  return SALE_TYPES.find((item) => item.name === type)?.color || "#8c8090";
}

function resetForm() {
  elements.entryForm.reset();
  editingId = "";
  elements.saveButton.textContent = "保存入库";
  elements.accountInput.value = activeAccount;
  elements.quantityInput.value = 1;
  elements.purchaseTimeInput.value = nowLocal();
  elements.saleTypeInput.value = "现货";
  elements.formDeleteButton.classList.add("hidden");
  elements.formAccountHint.textContent = `保存到 ${accountName(activeAccount)}`;
  renderStyleSuggestions([]);
  renderStyleReference("");
}

function resetImage() {
  currentImageData = "";
  currentProductImageData = "";
  currentOcrImageData = "";
  currentStyleImageData = "";
  elements.previewImage.removeAttribute("src");
  elements.previewWrap.classList.add("hidden");
  elements.uploadEmpty.classList.remove("hidden");
  renderStyleReference("");
}

function handleFiles(fileList) {
  const files = [...fileList].filter((item) => item.type.startsWith("image/"));
  if (files.length > 1) {
    setBatchFiles(files);
    return;
  }

  const file = files[0];
  if (!file) {
    setStatus("请选择图片文件", "warn", 0);
    return;
  }

  Promise.all([optimizeImage(file, 1100, 0.82), prepareOcrImage(file)]).then(([colorImageData, ocrImageData]) => {
    currentImageData = colorImageData;
    currentOcrImageData = ocrImageData;
    cropProductImage(colorImageData).then((productImage) => {
      currentProductImageData = productImage || colorImageData;
    });
    cropStyleReferenceImage(colorImageData).then((styleImage) => {
      currentStyleImageData = styleImage;
      renderStyleReference(styleImage);
    });
    elements.previewImage.src = currentImageData;
    elements.uploadEmpty.classList.add("hidden");
    elements.previewWrap.classList.remove("hidden");
    elements.imageInput.value = "";
    warnIfImageLooksIncomplete(colorImageData);
  });
}

function warnIfImageLooksIncomplete(imageData) {
  imageSize(imageData).then((size) => {
    if (!size.width || !size.height) {
      setStatus("图片已上传，可以开始识别", "active", 0);
      return;
    }
    const ratio = size.height / size.width;
    if (ratio < 1.75 || ratio > 2.45 || size.width < 900) {
      setStatus("图片可能不是完整订单截图，请确认商品、金额和时间都在图里", "warn", 0);
      return;
    }
    setStatus("图片已上传，可以开始识别", "active", 0);
  });
}

function imageSize(imageData) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = imageData;
  });
}

function setBatchFiles(files) {
  const batchLimit = 6;
  batchFiles = files.slice(0, batchLimit);
  elements.imageInput.value = "";
  elements.batchPanel.classList.remove("hidden");
  currentImageData = "";
  currentProductImageData = "";
  currentOcrImageData = "";
  currentStyleImageData = "";
  elements.previewImage.removeAttribute("src");
  elements.previewWrap.classList.add("hidden");
  elements.uploadEmpty.classList.remove("hidden");
  renderStyleReference("");
  renderBatchList();
  setStatus(
    files.length > batchLimit
      ? `手机端每次最多处理 ${batchLimit} 张，已先放入前 ${batchLimit} 张`
      : `已选择 ${batchFiles.length} 张截图，可批量识别`,
    "active",
    0,
  );
}

function clearBatch() {
  releaseBatchQueue();
  setStatus("已清空批量队列", "idle", 0);
}

function releaseBatchQueue() {
  batchFiles = [];
  elements.imageInput.value = "";
  elements.batchPanel.classList.add("hidden");
  elements.batchList.innerHTML = "";
  elements.batchHint.textContent = "已选择 0 张截图";
}

function renderBatchList() {
  elements.batchHint.textContent = `已选择 ${batchFiles.length} 张截图，保存到 ${accountName(activeAccount)}`;
  elements.batchList.innerHTML = "";
  batchFiles.forEach((file, index) => {
    const item = document.createElement("article");
    item.className = "batch-item";
    item.innerHTML = `
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(file.name || `截图 ${index + 1}`)}</strong>
        <small>${formatFileSize(file.size)}</small>
      </div>
    `;
    elements.batchList.append(item);
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function scanBatchImages() {
  if (!batchFiles.length) {
    setStatus("先选择多张图片", "warn", 0);
    return;
  }
  if (!window.Tesseract) {
    setStatus("本地 OCR 文件未加载，请检查 PWA 文件是否完整", "warn", 0);
    return;
  }

  elements.batchScanButton.disabled = true;
  elements.scanButton.disabled = true;
  const savedEntries = [];

  try {
    for (const [index, file] of batchFiles.entries()) {
      if (!file) continue;
      const item = elements.batchList.children[index];
      item?.classList.add("active");
      setStatus(`正在识别第 ${index + 1}/${batchFiles.length} 张`, "active", Math.round((index / batchFiles.length) * 100));
      const [colorImageData, ocrImageData] = await Promise.all([optimizeImage(file, 1100, 0.82), prepareOcrImage(file)]);
      const productImage = (await cropProductImage(colorImageData)) || colorImageData;
      const styleImage = await cropStyleReferenceImage(colorImageData);
      let ocrResult = { rawText: "", parsed: {} };
      try {
        ocrResult = await withTimeout(recognizePopmartScreenshot(ocrImageData, colorImageData, (message, progress) => {
          const totalProgress = ((index + progress / 100) / batchFiles.length) * 100;
          setStatus(`${message} · ${index + 1}/${batchFiles.length}`, "active", totalProgress);
        }), 90000, "OCR_TIMEOUT");
      } catch (error) {
        console.warn(error);
        if (error.message === "OCR_TIMEOUT") await resetOcrWorker();
        setStatus(`第 ${index + 1} 张识别失败，已跳过`, "warn", Math.round(((index + 1) / batchFiles.length) * 100));
      }
      const parsed = ocrResult.parsed || {};
      if (!hasUsableOcrResult(ocrResult.rawText, parsed)) {
        batchFiles[index] = null;
        item?.classList.remove("active");
        item?.classList.add("done");
        const hint = item?.querySelector("small");
        if (hint) hint.textContent = "识别失败，未保存";
        await new Promise((resolve) => window.setTimeout(resolve, 30));
        continue;
      }
      const entry = {
        id: crypto.randomUUID(),
        accountId: activeAccount,
        productName: parsed.productName || "待校对商品",
        styleName: parsed.styleName || "",
        quantity: safeQuantity(parsed.quantity),
        quantitySource: "ocr",
        price: Number(parsed.price || 0),
        purchaseTime: parsed.purchaseTime || nowLocal(),
        saleType: normalizeSaleType(parsed.saleType),
        salePrice: 0,
        saleTime: "",
        note: parsed.productName && parsed.styleName ? "" : "批量入库：请校对名称、款式和价格",
        image: "",
        productImage,
        styleImage,
        rawText: ocrResult.rawText,
        channel: "抽盒机",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      entries.push(entry);
      rememberStyle(entry.productName, entry.styleName);
      savedEntries.push(entry);
      batchFiles[index] = null;
      item?.classList.remove("active");
      item?.classList.add("done");
      await new Promise((resolve) => window.setTimeout(resolve, 30));
    }

    saveEntries();
    renderLedger();
    setStatus(`批量入库完成，已保存 ${savedEntries.length} 条`, "active", 100);
    clearBatch();
    resetImage();
    elements.imageInput.value = "";
    switchTab("inventory");
  } catch (error) {
    console.error(error);
    saveEntries();
    renderLedger();
    releaseBatchQueue();
    resetImage();
    setStatus(`批量入库中断，已保存 ${savedEntries.length} 条`, "warn", 100);
  } finally {
    elements.batchScanButton.disabled = false;
    elements.scanButton.disabled = false;
  }
}

function hasUsableOcrResult(rawText, parsed) {
  if (!String(rawText || "").trim()) return false;
  return Boolean(parsed?.productName || parsed?.styleName || Number(parsed?.price || 0) > 0);
}

function cropProductImage(imageData) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.width;
      const sourceHeight = image.height;
      const crop = {
        x: Math.round(sourceWidth * 0.035),
        y: Math.round(sourceHeight * 0.245),
        size: Math.round(sourceWidth * 0.205),
      };
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 180;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        crop.x,
        crop.y,
        Math.min(crop.size, sourceWidth - crop.x),
        Math.min(crop.size, sourceHeight - crop.y),
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve("");
    image.src = imageData;
  });
}

function cropStyleReferenceImage(imageData) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 520;
      canvas.height = 180;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        Math.round(image.width * 0.2),
        Math.round(image.height * 0.265),
        Math.round(image.width * 0.72),
        Math.round(image.height * 0.16),
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.68));
    };
    image.onerror = () => resolve("");
    image.src = imageData;
  });
}

function optimizeImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function prepareOcrImage(file, maxSide = 1500, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < data.data.length; index += 4) {
          const gray = data.data[index] * 0.299 + data.data[index + 1] * 0.587 + data.data[index + 2] * 0.114;
          const adjusted = gray < 210 ? Math.max(0, (gray - 18) * 0.62) : 255;
          data.data[index] = adjusted;
          data.data[index + 1] = adjusted;
          data.data[index + 2] = adjusted;
        }
        context.putImageData(data, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function scanImage() {
  if (!currentImageData) {
    setStatus("先上传一张图片", "warn", 0);
    return;
  }

  if (!window.Tesseract) {
    setStatus("本地 OCR 文件未加载，请检查 PWA 文件是否完整", "warn", 0);
    return;
  }

  const runId = ++scanRunId;
  elements.scanButton.disabled = true;
  setStatus("正在加载本地 OCR", "active", 4);

  try {
    const result = await withTimeout(recognizePopmartScreenshot(currentOcrImageData || currentImageData, currentImageData, (message, progress) => {
      if (runId !== scanRunId) return;
      setStatus(message, "active", progress);
    }), 90000, "OCR_TIMEOUT");
    if (runId !== scanRunId) return;
    elements.rawText.value = result.rawText;
    fillFormFromParsedRecord(result.parsed);
    setStatus("识别完成，已填入可校对内容", "active", 100);
  } catch (error) {
    console.error(error);
    const timedOut = error.message === "OCR_TIMEOUT";
    if (timedOut) await resetOcrWorker();
    setStatus(timedOut ? "识别超时，截图已保留，请手动填写" : "识别失败，可粘贴文字或手动填写", "warn", 0);
  } finally {
    elements.scanButton.disabled = false;
  }
}

async function recognizePopmartScreenshot(primaryImageData, colorImageData, onProgress) {
  onProgress?.("正在按固定位置识别", 10);
  const combinedRegion = await cropCombinedOcrRegion(primaryImageData);
  if (combinedRegion) {
    try {
      const combined = await recognizeImageData(combinedRegion, (message, progress) => {
        onProgress?.(`${message} · 固定区域`, Math.min(78, 12 + progress * 0.66));
      });
      if (hasUsableOcrResult(combined.rawText, combined.parsed)) {
        return combined;
      }
    } catch (error) {
      console.warn(error);
      await resetOcrWorker();
    }
  }

  const regionTexts = [];
  const regions = await cropOcrRegions(primaryImageData);

  for (const [index, region] of regions.entries()) {
    try {
      const result = await recognizeImageData(region.imageData, (message, progress) => {
        onProgress?.(`${message} · 区域 ${index + 1}/${regions.length}`, Math.min(78, 12 + (index * 16) + progress * 0.14));
      });
      if (result.rawText) {
        regionTexts.push(`${region.label}\n${result.rawText}`);
      }
    } catch (error) {
      console.warn(error);
      await resetOcrWorker();
    }
  }

  const regionText = regionTexts.join("\n");
  const regionParsed = parseRecordFields(regionText);
  if (hasUsableOcrResult(regionText, regionParsed)) {
    return {
      rawText: regionText,
      parsed: regionParsed,
    };
  }

  return recognizeImageWithFallback(primaryImageData, colorImageData, onProgress);
}

async function recognizeImageWithFallback(primaryImageData, fallbackImageData, onProgress) {
  const primary = await recognizeImageData(primaryImageData, onProgress);
  if (hasUsableOcrResult(primary.rawText, primary.parsed) || !fallbackImageData || fallbackImageData === primaryImageData) {
    return primary;
  }

  onProgress?.("正在用彩色图补识别", 72);
  const fallback = await recognizeImageData(fallbackImageData, onProgress);
  return hasUsableOcrResult(fallback.rawText, fallback.parsed) ? fallback : primary;
}

function cropOcrRegions(imageData) {
  const regionDefs = [
    { label: "状态区域", x: 0.02, y: 0.12, width: 0.96, height: 0.12 },
    { label: "商品区域", x: 0.22, y: 0.23, width: 0.74, height: 0.18 },
    { label: "金额区域", x: 0.02, y: 0.38, width: 0.96, height: 0.17 },
    { label: "时间区域", x: 0.02, y: 0.66, width: 0.92, height: 0.19 },
  ];

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const regions = regionDefs.map((region) => ({
        label: region.label,
        imageData: cropRegionFromImage(image, region),
      }));
      resolve(regions);
    };
    image.onerror = () => resolve([]);
    image.src = imageData;
  });
}

function cropCombinedOcrRegion(imageData) {
  const regionDefs = [
    { label: "状态区域", x: 0.02, y: 0.12, width: 0.96, height: 0.12 },
    { label: "商品区域", x: 0.22, y: 0.23, width: 0.74, height: 0.18 },
    { label: "金额区域", x: 0.02, y: 0.38, width: 0.96, height: 0.17 },
    { label: "时间区域", x: 0.02, y: 0.66, width: 0.92, height: 0.19 },
  ];

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = 1.7;
      const labelHeight = 34;
      const gap = 18;
      const canvasWidth = Math.round(image.width * 0.96 * scale);
      const canvasHeight = regionDefs.reduce((sum, region) => sum + labelHeight + Math.round(image.height * region.height * scale) + gap, 0);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, canvasWidth);
      canvas.height = Math.max(1, canvasHeight);
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111111";
      context.font = "24px system-ui, sans-serif";
      let targetY = 0;

      regionDefs.forEach((region) => {
        const sourceX = Math.round(image.width * region.x);
        const sourceY = Math.round(image.height * region.y);
        const sourceWidth = Math.round(image.width * region.width);
        const sourceHeight = Math.round(image.height * region.height);
        const targetWidth = Math.round(sourceWidth * scale);
        const targetHeight = Math.round(sourceHeight * scale);
        context.fillText(region.label, 8, targetY + 25);
        targetY += labelHeight;
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, targetY, targetWidth, targetHeight);
        targetY += targetHeight + gap;
      });

      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = () => resolve("");
    image.src = imageData;
  });
}

function cropRegionFromImage(image, region) {
  const sourceX = Math.round(image.width * region.x);
  const sourceY = Math.round(image.height * region.y);
  const sourceWidth = Math.round(image.width * region.width);
  const sourceHeight = Math.round(image.height * region.height);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, sourceWidth * scale);
  canvas.height = Math.max(1, sourceHeight * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function recognizeImageData(imageData, onProgress) {
  currentOcrProgress = onProgress;
  try {
    const worker = await getOcrWorker();
    const result = await worker.recognize(imageData);
    const rawText = result.data.text.trim();
    return {
      rawText,
      parsed: parseRecordFields(rawText),
    };
  } finally {
    if (currentOcrProgress === onProgress) currentOcrProgress = null;
  }
}

async function getOcrWorker() {
  if (ocrWorkerPromise) return ocrWorkerPromise;
  const ocrOptions = {
    workerPath: "./vendor/tesseract/worker.min.js",
    corePath: "./vendor/tesseract-core",
    langPath: "./tessdata",
    gzip: true,
    logger(event) {
      if (event.status === "loading language traineddata") {
        currentOcrProgress?.("正在加载离线语言包", Math.round(event.progress * 28) + 6);
      }
      if (event.status === "recognizing text") {
        currentOcrProgress?.("正在识别截图文字", Math.round(event.progress * 62) + 34);
      }
    },
  };
  currentOcrProgress?.("正在加载离线 OCR", 6);
  ocrWorkerPromise = Tesseract.createWorker("chi_sim+eng", 1, ocrOptions);
  const worker = await ocrWorkerPromise;
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM?.SPARSE_TEXT || "11",
    preserve_interword_spaces: "1",
  });
  return worker;
}

async function resetOcrWorker() {
  const workerPromise = ocrWorkerPromise;
  ocrWorkerPromise = null;
  currentOcrProgress = null;
  try {
    const worker = await workerPromise;
    await worker?.terminate?.();
  } catch (error) {
    console.warn(error);
  }
}

function parseRecordText(text) {
  const parsed = parseRecordFields(text);
  if (!parsed.hasText) {
    setStatus("没有可提取的文本", "warn", 0);
    return;
  }

  fillFormFromParsedRecord(parsed);
  setStatus("已提取商品信息，请校对", "active", 100);
}

function parseRecordFields(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  const normalizedText = normalizeOcrText(text);
  const normalizedLines = normalizedText.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  if (!lines.length) {
    return { hasText: false };
  }

  const price = extractTotalAmount(normalizedLines);
  const quantity = extractQuantity(normalizedText);
  const name = extractProductName(normalizedLines);
  const styleCandidates = extractStyleCandidates(normalizedLines, name);
  const styleName = styleCandidates[0] || "";
  const purchaseTime = extractPurchaseTime(normalizedText);
  const saleType = extractSaleType(normalizedText);

  return {
    hasText: true,
    productName: name,
    styleName,
    quantity,
    price,
    purchaseTime,
    saleType,
    styleCandidates,
  };
}

function fillFormFromParsedRecord(parsed) {
  if (!parsed) return;
  elements.productNameInput.value = parsed.productName || elements.productNameInput.value;
  elements.styleNameInput.value = parsed.styleName || elements.styleNameInput.value;
  elements.quantityInput.value = safeQuantity(parsed.quantity || elements.quantityInput.value || 1);
  elements.priceInput.value = parsed.price ? parsed.price.toFixed(2) : elements.priceInput.value;
  elements.purchaseTimeInput.value = parsed.purchaseTime || elements.purchaseTimeInput.value || nowLocal();
  elements.saleTypeInput.value = normalizeSaleType(parsed.saleType);
  renderStyleSuggestions(parsed.styleCandidates || [], elements.productNameInput.value);
}

function renderStyleSuggestions(candidates, productName = elements.productNameInput.value) {
  const remembered = rememberedStyles(productName);
  const values = [...new Set([...remembered, ...candidates].filter((value) => value && !isNonStyleWord(value)))].slice(0, 8);
  elements.styleSuggestions.innerHTML = "";
  elements.styleSuggestions.classList.toggle("hidden", !values.length);
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value;
    button.addEventListener("click", () => {
      elements.styleNameInput.value = value;
    });
    elements.styleSuggestions.append(button);
  });
}

function renderStyleReference(imageData) {
  if (!imageData) {
    elements.styleReference.classList.add("hidden");
    elements.styleReferenceImage.removeAttribute("src");
    return;
  }
  elements.styleReferenceImage.src = imageData;
  elements.styleReference.classList.remove("hidden");
}

function normalizeOcrText(text) {
  return text
    .split(/\n+/)
    .map((line) =>
      normalizeLatinSpacing(line)
        .replace(/([一-龥])\s+(?=[一-龥])/g, "$1")
        .replace(/[＊*]\s*(\d+(?:[.,]\d{1,2})?)/g, "¥$1")
        .replace(/[“”]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function normalizeLatinSpacing(line) {
  return String(line || "").replace(/\b((?:[A-Za-z]\s+){2,}[A-Za-z])\b/g, (match) => match.replace(/\s+/g, ""));
}

function extractTotalAmount(lines) {
  const totalKeywords = /(合计|总计|总额|实付|应付|支付|金额|价格|售价|total|amount|paid|price)/i;
  const candidates = [];

  lines.forEach((line, index) => {
    findAmountMatches(line).forEach((match) => {
      if (!match.hasCurrency && !totalKeywords.test(line)) return;
      candidates.push({
        amount: match.amount,
        score:
          (totalKeywords.test(line) ? 160 : 0) +
          (match.hasCurrency ? 80 : 0) +
          (/商品金额|实付|支付金额|应付/.test(line) ? 60 : 0) -
          index / 100,
      });
    });
  });

  if (!candidates.length) return 0;
  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return candidates[0].amount;
}

function extractProductName(lines) {
  const joined = lines.join(" ");
  const labeledLine = lines.find((line) => /抽盒/.test(line));
  if (labeledLine) return cleanProductName(labeledLine);

  const labeled = joined.match(/[【\[]?\s*抽盒\s*[】\]]?\s*([^\n¥￥]{2,56}?)(?:\s{2,}|¥|￥|商品金额|订单编号|下单时间)/);
  if (labeled) return cleanProductName(labeled[1]);

  const ignored = /(状态区域|商品区域|金额区域|时间区域|泡泡玛特|抽盒机|盒柜|待发货|订单|支付|金额|优惠|实付|价格|数量|时间|购买|现货|预售|合计|总计|收货|地址|编号|位置|快照|复制|点击查看|微信支付|¥|￥)/i;
  const candidate = lines.find((line) => {
    const value = cleanProductName(line);
    return value.length >= 2 && value.length <= 56 && !ignored.test(value) && !findAmounts(value).length;
  });
  return candidate ? cleanProductName(candidate) : "";
}

function extractStyleCandidates(lines, productName) {
  const productIndex = lines.findIndex((line) => cleanProductName(line) === productName || /抽盒|系列|手办/.test(line));
  const scored = [];

  lines.forEach((line, index) => {
    const numberedStyle = extractNumberedStyleName(line, productName);
    const cleaned = numberedStyle || cleanStyleCandidate(line, productName);
    if (!isLikelyStyleName(cleaned)) return;

    let score = 40;
    if (numberedStyle) score += 140;
    if (productIndex > -1) {
      const distance = index - productIndex;
      if (distance === 1) score += 80;
      if (distance === 2) score += 52;
      if (distance > 2 && distance <= 5) score += 24;
      if (distance <= 0 || distance > 8) score -= 50;
    } else if (index <= 6) {
      score += 18;
    }

    if (/^[\u4e00-\u9fa5]{2,8}$/.test(cleaned)) score += 44;
    if (/^[\u4e00-\u9fa5]{4}$/.test(cleaned)) score += 22;
    if (/^\s*[\d①②③④⑤⑥⑦⑧⑨⑩一二三四五六七八九十]+[).）、:：-]\s*[\u4e00-\u9fa5]{2,8}/.test(line)) score += 36;
    if (/款|隐藏|普通|确认|购买|更多|客服|订单|编号|位置|支付|待发货|抽盒|系列|手办|状态区域|商品区域|金额区域|时间区域/.test(cleaned)) score -= 80;
    if (productName && productName.includes(cleaned)) score -= 55;
    scored.push({ value: cleaned, score, index });
  });

  const unique = new Map();
  scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .forEach((item) => {
      if (!unique.has(item.value)) unique.set(item.value, item);
    });

  return [...unique.values()]
    .filter((item) => item.score > 0)
    .slice(0, 5)
    .map((item) => item.value);
}

function cleanProductName(value) {
  return String(value)
    .replace(/^\s*(?:[A-Z]\s+|\d+[).）、:：-]?\s*)?(?=[【\[]?\s*抽盒)/i, "")
    .replace(/[【\[]?\s*抽盒\s*[】\]]?/g, "")
    .replace(/^\s*[A-Z]\s+(?=[A-Za-z\u4e00-\u9fa5])/i, "")
    .replace(/([一-龥])\s+(?=[一-龥])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumberedStyleName(line, productName = "") {
  const match = String(line || "").match(/^\s*(?:\d{1,2}|[①②③④⑤⑥⑦⑧⑨⑩一二三四五六七八九十])\s*[).）、:：-]\s*(.+)$/);
  if (!match) return "";
  return cleanStyleCandidate(match[1], productName);
}

function cleanStyleCandidate(value, productName = "") {
  const cleaned = cleanProductName(value)
    .replace(/^[\s\d①②③④⑤⑥⑦⑧⑨⑩一二三四五六七八九十]+[).）、:：-]?\s*/, "")
    .replace(productName, "")
    .replace(/CHAKA|LABUBU|MOLLY|DIMOO|SKULLPANDA|HIRONO|CRYBABY|PUCKY|THE MONSTERS/gi, "")
    .replace(/一针一线系列手办|[A-Za-z0-9 ]*系列手办|系列手办|手办/g, "")
    .replace(/[xX×*]\s*\d{1,3}.*/, "")
    .replace(/[¥￥]\s*\d+(?:[.,]\d{1,2})?.*/, "")
    .replace(/(?:位置|编号|订单|金额|价格|付款|下单|复制|查看|待发货|商品详情|抽盒详情|确认|客服).*/, "")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9 -]/g, "")
    .trim();
  return correctStyleName(cleaned);
}

function correctStyleName(value) {
  const compact = String(value || "").replace(/\s/g, "");
  return STYLE_NAME_CORRECTIONS.get(compact) || value;
}

function isLikelyStyleName(value) {
  const compact = String(value || "").replace(/\s/g, "");
  if (isNonStyleWord(compact)) return false;
  if (compact.length < 2 || compact.length > 14) return false;
  if (!/[\u4e00-\u9fa5]/.test(compact)) return false;
  if (findAmounts(compact).length) return false;
  if (/\d{4,}|BL\d+|SMC|QMS|ID|NO/i.test(compact)) return false;
  if (/(状态区域|商品区域|金额区域|时间区域|泡泡玛特|抽盒机|盒柜|待发货|手动发货|默认收货|订单|支付|金额|优惠|实付|价格|数量|时间|购买|现货|预售|合计|总计|收货|地址|编号|位置|快照|复制|点击查看|微信支付|商品|系列|手办|详情|确认|客服|售后|发货|库存)/i.test(compact)) return false;
  return true;
}

function isNonStyleWord(value) {
  return NON_STYLE_WORDS.test(String(value || "").replace(/\s/g, ""));
}

function findAmounts(text) {
  return findAmountMatches(text).map((match) => match.amount);
}

function findAmountMatches(text) {
  return [...String(text || "").matchAll(/([¥￥$])\s*(\d{1,6}(?:[.,]\d{1,2})?)|(\d{1,6}(?:[.,]\d{1,2})?)\s*(元|rmb|RMB)?/g)]
    .map((match) => ({
      amount: Number((match[2] || match[3] || "").replace(",", ".")),
      hasCurrency: Boolean(match[1] || match[4]),
    }))
    .filter((match) => Number.isFinite(match.amount) && match.amount > 0);
}

function extractQuantity(text) {
  const explicit = text.match(/(?:购买数量|商品数量|数量|件数|qty)[^\d]{0,8}(\d{1,2})/i);
  if (explicit) return safeQuantity(explicit[1]);

  return 1;
}

function extractSaleType(text) {
  if (/预售|预呈|预定|预购|定金|尾款|预计.{0,16}可发货|可发货通知|到仓后|预约|pre[\s-]?order/i.test(text)) return "预售";
  if (/请尽快.{0,12}手动发货|去发货|立即发货|现货|即发|现货发售/i.test(text)) return "现货";
  return "现货";
}

function extractPurchaseTime(text) {
  const match =
    findLabeledTime(text, "付款时间") ||
    findLabeledTime(text, "下单时间") ||
    findLabeledTime(text, "购买时间") ||
    text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})[日\s]*(\d{1,2})?:?(\d{1,2})?/);
  if (!match) return "";

  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function findLabeledTime(text, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedLabel}[^\\d]*(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})[日\\s]*(\\d{1,2})?:?(\\d{1,2})?`);
  return String(text || "").match(pattern);
}

function filteredEntries() {
  const status = elements.statusFilter.value;
  const account = activeAccount;
  const query = normalizeStockKey(elements.inventorySearchInput.value);
  return entries.filter((entry) => {
    const matchesStatus = !status || entry.saleType === status;
    const matchesAccount = !account || (entry.accountId || accountId(0)) === account;
    const matchesQuery = !query || normalizeStockKey(`${entry.styleName || ""}${entry.productName || ""}`).includes(query);
    return matchesStatus && matchesAccount && matchesQuery;
  });
}

function renderLedger() {
  const visibleEntries = filteredEntries();
  const sortedEntries = [...visibleEntries].sort((a, b) => new Date(b.purchaseTime) - new Date(a.purchaseTime));
  elements.ledgerList.innerHTML = "";

  if (!sortedEntries.length) {
    const empty = document.createElement("div");
    empty.className = "ledger-empty";
    empty.textContent = entries.length ? "当前状态下没有记录。" : "还没有记录，上传第一张抽盒机截图开始。";
    elements.ledgerList.append(empty);
  } else {
    sortedEntries.forEach((entry) => {
      const row = document.createElement("article");
      row.className = "ledger-entry";
      const hasSale = Number(entry.salePrice || 0) > 0;
      const profit = hasSale ? Number(entry.salePrice || 0) - Number(entry.price || 0) : 0;
      row.innerHTML = `
        <img class="ledger-thumb" alt="" src="${entry.productImage || entry.image || ""}">
        <div>
          <h3>${escapeHtml(entry.styleName || entry.productName || "未命名商品")}</h3>
          <p>${entry.styleName && entry.productName ? `${escapeHtml(entry.productName)} · ` : ""}${formatDateTime(entry.purchaseTime)} · ${safeQuantity(entry.quantity)} 件</p>
          <div class="tag-line">
            <span class="ledger-tag state" style="background:${saleTypeColor(entry.saleType)}">${escapeHtml(entry.saleType)}</span>
            <span class="ledger-tag">${escapeHtml(accountName(entry.accountId))}</span>
            <span class="ledger-tag ${hasSale ? "sold" : ""}">${hasSale ? `已售 ${formatMoney(entry.salePrice)} · 利润 ${formatMoney(profit)}` : "未售"}</span>
          </div>
        </div>
        <div class="ledger-side">
          <strong class="ledger-amount">${formatMoney(entry.price)}</strong>
          <button type="button" class="mini-action" data-edit-id="${entry.id}">编辑</button>
          <button type="button" class="mini-action danger-mini" data-delete-id="${entry.id}">删除</button>
        </div>
      `;
      elements.ledgerList.append(row);
    });
  }

  const accountEntries = entries.filter((entry) => (entry.accountId || accountId(0)) === activeAccount);
  const stockItems = aggregateStock(validStockEntries(accountEntries));
  const stockCost = stockItems.reduce((total, item) => total + Number(item.cost || 0), 0);
  const month = new Date().toISOString().slice(0, 7);
  const monthRevenue = accountEntries
    .filter((entry) => entry.saleTime?.startsWith(month))
    .reduce((total, entry) => total + Number(entry.salePrice || 0), 0);
  const stockTotal = stockItems.reduce((sum, item) => sum + item.stock, 0);
  elements.monthTotal.textContent = formatMoney(stockCost);
  elements.monthRevenueTotal.textContent = formatMoney(monthRevenue);
  elements.entryCount.textContent = String(stockTotal);
  renderStatePills(visibleEntries);
  renderStockSearch();
  renderStockList(visibleEntries);
  renderStats(accountEntries);
  renderSoldHistory(accountEntries);
  renderAllAccountSummary();
  renderAccountProducts();
  renderBackupReminder();
}

function renderStatePills(sourceEntries) {
  elements.statePills.innerHTML = "";
  SALE_TYPES.forEach((type) => {
    const stateEntries = validStockEntries(sourceEntries)
      .filter((entry) => Number(entry.salePrice || 0) <= 0)
      .filter((entry) => entry.saleType === type.name);
    const total = stateEntries.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
    const quantity = stateEntries.reduce((sum, entry) => sum + safeQuantity(entry.quantity), 0);
    const pill = document.createElement("article");
    pill.className = "state-pill";
    pill.innerHTML = `
      <div class="state-title">
        <span class="state-dot" style="background:${type.color}"></span>
        <span>${escapeHtml(type.name)}</span>
      </div>
      <div>
        <strong>${formatMoney(total)}</strong>
        <span class="state-meta">${stateEntries.length} 笔 · ${quantity} 件</span>
      </div>
    `;
    elements.statePills.append(pill);
  });
}

function renderAccountProducts() {
  elements.accountProductsGrid.innerHTML = "";
  accountNames.forEach((name, index) => {
    const id = accountId(index);
    const accountEntries = entries
      .filter((entry) => (entry.accountId || accountId(0)) === id)
      .sort((a, b) => new Date(b.purchaseTime) - new Date(a.purchaseTime));
    const total = accountEntries.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
    const stockItems = aggregateStock(validStockEntries(accountEntries));
    const stockTotal = stockItems.reduce((sum, item) => sum + item.stock, 0);
    const previewItems = stockItems.slice(0, 3);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "account-product-card";
    card.dataset.accountId = id;
    card.innerHTML = `
      <div class="account-product-head">
        <strong>${escapeHtml(name)}</strong>
        <span>库存 ${stockTotal} · ${formatMoney(total)}</span>
      </div>
      <div class="account-product-thumbs">
        ${previewItems.map((item) => `<span class="stock-thumb"><img alt="" src="${item.image}"><b>×${item.stock}</b></span>`).join("")}
      </div>
      <p>${previewItems.map((item) => `${escapeHtml(item.name)}×${item.stock}`).join("、") || "暂无库存"}</p>
    `;
    elements.accountProductsGrid.append(card);
  });
}

function renderStockSearch() {
  const query = normalizeStockKey(elements.stockSearchInput.value);
  elements.stockSearchResults.innerHTML = "";
  elements.stockSearchResults.classList.toggle("hidden", !query);
  if (!query) return;

  const matchedEntries = validStockEntries(entries).filter((entry) => {
    const haystack = normalizeStockKey(`${entry.styleName || ""}${entry.productName || ""}`);
    return haystack.includes(query);
  });
  const stockItems = aggregateStock(matchedEntries);

  if (!stockItems.length) {
    elements.stockSearchResults.innerHTML = `<p class="search-empty">没有找到这个款式。</p>`;
    return;
  }

  const grouped = new Map();
  stockItems.forEach((item) => {
    const ids = item.accountIds?.length ? item.accountIds : [item.accountId || accountId(0)];
    ids.forEach((id) => {
      if (!grouped.has(id)) {
        grouped.set(id, { accountId: id, stock: 0, cost: 0, items: [] });
      }
      const group = grouped.get(id);
      const stock = item.accountStock?.[id] || item.stock;
      const cost = item.accountCost?.[id] || item.cost;
      group.stock += stock;
      group.cost += cost;
      group.items.push({ ...item, stock, cost });
    });
  });

  elements.stockSearchResults.innerHTML = [...grouped.values()]
    .sort((a, b) => accountIndex(a.accountId) - accountIndex(b.accountId))
    .map((group) => `
      <article class="search-result-card">
        <div>
          <strong>${escapeHtml(accountName(group.accountId))}</strong>
          <span>${group.stock} 件 · 成本 ${formatMoney(group.cost)}</span>
        </div>
        <p>${group.items.map((item) => `${escapeHtml(item.name)} ×${item.stock}`).join("、")}</p>
      </article>
    `)
    .join("");
}

function renderStockList(sourceEntries) {
  elements.stockList.innerHTML = "";
  const stockItems = aggregateStock(validStockEntries(sourceEntries));

  if (!stockItems.length) {
    const empty = document.createElement("div");
    empty.className = "ledger-empty";
    empty.textContent = "当前账号暂无库存。";
    elements.stockList.append(empty);
    return;
  }

  stockItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "stock-card";
    const expanded = expandedStockKeys.has(item.key);
    card.innerHTML = `
      <img class="stock-image" alt="" src="${item.image || ""}">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${item.productName && item.productName !== item.name ? escapeHtml(item.productName) : "泡泡玛特抽盒机"}</p>
        <div class="tag-line">
          <span class="ledger-tag state" style="background:${saleTypeColor(item.saleType)}">${escapeHtml(normalizeSaleType(item.saleType))}</span>
          <span class="ledger-tag">库存 ×${item.stock}</span>
          <span class="ledger-tag">成本 ${formatMoney(item.cost)}</span>
        </div>
      </div>
      <div class="stock-actions">
        <button type="button" class="mini-action add-stock" data-add-stock-key="${escapeHtml(item.key)}">加库存</button>
        <button type="button" class="mini-action sold" data-sell-stock-key="${escapeHtml(item.key)}">卖出</button>
        ${normalizeSaleType(item.saleType) === "预售" ? `<button type="button" class="mini-action arrival" data-arrive-stock-key="${escapeHtml(item.key)}">到货</button>` : ""}
        <button type="button" class="mini-action" data-edit-id="${item.latestId}">编辑</button>
        <button type="button" class="mini-action" data-toggle-stock-key="${escapeHtml(item.key)}">${expanded ? "收起" : "明细"}</button>
      </div>
      ${expanded ? renderStockDetailRows(item.key, sourceEntries) : ""}
    `;
    elements.stockList.append(card);
  });
}

function renderStockDetailRows(stockKey, sourceEntries) {
  const detailEntries = validStockEntries(sourceEntries)
    .filter((entry) => stockGroupKey(entry) === stockKey)
    .filter((entry) => Number(entry.salePrice || 0) <= 0)
    .sort((a, b) => new Date(b.purchaseTime) - new Date(a.purchaseTime));

  if (!detailEntries.length) {
    return `<div class="stock-detail-grid"><p class="search-empty">这组库存没有可展开的明细。</p></div>`;
  }

  return `
    <div class="stock-detail-grid">
      ${detailEntries
        .map((entry) => `
          <div class="stock-detail-row">
            <div>
              <strong>${formatDateTime(entry.purchaseTime)}</strong>
              <span>${safeQuantity(entry.quantity)} 件 · 成本 ${formatMoney(entry.price)}</span>
            </div>
            <div class="detail-actions">
              ${normalizeSaleType(entry.saleType) === "预售" ? `<button type="button" class="mini-action arrival" data-arrive-id="${entry.id}">到货</button>` : ""}
              <button type="button" class="mini-action" data-edit-id="${entry.id}">编辑</button>
            </div>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderStats(accountEntries) {
  const month = selectedStatsMonth();
  const soldEntries = accountEntries
    .filter((entry) => Number(entry.salePrice || 0) > 0 && entry.saleTime?.startsWith(month))
    .sort((a, b) => new Date(b.saleTime) - new Date(a.saleTime));
  const boughtEntries = accountEntries.filter((entry) => entry.purchaseTime?.startsWith(month));
  const revenue = soldEntries.reduce((sum, entry) => sum + Number(entry.salePrice || 0), 0);
  const soldCost = soldEntries.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
  const profit = soldEntries.reduce((sum, entry) => sum + Number(entry.salePrice || 0) - Number(entry.price || 0), 0);
  const soldCount = soldEntries.reduce((sum, entry) => sum + safeQuantity(entry.quantity), 0);
  const spend = boughtEntries.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
  const returnRate = soldCost > 0 ? Math.round((revenue / soldCost) * 100) : 0;

  elements.statsRevenue.textContent = formatMoney(revenue);
  elements.statsProfit.textContent = formatMoney(profit);
  elements.statsSoldCount.textContent = String(soldCount);
  elements.statsSpend.textContent = formatMoney(spend);
  elements.statsReturnRate.textContent = `${returnRate}%`;
  elements.soldList.innerHTML = "";

  if (!soldEntries.length) {
    const empty = document.createElement("div");
    empty.className = "ledger-empty";
    empty.textContent = "本月还没有卖出记录。";
    elements.soldList.append(empty);
    return;
  }

  soldEntries.forEach((entry) => {
    const profitValue = Number(entry.salePrice || 0) - Number(entry.price || 0);
    const row = document.createElement("article");
    row.className = "ledger-entry";
    row.innerHTML = `
      <img class="ledger-thumb" alt="" src="${entry.productImage || entry.image || ""}">
      <div>
        <h3>${escapeHtml(entry.styleName || entry.productName || "未命名商品")}</h3>
        <p>${formatDateTime(entry.saleTime)} · ${safeQuantity(entry.quantity)} 件</p>
        <div class="tag-line">
          <span class="ledger-tag sold">卖出 ${formatMoney(entry.salePrice)}</span>
          <span class="ledger-tag">利润 ${formatMoney(profitValue)}</span>
        </div>
      </div>
      <div class="ledger-side">
        <button type="button" class="mini-action" data-edit-id="${entry.id}">编辑</button>
      </div>
    `;
    elements.soldList.append(row);
  });
}

function renderSoldHistory(accountEntries) {
  elements.soldHistoryPanel.classList.toggle("hidden", !showSoldHistory);
  elements.soldHistoryToggle.textContent = showSoldHistory ? "隐藏已售历史" : "显示已售历史";
  if (!showSoldHistory) return;

  const query = normalizeStockKey(elements.inventorySearchInput.value);
  const soldEntries = accountEntries
    .filter((entry) => Number(entry.salePrice || 0) > 0)
    .filter((entry) => !query || normalizeStockKey(`${entry.styleName || ""}${entry.productName || ""}`).includes(query))
    .sort((a, b) => new Date(b.saleTime || b.purchaseTime) - new Date(a.saleTime || a.purchaseTime));
  elements.soldHistoryList.innerHTML = "";

  if (!soldEntries.length) {
    const empty = document.createElement("div");
    empty.className = "ledger-empty";
    empty.textContent = "当前账号还没有已售历史。";
    elements.soldHistoryList.append(empty);
    return;
  }

  soldEntries.forEach((entry) => {
    const profitValue = Number(entry.salePrice || 0) - Number(entry.price || 0);
    const row = document.createElement("article");
    row.className = "ledger-entry";
    row.innerHTML = `
      <img class="ledger-thumb" alt="" src="${entry.productImage || entry.image || ""}">
      <div>
        <h3>${escapeHtml(entry.styleName || entry.productName || "未命名商品")}</h3>
        <p>${formatDateTime(entry.saleTime)} · ${safeQuantity(entry.quantity)} 件</p>
        <div class="tag-line">
          <span class="ledger-tag sold">卖出 ${formatMoney(entry.salePrice)}</span>
          <span class="ledger-tag">利润 ${formatMoney(profitValue)}</span>
        </div>
      </div>
      <div class="ledger-side">
        <button type="button" class="mini-action" data-edit-id="${entry.id}">编辑</button>
      </div>
    `;
    elements.soldHistoryList.append(row);
  });
}

function markEntryArrived(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry || normalizeSaleType(entry.saleType) !== "预售" || Number(entry.salePrice || 0) > 0) return;
  entries = entries.map((item) => (item.id === id ? { ...item, saleType: "现货", updatedAt: Date.now() } : item));
  saveEntries();
  renderLedger();
  setStatus("已改为现货", "active", 100);
}

function markStockGroupArrived(stockKey) {
  const candidates = stockSellCandidates(stockKey).filter((entry) => normalizeSaleType(entry.saleType) === "预售");
  if (!candidates.length) return;
  const name = candidates[0].styleName || candidates[0].productName || "这组库存";
  if (!window.confirm(`把「${name}」这组预售库存改为现货吗？`)) return;
  const ids = new Set(candidates.map((entry) => entry.id));
  entries = entries.map((entry) => (ids.has(entry.id) ? { ...entry, saleType: "现货", updatedAt: Date.now() } : entry));
  expandedStockKeys.delete(stockKey);
  saveEntries();
  renderLedger();
  setStatus(`已将「${name}」改为现货`, "active", 100);
}

function renderAllAccountSummary() {
  if (!elements.allAccountSummary) return;
  const month = selectedStatsMonth();
  elements.allAccountSummary.innerHTML = "";
  const totals = {
    stock: 0,
    cost: 0,
    revenue: 0,
    profit: 0,
  };

  accountNames.forEach((name, index) => {
    const id = accountId(index);
    const accountEntries = entries.filter((entry) => (entry.accountId || accountId(0)) === id);
    const stockItems = aggregateStock(validStockEntries(accountEntries));
    const stock = stockItems.reduce((sum, item) => sum + item.stock, 0);
    const cost = stockItems.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const soldEntries = accountEntries.filter((entry) => Number(entry.salePrice || 0) > 0 && entry.saleTime?.startsWith(month));
    const revenue = soldEntries.reduce((sum, entry) => sum + Number(entry.salePrice || 0), 0);
    const profit = soldEntries.reduce((sum, entry) => sum + Number(entry.salePrice || 0) - Number(entry.price || 0), 0);
    totals.stock += stock;
    totals.cost += cost;
    totals.revenue += revenue;
    totals.profit += profit;

    const row = document.createElement("article");
    row.className = "account-summary-row";
    row.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>库存 ${stock}</span>
      <span>成本 ${formatMoney(cost)}</span>
      <span>营收 ${formatMoney(revenue)}</span>
      <span>利润 ${formatMoney(profit)}</span>
    `;
    elements.allAccountSummary.append(row);
  });

  const totalRow = document.createElement("article");
  totalRow.className = "account-summary-row total";
  totalRow.innerHTML = `
    <strong>总计</strong>
    <span>库存 ${totals.stock}</span>
    <span>成本 ${formatMoney(totals.cost)}</span>
    <span>营收 ${formatMoney(totals.revenue)}</span>
    <span>利润 ${formatMoney(totals.profit)}</span>
  `;
  elements.allAccountSummary.prepend(totalRow);
}

function aggregateStock(sourceEntries) {
  const groups = new Map();
  sourceEntries.forEach((entry) => {
    const quantity = safeQuantity(entry.quantity);
    const sold = Number(entry.salePrice || 0) > 0 ? quantity : 0;
    const stock = Math.max(0, quantity - sold);
    if (!stock) return;

    const saleType = normalizeSaleType(entry.saleType);
    const key = stockGroupKey(entry);
    const existing = groups.get(key);
    if (existing) {
      existing.stock += stock;
      existing.cost += Number(entry.price || 0);
      existing.accountStock[entry.accountId || accountId(0)] = (existing.accountStock[entry.accountId || accountId(0)] || 0) + stock;
      existing.accountCost[entry.accountId || accountId(0)] = (existing.accountCost[entry.accountId || accountId(0)] || 0) + Number(entry.price || 0);
      if (!existing.accountIds.includes(entry.accountId || accountId(0))) existing.accountIds.push(entry.accountId || accountId(0));
      if (new Date(entry.purchaseTime) > new Date(existing.lastTime)) {
        existing.image = entry.productImage || entry.image || existing.image;
        existing.lastTime = entry.purchaseTime || existing.lastTime;
        existing.latestId = entry.id;
        existing.saleType = saleType || existing.saleType;
      }
    } else {
      groups.set(key, {
        key,
        name: entry.styleName || entry.productName || "未命名商品",
        productName: entry.productName || "",
        stock,
        cost: Number(entry.price || 0),
        image: entry.productImage || entry.image || "",
        lastTime: entry.purchaseTime || "",
        latestId: entry.id,
        saleType,
        accountId: entry.accountId || accountId(0),
        accountIds: [entry.accountId || accountId(0)],
        accountStock: { [entry.accountId || accountId(0)]: stock },
        accountCost: { [entry.accountId || accountId(0)]: Number(entry.price || 0) },
      });
    }
  });
  return [...groups.values()].sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
}

function validStockEntries(sourceEntries) {
  return sourceEntries.filter((entry) => isCompleteEntry(entry));
}

function isCompleteEntry(entry) {
  return !isBadProductName(entry.productName) && hasUsefulStyleName(entry.styleName) && Number(entry.price || 0) > 0;
}

function isBadProductName(value) {
  const name = String(value || "").replace(/\s/g, "");
  return !name || name === "待校对商品" || name === "泡泡玛特抽盒机";
}

function hasUsefulStyleName(value) {
  const style = String(value || "").trim();
  return Boolean(style) && !isNonStyleWord(style);
}

function normalizeStockKey(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[【】\[\]（）()]/g, "")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "")
    .toLowerCase()
    .trim();
}

function stockGroupKey(entry) {
  const styleKey = normalizeStockKey(entry.styleName);
  const productKey = normalizeStockKey(entry.productName || "未命名商品");
  const saleType = normalizeSaleType(entry.saleType);
  return styleKey ? `${saleType}::style::${styleKey}` : `${saleType}::product::${productKey}`;
}

function stockSellCandidates(stockKey) {
  return validStockEntries(entries)
    .filter((entry) => (entry.accountId || accountId(0)) === activeAccount)
    .filter((entry) => stockGroupKey(entry) === stockKey)
    .filter((entry) => Number(entry.salePrice || 0) <= 0)
    .sort((a, b) => new Date(a.purchaseTime) - new Date(b.purchaseTime));
}

function stockTemplateEntries(stockKey) {
  return validStockEntries(entries)
    .filter((entry) => (entry.accountId || accountId(0)) === activeAccount)
    .filter((entry) => stockGroupKey(entry) === stockKey)
    .sort((a, b) => new Date(b.purchaseTime) - new Date(a.purchaseTime));
}

function openAddStockSheet(stockKey) {
  const templates = stockTemplateEntries(stockKey);
  if (!templates.length) {
    setStatus("没有找到可复制的款式记录", "warn", 0);
    return;
  }

  const latest = templates[0];
  const unsold = templates.filter((entry) => Number(entry.salePrice || 0) <= 0);
  const stockQuantity = unsold.reduce((sum, entry) => sum + safeQuantity(entry.quantity), 0);
  const stockCost = unsold.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
  const fallbackUnitPrice = Number(latest.price || 0) / safeQuantity(latest.quantity);
  const unitPrice = stockQuantity > 0 ? stockCost / stockQuantity : fallbackUnitPrice;

  addingStockKey = stockKey;
  elements.addStockTitle.textContent = `加「${latest.styleName || latest.productName || "这个款式"}」`;
  elements.addStockMeta.textContent = `${accountName(activeAccount)} · 自动复制商品图和款式`;
  elements.addStockQuantityInput.value = "1";
  elements.addStockUnitPriceInput.value = Number.isFinite(unitPrice) && unitPrice > 0 ? roundMoney(unitPrice).toFixed(2) : "";
  elements.addStockTimeInput.value = nowLocal();
  elements.addStockSaleTypeInput.value = normalizeSaleType(latest.saleType);
  updateAddStockTotal();
  elements.addStockSheet.classList.remove("hidden");
  elements.addStockSheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
  window.setTimeout(() => elements.addStockQuantityInput.focus(), 80);
}

function closeAddStockSheet() {
  addingStockKey = "";
  elements.addStockSheet.classList.add("hidden");
  elements.addStockSheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
}

function updateAddStockTotal() {
  const quantity = positiveInteger(elements.addStockQuantityInput.value);
  const unitPrice = Number(elements.addStockUnitPriceInput.value);
  const total = quantity && Number.isFinite(unitPrice) && unitPrice > 0 ? roundMoney(quantity * unitPrice) : 0;
  elements.addStockTotal.textContent = formatMoney(total);
}

function confirmAddStock() {
  if (!addingStockKey) return;
  const templates = stockTemplateEntries(addingStockKey);
  const latest = templates[0];
  if (!latest) {
    closeAddStockSheet();
    setStatus("没有找到可复制的款式记录", "warn", 0);
    return;
  }

  const quantity = positiveInteger(elements.addStockQuantityInput.value);
  const unitPrice = Number(elements.addStockUnitPriceInput.value);
  if (!quantity) {
    setStatus("请填写正确的新增数量", "warn", 0);
    elements.addStockQuantityInput.focus();
    return;
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    setStatus("请填写正确的买入单价", "warn", 0);
    elements.addStockUnitPriceInput.focus();
    return;
  }

  const entry = {
    ...latest,
    id: crypto.randomUUID(),
    accountId: activeAccount,
    quantity,
    quantitySource: "manual",
    price: roundMoney(quantity * unitPrice),
    purchaseTime: normalizeImportedTime(elements.addStockTimeInput.value) || nowLocal(),
    saleType: normalizeSaleType(elements.addStockSaleTypeInput.value),
    salePrice: 0,
    saleTime: "",
    note: "",
    image: "",
    rawText: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  entries.push(entry);
  rememberStyle(entry.productName, entry.styleName);
  saveEntries();
  renderLedger();
  closeAddStockSheet();
  setStatus(`已新增 ${quantity} 件「${entry.styleName || entry.productName || "库存"}」`, "active", 100);
}

function openSellSheet(stockKey) {
  const candidates = stockSellCandidates(stockKey);
  const stock = candidates.reduce((sum, entry) => sum + safeQuantity(entry.quantity), 0);
  if (!stock) {
    setStatus("这个款式当前没有可卖库存", "warn", 0);
    return;
  }

  const name = candidates[0].styleName || candidates[0].productName || "这个款式";
  const cost = candidates.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
  sellingStockKey = stockKey;
  elements.sellSheetTitle.textContent = `卖出「${name}」`;
  elements.sellSheetMeta.textContent = `${accountName(activeAccount)} · 当前 ${stock} 件 · 成本 ${formatMoney(cost)}`;
  elements.sellQuantityInput.max = String(stock);
  elements.sellQuantityInput.value = "1";
  elements.sellUnitPriceInput.value = "";
  elements.sellSplitPricesInput.checked = false;
  renderSellPriceLines();
  elements.sellTimeInput.value = nowLocal();
  elements.sellSheet.classList.remove("hidden");
  elements.sellSheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
  window.setTimeout(() => elements.sellUnitPriceInput.focus(), 80);
}

function closeSellSheet() {
  sellingStockKey = "";
  elements.sellSheet.classList.add("hidden");
  elements.sellSheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
}

function renderSellPriceLines() {
  const quantity = Math.min(
    positiveInteger(elements.sellQuantityInput.value) || 1,
    positiveInteger(elements.sellQuantityInput.max) || 20,
  );
  const split = elements.sellSplitPricesInput.checked;
  elements.sellPriceLines.classList.toggle("hidden", !split);
  if (!split) {
    elements.sellPriceLines.innerHTML = "";
    return;
  }

  const oldValues = [...elements.sellPriceLines.querySelectorAll("input")].map((input) => input.value);
  elements.sellPriceLines.innerHTML = Array.from({ length: quantity }, (_, index) => `
    <label>
      第 ${index + 1} 件
      <input class="split-price-input" type="number" min="0" step="0.01" placeholder="0.00" value="${escapeHtml(oldValues[index] || "")}" />
    </label>
  `).join("");
}

function selectedSellPrices(quantity) {
  if (!elements.sellSplitPricesInput.checked) {
    const unitPrice = Number(elements.sellUnitPriceInput.value);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return [];
    return Array.from({ length: quantity }, () => unitPrice);
  }

  const prices = [...elements.sellPriceLines.querySelectorAll("input")]
    .slice(0, quantity)
    .map((input) => Number(input.value));
  return prices.every((price) => Number.isFinite(price) && price > 0) ? prices : [];
}

function confirmSellStockGroup() {
  if (!sellingStockKey) return;
  const candidates = stockSellCandidates(sellingStockKey);
  const stock = candidates.reduce((sum, entry) => sum + safeQuantity(entry.quantity), 0);
  const name = candidates[0]?.styleName || candidates[0]?.productName || "这个款式";
  if (!stock) {
    closeSellSheet();
    setStatus("这个款式当前没有可卖库存", "warn", 0);
    return;
  }
  const quantity = positiveInteger(elements.sellQuantityInput.value);
  if (!quantity || quantity > stock) {
    setStatus("卖出数量不能超过当前库存", "warn", 0);
    return;
  }
  const prices = selectedSellPrices(quantity);
  if (prices.length !== quantity) {
    setStatus("请填写正确的卖出价格", "warn", 0);
    const firstEmpty = elements.sellSplitPricesInput.checked
      ? elements.sellPriceLines.querySelector("input")
      : elements.sellUnitPriceInput;
    firstEmpty?.focus();
    return;
  }
  const saleTime = normalizeImportedTime(elements.sellTimeInput.value) || nowLocal();

  applyStockSale(candidates, prices, saleTime);
  saveEntries();
  renderLedger();
  closeSellSheet();
  setStatus(`已卖出 ${quantity} 件「${name}」`, "active", 100);
}

function applyStockSale(candidates, prices, saleTime) {
  let priceIndex = 0;
  const candidateIds = new Set(candidates.map((entry) => entry.id));
  entries = entries.flatMap((entry) => {
    if (!candidateIds.has(entry.id) || priceIndex >= prices.length) return [entry];

    const quantityInEntry = safeQuantity(entry.quantity);
    const soldQuantity = Math.min(quantityInEntry, prices.length - priceIndex);
    const soldPrices = prices.slice(priceIndex, priceIndex + soldQuantity);
    priceIndex += soldQuantity;
    const unitCost = Number(entry.price || 0) / quantityInEntry;
    const remainingQuantity = quantityInEntry - soldQuantity;
    const result = [];

    if (remainingQuantity > 0) {
      result.push({
        ...entry,
        quantity: remainingQuantity,
        quantitySource: "manual",
        price: roundMoney(unitCost * remainingQuantity),
        updatedAt: Date.now(),
      });
    }

    if (allSamePrice(soldPrices)) {
      result.push({
        ...entry,
        id: remainingQuantity === 0 ? entry.id : crypto.randomUUID(),
        quantity: soldQuantity,
        quantitySource: "manual",
        price: roundMoney(unitCost * soldQuantity),
        salePrice: roundMoney(soldPrices.reduce((sum, price) => sum + price, 0)),
        saleTime,
        updatedAt: Date.now(),
      });
      return result;
    }

    soldPrices.forEach((price) => {
      result.push({
        ...entry,
        id: crypto.randomUUID(),
        quantity: 1,
        quantitySource: "manual",
        price: roundMoney(unitCost),
        salePrice: roundMoney(price),
        saleTime,
        updatedAt: Date.now(),
      });
    });
    return result;
  });
}

function allSamePrice(values) {
  return values.every((value) => roundMoney(value) === roundMoney(values[0]));
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function positiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function editEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  activeAccount = entry.accountId || accountId(0);
  saveActiveAccount();
  renderAccountControls();
  elements.saveButton.textContent = "保存修改";
  elements.formDeleteButton.classList.remove("hidden");
  elements.accountInput.value = activeAccount;
  elements.productNameInput.value = entry.productName || "";
  elements.styleNameInput.value = entry.styleName || "";
  elements.quantityInput.value = safeQuantity(entry.quantity);
  elements.priceInput.value = entry.price || "";
  elements.purchaseTimeInput.value = entry.purchaseTime || nowLocal();
  elements.saleTypeInput.value = normalizeSaleType(entry.saleType);
  elements.salePriceInput.value = entry.salePrice || "";
  elements.saleTimeInput.value = entry.saleTime || "";
  elements.noteInput.value = entry.note || "";
  elements.rawText.value = entry.rawText || "";
  currentImageData = entry.image || entry.productImage || "";
  currentProductImageData = entry.productImage || "";
  currentOcrImageData = "";
  currentStyleImageData = entry.styleImage || "";
  if (currentImageData) {
    elements.previewImage.src = currentImageData;
    elements.uploadEmpty.classList.add("hidden");
    elements.previewWrap.classList.remove("hidden");
  }
  if (currentStyleImageData) {
    renderStyleReference(currentStyleImageData);
  } else if (currentImageData) {
    cropStyleReferenceImage(currentImageData).then((styleImage) => {
      currentStyleImageData = styleImage;
      renderStyleReference(styleImage);
    });
  }
  renderStyleSuggestions([], entry.productName || "");
  switchTab("capture");
  elements.entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("正在编辑已有记录", "active", 100);
}

function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  if (!window.confirm(`删除「${entry.styleName || entry.productName || "这条记录"}」吗？`)) return;
  entries = entries.filter((item) => item.id !== id);
  if (editingId === id) {
    editingId = "";
    resetForm();
    resetImage();
  }
  saveEntries();
  renderLedger();
  setStatus("记录已删除", "active", 100);
}

function cleanupBadEntries() {
  const badEntries = entries.filter((entry) => isBadRecognizedEntry(entry));
  if (!badEntries.length) {
    setStatus("没有发现明显错误识别记录", "active", 100);
    return;
  }
  if (!window.confirm(`将删除 ${badEntries.length} 条明显错误识别记录，继续吗？`)) return;
  const badIds = new Set(badEntries.map((entry) => entry.id));
  entries = entries.filter((entry) => !badIds.has(entry.id));
  editingId = "";
  saveEntries();
  renderLedger();
  resetForm();
  resetImage();
  setStatus(`已清理 ${badEntries.length} 条错误识别记录`, "active", 100);
}

function isBadRecognizedEntry(entry) {
  if (entry.quantitySource === "manual") return false;
  return isBadProductName(entry.productName) || !hasUsefulStyleName(entry.styleName) || Number(entry.price || 0) <= 0;
}

function switchTab(tab) {
  const labels = {
    capture: "上传识别入库",
    inventory: "资产库存",
    stats: "收益统计",
    settings: "设置账号",
  };
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tab);
  });
  elements.headerHint.textContent = labels[tab] || labels.capture;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDateTime(value) {
  if (!value) return "";
  return value.replace("T", " ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function saveEntry(event) {
  event.preventDefault();
  const existing = entries.find((item) => item.id === editingId);
  const entry = {
    id: existing?.id || crypto.randomUUID(),
    accountId: elements.accountInput.value || activeAccount,
    productName: elements.productNameInput.value.trim(),
    styleName: elements.styleNameInput.value.trim(),
    quantity: safeQuantity(elements.quantityInput.value),
    quantitySource: "manual",
    price: Number(elements.priceInput.value || 0),
    purchaseTime: elements.purchaseTimeInput.value,
    saleType: normalizeSaleType(elements.saleTypeInput.value),
    salePrice: Number(elements.salePriceInput.value || 0),
    saleTime: elements.saleTimeInput.value,
    note: elements.noteInput.value.trim(),
    image: "",
    productImage: currentProductImageData || currentImageData || existing?.productImage || existing?.image || "",
    rawText: elements.rawText.value.trim(),
    styleImage: currentStyleImageData || existing?.styleImage || "",
    channel: "抽盒机",
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  if (existing) {
    entries = entries.map((item) => (item.id === editingId ? entry : item));
  } else {
    entries.push(entry);
  }
  rememberStyle(entry.productName, entry.styleName);
  saveEntries();
  activeAccount = entry.accountId;
  saveActiveAccount();
  renderAccountControls();
  renderLedger();
  resetForm();
  resetImage();
  setStatus(existing ? "记录已修改" : "记录已保存", "active", 100);
}

function exportCsv() {
  if (!entries.length) {
    setStatus("没有可导出的记录", "warn", 0);
    return;
  }

  const header = ["购买时间", "账号", "商品名称", "款式", "数量", "买入价格", "卖出价格", "卖出时间", "利润", "状态", "渠道", "备注"];
  const rows = entries.map((entry) => [
    formatDateTime(entry.purchaseTime),
    accountName(entry.accountId),
    entry.productName,
    entry.styleName || "",
    safeQuantity(entry.quantity),
    entry.price,
    entry.salePrice || "",
    formatDateTime(entry.saleTime),
    entry.salePrice ? Number(entry.salePrice || 0) - Number(entry.price || 0) : "",
    entry.saleType,
    "抽盒机",
    entry.note,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `box-machine-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportBackup() {
  const backup = {
    app: "popmart-box-tracker",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    accountNames,
    activeAccount,
    styleMemory,
    entries,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `box-machine-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify({ backedUpAt: Date.now(), entryCount: entries.length }));
  renderBackupReminder();
}

function readBackupMeta() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_META_KEY) || "{}");
  } catch {
    return {};
  }
}

function renderBackupReminder() {
  if (!elements.backupReminder) return;
  const meta = readBackupMeta();
  const backedUpAt = Number(meta.backedUpAt || 0);
  const backedUpCount = Number(meta.entryCount || 0);
  const daysSinceBackup = backedUpAt ? Math.floor((Date.now() - backedUpAt) / 86400000) : Infinity;
  const newRecords = Math.max(0, entries.length - backedUpCount);
  const shouldRemind = entries.length >= 10 && (!backedUpAt || daysSinceBackup >= 14 || newRecords >= 30);

  elements.backupReminder.classList.toggle("hidden", !shouldRemind);
  if (!shouldRemind) {
    elements.backupReminder.textContent = "";
    return;
  }

  if (!backedUpAt) {
    elements.backupReminder.textContent = "建议备份一次：这些库存只保存在当前手机浏览器里。";
  } else if (newRecords >= 30) {
    elements.backupReminder.textContent = `距离上次备份已新增 ${newRecords} 条记录，建议备份一次。`;
  } else {
    elements.backupReminder.textContent = `距离上次备份已 ${daysSinceBackup} 天，建议备份一次。`;
  }
}

function readSelectedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

async function importDataFile(event) {
  const file = event.target.files?.[0];
  elements.importDataInput.value = "";
  if (!file) return;

  try {
    const text = await readSelectedFile(file);
    if (/\.json$/i.test(file.name) || /^\s*\{/.test(text)) {
      restoreBackup(JSON.parse(text));
      return;
    }
    importCsv(text);
  } catch (error) {
    console.error(error);
    setStatus("导入失败，请检查文件格式", "warn", 0);
  }
}

function restoreBackup(backup) {
  if (!backup || !Array.isArray(backup.entries)) {
    setStatus("备份文件不完整", "warn", 0);
    return;
  }
  if (!window.confirm("恢复备份会覆盖当前本机数据，继续吗？")) return;

  accountNames = Array.isArray(backup.accountNames) ? readFixedAccountNames(backup.accountNames) : accountNames;
  activeAccount = /^account-[1-6]$/.test(backup.activeAccount || "") ? backup.activeAccount : activeAccount;
  styleMemory = backup.styleMemory && typeof backup.styleMemory === "object" ? backup.styleMemory : {};
  entries = backup.entries.map(normalizeEntry);

  saveAccountNames();
  saveActiveAccount();
  saveStyleMemory();
  saveEntries();
  renderAccountControls();
  renderAccountSettings();
  renderLedger();
  resetForm();
  resetImage();
  setStatus(`已恢复 ${entries.length} 条记录`, "active", 100);
}

function importCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => String(cell || "").trim()));
  if (rows.length < 2) {
    setStatus("CSV 里没有可导入的记录", "warn", 0);
    return;
  }
  const header = rows[0].map((cell) => String(cell || "").trim());
  const imported = rows.slice(1).map((row) => csvRowToEntry(header, row)).filter(Boolean);
  if (!imported.length) {
    setStatus("CSV 里没有可导入的记录", "warn", 0);
    return;
  }
  if (!window.confirm(`将追加导入 ${imported.length} 条记录，继续吗？`)) return;

  entries = [...entries, ...imported].map(normalizeEntry);
  imported.forEach((entry) => rememberStyle(entry.productName, entry.styleName));
  saveEntries();
  renderLedger();
  setStatus(`已导入 ${imported.length} 条记录`, "active", 100);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = String(text || "").replace(/^\ufeff/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(value);
      value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  return rows;
}

function csvRowToEntry(header, row) {
  const get = (name) => row[header.indexOf(name)] || "";
  const productName = get("商品名称").trim();
  const styleName = get("款式").trim();
  const price = Number(get("买入价格") || 0);
  if (!productName || !styleName || !price) return null;
  return {
    id: crypto.randomUUID(),
    accountId: accountIdFromName(get("账号")),
    productName,
    styleName,
    quantity: safeQuantity(get("数量") || 1),
    quantitySource: "manual",
    price,
    purchaseTime: normalizeImportedTime(get("购买时间")) || nowLocal(),
    saleType: normalizeSaleType(get("状态")),
    salePrice: Number(get("卖出价格") || 0),
    saleTime: normalizeImportedTime(get("卖出时间")),
    note: get("备注").trim(),
    image: "",
    productImage: "",
    styleImage: "",
    rawText: "",
    channel: "抽盒机",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function accountIdFromName(name) {
  const index = accountNames.findIndex((item) => item === String(name || "").trim());
  return index >= 0 ? accountId(index) : accountId(0);
}

function normalizeImportedTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.includes("T") ? text.slice(0, 16) : text.replace(/\s+/, "T").slice(0, 16);
}

async function refreshAppCache() {
  if (!window.confirm("只更新程序缓存，不会删除库存数据。继续吗？")) return;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    window.location.href = `./?fresh=${Date.now()}`;
  } catch (error) {
    console.error(error);
    setStatus("更新缓存失败，请稍后再试", "warn", 0);
  }
}

elements.selectButton.addEventListener("click", () => elements.imageInput.click());
elements.replaceButton.addEventListener("click", () => elements.imageInput.click());
elements.imageInput.addEventListener("change", (event) => handleFiles(event.target.files));
elements.scanButton.addEventListener("click", scanImage);
elements.batchScanButton.addEventListener("click", scanBatchImages);
elements.clearBatchButton.addEventListener("click", clearBatch);
elements.parseButton.addEventListener("click", () => parseRecordText(elements.rawText.value));
elements.productNameInput.addEventListener("input", () => renderStyleSuggestions([], elements.productNameInput.value));
elements.resetButton.addEventListener("click", resetForm);
elements.formDeleteButton.addEventListener("click", () => {
  if (!editingId) return;
  deleteEntry(editingId);
});
elements.entryForm.addEventListener("submit", saveEntry);
elements.exportButton.addEventListener("click", exportCsv);
elements.backupButton.addEventListener("click", exportBackup);
elements.importDataButton.addEventListener("click", () => elements.importDataInput.click());
elements.importDataInput.addEventListener("change", importDataFile);
elements.refreshAppButton.addEventListener("click", refreshAppCache);
elements.cleanupBadButton.addEventListener("click", cleanupBadEntries);
elements.activeAccountSelect.addEventListener("change", (event) => {
  activeAccount = event.target.value;
  saveActiveAccount();
  elements.accountInput.value = activeAccount;
  elements.accountFilter.value = activeAccount;
  elements.formAccountHint.textContent = `保存到 ${accountName(activeAccount)}`;
  if (batchFiles.length) renderBatchList();
  renderLedger();
});
elements.accountFilter.addEventListener("change", () => {
  activeAccount = elements.accountFilter.value || activeAccount;
  saveActiveAccount();
  renderAccountControls();
  renderLedger();
});
elements.statusFilter.addEventListener("change", renderLedger);
elements.inventorySearchInput.addEventListener("input", renderLedger);
elements.soldHistoryToggle.addEventListener("click", () => {
  showSoldHistory = !showSoldHistory;
  renderLedger();
});
elements.stockSearchInput.addEventListener("input", renderStockSearch);
elements.statsMonthInput.addEventListener("change", renderLedger);

elements.ledgerList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    deleteEntry(deleteButton.dataset.deleteId);
    return;
  }
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  editEntry(button.dataset.editId);
});

elements.stockList.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-stock-key]");
  if (addButton) {
    openAddStockSheet(addButton.dataset.addStockKey);
    return;
  }
  const sellButton = event.target.closest("[data-sell-stock-key]");
  if (sellButton) {
    openSellSheet(sellButton.dataset.sellStockKey);
    return;
  }
  const arriveGroupButton = event.target.closest("[data-arrive-stock-key]");
  if (arriveGroupButton) {
    markStockGroupArrived(arriveGroupButton.dataset.arriveStockKey);
    return;
  }
  const arriveButton = event.target.closest("[data-arrive-id]");
  if (arriveButton) {
    markEntryArrived(arriveButton.dataset.arriveId);
    return;
  }
  const toggleButton = event.target.closest("[data-toggle-stock-key]");
  if (toggleButton) {
    const key = toggleButton.dataset.toggleStockKey;
    if (expandedStockKeys.has(key)) {
      expandedStockKeys.delete(key);
    } else {
      expandedStockKeys.add(key);
    }
    renderLedger();
    return;
  }
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  editEntry(button.dataset.editId);
});

elements.soldList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  editEntry(button.dataset.editId);
});

elements.soldHistoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  editEntry(button.dataset.editId);
});

elements.accountProductsGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-account-id]");
  if (!card) return;
  activeAccount = card.dataset.accountId;
  saveActiveAccount();
  renderAccountControls();
  renderLedger();
  switchTab("inventory");
});

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

elements.sellCancelButton.addEventListener("click", closeSellSheet);
elements.sellConfirmButton.addEventListener("click", confirmSellStockGroup);
elements.sellQuantityInput.addEventListener("input", renderSellPriceLines);
elements.sellSplitPricesInput.addEventListener("change", renderSellPriceLines);
elements.sellSheet.addEventListener("click", (event) => {
  if (event.target === elements.sellSheet) closeSellSheet();
});
elements.addStockCancelButton.addEventListener("click", closeAddStockSheet);
elements.addStockConfirmButton.addEventListener("click", confirmAddStock);
elements.addStockQuantityInput.addEventListener("input", updateAddStockTotal);
elements.addStockUnitPriceInput.addEventListener("input", updateAddStockTotal);
elements.addStockSheet.addEventListener("click", (event) => {
  if (event.target === elements.addStockSheet) closeAddStockSheet();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.sellSheet.classList.contains("hidden")) {
    closeSellSheet();
  }
  if (event.key === "Escape" && !elements.addStockSheet.classList.contains("hidden")) {
    closeAddStockSheet();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installButton.classList.remove("hidden");
});

elements.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installButton.classList.add("hidden");
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => handleFiles(event.dataTransfer.files));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    setStatus("离线缓存注册失败，但当前页面仍可手动使用", "warn", 0);
  });
}

renderAccountControls();
renderAccountSettings();
resetForm();
elements.statsMonthInput.value = currentMonth();
elements.versionText.textContent = `当前版本 ${APP_VERSION}`;
saveEntries();
renderLedger();
