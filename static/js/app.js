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

function salaryRange(min, max) {
    const hasMin = min != null && min !== "";
    const hasMax = max != null && max !== "";
    if (!hasMin && !hasMax) return "—";
    const fmt = n => "$" + Number(n).toLocaleString();
    if (hasMin && hasMax) return `${fmt(min)} – ${fmt(max)}`;
    if (hasMin) return `${fmt(min)}+`;
    return `Up to ${fmt(max)}`;
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

// Keyboard shortcuts
(function () {
    const inInput = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    let gPressed = false;
    let gTimer = null;

    document.addEventListener("keydown", (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        // Escape: go back
        if (e.key === "Escape") {
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
