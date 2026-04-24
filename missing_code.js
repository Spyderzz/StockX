// ─── Helpers ───
function formatPrice(p) {
  if (p == null) return '—'
  return '₹' + Number(p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function timeAgo(iso) {
  if (!iso) return ''
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return `${Math.round(diff / 86400)}d ago`
  } catch { return '' }
}

// ─── News Card ───
function NewsCard({ news }) {
  if (!news || news.length === 0) return null
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h6"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">Recent News</span>
        </div>
        <span className="font-mono text-[10px] text-muted">{news.length} articles</span>
      </div>
      <div className="divide-y divide-line/50">
        {news.map((article, i) => (
          <a
            key={i}
            href={article.url !== '#' ? article.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.03] transition group"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-md bg-white/5 border border-line flex items-center justify-center mt-0.5">
              <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] leading-snug mb-1.5 group-hover:text-soft transition line-clamp-2">{article.title}</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-emerald">{article.source}</span>
                <span className="font-mono text-[10px] text-muted">{timeAgo(article.publishedAt)}</span>
              </div>
            </div>
            {article.url && article.url !== '#' && (
              <svg className="w-3.5 h-3.5 text-muted flex-shrink-0 mt-1 group-hover:text-soft transition" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── FII/DII Card ───
function FiiDiiCard({ fiiDii }) {
  if (!fiiDii || fiiDii.length === 0) return null

  const fiiTotal = fiiDii.reduce((s, r) => s + (r.fii_net ?? 0), 0)
  const diiTotal = fiiDii.reduce((s, r) => s + (r.dii_net ?? 0), 0)

  const fmt = (n) => {
    const abs = Math.abs(n)
    const str = abs >= 1000 ? `₹${(abs / 1000).toFixed(1)}K Cr` : `₹${abs.toFixed(0)} Cr`
    return n >= 0 ? `+${str}` : `−${str}`
  }

  const barMax = Math.max(...fiiDii.flatMap(r => [Math.abs(r.fii_net ?? 0), Math.abs(r.dii_net ?? 0)]), 1)

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">FII / DII Activity · Market Context</span>
        </div>
        <span className="font-mono text-[10px] text-muted">Last {fiiDii.length} sessions</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 divide-x divide-line/50 border-b border-line/50">
        {[
          { label: 'FII Net (5d)', val: fiiTotal, tag: 'Foreign Institutional' },
          { label: 'DII Net (5d)', val: diiTotal, tag: 'Domestic Institutional' },
        ].map(({ label, val, tag }) => (
          <div key={label} className="px-5 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1">{label}</div>
            <div className={`text-[22px] font-semibold tracking-tight mb-0.5 ${val >= 0 ? 'text-emerald' : 'text-danger'}`}>
              {fmt(val)}
            </div>
            <div className="font-mono text-[10px] text-muted">{tag}</div>
          </div>
        ))}
      </div>

      {/* Per-day bars */}
      <div className="px-5 py-4 space-y-3">
        {fiiDii.map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted w-24 flex-shrink-0">{row.date}</span>
            <div className="flex-1 grid grid-cols-2 gap-2">
              {[
                { val: row.fii_net ?? 0, label: 'FII' },
                { val: row.dii_net ?? 0, label: 'DII' },
              ].map(({ val, label }) => {
                const pct = Math.round((Math.abs(val) / barMax) * 100)
                const isPos = val >= 0
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-muted w-6">{label}</span>
                    <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: isPos ? '#10B981' : '#EF4444' }}
                      />
                    </div>
                    <span className={`font-mono text-[10px] w-16 text-right ${isPos ? 'text-emerald' : 'text-danger'}`}>
                      {fmt(val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-3">
        <p className="font-mono text-[10px] text-muted/60">
          Market-wide institutional flows · Source: NSE India · Not stock-specific
        </p>
      </div>
    </div>
  )
}

// ─── Result Card ───
function ResultCard({ result, loading }) {
  const c = COLOR_MAP[result.color]
  const displayedScore = useCountUp(result.score, !loading)
  const isGood = result.color === 'emerald'
  const icon = isGood
    ? <CheckIcon className={`w-6 h-6 ${c.text}`} />
    : <AlertIcon className={`w-6 h-6 ${c.text}`} />

  return (
    <div id="result-card" className="glass rounded-2xl overflow-hidden">
      {/* Terminal bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald/70" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted ml-3">stockx.engine › terminal</span>
        </div>
        <div className="flex items-center gap-2">
          {loading
            ? <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Analysing…</span>
            : <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">{result.isLive ? 'Live · API' : 'Demo'}</span>
            </>
          }
        </div>
      </div>

      <div className="p-6 md:p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent spinner" />
            <p className="font-mono text-[12px] uppercase tracking-widest text-muted">Analysing stock…</p>
          </div>
        ) : (
          <>
            {/* Query */}
            <div className="flex items-start gap-3 mb-5">
              <span className="font-mono text-[11px] mt-1 text-muted select-none">Query ›</span>
              <p className="text-soft text-[15px] leading-relaxed">
                What's the risk profile for <span className="text-white font-medium">{result.queryLabel}</span> right now?
              </p>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-line to-transparent mb-6" />

            {/* Verdict row */}
            <div className="flex items-start md:items-center justify-between gap-6 flex-col md:flex-row mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: c.bgStyle, border: `1px solid ${c.borderStyle}` }}>
                  {icon}
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">StockX Verdict</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{result.emoji}</span>
                    <span className="text-[18px] md:text-[20px] font-semibold text-white">{result.verdict}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-medium text-white/90 mb-1.5 uppercase tracking-wide">{result.fullName || result.queryLabel}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">Quality Score</div>
                <div className="flex items-baseline gap-1 justify-end">
                  <span className={`text-[44px] font-semibold tracking-[-0.04em] leading-none ${c.text}`}>{displayedScore}</span>
                  <span className="text-muted font-mono text-sm">/100</span>
                </div>
              </div>
            </div>

            {/* Price + change chip */}
            {result.price != null && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-baseline gap-1.5 px-4 py-2 rounded-xl border border-line bg-white/[0.03]">
                  <span className="text-white font-semibold text-[20px] tracking-tight">{formatPrice(result.price)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">NSE</span>
                </div>
                {result.changePercent != null && (
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-semibold font-mono ${result.changePercent >= 0 ? 'border-emerald/30 bg-emerald/10 text-emerald' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={result.changePercent >= 0 ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                    {result.changePercent >= 0 ? '+' : ''}{result.changePercent.toFixed(2)}% today
                  </div>
                )}
                <span className="font-mono text-[10px] text-muted/50 uppercase tracking-widest">Market price</span>
              </div>
            )}

            {/* Score bar */}
            <div className="relative h-1 rounded-full bg-line mb-6 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.score}%`, background: c.barGrad }} />
            </div>

            {/* Explanation */}
            <div className="rounded-xl border border-line bg-white/[0.015] p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-emerald/10 border border-emerald/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 11a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald mb-2">StockX Analysis</div>
                  <p className="text-soft text-[14px] leading-relaxed">{result.explain}</p>
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {result.dims.map(d => <DimCard key={d.name} dim={d} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── FAQ item ───
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="faq-item border-t border-line">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-6 py-5 text-left"
      >
        <span className="text-[15px] text-white font-medium">{q}</span>
        <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-lg transition-all flex-shrink-0 ${open ? 'bg-emerald text-ink border-emerald' : 'border-line text-muted'}`}>
          {open ? '−' : '+'}
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <p className="text-[14px] text-soft leading-relaxed pb-5">{a}</p>
      </div>
    </div>
  )
}

// ─── Main Component ───
export default function AnalysePage() {
  const { user, userProfile, authLoading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [user, authLoading, navigate])

  
  const [inputVal, setInputVal] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchInputRef = useRef(null)
  const resultCardRef = useRef(null)
  const pageRef = useRef(null)
  useFadeUp(pageRef)

  const handleAnalyseClick = () => {
    if (user) navigate('/analyse')
    else navigate('/login')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const displayName = userProfile?.name || user?.displayName || null
  const photoURL = user?.photoURL || null

  const scrollToResult = useCallback(() => {
    setTimeout(() => {
      resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [])

  const runAnalysis = useCallback(async (ticker) => {
    const sym = ticker.trim().toUpperCase()
    if (!sym) return

    // Show mock immediately if available for instant feedback
    if (MOCK_DATA[sym]) {
      setResult(MOCK_DATA[sym])
      setError('')
    } else {
      setResult(null)
    }
    scrollToResult()

    // Then call the real API
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/analyse`, { symbol: sym }, { timeout: 30000 })
      setResult(transformApiResult(res.data))
      scrollToResult()
    } catch (err) {
      if (MOCK_DATA[sym]) {
        // Keep mock result, just show soft note
      } else {
        const apiError = err.response?.data?.detail;
        setError(apiError || `Could not analyse "${sym}". Make sure you entered a valid NSE ticker.`);
        setResult(null);
      }
    } finally {
      setLoading(false)
    }
  }, [scrollToResult])

  const handleSearch = useCallback(async (e) => {
    e.preventDefault()
    const sym = inputVal.trim().toUpperCase()
    if (!sym) return
    await runAnalysis(sym)
  }, [inputVal, runAnalysis])

  const handleTicker = useCallback((t) => {
    setInputVal(t)
    runAnalysis(t)
  }, [runAnalysis])

  
  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200)
  }

  const scrollToSearch = (e) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => searchInputRef.current?.focus(), 400)
  }

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-x-hidden" style={{ background: '#050608', color: '#E5E7EB', fontFamily: "'Inter Tight', sans-serif" }}>
      <div className="noise-overlay" />

      {/* NAV */}
      
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5" style={{ background: 'rgba(5,6,8,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <a href="/app" className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-tight text-white">StockX</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-soft">
              {userProfile?.display_name || user?.email}
            </span>
            <button 
              onClick={async () => { await signOut(); navigate('/login') }}
              className="text-[13px] text-soft hover:text-white transition px-3 py-1.5 rounded-full border border-line bg-white/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>


      {/* HERO */}
      <header className="relative pt-36 pb-28 px-6 lg:px-10">
        <div className="absolute inset-0 grid-bg" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-line bg-card/50 fade-up">
            <svg className="w-3 h-3 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-soft">AI Intelligence Layer · India's First Decision Quality Engine</span>
          </div>

          <h1 className="text-[44px] md:text-[68px] lg:text-[76px] font-semibold tracking-[-0.035em] leading-[1.02] text-white mb-6 fade-up">
            Decision Quality Engine<br />
            <span className="text-white">Active</span>
          </h1>

          <p className="max-w-2xl mx-auto text-[17px] md:text-[18px] text-soft leading-relaxed mb-12 fade-up">
            Enter any NSE stock ticker below to run a complete 5-layer ML analysis.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto fade-up">
            <div className="relative flex items-center glass rounded-2xl glow-emerald transition-all focus-within:ring-2 focus-within:ring-emerald/40">
              <svg className="w-5 h-5 text-muted ml-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={inputVal}
                onChange={e => { setInputVal(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={handleBlur}
                placeholder="Ask about any stock (e.g., RELIANCE, HDFC)..."
                autoComplete="off"
                maxLength={20}
                className="flex-1 bg-transparent text-white text-[16px] md:text-[17px] py-5 px-4 placeholder:text-muted font-mono"
              />
              <button
                type="submit"
                disabled={loading || !inputVal.trim()}
                className="mr-2 w-11 h-11 rounded-xl bg-emerald text-ink flex items-center justify-center hover:bg-emerald/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <div className="w-4 h-4 rounded-full border-2 border-ink border-t-transparent spinner" />
                  : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" /></svg>
                }
              </button>
            </div>
            {showSuggestions && inputVal && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1117] border border-line rounded-xl overflow-hidden z-50 shadow-2xl">
                {NSE_STOCKS.filter(s => s.startsWith(inputVal) && s !== inputVal).slice(0, 5).map(s => (
                  <div
                    key={s}
                    onClick={() => { setInputVal(s); setShowSuggestions(false); handleTicker(s); }}
                    className="px-5 py-3 hover:bg-white/[0.03] cursor-pointer font-mono text-[14px] text-white border-b border-line/50 last:border-0 flex items-center gap-3"
                  >
                    <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {s}
                  </div>
                ))}
              </div>
            )}
    

            {/* Preloaded suggestions */}
            <div className="flex items-center justify-center flex-wrap gap-2 mt-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mr-2">Try:</span>
              {['SUZLON', 'RELIANCE', 'TATASTEEL', 'HDFCBANK', 'INFY'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTicker(t)}
                  className="px-3 py-1 rounded-md border border-line bg-card/60 hover:bg-card hover:border-line2 font-mono text-[11px] text-soft transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </form>

          {error && (
            <div className="mt-5 max-w-xl mx-auto p-3 rounded-xl bg-danger/10 border border-danger/25 text-danger font-mono text-[12px]">
              {error}
            </div>
          )}

          </div>
      </header>

      {/* RESULT CARD */}
      <section className="relative px-6 lg:px-10 -mt-8 mb-28">
        <div ref={resultCardRef} className="max-w-4xl mx-auto space-y-4">
          {result && <ResultCard result={result} loading={loading} />}
          {result && !loading && (
            <div className="grid md:grid-cols-2 gap-4">
              <NewsCard news={result.news} />
              <FiiDiiCard fiiDii={result.fiiDii} />
            </div>
          )}
        </div>
      </section>

      {/* NSE TICKER */}
      <div className="relative border-y border-line overflow-hidden py-3 mb-28" style={{ background: 'rgba(5,6,8,0.6)' }}>
        <div className="ticker-track font-mono text-[11px] uppercase tracking-[0.08em]">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-8 pr-8">
              <span className="text-muted">NSE TICK</span>
              {[
                ['RELIANCE', '+1.24%', true], ['TATASTEEL', '+0.87%', true], ['HDFCBANK', '−0.34%', false],
                ['INFY', '+2.11%', true], ['SUZLON', '−3.42%', false], ['ITC', '+0.56%', true],
                ['TCS', '+1.05%', true], ['WIPRO', '−0.78%', false], ['ADANIENT', '+4.12%', true],
                ['SBIN', '+0.44%', true], ['BAJFINANCE', '−1.22%', false], ['HINDUNILVR', '+0.31%', true],
              ].map(([sym, chg, up]) => (
                <span key={sym} className="text-soft">{sym} <span className={up ? 'text-emerald' : 'text-danger'}>{chg}</span></span>
              ))}
              <span className="text-muted">STOCKX ENGINE · LIVE</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="px-6 lg:px-10 pt-20 pb-10 border-t border-line" style={{ background: '#050608' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10 pb-10 border-b border-line">
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[20px] font-semibold tracking-tight text-white">StockX</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
              </div>
              <p className="text-[13px] text-soft leading-relaxed max-w-xs">India's first AI-powered Decision Quality Engine for retail traders. Built to audit decisions, not make them.</p>
            </div>
            <div>
              <h5 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-4">Company</h5>
              <ul className="space-y-2.5 text-[13.5px]">
                <li><a href="#" className="text-soft hover:text-white transition">About Stoxify</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">SEBI RA Network</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">RIDE, JIIT Noida</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-4">Legal</h5>
              <ul className="space-y-2.5 text-[13.5px]">
                <li><a href="#" className="text-soft hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">Disclaimer</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-8">
            <div>
              <p className="font-mono text-[11px] text-soft mb-1.5">Stoxify Private Limited (DIPP239975). Incubated at RIDE, JIIT Noida.</p>
              <p className="font-mono text-[10px] text-muted">© 2026 Stoxify Technologies Pvt. Ltd. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted px-2.5 py-1 border border-line rounded">DPIIT · DIPP239975</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted px-2.5 py-1 border border-line rounded">RIDE · JIIT Noida</span>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-line/60">
            <p className="text-[11px] text-muted leading-relaxed max-w-4xl">
              <span className="font-mono uppercase tracking-[0.1em] text-soft">Disclaimer:</span>{' '}
              StockX is a decision-support and risk-analysis tool, not an investment advisor. The Decision Quality Score does not constitute financial advice. Trading in securities markets is subject to market risks. Read all scheme related documents carefully before investing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
