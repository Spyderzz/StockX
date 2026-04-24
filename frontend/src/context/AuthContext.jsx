import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
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
