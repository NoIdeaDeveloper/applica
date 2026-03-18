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
                        <label for="location">Location</label>
                        <input type="text" id="location" name="location" class="input" value="${esc(app?.location || "")}" placeholder="Remote, New York, NY, Hybrid…">
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
                        <label for="resume">Resume${app?.resume_path ? " (replace)" : ""} <span class="file-size-hint">max 10 MB</span></label>
                        ${app?.resume_path ? `<p class="file-current">Current: <a href="/api/applications/${id}/resume" target="_blank">${esc(app.resume_path)}</a></p>` : ""}
                        <input type="file" id="resume" name="resume" class="input-file">
                    </div>
                    <div class="form-group">
                        <label for="cover_letter">Cover Letter${app?.cover_letter_path ? " (replace)" : ""} <span class="file-size-hint">max 10 MB</span></label>
                        ${app?.cover_letter_path ? `<p class="file-current">Current: <a href="/api/applications/${id}/cover-letter" target="_blank">${esc(app.cover_letter_path)}</a></p>` : ""}
                        <input type="file" id="cover_letter" name="cover_letter" class="input-file">
                    </div>
                </div>

                <div id="duplicate-warning" class="form-warning" hidden></div>
                <div id="form-error" class="form-error" hidden></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Add Application"}</button>
                    <a href="#${isEdit ? "/applications/" + id : "/applications"}" class="btn btn-secondary">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    mount(id) {
        const form = document.getElementById("app-form");
        const errorBanner = document.getElementById("form-error");

        const showFormError = (msg) => {
            errorBanner.textContent = msg;
            errorBanner.hidden = false;
            errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
        };

        const clearFormError = () => {
            errorBanner.hidden = true;
            errorBanner.textContent = "";
        };

        // Inline field validation
        const validators = [
            { field: form.company, message: "Company name is required." },
            { field: form.title,   message: "Job title is required." },
        ];

        const validateField = (field, message) => {
            const group = field.closest(".form-group");
            const existing = group.querySelector(".field-error");
            if (!field.value.trim()) {
                field.classList.add("input-error");
                if (!existing) {
                    const err = document.createElement("span");
                    err.className = "field-error";
                    err.textContent = message;
                    group.appendChild(err);
                }
                return false;
            }
            field.classList.remove("input-error");
            existing?.remove();
            return true;
        };

        validators.forEach(({ field, message }) => {
            field.addEventListener("input", () => validateField(field, message));
        });

        // Duplicate detection (only on new application form)
        const dupWarning = document.getElementById("duplicate-warning");
        if (!id) {
            let dupDebounce;
            const checkDuplicate = async () => {
                const company = form.company.value.trim();
                const title = form.title.value.trim();
                if (!company || !title) { dupWarning.hidden = true; return; }
                clearTimeout(dupDebounce);
                dupDebounce = setTimeout(async () => {
                    try {
                        const { duplicates } = await API.checkDuplicate(company, title);
                        if (duplicates.length) {
                            const d = duplicates[0];
                            dupWarning.innerHTML = `Possible duplicate: <a href="#/applications/${d.id}">${esc(d.company)} – ${esc(d.title)}</a> (${esc(d.status)}, applied ${formatDate(d.date_applied)}). You can still save.`;
                            dupWarning.hidden = false;
                        } else {
                            dupWarning.hidden = true;
                        }
                    } catch (_) { /* ignore */ }
                }, 500);
            };
            form.company.addEventListener("input", checkDuplicate);
            form.title.addEventListener("input", checkDuplicate);
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearFormError();

            const valid = validators.every(({ field, message }) => validateField(field, message));
            if (!valid) return;

            const salaryMin = form.salary_min.value !== "" ? parseInt(form.salary_min.value) : null;
            const salaryMax = form.salary_max.value !== "" ? parseInt(form.salary_max.value) : null;
            if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
                showFormError("Salary minimum cannot be greater than maximum.");
                return;
            }

            // Client-side file size check (10 MB)
            const MAX_BYTES = 10 * 1024 * 1024;
            const resumeFile = document.getElementById("resume").files[0];
            const coverFile = document.getElementById("cover_letter").files[0];
            if (resumeFile && resumeFile.size > MAX_BYTES) {
                showFormError(`Resume exceeds the 10 MB limit (${(resumeFile.size / 1024 / 1024).toFixed(1)} MB).`);
                return;
            }
            if (coverFile && coverFile.size > MAX_BYTES) {
                showFormError(`Cover letter exceeds the 10 MB limit (${(coverFile.size / 1024 / 1024).toFixed(1)} MB).`);
                return;
            }

            const data = {
                company: form.company.value.trim(),
                title: form.title.value.trim(),
                url: form.url.value || null,
                status: form.status.value,
                location: form.location.value.trim() || null,
                date_applied: form.date_applied.value || null,
                salary_min: salaryMin,
                salary_max: salaryMax,
                notes: form.notes.value || null,
            };

            const submitBtn = form.querySelector("[type=submit]");
            const originalLabel = submitBtn.textContent;
            submitBtn.disabled = true;

            try {
                let app;
                if (id) {
                    app = await API.updateApplication(id, data);
                } else {
                    app = await API.createApplication(data);
                }

                // Upload files in parallel if selected
                const uploads = [];
                if (resumeFile) uploads.push(API.uploadResume(app.id, resumeFile));
                if (coverFile) uploads.push(API.uploadCoverLetter(app.id, coverFile));
                if (uploads.length) {
                    submitBtn.textContent = `Uploading file${uploads.length > 1 ? "s" : ""}…`;
                    await Promise.all(uploads);
                }

                showToast(id ? "Application updated." : "Application added.");
                location.hash = `/applications/${app.id}`;
            } catch (err) {
                showFormError("Error: " + err.message);
                submitBtn.textContent = originalLabel;
                submitBtn.disabled = false;
            }
        });
    }
};
