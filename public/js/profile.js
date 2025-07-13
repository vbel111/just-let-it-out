// profile.js - Handles profile page logic and Firebase sync
import { 
  app, db, auth, storage,
  doc, getDoc, setDoc, updateDoc,
  onAuthStateChanged, updateProfile, signInAnonymously
} from './firebase-config.js';

const profileName = document.getElementById('profileName');
const profileDesc = document.getElementById('profileDesc');
const profileAvatar = document.getElementById('profileAvatar');
const editBtn = document.getElementById('editProfileBtn');
const saveBtn = document.getElementById('saveProfileBtn');
const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const avatarModal = document.getElementById('avatarModal');
const avatarGrid = document.getElementById('avatarGrid');
const confirmAvatarBtn = document.getElementById('confirmAvatarBtn');
const cancelAvatarBtn = document.getElementById('cancelAvatarBtn');
const usernameInput = document.getElementById('usernameInput');
const usernameField = document.getElementById('usernameField');
const usernameStatus = document.getElementById('usernameStatus');

let currentUser = null;
let editing = false;
let selectedAvatarId = null;
let availableAvatars = [];
let usernameCheckTimeout = null;

// Initialize authentication
async function initAuth() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (error) {
    console.error('Authentication error:', error);
  }
}

function setEditing(state) {
  editing = state;
  profileName.style.display = state ? 'none' : 'flex';
  usernameInput.style.display = state ? 'block' : 'none';
  profileDesc.contentEditable = state;
  changeAvatarBtn.style.display = state ? 'flex' : 'none';
  saveBtn.style.display = state ? 'inline-block' : 'none';
  editBtn.style.display = state ? 'none' : 'inline-block';
  
  if (state) {
    // Set current username in input
    usernameField.value = profileName.textContent === 'Anonymous User' ? '' : profileName.textContent;
    usernameField.focus();
  }
}

function randomColor(seed) {
  // Simple seeded random pastel color
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 80%)`;
}

function generateAvatarSVG(uid) {
  // Generate a unique, colorful SVG avatar based on UID
  const colors = [
    '#ff6b9d', '#4ecdc4', '#a855f7', '#fcd34d', '#f97316', 
    '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'
  ];
  
  // Generate consistent random values from UID
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const primaryColor = colors[Math.abs(hash) % colors.length];
  const secondaryColor = colors[Math.abs(hash * 2) % colors.length];
  
  // Generate face features
  const faceShape = Math.abs(hash * 3) % 3; // 0: circle, 1: square, 2: oval
  const eyeType = Math.abs(hash * 5) % 4; // Different eye styles
  const mouthType = Math.abs(hash * 7) % 4; // Different mouth styles
  const hasAccessory = Math.abs(hash * 11) % 3 === 0; // Random accessory
  
  // Eye positions
  const leftEyeX = 24 + (Math.abs(hash * 13) % 6);
  const rightEyeX = 72 - (Math.abs(hash * 13) % 6);
  const eyeY = 35 + (Math.abs(hash * 17) % 8);
  
  // Mouth position
  const mouthY = 55 + (Math.abs(hash * 19) % 10);
  
  let faceElement = '';
  if (faceShape === 0) {
    faceElement = `<circle cx="48" cy="48" r="40" fill="${primaryColor}" stroke="#fcd34d" stroke-width="4"/>`;
  } else if (faceShape === 1) {
    faceElement = `<rect x="8" y="8" width="80" height="80" rx="20" fill="${primaryColor}" stroke="#fcd34d" stroke-width="4"/>`;
  } else {
    faceElement = `<ellipse cx="48" cy="48" rx="40" ry="35" fill="${primaryColor}" stroke="#fcd34d" stroke-width="4"/>`;
  }
  
  // Generate eyes
  let eyesElement = '';
  if (eyeType === 0) {
    eyesElement = `<circle cx="${leftEyeX}" cy="${eyeY}" r="4" fill="#2d3748"/>
                   <circle cx="${rightEyeX}" cy="${eyeY}" r="4" fill="#2d3748"/>`;
  } else if (eyeType === 1) {
    eyesElement = `<ellipse cx="${leftEyeX}" cy="${eyeY}" rx="6" ry="3" fill="#2d3748"/>
                   <ellipse cx="${rightEyeX}" cy="${eyeY}" rx="6" ry="3" fill="#2d3748"/>`;
  } else if (eyeType === 2) {
    eyesElement = `<circle cx="${leftEyeX}" cy="${eyeY}" r="5" fill="white" stroke="#2d3748" stroke-width="2"/>
                   <circle cx="${leftEyeX}" cy="${eyeY}" r="2" fill="#2d3748"/>
                   <circle cx="${rightEyeX}" cy="${eyeY}" r="5" fill="white" stroke="#2d3748" stroke-width="2"/>
                   <circle cx="${rightEyeX}" cy="${eyeY}" r="2" fill="#2d3748"/>`;
  } else {
    eyesElement = `<rect x="${leftEyeX-3}" y="${eyeY-2}" width="6" height="4" fill="#2d3748"/>
                   <rect x="${rightEyeX-3}" y="${eyeY-2}" width="6" height="4" fill="#2d3748"/>`;
  }
  
  // Generate mouth
  let mouthElement = '';
  if (mouthType === 0) {
    mouthElement = `<ellipse cx="48" cy="${mouthY}" rx="12" ry="6" fill="#2d3748"/>`;
  } else if (mouthType === 1) {
    mouthElement = `<path d="M36 ${mouthY} Q48 ${mouthY + 8} 60 ${mouthY}" stroke="#2d3748" stroke-width="3" fill="none"/>`;
  } else if (mouthType === 2) {
    mouthElement = `<rect x="42" y="${mouthY}" width="12" height="4" rx="2" fill="#2d3748"/>`;
  } else {
    mouthElement = `<circle cx="48" cy="${mouthY}" r="3" fill="#2d3748"/>`;
  }
  
  // Generate accessory
  let accessoryElement = '';
  if (hasAccessory) {
    accessoryElement = `<circle cx="48" cy="25" r="8" fill="${secondaryColor}" opacity="0.8"/>
                        <circle cx="48" cy="25" r="4" fill="white"/>`;
  }
  
  return `<svg width='96' height='96' viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    ${faceElement}
    ${eyesElement}
    ${mouthElement}
    ${accessoryElement}
  </svg>`;
}

// Generate multiple avatar options for selection
function generateAvatarOptions(baseUid, count = 12) {
  const avatars = [];
  for (let i = 0; i < count; i++) {
    // Create variations by modifying the UID
    const variantUid = baseUid + '_variant_' + i;
    avatars.push({
      id: i,
      uid: variantUid,
      svg: generateAvatarSVG(variantUid)
    });
  }
  return avatars;
}

// Add stats update function
function updateStats(stats = {}) {
  // Update stat numbers
  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length >= 4) {
    statNumbers[0].textContent = stats.storiesShared || 0;
    statNumbers[1].textContent = stats.messagesReceived || 0;
    statNumbers[2].textContent = stats.roomsJoined || 0;
    statNumbers[3].textContent = stats.supportGiven || 0;
  }
}

// Username validation functions
async function checkUsernameAvailability(username) {
  if (!username || username.length < 3) {
    return { available: false, message: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 20) {
    return { available: false, message: 'Username must be 20 characters or less' };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { available: false, message: 'Username can only contain letters, numbers, and underscores' };
  }
  
  try {
    const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    if (usernameDoc.exists() && usernameDoc.data().userId !== currentUser.uid) {
      return { available: false, message: 'Username is already taken' };
    }
    
    return { available: true, message: 'Username is available!' };
  } catch (error) {
    console.error('Error checking username:', error);
    return { available: false, message: 'Error checking username availability' };
  }
}

function updateUsernameStatus(status, message) {
  usernameStatus.textContent = message;
  usernameStatus.className = `username-status ${status}`;
  usernameField.className = status === 'available' ? 'valid' : status === 'taken' ? 'invalid' : '';
}

// Initialize auth and start listening for auth changes
initAuth();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadProfile();
  } else {
    // Try to sign in anonymously if no user
    await initAuth();
  }
});

async function loadProfile() {
  if (!currentUser) return;
  
  try {
    // Try to load profile data from Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      profileName.textContent = userData.username || userData.displayName || 'Anonymous User';
      profileDesc.textContent = userData.bio || 'Your safe space for mental health support and sharing.';
      
      // Set avatar
      if (userData.avatarId !== undefined) {
        const avatarSvg = generateAvatarSVG(currentUser.uid + '_variant_' + userData.avatarId);
        profileAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSvg);
      } else {
        profileAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(generateAvatarSVG(currentUser.uid));
      }
      
      // Update stats if they exist
      updateStats(userData.stats || {});
    } else {
      // Create new user document with defaults
      const defaultUserData = {
        displayName: 'Anonymous User',
        username: null,
        bio: 'Your safe space for mental health support and sharing.',
        avatarId: 0,
        createdAt: new Date(),
        stats: {
          storiesShared: 0,
          messagesReceived: 0,
          roomsJoined: 0,
          supportGiven: 0
        }
      };
      
      await setDoc(userDocRef, defaultUserData);
      profileName.textContent = defaultUserData.displayName;
      profileDesc.textContent = defaultUserData.bio;
      profileAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(generateAvatarSVG(currentUser.uid));
      updateStats(defaultUserData.stats);
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    // Fallback to defaults
    profileName.textContent = 'Anonymous User';
    profileDesc.textContent = 'Your safe space for mental health support and sharing.';
    profileAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(generateAvatarSVG(currentUser.uid));
    updateStats({});
  }
}

editBtn.addEventListener('click', () => setEditing(true));
saveBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  
  try {
    const newUsername = usernameField.value.trim();
    const newBio = profileDesc.textContent.trim() || 'Your safe space for mental health support and sharing.';
    
    let updateData = {
      bio: newBio,
      updatedAt: new Date()
    };
    
    // Handle username update
    if (newUsername && newUsername !== 'Anonymous User') {
      // Check username availability one more time
      const result = await checkUsernameAvailability(newUsername);
      if (!result.available) {
        showToast(result.message, 'error');
        return;
      }
      
      // Get current user data to check for existing username
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const currentData = userDoc.data();
      
      // Remove old username from usernames collection if it exists
      if (currentData.username) {
        try {
          await updateDoc(doc(db, 'usernames', currentData.username.toLowerCase()), {
            userId: null,
            available: true
          });
        } catch (error) {
          // Username document might not exist, that's okay
        }
      }
      
      // Reserve new username
      await setDoc(doc(db, 'usernames', newUsername.toLowerCase()), {
        userId: currentUser.uid,
        username: newUsername,
        createdAt: new Date()
      });
      
      updateData.username = newUsername;
      updateData.displayName = newUsername;
    }
    
    // Update Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, updateData);
    
    // Update Firebase Auth profile (for consistency)
    if (updateData.displayName) {
      await updateProfile(currentUser, {
        displayName: updateData.displayName
      });
    }
    
    // Update UI
    if (newUsername) {
      profileName.textContent = newUsername;
    }
    
    setEditing(false);
    
    // Show success feedback
    showToast('Profile updated successfully! 🎉', 'success');
  } catch (error) {
    console.error('Error saving profile:', error);
    showToast('Failed to save profile. Please try again.', 'error');
  }
});

// Avatar selection functions
function showAvatarModal() {
  availableAvatars = generateAvatarOptions(currentUser.uid);
  renderAvatarGrid();
  avatarModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideAvatarModal() {
  avatarModal.style.display = 'none';
  document.body.style.overflow = '';
  selectedAvatarId = null;
}

function renderAvatarGrid() {
  avatarGrid.innerHTML = '';
  
  availableAvatars.forEach(avatar => {
    const avatarOption = document.createElement('div');
    avatarOption.className = 'avatar-option';
    avatarOption.innerHTML = avatar.svg;
    avatarOption.dataset.avatarId = avatar.id;
    
    avatarOption.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
      });
      avatarOption.classList.add('selected');
      selectedAvatarId = avatar.id;
    });
    
    avatarGrid.appendChild(avatarOption);
  });
}

// Add keyboard support for editing
profileName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    profileDesc.focus();
  }
  if (e.key === 'Escape') {
    setEditing(false);
    loadProfile(); // Reset to original values
  }
});

profileDesc.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    saveBtn.click();
  }
  if (e.key === 'Escape') {
    setEditing(false);
    loadProfile(); // Reset to original values
  }
});

// Add input validation
profileName.addEventListener('input', (e) => {
  const text = e.target.textContent;
  if (text.length > 50) {
    e.target.textContent = text.substring(0, 50);
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(e.target);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
});

profileDesc.addEventListener('input', (e) => {
  const text = e.target.textContent;
  if (text.length > 200) {
    e.target.textContent = text.substring(0, 200);
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(e.target);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
});

// Toast notification function
function showToast(message, type = 'info') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? 'var(--primary-blue)' : 'var(--primary-pink)'};
    color: white;
    padding: var(--spacing-3) var(--spacing-6);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    font-size: var(--font-size-sm);
    font-weight: 500;
    max-width: 90%;
    text-align: center;
    opacity: 0;
    transition: all var(--transition-normal);
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Username availability check on input
usernameField.addEventListener('input', (e) => {
  const username = e.target.value.trim();
  
  // Debounce input
  clearTimeout(usernameCheckTimeout);
  usernameCheckTimeout = setTimeout(async () => {
    if (!username) {
      updateUsernameStatus('', '');
      return;
    }
    
    // Check availability
    const { available, message } = await checkUsernameAvailability(username);
    updateUsernameStatus(available ? 'available' : 'taken', message);
  }, 300);
});

// Prevent form submission on Enter
usernameField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // Optionally, you can trigger profile save here
    // saveBtn.click();
  }
});

// Close avatar modal on cancel
cancelAvatarBtn.addEventListener('click', hideAvatarModal);

// Confirm avatar selection
confirmAvatarBtn.addEventListener('click', async () => {
  if (selectedAvatarId === null) return;
  
  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      avatarId: selectedAvatarId,
      updatedAt: new Date()
    });
    
    const avatarSvg = availableAvatars[selectedAvatarId].svg;
    profileAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSvg);
    
    hideAvatarModal();
    showToast('Avatar updated successfully! 🎉', 'success');
  } catch (error) {
    console.error('Error updating avatar:', error);
    showToast('Failed to update avatar. Please try again.', 'error');
  }
});

// Event listeners
changeAvatarBtn.addEventListener('click', showAvatarModal);
cancelAvatarBtn.addEventListener('click', hideAvatarModal);

confirmAvatarBtn.addEventListener('click', async () => {
  if (selectedAvatarId === null) return;
  
  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      avatarId: selectedAvatarId,
      updatedAt: new Date()
    });
    
    const avatarSvg = availableAvatars[selectedAvatarId].svg;
    profileAvatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSvg);
    
    hideAvatarModal();
    showToast('Avatar updated successfully! 🎉', 'success');
  } catch (error) {
    console.error('Error updating avatar:', error);
    showToast('Failed to update avatar. Please try again.', 'error');
  }
});

// Username input validation
usernameField.addEventListener('input', () => {
  clearTimeout(usernameCheckTimeout);
  const username = usernameField.value.trim();
  
  if (!username) {
    updateUsernameStatus('', '');
    return;
  }
  
  updateUsernameStatus('checking', 'Checking availability...');
  
  usernameCheckTimeout = setTimeout(async () => {
    const result = await checkUsernameAvailability(username);
    updateUsernameStatus(result.available ? 'available' : 'taken', result.message);
  }, 500);
});

// Close modal when clicking outside
avatarModal.addEventListener('click', (e) => {
  if (e.target === avatarModal) {
    hideAvatarModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && avatarModal.style.display === 'flex') {
    hideAvatarModal();
  }
});
