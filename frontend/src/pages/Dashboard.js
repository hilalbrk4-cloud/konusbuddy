import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { 
  Mic, LogOut, Trophy, Target, Flame, Star, 
  ChevronRight, BookOpen, BarChart3
} from "lucide-react";
import { Progress } from "../components/ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { user, logout, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, categoriesRes] = await Promise.all([
          axios.get(`${API}/stats`, { headers: getAuthHeaders() }),
          axios.get(`${API}/categories`, { headers: getAuthHeaders() })
        ]);
        setStats(statsRes.data);
        setCategories(categoriesRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getAuthHeaders]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F9FF] flex items-center justify-center">
        <div className="animate-bounce-in">
          <div className="w-20 h-20 bg-[#4CC9F0] rounded-full flex items-center justify-center">
            <span className="text-4xl">🎯</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F9FF]">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#4CC9F0] rounded-2xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-[#073B4C]" />
            </div>
            <span className="text-2xl font-black text-[#073B4C] font-['Nunito']">KonuşBuddy</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/progress"
              data-testid="progress-link"
              className="flex items-center gap-2 text-[#118AB2] font-semibold hover:text-[#073B4C] transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="hidden md:inline">İlerleme</span>
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="flex items-center gap-2 text-[#EF476F] font-semibold hover:text-[#D63F62] transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-[#073B4C] font-['Nunito']">
            Merhaba, {user?.name}! 👋
          </h1>
          <p className="text-[#118AB2] text-lg mt-2">
            Bugün konuşma egzersizi yapmaya hazır mısın?
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-md border-l-8 border-[#4CC9F0]" data-testid="stat-attempts">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-6 h-6 text-[#4CC9F0]" />
              <span className="text-sm text-[#8D99AE] font-medium">Toplam Deneme</span>
            </div>
            <p className="text-3xl font-black text-[#073B4C]">{stats?.total_attempts || 0}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border-l-8 border-[#06D6A0]" data-testid="stat-correct">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-6 h-6 text-[#06D6A0]" />
              <span className="text-sm text-[#8D99AE] font-medium">Doğru</span>
            </div>
            <p className="text-3xl font-black text-[#073B4C]">{stats?.correct_attempts || 0}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border-l-8 border-[#FFD166]" data-testid="stat-accuracy">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-6 h-6 text-[#FFD166]" />
              <span className="text-sm text-[#8D99AE] font-medium">Başarı</span>
            </div>
            <p className="text-3xl font-black text-[#073B4C]">%{stats?.accuracy_percentage || 0}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border-l-8 border-[#EF476F]" data-testid="stat-streak">
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-6 h-6 text-[#EF476F]" />
              <span className="text-sm text-[#8D99AE] font-medium">Seri</span>
            </div>
            <p className="text-3xl font-black text-[#073B4C]">{stats?.streak_days || 0} gün</p>
          </div>
        </div>

        {/* Difficulty Levels */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#073B4C] font-['Nunito'] mb-4 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#4CC9F0]" />
            Egzersiz Seviyeleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Easy */}
            <Link
              to="/exercise/easy"
              data-testid="level-easy"
              className="bg-white rounded-3xl p-6 shadow-md border-b-8 border-[#06D6A0] hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-16 bg-[#06D6A0]/20 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">🌱</span>
                </div>
                <ChevronRight className="w-8 h-8 text-[#06D6A0] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-[#073B4C] mb-2">Kolay</h3>
              <p className="text-[#8D99AE] text-sm mb-4">Basit kelimeler</p>
              <div className="flex items-center gap-2">
                <Progress value={(stats?.easy_completed || 0) / 20 * 100} className="h-3 flex-1" />
                <span className="text-sm font-bold text-[#06D6A0]">{stats?.easy_completed || 0}/20</span>
              </div>
            </Link>

            {/* Medium */}
            <Link
              to="/exercise/medium"
              data-testid="level-medium"
              className="bg-white rounded-3xl p-6 shadow-md border-b-8 border-[#FFD166] hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-16 bg-[#FFD166]/20 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">🌿</span>
                </div>
                <ChevronRight className="w-8 h-8 text-[#FFD166] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-[#073B4C] mb-2">Orta</h3>
              <p className="text-[#8D99AE] text-sm mb-4">Çok heceli kelimeler</p>
              <div className="flex items-center gap-2">
                <Progress value={(stats?.medium_completed || 0) / 20 * 100} className="h-3 flex-1" />
                <span className="text-sm font-bold text-[#FFD166]">{stats?.medium_completed || 0}/20</span>
              </div>
            </Link>

            {/* Hard */}
            <Link
              to="/exercise/hard"
              data-testid="level-hard"
              className="bg-white rounded-3xl p-6 shadow-md border-b-8 border-[#EF476F] hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-16 bg-[#EF476F]/20 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">🌳</span>
                </div>
                <ChevronRight className="w-8 h-8 text-[#EF476F] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-[#073B4C] mb-2">Zor</h3>
              <p className="text-[#8D99AE] text-sm mb-4">Cümleler</p>
              <div className="flex items-center gap-2">
                <Progress value={(stats?.hard_completed || 0) / 20 * 100} className="h-3 flex-1" />
                <span className="text-sm font-bold text-[#EF476F]">{stats?.hard_completed || 0}/20</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-2xl font-bold text-[#073B4C] font-['Nunito'] mb-4 flex items-center gap-2">
            <Star className="w-6 h-6 text-[#FFD166]" />
            Kategoriler
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => {
              const catProgress = stats?.categories_progress?.[category.id] || { total: 0, correct: 0, percentage: 0 };
              return (
                <Link
                  key={category.id}
                  to={`/exercises?category=${category.id}`}
                  data-testid={`category-${category.id}`}
                  className="card-category"
                >
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    {category.icon}
                  </div>
                  <span className="font-bold text-[#073B4C]">{category.name}</span>
                  <span className="text-sm text-[#8D99AE]">
                    {catProgress.correct}/{catProgress.total}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Start Button */}
        <div className="fixed bottom-8 right-8">
          <Link
            to="/exercises"
            data-testid="quick-start-btn"
            className="w-16 h-16 bg-[#EF476F] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <Mic className="w-8 h-8 text-white" />
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
