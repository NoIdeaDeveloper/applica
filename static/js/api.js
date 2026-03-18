const API = {
    async request(method, path, body) {
        const opts = { method, headers: {} };
        if (body && !(body instanceof FormData)) {
            opts.headers["Content-Type"] = "application/json";
            opts.body = JSON.stringify(body);
        } else if (body) {
            opts.body = body;
        }
        const res = await fetch(`/api${path}`, opts);
        if (res.status === 204) return null;
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Request failed");
        }
        return res.json();
    },

    getApplications(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request("GET", `/applications${qs ? "?" + qs : ""}`);
    },
    getApplication(id) { return this.request("GET", `/applications/${id}`); },
    createApplication(data) { return this.request("POST", "/applications", data); },
    updateApplication(id, data) { return this.request("PUT", `/applications/${id}`, data); },
    deleteApplication(id) { return this.request("DELETE", `/applications/${id}`); },

    _fileFormData(file) { const fd = new FormData(); fd.append("file", file); return fd; },
    uploadResume(id, file) { return this.request("POST", `/applications/${id}/resume`, this._fileFormData(file)); },
    uploadCoverLetter(id, file) { return this.request("POST", `/applications/${id}/cover-letter`, this._fileFormData(file)); },

    bulkAction(data) { return this.request("POST", "/applications/bulk", data); },
    checkDuplicate(company, title, excludeId) {
        const qs = new URLSearchParams({ company, title });
        if (excludeId) qs.set("exclude_id", excludeId);
        return this.request("GET", `/applications/check-duplicate?${qs}`);
    },
    getStats() { return this.request("GET", "/stats"); },
    createFollowup(data) { return this.request("POST", "/followups", data); },
    updateFollowup(id, data) { return this.request("PATCH", `/followups/${id}`, data); },
    deleteFollowup(id) { return this.request("DELETE", `/followups/${id}`); },
    createInterviewRound(data) { return this.request("POST", "/interview-rounds", data); },
    updateInterviewRound(id, data) { return this.request("PATCH", `/interview-rounds/${id}`, data); },
    deleteInterviewRound(id) { return this.request("DELETE", `/interview-rounds/${id}`); },
};
