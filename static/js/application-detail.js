const ApplicationDetail = {
    async render(id) {
        const app = await API.getApplication(id);
        return `
        <div class="detail-page">
            <div class="detail-header">
                <div>
                    <h1>${esc(app.company)}</h1>
                    <p class="detail-title">${esc(app.title)}</p>
                </div>
                <div class="detail-actions">
                    ${statusBadge(app.status)}
                    <a href="#/applications/${id}/edit" class="btn btn-secondary">Edit</a>
                    <button id="delete-btn" class="btn btn-danger">Delete</button>
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-field">
                    <label>Date Applied</label>
                    <span>${formatDate(app.date_applied)}</span>
                </div>
                <div class="detail-field">
                    <label>Salary Range</label>
                    <span>${salaryRange(app.salary_min, app.salary_max)}</span>
                </div>
                <div class="detail-field">
                    <label>Job Posting</label>
                    ${app.url ? `<a href="${esc(app.url)}" target="_blank" rel="noopener">${esc(app.url)}</a>` : "<span>—</span>"}
                </div>
                <div class="detail-field">
                    <label>Resume</label>
                    ${app.resume_path ? `<a href="/api/applications/${id}/resume" target="_blank">${esc(app.resume_path)}</a>` : "<span>—</span>"}
                </div>
                <div class="detail-field">
                    <label>Cover Letter</label>
                    ${app.cover_letter_path ? `<a href="/api/applications/${id}/cover-letter" target="_blank">${esc(app.cover_letter_path)}</a>` : "<span>—</span>"}
                </div>
            </div>

            ${app.notes ? `<div class="detail-notes"><label>Notes</label><p>${esc(app.notes)}</p></div>` : ""}

            <div class="followups-section">
                <h2>Follow-ups</h2>
                <form id="followup-form" class="followup-inline-form">
                    <input type="text" name="contact_name" placeholder="Contact name" class="input">
                    <input type="date" name="date" value="${getTodayISO()}" class="input">
                    <select name="method" class="input">
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="other">Other</option>
                    </select>
                    <select name="direction" class="input">
                        <option value="outbound">Outbound</option>
                        <option value="inbound">Inbound</option>
                    </select>
                    <input type="text" name="notes" placeholder="Notes" class="input followup-notes-input">
                    <button type="submit" class="btn btn-primary">Add</button>
                </form>

                <div id="followups-list">
                    ${app.followups.length ? app.followups.map(f => `
                        <div class="followup-item">
                            <div class="followup-info">
                                <span class="badge badge-${f.method}">${f.method}</span>
                                <span class="followup-direction ${f.direction}">${f.direction === "inbound" ? "&#8592;" : "&#8594;"}</span>
                                ${f.contact_name ? `<strong>${esc(f.contact_name)}</strong>` : ""}
                                <span class="followup-date">${formatDate(f.date)}</span>
                                ${f.notes ? `<span class="followup-note">${esc(f.notes)}</span>` : ""}
                            </div>
                            <button class="btn btn-sm btn-danger delete-followup" data-id="${f.id}">×</button>
                        </div>
                    `).join("") : '<p class="empty-state">No follow-ups yet.</p>'}
                </div>
            </div>
        </div>`;
    },

    mount(id) {
        document.getElementById("delete-btn").addEventListener("click", async () => {
            if (confirm("Delete this application and all its data?")) {
                await API.deleteApplication(id);
                location.hash = "/applications";
            }
        });

        document.getElementById("followup-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;
            await API.createFollowup({
                application_id: parseInt(id),
                contact_name: form.contact_name.value || null,
                date: form.date.value || null,
                method: form.method.value,
                direction: form.direction.value,
                notes: form.notes.value || null,
            });
            showToast("Follow-up added.");
            navigate(); // Re-render
        });

        document.querySelectorAll(".delete-followup").forEach(btn => {
            btn.addEventListener("click", async () => {
                await API.deleteFollowup(btn.dataset.id);
                navigate();
            });
        });
    }
};
