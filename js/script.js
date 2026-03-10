/**
 * script.js — Sunshine Tropical Health & Wellness
 * Single clean version (no duplicates)
 *
 * Modules:
 * 1) EmailJS (General Questions form)
 * 2) SimplePractice Widget Loader (OAR + Contact)
 * 3) Cart (drawer UI + service selection summary)
 * 4) Global UI helpers (year, hamburger, animations)
 *
 * Key rules:
 * - NEVER hijack normal external links.
 * - Only preventDefault on the actual widget anchors (#spRequestApptBtn, #spContactBtn).
 * - NEVER call spBtn.click() from inside its own click handler.
 */

(() => {
  "use strict";

  // =========================================================
  // HELPERS
  // =========================================================
  const $ = (sel, root = document) => root.querySelector(sel);

  function money(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  }

  function safeTrim(v) {
    return String(v || "").trim();
  }

  function getSchedulingAnchor() {
    return document.getElementById("portal-section") || null;
  }

  // =========================================================
  // 0) GLOBAL UI (Year + Hamburger + Animations)
  // =========================================================
  (function globalUiModule() {
    document.addEventListener("DOMContentLoaded", () => {
      // Year
      const y = document.getElementById("year");
      if (y) y.textContent = String(new Date().getFullYear());

      // Animations
      const animated = Array.from(document.querySelectorAll(".animate"));
      if (animated.length) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("active");
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12 }
        );

        animated.forEach((el, idx) => {
          el.style.transitionDelay = `${Math.min(idx * 90, 500)}ms`;
          observer.observe(el);
        });
      }

      // Hamburger menu
      const hamburger = document.getElementById("hamburger");
      const navMenu = document.getElementById("nav-menu");
      if (hamburger && navMenu && !hamburger.dataset.bound) {
        hamburger.dataset.bound = "true";

        const setA11y = (open) => {
          hamburger.setAttribute("aria-expanded", String(open));
          hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        };

        hamburger.addEventListener("click", () => {
          const isOpen = navMenu.classList.toggle("show");
          setA11y(isOpen);
        });

        navMenu.querySelectorAll("a").forEach((a) => {
          a.addEventListener("click", () => {
            if (window.matchMedia("(max-width: 980px)").matches) {
              navMenu.classList.remove("show");
              setA11y(false);
            }
          });
        });
      }
    });
  })();

  // =========================================================
  // 1) EMAILJS — General Questions (Non-Medical)
  // Form: #appointmentForm
  // =========================================================
  (function emailJsModule() {
    // CONFIG (yours)
    const EMAILJS_PUBLIC_KEY = "--B-cjWXskc4CjE4o";
    const EMAILJS_SERVICE_ID = "service_9cf9h5s";
    const CLINIC_TEMPLATE_ID = "template_2u7g6eh";
    const AUTOREPLY_TEMPLATE_ID = "template_v6zbtzl";

    // SETTINGS
    const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes
    const MIN_TIME_ON_PAGE_MS = 2500;
    const MAX_MESSAGE_CHARS = 2000;
    const STORAGE_RATE_KEY = "sth_email_last_submit_v1";
    const CART_SUMMARY_KEY = "sth_cart_summary_v1";

    function nowMs() {
      return Date.now();
    }

    function setBtnLoading(btn, loading) {
      if (!btn) return;
      btn.disabled = loading;
      btn.textContent = loading ? "Sending..." : "Send Message";
      btn.style.opacity = loading ? "0.75" : "1";
      btn.style.cursor = loading ? "not-allowed" : "pointer";
    }

    function getCartSummary() {
      const txt = safeTrim(localStorage.getItem(CART_SUMMARY_KEY));
      if (!txt) return "";
      return `\n\n---\nSERVICE SELECTION SUMMARY (from website cart)\n${txt}\n---\n`;
    }

    function isRateLimited() {
      const last = Number(localStorage.getItem(STORAGE_RATE_KEY) || "0");
      return last > 0 && nowMs() - last < RATE_LIMIT_MS;
    }

    function setRateLimitStamp() {
      localStorage.setItem(STORAGE_RATE_KEY, String(nowMs()));
    }

    function ensureHoneypotField(form) {
      if (!form || form.querySelector('input[name="company_website"]')) return;

      const wrap = document.createElement("div");
      wrap.style.position = "absolute";
      wrap.style.left = "-9999px";
      wrap.style.height = "0";
      wrap.style.overflow = "hidden";

      const label = document.createElement("label");
      label.textContent = "Company Website";
      label.setAttribute("for", "company_website");

      const input = document.createElement("input");
      input.type = "text";
      input.name = "company_website";
      input.id = "company_website";
      input.autocomplete = "off";
      input.tabIndex = -1;

      wrap.appendChild(label);
      wrap.appendChild(input);
      form.appendChild(wrap);
    }

    function buildPayload(form) {
      const from_name = safeTrim($("#from_name", form)?.value);
      const email = safeTrim($("#email", form)?.value);
      const phone = safeTrim($("#phone", form)?.value);
      let message = safeTrim($("#message", form)?.value);

      if (message.length > MAX_MESSAGE_CHARS) {
        message = message.slice(0, MAX_MESSAGE_CHARS) + "…";
      }

      const cartSummary = getCartSummary();
      if (cartSummary) message += cartSummary;

      return {
        from_name,
        email,
        phone,
        message,
        page: window.location.href,
        submitted_at: new Date().toLocaleString(),
        subject_line: `Website Question from ${from_name || "Client"}`,
      };
    }

    async function sendClinicEmail(payload) {
      return window.emailjs.send(EMAILJS_SERVICE_ID, CLINIC_TEMPLATE_ID, payload);
    }

    async function sendAutoReply(payload) {
      if (!AUTOREPLY_TEMPLATE_ID || AUTOREPLY_TEMPLATE_ID.includes("PASTE_AUTOREPLY")) {
        return { skipped: true };
      }

      const replyPayload = {
        to_email: payload.email,
        to_name: payload.from_name || "there",
        from_name: "Sunshine Tropical Health & Wellness",
        submitted_at: payload.submitted_at,
        page: payload.page,
        message: payload.message,
        subject_line: "We received your message",
      };

      return window.emailjs.send(EMAILJS_SERVICE_ID, AUTOREPLY_TEMPLATE_ID, replyPayload);
    }

    document.addEventListener("DOMContentLoaded", () => {
      const form = $("#appointmentForm");
      if (!form) return;

      if (form.dataset.emailjsBound === "true") return;
      form.dataset.emailjsBound = "true";

      ensureHoneypotField(form);

      if (typeof window.emailjs === "undefined") {
        console.warn("EmailJS library not loaded. Add the EmailJS CDN script tag.");
        return;
      }

      try {
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
      } catch (err) {
        console.error("EmailJS init failed:", err);
        return;
      }

      const loadedAt = nowMs();

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');

        if (nowMs() - loadedAt < MIN_TIME_ON_PAGE_MS) {
          alert("Please wait a moment and try again.");
          return;
        }

        const honey = safeTrim(form.querySelector('input[name="company_website"]')?.value);
        if (honey) {
          form.reset();
          alert("Message sent successfully! We’ll get back to you soon.");
          return;
        }

        if (isRateLimited()) {
          alert("Please wait a minute before sending another message.");
          return;
        }

        const payload = buildPayload(form);

        if (!payload.from_name || !payload.email) {
          alert("Please enter your full name and email.");
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
          alert("Please enter a valid email address.");
          return;
        }

        setBtnLoading(submitBtn, true);

        try {
          setRateLimitStamp();
          await sendClinicEmail(payload);
          try {
            await sendAutoReply(payload);
          } catch (_) {
            /* ignore */
          }

          form.reset();
          alert("Message sent successfully! We’ll get back to you soon.");
        } catch (err) {
          console.error("EmailJS send error:", err);
          localStorage.removeItem(STORAGE_RATE_KEY);
          alert("Message failed to send. Please try again or email us directly.");
        } finally {
          setBtnLoading(submitBtn, false);
        }
      });
    });
  })();

  // =========================================================
  // 2) SIMPLEPRACTICE — load once + open specific widget
  // =========================================================
  (function simplePracticeModule() {
    if (window.__STHW_SP_BOUND__) return;
    window.__STHW_SP_BOUND__ = true;

    const SP_SRC = "https://widget-cdn.simplepractice.com/assets/integration-1.0.js";
    let spLoadPromise = null;

    function loadSimplePracticeScript() {
      if (window.spwidget) return Promise.resolve(true);
      if (spLoadPromise) return spLoadPromise;

      spLoadPromise = new Promise((resolve) => {
        const existing = document.querySelector(`script[src="${SP_SRC}"]`);
        if (existing) {
          const t0 = Date.now();
          const tick = () => {
            if (window.spwidget) return resolve(true);
            if (Date.now() - t0 > 5000) return resolve(false);
            requestAnimationFrame(tick);
          };
          tick();
          return;
        }

        const s = document.createElement("script");
        s.src = SP_SRC;
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });

      return spLoadPromise;
    }

    // Only used for widget anchors (not normal links)
    function preventNavigateForWidgetAnchor(el) {
      if (!el || el.dataset.noNavBound) return;
      el.dataset.noNavBound = "true";

      el.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
        },
        true
      );
    }

    async function openSPWidgetById(btnId) {
      const btn = document.getElementById(btnId);
      if (!btn) return false;

      // Prevent only widget anchor navigation
      preventNavigateForWidgetAnchor(btn);

      // Ensure loader is present
      if (!window.spwidget) {
        const ok = await loadSimplePracticeScript();
        if (!ok || !window.spwidget) return false;
      }

      // Trigger a click that the SP integration script will handle
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    }

    window.STHW_openAppointmentWidget = () => openSPWidgetById("spRequestApptBtn");
    window.STHW_openContactWidget = () => openSPWidgetById("spContactBtn");

    document.addEventListener("DOMContentLoaded", () => {
      const oarBtn = document.getElementById("spRequestApptBtn");
      const contactBtn = document.getElementById("spContactBtn");

      // Prevent only the widget anchors from navigating
      preventNavigateForWidgetAnchor(oarBtn);
      preventNavigateForWidgetAnchor(contactBtn);

      // Optional: visible button to open contact widget
      const openContactBtn = document.getElementById("openContactWidgetBtn");
      if (openContactBtn && !openContactBtn.dataset.bound) {
        openContactBtn.dataset.bound = "true";
        openContactBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.STHW_openContactWidget();
        });
      }

      // IMPORTANT: Do NOT bind a click handler to oarBtn that re-clicks itself.
      // If SP script isn't loaded yet, the first click might do nothing.
      // So we preload the script when the button exists:
      if (oarBtn) loadSimplePracticeScript();
      if (contactBtn) loadSimplePracticeScript();
    });
  })();

  // =========================================================
  // 3) CART — Drawer + Summary + Checkout Summary Card
  // =========================================================
  (function cartModule() {
    if (window.__STHW_CART_BOUND__) return;
    window.__STHW_CART_BOUND__ = true;

    const STORAGE_KEY = "sth_cart_v1";
    const SUMMARY_KEY = "sth_cart_summary_v1";

    function loadCart() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    }

    function saveCart(cart) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    function cartQtyTotal(cart) {
      return Object.values(cart).reduce((sum, item) => sum + (item.qty || 0), 0);
    }

    function cartPriceTotal(cart) {
      return Object.values(cart).reduce(
        (sum, item) => sum + (item.qty || 0) * (item.price || 0),
        0
      );
    }

    function cartToText(cart) {
      const items = Object.values(cart);
      if (!items.length) return "";

      const lines = items.map((it) => {
        const label = it.qtyLabel || "Qty";
        const subtotal = (it.price || 0) * (it.qty || 0);
        return `• ${it.name} (${label}: ${it.qty}) — ${money(subtotal)}`;
      });

      return `SUNSHINE TROPICAL — SERVICE SUMMARY\n\nSelected Services:\n${lines.join(
        "\n"
      )}\n\nEstimated Total: ${money(cartPriceTotal(cart))}`;
    }

    function consultRequirements(cart) {
      const required = new Set();
      Object.values(cart).forEach((it) => {
        if (it.requiresConsult && it.consultId) required.add(it.consultId);
      });

      const missing = [];
      required.forEach((cid) => {
        if (!cart[cid]) missing.push(cid);
      });
      return missing;
    }

    // ---- Checkout summary card on Patient Portal page (optional elements)
    function renderCheckoutSummaryCard() {
      const cartHelper = document.getElementById("cartPasteHelper");
      const list = document.getElementById("cartSummaryList");
      const totalEl = document.getElementById("cartSummaryTotal");
      const pre = document.getElementById("cartSummaryPre");

      // If this page doesn't have the summary card elements, skip safely.
      if (!cartHelper || !list || !totalEl || !pre) return;

      const cart = loadCart();
      const items = Object.values(cart);

      if (!items.length) {
        cartHelper.style.display = "none";
        return;
      }

      cartHelper.style.display = "block";

      list.innerHTML = items
        .map((it) => {
          const qtyLabel = it.qtyLabel || "Qty";
          const metaParts = [];
          if (it.category) metaParts.push(it.category);
          if (it.requiresConsult) metaParts.push("Requires consult");
          if (it.isConsult) metaParts.push("Consult");
          metaParts.push(`${qtyLabel}: ${it.qty}`);

          return `
            <div class="checkout-item">
              <div class="left">
                <p class="name">${it.name}</p>
                <p class="meta">${metaParts.join(" • ")}</p>
              </div>
              <div class="price">${money((it.price || 0) * (it.qty || 0))}</div>
            </div>
          `;
        })
        .join("");

      const total = cartPriceTotal(cart);
      totalEl.textContent = money(total);

      const txt = cartToText(cart);
      pre.textContent = txt;
      localStorage.setItem(SUMMARY_KEY, txt);
    }

    // ---- Cart drawer UI
    function renderCartUI() {
      const cartFab = $("#cartFab");
      const cartCount = $("#cartCount");
      const cartItems = $("#cartItems");
      const cartTotalEl = $("#cartTotal");
      const cartWarn = $("#cartWarn");

      if (!cartFab || !cartCount || !cartItems) return;

      const cart = loadCart();
      const items = Object.values(cart);

      cartCount.textContent = String(cartQtyTotal(cart));
      if (cartTotalEl) cartTotalEl.textContent = money(cartPriceTotal(cart));

      const summaryText = cartToText(cart);
      localStorage.setItem(SUMMARY_KEY, summaryText);

      // Keep the portal summary card in sync if present
      renderCheckoutSummaryCard();

      if (cartWarn) cartWarn.classList.remove("show");

      if (!items.length) {
        cartItems.innerHTML = `
          <div style="padding:10px;color:#475569;line-height:1.5;">
            Your cart is empty. Add a service on the Services page to continue.
          </div>
        `;
        return;
      }

      cartItems.innerHTML = items
        .map((item) => {
          const label = item.qtyLabel || "Qty";
          return `
            <div class="cart-item" data-id="${item.id}">
              <div class="row">
                <strong style="color:#0f172a">${item.name}</strong>
                <span style="font-weight:1000;color:#008080">${money(item.price)}</span>
              </div>
              <div class="row">
                <span style="color:#475569;font-size:.92rem;">
                  ${item.category || ""}${item.requiresConsult ? " • Requires consult" : ""}${
                    item.isConsult ? " • Consult" : ""
                  }
                </span>
                <div class="qty" aria-label="Quantity controls">
                  <button type="button" data-dec>−</button>
                  <strong>${label}: ${item.qty}</strong>
                  <button type="button" data-inc>+</button>
                  <button type="button" class="remove-btn" data-remove aria-label="Remove item">✕</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    function openCartUI() {
      $("#cartOverlay")?.classList.add("show");
      $("#cartDrawer")?.classList.add("show");
      $("#cartOverlay")?.setAttribute("aria-hidden", "false");
      $("#cartDrawer")?.setAttribute("aria-hidden", "false");
    }

    function closeCartUI() {
      $("#cartOverlay")?.classList.remove("show");
      $("#cartDrawer")?.classList.remove("show");
      $("#cartOverlay")?.setAttribute("aria-hidden", "true");
      $("#cartDrawer")?.setAttribute("aria-hidden", "true");
    }

    function changeQty(itemId, delta) {
      const cart = loadCart();
      if (!cart[itemId]) return;

      cart[itemId].qty = (cart[itemId].qty || 0) + delta;
      if (cart[itemId].qty <= 0) delete cart[itemId];

      saveCart(cart);
      renderCartUI();
    }

    function removeItem(itemId) {
      const cart = loadCart();
      delete cart[itemId];
      saveCart(cart);
      renderCartUI();
    }

    function clearCart() {
      saveCart({});
      renderCartUI();
    }

    // ---- Copy summary helper (used optionally)
    async function copyToClipboard(text) {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // fallback
        try {
          const pre = document.getElementById("cartSummaryPre");
          if (pre) pre.textContent = text;

          const range = document.createRange();
          range.selectNodeContents(pre || document.body);

          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          const ok = document.execCommand("copy");
          sel.removeAllRanges();
          return !!ok;
        } catch {
          return false;
        }
      }
    }

    function ensureToastNearWidget() {
      const spBtn = document.getElementById("spRequestApptBtn");
      if (!spBtn || !spBtn.parentElement) return null;

      let toast = document.getElementById("portalSummaryToast");
      if (toast) return toast;

      toast = document.createElement("div");
      toast.id = "portalSummaryToast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.style.cssText = `
        margin: 12px auto 0;
        max-width: 720px;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(0, 128, 128, .10);
        border: 1px solid rgba(0, 128, 128, .18);
        color: #0f172a;
        font-weight: 900;
        line-height: 1.4;
        display: none;
        text-align: center;
      `;
      spBtn.parentElement.appendChild(toast);
      return toast;
    }

    document.addEventListener("DOMContentLoaded", () => {
      const cartFab = $("#cartFab");
      const cartOverlay = $("#cartOverlay");
      const cartDrawer = $("#cartDrawer");
      const closeCartBtn = $("#closeCart");
      const cartItems = $("#cartItems");
      const clearCartBtn = $("#clearCartBtn");
      const checkoutBtn = $("#checkoutBtn");
      const cartWarn = $("#cartWarn");

      if (!cartFab || !cartOverlay || !cartDrawer || !cartItems) {
        // Still render checkout summary card on pages that have it
        renderCheckoutSummaryCard();
        return;
      }

      cartFab.addEventListener("click", () => {
        renderCartUI();
        openCartUI();
      });

      cartOverlay.addEventListener("click", closeCartUI);
      closeCartBtn?.addEventListener("click", closeCartUI);

      cartItems.addEventListener("click", (e) => {
        const wrap = e.target.closest(".cart-item");
        if (!wrap) return;
        const id = wrap.getAttribute("data-id");
        if (!id) return;

        if (e.target.matches("[data-inc]")) changeQty(id, +1);
        if (e.target.matches("[data-dec]")) changeQty(id, -1);
        if (e.target.closest("[data-remove]")) removeItem(id);
      });

      clearCartBtn?.addEventListener("click", clearCart);

      // Optional: copy summary on widget press WITHOUT blocking widget
      const spBtn = document.getElementById("spRequestApptBtn");
      if (spBtn && !spBtn.dataset.copyBound) {
        spBtn.dataset.copyBound = "true";
        spBtn.addEventListener(
          "pointerdown",
          async () => {
            const cart = loadCart();
            const summary = cartToText(cart);
            if (!summary) return;

            const toast = ensureToastNearWidget();
            const ok = await copyToClipboard(summary);

            if (toast) {
              toast.style.display = "block";
              toast.textContent = ok
                ? "✅ Service summary copied. If you see a notes/message box, paste it so we know what you selected."
                : "⚠️ Copy may be blocked by your browser. Your selected services are still shown on this page.";
            }
          },
          { passive: true }
        );
      }

      // Checkout -> open APPOINTMENT REQUEST widget (OAR)
      checkoutBtn?.addEventListener("click", (e) => {
        e.preventDefault();

        const cart = loadCart();
        const missing = consultRequirements(cart);

        if (missing.length) {
          if (cartWarn) {
            cartWarn.textContent =
              "A consult is required for one or more items. Please go to the Services page and add the required consult, then continue.";
            cartWarn.classList.add("show");
          }
          window.location.href = "services.html#buy-services";
          return;
        }

        const hasItems = Object.keys(cart).length > 0;
        if (!hasItems) {
          if (cartWarn) {
            cartWarn.textContent = "Please select at least one service before submitting your request.";
            cartWarn.classList.add("show");
          }
          return;
        }

        if (cartWarn) cartWarn.classList.remove("show");
        localStorage.setItem(SUMMARY_KEY, cartToText(cart));

        closeCartUI();

        // Scroll to portal section then open OAR widget
        getSchedulingAnchor()?.scrollIntoView({ behavior: "smooth", block: "start" });

        setTimeout(() => {
          if (typeof window.STHW_openAppointmentWidget === "function") {
            window.STHW_openAppointmentWidget();
          }
        }, 250);
      });

      renderCartUI();
    });

    // Expose cart helpers for Services page buttons (if you use them)
    window.STHW_cart = {
      load: loadCart,
      save: saveCart,
      render: renderCartUI,
    };
  })();
})();
// =========================================================
// 4) SERVICES CATALOG (only runs on Services page)
// Supports dropdown items added into the SAME cart.
// Requires: #product-grid exists on that page.
// =========================================================
(function servicesCatalogModule() {
  const STORAGE_KEY = "sth_cart_v1";

  // Only run on pages that actually have the product grid
  document.addEventListener("DOMContentLoaded", () => {
    const productGrid = document.getElementById("product-grid");
    if (!productGrid) return;

    // ---- Option Lists
    const SHOT_TREATMENTS = [
      { key: "B12", name: "Vitamin B12", price: 20.0 },
      { key: "NAD-Glutathione", name: "Energy Booster", price: 400.0 },
      { key: "Vitamin-C", name: "Vitamin C", price: 25.0 },
      { key: "Ondansetron", name: "Ondansetron", price: 30.0 },
      { key: "Vitamin-D", name: "Vitamin D", price: 35.0 },
      { key: "Folic-acid", name: "Vitamin Folic Acid", price: 20.0 },
    ];

    const IV_TREATMENTS = [
      { key: "Wellness-immunity", name: "Wellness & Immunity", price: 200.0 },
      { key: "Fat-blast", name: "Fat Blast", price: 150.0 },
      { key: "Hangover", name: "Hangover", price: 250.0 },
      { key: "Glow-beauty", name: "Glow Beauty", price: 200.0 },
      { key: "Libido-performance", name: "Libido & Performance", price: 250.0 },
      { key: "Vitamin-reboot", name: "Vitamin Reboot", price: 100.0 },
    ];

    const SEMAGLUTIDE = [
      { key: "sema-0-25-4wk", name: "Initial dose - (4 weeks)", price: 200.0 },
      { key: "sema-0-5-4wk", name: "Intermediate dose - (4 weeks)", price: 280.0 },
      { key: "sema-1-4wk", name: "Highest dose - (4 weeks)", price: 300.0 },
    ];

    const TIRZEPATIDE = [
      { key: "tirz-2-5-4wk", name: "Initial dose - (4 weeks)", price: 325.0 },
      { key: "tirz-5-4wk", name: "Intermediate dose - (4 weeks)", price: 430.0 },
      { key: "tirz-7-5-4wk", name: "Highest dose - (4 weeks)", price: 560.0 },
    ];

    // ---- Products (yours)
    const PRODUCTS = [
      {
        id: "primary-care",
        name: "Primary Care Visit (Only Telehealth at this moment)",
        price: 100.0,
        category: "Primary Care",
        desc: "Initial primary care visit for common concerns, follow-ups, and care planning.",
        img: "assets/img/services/primary-care.jpg",
      },
      {
        id: "chronic-condition",
        name: "Chronic Condition Check-In",
        price: 150.0,
        category: "Chronic Care",
        desc: "Condition monitoring, medication review, labs follow-up, and lifestyle support.",
        img: "assets/img/services/chronic-care.jpg",
      },
      {
        id: "preventive-wellness",
        name: "Preventive Wellness Visit (At Home Visit)",
        price: 110.0,
        category: "Preventative",
        desc: "At-home visit focused on screenings review, lifestyle guidance, and health planning.",
        img: "assets/img/services/preventative.jpg",
      },
      {
        id: "telehealth",
        name: "Telehealth Quick Evaluation",
        price: 100.0,
        category: "Telehealth",
        desc: "Short virtual appointment for straightforward concerns or medication questions.",
        img: "assets/img/services/telehealth.jpg",
      },

      // Consults
      {
        id: "weight-loss",
        name: "Weight Loss Consultation",
        price: 50.0,
        category: "Weight Loss",
        desc: "Initial consult to discuss goals, eligibility, baseline labs, and a safe plan.",
        img: "assets/img/services/weight-loss.jpg",
        isConsult: true,
        qtyLabel: "Qty",
      },
      {
        id: "botox-consult",
        name: "Botox/Shot Consultation",
        price: 50.0,
        category: "Aesthetics",
        desc: "Consult to review goals, medical history, and plan.",
        img: "assets/img/services/botox.jpg",
        isConsult: true,
        qtyLabel: "Qty",
      },
      {
        id: "iv-consult",
        name: "IV Therapy Consultation",
        price: 35.0,
        category: "IV Therapy",
        desc: "Required for IV and wellness injection services. Review history, goals, and appropriate plan.",
        img: "assets/img/services/iv-therapy.jpg",
        isConsult: true,
        qtyLabel: "Qty",
      },

      // Dropdowns (require consult)
      {
        id: "shot-treatments",
        name: "Shot Treatments",
        price: 0.0,
        category: "Aesthetics",
        desc: "Choose a shot treatment from the dropdown. The selected option will be added to your cart.",
        img: "assets/img/services/shot-treatment.jpg",
        requiresConsult: true,
        consultId: "botox-consult",
        isDropdown: true,
        dropdownLabel: "Select a shot",
        options: SHOT_TREATMENTS,
      },
      {
        id: "iv-treatments",
        name: "IV Treatments",
        price: 0.0,
        category: "IV Therapy",
        desc: "Choose an IV treatment from the dropdown. The selected option will be added to your cart.",
        img: "assets/img/services/iv-treatment.jpg",
        requiresConsult: true,
        consultId: "iv-consult",
        isDropdown: true,
        dropdownLabel: "Select an IV treatment",
        options: IV_TREATMENTS,
      },
      {
        id: "weight-loss-semaglutide",
        name: "Weight Loss Treatment (Semaglutide)",
        price: 0.0,
        category: "Weight Loss",
        desc: "Choose a dosing option from the dropdown. The selected option will be added to your cart.",
        img: "assets/img/services/semaglutide.jpg",
        requiresConsult: true,
        consultId: "weight-loss",
        isDropdown: true,
        dropdownLabel: "Select semaglutide option",
        options: SEMAGLUTIDE,
      },
      {
        id: "weight-loss-tirzepatide",
        name: "Weight Loss Treatment (Tirzepatide)",
        price: 0.0,
        category: "Weight Loss",
        desc: "Choose a dosing option from the dropdown. The selected option will be added to your cart.",
        img: "assets/img/services/tirzepatide.jpg",
        requiresConsult: true,
        consultId: "weight-loss",
        isDropdown: true,
        dropdownLabel: "Select tirzepatide option",
        options: TIRZEPATIDE,
      },
    ];

    // ---- Cart helpers (use SAME storage as main cart)
    function loadCart() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    }
    function saveCart(cart) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    function addToCart(productId, qty = 1) {
      const p = PRODUCTS.find((x) => x.id === productId);
      if (!p || p.isDropdown) return;

      const cart = loadCart();
      if (!cart[productId]) {
        cart[productId] = {
          ...p,
          qty,
          qtyLabel: p.qtyLabel || "Qty",
        };
      } else {
        cart[productId].qty = (cart[productId].qty || 0) + qty;
      }
      saveCart(cart);
      window.STHW_cart?.render?.();
    }

    function addDropdownOption(parentProduct, opt) {
      const cart = loadCart();
      const optionId = `${parentProduct.id}::${opt.key}`;

      const lineItem = {
        id: optionId,
        name: `${parentProduct.name} — ${opt.name}`,
        price: opt.price,
        category: parentProduct.category,
        desc: parentProduct.desc,
        img: parentProduct.img,
        requiresConsult: !!parentProduct.requiresConsult,
        consultId: parentProduct.consultId || null,
        qtyLabel: "Qty",
      };

      if (!cart[optionId]) cart[optionId] = { ...lineItem, qty: 1 };
      else cart[optionId].qty = (cart[optionId].qty || 0) + 1;

      saveCart(cart);
      window.STHW_cart?.render?.();

      // Open cart drawer if it exists
      document.getElementById("cartFab")?.click?.();
    }

    // ---- Render Products
    function renderProducts() {
      productGrid.innerHTML = PRODUCTS.map((p) => {
        const consultBadge = p.isConsult ? `<span class="pill-note">Consult</span>` : "";
        const requiresBadge = p.requiresConsult ? `<span class="pill-note pill-requires">Requires consult</span>` : "";
        const minPrice = p.isDropdown ? Math.min(...p.options.map((o) => o.price)) : p.price;

        const dropdownUI = p.isDropdown
          ? `
            <div class="meta" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">
              <span class="price">From ${money(minPrice)}</span>
            </div>
            <div class="meta" style="gap:10px;flex-wrap:wrap;">
              <select class="dropdown" data-dd="${p.id}" aria-label="${p.dropdownLabel || "Select option"}"
                style="padding:10px 12px;border-radius:12px;border:1px solid rgba(15,23,42,.18);min-width:260px;max-width:100%;">
                <option value="">${p.dropdownLabel || "Select an option"}</option>
                ${p.options.map((opt) => `<option value="${opt.key}">${opt.name} — ${money(opt.price)}</option>`).join("")}
              </select>
              <button class="btn primary" type="button" data-dd-add="${p.id}">Add Selected</button>
            </div>
          `
          : `
            <div class="meta" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <span class="price">${money(p.price)}</span>
              <button class="btn primary" type="button" data-add="${p.id}">Add to Cart</button>
            </div>
          `;

        return `
          <article class="product-card" id="buy-${p.id}">
            <div class="img">
              <img src="${p.img}" alt="${p.name}"
                onerror="this.style.display='none'; this.parentElement.style.padding='22px'; this.parentElement.innerHTML='<div style=&quot;color:#0f172a;font-weight:900;text-align:center;line-height:1.3;&quot;>Add an image at:<br><span style=&quot;font-weight:800;color:#475569&quot;>${p.img}</span></div>';">
            </div>
            <div class="content">
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                <span class="tag">${p.category}</span>
                ${consultBadge}
                ${requiresBadge}
              </div>
              <h3>${p.name}</h3>
              <p>${p.desc}</p>
              ${dropdownUI}
            </div>
          </article>
        `;
      }).join("");

      // Click delegation
      productGrid.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-add]");
        if (btn) {
          addToCart(btn.getAttribute("data-add"), 1);
          document.getElementById("cartFab")?.click?.();
          return;
        }

        const ddBtn = e.target.closest("[data-dd-add]");
        if (ddBtn) {
          const pid = ddBtn.getAttribute("data-dd-add");
          const parent = PRODUCTS.find((x) => x.id === pid);
          if (!parent || !parent.isDropdown) return;

          const sel = productGrid.querySelector(`select[data-dd="${pid}"]`);
          const chosenKey = sel?.value || "";
          if (!chosenKey) {
            // If cartWarn exists on this page, show it; otherwise alert.
            const cartWarn = document.getElementById("cartWarn");
            if (cartWarn) {
              cartWarn.textContent = `Please choose an option for "${parent.name}" before adding to cart.`;
              cartWarn.classList.add("show");
              document.getElementById("cartFab")?.click?.();
            } else {
              alert(`Please choose an option for "${parent.name}" before adding to cart.`);
            }
            return;
          }

          const opt = parent.options.find((o) => o.key === chosenKey);
          if (!opt) return;

          addDropdownOption(parent, opt);
        }
      }, { passive: true });
    }

    renderProducts();
    window.STHW_cart?.render?.();
  });
})();
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("spRequestApptBtn");
  if (!btn) return;

  // Force normal navigation (same tab)
  btn.addEventListener("click", (e) => {
    // If any older code prevents default, undo that behavior by navigating manually
    if (btn.getAttribute("href") && btn.getAttribute("href") !== "#") {
      window.location.href = btn.getAttribute("href");
    }
  }, true);
});

document.addEventListener("DOMContentLoaded", function () {
  const dropdownToggle = document.querySelector(".has-dropdown > .dropdown-toggle");
  const dropdownItem = document.querySelector(".has-dropdown");

  if (dropdownToggle && dropdownItem) {
    dropdownToggle.addEventListener("click", function (e) {
      if (window.innerWidth <= 980) {
        e.preventDefault();
        dropdownItem.classList.toggle("open");
      }
    });
  }
});
