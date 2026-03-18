const ApplicationForm = {
    async render(id) {
        let app = null;
        if (id) {
            app = await API.getApplication(id);
        }
        const isEdit = !!app;

        return `
        <div class="form-page">
            <nav class="breadcrumb">${isEdit ? `<a href="#/applications/${id}">← ${esc(app.company)}</a>` : '<a href="#/applications">← Applications</a>'}</nav>
            <h1>${isEdit ? "Edit" : "New"} Application</h1>
            <form id="app-form" class="form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="company">Company *</label>
                        <input type="text" id="company" name="company" class="input" required value="${esc(app?.company || "")}">
                    </div>
                    <div class="form-group">
                        <label for="title">Job Title *</label>
                        <input type="text" id="title" name="title" class="input" required value="${esc(app?.title || "")}">
                    </div>
                    <div class="form-group">
                        <label for="url">Job Posting URL</label>
                        <input type="url" id="url" name="url" class="input" value="${esc(app?.url || "")}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label for="status">Status</label>
                        <select id="status" name="status" class="input">
                            ${["applied", "interviewing", "offer", "rejected", "ghosted"].map(s =>
                                `<option value="${s}" ${(app?.status || "applied") === s ? "selected" : ""}>${s}</option>`
                            ).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="date_applied">Date Applied</label>
                        <input type="date" id="date_applied" name="date_applied" class="input" value="${app?.date_applied || getTodayISO()}">
                    </div>
                    <div class="form-group form-group-salary">
                        <label>Salary Range</label>
                        <div class="salary-inputs">
                            <input type="number" id="salary_min" name="salary_min" class="input" placeholder="Min" value="${app?.salary_min || ""}">
                            <span>–</span>
                            <input type="number" id="salary_max" name="salary_max" class="input" placeholder="Max" value="${app?.salary_max || ""}">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="notes">Notes</label>
                    <textarea id="notes" name="notes" class="input" rows="4">${esc(app?.notes || "")}</textarea>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label for="resume">Resume${app?.resume_path ? " (replace)" : ""}</label>
                        ${app?.resume_path ? `<p class="file-current">Current: <a href="/api/applications/${id}/resume" target="_blank">${esc(app.resume_path)}</a></p>` : ""}
                        <input type="file" id="resume" name="resume" class="input-file">
                    </div>
                    <div class="form-group">
                        <label for="cover_letter">Cover Letter${app?.cover_letter_path ? " (replace)" : ""}</label>
                        ${app?.cover_letter_path ? `<p class="file-current">Current: <a href="/api/applications/${id}/cover-letter" target="_blank">${esc(app.cover_letter_path)}</a></p>` : ""}
                        <input type="file" id="cover_letter" name="cover_letter" class="input-file">
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Add Application"}</button>
                    <a href="#${isEdit ? "/applications/" + id : "/applications"}" class="btn btn-secondary">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    mount(id) {
        const form = document.getElementById("app-form");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = {
                company: form.company.value,
                title: form.title.value,
                url: form.url.value || null,
                status: form.status.value,
                date_applied: form.date_applied.value || null,
                salary_min: form.salary_min.value ? parseInt(form.salary_min.value) : null,
                salary_max: form.salary_max.value ? parseInt(form.salary_max.value) : null,
                notes: form.notes.value || null,
            };

            try {
                let app;
                if (id) {
                    app = await API.updateApplication(id, data);
                } else {
                    app = await API.createApplication(data);
                }

                // Upload files in parallel if selected
                const resumeFile = document.getElementById("resume").files[0];
                const coverFile = document.getElementById("cover_letter").files[0];
                const uploads = [];
                if (resumeFile) uploads.push(API.uploadResume(app.id, resumeFile));
                if (coverFile) uploads.push(API.uploadCoverLetter(app.id, coverFile));
                if (uploads.length) await Promise.all(uploads);

                showToast(id ? "Application updated." : "Application added.");
                location.hash = `/applications/${app.id}`;
            } catch (err) {
                showToast("Error: " + err.message, "error");
            }
        });
    }
};
