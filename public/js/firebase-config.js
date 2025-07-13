// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query as firestoreQuery,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  where,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
import {
  getDatabase,
  ref,
  push,
  onValue,
  serverTimestamp as rtdbServerTimestamp,
  query as rtdbQuery,
  orderByChild,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyC38AD0tCNl7k5gtW7JsUAD7m00FCKuQfs",
  authDomain: "justletitout-d4f47.firebaseapp.com",
  databaseURL: "https://justletitout-d4f47-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "justletitout-d4f47",
  storageBucket: "justletitout-d4f47.firebasestorage.app",
  messagingSenderId: "551225449276",
  appId: "1:551225449276:web:5487e25f8504ba8bd69c39",
  measurementId: "G-0FGR52MSR4",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const rtdb = getDatabase(app)
export const storage = getStorage(app)

// Export app instance
export { app }

// Firebase service functions
export {
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
  collection,
  addDoc,
  onSnapshot,
  firestoreQuery,
  firestoreOrderBy,
  firestoreLimit,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  where,
  increment,
  ref,
  push,
  onValue,
  rtdbServerTimestamp,
  rtdbQuery,
  orderByChild,
  limitToLast,
  storageRef,
  uploadBytes,
  getDownloadURL,
}

// Authentication state management
let currentUser = null

export const initializeAuth = () => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user
        console.log("User signed in anonymously:", user.uid)
        resolve(user)
      } else {
        // Sign in anonymously if no user
        signInAnonymously(auth)
          .then((result) => {
            currentUser = result.user
            console.log("Anonymous sign-in successful:", result.user.uid)
            resolve(result.user)
          })
          .catch((error) => {
            console.error("Anonymous sign-in failed:", error)
            reject(error)
          })
      }
    })
  })
}

export const getCurrentUser = () => currentUser

// Utility functions for data operations
export const createAnonymousPost = async (content, type = "story") => {
  try {
    const user = getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const postData = {
      content: content.trim(),
      type: type,
      userId: user.uid,
      timestamp: serverTimestamp(),
      likes: 0,
      replies: 0,
      isAnonymous: true,
    }

    const docRef = await addDoc(collection(db, "posts"), postData)
    console.log("Post created with ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating post:", error)
    throw error
  }
}

export const createChatRoom = async (roomName, description = "") => {
  try {
    const user = getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const roomData = {
      name: roomName.trim(),
      description: description.trim(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      isActive: true,
      participantCount: 0,
      lastActivity: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, "chatRooms"), roomData)
    console.log("Chat room created with ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating chat room:", error)
    throw error
  }
}

export const sendChatMessage = async (roomId, message) => {
  try {
    const user = getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const messageData = {
      text: message.trim(),
      userId: user.uid,
      timestamp: rtdbServerTimestamp(),
      isAnonymous: true,
    }

    const messagesRef = ref(rtdb, `chatRooms/${roomId}/messages`)
    await push(messagesRef, messageData)

    console.log("Message sent to room:", roomId)
    return true
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

export const listenToChatMessages = (roomId, callback) => {
  const messagesRef = ref(rtdb, `chatRooms/${roomId}/messages`)
  const messagesQuery = rtdbQuery(messagesRef, orderByChild("timestamp"), limitToLast(50))

  return onValue(messagesQuery, (snapshot) => {
    const messages = []
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key,
        ...childSnapshot.val(),
      })
    })
    callback(messages)
  })
}

export const getRecentPosts = (callback, postLimit = 20) => {
  const postsQuery = firestoreQuery(collection(db, "posts"), firestoreOrderBy("timestamp", "desc"), firestoreLimit(postLimit))

  return onSnapshot(postsQuery, (snapshot) => {
    const posts = []
    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    callback(posts)
  })
}

// Mental health resources data
export const mentalHealthResources = {
  emergencyContacts: [
    {
      name: "National Suicide Prevention Lifeline",
      phone: "988",
      description: "24/7 crisis support",
    },
    {
      name: "Crisis Text Line",
      phone: "Text HOME to 741741",
      description: "24/7 text-based crisis support",
    },
    {
      name: "SAMHSA National Helpline",
      phone: "1-800-662-4357",
      description: "Treatment referral and information service",
    },
  ],
  resources: [
    {
      title: "Breathing Exercises",
      description: "Simple techniques to manage anxiety and stress",
      type: "technique",
    },
    {
      title: "Mindfulness Meditation",
      description: "Guided practices for mental wellness",
      type: "technique",
    },
    {
      title: "Professional Help Finder",
      description: "Find mental health professionals in your area",
      type: "resource",
    },
  ],
}

// Room Request Management Functions
export const createRoomRequest = async (requestData) => {
  try {
    const user = getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    // Check for duplicate requests from same user
    const userRequestsQuery = firestoreQuery(
      collection(db, "room_requests"),
      where("createdBy", "==", user.uid),
      where("status", "==", "pending")
    );
    
    const existingRequests = await getDocs(userRequestsQuery);
    if (!existingRequests.empty) {
      throw new Error("You already have a pending room request. Please wait for approval.");
    }

    const roomRequestData = {
      ...requestData,
      createdBy: user.uid,
      status: "pending",
      createdAt: serverTimestamp(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: ""
    }

    const docRef = await addDoc(collection(db, "room_requests"), roomRequestData)
    console.log("Room request created with ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating room request:", error)
    throw error
  }
}

export const getRoomRequests = async (status = null) => {
  try {
    let q = collection(db, "room_requests");
    
    if (status) {
      q = firestoreQuery(q, where("status", "==", status));
    }
    
    q = firestoreQuery(q, firestoreOrderBy("createdAt", "desc"));
    
    const snapshot = await getDocs(q);
    const requests = [];
    
    snapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return requests;
  } catch (error) {
    console.error("Error getting room requests:", error);
    throw error;
  }
}

export const listenToRoomRequests = (callback) => {
  const q = firestoreQuery(
    collection(db, "room_requests"),
    firestoreOrderBy("createdAt", "desc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(requests);
  });
}

export const approveRoomRequest = async (requestId, adminNotes = "") => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    // Get the request data
    const requestRef = doc(db, "room_requests", requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error("Room request not found");
    }
    
    const requestData = requestSnap.data();
    
    // Create the actual room in the rooms collection
    const roomData = {
      name: requestData.name,
      theme: requestData.theme,
      description: requestData.description,
      tags: requestData.tags || [],
      createdBy: requestData.createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
      participantCount: 0,
      lastActivity: serverTimestamp(),
      maxParticipants: 50, // Default limit
      isPrivate: false
    };
    
    const roomRef = await addDoc(collection(db, "rooms"), roomData);
    
    // Update the request status
    await updateDoc(requestRef, {
      status: "approved",
      reviewedBy: user.uid,
      reviewedAt: serverTimestamp(),
      reviewNotes: adminNotes,
      approvedRoomId: roomRef.id
    });
    
    console.log("Room request approved, room created with ID:", roomRef.id);
    return roomRef.id;
  } catch (error) {
    console.error("Error approving room request:", error);
    throw error;
  }
}

export const rejectRoomRequest = async (requestId, adminNotes = "") => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const requestRef = doc(db, "room_requests", requestId);
    
    await updateDoc(requestRef, {
      status: "rejected",
      reviewedBy: user.uid,
      reviewedAt: serverTimestamp(),
      reviewNotes: adminNotes
    });
    
    console.log("Room request rejected:", requestId);
    return true;
  } catch (error) {
    console.error("Error rejecting room request:", error);
    throw error;
  }
}

export const getActiveRooms = async () => {
  try {
    console.log("Fetching active rooms from Firestore...");
    
    const q = firestoreQuery(
      collection(db, "rooms"),
      where("isActive", "==", true),
      firestoreOrderBy("lastActivity", "desc")
    );
    
    const snapshot = await getDocs(q);
    const rooms = [];
    
    console.log(`Found ${snapshot.size} rooms in Firestore`);
    
    snapshot.forEach((doc) => {
      const roomData = {
        id: doc.id,
        ...doc.data()
      };
      console.log("Room data:", roomData);
      rooms.push(roomData);
    });
    
    console.log("Returning rooms:", rooms);
    return rooms;
  } catch (error) {
    console.error("Error getting active rooms:", error);
    throw error;
  }
}

// Chat room functions
export const joinRoom = async (roomId) => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      throw new Error("Room not found");
    }
    
    // Update participant count and last activity
    await updateDoc(roomRef, {
      participantCount: increment(1),
      lastActivity: serverTimestamp()
    });
    
    return roomSnap.data();
  } catch (error) {
    console.error("Error joining room:", error);
    throw error;
  }
}

export const leaveRoom = async (roomId) => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const roomRef = doc(db, "rooms", roomId);
    
    await updateDoc(roomRef, {
      participantCount: increment(-1),
      lastActivity: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error("Error leaving room:", error);
    throw error;
  }
}

export const sendRoomMessage = async (roomId, message, tempUsername) => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const messageData = {
      text: message.trim(),
      userId: user.uid,
      tempUsername: tempUsername || "Anonymous",
      timestamp: rtdbServerTimestamp(),
      isAnonymous: true
    };

    const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
    const newMessageRef = push(messagesRef, messageData);
    
    // Update room's last activity
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
      lastActivity: serverTimestamp()
    });

    console.log("Message sent to room:", roomId);
    return newMessageRef.key;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

export const listenToRoomMessages = (roomId, callback) => {
  const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
  // Use Realtime Database query syntax
  const messagesQuery = rtdbQuery(messagesRef, orderByChild("timestamp"), limitToLast(100));

  return onValue(messagesQuery, (snapshot) => {
    const messages = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    callback(messages);
  });
}

// Generate temporary username for anonymity
export const generateTempUsername = () => {
  const adjectives = [
    "Kind", "Gentle", "Brave", "Wise", "Calm", "Strong", "Bright", "Cool",
    "Swift", "Bold", "Clear", "Free", "Pure", "True", "Wild", "Soft"
  ];
  
  const animals = [
    "Butterfly", "Dolphin", "Eagle", "Fox", "Dove", "Lion", "Owl", "Wolf",
    "Deer", "Tiger", "Bear", "Cat", "Bird", "Fish", "Whale", "Turtle"
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 100);
  
  return `${adjective}${animal}${number}`;
}

// Utility function to format Firebase timestamps
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    let date;
    if (timestamp.seconds) {
      // Firestore timestamp
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      // Realtime Database timestamp
      date = new Date(timestamp);
    }
    
    return date.toLocaleString();
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return '';
  }
}
