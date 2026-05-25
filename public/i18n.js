// Bilingual translation dictionary. Server stays English; this overlays for the UI.
// Strings the server already provides (check titles, descriptions, howToFix) are
// looked up here by checkId / categoryId — if missing, frontend falls back to the
// English string returned by the API.

export const SUPPORTED_LANGS = ['en', 'uk'];

const D = {
  en: {
    appTitle: 'Web MCP Auditor',
    tagline: 'Lighthouse-style audit for Web MCP on any URL.',
    aboutWebMcp: 'Web MCP',
    urlPlaceholder: 'https://example.com',
    runAudit: 'Run audit',
    auditing: 'Auditing…',
    executeToggle: 'Execute tool calls (intrusive)',
    tryFixture: 'Try a fixture:',
    fixtureImp: 'Imperative-only',
    fixtureDecl: 'Declarative-only',
    fixtureMixed: 'Mixed/bad',
    statusAuditing: 'Auditing {url} (this can take 15–30 seconds)…',
    statusError: 'Error: {code} — {msg}',
    statusNetwork: 'Network error: {msg}',
    overallScore: 'Overall score',
    metaUrl: 'URL',
    metaStatus: 'HTTP status',
    metaRuntime: 'Runtime mode',
    metaBrowser: 'Browser',
    metaDuration: 'Duration',
    badgePass: '{n} pass',
    badgeWarn: '{n} warn',
    badgeFail: '{n} fail',
    badgeNa: '{n} n/a',
    runtimeUnavailableTitle: 'WebMCP runtime: unavailable.',
    runtimeUnavailableBody: 'The auditing browser does not expose navigator.modelContext, so runtime/imperative/execution checks were skipped. Declarative-DOM and Permissions-Policy header checks still ran.',
    howToFix: 'How to fix',
    techDetails: 'Technical details',
    specDocs: 'Spec / docs →',
    apiHint: 'API:',
    healthLink: 'health',
    aboutSummary: 'About this audit — what is Web MCP and how to read the score',
    aboutP1: 'Web MCP (Model Context Protocol for the Web) is a proposed browser standard, available in Chrome 149+ behind chrome://flags/#enable-webmcp-testing, that lets a site expose structured "tools" to AI agents — either by calling navigator.modelContext.registerTool() in JavaScript, or by annotating HTML forms with toolname / tooldescription / toolparamtitle / toolparamdescription. Without this, agents have to scrape your UI; with it, they get an explicit, typed contract.',
    aboutP2: 'This auditor checks 16 things across 5 categories: whether the runtime is exposed, what tools are registered (imperative + declarative), the quality of each tool\'s metadata, and execution + safety hygiene (Permissions-Policy header, opt-in smoke test of executeTool).',
    aboutP3: 'Scores are weighted: each pass earns full weight, warn earns half, fail earns zero. Categories with no applicable checks (n/a) are excluded. Bands: 0–49 red, 50–89 amber, 90–100 green. The overall score is the average of category scores.',
    aboutP4: 'If you author the site being audited: expand the "How to fix" block under every warn/fail finding for concrete next steps. Useful starting points: developer.chrome.com/docs/ai/webmcp for the spec, and the three built-in fixtures (Imperative-only / Declarative-only / Mixed/bad) to see what a clean vs broken implementation looks like.',
    rawSection: 'Raw audit JSON (probe + headers)',
    downloadJson: 'Download JSON',
    langLabel: 'Language',
    langEN: 'English',
    langUK: 'Українська',
    hintLabel: 'Note',

    // Trust strip
    trustMethod: '16 checks · 5 categories',
    trustMethodSub: 'Weighted scoring, transparent rules',
    trustSpec: 'Tracks the Web MCP spec',
    trustSpecSub: 'Chrome 149+ origin trial & W3C draft',
    trustOss: 'Open source · MIT',
    trustOssSub: 'View source on GitHub →',
    trustPrivacy: 'No data stored',
    trustPrivacySub: 'Reports live only in your browser',

    // Info panels (methodology / sources / privacy)
    methodologyTitle: 'Methodology — what we check and how we score',
    methodologyIntro: 'Every check below runs on every audited page. Each emits a status (pass / warn / fail / n/a). We compute a per-category score as a weighted average — pass earns full weight, warn earns half, fail earns zero. Categories with no applicable findings (n/a) are excluded from the overall score. Color bands: 0–49 red, 50–89 amber, 90–100 green.',
    methodologyWeight: 'weight',
    methodologyCheck: 'check',
    methodologySev: 'severity',
    sourcesTitle: 'Sources & references',
    sourcesIntro: 'This auditor implements the Web MCP draft as documented by the Chrome team and the W3C Web Machine Learning community group. Every check links back to the relevant section of the spec.',
    privacyTitle: 'Privacy & what we don\'t do',
    privacyP1: 'When you audit a URL we fetch it server-side with a headless Chrome instance, run the audit, and return the result as JSON. We do not log the URLs you audit, the results of those audits, or any personal data. There are no analytics, no third-party trackers, no cookies (we use only localStorage for your language preference).',
    privacyP2: 'The audit visits the target URL like a normal browser would. Permissions-Policy, robots.txt, and rate limits set by that site apply normally. By default the auditor does NOT execute tools on the target site (it only reads tool definitions); turning on "Execute tool calls" runs each tool once with a synthesized input, which can mutate state if the site implements non-readOnly tools.',
    privacyP3: 'You can verify all of this — the source is open. If you self-host, no third party ever sees the URLs you audit.',

    // Footer
    footerVersion: 'Version',
    footerUpdated: 'Checks updated',
    footerLicense: 'MIT-licensed',
    footerRepo: 'Source on GitHub',
    footerIssues: 'Report an issue',
    footerApiHeading: 'API',
    footerDisclaimer: 'Independent tool. Not affiliated with Google, the Chrome team, or W3C.',

    // Verdict messages
    verdict: {
      degradedHead: 'Degraded mode — limited audit',
      degradedBody: 'The auditing browser does not expose navigator.modelContext, so this report only covers declarative HTML annotations and the Permissions-Policy header. To get full coverage, run the auditor with Chrome ≥149 (set PUPPETEER_EXECUTABLE_PATH or run `npx @puppeteer/browsers install chrome@beta`).',
      noApiHead: 'Web MCP runtime is not exposed on this page',
      noApiBody: 'The browser supports Web MCP, but the page didn\'t expose navigator.modelContext. This usually means the page is on an opaque origin (data:, blob:, sandboxed iframe) or the runtime is gated by a policy you didn\'t accept. Declarative-DOM checks still ran.',
      noToolsHead: 'This site does not implement Web MCP',
      noToolsBody: 'The Web MCP runtime is available on this page, but the site registers no tools (imperative API) and has no annotated forms (declarative API). AI agents will fall back to UI scraping — they cannot reliably automate this page.',
      imperativeOnlyHead: 'This site implements Web MCP with {n} imperative tool{s}',
      imperativeOnlyBody: 'AI agents can call these tools via navigator.modelContext.executeTool(). Check the Metadata quality section to make sure descriptions and schemas are agent-friendly.',
      declarativeOnlyHead: 'This site uses the Declarative API only ({n} annotated form{s})',
      declarativeOnlyBody: 'Agents can fill and submit these forms based on the toolname / toolparam* attributes. Consider adding imperative tools too for actions that don\'t map cleanly to a form.',
      bothHead: 'This site implements Web MCP with {imp} imperative + {decl} declarative tool{s}',
      bothBody: 'Both APIs are in use. The full check catalog ran against every tool — fix any fail/warn below to improve agent reliability.'
    },

    categories: {
      runtime: {
        title: 'Runtime detection',
        description: 'Whether the Web MCP API (navigator.modelContext) is exposed to this page and is callable.',
        hint: 'This category checks the browser, not the site. In modern Chrome (≥149) the API is exposed automatically on every HTTPS page — so a green score here does NOT mean the site uses Web MCP. Site adoption is measured in the Imperative inventory and Declarative inventory sections below.'
      },
      imperative: {
        title: 'Imperative inventory',
        description: 'Tools registered programmatically via navigator.modelContext.registerTool(). This is the primary surface AI agents interact with.'
      },
      declarative: {
        title: 'Declarative inventory',
        description: 'HTML forms annotated with toolname / tooldescription / toolparam* — an agent can fill and submit them without you writing any JS.'
      },
      metadata: {
        title: 'Metadata quality',
        description: 'For every detected tool: is the description meaningful, is the inputSchema a valid JSON Schema 2020-12, are all properties typed, are safety hints set explicitly?'
      },
      safety: {
        title: 'Execution & safety',
        description: 'Whether the page sets a Permissions-Policy "tools" directive (controls cross-origin embedding), and — optionally — whether each tool actually executes without error.'
      }
    },

    // checks: keep English from API — no overlay needed
    checks: {}
  },

  uk: {
    appTitle: 'Web MCP Аудитор',
    tagline: 'Аудит у стилі Lighthouse для Web MCP на будь-якій URL.',
    aboutWebMcp: 'Web MCP',
    urlPlaceholder: 'https://example.com',
    runAudit: 'Запустити аудит',
    auditing: 'Аудит триває…',
    executeToggle: 'Виконувати tool calls (інтрузивно)',
    tryFixture: 'Спробуй фікстуру:',
    fixtureImp: 'Тільки imperative',
    fixtureDecl: 'Тільки declarative',
    fixtureMixed: 'Mixed/bad',
    statusAuditing: 'Аудит {url} (це може зайняти 15–30 секунд)…',
    statusError: 'Помилка: {code} — {msg}',
    statusNetwork: 'Мережева помилка: {msg}',
    overallScore: 'Загальний бал',
    metaUrl: 'URL',
    metaStatus: 'HTTP статус',
    metaRuntime: 'Режим runtime',
    metaBrowser: 'Браузер',
    metaDuration: 'Тривалість',
    badgePass: '{n} pass',
    badgeWarn: '{n} warn',
    badgeFail: '{n} fail',
    badgeNa: '{n} n/a',
    runtimeUnavailableTitle: 'WebMCP runtime: недоступний.',
    runtimeUnavailableBody: 'Браузер аудитора не експонує navigator.modelContext, тому runtime/imperative/execution перевірки пропущено. Declarative-DOM перевірки та Permissions-Policy заголовок усе ж відпрацювали.',
    howToFix: 'Як виправити',
    techDetails: 'Технічні деталі',
    specDocs: 'Специфікація / docs →',
    apiHint: 'API:',
    healthLink: 'статус',
    aboutSummary: 'Про цей аудит — що таке Web MCP і як читати бал',
    aboutP1: 'Web MCP (Model Context Protocol для Web) — це запропонований браузерний стандарт, доступний у Chrome 149+ за прапором chrome://flags/#enable-webmcp-testing, що дозволяє сайту експонувати структуровані "tools" для AI-агентів — або через виклик navigator.modelContext.registerTool() у JavaScript, або через анотування HTML-форм атрибутами toolname / tooldescription / toolparamtitle / toolparamdescription. Без цього агентам доводиться скрейпити UI; з цим вони отримують явний типізований контракт.',
    aboutP2: 'Цей аудитор перевіряє 16 речей у 5 категоріях: чи експоновано runtime, які tools зареєстровано (imperative + declarative), якість метаданих кожного tool, та гігієну виконання + безпеки (Permissions-Policy заголовок, опціональний smoke-тест executeTool).',
    aboutP3: 'Оцінки зважені: кожен pass дає повну вагу, warn — половину, fail — нуль. Категорії без застосовних перевірок (n/a) виключаються. Смуги: 0–49 червоний, 50–89 жовтий, 90–100 зелений. Загальний бал — середнє від категорій.',
    aboutP4: 'Якщо ти автор сайту, який аудитуєш: розгорни блок "Як виправити" під кожним warn/fail для конкретних кроків. Корисні відправні точки: developer.chrome.com/docs/ai/webmcp для специфікації, та три вбудовані фікстури (Imperative-only / Declarative-only / Mixed/bad) щоб побачити чисту vs зламану реалізацію.',
    rawSection: 'Сирий JSON аудиту (probe + headers)',
    downloadJson: 'Завантажити JSON',
    langLabel: 'Мова',
    langEN: 'English',
    langUK: 'Українська',
    hintLabel: 'Підказка',

    // Trust strip
    trustMethod: '16 перевірок · 5 категорій',
    trustMethodSub: 'Зважена оцінка, прозорі правила',
    trustSpec: 'Слідкує за специфікацією Web MCP',
    trustSpecSub: 'Chrome 149+ origin trial та W3C draft',
    trustOss: 'Open source · MIT',
    trustOssSub: 'Подивитись код на GitHub →',
    trustPrivacy: 'Жодних збережених даних',
    trustPrivacySub: 'Звіти живуть лише у твоєму браузері',

    // Info panels
    methodologyTitle: 'Методологія — що перевіряємо і як оцінюємо',
    methodologyIntro: 'Кожна перевірка нижче запускається на кожній сторінці. Кожна повертає статус (pass / warn / fail / n/a). Бал категорії — зважене середнє: pass дає повну вагу, warn — половину, fail — нуль. Категорії без застосовних перевірок (n/a) виключаються із загального балу. Кольори: 0–49 червоний, 50–89 жовтий, 90–100 зелений.',
    methodologyWeight: 'вага',
    methodologyCheck: 'перевірка',
    methodologySev: 'severity',
    sourcesTitle: 'Джерела та посилання',
    sourcesIntro: 'Цей аудитор реалізує Web MCP draft, як його документує команда Chrome та W3C Web Machine Learning community group. Кожна перевірка має лінк на відповідний розділ специфікації.',
    privacyTitle: 'Приватність — і чого ми НЕ робимо',
    privacyP1: 'Коли ти аудитуєш URL, ми завантажуємо його server-side через headless Chrome, прогоняємо аудит і повертаємо результат у JSON. Ми не логуємо URL, які ти аудитуєш, результати аудитів, ані будь-які персональні дані. Жодної аналітики, жодних third-party трекерів, жодних cookies (тільки localStorage для збереження мови).',
    privacyP2: 'Аудит відвідує цільовий URL так, як це робить звичайний браузер. Permissions-Policy, robots.txt, rate-limits цільового сайту застосовуються нормально. За замовчуванням аудитор НЕ виконує tools на цільовому сайті (тільки читає визначення); опція "Execute tool calls" викликає кожен tool раз із синтезованим входом — це може змінити стан, якщо сайт має non-readOnly tools.',
    privacyP3: 'Можеш все це перевірити — код відкритий. Якщо self-host — жодна третя сторона взагалі не бачить URL, які ти аудитуєш.',

    // Footer
    footerVersion: 'Версія',
    footerUpdated: 'Перевірки оновлено',
    footerLicense: 'Ліцензія MIT',
    footerRepo: 'Код на GitHub',
    footerIssues: 'Повідомити про проблему',
    footerApiHeading: 'API',
    footerDisclaimer: 'Незалежний інструмент. Не афілійований з Google, командою Chrome чи W3C.',

    verdict: {
      degradedHead: 'Degraded режим — обмежений аудит',
      degradedBody: 'Браузер аудитора не експонує navigator.modelContext, тому цей звіт покриває лише декларативні HTML-анотації та Permissions-Policy заголовок. Для повного покриття запусти аудитор з Chrome ≥149 (встанови PUPPETEER_EXECUTABLE_PATH або виконай `npx @puppeteer/browsers install chrome@beta`).',
      noApiHead: 'Web MCP runtime не експоновано на цій сторінці',
      noApiBody: 'Браузер підтримує Web MCP, але сторінка не експонувала navigator.modelContext. Зазвичай це означає, що сторінка на opaque-origin (data:, blob:, sandboxed iframe) або runtime обмежено політикою, яку ти не прийняв. Declarative-DOM перевірки все ж відпрацювали.',
      noToolsHead: 'Цей сайт не реалізує Web MCP',
      noToolsBody: 'Web MCP runtime доступний на цій сторінці, але сайт не реєструє жодного tool (imperative API) і не має анотованих форм (declarative API). AI-агенти повернуться до UI-скрейпінгу — вони не можуть надійно автоматизувати цю сторінку.',
      imperativeOnlyHead: 'Сайт реалізує Web MCP з {n} imperative tool{s}',
      imperativeOnlyBody: 'AI-агенти можуть викликати ці tools через navigator.modelContext.executeTool(). Перевір секцію Metadata quality, щоб переконатися, що описи та схеми agent-friendly.',
      declarativeOnlyHead: 'Сайт використовує тільки Declarative API ({n} анотован{ed} форм{s})',
      declarativeOnlyBody: 'Агенти можуть заповнити та надіслати ці форми на основі toolname / toolparam* атрибутів. Розглянь додавання imperative tools для дій, які не лягають у форму.',
      bothHead: 'Сайт реалізує Web MCP з {imp} imperative + {decl} declarative tool{s}',
      bothBody: 'Використовуються обидва API. Повний каталог перевірок прогнано для кожного tool — виправ будь-які fail/warn нижче, щоб покращити надійність для агентів.'
    },

    categories: {
      runtime: {
        title: 'Runtime detection',
        description: 'Чи експоновано Web MCP API (navigator.modelContext) на сторінку і чи воно викликається.',
        hint: 'Ця категорія перевіряє БРАУЗЕР, а не сайт. У сучасному Chrome (≥149) API експонується автоматично на кожній HTTPS-сторінці — тож зелений бал тут НЕ означає, що сайт використовує Web MCP. Адопція сайтом вимірюється у секціях Imperative inventory та Declarative inventory нижче.'
      },
      imperative: {
        title: 'Imperative inventory',
        description: 'Tools зареєстровані програмно через navigator.modelContext.registerTool(). Це основна поверхня, з якою працюють AI-агенти.'
      },
      declarative: {
        title: 'Declarative inventory',
        description: 'HTML-форми з анотаціями toolname / tooldescription / toolparam* — агент може заповнити та надіслати їх без жодного JS від тебе.'
      },
      metadata: {
        title: 'Metadata quality',
        description: 'Для кожного знайденого tool: чи має він осмислений опис, чи inputSchema — валідний JSON Schema 2020-12, чи всі властивості типізовані, чи явно вказані safety hints?'
      },
      safety: {
        title: 'Execution & safety',
        description: 'Чи встановлює сторінка директиву Permissions-Policy "tools" (контролює cross-origin вбудовування), та — опціонально — чи кожен tool реально виконується без помилки.'
      }
    },

    checks: {
      'runtime.api-present': { title: 'navigator.modelContext експоновано', howToFix: 'Сторінка не експонувала navigator.modelContext. Якщо ти автор: подавай через HTTPS і уникай opaque-origin (data:, blob:, sandboxed iframes). Перевір локально через chrome://flags/#enable-webmcp-testing або origin trial у Chrome 149+.' },
      'runtime.api-shape':   { title: 'registerTool, getTools, executeTool — усі функції', howToFix: 'Бракує необхідного методу. Найімовірніше, твій Chromium застарів — онови до Chrome ≥149 з підтримкою WebMCP, або перевір, чи код не monkey-patch\'ив modelContext.' },
      'runtime.late-registration': { title: 'Tools реєструються до load + 2s вікна', howToFix: 'Деякі агенти роблять snapshot getTools() одразу після load. Якщо реєструєш пізніше — вони можуть бути невидимими. Перенеси реєстрацію в top-level скрипт або в обробник "DOMContentLoaded".' },
      'imperative.tool-count': { title: 'Зареєстровано хоча б один tool', howToFix: 'Не зареєстровано жодного imperative tool. Виклич navigator.modelContext.registerTool({ name, description, inputSchema, execute }) для кожної дії, яку хочеш дати агентам. Пропусти, якщо свідомо використовуєш тільки declarative API.' },
      'imperative.unique-names': { title: 'Імена tools унікальні', howToFix: 'Імена tools — це ідентифікатори. Дублікати призводять до неоднозначності — агент може вибрати не ту реалізацію. Перейменуй один з дублікатів, або відмени попередній через AbortController перед повторною реєстрацією.' },
      'imperative.name-convention': { title: 'Імена tools у snake_case (≤64 символів)', howToFix: 'Агенти часто роблять pattern-match на іменах. Використовуй нижній snake_case (^[a-z][a-z0-9_]{0,63}$): "add_to_cart", не "AddToCart" чи "tool-1".' },
      'imperative.no-duplicate-registration': { title: 'registerTool не викликається двічі для одного імені без cleanup', howToFix: 'Повторна реєстрація без відміни попередньої тече listeners і дає непередбачувану поведінку. Передай { signal: controller.signal } у registerTool, а потім controller.abort() перед повторною реєстрацією.' },
      'declarative.form-pairing': { title: '[toolname] елементи пов\'язані з <form>', howToFix: 'Declarative API працює тільки на <form> елементах (або всередині форми). Перенеси toolname/tooldescription на <form>, інакше агенту немає що submitити.' },
      'declarative.param-coverage': { title: 'Інпути форм мають toolparamtitle + toolparamdescription', howToFix: 'Без toolparamtitle та toolparamdescription на кожному input/select/textarea агенту доводиться вгадувати, що заповнювати. Додай їх — вони мапляться напряму на JSON Schema property title/description.' },
      'declarative.has-tooldescription': { title: 'Кожен [toolname] має tooldescription', howToFix: 'Без осмисленого tooldescription агент бачить лише ім\'я. Додай tooldescription="…" що пояснює, що зробить submit форми.' },
      'metadata.description-length': { title: 'Опис довжиною 20–500 символів', howToFix: 'Цілься на 20–500 символів. Закороткий → агент не може вибрати з кількох схожих tools. Задовгий → їсть контекст. Опиши, що робить tool і коли його застосовувати (не як він реалізований).' },
      'metadata.inputschema-valid': { title: 'inputSchema валідний за JSON Schema 2020-12', howToFix: 'Твій inputSchema не валідний JSON Schema. Часті помилки: additionalProperties має бути boolean (не string), кожна властивість потребує type, $ref шляхи мають розв\'язуватися. Перевір лінтером JSON Schema.' },
      'metadata.inputschema-typed': { title: 'Корінь inputSchema — object, кожна властивість типізована', howToFix: 'Встанови { "type": "object" } на корені та явний type на кожній властивості. Нетипізовані схеми приймають будь-що, що збиває агентів з пантелику.' },
      'metadata.annotations-present': { title: 'annotations.readOnlyHint встановлено явно', howToFix: 'Встанови annotations: { readOnlyHint: true } для tools, які тільки читають, false — для тих, що змінюють стан. Агенти використовують це, щоб гейтити чутливі дії (напр., запитувати підтвердження для записів).' },
      'safety.permissions-policy': { title: 'Permissions-Policy: tools= заголовок встановлено', howToFix: 'Якщо твою сторінку можна вбудувати в iframe з іншого origin, встанови Permissions-Policy: tools=(self "https://trusted.com") щоб контролювати, хто може викликати твої tools. Дефолт — лише self, що безпечно, але невидимо — явне налаштування документує намір.' },
      'safety.execute-smoke': { title: 'executeTool резолвиться без помилок', howToFix: 'Tool кинув виключення або таймаутнув при виклику з синтезованим входом. Часті причини: вимагає user gesture (declarative форми часто), бракує required поля, яке схема не позначила як required, або execute() awaitить щось, що ніколи не резолвиться в headless.' }
    }
  }
};

export function detectLang() {
  // 1) URL ?lang= param
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && SUPPORTED_LANGS.includes(urlLang)) return urlLang;
  // 2) localStorage
  try {
    const stored = window.localStorage.getItem('webmcp-auditor-lang');
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  } catch {}
  // 3) navigator.language
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGS.includes(nav)) return nav;
  return 'en';
}

export function setLang(lang) {
  try { window.localStorage.setItem('webmcp-auditor-lang', lang); } catch {}
}

function format(s, vars) {
  if (!s) return s;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null) ? String(vars[k]) : '');
}

// Plural-aware suffix substitution. Vars contains a numeric and an 's' template token.
// English {s} → '' / 's'; Ukrainian {s} → empty (we use natural forms where reasonable).
export function t(lang, key, vars) {
  const dict = D[lang] || D.en;
  const value = getPath(dict, key);
  if (value == null) {
    const fallback = getPath(D.en, key);
    return format(fallback, vars);
  }
  return format(value, vars);
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

// Look up a category translation by id; fall back to API-returned text if missing.
export function categoryText(lang, catId, apiFallback) {
  const c = (D[lang] && D[lang].categories && D[lang].categories[catId]) || null;
  return {
    title: (c && c.title) || (apiFallback && apiFallback.title) || catId,
    description: (c && c.description) || (apiFallback && apiFallback.description) || '',
    hint: (c && c.hint) || null
  };
}

// Look up a check translation by id; fall back to API-returned text if missing.
export function checkText(lang, checkId, apiFallback) {
  const c = (D[lang] && D[lang].checks && D[lang].checks[checkId]) || null;
  return {
    title: (c && c.title) || (apiFallback && apiFallback.title) || checkId,
    howToFix: (c && c.howToFix) || (apiFallback && apiFallback.howToFix) || null
  };
}
