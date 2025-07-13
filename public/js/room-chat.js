// Room Chat functionality for approved rooms
import { 
    initializeAuth, 
    joinRoom, 
    leaveRoom, 
    sendRoomMessage, 
    listenToRoomMessages,
    generateTempUsername,
    formatTimestamp
} from "./firebase-config.js";

class RoomChatApp {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.messageListener = null;
        this.tempUsername = null;
        this.typingTimeout = null;
        this.init();
    }

    async init() {
        try {
            // Get room ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const roomId = urlParams.get('roomId');
            
            if (!roomId) {
                this.showError("No room specified. Redirecting to room list...");
                setTimeout(() => window.location.href = "chat.html", 2000);
                return;
            }

            this.currentUser = await initializeAuth();
            this.tempUsername = generateTempUsername();
            
            await this.loadRoom(roomId);
            this.setupEventListeners();
            this.setupMessageListener();
            
        } catch (error) {
            console.error("Room chat initialization failed:", error);
            this.showError("Failed to join room. Please try again.");
        }
    }

    async loadRoom(roomId) {
        try {
            this.showLoading();
            
            // Join the room and get room data
            const roomData = await joinRoom(roomId);
            this.currentRoom = { id: roomId, ...roomData };
            
            // Update UI with room information
            this.updateRoomHeader();
            
        } catch (error) {
            console.error("Failed to load room:", error);
            this.showError("Room not found or no longer available.");
            setTimeout(() => window.location.href = "chat.html", 2000);
        } finally {
            this.hideLoading();
        }
    }

    updateRoomHeader() {
        if (!this.currentRoom) return;
        
        document.getElementById("roomName").textContent = this.currentRoom.name;
        document.getElementById("roomDescription").textContent = this.currentRoom.description;
        document.getElementById("participantCount").textContent = `${this.currentRoom.participantCount || 0} online`;
        
        // Update room theme indicator
        const themeIndicator = document.getElementById("roomTheme");
        if (themeIndicator) {
            themeIndicator.textContent = this.currentRoom.theme;
            themeIndicator.className = `room-theme ${this.currentRoom.theme.toLowerCase().replace(/\s+/g, '-')}`;
        }
    }

    setupEventListeners() {
        // Send message button
        const sendBtn = document.getElementById("sendBtn");
        const messageInput = document.getElementById("messageInput");

        sendBtn.addEventListener("click", () => {
            this.handleSendMessage();
        });

        // Send on Enter, new line on Shift+Enter
        messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener("input", (e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
            
            // Handle typing indicator (optional)
            this.handleTyping();
        });

        // Leave room confirmation
        const leaveBtn = document.getElementById("leaveRoomBtn");
        if (leaveBtn) {
            leaveBtn.addEventListener("click", () => {
                this.confirmLeaveRoom();
            });
        }

        // Room info modal
        const infoBtn = document.getElementById("roomInfoBtn");
        const infoModal = document.getElementById("roomInfoModal");
        const closeInfoBtn = document.getElementById("closeRoomInfo");

        if (infoBtn && infoModal) {
            infoBtn.addEventListener("click", () => {
                this.showRoomInfo();
            });
        }

        if (closeInfoBtn) {
            closeInfoBtn.addEventListener("click", () => {
                infoModal.classList.remove("active");
            });
        }

        // Guidelines modal
        const guidelinesBtn = document.getElementById("guidelinesBtn");
        const guidelinesModal = document.getElementById("guidelinesModal");
        const closeGuidelinesBtn = document.getElementById("closeGuidelines");

        if (guidelinesBtn && guidelinesModal) {
            guidelinesBtn.addEventListener("click", () => {
                guidelinesModal.classList.add("active");
            });
        }

        if (closeGuidelinesBtn) {
            closeGuidelinesBtn.addEventListener("click", () => {
                guidelinesModal.classList.remove("active");
            });
        }

        // Handle back navigation
        window.addEventListener("beforeunload", () => {
            this.cleanup();
        });
    }

    setupMessageListener() {
        if (!this.currentRoom) return;

        try {
            this.messageListener = listenToRoomMessages(this.currentRoom.id, (messages) => {
                this.renderMessages(messages);
            });
        } catch (error) {
            console.error("Failed to setup message listener:", error);
            this.showError("Failed to load messages.");
        }
    }

    async handleSendMessage() {
        const messageInput = document.getElementById("messageInput");
        const message = messageInput.value.trim();

        if (!message || !this.currentRoom) return;

        // Basic message validation
        if (message.length > 500) {
            this.showError("Message is too long. Please keep it under 500 characters.");
            return;
        }

        try {
            // Disable input while sending
            const sendBtn = document.getElementById("sendBtn");
            sendBtn.disabled = true;
            messageInput.disabled = true;

            // Send message
            await sendRoomMessage(this.currentRoom.id, message, this.tempUsername);

            // Clear input
            messageInput.value = "";
            messageInput.style.height = "auto";

        } catch (error) {
            console.error("Failed to send message:", error);
            this.showError("Failed to send message. Please try again.");
        } finally {
            // Re-enable input
            const sendBtn = document.getElementById("sendBtn");
            sendBtn.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById("messagesContainer");
        if (!messagesContainer) return;

        const wasAtBottom = this.isScrolledToBottom(messagesContainer);

        messagesContainer.innerHTML = messages.map(message => this.createMessageBubble(message)).join("");

        // Auto-scroll to bottom if user was already at bottom or if it's their message
        if (wasAtBottom || messages[messages.length - 1]?.userId === this.currentUser?.uid) {
            this.scrollToBottom(messagesContainer);
        }
    }

    createMessageBubble(message) {
        const isOwnMessage = message.userId === this.currentUser?.uid;
        const timestamp = formatTimestamp(message.timestamp);
        const username = message.tempUsername || "Anonymous";

        return `
            <div class="message-bubble ${isOwnMessage ? 'own-message' : 'other-message'}">
                <div class="message-header">
                    <span class="message-username">${this.escapeHtml(username)}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message.text)}</div>
            </div>
        `;
    }

    isScrolledToBottom(element) {
        return Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 5;
    }

    scrollToBottom(element) {
        element.scrollTop = element.scrollHeight;
    }

    handleTyping() {
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Show typing indicator (if implemented)
        // this.showTypingIndicator();

        // Hide typing indicator after 2 seconds of no typing
        this.typingTimeout = setTimeout(() => {
            // this.hideTypingIndicator();
        }, 2000);
    }

    showRoomInfo() {
        if (!this.currentRoom) return;

        const modal = document.getElementById("roomInfoModal");
        const content = modal.querySelector(".room-info-content");

        const tags = this.currentRoom.tags?.length > 0 ? 
            this.currentRoom.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join("") : 
            "No tags";

        content.innerHTML = `
            <h3>${this.escapeHtml(this.currentRoom.name)}</h3>
            <div class="room-info-section">
                <label>Theme/Category:</label>
                <p>${this.escapeHtml(this.currentRoom.theme)}</p>
            </div>
            <div class="room-info-section">
                <label>Description:</label>
                <p>${this.escapeHtml(this.currentRoom.description)}</p>
            </div>
            <div class="room-info-section">
                <label>Tags:</label>
                <div class="room-tags">${tags}</div>
            </div>
            <div class="room-info-section">
                <label>Created:</label>
                <p>${formatTimestamp(this.currentRoom.createdAt)}</p>
            </div>
            <div class="room-info-section">
                <label>Your username in this room:</label>
                <p class="temp-username">${this.tempUsername}</p>
            </div>
        `;

        modal.classList.add("active");
    }

    confirmLeaveRoom() {
        if (confirm("Are you sure you want to leave this room?")) {
            this.leaveCurrentRoom();
        }
    }

    async leaveCurrentRoom() {
        try {
            if (this.currentRoom) {
                await leaveRoom(this.currentRoom.id);
            }
            
            // Redirect to room list
            window.location.href = "chat.html";
            
        } catch (error) {
            console.error("Failed to leave room:", error);
            // Still redirect even if leave fails
            window.location.href = "chat.html";
        }
    }

    showLoading() {
        const loadingEl = document.getElementById("loadingState");
        if (loadingEl) loadingEl.style.display = "flex";
        
        const chatContainer = document.getElementById("chatContainer");
        if (chatContainer) chatContainer.style.display = "none";
    }

    hideLoading() {
        const loadingEl = document.getElementById("loadingState");
        if (loadingEl) loadingEl.style.display = "none";
        
        const chatContainer = document.getElementById("chatContainer");
        if (chatContainer) chatContainer.style.display = "flex";
    }

    showError(message) {
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
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    cleanup() {
        if (this.messageListener) {
            this.messageListener();
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Leave room when page unloads
        if (this.currentRoom) {
            leaveRoom(this.currentRoom.id).catch(console.error);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new RoomChatApp();
});
