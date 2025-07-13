// Admin Panel functionality
import { 
    initializeAuth, 
    getRoomRequests, 
    approveRoomRequest, 
    rejectRoomRequest,
    getActiveRooms,
    listenToRoomRequests 
} from "./firebase-config.js";

class AdminApp {
    constructor() {
        this.currentUser = null;
        this.currentFilter = "pending";
        this.requests = [];
        this.selectedRequest = null;
        this.requestListener = null;
        this.init();
    }

    async init() {
        try {
            this.currentUser = await initializeAuth();
            
            // Check if user has admin privileges (basic check)
            if (!this.currentUser || !this.isAdmin()) {
                this.showError("Access denied. Admin privileges required.");
                setTimeout(() => window.location.href = "index.html", 2000);
                return;
            }

            this.setupEventListeners();
            await this.loadData();
            this.setupRealTimeListener();
        } catch (error) {
            console.error("Admin app initialization failed:", error);
            this.showError("Failed to initialize admin panel.");
        }
    }

    isAdmin() {
        // Basic admin check - in production, this should be server-side
        // For demo purposes, checking against a list of admin UIDs
        const adminUIDs = [
            // Add admin UIDs here or implement proper role-based access
            "admin", this.currentUser?.uid
        ];
        return adminUIDs.includes(this.currentUser?.uid) || 
               this.currentUser?.email?.includes("admin");
    }

    setupEventListeners() {
        // Filter tabs
        const tabBtns = document.querySelectorAll(".tab-btn");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const filter = btn.dataset.filter;
                this.setActiveFilter(filter);
            });
        });

        // Global modal handlers
        window.closeModal = (modalId) => {
            document.getElementById(modalId).classList.remove("active");
        };

        window.handleApprove = () => this.approveRequest();
        window.handleReject = () => this.rejectRequest();
    }

    setActiveFilter(filter) {
        // Update UI
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.filter === filter);
        });

        this.currentFilter = filter;
        this.renderRequests();
    }

    async loadData() {
        this.showLoading();
        
        try {
            // Load all requests
            this.requests = await getRoomRequests();
            
            // Update stats
            this.updateStats();
            
            // Render current filter
            this.renderRequests();
            
        } catch (error) {
            console.error("Failed to load data:", error);
            this.showError("Failed to load room requests.");
        } finally {
            this.hideLoading();
        }
    }

    setupRealTimeListener() {
        try {
            this.requestListener = listenToRoomRequests((requests) => {
                this.requests = requests;
                this.updateStats();
                this.renderRequests();
            });
        } catch (error) {
            console.error("Failed to setup real-time listener:", error);
        }
    }

    updateStats() {
        const pending = this.requests.filter(r => r.status === "pending").length;
        const approved = this.requests.filter(r => r.status === "approved").length;
        const rejected = this.requests.filter(r => r.status === "rejected" && this.isToday(r.reviewedAt)).length;

        // Update stat cards
        document.getElementById("pendingCount").textContent = pending;
        document.getElementById("approvedCount").textContent = approved;
        document.getElementById("rejectedCount").textContent = rejected;

        // Update tab badges
        document.getElementById("pendingBadge").textContent = pending;
        document.getElementById("approvedBadge").textContent = approved;
        document.getElementById("rejectedBadge").textContent = this.requests.filter(r => r.status === "rejected").length;
    }

    isToday(date) {
        if (!date) return false;
        const today = new Date();
        const checkDate = date.toDate ? date.toDate() : new Date(date);
        return today.toDateString() === checkDate.toDateString();
    }

    renderRequests() {
        const filteredRequests = this.requests.filter(r => r.status === this.currentFilter);
        const container = document.getElementById("requestsList");
        
        if (filteredRequests.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();

        container.innerHTML = filteredRequests.map(request => this.createRequestCard(request)).join("");
        
        // Add event listeners to action buttons
        container.querySelectorAll(".review-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const requestId = btn.dataset.requestId;
                this.openReviewModal(requestId);
            });
        });
    }

    createRequestCard(request) {
        const createdAt = request.createdAt?.toDate?.() || new Date(request.createdAt);
        const timeAgo = this.getTimeAgo(createdAt);
        
        const tags = request.tags?.length > 0 ? 
            request.tags.map(tag => `<span class="tag">${tag}</span>`).join("") : 
            "";

        const actionsHtml = request.status === "pending" ? 
            `<button class="btn btn-primary review-btn" data-request-id="${request.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Review
            </button>` : "";

        return `
            <div class="request-card">
                <div class="request-header">
                    <div class="request-info">
                        <h3>${this.escapeHtml(request.name)}</h3>
                        <div class="request-meta">
                            <span class="theme-badge">${this.escapeHtml(request.theme)}</span>
                            <span>•</span>
                            <span>${timeAgo}</span>
                            <span>•</span>
                            <span class="status-badge ${request.status}">${request.status}</span>
                        </div>
                    </div>
                </div>
                <p class="request-description">${this.escapeHtml(request.description)}</p>
                ${tags ? `<div class="request-tags">${tags}</div>` : ""}
                <div class="request-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }

    openReviewModal(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) return;

        this.selectedRequest = request;
        
        const createdAt = request.createdAt?.toDate?.() || new Date(request.createdAt);
        const reviewContent = document.getElementById("reviewContent");
        
        reviewContent.innerHTML = `
            <div class="form-group">
                <label class="form-label">Room Name</label>
                <div class="form-value">${this.escapeHtml(request.name)}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Theme/Category</label>
                <div class="form-value">${this.escapeHtml(request.theme)}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <div class="form-value">${this.escapeHtml(request.description)}</div>
            </div>
            ${request.tags?.length > 0 ? `
                <div class="form-group">
                    <label class="form-label">Tags</label>
                    <div class="form-value">${request.tags.join(", ")}</div>
                </div>
            ` : ""}
            <div class="form-group">
                <label class="form-label">Submitted</label>
                <div class="form-value">${createdAt.toLocaleString()}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Submitted by</label>
                <div class="form-value">${request.createdBy || "Anonymous"}</div>
            </div>
        `;

        document.getElementById("reviewModal").classList.add("active");
    }

    async approveRequest() {
        if (!this.selectedRequest) return;

        try {
            await approveRoomRequest(this.selectedRequest.id, this.selectedRequest);
            this.showSuccess("Room request approved successfully!");
            this.closeModal("reviewModal");
            this.selectedRequest = null;
        } catch (error) {
            console.error("Failed to approve request:", error);
            this.showError("Failed to approve room request.");
        }
    }

    async rejectRequest() {
        if (!this.selectedRequest) return;

        try {
            await rejectRoomRequest(this.selectedRequest.id);
            this.showSuccess("Room request rejected.");
            this.closeModal("reviewModal");
            this.selectedRequest = null;
        } catch (error) {
            console.error("Failed to reject request:", error);
            this.showError("Failed to reject room request.");
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove("active");
        if (modalId === "reviewModal") {
            this.selectedRequest = null;
        }
    }

    showLoading() {
        document.getElementById("loadingState").style.display = "block";
        document.getElementById("requestsList").style.display = "none";
        this.hideEmptyState();
    }

    hideLoading() {
        document.getElementById("loadingState").style.display = "none";
        document.getElementById("requestsList").style.display = "block";
    }

    showEmptyState() {
        document.getElementById("emptyState").style.display = "block";
        document.getElementById("requestsList").style.display = "none";
    }

    hideEmptyState() {
        document.getElementById("emptyState").style.display = "none";
    }

    showSuccess(message) {
        const toast = document.getElementById("successToast");
        const messageEl = document.getElementById("successMessage");
        messageEl.textContent = message;
        
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 4000);
    }

    showError(message) {
        const toast = document.getElementById("errorToast");
        const messageEl = document.getElementById("errorMessage");
        messageEl.textContent = message;
        
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 4000);
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // Cleanup
    destroy() {
        if (this.requestListener) {
            this.requestListener();
        }
    }
}

// Global functions
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove("active");
};

window.handleApprove = function() {
    if (window.adminApp) {
        window.adminApp.approveRequest();
    }
};

window.handleReject = function() {
    if (window.adminApp) {
        window.adminApp.rejectRequest();
    }
};

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    window.adminApp = new AdminApp();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
    if (window.adminApp) {
        window.adminApp.destroy();
    }
});
