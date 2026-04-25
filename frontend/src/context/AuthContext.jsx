import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../config/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    // Consume redirect result if we just returned from a redirect
    getRedirectResult(auth).catch(err => {
      console.error("Firebase Redirect Auth Error:", err)
    })

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser)
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid))
          setUserProfile(snap.exists() ? snap.data() : null)
        } catch {
          setUserProfile(null)
        }
      } else {
        setUserProfile(null)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const signInWithGoogle = async () => {
    try {
      // Primary method: Popup (works seamlessly on desktop)
      const result = await signInWithPopup(auth, googleProvider)
      const fbUser = result.user
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid))
        if (snap.exists()) {
          setUserProfile(snap.data())
          return { needsProfile: false }
        }
      } catch {}
      return { needsProfile: true }
    } catch (err) {
      // If popup is blocked or fails due to mobile restrictions, fallback to redirect
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        // Sometimes Safari drops cross-site cookies, so we redirect
        err.code === 'auth/network-request-failed' ||
        err.code === 'auth/internal-error'
      ) {
        await signInWithRedirect(auth, googleProvider)
        return { needsProfile: false }
      }
      throw err
    }
  }

  const signOut = () => firebaseSignOut(auth)

  const saveProfile = async (name, phone) => {
    if (!user) return
    const profile = {
      uid: user.uid,
      name,
      phone,
      email: user.email,
      googleDisplayName: user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: new Date().toISOString(),
    }
    await setDoc(doc(db, 'users', user.uid), profile)
    setUserProfile(profile)
  }

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      authLoading,
      needsProfileSetup: !!user && !userProfile,
      signInWithGoogle,
      signOut,
      saveProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
