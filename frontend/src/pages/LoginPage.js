import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Mic, Eye, EyeOff, ArrowLeft } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Lütfen tüm alanları doldurun");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Hoş geldin! 🎉");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Giriş yapılamadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F9FF] flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Link 
          to="/" 
          data-testid="back-to-home"
          className="inline-flex items-center gap-2 text-[#118AB2] font-semibold hover:text-[#073B4C] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Ana Sayfa
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#4CC9F0] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Mic className="w-10 h-10 text-[#073B4C]" />
            </div>
            <h1 className="text-3xl font-black text-[#073B4C] font-['Nunito']">
              Tekrar Hoş Geldin!
            </h1>
            <p className="text-[#118AB2] mt-2">Hesabına giriş yap</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-lg">
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">E-posta</label>
                <input
                  type="email"
                  data-testid="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-default"
                  placeholder="ornek@email.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    data-testid="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-default pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8D99AE] hover:text-[#073B4C]"
                  >
                    {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                data-testid="login-submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
              </button>
            </div>
          </form>

          {/* Register link */}
          <p className="text-center mt-6 text-[#118AB2]">
            Hesabın yok mu?{" "}
            <Link 
              to="/register" 
              data-testid="goto-register"
              className="text-[#4CC9F0] font-bold hover:underline"
            >
              Kayıt Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
