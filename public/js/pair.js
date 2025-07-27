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
let isConnected = false;
let typingTimer = null;
let isTyping = false;
let partnerTyping = false;

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

// Create typing indicator element
const typingIndicator = document.createElement('div');
typingIndicator.id = 'typingIndicator';
typingIndicator.className = 'typing-indicator';
typingIndicator.innerHTML = `
  <div class="typing-dots">
    <span></span>
    <span></span>
    <span></span>
  </div>
  <span class="typing-text">Partner is typing...</span>
`;
typingIndicator.style.display = 'none';

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
      
      // Handle typing indicator
      if (currentSessionId && isConnected) {
        this.handleTyping();
      }
    });

    messageInput.addEventListener('keyup', () => {
      // Handle typing indicator on key release
      if (currentSessionId && isConnected) {
        this.handleTyping();
      }
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
    this.updateStatus('searching', 'Looking for partner...');
    this.showWaitingScreen();

    try {
      // Check if user is authenticated
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      console.log('Adding user to pairing queue:', currentUser.uid);
      
      // Check current queue size for user feedback
      const queueSnapshot = await getDocs(collection(db, 'pairingQueue'));
      const queueSize = queueSnapshot.size;
      
      if (queueSize > 0) {
        this.updateStatus('searching', `${queueSize} people waiting...`);
      }
      
      // Add user to pairing queue
      const queueDoc = await addDoc(collection(db, 'pairingQueue'), {
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: 'waiting'
      });

      console.log('Successfully added to queue with ID:', queueDoc.id);

      // Set timeout for pairing (30 seconds)
      pairingTimeout = setTimeout(() => {
        this.cancelPairing();
        this.showError('No partners available right now. Please try again later.');
      }, 30000);

      // Listen for pairing
      this.listenForPairing(queueDoc.id);

    } catch (error) {
      console.error('Error starting pairing:', error);
      this.showError(`Failed to start pairing: ${error.message}`);
    }
  }

  async listenForPairing(queueDocId) {
    // Check for existing pairs
    const pairsQuery = query(
      collection(db, 'chatSessions'),
      where('participants', 'array-contains', currentUser.uid),
      where('status', '==', 'active'),
      limit(1)
    );

    const unsubscribe = onSnapshot(pairsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sessionDoc = snapshot.docs[0];
        currentSessionId = sessionDoc.id;
        const sessionData = sessionDoc.data();
        
        // Get partner ID
        partnerId = sessionData.participants.find(id => id !== currentUser.uid);
        
        // Clear pairing timeout
        if (pairingTimeout) {
          clearTimeout(pairingTimeout);
          pairingTimeout = null;
        }

        // Remove from queue
        this.removeFromQueue(queueDocId);
        
        // Start chat
        this.startChat();
        
        // Unsubscribe from this listener
        unsubscribe();
      }
    });

    // Also try to pair with someone already in queue
    setTimeout(() => {
      this.tryPairWithExisting(queueDocId);
    }, 2000);
  }

  async tryPairWithExisting(myQueueDocId) {
    try {
      // Find someone else in queue
      const queueQuery = query(
        collection(db, 'pairingQueue'),
        where('userId', '!=', currentUser.uid),
        where('status', '==', 'waiting'),
        orderBy('timestamp'),
        limit(1)
      );

      const queueSnapshot = await getDocs(queueQuery);
      
      if (!queueSnapshot.empty) {
        const partnerDoc = queueSnapshot.docs[0];
        const partnerData = partnerDoc.data();
        partnerId = partnerData.userId;

        // Create chat session
        const sessionDoc = await addDoc(collection(db, 'chatSessions'), {
          participants: [currentUser.uid, partnerId],
          createdAt: serverTimestamp(),
          status: 'active'
        });

        currentSessionId = sessionDoc.id;

        // Remove both users from queue
        await deleteDoc(doc(db, 'pairingQueue', myQueueDocId));
        await deleteDoc(doc(db, 'pairingQueue', partnerDoc.id));

        // Clear timeout
        if (pairingTimeout) {
          clearTimeout(pairingTimeout);
          pairingTimeout = null;
        }

        // Start chat
        this.startChat();
      }
    } catch (error) {
      console.error('Error pairing with existing user:', error);
    }
  }

  async removeFromQueue(queueDocId) {
    try {
      await deleteDoc(doc(db, 'pairingQueue', queueDocId));
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  }

  startChat() {
    isConnected = true;
    this.updateStatus('connected', 'Connected');
    this.showChatInterface();
    this.startTimer();
    this.listenToMessages();
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

  async handleTyping() {
    if (!isTyping) {
      isTyping = true;
      try {
        await updateDoc(doc(db, 'chatSessions', currentSessionId), {
          [`typing.${currentUser.uid}`]: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating typing status:', error);
      }
    }

    // Clear existing timer
    if (typingTimer) {
      clearTimeout(typingTimer);
    }

    // Set timer to stop typing indicator after 3 seconds
    typingTimer = setTimeout(async () => {
      isTyping = false;
      try {
        await updateDoc(doc(db, 'chatSessions', currentSessionId), {
          [`typing.${currentUser.uid}`]: null
        });
      } catch (error) {
        console.error('Error clearing typing status:', error);
      }
    }, 3000);
  }

  showTypingIndicator() {
    if (!partnerTyping) {
      partnerTyping = true;
      chatMessages.appendChild(typingIndicator);
      typingIndicator.style.display = 'flex';
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  hideTypingIndicator() {
    if (partnerTyping) {
      partnerTyping = false;
      if (typingIndicator.parentNode) {
        typingIndicator.parentNode.removeChild(typingIndicator);
      }
      typingIndicator.style.display = 'none';
    }
  }

  async listenToMessages() {
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
    });

    // Listen for partner disconnection and typing indicators
    const sessionDoc = doc(db, 'chatSessions', currentSessionId);
    onSnapshot(sessionDoc, (doc) => {
      const sessionData = doc.data();
      if (sessionData) {
        // Check if session ended
        if (sessionData.status === 'ended') {
          this.endChatSession('partner_disconnected');
          return;
        }

        // Check typing indicators
        if (sessionData.typing && partnerId) {
          const partnerTypingTime = sessionData.typing[partnerId];
          if (partnerTypingTime) {
            const now = new Date();
            const typingTime = partnerTypingTime.toDate();
            const timeDiff = now - typingTime;
            
            // Show typing indicator if partner typed within last 4 seconds
            if (timeDiff < 4000) {
              this.showTypingIndicator();
            } else {
              this.hideTypingIndicator();
            }
          } else {
            this.hideTypingIndicator();
          }
        }
      }
    });
  }

  async sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentSessionId) return;

    try {
      // Clear typing indicator when sending
      if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
      }
      
      isTyping = false;
      
      // Clear own typing status
      await updateDoc(doc(db, 'chatSessions', currentSessionId), {
        [`typing.${currentUser.uid}`]: null
      });

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
    isConnected = false;
    
    // Clear timer
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }

    // Stop message listener
    if (messageListener) {
      messageListener();
      messageListener = null;
    }

    // Update session status
    if (currentSessionId) {
      try {
        await updateDoc(doc(db, 'chatSessions', currentSessionId), {
          status: 'ended',
          endedAt: serverTimestamp(),
          endReason: reason
        });
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }

    // Show appropriate end screen
    if (reason === 'time') {
      endReason.textContent = 'Your 5-minute chat session has completed.';
      this.showChatEndedScreen();
    } else if (reason === 'partner_disconnected') {
      this.showDisconnectionScreen();
    } else {
      endReason.textContent = 'Chat session ended.';
      this.showChatEndedScreen();
    }

    this.updateStatus('disconnected', 'Disconnected');
    timerDisplay.style.display = 'none';
  }

  async handleDisconnect(manual = true) {
    if (currentSessionId && isConnected) {
      await this.endChatSession(manual ? 'user_disconnect' : 'page_close');
    }

    // Clean up any pairing processes
    if (pairingTimeout) {
      clearTimeout(pairingTimeout);
      pairingTimeout = null;
    }

    // Reset state
    currentSessionId = null;
    partnerId = null;
    isConnected = false;
  }

  cancelPairing() {
    if (pairingTimeout) {
      clearTimeout(pairingTimeout);
      pairingTimeout = null;
    }
    
    window.location.href = 'index.html';
  }

  restartPairing() {
    // Clean up previous session
    this.handleDisconnect(false);
    
    // Reset state
    currentSessionId = null;
    partnerId = null;
    isConnected = false;
    timeRemaining = 300;
    isTyping = false;
    partnerTyping = false;
    
    // Stop any existing listeners
    if (messageListener) {
      messageListener();
      messageListener = null;
    }
    
    // Clear typing timer
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    
    // Hide typing indicator
    this.hideTypingIndicator();
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      this.startPairing();
    }, 1000);
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
