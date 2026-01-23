import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import ExerciseSelect from "./pages/ExerciseSelect";
import ExercisePage from "./pages/ExercisePage";
import ProgressPage from "./pages/ProgressPage";
import "./App.css";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
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
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
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
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#073B4C',
              color: 'white',
              borderRadius: '1rem',
              fontSize: '1.1rem',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: '600',
              padding: '1rem 1.5rem',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/exercises" element={<ProtectedRoute><ExerciseSelect /></ProtectedRoute>} />
          <Route path="/exercise/:difficulty" element={<ProtectedRoute><ExercisePage /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
