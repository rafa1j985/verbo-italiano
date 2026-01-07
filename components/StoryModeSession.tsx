import React, { useState, useEffect } from 'react';
import { UserBrain, GlobalGameConfig } from '../types';
import { generateStory, playTextToSpeech, generateIllustration } from '../services/geminiService';
import { BookOpen, Star, RefreshCw, Volume2, ThumbsUp, Image as ImageIcon, Sparkles, AlertTriangle, Feather, PenTool } from 'lucide-react';

interface StoryModeSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  config: GlobalGameConfig;
}

// THEATRICAL LOADING MESSAGES
const WRITER_STEPS = [
    "🇮🇹 Stiamo cercando l'ispirazione...",
    "🍷 Sorseggiando un buon vino...",
    "🍝 Scegliendo i personaggi a Roma...",
    "✍️ Scrivendo il primo capitolo...",
    "🎭 Aggiungendo un po' di dramma...",
    "📖 Quasi pronto..."
];

const StoryModeSession: React.FC<StoryModeSessionProps> = ({ onExit, brain, onUpdateBrain, config }) => {
  // UI States
  const [loading, setLoading] = useState(true);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Content States
  const [story, setStory] = useState<{ title: string; storyText: string; translation: string } | null>(null);
  const [targetVerbs, setTargetVerbs] = useState<string[]>([]);
  
  // Image Async States
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Rating States
  const [ratingInterest, setRatingInterest] = useState(5);
  const [ratingComprehension, setRatingComprehension] = useState(5);
  const [submitted, setSubmitted] = useState(false);

  // --- THEATRICAL LOADING EFFECT ---
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (loading) {
          interval = setInterval(() => {
              setLoadingStepIndex(prev => (prev + 1) % WRITER_STEPS.length);
          }, 2500); // Change message every 2.5s
      }
      return () => clearInterval(interval);
  }, [loading]);

  const loadStory = async () => {
    setLoading(true);
    setError(null);
    setLoadingStepIndex(0);
    setGeneratedImage(null); // Reset image

    try {
        // 1. Select Verbs (Logic: Recent & Hardest)
        const allVerbs = Object.keys(brain.verbHistory);
        const sortedVerbs = allVerbs.sort((a, b) => brain.verbHistory[b].lastSeen - brain.verbHistory[a].lastSeen);
        const recentVerbs = sortedVerbs.slice(0, 5);
        setTargetVerbs(recentVerbs);
        
        // 2. Generate Text (FAST) - Using Flash Model
        // This should take ~2-4 seconds.
        const data = await generateStory(recentVerbs, brain.currentLevel);
        
        if (data) {
            setStory(data);
            setLoading(false); // UNBLOCK UI IMMEDIATELY
            
            // 3. Trigger Image Generation (BACKGROUND/ASYNC)
            // This does NOT block the user from reading.
            generateImageAsync(data.storyText);
        } else {
            throw new Error("O escritor falhou ao criar a trama.");
        }
    } catch (err) {
        console.error(err);
        setError("Não foi possível criar a história. A IA pode estar sobrecarregada.");
        setLoading(false);
    }
  };

  const generateImageAsync = async (text: string) => {
      setIsGeneratingImage(true);
      // We don't await this in the main thread (it's called without await in loadStory)
      // But inside this async function, we await the API.
      const imgBase64 = await generateIllustration(text);
      if (imgBase64) {
          setGeneratedImage(imgBase64);
      }
      setIsGeneratingImage(false);
  };

  useEffect(() => {
    loadStory();
  }, []);

  const handleSubmit = () => {
    if (!story) return;

    const newBrain = { ...brain };
    newBrain.verbsSinceLastStory = 0;
    
    if (!newBrain.storyHistory) newBrain.storyHistory = [];
    newBrain.storyHistory.push({
      id: `story-${Date.now()}`,
      date: Date.now(),
      storyTitle: story.title,
      storyText: story.storyText,
      targetVerbs: targetVerbs,
      ratingInterest,
      ratingComprehension,
      imageUrl: generatedImage || undefined
    });

    onUpdateBrain(newBrain);
    setSubmitted(true);
    setTimeout(onExit, 1500);
  };

  const handleAudio = () => {
    if (story) {
      const cleanText = story.storyText.replace(/<[^>]*>/g, '');
      playTextToSpeech(cleanText);
    }
  };

  // --- RENDER: LOADING THEATER ---
  if (loading) {
    return (
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center space-y-8 p-6 text-center relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 to-slate-900"></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse"></div>
                <Feather className="text-purple-400 animate-bounce" size={64} />
            </div>
            
            <h2 className="text-2xl font-serif font-bold text-white mb-2 tracking-wide">
                {WRITER_STEPS[loadingStepIndex]}
            </h2>
            
            <div className="flex gap-2 mt-4 justify-center">
                {WRITER_STEPS.map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-1.5 w-8 rounded-full transition-all duration-500 ${i === loadingStepIndex ? 'bg-purple-500 scale-110' : 'bg-slate-700'}`}
                    />
                ))}
            </div>

            <p className="text-slate-500 text-xs mt-8 font-mono uppercase tracking-widest">
                IA Generativa em ação
            </p>
        </div>
      </div>
    );
  }

  // --- RENDER: ERROR ---
  if (error) {
      return (
          <div className="h-full bg-slate-50 flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <div className="bg-red-100 p-4 rounded-full text-red-500 mb-2">
                  <AlertTriangle size={48} />
              </div>
              <h2 className="text-xl font-bold text-slate-700">Erro na Criação</h2>
              <p className="text-slate-500 max-w-xs">{error}</p>
              <div className="flex gap-4 mt-6">
                  <button onClick={onExit} className="px-6 py-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 font-bold">
                      Sair
                  </button>
                  <button onClick={loadStory} className="px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 font-bold shadow-lg">
                      Tentar Novamente
                  </button>
              </div>
          </div>
      );
  }

  // --- RENDER: SUCCESS (SAVED) ---
  if (submitted) {
     return (
        <div className="h-full bg-slate-50 flex flex-col items-center justify-center animate-fade-in">
           <div className="bg-white p-8 rounded-full shadow-xl mb-4 text-emerald-500">
               <ThumbsUp size={64} />
           </div>
           <h2 className="text-2xl font-bold text-slate-800">História Salva na Galeria!</h2>
           <p className="text-slate-500">Sua memória visual foi preservada.</p>
        </div>
     );
  }

  if (!story) return null;

  // --- RENDER: STORY READER ---
  return (
    <div className="max-w-2xl mx-auto h-full p-6 flex flex-col overflow-y-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                 <BookOpen size={24} />
              </div>
              <h1 className="text-2xl font-serif font-bold text-slate-800">Story Mode</h1>
          </div>
          <button onClick={onExit} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
              Sair
          </button>
      </div>

      {/* STORY CARD CONTAINER */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 mb-8 relative overflow-hidden flex flex-col">
          
          {/* IMAGE HEADER (ASYNC PLACEHOLDER) */}
          <div className="relative w-full h-64 bg-slate-900 flex items-center justify-center overflow-hidden group">
              {generatedImage ? (
                  <>
                    <img src={generatedImage} alt="Story Art" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 animate-in fade-in duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 text-white">
                        <span className="text-[10px] uppercase font-bold tracking-widest bg-purple-500/80 px-2 py-1 rounded backdrop-blur-md">Arte Originale</span>
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400 p-8 text-center">
                      {isGeneratingImage ? (
                          <>
                            <RefreshCw className="animate-spin text-purple-400" size={32} />
                            <span className="text-xs font-bold uppercase tracking-widest animate-pulse text-purple-300">
                                O artista está pintando a cena...
                            </span>
                            <p className="text-[10px] text-slate-500 max-w-xs mt-2">
                                A história já está pronta abaixo. A imagem aparecerá magicamente quando secar a tinta.
                            </p>
                          </>
                      ) : (
                          <ImageIcon size={32} />
                      )}
                  </div>
              )}
          </div>

          <div className="p-8">
              <h2 className="text-3xl font-serif font-bold text-slate-800 mb-6">{story.title}</h2>
              
              <div className="prose prose-lg text-slate-700 leading-relaxed mb-8 font-serif">
                  <p dangerouslySetInnerHTML={{ __html: story.storyText }}></p>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                  <button onClick={handleAudio} className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 font-bold transition-colors">
                      <Volume2 size={20} /> Ouvir
                  </button>
                  <div className="flex gap-2">
                      {targetVerbs.map(v => (
                          <span key={v} className="text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">{v}</span>
                      ))}
                  </div>
              </div>
              
              <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-500 italic">
                  <strong>Tradução:</strong> {story.translation}
              </div>
          </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-center font-bold text-slate-800 uppercase tracking-widest text-xs">Avalie para Salvar</h3>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Interesse</label>
                  <input 
                     type="range" min="0" max="10" 
                     value={ratingInterest} 
                     onChange={(e) => setRatingInterest(Number(e.target.value))}
                     className="w-full accent-purple-600"
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Compreensão</label>
                  <input 
                     type="range" min="0" max="10" 
                     value={ratingComprehension} 
                     onChange={(e) => setRatingComprehension(Number(e.target.value))}
                     className="w-full accent-emerald-600"
                  />
              </div>
          </div>

          <button 
             onClick={handleSubmit}
             className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex justify-center items-center gap-2"
          >
             Salvar na Galeria <ImageIcon size={20} />
          </button>
      </div>
    </div>
  );
};

export default StoryModeSession;