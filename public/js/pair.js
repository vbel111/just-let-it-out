// Import Firebase modules
import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged, 
  signInAnonymously 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  collection, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  updateDoc,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Global variables
let currentUser = null;
let currentSessionId = null;
let partnerId = null;
let sessionTimer = null;
let timeRemaining = 300; // 5 minutes in seconds
let pairingTimeout = null;
let messageListener = null;
let sessionListener = null;
let queueListener = null;
let isConnected = false;
let currentQueueDocId = null;
let isProcessingPairing = false;
let isSessionEnded = false;

// DOM elements
const backBtn = document.getElementById('backBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const timerDisplay = document.getElementById('timerDisplay');
const timeRemainingSpan = document.getElementById('timeRemaining');
const waitingScreen = document.getElementById('waitingScreen');
const chatInterface = document.getElementById('chatInterface');
const chatEndedScreen = document.getElementById('chatEndedScreen');
const disconnectionScreen = document.getElementById('disconnectionScreen');
const cancelSearchBtn = document.getElementById('cancelSearchBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const disconnectControls = document.getElementById('disconnectControls');
const disconnectBtn = document.getElementById('disconnectBtn');
const findNewPartnerBtn = document.getElementById('findNewPartnerBtn');
const findNewPartnerBtn2 = document.getElementById('findNewPartnerBtn2');
const goHomeBtn = document.getElementById('goHomeBtn');
const goHomeBtn2 = document.getElementById('goHomeBtn2');
const endReason = document.getElementById('endReason');

// Pair Chat App Class
class PairChatApp {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Initializing PairChatApp...');
    
    // Set up authentication
    onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? user.uid : 'no user');
      if (user) {
        currentUser = user;
        console.log('User authenticated, starting pairing...');
        this.startPairing();
      } else {
        console.log('No user, authenticating anonymously...');
        this.authenticateUser();
      }
    });

    this.setupEventListeners();
  }

  async authenticateUser() {
    try {
      console.log('Attempting anonymous sign-in...');
      const result = await signInAnonymously(auth);
      console.log('Anonymous sign-in successful:', result.user.uid);
    } catch (error) {
      console.error('Authentication failed:', error);
      this.showError(`Failed to connect: ${error.message}`);
    }
  }

  setupEventListeners() {
    // Back button
    backBtn.addEventListener('click', () => {
      this.handleDisconnect(false);
      window.location.href = 'index.html';
    });

    // Cancel search
    cancelSearchBtn.addEventListener('click', () => {
      this.cancelPairing();
    });

    // Send message
    sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Message input
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    messageInput.addEventListener('input', () => {
      this.adjustTextareaHeight();
      sendBtn.disabled = !messageInput.value.trim();
    });

    // Disconnect button
    disconnectBtn.addEventListener('click', () => {
      this.handleDisconnect(true);
    });

    // End screen buttons
    findNewPartnerBtn.addEventListener('click', () => {
      this.restartPairing();
    });

    findNewPartnerBtn2.addEventListener('click', () => {
      this.restartPairing();
    });

    goHomeBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    goHomeBtn2.addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      if (isConnected || currentSessionId) {
        this.handleDisconnect(false);
      }
    });
  }

  async startPairing() {
    console.log('Starting pairing process...');
    
    // Prevent multiple pairing attempts
    if (isProcessingPairing) {
      console.log('Already processing pairing, skipping...');
      return;
    }
    
    isProcessingPairing = true;
    isSessionEnded = false;
    
    this.updateStatus('searching', 'Looking for partner...');
    this.showWaitingScreen();

    try {
      // Check if user is authenticated
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Clean up any existing queue entries for this user
      await this.cleanupUserQueue();

      console.log('Adding user to pairing queue:', currentUser.uid);
      
      // Add user to pairing queue with better error handling
      const queueDoc = await addDoc(collection(db, 'pairingQueue'), {
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: 'waiting',
        expiresAt: new Date(Date.now() + 60000) // Expire after 1 minute
      });

      currentQueueDocId = queueDoc.id;
      console.log('Successfully added to queue with ID:', queueDoc.id);

      // Set timeout for pairing (45 seconds)
      pairingTimeout = setTimeout(() => {
        console.log('Pairing timeout reached');
        this.cancelPairing();
        this.showError('No partners available right now. Please try again later.');
      }, 45000);

      // Listen for pairing
      await this.listenForPairing();

    } catch (error) {
      console.error('Error starting pairing:', error);
      isProcessingPairing = false;
      this.showError(`Failed to start pairing: ${error.message}`);
    }
  }

  async cleanupUserQueue() {
    try {
      const existingQueueQuery = query(
        collection(db, 'pairingQueue'),
        where('userId', '==', currentUser.uid)
      );
      
      const existingDocs = await getDocs(existingQueueQuery);
      
      for (const doc of existingDocs.docs) {
        await deleteDoc(doc.ref);
        console.log('Cleaned up existing queue entry:', doc.id);
      }
    } catch (error) {
      console.error('Error cleaning up queue:', error);
    }
  }

  async listenForPairing() {
    console.log('Setting up pairing listeners...');
    
    // First, try to pair immediately with existing users
    await this.tryPairWithExisting();
    
    // If no immediate pairing, listen for new sessions
    if (!isConnected && !isSessionEnded) {
      const pairsQuery = query(
        collection(db, 'chatSessions'),
        where('participants', 'array-contains', currentUser.uid),
        where('status', '==', 'active'),
        limit(1)
      );

      sessionListener = onSnapshot(pairsQuery, (snapshot) => {
        console.log('Session listener triggered, docs:', snapshot.docs.length);
        
        if (!snapshot.empty && !isConnected && !isSessionEnded) {
          const sessionDoc = snapshot.docs[0];
          currentSessionId = sessionDoc.id;
          const sessionData = sessionDoc.data();
          
          console.log('Found active session:', currentSessionId);
          
          // Get partner ID
          partnerId = sessionData.participants.find(id => id !== currentUser.uid);
          
          // Clear pairing timeout
          this.clearPairingTimeout();
          
          // Remove from queue
          this.removeFromQueue();
          
          // Start chat
          this.startChat();
        }
      }, (error) => {
        console.error('Error in session listener:', error);
      });
    }
  }

  async tryPairWithExisting() {
    if (isConnected || isSessionEnded) {
      console.log('Already connected or session ended, skipping pairing attempt');
      return;
    }

    try {
      console.log('Trying to pair with existing user...');
      
      // Find someone else in queue (with better filtering)
      const queueQuery = query(
        collection(db, 'pairingQueue'),
        where('status', '==', 'waiting'),
        orderBy('timestamp'),
        limit(10) // Get multiple candidates
      );

      const queueSnapshot = await getDocs(queueQuery);
      
      // Filter out our own entry and expired entries
      const availablePartners = queueSnapshot.docs.filter(doc => {
        const data = doc.data();
        const isNotMe = data.userId !== currentUser.uid;
        const isNotExpired = !data.expiresAt || data.expiresAt.toDate() > new Date();
        return isNotMe && isNotExpired;
      });

      if (availablePartners.length > 0) {
        const partnerDoc = availablePartners[0];
        const partnerData = partnerDoc.data();
        partnerId = partnerData.userId;

        console.log('Found partner:', partnerId);

        // Create chat session atomically
        const sessionDoc = await addDoc(collection(db, 'chatSessions'), {
          participants: [currentUser.uid, partnerId],
          createdAt: serverTimestamp(),
          status: 'active',
          expiresAt: new Date(Date.now() + 300000) // 5 minutes
        });

        currentSessionId = sessionDoc.id;
        console.log('Created session:', currentSessionId);

        // Remove both users from queue
        await this.removeFromQueue();
        await deleteDoc(doc(db, 'pairingQueue', partnerDoc.id));

        // Clear timeout
        this.clearPairingTimeout();

        // Start chat
        this.startChat();
        
        return true;
      } else {
        console.log('No available partners found, continuing to wait...');
        return false;
      }
    } catch (error) {
      console.error('Error pairing with existing user:', error);
      return false;
    }
  }

  clearPairingTimeout() {
    if (pairingTimeout) {
      clearTimeout(pairingTimeout);
      pairingTimeout = null;
      console.log('Cleared pairing timeout');
    }
  }

  async removeFromQueue() {
    if (currentQueueDocId) {
      try {
        await deleteDoc(doc(db, 'pairingQueue', currentQueueDocId));
        console.log('Removed from queue:', currentQueueDocId);
        currentQueueDocId = null;
      } catch (error) {
        console.error('Error removing from queue:', error);
      }
    }
  }

  startChat() {
    if (isConnected || isSessionEnded) {
      console.log('Already connected or session ended, skipping chat start');
      return;
    }

    console.log('Starting chat with partner:', partnerId);
    isConnected = true;
    isProcessingPairing = false;
    
    this.updateStatus('connected', 'Connected');
    this.showChatInterface();
    this.startTimer();
    this.listenToMessages();
    this.listenToSession();
  }

  startTimer() {
    timeRemaining = 300; // 5 minutes
    timerDisplay.style.display = 'flex';
    
    sessionTimer = setInterval(() => {
      timeRemaining--;
      this.updateTimerDisplay();
      
      if (timeRemaining <= 0) {
        this.endChatSession('time');
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timeRemainingSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  async listenToMessages() {
    if (!currentSessionId) {
      console.error('No session ID for message listening');
      return;
    }

    // Clear existing messages first
    chatMessages.innerHTML = `
      <div class="system-message">
        <p>You're now connected with a stranger. Be kind and respectful!</p>
        <p>This chat will automatically end in 5 minutes.</p>
      </div>
    `;

    const messagesQuery = query(
      collection(db, 'chatSessions', currentSessionId, 'messages'),
      orderBy('timestamp')
    );

    messageListener = onSnapshot(messagesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const messageData = change.doc.data();
          // Only add the message if it doesn't already exist
          if (!document.querySelector(`[data-message-id="${change.doc.id}"]`)) {
            this.displayMessage(messageData, change.doc.id);
          }
        }
      });
    }, (error) => {
      console.error('Error in message listener:', error);
    });
  }

  listenToSession() {
    if (!currentSessionId) {
      console.error('No session ID for session listening');
      return;
    }

    // Listen for session changes (partner disconnection, etc.)
    const sessionDoc = doc(db, 'chatSessions', currentSessionId);
    const sessionUnsubscribe = onSnapshot(sessionDoc, (doc) => {
      if (doc.exists()) {
        const sessionData = doc.data();
        console.log('Session status:', sessionData.status);
        
        if (sessionData.status === 'ended' && isConnected && !isSessionEnded) {
          console.log('Session ended by partner or system');
          this.endChatSession('partner_disconnected');
        }
      } else {
        console.log('Session document no longer exists');
        if (isConnected && !isSessionEnded) {
          this.endChatSession('session_deleted');
        }
      }
    }, (error) => {
      console.error('Error in session listener:', error);
    });

    // Store the unsubscribe function
    if (!sessionListener) {
      sessionListener = sessionUnsubscribe;
    }
  }

  async sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentSessionId) return;

    try {
      await addDoc(collection(db, 'chatSessions', currentSessionId, 'messages'), {
        senderId: currentUser.uid,
        message: message,
        timestamp: serverTimestamp()
      });

      messageInput.value = '';
      sendBtn.disabled = true;
      this.adjustTextareaHeight();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  displayMessage(messageData, messageId) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${messageData.senderId === currentUser.uid ? 'sent' : 'received'}`;
    messageDiv.setAttribute('data-message-id', messageId);
    
    const time = messageData.timestamp ? new Date(messageData.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
    
    messageDiv.innerHTML = `
      <div class="message-bubble">${this.escapeHtml(messageData.message)}</div>
      <div class="message-time">${time}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async endChatSession(reason) {
    if (isSessionEnded) {
      console.log('Session already ended, skipping...');
      return;
    }

    console.log('Ending chat session, reason:', reason);
    isSessionEnded = true;
    isConnected = false;
    
    // Clear timer
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }

    // Stop all listeners
    this.cleanupListeners();

    // Update session status in Firestore
    if (currentSessionId) {
      try {
        await updateDoc(doc(db, 'chatSessions', currentSessionId), {
          status: 'ended',
          endedAt: serverTimestamp(),
          endReason: reason
        });
        console.log('Session marked as ended in Firestore');
      } catch (error) {
        console.error('Error ending session in Firestore:', error);
      }
    }

    // Show appropriate end screen
    if (reason === 'time') {
      endReason.textContent = 'Your 5-minute chat session has completed.';
      this.showChatEndedScreen();
    } else if (reason === 'partner_disconnected') {
      this.showDisconnectionScreen();
    } else if (reason === 'session_deleted') {
      endReason.textContent = 'Connection lost. Session ended unexpectedly.';
      this.showDisconnectionScreen();
    } else {
      endReason.textContent = 'Chat session ended.';
      this.showChatEndedScreen();
    }

    this.updateStatus('disconnected', 'Disconnected');
    timerDisplay.style.display = 'none';
  }

  cleanupListeners() {
    // Stop message listener
    if (messageListener) {
      messageListener();
      messageListener = null;
      console.log('Cleaned up message listener');
    }

    // Stop session listener
    if (sessionListener) {
      sessionListener();
      sessionListener = null;
      console.log('Cleaned up session listener');
    }

    // Stop queue listener
    if (queueListener) {
      queueListener();
      queueListener = null;
      console.log('Cleaned up queue listener');
    }
  }

  async handleDisconnect(manual = true) {
    console.log('Handling disconnect, manual:', manual);
    
    if (currentSessionId && isConnected && !isSessionEnded) {
      await this.endChatSession(manual ? 'user_disconnect' : 'page_close');
    }

    // Clean up any pairing processes
    this.clearPairingTimeout();
    
    // Clean up listeners
    this.cleanupListeners();

    // Remove from queue if still in it
    await this.removeFromQueue();

    // Reset state
    this.resetState();
  }

  resetState() {
    currentSessionId = null;
    partnerId = null;
    isConnected = false;
    isProcessingPairing = false;
    isSessionEnded = false;
    currentQueueDocId = null;
    timeRemaining = 300;
    console.log('State reset complete');
  }

  cancelPairing() {
    console.log('Canceling pairing...');
    
    this.clearPairingTimeout();
    this.cleanupListeners();
    this.removeFromQueue();
    this.resetState();
    
    window.location.href = 'index.html';
  }

  restartPairing() {
    console.log('Restarting pairing...');
    
    // Clean up previous session
    this.handleDisconnect(false);
    
    // Reset state completely
    this.resetState();
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      if (!isProcessingPairing) {
        this.startPairing();
      }
    }, 1500);
  }

  // UI Helper Methods
  updateStatus(status, text) {
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
  }

  showWaitingScreen() {
    waitingScreen.style.display = 'flex';
    chatInterface.style.display = 'none';
    chatEndedScreen.style.display = 'none';
    disconnectionScreen.style.display = 'none';
    disconnectControls.style.display = 'none';
  }

  showChatInterface() {
    waitingScreen.style.display = 'none';
    chatInterface.style.display = 'flex';
    chatEndedScreen.style.display = 'none';
    disconnectionScreen.style.display = 'none';
    disconnectControls.style.display = 'block';
    
    messageInput.focus();
  }

  showChatEndedScreen() {
    waitingScreen.style.display = 'none';
    chatInterface.style.display = 'none';
    chatEndedScreen.style.display = 'flex';
    disconnectionScreen.style.display = 'none';
    disconnectControls.style.display = 'none';
  }

  showDisconnectionScreen() {
    waitingScreen.style.display = 'none';
    chatInterface.style.display = 'none';
    chatEndedScreen.style.display = 'none';
    disconnectionScreen.style.display = 'flex';
    disconnectControls.style.display = 'none';
  }

  adjustTextareaHeight() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    alert(message);
    window.location.href = 'index.html';
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  new PairChatApp();
});
