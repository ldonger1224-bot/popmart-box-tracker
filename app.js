const STORAGE_KEY = "box-machine-records";
const ACCOUNTS_KEY = "box-machine-account-names";
const ACTIVE_ACCOUNT_KEY = "box-machine-active-account";
const STYLE_MEMORY_KEY = "box-machine-style-memory";
const ACCOUNT_COUNT = 6;
const SALE_TYPES = [
  { name: "待确认", color: "#8c8090" },
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
  ledgerList: document.querySelector("#ledgerList"),
  monthTotal: document.querySelector("#monthTotal"),
  monthRevenueTotal: document.querySelector("#monthRevenueTotal"),
  entryCount: document.querySelector("#entryCount"),
  exportButton: document.querySelector("#exportButton"),
  cleanupBadButton: document.querySelector("#cleanupBadButton"),
  accountFilter: document.querySelector("#accountFilter"),
  accountNameGrid: document.querySelector("#accountNameGrid"),
  accountProductsGrid: document.querySelector("#accountProductsGrid"),
  statusFilter: document.querySelector("#statusFilter"),
  statePills: document.querySelector("#statePills"),
  stockList: document.querySelector("#stockList"),
  soldList: document.querySelector("#soldList"),
  allAccountSummary: document.querySelector("#allAccountSummary"),
  statsRevenue: document.querySelector("#statsRevenue"),
  statsProfit: document.querySelector("#statsProfit"),
  statsSoldCount: document.querySelector("#statsSoldCount"),
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
  return SALE_TYPES.some((item) => item.name === value) ? value : "待确认";
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
    return defaults.map((fallback, index) => String(saved[index] || fallback));
  } catch {
    return defaults;
  }
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
  elements.saleTypeInput.value = "待确认";
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
    setStatus("图片已上传，可以开始识别", "active", 0);
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
  const regionTexts = [];
  const regions = await cropOcrRegions(primaryImageData);

  for (const [index, region] of regions.entries()) {
    const result = await recognizeImageData(region.imageData, (message, progress) => {
      onProgress?.(`${message} · 区域 ${index + 1}/${regions.length}`, Math.min(78, 12 + (index * 22) + progress * 0.18));
    });
    if (result.rawText) {
      regionTexts.push(`${region.label}\n${result.rawText}`);
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
  return "待确认";
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
  return entries.filter((entry) => {
    const matchesStatus = !status || entry.saleType === status;
    const matchesAccount = !account || (entry.accountId || accountId(0)) === account;
    return matchesStatus && matchesAccount;
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
  renderStockList(visibleEntries);
  renderStats(accountEntries);
  renderAllAccountSummary();
  renderAccountProducts();
}

function renderStatePills(sourceEntries) {
  elements.statePills.innerHTML = "";
  SALE_TYPES.forEach((type) => {
    const stateEntries = validStockEntries(sourceEntries).filter((entry) => entry.saleType === type.name);
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
      <button type="button" class="mini-action" data-edit-id="${item.latestId}">编辑</button>
    `;
    elements.stockList.append(card);
  });
}

function renderStats(accountEntries) {
  const month = new Date().toISOString().slice(0, 7);
  const soldEntries = accountEntries
    .filter((entry) => Number(entry.salePrice || 0) > 0 && entry.saleTime?.startsWith(month))
    .sort((a, b) => new Date(b.saleTime) - new Date(a.saleTime));
  const revenue = soldEntries.reduce((sum, entry) => sum + Number(entry.salePrice || 0), 0);
  const profit = soldEntries.reduce((sum, entry) => sum + Number(entry.salePrice || 0) - Number(entry.price || 0), 0);
  const soldCount = soldEntries.reduce((sum, entry) => sum + safeQuantity(entry.quantity), 0);

  elements.statsRevenue.textContent = formatMoney(revenue);
  elements.statsProfit.textContent = formatMoney(profit);
  elements.statsSoldCount.textContent = String(soldCount);
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

function renderAllAccountSummary() {
  if (!elements.allAccountSummary) return;
  const month = new Date().toISOString().slice(0, 7);
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

    const styleKey = normalizeStockKey(entry.styleName);
    const productKey = normalizeStockKey(entry.productName || "未命名商品");
    const saleType = normalizeSaleType(entry.saleType);
    const key = styleKey ? `${saleType}::style::${styleKey}` : `${saleType}::product::${productKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.stock += stock;
      existing.cost += Number(entry.price || 0);
      if (new Date(entry.purchaseTime) > new Date(existing.lastTime)) {
        existing.image = entry.productImage || entry.image || existing.image;
        existing.lastTime = entry.purchaseTime || existing.lastTime;
        existing.latestId = entry.id;
        existing.saleType = saleType || existing.saleType;
      }
    } else {
      groups.set(key, {
        name: entry.styleName || entry.productName || "未命名商品",
        productName: entry.productName || "",
        stock,
        cost: Number(entry.price || 0),
        image: entry.productImage || entry.image || "",
        lastTime: entry.purchaseTime || "",
        latestId: entry.id,
        saleType,
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

function editEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  activeAccount = entry.accountId || accountId(0);
  saveActiveAccount();
  renderAccountControls();
  elements.saveButton.textContent = "保存修改";
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

elements.selectButton.addEventListener("click", () => elements.imageInput.click());
elements.replaceButton.addEventListener("click", () => elements.imageInput.click());
elements.imageInput.addEventListener("change", (event) => handleFiles(event.target.files));
elements.scanButton.addEventListener("click", scanImage);
elements.batchScanButton.addEventListener("click", scanBatchImages);
elements.clearBatchButton.addEventListener("click", clearBatch);
elements.parseButton.addEventListener("click", () => parseRecordText(elements.rawText.value));
elements.productNameInput.addEventListener("input", () => renderStyleSuggestions([], elements.productNameInput.value));
elements.resetButton.addEventListener("click", resetForm);
elements.entryForm.addEventListener("submit", saveEntry);
elements.exportButton.addEventListener("click", exportCsv);
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
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  editEntry(button.dataset.editId);
});

elements.soldList.addEventListener("click", (event) => {
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
saveEntries();
renderLedger();
