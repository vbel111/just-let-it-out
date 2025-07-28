// qa.js - Q&A Feature Logic with Firebase Integration
import { 
  app, db, auth, storage,
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  collection, firestoreQuery, firestoreOrderBy, firestoreLimit, where, onSnapshot,
  onAuthStateChanged, signInAnonymously, serverTimestamp
} from './firebase-config.js';

// DOM Elements
const qaAvatar = document.getElementById('qaAvatar');
const qaUsername = document.getElementById('qaUsername');
const questionsReceived = document.getElementById('questionsReceived');
const answersGiven = document.getElementById('answersGiven');
const shareLink = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const shareLinkBtn = document.getElementById('shareLinkBtn');
const questionsFeed = document.getElementById('questionsFeed');
const emptyState = document.getElementById('emptyState');
const filterTabs = document.querySelectorAll('.filter-tab');

// Modal Elements
const answerModal = document.getElementById('answerModal');
const closeAnswerModal = document.getElementById('closeAnswerModal');
const modalQuestionText = document.getElementById('modalQuestionText');
const answerTextarea = document.getElementById('answerTextarea');
const answerCharCount = document.getElementById('answerCharCount');
const skipQuestionBtn = document.getElementById('skipQuestionBtn');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');

// Social Share Modal Elements
const shareStoryModal = document.getElementById('shareStoryModal');
const shareInstagram = document.getElementById('shareInstagram');
const shareTwitter = document.getElementById('shareTwitter');
const shareSnapchat = document.getElementById('shareSnapchat');
const storyAvatar = document.getElementById('storyAvatar');
const storyUsername = document.getElementById('storyUsername');
const storyLink = document.getElementById('storyLink');
const downloadStoryBtn = document.getElementById('downloadStoryBtn');
const closeStoryModal = document.getElementById('closeStoryModal');

// Global Variables
let currentUser = null;
let currentUserData = null;
let currentQuestionId = null;
let currentFilter = 'all';
let questionsListener = null;

// Initialize Authentication
async function initAuth() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (error) {
    console.error('Authentication error:', error);
    showToast('Authentication failed. Please refresh the page.', 'error');
  }
}

// Avatar Generation (same as profile.js)
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

// Load User Profile Data
async function loadUserProfile() {
  if (!currentUser) return;
  
  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      currentUserData = userDocSnap.data();
      const username = currentUserData.username || 'anonymous';
      const displayName = currentUserData.displayName || 'Anonymous User';
      
      // Update UI
      qaUsername.textContent = `@${username}`;
      
      // Set avatar
      const avatarVariant = currentUserData.avatarId !== undefined ? currentUserData.avatarId : 0;
      const avatarSvg = generateAvatarSVG(currentUser.uid + '_variant_' + avatarVariant);
      qaAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSvg);
      storyAvatar.src = qaAvatar.src;
      storyUsername.textContent = `@${username}`;
      
      // Generate and display share link
      const baseUrl = window.location.origin;
      const userShareLink = `${baseUrl}/ask.html?u=${username}`;
      shareLink.value = userShareLink;
      storyLink.textContent = `justletitout.app/ask?u=${username}`;
      
      // Generate QR code for the story modal
      generateStoryWithQR();
      
      // Update stats
      updateStats();
      
      // Load questions
      loadQuestions();
    } else {
      // Redirect to profile if no user data exists
      showToast('Please complete your profile first', 'info');
      setTimeout(() => {
        window.location.href = 'profile.html';
      }, 2000);
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Failed to load profile data', 'error');
  }
}

// Update Stats
async function updateStats() {
  if (!currentUser) return;
  
  try {
    // Count questions received
    const questionsQuery = firestoreQuery(
      collection(db, 'questions'),
      where('recipientId', '==', currentUser.uid)
    );
    
    const questionsSnapshot = await getDocs(questionsQuery);
    const totalQuestions = questionsSnapshot.size;
    
    // Count answers given
    const answeredQuestions = questionsSnapshot.docs.filter(doc => 
      doc.data().answer && doc.data().answer.trim() !== ''
    ).length;
    
    questionsReceived.textContent = totalQuestions;
    answersGiven.textContent = answeredQuestions;
    
    // Update user stats in Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      'stats.questionsReceived': totalQuestions,
      'stats.answersGiven': answeredQuestions
    });
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Load Questions Feed
function loadQuestions() {
  if (!currentUser || questionsListener) return;
  
  let questionsQuery;
  
  if (currentFilter === 'answered') {
    questionsQuery = firestoreQuery(
      collection(db, 'questions'),
      where('recipientId', '==', currentUser.uid),
      where('answered', '==', true),
      firestoreOrderBy('answeredAt', 'desc'),
      firestoreLimit(50)
    );
  } else if (currentFilter === 'unanswered') {
    questionsQuery = firestoreQuery(
      collection(db, 'questions'),
      where('recipientId', '==', currentUser.uid),
      where('answered', '==', false),
      firestoreOrderBy('createdAt', 'desc'),
      firestoreLimit(50)
    );
  } else {
    questionsQuery = firestoreQuery(
      collection(db, 'questions'),
      where('recipientId', '==', currentUser.uid),
      firestoreOrderBy('createdAt', 'desc'),
      firestoreLimit(50)
    );
  }
  
  questionsListener = onSnapshot(questionsQuery, (snapshot) => {
    const questions = [];
    snapshot.forEach((doc) => {
      questions.push({ id: doc.id, ...doc.data() });
    });
    
    displayQuestions(questions);
    updateStats();
  }, (error) => {
    console.error('Error loading questions:', error);
    showToast('Failed to load questions', 'error');
  });
}

// Display Questions in Feed
function displayQuestions(questions) {
  questionsFeed.innerHTML = '';
  
  if (questions.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  questions.forEach(question => {
    const questionElement = createQuestionElement(question);
    questionsFeed.appendChild(questionElement);
  });
}

// Create Question Element

function createQuestionElement(question) {
  const div = document.createElement('div');
  div.className = 'question-card';
  div.dataset.questionId = question.id;
  
  const timeAgo = getTimeAgo(question.createdAt?.toDate() || new Date());
  const isAnswered = question.answered || false;
  
  div.innerHTML = `
    <div class="question-header">
      <div class="question-meta">
        <span class="question-status ${isAnswered ? 'answered' : 'unanswered'}">
          ${isAnswered ? 'Answered' : 'Unanswered'}
        </span>
        <span class="question-time">${timeAgo}</span>
      </div>
      <div class="question-actions">
        ${!isAnswered ? `
          <button class="action-btn answer-btn" onclick="openAnswerModal('${question.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
          </button>
          <button class="action-btn delete-btn" onclick="deleteQuestion('${question.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        ` : ''}
        <button class="action-btn share-btn" onclick="shareQuestionAsImage('${question.id}')">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="question-content">
      <p class="question-text">${escapeHtml(question.text)}</p>
      ${isAnswered ? `
        <div class="answer-section">
          <h4>Your Answer:</h4>
          <p class="answer-text">${escapeHtml(question.answer)}</p>
          <span class="answer-time">Answered ${getTimeAgo(question.answeredAt?.toDate() || new Date())}</span>
        </div>
      ` : ''}
    </div>
  `;
  
  return div;
}

// Add new function to generate question image
async function generateQuestionImage(questionData) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size for social media (1080x1080 for Instagram)
    canvas.width = 1080;
    canvas.height = 1080;
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(200, 200, 100, 0, 2 * Math.PI);
    ctx.arc(880, 300, 80, 0, 2 * Math.PI);
    ctx.arc(150, 800, 60, 0, 2 * Math.PI);
    ctx.arc(900, 850, 90, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add avatar
    const avatarSize = 120;
    const avatarX = (canvas.width - avatarSize) / 2;
    const avatarY = 150;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add username
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(qaUsername.textContent, canvas.width / 2, avatarY + avatarSize + 60);
    
    // Add "Question" label
    ctx.font = '36px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Question', canvas.width / 2, avatarY + avatarSize + 120);
    
    // Add question text with word wrapping
    ctx.fillStyle = 'white';
    ctx.font = 'bold 42px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    
    const questionText = questionData.text;
    const maxWidth = canvas.width - 120;
    const lineHeight = 60;
    let y = 500;
    
    // Word wrap function
    const wrapText = (text, maxWidth) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (let word of words) {
        const testLine = currentLine + word + ' ';
        const testWidth = ctx.measureText(testLine).width;
        
        if (testWidth > maxWidth && currentLine !== '') {
          lines.push(currentLine.trim());
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine.trim());
      return lines;
    };
    
    const lines = wrapText(questionText, maxWidth);
    
    // Draw question text
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, y + (index * lineHeight));
    });
    
    // Add answer if exists
    if (questionData.answered && questionData.answer && questionData.answer !== '[Skipped]') {
      y += (lines.length * lineHeight) + 80;
      
      ctx.font = '32px Inter, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText('Answer', canvas.width / 2, y);
      
      y += 50;
      ctx.font = '36px Inter, Arial, sans-serif';
      ctx.fillStyle = 'white';
      
      const answerLines = wrapText(questionData.answer, maxWidth);
      answerLines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, y + (index * 50));
      });
    }
    
    // Add app branding at bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '28px Inter, Arial, sans-serif';
    ctx.fillText('Just Let It Out', canvas.width / 2, canvas.height - 80);
    
    ctx.font = '24px Inter, Arial, sans-serif';
    ctx.fillText('Ask me anything anonymously', canvas.width / 2, canvas.height - 40);
    
    return canvas;
  } catch (error) {
    console.error('Error generating question image:', error);
    throw error;
  }
}

// Add function to share question as image
window.shareQuestionAsImage = async function(questionId) {
  try {
    // Find question data
    const questionCard = document.querySelector(`[data-question-id="${questionId}"]`);
    if (!questionCard) {
      showToast('Question not found', 'error');
      return;
    }
    
    const questionText = questionCard.querySelector('.question-text').textContent;
    const answerElement = questionCard.querySelector('.answer-text');
    const isAnswered = questionCard.querySelector('.question-status').textContent === 'Answered';
    
    const questionData = {
      id: questionId,
      text: questionText,
      answered: isAnswered,
      answer: answerElement ? answerElement.textContent : null
    };
    
    showToast('Generating image...', 'info');
    
    // Generate image
    const canvas = await generateQuestionImage(questionData);
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
      try {
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `question-${questionId}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Question image downloaded!', 'success');
        
        // Show sharing options
        showQuestionSharingOptions(blob, questionData);
      } catch (error) {
        console.error('Error processing image:', error);
        showToast('Failed to process image', 'error');
      }
    }, 'image/png');
    
  } catch (error) {
    console.error('Error sharing question:', error);
    showToast('Failed to generate question image', 'error');
  }
};

// Add function to show sharing options
function showQuestionSharingOptions(blob, questionData) {
  // Create sharing modal
  const sharingModal = document.createElement('div');
  sharingModal.className = 'modal-overlay';
  sharingModal.id = 'questionSharingModal';
  sharingModal.style.display = 'flex';
  
  sharingModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Share Question</h2>
        <button class="close-btn" onclick="closeQuestionSharingModal()">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p>Question image has been downloaded to your device.</p>
        <div class="sharing-options">
          <button class="share-option" onclick="shareToInstagramStory()">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
              <path d="M12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Instagram Story
          </button>
          <button class="share-option" onclick="shareToTwitterWithImage()">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Twitter
          </button>
          <button class="share-option" onclick="copyQuestionImageToClipboard()">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(sharingModal);
  
  // Store blob for sharing functions
  window.currentQuestionBlob = blob;
  window.currentQuestionData = questionData;
}

// Add sharing functions
window.closeQuestionSharingModal = function() {
  const modal = document.getElementById('questionSharingModal');
  if (modal) {
    modal.remove();
  }
  window.currentQuestionBlob = null;
  window.currentQuestionData = null;
};

window.shareToInstagramStory = function() {
  showToast('Image downloaded! Open Instagram and add it to your story.', 'info');
  closeQuestionSharingModal();
};

window.shareToTwitterWithImage = function() {
  const text = `Check out this question from my Q&A! Ask me anything anonymously: ${shareLink.value}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(twitterUrl, '_blank');
  showToast('Image downloaded! Attach it to your tweet.', 'info');
  closeQuestionSharingModal();
};

window.copyQuestionImageToClipboard = async function() {
  try {
    if (window.currentQuestionBlob && navigator.clipboard && window.ClipboardItem) {
      const clipboardItem = new ClipboardItem({
        'image/png': window.currentQuestionBlob
      });
      await navigator.clipboard.write([clipboardItem]);
      showToast('Question image copied to clipboard!', 'success');
    } else {
      showToast('Image has been downloaded to your device', 'info');
    }
    closeQuestionSharingModal();
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showToast('Image has been downloaded to your device', 'info');
    closeQuestionSharingModal();
  }
};


// Open Answer Modal
window.openAnswerModal = function(questionId) {
  currentQuestionId = questionId;
  
  // Find question data
  const questionCard = document.querySelector(`[data-question-id="${questionId}"]`);
  const questionText = questionCard.querySelector('.question-text').textContent;
  
  modalQuestionText.textContent = questionText;
  answerTextarea.value = '';
  answerCharCount.textContent = '0';
  
  answerModal.style.display = 'flex';
  answerTextarea.focus();
};

// Close Answer Modal
function closeAnswerModalHandler() {
  answerModal.style.display = 'none';
  currentQuestionId = null;
}

// Submit Answer
async function submitAnswer() {
  if (!currentQuestionId || !answerTextarea.value.trim()) {
    showToast('Please enter an answer', 'warning');
    return;
  }
  
  try {
    const questionRef = doc(db, 'questions', currentQuestionId);
    await updateDoc(questionRef, {
      answer: answerTextarea.value.trim(),
      answered: true,
      answeredAt: serverTimestamp()
    });
    
    showToast('Answer submitted successfully!', 'success');
    closeAnswerModalHandler();
  } catch (error) {
    console.error('Error submitting answer:', error);
    showToast('Failed to submit answer', 'error');
  }
}

// Skip Question (Mark as answered without response)
async function skipQuestion() {
  if (!currentQuestionId) return;
  
  try {
    const questionRef = doc(db, 'questions', currentQuestionId);
    await updateDoc(questionRef, {
      answer: '[Skipped]',
      answered: true,
      answeredAt: serverTimestamp()
    });
    
    showToast('Question skipped', 'info');
    closeAnswerModalHandler();
  } catch (error) {
    console.error('Error skipping question:', error);
    showToast('Failed to skip question', 'error');
  }
}

// Delete Question
window.deleteQuestion = async function(questionId) {
  if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, 'questions', questionId));
    showToast('Question deleted', 'success');
  } catch (error) {
    console.error('Error deleting question:', error);
    showToast('Failed to delete question', 'error');
  }
};

// Copy Link to Clipboard
async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    showToast('Link copied to clipboard!', 'success');
    
    // Visual feedback
    const originalText = copyLinkBtn.innerHTML;
    copyLinkBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;
    
    setTimeout(() => {
      copyLinkBtn.innerHTML = originalText;
    }, 2000);
  } catch (error) {
    // Fallback for older browsers
    shareLink.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
  }
}

// Social Sharing Functions
function shareToInstagram() {
  generateStoryWithQR().then(() => {
    shareStoryModal.style.display = 'flex';
  });
}

function shareToTwitter() {
  const text = `Ask me anything anonymously! 💭✨ ${shareLink.value}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(twitterUrl, '_blank');
}

function shareToWhatsapp() {
  const text = `Ask me anything anonymously! 💭✨ ${shareLink.value}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
}

function shareToSnapchat() {
  showToast('Generate your story image and share it on Snapchat!', 'info');
  shareToInstagram(); // Show story modal
}

// Generate Story with QR Code
async function generateStoryWithQR() {
  try {
    const qrContainer = document.querySelector('.qr-placeholder');
    if (!qrContainer) {
      console.warn('QR container not found');
      return;
    }

    // Clear previous QR code
    qrContainer.innerHTML = '<div style="width: 120px; height: 120px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280; text-align: center;">Loading QR...</div>';
    
    // Function to generate QR code with enhanced error handling
    const generateQR = async () => {
      try {
        const libraryType = checkQRLibrary();
        if (!libraryType) {
          console.warn('No QR Code library available, using visual fallback');
          return false;
        }

        const canvas = document.createElement('canvas');
        
        if (libraryType === 'qrcode') {
          // Use QRCode library (node-qrcode)
          const qrPromise = window.QRCode.toCanvas(canvas, shareLink.value, {
            width: 120,
            height: 120,
            margin: 1,
            color: {
              dark: '#1f2937',
              light: '#ffffff'
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('QR generation timeout')), 5000)
          );
          
          await Promise.race([qrPromise, timeoutPromise]);
        } else if (libraryType === 'qrious') {
          // Use QRious library
          const qr = new window.QRious({
            element: canvas,
            value: shareLink.value,
            size: 120,
            background: '#ffffff',
            foreground: '#1f2937'
          });
        } else if (libraryType === 'qrcode-generator') {
          // Use qrcode-generator library
          const qr = window.qrcode(4, 'M');
          qr.addData(shareLink.value);
          qr.make();
          
          const moduleCount = qr.getModuleCount();
          const cellSize = 120 / moduleCount;
          
          canvas.width = 120;
          canvas.height = 120;
          const ctx = canvas.getContext('2d');
          
          // Fill background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 120, 120);
          
          // Draw QR modules
          ctx.fillStyle = '#1f2937';
          for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
              if (qr.isDark(row, col)) {
                ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
              }
            }
          }
        }
        
        qrContainer.innerHTML = '';
        qrContainer.appendChild(canvas);
        console.log('QR code generated successfully');
        return true;
      } catch (error) {
        console.error('QR generation error:', error);
        return false;
      }
    };

    // Try to generate QR code immediately
    const success = await generateQR();
    
    if (!success) {
      // Wait a bit and try again (library might still be loading)
      setTimeout(async () => {
        const retrySuccess = await generateQR();
        
        if (!retrySuccess) {
          // Try simple local QR generation
          const simpleQRSuccess = generateSimpleQR(qrContainer, shareLink.value);
          if (!simpleQRSuccess) {
            // Create enhanced visual fallback QR code
            createVisualQRFallback(qrContainer);
          }
        }
      }, 2000);
    }
  } catch (error) {
    console.error('Error in generateStoryWithQR:', error);
    const qrContainer = document.querySelector('.qr-placeholder');
    if (qrContainer) {
      createVisualQRFallback(qrContainer, true);
    }
  }
}

// Create a visual QR code fallback
function createVisualQRFallback(container, isError = false) {
  const backgroundColor = isError ? '#ef4444' : '#1f2937';
  const title = isError ? 'QR Error' : 'QR CODE';
  const subtitle = isError ? 'Check console' : `Scan to visit:\n${storyLink.textContent}`;
  
  container.innerHTML = `
    <div style="
      width: 120px; 
      height: 120px; 
      background: ${backgroundColor}; 
      color: white; 
      border-radius: 8px; 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      font-size: 10px; 
      text-align: center; 
      padding: 8px; 
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    ">
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
          repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px),
          repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px);
      "></div>
      <div style="font-weight: bold; margin-bottom: 4px; z-index: 1; position: relative;">${title}</div>
      <div style="font-size: 8px; line-height: 1.2; z-index: 1; position: relative;">${subtitle}</div>
    </div>
  `;
}

// Simple local QR generation function (ASCII-style for extreme fallback)
function generateSimpleQR(container, url) {
  try {
    // Create a simple pattern-based QR code representation
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 120;
    canvas.height = 120;
    
    // Create hash from URL for consistent pattern
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash + url.charCodeAt(i)) & 0xffffffff;
    }
    
    const cellSize = 4;
    const gridSize = canvas.width / cellSize;
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Generate pattern
    ctx.fillStyle = '#1f2937';
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const seed = (x * gridSize + y + hash) % 100;
        // Create a more QR-like pattern
        if (seed % 3 === 0 || (x + y) % 4 === 0 || (x * y + hash) % 7 === 0) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
    
    // Add corner markers (QR code style)
    const markerSize = cellSize * 7;
    const drawMarker = (x, y) => {
      // Outer square
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x, y, markerSize, markerSize);
      // Inner white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + cellSize, y + cellSize, markerSize - 2 * cellSize, markerSize - 2 * cellSize);
      // Center dot
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x + 3 * cellSize, y + 3 * cellSize, cellSize, cellSize);
    };
    
    // Draw three corner markers
    drawMarker(0, 0); // Top-left
    drawMarker(canvas.width - markerSize, 0); // Top-right
    drawMarker(0, canvas.height - markerSize); // Bottom-left
    
    container.innerHTML = '';
    container.appendChild(canvas);
    
    console.log('Simple QR pattern generated as local fallback');
    return true;
  } catch (error) {
    console.error('Simple QR generation failed:', error);
    return false;
  }
}

// Download Story Image
async function downloadStory() {
  try {
    // Create a new canvas for the final image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1080;
    canvas.height = 1920;
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(200, 300, 80, 0, 2 * Math.PI);
    ctx.arc(880, 400, 60, 0, 2 * Math.PI);
    ctx.arc(150, 1400, 70, 0, 2 * Math.PI);
    ctx.arc(900, 1500, 90, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add avatar (simplified circle)
    const avatarSize = 120;
    const avatarX = (canvas.width - avatarSize) / 2;
    const avatarY = 300;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add a simple avatar design inside
    ctx.fillStyle = '#667eea';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 - 10, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add username
    ctx.fillStyle = 'white';
    ctx.font = 'bold 56px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(storyUsername.textContent, canvas.width / 2, avatarY + avatarSize + 80);
    
    // Add main text
    ctx.font = 'bold 72px Inter, Arial, sans-serif';
    ctx.fillText('Ask me anything!', canvas.width / 2, 900);
    
    ctx.font = '48px Inter, Arial, sans-serif';
    ctx.fillText('Send me anonymous questions', canvas.width / 2, 980);
    
    // Add app name
    ctx.font = '36px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Just Let It Out', canvas.width / 2, 1100);
    
    // Generate QR code directly on canvas
    const qrSize = 200;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 1200;
    
    // Add QR code background
    ctx.fillStyle = 'white';
    ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
    
    // Generate QR code with enhanced fallback
    try {
      let qrGenerated = false;
      const libraryType = checkQRLibrary();
      
      if (libraryType === 'qrcode' && window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        try {
          // Create a temporary canvas for QR code using QRCode library
          const qrCanvas = document.createElement('canvas');
          await window.QRCode.toCanvas(qrCanvas, shareLink.value, {
            width: qrSize,
            height: qrSize,
            margin: 1,
            color: {
              dark: '#1f2937',
              light: '#ffffff'
            }
          });
          
          // Draw QR code onto main canvas
          ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
          qrGenerated = true;
          console.log('QR code generated successfully for story download using QRCode');
        } catch (qrError) {
          console.error('QRCode Canvas generation failed:', qrError);
        }
      } else if (libraryType === 'qrious' && window.QRious) {
        try {
          // Create a temporary canvas for QR code using QRious library
          const qrCanvas = document.createElement('canvas');
          new window.QRious({
            element: qrCanvas,
            value: shareLink.value,
            size: qrSize,
            background: '#ffffff',
            foreground: '#1f2937'
          });
          
          // Draw QR code onto main canvas
          ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
          qrGenerated = true;
          console.log('QR code generated successfully for story download using QRious');
        } catch (qrError) {
          console.error('QRious Canvas generation failed:', qrError);
        }
      } else if (libraryType === 'qrcode-generator' && window.qrcode) {
        try {
          // Create a temporary canvas for QR code using qrcode-generator library
          const qrCanvas = document.createElement('canvas');
          const qr = window.qrcode(4, 'M');
          qr.addData(shareLink.value);
          qr.make();
          
          const moduleCount = qr.getModuleCount();
          const cellSize = qrSize / moduleCount;
          
          qrCanvas.width = qrSize;
          qrCanvas.height = qrSize;
          const qrCtx = qrCanvas.getContext('2d');
          
          // Fill background
          qrCtx.fillStyle = '#ffffff';
          qrCtx.fillRect(0, 0, qrSize, qrSize);
          
          // Draw QR modules
          qrCtx.fillStyle = '#1f2937';
          for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
              if (qr.isDark(row, col)) {
                qrCtx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
              }
            }
          }
          
          // Draw QR code onto main canvas
          ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
          qrGenerated = true;
          console.log('QR code generated successfully for story download using qrcode-generator');
        } catch (qrError) {
          console.error('qrcode-generator Canvas generation failed:', qrError);
        }
      }
      
      if (!qrGenerated) {
        console.log('Creating enhanced visual QR fallback for story download');
        // Enhanced fallback with better visual design
        const patternSize = 10;
        const cellSize = qrSize / patternSize;
        
        // Create a more sophisticated pattern based on the URL
        const urlHash = shareLink.value.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        
        // Base background
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        
        // Generate a more complex pseudo-random pattern
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < patternSize; i++) {
          for (let j = 0; j < patternSize; j++) {
            const seed = (i * patternSize + j + urlHash) % 100;
            // More varied pattern generation
            if ((seed % 3 === 0) || (i + j) % 4 === 0 || (i * j) % 7 === 0) {
              ctx.fillRect(qrX + i * cellSize, qrY + j * cellSize, cellSize, cellSize);
            }
          }
        }
        
        // Add QR code corner markers for authenticity
        const markerSize = cellSize * 3;
        
        // Function to draw corner marker
        const drawCornerMarker = (x, y) => {
          // Outer square
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(x, y, markerSize, markerSize);
          // Inner square
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + cellSize, y + cellSize, cellSize, cellSize);
        };
        
        // Draw corner markers
        drawCornerMarker(qrX, qrY); // Top-left
        drawCornerMarker(qrX + qrSize - markerSize, qrY); // Top-right
        drawCornerMarker(qrX, qrY + qrSize - markerSize); // Bottom-left
        
        // Add center alignment pattern
        const centerX = qrX + qrSize/2 - cellSize;
        const centerY = qrY + qrSize/2 - cellSize;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(centerX, centerY, cellSize * 2, cellSize * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(centerX + cellSize/2, centerY + cellSize/2, cellSize, cellSize);
        
        // Add subtle "SCAN ME" text overlay
        ctx.fillStyle = 'rgba(31, 41, 55, 0.85)';
        ctx.fillRect(qrX + 30, qrY + qrSize/2 - 15, qrSize - 60, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCAN ME', qrX + qrSize/2, qrY + qrSize/2 + 5);
      }
    } catch (qrError) {
      console.error('QR code generation completely failed:', qrError);
      // Final fallback: simple text-based QR placeholder
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = '#6b7280';
      ctx.font = 'bold 24px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR CODE', qrX + qrSize/2, qrY + qrSize/2 - 10);
      ctx.font = '16px Inter, Arial, sans-serif';
      ctx.fillText('Visit link below', qrX + qrSize/2, qrY + qrSize/2 + 20);
    }
    
    // Add link text
    ctx.fillStyle = 'white';
    ctx.font = '32px Inter, Arial, sans-serif';
    ctx.fillText(storyLink.textContent, canvas.width / 2, qrY + qrSize + 80);
    
    // Add call to action
    ctx.font = '28px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('Scan or visit link to ask questions', canvas.width / 2, qrY + qrSize + 130);
    
    // Convert to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa-story-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Story image downloaded!', 'success');
    }, 'image/png');
  } catch (error) {
    console.error('Error downloading story:', error);
    showToast('Failed to download story', 'error');
  }
}

// Filter Questions
function setFilter(filter) {
  currentFilter = filter;
  
  // Update active tab
  filterTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  
  // Reload questions with new filter
  if (questionsListener) {
    questionsListener();
    questionsListener = null;
  }
  loadQuestions();
}

// Utility Functions
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Style the toast
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
  
  // Set background color based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  toast.style.backgroundColor = colors[type] || colors.info;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 100);
  
  // Remove after 3 seconds
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

// Initialize QR Code Library Check
function initializeQRCheck() {
  console.log('🔍 Initializing QR Code Library Check - Version 2.0');
  
  // Check QR library availability immediately 
  const checkQRLibrary = () => {
    // Check for QRCode library (node-qrcode)
    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
      console.log('✅ QRCode library loaded successfully');
      return 'qrcode';
    }
    // Check for QRious library
    if (window.QRious && typeof window.QRious === 'function') {
      console.log('✅ QRious library loaded successfully');
      return 'qrious';
    }
    // Check for qrcode-generator library
    if (window.qrcode && typeof window.qrcode === 'function') {
      console.log('✅ qrcode-generator library loaded successfully');
      return 'qrcode-generator';
    }
    return false;
  };

  // Check immediately
  if (checkQRLibrary()) {
    return;
  }

  // Multi-tier fallback approach for production
  const loadQRLibrary = async () => {
    console.log('🌐 Starting QR library loading process...');
    
    // Quick network connectivity check
    if (!navigator.onLine) {
      console.warn('⚠️ Device appears to be offline, skipping QR library loading');
      showToast('You appear to be offline. QR codes will be unavailable.', 'warning');
      return false;
    }

    const cdnUrls = [
      'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
      'https://unpkg.com/qrious@4.0.2/dist/qrious.min.js',
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js',
      'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'
    ];

    console.log('📚 Available CDN URLs:', cdnUrls);

    for (const url of cdnUrls) {
      try {
        console.log(`Attempting to load QR library from: ${url}`);
        await loadScript(url);
        
        // Wait a moment for library to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if library loaded successfully
        const libraryType = checkQRLibrary();
        if (libraryType) {
          console.log(`QR Code library (${libraryType}) loaded successfully from:`, url);
          // Regenerate QR if needed
          const shareModal = document.getElementById('shareStoryModal');
          if (shareModal && shareModal.style.display !== 'none') {
            generateStoryWithQR();
          }
          return true;
        } else {
          console.warn(`QR library loaded from ${url} but API not available`);
        }
      } catch (error) {
        console.warn(`Failed to load QR library from ${url}:`, error);
        continue;
      }
    }

    // If all CDNs fail, try QR API services as fallback
    console.log('All QR Code library sources failed - trying API fallback');
    
    const tryQRAPI = async () => {
      try {
        const qrAPIs = [
          `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareLink.value)}`,
          `https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=${encodeURIComponent(shareLink.value)}`
        ];
        
        for (const apiUrl of qrAPIs) {
          try {
            console.log('Trying QR API:', apiUrl);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const loadPromise = new Promise((resolve, reject) => {
              img.onload = () => resolve(img);
              img.onerror = reject;
              setTimeout(() => reject(new Error('API timeout')), 5000);
            });
            
            img.src = apiUrl;
            const loadedImg = await loadPromise;
            
            // Update QR containers with API-generated image
            const qrContainers = document.querySelectorAll('.qr-placeholder');
            qrContainers.forEach(container => {
              const imgClone = loadedImg.cloneNode();
              imgClone.style.width = '120px';
              imgClone.style.height = '120px';
              imgClone.style.borderRadius = '8px';
              container.innerHTML = '';
              container.appendChild(imgClone);
            });
            
            console.log('QR code generated successfully via API');
            showToast('QR code loaded via backup service', 'success');
            return true;
          } catch (apiError) {
            console.warn(`QR API failed: ${apiUrl}`, apiError);
            continue;
          }
        }
        return false;
      } catch (error) {
        console.error('All QR API services failed:', error);
        return false;
      }
    };
    
    const apiSuccess = await tryQRAPI();
    if (apiSuccess) return true;
    
    // If all methods fail, show graceful message
    console.error('All QR Code generation methods failed - likely network connectivity issue');
    
    // Show user-friendly message
    showToast('QR code unavailable due to network issues. You can still share your link manually!', 'warning');
    
    // Update any QR containers with helpful fallback
    const qrContainers = document.querySelectorAll('.qr-placeholder');
    qrContainers.forEach(container => {
      container.innerHTML = `
        <div style="width: 120px; height: 120px; background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; text-align: center; padding: 8px; box-sizing: border-box; position: relative; overflow: hidden;">
          <div style="position: absolute; top: -20px; right: -20px; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
          <div style="position: absolute; bottom: -15px; left: -15px; width: 30px; height: 30px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
          <div style="font-weight: bold; margin-bottom: 4px; z-index: 1;">📱 Share Link</div>
          <div style="font-size: 8px; line-height: 1.2; z-index: 1;">Copy link below<br>to share manually</div>
        </div>
      `;
    });
    return false;
  };

  // Helper function to load script with Promise and timeout
  const loadScript = (src, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      // Remove existing script if present
      const existingScript = document.querySelector(`script[src*="qrcode"], script[src*="qrious"]`);
      if (existingScript) {
        console.log('🗑️ Removing existing QR script:', existingScript.src);
        existingScript.remove();
      }

      // Add cache buster for better loading
      const cacheBuster = Date.now();
      const srcWithCacheBuster = src.includes('?') ? `${src}&_cb=${cacheBuster}` : `${src}?_cb=${cacheBuster}`;

      const script = document.createElement('script');
      script.src = srcWithCacheBuster;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      console.log('⬇️ Loading script:', srcWithCacheBuster);
      
      let timeoutId;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
      };
      
      script.onload = () => {
        console.log('✅ Script loaded successfully:', src);
        cleanup();
        resolve();
      };
      
      script.onerror = (error) => {
        console.log('❌ Script failed to load:', src, error);
        cleanup();
        script.remove();
        reject(error);
      };
      
      // Set timeout
      timeoutId = setTimeout(() => {
        console.log('⏰ Script loading timeout:', src);
        cleanup();
        script.remove();
        reject(new Error(`Script loading timeout: ${src}`));
      }, timeout);
      
      document.head.appendChild(script);
    });
  };

  // Try loading after a short delay to allow page to fully load
  setTimeout(() => {
    if (!checkQRLibrary()) {
      loadQRLibrary();
    }
  }, 1000);
}

// Event Listeners
copyLinkBtn.addEventListener('click', copyLink);
shareInstagram.addEventListener('click', shareToInstagram);
shareTwitter.addEventListener('click', shareToTwitter);

const shareWhatsapp = document.getElementById('shareWhatsapp');
shareWhatsapp.addEventListener('click', shareToWhatsapp);

shareSnapchat.addEventListener('click', shareToSnapchat);
shareLinkBtn.addEventListener('click', copyLink);
closeAnswerModal.addEventListener('click', closeAnswerModalHandler);
submitAnswerBtn.addEventListener('click', submitAnswer);
skipQuestionBtn.addEventListener('click', skipQuestion);
downloadStoryBtn.addEventListener('click', downloadStory);
closeStoryModal.addEventListener('click', () => {
  shareStoryModal.style.display = 'none';
});

// Initialize QR check
console.log('🚀 QA.js loaded - Version 2.0 with enhanced QR fallbacks');
initializeQRCheck();

// Answer textarea character count
answerTextarea.addEventListener('input', () => {
  const length = answerTextarea.value.length;
  answerCharCount.textContent = length;
  
  if (length > 450) {
    answerCharCount.style.color = '#ef4444';
  } else if (length > 400) {
    answerCharCount.style.color = '#f59e0b';
  } else {
    answerCharCount.style.color = '#6b7280';
  }
});

// Filter tabs
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    setFilter(tab.dataset.filter);
  });
});

// Close modals on outside click
answerModal.addEventListener('click', (e) => {
  if (e.target === answerModal) {
    closeAnswerModalHandler();
  }
});

shareStoryModal.addEventListener('click', (e) => {
  if (e.target === shareStoryModal) {
    shareStoryModal.style.display = 'none';
  }
});

// Initialize app
initAuth();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserProfile();
  } else {
    await initAuth();
  }
});
