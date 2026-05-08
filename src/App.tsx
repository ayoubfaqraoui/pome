import { useState, useRef, useEffect } from 'react'
import { Wand2, Pencil, Check, Copy, Terminal, Sparkles, Download, X, Feather, BookmarkPlus, BookmarkCheck, Trash2, Clock, ChevronDown, Key, Menu } from 'lucide-react'
import './App.css'
import { enhancePrompt, extendPrompt, AVAILABLE_MODELS, type EnhancementConfig, type ModelDefinition } from './lib/promptEngine'

const tones = ['Professional', 'Casual', 'Friendly', 'Technical', 'Creative', 'Academic']
const roles = ['Expert Assistant', 'Software Developer', 'UI/UX Designer', 'Letterboxd Reviewer', 'Creative Writer', 'Teacher', 'Consultant']
const formats = ['Markdown', 'JSON', 'Bullet Points', 'Step by Step', 'Code Block']

interface SavedPrompt {
  id: string;
  rawPrompt: string;
  enhancedPrompt: string;
  explanation: string;
  model: ModelDefinition;
  timestamp: number;
}

function ArtisticDropdown({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="artistic-dropdown-container" ref={dropdownRef}>
      <button 
        className={`artistic-dropdown-trigger ${isOpen ? 'active' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={label}
      >
        {value && <span className="artistic-value">{value}</span>}
        <ChevronDown size={14} className="chevron" />
      </button>
      
      {isOpen && (
        <div className="artistic-dropdown-menu">
          {options.map(opt => (
            <button
              key={opt}
              className={`artistic-option ${value === opt ? 'active' : ''}`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              <span className="artistic-option-name">{opt}</span>
              {value === opt && <Check size={14} className="check-icon" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [rawPrompt, setRawPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [explanation, setExplanation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [extendInput, setExtendInput] = useState('')
  const [isExtendLoading, setIsExtendLoading] = useState(false)

  const [selectedModel, setSelectedModel] = useState<ModelDefinition>(AVAILABLE_MODELS[0]) // Default to GPT OSS 20B
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'history' | 'keys'>('history')
  const [selectedKeyModel, setSelectedKeyModel] = useState<string>(AVAILABLE_MODELS[0].id)
  
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [isKeySaved, setIsKeySaved] = useState(false)

  const [config, setConfig] = useState<EnhancementConfig>({
    tone: 'Professional',
    role: 'Expert Assistant',
    format: 'Markdown',
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultsRef = useRef<HTMLElement>(null)
  const editAreaRef = useRef<HTMLTextAreaElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  // Load saved prompts from local storage
  useEffect(() => {
    const saved = localStorage.getItem('pome_saved_prompts')
    if (saved) {
      try {
        setSavedPrompts(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved prompts', e)
      }
    }
  }, [])

  // Save to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('pome_saved_prompts', JSON.stringify(savedPrompts))
  }, [savedPrompts])

  // Load API keys
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pome_api_keys')
      if (saved) {
        setApiKeys(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to parse saved API keys', e)
    }
  }, [])

  const saveApiKeys = () => {
    localStorage.setItem('pome_api_keys', JSON.stringify(apiKeys))
    setIsKeySaved(true)
    setTimeout(() => setIsKeySaved(false), 2000)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-expand textarea height as user types — no browser resize handle needed
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [rawPrompt])

  // Scroll to results when they appear
  useEffect(() => {
    if (enhancedPrompt && !isLoading) {
      let attempts = 0;
      
      const scrollToResults = () => {
        if (resultsRef.current) {
          const rect = resultsRef.current.getBoundingClientRect();
          if (rect.height > 0 || attempts > 5) {
            const absoluteTop = rect.top + window.scrollY;
            window.scrollTo({
              top: absoluteTop - 40,
              behavior: 'smooth'
            });
            return;
          }
        }
        if (attempts < 10) {
          attempts++;
          requestAnimationFrame(() => setTimeout(scrollToResults, 50));
        }
      };

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
  }, [isLoading, rawPrompt, config, selectedModel])

  const handleEnhance = async () => {
    if (!rawPrompt.trim()) {
      setError('Please share your idea first...')
      return
    }

    setIsLoading(true)
    setError('')
    setEnhancedPrompt('')
    setExplanation('')
    setIsEditing(false)
    setIsExtending(false)

    try {
      const result = await enhancePrompt(rawPrompt, config, selectedModel)
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

  const openInGemini = async () => {
    if (enhancedPrompt) {
      await navigator.clipboard.writeText(enhancedPrompt)
      window.open('https://gemini.google.com/app', '_blank')
    }
  }

  const handleDownload = () => {
    if (!enhancedPrompt) return;
    const blob = new Blob([enhancedPrompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pome-prompt-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExtend = async () => {
    if (!extendInput.trim()) return

    setIsExtendLoading(true)
    setError('')
    
    try {
      const result = await extendPrompt(enhancedPrompt, extendInput, config, selectedModel)
      setEnhancedPrompt(result.enhancedPrompt)
      setExplanation(result.explanation)
      setExtendInput('')
      setIsExtending(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsExtendLoading(false)
    }
  }

  const saveCurrentPrompt = () => {
    if (!enhancedPrompt) return;
    
    const newSaved: SavedPrompt = {
      id: Date.now().toString(),
      rawPrompt,
      enhancedPrompt,
      explanation,
      model: selectedModel,
      timestamp: Date.now()
    }
    
    setSavedPrompts([newSaved, ...savedPrompts])
  }

  const loadSavedPrompt = (saved: SavedPrompt) => {
    setRawPrompt(saved.rawPrompt)
    setEnhancedPrompt(saved.enhancedPrompt)
    setExplanation(saved.explanation)
    setSelectedModel(saved.model)
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteSavedPrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSavedPrompts(savedPrompts.filter(p => p.id !== id))
  }

  const isCurrentPromptSaved = savedPrompts.some(p => p.enhancedPrompt === enhancedPrompt)

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

      <div className="header-actions-container">
        <button className="icon-btn menu-toggle" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={24} color="var(--text-main)" />
        </button>
      </div>

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
            
            <div className="input-footer">
              <div className="input-footer-left">
                <div className="model-dropdown-container" ref={modelDropdownRef}>
                  <button 
                    className={`model-dropdown-trigger ${isModelDropdownOpen ? 'active' : ''}`} 
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    title="Model"
                  >
                    <span className="model-name">{selectedModel.label}</span>
                    <ChevronDown size={14} className="chevron" />
                  </button>
                  
                  {isModelDropdownOpen && (
                    <div className="model-dropdown-menu">
                      {AVAILABLE_MODELS.map(model => (
                        <button
                          key={model.id}
                          className={`model-option ${selectedModel.id === model.id ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedModel(model)
                            setIsModelDropdownOpen(false)
                          }}
                        >
                          <span className="model-option-name">{model.label}</span>
                          {selectedModel.id === model.id && <Check size={14} className="check-icon" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="config-dropdowns">
                  <ArtisticDropdown 
                    label="Vibe" 
                    value={config.tone!} 
                    options={tones} 
                    onChange={(val) => setConfig({ ...config, tone: val })} 
                  />
                  <ArtisticDropdown 
                    label="Persona" 
                    value={config.role!} 
                    options={roles} 
                    onChange={(val) => setConfig({ ...config, role: val })} 
                  />
                  <ArtisticDropdown 
                    label="Format" 
                    value={config.format!} 
                    options={formats} 
                    onChange={(val) => setConfig({ ...config, format: val })} 
                  />
                </div>
              </div>

              <div className="input-footer-right">
                <button
                  className="generate-btn"
                  onClick={handleEnhance}
                  disabled={isLoading || !rawPrompt.trim()}
                >
                  {isLoading ? (
                    <>
                      <Feather className="feather-icon" size={16} strokeWidth={1.5} />
                      <span className="btn-text weaving-text">Rising</span>
                    </>
                  ) : (
                    <span className="btn-text">Enhance</span>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-toast">
                <span>{error}</span>
                <button className="error-dismiss" onClick={() => setError('')}><X size={14} /></button>
              </div>
            )}
          </div>
        </section>

        {(enhancedPrompt || explanation) && (
          <section className="results-section" ref={resultsRef}>
            <div className="result-card enhanced">
              <div className="card-header">
                <h3>The Prompt</h3>
                <div className="header-actions">
                  <button 
                    className={`icon-btn ${isCurrentPromptSaved ? 'saved' : ''}`} 
                    onClick={saveCurrentPrompt} 
                    title={isCurrentPromptSaved ? "Saved to History" : "Save this prompt"}
                    disabled={isCurrentPromptSaved}
                  >
                    {isCurrentPromptSaved ? <BookmarkCheck size={18} strokeWidth={1.75} /> : <BookmarkPlus size={18} strokeWidth={1.75} />}
                  </button>
                  <button className={`icon-btn ${isExtending ? 'active' : ''}`} onClick={() => setIsExtending(!isExtending)} title="Add more details to this prompt">
                    {isExtending ? <X size={18} strokeWidth={1.75} /> : <Wand2 size={18} strokeWidth={1.75} />}
                  </button>
                  <button className={`icon-btn ${isEditing ? 'active' : ''}`} onClick={() => setIsEditing(!isEditing)} title={isEditing ? "Save edits" : "Manually edit the prompt"}>
                    {isEditing ? <Check size={18} strokeWidth={1.75} /> : <Pencil size={18} strokeWidth={1.75} />}
                  </button>
                  <button className={`icon-btn ${isCopied ? 'copied' : ''}`} onClick={copyToClipboard} title="Copy to clipboard">
                    {isCopied ? <Check size={18} strokeWidth={1.75} /> : <Copy size={18} strokeWidth={1.75} />}
                  </button>
                  <button className="icon-btn" onClick={handleDownload} title="Download as Markdown">
                    <Download size={18} strokeWidth={1.75} />
                  </button>
                  <div className="divider" />
                  <button className="icon-btn ai-studio-btn" onClick={openInAIStudio} title="Open in Google AI Studio">
                    <Terminal size={18} strokeWidth={1.75} />
                  </button>
                  <button className="icon-btn gemini-btn" onClick={openInGemini} title="Open in Google Gemini">
                    <Sparkles size={18} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
              <div className="card-body">
                {isEditing ? (
                  <textarea 
                    ref={editAreaRef}
                    className="prompt-input edit-mode" 
                    value={enhancedPrompt}
                    onChange={(e) => setEnhancedPrompt(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <p className="prompt-text">{enhancedPrompt}</p>
                )}

                {isExtending && (
                  <div className="extend-section">
                    <input 
                      type="text" 
                      className="extend-input" 
                      placeholder="e.g. Make it sound more urgent, add a section about pricing..." 
                      value={extendInput}
                      onChange={(e) => setExtendInput(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') handleExtend() }}
                      disabled={isExtendLoading}
                      autoFocus
                    />
                    <button className="generate-btn extend-submit-btn" onClick={handleExtend} disabled={isExtendLoading}>
                      {isExtendLoading ? (
                        <>
                          <Feather className="feather-icon" size={16} strokeWidth={1} />
                          <span className="btn-text weaving-text">Rising</span>
                        </>
                      ) : (
                        <span className="btn-text">Submit</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {explanation && (
              <div className="result-card explanation">
                <div className="card-header">
                  <h3>Behind the scenes ({selectedModel.label})</h3>
                </div>
                <div className="card-body">
                  <p className="explanation-text">{explanation}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Unified Sidebar */}
      <div className={`history-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="history-sidebar-header" style={{flexDirection: 'column', alignItems: 'stretch', gap: '1rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div className="sidebar-tabs" style={{display: 'flex', gap: '1rem'}}>
              <button 
                className={`tab-btn ${sidebarTab === 'history' ? 'active' : ''}`}
                onClick={() => setSidebarTab('history')}
                style={{background: 'transparent', border: 'none', color: sidebarTab === 'history' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, fontSize: '0.9rem'}}
              >
                <Clock size={16} /> Saved
              </button>
              <button 
                className={`tab-btn ${sidebarTab === 'keys' ? 'active' : ''}`}
                onClick={() => setSidebarTab('keys')}
                style={{background: 'transparent', border: 'none', color: sidebarTab === 'keys' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, fontSize: '0.9rem'}}
              >
                <Key size={16} /> API Keys
              </button>
            </div>
            <button className="icon-btn" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="history-list">
          {sidebarTab === 'history' ? (
            savedPrompts.length === 0 ? (
              <div className="empty-history">
                <BookmarkPlus size={32} opacity={0.5} />
                <p>No saved prompts yet.</p>
                <span>Save a generated prompt to compare models and keep a history.</span>
              </div>
            ) : (
              savedPrompts.map(saved => (
                <div key={saved.id} className="history-item" onClick={() => loadSavedPrompt(saved)}>
                  <div className="history-item-header">
                    <span className="history-model-name">{saved.model.label}</span>
                    <span className="history-time">
                      {new Date(saved.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="history-raw-preview">{saved.rawPrompt}</p>
                  <div className="history-actions">
                    <button className="history-delete" onClick={(e) => deleteSavedPrompt(saved.id, e)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="keys-config-section" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%'}}>
              <p className="settings-desc">Configure API keys per model. Keys are securely stored locally.</p>
              
              <div className="key-input-group">
                <label>Target Model</label>
                <div className="model-dropdown-container" style={{width: '100%'}}>
                  <select 
                    value={selectedKeyModel} 
                    onChange={(e) => setSelectedKeyModel(e.target.value)}
                    style={{width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', appearance: 'none', cursor: 'pointer'}}
                  >
                    {AVAILABLE_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none'}} />
                </div>
              </div>

              <div className="key-input-group">
                <label>API Key</label>
                <input 
                  type="password"
                  placeholder="Paste API Key here..."
                  value={apiKeys[selectedKeyModel] || ''}
                  onChange={(e) => setApiKeys({...apiKeys, [selectedKeyModel]: e.target.value})}
                  style={{width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)'}}
                />
              </div>

              <div style={{marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end'}}>
                <button className="generate-btn" onClick={() => {
                  saveApiKeys();
                }} style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                  {isKeySaved ? <><Check size={16} /> Saved!</> : 'Save Key'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {isSidebarOpen && <div className="history-overlay" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  )
}

export default App
