const Applications = {
    async render() {
        return `
        <div class="applications-page">
            <div class="page-header">
                <h1>Applications</h1>
                <a href="#/applications/new" class="btn btn-primary">+ New Application</a>
            </div>
            <div class="filters">
                <input type="text" id="search-input" placeholder="Search company or title..." class="input">
                <select id="status-filter" class="input">
                    <option value="">All Statuses</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                    <option value="ghosted">Ghosted</option>
                </select>
                <select id="sort-select" class="input">
                    <option value="date_applied DESC">Newest First</option>
                    <option value="date_applied ASC">Oldest First</option>
                    <option value="company ASC">Company A-Z</option>
                    <option value="company DESC">Company Z-A</option>
                    <option value="updated_at DESC">Recently Updated</option>
                </select>
            </div>
            <div id="applications-list"></div>
        </div>`;
    },

    mount() {
        const PAGE_SIZE = 25;
        let currentPage = 0;

        const searchInput = document.getElementById("search-input");
        const statusFilter = document.getElementById("status-filter");
        const sortSelect = document.getElementById("sort-select");

        const load = async () => {
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
                container.innerHTML = '<p class="empty-state">No applications found.</p>';
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
                            <th>Company</th>
                            <th>Position</th>
                            <th>Status</th>
                            <th>Date Applied</th>
                            <th>Salary</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apps.map(a => `
                            <tr class="clickable-row" data-id="${a.id}">
                                <td><strong>${esc(a.company)}</strong></td>
                                <td>${esc(a.title)}</td>
                                <td>${statusBadge(a.status)}</td>
                                <td>${formatDate(a.date_applied)}</td>
                                <td>${salaryRange(a.salary_min, a.salary_max)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
                ${paginationHtml}`;

            container.querySelectorAll(".clickable-row").forEach(row => {
                row.addEventListener("click", () => {
                    location.hash = `/applications/${row.dataset.id}`;
                });
            });

            document.getElementById("prev-page")?.addEventListener("click", () => {
                currentPage--;
                load();
            });
            document.getElementById("next-page")?.addEventListener("click", () => {
                currentPage++;
                load();
            });
        };

        const resetAndLoad = () => { currentPage = 0; load(); };

        let debounce;
        searchInput.addEventListener("input", () => {
            clearTimeout(debounce);
            debounce = setTimeout(resetAndLoad, 300);
        });
        statusFilter.addEventListener("change", resetAndLoad);
        sortSelect.addEventListener("change", resetAndLoad);

        load();
    }
};
