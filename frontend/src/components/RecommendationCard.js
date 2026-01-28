import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { Link } from "react-router-dom";
import { 
  Sparkles, AlertCircle, ChevronRight, Target, 
  TrendingUp, RefreshCw, Loader2, BookOpen
} from "lucide-react";
import { Progress } from "./ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RecommendationCard = () => {
  const { getAuthHeaders } = useAuth();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/recommendations`, {
        headers: getAuthHeaders()
      });
      setRecommendations(response.data);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError("Öneriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#9B5DE5]/10 to-[#4CC9F0]/10 rounded-3xl p-6 border-2 border-[#9B5DE5]/20">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#9B5DE5] animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-[#EF476F]/10 to-[#FFD166]/10 rounded-3xl p-6 border-2 border-[#EF476F]/20">
        <div className="flex items-center gap-3 text-[#EF476F]">
          <AlertCircle className="w-6 h-6" />
          <span className="font-medium">{error}</span>
          <button 
            onClick={fetchRecommendations}
            className="ml-auto p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (!recommendations) return null;

  return (
    <div className="bg-gradient-to-br from-[#9B5DE5]/10 to-[#4CC9F0]/10 rounded-3xl p-6 border-2 border-[#9B5DE5]/20" data-testid="recommendation-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#9B5DE5] rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[#073B4C]">Sana Özel Öneriler</h3>
            <p className="text-xs text-[#8D99AE]">AI tarafından hazırlandı</p>
          </div>
        </div>
        <button 
          onClick={fetchRecommendations}
          data-testid="refresh-recommendations"
          className="p-2 hover:bg-white/50 rounded-full transition-colors"
          title="Yenile"
        >
          <RefreshCw className="w-5 h-5 text-[#9B5DE5]" />
        </button>
      </div>

      {/* AI Analysis */}
      <div className="bg-white/60 rounded-2xl p-4 mb-4">
        <p className="text-[#073B4C] text-sm leading-relaxed">
          {recommendations.ai_analysis}
        </p>
      </div>

      {/* Struggling Words */}
      {recommendations.struggling_words && recommendations.struggling_words.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-[#073B4C] text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#EF476F]" />
            Pratik Gereken Kelimeler
          </h4>
          <div className="flex flex-wrap gap-2">
            {recommendations.struggling_words.slice(0, 5).map((word, idx) => (
              <div 
                key={idx}
                className="bg-white/80 px-3 py-1.5 rounded-full text-sm flex items-center gap-2"
              >
                <span className="font-medium text-[#073B4C]">{word.word}</span>
                <span className="text-xs text-[#EF476F]">%{word.success_rate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-3">
        <h4 className="font-semibold text-[#073B4C] text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#4CC9F0]" />
          Önerilen Egzersizler
        </h4>
        {recommendations.recommendations.map((rec, idx) => (
          <Link
            key={idx}
            to={`/exercise/${rec.difficulty}`}
            data-testid={`recommendation-${idx}`}
            className="block bg-white rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-bold text-[#073B4C]">{rec.title}</h5>
              <ChevronRight className="w-5 h-5 text-[#9B5DE5] group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-sm text-[#8D99AE] mb-2">{rec.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {rec.words.slice(0, 4).map((word, widx) => (
                <span 
                  key={widx}
                  className="bg-[#F0F9FF] px-2 py-0.5 rounded-full text-xs font-medium text-[#4CC9F0]"
                >
                  {word}
                </span>
              ))}
              {rec.words.length > 4 && (
                <span className="text-xs text-[#8D99AE]">+{rec.words.length - 4}</span>
              )}
            </div>
            <p className="text-xs text-[#9B5DE5] italic">{rec.reason}</p>
          </Link>
        ))}
      </div>

      {/* Encouragement */}
      <div className="mt-4 bg-[#06D6A0]/10 rounded-2xl p-3 flex items-center gap-3">
        <span className="text-2xl">💪</span>
        <p className="text-sm font-medium text-[#073B4C]">
          {recommendations.encouragement}
        </p>
      </div>
    </div>
  );
};

export default RecommendationCard;
