/**
 * MemoTap — visual memo unlock + local encrypted vault
 * Crypto: Web Crypto PBKDF2 (SHA-256) → AES-GCM
 * Never stores raw tap sequence; salt + ciphertext in localStorage.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "memotap.v1";
  const PBKDF2_ITERATIONS = 120000;
  const SEQ_MIN = 4;
  const SEQ_MAX = 6;

  /** Friendly objects for the scene */
  const OBJECTS = [
    { id: "star", emoji: "⭐", label: "Star" },
    { id: "heart", emoji: "❤️", label: "Heart" },
    { id: "moon", emoji: "🌙", label: "Moon" },
    { id: "sun", emoji: "☀️", label: "Sun" },
    { id: "flower", emoji: "🌸", label: "Flower" },
    { id: "apple", emoji: "🍎", label: "Apple" },
    { id: "cat", emoji: "🐱", label: "Cat" },
    { id: "dog", emoji: "🐶", label: "Dog" },
    { id: "fish", emoji: "🐟", label: "Fish" },
    { id: "bird", emoji: "🐦", label: "Bird" },
    { id: "tree", emoji: "🌳", label: "Tree" },
    { id: "house", emoji: "🏠", label: "House" },
    { id: "car", emoji: "🚗", label: "Car" },
    { id: "key", emoji: "🔑", label: "Key" },
    { id: "gem", emoji: "💎", label: "Gem" },
    { id: "rocket", emoji: "🚀", label: "Rocket" },
    { id: "pizza", emoji: "🍕", label: "Pizza" },
    { id: "coffee", emoji: "☕", label: "Coffee" },
    { id: "music", emoji: "🎵", label: "Music" },
    { id: "balloon", emoji: "🎈", label: "Balloon" },
  ];

  const DEMO_VAULT = [
    { id: "1", icon: "📧", service: "Demo Mail", username: "you@example.com", secret: "tap-me-not-123" },
    { id: "2", icon: "🏦", service: "Demo Bank", username: "mark.demo", secret: "•••••••• (demo: vault-safe)" },
    { id: "3", icon: "🎮", service: "Game Portal", username: "memogamer", secret: "highscore-unlock" },
    { id: "4", icon: "☁️", service: "Cloud Notes", username: "notes@local", secret: "remember-the-path" },
  ];

  // --- Crypto helpers ---

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function b64ToBuf(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  function sequenceToPassword(ids) {
    return ids.join("|");
  }

  async function deriveKey(password, saltBuf) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBuf,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptVault(password, vaultObj) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt.buffer);
    const plain = new TextEncoder().encode(JSON.stringify(vaultObj));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
    return {
      salt: bufToB64(salt),
      iv: bufToB64(iv),
      ciphertext: bufToB64(cipher),
      iterations: PBKDF2_ITERATIONS,
      version: 1,
    };
  }

  async function decryptVault(password, packed) {
    const salt = b64ToBuf(packed.salt);
    const iv = new Uint8Array(b64ToBuf(packed.iv));
    const key = await deriveKey(password, salt);
    const cipher = b64ToBuf(packed.ciphertext);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  // --- Persistence ---

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // --- UI helpers ---

  const $ = (sel) => document.querySelector(sel);
  const app = $("#app");

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
    const s = document.getElementById(id);
    if (s) s.classList.add("active");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function byId(id) {
    return OBJECTS.find((o) => o.id === id);
  }

  function setDots(container, count, filled, mode) {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i < filled ? " filled" : "");
      if (mode && i < filled) d.classList.add(mode);
      container.appendChild(d);
    }
  }

  function renderScene(container, objectIds, onTap, options = {}) {
    container.innerHTML = "";
    const showLabels = !options.dense;
    objectIds.forEach((id) => {
      const obj = byId(id);
      if (!obj) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "obj";
      btn.dataset.id = id;
      btn.setAttribute("aria-label", obj.label);
      btn.innerHTML =
        `<span class="emoji" aria-hidden="true">${obj.emoji}</span>` +
        (showLabels ? `<span class="label">${obj.label}</span>` : "");
      btn.addEventListener("click", () => {
        btn.classList.add("pressed");
        setTimeout(() => btn.classList.remove("pressed"), 120);
        onTap(id, btn);
      });
      container.appendChild(btn);
    });
  }

  function flashBtn(btn, ok) {
    btn.classList.add(ok ? "flash-ok" : "flash-bad");
    setTimeout(() => btn.classList.remove("flash-ok", "flash-bad"), 400);
  }

  // --- App state ---

  let setupSeq = [];
  let confirmSeq = [];
  let unlockSeq = [];
  let pendingPassword = null;
  let unlockedVault = null;
  let expectedLen = SEQ_MIN;
  let unlockSceneIds = [];

  const setupPool = OBJECTS.slice(0, 9).map((o) => o.id);

  // --- Screens ---

  function refreshWelcome() {
    const st = loadState();
    const hasVault = !!(st && st.ciphertext);
    $("#btnTryUnlock").hidden = !hasVault;
    $("#btnStartSetup").textContent = hasVault ? "Reset & set new memo" : "Set my memo";
  }

  function startSetup() {
    setupSeq = [];
    confirmSeq = [];
    pendingPassword = null;
    setDots($("#setupDots"), SEQ_MAX, 0);
    $("#setupHint").innerHTML = `Tap <strong>${SEQ_MIN}–${SEQ_MAX}</strong> objects in a memorable order.`;
    $("#btnSetupUndo").disabled = true;
    $("#btnSetupDone").disabled = true;
    renderScene($("#setupScene"), setupPool, onSetupTap);
    showScreen("screen-setup");
  }

  function onSetupTap(id) {
    if (setupSeq.length >= SEQ_MAX) return;
    setupSeq.push(id);
    setDots($("#setupDots"), SEQ_MAX, setupSeq.length);
    $("#btnSetupUndo").disabled = setupSeq.length === 0;
    $("#btnSetupDone").disabled = setupSeq.length < SEQ_MIN;
    $("#setupHint").textContent =
      setupSeq.length < SEQ_MIN
        ? `Need ${SEQ_MIN - setupSeq.length} more…`
        : setupSeq.length < SEQ_MAX
          ? `Looking good — add more or lock it in (${setupSeq.length}/${SEQ_MAX}).`
          : "Max length — lock it in!";
  }

  function startConfirm() {
    confirmSeq = [];
    expectedLen = setupSeq.length;
    pendingPassword = sequenceToPassword(setupSeq);
    setDots($("#confirmDots"), expectedLen, 0);
    $("#confirmStatus").textContent = "";
    $("#confirmStatus").className = "status";
    renderScene($("#confirmScene"), setupPool, onConfirmTap);
    showScreen("screen-confirm");
  }

  async function onConfirmTap(id, btn) {
    if (confirmSeq.length >= expectedLen) return;
    confirmSeq.push(id);
    setDots($("#confirmDots"), expectedLen, confirmSeq.length);
    const idx = confirmSeq.length - 1;
    const ok = confirmSeq[idx] === setupSeq[idx];
    flashBtn(btn, ok);
    if (!ok) {
      $("#confirmStatus").textContent = "Not quite — try again.";
      $("#confirmStatus").className = "status error";
      confirmSeq = [];
      setDots($("#confirmDots"), expectedLen, 0, "bad");
      return;
    }
    if (confirmSeq.length === expectedLen) {
      $("#confirmStatus").textContent = "Locking vault…";
      $("#confirmStatus").className = "status ok";
      try {
        const packed = await encryptVault(pendingPassword, { accounts: DEMO_VAULT });
        // Store only crypto blob + meta (never the sequence)
        saveState({
          ...packed,
          createdAt: new Date().toISOString(),
          seqLength: expectedLen,
        });
        pendingPassword = null;
        setupSeq = [];
        confirmSeq = [];
        setTimeout(() => {
          unlockedVault = { accounts: DEMO_VAULT };
          renderVault();
          showScreen("screen-vault");
        }, 350);
      } catch (e) {
        console.error(e);
        $("#confirmStatus").textContent = "Could not encrypt — try another browser.";
        $("#confirmStatus").className = "status error";
      }
    }
  }

  function startUnlock() {
    const st = loadState();
    if (!st || !st.ciphertext) {
      refreshWelcome();
      showScreen("screen-welcome");
      return;
    }
    unlockSeq = [];
    expectedLen = st.seqLength || SEQ_MIN;
    unlockedVault = null;
    setDots($("#unlockDots"), expectedLen, 0);
    $("#unlockStatus").textContent = "";
    $("#unlockStatus").className = "status";

    // Mix memo-likely objects with decoys (full set shuffled)
    unlockSceneIds = shuffle(OBJECTS.map((o) => o.id)).slice(0, 16);
    renderScene($("#unlockScene"), unlockSceneIds, onUnlockTap, { dense: true });
    showScreen("screen-unlock");
  }

  async function onUnlockTap(id, btn) {
    const st = loadState();
    if (!st) return;
    if (unlockSeq.length >= expectedLen) return;

    unlockSeq.push(id);
    setDots($("#unlockDots"), expectedLen, unlockSeq.length);
    flashBtn(btn, true);

    if (unlockSeq.length < expectedLen) return;

    const password = sequenceToPassword(unlockSeq);
    $("#unlockStatus").textContent = "Checking…";
    try {
      const vault = await decryptVault(password, st);
      unlockedVault = vault;
      $("#unlockStatus").textContent = "Unlocked!";
      $("#unlockStatus").className = "status ok";
      setDots($("#unlockDots"), expectedLen, expectedLen, "ok");
      setTimeout(() => {
        renderVault();
        showScreen("screen-vault");
      }, 300);
    } catch {
      $("#unlockStatus").textContent = "Wrong sequence — try again.";
      $("#unlockStatus").className = "status error";
      setDots($("#unlockDots"), expectedLen, expectedLen, "bad");
      unlockSeq = [];
      setTimeout(() => setDots($("#unlockDots"), expectedLen, 0), 500);
    }
  }

  function renderVault() {
    const list = $("#vaultList");
    list.innerHTML = "";
    const accounts = (unlockedVault && unlockedVault.accounts) || [];
    accounts.forEach((acc) => {
      const li = document.createElement("li");
      li.className = "vault-item";
      li.innerHTML = `
        <div class="svc"><span class="ico">${acc.icon}</span><span>${escapeHtml(acc.service)}</span></div>
        <div class="meta">${escapeHtml(acc.username)}</div>
        <div class="secret blurred" data-secret="${escapeAttr(acc.secret)}">${escapeHtml(acc.secret)}</div>
        <button type="button" class="reveal">Reveal</button>
      `;
      const secretEl = li.querySelector(".secret");
      const revealBtn = li.querySelector(".reveal");
      const toggle = () => {
        const blurred = secretEl.classList.toggle("blurred");
        revealBtn.textContent = blurred ? "Reveal" : "Hide";
      };
      revealBtn.addEventListener("click", toggle);
      secretEl.addEventListener("click", toggle);
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function lockVault() {
    unlockedVault = null;
    unlockSeq = [];
    startUnlock();
  }

  function resetDemo() {
    if (!confirm("Erase the encrypted vault on this device?")) return;
    clearState();
    unlockedVault = null;
    setupSeq = [];
    confirmSeq = [];
    unlockSeq = [];
    refreshWelcome();
    showScreen("screen-welcome");
  }

  // Skin toggle
  function loadSkin() {
    const skin = localStorage.getItem("memotap.skin") || "playful";
    applySkin(skin);
  }

  function applySkin(skin) {
    app.classList.remove("skin-playful", "skin-terminal");
    app.classList.add(skin === "terminal" ? "skin-terminal" : "skin-playful");
    $("#skinToggle").textContent = skin === "terminal" ? "> Terminal" : "✨ Playful";
    localStorage.setItem("memotap.skin", skin);
  }

  function toggleSkin() {
    const next = app.classList.contains("skin-terminal") ? "playful" : "terminal";
    applySkin(next);
  }

  // Wire events
  $("#btnStartSetup").addEventListener("click", () => {
    if (loadState()) {
      if (!confirm("This replaces your current vault. Continue?")) return;
      clearState();
    }
    startSetup();
  });
  $("#btnTryUnlock").addEventListener("click", startUnlock);
  $("#btnSetupUndo").addEventListener("click", () => {
    setupSeq.pop();
    setDots($("#setupDots"), SEQ_MAX, setupSeq.length);
    $("#btnSetupUndo").disabled = setupSeq.length === 0;
    $("#btnSetupDone").disabled = setupSeq.length < SEQ_MIN;
  });
  $("#btnSetupClear").addEventListener("click", () => {
    setupSeq = [];
    setDots($("#setupDots"), SEQ_MAX, 0);
    $("#btnSetupUndo").disabled = true;
    $("#btnSetupDone").disabled = true;
    $("#setupHint").innerHTML = `Tap <strong>${SEQ_MIN}–${SEQ_MAX}</strong> objects in a memorable order.`;
  });
  $("#btnSetupDone").addEventListener("click", startConfirm);
  $("#btnConfirmBack").addEventListener("click", startSetup);
  $("#btnConfirmClear").addEventListener("click", () => {
    confirmSeq = [];
    setDots($("#confirmDots"), expectedLen, 0);
    $("#confirmStatus").textContent = "";
  });
  $("#btnUnlockClear").addEventListener("click", () => {
    unlockSeq = [];
    setDots($("#unlockDots"), expectedLen, 0);
    $("#unlockStatus").textContent = "";
  });
  $("#btnResetAll").addEventListener("click", resetDemo);
  $("#btnLock").addEventListener("click", lockVault);
  $("#btnRevealAll").addEventListener("click", () => {
    document.querySelectorAll(".vault-item .secret").forEach((el) => el.classList.remove("blurred"));
    document.querySelectorAll(".vault-item .reveal").forEach((el) => (el.textContent = "Hide"));
  });
  $("#skinToggle").addEventListener("click", toggleSkin);

  // Boot
  loadSkin();
  refreshWelcome();
  const st = loadState();
  if (st && st.ciphertext) {
    showScreen("screen-welcome");
  } else {
    showScreen("screen-welcome");
  }
})();
