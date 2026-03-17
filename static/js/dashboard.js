const Dashboard = {
    async render() {
        const [stats, apps] = await Promise.all([
            API.getStats(),
            API.getApplications({ sort: "updated_at DESC" }),
        ]);
        const recent = apps.slice(0, 5);
        const statuses = ["applied", "interviewing", "offer", "rejected", "ghosted"];
        const maxWeekly = Math.max(...(stats.weekly.map(w => w.count) || [1]), 1);

        return `
        <div class="dashboard">
            <h1>Dashboard</h1>
            <div class="stats-grid">
                <div class="stat-card stat-total">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">Total</div>
                </div>
                ${statuses.map(s => `
                    <div class="stat-card stat-${s}">
                        <div class="stat-number">${stats.by_status[s] || 0}</div>
                        <div class="stat-label">${s}</div>
                    </div>
                `).join("")}
            </div>

            <div class="dashboard-row">
                <div class="card">
                    <h2>Applications per Week</h2>
                    <div class="bar-chart">
                        ${stats.weekly.length ? stats.weekly.map(w => `
                            <div class="bar-group">
                                <div class="bar" style="height: ${(w.count / maxWeekly) * 100}%">
                                    <span class="bar-value">${w.count}</span>
                                </div>
                                <div class="bar-label">W${w.week.split("-")[1]}</div>
                            </div>
                        `).join("") : '<p class="empty-state">No data yet</p>'}
                    </div>
                </div>

                <div class="card">
                    <h2>Recent Activity</h2>
                    ${recent.length ? `
                    <div class="recent-list">
                        ${recent.map(a => `
                            <a href="#/applications/${a.id}" class="recent-item">
                                <div class="recent-info">
                                    <strong>${esc(a.company)}</strong>
                                    <span>${esc(a.title)}</span>
                                </div>
                                ${statusBadge(a.status)}
                            </a>
                        `).join("")}
                    </div>` : '<p class="empty-state">No applications yet. <a href="#/applications/new">Add your first one!</a></p>'}
                </div>
            </div>

            <div class="quick-stats">
                <span><strong>${stats.this_week}</strong> this week</span>
                <span><strong>${stats.this_month}</strong> this month</span>
            </div>
        </div>`;
    }
};
