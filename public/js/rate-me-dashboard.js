// Rate Me Dashboard - Main Logic
import { 
  app, db, auth, storage,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, firestoreQuery as query, where, firestoreOrderBy as orderBy, firestoreLimit as limit, getDocs, onSnapshot,
  storageRef, deleteObject, getDownloadURL,
  onAuthStateChanged, signInAnonymously, serverTimestamp,
  deleteRateMePhoto
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
  
  trackDashboard: (action, details = {}) => {
    analytics.track('dashboard_event', { action, ...details });
  }
};

// Track page view
analytics.track('page_view', { page: 'rate_me_dashboard' });

// Global variables
let currentUser = null;
let userPhotos = [];
let selectedPhoto = null;
let currentFilter = 'all';

// DOM Elements
const backBtn = document.getElementById('backBtn');
const settingsBtn = document.getElementById('settingsBtn');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const dashboardContent = document.getElementById('dashboardContent');

// Stats elements
const totalPhotos = document.getElementById('totalPhotos');
const totalRatings = document.getElementById('totalRatings');
const totalViews = document.getElementById('totalViews');
const totalComments = document.getElementById('totalComments');

// Action buttons
const uploadFirstBtn = document.getElementById('uploadFirstBtn');
const uploadNewBtn = document.getElementById('uploadNewBtn');
const viewAnalyticsBtn = document.getElementById('viewAnalyticsBtn');

// Filter and photos
const filterTabs = document.querySelectorAll('.filter-tab');
const photosGrid = document.getElementById('photosGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// Modals
const photoModal = document.getElementById('photoModal');
const deleteModal = document.getElementById('deleteModal');
const settingsModal = document.getElementById('settingsModal');
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

// Modal elements
const closeModal = document.getElementById('closeModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const closeSettings = document.getElementById('closeSettings');

const modalPhoto = document.getElementById('modalPhoto');
const modalStatus = document.getElementById('modalStatus');
const modalTimeRemaining = document.getElementById('modalTimeRemaining');
const modalAvgRating = document.getElementById('modalAvgRating');
const modalHearts = document.getElementById('modalHearts');
const modalTotalRatings = document.getElementById('modalTotalRatings');
const modalViews = document.getElementById('modalViews');
const modalComments = document.getElementById('modalComments');
const modalShareLink = document.getElementById('modalShareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const ratingChart = document.getElementById('ratingChart');
const commentsSection = document.getElementById('commentsSection');
const commentsList = document.getElementById('commentsList');

const shareBtn = document.getElementById('shareBtn');
const extendBtn = document.getElementById('extendBtn');
const deleteBtn = document.getElementById('deleteBtn');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');

// Dashboard App Class
class RateMeDashboard {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Initializing Rate Me Dashboard...');
    
    // Set up authentication
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        await this.loadUserData();
      } else {
        await this.authenticateUser();
      }
    });

    this.setupEventListeners();
    analytics.trackDashboard('page_loaded');
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

  async loadUserData() {
    try {
      await this.loadPhotos();
      this.updateStats();
      this.displayPhotos();
      this.showDashboard();
      
      analytics.trackDashboard('data_loaded', { 
        photo_count: userPhotos.length 
      });

    } catch (error) {
      console.error('Error loading user data:', error);
      this.showError('Failed to load your photos');
    }
  }

  async loadPhotos() {
    try {
      const photosQuery = query(
        collection(db, 'rateMePosts'),
        where('uploaderId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const photosSnapshot = await getDocs(photosQuery);
      userPhotos = [];
      
      for (const photoDoc of photosSnapshot.docs) {
        const photoData = photoDoc.data();
        const photoWithId = {
          id: photoDoc.id,
          ...photoData
        };
        
        // Load rating stats for each photo
        await this.loadPhotoStats(photoWithId);
        userPhotos.push(photoWithId);
      }
      
    } catch (error) {
      console.error('Error loading photos:', error);
      userPhotos = [];
    }
  }

  async loadPhotoStats(photo) {
    try {
      // Load ratings for this photo
      const ratingsQuery = query(
        collection(db, 'rateMeRatings'),
        where('postId', '==', photo.id)
      );
      
      const ratingsSnapshot = await getDocs(ratingsQuery);
      const ratings = [];
      
      ratingsSnapshot.forEach(doc => {
        ratings.push(doc.data());
      });
      
      // Calculate stats
      photo.ratings = ratings;
      photo.stats = photo.stats || {};
      photo.stats.totalRatings = ratings.length;
      photo.stats.totalComments = ratings.filter(r => r.comment && r.comment.trim()).length;
      
      if (ratings.length > 0) {
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        photo.stats.averageRating = Math.round(avgRating * 10) / 10;
        
        // Calculate rating breakdown
        photo.stats.ratingBreakdown = {};
        for (let i = 1; i <= 5; i++) {
          photo.stats.ratingBreakdown[i] = ratings.filter(r => r.rating === i).length;
        }
      } else {
        photo.stats.averageRating = 0;
        photo.stats.ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }
      
    } catch (error) {
      console.error('Error loading photo stats:', error);
      photo.stats = {
        totalRatings: 0,
        totalComments: 0,
        averageRating: 0,
        viewCount: 0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
  }

  updateStats() {
    const stats = userPhotos.reduce((acc, photo) => {
      acc.totalPhotos += 1;
      acc.totalRatings += photo.stats.totalRatings || 0;
      acc.totalViews += photo.stats.viewCount || 0;
      acc.totalComments += photo.stats.totalComments || 0;
      return acc;
    }, {
      totalPhotos: 0,
      totalRatings: 0,
      totalViews: 0,
      totalComments: 0
    });

    totalPhotos.textContent = stats.totalPhotos;
    totalRatings.textContent = stats.totalRatings;
    totalViews.textContent = stats.totalViews;
    totalComments.textContent = stats.totalComments;
  }

  displayPhotos() {
    const filteredPhotos = this.getFilteredPhotos();
    
    if (filteredPhotos.length === 0) {
      if (userPhotos.length === 0) {
        this.showEmptyState();
        return;
      } else {
        photosGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">No photos match the current filter.</p>';
        return;
      }
    }

    photosGrid.innerHTML = '';
    
    filteredPhotos.forEach(photo => {
      const photoCard = this.createPhotoCard(photo);
      photosGrid.appendChild(photoCard);
    });
  }

  getFilteredPhotos() {
    const now = new Date();
    
    switch (currentFilter) {
      case 'active':
        return userPhotos.filter(photo => 
          photo.status === 'active' && 
          new Date(photo.expiresAt.toDate()) > now
        );
      case 'expired':
        return userPhotos.filter(photo => 
          photo.status !== 'active' || 
          new Date(photo.expiresAt.toDate()) <= now
        );
      default:
        return userPhotos;
    }
  }

  createPhotoCard(photo) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.dataset.photoId = photo.id;
    
    const now = new Date();
    const expiresAt = new Date(photo.expiresAt.toDate());
    const isExpired = now > expiresAt;
    const timeLeft = isExpired ? 0 : expiresAt - now;
    
    let timeText = 'Expired';
    if (!isExpired) {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      timeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    
    card.innerHTML = `
      <img src="${photo.imageUrl}" alt="Photo" class="photo-thumbnail">
      <div class="photo-info">
        <div class="photo-status">
          <span class="status-badge ${isExpired ? 'expired' : 'active'}">
            ${isExpired ? 'Expired' : 'Active'}
          </span>
          <span class="time-remaining">${timeText}</span>
        </div>
        <div class="photo-stats">
          <div class="photo-stat">
            <span class="photo-stat-icon">⭐</span>
            <span>${photo.stats.averageRating.toFixed(1)}</span>
          </div>
          <div class="photo-stat">
            <span class="photo-stat-icon">📊</span>
            <span>${photo.stats.totalRatings}</span>
          </div>
          <div class="photo-stat">
            <span class="photo-stat-icon">👀</span>
            <span>${photo.stats.viewCount || 0}</span>
          </div>
          <div class="photo-stat">
            <span class="photo-stat-icon">💬</span>
            <span>${photo.stats.totalComments}</span>
          </div>
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      this.showPhotoDetails(photo);
    });
    
    return card;
  }

  showPhotoDetails(photo) {
    selectedPhoto = photo;
    
    // Update modal content
    modalPhoto.src = photo.imageUrl;
    
    const now = new Date();
    const expiresAt = new Date(photo.expiresAt.toDate());
    const isExpired = now > expiresAt;
    const timeLeft = isExpired ? 0 : expiresAt - now;
    
    let timeText = 'Expired';
    if (!isExpired) {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      timeText = `${hours}h ${minutes}m remaining`;
    }
    
    modalStatus.innerHTML = `
      <span class="status-badge ${isExpired ? 'expired' : 'active'}">
        ${isExpired ? 'Expired' : 'Active'}
      </span>
      <span class="time-remaining">${timeText}</span>
    `;
    
    modalAvgRating.textContent = photo.stats.averageRating.toFixed(1);
    modalTotalRatings.textContent = photo.stats.totalRatings;
    modalViews.textContent = photo.stats.viewCount || 0;
    modalComments.textContent = photo.stats.totalComments;
    
    // Generate hearts display
    modalHearts.innerHTML = this.generateHeartsDisplay(photo.stats.averageRating);
    
    // Update share link
    const shareUrl = `${window.location.origin}/rate-me-view.html?id=${photo.id}`;
    modalShareLink.value = shareUrl;
    
    // Update rating breakdown chart
    this.updateRatingChart(photo.stats.ratingBreakdown);
    
    // Always show comments section and load comments
    commentsSection.style.display = 'flex';
    this.loadComments(photo);
    
    // Show/hide extend button
    extendBtn.style.display = (!isExpired && timeLeft < 3600000) ? 'block' : 'none'; // Show if less than 1 hour left
    
    this.showModal(photoModal);
    
    analytics.trackDashboard('photo_details_viewed', { 
      photo_id: photo.id,
      is_expired: isExpired 
    });
  }

  generateHeartsDisplay(rating) {
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
    
    // Fill remaining with empty hearts
    while (hearts.length < 5) {
      hearts += '🤍';
    }
    
    return hearts;
  }

  updateRatingChart(breakdown) {
    ratingChart.innerHTML = '';
    
    const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
    
    for (let rating = 5; rating >= 1; rating--) {
      const count = breakdown[rating] || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      
      const barElement = document.createElement('div');
      barElement.className = 'rating-bar';
      
      barElement.innerHTML = `
        <div class="rating-label">
          <span>${'💜'.repeat(rating)}</span>
        </div>
        <div class="rating-progress">
          <div class="rating-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="rating-count">${count}</div>
      `;
      
      ratingChart.appendChild(barElement);
    }
  }

  async loadComments(photo) {
    try {
      // Show loading state
      const commentsLoading = document.getElementById('commentsLoading');
      const noComments = document.getElementById('noComments');
      const commentsCount = document.getElementById('commentsCount');
      
      commentsLoading.style.display = 'flex';
      noComments.style.display = 'none';
      commentsList.innerHTML = '';
      
      // Filter comments from ratings
      const comments = photo.ratings ? photo.ratings.filter(rating => rating.comment && rating.comment.trim()) : [];
      
      // Update comments count
      commentsCount.textContent = `(${comments.length})`;
      
      // Hide loading after a brief delay for better UX
      setTimeout(() => {
        commentsLoading.style.display = 'none';
        
        if (comments.length === 0) {
          noComments.style.display = 'flex';
          return;
        }
        
        // Sort comments by timestamp (newest first)
        comments.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return timeB - timeA;
        });
        
        comments.forEach(comment => {
          const commentElement = document.createElement('div');
          commentElement.className = 'comment';
          
          const timeAgo = this.formatTimeAgo(comment.timestamp?.toDate ? comment.timestamp.toDate() : new Date(comment.timestamp));
          const hearts = '💜'.repeat(comment.rating);
          
          commentElement.innerHTML = `
            <div class="comment-meta">
              <div class="comment-rating">${hearts}</div>
              <div class="comment-time">${timeAgo}</div>
            </div>
            <div class="comment-text">${this.escapeHtml(comment.comment)}</div>
          `;
          
          commentsList.appendChild(commentElement);
        });
      }, 500); // Brief loading delay for better UX
      
    } catch (error) {
      console.error('Error loading comments:', error);
      document.getElementById('commentsLoading').style.display = 'none';
      document.getElementById('noComments').style.display = 'flex';
    }
  }

  async refreshComments() {
    if (!selectedPhoto) return;
    
    try {
      // Show loading state for refresh
      const commentsLoading = document.getElementById('commentsLoading');
      commentsLoading.style.display = 'flex';
      
      // Re-fetch the photo data to get latest comments
      const photoDoc = await getDoc(doc(db, 'rate-me-photos', selectedPhoto.id));
      if (photoDoc.exists()) {
        const updatedPhoto = { id: photoDoc.id, ...photoDoc.data() };
        selectedPhoto = updatedPhoto; // Update the selected photo
        
        // Reload comments with fresh data
        await this.loadComments(updatedPhoto);
        
        // Update comment count in stats
        modalComments.textContent = updatedPhoto.stats?.totalComments || 0;
        
        this.showToast('Comments refreshed!', 'success');
      }
    } catch (error) {
      console.error('Error refreshing comments:', error);
      this.showToast('Failed to refresh comments', 'error');
      document.getElementById('commentsLoading').style.display = 'none';
    }
  }

  formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showDashboard() {
    loadingState.style.display = 'none';
    emptyState.style.display = 'none';
    dashboardContent.style.display = 'block';
  }

  showEmptyState() {
    loadingState.style.display = 'none';
    dashboardContent.style.display = 'none';
    emptyState.style.display = 'block';
  }

  setupEventListeners() {
    // Navigation
    backBtn.addEventListener('click', () => {
      window.history.back();
    });

    settingsBtn.addEventListener('click', () => {
      this.showModal(settingsModal);
    });

    // Upload buttons
    uploadFirstBtn.addEventListener('click', () => {
      this.navigateToUpload();
    });

    uploadNewBtn.addEventListener('click', () => {
      this.navigateToUpload();
    });

    viewAnalyticsBtn.addEventListener('click', () => {
      this.showComingSoon('Advanced Analytics');
    });

    // Filter tabs
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active tab
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update filter and redisplay
        currentFilter = tab.dataset.filter;
        this.displayPhotos();
        
        analytics.trackDashboard('filter_changed', { filter: currentFilter });
      });
    });

    // Modal events
    closeModal.addEventListener('click', () => {
      this.hideModal(photoModal);
    });

    closeDeleteModal.addEventListener('click', () => {
      this.hideModal(deleteModal);
    });

    closeSettings.addEventListener('click', () => {
      this.hideModal(settingsModal);
    });

    // Photo modal actions
    copyLinkBtn.addEventListener('click', () => {
      this.copyShareLink();
    });

    shareBtn.addEventListener('click', () => {
      this.sharePhoto();
    });

    extendBtn.addEventListener('click', () => {
      this.extendPhotoTime();
    });

    deleteBtn.addEventListener('click', () => {
      this.showDeleteConfirmation();
    });

    // Delete confirmation
    confirmDelete.addEventListener('click', () => {
      this.deletePhoto();
    });

    cancelDelete.addEventListener('click', () => {
      this.hideModal(deleteModal);
    });

    // Refresh comments button
    const refreshCommentsBtn = document.getElementById('refreshCommentsBtn');
    if (refreshCommentsBtn) {
      refreshCommentsBtn.addEventListener('click', () => {
        if (selectedPhoto) {
          this.refreshComments();
        }
      });
    }

    // Close modals on backdrop click
    [photoModal, deleteModal, settingsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal(modal);
        }
      });
    });
  }

  navigateToUpload() {
    analytics.trackDashboard('upload_button_clicked');
    window.location.href = 'rate-me.html';
  }

  copyShareLink() {
    navigator.clipboard.writeText(modalShareLink.value).then(() => {
      copyLinkBtn.textContent = 'Copied!';
      copyLinkBtn.classList.add('copied');
      
      setTimeout(() => {
        copyLinkBtn.textContent = 'Copy';
        copyLinkBtn.classList.remove('copied');
      }, 2000);
      
      this.showToast('Link copied to clipboard', 'success');
      analytics.trackDashboard('share_link_copied', { photo_id: selectedPhoto.id });
    }).catch(err => {
      console.error('Failed to copy: ', err);
      this.showToast('Failed to copy link', 'error');
    });
  }

  sharePhoto() {
    if (navigator.share) {
      navigator.share({
        title: 'Rate my photo!',
        text: 'Check out my photo and give it a rating!',
        url: modalShareLink.value
      }).then(() => {
        analytics.trackDashboard('photo_shared_native', { photo_id: selectedPhoto.id });
      }).catch(err => {
        console.log('Share cancelled');
      });
    } else {
      // Fallback to copying link
      this.copyShareLink();
    }
  }

  async extendPhotoTime() {
    if (!selectedPhoto) return;

    this.showLoading(true);

    try {
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 3); // Extend by 3 hours

      await updateDoc(doc(db, 'rateMePosts', selectedPhoto.id), {
        expiresAt: newExpiresAt
      });

      selectedPhoto.expiresAt = { toDate: () => newExpiresAt };
      
      this.showToast('Photo time extended by 3 hours', 'success');
      this.hideModal(photoModal);
      this.displayPhotos();
      
      analytics.trackDashboard('photo_time_extended', { photo_id: selectedPhoto.id });

    } catch (error) {
      console.error('Error extending photo time:', error);
      this.showToast('Failed to extend photo time', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  showDeleteConfirmation() {
    this.hideModal(photoModal);
    this.showModal(deleteModal);
  }

  async deletePhoto() {
    if (!selectedPhoto) return;

    this.showLoading(true);

    try {
      // Delete the photo document
      await deleteDoc(doc(db, 'rateMePosts', selectedPhoto.id));

      // Delete associated ratings
      const ratingsQuery = query(
        collection(db, 'rateMeRatings'),
        where('postId', '==', selectedPhoto.id)
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      
      const deletePromises = ratingsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete the image from storage
      try {
        await deleteRateMePhoto(selectedPhoto.id);
      } catch (storageError) {
        console.log('Storage delete failed (file may not exist):', storageError);
      }

      // Remove from local array
      userPhotos = userPhotos.filter(photo => photo.id !== selectedPhoto.id);
      
      this.updateStats();
      this.displayPhotos();
      this.hideModal(deleteModal);
      this.showToast('Photo deleted successfully', 'success');
      
      analytics.trackDashboard('photo_deleted', { photo_id: selectedPhoto.id });

    } catch (error) {
      console.error('Error deleting photo:', error);
      this.showToast('Failed to delete photo', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  showModal(modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  hideModal(modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  showComingSoon(feature) {
    this.showToast(`${feature} coming soon!`, 'info');
  }

  showError(message) {
    this.showToast(message, 'error');
  }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RateMeDashboard();
});

// Handle page visibility for cleanup
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    analytics.trackDashboard('page_hidden');
  } else {
    analytics.trackDashboard('page_visible');
  }
});

export default RateMeDashboard;
