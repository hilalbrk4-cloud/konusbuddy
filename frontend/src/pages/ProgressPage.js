import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { 
  ArrowLeft, CheckCircle, XCircle, Calendar, 
  TrendingUp, Award, Mic
} from "lucide-react";
import { Progress } from "../components/ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProgressPage = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          axios.get(`${API}/stats`, { headers: getAuthHeaders() }),
          axios.get(`${API}/progress?limit=50`, { headers: getAuthHeaders() })
        ]);
        setStats(statsRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getAuthHeaders]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy": return "#06D6A0";
      case "medium": return "#FFD166";
      case "hard": return "#EF476F";
      default: return "#4CC9F0";
    }
  };

  const getDifficultyName = (difficulty) => {
    switch (difficulty) {
      case "easy": return "Kolay";
      case "medium": return "Orta";
      case "hard": return "Zor";
      default: return difficulty;
    }
  };

  const getCategoryName = (category) => {
    const names = {
      animals: "Hayvanlar",
      colors: "Renkler",
      objects: "Objeler",
      foods: "Yiyecekler",
      body_parts: "Vücut",
      phrases: "Cümleler"
    };
    return names[category] || category;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F9FF] flex items-center justify-center">
        <div className="animate-bounce-in">
          <div className="w-20 h-20 bg-[#4CC9F0] rounded-full flex items-center justify-center">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F9FF]">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-4 md:px-8 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              data-testid="back-to-dashboard"
              className="w-12 h-12 bg-[#F0F9FF] rounded-xl flex items-center justify-center hover:bg-[#E0F7FA] transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-[#073B4C]" />
            </Link>
            <h1 className="text-2xl font-bold text-[#073B4C] font-['Nunito']">İlerleme Takibi</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md text-center" data-testid="stat-total">
            <Award className="w-10 h-10 text-[#4CC9F0] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#073B4C]">{stats?.total_attempts || 0}</p>
            <p className="text-sm text-[#8D99AE]">Toplam Deneme</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md text-center" data-testid="stat-correct-total">
            <CheckCircle className="w-10 h-10 text-[#06D6A0] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#073B4C]">{stats?.correct_attempts || 0}</p>
            <p className="text-sm text-[#8D99AE]">Doğru Cevap</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md text-center" data-testid="stat-accuracy-total">
            <TrendingUp className="w-10 h-10 text-[#FFD166] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#073B4C]">%{stats?.accuracy_percentage || 0}</p>
            <p className="text-sm text-[#8D99AE]">Başarı Oranı</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md text-center" data-testid="stat-streak-total">
            <Calendar className="w-10 h-10 text-[#EF476F] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#073B4C]">{stats?.streak_days || 0}</p>
            <p className="text-sm text-[#8D99AE]">Gün Serisi</p>
          </div>
        </div>

        {/* Difficulty Progress */}
        <div className="bg-white rounded-3xl p-6 shadow-md mb-8">
          <h2 className="text-xl font-bold text-[#073B4C] mb-6">Seviye İlerlemesi</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-[#073B4C]">🌱 Kolay</span>
                <span className="text-[#06D6A0] font-bold">{stats?.easy_completed || 0} doğru</span>
              </div>
              <Progress value={((stats?.easy_completed || 0) / 20) * 100} className="h-4" />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-[#073B4C]">🌿 Orta</span>
                <span className="text-[#FFD166] font-bold">{stats?.medium_completed || 0} doğru</span>
              </div>
              <Progress value={((stats?.medium_completed || 0) / 20) * 100} className="h-4" />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-[#073B4C]">🌳 Zor</span>
                <span className="text-[#EF476F] font-bold">{stats?.hard_completed || 0} doğru</span>
              </div>
              <Progress value={((stats?.hard_completed || 0) / 20) * 100} className="h-4" />
            </div>
          </div>
        </div>

        {/* Category Progress */}
        <div className="bg-white rounded-3xl p-6 shadow-md mb-8">
          <h2 className="text-xl font-bold text-[#073B4C] mb-6">Kategori İlerlemesi</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats?.categories_progress && Object.entries(stats.categories_progress).map(([key, value]) => (
              <div key={key} className="bg-[#F0F9FF] rounded-2xl p-4 text-center">
                <h3 className="font-semibold text-[#073B4C] mb-2">{getCategoryName(key)}</h3>
                <p className="text-2xl font-black text-[#4CC9F0]">
                  {value.correct}/{value.total}
                </p>
                <p className="text-sm text-[#8D99AE]">
                  %{Math.round(value.percentage)} başarı
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent History */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <h2 className="text-xl font-bold text-[#073B4C] mb-6">Son Aktiviteler</h2>
          
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-[#F0F9FF] rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-10 h-10 text-[#4CC9F0]" />
              </div>
              <p className="text-[#8D99AE]">Henüz egzersiz yapmadın</p>
              <Link to="/exercises" className="btn-primary inline-block mt-4">
                Egzersize Başla
              </Link>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div 
                  key={item.id}
                  data-testid={`history-item-${item.id}`}
                  className={`flex items-center gap-4 p-4 rounded-2xl ${
                    item.is_correct ? 'bg-[#06D6A0]/10' : 'bg-[#EF476F]/10'
                  }`}
                >
                  {item.is_correct ? (
                    <CheckCircle className="w-8 h-8 text-[#06D6A0] flex-shrink-0" />
                  ) : (
                    <XCircle className="w-8 h-8 text-[#EF476F] flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#073B4C] truncate">{item.word}</p>
                    <p className="text-sm text-[#8D99AE] truncate">
                      Söylenen: "{item.spoken_word}"
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span 
                      className="inline-block px-2 py-1 rounded-full text-xs font-bold text-white mb-1"
                      style={{ backgroundColor: getDifficultyColor(item.difficulty) }}
                    >
                      {getDifficultyName(item.difficulty)}
                    </span>
                    <p className="text-xs text-[#8D99AE]">{formatDate(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProgressPage;
