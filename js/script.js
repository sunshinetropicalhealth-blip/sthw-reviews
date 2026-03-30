/**
 * script.js — Sunshine Tropical Health & Wellness
 * Clean unified version
 *
 * Modules:
 * 1) Global UI (year, animations, hamburger, nav dropdown)
 * 2) EmailJS (general questions form)
 * 3) SimplePractice / portal link handling
 * 4) Cart (drawer UI + summary)
 * 5) Services catalog (services page only)
 * 6) Reviews page (approved reviews + review submission)
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

  function isMobileNav() {
    return window.matchMedia("(max-width: 980px)").matches;
  }

  function getSchedulingAnchor() {
    return document.getElementById("portal-section") || null;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // =========================================================
  // 0) GLOBAL UI
  // =========================================================
  (function globalUiModule() {
    document.addEventListener("DOMContentLoaded", () => {
      // Footer year
      const yearEl = document.getElementById("year");
      if (yearEl) yearEl.textContent = String(new Date().getFullYear());

      // Scroll animations
      const animated = Array.from(document.querySelectorAll(".animate"));
      if (animated.length) {
        if ("IntersectionObserver" in window) {
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
        } else {
          animated.forEach((el) => el.classList.add("active"));
        }
      }

      // Universal header/nav
      const hamburger = document.getElementById("hamburger");
      const navMenu = document.getElementById("nav-menu");
      const servicesItem = document.querySelector(".services-item");
      const servicesToggle = servicesItem
        ? servicesItem.querySelector(".dropdown-toggle")
        : null;

      const setHamburgerState = (open) => {
        if (!hamburger) return;
        hamburger.setAttribute("aria-expanded", String(open));
        hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };

      const closeServicesDropdown = () => {
        if (servicesItem) servicesItem.classList.remove("open");
        if (servicesToggle) servicesToggle.setAttribute("aria-expanded", "false");
      };

      const closeMobileMenu = () => {
        if (navMenu) navMenu.classList.remove("show");
        setHamburgerState(false);
        closeServicesDropdown();
      };

      if (hamburger && navMenu && !hamburger.dataset.bound) {
        hamburger.dataset.bound = "true";

        hamburger.addEventListener("click", () => {
          const isOpen = navMenu.classList.toggle("show");
          setHamburgerState(isOpen);

          if (!isOpen) closeServicesDropdown();
        });
      }

      if (servicesItem && servicesToggle && !servicesToggle.dataset.bound) {
        servicesToggle.dataset.bound = "true";

        servicesToggle.addEventListener("click", (e) => {
          if (isMobileNav()) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = servicesItem.classList.toggle("open");
            servicesToggle.setAttribute("aria-expanded", String(isOpen));
          } else if (servicesToggle.tagName.toLowerCase() === "button") {
            if (!document.body.classList.contains("services-page")) {
              window.location.href = "services.html";
            }
          }
        });
      }

      if (navMenu && !navMenu.dataset.linkCloseBound) {
        navMenu.dataset.linkCloseBound = "true";

  navMenu.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link) return;

  // ✅ DO NOT close if clicking inside services dropdown
  if (e.target.closest(".services-dropdown")) {
    return;
  }

  if (isMobileNav()) {
    closeMobileMenu();
  }
});
      }

      document.addEventListener("click", (e) => {
        if (
          isMobileNav() &&
          servicesItem &&
          servicesItem.classList.contains("open") &&
          !servicesItem.contains(e.target)
        ) {
          closeServicesDropdown();
        }
      });

      window.addEventListener("resize", () => {
        if (!isMobileNav()) {
          if (navMenu) navMenu.classList.remove("show");
          setHamburgerState(false);
          closeServicesDropdown();
        }
      });
    });
  })();

  // =========================================================
  // 1) EMAILJS — General Questions (Non-Medical)
  // Form: #appointmentForm
  // Expected field IDs inside form:
  // #from_name, #email, #phone, #message
  // Optional status element: #appointmentFormStatus
  // =========================================================
  (function emailJsModule() {
    const EMAILJS_PUBLIC_KEY = "--B-cjWXskc4CjE4o";
    const EMAILJS_SERVICE_ID = "service_9cf9h5s";
    const CLINIC_TEMPLATE_ID = "template_2u7g6eh";
    const AUTOREPLY_TEMPLATE_ID = "template_v6zbtzl";

    const RATE_LIMIT_MS = 2 * 60 * 1000;
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

    function setFormStatus(el, message, type) {
      if (!el) return;
      el.textContent = message || "";
      el.className = "";
      if (type) el.classList.add(type);
    }

    function getCartSummary() {
      const txt = safeTrim(localStorage.getItem(CART_SUMMARY_KEY));
      if (!txt) return "";
      return `\n\n---\nSERVICE SELECTION SUMMARY\n${txt}\n---\n`;
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
        message = `${message.slice(0, MAX_MESSAGE_CHARS)}…`;
      }

      const cartSummary = getCartSummary();
      if (cartSummary) message += cartSummary;

      return {
        from_name,
        email,
        reply_to: email,
        phone,
        message,
        page: window.location.href,
        submitted_at: new Date().toLocaleString(),
        subject_line: `Website Question from ${from_name || "Client"}`
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
        subject_line: "We received your message"
      };

      return window.emailjs.send(EMAILJS_SERVICE_ID, AUTOREPLY_TEMPLATE_ID, replyPayload);
    }

    document.addEventListener("DOMContentLoaded", () => {
      const form = $("#appointmentForm");
      if (!form) return;
      if (form.dataset.emailjsBound === "true") return;
      form.dataset.emailjsBound = "true";

      const statusEl = document.getElementById("appointmentFormStatus");

      ensureHoneypotField(form);

      if (typeof window.emailjs === "undefined") {
        console.warn("EmailJS library not loaded.");
        setFormStatus(statusEl, "The contact form is temporarily unavailable.", "error");
        return;
      }

      try {
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
      } catch (err) {
        console.error("EmailJS init failed:", err);
        setFormStatus(statusEl, "The contact form is temporarily unavailable.", "error");
        return;
      }

      const loadedAt = nowMs();

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        setFormStatus(statusEl, "", "");

        if (nowMs() - loadedAt < MIN_TIME_ON_PAGE_MS) {
          setFormStatus(statusEl, "Please wait a moment and try again.", "error");
          return;
        }

        const honey = safeTrim(form.querySelector('input[name="company_website"]')?.value);
        if (honey) {
          form.reset();
          setFormStatus(statusEl, "Message sent successfully! We’ll get back to you soon.", "success");
          return;
        }

        if (isRateLimited()) {
          setFormStatus(statusEl, "Please wait a minute before sending another message.", "error");
          return;
        }

        const payload = buildPayload(form);

        if (!payload.from_name || !payload.email) {
          setFormStatus(statusEl, "Please enter your full name and email.", "error");
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
          setFormStatus(statusEl, "Please enter a valid email address.", "error");
          return;
        }

        if (!payload.message) {
          setFormStatus(statusEl, "Please enter your message.", "error");
          return;
        }

        setBtnLoading(submitBtn, true);

        try {
          setRateLimitStamp();
          await sendClinicEmail(payload);

          try {
            await sendAutoReply(payload);
          } catch (_) {
            // ignore auto-reply failure
          }

          form.reset();
          setFormStatus(statusEl, "Message sent successfully! We’ll get back to you soon.", "success");
        } catch (err) {
          console.error("EmailJS send error:", err);
          localStorage.removeItem(STORAGE_RATE_KEY);
          setFormStatus(
            statusEl,
            "Message failed to send. Please try again or email us directly.",
            "error"
          );
        } finally {
          setBtnLoading(submitBtn, false);
        }
      });
    });
  })();

  // =========================================================
  // 2) SIMPLEPRACTICE / PORTAL LINKS
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

      preventNavigateForWidgetAnchor(btn);

      if (!window.spwidget) {
        const ok = await loadSimplePracticeScript();
        if (!ok || !window.spwidget) return false;
      }

      btn.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
      return true;
    }

    window.STHW_openAppointmentWidget = () => {
      const directPortalLink = document.getElementById("spRequestApptBtn");
      if (
        directPortalLink &&
        directPortalLink.href &&
        !directPortalLink.dataset.spwidgetContact &&
        !directPortalLink.hasAttribute("data-spwidget-contact")
      ) {
        window.location.href = directPortalLink.href;
        return Promise.resolve(true);
      }
      return openSPWidgetById("spRequestApptBtn");
    };

    window.STHW_openContactWidget = () => openSPWidgetById("spContactBtn");

    document.addEventListener("DOMContentLoaded", () => {
      const oarBtn = document.getElementById("spRequestApptBtn");
      const contactBtn = document.getElementById("spContactBtn");

      if (
        oarBtn &&
        (oarBtn.dataset.spwidgetContact || oarBtn.hasAttribute("data-spwidget-contact"))
      ) {
        preventNavigateForWidgetAnchor(oarBtn);
      }

      if (contactBtn) {
        preventNavigateForWidgetAnchor(contactBtn);
      }

      const openContactBtn = document.getElementById("openContactWidgetBtn");
      if (openContactBtn && !openContactBtn.dataset.bound) {
        openContactBtn.dataset.bound = "true";
        openContactBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.STHW_openContactWidget();
        });
      }

      if (
        contactBtn ||
        (oarBtn && (oarBtn.dataset.spwidgetContact || oarBtn.hasAttribute("data-spwidget-contact")))
      ) {
        loadSimplePracticeScript();
      }
    });
  })();

  // =========================================================
  // 3) CART
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

    function renderCheckoutSummaryCard() {
      const cartHelper = document.getElementById("cartPasteHelper");
      const list = document.getElementById("cartSummaryList");
      const totalEl = document.getElementById("cartSummaryTotal");
      const pre = document.getElementById("cartSummaryPre");

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
                <p class="name">${escapeHtml(it.name)}</p>
                <p class="meta">${metaParts.map(escapeHtml).join(" • ")}</p>
              </div>
              <div class="price">${money((it.price || 0) * (it.qty || 0))}</div>
            </div>
          `;
        })
        .join("");

      totalEl.textContent = money(cartPriceTotal(cart));
      const txt = cartToText(cart);
      pre.textContent = txt;
      localStorage.setItem(SUMMARY_KEY, txt);
    }

    function renderCartUI() {
      const cartFab = $("#cartFab");
      const cartCount = $("#cartCount");
      const cartItems = $("#cartItems");
      const cartTotalEl = $("#cartTotal");
      const cartWarn = $("#cartWarn");

      if (!cartCount || !cartItems) {
        renderCheckoutSummaryCard();
        return;
      }

      const cart = loadCart();
      const items = Object.values(cart);

      cartCount.textContent = String(cartQtyTotal(cart));
      if (cartTotalEl) cartTotalEl.textContent = money(cartPriceTotal(cart));

      const summaryText = cartToText(cart);
      localStorage.setItem(SUMMARY_KEY, summaryText);

      renderCheckoutSummaryCard();

      if (cartWarn) cartWarn.classList.remove("show");

      if (!items.length) {
        cartItems.innerHTML = `
          <div style="padding:10px;color:#475569;line-height:1.5;">
            Your cart is empty. Add a service on the Services page to continue.
          </div>
        `;
        if (cartFab && document.body.classList.contains("home-page")) {
          cartFab.style.display = "none";
        }
        return;
      }

      cartItems.innerHTML = items
        .map((item) => {
          const label = item.qtyLabel || "Qty";
          return `
            <div class="cart-item" data-id="${escapeHtml(item.id)}">
              <div class="row">
                <strong style="color:#0f172a">${escapeHtml(item.name)}</strong>
                <span style="font-weight:1000;color:#008080">${money(item.price)}</span>
              </div>
              <div class="row">
                <span style="color:#475569;font-size:.92rem;">
                  ${escapeHtml(item.category || "")}${item.requiresConsult ? " • Requires consult" : ""}${item.isConsult ? " • Consult" : ""}
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

      if (cartFab && document.body.classList.contains("home-page")) {
        cartFab.style.display = "none";
      }
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

    async function copyToClipboard(text) {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        try {
          const pre = document.getElementById("cartSummaryPre");
          if (!pre) return false;
          pre.textContent = text;

          const range = document.createRange();
          range.selectNodeContents(pre);
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

      renderCartUI();

      if (cartFab && !cartFab.dataset.bound) {
        cartFab.dataset.bound = "true";
        cartFab.addEventListener("click", () => {
          renderCartUI();
          openCartUI();
        });
      }

      cartOverlay?.addEventListener("click", closeCartUI);
      closeCartBtn?.addEventListener("click", closeCartUI);

      cartItems?.addEventListener("click", (e) => {
        const wrap = e.target.closest(".cart-item");
        if (!wrap) return;
        const id = wrap.getAttribute("data-id");
        if (!id) return;

        if (e.target.matches("[data-inc]")) changeQty(id, +1);
        if (e.target.matches("[data-dec]")) changeQty(id, -1);
        if (e.target.closest("[data-remove]")) removeItem(id);
      });

      clearCartBtn?.addEventListener("click", clearCart);

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
                ? "✅ Service summary copied. Paste it into the secure portal if prompted."
                : "⚠️ Copy may be blocked by your browser. Your selected services are still shown on this page.";
            }
          },
          { passive: true }
        );
      }

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
            cartWarn.textContent =
              "Please select at least one service before submitting your request.";
            cartWarn.classList.add("show");
          }
          return;
        }

        if (cartWarn) cartWarn.classList.remove("show");
        localStorage.setItem(SUMMARY_KEY, cartToText(cart));

        closeCartUI();

        const portalLink = document.getElementById("spRequestApptBtn");
        if (portalLink && portalLink.href) {
          window.location.href = portalLink.href;
          return;
        }

        getSchedulingAnchor()?.scrollIntoView({ behavior: "smooth", block: "start" });

        setTimeout(() => {
          if (typeof window.STHW_openAppointmentWidget === "function") {
            window.STHW_openAppointmentWidget();
          }
        }, 250);
      });
    });

    window.STHW_cart = {
      load: loadCart,
      save: saveCart,
      render: renderCartUI,
      open: openCartUI,
      close: closeCartUI
    };
  })();

  // =========================================================
  // 4) SERVICES CATALOG (only runs on Services page)
  // =========================================================
  (function servicesCatalogModule() {
    const STORAGE_KEY = "sth_cart_v1";

    document.addEventListener("DOMContentLoaded", () => {
      const productGrid = document.getElementById("product-grid");
      if (!productGrid) return;

      const SHOT_TREATMENTS = [
        { key: "B12", name: "Vitamin B12", price: 20.0 },
        { key: "NAD-Injection", name: "NAD +", price: 350.0 },
        { key: "NAD-Glutathione", name: "NAD + Glutathione", price: 400.0 },
        { key: "Odansetron", name: "Odansetron", price: 30.0 },
        { key: "Vitamin-D", name: "Vitamin D", price: 50.0 },
        { key: "Lipostat-plus", name: "Lipostat Plus", price: 220.0 },
        { key: "Lipominus-injection", name: "Lipominus mix", price: 220.0 },
        { key: "Lipominus-Mix-C", name: "Lipominus mix-C", price: 220.0 },
        { key: "Additional-Vitamins", name: "Additional Vitamins", price: 50.0 }
      ];

      const IV_TREATMENTS = [
        { key: "Wellness-immunity", name: "Wellness & Immunity", price: 200.0 },
        { key: "Fat-blast", name: "Fat Blast", price: 150.0 },
        { key: "Hangover", name: "Hangover", price: 250.0 },
        { key: "Glow-beauty", name: "Glow Beauty", price: 200.0 },
        { key: "Libido-performance", name: "Libido & Performance", price: 250.0 },
        { key: "Vitamin-reboot", name: "Vitamin Reboot", price: 100.0 }
      ];

      const SEMAGLUTIDE = [
        { key: "sema-0-25-4wk", name: "Initial dose - (4 weeks)", price: 200.0 },
        { key: "sema-0-5-4wk", name: "Intermediate dose - (4 weeks)", price: 280.0 },
        { key: "sema-1-4wk", name: "Highest dose - (4 weeks)", price: 300.0 }
      ];

      const TIRZEPATIDE = [
        { key: "tirz-2-5-4wk", name: "Initial dose - (4 weeks)", price: 325.0 },
        { key: "tirz-5-4wk", name: "Intermediate dose - (4 weeks)", price: 430.0 },
        { key: "tirz-7-5-4wk", name: "Highest dose - (4 weeks)", price: 560.0 }
      ];

      const PRODUCTS = [
        {
          id: "primary-care",
          name: "Primary Care Visit (Only Telehealth at this moment)",
          price: 100.0,
          category: "Primary Care",
          desc: "Initial primary care visit for common concerns, labs follow-up and care planning.",
          img: "assets/img/services/primary-care.jpg"
        },
        {
          id: "chronic-condition",
          name: "Chronic Condition Management",
          price: 150.0,
          category: "Chronic Care",
          desc: "Condition monitoring, medication review, labs follow-up, and general health maintenance.",
          img: "assets/img/services/chronic-care.jpg"
        },
        {
          id: "preventive-wellness",
          name: "Routine & Sick (At-home visit)",
          price: 110.0,
          category: "At-Home Visit",
          desc: "In-home consultation focused on screening review, lifestyle guidance, vital signs assessment, and personalized health planning.",
          img: "assets/img/services/preventative.jpg"
        },
        {
          id: "telehealth",
          name: "Telehealth Express Visit",
          price: 100.0,
          category: "Telehealth",
          desc: "Short virtual appointment for sick visits, minor medical issues, or medication questions.",
          img: "assets/img/services/telehealth.jpg"
        },
        {
          id: "weight-loss",
          name: "Weight Loss Consultation",
          price: 50.0,
          category: "Weight Loss",
          desc: "Initial consult to review health history, discuss weight management goals, baseline labs and a safe personalized treatment plan.",
          img: "assets/img/services/weight-loss.jpg",
          isConsult: true,
          qtyLabel: "Qty"
        },
        {
          id: "botox-consult",
          name: "Wellness-Injection Consultation",
          price: 35.0,
          category: "Wellness",
          desc: "Initial consult required for wellness injection services. Review history, goals, and appropriate plan.",
          img: "assets/img/services/botox.jpg",
          isConsult: true,
          qtyLabel: "Qty"
        },
        {
          id: "iv-consult",
          name: "IV Nutrition Therapy Consultation",
          price: 35.0,
          category: "IV Nutrition",
          desc: "Initial consult required for IV nutrition therapy. Review history, goals, and appropriate plan.",
          img: "assets/img/services/iv-therapy.jpg",
          isConsult: true,
          qtyLabel: "Qty"
        },
        {
          id: "shot-treatments",
          name: "Wellness Injection",
          price: 0.0,
          category: "Wellness",
          desc: "Choose a shot treatment from the dropdown. The selected option will be added to your cart.",
          img: "assets/img/services/shot-treatment.jpg",
          requiresConsult: true,
          consultId: "botox-consult",
          isDropdown: true,
          dropdownLabel: "Select a shot treatment",
          options: SHOT_TREATMENTS
        },
        {
          id: "iv-treatments",
          name: "IV Nutrition Therapy",
          price: 0.0,
          category: "IV Nutrition",
          desc: "Choose an IV treatment from the dropdown. The selected option will be added to your cart.",
          img: "assets/img/services/iv-treatment.jpg",
          requiresConsult: true,
          consultId: "iv-consult",
          isDropdown: true,
          dropdownLabel: "Select an IV treatment",
          options: IV_TREATMENTS
        },
        {
          id: "weight-loss-Semaglutide",
          name: "Weight Loss Treatment (Semaglutide)",
          price: 0.0,
          category: "Weight Loss",
          desc: "Choose a dosing option from the dropdown. The selected option will be added to your cart.",
          img: "assets/img/services/semaglutide.jpg",
          requiresConsult: true,
          consultId: "weight-loss",
          isDropdown: true,
          dropdownLabel: "Select Semaglutide option",
          options: SEMAGLUTIDE
        },
        {
          id: "weight-loss-Tirzepatide",
          name: "Weight Loss Treatment (Tirzepatide)",
          price: 0.0,
          category: "Weight Loss",
          desc: "Choose a dosing option from the dropdown. The selected option will be added to your cart.",
          img: "assets/img/services/tirzepatide.jpg",
          requiresConsult: true,
          consultId: "weight-loss",
          isDropdown: true,
          dropdownLabel: "Select Tirzepatide option",
          options: TIRZEPATIDE
        }
      ];

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
        const product = PRODUCTS.find((p) => p.id === productId);
        if (!product || product.isDropdown) return;

        const cart = loadCart();
        if (!cart[productId]) {
          cart[productId] = {
            ...product,
            qty,
            qtyLabel: product.qtyLabel || "Qty"
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
          qtyLabel: "Qty"
        };

        if (!cart[optionId]) {
          cart[optionId] = { ...lineItem, qty: 1 };
        } else {
          cart[optionId].qty = (cart[optionId].qty || 0) + 1;
        }

        saveCart(cart);
        window.STHW_cart?.render?.();
        window.STHW_cart?.open?.();
      }

      function renderProducts() {
        productGrid.innerHTML = PRODUCTS.map((p) => {
          const consultBadge = p.isConsult ? `<span class="pill-note">Consult</span>` : "";
          const requiresBadge = p.requiresConsult
            ? `<span class="pill-note pill-requires">Requires consult</span>`
            : "";
          const minPrice = p.isDropdown ? Math.min(...p.options.map((o) => o.price)) : p.price;

          const actionUI = p.isDropdown
            ? `
              <div class="meta meta-dropdown">
                <span class="price">From ${money(minPrice)}</span>
                <select class="dropdown" data-dd="${p.id}" aria-label="${escapeHtml(
                p.dropdownLabel || "Select option"
              )}">
                  <option value="">${escapeHtml(p.dropdownLabel || "Select an option")}</option>
                  ${p.options
                    .map(
                      (opt) =>
                        `<option value="${escapeHtml(opt.key)}">${escapeHtml(opt.name)} — ${money(opt.price)}</option>`
                    )
                    .join("")}
                </select>
                <button class="btn primary" type="button" data-dd-add="${p.id}">Add Selected</button>
              </div>
            `
            : `
              <div class="meta meta-actions">
                <span class="price">${money(p.price)}</span>
                <button class="btn primary" type="button" data-add="${p.id}">Add to Cart</button>
              </div>
            `;

          return `
            <article class="product-card" id="buy-${p.id}">
              <div class="img">
                <img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}"
                  onerror="this.style.display='none'; this.parentElement.style.padding='22px'; this.parentElement.innerHTML='<div style=&quot;color:#0f172a;font-weight:900;text-align:center;line-height:1.3;&quot;>Add an image at:<br><span style=&quot;font-weight:800;color:#475569&quot;>${escapeHtml(
                    p.img
                  )}</span></div>';">
              </div>
              <div class="content">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                  <span class="tag">${escapeHtml(p.category)}</span>
                  ${consultBadge}
                  ${requiresBadge}
                </div>
                <h3>${escapeHtml(p.name)}</h3>
                <p>${escapeHtml(p.desc)}</p>
                ${actionUI}
              </div>
            </article>
          `;
        }).join("");

        if (!productGrid.dataset.bound) {
          productGrid.dataset.bound = "true";

          productGrid.addEventListener("click", (e) => {
            const addBtn = e.target.closest("[data-add]");
            if (addBtn) {
              addToCart(addBtn.getAttribute("data-add"), 1);
              window.STHW_cart?.open?.();
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
                const cartWarn = document.getElementById("cartWarn");
                if (cartWarn) {
                  cartWarn.textContent = `Please choose an option for "${parent.name}" before adding to cart.`;
                  cartWarn.classList.add("show");
                } else {
                  alert(`Please choose an option for "${parent.name}" before adding to cart.`);
                }
                window.STHW_cart?.open?.();
                return;
              }

              const opt = parent.options.find((o) => o.key === chosenKey);
              if (!opt) return;

              addDropdownOption(parent, opt);
            }
          });
        }
      }

      function jumpToHashTarget(hash) {
        if (!hash || !hash.startsWith("#buy-")) return;
        const el = document.querySelector(hash);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      document.querySelectorAll('a.service-jump[href^="#buy-"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const hash = a.getAttribute("href");
          renderProducts();
          if (history.pushState) history.pushState(null, "", hash);
          setTimeout(() => jumpToHashTarget(hash), 30);
        });
      });

      renderProducts();
      window.STHW_cart?.render?.();
      setTimeout(() => jumpToHashTarget(window.location.hash), 30);
    });
  })();

  // =========================================================
  // 5) REVIEWS PAGE
  // =========================================================
  (function reviewsModule() {
    document.addEventListener("DOMContentLoaded", () => {
      const approvedReviewsList = document.getElementById("approvedReviewsList");
      const reviewForm = document.getElementById("reviewForm");
      const reviewFormStatus = document.getElementById("reviewFormStatus");
      const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");

      const SUPABASE_URL = "https://qdysdamxttccpgetscai.supabase.co";
      const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3FkeXNkYW14dHRjY3BnZXRzY2FpLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJyZWYiOiJxZHlzZGFteHR0Y2NwZ2V0c2NhaSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzczMTYyMTU0LCJleHAiOjIwODg3MzgxNTR9.0w-9JyX9AMkWoCQ7LYuIeIdEH3Vx1XDGaglmDCOI8k8";

      const supabaseLib = window.supabase;
      const supabaseClient = supabaseLib
        ? supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

      function renderStars(rating) {
        const count = Math.max(0, Math.min(5, Number(rating || 0)));
        return "★".repeat(count) + "☆".repeat(5 - count);
      }

      async function loadApprovedReviews() {
        if (!approvedReviewsList) return;

        if (!supabaseClient) {
          approvedReviewsList.innerHTML = `
            <div class="review-loading-card">
              Approved feedback will appear here once available.
            </div>
          `;
          return;
        }

        try {
          const { data, error } = await supabaseClient
            .from("reviews")
            .select("review_name, review_relationship, review_title, review_message, rating, approved_at")
            .eq("approved", true)
            .eq("rejected", false)
            .order("approved_at", { ascending: false });

          if (error) {
            console.error("Error loading approved reviews:", error);
            approvedReviewsList.innerHTML = `
              <div class="review-loading-card">
                We were unable to load approved feedback at this time.
              </div>
            `;
            return;
          }

          if (!data || !data.length) {
            approvedReviewsList.innerHTML = `
              <div class="review-loading-card">
                Approved feedback will appear here once available.
              </div>
            `;
            return;
          }

          approvedReviewsList.innerHTML = data
            .map(
              (review) => `
              <article class="approved-review-card">
                <div class="approved-review-badge">Verified Patient Feedback</div>
                <div class="approved-review-stars">${renderStars(review.rating)}</div>
                <h4 class="approved-review-title">${escapeHtml(review.review_title)}</h4>
                <p class="approved-review-meta">
                  ${escapeHtml(review.review_name)}${
                    review.review_relationship ? " • " + escapeHtml(review.review_relationship) : ""
                  }
                </p>
                <p class="approved-review-message">${escapeHtml(review.review_message)}</p>
              </article>
            `
            )
            .join("");
        } catch (err) {
          console.error("Unexpected approved reviews error:", err);
          approvedReviewsList.innerHTML = `
            <div class="review-loading-card">
              We were unable to load approved feedback at this time.
            </div>
          `;
        }
      }

      if (reviewForm && !reviewForm.dataset.bound) {
        reviewForm.dataset.bound = "true";

        reviewForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const getVal = (name) =>
            reviewForm.querySelector(`[name="${name}"]`)?.value.trim() || "";

          const getChecked = (name) =>
            !!reviewForm.querySelector(`[name="${name}"]`)?.checked;

          const review_name = getVal("review_name");
          const review_email = getVal("review_email");
          const review_relationship = getVal("review_relationship");
          const review_title = getVal("review_title");
          const review_message = getVal("review_message");
          const rating = Number(getVal("review_rating") || 0);
          const review_consent_moderation = getChecked("review_consent_moderation");
          const review_consent_privacy = getChecked("review_consent_privacy");
          const review_consent_publish = getChecked("review_consent_publish");
          const website = getVal("website");

          if (reviewFormStatus) {
            reviewFormStatus.className = "review-form-status";
            reviewFormStatus.textContent = "";
          }

          if (
            !review_name ||
            !review_email ||
            !review_relationship ||
            !review_title ||
            !review_message
          ) {
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent = "Please complete all required fields.";
            }
            return;
          }

          if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent = "Please select a valid rating.";
            }
            return;
          }

          if (
            !review_consent_moderation ||
            !review_consent_privacy ||
            !review_consent_publish
          ) {
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent = "Please agree to all required consent statements.";
            }
            return;
          }

          if (website !== "") {
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent = "Spam detected.";
            }
            return;
          }

          if (review_message.length < 20) {
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent =
                "Please enter at least 20 characters in your review.";
            }
            return;
          }

          const blockedWords = [
            "bitcoin",
            "crypto",
            "loan",
            "casino",
            "viagra",
            "http://",
            "https://",
            "www."
          ];

          const lowerMessage = review_message.toLowerCase();
          const lowerTitle = review_title.toLowerCase();
          const lowerName = review_name.toLowerCase();
          const lowerEmail = review_email.toLowerCase();

          const hasBlockedWord =
            blockedWords.some((word) => lowerMessage.includes(word)) ||
            blockedWords.some((word) => lowerTitle.includes(word)) ||
            blockedWords.some((word) => lowerName.includes(word)) ||
            blockedWords.some((word) => lowerEmail.includes(word));

          if (hasBlockedWord) {
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent = "Your review contains blocked content.";
            }
            return;
          }

          if (reviewSubmitBtn) {
            reviewSubmitBtn.disabled = true;
            reviewSubmitBtn.textContent = "Submitting...";
          }

          const payload = {
            review_name,
            review_email,
            review_relationship,
            review_title,
            review_message,
            rating,
            review_consent_moderation,
            review_consent_privacy,
            review_consent_publish,
            website
          };

          try {
            const response = await fetch("/.netlify/functions/submit-review", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
            });

            const raw = await response.text();
            let result = {};

            try {
              result = raw ? JSON.parse(raw) : {};
            } catch {
              result = { error: raw || "Submission failed." };
            }

            if (!response.ok) {
              throw new Error(result.error || "Submission failed.");
            }

            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status success";
              reviewFormStatus.textContent =
                "Thank you. Your feedback has been submitted for provider review.";
            }

            reviewForm.reset();
          } catch (error) {
            console.error("Review submission error:", error);
            if (reviewFormStatus) {
              reviewFormStatus.className = "review-form-status error";
              reviewFormStatus.textContent =
                error.message ||
                "We were unable to submit your feedback at this time. Please try again later.";
            }
          } finally {
            if (reviewSubmitBtn) {
              reviewSubmitBtn.disabled = false;
              reviewSubmitBtn.textContent = "Submit Feedback for Review";
            }
          }
        });
      }

      loadApprovedReviews();
    });
  })();
})();

