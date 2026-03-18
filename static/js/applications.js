const Applications = {
    async render(params = new URLSearchParams()) {
        const search = params.get("search") || "";
        const status = params.get("status") || "";
        const sort = params.get("sort") || "date_applied DESC";
        const statuses = ["applied", "interviewing", "offer", "rejected", "ghosted"];
        const sorts = [
            ["date_applied DESC", "Newest First"],
            ["date_applied ASC", "Oldest First"],
            ["company ASC", "Company A-Z"],
            ["company DESC", "Company Z-A"],
            ["updated_at DESC", "Recently Updated"],
        ];
        return `
        <div class="applications-page">
            <div class="page-header">
                <h1>Applications</h1>
                <div class="header-actions">
                    <div class="export-dropdown">
                        <button class="btn btn-secondary" id="export-btn">Export ▾</button>
                        <div class="export-menu" id="export-menu" hidden>
                            <button data-fmt="csv">Download CSV</button>
                            <button data-fmt="json">Download JSON</button>
                        </div>
                    </div>
                    <a href="#/applications/new" class="btn btn-primary">+ New Application</a>
                </div>
            </div>
            <div class="filters">
                <input type="text" id="search-input" placeholder="Search company or title..." class="input" value="${esc(search)}">
                <select id="status-filter" class="input">
                    <option value="">All Statuses</option>
                    ${statuses.map(s => `<option value="${s}" ${status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}
                </select>
                <select id="sort-select" class="input">
                    ${sorts.map(([val, label]) => `<option value="${val}" ${sort === val ? "selected" : ""}>${label}</option>`).join("")}
                </select>
            </div>
            <div id="bulk-bar" class="bulk-bar" hidden>
                <span id="bulk-count"></span>
                <select id="bulk-status" class="input input-sm">
                    <option value="">Set status…</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                    <option value="ghosted">Ghosted</option>
                </select>
                <button id="bulk-update-btn" class="btn btn-secondary btn-sm">Update Status</button>
                <button id="bulk-delete-btn" class="btn btn-danger btn-sm">Delete Selected</button>
            </div>
            <div id="applications-list"></div>
        </div>`;
    },

    mount(params = new URLSearchParams()) {
        const PAGE_SIZE = 25;
        let currentPage = parseInt(params.get("page") || "0");

        const searchInput = document.getElementById("search-input");
        const statusFilter = document.getElementById("status-filter");
        const sortSelect = document.getElementById("sort-select");

        const pushState = () => {
            const qs = new URLSearchParams();
            if (searchInput.value) qs.set("search", searchInput.value);
            if (statusFilter.value) qs.set("status", statusFilter.value);
            if (sortSelect.value !== "date_applied DESC") qs.set("sort", sortSelect.value);
            if (currentPage > 0) qs.set("page", currentPage);
            const newHash = "/applications" + (qs.toString() ? "?" + qs.toString() : "");
            // Replace state without triggering navigation
            history.replaceState(null, "", "#" + newHash);
        };
        const bulkBar = document.getElementById("bulk-bar");
        const bulkCount = document.getElementById("bulk-count");
        const bulkStatus = document.getElementById("bulk-status");

        const getSelected = () => [...document.querySelectorAll(".row-check:checked")].map(cb => parseInt(cb.dataset.id));

        const updateBulkBar = () => {
            const selected = getSelected();
            bulkBar.hidden = selected.length === 0;
            bulkCount.textContent = `${selected.length} selected`;
        };

        const load = async () => {
            pushState();
            const params = { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE };
            if (searchInput.value) params.search = searchInput.value;
            if (statusFilter.value) params.status = statusFilter.value;
            params.sort = sortSelect.value;

            const container = document.getElementById("applications-list");
            let result;
            try {
                result = await API.getApplications(params);
            } catch (err) {
                container.innerHTML = `<p class="error-msg">Failed to load: ${esc(err.message)}</p>`;
                return;
            }

            const { items: apps, total } = result;
            const totalPages = Math.ceil(total / PAGE_SIZE);

            if (!apps.length) {
                const isFiltered = searchInput.value || statusFilter.value;
                container.innerHTML = isFiltered
                    ? `<div class="empty-state-block">
                           <p class="empty-state">No applications match your filters.</p>
                           <button class="btn btn-secondary" id="clear-filters">Clear filters</button>
                       </div>`
                    : `<div class="empty-state-block">
                           <p class="empty-state">No applications yet.</p>
                           <a href="#/applications/new" class="btn btn-primary">+ Add your first application</a>
                       </div>`;
                document.getElementById("clear-filters")?.addEventListener("click", () => {
                    searchInput.value = "";
                    statusFilter.value = "";
                    sortSelect.value = "date_applied DESC";
                    resetAndLoad();
                });
                return;
            }

            const paginationHtml = totalPages > 1 ? `
                <div class="pagination">
                    <button class="btn btn-secondary" id="prev-page" ${currentPage === 0 ? "disabled" : ""}>← Prev</button>
                    <span class="pagination-info">Page ${currentPage + 1} of ${totalPages} <span class="text-dim">(${total} total)</span></span>
                    <button class="btn btn-secondary" id="next-page" ${currentPage >= totalPages - 1 ? "disabled" : ""}>Next →</button>
                </div>` : "";

            container.innerHTML = `
                <table class="app-table">
                    <thead>
                        <tr>
                            <th class="col-check"><input type="checkbox" id="select-all" title="Select all"></th>
                            <th>Company</th>
                            <th>Position</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Date Applied</th>
                            <th>Salary</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apps.map(a => `
                            <tr class="clickable-row" data-id="${a.id}">
                                <td class="col-check"><input type="checkbox" class="row-check" data-id="${a.id}"></td>
                                <td><strong>${esc(a.company)}</strong></td>
                                <td>${esc(a.title)}</td>
                                <td class="text-dim">${esc(a.location || "—")}</td>
                                <td>${statusBadge(a.status)}</td>
                                <td>${formatDate(a.date_applied)}</td>
                                <td>${salaryRange(a.salary_min, a.salary_max)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
                ${paginationHtml}`;

            // Select-all toggle
            document.getElementById("select-all").addEventListener("change", (e) => {
                document.querySelectorAll(".row-check").forEach(cb => cb.checked = e.target.checked);
                updateBulkBar();
            });

            // Individual checkbox changes
            container.querySelectorAll(".row-check").forEach(cb => {
                cb.addEventListener("change", updateBulkBar);
            });

            // Row click — skip if clicking the checkbox cell
            container.querySelectorAll(".clickable-row").forEach(row => {
                row.addEventListener("click", (e) => {
                    if (e.target.closest(".col-check")) return;
                    location.hash = `/applications/${row.dataset.id}`;
                });
            });

            document.getElementById("prev-page")?.addEventListener("click", () => { currentPage--; load(); });
            document.getElementById("next-page")?.addEventListener("click", () => { currentPage++; load(); });

            bulkBar.hidden = true;
        };

        // Bulk action handlers (attached once, survive re-renders)
        document.getElementById("bulk-update-btn").addEventListener("click", async () => {
            const ids = getSelected();
            const status = bulkStatus.value;
            if (!ids.length) return;
            if (!status) { showToast("Select a status first.", "error"); return; }
            await API.bulkAction({ ids, action: "update_status", status });
            showToast(`Updated ${ids.length} application${ids.length > 1 ? "s" : ""}.`);
            bulkStatus.value = "";
            load();
        });

        document.getElementById("bulk-delete-btn").addEventListener("click", async () => {
            const ids = getSelected();
            if (!ids.length) return;
            if (!confirm(`Delete ${ids.length} application${ids.length > 1 ? "s" : ""} and all their data?`)) return;
            await API.bulkAction({ ids, action: "delete" });
            showToast(`Deleted ${ids.length} application${ids.length > 1 ? "s" : ""}.`);
            load();
        });

        const resetAndLoad = () => { currentPage = 0; load(); };

        let debounce;
        searchInput.addEventListener("input", () => {
            clearTimeout(debounce);
            debounce = setTimeout(resetAndLoad, 300);
        });
        statusFilter.addEventListener("change", resetAndLoad);
        sortSelect.addEventListener("change", resetAndLoad);

        load();

        // Export dropdown
        const exportBtn = document.getElementById("export-btn");
        const exportMenu = document.getElementById("export-menu");
        exportBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            exportMenu.hidden = !exportMenu.hidden;
            if (!exportMenu.hidden) {
                document.addEventListener("click", () => { exportMenu.hidden = true; }, { once: true });
            }
        });
        exportMenu.addEventListener("click", (e) => {
            const fmt = e.target.dataset.fmt;
            if (!fmt) return;
            const qs = new URLSearchParams({ format: fmt });
            if (searchInput.value) qs.set("search", searchInput.value);
            if (statusFilter.value) qs.set("status", statusFilter.value);
            window.location.href = `/api/applications/export?${qs}`;
            exportMenu.hidden = true;
        });
    }
};
