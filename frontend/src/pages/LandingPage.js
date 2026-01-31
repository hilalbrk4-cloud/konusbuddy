import { Link } from "react-router-dom";
import { Mic, Volume2, Star, Trophy, Users, Heart } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#F0F9FF]">
      {/* Header */}
      <header className="px-4 py-4 md:px-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#4CC9F0] rounded-2xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-[#073B4C]" />
            </div>
            <span className="text-2xl font-black text-[#073B4C] font-['Nunito']">KonuşBuddy</span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/login" 
              data-testid="login-link"
              className="px-6 py-3 text-[#073B4C] font-bold text-lg hover:bg-white/50 rounded-full transition-all"
            >
              Giriş Yap
            </Link>
            <Link 
              to="/register" 
              data-testid="register-link"
              className="btn-primary"
            >
              Başla
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="px-4 py-12 md:py-24 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-8 md:gap-16">
          {/* Text Content */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-black text-[#073B4C] font-['Nunito'] leading-tight mb-6">
              Konuşmayı
              <span className="text-[#4CC9F0]"> Eğlenerek </span>
              Öğren!
            </h1>
            <p className="text-xl text-[#118AB2] font-medium mb-8 max-w-xl">
              Çocuklar için tasarlanmış eğlenceli konuşma terapisi egzersizleri. 
              Sesli geri bildirimlerle doğru telaffuzu öğren!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link 
                to="/register" 
                data-testid="hero-start-btn"
                className="btn-primary text-center"
              >
                Ücretsiz Başla
              </Link>
              <Link 
                to="/login" 
                data-testid="hero-login-btn"
                className="btn-secondary text-center"
              >
                Hesabım Var
              </Link>
            </div>
          </div>
          
          {/* Hero Image - Modern, çocuk yüzü içermeyen illüstrasyon */}
          <div className="flex-1 relative">
            <div className="relative bg-gradient-to-br from-[#4CC9F0]/20 to-[#9B5DE5]/20 rounded-3xl p-8 max-w-lg mx-auto">
              {/* Abstract Speech Therapy Illustration */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#FFD166] rounded-2xl p-4 flex items-center justify-center animate-float shadow-lg">
                  <span className="text-4xl">🎯</span>
                </div>
                <div className="bg-[#4CC9F0] rounded-2xl p-4 flex items-center justify-center animate-float shadow-lg" style={{ animationDelay: '0.3s' }}>
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <div className="bg-[#06D6A0] rounded-2xl p-4 flex items-center justify-center animate-float shadow-lg" style={{ animationDelay: '0.6s' }}>
                  <span className="text-4xl">⭐</span>
                </div>
              </div>
              
              {/* Word Cards Preview */}
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-[#F0F9FF] rounded-xl flex items-center justify-center">
                    <span className="text-3xl">🐱</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#073B4C]">Kedi</p>
                    <p className="text-sm text-[#8D99AE]">Ke-di</p>
                  </div>
                  <Volume2 className="w-8 h-8 text-[#4CC9F0] ml-auto" />
                </div>
                <div className="flex gap-2">
                  <span className="bg-[#06D6A0]/20 text-[#06D6A0] px-3 py-1 rounded-full text-sm font-bold">Kolay</span>
                  <span className="bg-[#4CC9F0]/20 text-[#4CC9F0] px-3 py-1 rounded-full text-sm font-bold">Hayvanlar</span>
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-[#FFD166] rounded-2xl flex items-center justify-center animate-float shadow-lg">
                <Star className="w-8 h-8 text-[#073B4C]" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[#06D6A0] rounded-2xl flex items-center justify-center animate-float shadow-lg" style={{ animationDelay: '0.5s' }}>
                <Trophy className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 md:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#073B4C] font-['Nunito'] mb-12">
            Neden KonuşBuddy?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card-category cursor-default">
              <div className="w-20 h-20 bg-[#4CC9F0]/20 rounded-full flex items-center justify-center">
                <Mic className="w-10 h-10 text-[#4CC9F0]" />
              </div>
              <h3 className="text-xl font-bold text-[#073B4C]">Sesli Egzersizler</h3>
              <p className="text-[#118AB2] text-center">
                Kelimeleri dinle ve tekrar et. Anında geri bildirim al!
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="card-category cursor-default">
              <div className="w-20 h-20 bg-[#FFD166]/20 rounded-full flex items-center justify-center">
                <Volume2 className="w-10 h-10 text-[#FFD166]" />
              </div>
              <h3 className="text-xl font-bold text-[#073B4C]">Net Telaffuz</h3>
              <p className="text-[#118AB2] text-center">
                Her kelime için doğru telaffuzu sesli olarak öğren.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="card-category cursor-default">
              <div className="w-20 h-20 bg-[#06D6A0]/20 rounded-full flex items-center justify-center">
                <Star className="w-10 h-10 text-[#06D6A0]" />
              </div>
              <h3 className="text-xl font-bold text-[#073B4C]">İlerleme Takibi</h3>
              <p className="text-[#118AB2] text-center">
                Gelişimini takip et ve başarılarını kutla!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Difficulty Levels */}
      <section className="px-4 py-16 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#073B4C] font-['Nunito'] mb-4">
            Her Seviyeye Uygun
          </h2>
          <p className="text-xl text-[#118AB2] text-center mb-12 max-w-2xl mx-auto">
            Kolay, Orta ve Zor seviyelerle kendi hızında ilerle
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-8 border-l-8 border-[#06D6A0] shadow-lg">
              <span className="text-4xl mb-4 block">🌱</span>
              <h3 className="text-2xl font-bold text-[#073B4C] mb-2">Kolay</h3>
              <p className="text-[#118AB2]">Basit kelimeler: Kedi, Top, Elma...</p>
            </div>
            
            <div className="bg-white rounded-3xl p-8 border-l-8 border-[#FFD166] shadow-lg">
              <span className="text-4xl mb-4 block">🌿</span>
              <h3 className="text-2xl font-bold text-[#073B4C] mb-2">Orta</h3>
              <p className="text-[#118AB2]">Çok heceli: Kelebek, Televizyon...</p>
            </div>
            
            <div className="bg-white rounded-3xl p-8 border-l-8 border-[#EF476F] shadow-lg">
              <span className="text-4xl mb-4 block">🌳</span>
              <h3 className="text-2xl font-bold text-[#073B4C] mb-2">Zor</h3>
              <p className="text-[#118AB2]">Cümleler: "Günaydın anne"...</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-16 md:px-8 bg-[#073B4C]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#4CC9F0] font-['Nunito']">60+</div>
              <div className="text-white/80 mt-2">Kelime & Cümle</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#FFD166] font-['Nunito']">6</div>
              <div className="text-white/80 mt-2">Kategori</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#06D6A0] font-['Nunito']">3</div>
              <div className="text-white/80 mt-2">Zorluk Seviyesi</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#EF476F] font-['Nunito']">
                <Heart className="w-12 h-12 mx-auto" />
              </div>
              <div className="text-white/80 mt-2">Çocuk Dostu</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#073B4C] font-['Nunito'] mb-6">
            Hemen Başla!
          </h2>
          <p className="text-xl text-[#118AB2] mb-8">
            Ücretsiz hesap oluştur ve konuşma egzersizlerine başla
          </p>
          <Link 
            to="/register" 
            data-testid="cta-start-btn"
            className="btn-accent inline-block"
          >
            Ücretsiz Kayıt Ol
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 md:px-8 bg-white border-t border-[#E0F7FA]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#4CC9F0] rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-[#073B4C]" />
            </div>
            <span className="text-xl font-bold text-[#073B4C]">KonuşBuddy</span>
          </div>
          <p className="text-[#8D99AE] text-center">
            © 2024 KonuşBuddy. Çocuklar için konuşma terapisi.
          </p>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#118AB2]" />
            <span className="text-[#118AB2]">4-10 yaş</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
