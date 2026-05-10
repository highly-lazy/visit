/* ═══════════════════════════════════════════════════════════════
   BSI Business Portal — Application Script
   Architecture: Modules → State → Init
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTS
     ───────────────────────────────────────────── */
  const STORAGE_KEYS = {
    LANG:  'bsi.lang',
    THEME: 'bsi.theme'
  };

  const SUPPORTED_LANGS = ['uz', 'en', 'ru'];
  const DEFAULT_LANG    = 'uz';
  const DEFAULT_THEME   = 'dark';

  const CAT_ICONS = {
    Industrial: '🏭', Automotive: '🚗', Engineering: '⚙️',
    Finance: '💰',    Technology: '💻', Trade: '📦', Energy: '⚡',
    Salt: '🧂',       Tourism: '🏙️',   Ecology: '♻️', Municipal: '🧹',
    Construction: '🏗️', Food: '🍽️',  Textile: '🧵', Government: '🏛️'
  };

  /* ─────────────────────────────────────────────
     STATE
     ───────────────────────────────────────────── */
  const state = {
    lang:       DEFAULT_LANG,
    theme:      DEFAULT_THEME,
    activeCat:  'all',
    search:     '',
    sortBy:     'name',
    companies:  [],
    i18n:       {}
  };

  /* ─────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────── */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const debounce = (fn, ms = 200) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  };

  const safeStorage = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    }
  };

  const toast = (() => {
    let timer;
    return (msg, { type = 'info', duration = 3000 } = {}) => {
      const el = $('#toast');
      if (!el) { alert(msg); return; }
      el.textContent = msg;
      el.classList.toggle('toast--error', type === 'error');
      el.classList.add('is-shown');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('is-shown'), duration);
    };
  })();

  /* ─────────────────────────────────────────────
     DATA LOADING
     ───────────────────────────────────────────── */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function loadAllData() {
    const [i18n, companies] = await Promise.all([
      loadJSON('assets/data/i18n.json'),
      loadJSON('assets/data/companies.json')
    ]);
    state.i18n = i18n;
    state.companies = companies;
  }

  /* ─────────────────────────────────────────────
     THEME
     ───────────────────────────────────────────── */
  const Theme = {
    init() {
      const saved = safeStorage.get(STORAGE_KEYS.THEME);
      const prefers = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      this.set(saved || prefers || DEFAULT_THEME, false);

      $('#theme-toggle')?.addEventListener('click', () => this.toggle());
    },
    set(theme, save = true) {
      state.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      if (save) safeStorage.set(STORAGE_KEYS.THEME, theme);

      const btn = $('#theme-toggle');
      if (btn) {
        const t = state.i18n?.[state.lang]?.nav;
        btn.setAttribute('aria-label', theme === 'dark' ? (t?.themeLight ?? 'Light mode') : (t?.themeDark ?? 'Dark mode'));
      }
    },
    toggle() {
      this.set(state.theme === 'dark' ? 'light' : 'dark');
    }
  };

  /* ─────────────────────────────────────────────
     LANGUAGE / I18N
     ───────────────────────────────────────────── */
  const I18n = {
    init() {
      const saved = safeStorage.get(STORAGE_KEYS.LANG);
      const browser = (navigator.language || '').slice(0, 2).toLowerCase();
      const lang = SUPPORTED_LANGS.includes(saved) ? saved
                 : SUPPORTED_LANGS.includes(browser) ? browser
                 : DEFAULT_LANG;
      this.set(lang, false);

      $$('.lang__btn').forEach(btn => {
        btn.addEventListener('click', () => this.set(btn.dataset.lang));
      });
    },
    t(path) {
      const parts = path.split('.');
      let cur = state.i18n[state.lang];
      for (const p of parts) {
        if (cur == null) return '';
        cur = cur[p];
      }
      return cur ?? '';
    },
    set(lang, save = true) {
      if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
      state.lang = lang;
      document.documentElement.lang = lang;
      if (save) safeStorage.set(STORAGE_KEYS.LANG, lang);

      $$('.lang__btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.lang === lang);
        b.setAttribute('aria-pressed', b.dataset.lang === lang);
      });

      this.applyAll();
    },
    applyAll() {
      const T = state.i18n[state.lang];
      if (!T) return;

      // <title> + meta description
      document.title = T.meta.title;
      const metaDesc = $('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', T.meta.description);

      // [data-i18n] -> textContent
      $$('[data-i18n]').forEach(el => {
        const v = this.t(el.dataset.i18n);
        if (typeof v === 'string') el.textContent = v;
      });
      // [data-i18n-html] -> innerHTML (for pre-vetted markup)
      $$('[data-i18n-html]').forEach(el => {
        const v = this.t(el.dataset.i18nHtml);
        if (typeof v === 'string') el.innerHTML = v;
      });
      // [data-i18n-attr="attr:key"]
      $$('[data-i18n-attr]').forEach(el => {
        const pairs = el.dataset.i18nAttr.split(',');
        pairs.forEach(pair => {
          const [attr, key] = pair.split(':').map(s => s.trim());
          const v = this.t(key);
          if (typeof v === 'string') el.setAttribute(attr, v);
        });
      });

      // Hero pills (array)
      const pillsWrap = $('#hero-pills');
      if (pillsWrap && Array.isArray(T.hero.pills)) {
        pillsWrap.innerHTML = T.hero.pills.map(p =>
          `<div class="hero__pill">${escapeHtml(p)}</div>`
        ).join('');
      }

      // Stats
      const statsWrap = $('#stats');
      if (statsWrap && Array.isArray(T.about.stats)) {
        statsWrap.innerHTML = T.about.stats.map((s, i) => `
          <div class="stat reveal">
            <span class="stat__num" data-target="${s.target}" data-counted="0">0</span>
            <div class="stat__lbl">${escapeHtml(s.label)}</div>
          </div>
        `).join('');
        // re-observe
        statsWrap.querySelectorAll('.reveal').forEach(el => observer.observe(el));
      }

      // Projects
      const projWrap = $('#projects-grid');
      if (projWrap && Array.isArray(T.projects.items)) {
        projWrap.innerHTML = T.projects.items.map(p => {
          const tagsHtml = p.tags.map(t => `<span class="project__tag">${escapeHtml(t)}</span>`).join('');
          if (p.featured) {
            return `
              <article class="project project--featured reveal">
                <div>
                  <div class="project__lbl">${escapeHtml(p.label)}</div>
                  <div class="project__icon">${escapeHtml(p.icon)}</div>
                  <h3 class="project__name">${escapeHtml(p.name)}</h3>
                  <p class="project__desc">${escapeHtml(p.desc)}</p>
                  <div class="project__tags">${tagsHtml}</div>
                  <a class="project__link" href="#companies">${escapeHtml(T.projects.viewPartners)} →</a>
                </div>
                <div class="project__visual" aria-hidden="true">${escapeHtml(p.visual ?? '🏢')}</div>
              </article>
            `;
          }
          return `
            <article class="project reveal">
              <div class="project__icon">${escapeHtml(p.icon)}</div>
              <div class="project__lbl">${escapeHtml(p.label)}</div>
              <h3 class="project__name">${escapeHtml(p.name)}</h3>
              <p class="project__desc">${escapeHtml(p.desc)}</p>
              <div class="project__tags">${tagsHtml}</div>
              <a class="project__link" href="#companies">${escapeHtml(T.projects.more)} →</a>
            </article>
          `;
        }).join('');
        projWrap.querySelectorAll('.reveal').forEach(el => observer.observe(el));
      }

      // Sort options
      const sortSel = $('#sort');
      if (sortSel) {
        sortSel.innerHTML = `
          <option value="name">${escapeHtml(T.companies.sort.name)}</option>
          <option value="country">${escapeHtml(T.companies.sort.country)}</option>
          <option value="founded">${escapeHtml(T.companies.sort.founded)}</option>
        `;
        sortSel.value = state.sortBy;
      }

      // Theme toggle aria-label
      const tBtn = $('#theme-toggle');
      if (tBtn) tBtn.setAttribute('aria-label', state.theme === 'dark' ? T.nav.themeLight : T.nav.themeDark);

      // Companies UI
      Companies.buildCategories();
      Companies.render();
    }
  };

  /* ─────────────────────────────────────────────
     HEADER / NAV
     ───────────────────────────────────────────── */
  const Header = {
    init() {
      const header = $('#header');
      const sectionIds = ['home', 'about', 'projects', 'companies', 'contact'];

      const onScroll = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 40);

        let current = 'home';
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top < 120) current = id;
        }
        $$('.nav__link').forEach(l => {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + current);
        });
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      // Mobile menu
      const ham = $('#hamburger');
      const menu = $('#mobile-menu');
      ham?.addEventListener('click', () => {
        const open = menu.classList.toggle('is-open');
        ham.classList.toggle('is-open', open);
        ham.setAttribute('aria-expanded', open);
        document.body.style.overflow = open ? 'hidden' : '';
      });
      $$('#mobile-menu .nav__link').forEach(l => {
        l.addEventListener('click', () => {
          menu.classList.remove('is-open');
          ham.classList.remove('is-open');
          ham.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        });
      });
    }
  };

  /* ─────────────────────────────────────────────
     COMPANIES
     ───────────────────────────────────────────── */
  const ITEMS_PER_PAGE = 12;

  const Companies = {
    currentPage: 1,

    init() {
      $('#search')?.addEventListener('input', debounce((e) => {
        state.search = e.target.value.toLowerCase().trim();
        this.currentPage = 1;
        this.render();
      }, 150));

      $('#sort')?.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    },

    buildCategories() {
      const T = state.i18n[state.lang];
      const counts = { all: state.companies.length };
      state.companies.forEach(c => {
        counts[c.category] = (counts[c.category] || 0) + 1;
      });

      const tabs = $('#cats');
      if (!tabs) return;
      const allLabel = T.companies.all;
      const catsTrans = T.companies.categories || {};

      tabs.innerHTML = `
        <button class="cat ${state.activeCat === 'all' ? 'is-active' : ''}" data-cat="all" type="button">
          <span class="cat__icon">🌐</span>${escapeHtml(allLabel)}
          <span class="cat__count">${counts.all}</span>
        </button>
      ` + Object.keys(counts).filter(k => k !== 'all').map(cat => {
        const label = catsTrans[cat] || cat;
        return `
          <button class="cat ${state.activeCat === cat ? 'is-active' : ''}" data-cat="${escapeHtml(cat)}" type="button">
            <span class="cat__icon">${escapeHtml(CAT_ICONS[cat] || '📋')}</span>${escapeHtml(label)}
            <span class="cat__count">${counts[cat]}</span>
          </button>
        `;
      }).join('');

      tabs.querySelectorAll('.cat').forEach(btn => {
        btn.addEventListener('click', () => {
          state.activeCat = btn.dataset.cat;
          this.currentPage = 1;
          tabs.querySelectorAll('.cat').forEach(b => b.classList.toggle('is-active', b === btn));
          this.render();
        });
      });
    },

    filter() {
      const q = state.search;
      const T = state.i18n[state.lang];
      let list = state.companies.filter(c => {
        if (state.activeCat !== 'all' && c.category !== state.activeCat) return false;
        if (!q) return true;
        const desc = (c.desc[state.lang] || c.desc.en || '').toLowerCase();
        const country = (c.country[state.lang] || c.country.en || '').toLowerCase();
        const industry = (c.industry[state.lang] || c.industry.en || '').toLowerCase();
        return c.name.toLowerCase().includes(q)
            || country.includes(q)
            || industry.includes(q)
            || desc.includes(q)
            || c.tags.some(t => String(t).toLowerCase().includes(q));
      });

      list.sort((a, b) => {
        if (state.sortBy === 'name')    return a.name.localeCompare(b.name);
        if (state.sortBy === 'country') return (a.country[state.lang] || a.country.en).localeCompare(b.country[state.lang] || b.country.en);
        if (state.sortBy === 'founded') return (a.founded || 0) - (b.founded || 0);
        return 0;
      });
      return list;
    },

    render() {
      const T = state.i18n[state.lang];
      const list = this.filter();

      const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
      if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);

      const start = (this.currentPage - 1) * ITEMS_PER_PAGE;
      const pageList = list.slice(start, start + ITEMS_PER_PAGE);

      $('#results-count').textContent = list.length;
      $('#results-label').textContent = T.companies.found;

      const grid = $('#companies-grid');
      const empty = $('#empty-state');
      if (!grid) return;

      // Remove existing cards (keep empty state)
      grid.querySelectorAll('.company').forEach(el => el.remove());
      empty?.classList.toggle('is-shown', list.length === 0);

      this.renderPagination(totalPages);

      const frag = document.createDocumentFragment();
      pageList.forEach((c, i) => {
        const desc = c.desc[state.lang] || c.desc.en || '';
        const country = c.country[state.lang] || c.country.en || '';
        const industry = c.industry[state.lang] || c.industry.en || '';
        const initials = c.name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('');
        const catLabel = (T.companies.categories || {})[c.category] || c.category;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'company';
        btn.style.setProperty('--c-color', c.color);
        btn.style.animationDelay = (i * 40) + 'ms';
        btn.setAttribute('aria-label', `${c.name} — ${industry}`);
        btn.addEventListener('click', () => Modal.open(c));

        btn.innerHTML = `
          <div class="company__top">
            <div class="company__head">
              <div class="company__logo" style="background:${escapeHtml(c.color)}">${escapeHtml(initials)}</div>
              <div>
                <div class="company__name">${escapeHtml(c.name)}</div>
                <div class="company__industry">${escapeHtml(industry)}</div>
              </div>
            </div>
            <div class="company__flag" aria-hidden="true">${escapeHtml(c.flag)}</div>
          </div>
          <p class="company__desc">${escapeHtml(desc)}</p>
          <div class="company__footer">
            <div class="company__meta">
              <span aria-hidden="true">${escapeHtml(c.flag)}</span>
              <span>${escapeHtml(country)}</span>
              ${c.founded ? `<span style="opacity:.3">·</span><span>est. ${c.founded}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:7px">
              <div class="company__cat">${escapeHtml(CAT_ICONS[c.category] || '')} ${escapeHtml(catLabel)}</div>
              <div class="company__arrow" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </div>
          </div>
        `;
        frag.appendChild(btn);
      });
      grid.appendChild(frag);
    },

    renderPagination(totalPages) {
      const nav = $('#pagination');
      if (!nav) return;
      nav.innerHTML = '';
      if (totalPages <= 1) return;

      const cur = this.currentPage;

      const mkBtn = (label, page, disabled = false, active = false) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pagination__btn' + (active ? ' is-active' : '');
        b.textContent = label;
        b.disabled = disabled;
        b.setAttribute('aria-label', `Page ${page}`);
        if (!disabled) {
          b.addEventListener('click', () => {
            this.currentPage = page;
            this.render();
            document.getElementById('companies')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
        return b;
      };

      const mkDots = () => {
        const s = document.createElement('span');
        s.className = 'pagination__dots';
        s.textContent = '…';
        return s;
      };

      // Prev
      nav.appendChild(mkBtn('←', cur - 1, cur === 1));

      // Page numbers with smart ellipsis
      const pages = [];
      pages.push(1);
      if (cur > 3) pages.push('...');
      for (let p = Math.max(2, cur - 1); p <= Math.min(totalPages - 1, cur + 1); p++) pages.push(p);
      if (cur < totalPages - 2) pages.push('...');
      if (totalPages > 1) pages.push(totalPages);

      pages.forEach(p => {
        if (p === '...') { nav.appendChild(mkDots()); return; }
        nav.appendChild(mkBtn(p, p, false, p === cur));
      });

      // Next
      nav.appendChild(mkBtn('→', cur + 1, cur === totalPages));
    }
  };

  /* ─────────────────────────────────────────────
     MODAL
     ───────────────────────────────────────────── */
  const Modal = {
    el:       null,
    lastFocus: null,

    init() {
      this.el = $('#modal-overlay');
      $('#modal-close')?.addEventListener('click', () => this.close());
      this.el?.addEventListener('click', (e) => {
        if (e.target === this.el) this.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.el?.classList.contains('is-open')) this.close();
      });
    },

    open(c) {
      const T = state.i18n[state.lang];
      const M = T.companies.modal;
      const desc = c.desc[state.lang] || c.desc.en;
      const country = c.country[state.lang] || c.country.en;
      const industry = c.industry[state.lang] || c.industry.en;
      const initials = c.name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('');

      $('#modal-logo').textContent = initials;
      $('#modal-logo').style.background = c.color;
      $('#modal-name').textContent = `${c.flag} ${c.name}`;
      $('#modal-sub').textContent = industry;
      $('#modal-desc').textContent = desc;

      const items = [
        { l: '🌍 ' + M.country,   v: country },
        { l: '📅 ' + M.founded,   v: c.founded || '—' },
        { l: '👥 ' + M.employees, v: c.emp     || '—' },
        { l: '📍 ' + M.address,   v: c.address || '—' },
        { l: '📞 ' + M.phone,     v: c.phone   || '—' },
        { l: '✉️ ' + M.email,     v: c.email   || '—' }
      ];
      $('#modal-grid').innerHTML = items.map(i => `
        <div class="modal__item">
          <div class="modal__label">${escapeHtml(i.l)}</div>
          <div class="modal__val">${escapeHtml(i.v)}</div>
        </div>
      `).join('');

      $('#modal-tags').innerHTML = c.tags.map(t =>
        `<div class="modal__tag">#${escapeHtml(t)}</div>`
      ).join('');

      let btns = '';
      if (c.web)   btns += `<a class="modal__btn modal__btn--primary" href="${escapeHtml(c.web)}" target="_blank" rel="noopener">🌐 ${escapeHtml(M.website)}</a>`;
      if (c.phone) btns += `<a class="modal__btn modal__btn--sec"     href="tel:${escapeHtml(c.phone)}">📞 ${escapeHtml(M.call)}</a>`;
      if (c.email) btns += `<a class="modal__btn modal__btn--sec"     href="mailto:${escapeHtml(c.email)}">✉️ ${escapeHtml(M.emailBtn)}</a>`;
      $('#modal-btns').innerHTML = btns;

      this.lastFocus = document.activeElement;
      this.el.classList.add('is-open');
      this.el.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('#modal-close')?.focus();
    },

    close() {
      this.el?.classList.remove('is-open');
      this.el?.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      this.lastFocus?.focus?.();
    }
  };

  /* ─────────────────────────────────────────────
     CONTACT FORM — Telegram Bot Integration
     ───────────────────────────────────────────── */

  // ⮕ O'z Telegram Bot tokeningizni va chat ID ni shu yerga kiriting:
  const TG_BOT_TOKEN = '7770159943:AAGXJXm3AKLJNapmknWPHoTy8Ks0JlR6mKU';
  const TG_CHAT_ID   = '1080836070';

  const ContactForm = {
    init() {
      const form = $('#contact-form');
      if (!form) return;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit(form);
      });
    },

    async submit(form) {
      const T = state.i18n[state.lang].contact.form;
      const data = Object.fromEntries(new FormData(form));

      // Validation
      const allFilled = ['name', 'email', 'subject', 'message'].every(k => (data[k] || '').trim().length > 0);
      if (!allFilled) {
        toast(T.errorRequired, { type: 'error' });
        return;
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());
      if (!emailOk) {
        toast(T.errorEmail, { type: 'error' });
        return;
      }

      // Disable button during send
      const btn = form.querySelector('.form__btn');
      const origText = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Yuborilmoqda...';
      }

      // Build Telegram message
      const text =
        `📩 *BSI Portali — Yangi Xabar*\n\n` +
        `👤 *Ism:* ${data.name.trim()}\n` +
        `📧 *Email:* ${data.email.trim()}\n` +
        `📌 *Mavzu:* ${data.subject.trim()}\n\n` +
        `💬 *Xabar:*\n${data.message.trim()}`;

      try {
        const res = await fetch(
          `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TG_CHAT_ID,
              text,
              parse_mode: 'Markdown'
            })
          }
        );

        const json = await res.json();
        if (json.ok) {
          toast(T.sent, { duration: 4000 });
          form.reset();
        } else {
          console.error('[BSI] Telegram error:', json);
          toast(T.errorSend || '❌ Xabar yuborishda xato yuz berdi. Qaytadan urinib ko\'ring.', { type: 'error', duration: 5000 });
        }
      } catch (err) {
        console.error('[BSI] Network error:', err);
        toast(T.errorSend || '❌ Internet bilan muammo. Qaytadan urinib ko\'ring.', { type: 'error', duration: 5000 });
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = state.i18n[state.lang]?.contact?.form?.send || origText;
        }
      }
    }
  };

  /* ─────────────────────────────────────────────
     CUSTOM CURSOR (desktop only)
     ───────────────────────────────────────────── */
  const Cursor = {
    init() {
      const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!isFinePointer) return;

      document.body.classList.add('cursor-on');
      const dot  = $('#cursor-dot');
      const ring = $('#cursor-ring');
      if (!dot || !ring) return;

      let mx = 0, my = 0, rx = 0, ry = 0, raf;

      const onMove = (e) => {
        mx = e.clientX; my = e.clientY;
        dot.style.left = mx + 'px';
        dot.style.top  = my + 'px';
        if (!raf) raf = requestAnimationFrame(loop);
      };
      const loop = () => {
        rx += (mx - rx) * .15;
        ry += (my - ry) * .15;
        ring.style.left = rx + 'px';
        ring.style.top  = ry + 'px';
        if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      };

      document.addEventListener('mousemove', onMove, { passive: true });

      // Grow on interactive elements
      const interactive = 'a, button, input, textarea, select, [role="button"]';
      document.addEventListener('mouseover', (e) => {
        if (e.target.closest(interactive)) document.body.classList.add('cursor-grow');
      });
      document.addEventListener('mouseout', (e) => {
        if (e.target.closest(interactive)) document.body.classList.remove('cursor-grow');
      });
    }
  };

  /* ─────────────────────────────────────────────
     REVEAL OBSERVER
     ───────────────────────────────────────────── */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (!en.isIntersecting) return;
      const target = en.target;
      setTimeout(() => target.classList.add('is-visible'), i * 50);

      // Counter animation
      const counter = target.querySelector?.('[data-target]');
      if (counter && counter.dataset.counted === '0') {
        counter.dataset.counted = '1';
        const max = parseInt(counter.dataset.target, 10) || 0;
        const dur = 1200;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const v = Math.round(eased * max);
          counter.textContent = v + (max >= 10 ? '+' : '');
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }

      observer.unobserve(target);
    });
  }, { threshold: .12 });

  function observeReveals() {
    $$('.reveal').forEach(el => observer.observe(el));
  }

  /* ─────────────────────────────────────────────
     PHOTO LOADING (graceful fallback)
     ───────────────────────────────────────────── */
  function initPhoto() {
    const img = $('#hero-photo');
    const placeholder = $('#hero-placeholder');
    if (!img || !placeholder) return;

    const showImg = () => {
      img.style.display = 'block';
      placeholder.style.display = 'none';
    };
    const showPlaceholder = () => {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    };

    img.addEventListener('load',  showImg);
    img.addEventListener('error', showPlaceholder);

    // If already loaded from cache before listeners attached
    if (img.complete) {
      if (img.naturalWidth > 0) showImg();
      else showPlaceholder();
    }
  }

  /* ─────────────────────────────────────────────
     INIT
     ───────────────────────────────────────────── */
  async function init() {
    try {
      await loadAllData();
    } catch (err) {
      console.error('[BSI] Failed to load data:', err);
      // Show a basic error message
      const main = $('#main');
      if (main) {
        main.innerHTML = '<div style="padding:80px 20px;text-align:center;color:var(--fg-muted)"><h2 style="font-family:var(--font-display);font-size:32px;color:var(--gold);margin-bottom:12px">⚠️ Loading error</h2><p>Could not load site data. If you are opening the file directly (file://), please run a local server: <br><code style="background:var(--bg-elev-2);padding:4px 8px;border-radius:4px;color:var(--gold)">python3 -m http.server</code></p></div>';
      }
      return;
    }

    Theme.init();
    Header.init();
    Companies.init();   // attach listeners first
    Modal.init();
    ContactForm.init();
    Cursor.init();
    initPhoto();
    I18n.init();        // applyAll() will populate dynamic content
    observeReveals();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
