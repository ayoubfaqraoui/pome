import { useState, useRef, useEffect } from 'react'
import './App.css'
import { enhancePrompt, type EnhancementConfig } from './lib/promptEngine'

const tones = ['Professional', 'Casual', 'Friendly', 'Technical', 'Creative', 'Academic']
const roles = ['Expert Assistant', 'Software Developer', 'Letterboxd Reviewer', 'Creative Writer', 'Teacher', 'Consultant']
const formats = ['Structured Markdown', 'JSON', 'Bullet Points', 'Step by Step', 'Code Block']

function App() {
  const [rawPrompt, setRawPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [explanation, setExplanation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  const [config, setConfig] = useState<EnhancementConfig>({
    tone: 'Professional',
    role: 'Expert Assistant',
    format: 'Structured Markdown',
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultsRef = useRef<HTMLElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [rawPrompt])

  // Scroll to results when they appear
  useEffect(() => {
    if (enhancedPrompt && !isLoading) {
      let attempts = 0;
      
      const scrollToResults = () => {
        if (resultsRef.current) {
          const rect = resultsRef.current.getBoundingClientRect();
          
          // Only scroll if the element has actually been laid out (height > 0)
          if (rect.height > 0 || attempts > 5) {
            const absoluteTop = rect.top + window.scrollY;
            window.scrollTo({
              top: absoluteTop - 40,
              behavior: 'smooth'
            });
            return;
          }
        }
        
        // If element isn't ready or laid out yet, try again shortly
        if (attempts < 10) {
          attempts++;
          requestAnimationFrame(() => setTimeout(scrollToResults, 50));
        }
      };

      // Start the scrolling attempt process
      requestAnimationFrame(() => setTimeout(scrollToResults, 50));
    }
  }, [enhancedPrompt, isLoading])

  // Keyboard shortcut (Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (!isLoading && rawPrompt.trim()) {
          handleEnhance()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, rawPrompt, config])

  const handleEnhance = async () => {
    if (!rawPrompt.trim()) {
      setError('Please share your idea first...')
      return
    }

    setIsLoading(true)
    setError('')
    setEnhancedPrompt('')
    setExplanation('')

    try {
      const result = await enhancePrompt(rawPrompt, config)
      setEnhancedPrompt(result.enhancedPrompt)
      setExplanation(result.explanation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (enhancedPrompt) {
      await navigator.clipboard.writeText(enhancedPrompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const openInAIStudio = async () => {
    if (enhancedPrompt) {
      await navigator.clipboard.writeText(enhancedPrompt)
      window.open('https://aistudio.google.com/prompts/new_chat', '_blank')
    }
  }

  const PillSelector = ({ 
    label, 
    options, 
    value, 
    onChange 
  }: { 
    label: string, 
    options: string[], 
    value: string, 
    onChange: (val: string) => void 
  }) => (
    <div className="config-group">
      <span className="config-label">{label}</span>
      <div className="pill-container">
        {options.map((opt) => (
          <button
            key={opt}
            className={`pill ${value === opt ? 'active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="app-container">
      <div className="background-glow glow-1"></div>
      <div className="background-glow glow-2"></div>

      <header className="brand-header">
        <h1 className="logo">Pome.</h1>
        <p className="subtitle">Distill your raw thoughts into powerful AI prompts.</p>
      </header>

      <main className="main-content">
        <section className="composer-section">
          <div className="editor-wrapper">
            <textarea
              ref={textareaRef}
              className="prompt-input"
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              placeholder="What are you trying to build, solve, or create? Just dump your brain here..."
            />
          </div>

          <div className="controls-grid">
            <PillSelector 
              label="Vibe" 
              options={tones} 
              value={config.tone!} 
              onChange={(t) => setConfig({ ...config, tone: t })} 
            />
            <PillSelector 
              label="Persona" 
              options={roles} 
              value={config.role!} 
              onChange={(r) => setConfig({ ...config, role: r })} 
            />
            <PillSelector 
              label="Format" 
              options={formats} 
              value={config.format!} 
              onChange={(f) => setConfig({ ...config, format: f })} 
            />
          </div>

          <div className="action-row">
            {error && <span className="error-message">{error}</span>}
            <button
              className={`generate-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleEnhance}
              disabled={isLoading}
            >
              <span className="btn-text">{isLoading ? 'Distilling...' : 'Enhance'}</span>
              <div className="btn-glow"></div>
            </button>
          </div>
        </section>

        {(enhancedPrompt || explanation) && (
          <section className="results-section" ref={resultsRef}>
            <div className="result-card enhanced">
              <div className="card-header">
                <h3>The Prompt</h3>
                <div className="header-actions">
                  <button className={`copy-btn ${isCopied ? 'copied' : ''}`} onClick={copyToClipboard}>
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="copy-btn ai-studio-btn" onClick={openInAIStudio} title="Copies prompt and opens AI Studio">
                    Run in AI Studio
                  </button>
                </div>
              </div>
              <div className="card-body">
                <p className="prompt-text">{enhancedPrompt}</p>
              </div>
            </div>

            {explanation && (
              <div className="result-card explanation">
                <div className="card-header">
                  <h3>Behind the scenes</h3>
                </div>
                <div className="card-body">
                  <p className="explanation-text">{explanation}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
