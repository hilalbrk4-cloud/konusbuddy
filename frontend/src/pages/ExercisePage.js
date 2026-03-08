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

// ─── Levenshtein mesafesi ───────────────────────────────────────────────────
const levenshteinDistance = (str1, str2) => {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = str1[i - 1] === str2[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
    }
  }
  return dp[m][n];
};

// ─── Türkçe karakter düzeltme haritası ─────────────────────────────────────
// Mobil Chrome, konuşma tanımada Türkçe karakterleri bazen ASCII'ye dönüştürür.
// Örn: "ü" → "u", "ı" → "i", "ş" → "s" gibi. Bu harita geri çevirir.
const turkishCharMap = {
  "u": ["ü", "u"],
  "i": ["ı", "i", "İ", "I"],
  "s": ["ş", "s"],
  "g": ["ğ", "g"],
  "o": ["ö", "o"],
  "c": ["ç", "c"],
};

// Söylenen metni hedef kelimeyle karşılaştırırken Türkçe karakter toleransı uygula
const normalizeForComparison = (text) => {
  return text
    .toLowerCase()
    .replace(/ü/g, "u")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/İ/g, "i")
    .replace(/I/g, "i");
};

// ─── Global AudioContext (mobil unlock için) ────────────────────────────────
// Mobil tarayıcılar sesi yalnızca kullanıcı dokunuşuyla başlatılan bir
// AudioContext üzerinden kabul eder. Bu nesneyi bir kez oluşturup saklarız.
let globalAudioContext = null;

const getAudioContext = () => {
  if (!globalAudioContext || globalAudioContext.state === "closed") {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) globalAudioContext = new AC();
  }
  return globalAudioContext;
};

// Dokunuş anında çağrılır → AudioContext'i "resumed" duruma getirir
const unlockAudioContext = async () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume();
  }
};

// ─── Ses çalma yardımcısı ───────────────────────────────────────────────────
// AudioContext üzerinden fetch + decodeAudioData ile çalar.
// Bu yöntem mobil Chrome/Safari'de HTML Audio'dan çok daha güvenilirdir.
const playSound = (path) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) {
        const audio = new Audio(path);
        audio.onended = resolve;
        audio.onerror = () => reject(new Error("Audio load failed"));
        audio.play().catch(reject);
        return;
      }

      if (ctx.state === "suspended") await ctx.resume();

      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = resolve;
      source.start(0);
    } catch (err) {
      console.warn("playSound hatası, TTS'e düşülüyor:", err);
      reject(err); // .catch() tetiklensin → TTS devreye girsin
    }
  });
};

// ─── Ana Bileşen ────────────────────────────────────────────────────────────
const ExercisePage = () => {
  const { difficulty } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  const [exercises, setExercises] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  const recognitionRef = useRef(null);
  const isProcessingRef = useRef(false); // ref kullanıyoruz: render'dan bağımsız kilit
  const [showWarning, setShowWarning] = useState(true); // İlk açılışta uyarı göster

  // ── Egzersizleri çek ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const res = await axios.get(`${API}/exercises?difficulty=${difficulty}`, {
          headers: getAuthHeaders()
        });
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

  // ── Konuşma tanıma (Speech Recognition) ────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "tr-TR";
    recognition.maxAlternatives = 5;

    recognition.onresult = (event) => {
      const results = event.results[event.results.length - 1];
      // Tüm alternatifleri topla — hedefle eşleşen varsa onu seç
      const alternatives = [];
      for (let i = 0; i < results.length; i++) {
        alternatives.push(results[i].transcript.toLowerCase().trim());
      }
      // currentExercise'e burada erişemeyiz, tüm alternatifleri gönder
      // Analiz tarafında en iyi eşleşmeyi seçeceğiz
      setSpokenText(alternatives.join("||"));
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast.error("Mikrofon izni gerekli! Lütfen tarayıcı ayarlarından izin verin.");
      } else if (event.error === "no-speech") {
        toast.info("Ses algılanamadı, tekrar deneyin.");
      } else if (event.error === "network") {
        toast.error("Ağ hatası. İnternet bağlantınızı kontrol edin.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const currentExercise = exercises[currentIndex];

  // ── Kelimeyi seslendir ──────────────────────────────────────────────────
  const speakWord = useCallback(() => {
    if (!currentExercise) return;

    // Mobilde en güvenilir yöntem: doğrudan SpeechSynthesis
    // new Audio() mobil Chrome'da kullanıcı etkileşiminden kopuk çalışınca bloklanır.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentExercise.word);
    utterance.lang = "tr-TR";
    utterance.rate = 0.7;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, [currentExercise]);

  // ── Mikrofon başlat / durdur ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!recognitionRef.current || isListening || isProcessingRef.current) return;

    // ⭐ KRİTİK: Kullanıcı dokunuşu anında AudioContext'i unlock et.
    // Bu çağrı olmadan mobil tarayıcı sonraki sesleri bloklar.
    await unlockAudioContext();

    // Mobilde ses çalarken tanıma başlatma — çakışmayı önle
    window.speechSynthesis.cancel();

    setSpokenText("");
    setFeedback(null);
    setIsListening(true);

    // Grammar: motora sadece egzersiz kelimelerini tanımasını söyle
    try {
      const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      if (SpeechGrammarList && currentExercise) {
        const words = exercises.map(e => e.word).join(" | ");
        const grammar = `#JSGF V1.0; grammar words; public <word> = ${words};`;
        const grammarList = new SpeechGrammarList();
        grammarList.addFromString(grammar, 1);
        recognitionRef.current.grammars = grammarList;
      }
    } catch (_) {}

    try {
      recognitionRef.current.start();
    } catch (err) {
      recognitionRef.current.abort();
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch (_) {}
      }, 200);
    }
  }, [isListening, currentExercise, exercises]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  // ── Cevap analizi ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!spokenText || isProcessingRef.current || !currentExercise) return;

    const runAnalysis = async () => {
      isProcessingRef.current = true;

      // Herhangi bir aktif sesi durdur
      window.speechSynthesis.cancel();

      const target = currentExercise.word.toLowerCase().trim();
      // Alternatifleri ayır (|| ile birleştirilmişti)
      const allAlternatives = spokenText.split("||").map(s => s.trim());
      // Hedefle eşleşen alternatif varsa onu kullan, yoksa ilkini al
      const normalTarget = normalizeForComparison(target);
      const matchingAlt = allAlternatives.find(a =>
        a === target || normalizeForComparison(a) === normalTarget
      );
      const spoken = matchingAlt || allAlternatives[0];
      const dist = levenshteinDistance(target, spoken);

      // Doğruluk kriteri: tam eşleşme veya normalize eşleşme
      const normalSpoken = normalizeForComparison(spoken);

const isCorrect = spoken === target || normalSpoken === normalTarget;

      if (isCorrect) {
        setFeedback({ type: "success", message: "Harika! Çok güzel söyledin! 🌟" });
        // Önce geri bildirim sesini çal, sonra kilidi kaldır
        await playSound("/sounds/harika.mp3");
      } else {
        setFeedback({ type: "error", message: "Hadi bir daha dene, yapabilirsin! 💪" });
        await playSound("/sounds/tekrar.mp3");
      }

      setSessionStats(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1
      }));

      // Sesi oynatma bittikten sonra kilidi kaldır
      isProcessingRef.current = false;
    };

    runAnalysis();
  }, [spokenText, currentExercise]);

  // ── Sonraki egzersiz ─────────────────────────────────────────────────────
  const nextExercise = useCallback(() => {
    setFeedback(null);
    setSpokenText("");
    isProcessingRef.current = false;

    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      toast.success(`Tebrikler! ${sessionStats.correct}/${sessionStats.total} doğru!`);
      navigate("/dashboard");
    }
  }, [currentIndex, exercises.length, sessionStats, navigate]);

  const tryAgain = useCallback(() => {
    setFeedback(null);
    setSpokenText("");
    isProcessingRef.current = false;
  }, []);

  // ── Yardımcılar ──────────────────────────────────────────────────────────
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

  // ── Yükleniyor ───────────────────────────────────────────────────────────
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
          <Link to="/dashboard" className="btn-primary">Ana Sayfaya Dön</Link>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
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
          {/* Kelime Kartı */}
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

          {/* Söylenen metin */}
          {spokenText && (
            <div className="bg-white rounded-2xl p-4 mb-6 text-center shadow-md">
              <p className="text-sm text-[#8D99AE] mb-1">Sen söyledin:</p>
              <p className="text-2xl font-bold text-[#073B4C]">{spokenText}</p>
            </div>
          )}



          {/* Kontroller */}
          <div className="flex justify-center gap-6 mb-8">
            {/* Dinle */}
            <button
              onClick={speakWord}
              data-testid="listen-btn"
              className="w-20 h-20 bg-[#FFD166] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              title="Dinle"
            >
              <Volume2 className="w-10 h-10 text-[#073B4C]" />
            </button>

            {/* Mikrofon */}
            <button
              onClick={isListening ? stopListening : startListening}
              data-testid="mic-btn"
              className={`mic-button ${isListening ? "listening" : ""}`}
              title={isListening ? "Dinleniyor..." : "Konuş"}
            >
              {isListening
                ? <MicOff className="w-16 h-16 text-white" />
                : <Mic className="w-16 h-16 text-white" />
              }
            </button>

            {/* Atla */}
            <button
              onClick={nextExercise}
              data-testid="skip-btn"
              className="w-20 h-20 bg-[#4CC9F0] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              title="Atla"
            >
              <SkipForward className="w-10 h-10 text-[#073B4C]" />
            </button>
          </div>

          {/* Dinleniyor göstergesi */}
          {isListening && (
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-[#06D6A0] text-white px-6 py-3 rounded-full animate-pulse">
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" />
                <span className="font-bold">Dinliyorum...</span>
              </div>
            </div>
          )}

          {/* Tarayıcı desteği uyarısı */}
          {!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window) && (
            <div className="bg-[#EF476F]/10 border-2 border-[#EF476F] rounded-2xl p-4 text-center">
              <p className="text-[#EF476F] font-medium">
                Tarayıcınız ses tanımayı desteklemiyor. Lütfen Chrome kullanın.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* İlk açılış uyarı popup'ı */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-[#FFD166]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">⚠️</span>
              </div>
              <h3 className="text-xl font-black text-[#073B4C] mb-2">Bilgilendirme</h3>
              <p className="text-[#8D99AE] text-sm leading-relaxed">
                Bu uygulama ses tanıma için Google'ın teknolojisini kullanmaktadır. 
                Bazı benzer sesler (örn. <strong className="text-[#073B4C]">t/k, p/b</strong>) 
                otomatik olarak düzeltilebilir ve yanlış telaffuz doğru kabul edilebilir.
                <br /><br />
                Bu nedenle <strong className="text-[#073B4C]">terapist değerlendirmesi</strong> her zaman gereklidir.
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-[#06D6A0] text-white font-bold py-3 rounded-2xl hover:bg-[#05c090] transition-colors"
            >
              Anladım, Devam Et
            </button>
          </div>
        </div>
      )}

      {/* Geri Bildirim Modalı */}
      {feedback && (
        <div className="feedback-overlay" data-testid="feedback-modal">
          <div className={`feedback-modal ${feedback.type}`}>
            {feedback.type === "success" ? (
              <CheckCircle className="w-24 h-24 text-[#06D6A0]" />
            ) : feedback.type === "close" ? (
              <div className="w-24 h-24 bg-[#FFD166] rounded-full flex items-center justify-center">
                <span className="text-5xl">💪</span>
              </div>
            ) : (
              <XCircle className="w-24 h-24 text-[#EF476F]" />
            )}

            <h3 className="text-2xl font-black text-[#073B4C] text-center">
              {feedback.message}
            </h3>

            {feedback.type === "error" && (
              <p className="text-lg text-[#8D99AE]">
                Doğrusu: <strong className="text-[#073B4C]">{currentExercise?.word}</strong>
              </p>
            )}
            {feedback.type === "close" && (
              <p className="text-lg text-[#8D99AE]">
                Hedef kelime: <strong className="text-[#073B4C]">{currentExercise?.word}</strong>
              </p>
            )}

            <div className="flex gap-4 mt-4">
              {(feedback.type === "error" || feedback.type === "close") && (
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
                {(exercises.length === 0 || currentIndex < exercises.length - 1) ? (
                  <><span>Sonraki</span><SkipForward className="w-5 h-5" /></>
                ) : (
                  <><span>Bitir</span><CheckCircle className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer — Seans istatistikleri */}
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
              %{sessionStats.total > 0
                ? Math.round((sessionStats.correct / sessionStats.total) * 100)
                : 0}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ExercisePage;