
import React, { useState, useEffect } from 'react';
import { UserBrain, GlobalGameConfig } from '../types';
import { generateStory, playTextToSpeech, generateIllustration } from '../services/geminiService';
import { BookOpen, Star, ArrowRight, RefreshCw, Volume2, ThumbsUp, Brain, Image as ImageIcon, Sparkles, AlertTriangle } from 'lucide-react';

interface StoryModeSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  config: GlobalGameConfig;
}

const StoryModeSession: React.FC<StoryModeSessionProps> = ({ onExit, brain, onUpdateBrain, config }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<{ title: string; storyText: string; translation: string } | null>(null);
  const [ratingInterest, setRatingInterest] = useState(5);
  const [ratingComprehension, setRatingComprehension] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [targetVerbs, setTargetVerbs] = useState<string[]>([]);
  
  // Image Gen State (Auto)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const loadStory = async () => {
    setLoading(true);
    setError(null);
    try {
        // Pick the last 5 verbs added to history
        const allVerbs = Object.keys(brain.verbHistory);
        // Sort by lastSeen descending
        const sortedVerbs = allVerbs.sort((a, b) => brain.verbHistory[b].lastSeen - brain.verbHistory[a].lastSeen);
        const recentVerbs = sortedVerbs.slice(0, 5);
        
        setTargetVerbs(recentVerbs);
        
        const data = await generateStory(recentVerbs, brain.currentLevel);
        if (data) {
            setStory(data);
            setLoading(false);
            // TRIGGER IMAGE GENERATION AUTOMATICALLY
            generateImage(data.storyText);
        } else {
            throw new Error("Falha na geração");
        }
    } catch (err) {
        setError("Não foi possível criar a história. A IA pode estar sobrecarregada ou os verbos são insuficientes.");
        setLoading(false);
    }
  };

  useEffect(() => {
    loadStory();
  }, []);

  const generateImage = async (text: string) => {
      setIsGeneratingImage(true);
      const imgBase64 = await generateIllustration(text);
      if (imgBase64) {
          setGeneratedImage(imgBase64);
      }
      setIsGeneratingImage(false);
  };

  const handleSubmit = () => {
    if (!story) return;

    const newBrain = { ...brain };
    
    // Reset counter
    newBrain.verbsSinceLastStory = 0;
    
    // Save to history (Including Image)
    if (!newBrain.storyHistory) newBrain.storyHistory = [];
    newBrain.storyHistory.push({
      id: `story-${Date.now()}`,
      date: Date.now(),
      storyTitle: story.title,
      storyText: story.storyText,
      targetVerbs: targetVerbs,
      ratingInterest,
      ratingComprehension,
      imageUrl: generatedImage || undefined // Save automatically
    });

    onUpdateBrain(newBrain);
    setSubmitted(true);
    setTimeout(onExit, 1500);
  };

  const handleAudio = () => {
    if (story) {
      // Strip HTML tags for TTS
      const cleanText = story.storyText.replace(/<[^>]*>/g, '');
      playTextToSpeech(cleanText);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-50 flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <RefreshCw className="animate-spin text-purple-600" size={48} />
        <h2 className="text-xl font-bold text-slate-700">Criando sua História...</h2>
        <p className="text-slate-500">Conectando {targetVerbs.length > 0 ? targetVerbs.join(", ") : "verbos"} em um contexto único.</p>
        <p className="text-xs text-slate-400 mt-4">Isso pode levar alguns segundos.</p>
      </div>
    );
  }

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

  if (!story) return null;

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

  return (
    <div className="max-w-2xl mx-auto h-full p-6 flex flex-col overflow-y-auto">
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
          
          {/* IMAGE HEADER (AUTO-GENERATED) */}
          <div className="relative w-full h-64 bg-slate-100 flex items-center justify-center overflow-hidden group">
              {generatedImage ? (
                  <>
                    <img src={generatedImage} alt="Story Art" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 text-white">
                        <span className="text-[10px] uppercase font-bold tracking-widest bg-purple-500/80 px-2 py-1 rounded backdrop-blur-md">Arte Originale</span>
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                      <RefreshCw className="animate-spin" size={32} />
                      <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Pintando Cena...</span>
                  </div>
              )}
          </div>

          <div className="p-8">
              <h2 className="text-3xl font-serif font-bold text-slate-800 mb-6">{story.title}</h2>
              
              <div className="prose prose-lg text-slate-700 leading-relaxed mb-8">
                  <p dangerouslySetInnerHTML={{ __html: story.storyText }}></p>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                  <button onClick={handleAudio} className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 font-bold transition-colors">
                      <Volume2 size={20} /> Ouvir
                  </button>
                  <div className="text-xs text-slate-400 font-medium">Baseado em fatos gramaticais</div>
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
