function interviewSummary(rounds) {
    if (!rounds.length) return "";
    const counts = { passed: 0, failed: 0, pending: 0 };
    for (const r of rounds) counts[r.outcome || "pending"]++;
    const parts = [];
    if (counts.passed) parts.push(`<span class="isummary-passed">${counts.passed} passed</span>`);
    if (counts.pending) parts.push(`<span class="isummary-pending">${counts.pending} pending</span>`);
    if (counts.failed) parts.push(`<span class="isummary-failed">${counts.failed} failed</span>`);
    return `<p class="interview-summary">${rounds.length} interview round${rounds.length > 1 ? "s" : ""} — ${parts.join(", ")}</p>`;
}

function buildTimeline(app) {
    const events = [];

    events.push({
        date: app.date_applied,
        type: "applied",
        icon: "📋",
        title: "Applied",
        detail: null,
    });

    for (const r of app.interview_rounds) {
        events.push({
            date: r.date || null,
            type: "round",
            icon: "🎙️",
            title: `${STAGE_LABELS[r.stage] || r.stage} Interview`,
            detail: [
                r.interviewer ? `with ${esc(r.interviewer)}` : null,
                r.outcome && r.outcome !== "pending" ? `<span class="badge badge-round-${r.outcome}">${r.outcome}</span>` : null,
                r.notes ? `<span class="timeline-note">${esc(r.notes)}</span>` : null,
            ].filter(Boolean).join(" · "),
            sortKey: r.id,
        });
    }

    for (const f of app.followups) {
        const dir = f.direction === "inbound" ? "&#8592;" : "&#8594;";
        events.push({
            date: f.date || null,
            type: "followup",
            icon: "📬",
            title: `${capitalize(f.method)} <span class="followup-direction ${f.direction}">${dir}</span>`,
            detail: [
                f.contact_name ? `<strong>${esc(f.contact_name)}</strong>${f.contact_title ? `, ${esc(f.contact_title)}` : ""}` : null,
                f.notes ? `<span class="timeline-note">${esc(f.notes)}</span>` : null,
            ].filter(Boolean).join(" · "),
            sortKey: f.id,
        });
    }

    // Sort: events with no date go last, otherwise chronological, ties broken by insertion order (sortKey)
    events.sort((a, b) => {
        if (!a.date && !b.date) return (a.sortKey || 0) - (b.sortKey || 0);
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.sortKey || 0) - (b.sortKey || 0);
    });

    if (events.length <= 1) return ""; // Only the "applied" event — not worth showing

    return `
    <div class="timeline-section">
        <h2>Timeline</h2>
        <ol class="timeline">
            ${events.map(ev => `
            <li class="timeline-item timeline-${ev.type}">
                <span class="timeline-icon">${ev.icon}</span>
                <div class="timeline-body">
                    <div class="timeline-header">
                        <span class="timeline-title">${ev.title}</span>
                        <span class="timeline-date">${ev.date ? formatDate(ev.date) : '<span class="text-dim">No date</span>'}</span>
                    </div>
                    ${ev.detail ? `<div class="timeline-detail">${ev.detail}</div>` : ""}
                </div>
            </li>`).join("")}
        </ol>
    </div>`;
}

const STAGE_LABELS = {
    phone_screen: "Phone Screen",
    technical: "Technical",
    onsite: "Onsite",
    final: "Final",
    other: "Other",
};

const ApplicationDetail = {
    async render(id) {
        const app = await API.getApplication(id);
        return `
        <div class="detail-page" data-company="${esc(app.company)}">
            <nav class="breadcrumb"><a href="#/applications">← Applications</a></nav>
            <div class="detail-header">
                <div>
                    <h1>${esc(app.company)}</h1>
                    <p class="detail-title">${esc(app.title)}</p>
                    ${interviewSummary(app.interview_rounds)}
                </div>
                <div class="detail-actions">
                    ${statusBadge(app.status)}
                    ${app.archived ? '<span class="badge badge-archived">Archived</span>' : ""}
                    ${!app.archived ? `<a href="#/applications/${id}/edit" class="btn btn-secondary">Edit</a>` : ""}
                    <button id="print-btn" class="btn btn-secondary" title="Print / Save as PDF">Print</button>
                    ${app.archived
                        ? `<button id="restore-btn" class="btn btn-secondary">Restore</button>
                           <button id="delete-btn" class="btn btn-danger">Delete</button>`
                        : `<button id="archive-btn" class="btn btn-secondary">Archive</button>`}
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-field">
                    <label>Date Applied</label>
                    <span>${formatDate(app.date_applied)}</span>
                </div>
                <div class="detail-field">
                    <label>Base Salary</label>
                    <span>${salaryRange(app.salary_min, app.salary_max)}</span>
                </div>
                ${app.bonus != null ? `<div class="detail-field"><label>Target Bonus</label><span>${formatCurrency(app.bonus)}</span></div>` : ""}
                ${app.equity ? `<div class="detail-field"><label>Equity</label><span>${esc(app.equity)}</span></div>` : ""}
                ${app.benefits ? `<div class="detail-field"><label>Benefits</label><span>${esc(app.benefits)}</span></div>` : ""}
                <div class="detail-field">
                    <label>Location</label>
                    <span>${app.location ? esc(app.location) : "—"}</span>
                </div>
                <div class="detail-field">
                    <label>Source</label>
                    <span>${app.source ? esc(app.source) : "—"}</span>
                </div>
                <div class="detail-field">
                    <label>Industry</label>
                    <span>${app.industry ? esc(app.industry) : "—"}</span>
                </div>
                <div class="detail-field">
                    <label>Company Size</label>
                    <span>${app.company_size ? esc(app.company_size) : "—"}</span>
                </div>
                <div class="detail-field">
                    <label>Employment Type</label>
                    <span>${app.employment_type ? esc(app.employment_type) : "—"}</span>
                </div>
                <div class="detail-field">
                    <label>Seniority</label>
                    <span>${app.seniority ? esc(app.seniority) : "—"}</span>
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
                <div class="detail-field">
                    <label>Last Updated</label>
                    <span title="${esc(app.updated_at)}">${formatDatetime(app.updated_at)}</span>
                </div>
            </div>

            ${app.notes ? `<div class="detail-notes"><label>Notes</label><p>${esc(app.notes)}</p></div>` : ""}
            ${app.rejection_reason ? `<div class="detail-notes detail-rejection"><label>Rejection Reason</label><p>${esc(app.rejection_reason)}</p></div>` : ""}

            <div id="company-notes-section"></div>

            ${buildTimeline(app)}

            <div class="interviews-section">
                <h2>Interview Rounds</h2>
                <form id="round-form" class="followup-inline-form">
                    <select name="stage" class="input">
                        <option value="phone_screen">Phone Screen</option>
                        <option value="technical">Technical</option>
                        <option value="onsite">Onsite</option>
                        <option value="final">Final</option>
                        <option value="other">Other</option>
                    </select>
                    <input type="date" name="date" class="input">
                    <input type="text" name="interviewer" placeholder="Interviewer(s)" class="input">
                    <select name="outcome" class="input">
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                    </select>
                    <button type="submit" class="btn btn-primary">Add</button>
                </form>
                <textarea name="notes" form="round-form" placeholder="Notes (optional)" class="input followup-notes-textarea" rows="2"></textarea>
                <div id="rounds-list">
                    ${app.interview_rounds.length ? app.interview_rounds.map(r => `
                        <div class="followup-item">
                            <div class="followup-info">
                                <span class="badge badge-round-${r.outcome || "pending"}">${STAGE_LABELS[r.stage] || r.stage}</span>
                                ${r.date ? `<span class="followup-date">${formatDate(r.date)}</span>` : ""}
                                ${r.interviewer ? `<span>${esc(r.interviewer)}</span>` : ""}
                                ${r.notes ? `<span class="followup-note">${esc(r.notes)}</span>` : ""}
                            </div>
                            <button class="btn btn-sm btn-danger delete-round" data-id="${r.id}">×</button>
                        </div>
                    `).join("") : '<p class="empty-state">No interview rounds yet.</p>'}
                </div>
            </div>

            <div class="followups-section">
                <h2>Follow-ups</h2>
                <form id="followup-form" class="followup-inline-form">
                    <input type="text" name="contact_name" placeholder="Contact name" class="input">
                    <input type="text" name="contact_title" placeholder="Their title" class="input">
                    <input type="email" name="contact_email" placeholder="Their email" class="input">
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
                    <button type="submit" class="btn btn-primary">Add</button>
                </form>
                <textarea name="notes" form="followup-form" placeholder="Notes (optional)" class="input followup-notes-textarea" rows="2"></textarea>

                <div id="followups-list">
                    ${app.followups.length ? app.followups.map(f => `
                        <div class="followup-item" data-id="${f.id}">
                            <div class="followup-info">
                                <span class="badge badge-${f.method}">${f.method}</span>
                                <span class="followup-direction ${f.direction}">${f.direction === "inbound" ? "&#8592;" : "&#8594;"}</span>
                                ${f.contact_name ? `<span class="followup-contact"><strong>${esc(f.contact_name)}</strong>${f.contact_title ? `<span class="followup-contact-meta">, ${esc(f.contact_title)}</span>` : ""}${f.contact_email ? `<a href="mailto:${esc(f.contact_email)}" class="followup-contact-meta"> &lt;${esc(f.contact_email)}&gt;</a>` : ""}</span>` : ""}
                                <span class="followup-date">${formatDate(f.date)}</span>
                                ${f.notes ? `<span class="followup-note">${esc(f.notes)}</span>` : ""}
                            </div>
                            <div class="followup-actions">
                                <button class="btn btn-sm btn-secondary edit-followup" data-id="${f.id}"
                                    data-contact-name="${esc(f.contact_name || "")}"
                                    data-contact-title="${esc(f.contact_title || "")}"
                                    data-contact-email="${esc(f.contact_email || "")}"
                                    data-date="${esc(f.date || "")}"
                                    data-method="${esc(f.method)}"
                                    data-direction="${esc(f.direction)}"
                                    data-notes="${esc(f.notes || "")}">Edit</button>
                                <button class="btn btn-sm btn-danger delete-followup" data-id="${f.id}">×</button>
                            </div>
                        </div>
                        <div class="followup-edit-form" id="edit-form-${f.id}" hidden>
                            <div class="followup-inline-form">
                                <input type="text" name="contact_name" placeholder="Contact name" class="input" value="${esc(f.contact_name || "")}">
                                <input type="text" name="contact_title" placeholder="Their title" class="input" value="${esc(f.contact_title || "")}">
                                <input type="email" name="contact_email" placeholder="Their email" class="input" value="${esc(f.contact_email || "")}">
                                <input type="date" name="date" class="input" value="${esc(f.date || "")}">
                                <select name="method" class="input">
                                    ${["email","phone","linkedin","other"].map(m => `<option value="${m}" ${f.method===m?"selected":""}>${capitalize(m)}</option>`).join("")}
                                </select>
                                <select name="direction" class="input">
                                    <option value="outbound" ${f.direction==="outbound"?"selected":""}>Outbound</option>
                                    <option value="inbound" ${f.direction==="inbound"?"selected":""}>Inbound</option>
                                </select>
                                <button class="btn btn-primary save-followup-edit" data-id="${f.id}">Save</button>
                                <button class="btn btn-secondary cancel-followup-edit" data-id="${f.id}">Cancel</button>
                            </div>
                            <textarea name="notes" placeholder="Notes (optional)" class="input followup-notes-textarea" rows="2">${esc(f.notes || "")}</textarea>
                        </div>
                    `).join("") : '<p class="empty-state">No follow-ups yet.</p>'}
                </div>
            </div>
        </div>`;
    },

    mount(id) {
        document.getElementById("print-btn").addEventListener("click", () => window.print());

        // Company notes (loaded async, injected into placeholder)
        const companyNotesSection = document.getElementById("company-notes-section");
        const company = document.querySelector(".detail-page")?.dataset.company || "";

        const renderCompanyNotes = (notes, editing = false) => {
            companyNotesSection.innerHTML = `
                <div class="detail-notes company-notes-block">
                    <div class="company-notes-header">
                        <label>Company Notes <span class="text-dim">(shared across all ${esc(company)} applications)</span></label>
                        ${!editing ? `<button class="btn btn-sm btn-secondary" id="cn-edit-btn">Edit</button>` : ""}
                    </div>
                    ${editing ? `
                        <textarea id="cn-textarea" class="input" rows="4" style="width:100%;margin-top:8px">${esc(notes)}</textarea>
                        <div style="margin-top:8px;display:flex;gap:8px">
                            <button class="btn btn-primary btn-sm" id="cn-save-btn">Save</button>
                            <button class="btn btn-secondary btn-sm" id="cn-cancel-btn">Cancel</button>
                        </div>` :
                        `<p style="margin-top:8px;white-space:pre-wrap;min-height:1.5em">${notes ? esc(notes) : '<span class="text-dim">No company notes yet. Click Edit to add.</span>'}</p>`}
                </div>`;

            document.getElementById("cn-edit-btn")?.addEventListener("click", () => renderCompanyNotes(notes, true));
            document.getElementById("cn-cancel-btn")?.addEventListener("click", () => renderCompanyNotes(notes, false));
            document.getElementById("cn-save-btn")?.addEventListener("click", async () => {
                const updated = document.getElementById("cn-textarea").value;
                await API.upsertCompanyNotes(company, updated);
                showToast("Company notes saved.");
                renderCompanyNotes(updated, false);
            });
        };

        API.getCompanyNotes(company)
            .then(data => renderCompanyNotes(data.notes || ""))
            .catch(() => renderCompanyNotes("", false));

        document.getElementById("archive-btn")?.addEventListener("click", async () => {
            await API.archiveApplication(id);
            showToast("Application archived.");
            navigate();
        });

        document.getElementById("restore-btn")?.addEventListener("click", async () => {
            await API.restoreApplication(id);
            showToast("Application restored.");
            navigate();
        });

        document.getElementById("delete-btn")?.addEventListener("click", async () => {
            if (confirm("Permanently delete this application and all its data?")) {
                await API.deleteApplication(id);
                location.hash = "/applications?archived=1";
            }
        });

        document.getElementById("round-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;
            const notesEl = document.querySelector("textarea[form='round-form']");
            await API.createInterviewRound({
                application_id: parseInt(id),
                stage: form.stage.value,
                date: form.date.value || null,
                interviewer: form.interviewer.value || null,
                outcome: form.outcome.value,
                notes: notesEl?.value || null,
            });
            showToast("Interview round added.");
            navigate();
        });

        document.querySelectorAll(".delete-round").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (!confirm("Delete this interview round?")) return;
                await API.deleteInterviewRound(btn.dataset.id);
                navigate();
            });
        });

        document.getElementById("followup-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;
            const notesEl = document.querySelector("textarea[form='followup-form']");
            await API.createFollowup({
                application_id: parseInt(id),
                contact_name: form.contact_name.value || null,
                contact_title: form.contact_title.value || null,
                contact_email: form.contact_email.value || null,
                date: form.date.value || null,
                method: form.method.value,
                direction: form.direction.value,
                notes: notesEl?.value || null,
            });
            showToast("Follow-up added.");
            navigate(); // Re-render
        });

        document.getElementById("followups-list").addEventListener("click", async (e) => {
            const btn = e.target.closest("button[data-id]");
            if (!btn) return;
            const fid = btn.dataset.id;

            if (btn.classList.contains("edit-followup")) {
                document.getElementById(`edit-form-${fid}`).hidden = false;
                btn.closest(".followup-item").style.opacity = "0.4";
            } else if (btn.classList.contains("cancel-followup-edit")) {
                document.getElementById(`edit-form-${fid}`).hidden = true;
                document.querySelector(`.followup-item[data-id="${fid}"]`).style.opacity = "";
            } else if (btn.classList.contains("save-followup-edit")) {
                const editForm = document.getElementById(`edit-form-${fid}`);
                await API.updateFollowup(fid, {
                    contact_name: editForm.querySelector("[name=contact_name]").value || null,
                    contact_title: editForm.querySelector("[name=contact_title]").value || null,
                    contact_email: editForm.querySelector("[name=contact_email]").value || null,
                    date: editForm.querySelector("[name=date]").value || null,
                    method: editForm.querySelector("[name=method]").value,
                    direction: editForm.querySelector("[name=direction]").value,
                    notes: editForm.querySelector("[name=notes]").value || null,
                });
                showToast("Follow-up updated.");
                navigate();
            } else if (btn.classList.contains("delete-followup")) {
                if (!confirm("Delete this follow-up?")) return;
                await API.deleteFollowup(fid);
                navigate();
            }
        });
    }
};
