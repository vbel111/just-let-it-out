// Vercel Analytics Configuration
import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject();

// Custom analytics tracking for app events
class AppAnalytics {
  static track(event, properties = {}) {
    // Track custom events for better insights
    if (typeof gtag !== 'undefined') {
      gtag('event', event, properties);
    }
    
    // Also log to console in development
    if (window.location.hostname === 'localhost') {
      console.log('Analytics Event:', event, properties);
    }
  }

  // Track page views
  static trackPageView(pageName) {
    this.track('page_view', {
      page: pageName,
      timestamp: new Date().toISOString()
    });
  }

  // Track feature usage
  static trackFeatureUsage(feature) {
    this.track('feature_used', {
      feature: feature,
      timestamp: new Date().toISOString()
    });
  }

  // Track chat events
  static trackChatEvent(eventType, details = {}) {
    this.track('chat_event', {
      event_type: eventType,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  // Track story interactions
  static trackStoryInteraction(action, details = {}) {
    this.track('story_interaction', {
      action: action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  // Track Q&A events
  static trackQAEvent(action, details = {}) {
    this.track('qa_event', {
      action: action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  // Track user engagement
  static trackEngagement(type, duration = null) {
    this.track('user_engagement', {
      engagement_type: type,
      duration: duration,
      timestamp: new Date().toISOString()
    });
  }

  // Track errors for debugging
  static trackError(error, context = '') {
    this.track('error_occurred', {
      error_message: error.message || error,
      error_context: context,
      timestamp: new Date().toISOString()
    });
  }
}

// Export for use in other modules
window.AppAnalytics = AppAnalytics;

// Track initial page load
document.addEventListener('DOMContentLoaded', () => {
  const pageName = document.title || window.location.pathname;
  AppAnalytics.trackPageView(pageName);
});

// Track time spent on page
let pageStartTime = Date.now();
window.addEventListener('beforeunload', () => {
  const timeSpent = Math.round((Date.now() - pageStartTime) / 1000);
  AppAnalytics.trackEngagement('page_time', timeSpent);
});

// Track errors globally
window.addEventListener('error', (event) => {
  AppAnalytics.trackError(event.error, 'global_error');
});

// Track unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  AppAnalytics.trackError(event.reason, 'unhandled_promise');
});

export default AppAnalytics;
