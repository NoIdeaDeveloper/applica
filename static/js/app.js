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

function salaryRange(min, max) {
    if (!min && !max) return "—";
    const fmt = n => "$" + Number(n).toLocaleString();
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    return min ? fmt(min) + "+" : "Up to " + fmt(max);
}

// Router
const ROUTES = [
    { pattern: /^\/applications\/(\d+)\/edit$/, render: id => ApplicationForm.render(id), mount: id => ApplicationForm.mount(id) },
    { pattern: /^\/applications\/(\d+)$/, render: id => ApplicationDetail.render(id), mount: id => ApplicationDetail.mount(id) },
    { pattern: /^\/applications\/new$/, render: () => ApplicationForm.render(), mount: () => ApplicationForm.mount() },
    { pattern: /^\/applications$/, render: () => Applications.render(), mount: () => Applications.mount() },
    { pattern: /^\/$/, render: () => Dashboard.render(), mount: () => {} },
];

function getRoute(hash) {
    for (const route of ROUTES) {
        const m = route.pattern.exec(hash);
        if (m) return { render: () => route.render(m[1]), mount: () => route.mount(m[1]) };
    }
    return { render: () => Dashboard.render(), mount: () => {} };
}

async function navigate() {
    const hash = location.hash.slice(1) || "/";
    const { render, mount } = getRoute(hash);
    const app = document.getElementById("app");
    try {
        app.innerHTML = await render();
        mount();
        document.querySelectorAll("nav a").forEach(a => {
            a.classList.toggle("active", a.getAttribute("href") === "#" + hash);
        });
    } catch (e) {
        app.innerHTML = `<div class="error-msg">Error: ${esc(e.message)}</div>`;
    }
}

window.addEventListener("hashchange", navigate);
window.addEventListener("DOMContentLoaded", navigate);
