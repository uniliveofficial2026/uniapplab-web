/**
 * Legal page auto-translate (Google Translate Element).
 * Supports Burmese (မြန်မာ) and all common languages; auto-picks browser language.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'unilive_legal_lang';

  /** Common languages + Burmese — Google Translate codes */
  var LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'my', label: 'မြန်မာ (Burmese)' },
    { code: 'zh-CN', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'th', label: 'ไทย' },
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'id', label: 'Bahasa Indonesia' },
    { code: 'ms', label: 'Bahasa Melayu' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'bn', label: 'বাংলা' },
    { code: 'ar', label: 'العربية' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'pt', label: 'Português' },
    { code: 'de', label: 'Deutsch' },
    { code: 'ru', label: 'Русский' },
    { code: 'it', label: 'Italiano' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'uk', label: 'Українська' },
    { code: 'pl', label: 'Polski' },
    { code: 'nl', label: 'Nederlands' },
    { code: 'sv', label: 'Svenska' },
    { code: 'tl', label: 'Filipino' },
    { code: 'km', label: 'ភាសាខ្មែរ' },
    { code: 'lo', label: 'ລາວ' },
  ];

  var included = LANGUAGES.map(function (l) {
    return l.code;
  }).join(',');

  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function setGoogTransCookie(pair) {
    var host = location.hostname;
    var expires = 'expires=' + new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = 'googtrans=' + pair + ';path=/;' + expires;
    if (host && host.indexOf('.') !== -1) {
      document.cookie = 'googtrans=' + pair + ';path=/;domain=.' + host + ';' + expires;
    }
  }

  function clearGoogTransCookie() {
    var host = location.hostname;
    document.cookie = 'googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (host && host.indexOf('.') !== -1) {
      document.cookie = 'googtrans=;path=/;domain=.' + host + ';expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  function detectBrowserLang() {
    var raw = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (raw === 'zh-cn' || raw.indexOf('zh-hans') === 0) return 'zh-CN';
    if (raw === 'zh-tw' || raw.indexOf('zh-hant') === 0 || raw === 'zh-hk') return 'zh-TW';
    var short = raw.split('-')[0];
    // Burmese / Myanmar
    if (short === 'my' || short === 'bur') return 'my';
    for (var i = 0; i < LANGUAGES.length; i += 1) {
      if (LANGUAGES[i].code.toLowerCase() === short || LANGUAGES[i].code.toLowerCase() === raw) {
        return LANGUAGES[i].code;
      }
    }
    return 'en';
  }

  function preferredLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGUAGES.some(function (l) { return l.code === saved; })) return saved;
    } catch (_) {}
    return detectBrowserLang();
  }

  function currentFromCookie() {
    var c = readCookie('googtrans');
    // formats: /en/my  or  /auto/my
    var parts = c.split('/');
    if (parts.length >= 3 && parts[2]) return parts[2];
    return 'en';
  }

  function applyLang(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (_) {}
    if (!code || code === 'en') {
      clearGoogTransCookie();
    } else {
      setGoogTransCookie('/en/' + code);
    }
    // Reload so Google Translate applies cleanly
    location.reload();
  }

  function buildToolbar() {
    var existing = document.getElementById('legal-lang-bar');
    if (existing) return;

    var bar = document.createElement('div');
    bar.id = 'legal-lang-bar';
    bar.setAttribute('translate', 'no');
    bar.innerHTML =
      '<div class="legal-lang-inner">' +
      '<label for="legal-lang-select"><span aria-hidden="true">🌐</span> Language / ဘာသာစကား</label>' +
      '<select id="legal-lang-select" aria-label="Translate this page"></select>' +
      '<span class="legal-lang-hint">Auto-translate · includes Burmese (မြန်မာ)</span>' +
      '</div>' +
      '<div id="google_translate_element" aria-hidden="true"></div>';

    document.body.insertBefore(bar, document.body.firstChild);

    var select = document.getElementById('legal-lang-select');
    var current = preferredLang();
    LANGUAGES.forEach(function (lang) {
      var opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.label;
      if (lang.code === current) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      applyLang(select.value);
    });

    // Sync cookie before Google script runs so first paint translates
    if (current !== 'en' && currentFromCookie() !== current) {
      setGoogTransCookie('/en/' + current);
    } else if (current === 'en') {
      clearGoogTransCookie();
    }
  }

  window.googleTranslateElementInit = function () {
    // eslint-disable-next-line no-undef
    new google.translate.TranslateElement(
      {
        pageLanguage: 'en',
        includedLanguages: included,
        autoDisplay: false,
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
      },
      'google_translate_element',
    );
  };

  function loadGoogleScript() {
    if (document.getElementById('google-translate-script')) return;
    var s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      buildToolbar();
      loadGoogleScript();
    });
  } else {
    buildToolbar();
    loadGoogleScript();
  }
})();
