import re

with open('frontend/src/pages/AnalysePage.jsx', 'r') as f:
    content = f.read()

# 1. Import NSE_STOCKS
if "import NSE_STOCKS" not in content:
    content = content.replace("import { useAuth } from '../context/AuthContext'", "import { useAuth } from '../context/AuthContext'\nimport NSE_STOCKS from '../config/nse_stocks.json'")

# 2. Add showSuggestions state and filtered logic
search_state_code = """
  const [inputVal, setInputVal] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
"""
content = content.replace("const [inputVal, setInputVal] = useState('')", search_state_code)

# 3. Add handleBlur to hide suggestions with delay
handle_blur_code = """
  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200)
  }
"""
content = content.replace("const scrollToSearch", handle_blur_code + "\n  const scrollToSearch")

# 4. Modify form to include dropdown
form_pattern = re.compile(r'(<form onSubmit=\{handleSearch\}.*?<div className="relative flex items-center glass.*?)(<input.*?/>)(.*?</form>)', re.DOTALL)

def form_repl(m):
    prefix = m.group(1)
    input_tag = m.group(2)
    suffix = m.group(3)
    
    input_tag = input_tag.replace('onChange={e => setInputVal(e.target.value.toUpperCase())}', 'onChange={e => { setInputVal(e.target.value.toUpperCase()); setShowSuggestions(true); }}\n                onFocus={() => setShowSuggestions(true)}\n                onBlur={handleBlur}')
    
    dropdown = """
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
    """
    # Insert dropdown after the input's container div which is closed by `</div>` inside `suffix`
    # Wait, the suffix contains `</button>\n            </div>`
    # So we can insert dropdown right after `</div>`
    suffix = suffix.replace('</button>\n            </div>', '</button>\n            </div>' + dropdown)
    return prefix + input_tag + suffix

content = form_pattern.sub(form_repl, content)

with open('frontend/src/pages/AnalysePage.jsx', 'w') as f:
    f.write(content)
