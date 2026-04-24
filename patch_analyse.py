import re

with open('frontend/src/pages/AnalysePage.jsx', 'r') as f:
    content = f.read()

# 1. Component name
content = content.replace('export default function LandingPage() {', 'import { useAuth } from "../context/AuthContext"\nimport { useNavigate } from "react-router-dom"\n\nexport default function AnalysePage() {')

# 2. Add auth hook
auth_code = """
  const { user, userProfile, authLoading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [user, authLoading, navigate])
"""
content = content.replace('const [inputVal, setInputVal] = useState(\'\')', auth_code + '\n  const [inputVal, setInputVal] = useState(\'\')')

# 3. Modify Nav
nav_pattern = re.compile(r'<nav.*?</nav>', re.DOTALL)
new_nav = """
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
"""
content = nav_pattern.sub(new_nav, content, count=1)

# 4. Remove promo sections
# Let's use string split to remove from {/* ENGINE GRID */} to the end, then add back the footer.
engine_idx = content.find('{/* ENGINE GRID */}')
footer_idx = content.find('{/* FOOTER */}')

if engine_idx != -1 and footer_idx != -1:
    footer_content = content[footer_idx:]
    content = content[:engine_idx] + footer_content
    
# 5. Modify Header titles
content = content.replace(
    '''The analyst that<br />
            <span className="text-white">never </span><span className="italic font-light text-emerald">sleeps.</span>''',
    '''Decision Quality Engine<br />
            <span className="text-white">Active</span>'''
)

content = content.replace(
    '''Ask about any NSE stock. Get institutional-grade risk analysis, technical validation, and a Decision Quality Score in seconds. No Bloomberg terminal required.''',
    '''Enter any NSE stock ticker below to run a complete 5-layer ML analysis.'''
)

# Remove the "Indian Market · Live Data" badges
badges_pattern = re.compile(r'{/\* Trust badges \*/}.*?</div>\s*</div>\s*</header>', re.DOTALL)
content = badges_pattern.sub('</div>\n      </header>', content)

# 6. Change result state from MOCK_DATA.SUZLON to null initially so it's a "pure analysis page" waiting for input
content = content.replace('const [result, setResult] = useState(MOCK_DATA.SUZLON)', 'const [result, setResult] = useState(null)')

with open('frontend/src/pages/AnalysePage.jsx', 'w') as f:
    f.write(content)
