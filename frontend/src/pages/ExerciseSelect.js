import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { ArrowLeft, Mic, Volume2, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ExerciseSelect = () => {
  const { getAuthHeaders } = useAuth();
  const [searchParams] = useSearchParams();
  const [exercises, setExercises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [difficulties] = useState([
    { id: "easy", name: "Kolay", color: "#06D6A0" },
    { id: "medium", name: "Orta", color: "#FFD166" },
    { id: "hard", name: "Zor", color: "#EF476F" },
  ]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${API}/categories`, { headers: getAuthHeaders() });
        setCategories(res.data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, [getAuthHeaders]);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoading(true);
      try {
        let url = `${API}/exercises`;
        const params = new URLSearchParams();
        if (selectedCategory) params.append("category", selectedCategory);
        if (selectedDifficulty) params.append("difficulty", selectedDifficulty);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await axios.get(url, { headers: getAuthHeaders() });
        setExercises(res.data);
      } catch (error) {
        console.error("Error fetching exercises:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, [selectedCategory, selectedDifficulty, getAuthHeaders]);

  const speakWord = (word) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
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
            <h1 className="text-2xl font-bold text-[#073B4C] font-['Nunito']">Egzersizler</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  data-testid="category-filter"
                  className="rounded-xl border-2 border-[#E0F7FA] hover:border-[#4CC9F0]"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : "Kategori"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-xl">
                <DropdownMenuItem onClick={() => setSelectedCategory("")}>
                  Tümü
                </DropdownMenuItem>
                {categories.map((cat) => (
                  <DropdownMenuItem 
                    key={cat.id} 
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.icon} {cat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Difficulty Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  data-testid="difficulty-filter"
                  className="rounded-xl border-2 border-[#E0F7FA] hover:border-[#4CC9F0]"
                >
                  {selectedDifficulty ? getDifficultyName(selectedDifficulty) : "Seviye"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-xl">
                <DropdownMenuItem onClick={() => setSelectedDifficulty("")}>
                  Tümü
                </DropdownMenuItem>
                {difficulties.map((diff) => (
                  <DropdownMenuItem 
                    key={diff.id} 
                    onClick={() => setSelectedDifficulty(diff.id)}
                  >
                    <span 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: diff.color }}
                    />
                    {diff.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        {/* Quick Start by Difficulty */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {difficulties.map((diff) => (
            <Link
              key={diff.id}
              to={`/exercise/${diff.id}`}
              data-testid={`start-${diff.id}`}
              className="bg-white rounded-2xl p-6 flex items-center gap-4 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
              style={{ borderLeft: `6px solid ${diff.color}` }}
            >
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${diff.color}20` }}
              >
                <Mic className="w-7 h-7" style={{ color: diff.color }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#073B4C]">{diff.name} Egzersiz</h3>
                <p className="text-sm text-[#8D99AE]">Hemen başla →</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Exercise Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-16 h-16 bg-[#4CC9F0] rounded-full animate-bounce flex items-center justify-center">
              <Mic className="w-8 h-8 text-white" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                data-testid={`exercise-card-${exercise.id}`}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all group"
              >
                <div className="relative aspect-square">
                  <img 
                    src={exercise.image_url} 
                    alt={exercise.word}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord(exercise.word);
                    }}
                    data-testid={`speak-${exercise.id}`}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all"
                  >
                    <Volume2 className="w-5 h-5 text-[#4CC9F0]" />
                  </button>
                  <span 
                    className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: getDifficultyColor(exercise.difficulty) }}
                  >
                    {getDifficultyName(exercise.difficulty)}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold text-[#073B4C] mb-1">{exercise.word}</h3>
                  {exercise.pronunciation_hint && (
                    <p className="text-sm text-[#8D99AE]">{exercise.pronunciation_hint}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && exercises.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-[#FFD166]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔍</span>
            </div>
            <h3 className="text-xl font-bold text-[#073B4C] mb-2">Egzersiz Bulunamadı</h3>
            <p className="text-[#8D99AE]">Filtreleri değiştirmeyi deneyin</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExerciseSelect;
