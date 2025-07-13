// Create Room functionality
import { initializeAuth, createRoomRequest } from "./firebase-config.js";

class CreateRoomApp {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            this.currentUser = await initializeAuth();
            this.setupEventListeners();
            this.setupCharacterCounters();
        } catch (error) {
            console.error("Create room app initialization failed:", error);
            this.showError("Failed to initialize. Please refresh and try again.");
        }
    }

    setupEventListeners() {
        const form = document.getElementById("createRoomForm");
        const submitBtn = document.getElementById("submitBtn");

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Real-time validation
        const inputs = form.querySelectorAll("input, select, textarea");
        inputs.forEach(input => {
            input.addEventListener("input", () => {
                this.validateForm();
            });
        });
    }

    setupCharacterCounters() {
        // Room name counter
        const roomNameInput = document.getElementById("roomName");
        const roomNameCounter = document.getElementById("roomNameCounter");
        
        roomNameInput.addEventListener("input", () => {
            const count = roomNameInput.value.length;
            roomNameCounter.textContent = count;
            
            if (count > 45) {
                roomNameCounter.style.color = "#EF4444";
            } else if (count > 35) {
                roomNameCounter.style.color = "#F59E0B";
            } else {
                roomNameCounter.style.color = "#6B7280";
            }
        });

        // Room description counter
        const roomDescInput = document.getElementById("roomDescription");
        const roomDescCounter = document.getElementById("roomDescriptionCounter");
        
        roomDescInput.addEventListener("input", () => {
            const count = roomDescInput.value.length;
            roomDescCounter.textContent = count;
            
            if (count > 280) {
                roomDescCounter.style.color = "#EF4444";
            } else if (count > 250) {
                roomDescCounter.style.color = "#F59E0B";
            } else {
                roomDescCounter.style.color = "#6B7280";
            }
        });
    }

    validateForm() {
        const form = document.getElementById("createRoomForm");
        const submitBtn = document.getElementById("submitBtn");
        
        const roomName = document.getElementById("roomName").value.trim();
        const roomTheme = document.getElementById("roomTheme").value;
        const roomDescription = document.getElementById("roomDescription").value.trim();
        const agreeGuidelines = document.getElementById("agreeGuidelines").checked;
        const agreePrivacy = document.getElementById("agreePrivacy").checked;

        const isValid = roomName.length >= 3 && 
                       roomTheme && 
                       roomDescription.length >= 10 && 
                       agreeGuidelines && 
                       agreePrivacy;

        submitBtn.disabled = !isValid;
        
        return isValid;
    }

    async handleSubmit() {
        if (!this.validateForm()) {
            this.showError("Please fill in all required fields correctly.");
            return;
        }

        const submitBtn = document.getElementById("submitBtn");
        const btnText = submitBtn.querySelector(".btn-text");
        const loadingSpinner = submitBtn.querySelector(".loading-spinner");

        try {
            // Show loading state
            submitBtn.disabled = true;
            btnText.style.display = "none";
            loadingSpinner.style.display = "flex";

            // Get form data
            const formData = this.getFormData();
            
            // Validate content
            if (!this.validateContent(formData)) {
                throw new Error("Please check your input for inappropriate content.");
            }

            // Submit to Firebase
            await createRoomRequest(formData);

            // Show success
            this.showSuccess();

        } catch (error) {
            console.error("Room request submission failed:", error);
            this.showError(error.message || "Failed to submit room request. Please try again.");
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.style.display = "inline";
            loadingSpinner.style.display = "none";
        }
    }

    getFormData() {
        const roomName = document.getElementById("roomName").value.trim();
        const roomTheme = document.getElementById("roomTheme").value;
        const roomDescription = document.getElementById("roomDescription").value.trim();
        const roomTags = document.getElementById("roomTags").value.trim();

        // Process tags
        const tags = roomTags ? 
            roomTags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0) : 
            [];

        return {
            name: roomName,
            theme: roomTheme,
            description: roomDescription,
            tags: tags,
            createdBy: this.currentUser?.uid || "anonymous",
            status: "pending",
            createdAt: new Date()
        };
    }

    validateContent(formData) {
        // Basic profanity filter and content validation
        const inappropriateWords = [
            "spam", "scam", "inappropriate", "explicit", "hate", "violence",
            // Add more as needed - this is a basic filter
        ];

        const textToCheck = `${formData.name} ${formData.description} ${formData.tags.join(" ")}`.toLowerCase();
        
        for (const word of inappropriateWords) {
            if (textToCheck.includes(word)) {
                return false;
            }
        }

        // Check for minimum quality
        if (formData.name.length < 3 || formData.description.length < 10) {
            return false;
        }

        // Check for excessive caps
        const capsRatio = (formData.name.match(/[A-Z]/g) || []).length / formData.name.length;
        if (capsRatio > 0.7) {
            return false;
        }

        return true;
    }

    showSuccess() {
        const modal = document.getElementById("successModal");
        modal.classList.add("active");
        
        // Auto-redirect after 5 seconds
        setTimeout(() => {
            window.location.href = "chat.html";
        }, 5000);
    }

    showError(message) {
        const modal = document.getElementById("errorModal");
        const errorMessage = document.getElementById("errorMessage");
        errorMessage.textContent = message;
        modal.classList.add("active");
    }
}

// Global functions for modal control
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove("active");
};

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new CreateRoomApp();
});

// Prevent form submission on Enter in text inputs (except textarea)
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.type !== "submit") {
        e.preventDefault();
    }
});
