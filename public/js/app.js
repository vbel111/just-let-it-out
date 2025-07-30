// Main Application Logic
import { initializeAuth, createAnonymousPost } from "./firebase-config.js"

// Auto-unregister service workers in development (localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (window.location.hostname === 'localhost') {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister());
      });
    }
  });
}

class JustLetItOutApp {
  constructor() {
    this.currentUser = null
    this.isLoading = false
    this.init()
  }

  async init() {
    try {
      console.log("App initialization starting...")
      this.showLoading(true)
      
      // Setup event listeners first, before Firebase
      this.setupEventListeners()
      console.log("Event listeners set up")
      
      // Then initialize Firebase
      await this.initializeFirebase()
      console.log("Firebase initialized")
      
      this.setupServiceWorker()
      console.log("Service worker set up")
      
      this.showLoading(false)
      console.log("App initialization completed successfully")
    } catch (error) {
      console.error("App initialization failed:", error)
      this.showError("Failed to initialize app. Please refresh and try again.")
      this.showLoading(false)
      
      // Still setup event listeners even if Firebase fails
      this.setupEventListeners()
    }
  }

  async initializeFirebase() {
    try {
      this.currentUser = await initializeAuth()
      console.log("Firebase initialized successfully")
    } catch (error) {
      console.error("Firebase initialization failed:", error)
      throw error
    }
  }

  setupEventListeners() {
    console.log("Setting up event listeners...")
    
    // Feature card navigation
    const featureCards = document.querySelectorAll(".feature-card")
    console.log("Found feature cards:", featureCards.length)
    
    featureCards.forEach((card, index) => {
      const feature = card.dataset.feature
      console.log(`Feature card ${index}:`, feature)
      
      card.addEventListener("click", (e) => {
        e.preventDefault()
        console.log("Feature card clicked:", feature)
        this.handleFeatureNavigation(feature, e)
      })
      
      // Add a simple test click handler
      card.style.cursor = "pointer"
    })

    // Bottom navigation
    const navItems = document.querySelectorAll(".nav-item")
    console.log("Found nav items:", navItems.length)
    
    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        const nav = e.currentTarget.dataset.nav
        console.log("Nav item clicked:", nav)
        this.handleBottomNavigation(nav, e)
      })
    })

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      this.handleKeyboardNavigation(e)
    })

    // Touch gestures for mobile
    this.setupTouchGestures()
  }

  setupTouchGestures() {
    let touchStartY = 0
    let touchEndY = 0

    document.addEventListener("touchstart", (e) => {
      touchStartY = e.changedTouches[0].screenY
    })

    document.addEventListener("touchend", (e) => {
      touchEndY = e.changedTouches[0].screenY
      this.handleSwipeGesture(touchStartY, touchEndY)
    })
  }

  handleSwipeGesture(startY, endY) {
    const swipeThreshold = 50
    const diff = startY - endY

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe up - could trigger quick post
        console.log("Swipe up detected")
      } else {
        // Swipe down - could refresh or go back
        console.log("Swipe down detected")
      }
    }
  }

  handleFeatureNavigation(feature, event) {
    console.log("Handling feature navigation:", feature)
    
    if (event) {
      this.addRippleEffect(event.currentTarget, event)
    }

    switch (feature) {
      case "create-room":
        console.log("Navigating to create room")
        this.navigateToCreateRoom()
        break
      case "pair-up":
        console.log("Navigating to pair up")
        this.navigateToPairUp()
        break
      case "stories":
        console.log("Navigating to stories")
        this.navigateToStories()
        break
      case "send-message":
        console.log("Navigating to send message")
        this.navigateToSendMessage()
        break
      case "support":
        console.log("Navigating to support")
        this.navigateToSupport()
        break
      default:
        console.log("Unknown feature:", feature)
    }
  }

  handleBottomNavigation(nav, event) {
    // Update active state
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active")
    })
    event.currentTarget.classList.add("active")

    switch (nav) {
      case "home":
        this.navigateToHome()
        break
      case "chat":
        this.navigateToChat()
        break
      default:
        console.log("Unknown navigation:", nav)
    }
  }

  handleKeyboardNavigation(e) {
    // Escape key to close modals
    if (e.key === "Escape") {
      this.closeAllModals()
    }

    // Quick post shortcut (Ctrl/Cmd + N)
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault()
      this.navigateToSendMessage()
    }
  }

  addRippleEffect(element, event) {
    const ripple = document.createElement("div")
    ripple.style.position = "absolute"
    ripple.style.borderRadius = "50%"
    ripple.style.background = "rgba(255, 255, 255, 0.3)"
    ripple.style.transform = "scale(0)"
    ripple.style.animation = "ripple 0.6s linear"
    ripple.style.pointerEvents = "none"

    const rect = element.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    ripple.style.width = ripple.style.height = size + "px"
    ripple.style.left = event.clientX - rect.left - size / 2 + "px"
    ripple.style.top = event.clientY - rect.top - size / 2 + "px"

    element.style.position = "relative"
    element.appendChild(ripple)

    setTimeout(() => {
      ripple.remove()
    }, 600)
  }

  // Navigation methods
  navigateToCreateRoom() {
    console.log("Navigating to Create Room")
    window.location.href = "create-room.html"
  }

  navigateToPairUp() {
    console.log("Navigating to Pair Chat")
    window.location.href = "pair.html"
  }

  navigateToStories() {
    console.log("Navigating to Stories")
    window.location.href = "stories.html"
  }

  navigateToSendMessage() {
    console.log("Navigating to Q&A")
    window.location.href = "qa.html"
  }

  navigateToSupport() {
    console.log("Navigating to Mental Health Support")
    window.location.href = "support.html"
  }

  navigateToHome() {
    console.log("Navigating to Home")
    window.location.href = "index.html"
  }

   navigateToChat() {
    console.log("Chat feature coming soon")
    this.showComingSoon("Chat")
  }

  // Modal methods
  closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.classList.remove("active")
    })
  }

  // Utility methods
  showLoading(show) {
    const overlay = document.getElementById("loadingOverlay")
    if (overlay) {
      if (show) {
        overlay.classList.add("active")
        this.isLoading = true
      } else {
        overlay.classList.remove("active")
        this.isLoading = false
      }
    } else {
      console.log("Loading overlay not found")
    }
  }

  showError(message) {
    this.showNotification(message, "error")
  }

  showSuccess(message) {
    this.showNotification(message, "success")
  }

  showComingSoon(feature) {
    this.showNotification(`${feature} feature coming soon!`, "info")
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.textContent = message

    // Style the notification
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
    })

    // Set background color based on type
    const colors = {
      error: "#EF4444",
      success: "#10B981",
      info: "#3B82F6",
      warning: "#F59E0B",
    }
    notification.style.background = colors[type] || colors.info

    // Add to DOM and animate
    document.body.appendChild(notification)

    requestAnimationFrame(() => {
      notification.style.opacity = "1"
      notification.style.transform = "translateX(-50%) translateY(0)"
    })

    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = "0"
      notification.style.transform = "translateX(-50%) translateY(-20px)"
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }

  setupServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration)
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error)
        })
    }
  }
}

// Add ripple animation CSS
const style = document.createElement("style")
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`
document.head.appendChild(style)

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new JustLetItOutApp()
})

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("App became visible")
    // Refresh data or reconnect if needed
  } else {
    console.log("App became hidden")
    // Pause non-critical operations
  }
})

// Handle online/offline status
window.addEventListener("online", () => {
  console.log("App is online")
  document.body.classList.remove("offline")
})

window.addEventListener("offline", () => {
  console.log("App is offline")
  document.body.classList.add("offline")
})
