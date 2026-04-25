import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProfileSetup({ onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const n = name.trim()
    const p = phone.trim()
    if (!n) { setError('Please enter your name.'); return }
    if (!/^[6-9]\d{9}$/.test(p)) { setError('Enter a valid 10-digit Indian mobile number.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(n, p)
    } catch {
      setError('Could not save profile. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(5,6,8,0.92)', backdropFilter: 'blur(24px)' }}>
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 border border-white/10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald/10 border border-emerald/25 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-[22px] font-semibold text-white tracking-tight mb-1">One last step</h2>
            <p className="text-[13px] text-soft">Tell us a bit about yourself to complete setup.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ritish Jaiswal"
                maxLength={60}
                className="w-full bg-white/5 border border-line rounded-xl px-4 py-3 text-white text-[14px] placeholder:text-muted focus:border-emerald/50 focus:bg-white/8 transition outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">Phone Number</label>
              <div className="flex items-center gap-2">
                <span className="text-soft text-[14px] px-3 py-3 bg-white/5 border border-line rounded-xl font-mono">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="flex-1 bg-white/5 border border-line rounded-xl px-4 py-3 text-white text-[14px] placeholder:text-muted focus:border-emerald/50 transition outline-none font-mono"
                />
              </div>
            </div>

            {error && (
              <p className="text-danger text-[12px] font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-3.5 rounded-xl bg-emerald text-ink font-semibold text-[14px] hover:bg-emerald/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Complete Setup →'}
            </button>
          </form>

          <p className="text-[11px] text-muted text-center mt-5 leading-relaxed">
            Your phone number is stored securely and never shared with third parties.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { user, userProfile, authLoading, signInWithGoogle, saveProfile } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user && userProfile) {
      navigate('/analyse', { replace: true })
    }
    if (!authLoading && user && !userProfile) {
      setShowProfileSetup(true)
    }
  }, [user, userProfile, authLoading, navigate])

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    setError('')
    try {
      const { needsProfile } = await signInWithGoogle()
      if (needsProfile) {
        setShowProfileSetup(true)
      } else {
        navigate('/analyse', { replace: true })
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setSigningIn(false)
    }
  }

  const handleProfileSave = async (name, phone) => {
    await saveProfile(name, phone)
    navigate('/analyse', { replace: true })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050608' }}>
        <div className="w-7 h-7 rounded-full border-2 border-emerald border-t-transparent spinner" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: '#050608', color: '#E5E7EB', fontFamily: "'Inter Tight', sans-serif" }}>
      <div className="noise-overlay" />

      {/* Grid bg */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* Ambient glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />

      {/* Profile setup modal */}
      {showProfileSetup && <ProfileSetup onSave={handleProfileSave} />}

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-40 border-b border-white/5" style={{ background: 'rgba(5,6,8,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-tight text-white">StockX</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
            </div>
          </a>
          <a href="/" className="text-[13px] text-soft hover:text-white transition">← Back to Home</a>
        </div>
      </nav>

      {/* MAIN */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-card/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">Decision Quality Engine</span>
            </div>
          </div>

          {/* Card */}
          <div className="glass rounded-3xl p-8 border border-white/8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-line flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-soft" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h1 className="text-[26px] font-semibold text-white tracking-tight mb-2">
                Get full access
              </h1>
              <p className="text-[14px] text-soft leading-relaxed max-w-xs mx-auto">
                Sign in to unlock unlimited stock analysis, real-time API data and more insights.
              </p>
            </div>

            {/* What you get */}
            <div className="space-y-2.5 mb-8">
              {[
                ['Unlimited stock queriesInstitutional-grade intelligence for retail traders.', 'emerald'],
                ['Live NSE data with over 5 analysislayers', 'emerald'],
                ['Detect risk, traps, and weak setups in seconds.', 'emerald'],
                ['No noise. No tips. Just decision clarity', 'emerald'],
              ].map(([text, color]) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald/15 border border-emerald/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-emerald" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[13px] text-soft">{text}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-line to-transparent mb-6" />

            {/* Google Sign-in */}
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl border border-line bg-white/5 hover:bg-white/10 hover:border-line2 transition-all text-white font-medium text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingIn ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-soft border-t-transparent spinner" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  {/* Google logo */}
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {error && (
              <p className="text-danger text-[12px] font-mono text-center mt-3">{error}</p>
            )}

            <p className="text-[11px] text-muted text-center mt-5 leading-relaxed">
              By continuing, you agree to our Terms of Service. No broker access or demat information is required.
            </p>
          </div>

          {/* SEBI note */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">SEBI-Compliant · No Investment Advice · No Broker Access</span>
          </div>
        </div>
      </div>
    </div>
  )
}
