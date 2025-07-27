// Stories functionality - Enhanced with Firebase v10.7.1
import { 
  app, db, auth,
  doc, getDoc, addDoc, collection, firestoreQuery, firestoreOrderBy, firestoreLimit, onSnapshot, updateDoc, setDoc, getDocs, where,
  onAuthStateChanged, signInAnonymously, serverTimestamp, increment
} from './firebase-config.js';

class StoriesApp {
  constructor() {
    this.currentUser = null;
    this.stories = [];
    this.userLikes = new Set();
    this.userReactions = new Map(); // Track user reactions per story
    this.userBookmarks = new Set(); // Track bookmarked stories
    this.unsubscribeStories = null;
    this.unsubscribeUserLikes = null;
    this.unsubscribeUserBookmarks = null;
    this.lastVisibleStory = null;
    this.loadingMoreStories = false;
    this.hasMoreStories = true;
    this.currentFilter = 'all'; // Track current filter
    this.currentSort = 'newest'; // Track current sort
    this.init();
  }

  async init() {
    try {
      // Wait for auth state to be determined
      await this.initializeAuth();
      this.setupEventListeners();
      this.loadStories();
      console.log('Stories app initialized successfully');
    } catch (error) {
      console.error("Stories app initialization failed:", error);
      this.showError("Failed to load stories. Please refresh the page.");
    }
  }

  async initializeAuth() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          this.currentUser = user;
          console.log('User signed in:', user.uid);
          await this.loadUserLikes();
          await this.loadUserReactions();
          await this.loadUserBookmarks();
          resolve(user);
        } else {
          console.log('No user signed in, signing in anonymously...');
          try {
            const result = await signInAnonymously(auth);
            this.currentUser = result.user;
            console.log('Anonymous sign in successful:', result.user.uid);
            await this.loadUserLikes();
            await this.loadUserReactions();
            await this.loadUserBookmarks();
            resolve(result.user);
          } catch (error) {
            console.error('Anonymous sign in failed:', error);
            this.showUIState('error');
            resolve(null);
          }
        }
      });
    });
  }

  setupEventListeners() {
    // Share story modal
    const shareStoryBtn = document.getElementById("shareStoryBtn");
    const floatingWriteBtn = document.getElementById("floatingWriteBtn");
    const shareStoryModal = document.getElementById("shareStoryModal");
    const closeShareStory = document.getElementById("closeShareStory");
    const cancelShareStory = document.getElementById("cancelShareStory");
    const submitShareStory = document.getElementById("submitShareStory");
    const storyText = document.getElementById("storyText");
    const storyCharCount = document.getElementById("storyCharCount");
    const storyTags = document.getElementById("storyTags");
    const tagsPreview = document.getElementById("tagsPreview");

    // Handle both share story buttons
    const openModal = () => {
      shareStoryModal.classList.add("active");
      setTimeout(() => storyText?.focus(), 300);
    };

    if (shareStoryBtn && shareStoryModal) {
      shareStoryBtn.addEventListener("click", openModal);
    }

    if (floatingWriteBtn && shareStoryModal) {
      floatingWriteBtn.addEventListener("click", openModal);
    }

    // Floating button scroll behavior
    this.setupFloatingButton();
    // Pull to refresh for mobile
    this.setupPullToRefresh();
    // Infinite scroll for stories feed
    window.addEventListener('scroll', () => {
      const feed = document.getElementById('storiesFeed');
      if (!feed) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 300;
      if (scrollPosition >= threshold) {
        this.loadMoreStories();
      }
    });

    // Close modal handlers
    [closeShareStory, cancelShareStory].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => {
          shareStoryModal?.classList.remove("active");
          this.clearShareStoryForm();
        });
      }
    });

    // Submit story handler
    if (submitShareStory) {
      submitShareStory.addEventListener("click", () => {
        this.handleShareStory();
      });
    }

    // Character counter
    if (storyText && storyCharCount) {
      storyText.addEventListener("input", (e) => {
        const count = e.target.value.length;
        storyCharCount.textContent = count;

        if (count > 900) {
          storyCharCount.style.color = "#EF4444";
        } else {
          storyCharCount.style.color = "#6b7280";
        }
      });
    }

    // Tags input handler
    if (storyTags && tagsPreview) {
      storyTags.addEventListener("input", (e) => {
        this.updateTagsPreview(e.target.value, tagsPreview);
      });
    }

    // Story templates
    document.addEventListener("click", (e) => {
      if (e.target.closest(".template-btn")) {
        this.handleStoryTemplate(e.target.closest(".template-btn"));
      }
    });

    // Filter and sort controls
    const storyFilter = document.getElementById("storyFilter");
    const storySort = document.getElementById("storySort");
    const storySearch = document.getElementById("storySearch");
    const clearSearch = document.getElementById("clearSearch");

    if (storyFilter) {
      storyFilter.addEventListener("change", (e) => {
        this.currentFilter = e.target.value;
        this.applyFiltersAndSort();
      });
    }

    if (storySort) {
      storySort.addEventListener("change", (e) => {
        this.currentSort = e.target.value;
        this.applyFiltersAndSort();
      });
    }

    if (storySearch) {
      let searchTimeout;
      storySearch.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchStories(e.target.value);
        }, 300); // Debounce search
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener("click", () => {
        if (storySearch) {
          storySearch.value = '';
          this.searchStories('');
        }
      });
    }

    // Story interactions
    document.addEventListener("click", (e) => {
      if (e.target.closest(".main-reaction-btn")) {
        this.toggleReactionOptions(e.target.closest(".main-reaction-btn"));
      }
      if (e.target.closest(".reaction-option-btn")) {
        this.handleReaction(e.target.closest(".reaction-option-btn"));
      }
      if (e.target.closest(".reply-btn")) {
        this.handleReply(e.target.closest(".reply-btn"));
      }
      if (e.target.closest(".view-comments-btn")) {
        this.handleViewComments(e.target.closest(".view-comments-btn"));
      }
      if (e.target.closest(".close-comments-btn")) {
        this.handleCloseComments(e.target.closest(".close-comments-btn"));
      }
      if (e.target.closest(".submit-comment-btn")) {
        this.handleSubmitComment(e.target.closest(".submit-comment-btn"));
      }
      if (e.target.closest(".share-btn")) {
        this.handleShare(e.target.closest(".share-btn"));
      }
      if (e.target.closest(".generate-image-btn")) {
        this.handleGenerateImage(e.target.closest(".generate-image-btn"));
      }
      if (e.target.closest(".bookmark-btn")) {
        this.handleBookmark(e.target.closest(".bookmark-btn"));
      }
      if (e.target.closest(".story-tag")) {
        this.handleTagFilter(e.target.closest(".story-tag"));
      }
      
      // Close reaction options when clicking outside
      if (!e.target.closest(".reactions-container")) {
        document.querySelectorAll(".reaction-options.show").forEach(options => {
          options.classList.remove('show');
          options.classList.add('hide');
          const expandIcon = options.parentElement.querySelector(".expand-icon");
          if (expandIcon) expandIcon.textContent = "+";
          
          setTimeout(() => {
            options.style.display = "none";
            options.classList.remove('hide');
          }, 200);
        });
      }
    });

    // Close modal when clicking outside
    if (shareStoryModal) {
      shareStoryModal.addEventListener("click", (e) => {
        if (e.target === shareStoryModal) {
          shareStoryModal.classList.remove("active");
          this.clearShareStoryForm();
        }
      });
    }
  }

  loadStories() {
    try {
      this.showUIState('loading');
      const storiesQuery = firestoreQuery(
        collection(db, 'stories'),
        firestoreOrderBy('timestamp', 'desc'),
        firestoreLimit(20)
      );
      
      // Set up real-time listener for stories
      this.unsubscribeStories = onSnapshot(storiesQuery, (snapshot) => {
        console.log('Stories snapshot received, docs count:', snapshot.docs.length);
        const stories = [];
        snapshot.forEach((doc) => {
          const storyData = { id: doc.id, ...doc.data() };
          stories.push(storyData);
        });
        
        // Update stories data
        this.stories = stories;
        this.lastVisibleStory = snapshot.docs[snapshot.docs.length - 1] || null;
        this.hasMoreStories = snapshot.docs.length === 20;
        
        console.log('Updated stories data:', this.stories.map(s => ({ id: s.id, reactions: s.reactions })));
        
        if (stories.length === 0) {
          this.showUIState('empty');
        } else {
          this.showUIState('stories');
          this.displayStories(stories);
        }
        
        // Update reaction buttons with latest data
        this.updateAllMainReactionButtons();
      }, (error) => {
        console.error('Error in stories listener:', error);
        this.showUIState('error');
      });
      
    } catch (error) {
      console.error('Error setting up stories listener:', error);
      this.showUIState('error');
    }
  }

  async loadMoreStories() {
    if (!this.hasMoreStories || this.loadingMoreStories || !this.lastVisibleStory) return;
    this.loadingMoreStories = true;
    const storiesQuery = firestoreQuery(
      collection(db, 'stories'),
      firestoreOrderBy('timestamp', 'desc'),
      firestoreStartAfter(this.lastVisibleStory),
      firestoreLimit(20)
    );
    try {
      const snapshot = await getDocs(storiesQuery);
      const newStories = [];
      snapshot.forEach((doc) => {
        newStories.push({ id: doc.id, ...doc.data() });
      });
      if (newStories.length > 0) {
        this.stories = this.stories.concat(newStories);
        this.displayStories(this.stories);
        this.lastVisibleStory = snapshot.docs[snapshot.docs.length - 1];
        this.hasMoreStories = newStories.length === 20;
      } else {
        this.hasMoreStories = false;
      }
    } catch (error) {
      console.error('Error loading more stories:', error);
    }
    this.loadingMoreStories = false;
  }

  displayStories(stories) {
    const feed = document.getElementById("storiesFeed");
    if (!feed) return;

    // Clear existing stories (not state elements) only if this is the first page
    if (feed.dataset.page !== 'appended') {
      const existingStories = feed.querySelectorAll('.story-card[data-story-id]');
      existingStories.forEach(story => story.remove());
    }
    feed.dataset.page = 'appended';

    // Add new stories
    stories.forEach((story, index) => {
      if (!feed.querySelector(`[data-story-id='${story.id}']`)) {
        const storyElement = this.createStoryElement(story);
        setTimeout(() => {
          feed.appendChild(storyElement);
          storyElement.style.opacity = '0';
          storyElement.style.transform = 'translateY(20px)';
          requestAnimationFrame(() => {
            storyElement.style.transition = 'all 0.3s ease';
            storyElement.style.opacity = '1';
            storyElement.style.transform = 'translateY(0)';
          });
        }, index * 50);
      }
    });
  }

  createStoryElement(story) {
    const article = document.createElement("article");
    article.className = "story-card";
    article.dataset.storyId = story.id;

    // Get user reaction states
    const userReaction = this.userReactions.get(story.id);
    const isBookmarked = this.userBookmarks.has(story.id);
    const reactionClasses = {
      like: userReaction === 'like' ? 'active' : '',
      love: userReaction === 'love' ? 'active' : '',
      wow: userReaction === 'wow' ? 'active' : '',
      sad: userReaction === 'sad' ? 'active' : '',
      hug: userReaction === 'hug' ? 'active' : ''
    };

    article.innerHTML = `
      <div class="story-content" id="story-content-${story.id}">
        <p class="story-text">${this.escapeHtml(story.content)}</p>
        ${story.tags && story.tags.length > 0 ? `<div class="story-tags">${story.tags.map(tag => `<span class="story-tag">#${tag}</span>`).join('')}</div>` : ''}
        <div class="story-meta">
          <span class="reading-time">${this.getReadingTime(story.content)}</span>
          <span class="story-length-indicator ${this.getStoryLengthClass(story.content)}"></span>
        </div>
      </div>
      <div class="story-footer">
        <div class="story-reactions">
          <div class="reactions-container" data-story-id="${story.id}">
            <button class="main-reaction-btn" data-story-id="${story.id}">
              <span class="main-reaction-icon">${userReaction ? this.getReactionEmoji(userReaction) : '❤️'}</span>
              <span class="total-reactions">${this.getTotalReactions(story.reactions)}</span>
              <span class="expand-icon">+</span>
            </button>
            <div class="reaction-options" style="display: none;">
              <button class="reaction-option-btn ${reactionClasses.like}" data-story-id="${story.id}" data-reaction="like">
                <span class="reaction-icon">❤️</span>
                <span class="reaction-count">${story.reactions?.like || 0}</span>
              </button>
              <button class="reaction-option-btn ${reactionClasses.love}" data-story-id="${story.id}" data-reaction="love">
                <span class="reaction-icon">🥰</span>
                <span class="reaction-count">${story.reactions?.love || 0}</span>
              </button>
              <button class="reaction-option-btn ${reactionClasses.wow}" data-story-id="${story.id}" data-reaction="wow">
                <span class="reaction-icon">😮</span>
                <span class="reaction-count">${story.reactions?.wow || 0}</span>
              </button>
              <button class="reaction-option-btn ${reactionClasses.sad}" data-story-id="${story.id}" data-reaction="sad">
                <span class="reaction-icon">😢</span>
                <span class="reaction-count">${story.reactions?.sad || 0}</span>
              </button>
              <button class="reaction-option-btn ${reactionClasses.hug}" data-story-id="${story.id}" data-reaction="hug">
                <span class="reaction-icon">🤗</span>
                <span class="reaction-count">${story.reactions?.hug || 0}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="story-actions">
          <button class="action-btn reply-btn" data-story-id="${story.id}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
            </svg>
            <span>${story.replies || 0}</span>
          </button>
          <button class="action-btn view-comments-btn" data-story-id="${story.id}" title="View Comments">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
          <button class="action-btn bookmark-btn ${isBookmarked ? 'active' : ''}" data-story-id="${story.id}" title="${isBookmarked ? 'Remove Bookmark' : 'Bookmark Story'}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
          <button class="action-btn generate-image-btn" data-story-id="${story.id}" title="Generate Image">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2zm0-2V6h14v12H5zm2-2l3-4 2.25 3 3-4L19 18H5z"/>
            </svg>
          </button>
          <button class="action-btn share-btn" data-story-id="${story.id}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
          </button>
        </div>
        <div class="story-time" title="${this.formatFullDate(story.timestamp)}">${this.formatTime(story.timestamp)}</div>
      </div>
      <div class="comments-section" id="comments-${story.id}" style="display: none;">
        <div class="comments-header">
          <h4>Comments</h4>
          <button class="close-comments-btn">×</button>
        </div>
        <div class="comments-list"></div>
        <div class="comment-input">
          <textarea placeholder="Add a comment..." maxlength="500"></textarea>
          <button class="submit-comment-btn" data-story-id="${story.id}">Post</button>
        </div>
      </div>
    `;

    return article;
  }

  async handleShareStory() {
    const storyText = document.getElementById("storyText");
    const storyTags = document.getElementById("storyTags");
    const allowReplies = document.getElementById("allowReplies");
    
    if (!storyText) return;
    
    const content = storyText.value.trim();
    const tagsInput = storyTags?.value.trim() || "";

    if (!content) {
      this.showError("Please write your story before sharing.");
      return;
    }

    if (content.length > 1000) {
      this.showError("Story is too long. Please keep it under 1000 characters.");
      return;
    }

    if (!this.currentUser) {
      this.showError("Please wait while we connect you anonymously...");
      return;
    }

    try {
      // Show loading state
      const submitBtn = document.getElementById("submitShareStory");
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.textContent = "Sharing...";
        submitBtn.disabled = true;
      }

      // Extract hashtags from content and combine with explicit tags
      const hashtagsFromContent = this.extractHashtags(content);
      const explicitTags = this.parseTagsInput(tagsInput);
      
      // Combine and deduplicate tags
      const allTags = [...new Set([...hashtagsFromContent, ...explicitTags])];

      // Create story document
      const storyData = {
        content: content,
        authorId: this.currentUser.uid,
        timestamp: serverTimestamp(),
        likes: 0,
        replies: 0,
        reactions: {
          like: 0,
          love: 0,
          wow: 0,
          sad: 0,
          hug: 0
        },
        allowReplies: allowReplies?.checked !== false,
        tags: allTags,
        type: 'story',
        isAnonymous: true
      };

      // Add to Firestore
      await addDoc(collection(db, 'stories'), storyData);

      // Close modal and reset form
      document.getElementById("shareStoryModal")?.classList.remove("active");
      this.clearShareStoryForm();
      this.showSuccess("Your story has been shared anonymously!");

      // Reset button
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }

    } catch (error) {
      console.error("Error sharing story:", error);
      this.showError("Failed to share story. Please try again.");
      
      // Reset button
      const submitBtn = document.getElementById("submitShareStory");
      if (submitBtn) {
        submitBtn.textContent = "Share Anonymously";
        submitBtn.disabled = false;
      }
    }
  }

  extractHashtags(text) {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1).toLowerCase()) : [];
  }

  clearShareStoryForm() {
    const storyText = document.getElementById("storyText");
    const storyCharCount = document.getElementById("storyCharCount");
    const storyTags = document.getElementById("storyTags");
    const tagsPreview = document.getElementById("tagsPreview");
    const allowReplies = document.getElementById("allowReplies");

    if (storyText) storyText.value = "";
    if (storyCharCount) {
      storyCharCount.textContent = "0";
      storyCharCount.style.color = "#6b7280";
    }
    if (storyTags) storyTags.value = "";
    if (tagsPreview) {
      tagsPreview.innerHTML = "";
      tagsPreview.style.display = "none";
    }
    if (allowReplies) allowReplies.checked = true;
  }

  async handleLike(button) {
    const storyId = button.dataset.storyId;
    if (!storyId || !this.currentUser) return;

    const isLiked = button.classList.contains("active");
    const countSpan = button.querySelector("span");
    
    try {
      const storyRef = doc(db, 'stories', storyId);
      
      if (isLiked) {
        // Unlike
        button.classList.remove("active");
        await updateDoc(storyRef, {
          likes: increment(-1)
        });
        
        // Remove from user likes
        await this.removeUserLike(storyId);
        
      } else {
        // Like
        button.classList.add("active");
        await updateDoc(storyRef, {
          likes: increment(1)
        });
        
        // Add to user likes
        await this.addUserLike(storyId);
        
        // Add heart animation
        this.createHeartAnimation(button);
      }

    } catch (error) {
      console.error('Error updating like:', error);
      // Revert UI change
      if (isLiked) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    }
  }

  async addUserLike(storyId) {
    try {
      const userLikesRef = doc(db, 'userLikes', this.currentUser.uid);
      const userDoc = await getDoc(userLikesRef);
      
      if (userDoc.exists()) {
        const likes = userDoc.data().storyLikes || [];
        if (!likes.includes(storyId)) {
          likes.push(storyId);
          await updateDoc(userLikesRef, { storyLikes: likes });
        }
      } else {
        await setDoc(userLikesRef, { storyLikes: [storyId] });
      }
    } catch (error) {
      console.error('Error adding user like:', error);
    }
  }

  async removeUserLike(storyId) {
    try {
      const userLikesRef = doc(db, 'userLikes', this.currentUser.uid);
      const userDoc = await getDoc(userLikesRef);
      
      if (userDoc.exists()) {
        const likes = userDoc.data().storyLikes || [];
        const updatedLikes = likes.filter(id => id !== storyId);
        await updateDoc(userLikesRef, { storyLikes: updatedLikes });
      }
    } catch (error) {
      console.error('Error removing user like:', error);
    }
  }

  isStoryLikedByUser(storyId) {
    return this.userLikes.has(storyId);
  }

  async loadUserLikes() {
    if (!this.currentUser) return;

    try {
      const userLikesRef = doc(db, 'userLikes', this.currentUser.uid);
      
      this.unsubscribeUserLikes = onSnapshot(userLikesRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          this.userLikes = new Set(data.storyLikes || []);
        } else {
          this.userLikes = new Set();
        }
        
        // Update UI for existing stories
        this.updateLikeButtons();
      }, (error) => {
        console.error('Error loading user likes:', error);
        this.userLikes = new Set();
      });

    } catch (error) {
      console.error('Error setting up user likes listener:', error);
      this.userLikes = new Set();
    }
  }

  updateLikeButtons() {
    const likeButtons = document.querySelectorAll('.like-btn[data-story-id]');
    likeButtons.forEach(button => {
      const storyId = button.dataset.storyId;
      const isLiked = this.userLikes.has(storyId);
      
      if (isLiked) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  showUIState(state) {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    
    // Hide all states
    [loadingState, emptyState, errorState].forEach(el => {
      if (el) el.style.display = 'none';
    });

    // Show requested state
    switch (state) {
      case 'loading':
        if (loadingState) loadingState.style.display = 'flex';
        break;
      case 'empty':
        if (emptyState) emptyState.style.display = 'flex';
        break;
      case 'error':
        if (errorState) errorState.style.display = 'flex';
        break;
      case 'stories':
        // Stories are displayed, hide all state messages
        break;
    }
  }

  async loadComments(storyId) {
    const commentsCol = collection(db, 'stories', storyId, 'comments');
    const q = firestoreQuery(commentsCol, firestoreOrderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    const comments = [];
    snapshot.forEach(doc => {
      comments.push({ id: doc.id, ...doc.data() });
    });
    return comments;
  }

  displayComments(comments, container, parentId) {
  const thread = comments.filter(c => c.parentId === parentId);
  thread.forEach(comment => {
    const li = document.createElement('li');
    li.className = 'story-comment';
    li.innerHTML = `
      <div class="story-comment-avatar">&#128100;</div>
      <div class="story-comment-content">
        <div class="story-comment-meta">
          <span>${this.formatTime(comment.timestamp)}</span>
        </div>
        <div class="story-comment-text">${this.escapeHtml(comment.text)}</div>
        <div class="story-comment-actions">
          <button class="story-comment-reply-btn" data-comment-id="${comment.id}">Reply</button>
        </div>
      </div>
    `;
    // Attach reply event
    li.querySelector('.story-comment-reply-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.showReplyInput(container, comments, comment.id, li);
    });
    container.appendChild(li);
    // Render replies recursively
    const repliesContainer = document.createElement('div');
    repliesContainer.className = 'story-comment-thread';
    container.appendChild(repliesContainer);
    this.displayComments(comments, repliesContainer, comment.id);
  });
}

  async addComment(storyId, text, parentId) {
    const commentsCol = collection(db, 'stories', storyId, 'comments');
    await addDoc(commentsCol, {
      text,
      parentId: parentId || null,
      userId: this.currentUser?.uid || null,
      timestamp: serverTimestamp(),
    });
  }

  handleReply(button) {
    const storyId = button.dataset.storyId;
    if (!storyId) return;
    
    // Find the story card
    const storyCard = button.closest('.story-card');
    if (!storyCard) return;

    // Check if reply section already exists
    let replySection = storyCard.querySelector('.story-reply-section');
    
    if (!replySection) {
      // Create reply section
      replySection = document.createElement('div');
      replySection.className = 'story-reply-section';
      replySection.innerHTML = `
        <div class="reply-input-container">
          <textarea placeholder="Share your thoughts anonymously..." maxlength="300"></textarea>
          <div class="reply-actions">
            <button class="btn-secondary cancel-story-reply">Cancel</button>
            <button class="btn-primary submit-story-reply">Reply</button>
          </div>
        </div>
      `;
      
      storyCard.appendChild(replySection);
      
      const textarea = replySection.querySelector('textarea');
      textarea.focus();

      // Handle cancel
      replySection.querySelector('.cancel-story-reply').addEventListener('click', () => {
        replySection.remove();
      });

      // Handle submit
      replySection.querySelector('.submit-story-reply').addEventListener('click', async () => {
        await this.submitStoryReply(storyId, textarea, replySection, button);
      });
    } else {
      // Toggle existing reply section
      const textarea = replySection.querySelector('textarea');
      if (replySection.style.display === 'none') {
        replySection.style.display = 'block';
        textarea.focus();
      } else {
        replySection.style.display = 'none';
      }
    }
  }

  async submitStoryReply(storyId, textarea, replySection, replyButton) {
    const text = textarea.value.trim();
    if (!text) {
      this.showError("Please write something before replying.");
      return;
    }

    if (!this.currentUser) {
      this.showError("Please wait while we connect you anonymously...");
      return;
    }

    try {
      const submitBtn = replySection.querySelector('.submit-story-reply');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Posting...";
      submitBtn.disabled = true;

      // Add to Firestore
      await this.addComment(storyId, text, null);

      // Update reply count in the button
      const countSpan = replyButton.querySelector('span');
      const currentCount = parseInt(countSpan.textContent) || 0;
      countSpan.textContent = currentCount + 1;

      // Update in Firestore
      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        replies: increment(1)
      });

      replySection.remove();
      this.showSuccess("Your reply has been posted anonymously!");

    } catch (error) {
      console.error('Error posting reply:', error);
      this.showError('Failed to post reply. Please try again.');
      
      const submitBtn = replySection.querySelector('.submit-story-reply');
      submitBtn.textContent = "Reply";
      submitBtn.disabled = false;
    }
  }

  async handleSubmitComment(button) {
    const storyId = button.dataset.storyId;
    const commentsSection = button.closest('.comments-section');
    const textarea = commentsSection.querySelector('textarea');
    const text = textarea.value.trim();

    if (!text) {
      this.showError('Please write a comment before posting.');
      return;
    }

    if (!this.currentUser) {
      this.showError('Please wait while we connect you anonymously...');
      return;
    }

    try {
      const originalText = button.textContent;
      button.textContent = 'Posting...';
      button.disabled = true;

      // Add comment to Firestore
      await this.addComment(storyId, text, null);

      // Clear textarea
      textarea.value = '';
      
      // Update reply count
      const storyCard = commentsSection.closest('.story-card');
      const replyBtn = storyCard.querySelector('.reply-btn span');
      const currentCount = parseInt(replyBtn.textContent) || 0;
      replyBtn.textContent = currentCount + 1;

      // Update in Firestore
      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        replies: increment(1)
      });

      this.showSuccess('Comment posted successfully!');

    } catch (error) {
      console.error('Error posting comment:', error);
      this.showError('Failed to post comment. Please try again.');
    } finally {
      button.textContent = 'Post';
      button.disabled = false;
    }
  }

  handleShare(button) {
    const storyId = button.dataset.storyId;
    
    if (navigator.share) {
      navigator.share({
        title: 'Anonymous Story',
        text: 'Check out this inspiring story',
        url: window.location.href
      }).catch((error) => {
        console.log('Error sharing:', error);
        this.fallbackShare();
      });
    } else {
      this.fallbackShare();
    }
  }

  fallbackShare() {
    // Try clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.showSuccess("Link copied to clipboard!");
      }).catch(() => {
        this.showNotification("Sharing feature coming soon!", "info");
      });
    } else {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showSuccess("Link copied to clipboard!");
      } catch (err) {
        this.showNotification("Sharing feature coming soon!", "info");
      }
    }
  }

  createHeartAnimation(button) {
    const heart = document.createElement("div");
    heart.innerHTML = "❤️";
    heart.style.position = "absolute";
    heart.style.fontSize = "20px";
    heart.style.pointerEvents = "none";
    heart.style.animation = "heartFloat 1s ease-out forwards";
    heart.style.zIndex = "1000";

    const rect = button.getBoundingClientRect();
    heart.style.left = rect.left + rect.width / 2 + "px";
    heart.style.top = rect.top + "px";

    document.body.appendChild(heart);

    setTimeout(() => {
      if (heart.parentNode) {
        heart.parentNode.removeChild(heart);
      }
    }, 1000);
  }

  formatTime(timestamp) {
    if (!timestamp) return "Just now";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

    return date.toLocaleDateString();
  }

  formatFullDate(timestamp) {
    if (!timestamp) return "Unknown date";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    this.showNotification(message, "error");
  }

  showSuccess(message) {
    this.showNotification(message, "success");
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 24px",
      borderRadius: "12px",
      color: "white",
      fontWeight: "500",
      fontSize: "14px",
      zIndex: "1000",
      maxWidth: "90%",
      textAlign: "center",
      opacity: "0",
      transition: "all 0.3s ease",
    });

    const colors = {
      error: "#EF4444",
      success: "#10B981",
      info: "#3B82F6",
    };
    notification.style.background = colors[type] || colors.info;

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.style.opacity = "1";
    });

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  updateTagsPreview(tagsString, previewElement) {
    if (!previewElement) return;
    
    const tags = this.parseTagsInput(tagsString);
    
    if (tags.length === 0) {
      previewElement.innerHTML = '';
      previewElement.style.display = 'none';
      return;
    }
    
    previewElement.style.display = 'flex';
    previewElement.innerHTML = tags.map(tag => 
      `<span class="tag-preview">#${tag}</span>`
    ).join('');
  }

  parseTagsInput(tagsString) {
    if (!tagsString.trim()) return [];
    
    return tagsString
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 20)
      .slice(0, 10); // Limit to 10 tags
  }

  async handleGenerateImage(button) {
    const storyId = button.dataset.storyId;
    
    try {
      // Find story data
      const storyCard = button.closest('.story-card');
      if (!storyCard) {
        this.showError('Story not found');
        return;
      }
      
      const storyContent = storyCard.querySelector('.story-content').textContent;
      const storyTimeElement = storyCard.querySelector('.story-time');
      const storyTime = storyTimeElement ? storyTimeElement.getAttribute('title') : 'Unknown date';
      
      const storyData = {
        id: storyId,
        content: storyContent,
        timestamp: storyTime
      };
      
      this.showNotification('Generating image...', 'info');
      
      // Generate image
      const canvas = await this.generateStoryImage(storyData);
      
      // Convert to blob and download
      canvas.toBlob(async (blob) => {
        try {
          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `story-${storyId}-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          this.showSuccess('Story image downloaded!');
          
          // Show sharing options if Web Share API is available
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'story.png', { type: 'image/png' })] })) {
            const file = new File([blob], 'story.png', { type: 'image/png' });
            try {
              await navigator.share({
                title: 'Anonymous Story',
                text: 'Check out this inspiring story',
                files: [file]
              });
            } catch (shareError) {
              if (shareError.name !== 'AbortError') {
                console.log('Share failed:', shareError);
              }
            }
          }
        } catch (error) {
          console.error('Error processing image:', error);
          this.showError('Failed to process image');
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Error generating story image:', error);
      this.showError('Failed to generate story image');
    }
  }

  async generateStoryImage(storyData) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size for social media (1080x1080 for Instagram)
      canvas.width = 1080;
      canvas.height = 1080;
      
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#8a9be7ff');
      gradient.addColorStop(1, '#e493c9ff');
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
      
      // Add heart icon
      const heartSize = 120;
      const heartX = (canvas.width - heartSize) / 2;
      const heartY = 150;
      
      ctx.fillStyle = '#ffffff';
      ctx.font = `${heartSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('❤️', heartX + heartSize/2, heartY + heartSize);
      
      // Add "Story" label
      ctx.font = '36px Inter, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText('Anonymous Story', canvas.width / 2, heartY + heartSize + 80);
      
      // Add story content with word wrapping
      ctx.fillStyle = 'white';
      ctx.font = 'bold 42px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      
      const storyText = storyData.content;
      const maxWidth = canvas.width - 120;
      const lineHeight = 60;
      let y = 450;
      
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
      
      const lines = wrapText(storyText, maxWidth);
      
      // Draw story text
      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, y + (index * lineHeight));
      });
      
      // Add timestamp if available
      if (storyData.timestamp && storyData.timestamp !== 'Unknown date') {
        y += (lines.length * lineHeight) + 80;
        
        ctx.font = '28px Inter, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(storyData.timestamp, canvas.width / 2, y);
      }
      
      // Add app branding at bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '28px Inter, Arial, sans-serif';
      ctx.fillText('Just Let It Out', canvas.width / 2, canvas.height - 80);
      
      ctx.font = '24px Inter, Arial, sans-serif';
      ctx.fillText('Share your story anonymously', canvas.width / 2, canvas.height - 40);
      
      return canvas;
    } catch (error) {
      console.error('Error generating story image:', error);
      throw error;
    }
  }

  async handleBookmark(button) {
    const storyId = button.dataset.storyId;
    if (!storyId || !this.currentUser) return;

    const isBookmarked = button.classList.contains("active");
    
    try {
      if (isBookmarked) {
        // Remove bookmark
        button.classList.remove("active");
        button.title = "Bookmark Story";
        await this.removeUserBookmark(storyId);
        this.showNotification("Bookmark removed", "info");
      } else {
        // Add bookmark
        button.classList.add("active");
        button.title = "Remove Bookmark";
        await this.addUserBookmark(storyId);
        this.showNotification("Story bookmarked!", "success");
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      // Revert UI change
      if (isBookmarked) {
        button.classList.add("active");
        button.title = "Remove Bookmark";
      } else {
        button.classList.remove("active");
        button.title = "Bookmark Story";
      }
      this.showError('Failed to update bookmark. Please try again.');
    }
  }

  async addUserBookmark(storyId) {
    try {
      const userBookmarksRef = doc(db, 'userBookmarks', this.currentUser.uid);
      const userDoc = await getDoc(userBookmarksRef);
      
      if (userDoc.exists()) {
        const bookmarks = userDoc.data().storyBookmarks || [];
        if (!bookmarks.includes(storyId)) {
          bookmarks.push(storyId);
          await updateDoc(userBookmarksRef, { storyBookmarks: bookmarks });
        }
      } else {
        await setDoc(userBookmarksRef, { storyBookmarks: [storyId] });
      }
    } catch (error) {
      console.error('Error adding user bookmark:', error);
    }
  }

  async removeUserBookmark(storyId) {
    try {
      const userBookmarksRef = doc(db, 'userBookmarks', this.currentUser.uid);
      const userDoc = await getDoc(userBookmarksRef);
      
      if (userDoc.exists()) {
        const bookmarks = userDoc.data().storyBookmarks || [];
        const updatedBookmarks = bookmarks.filter(id => id !== storyId);
        await updateDoc(userBookmarksRef, { storyBookmarks: updatedBookmarks });
      }
    } catch (error) {
      console.error('Error removing user bookmark:', error);
    }
  }

  async loadUserBookmarks() {
    if (!this.currentUser) return;

    try {
      const userBookmarksRef = doc(db, 'userBookmarks', this.currentUser.uid);
      
      this.unsubscribeUserBookmarks = onSnapshot(userBookmarksRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          this.userBookmarks = new Set(data.storyBookmarks || []);
        } else {
          this.userBookmarks = new Set();
        }
        
        // Update UI for existing stories
        this.updateBookmarkButtons();
      }, (error) => {
        console.error('Error loading user bookmarks:', error);
        this.userBookmarks = new Set();
      });

    } catch (error) {
      console.error('Error setting up user bookmarks listener:', error);
      this.userBookmarks = new Set();
    }
  }

  updateBookmarkButtons() {
    const bookmarkButtons = document.querySelectorAll('.bookmark-btn[data-story-id]');
    bookmarkButtons.forEach(button => {
      const storyId = button.dataset.storyId;
      const isBookmarked = this.userBookmarks.has(storyId);
      
      if (isBookmarked) {
        button.classList.add('active');
        button.title = 'Remove Bookmark';
      } else {
        button.classList.remove('active');
        button.title = 'Bookmark Story';
      }
    });
  }

  getReadingTime(content) {
    const wordsPerMinute = 200;
    const words = content.split(' ').length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes === 1 ? '1 min read' : `${minutes} min read`;
  }

  getStoryLengthClass(content) {
    const length = content.length;
    if (length < 200) return 'short';
    if (length < 500) return 'medium';
    return 'long';
  }

  handleTagFilter(tagElement) {
    const tag = tagElement.textContent.replace('#', '');
    this.currentFilter = tag;
    this.filterStoriesByTag(tag);
    this.showNotification(`Filtering by #${tag}`, "info");
  }

  filterStoriesByTag(tag) {
    const storyCards = document.querySelectorAll('.story-card');
    storyCards.forEach(card => {
      const tags = card.querySelectorAll('.story-tag');
      const hasTag = Array.from(tags).some(tagEl => 
        tagEl.textContent.toLowerCase().includes(tag.toLowerCase())
      );
      
      if (hasTag || tag === 'all') {
        card.style.display = 'block';
        card.style.opacity = '1';
      } else {
        card.style.display = 'none';
      }
    });
  }

  applyFiltersAndSort() {
    const feed = document.getElementById("storiesFeed");
    if (!feed) return;

    let filteredStories = [...this.stories];

    // Apply filters
    switch (this.currentFilter) {
      case 'bookmarked':
        filteredStories = filteredStories.filter(story => 
          this.userBookmarks.has(story.id)
        );
        break;
      case 'trending':
        // Trending = stories with high engagement in last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        filteredStories = filteredStories.filter(story => {
          const storyDate = story.timestamp.toDate ? story.timestamp.toDate() : new Date(story.timestamp);
          return storyDate > oneDayAgo && this.getTotalReactions(story.reactions) > 2;
        });
        break;
    }

    // Apply sorting
    switch (this.currentSort) {
      case 'popular':
        filteredStories.sort((a, b) => {
          const aScore = (a.replies || 0) + this.getTotalReactions(a.reactions);
          const bScore = (b.replies || 0) + this.getTotalReactions(b.reactions);
          return bScore - aScore;
        });
        break;
      case 'reactions':
        filteredStories.sort((a, b) => 
          this.getTotalReactions(b.reactions) - this.getTotalReactions(a.reactions)
        );
        break;
      case 'newest':
      default:
        filteredStories.sort((a, b) => {
          const aTime = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const bTime = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return bTime - aTime;
        });
        break;
    }

    // Clear and redisplay filtered stories
    const existingStories = feed.querySelectorAll('.story-card[data-story-id]');
    existingStories.forEach(story => story.remove());
    
    if (filteredStories.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'filter-empty-state';
      emptyMessage.innerHTML = `
        <div class="empty-state-icon">📝</div>
        <h3>No stories found</h3>
        <p>Try adjusting your filters or search terms.</p>
        <button class="btn-secondary clear-filters-btn">
          Clear Filters
        </button>
      `;
      
      // Add event listener for clear filters button
      const clearFiltersBtn = emptyMessage.querySelector('.clear-filters-btn');
      clearFiltersBtn.addEventListener('click', () => {
        const storyFilter = document.getElementById('storyFilter');
        const storySort = document.getElementById('storySort');
        const storySearch = document.getElementById('storySearch');
        
        if (storyFilter) storyFilter.value = 'all';
        if (storySort) storySort.value = 'newest';
        if (storySearch) storySearch.value = '';
        
        this.currentFilter = 'all';
        this.currentSort = 'newest';
        
        // Remove the empty message first
        emptyMessage.remove();
        
        // Show all stories without filters
        if (this.stories.length > 0) {
          this.displayStories(this.stories);
        } else {
          // If no stories loaded, reload them
          this.loadStories();
        }
        
        // Clear search highlighting
        this.searchStories('');
      });
      
      feed.appendChild(emptyMessage);
    } else {
      this.displayStories(filteredStories);
    }
  }

  searchStories(searchTerm) {
    const storyCards = document.querySelectorAll('.story-card');
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      // Show all stories if search is empty
      storyCards.forEach(card => {
        card.style.display = 'block';
        card.style.opacity = '1';
      });
      return;
    }

    storyCards.forEach(card => {
      const storyText = card.querySelector('.story-text')?.textContent.toLowerCase() || '';
      const storyTags = Array.from(card.querySelectorAll('.story-tag'))
        .map(tag => tag.textContent.toLowerCase()).join(' ');
      
      const matches = storyText.includes(term) || storyTags.includes(term);
      
      if (matches) {
        card.style.display = 'block';
        card.style.opacity = '1';
        // Highlight search terms
        this.highlightSearchTerms(card, term);
      } else {
        card.style.display = 'none';
      }
    });

    const clearSearchBtn = document.getElementById("clearSearch");
    if (clearSearchBtn) {
      clearSearchBtn.style.display = term ? 'block' : 'none';
    }
  }

  highlightSearchTerms(card, term) {
    const storyText = card.querySelector('.story-text');
    if (!storyText) return;

    const originalText = storyText.textContent;
    const regex = new RegExp(`(${term})`, 'gi');
    const highlightedText = originalText.replace(regex, '<mark>$1</mark>');
    storyText.innerHTML = highlightedText;
  }

  handleStoryTemplate(button) {
    const template = button.dataset.template;
    const storyText = document.getElementById("storyText");
    const storyTags = document.getElementById("storyTags");
    
    if (!storyText) return;

    const templates = {
      gratitude: {
        text: "Today I'm grateful for...\n\nIt reminded me that...",
        tags: "gratitude, mindfulness, appreciation"
      },
      challenge: {
        text: "I faced a difficult situation when...\n\nWhat I learned was...\n\nTo anyone going through something similar...",
        tags: "challenge, growth, resilience"
      },
      advice: {
        text: "Something I wish I knew earlier is...\n\nThis has helped me because...\n\nI hope this helps someone else too.",
        tags: "advice, wisdom, help"
      },
      milestone: {
        text: "I reached an important milestone today...\n\nThe journey to get here was...\n\nI want to celebrate by...",
        tags: "milestone, achievement, celebration"
      }
    };

    const selectedTemplate = templates[template];
    if (selectedTemplate) {
      storyText.value = selectedTemplate.text;
      if (storyTags) {
        storyTags.value = selectedTemplate.tags;
        this.updateTagsPreview(selectedTemplate.tags, document.getElementById("tagsPreview"));
      }
      
      // Update character count
      const charCount = document.getElementById("storyCharCount");
      if (charCount) {
        charCount.textContent = selectedTemplate.text.length;
        charCount.style.color = selectedTemplate.text.length > 900 ? "#EF4444" : "#6b7280";
      }
      
      // Focus and position cursor at the end of the first line
      storyText.focus();
      const firstLineEnd = selectedTemplate.text.indexOf('\n');
      if (firstLineEnd > 0) {
        storyText.setSelectionRange(firstLineEnd, firstLineEnd);
      }
    }
  }

  // Cleanup when app is destroyed
  destroy() {
    if (this.unsubscribeStories) {
      this.unsubscribeStories();
    }
    if (this.unsubscribeUserLikes) {
      this.unsubscribeUserLikes();
    }
    if (this.unsubscribeUserBookmarks) {
      this.unsubscribeUserBookmarks();
    }
  }

  setupFloatingButton() {
    const floatingBtn = document.getElementById("floatingWriteBtn");
    if (!floatingBtn) return;

    let lastScrollY = window.scrollY;
    let scrollTimeout;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show button when scrolling down past 100px
      if (currentScrollY > 100) {
        floatingBtn.classList.add("visible");
      } else {
        floatingBtn.classList.remove("visible");
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 10);
    });
  }

  setupPullToRefresh() {
    let startY = 0;
    let pullDistance = 0;
    let isPulling = false;
    const refreshThreshold = 80;
    
    const feed = document.getElementById('storiesFeed');
    if (!feed) return;

    // Create refresh indicator
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'pull-refresh-indicator';
    refreshIndicator.innerHTML = `
      <div class="refresh-icon">↓</div>
      <span class="refresh-text">Pull to refresh</span>
    `;
    feed.parentNode.insertBefore(refreshIndicator, feed);

    const updateIndicator = (distance) => {
      const progress = Math.min(distance / refreshThreshold, 1);
      refreshIndicator.style.height = `${distance}px`;
      refreshIndicator.style.opacity = progress;
      
      if (progress >= 1) {
        refreshIndicator.querySelector('.refresh-text').textContent = 'Release to refresh';
        refreshIndicator.querySelector('.refresh-icon').style.transform = 'rotate(180deg)';
      } else {
        refreshIndicator.querySelector('.refresh-text').textContent = 'Pull to refresh';
        refreshIndicator.querySelector('.refresh-icon').style.transform = 'rotate(0deg)';
      }
    };

    feed.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    });

    feed.addEventListener('touchmove', (e) => {
      if (!isPulling || window.scrollY > 0) return;
      
      const currentY = e.touches[0].clientY;
      pullDistance = Math.max(0, currentY - startY);
      
      if (pullDistance > 0) {
        e.preventDefault();
        updateIndicator(pullDistance);
      }
    });

    feed.addEventListener('touchend', () => {
      if (!isPulling) return;
      
      if (pullDistance >= refreshThreshold) {
        // Trigger refresh
        refreshIndicator.querySelector('.refresh-text').textContent = 'Refreshing...';
        refreshIndicator.querySelector('.refresh-icon').innerHTML = '⟳';
        refreshIndicator.querySelector('.refresh-icon').style.animation = 'spin 1s linear infinite';
        
        this.refreshStories().finally(() => {
          setTimeout(() => {
            refreshIndicator.style.height = '0px';
            refreshIndicator.style.opacity = '0';
            refreshIndicator.querySelector('.refresh-icon').style.animation = '';
            refreshIndicator.querySelector('.refresh-icon').innerHTML = '↓';
          }, 500);
        });
      } else {
        refreshIndicator.style.height = '0px';
        refreshIndicator.style.opacity = '0';
      }
      
      isPulling = false;
      pullDistance = 0;
    });
  }

  async refreshStories() {
    try {
      this.showNotification('Refreshing stories...', 'info');
      this.stories = [];
      this.lastVisibleStory = null;
      this.hasMoreStories = true;
      await this.loadStories();
      this.showNotification('Stories refreshed!', 'success');
    } catch (error) {
      console.error('Error refreshing stories:', error);
      this.showError('Failed to refresh stories');
    }
  }

  showReplyInput(container, comments, commentId, commentElement) {
    // Check if reply input already exists
    const existingInput = commentElement.querySelector('.reply-input');
    if (existingInput) {
      existingInput.focus();
      return;
    }

    // Create reply input
    const replyDiv = document.createElement('div');
    replyDiv.className = 'reply-input';
    replyDiv.innerHTML = `
      <textarea placeholder="Write a reply..." maxlength="300"></textarea>
      <div class="reply-actions">
        <button class="btn-secondary cancel-reply">Cancel</button>
        <button class="btn-primary submit-reply">Reply</button>
      </div>
    `;

    commentElement.appendChild(replyDiv);
    const textarea = replyDiv.querySelector('textarea');
    textarea.focus();

    // Handle cancel
    replyDiv.querySelector('.cancel-reply').addEventListener('click', () => {
      replyDiv.remove();
    });

    // Handle submit
    replyDiv.querySelector('.submit-reply').addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) return;

      try {
        // For now, just show a message
        this.showNotification("Reply feature coming soon!", "info");
        replyDiv.remove();
      } catch (error) {
        console.error('Error adding reply:', error);
        this.showError('Failed to add reply');
      }
    });
  }

  async handleReaction(button) {
    console.log('handleReaction called with button:', button);
    const storyId = button.dataset.storyId;
    const reactionType = button.dataset.reaction;
    console.log('Story ID:', storyId, 'Reaction Type:', reactionType, 'Current User:', this.currentUser);
    
    if (!storyId || !reactionType || !this.currentUser) {
      console.log('Missing required data:', { storyId, reactionType, currentUser: this.currentUser });
      return;
    }

    const currentUserReaction = this.userReactions.get(storyId);
    const isCurrentReaction = currentUserReaction === reactionType;
    console.log('Current user reaction:', currentUserReaction, 'Is same reaction?', isCurrentReaction);
    
    try {
      const storyRef = doc(db, 'stories', storyId);
      
      if (isCurrentReaction) {
        console.log('Removing reaction');
        // Remove reaction
        await updateDoc(storyRef, {
          [`reactions.${reactionType}`]: increment(-1)
        });
        console.log('Firestore reaction decremented');
        
        // Remove from user reactions
        await this.removeUserReaction(storyId);
        this.userReactions.delete(storyId);
        
      } else {
        console.log('Adding/changing reaction');
        // Add new reaction (remove old one if it exists)
        const updateData = {
          [`reactions.${reactionType}`]: increment(1)
        };
        
        // If user had a different reaction, decrement that one
        if (currentUserReaction) {
          updateData[`reactions.${currentUserReaction}`] = increment(-1);
        }
        
        await updateDoc(storyRef, updateData);
        console.log('Firestore reaction updated:', updateData);
        
        // Update user reactions
        await this.addUserReaction(storyId, reactionType);
        this.userReactions.set(storyId, reactionType);
        
        // Add reaction animation
        this.createReactionAnimation(button, reactionType);
      }

      // Hide reaction options after selection with animation
      const container = button.closest(".reactions-container");
      const options = container.querySelector(".reaction-options");
      const expandIcon = container.querySelector(".expand-icon");
      
      options.classList.remove('show');
      options.classList.add('hide');
      expandIcon.textContent = "+";
      
      setTimeout(() => {
        options.style.display = "none";
        options.classList.remove('hide');
      }, 200);
      
      // Update the main reaction button
      this.updateMainReactionButton(storyId);

    } catch (error) {
      console.error('Error updating reaction:', error);
      console.error('Error details:', error.message, error.code);
      // Revert UI changes by refreshing the story element
      this.refreshStoryElement(storyId);
    }
  }

  async addUserReaction(storyId, reactionType) {
    console.log('Adding user reaction:', storyId, reactionType);
    try {
      const userReactionsRef = doc(db, 'userReactions', this.currentUser.uid);
      const userDoc = await getDoc(userReactionsRef);
      
      const reactions = userDoc.exists() ? (userDoc.data().storyReactions || {}) : {};
      reactions[storyId] = reactionType;
      console.log('Updated reactions object:', reactions);
      
      if (userDoc.exists()) {
        await updateDoc(userReactionsRef, { storyReactions: reactions });
        console.log('Updated existing user reactions document');
      } else {
        await setDoc(userReactionsRef, { storyReactions: reactions });
        console.log('Created new user reactions document');
      }
    } catch (error) {
      console.error('Error adding user reaction:', error);
    }
  }

  async removeUserReaction(storyId) {
    console.log('Removing user reaction for story:', storyId);
    try {
      const userReactionsRef = doc(db, 'userReactions', this.currentUser.uid);
      const userDoc = await getDoc(userReactionsRef);
      
      if (userDoc.exists()) {
        const reactions = userDoc.data().storyReactions || {};
        delete reactions[storyId];
        console.log('Updated reactions after removal:', reactions);
        await updateDoc(userReactionsRef, { storyReactions: reactions });
        console.log('User reaction removed successfully');
      } else {
        console.log('No user reactions document exists');
      }
    } catch (error) {
      console.error('Error removing user reaction:', error);
    }
  }

  async loadUserReactions() {
    console.log('Loading user reactions for user:', this.currentUser?.uid);
    if (!this.currentUser) {
      console.log('No current user, skipping reaction load');
      return;
    }

    try {
      const userReactionsRef = doc(db, 'userReactions', this.currentUser.uid);
      console.log('Setting up user reactions listener...');
      
      onSnapshot(userReactionsRef, (doc) => {
        console.log('User reactions snapshot received, exists:', doc.exists());
        if (doc.exists()) {
          const data = doc.data();
          console.log('User reactions data:', data);
          const reactions = data.storyReactions || {};
          console.log('Story reactions:', reactions);
          this.userReactions = new Map(Object.entries(reactions));
        } else {
          console.log('No user reactions document, creating empty map');
          this.userReactions = new Map();
        }
        
        console.log('User reactions map:', this.userReactions);
        // Update all main reaction buttons
        this.updateAllMainReactionButtons();
      });
    } catch (error) {
      console.error('Error loading user reactions:', error);
    }
  }

  createReactionAnimation(button, reactionType) {
    const emoji = button.querySelector('.reaction-icon').textContent;
    const animation = document.createElement('div');
    animation.className = 'reaction-animation';
    animation.textContent = emoji;
    animation.style.cssText = `
      position: absolute;
      z-index: 1000;
      font-size: 1.5rem;
      pointer-events: none;
      animation: reactionPop 0.6s ease-out forwards;
    `;
    
    const rect = button.getBoundingClientRect();
    animation.style.left = rect.left + rect.width / 2 + 'px';
    animation.style.top = rect.top + 'px';
    
    document.body.appendChild(animation);
    
    setTimeout(() => {
      animation.remove();
    }, 600);
  }

  async handleViewComments(button) {
    const storyId = button.dataset.storyId;
    if (!storyId) return;

    const commentsSection = document.getElementById(`comments-${storyId}`);
    if (!commentsSection) return;

    // Toggle comments visibility
    if (commentsSection.style.display === 'none') {
      commentsSection.style.display = 'block';
      button.classList.add('active');
      button.title = 'Hide Comments';
      
      // Load comments if not already loaded
      if (!commentsSection.dataset.loaded) {
        await this.loadAndDisplayComments(storyId);
        commentsSection.dataset.loaded = 'true';
      }
    } else {
      commentsSection.style.display = 'none';
      button.classList.remove('active');
      button.title = 'View Comments';
    }
  }

  handleCloseComments(button) {
    const commentsSection = button.closest('.comments-section');
    const storyId = commentsSection.id.replace('comments-', '');
    
    commentsSection.style.display = 'none';
    
    // Update the view comments button state
    const storyCard = commentsSection.closest('.story-card');
    const viewCommentsBtn = storyCard.querySelector('.view-comments-btn');
    if (viewCommentsBtn) {
      viewCommentsBtn.classList.remove('active');
      viewCommentsBtn.title = 'View Comments';
    }
  }

  async loadAndDisplayComments(storyId) {
    try {
      const commentsSection = document.getElementById(`comments-${storyId}`);
      const commentsList = commentsSection.querySelector('.comments-list');
      
      // Show loading state
      commentsList.innerHTML = '<div class="comments-loading">Loading comments...</div>';
      
      // Load comments from Firestore
      const comments = await this.loadComments(storyId);
      
      // Clear loading state
      commentsList.innerHTML = '';
      
      if (comments.length === 0) {
        commentsList.innerHTML = '<div class="comments-empty">No comments yet. Be the first to comment!</div>';
      } else {
        this.displayComments(comments, commentsList, null);
      }
      
      // Set up real-time listener for new comments
      this.setupCommentsListener(storyId, commentsList);
      
    } catch (error) {
      console.error('Error loading comments:', error);
      const commentsList = document.getElementById(`comments-${storyId}`).querySelector('.comments-list');
      commentsList.innerHTML = '<div class="comments-error">Failed to load comments. Please try again.</div>';
    }
  }

  setupCommentsListener(storyId, commentsList) {
    const commentsCol = collection(db, 'stories', storyId, 'comments');
    const q = firestoreQuery(commentsCol, firestoreOrderBy('timestamp', 'asc'));
    
    onSnapshot(q, (snapshot) => {
      const comments = [];
      snapshot.forEach((doc) => {
        comments.push({ id: doc.id, ...doc.data() });
      });
      
      // Clear and redisplay all comments
      commentsList.innerHTML = '';
      if (comments.length === 0) {
        commentsList.innerHTML = '<div class="comments-empty">No comments yet. Be the first to comment!</div>';
      } else {
        this.displayComments(comments, commentsList, null);
      }
    });
  }

  refreshStoryElement(storyId) {
    // Find the story in our data and refresh its display
    const story = this.stories.find(s => s.id === storyId);
    if (story) {
      const storyCard = document.querySelector(`[data-story-id="${storyId}"]`);
      if (storyCard) {
        const newElement = this.createStoryElement(story);
        storyCard.replaceWith(newElement);
      }
    }
  }

  toggleReactionOptions(button) {
    const container = button.closest(".reactions-container");
    const options = container.querySelector(".reaction-options");
    const expandIcon = button.querySelector(".expand-icon");
    
    // Close all other reaction options first
    document.querySelectorAll(".reaction-options").forEach(otherOptions => {
      if (otherOptions !== options && otherOptions.classList.contains('show')) {
        otherOptions.classList.remove('show');
        otherOptions.classList.add('hide');
        setTimeout(() => {
          otherOptions.style.display = "none";
          otherOptions.classList.remove('hide');
        }, 200);
        
        const otherExpandIcon = otherOptions.parentElement.querySelector(".expand-icon");
        if (otherExpandIcon) otherExpandIcon.textContent = "+";
      }
    });
    
    // Toggle current options
    if (!options.classList.contains('show')) {
      options.style.display = "flex";
      options.classList.add('show');
      expandIcon.textContent = "×";
    } else {
      options.classList.remove('show');
      options.classList.add('hide');
      expandIcon.textContent = "+";
      setTimeout(() => {
        options.style.display = "none";
        options.classList.remove('hide');
      }, 200);
    }
  }

  getReactionEmoji(reactionType) {
    const emojis = {
      like: '❤️',
      love: '🥰',
      wow: '😮',
      sad: '😢',
      hug: '🤗'
    };
    return emojis[reactionType] || '❤️';
  }

  getTotalReactions(reactions) {
    if (!reactions) return 0;
    return Object.values(reactions).reduce((total, count) => total + (count || 0), 0);
  }

  updateMainReactionButton(storyId) {
    console.log('Updating main reaction button for story:', storyId);
    const container = document.querySelector(`[data-story-id="${storyId}"].reactions-container`);
    if (!container) {
      console.log('Container not found for story:', storyId);
      return;
    }
    
    const mainBtn = container.querySelector(".main-reaction-btn");
    const iconSpan = mainBtn.querySelector(".main-reaction-icon");
    const countSpan = mainBtn.querySelector(".total-reactions");
    
    const userReaction = this.userReactions.get(storyId);
    const story = this.stories.find(s => s.id === storyId);
    
    console.log('User reaction:', userReaction, 'Story data:', story?.reactions);
    
    if (userReaction) {
      iconSpan.textContent = this.getReactionEmoji(userReaction);
      mainBtn.classList.add('active');
    } else {
      iconSpan.textContent = '❤️';
      mainBtn.classList.remove('active');
    }
    
    if (story) {
      const totalReactions = this.getTotalReactions(story.reactions);
      console.log('Setting total reactions to:', totalReactions);
      countSpan.textContent = totalReactions;
      
      // Also update individual reaction counts in the options
      const options = container.querySelector('.reaction-options');
      if (options) {
        const reactionButtons = options.querySelectorAll('.reaction-option-btn');
        reactionButtons.forEach(btn => {
          const reactionType = btn.dataset.reaction;
          const countEl = btn.querySelector('.reaction-count');
          if (countEl && story.reactions) {
            countEl.textContent = story.reactions[reactionType] || 0;
          }
        });
      }
    }
  }

  updateAllMainReactionButtons() {
    this.stories.forEach(story => {
      this.updateMainReactionButton(story.id);
    });
  }

  getTotalReactions(reactions) {
    if (!reactions) return 0;
    return Object.values(reactions).reduce((sum, count) => sum + (count || 0), 0);
  }
}

// Add animation CSS
const style = document.createElement("style");
style.textContent = `
    @keyframes heartFloat {
        0% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        100% {
            opacity: 0;
            transform: translateY(-50px) scale(1.5);
        }
    }
    
    @keyframes reactionPop {
        0% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        50% {
            transform: translateY(-20px) scale(1.3);
        }
        100% {
            opacity: 0;
            transform: translateY(-40px) scale(0.8);
        }
    }
`;
document.head.appendChild(style);

// Initialize stories app
document.addEventListener("DOMContentLoaded", () => {
  new StoriesApp();
});
