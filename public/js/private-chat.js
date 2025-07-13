// Private Chat - Real-time 1-on-1 Anonymous Chat
import { 
    initializeAuth, 
    getCurrentUser,
    rtdb as db
} from "./firebase-config.js";

import {
    ref,
    push,
    set,
    onValue,
    off,
    remove,
    serverTimestamp,
    onDisconnect,
    get,
    update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

class PrivateChatApp {
    constructor() {
        this.currentUser = null;
        this.roomId = null;
        this.roomRef = null;
        this.messagesRef = null;
        this.userRole = null;
        this.partnerId = null;
        this.partnerRole = null;
        this.typingTimeout = null;
        this.isTyping = false;
        this.messages = [];
        this.init();
    }

    async init() {
        try {
            console.log("Initializing private chat...");
            
            // Get room ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            this.roomId = urlParams.get('roomId');
            
            if (!this.roomId) {
                this.showError("Invalid room ID. Redirecting to home...");
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }

            // Initialize authentication
            this.currentUser = await initializeAuth();
            console.log("User authenticated:", this.currentUser);
            
            // Load room data and setup chat
            await this.loadRoomData();
            this.setupEventListeners();
            this.setupRealtimeListeners();
            
        } catch (error) {
            console.error("Private chat initialization failed:", error);
            this.showError("Failed to connect to chat. Please try again.");
        }
    }

    async loadRoomData() {
        try {
            this.roomRef = ref(db, `private_chats/${this.roomId}`);
            const roomSnapshot = await get(this.roomRef);
            
            if (!roomSnapshot.exists()) {
                throw new Error("Room not found");
            }
            
            const roomData = roomSnapshot.val();
            console.log("Room data loaded:", roomData);
            
            // Verify user is participant
            if (!roomData.participants || !roomData.participants[this.currentUser.uid]) {
                throw new Error("Unauthorized access to room");
            }
            
            // Get user and partner info
            const participants = Object.keys(roomData.participants);
            this.partnerId = participants.find(uid => uid !== this.currentUser.uid);
            
            if (!this.partnerId) {
                throw new Error("Partner not found in room");
            }
            
            this.userRole = roomData.participants[this.currentUser.uid].role;
            this.partnerRole = roomData.participants[this.partnerId].role;
            
            console.log(`User role: ${this.userRole}, Partner role: ${this.partnerRole}`);
            
            // Update UI
            this.updateChatInfo();
            
            // Setup disconnect handling
            this.setupDisconnectHandling();

            // Start chat timer if startedAt is present
            if (roomData.startedAt) {
                this.startChatTimer(roomData.startedAt);
            }
            
        } catch (error) {
            console.error("Failed to load room data:", error);
            throw error;
        }
    }

    setupDisconnectHandling() {
        // Update status on disconnect
        const userStatusRef = ref(db, `private_chats/${this.roomId}/participants/${this.currentUser.uid}/status`);
        onDisconnect(userStatusRef).set("disconnected");
        
        // Set status to connected
        set(userStatusRef, "connected");
    }

    setupEventListeners() {
        // Timer display
        this.chatTimerDisplay = document.getElementById('chatTimer');
        // Message input
        const messageInput = document.getElementById("messageInput");
        const sendButton = document.getElementById("sendButton");
        const charCount = document.getElementById("charCount");

        if (messageInput) {
            messageInput.addEventListener("input", (e) => {
                this.handleInputChange(e);
                this.updateCharCount();
                this.handleTyping();
            });

            messageInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize textarea
            messageInput.addEventListener("input", () => {
                messageInput.style.height = "auto";
                messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
            });
        }

        if (sendButton) {
            sendButton.addEventListener("click", () => {
                this.sendMessage();
            });
        }

        // Report button
        const reportBtn = document.getElementById("reportBtn");
        if (reportBtn) {
            reportBtn.addEventListener("click", () => {
                this.openReportModal();
            });
        }

        // End chat button
        const endChatBtn = document.getElementById("endChatBtn");
        if (endChatBtn) {
            endChatBtn.addEventListener("click", () => {
                this.openEndChatModal();
            });
        }

        // Modal event listeners
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Report modal
        const reportModal = document.getElementById("reportModal");
        const closeReportModal = document.getElementById("closeReportModal");
        const cancelReport = document.getElementById("cancelReport");
        const submitReport = document.getElementById("submitReport");
        
        [closeReportModal, cancelReport].forEach(btn => {
            if (btn) {
                btn.addEventListener("click", () => {
                    this.closeReportModal();
                });
            }
        });

        if (submitReport) {
            submitReport.addEventListener("click", () => {
                this.submitReport();
            });
        }

        // Report reason selection
        const reportReasons = document.querySelectorAll('input[name="reportReason"]');
        reportReasons.forEach(radio => {
            radio.addEventListener("change", () => {
                if (submitReport) {
                    submitReport.disabled = false;
                }
            });
        });

        // End chat modal
        const endChatModal = document.getElementById("endChatModal");
        const closeEndChatModal = document.getElementById("closeEndChatModal");
        const cancelEndChat = document.getElementById("cancelEndChat");
        const confirmEndChat = document.getElementById("confirmEndChat");

        [closeEndChatModal, cancelEndChat].forEach(btn => {
            if (btn) {
                btn.addEventListener("click", () => {
                    this.closeEndChatModal();
                });
            }
        });

        if (confirmEndChat) {
            confirmEndChat.addEventListener("click", () => {
                this.endChat();
            });
        }

        // Chat ended modal
        const goHome = document.getElementById("goHome");
        const newChat = document.getElementById("newChat");

        if (goHome) {
            goHome.addEventListener("click", () => {
                window.location.href = "index.html";
            });
        }

        if (newChat) {
            newChat.addEventListener("click", () => {
                window.location.href = "pair.html";
            });
        }

        // Close modals on background click
        [reportModal, endChatModal].forEach(modal => {
            if (modal) {
                modal.addEventListener("click", (e) => {
                    if (e.target === modal) {
                        modal.classList.remove("active");
                    }
                });
            }
        });

        // Modal and notification accessibility improvements
        const chatEndedModal = document.getElementById("chatEndedModal");
        chatEndedModal.setAttribute("role", "dialog");
        chatEndedModal.setAttribute("tabindex", "-1");
        chatEndedModal.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                chatEndedModal.style.display = "none";
            }
        });
        // Trap focus inside modal
        chatEndedModal.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                const focusable = chatEndedModal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                    e.preventDefault();
                    (e.shiftKey ? last : first).focus();
                }
            }
        });
    }

    setupRealtimeListeners() {
        // Listen for messages
        this.messagesRef = ref(db, `private_chats/${this.roomId}/messages`);
        onValue(this.messagesRef, (snapshot) => {
            this.handleMessagesUpdate(snapshot);
        });

        // Listen for typing indicators
        const typingRef = ref(db, `private_chats/${this.roomId}/typing/${this.partnerId}`);
        onValue(typingRef, (snapshot) => {
            this.handlePartnerTyping(snapshot);
        });

        // Listen for partner status
        const partnerStatusRef = ref(db, `private_chats/${this.roomId}/participants/${this.partnerId}/status`);
        onValue(partnerStatusRef, (snapshot) => {
            this.updatePartnerStatus(snapshot.val());
        });

        // Listen for chat status (if ended by partner)
        const chatStatusRef = ref(db, `private_chats/${this.roomId}/status`);
        onValue(chatStatusRef, (snapshot) => {
            const status = snapshot.val();
            if (status === "ended") {
                this.handleChatEnded("Your chat partner ended the conversation.");
            }
        });
    }

    handleInputChange(e) {
        const sendButton = document.getElementById("sendButton");
        const hasText = e.target.value.trim().length > 0;
        
        if (sendButton) {
            sendButton.disabled = !hasText;
        }
    }

    updateCharCount() {
        const messageInput = document.getElementById("messageInput");
        const charCount = document.getElementById("charCount");
        
        if (messageInput && charCount) {
            const length = messageInput.value.length;
            charCount.textContent = `${length}/1000`;
            
            if (length > 900) {
                charCount.style.color = "#dc2626";
            } else {
                charCount.style.color = "var(--gray-500)";
            }
        }
    }

    handleTyping() {
        const typingRef = ref(db, `private_chats/${this.roomId}/typing/${this.currentUser.uid}`);
        
        // Set typing indicator
        if (!this.isTyping) {
            this.isTyping = true;
            set(typingRef, true);
        }

        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Set new timeout to remove typing indicator
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            remove(typingRef);
        }, 2000);
    }

    async sendMessage() {
        const messageInput = document.getElementById("messageInput");
        if (!messageInput || !messageInput.value.trim()) return;

        const messageText = messageInput.value.trim();
        
        try {
            // Create message object
            const messageData = {
                text: messageText,
                from: this.userRole,
                fromUid: this.currentUser.uid,
                timestamp: serverTimestamp()
            };

            // Add message to database
            await push(this.messagesRef, messageData);

            // Clear input
            messageInput.value = "";
            messageInput.style.height = "auto";
            
            // Update send button state
            const sendButton = document.getElementById("sendButton");
            if (sendButton) {
                sendButton.disabled = true;
            }

            // Update character count
            this.updateCharCount();

            // Remove typing indicator
            if (this.isTyping) {
                this.isTyping = false;
                const typingRef = ref(db, `private_chats/${this.roomId}/typing/${this.currentUser.uid}`);
                remove(typingRef);
            }

        } catch (error) {
            console.error("Failed to send message:", error);
            this.showError("Failed to send message. Please try again.");
        }
    }

    handleMessagesUpdate(snapshot) {
        const messagesContainer = document.getElementById("chatMessages");
        if (!messagesContainer) return;

        // Keep system message at top
        const systemMessage = messagesContainer.querySelector(".system-message");
        
        // Clear existing messages (except system message)
        const existingMessages = messagesContainer.querySelectorAll(".message");
        existingMessages.forEach(msg => msg.remove());

        if (!snapshot.exists()) return;

        const messages = snapshot.val();
        const messageList = Object.entries(messages)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        messageList.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        this.scrollToBottom();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${message.fromUid === this.currentUser.uid ? "own" : "other"}`;

        const messageContent = document.createElement("div");
        messageContent.className = "message-content";

        const messageBubble = document.createElement("div");
        messageBubble.className = "message-bubble";
        messageBubble.textContent = message.text;

        const messageMeta = document.createElement("div");
        messageMeta.className = "message-meta";

        const messageTime = document.createElement("span");
        messageTime.className = "message-time";
        
        if (message.timestamp) {
            const date = new Date(message.timestamp);
            messageTime.textContent = date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }

        messageMeta.appendChild(messageTime);
        messageContent.appendChild(messageBubble);
        messageContent.appendChild(messageMeta);
        messageDiv.appendChild(messageContent);

        return messageDiv;
    }

    handlePartnerTyping(snapshot) {
        const typingIndicator = document.getElementById("typingIndicator");
        if (!typingIndicator) return;

        const isTyping = snapshot.exists() && snapshot.val() === true;
        
        if (isTyping) {
            typingIndicator.style.display = "block";
            this.scrollToBottom();
        } else {
            typingIndicator.style.display = "none";
        }
    }

    scrollToBottom() {
        const chatContainer = document.querySelector(".chat-container");
        if (chatContainer) {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 100);
        }
    }

    updateChatInfo() {
        // Update header info
        const partnerStatus = document.getElementById("partnerStatus");
        if (partnerStatus) {
            partnerStatus.textContent = `Connected with ${this.partnerRole}`;
        }
    }

    updatePartnerStatus(status) {
        const partnerStatus = document.getElementById("partnerStatus");
        const statusDot = document.querySelector(".status-dot");
        
        if (partnerStatus && statusDot) {
            if (status === "connected") {
                partnerStatus.textContent = `Connected with ${this.partnerRole}`;
                statusDot.classList.add("active");
            } else {
                partnerStatus.textContent = `${this.partnerRole} disconnected`;
                statusDot.classList.remove("active");
            }
        }
    }

    openReportModal() {
        const modal = document.getElementById("reportModal");
        if (modal) {
            modal.classList.add("active");
            
            // Reset form
            const form = modal.querySelector("form");
            if (form) {
                form.reset();
            }
            
            const submitBtn = document.getElementById("submitReport");
            if (submitBtn) {
                submitBtn.disabled = true;
            }
        }
    }

    closeReportModal() {
        const modal = document.getElementById("reportModal");
        if (modal) {
            modal.classList.remove("active");
        }
    }

    async submitReport() {
        try {
            const selectedReason = document.querySelector('input[name="reportReason"]:checked');
            const reportDetails = document.getElementById("reportDetails");
            
            if (!selectedReason) return;

            const reportData = {
                roomId: this.roomId,
                reportedUser: this.partnerId,
                reportedRole: this.partnerRole,
                reporterUser: this.currentUser.uid,
                reporterRole: this.userRole,
                reason: selectedReason.value,
                details: reportDetails ? reportDetails.value : "",
                timestamp: serverTimestamp()
            };

            // Save report to database
            const reportsRef = ref(db, "reports");
            await push(reportsRef, reportData);

            this.closeReportModal();
            this.showNotification("Report submitted. Thank you for helping keep our community safe.");

        } catch (error) {
            console.error("Failed to submit report:", error);
            this.showError("Failed to submit report. Please try again.");
        }
    }

    openEndChatModal() {
        const modal = document.getElementById("endChatModal");
        if (modal) {
            modal.classList.add("active");
        }
    }

    closeEndChatModal() {
        const modal = document.getElementById("endChatModal");
        if (modal) {
            modal.classList.remove("active");
        }
    }

    async endChat() {
        try {
            // Update chat status
            await update(this.roomRef, {
                status: "ended",
                endedBy: this.currentUser.uid,
                endedAt: serverTimestamp()
            });

            this.closeEndChatModal();
            this.handleChatEnded("You ended the conversation.");

        } catch (error) {
            console.error("Failed to end chat:", error);
            this.showError("Failed to end chat. Please try again.");
        }
    }

    startChatTimer(startedAt) {
        // startedAt is a unix timestamp in ms or s (Firebase returns ms)
        const DURATION = 10 * 60 * 1000; // 10 minutes in ms
        let startTime = typeof startedAt === 'object' && startedAt.hasOwnProperty('seconds')
            ? startedAt.seconds * 1000
            : startedAt;
        if (typeof startTime !== 'number') {
            startTime = Date.now(); // Fallback
        }
        const endTime = startTime + DURATION;
        if (this.updateTimerInterval) clearInterval(this.updateTimerInterval);
        this.updateChatTimer(endTime);
        this.updateTimerInterval = setInterval(() => {
            this.updateChatTimer(endTime);
        }, 1000);
    }

    updateChatTimer(endTime) {
        const now = Date.now();
        let remaining = endTime - now;
        if (remaining < 0) remaining = 0;
        const min = Math.floor(remaining / 60000);
        const sec = Math.floor((remaining % 60000) / 1000);
        const formatted = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        if (this.chatTimerDisplay) {
            if (remaining > 0) {
                this.chatTimerDisplay.textContent = `Time left: ${formatted}`;
                this.chatTimerDisplay.style.display = '';
            } else {
                this.chatTimerDisplay.textContent = 'Chat ended';
                this.chatTimerDisplay.style.display = '';
            }
        }
        if (remaining <= 0) {
            if (this.updateTimerInterval) clearInterval(this.updateTimerInterval);
            // End chat for both users if not already ended
            this.autoEndChatDueToTimeout();
        }
    }

    async autoEndChatDueToTimeout() {
        // Only end if not already ended
        const statusSnapshot = await get(ref(db, `private_chats/${this.roomId}/status`));
        if (statusSnapshot.exists() && statusSnapshot.val() !== 'ended') {
            await update(this.roomRef, {
                status: 'ended',
                endedBy: 'timer',
                endedAt: serverTimestamp()
            });
            this.handleChatEnded('This chat has ended automatically after 10 minutes.');
        }
    }

    handleChatEnded(message) {
        // Stop all listeners
        if (this.messagesRef) {
            off(this.messagesRef);
        }
        if (this.updateTimerInterval) {
            clearInterval(this.updateTimerInterval);
        }
        // Show chat ended modal and feedback
        function showChatEndedModal(reason) {
            const chatEndedModal = document.getElementById("chatEndedModal");
            chatEndedModal.style.display = "block";
            chatEndedModal.setAttribute("aria-modal", "true");
            chatEndedModal.setAttribute("aria-label", "Chat ended");
            chatEndedModal.focus();
            if (reason === "timeout") {
                const chatEndedTitle = document.getElementById("chatEndedTitle");
                const chatEndedMsg = document.getElementById("chatEndedMsg");
                chatEndedTitle.textContent = "Time's up!";
                chatEndedMsg.textContent = "The 10-minute chat has ended. Thank you for chatting!";
            } else {
                const chatEndedTitle = document.getElementById("chatEndedTitle");
                const chatEndedMsg = document.getElementById("chatEndedMsg");
                chatEndedTitle.textContent = "Chat ended";
                chatEndedMsg.textContent = "The chat has ended. Thank you for chatting!";
            }
            const timerDisplay = document.getElementById("chatTimer");
            timerDisplay.textContent = 'Chat ended';
            timerDisplay.style.display = '';
            const chatInput = document.getElementById("messageInput");
            chatInput.disabled = true;
            const sendBtn = document.getElementById("sendButton");
            sendBtn.disabled = true;
            const endChatBtn = document.getElementById("endChatBtn");
            endChatBtn.style.display = "none";
            const reportBtn = document.getElementById("reportBtn");
            reportBtn.style.display = "none";
            showFeedbackModal();
        }

        // --- Feedback Modal ---
        function showFeedbackModal() {
            let modal = document.getElementById('feedbackModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'feedbackModal';
                modal.className = 'modal';
                modal.setAttribute('role', 'dialog');
                modal.setAttribute('aria-modal', 'true');
                modal.setAttribute('tabindex', '-1');
                modal.innerHTML = `
                    <div class="modal-content" style="text-align:center;">
                        <h2 id="feedbackTitle">How was your chat?</h2>
                        <div id="feedbackRating" style="margin:1em 0;">
                            <button id="thumbsUp" aria-label="Thumbs up" tabindex="0" style="font-size:2em;">👍</button>
                            <button id="thumbsDown" aria-label="Thumbs down" tabindex="0" style="font-size:2em;">👎</button>
                        </div>
                        <textarea id="feedbackText" rows="3" placeholder="Optional: Tell us more or report..." style="width:90%;margin-bottom:1em;"></textarea>
                        <div>
                            <button id="submitFeedback" class="btn btn-primary" tabindex="0">Submit Feedback</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            modal.style.display = 'block';
            modal.focus();
            // Keyboard trap for accessibility
            modal.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    modal.style.display = 'none';
                }
            });
            // Feedback logic
            let rating = null;
            document.getElementById('thumbsUp').onclick = () => {
                rating = 'up';
                document.getElementById('thumbsUp').style.background = '#d1fae5';
                document.getElementById('thumbsDown').style.background = '';
            };
            document.getElementById('thumbsDown').onclick = () => {
                rating = 'down';
                document.getElementById('thumbsDown').style.background = '#fee2e2';
                document.getElementById('thumbsUp').style.background = '';
            };
            document.getElementById('submitFeedback').onclick = async () => {
                const text = document.getElementById('feedbackText').value;
                const userId = window.currentUserId || firebase.auth().currentUser?.uid;
                const feedbackRef = firebase.database().ref(`feedback/${roomId}/${userId}`);
                await feedbackRef.set({
                    rating,
                    text,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                modal.style.display = 'none';
                showToast('Thank you for your feedback!');
            };
        }

        showChatEndedModal('manual');
        // Hide timer if present
        if (this.chatTimerDisplay) {
            this.chatTimerDisplay.textContent = "Chat ended";
        }

        // Disable input
        const messageInput = document.getElementById("messageInput");
        const sendButton = document.getElementById("sendButton");
        
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = "Chat has ended";
        }
        
        if (sendButton) {
            sendButton.disabled = true;
        }

        // Schedule room cleanup (after 5 minutes)
        setTimeout(() => {
            this.cleanupRoom();
        }, 5 * 60 * 1000);
    }

    async cleanupRoom() {
        try {
            // Remove the entire room from database
            await remove(this.roomRef);
            console.log("Room cleaned up successfully");
        } catch (error) {
            console.error("Failed to cleanup room:", error);
        }
    }

    showError(message) {
        console.error(message);
        this.showNotification(message, "error");
    }

    showNotification(message, type = "info") {
        // Create notification element
        const notification = document.createElement("div");
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "12px 20px",
            borderRadius: "8px",
            color: "white",
            fontWeight: "500",
            zIndex: "10000",
            opacity: "0",
            transform: "translateX(100%)",
            transition: "all 0.3s ease",
            maxWidth: "300px"
        });

        if (type === "error") {
            notification.style.background = "#dc2626";
        } else {
            notification.style.background = "#10b981";
        }

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.style.opacity = "1";
            notification.style.transform = "translateX(0)";
        }, 100);

        // Hide notification
        setTimeout(() => {
            notification.style.opacity = "0";
            notification.style.transform = "translateX(100%)";
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new PrivateChatApp();
});

export { PrivateChatApp };
