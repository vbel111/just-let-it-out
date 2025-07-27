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
  getDocs,
  writeBatch
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
let queueStartTime = null;
let queueCountListener = null;

// Sound effects
const sounds = {
  message: () => {
    if (soundEnabled) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAA==');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors
    }
  },
  connect: () => {
    if (soundEnabled) {
      const audio = new Audio('data:audio/wav;base64,UklGRpQDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YXADAADBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAg==');
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore errors
    }
  },
  disconnect: () => {
    if (soundEnabled) {
      const audio = new Audio('data:audio/wav;base64,UklGRpQDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YXADAADBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjiS2PLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAg==');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors
    }
  }
};

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

// Create match notification element
const matchNotification = document.createElement('div');
matchNotification.id = 'matchNotification';
matchNotification.className = 'match-notification';
matchNotification.innerHTML = `
  <div class="match-icon">🎉</div>
  <div class="match-text">Match Found!</div>
  <div class="match-subtext">Starting chat...</div>
`;
matchNotification.style.display = 'none';

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
      console.error('Auth error details:', {
        code: error.code,
        message: error.message
      });
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

    // Page visibility change (handle tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isConnected) {
        // User switched tabs during chat - disconnect
        this.handleDisconnect(true);
      }
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
    queueStartTime = Date.now();
    this.updateStatus('searching', 'Looking for partner...');
    this.showWaitingScreen();
    this.startQueueCountListener();

    try {
      // Check if user is authenticated
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      console.log('Adding user to pairing queue:', currentUser.uid);
      
      // Add user to pairing queue with metadata for scalable random matching
      const queueDoc = await addDoc(collection(db, 'pairingQueue'), {
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: 'waiting',
        region: 'global', // Can be used for regional matching if needed
        joinedAt: Date.now(), // For client-side calculations
        randomSeed: Math.random(), // For random matching order
        lastMatchAttempt: Date.now() // For preventing rapid re-matching
      });

      console.log('Successfully added to queue with ID:', queueDoc.id);

      // Set timeout for pairing (60 seconds for better experience)
      pairingTimeout = setTimeout(() => {
        this.cancelPairing();
        this.showError('No partners available right now. Please try again later.');
      }, 60000);

      // Listen for pairing
      this.listenForPairing(queueDoc.id);

      // Immediately try to find a match with improved random selection
      this.tryInstantMatch(queueDoc.id);

    } catch (error) {
      console.error('Error starting pairing:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        currentUser: currentUser ? currentUser.uid : 'null',
        db: db ? 'initialized' : 'null'
      });
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
          status: 'active',
          messages: []
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
    this.showMatchNotification();
    
    // Show match notification for 2 seconds before starting chat
    setTimeout(() => {
      this.updateStatus('connected', 'Connected');
      this.showChatInterface();
      this.startTimer();
      this.listenToMessages();
    }, 2000);
  }

  showMatchNotification() {
    // Add notification to body
    document.body.appendChild(matchNotification);
    matchNotification.style.display = 'flex';
    
    // Hide after 2 seconds
    setTimeout(() => {
      if (matchNotification.parentNode) {
        matchNotification.parentNode.removeChild(matchNotification);
      }
      matchNotification.style.display = 'none';
    }, 2000);
  }

  startQueueCountListener() {
    // Listen to real-time queue count updates
    const queueQuery = query(
      collection(db, 'pairingQueue'),
      where('status', '==', 'waiting')
    );

    queueCountListener = onSnapshot(queueQuery, (snapshot) => {
      const queueSize = snapshot.size;
      
      if (!isConnected && queueStartTime) {
        const elapsed = Math.floor((Date.now() - queueStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
        
        if (queueSize > 1) {
          this.updateStatus('searching', `${queueSize} people in queue • ${timeStr}`);
        } else {
          this.updateStatus('searching', `Looking for partner... • ${timeStr}`);
        }
      }
    });
  }

  startQueueTimer() {
    // This method now primarily handles the initial setup
    // Real-time updates are handled by startQueueCountListener
  }

  async tryInstantMatch(myQueueDocId) {
    try {
      console.log('Attempting instant match...');
      
      // Find available partners with improved random selection for scalability
      const queueQuery = query(
        collection(db, 'pairingQueue'),
        where('status', '==', 'waiting'),
        where('userId', '!=', currentUser.uid),
        orderBy('userId'), // Order by userId first for != filter
        orderBy('randomSeed'), // Then by random seed for randomization
        limit(10) // Limit for efficiency with large queues
      );

      const querySnapshot = await getDocs(queueQuery);
      
      if (querySnapshot.empty) {
        console.log('No available partners found');
        return false;
      }

      // Select a random partner from available options for better distribution
      const availablePartners = querySnapshot.docs;
      const randomIndex = Math.floor(Math.random() * availablePartners.length);
      const partnerDoc = availablePartners[randomIndex];
      const partnerData = partnerDoc.data();
      const partnerQueueDocId = partnerDoc.id;

      console.log('Found potential partner:', partnerData.userId);

      // Attempt to create chat session atomically
      const sessionId = await this.createChatSession(currentUser.uid, partnerData.userId);
      
      if (sessionId) {
        // Successfully matched! Clean up queue entries
        await this.cleanupQueueEntries([myQueueDocId, partnerQueueDocId]);
        
        // Initialize chat session
        currentSessionId = sessionId;
        partnerId = partnerData.userId;
        
        this.showMatchFound();
        this.initializeChatSession();
        
        console.log('Instant match successful!');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error in instant match:', error);
      return false;
    }
  }

  async createChatSession(user1Id, user2Id) {
    try {
      // Create unique session ID to prevent duplicates
      const sessionData = {
        participants: [user1Id, user2Id],
        status: 'active',
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        messages: []
      };

      const sessionRef = await addDoc(collection(db, 'chatSessions'), sessionData);
      return sessionRef.id;
      
    } catch (error) {
      console.error('Error creating chat session:', error);
      return null;
    }
  }

  async cleanupQueueEntries(queueDocIds) {
    try {
      const batch = writeBatch(db);
      
      for (const docId of queueDocIds) {
        const docRef = doc(db, 'pairingQueue', docId);
        batch.update(docRef, { status: 'matched' });
      }
      
      await batch.commit();
      console.log('Queue entries cleaned up successfully');
      
    } catch (error) {
      console.error('Error cleaning up queue entries:', error);
    }
  }

  showMatchFound() {
    // Hide the waiting screen
    waitingScreen.style.display = 'none';
    statusText.style.display = 'none';
    
    // Show match notification with animation
    matchNotification.innerHTML = `
      <div class="match-content">
        <div class="match-icon">🎉</div>
        <h3>Match Found!</h3>
        <p>Get ready to chat with your partner</p>
      </div>
    `;
    matchNotification.style.display = 'flex';
    
    // Animate the notification
    setTimeout(() => {
      matchNotification.classList.add('show');
    }, 100);
    
    // Hide notification after 3 seconds and show chat
    setTimeout(() => {
      matchNotification.classList.remove('show');
      setTimeout(() => {
        matchNotification.style.display = 'none';
        this.showChatScreen();
      }, 300);
    }, 3000);
  }

  showChatScreen() {
    chatContainer.style.display = 'flex';
    isConnected = true;
    this.startTimer();
  }

  initializeChatSession() {
    console.log('Initializing chat session...');
    
    // Setup chat message listeners
    this.setupChatListeners();
    
    // Clear any existing messages
    messagesContainer.innerHTML = '';
    
    // Show welcome message
    this.showSystemMessage('🎉 Connected! You have 5 minutes to chat. Be kind and respectful.');
    
    // Focus on message input
    messageInput.focus();
  }

  setupChatListeners() {
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
    
    // Add visual warning when time is running out
    if (timeRemaining <= 60) {
      timerDisplay.classList.add('warning');
      timeRemainingSpan.style.color = '#dc3545';
    } else if (timeRemaining <= 120) {
      timerDisplay.classList.add('caution');
      timeRemainingSpan.style.color = '#fd7e14';
    }
    
    // Show warning message
    if (timeRemaining === 60) {
      this.showSystemMessage('⏰ One minute remaining!');
    } else if (timeRemaining === 30) {
      this.showSystemMessage('⚠️ 30 seconds left!');
    }
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

    // Clean up queue count listener
    if (queueCountListener) {
      queueCountListener();
      queueCountListener = null;
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
    
    // Clean up queue count listener
    if (queueCountListener) {
      queueCountListener();
      queueCountListener = null;
    }
    
    window.location.href = 'index.html';
  }

  async restartPairing() {
    // Clean up previous session completely
    await this.handleDisconnect(false);
    
    // Reset all state variables
    currentSessionId = null;
    partnerId = null;
    isConnected = false;
    timeRemaining = 300;
    isTyping = false;
    partnerTyping = false;
    queueStartTime = null;
    
    // Stop any existing listeners
    if (messageListener) {
      messageListener();
      messageListener = null;
    }
    
    // Clear any existing timers
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
    
    if (pairingTimeout) {
      clearTimeout(pairingTimeout);
      pairingTimeout = null;
    }
    
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

  showSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = `<p>${message}</p>`;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    // Simple error display - could be enhanced with toast notifications
    alert(message);
    window.location.href = 'index.html';
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  new PairChatApp();
});
