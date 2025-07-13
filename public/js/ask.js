// ask.js - Anonymous Question Submission Logic
import { 
  app, db, auth,
  doc, getDoc, addDoc, collection, firestoreQuery, where, getDocs,
  onAuthStateChanged, signInAnonymously, serverTimestamp
} from './firebase-config.js';

// DOM Elements
const loadingState = document.getElementById('loadingState');
const userNotFoundState = document.getElementById('userNotFoundState');
const askContent = document.getElementById('askContent');
const successState = document.getElementById('successState');

const recipientAvatar = document.getElementById('recipientAvatar');
const recipientUsername = document.getElementById('recipientUsername');
const recipientQuestions = document.getElementById('recipientQuestions');
const recipientAnswers = document.getElementById('recipientAnswers');

const questionForm = document.getElementById('questionForm');
const questionTextarea = document.getElementById('questionTextarea');
const questionCharCount = document.getElementById('questionCharCount');
const submitQuestionBtn = document.getElementById('submitQuestionBtn');

// Global Variables
let targetUserId = null;
let targetUserData = null;

// Avatar Generation (same as other files)
function generateAvatarSVG(uid) {
  const colors = [
    '#ff6b9d', '#4ecdc4', '#a855f7', '#fcd34d', '#f97316', 
    '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'
  ];
  
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const primaryColor = colors[Math.abs(hash) % colors.length];
  const secondaryColor = colors[Math.abs(hash * 2) % colors.length];
  
  const faceShape = Math.abs(hash * 3) % 3;
  const eyeType = Math.abs(hash * 5) % 4;
  const mouthType = Math.abs(hash * 7) % 4;
  const hasAccessory = Math.abs(hash * 11) % 3 === 0;
  
  const leftEyeX = 24 + (Math.abs(hash * 13) % 6);
  const rightEyeX = 72 - (Math.abs(hash * 13) % 6);
  const eyeY = 35 + (Math.abs(hash * 17) % 8);
  const mouthY = 55 + (Math.abs(hash * 19) % 10);
  
  let faceElement = '';
  if (faceShape === 0) {
    faceElement = `<circle cx="48" cy="48" r="40" fill="${primaryColor}" stroke="#fcd34d" stroke-width="4"/>`;
  } else if (faceShape === 1) {
    faceElement = `<rect x="8" y="8" width="80" height="80" rx="20" fill="${primaryColor}" stroke="#fcd34d" stroke-width="4"/>`;
  } else {
    faceElement = `<ellipse cx="48" cy="48" rx="40" ry="35" fill="${primaryColor}" stroke="#fcd34d" stroke-width="4"/>`;
  }
  
  let eyes = '';
  if (eyeType === 0) {
    eyes = `<circle cx="${leftEyeX}" cy="${eyeY}" r="4" fill="#000"/>
            <circle cx="${rightEyeX}" cy="${eyeY}" r="4" fill="#000"/>`;
  } else if (eyeType === 1) {
    eyes = `<ellipse cx="${leftEyeX}" cy="${eyeY}" rx="6" ry="4" fill="#000"/>
            <ellipse cx="${rightEyeX}" cy="${eyeY}" rx="6" ry="4" fill="#000"/>`;
  } else if (eyeType === 2) {
    eyes = `<rect x="${leftEyeX-3}" y="${eyeY-2}" width="6" height="4" fill="#000"/>
            <rect x="${rightEyeX-3}" y="${eyeY-2}" width="6" height="4" fill="#000"/>`;
  } else {
    eyes = `<polygon points="${leftEyeX-3},${eyeY} ${leftEyeX+3},${eyeY-3} ${leftEyeX+3},${eyeY+3}" fill="#000"/>
            <polygon points="${rightEyeX-3},${eyeY} ${rightEyeX+3},${eyeY-3} ${rightEyeX+3},${eyeY+3}" fill="#000"/>`;
  }
  
  let mouth = '';
  if (mouthType === 0) {
    mouth = `<ellipse cx="48" cy="${mouthY}" rx="8" ry="4" fill="#000"/>`;
  } else if (mouthType === 1) {
    mouth = `<path d="M 40 ${mouthY} Q 48 ${mouthY + 5} 56 ${mouthY}" stroke="#000" stroke-width="2" fill="none"/>`;
  } else if (mouthType === 2) {
    mouth = `<rect x="44" y="${mouthY-1}" width="8" height="2" fill="#000"/>`;
  } else {
    mouth = `<circle cx="48" cy="${mouthY}" r="3" fill="#000"/>`;
  }
  
  let accessory = '';
  if (hasAccessory) {
    accessory = `<rect x="20" y="25" width="56" height="8" rx="4" fill="${secondaryColor}" opacity="0.8"/>`;
  }
  
  return `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
    ${faceElement}
    ${accessory}
    ${eyes}
    ${mouth}
  </svg>`;
}

// Get URL Parameters
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Find User by Username
async function findUserByUsername(username) {
  try {
    // Query users collection by username field
    const usersRef = collection(db, 'users');
    const usernameQuery = firestoreQuery(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(usernameQuery);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    // Get the first matching user
    const userDoc = querySnapshot.docs[0];
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
    
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

// Load Target User Profile
async function loadTargetUser() {
  const username = getUrlParameter('u');
  
  if (!username) {
    showUserNotFound();
    return;
  }
  
  try {
    // Find user by username
    let userData = await findUserByUsername(username);
    

    
    if (!userData) {
      showUserNotFound();
      return;
    }
    
    // Set the target user data
    targetUserId = userData.id;
    targetUserData = userData;
    
    // Update UI
    recipientUsername.textContent = `@${userData.username}`;
    recipientQuestions.textContent = userData.stats?.questionsReceived || 0;
    recipientAnswers.textContent = userData.stats?.answersGiven || 0;
    
    // Generate and set avatar
    const avatarVariant = userData.avatarId !== undefined ? userData.avatarId : 0;
    const avatarSvg = generateAvatarSVG(userData.id + '_variant_' + avatarVariant);
    recipientAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSvg);
    
    // Show the main content
    showAskContent();
    
  } catch (error) {
    console.error('Error loading target user:', error);
    showUserNotFound();
  }
}

// Show Different States
function showUserNotFound() {
  loadingState.style.display = 'none';
  userNotFoundState.style.display = 'block';
  askContent.style.display = 'none';
  successState.style.display = 'none';
}

function showAskContent() {
  loadingState.style.display = 'none';
  userNotFoundState.style.display = 'none';
  askContent.style.display = 'block';
  successState.style.display = 'none';
}

function showSuccessState() {
  loadingState.style.display = 'none';
  userNotFoundState.style.display = 'none';
  askContent.style.display = 'none';
  successState.style.display = 'block';
}

// Submit Question
async function submitQuestion(e) {
  e.preventDefault();
  
  const questionText = questionTextarea.value.trim();
  
  if (!questionText || !targetUserId) {
    showToast('Please enter a question', 'warning');
    return;
  }
  
  if (questionText.length > 500) {
    showToast('Question is too long (max 500 characters)', 'warning');
    return;
  }
  
  try {
    submitQuestionBtn.disabled = true;
    submitQuestionBtn.innerHTML = `
      <div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-right: 8px;"></div>
      Sending...
    `;
    
    // Add question to Firestore
    const questionData = {
      text: questionText,
      recipientId: targetUserId,
      recipientUsername: targetUserData.username,
      createdAt: serverTimestamp(),
      answered: false,
      answer: null,
      answeredAt: null,
      // Anonymous - no sender information stored
      senderIP: null, // Could add for moderation but keeping it anonymous
      reportCount: 0,
      isHidden: false
    };
    
    await addDoc(collection(db, 'questions'), questionData);
    
    showToast('Question sent successfully!', 'success');
    showSuccessState();
    
  } catch (error) {
    console.error('Error submitting question:', error);
    showToast('Failed to send question. Please try again.', 'error');
    
    submitQuestionBtn.disabled = false;
    submitQuestionBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
      Send Question
    `;
  }
}

// Reset Form
window.resetForm = function() {
  questionTextarea.value = '';
  questionCharCount.textContent = '0';
  submitQuestionBtn.disabled = true;
  showAskContent();
};

// Update Character Count and Submit Button
function updateCharacterCount() {
  const length = questionTextarea.value.length;
  questionCharCount.textContent = length;
  
  // Update character count color
  if (length > 450) {
    questionCharCount.style.color = '#ef4444';
  } else if (length > 400) {
    questionCharCount.style.color = '#f59e0b';
  } else {
    questionCharCount.style.color = '#6b7280';
  }
  
  // Enable/disable submit button
  submitQuestionBtn.disabled = length === 0 || length > 500;
}

// Utility Functions
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 24px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    zIndex: '10000',
    opacity: '0',
    transform: 'translateY(-20px)',
    transition: 'all 0.3s ease',
    maxWidth: '300px',
    wordWrap: 'break-word'
  });
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  toast.style.backgroundColor = colors[type] || colors.info;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 100);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Event Listeners
questionTextarea.addEventListener('input', updateCharacterCount);
questionForm.addEventListener('submit', submitQuestion);

// Prevent form submission on Enter key (allow shift+enter for new lines)
questionTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!submitQuestionBtn.disabled) {
      submitQuestion(e);
    }
  }
});

// Initialize Anonymous Authentication (don't need to store anything)
async function initAuth() {
  try {
    // For anonymous question submission, we might not even need auth
    // But keeping it for consistency and potential rate limiting
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (error) {
    console.error('Auth error:', error);
    // Continue anyway for anonymous usage
  }
}

// Initialize app
initAuth();
loadTargetUser();
