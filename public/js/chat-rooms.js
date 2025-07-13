// Chat rooms listing functionality
import { 
    initializeAuth, 
    getActiveRooms,
    formatTimestamp
} from "./firebase-config.js";

class ChatRoomsApp {
    constructor() {
        this.currentUser = null;
        this.rooms = [];
        this.initTimeout = null;
        this.init();
    }

    async init() {
        try {
            console.log("Initializing ChatRoomsApp...");
            this.showLoading();
            
            // Set overall timeout for initialization
            this.initTimeout = setTimeout(() => {
                console.error("Initialization timeout reached");
                this.hideLoading();
                this.showError("Connection timeout. Please refresh the page to try again.");
                this.showEmptyState();
            }, 15000);
            
            // Initialize authentication with timeout
            const authTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Authentication timeout")), 8000)
            );
            
            const authPromise = initializeAuth();
            
            this.currentUser = await Promise.race([authPromise, authTimeout]);
            console.log("User authenticated:", this.currentUser);
            
            this.setupEventListeners();
            await this.loadRooms();
            
            // Clear timeout on success
            if (this.initTimeout) {
                clearTimeout(this.initTimeout);
                this.initTimeout = null;
            }
            
        } catch (error) {
            console.error("Chat rooms app initialization failed:", error);
            
            // Clear timeout
            if (this.initTimeout) {
                clearTimeout(this.initTimeout);
                this.initTimeout = null;
            }
            
            this.hideLoading();
            
            if (error.message.includes("timeout")) {
                this.showError("Connection timeout. Please refresh the page to try again.");
            } else {
                this.showError("Failed to connect. Please check your internet connection and try again.");
            }
            
            // Show empty state instead of sample rooms
            this.setupEventListeners();
            this.showEmptyState();
        }
    }

    setupEventListeners() {
        // Create room request button
        const createRoomBtn = document.getElementById("createRoomBtn");
        if (createRoomBtn) {
            createRoomBtn.addEventListener("click", () => {
                window.location.href = "create-room.html";
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById("refreshBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                this.loadRooms();
            });
        }

        // Search functionality
        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.filterRooms(e.target.value);
            });
        }

        // Category filter
        const categoryFilter = document.getElementById("categoryFilter");
        if (categoryFilter) {
            categoryFilter.addEventListener("change", (e) => {
                this.filterByCategory(e.target.value);
            });
        }
    }

    async loadRooms() {
        try {
            console.log("Loading rooms...");
            this.showLoading();
            
            // Set a timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Loading timeout after 10 seconds")), 10000);
            });
            
            // Get active approved rooms with timeout
            const roomsPromise = getActiveRooms();
            this.rooms = await Promise.race([roomsPromise, timeoutPromise]);
            
            // Validate room data
            this.rooms = this.rooms.filter(room => {
                if (!room || !room.id) {
                    console.warn("Invalid room data:", room);
                    return false;
                }
                return true;
            });
            
            console.log(`Loaded ${this.rooms.length} rooms:`, this.rooms);
            
            // Update room count
            this.updateRoomCount();
            
            // Render rooms
            this.renderRooms(this.rooms);
            
        } catch (error) {
            console.error("Failed to load rooms:", error);
            this.showError(`Failed to load chat rooms: ${error.message}`);
            
            // Show empty state instead of sample rooms
            this.rooms = [];
            this.updateRoomCount();
            this.renderRooms(this.rooms);
        } finally {
            this.hideLoading();
        }
    }

    updateRoomCount() {
        const countElement = document.getElementById("roomCount");
        if (countElement) {
            countElement.textContent = this.rooms.length;
        }
    }

    renderRooms(rooms) {
        const roomsList = document.getElementById("roomsList");
        if (!roomsList) return;

        console.log(`Rendering ${rooms.length} rooms`);

        if (rooms.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();

        try {
            roomsList.innerHTML = rooms.map(room => this.createRoomCard(room)).join("");

            // Add click listeners to room cards
            roomsList.querySelectorAll(".room-card").forEach(card => {
                card.addEventListener("click", () => {
                    const roomId = card.dataset.roomId;
                    this.joinRoom(roomId);
                });
            });
        } catch (error) {
            console.error("Error rendering rooms:", error);
            this.showError(`Error displaying rooms: ${error.message}`);
        }
    }

    createRoomCard(room) {
        const lastActivity = formatTimestamp(room.lastActivity);
        const createdAt = formatTimestamp(room.createdAt);
        const participantCount = room.participantCount || 0;
        
        // Safe theme handling
        const theme = room.theme || "general";
        const themeClass = theme.toLowerCase().replace(/\s+/g, '-');
        
        const tags = room.tags?.length > 0 ? 
            room.tags.slice(0, 3).map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join("") : 
            "";

        const moreTagsCount = room.tags?.length > 3 ? room.tags.length - 3 : 0;

        return `
            <div class="room-card" data-room-id="${room.id}">
                <div class="room-header">
                    <div class="room-info">
                        <h3 class="room-name">${this.escapeHtml(room.name || 'Untitled Room')}</h3>
                        <div class="room-meta">
                            <span class="theme-badge ${themeClass}">${this.escapeHtml(theme)}</span>
                            <span class="participant-count">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                ${participantCount}
                            </span>
                        </div>
                    </div>
                    <div class="room-status">
                        <div class="activity-indicator active"></div>
                        <span class="activity-text">Active</span>
                    </div>
                </div>
                
                <p class="room-description">${this.escapeHtml(room.description || 'No description available')}</p>
                
                ${tags || moreTagsCount > 0 ? `
                    <div class="room-tags">
                        ${tags}
                        ${moreTagsCount > 0 ? `<span class="more-tags">+${moreTagsCount} more</span>` : ""}
                    </div>
                ` : ""}
                
                <div class="room-footer">
                    <span class="last-activity">Last active: ${lastActivity}</span>
                    <button class="join-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"/>
                        </svg>
                        Join Room
                    </button>
                </div>
            </div>
        `;
    }

    joinRoom(roomId) {
        if (!roomId) return;
        
        // Navigate to the room chat page
        window.location.href = `room.html?roomId=${roomId}`;
    }

    filterRooms(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderRooms(this.rooms);
            return;
        }

        const filtered = this.rooms.filter(room => {
            const searchText = searchTerm.toLowerCase();
            const roomName = (room.name || '').toLowerCase();
            const roomDescription = (room.description || '').toLowerCase();
            const roomTheme = (room.theme || '').toLowerCase();
            
            return roomName.includes(searchText) ||
                   roomDescription.includes(searchText) ||
                   roomTheme.includes(searchText) ||
                   (room.tags && room.tags.some(tag => tag.toLowerCase().includes(searchText)));
        });

        this.renderRooms(filtered);
    }

    filterByCategory(category) {
        if (!category || category === "all") {
            this.renderRooms(this.rooms);
            return;
        }

        const filtered = this.rooms.filter(room => {
            const roomTheme = room.theme || 'general';
            return roomTheme.toLowerCase() === category.toLowerCase();
        });

        this.renderRooms(filtered);
    }

    showLoading() {
        const loadingState = document.getElementById("loadingState");
        const roomsList = document.getElementById("roomsList");
        
        if (loadingState) loadingState.style.display = "flex";
        if (roomsList) roomsList.style.display = "none";
        this.hideEmptyState();
    }

    hideLoading() {
        const loadingState = document.getElementById("loadingState");
        const roomsList = document.getElementById("roomsList");
        
        if (loadingState) loadingState.style.display = "none";
        if (roomsList) roomsList.style.display = "grid";
    }

    showEmptyState() {
        const emptyState = document.getElementById("emptyState");
        const roomsList = document.getElementById("roomsList");
        
        if (emptyState) emptyState.style.display = "flex";
        if (roomsList) roomsList.style.display = "none";
    }

    hideEmptyState() {
        const emptyState = document.getElementById("emptyState");
        if (emptyState) emptyState.style.display = "none";
    }

    showError(message) {
        console.error("Error:", message);
        
        // Hide loading state
        this.hideLoading();
        
        // Simple toast notification
        const toast = document.createElement("div");
        toast.className = "error-toast";
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #EF4444;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            max-width: 90vw;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new ChatRoomsApp();
});
