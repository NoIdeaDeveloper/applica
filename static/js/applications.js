const SavedSearches = {
    KEY: "applica_saved_searches",
    load() { try { return JSON.parse(localStorage.getItem(this.KEY) || "[]"); } catch { return []; } },
    save(list) { localStorage.setItem(this.KEY, JSON.stringify(list)); },
    add(name, search, status, sort) {
        const list = this.load();
        list.push({ name, search, status, sort });
        this.save(list);
    },
    remove(index) {
        const list = this.load();
        list.splice(index, 1);
        this.save(list);
    },
};

const Applications = {
    async render(params = new URLSearchParams()) {
        const search = params.get("search") || "";
        const status = params.get("status") || "";
        const sort = params.get("sort") || "date_applied DESC";
        const archived = params.get("archived") === "1";
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
                <h1>${archived ? "Archived Applications" : "Applications"}</h1>
                <div class="header-actions">
                    ${archived
                        ? `<a href="#/applications" class="btn btn-secondary">← Active</a>`
                        : `<div class="export-dropdown">
                            <button class="btn btn-secondary" id="export-btn">Export ▾</button>
                            <div class="export-menu" id="export-menu" hidden>
                                <button data-fmt="csv">Download CSV</button>
                                <button data-fmt="json">Download JSON</button>
                            </div>
                           </div>
                           <label class="btn btn-secondary" id="import-label" title="Import applications from CSV">
                               <span id="import-label-text">Import CSV</span>
                               <input type="file" id="import-input" accept=".csv" style="display:none">
                           </label>
                           <a href="#/applications?archived=1" class="btn btn-secondary">Archived</a>
                           <a href="#/applications/new" class="btn btn-primary">+ New Application</a>`}
                </div>
            </div>
            <div class="filters">
                <input type="text" id="search-input" placeholder="Search company or title..." class="input" value="${esc(search)}">
                ${!archived ? `<select id="status-filter" class="input">
                    <option value="">All Statuses</option>
                    ${statuses.map(s => `<option value="${s}" ${status === s ? "selected" : ""}>${capitalize(s)}</option>`).join("")}
                </select>` : ""}
                <select id="sort-select" class="input">
                    ${sorts.map(([val, label]) => `<option value="${val}" ${sort === val ? "selected" : ""}>${label}</option>`).join("")}
                </select>
                ${!archived ? `<button id="save-search-btn" class="btn btn-secondary btn-sm" title="Save current search" hidden>⭐ Save</button>` : ""}
            </div>
            ${!archived ? `<div id="saved-searches-bar" class="saved-searches-bar"></div>` : ""}
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
        const archived = params.get("archived") === "1";

        const searchInput = document.getElementById("search-input");
        const statusFilter = document.getElementById("status-filter");
        const sortSelect = document.getElementById("sort-select");

        const pushState = () => {
            const qs = new URLSearchParams();
            if (searchInput.value) qs.set("search", searchInput.value);
            if (statusFilter?.value) qs.set("status", statusFilter.value);
            if (sortSelect.value !== "date_applied DESC") qs.set("sort", sortSelect.value);
            if (currentPage > 0) qs.set("page", currentPage);
            if (archived) qs.set("archived", "1");
            const newHash = "/applications" + (qs.toString() ? "?" + qs.toString() : "");
            history.replaceState(null, "", "#" + newHash);
        };
        // Saved searches (active view only)
        const saveSearchBtn = document.getElementById("save-search-btn");
        const savedSearchesBar = document.getElementById("saved-searches-bar");

        const renderSavedSearches = () => {
            if (!savedSearchesBar) return;
            const list = SavedSearches.load();
            if (!list.length) { savedSearchesBar.innerHTML = ""; return; }
            savedSearchesBar.innerHTML = list.map((s, i) => `
                <span class="saved-search-chip">
                    <button class="saved-search-apply" data-index="${i}" title="Apply: ${esc(s.name)}">${esc(s.name)}</button>
                    <button class="saved-search-remove" data-index="${i}" title="Remove">×</button>
                </span>`).join("");
        };

        const updateSaveBtn = () => {
            if (!saveSearchBtn) return;
            const hasFilters = searchInput.value || statusFilter?.value || sortSelect.value !== "date_applied DESC";
            saveSearchBtn.hidden = !hasFilters;
        };

        if (saveSearchBtn) {
            saveSearchBtn.addEventListener("click", () => {
                const name = prompt("Name this search:");
                if (!name?.trim()) return;
                SavedSearches.add(name.trim(), searchInput.value, statusFilter?.value || "", sortSelect.value);
                renderSavedSearches();
            });
        }

        if (savedSearchesBar) {
            savedSearchesBar.addEventListener("click", (e) => {
                const applyBtn = e.target.closest(".saved-search-apply");
                const removeBtn = e.target.closest(".saved-search-remove");
                if (applyBtn) {
                    const s = SavedSearches.load()[parseInt(applyBtn.dataset.index)];
                    if (!s) return;
                    searchInput.value = s.search || "";
                    if (statusFilter) statusFilter.value = s.status || "";
                    sortSelect.value = s.sort || "date_applied DESC";
                    updateSaveBtn();
                    resetAndLoad();
                } else if (removeBtn) {
                    SavedSearches.remove(parseInt(removeBtn.dataset.index));
                    renderSavedSearches();
                }
            });
        }

        renderSavedSearches();

        const bulkBar = document.getElementById("bulk-bar");
        const bulkCount = document.getElementById("bulk-count");
        const bulkStatus = document.getElementById("bulk-status");

        const getSelected = () => [...document.querySelectorAll(".row-check:checked")].map(cb => parseInt(cb.dataset.id));

        const updateBulkBar = () => {
            const selected = getSelected();
            bulkBar.hidden = selected.length === 0;
            bulkCount.textContent = `${selected.length} selected`;
        };

        const closeStatusDropdown = () => {
            document.querySelector(".status-inline-menu")?.remove();
        };

        const load = async () => {
            pushState();
            const params = { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE };
            if (searchInput.value) params.search = searchInput.value;
            if (statusFilter?.value) params.status = statusFilter.value;
            params.sort = sortSelect.value;
            if (archived) params.archived = "1";

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
                const isFiltered = searchInput.value || statusFilter?.value;
                container.innerHTML = archived
                    ? `<div class="empty-state-block"><p class="empty-state">No archived applications.</p></div>`
                    : isFiltered
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
                    if (statusFilter) statusFilter.value = "";
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
                                <td class="col-status"><button class="badge badge-${a.status} status-badge-btn" data-id="${a.id}" data-status="${a.status}" title="Click to change status">${a.status}</button></td>
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

            // Row click — skip if clicking the checkbox or status cell
            container.querySelectorAll(".clickable-row").forEach(row => {
                row.addEventListener("click", (e) => {
                    if (e.target.closest(".col-check")) return;
                    if (e.target.closest(".col-status")) return;
                    location.hash = `/applications/${row.dataset.id}`;
                });
            });

            // Inline status dropdown
            container.addEventListener("click", (e) => {
                const btn = e.target.closest(".status-badge-btn");
                if (!btn) return;
                e.stopPropagation();
                closeStatusDropdown();

                const statuses = ["applied", "interviewing", "offer", "rejected", "ghosted"];
                const appId = btn.dataset.id;
                const current = btn.dataset.status;

                const menu = document.createElement("div");
                menu.className = "status-inline-menu";
                menu.innerHTML = statuses.map(s => `
                    <button class="status-inline-opt badge badge-${s} ${s === current ? "status-inline-current" : ""}" data-status="${s}">${s}</button>
                `).join("");

                const rect = btn.getBoundingClientRect();
                menu.style.top = (rect.bottom + window.scrollY + 4) + "px";
                menu.style.left = (rect.left + window.scrollX) + "px";
                document.body.appendChild(menu);

                menu.addEventListener("click", async (ev) => {
                    const opt = ev.target.closest(".status-inline-opt");
                    if (!opt) return;
                    const newStatus = opt.dataset.status;
                    closeStatusDropdown();
                    if (newStatus === current) return;
                    try {
                        await API.updateApplication(appId, { status: newStatus });
                        load();
                    } catch (err) {
                        showToast("Failed to update status: " + err.message, "error");
                    }
                });

                // Close on outside click
                setTimeout(() => {
                    document.addEventListener("click", closeStatusDropdown, { once: true });
                }, 0);
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
            try {
                await API.bulkAction({ ids, action: "update_status", status });
                showToast(`Updated ${ids.length} application${ids.length > 1 ? "s" : ""}.`);
            } catch {
                showToast("Action failed. Please try again.", "error");
            }
            bulkStatus.value = "";
            load();
        });

        document.getElementById("bulk-delete-btn").addEventListener("click", async () => {
            const ids = getSelected();
            if (!ids.length) return;
            if (!confirm(`Delete ${ids.length} application${ids.length > 1 ? "s" : ""} and all their data?`)) return;
            try {
                await API.bulkAction({ ids, action: "delete" });
                showToast(`Deleted ${ids.length} application${ids.length > 1 ? "s" : ""}.`);
            } catch {
                showToast("Action failed. Please try again.", "error");
            }
            load();
        });

        const resetAndLoad = () => { currentPage = 0; load(); };

        let debounce;
        searchInput.addEventListener("input", () => {
            clearTimeout(debounce);
            updateSaveBtn();
            debounce = setTimeout(resetAndLoad, 300);
        });
        statusFilter?.addEventListener("change", () => { updateSaveBtn(); resetAndLoad(); });
        sortSelect.addEventListener("change", () => { updateSaveBtn(); resetAndLoad(); });
        updateSaveBtn();

        load();

        // Export dropdown (only present in active view)
        const exportBtn = document.getElementById("export-btn");
        const exportMenu = document.getElementById("export-menu");
        if (exportBtn && exportMenu) {
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
            if (statusFilter?.value) qs.set("status", statusFilter.value);
            window.location.href = `/api/applications/export?${qs}`;
            exportMenu.hidden = true;
        });
        } // end if (exportBtn && exportMenu)

        // CSV import
        const importInput = document.getElementById("import-input");
        importInput?.addEventListener("change", async () => {
            const file = importInput.files[0];
            if (!file) return;
            const labelText = document.getElementById("import-label-text");
            labelText.textContent = "Importing…";
            try {
                const result = await API.importCSV(file);
                let msg, toastType;
                if (result.imported === 0) {
                    msg = `No new applications imported` + (result.skipped ? ` — ${result.skipped} row${result.skipped !== 1 ? "s" : ""} skipped.` : ".");
                    toastType = "error";
                } else {
                    msg = `Imported ${result.imported} application${result.imported !== 1 ? "s" : ""}` +
                        (result.skipped ? `, ${result.skipped} skipped` : "") + ".";
                    toastType = result.skipped ? "error" : "success";
                }
                showToast(msg, toastType);
                if (result.errors.length) {
                    console.warn("Import errors:", result.errors);
                }
                load();
            } catch (err) {
                showToast("Import failed: " + err.message, "error");
            } finally {
                labelText.textContent = "Import CSV";
                importInput.value = "";
            }
        });
    }
};
