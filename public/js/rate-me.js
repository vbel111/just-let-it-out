// Rate Me Feature - Main JavaScript Logic
import { 
  app, db, auth, storage,
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs,
  collection, firestoreQuery as query, where, firestoreOrderBy as orderBy, firestoreLimit as limit, onSnapshot,
  onAuthStateChanged, signInAnonymously, serverTimestamp,
  storageRef, uploadBytes, getDownloadURL, deleteObject,
  uploadRateMePhoto, createRateMePost
} from './firebase-config.js';

// Analytics tracking
const analytics = {
  track: (event, properties = {}) => {
    if (typeof window.va === 'function') {
      window.va('track', event, properties);
    }
    if (window.location.hostname === 'localhost') {
      console.log('Analytics:', event, properties);
    }
  },
  
  trackRateMe: (action, details = {}) => {
    analytics.track('rate_me_event', { action, ...details });
  }
};

// Track page view
analytics.track('page_view', { page: 'rate_me' });

// Global variables
let currentUser = null;
let currentPhotoFile = null;
let currentPhotoUrl = null;
let currentPhotoId = null;
let currentPostId = null;

// DOM Elements
const backBtn = document.getElementById('backBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const cameraBtn = document.getElementById('cameraBtn');
const galleryBtn = document.getElementById('galleryBtn');
const photoInput = document.getElementById('photoInput');
const uploadSection = document.getElementById('uploadSection');
const previewSection = document.getElementById('previewSection');
const shareSection = document.getElementById('shareSection');
const photoPreview = document.getElementById('photoPreview');
const retakeBtn = document.getElementById('retakeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const shareBtn = document.getElementById('shareBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// Settings elements
const timeLimit = document.getElementById('timeLimit');
const ratingLimit = document.getElementById('ratingLimit');
const allowComments = document.getElementById('allowComments');
const positiveOnly = document.getElementById('positiveOnly');

// Share elements
const shareLink = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const qrCode = document.getElementById('qrCode');
const newPhotoBtn = document.getElementById('newPhotoBtn');
const viewDashboardBtn = document.getElementById('viewDashboardBtn');

// Social share buttons
const shareWhatsApp = document.getElementById('shareWhatsApp');
const shareInstagram = document.getElementById('shareInstagram');
const shareTwitter = document.getElementById('shareTwitter');
const shareSnapchat = document.getElementById('shareSnapchat');

// Rate Me App Class
class RateMeApp {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Initializing Rate Me App...');
    
    // Set up authentication
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        console.log('User authenticated successfully:', {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          providerData: user.providerData
        });
      } else {
        console.log('No user found, starting anonymous authentication...');
        this.authenticateUser();
      }
    });

    this.setupEventListeners();
    analytics.trackRateMe('page_loaded');
  }

  async authenticateUser() {
    try {
      console.log('Starting anonymous authentication...');
      const result = await signInAnonymously(auth);
      currentUser = result.user;
      console.log('Anonymous authentication successful:', {
        uid: currentUser.uid,
        isAnonymous: currentUser.isAnonymous
      });
    } catch (error) {
      console.error('Authentication failed:', error);
      this.showError('Authentication failed. Please refresh and try again.');
    }
  }

  setupEventListeners() {
    // Navigation
    const backBtn = document.getElementById('backBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    
    backBtn.addEventListener('click', () => {
      window.history.back();
    });
    
    dashboardBtn.addEventListener('click', () => {
      analytics.trackRateMe('dashboard_accessed');
      window.location.href = 'rate-me-dashboard.html';
    });

    dashboardBtn.addEventListener('click', () => {
      window.location.href = 'rate-me-dashboard.html';
    });

    // Photo upload
    cameraBtn.addEventListener('click', () => {
      photoInput.setAttribute('capture', 'environment');
      photoInput.click();
      analytics.trackRateMe('camera_clicked');
    });

    galleryBtn.addEventListener('click', () => {
      photoInput.removeAttribute('capture');
      photoInput.click();
      analytics.trackRateMe('gallery_clicked');
    });

    photoInput.addEventListener('change', (e) => {
      this.handlePhotoSelection(e);
    });

    // Preview actions
    retakeBtn.addEventListener('click', () => {
      this.resetToUpload();
    });

    cancelBtn.addEventListener('click', () => {
      this.resetToUpload();
    });

    shareBtn.addEventListener('click', () => {
      this.processAndSharePhoto();
    });

    // Share actions
    copyLinkBtn.addEventListener('click', () => {
      this.copyShareLink();
    });

    newPhotoBtn.addEventListener('click', () => {
      this.resetToUpload();
    });

    viewDashboardBtn.addEventListener('click', () => {
      window.location.href = 'rate-me-dashboard.html';
    });

    // Social sharing
    shareWhatsApp.addEventListener('click', () => {
      this.shareToWhatsApp();
    });

    shareInstagram.addEventListener('click', () => {
      this.shareToInstagram();
    });

    shareTwitter.addEventListener('click', () => {
      this.shareToTwitter();
    });

    shareSnapchat.addEventListener('click', () => {
      this.shareToSnapchat();
    });
  }

  async handlePhotoSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.showError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showError('Image too large. Please choose a file under 10MB.');
      return;
    }

    currentPhotoFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.src = e.target.result;
      this.showPreviewSection();
    };
    reader.readAsDataURL(file);

    analytics.trackRateMe('photo_selected', { 
      file_size: file.size,
      file_type: file.type 
    });
  }

  showPreviewSection() {
    uploadSection.style.display = 'none';
    previewSection.style.display = 'block';
    previewSection.classList.add('fade-in');
  }

  resetToUpload() {
    previewSection.style.display = 'none';
    shareSection.style.display = 'none';
    uploadSection.style.display = 'block';
    uploadSection.classList.add('fade-in');
    
    // Reset form
    photoInput.value = '';
    currentPhotoFile = null;
    currentPhotoUrl = null;
    currentPostId = null;
  }

  async processAndSharePhoto() {
    if (!currentPhotoFile || !currentUser) {
      this.showError('Please select a photo and ensure you are authenticated.');
      return;
    }

    this.showLoading(true);

    try {
      // Check content moderation
      const isSafe = await this.moderateContent(currentPhotoFile);
      if (!isSafe) {
        throw new Error('Image contains inappropriate content. Please choose a different photo.');
      }

      // Upload photo to Firebase Storage
      const photoUrl = await this.uploadPhoto(currentPhotoFile);
      
      // Create post document
      const postData = {
        uploaderId: currentUser.uid,
        imageUrl: photoUrl,
        expiresAt: new Date(Date.now() + parseInt(timeLimit.value) * 60 * 60 * 1000), // hours to ms
        settings: {
          allowComments: allowComments.checked,
          positiveOnly: positiveOnly.checked,
          maxRatings: ratingLimit.value === 'unlimited' ? null : parseInt(ratingLimit.value),
          timeLimit: parseInt(timeLimit.value)
        }
      };

      currentPostId = await createRateMePost(postData);

      // Generate share link
      const shareUrl = `${window.location.origin}/rate-me-view.html?id=${currentPostId}`;
      
      this.showShareSection(shareUrl);
      
      analytics.trackRateMe('photo_shared', {
        post_id: currentPostId,
        time_limit: timeLimit.value,
        rating_limit: ratingLimit.value,
        comments_enabled: allowComments.checked
      });

    } catch (error) {
      console.error('Error processing photo:', error);
      this.showError(error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async moderateContent(file) {
    // Basic client-side validation
    // In production, this would call a server-side AI moderation API
    
    // For now, we'll do basic filename and size checks
    const filename = file.name.toLowerCase();
    const suspiciousWords = ['nude', 'naked', 'nsfw', 'xxx'];
    
    for (const word of suspiciousWords) {
      if (filename.includes(word)) {
        return false;
      }
    }

    // TODO: Implement proper AI content moderation
    // This would typically involve:
    // 1. Uploading to a temporary location
    // 2. Calling Google Vision API, AWS Rekognition, or similar
    // 3. Checking for nudity, violence, inappropriate content
    // 4. Returning approval/rejection

    return true; // For now, approve all content
  }

  async uploadPhoto(file) {
    const photoId = `${currentUser.uid}_${Date.now()}`;
    
    console.log('Starting photo upload...', {
      userId: currentUser.uid,
      photoId: photoId,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Show progress during upload
    const progressBar = document.querySelector('.upload-progress');
    if (progressBar) {
      progressBar.style.display = 'block';
    }
    
    try {
      const downloadUrl = await uploadRateMePhoto(file, photoId, (progress) => {
        console.log(`Upload progress: ${Math.round(progress)}%`);
        if (progressBar) {
          progressBar.querySelector('.progress-fill').style.width = `${progress}%`;
          progressBar.querySelector('.progress-text').textContent = `${Math.round(progress)}%`;
        }
      });
      
      console.log('Photo uploaded successfully:', downloadUrl);
      currentPhotoUrl = downloadUrl;
      currentPhotoId = photoId;
      return downloadUrl;
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw error;
    } finally {
      if (progressBar) {
        progressBar.style.display = 'none';
      }
    }
  }

  showShareSection(shareUrl) {
    previewSection.style.display = 'none';
    shareSection.style.display = 'block';
    shareSection.classList.add('fade-in');

    // Set share link
    shareLink.value = shareUrl;

    // Generate QR code
    if (window.QRCode) {
      qrCode.innerHTML = ''; // Clear previous QR code
      window.QRCode.toCanvas(qrCode, shareUrl, {
        width: 200,
        height: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    }
  }

  copyShareLink() {
    shareLink.select();
    shareLink.setSelectionRange(0, 99999); // For mobile devices

    try {
      document.execCommand('copy');
      this.showSuccess('Link copied to clipboard!');
      analytics.trackRateMe('link_copied');
    } catch (err) {
      console.error('Failed to copy link:', err);
      this.showError('Failed to copy link. Please copy manually.');
    }
  }

  shareToWhatsApp() {
    const text = `Hey! Rate my photo anonymously 💜 ${shareLink.value}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    analytics.trackRateMe('shared_whatsapp');
  }

  shareToInstagram() {
    // Instagram doesn't have direct URL sharing, so we copy the link
    this.copyShareLink();
    this.showSuccess('Link copied! Paste it in your Instagram story or bio 📸');
    analytics.trackRateMe('shared_instagram');
  }

  shareToTwitter() {
    const text = `Rate me anonymously! 💜 ${shareLink.value} #RateMe #JustLetItOut`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    analytics.trackRateMe('shared_twitter');
  }

  shareToSnapchat() {
    // Snapchat sharing would require their API integration
    this.copyShareLink();
    this.showSuccess('Link copied! Share it on Snapchat 👻');
    analytics.trackRateMe('shared_snapchat');
  }

  showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  showError(message) {
    // Simple alert for now - in production, use a better notification system
    alert(`Error: ${message}`);
  }

  showSuccess(message) {
    // Simple alert for now - in production, use a better notification system
    alert(message);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RateMeApp();
});

// Handle page visibility for cleanup
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    analytics.trackRateMe('page_hidden');
  } else {
    analytics.trackRateMe('page_visible');
  }
});

export default RateMeApp;
