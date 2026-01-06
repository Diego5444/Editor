
import React, { useState, useEffect, useRef } from 'react';
import { 
  Code2, 
  Play, 
  Sparkles, 
  Trash2, 
  X, 
  Terminal, 
  Files, 
  Search, 
  Settings, 
  FolderOpen, 
  FileCode, 
  Plus, 
  Download, 
  AlertCircle,
  ArrowLeft,
  RotateCw,
  ExternalLink,
  Smartphone,
  Replace,
  ReplaceAll,
  ChevronDown,
  ChevronUp,
  Type,
  Regex,
  RefreshCw,
  Save
} from 'lucide-react';
import Editor from 'react-simple-code-editor';
// @ts-ignore
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
// @ts-ignore
import JSZip from 'jszip';

import { Language, CodeFile } from './types';
import { getCodeSuggestions, getInlineSuggestions, simulateExecution } from './services/geminiService';

const STORAGE_KEY = 'droidcode_project_v1';

const INITIAL_FILES: Record<string, CodeFile> = {
  'index_html': {
    id: Language.HTML,
    name: 'index.html',
    content: '<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { background: #1a1a1a; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }\n    .btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <div style="text-align: center;">\n    <h1>DroidCode Activity</h1>\n    <p>Editor de código con IA</p>\n    <button class="btn" onclick="alert(\'Hola desde la Preview!\')">Probar Botón</button>\n  </div>\n</body>\n</html>',
    language: 'html'
  },
  'main_py': {
    id: Language.PYTHON,
    name: 'main.py',
    content: 'def factorial(n):\n    if n == 0: return 1\n    return n * factorial(n-1)\n\nprint(f"El factorial de 5 es: {factorial(5)}")\n# ¡Usa la IA para generar más código!',
    language: 'python'
  }
};

const App: React.FC = () => {
  // Persistence Loading
  const loadStoredData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const storedData = loadStoredData();

  const [files, setFiles] = useState<Record<string, CodeFile>>(storedData?.files || INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string>(storedData?.activeFileId || 'main_py');
  const [openFileIds, setOpenFileIds] = useState<string[]>(storedData?.openFileIds || ['main_py', 'index_html']);
  
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  
  // Search & Replace State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestPosition, setSuggestPosition] = useState<{ top: number, left: number } | null>(null);
  
  const [pythonOutput, setPythonOutput] = useState<string>("");
  const [executing, setExecuting] = useState(false);

  // use any for browser environment compatibility
  const typingTimeoutRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeFile = files[activeFileId];

  // Auto-Save Effect
  useEffect(() => {
    const dataToSave = {
      files,
      activeFileId,
      openFileIds
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [files, activeFileId, openFileIds]);

  const getLanguageFromExt = (name: string): Language => {
    if (name.endsWith('.html')) return Language.HTML;
    if (name.endsWith('.css')) return Language.CSS;
    if (name.endsWith('.js')) return Language.JS;
    if (name.endsWith('.py')) return Language.PYTHON;
    return Language.HTML;
  };

  const getFileIcon = (lang: string) => {
    switch(lang) {
      case 'html': return <span className="text-orange-500 font-bold text-[10px] w-4 text-center">H</span>;
      case 'css': return <span className="text-blue-400 font-bold text-[10px] w-4 text-center">C</span>;
      case 'javascript': return <span className="text-yellow-400 font-bold text-[10px] w-4 text-center">J</span>;
      case 'python': return <span className="text-blue-500 font-bold text-[10px] w-4 text-center">Py</span>;
      default: return <FileCode size={14} />;
    }
  };

  const createNewFile = () => {
    if (!newFileName.trim()) return;
    const lang = getLanguageFromExt(newFileName);
    const id = `${newFileName.replace('.', '_')}_${Date.now()}`;
    
    let initialContent = '';
    if (lang === Language.PYTHON) initialContent = '# Python Script\nprint("Hello World")';
    if (lang === Language.HTML) initialContent = '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>';

    setFiles(prev => ({ 
      ...prev, 
      [id]: { 
        id: lang, 
        name: newFileName, 
        content: initialContent, 
        language: lang === Language.JS ? 'javascript' : lang 
      } 
    }));
    setOpenFileIds(prev => Array.from(new Set([...prev, id])));
    setActiveFileId(id);
    setNewFileName('');
    setIsCreatingFile(false);
  };

  const resetProject = () => {
    if (confirm("¿Estás seguro de que quieres borrar todo y restaurar los archivos iniciales?")) {
      setFiles(INITIAL_FILES);
      setActiveFileId('main_py');
      setOpenFileIds(['main_py', 'index_html']);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const downloadProject = async () => {
    const zip = new JSZip();
    (Object.values(files) as CodeFile[]).forEach(file => zip.file(file.name, file.content));
    const content = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `droidcode_project_${Date.now()}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCodeChange = (newContent: string) => {
    if (!activeFileId) return;
    setFiles(prev => ({ ...prev, [activeFileId]: { ...prev[activeFileId], content: newContent } }));
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      const textarea = document.querySelector('textarea');
      if (newContent.length > 2 && textarea) {
        const pos = getCaretCoordinates(textarea);
        setSuggestPosition(pos);
        const hits = await getInlineSuggestions(newContent, activeFile.id, textarea.selectionStart);
        setSuggestions(hits);
      } else {
        setSuggestions([]);
        setSuggestPosition(null);
      }
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = "    ";
      const newContent = activeFile.content.substring(0, start) + spaces + activeFile.content.substring(end);
      handleCodeChange(newContent);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const getCaretCoordinates = (textarea: HTMLTextAreaElement) => {
    const { selectionStart, value } = textarea;
    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement('div');
    Array.from(style).forEach(p => mirror.style.setProperty(p, style.getPropertyValue(p)));
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.width = textarea.offsetWidth + 'px';
    mirror.textContent = value.substring(0, selectionStart);
    const span = document.createElement('span');
    span.textContent = value.substring(selectionStart) || '.';
    mirror.appendChild(span);
    document.body.appendChild(mirror);
    const { offsetTop, offsetLeft } = span;
    document.body.removeChild(mirror);
    const rect = textarea.getBoundingClientRect();
    return {
      top: rect.top + offsetTop - textarea.scrollTop + 25,
      left: Math.min(rect.left + offsetLeft - textarea.scrollLeft, window.innerWidth - 220)
    };
  };

  const handleReplace = () => {
    if (!activeFile || !searchQuery) return;
    let regex: RegExp;
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      regex = isRegex ? new RegExp(searchQuery, flags) : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch (e) { return; }
    const currentContent = activeFile.content;
    const nextMatch = regex.exec(currentContent);
    if (nextMatch) {
      const newContent = currentContent.substring(0, nextMatch.index) + replaceQuery + currentContent.substring(nextMatch.index + nextMatch[0].length);
      handleCodeChange(newContent);
    }
  };

  const handleReplaceAll = () => {
    if (!activeFile || !searchQuery) return;
    let regex: RegExp;
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      regex = isRegex ? new RegExp(searchQuery, flags) : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch (e) { return; }
    const newContent = activeFile.content.replace(regex, replaceQuery);
    handleCodeChange(newContent);
  };

  const handleRun = async () => {
    setShowPreview(true);
    if (activeFile?.id === Language.PYTHON) {
      setExecuting(true);
      setPythonOutput("");
      const out = await simulateExecution(activeFile.content, Language.PYTHON);
      setPythonOutput(out);
      setExecuting(false);
    }
  };

  const generateCombinedPreview = () => {
    const htmlFile = (Object.values(files) as CodeFile[]).find(f => f.name === 'index.html');
    const cssFiles = (Object.values(files) as CodeFile[]).filter(f => f.name.endsWith('.css')).map(f => `<style>${f.content}</style>`).join('\n');
    const jsFiles = (Object.values(files) as CodeFile[]).filter(f => f.name.endsWith('.js')).map(f => `<script>${f.content}</script>`).join('\n');
    return `${htmlFile?.content || ''}${cssFiles}${jsFiles}`;
  };

  return (
    <div className="flex h-screen bg-[#0d1117] overflow-hidden text-slate-300 font-sans selection:bg-blue-500/30">
      
      {/* Activity Bar */}
      <nav className="w-12 sm:w-14 bg-[#161b22] border-r border-[#30363d] flex flex-col items-center py-4 gap-6 z-50">
        <button onClick={() => setExplorerOpen(!explorerOpen)} className={`p-2 transition-colors ${explorerOpen ? 'text-white border-l-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
          <Files size={24} />
        </button>
        <button onClick={downloadProject} className="p-2 text-slate-500 hover:text-blue-400" title="Descargar ZIP">
          <Download size={24} />
        </button>
        <div className="mt-auto flex flex-col gap-4 pb-4">
           <button onClick={resetProject} className="p-2 text-slate-600 hover:text-red-400 transition-colors" title="Reiniciar Proyecto"><RefreshCw size={22} /></button>
           <button className="p-2 text-slate-500 hover:text-slate-300"><Settings size={24} /></button>
        </div>
      </nav>

      {/* Explorer */}
      {explorerOpen && (
        <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col z-40 transition-all duration-300 ease-in-out">
          <div className="p-4 flex items-center justify-between border-b border-[#30363d] bg-[#0d1117]/50">
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Explorador</h2>
            <button onClick={() => setIsCreatingFile(true)} className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-white transition-colors"><Plus size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto pt-2 bg-[#161b22]">
            {isCreatingFile && (
              <div className="px-4 py-3 bg-[#0d1117] border-b border-[#30363d] animate-in slide-in-from-left duration-200">
                <input 
                  autoFocus 
                  className="w-full bg-[#161b22] border border-blue-500 rounded px-2 py-1.5 text-xs outline-none text-white font-mono" 
                  placeholder="ej. script.py" 
                  value={newFileName} 
                  onChange={(e) => setNewFileName(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && createNewFile()} 
                  onBlur={() => !newFileName && setIsCreatingFile(false)}
                />
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 text-slate-500 text-[10px] font-bold tracking-wider uppercase opacity-60">Proyecto</div>
            {(Object.entries(files) as [string, CodeFile][]).map(([id, file]) => (
              <div 
                key={id} 
                onClick={() => { setActiveFileId(id); if(!openFileIds.includes(id)) setOpenFileIds(p => [...p, id]); }} 
                className={`group flex items-center gap-2 px-6 py-2 text-xs cursor-pointer transition-all ${activeFileId === id ? 'bg-[#21262d] text-blue-400 border-r-2 border-blue-500' : 'text-slate-400 hover:bg-[#1c2128] hover:text-slate-200'}`}
              >
                {getFileIcon(file.language)}
                <span className="truncate flex-1 font-medium">{file.name}</span>
                <Trash2 
                  size={12} 
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if(confirm(`¿Borrar ${file.name}?`)) {
                      const nf = {...files}; delete nf[id]; 
                      setFiles(nf); 
                      const newOpen = openFileIds.filter(fid => fid !== id);
                      setOpenFileIds(newOpen);
                      if (activeFileId === id && newOpen.length > 0) setActiveFileId(newOpen[0]);
                    }
                  }} 
                />
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="bg-[#161b22] border-b border-[#30363d] flex flex-col shadow-md z-30">
          <div className="flex items-center justify-between px-4 py-1.5">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-[#21262d] px-2 py-0.5 rounded border border-[#30363d]">
                   <Code2 size={12} className="text-blue-500"/>
                   <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">DroidCode</span>
                </div>
                {activeFile && <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><FolderOpen size={10}/> {activeFile.name}</span>}
             </div>
             <div className="flex items-center gap-3">
                <button onClick={() => setShowSearch(!showSearch)} className={`p-1.5 rounded-md transition-all ${showSearch ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-[#30363d]'}`} title="Buscar y Reemplazar">
                  <Search size={16} />
                </button>
                <button onClick={handleRun} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-[10px] font-bold transition-all shadow-lg active:scale-95">
                  <Play size={12} fill="white"/> RUN
                </button>
                <button onClick={() => { setAiLoading(true); setAiPanelOpen(true); getCodeSuggestions(activeFile.content, activeFile.id as Language).then(res => { setAiResponse(res); setAiLoading(false); }); }} className="text-blue-400 hover:text-blue-300 transition-transform active:scale-110"><Sparkles size={18} /></button>
             </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto no-scrollbar bg-[#0d1117] border-b border-[#30363d]">
            {openFileIds.map(id => (
              <div 
                key={id} 
                onClick={() => setActiveFileId(id)} 
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-[11px] border-r border-[#30363d] cursor-pointer transition-all ${activeFileId === id ? 'bg-[#0d1117] text-blue-400 border-t-2 border-t-blue-500' : 'bg-[#161b22] text-slate-500 hover:bg-[#1c2128]'}`}
              >
                {files[id] && getFileIcon(files[id].language)}
                <span className={`${activeFileId === id ? 'font-bold' : 'font-normal'}`}>{files[id]?.name}</span>
                <X size={10} className="hover:text-red-400 transition-colors" onClick={(e) => { e.stopPropagation(); setOpenFileIds(p => p.filter(fid => fid !== id)); }} />
              </div>
            ))}
          </div>
        </header>

        {/* Floating Search Bar */}
        {showSearch && (
          <div className="absolute top-4 right-4 z-50 w-80 bg-[#161b22] border border-[#30363d] p-4 rounded-xl shadow-2xl backdrop-blur-xl bg-opacity-95 animate-in slide-in-from-top-4 duration-300">
             <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Buscar y Reemplazar</span>
                <button onClick={() => setShowSearch(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
             </div>
             <div className="flex flex-col gap-3">
               <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden focus-within:border-blue-500 transition-colors">
                    <input className="flex-1 bg-transparent px-3 py-2 text-xs outline-none text-slate-200 placeholder-slate-600 font-mono" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <div className="flex items-center pr-2 gap-1.5">
                      <button onClick={() => setIsCaseSensitive(!isCaseSensitive)} className={`p-1.5 rounded-md text-[10px] transition-all ${isCaseSensitive ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-[#30363d]'}`} title="Case Sensitive"><Type size={14} /></button>
                      <button onClick={() => setIsRegex(!isRegex)} className={`p-1.5 rounded-md text-[10px] transition-all ${isRegex ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-[#30363d]'}`} title="Regex"><Regex size={14} /></button>
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors">
                    <input className="w-full bg-transparent text-xs outline-none text-slate-200 placeholder-slate-600 font-mono" placeholder="Reemplazar con..." value={replaceQuery} onChange={(e) => setReplaceQuery(e.target.value)} />
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={handleReplace} className="flex-1 py-2 bg-[#30363d] hover:bg-[#484f58] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"><Replace size={14}/> Siguiente</button>
                  <button onClick={handleReplaceAll} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"><ReplaceAll size={14}/> Todo</button>
               </div>
             </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 overflow-auto bg-[#0d1117] relative">
          {activeFile ? (
            <div className="h-full flex">
              {/* Line Numbers column decoration */}
              <div className="w-10 bg-[#0d1117] border-r border-[#30363d] flex flex-col pt-[15px] select-none pointer-events-none items-center text-[11px] text-[#484f58] font-mono leading-6">
                {activeFile.content.split('\n').map((_, i) => <div key={i}>{i+1}</div>)}
              </div>
              <Editor
                value={activeFile.content}
                onValueChange={handleCodeChange}
                highlight={code => Prism.highlight(code, Prism.languages[activeFile.language] || Prism.languages.plain, activeFile.language)}
                onKeyDown={handleKeyDown}
                padding={15}
                className="code-input flex-1 text-[13px] leading-6 min-h-full font-mono"
                textareaClassName="outline-none caret-blue-400"
                style={{ fontFamily: '"Fira Code", monospace' }}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 bg-[#0d1117]">
              <div className="relative">
                <FolderOpen size={64} className="opacity-10" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500/20 rounded-full animate-ping"/>
              </div>
              <p className="text-sm italic tracking-widest opacity-40">DroidCode está listo.</p>
              <button onClick={() => setIsCreatingFile(true)} className="px-6 py-2 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-full text-xs hover:bg-blue-600 hover:text-white transition-all">Crear nuevo archivo</button>
            </div>
          )}

          {/* IntelliSense Dropdown */}
          {suggestPosition && suggestions.length > 0 && (
            <div className="fixed z-[100] w-64 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 backdrop-blur-lg bg-opacity-90 overflow-hidden" style={{ top: suggestPosition.top, left: suggestPosition.left }}>
              <div className="p-2 border-b border-[#30363d] bg-blue-600/10 flex items-center gap-2">
                <Sparkles size={10} className="text-blue-400"/>
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">IA Sugiere</span>
              </div>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => {
                  const tx = document.querySelector('textarea');
                  if(!tx) return;
                  const start = tx.selectionStart;
                  handleCodeChange(activeFile.content.substring(0, start) + s + activeFile.content.substring(tx.selectionEnd));
                  setSuggestions([]); setSuggestPosition(null);
                  setTimeout(() => { tx.focus(); tx.setSelectionRange(start + s.length, start + s.length); }, 10);
                }} className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white text-[12px] font-mono text-slate-300 transition-colors border-l-4 border-transparent hover:border-blue-300">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer info bar */}
        <footer className="bg-[#161b22] border-t border-[#30363d] px-4 py-1 flex items-center justify-between text-[10px] text-slate-500">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Save size={10}/> Auto-saved</span>
              <span className="flex items-center gap-1 font-mono uppercase text-blue-500/80">{activeFile?.language}</span>
           </div>
           <div>
              <span>Ln {activeFile?.content.split('\n').length}, Col {activeFile?.content.length}</span>
           </div>
        </footer>
      </main>

      {/* FULL-SCREEN PREVIEW / TERMINAL ACTIVITY */}
      {showPreview && (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#161b22] text-white p-4 flex items-center justify-between border-b border-black/20 shadow-2xl">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-75"><ArrowLeft size={24} /></button>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">{activeFile?.id === Language.PYTHON ? 'EJECUCIÓN PYTHON' : 'VISTA PREVIA WEB'}</span>
                <span className="text-[10px] text-emerald-400 font-mono uppercase flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500" /> Sistema Activo
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => {
                if(iframeRef.current) iframeRef.current.srcdoc = generateCombinedPreview();
                if(activeFile?.id === Language.PYTHON) handleRun();
              }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><RotateCw size={20} /></button>
              <button className="bg-red-500/90 hover:bg-red-600 text-white px-5 py-2 rounded-lg text-[11px] font-black tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-red-900/20" onClick={() => setShowPreview(false)}>CERRAR</button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden bg-[#f8fafc]">
            {activeFile?.id === Language.PYTHON ? (
              <div className="absolute inset-0 bg-[#0c0c0c] p-8 font-mono overflow-auto selection:bg-emerald-500/30">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-3 text-slate-700 mb-8 border-b border-white/5 pb-4 text-[11px] tracking-widest uppercase font-bold">
                    <Terminal size={16} /> Entorno Virtual DroidCode v2.0
                  </div>
                  <div className="text-emerald-400 leading-relaxed text-base whitespace-pre-wrap font-mono">
                    {executing ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                           <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                           <span className="italic opacity-70">Compilando y ejecutando...</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500 w-1/2 animate-infinite-scroll"/>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-700">
                        <div className="flex items-center gap-2 mb-4">
                           <span className="text-slate-600 font-bold">$</span>
                           <span className="text-slate-500">python3 {activeFile.name}</span>
                        </div>
                        <div className="mt-2 bg-white/5 p-6 rounded-xl border border-white/5 shadow-inner leading-8">
                           {pythonOutput || ">>> Proceso finalizado (sin salida)."}
                        </div>
                      </div>
                    )}
                  </div>
                  {!executing && <div className="mt-8 flex items-center gap-3 text-emerald-500/40"><span>{">>>"}</span> <div className="w-3 h-6 bg-emerald-500/30 animate-pulse" /></div>}
                </div>
              </div>
            ) : (
              <iframe ref={iframeRef} title="Activity Preview" className="w-full h-full border-none shadow-2xl bg-white" srcDoc={generateCombinedPreview()} />
            )}
          </div>
          
          <div className="bg-white p-3 flex justify-center border-t border-slate-100">
             <div className="flex items-center gap-12 text-slate-300">
                <Smartphone size={22} className="hover:text-blue-500 transition-colors cursor-pointer" />
                <div className="h-8 w-[1.5px] bg-slate-100" />
                <ExternalLink size={22} className="hover:text-blue-500 transition-colors cursor-pointer" />
             </div>
          </div>
        </div>
      )}

      {/* AI Panel */}
      {aiPanelOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-lg transition-all duration-500" onClick={() => setAiPanelOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-[#161b22] border-l border-[#30363d] shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between p-6 border-b border-[#30363d] bg-[#1c2128]">
              <div className="flex items-center gap-3 text-blue-400 font-black text-xs uppercase tracking-[0.3em]"><Sparkles size={20}/><span>Copilot AI</span></div>
              <button onClick={() => setAiPanelOpen(false)} className="text-slate-500 hover:text-white transition-all hover:rotate-90"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-8">
                  <div className="relative scale-150">
                    <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"/>
                    <Sparkles className="absolute inset-0 m-auto text-blue-400 animate-pulse" size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-mono tracking-widest text-blue-400 uppercase font-black">Pensando...</p>
                    <p className="text-[10px] text-slate-500 mt-4 italic max-w-[200px] leading-relaxed">Analizando estructura de código y optimizando algoritmos...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-[#0d1117] rounded-2xl p-6 border border-[#30363d] text-[13px] font-mono leading-relaxed text-slate-300 whitespace-pre-wrap shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"/>
                    <div className="flex items-center gap-3 mb-4 text-slate-500 border-b border-[#30363d] pb-3 text-[11px] font-bold">
                      <Code2 size={16} className="text-blue-500"/> PROPUESTA DE REFACTORIZACIÓN
                    </div>
                    {aiResponse}
                  </div>
                  <button 
                    onClick={() => { 
                      const match = aiResponse?.match(/```(?:\w+)?\n([\s\S]*?)```/);
                      handleCodeChange(match ? match[1] : (aiResponse || '')); 
                      setAiPanelOpen(false); 
                    }} 
                    className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-2xl font-black text-xs tracking-[0.2em] transition-all shadow-2xl shadow-blue-500/30 active:scale-95 uppercase"
                  >
                    Aplicar Inteligencia
                  </button>
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex gap-3 items-start">
                     <AlertCircle size={18} className="text-yellow-500 shrink-0"/>
                     <p className="text-[10px] text-slate-400 leading-relaxed italic">Revisa el código antes de aplicarlo. La IA es una herramienta poderosa pero requiere supervisión humana.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
