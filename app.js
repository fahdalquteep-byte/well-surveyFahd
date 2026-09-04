/* =========================================================
   تطبيق مسح الآبار - محرك التشغيل
   Well Survey / Project Map
   ========================================================= */

'use strict';

const DB_NAME = 'wells_survey_v2';
const DB_VERSION = 1;
const STORE_NAME = 'forms';

let currentId = null;
let dbPromise = null;

/* ---------------------------------------------------------
   أدوات عامة
--------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function toast(message, type = 'success') {
    const el = $('toast');
    if (!el) return;

    el.textContent = message;
    el.style.display = 'block';
    el.dataset.type = type;

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        el.style.display = 'none';
    }, 2200);
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function makeId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return 'well-' + Date.now() + '-' +
        Math.random().toString(36).slice(2);
}

/* ---------------------------------------------------------
   قاعدة البيانات IndexedDB
--------------------------------------------------------- */

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB غير متاح في هذا المتصفح'));
            return;
        }

        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: 'id'
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });

    return dbPromise;
}

async function getAllForms() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readonly'
        );

        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function getForm(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readonly'
        );

        const request = tx
            .objectStore(STORE_NAME)
            .get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function saveForm(data) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readwrite'
        );

        tx.objectStore(STORE_NAME).put(data);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

async function deleteForm(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readwrite'
        );

        tx.objectStore(STORE_NAME).delete(id);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/* ---------------------------------------------------------
   تعريف الأقسام
--------------------------------------------------------- */

const sections = [
    ...new Set(
        (window.FIELD_DEFS || [])
            .map(field => field.section)
            .filter(Boolean)
    )
];

/* ---------------------------------------------------------
   توليد رقم استمارة تلقائي
--------------------------------------------------------- */

async function nextFormNumber() {
    const forms = await getAllForms();

    let max = 0;

    for (const form of forms) {
        const raw = form.form_no ?? form.m ?? '';

        const numbers = String(raw).match(/\d+/g);

        if (numbers) {
            const n = parseInt(
                numbers[numbers.length - 1],
                10
            );

            if (Number.isFinite(n) && n > max) {
                max = n;
            }
        }
    }

    return String(max + 1);
}

/* ---------------------------------------------------------
   بناء الاستمارة
--------------------------------------------------------- */

function renderForm(data = {}) {
    const form = $('form');

    if (!form) {
        throw new Error('عنصر form غير موجود في index.html');
    }

    form.innerHTML = '';

    for (const sectionName of sections) {
        const section = document.createElement('section');

        section.className = 'section';

        const title = document.createElement('h3');
        title.textContent = sectionName;

        const grid = document.createElement('div');
        grid.className = 'grid';

        section.appendChild(title);
        section.appendChild(grid);

        const fields = window.FIELD_DEFS.filter(
            field => field.section === sectionName
        );

        for (const field of fields) {
            const wrapper = document.createElement('div');

            wrapper.className = 'field';

            const value = data[field.id] ?? '';

            /* متعدد الاختيارات */
            if (field.type === 'multi') {
                const label = document.createElement('label');
                label.textContent = field.label;

                wrapper.appendChild(label);

                const checks = document.createElement('div');
                checks.className = 'checks';

                for (const option of field.options || []) {
                    const item = document.createElement('label');
                    item.className = 'check';

                    const input = document.createElement('input');

                    input.type = 'checkbox';
                    input.dataset.id = field.id;
                    input.value = option;

                    if (
                        Array.isArray(value) &&
                        value.includes(option)
                    ) {
                        input.checked = true;
                    }

                    item.appendChild(input);

                    const text = document.createTextNode(
                        ' ' + option
                    );

                    item.appendChild(text);
                    checks.appendChild(item);
                }

                wrapper.appendChild(checks);
            }

            /* قائمة اختيار */
            else if (field.type === 'select') {
                const label = document.createElement('label');
                label.textContent = field.label;

                const select = document.createElement('select');

                select.dataset.id = field.id;

                const empty = document.createElement('option');

                empty.value = '';
                empty.textContent = 'اختر…';

                select.appendChild(empty);

                for (const option of field.options || []) {
                    const opt = document.createElement('option');

                    opt.value = option;
                    opt.textContent = option;

                    if (String(value) === String(option)) {
                        opt.selected = true;
                    }

                    select.appendChild(opt);
                }

                wrapper.appendChild(label);
                wrapper.appendChild(select);
            }

            /* حقل عادي */
            else {
                const label = document.createElement('label');

                label.textContent = field.label;

                const input = document.createElement('input');

                input.dataset.id = field.id;
                input.type = field.type || 'text';
                input.value = value;

                if (field.readonly) {
                    input.readOnly = true;
                }

                wrapper.appendChild(label);
                wrapper.appendChild(input);
            }

            grid.appendChild(wrapper);
        }

        form.appendChild(section);
    }

    setupCalculations();
    calculatePanelPower();
}

/* ---------------------------------------------------------
   حساب قدرة الألواح
--------------------------------------------------------- */

function setupCalculations() {
    const panels = document.querySelector(
        '[data-id="panels"]'
    );

    const power = document.querySelector(
        '[data-id="panel_power"]'
    );

    if (panels) {
        panels.addEventListener(
            'input',
            calculatePanelPower
        );
    }

    if (power) {
        power.addEventListener(
            'input',
            calculatePanelPower
        );
    }
}

function calculatePanelPower() {
    const panels = parseFloat(
        document.querySelector(
            '[data-id="panels"]'
        )?.value || 0
    );

    const power = parseFloat(
        document.querySelector(
            '[data-id="panel_power"]'
        )?.value || 0
    );

    const total = document.querySelector(
        '[data-id="total_panel_power"]'
    );

    if (!total) return;

    if (
        Number.isFinite(panels) &&
        Number.isFinite(power) &&
        panels > 0 &&
        power > 0
    ) {
        total.value = panels * power;
    } else {
        total.value = '';
    }
}

/* ---------------------------------------------------------
   قراءة البيانات من الاستمارة
--------------------------------------------------------- */

function readForm() {
    const data = {};

    for (const field of window.FIELD_DEFS || []) {
        if (field.type === 'multi') {
            data[field.id] = [
                ...document.querySelectorAll(
                    `input[data-id="${field.id}"]:checked`
                )
            ].map(input => input.value);
        } else {
            const element = document.querySelector(
                `[data-id="${field.id}"]`
            );

            data[field.id] = element
                ? element.value
                : '';
        }
    }

    return data;
}

/* ---------------------------------------------------------
   فتح المحرر
--------------------------------------------------------- */

async function showEditor(data = {}, id = null) {
    currentId = id;

    const editor = $('editor');
    const list = $('list');
    const title = $('editorTitle');

    if (!editor || !list) {
        toast(
            'تعذر فتح محرر الاستمارة',
            'error'
        );
        return;
    }

    if (!id && !data.form_no) {
        try {
            data.form_no = await nextFormNumber();
        } catch (error) {
            console.error(error);
        }
    }

    if (!data.survey_date) {
        data.survey_date = today();
    }

    editor.classList.remove('hidden');
    list.classList.add('hidden');

    if (title) {
        title.textContent = id
            ? 'تعديل الاستمارة'
            : 'استمارة جديدة';
    }

    renderForm(data);

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/* ---------------------------------------------------------
   إغلاق المحرر
--------------------------------------------------------- */

function closeEditor() {
    currentId = null;

    $('editor')?.classList.add('hidden');
    $('list')?.classList.remove('hidden');

    renderList();
}

/* ---------------------------------------------------------
   حفظ
--------------------------------------------------------- */

async function saveCurrentForm() {
    try {
        const data = readForm();

        if (!data.form_no) {
            data.form_no = await nextFormNumber();
        }

        if (!data.survey_date) {
            data.survey_date = today();
        }

        data.id = currentId || makeId();

        data.created =
            data.created ||
            new Date().toISOString();

        data.updated =
            new Date().toISOString();

        await saveForm(data);

        currentId = data.id;

        toast('تم حفظ الاستمارة بنجاح');

        await renderList();

        $('editor')?.classList.add('hidden');
        $('list')?.classList.remove('hidden');

    } catch (error) {
        console.error(
            'Save error:',
            error
        );

        toast(
            'حدث خطأ أثناء حفظ الاستمارة',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   عرض السجلات
--------------------------------------------------------- */

async function renderList() {
    try {
        const list = $('list');

        if (!list) return;

        let forms = await getAllForms();

        const search = (
            $('search')?.value || ''
        )
            .trim()
            .toLowerCase();

        if (search) {
            forms = forms.filter(form => {
                return Object.values(form)
                    .flat()
                    .join(' ')
                    .toLowerCase()
                    .includes(search);
            });
        }

        forms.sort((a, b) => {
            return String(
                b.updated || ''
            ).localeCompare(
                String(a.updated || '')
            );
        });

        if (!forms.length) {
            list.innerHTML = `
                <p class="muted">
                    لا توجد استمارات محفوظة.
                    <br>
                    اضغط «استمارة جديدة» للبدء.
                </p>
            `;
            return;
        }

        list.innerHTML = forms.map(form => {
            const id = escapeHTML(form.id);

            const formNo = escapeHTML(
                form.form_no ||
                form.m ||
                'بدون رقم'
            );

            const location = escapeHTML(
                form.site_name ||
                form.address ||
                form.village ||
                'موقع غير محدد'
            );

            const owner = escapeHTML(
                form.owner ||
                'بدون مالك'
            );

            const date = escapeHTML(
                form.survey_date ||
                ''
            );

            const status = escapeHTML(
                form.status ||
                ''
            );

            return `
                <article
                    class="card"
                    data-id="${id}"
                    tabindex="0"
                    role="button"
                >
                    <h3>
                        استمارة رقم ${formNo}
                    </h3>

                    <div>
                        ${location}
                    </div>

                    <div class="muted">
                        ${owner}
                        ${date ? ' — ' + date : ''}
                    </div>

                    ${
                        status
                            ? `<div class="muted">
                                الحالة: ${status}
                               </div>`
                            : ''
                    }
                </article>
            `;
        }).join('');

        document
            .querySelectorAll('.card[data-id]')
            .forEach(card => {

                const open = async () => {
                    const form = await getForm(
                        card.dataset.id
                    );

                    if (form) {
                        showEditor(
                            form,
                            form.id
                        );
                    }
                };

                card.addEventListener(
                    'click',
                    open
                );

                card.addEventListener(
                    'keydown',
                    event => {
                        if (
                            event.key === 'Enter' ||
                            event.key === ' '
                        ) {
                            event.preventDefault();
                            open();
                        }
                    }
                );
            });

    } catch (error) {
        console.error(
            'Render list error:',
            error
        );

        toast(
            'تعذر تحميل الاستمارات',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   نسخ استمارة
--------------------------------------------------------- */

async function duplicateCurrentForm() {
    if (!currentId) {
        toast(
            'افتح استمارة أولًا لنسخها',
            'error'
        );
        return;
    }

    try {
        const original = await getForm(
            currentId
        );

        if (!original) {
            toast(
                'الاستمارة غير موجودة',
                'error'
            );
            return;
        }

        const copy = {
            ...original,

            id: makeId(),

            form_no:
                await nextFormNumber(),

            created:
                new Date().toISOString(),

            updated:
                new Date().toISOString()
        };

        await saveForm(copy);

        toast(
            'تم نسخ الاستمارة'
        );

        await showEditor(
            copy,
            copy.id
        );

    } catch (error) {
        console.error(error);

        toast(
            'تعذر نسخ الاستمارة',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   حذف
--------------------------------------------------------- */

async function deleteCurrentForm() {
    if (!currentId) {
        toast(
            'لا توجد استمارة محددة',
            'error'
        );
        return;
    }

    const confirmed = window.confirm(
        'هل أنت متأكد من حذف هذه الاستمارة؟\nلا يمكن التراجع عن الحذف.'
    );

    if (!confirmed) return;

    try {
        await deleteForm(currentId);

        currentId = null;

        $('editor')?.classList.add('hidden');
        $('list')?.classList.remove('hidden');

        await renderList();

        toast(
            'تم حذف الاستمارة'
        );

    } catch (error) {
        console.error(error);

        toast(
            'تعذر حذف الاستمارة',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   تصدير CSV متوافق مع Excel
--------------------------------------------------------- */

function csvCell(value) {
    let text;

    if (Array.isArray(value)) {
        text = value.join('، ');
    } else {
        text = value ?? '';
    }

    return '"' +
        String(text)
            .replace(/"/g, '""') +
        '"';
}

async function exportCSV() {
    try {
        const forms = await getAllForms();

        if (!forms.length) {
            toast(
                'لا توجد بيانات للتصدير',
                'error'
            );
            return;
        }

        const fields =
            window.FIELD_DEFS || [];

        const headers =
            fields.map(
                field => field.label
            );

        const rows = forms.map(form => {
            return fields.map(
                field => csvCell(
                    form[field.id]
                )
            );
        });

        const csv =
            '\ufeff' +
            [
                headers.map(csvCell),
                ...rows
            ]
                .map(row => row.join(','))
                .join('\r\n');

        const blob = new Blob(
            [csv],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement('a');

        link.href = url;

        link.download =
            'استمارات_مسح_الآبار_' +
            new Date()
                .toISOString()
                .slice(0, 10) +
            '.csv';

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        toast(
            `تم تصدير ${forms.length} استمارة`
        );

    } catch (error) {
        console.error(error);

        toast(
            'تعذر تصدير البيانات',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   ربط الأزرار
--------------------------------------------------------- */

function bindEvents() {
    const newButton = $('newBtn');
    const closeButton = $('closeBtn');
    const saveButton = $('saveBtn');
    const deleteButton = $('deleteBtn');
    const exportButton = $('exportAll');
    const searchInput = $('search');

    if (newButton) {
        newButton.addEventListener(
            'click',
            () => showEditor()
        );
    }

    if (closeButton) {
        closeButton.addEventListener(
            'click',
            closeEditor
        );
    }

    if (saveButton) {
        saveButton.addEventListener(
            'click',
            event => {
                event.preventDefault();
                saveCurrentForm();
            }
        );
    }

    if (deleteButton) {
        deleteButton.addEventListener(
            'click',
            deleteCurrentForm
        );
    }

    if (exportButton) {
        exportButton.addEventListener(
            'click',
            exportCSV
        );
    }

    if (searchInput) {
        searchInput.addEventListener(
            'input',
            renderList
        );
    }
}

/* ---------------------------------------------------------
   اختصارات لوحة المفاتيح
--------------------------------------------------------- */

function bindKeyboard() {
    document.addEventListener(
        'keydown',
        event => {

            if (
                (event.ctrlKey ||
                 event.metaKey) &&
                event.key.toLowerCase() === 's'
            ) {
                event.preventDefault();

                if (
                    $('editor') &&
                    !$('editor').classList.contains(
                        'hidden'
                    )
                ) {
                    saveCurrentForm();
                }
            }

            if (event.key === 'Escape') {
                if (
                    $('editor') &&
                    !$('editor').classList.contains(
                        'hidden'
                    )
                ) {
                    closeEditor();
                }
            }
        }
    );
}

/* ---------------------------------------------------------
   فحص سلامة التطبيق
--------------------------------------------------------- */

async function startupCheck() {
    try {
        if (
            !Array.isArray(
                window.FIELD_DEFS
            ) ||
            !window.FIELD_DEFS.length
        ) {
            throw new Error(
                'FIELD_DEFS غير موجودة'
            );
        }

        await openDB();

        console.log(
            'Well Survey: database ready'
        );

    } catch (error) {
        console.error(
            'Startup error:',
            error
        );

        toast(
            'تعذر تشغيل قاعدة البيانات',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   Service Worker
--------------------------------------------------------- */

function registerServiceWorker() {
    if (
        'serviceWorker' in navigator
    ) {
        window.addEventListener(
            'load',
            () => {
                navigator.serviceWorker
                    .register('sw.js')
                    .then(() => {
                        console.log(
                            'Service Worker registered'
                        );
                    })
                    .catch(error => {
                        console.warn(
                            'Service Worker:',
                            error
                        );
                    });
            }
        );
    }
}

/* ---------------------------------------------------------
   التشغيل
--------------------------------------------------------- */

async function initApp() {
    try {
        bindEvents();
        bindKeyboard();

        await startupCheck();

        await renderList();

        registerServiceWorker();

        console.log(
            'مسح الآبار: تم تشغيل التطبيق بنجاح'
        );

    } catch (error) {
        console.error(
            'Fatal application error:',
            error
        );

        toast(
            'حدث خطأ أثناء تشغيل التطبيق',
            'error'
        );
    }
}

/* ---------------------------------------------------------
   بدء التطبيق بعد تحميل الصفحة
--------------------------------------------------------- */

if (
    document.readyState === 'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        initApp
    );
} else {
    initApp();
         }}
console.log('APP READY');
