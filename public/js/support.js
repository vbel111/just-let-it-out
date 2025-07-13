// Support functionality
import { initializeAuth } from "./firebase-config.js"

class SupportApp {
  constructor() {
    this.currentUser = null
    this.breathingTimer = null
    this.breathingStep = 0
    this.breathingCycle = 0
    this.init()
  }

  async init() {
    try {
      this.currentUser = await initializeAuth()
      this.setupEventListeners()
    } catch (error) {
      console.error("Support app initialization failed:", error)
    }
  }

  setupEventListeners() {
    // Resource buttons
    document.querySelectorAll(".resource-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        const resource = e.target.dataset.resource
        this.handleResourceClick(resource)
      })
    })

    // Breathing exercise modal
    const breathingModal = document.getElementById("breathingModal")
    const closeBreathing = document.getElementById("closeBreathing")
    const startBreathing = document.getElementById("startBreathing")

    closeBreathing.addEventListener("click", () => {
      this.closeBreathingExercise()
    })

    startBreathing.addEventListener("click", () => {
      this.startBreathingExercise()
    })

    // Close modal on outside click
    breathingModal.addEventListener("click", (e) => {
      if (e.target === breathingModal) {
        this.closeBreathingExercise()
      }
    })
  }

  handleResourceClick(resource) {
    switch (resource) {
      case "breathing":
        this.openBreathingExercise()
        break
      case "meditation":
        this.showComingSoon("Guided Meditation")
        break
      case "finder":
        this.showComingSoon("Professional Help Finder")
        break
      case "groups":
        this.showComingSoon("Support Groups")
        break
      default:
        console.log("Unknown resource:", resource)
    }
  }

  openBreathingExercise() {
    const modal = document.getElementById("breathingModal")
    modal.classList.add("active")
    this.resetBreathingExercise()
  }

  closeBreathingExercise() {
    const modal = document.getElementById("breathingModal")
    modal.classList.remove("active")
    this.stopBreathingExercise()
  }

  resetBreathingExercise() {
    const circle = document.getElementById("breathingCircle")
    const text = document.getElementById("breathingText")
    const button = document.getElementById("startBreathing")

    circle.className = "breathing-circle"
    text.textContent = "Get Ready"
    button.textContent = "Start Exercise"
    button.disabled = false

    this.breathingStep = 0
    this.breathingCycle = 0
  }

  startBreathingExercise() {
    const button = document.getElementById("startBreathing")
    button.textContent = "Stop Exercise"
    button.onclick = () => this.stopBreathingExercise()

    this.breathingStep = 0
    this.breathingCycle = 0
    this.runBreathingCycle()
  }

  stopBreathingExercise() {
    if (this.breathingTimer) {
      clearTimeout(this.breathingTimer)
      this.breathingTimer = null
    }
    this.resetBreathingExercise()
  }

  runBreathingCycle() {
    const circle = document.getElementById("breathingCircle")
    const text = document.getElementById("breathingText")

    const phases = [
      { name: "inhale", duration: 4000, text: "Inhale", class: "inhale" },
      { name: "hold", duration: 7000, text: "Hold", class: "hold" },
      { name: "exhale", duration: 8000, text: "Exhale", class: "exhale" },
      { name: "pause", duration: 1000, text: "Pause", class: "" },
    ]

    const currentPhase = phases[this.breathingStep]

    // Update UI
    circle.className = `breathing-circle ${currentPhase.class}`
    text.textContent = currentPhase.text

    // Set timer for next phase
    this.breathingTimer = setTimeout(() => {
      this.breathingStep = (this.breathingStep + 1) % phases.length

      if (this.breathingStep === 0) {
        this.breathingCycle++
        if (this.breathingCycle >= 4) {
          // Complete after 4 cycles
          this.completeBreathingExercise()
          return
        }
      }

      this.runBreathingCycle()
    }, currentPhase.duration)
  }

  completeBreathingExercise() {
    const circle = document.getElementById("breathingCircle")
    const text = document.getElementById("breathingText")
    const button = document.getElementById("startBreathing")

    circle.className = "breathing-circle"
    text.textContent = "Complete!"
    button.textContent = "Start Again"
    button.onclick = () => this.startBreathingExercise()

    this.showSuccess("Great job! You completed the breathing exercise.")
  }

  showComingSoon(feature) {
    this.showNotification(`${feature} feature coming soon!`, "info")
  }

  showSuccess(message) {
    this.showNotification(message, "success")
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.textContent = message

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

    const colors = {
      error: "#EF4444",
      success: "#10B981",
      info: "#3B82F6",
      warning: "#F59E0B",
    }
    notification.style.background = colors[type] || colors.info

    document.body.appendChild(notification)

    requestAnimationFrame(() => {
      notification.style.opacity = "1"
    })

    setTimeout(() => {
      notification.style.opacity = "0"
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }
}

// Initialize support app
document.addEventListener("DOMContentLoaded", () => {
  new SupportApp()
})
