import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { 
  ArrowLeft, Mic, MicOff, Volume2, SkipForward, 
  CheckCircle, XCircle, Home, RefreshCw
} from "lucide-react";
import { Progress } from "../components/ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ExercisePage = () => {
  const { difficulty } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();
  
  const [exercises, setExercises] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  
  const recognitionRef = useRef(null);

  // Fetch exercises
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const res = await axios.get(`${API}/exercises?difficulty=${difficulty}`, { 
          headers: getAuthHeaders() 
        });
        // Shuffle exercises
        const shuffled = res.data.sort(() => Math.random() - 0.5);
        setExercises(shuffled);
      } catch (error) {
        console.error("Error fetching exercises:", error);
        toast.error("Egzersizler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, [difficulty, getAuthHeaders]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'tr-TR';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSpokenText(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Mikrofon izni gerekli!");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const currentExercise = exercises[currentIndex];

  const speakWord = useCallback(() => {
    if ('speechSynthesis' in window && currentExercise) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentExercise.word);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.7;
      window.speechSynthesis.speak(utterance);
    }
  }, [currentExercise]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setSpokenText("");
      setFeedback(null);
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Check answer when spoken text changes
  useEffect(() => {
    if (spokenText && currentExercise) {
      checkAnswer(spokenText);
    }
  }, [spokenText]);

  const checkAnswer = async (spoken) => {
    if (!currentExercise) return;

    const targetWord = currentExercise.word.toLowerCase().trim();
    const spokenWord = spoken.toLowerCase().trim();
    
    // Flexible matching - check if spoken contains target or vice versa
    const isCorrect = spokenWord.includes(targetWord) || 
                      targetWord.includes(spokenWord) ||
                      levenshteinDistance(spokenWord, targetWord) <= Math.floor(targetWord.length * 0.3);

    // Save progress
    try {
      await axios.post(`${API}/progress`, {
        word_id: currentExercise.id,
        spoken_word: spoken,
        is_correct: isCorrect,
        difficulty: currentExercise.difficulty,
        category: currentExercise.category
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.error("Error saving progress:", error);
    }

    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    if (isCorrect) {
      setFeedback({
        type: 'success',
        message: getSuccessMessage()
      });
      // Play success sound simulation via speech
      const successUtterance = new SpeechSynthesisUtterance("Harika!");
      successUtterance.lang = 'tr-TR';
      successUtterance.rate = 1;
      window.speechSynthesis.speak(successUtterance);
    } else {
      setFeedback({
        type: 'error',
        message: getErrorMessage()
      });
      // Speak the correct word slowly
      setTimeout(() => {
        const correctUtterance = new SpeechSynthesisUtterance(`Doğrusu: ${currentExercise.word}`);
        correctUtterance.lang = 'tr-TR';
        correctUtterance.rate = 0.6;
        window.speechSynthesis.speak(correctUtterance);
      }, 1000);
    }
  };

  const getSuccessMessage = () => {
    const messages = [
      "Harika! Çok güzel söyledin! 🌟",
      "Süper! Devam et! 🎉",
      "Mükemmel! Aferin sana! 👏",
      "Bravo! Çok iyi! ⭐",
      "Doğru! Sen harikasın! 🏆"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getErrorMessage = () => {
    const messages = [
      "Tekrar deneyelim! 💪",
      "Neredeyse! Bir daha dene! 🔄",
      "Olsun, alıştırma yapalım! 🎯",
      "Yaklaştın! Bir kez daha! 🌈",
      "Sorun değil, tekrar edelim! 😊"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const levenshteinDistance = (str1, str2) => {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
        }
      }
    }
    return dp[m][n];
  };

  const nextExercise = () => {
    setFeedback(null);
    setSpokenText("");
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Session complete
      toast.success(`Tebrikler! ${sessionStats.correct}/${sessionStats.total} doğru!`);
      navigate("/dashboard");
    }
  };

  const tryAgain = () => {
    setFeedback(null);
    setSpokenText("");
  };

  const getDifficultyColor = () => {
    switch (difficulty) {
      case "easy": return "#06D6A0";
      case "medium": return "#FFD166";
      case "hard": return "#EF476F";
      default: return "#4CC9F0";
    }
  };

  const getDifficultyName = () => {
    switch (difficulty) {
      case "easy": return "Kolay";
      case "medium": return "Orta";
      case "hard": return "Zor";
      default: return difficulty;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F9FF] flex items-center justify-center">
        <div className="animate-bounce-in">
          <div className="w-24 h-24 bg-[#4CC9F0] rounded-full flex items-center justify-center">
            <Mic className="w-12 h-12 text-white" />
          </div>
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen bg-[#F0F9FF] flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#FFD166]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">😕</span>
          </div>
          <h2 className="text-2xl font-bold text-[#073B4C] mb-4">Bu seviyede egzersiz bulunamadı</h2>
          <Link to="/dashboard" className="btn-primary">
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F9FF] flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-4 md:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              data-testid="back-btn"
              className="w-12 h-12 bg-[#F0F9FF] rounded-xl flex items-center justify-center hover:bg-[#E0F7FA] transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-[#073B4C]" />
            </Link>
            <div>
              <span 
                className="px-3 py-1 rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: getDifficultyColor() }}
              >
                {getDifficultyName()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[#073B4C] font-bold">
              {currentIndex + 1} / {exercises.length}
            </span>
            <Link 
              to="/dashboard" 
              data-testid="home-btn"
              className="w-10 h-10 bg-[#F0F9FF] rounded-xl flex items-center justify-center hover:bg-[#E0F7FA] transition-colors"
            >
              <Home className="w-5 h-5 text-[#073B4C]" />
            </Link>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-4">
          <Progress 
            value={((currentIndex + 1) / exercises.length) * 100} 
            className="h-3"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-lg w-full">
          {/* Word Image - key forces re-render on exercise change */}
          <div 
            key={currentExercise?.id}
            className="bg-white rounded-3xl shadow-lg p-4 mb-8 border-8 animate-bounce-in"
            style={{ borderColor: getDifficultyColor() }}
          >
            <div className="aspect-square rounded-2xl overflow-hidden mb-4">
              <img 
                src={currentExercise?.image_url}
                alt={currentExercise?.word}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Word display */}
            <div className="text-center">
              <h2 
                className="text-4xl md:text-5xl font-black text-[#073B4C] font-['Nunito'] mb-2"
                data-testid="current-word"
              >
                {currentExercise?.word}
              </h2>
              {currentExercise?.pronunciation_hint && (
                <p className="text-lg text-[#8D99AE]">
                  ({currentExercise.pronunciation_hint})
                </p>
              )}
            </div>
          </div>

          {/* Spoken text display */}
          {spokenText && (
            <div className="bg-white rounded-2xl p-4 mb-6 text-center shadow-md">
              <p className="text-sm text-[#8D99AE] mb-1">Sen söyledin:</p>
              <p className="text-2xl font-bold text-[#073B4C]">{spokenText}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-6 mb-8">
            {/* Listen button */}
            <button
              onClick={speakWord}
              data-testid="listen-btn"
              className="w-20 h-20 bg-[#FFD166] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              title="Dinle"
            >
              <Volume2 className="w-10 h-10 text-[#073B4C]" />
            </button>

            {/* Microphone button */}
            <button
              onClick={isListening ? stopListening : startListening}
              data-testid="mic-btn"
              className={`mic-button ${isListening ? 'listening' : ''}`}
              title={isListening ? "Dinleniyor..." : "Konuş"}
            >
              {isListening ? (
                <MicOff className="w-16 h-16 text-white" />
              ) : (
                <Mic className="w-16 h-16 text-white" />
              )}
            </button>

            {/* Skip button */}
            <button
              onClick={nextExercise}
              data-testid="skip-btn"
              className="w-20 h-20 bg-[#4CC9F0] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              title="Atla"
            >
              <SkipForward className="w-10 h-10 text-[#073B4C]" />
            </button>
          </div>

          {/* Listening indicator */}
          {isListening && (
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-[#06D6A0] text-white px-6 py-3 rounded-full animate-pulse">
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" />
                <span className="font-bold">Dinliyorum...</span>
              </div>
            </div>
          )}

          {/* Browser support warning */}
          {!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window) && (
            <div className="bg-[#EF476F]/10 border-2 border-[#EF476F] rounded-2xl p-4 text-center">
              <p className="text-[#EF476F] font-medium">
                Tarayıcınız ses tanımayı desteklemiyor. Lütfen Chrome kullanın.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Feedback Modal */}
      {feedback && (
        <div className="feedback-overlay" data-testid="feedback-modal">
          <div className={`feedback-modal ${feedback.type}`}>
            {feedback.type === 'success' ? (
              <CheckCircle className="w-24 h-24 text-[#06D6A0]" />
            ) : (
              <XCircle className="w-24 h-24 text-[#EF476F]" />
            )}
            
            <h3 className="text-2xl font-black text-[#073B4C] text-center">
              {feedback.message}
            </h3>
            
            {feedback.type === 'error' && (
              <p className="text-lg text-[#8D99AE]">
                Doğrusu: <strong className="text-[#073B4C]">{currentExercise?.word}</strong>
              </p>
            )}
            
            <div className="flex gap-4 mt-4">
              {feedback.type === 'error' && (
                <button
                  onClick={tryAgain}
                  data-testid="try-again-btn"
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Tekrar Dene
                </button>
              )}
              <button
                onClick={nextExercise}
                data-testid="next-btn"
                className="btn-primary flex items-center gap-2"
              >
                {currentIndex < exercises.length - 1 ? (
                  <>
                    Sonraki
                    <SkipForward className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    Bitir
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session stats */}
      <footer className="bg-white px-4 py-4 border-t border-[#E0F7FA]">
        <div className="max-w-4xl mx-auto flex justify-center gap-8">
          <div className="text-center">
            <p className="text-sm text-[#8D99AE]">Doğru</p>
            <p className="text-2xl font-black text-[#06D6A0]">{sessionStats.correct}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-[#8D99AE]">Toplam</p>
            <p className="text-2xl font-black text-[#073B4C]">{sessionStats.total}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-[#8D99AE]">Başarı</p>
            <p className="text-2xl font-black text-[#FFD166]">
              %{sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ExercisePage;
