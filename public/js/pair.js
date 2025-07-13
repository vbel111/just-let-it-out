// Pair Me Up - Anonymous 1-on-1 Chat Matchmaking
import { 
    initializeAuth, 
    getCurrentUser,
    rtdb as db
} from "./firebase-config.js";

import {
    ref,
    set,
    onValue,
    off,
    remove,
    onDisconnect,
    get
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

class PairMeUpApp {
    showMatchedNotification(partnerId) {
        // Show a visual notification in the UI when a match is found
        let notification = document.getElementById('matchedNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'matchedNotification';
            notification.className = 'notification notification-success';
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.padding = '16px 32px';
            notification.style.borderRadius = '12px';
            notification.style.background = '#10B981';
            notification.style.color = 'white';
            notification.style.fontWeight = '600';
            notification.style.fontSize = '1.1em';
            notification.style.zIndex = '2000';
            notification.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)';
            document.body.appendChild(notification);
        }
        notification.textContent = `Match found! You will be chatting with: ${partnerId}`;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3500);
    }

    showError(message) {
        // Show a visual error notification in the UI
        let notification = document.getElementById('errorNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'errorNotification';
            notification.className = 'notification notification-error';
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.padding = '16px 32px';
            notification.style.borderRadius = '12px';
            notification.style.background = '#EF4444';
            notification.style.color = 'white';
            notification.style.fontWeight = '600';
            notification.style.fontSize = '1.1em';
            notification.style.zIndex = '2000';
            notification.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)';
            document.body.appendChild(notification);
        }
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3500);
    }
    constructor() {
        this.currentUser = null;
        this.waitingRef = null;
        this.queueRef = null;
        this.isWaiting = false;
        this.init();
    }

    async init() {
        try {
            console.log("Initializing Pair Me Up...");
            // Initialize authentication
            this.currentUser = await initializeAuth();
            console.log("User authenticated:", this.currentUser);
            this.setupEventListeners();
            // Optionally show UI ready state here
        } catch (error) {
            console.error("Pair Me Up initialization failed:", error);
            alert("Failed to connect. Please check your internet connection and try again.");
        }
    }



    setupEventListeners() {
        // Start pairing button
        const startBtn = document.getElementById("startPairing");
        if (startBtn) {
            startBtn.addEventListener("click", () => {
                this.startPairing();
            });
        }

        // Cancel pairing button
        const cancelBtn = document.getElementById("cancelPairing");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                this.cancelPairing();
            });
        }

        // Retry button
        const retryBtn = document.getElementById("retryPairing");
        if (retryBtn) {
            retryBtn.addEventListener("click", () => {
                this.startPairing();
            });
        }

        // Handle page visibility changes
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && this.isWaiting) {
                // User left the page while waiting - cancel pairing
                this.cancelPairing();
            }
        });

        // Handle browser close/refresh
        window.addEventListener("beforeunload", () => {
            if (this.isWaiting) {
                this.cleanup();
            }
        });
    }

    async startPairing() {
        try {
            console.log("Starting pairing process...");
            this.isWaiting = true;
            // Show loading overlay
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            // Check if someone is already waiting
            const queueRef = ref(db, "pair_queue");
            const queueSnapshot = await get(queueRef);
            
            let existingWaiter = null;
            let existingWaiterId = null;

            if (queueSnapshot.exists()) {
                const queueData = queueSnapshot.val();
                // Find someone who isn't us
                for (const [waiterId, waiterData] of Object.entries(queueData)) {
                    if (waiterId !== this.currentUser.uid) {
                        existingWaiter = waiterData;
                        existingWaiterId = waiterId;
                        break;
                    }
                }
            }

            if (existingWaiter && existingWaiterId) {
                // Match found! Create private room
                console.log("Match found with:", existingWaiterId);
                this.showMatchedNotification(existingWaiterId);
                await this.createPrivateRoom(existingWaiterId);
            } else {
                // No match, add to queue and wait
                console.log("No match found, joining queue...");
                await this.joinQueue();
            }

        } catch (error) {
            console.error("Failed to start pairing:", error);
            this.showError("Failed to start pairing. Please try again.");
            this.isWaiting = false;
        }
    }

    async joinQueue() {
        try {
            // Add ourselves to the queue
            this.waitingRef = ref(db, `pair_queue/${this.currentUser.uid}`);
            
            await set(this.waitingRef, {
                uid: this.currentUser.uid,
                timestamp: { ".sv": "timestamp" },
                status: "waiting"
            });

            // Setup disconnect cleanup
            onDisconnect(this.waitingRef).remove();

            // Listen for queue changes (someone else joins)
            this.queueRef = ref(db, "pair_queue");
            onValue(this.queueRef, (snapshot) => {
                if (!this.isWaiting) return;
                this.handleQueueUpdate(snapshot);
            });

            console.log("Joined queue successfully");

        } catch (error) {
            console.error("Failed to join queue:", error);
            throw error;
        }
    }

    handleQueueUpdate(snapshot) {
        if (!snapshot.exists() || !this.isWaiting) return;

        const queueData = snapshot.val();
        const myEntry = queueData[this.currentUser.uid];

        // If our status is 'matched', show matched state and redirect to chatroom
        if (myEntry && myEntry.status === 'matched' && myEntry.roomId) {
            this.isWaiting = false;
            // Hide loading overlay
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            // Show matched UI
            const matchedState = document.getElementById('matchedState');
            if (matchedState) matchedState.style.display = 'block';
            setTimeout(() => {
                window.location.href = `private-room.html?roomId=${myEntry.roomId}`;
            }, 1000);
            return;
        }

        // Look for potential matches (exclude ourselves)
        const otherWaiters = Object.entries(queueData).filter(([uid]) => uid !== this.currentUser.uid && queueData[uid].status === 'waiting');
        if (myEntry && myEntry.status === 'waiting' && otherWaiters.length > 0) {
            const [partnerId, partnerEntry] = otherWaiters[0];
            if (partnerEntry.status === 'waiting') {
                console.log("Found match in queue:", partnerId);
                this.createPrivateRoom(partnerId);
            }
        }
    }

    async createPrivateRoom(partnerId) {
        try {
            console.log("Creating private room with partner:", partnerId);
            
            // Generate room ID
            const roomId = `private_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create private room data
            const roomData = {
                roomId: roomId,
                participants: {
                    [this.currentUser.uid]: {
                        role: "Stranger A",
                        status: "connected",
                        joinedAt: { ".sv": "timestamp" }
                    },
                    [partnerId]: {
                        role: "Stranger B",
                        status: "connected", 
                        joinedAt: { ".sv": "timestamp" }
                    }
                },
                createdAt: { ".sv": "timestamp" },
                status: "active",
                messages: {}
            };

            // Save room to database
            const roomRef = ref(db, `private_chats/${roomId}`);
            await set(roomRef, roomData);

            // Remove both users from queue
            await this.removeFromQueue();
            await set(ref(db, `pair_queue/${partnerId}`), {
                partner: this.currentUser.uid,
                status: 'matched',
                roomId: roomId
            });
            await set(ref(db, `pair_queue/${this.currentUser.uid}`), {
                partner: partnerId,
                status: 'matched',
                roomId: roomId
            });

            setTimeout(() => {
                window.location.href = `private-room.html?roomId=${roomId}`;
            }, 1000);

        } catch (error) {
            console.error("Failed to create private room:", error);
            alert("Failed to create chat room. Please try again.");
        }
    }

    async removeFromQueue() {
        if (this.waitingRef) {
            await remove(this.waitingRef);
            this.waitingRef = null;
        }
    }

    async cancelPairing() {
        this.isWaiting = false;
        // Hide loading overlay
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        const matchedState = document.getElementById('matchedState');
        if (matchedState) matchedState.style.display = 'none';
        if (this.queueRef) {
            off(this.queueRef);
            this.queueRef = null;
        }
        await this.removeFromQueue();
    }

    async cleanup() {
        this.isWaiting = false;
        // Hide loading overlay
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        const matchedState = document.getElementById('matchedState');
        if (matchedState) matchedState.style.display = 'none';
        if (this.queueRef) {
            off(this.queueRef);
            this.queueRef = null;
        }
        await this.removeFromQueue();
    }

    startWaitingTimer() {
        this.waitingSeconds = 0;
        this.waitingTimer = setInterval(() => {
            this.waitingSeconds++;
            this.updateWaitingTime();
        }, 1000);
    }

    stopWaitingTimer() {
        if (this.waitingTimer) {
            clearInterval(this.waitingTimer);
            this.waitingTimer = null;
        }
    }

    updateWaitingTime() {
        const minutes = Math.floor(this.waitingSeconds / 60);
        const seconds = this.waitingSeconds % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const timeElement = document.getElementById("waitingTime");
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }

    updateQueuePosition() {
        const positionElement = document.getElementById("queuePosition");
        if (positionElement) {
            // update position display logic here if needed
        }
        // ... any other logic for updating queue position
    }

    hideAllStates() {
        // Hide stats bar if needed
        const states = ["readyState", "waitingState", "matchedState", "errorState"];
        states.forEach(stateId => {
            const element = document.getElementById(stateId);
            if (element) {
                element.style.display = "none";
            }
        });
    }

    listenForStats() {
        const usersOnlineEl = document.getElementById('usersOnline');
        const totalMatchesEl = document.getElementById('totalMatches');
        const avgWaitEl = document.getElementById('avgWait');
        onValue(ref(db, 'stats'), (snapshot) => {
            const stats = snapshot.val() || {};
            if (usersOnlineEl) usersOnlineEl.textContent = `Users online: ${stats.usersOnline || 0}`;
            if (totalMatchesEl) totalMatchesEl.textContent = `Total matches: ${stats.totalMatches || 0}`;
            if (avgWaitEl) avgWaitEl.textContent = `Avg. wait: ${stats.avgWait || '--'}s`;
        });
    }

    updateStatsUsersOnline(delta) {
        const statsRef = ref(db, 'stats/usersOnline');
        get(statsRef).then(snap => {
            let val = snap.exists() ? snap.val() : 0;
            val = Math.max(0, val + delta);
            set(statsRef, val);
        });
    }

}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new PairMeUpApp();
});

export { PairMeUpApp };
