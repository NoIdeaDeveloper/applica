// Shared constants
const STATUSES = ["applied", "interviewing", "offer", "rejected", "ghosted"];

// Helpers (loaded first, available to all view modules)
function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

function getTodayISO() {
    return new Date().toISOString().split("T")[0];
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function statusBadge(status) {
    return `<span class="badge badge-${status}">${status}</span>`;
}

function formatDate(d) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
    });
}

function formatDatetime(d) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit"
    });
}

function formatCurrency(n) {
    return "$" + Number(n).toLocaleString();
}

function salaryRange(min, max) {
    const hasMin = min != null && min !== "";
    const hasMax = max != null && max !== "";
    if (!hasMin && !hasMax) return "—";
    if (hasMin && hasMax) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
    if (hasMin) return `${formatCurrency(min)}+`;
    return `Up to ${formatCurrency(max)}`;
}

// Toast notifications
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
    setTimeout(() => {
        toast.classList.remove("toast-visible");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 3000);
}

// Router
const ROUTES = [
    { pattern: /^\/applications\/(\d+)\/edit$/, render: (id, _p) => ApplicationForm.render(id), mount: (id, _p) => ApplicationForm.mount(id) },
    { pattern: /^\/applications\/(\d+)$/, render: (id, _p) => ApplicationDetail.render(id), mount: (id, _p) => ApplicationDetail.mount(id) },
    { pattern: /^\/applications\/new$/, render: (_id, _p) => ApplicationForm.render(), mount: (_id, _p) => ApplicationForm.mount() },
    { pattern: /^\/applications$/, render: (_id, p) => Applications.render(p), mount: (_id, p) => Applications.mount(p) },
    { pattern: /^\/$/, render: () => Dashboard.render(), mount: () => {} },
];

function getRoute(path) {
    for (const route of ROUTES) {
        const m = route.pattern.exec(path);
        if (m) return { render: (p) => route.render(m[1], p), mount: (p) => route.mount(m[1], p) };
    }
    return { render: () => Dashboard.render(), mount: () => {} };
}

function getHashPath() {
    const full = location.hash.slice(1) || "/";
    const [path, qs] = full.split("?");
    return { path, params: new URLSearchParams(qs || "") };
}

async function navigate() {
    const { path, params } = getHashPath();
    const { render, mount } = getRoute(path);
    const app = document.getElementById("app");
    app.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    try {
        app.innerHTML = await render(params);
        mount(params);
        document.querySelectorAll("nav a").forEach(a => {
            const href = a.getAttribute("href").slice(1); // strip leading #
            a.classList.toggle("active", path === href || (href !== "/" && path.startsWith(href)));
        });
    } catch (e) {
        app.innerHTML = `<div class="error-msg">Error: ${esc(e.message)}</div>`;
    }
}

window.addEventListener("hashchange", () => {
    // Close mobile menu on navigation
    document.getElementById("sidebar-body")?.classList.remove("open");
    navigate();
});
window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("hamburger")?.addEventListener("click", () => {
        document.getElementById("sidebar-body").classList.toggle("open");
    });
    navigate();
});

// Shortcuts modal
function showShortcutsModal() {
    if (document.getElementById("shortcuts-modal")) return;
    const modal = document.createElement("div");
    modal.id = "shortcuts-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h2>Keyboard Shortcuts</h2>
                <button class="modal-close" id="shortcuts-close">×</button>
            </div>
            <table class="shortcuts-table">
                <tbody>
                    <tr><td><kbd>n</kbd></td><td>New application</td></tr>
                    <tr><td><kbd>e</kbd></td><td>Edit application (on detail page)</td></tr>
                    <tr><td><kbd>/</kbd></td><td>Focus search</td></tr>
                    <tr><td><kbd>g</kbd> <kbd>a</kbd></td><td>Go to Applications</td></tr>
                    <tr><td><kbd>g</kbd> <kbd>d</kbd></td><td>Go to Dashboard</td></tr>
                    <tr><td><kbd>Esc</kbd></td><td>Go back / blur input</td></tr>
                    <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
                </tbody>
            </table>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.id === "shortcuts-close") modal.remove();
    });
}

// Theme toggle
(function () {
    const btn = document.getElementById("theme-toggle");
    const apply = (light) => {
        document.body.classList.toggle("light", light);
        btn.textContent = light ? "🌙 Dark mode" : "☀️ Light mode";
    };
    apply(localStorage.getItem("applica-theme") === "light");
    btn.addEventListener("click", () => {
        const light = !document.body.classList.contains("light");
        localStorage.setItem("applica-theme", light ? "light" : "dark");
        apply(light);
    });
})();

// Keyboard shortcuts
(function () {
    const inInput = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    let gPressed = false;
    let gTimer = null;

    document.addEventListener("keydown", (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        // Escape: close modal or go back
        if (e.key === "Escape") {
            if (document.getElementById("shortcuts-modal")) {
                document.getElementById("shortcuts-modal").remove();
                return;
            }
            if (inInput()) { document.activeElement.blur(); return; }
            const path = getHashPath().path;
            if (/^\/applications\/\d+\/edit$/.test(path)) {
                location.hash = path.replace("/edit", "");
            } else if (/^\/applications\/\d+$/.test(path)) {
                location.hash = "/applications";
            }
            return;
        }

        if (inInput()) return;

        // ? : show shortcuts modal
        if (e.key === "?") {
            e.preventDefault();
            showShortcutsModal();
            return;
        }

        // / : focus search on applications list
        if (e.key === "/") {
            const search = document.getElementById("search-input");
            if (search) { e.preventDefault(); search.focus(); }
            return;
        }

        // n : new application
        if (e.key === "n") {
            location.hash = "/applications/new";
            return;
        }

        // e : edit application (detail page only, not archived)
        if (e.key === "e") {
            const path = getHashPath().path;
            const match = path.match(/^\/applications\/(\d+)$/);
            if (match && !document.getElementById("restore-btn")) {
                location.hash = `/applications/${match[1]}/edit`;
            }
            return;
        }

        // g a / g d : go to section
        if (e.key === "g") {
            gPressed = true;
            clearTimeout(gTimer);
            gTimer = setTimeout(() => { gPressed = false; }, 1000);
            return;
        }
        if (gPressed) {
            gPressed = false;
            clearTimeout(gTimer);
            if (e.key === "a") location.hash = "/applications";
            if (e.key === "d") location.hash = "/";
        }
    });
})();
