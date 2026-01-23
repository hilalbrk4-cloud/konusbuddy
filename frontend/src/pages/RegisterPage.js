import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Mic, Eye, EyeOff, ArrowLeft } from "lucide-react";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    parent_name: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Lütfen zorunlu alanları doldurun");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalı");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        age: formData.age ? parseInt(formData.age) : null,
        parent_name: formData.parent_name || null
      });
      toast.success("Kayıt başarılı! Hoş geldin! 🎉");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kayıt yapılamadı");
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
            <div className="w-20 h-20 bg-[#FFD166] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Mic className="w-10 h-10 text-[#073B4C]" />
            </div>
            <h1 className="text-3xl font-black text-[#073B4C] font-['Nunito']">
              Hesap Oluştur
            </h1>
            <p className="text-[#118AB2] mt-2">Konuşma egzersizlerine başla!</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-lg">
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">Çocuğun Adı *</label>
                <input
                  type="text"
                  name="name"
                  data-testid="register-name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-default"
                  placeholder="Ali"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">Yaş</label>
                <input
                  type="number"
                  name="age"
                  data-testid="register-age"
                  value={formData.age}
                  onChange={handleChange}
                  min="1"
                  max="15"
                  className="input-default"
                  placeholder="7"
                />
              </div>

              {/* Parent Name */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">Ebeveyn Adı</label>
                <input
                  type="text"
                  name="parent_name"
                  data-testid="register-parent"
                  value={formData.parent_name}
                  onChange={handleChange}
                  className="input-default"
                  placeholder="Ayşe Hanım"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">E-posta *</label>
                <input
                  type="email"
                  name="email"
                  data-testid="register-email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-default"
                  placeholder="ornek@email.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">Şifre *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    data-testid="register-password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-default pr-12"
                    placeholder="En az 6 karakter"
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

              {/* Confirm Password */}
              <div>
                <label className="block text-[#073B4C] font-bold mb-2">Şifre Tekrar *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  data-testid="register-confirm-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-default"
                  placeholder="Şifreyi tekrar girin"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                data-testid="register-submit"
                disabled={loading}
                className="btn-secondary w-full disabled:opacity-50"
              >
                {loading ? "Kayıt Yapılıyor..." : "Kayıt Ol"}
              </button>
            </div>
          </form>

          {/* Login link */}
          <p className="text-center mt-6 text-[#118AB2]">
            Zaten hesabın var mı?{" "}
            <Link 
              to="/login" 
              data-testid="goto-login"
              className="text-[#4CC9F0] font-bold hover:underline"
            >
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
