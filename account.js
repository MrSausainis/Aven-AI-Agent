try {

if (typeof supabase === "undefined") {
  throw new Error("The Supabase library itself never loaded - check your " +
    "internet connection, or an ad blocker / privacy extension may be " +
    "blocking cdn.jsdelivr.net.");
}

const SUPABASE_URL = "https://upiadmvxzphegivqszvp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iS9do7OPQuY-zEeAFfSrWQ_zA_IAObI";
const DOWNLOAD_URL = "https://github.com/MrSausainis/Aven-AI-Agent/releases/latest/download/AVEN-Setup.exe";
const RESEND_COOLDOWN_SECONDS = 30;
const LEGAL_VERSION = "2026-09-29";

const THEME_COLORS = {
  "Midnight Purple": { bg: "#08060f", accent: "#b57bff" },
  "Obsidian":        { bg: "#111111", accent: "#e6e6e6" },
  "Frost":           { bg: "#04080a", accent: "#00cfff" },
  "Crimson":         { bg: "#0a0406", accent: "#e63946" },
  "Emerald":         { bg: "#05100b", accent: "#39d98a" },
  "Monochrome":      { bg: "#000000", accent: "#ffffff" },
  "OLED":            { bg: "#000000", accent: "#b8c2cc" },
};
const ALL_THEME_NAMES = Object.keys(THEME_COLORS);
const LEGACY_THEME_ALIASES = {
  "Holographic E.V.A.": "Frost",
  "Crimson Core": "Crimson",
  "Phantom Silver": "Obsidian",
};

const PAGE_PARAMS = new URLSearchParams(window.location.search);
const DESKTOP_LOGIN_MODE = PAGE_PARAMS.has("desktop_callback");

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: DESKTOP_LOGIN_MODE
    ? { persistSession: false, autoRefreshToken: false }
    : { persistSession: true, autoRefreshToken: true },
});
const el = (id) => document.getElementById(id);

function canonicalPublicName(value) {
  const name = value.normalize("NFC").replace(/^ +| +$/g, "").replace(/ +/g, " ");
  return [...name].length >= 1 && [...name].length <= 32 && /^[\p{L}0-9 _.-]+$/u.test(name) ? name : null;
}
const ACCOUNT_NAME_HINT = "Use 1–32 letters, digits, spaces, dots, underscores or hyphens.";

if (DESKTOP_LOGIN_MODE) {
  el("authTitle").textContent = "Connect AvenAI desktop";
  el("authSubtitle").textContent = "Log in here to create a separate secure desktop session.";
}

function validatedDesktopCallback(rawCallback, expectedState, requireState) {
  if (!rawCallback) return null;
  try {
    const target = new URL(rawCallback);
    const host = target.hostname.toLowerCase();
    const loopback = host === "127.0.0.1" || host === "localhost";
    const port = Number(target.port || 0);
    if (target.protocol !== "http:" || !loopback || target.pathname !== "/callback" ||
        !Number.isInteger(port) || port < 1 || port > 65535 ||
        target.username || target.password) {
      return null;
    }
    if (requireState && (!expectedState || target.searchParams.get("state") !== expectedState)) {
      return null;
    }
    return target;
  } catch (_) {
    return null;
  }
}

function postDesktopSession(target, state, session, accountName) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = target.origin + target.pathname;
  form.style.display = "none";
  const fields = {
    state,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    account_name: accountName,
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value || "";
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function showMsg(id, text, kind){
  const box = el(id);
  box.textContent = text;
  box.className = "msg " + kind;
  box.style.display = "block";
}
function hideMsg(id){ el(id).style.display = "none"; }
function setBusy(btn, busy, label){
  btn.disabled = busy;
  if (label !== undefined) btn.textContent = label;
}

function fadeIn(elOrId){
  const target = typeof elOrId === "string" ? el(elOrId) : elOrId;
  if (!target) return;
  target.classList.remove("fade-in");
  void target.offsetWidth;
  target.classList.add("fade-in");
}

function showWrap(which){
  el("loadingWrap").classList.add("hidden");
  el("authWrap").classList.toggle("hidden", which !== "auth");
  el("brokenWrap").classList.toggle("hidden", which !== "broken");
  el("dashShell").classList.toggle("hidden", which !== "dash");
  const shown = which === "auth" ? el("authView") : which === "broken" ? el("brokenView") : el("dashShell");
  fadeIn(shown);
}

document.querySelectorAll(".dash-nav-item").forEach((item) => {
  item.onclick = () => {
    document.querySelectorAll(".dash-nav-item").forEach((i) => i.classList.remove("active"));
    document.querySelectorAll(".dash-section").forEach((s) => s.classList.remove("active"));
    item.classList.add("active");
    const section = el("section-" + item.dataset.section);
    section.classList.add("active");
    fadeIn(section);
  };
});

function openDashboardSection(name){
  const item = document.querySelector(`.dash-nav-item[data-section="${name}"]`);
  if (item) item.click();
}
document.querySelectorAll("[data-open-section]").forEach((btn) => {
  btn.onclick = () => openDashboardSection(btn.dataset.openSection);
});

const authTabs = [
  { name: "signup", tab: el("tabSignup"), panel: el("signupForm") },
  { name: "login", tab: el("tabLogin"), panel: el("loginForm") },
];

function selectAuthTab(name, focusTab = false) {
  authTabs.forEach(({ name: tabName, tab, panel }) => {
    const selected = tabName === name;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panel.classList.toggle("hidden", !selected);
    panel.setAttribute("aria-hidden", String(!selected));
    if (selected) fadeIn(panel);
  });
  el("forgotForm").classList.add("hidden");
  hideMsg("authMsg");
  if (focusTab) authTabs.find(({ name: tabName }) => tabName === name)?.tab.focus();
}

authTabs.forEach(({ name, tab }, index) => {
  tab.onclick = () => selectAuthTab(name);
  tab.onkeydown = (event) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % authTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + authTabs.length) % authTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = authTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectAuthTab(authTabs[nextIndex].name, true);
  };
});

el("forgotLink").onclick = (e) => {
  e.preventDefault();
  hideMsg("authMsg");
  el("loginForm").classList.add("hidden");
  el("loginForm").setAttribute("aria-hidden", "true");
  el("forgotForm").classList.remove("hidden");
  el("forgot_email").value = el("li_email").value;
};
el("backToLoginLink").onclick = (e) => {
  e.preventDefault();
  selectAuthTab("login");
};
el("forgot_submit").onclick = async () => {
  hideMsg("authMsg");
  const email = el("forgot_email").value.trim();
  if (!email) {
    showMsg("authMsg", "Enter your email first.", "error");
    return;
  }
  setBusy(el("forgot_submit"), true, "Sending...");
  const { error } = await supa.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  setBusy(el("forgot_submit"), false, "Send reset link");
  if (error) {
    showMsg("authMsg", error.message, "error");
    return;
  }
  showMsg("authMsg", "If that email has an account, a reset link is on its way. Check spam too.", "ok");
};
el("recovery_submit").onclick = async () => {
  hideMsg("authMsg");
  const pass = el("recovery_pass").value;
  if (!pass || pass.length < 12) {
    showMsg("authMsg", "Password needs to be at least 12 characters.", "error");
    return;
  }
  setBusy(el("recovery_submit"), true, "...");
  const { error } = await supa.auth.updateUser({ password: pass });
  setBusy(el("recovery_submit"), false, "Set new password");
  if (error) {
    showMsg("authMsg", error.message, "error");
    return;
  }
  showWrap("auth");
  el("recoveryForm").classList.add("hidden");
  selectAuthTab("login");
  showMsg("authMsg", "Password updated - you're logged in.", "ok");
  await refreshSession();
};

supa.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    showWrap("auth");
    el("loginForm").classList.add("hidden");
    el("signupForm").classList.add("hidden");
    el("forgotForm").classList.add("hidden");
    el("recoveryForm").classList.remove("hidden");
  }
});

let lastSignupEmail = null;
let resendTimer = null;

function startResendCooldown(){
  const btn = el("su_resend");
  btn.classList.remove("hidden");
  let remaining = RESEND_COOLDOWN_SECONDS;
  setBusy(btn, true, `Resend in ${remaining}s`);
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      setBusy(btn, false, "Resend confirmation email");
    } else {
      setBusy(btn, true, `Resend in ${remaining}s`);
    }
  }, 1000);
}

el("su_resend").onclick = async () => {
  if (!lastSignupEmail) return;
  setBusy(el("su_resend"), true, "Sending...");
  const { error } = await supa.auth.resend({ type: "signup", email: lastSignupEmail });
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("rate") || msg.includes("limit")) {
      showMsg("authMsg", "Too many attempts - Supabase's own test mailer only allows " +
        "a couple of emails per hour. Wait a bit before trying again.", "error");
    } else {
      showMsg("authMsg", error.message, "error");
    }
  } else {
    showMsg("authMsg", "Confirmation email resent to " + lastSignupEmail + ".", "ok");
  }
  startResendCooldown();
};

el("su_submit").onclick = async () => {
  hideMsg("authMsg");
  const account_name = canonicalPublicName(el("su_name").value);
  const email = el("su_email").value.trim();
  const password = el("su_pass").value;

  if (!el("su_name").value || !email || !password) {
    showMsg("authMsg", "Fill in all three fields.", "error");
    return;
  }
  if (!account_name) {
    showMsg("authMsg", ACCOUNT_NAME_HINT, "error");
    return;
  }
  el("su_name").value = account_name;
  if (!el("su_legal").checked) {
    showMsg("authMsg", "Please accept the Terms and read the Privacy Notice before creating an account.", "error");
    return;
  }
  if (password.length < 12) {
    showMsg("authMsg", "Password needs to be at least 12 characters.", "error");
    return;
  }

  setBusy(el("su_submit"), true);
  const { data, error } = await supa.auth.signUp({
    email, password,
    options: { data: { account_name, legal_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() } },
  });

  if (error) {
    setBusy(el("su_submit"), false, "Create account");
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      showMsg("authMsg", "That account name is already taken - try another.", "error");
    } else if (msg.includes("rate") || msg.includes("limit")) {
      showMsg("authMsg", "Too many signup attempts in a short time - wait a few minutes and try again.", "error");
    } else {
      showMsg("authMsg", error.message, "error");
    }
    return;
  }

  if (data.session) {
    await refreshSession();
  } else {
    lastSignupEmail = email;
    setBusy(el("su_submit"), true, "Check your email");
    showMsg("authMsg",
      "Account created. Check " + email + " for a confirmation link, " +
      "then log in above. Didn't get it? Check spam, or use resend below.", "ok");
    startResendCooldown();
  }
};

el("li_submit").onclick = async () => {
  hideMsg("authMsg");
  const email = el("li_email").value.trim();
  const password = el("li_pass").value;
  if (!email || !password) {
    showMsg("authMsg", "Enter your email and password.", "error");
    return;
  }
  setBusy(el("li_submit"), true);
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) {
    setBusy(el("li_submit"), false, "Log in");
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("confirm")) {
      showMsg("authMsg", "Confirm your email first - check your inbox for the link.", "error");
    } else {
      showMsg("authMsg", "Couldn't log in - check your email and password.", "error");
    }
    return;
  }
  await refreshSession();
};

async function doLogout(){
  await supa.auth.signOut({ scope: "local" });
  showWrap("auth");
}
el("logoutBtn").onclick = doLogout;
el("brokenLogoutBtn").onclick = doLogout;

el("downloadBtn").onclick = () => { window.location.href = DOWNLOAD_URL; };

el("upgradeBtn").onclick = () => {
  el("upgradeOptions").classList.toggle("hidden");
};

async function startCheckout(tierKey) {
  hideMsg("upgradeMsg");
  if (tierKey !== "monthly" && tierKey !== "annual") {
    showMsg("upgradeMsg", "Unknown plan.", "error");
    return;
  }
  showMsg("upgradeMsg", "Redirecting to checkout...", "ok");
  const { data, error } = await supa.functions.invoke("create-checkout", {
    body: { plan: tierKey },
  });
  if (error) {
    showMsg("upgradeMsg", "Couldn't start checkout: " + error.message, "error");
    return;
  }
  if (data && data.url) {
    window.location.href = data.url;
  } else {
    showMsg("upgradeMsg", "Checkout didn't return a URL - try again in a moment.", "error");
  }
}
el("upgradeMonthlyBtn").onclick = () => startCheckout("monthly");
el("upgradeAnnualBtn").onclick = () => startCheckout("annual");

el("settingsSave").onclick = async () => {
  hideMsg("settingsMsg");
  const newName = canonicalPublicName(el("settingsName").value);
  if (!newName) {
    showMsg("settingsMsg", ACCOUNT_NAME_HINT, "error");
    return;
  }
  setBusy(el("settingsSave"), true, "...");
  const { data: { session } } = await supa.auth.getSession();
  const { error } = await supa.from("profiles").update({ account_name: newName }).eq("id", session.user.id);
  setBusy(el("settingsSave"), false, "Save");

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      showMsg("settingsMsg", "That name is already taken - try another.", "error");
    } else {
      showMsg("settingsMsg", error.message, "error");
    }
    return;
  }
  showMsg("settingsMsg", "Saved.", "ok");
  el("settingsName").value = newName;
  el("dashName").textContent = newName;
  el("dashAvatar").textContent = newName.charAt(0).toUpperCase();
};

el("settingsPassSave").onclick = async () => {
  hideMsg("settingsPassMsg");
  const pass1 = el("settingsNewPass").value;
  const pass2 = el("settingsNewPass2").value;

  if (!pass1 || !pass2) {
    showMsg("settingsPassMsg", "Fill in both fields.", "error");
    return;
  }
  if (pass1.length < 12) {
    showMsg("settingsPassMsg", "Password needs to be at least 12 characters.", "error");
    return;
  }
  if (pass1 !== pass2) {
    showMsg("settingsPassMsg", "Passwords don't match.", "error");
    return;
  }

  setBusy(el("settingsPassSave"), true, "...");
  const { error } = await supa.auth.updateUser({ password: pass1 });
  setBusy(el("settingsPassSave"), false, "Change password");

  if (error) {
    showMsg("settingsPassMsg", error.message, "error");
    return;
  }
  el("settingsNewPass").value = "";
  el("settingsNewPass2").value = "";
  try { await supa.auth.signOut({ scope: "others" }); } catch (_) {}
  showMsg("settingsPassMsg", "Password changed. Other sessions were asked to sign out.", "ok");
};

let selectedRating = 0;
function paintStars(rating){
  document.querySelectorAll("#starPicker [data-star]").forEach((s) => {
    s.classList.toggle("filled", parseInt(s.dataset.star) <= rating);
  });
}
document.querySelectorAll("#starPicker [data-star]").forEach((s) => {
  s.onclick = () => {
    selectedRating = parseInt(s.dataset.star);
    paintStars(selectedRating);
  };
});

async function loadOwnReview(uid){
  const { data } = await supa.from("reviews").select("rating, body").eq("id", uid).maybeSingle();
  if (data) {
    selectedRating = data.rating;
    paintStars(selectedRating);
    el("reviewBody").value = data.body;
  }
}

el("reviewSave").onclick = async () => {
  hideMsg("reviewMsg");
  const body = el("reviewBody").value.trim();
  if (!selectedRating) {
    showMsg("reviewMsg", "Pick a star rating first.", "error");
    return;
  }
  if (!body) {
    showMsg("reviewMsg", "Write a few words first.", "error");
    return;
  }
  const { data: { session } } = await supa.auth.getSession();
  const { data: profile } = await supa.from("profiles").select("account_name").eq("id", session.user.id).maybeSingle();
  setBusy(el("reviewSave"), true, "...");
  const { error } = await supa.from("reviews").upsert({
    id: session.user.id,
    account_name: profile.account_name,
    rating: selectedRating,
    body: body,
  });
  setBusy(el("reviewSave"), false, "Save review");
  if (error) {
    showMsg("reviewMsg", error.message, "error");
    return;
  }
  showMsg("reviewMsg", "Saved - thank you!", "ok");
};

async function refreshSession(){
  let session;
  try {
    const result = await supa.auth.getSession();
    if (result.error) throw result.error;
    session = result.data.session;
  } catch (e) {
    console.error("Session check failed:", e);
    showWrap("auth");
    showMsg("authMsg", "Could not verify your session - please log in.", "error");
    return;
  }
  if (!session) { showWrap("auth"); return; }

  const uid = session.user.id;
  const { data: profile } = await supa.from("profiles").select("account_name").eq("id", uid).maybeSingle();
  const { data: entitlement } = await supa.from("entitlements")
    .select("tier_id, tier_source, tier_expires_at, preferred_theme, tiers(display_name, cloud_enabled, " +
            "widgets_enabled, music_player_enabled, office_tools_enabled, " +
            "streamer_tools_enabled, allowed_themes, future_updates)")
    .eq("id", uid).maybeSingle();

  if (!profile || !entitlement) {
    showWrap("broken");
    return;
  }

  let effectiveEntitlement = entitlement;
  const expiresAt = entitlement.tier_expires_at ? Date.parse(entitlement.tier_expires_at) : NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    const { data: freeTier } = await supa.from("tiers")
      .select("display_name, cloud_enabled, widgets_enabled, music_player_enabled, " +
              "office_tools_enabled, streamer_tools_enabled, " +
              "allowed_themes, future_updates")
      .eq("tier_id", "free").maybeSingle();
    effectiveEntitlement = {
      ...entitlement,
      tier_id: "free",
      tier_source: "expired",
      tiers: freeTier || { display_name: "Free", allowed_themes: ["Frost"] },
    };
  }

  const params = PAGE_PARAMS;
  const desktopCallback = params.get("desktop_callback");
  if (desktopCallback) {
    const desktopState = params.get("desktop_state");
    const handoffMode = params.get("desktop_handoff");
    const v2 = handoffMode === "post-v2";
    const target = validatedDesktopCallback(desktopCallback, desktopState, v2);
    if (!target) {
      showWrap("dash");
      showMsg("dashMsg", "AVEN desktop sign-in request was invalid. Start sign-in again from AVEN.", "error");
      return;
    }

    if (v2) {
      postDesktopSession(target, desktopState, session, profile.account_name);
    } else {
      target.searchParams.set("access_token", session.access_token);
      target.searchParams.set("refresh_token", session.refresh_token);
      target.searchParams.set("account_name", profile.account_name);
      window.location.replace(target.toString());
    }
    return;
  }

  showWrap("dash");
  const displayTier = effectiveEntitlement.tiers?.display_name || effectiveEntitlement.tier_id;
  const sourceLabel = effectiveEntitlement.tier_source === "manual" ? "Manually granted" :
                      effectiveEntitlement.tier_source === "stripe" ? "Paid subscription" :
                      effectiveEntitlement.tier_source === "expired" ? "Plan expired" : "Free signup";
  const normalizedTheme = LEGACY_THEME_ALIASES[effectiveEntitlement.preferred_theme] ||
                          effectiveEntitlement.preferred_theme ||
                          effectiveEntitlement.tiers?.allowed_themes?.[0] || "Frost";

  el("dashName").textContent = profile.account_name;
  el("dashAvatar").textContent = profile.account_name.charAt(0).toUpperCase();
  el("dashTier").textContent = displayTier;
  el("dashSource").textContent = sourceLabel;
  el("sidebarTier").textContent = displayTier + " · " + sourceLabel;
  el("overviewName").textContent = profile.account_name;
  el("overviewEmail").textContent = session.user.email || "Signed-in account";
  el("overviewPlan").textContent = displayTier;
  el("overviewPlanNote").textContent = sourceLabel;
  el("overviewTheme").textContent = normalizedTheme;
  el("dashExpires").textContent = Number.isFinite(expiresAt)
    ? (expiresAt <= Date.now() ? "Expired " : "Through ") + new Date(expiresAt).toLocaleDateString()
    : "No fixed expiry";
  el("settingsName").value = profile.account_name;

  const checkoutState = params.get("checkout");
  if (checkoutState === "success") {
    showMsg("dashMsg", "Checkout completed. Stripe may take a moment to refresh your plan access.", "ok");
  } else if (checkoutState === "cancelled") {
    showMsg("dashMsg", "Checkout was cancelled. Your current plan was not changed.", "warn");
  }

  renderFeatures(effectiveEntitlement.tiers || {});
  renderThemeSwatches(effectiveEntitlement.tiers?.allowed_themes || ["Frost"], normalizedTheme);
  loadOwnReview(uid);
}

function renderFeatures(tier){
  const rows = [
    ["Cloud AI requests", tier.cloud_enabled],
    ["Overlay widgets", tier.widgets_enabled],
    ["Music player", tier.music_player_enabled],
    ["Office Automation (Excel/CSV, folder tidy, screenshots)", tier.office_tools_enabled],
    ["Streamer tools extension (OBS control)", tier.streamer_tools_enabled],
  ];
  el("featuresList").innerHTML = rows.map(([name, on]) => `
    <div class="feature-row ${on ? "on" : "off"}">
      <span class="feature-mark">${on ? "&check;" : "&times;"}</span>
      <span class="feature-name">${name}</span>
    </div>`).join("");

  const noteText = {
    all: "Every future paid feature is included permanently on this tier - no re-upgrade needed as AvenAI grows.",
    subscription: "Every current and future paid feature is included for as long as your subscription stays active.",
    none: "New paid features added later aren't automatically included on this tier.",
  }[tier.future_updates] || "";
  const note = el("futureUpdatesNote");
  if (noteText) { note.textContent = noteText; note.style.display = "block"; }
  else { note.style.display = "none"; }
}

function renderThemeSwatches(allowedThemes, preferred){
  el("themeSwatches").innerHTML = ALL_THEME_NAMES.map((name) => {
    const c = THEME_COLORS[name];
    const locked = !allowedThemes.includes(name);
    const active = !locked && name === preferred;
    return `
      <button type="button" class="theme-swatch ${active ? "active" : ""} ${locked ? "locked" : ""}"
              data-theme="${name}" ${locked ? "disabled" : ""}
              style="--dot-bg:${c.bg}; --dot-accent:${c.accent};">
        <span class="theme-swatch-dot"></span>
        <span class="theme-swatch-label">${name}</span>
        ${locked ? '<span class="theme-swatch-lock">Locked</span>' : ""}
      </button>`;
  }).join("");

  document.querySelectorAll(".theme-swatch:not(.locked)").forEach((btn) => {
    btn.onclick = async () => {
      hideMsg("themeMsg");
      const theme = btn.dataset.theme;
      document.querySelectorAll(".theme-swatch").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const { data: { session } } = await supa.auth.getSession();
      const { error } = await supa.from("profiles").update({ preferred_theme: theme }).eq("id", session.user.id);
      if (error) {
        showMsg("themeMsg", error.message, "error");
        return;
      }
      showMsg("themeMsg", "Saved - applies next time you open AvenAI", "ok");
    };
  });
}

async function exportAccountData(){
  hideMsg("dataMsg");
  setBusy(el("exportDataBtn"), true, "Preparing...");
  try {
    const { data: { user }, error: userError } = await supa.auth.getUser();
    if (userError || !user) {
      showMsg("dataMsg", "Could not verify your account. Log in again or retry.", "error");
      return;
    }
    const uid = user.id;
    const [profileResult, entitlementResult, reviewResult] = await Promise.all([
      supa.from("profiles").select("id,account_name,created_at,preferred_theme").eq("id", uid).maybeSingle(),
      supa.from("entitlements").select("id,account_name,tier_id,tier_source,tier_expires_at,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,preferred_theme,updated_at").eq("id", uid).maybeSingle(),
      supa.from("reviews").select("id,account_name,rating,body,created_at,updated_at").eq("id", uid).maybeSingle(),
    ]);
    if ([profileResult, entitlementResult, reviewResult].some(result => result.error)
        || !profileResult.data || !entitlementResult.data
        || [profileResult.data, entitlementResult.data, reviewResult.data].some(row => row && row.id !== uid)) {
      throw new Error("Account data could not be fully loaded");
    }
    // Select account fields explicitly; never serialize the SDK session/user
    // object wholesale, which can carry authentication/provider tokens.
    const payload = {
      schema_version: 1, scope: "basic_account", exported_at: new Date().toISOString(),
      account: {
        id: uid, email: user.email || null, phone: user.phone || null,
        created_at: user.created_at || null, updated_at: user.updated_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        phone_confirmed_at: user.phone_confirmed_at || null,
        is_anonymous: user.is_anonymous === true, user_metadata: user.user_metadata || {},
      },
      profile: profileResult.data, entitlement: entitlementResult.data, review: reviewResult.data || null,
      note: "Basic export of your profile, entitlement, review and selected authentication fields, including user-provided metadata. It does not include payment-provider records, server logs, authentication/session tokens or desktop data. Payment-card data is handled by Stripe and is not stored by this website.",
    };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="aven-account-data.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showMsg("dataMsg","Export created locally in your browser.","ok");
  } catch (_) { showMsg("dataMsg","Could not create the export. Try again.","error"); }
  finally { setBusy(el("exportDataBtn"),false,"Export account data"); }
}
async function deleteOwnReview(){
  hideMsg("dataMsg");
  if (!window.confirm("Delete your public review? This does not delete your account.")) return;
  const { data: { session } } = await supa.auth.getSession();
  if (!session?.user) { showMsg("dataMsg","Your session expired. Log in again.","error"); return; }
  setBusy(el("deleteReviewBtn"),true,"Deleting...");
  const { error } = await supa.from("reviews").delete().eq("id",session.user.id);
  setBusy(el("deleteReviewBtn"),false,"Delete my review");
  if (error) { showMsg("dataMsg","Could not delete the review: "+error.message,"error"); return; }
  selectedRating=0; paintStars(0); el("reviewBody").value=""; showMsg("dataMsg","Your public review was deleted.","ok");
}
el("exportDataBtn").onclick=exportAccountData;
el("deleteReviewBtn").onclick=deleteOwnReview;

refreshSession();

} catch (fatalError) {
  const banner = document.createElement("div");
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#3a1414;" +
    "color:#ffb0a0;padding:14px 20px;font-family:sans-serif;font-size:14px;" +
    "z-index:9999;border-bottom:2px solid #ff8a80;";
  banner.textContent = "This page failed to start: " + fatalError.message +
    ". Reload the page; if it continues, use the project support link.";
  document.body.prepend(banner);
  console.error("AvenAI account.html fatal init error:", fatalError);
}
