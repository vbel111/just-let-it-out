// Rate Me View - Rating Interface Logic
import { 
  app, db, auth, storage,
  doc, getDoc, setDoc, updateDoc, addDoc, increment,
  collection, firestoreQuery as query, where, firestoreOrderBy as orderBy, firestoreLimit as limit, onSnapshot, getDocs,
  onAuthStateChanged, signInAnonymously, serverTimestamp,
  submitRating
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
  
  trackRating: (action, details = {}) => {
    analytics.track('rating_event', { action, ...details });
  }
};

// Track page view
analytics.track('page_view', { page: 'rate_me_view' });

// Global variables
let currentUser = null;
let postId = null;
let postData = null;
let selectedRating = null;
let selectedReaction = null;
let hasRated = false;

// DOM Elements
const backBtn = document.getElementById('backBtn');
const reportBtn = document.getElementById('reportBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const ratingInterface = document.getElementById('ratingInterface');
const alreadyRated = document.getElementById('alreadyRated');
const ratingForm = document.getElementById('ratingForm');
const successState = document.getElementById('successState');

// Photo elements
const photoDisplay = document.getElementById('photoDisplay');
const viewCount = document.getElementById('viewCount');
const timeRemaining = document.getElementById('timeRemaining');

// Rating elements
const ratingBtns = document.querySelectorAll('.rating-btn');
const reactionBtns = document.querySelectorAll('.reaction-btn');
const commentText = document.getElementById('commentText');
const charCount = document.getElementById('charCount');
const commentSection = document.getElementById('commentSection');
const submitBtn = document.getElementById('submitRating');

// Results elements
const averageRating = document.getElementById('averageRating');
const averageHearts = document.getElementById('averageHearts');
const totalRatings = document.getElementById('totalRatings');
const newAverage = document.getElementById('newAverage');
const newAverageHearts = document.getElementById('newAverageHearts');
const newTotal = document.getElementById('newTotal');

// Modal elements
const guidelinesModal = document.getElementById('guidelinesModal');
const reportModal = document.getElementById('reportModal');
const closeGuidelines = document.getElementById('closeGuidelines');
const closeReport = document.getElementById('closeReport');
const understoodBtn = document.getElementById('understoodBtn');
const cancelReport = document.getElementById('cancelReport');
const submitReport = document.getElementById('submitReport');
const loadingOverlay = document.getElementById('loadingOverlay');

// Rating View App Class
class RatingViewApp {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Initializing Rating View App...');
    
    // Get post ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    postId = urlParams.get('id');
    
    if (!postId) {
      this.showError('No photo ID provided');
      return;
    }

    // Set up authentication
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        await this.loadPost();
      } else {
        await this.authenticateUser();
      }
    });

    this.setupEventListeners();
    analytics.trackRating('page_loaded', { post_id: postId });
  }

  async authenticateUser() {
    try {
      const result = await signInAnonymously(auth);
      currentUser = result.user;
      console.log('Anonymous authentication successful');
    } catch (error) {
      console.error('Authentication failed:', error);
      this.showError('Authentication failed. Please refresh and try again.');
    }
  }

  async loadPost() {
    try {
      // Load post data
      const postDoc = await getDoc(doc(db, 'rateMePosts', postId));
      
      if (!postDoc.exists()) {
        this.showError('Photo not found');
        return;
      }

      postData = postDoc.data();
      
      // Check if post is still active
      if (postData.status !== 'active') {
        this.showError('This photo is no longer available');
        return;
      }

      // Check if post has expired
      const now = new Date();
      const expiresAt = postData.expiresAt.toDate();
      if (now > expiresAt) {
        this.showError('This photo has expired');
        return;
      }

      // Check if user has already rated
      await this.checkIfAlreadyRated();

      // Update view count
      await this.incrementViewCount();

      // Display photo and interface
      this.displayPhoto();
      this.updateTimeRemaining();
      this.showRatingInterface();

      analytics.trackRating('post_loaded', { 
        post_id: postId,
        has_rated: hasRated 
      });

    } catch (error) {
      console.error('Error loading post:', error);
      this.showError('Failed to load photo');
    }
  }

  async checkIfAlreadyRated() {
    try {
      // Check if this user has already rated this post
      const ratingsQuery = query(
        collection(db, 'rateMeRatings'),
        where('postId', '==', postId),
        where('raterFingerprint', '==', this.getUserFingerprint())
      );
      
      const ratingsSnapshot = await getDocs(ratingsQuery);
      hasRated = !ratingsSnapshot.empty;
      
    } catch (error) {
      console.error('Error checking rating status:', error);
      hasRated = false;
    }
  }

  getUserFingerprint() {
    // Create a simple fingerprint based on user agent and current user ID
    // In production, you might want a more sophisticated fingerprinting system
    return btoa(currentUser.uid + navigator.userAgent).substring(0, 20);
  }

  async incrementViewCount() {
    try {
      await updateDoc(doc(db, 'rateMePosts', postId), {
        'stats.viewCount': increment(1)
      });
      
      // Update local data
      postData.stats.viewCount = (postData.stats.viewCount || 0) + 1;
      
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  }

  displayPhoto() {
    photoDisplay.src = postData.imageUrl;
    photoDisplay.alt = 'Photo to rate';
    
    // Update view count display
    const views = postData.stats.viewCount || 0;
    viewCount.querySelector('span').textContent = `${views} view${views !== 1 ? 's' : ''}`;
    
    // Show/hide comment section based on settings
    if (!postData.settings.allowComments) {
      commentSection.style.display = 'none';
    }
  }

  updateTimeRemaining() {
    const now = new Date();
    const expiresAt = postData.expiresAt.toDate();
    const timeLeft = expiresAt - now;
    
    if (timeLeft <= 0) {
      timeRemaining.querySelector('span').textContent = 'Expired';
      return;
    }
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      timeRemaining.querySelector('span').textContent = `${hours}h ${minutes}m remaining`;
    } else {
      timeRemaining.querySelector('span').textContent = `${minutes}m remaining`;
    }
  }

  showRatingInterface() {
    loadingState.style.display = 'none';
    ratingInterface.style.display = 'block';
    
    if (hasRated) {
      this.showAlreadyRatedState();
    } else {
      this.showRatingForm();
    }
  }

  showAlreadyRatedState() {
    ratingForm.style.display = 'none';
    alreadyRated.style.display = 'block';
    
    // Display current results
    this.displayResults(averageRating, averageHearts, totalRatings);
  }

  showRatingForm() {
    alreadyRated.style.display = 'none';
    ratingForm.style.display = 'block';
  }

  displayResults(avgElement, heartsElement, totalElement) {
    const avgRating = postData.stats.averageRating || 0;
    const total = postData.stats.totalRatings || 0;
    
    avgElement.querySelector('.rating-number').textContent = avgRating.toFixed(1);
    totalElement.querySelector('span').textContent = `${total} rating${total !== 1 ? 's' : ''}`;
    
    // Display hearts based on average rating
    const hearts = this.generateHeartDisplay(avgRating);
    heartsElement.innerHTML = hearts;
  }

  generateHeartDisplay(rating) {
    const heartTypes = ['🤍', '💙', '💚', '🧡', '💜'];
    const fullHearts = Math.floor(rating);
    const hasHalfHeart = rating % 1 >= 0.5;
    
    let hearts = '';
    
    // Add full hearts
    for (let i = 0; i < fullHearts && i < 5; i++) {
      hearts += heartTypes[i];
    }
    
    // Add half heart if needed
    if (hasHalfHeart && fullHearts < 5) {
      hearts += heartTypes[fullHearts];
    }
    
    return hearts;
  }

  setupEventListeners() {
    // Navigation
    backBtn.addEventListener('click', () => {
      window.history.back();
    });

    reportBtn.addEventListener('click', () => {
      this.showReportModal();
    });

    // Rating buttons
    ratingBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectRating(e.target.closest('.rating-btn'));
      });
    });

    // Reaction buttons
    reactionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectReaction(e.target.closest('.reaction-btn'));
      });
    });

    // Comment input
    commentText.addEventListener('input', () => {
      this.updateCharCount();
      this.validateForm();
    });

    // Submit button
    submitBtn.addEventListener('click', () => {
      this.submitRating();
    });

    // Modal events
    closeGuidelines.addEventListener('click', () => {
      this.hideModal(guidelinesModal);
    });

    closeReport.addEventListener('click', () => {
      this.hideModal(reportModal);
    });

    understoodBtn.addEventListener('click', () => {
      this.hideModal(guidelinesModal);
    });

    cancelReport.addEventListener('click', () => {
      this.hideModal(reportModal);
    });

    submitReport.addEventListener('click', () => {
      this.submitReport();
    });

    // Close modals on backdrop click
    [guidelinesModal, reportModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal(modal);
        }
      });
    });

    // Show guidelines on first visit
    if (!localStorage.getItem('rateMeGuidelinesSeen')) {
      setTimeout(() => {
        this.showModal(guidelinesModal);
        localStorage.setItem('rateMeGuidelinesSeen', 'true');
      }, 1000);
    }
  }

  selectRating(btn) {
    // Remove previous selection
    ratingBtns.forEach(b => b.classList.remove('selected'));
    
    // Add selection to clicked button
    btn.classList.add('selected');
    selectedRating = parseInt(btn.dataset.rating);
    
    this.validateForm();
    
    analytics.trackRating('rating_selected', { 
      rating: selectedRating,
      post_id: postId 
    });
  }

  selectReaction(btn) {
    // Toggle reaction selection
    if (btn.classList.contains('selected')) {
      btn.classList.remove('selected');
      selectedReaction = null;
    } else {
      // Remove previous selection
      reactionBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedReaction = btn.dataset.reaction;
    }
    
    analytics.trackRating('reaction_selected', { 
      reaction: selectedReaction,
      post_id: postId 
    });
  }

  updateCharCount() {
    const count = commentText.value.length;
    charCount.textContent = count;
    
    if (count > 180) {
      charCount.style.color = 'var(--warning-color)';
    } else if (count > 200) {
      charCount.style.color = 'var(--error-color)';
    } else {
      charCount.style.color = 'var(--text-secondary)';
    }
  }

  validateForm() {
    const hasRating = selectedRating !== null;
    const isValidComment = commentText.value.length <= 200;
    
    submitBtn.disabled = !hasRating || !isValidComment;
  }

  async submitRating() {
    if (!selectedRating || !currentUser) {
      this.showError('Please select a rating');
      return;
    }

    this.showLoading(true);

    try {
      // Create rating data
      const ratingData = {
        postId: postId,
        rating: selectedRating,
        raterFingerprint: this.getUserFingerprint(),
        reaction: selectedReaction || null,
        comment: commentText.value.trim() || null
      };

      // Submit rating using improved helper function
      await submitRating(ratingData);

      // Reload post data to get updated stats
      const postDoc = await getDoc(doc(db, 'rateMePosts', postId));
      if (postDoc.exists()) {
        postData = postDoc.data();
      }

      this.showSuccessState();

      analytics.trackRating('rating_submitted', {
        post_id: postId,
        rating: selectedRating,
        has_reaction: !!selectedReaction,
        has_comment: !!commentText.value.trim()
      });

    } catch (error) {
      console.error('Error submitting rating:', error);
      this.showError('Failed to submit rating. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  showSuccessState() {
    ratingForm.style.display = 'none';
    successState.style.display = 'block';
    
    // Display updated results
    this.displayResults(newAverage, newAverageHearts, newTotal);
    
    // Scroll to success state
    successState.scrollIntoView({ behavior: 'smooth' });
  }

  showModal(modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  hideModal(modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  showReportModal() {
    this.showModal(reportModal);
    analytics.trackRating('report_opened', { post_id: postId });
  }

  async submitReport() {
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    
    if (!selectedReason) {
      alert('Please select a reason for reporting');
      return;
    }

    try {
      const reportData = {
        postId: postId,
        reporterId: currentUser.uid,
        reason: selectedReason.value,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(db, 'reports'), reportData);
      
      this.hideModal(reportModal);
      alert('Report submitted. Thank you for helping keep our community safe.');
      
      analytics.trackRating('content_reported', { 
        post_id: postId,
        reason: selectedReason.value 
      });

    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    }
  }

  showError(message) {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    errorState.querySelector('p').textContent = message;
  }

  showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RatingViewApp();
});

// Handle page visibility for cleanup
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    analytics.trackRating('page_hidden');
  } else {
    analytics.trackRating('page_visible');
  }
});

export default RatingViewApp;
