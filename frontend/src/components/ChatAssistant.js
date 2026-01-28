import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { 
  MessageCircle, Send, X, Trash2, Bot, User, 
  Volume2, Loader2, Sparkles
} from "lucide-react";
import { Button } from "./ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ChatAssistant = () => {
  const { user, getAuthHeaders } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat history on mount
  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`${API}/chat/history`, {
        headers: getAuthHeaders()
      });
      if (response.data.messages && response.data.messages.length > 0) {
        setMessages(response.data.messages);
      } else {
        // Add welcome message if no history
        setMessages([{
          role: "assistant",
          content: `Merhaba ${user?.name || "arkadaşım"}! 👋 Ben KonuşBuddy, seninle sohbet etmek için buradayım! Ne hakkında konuşmak istersin?`
        }]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setMessages([{
        role: "assistant",
        content: `Merhaba ${user?.name || "arkadaşım"}! 👋 Ben KonuşBuddy! Seninle konuşmayı çok isterim!`
      }]);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    
    // Add user message immediately
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await axios.post(
        `${API}/chat`,
        { message: userMessage },
        { headers: getAuthHeaders() }
      );

      setIsTyping(false);
      
      // Add AI response
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.response 
      }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Hmm, bir sorun oluştu. Tekrar dener misin? 🤔" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await axios.delete(`${API}/chat/history`, {
        headers: getAuthHeaders()
      });
      setMessages([{
        role: "assistant",
        content: `Yeni bir sohbete başlayalım ${user?.name || "arkadaşım"}! 🌟 Ne hakkında konuşmak istersin?`
      }]);
    } catch (error) {
      console.error("Error clearing chat:", error);
    }
  };

  const speakMessage = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        data-testid="chat-toggle-btn"
        className={`fixed bottom-8 left-8 w-16 h-16 bg-gradient-to-br from-[#9B5DE5] to-[#7B4BC4] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all z-40 ${isOpen ? 'hidden' : ''}`}
      >
        <MessageCircle className="w-8 h-8 text-white" />
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-[#06D6A0] rounded-full flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div 
          className="fixed bottom-4 left-4 w-[380px] h-[500px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 animate-bounce-in"
          data-testid="chat-window"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#9B5DE5] to-[#7B4BC4] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">KonuşBuddy</h3>
                <p className="text-white/80 text-xs">Sohbet Asistanı</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                data-testid="clear-chat-btn"
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                title="Sohbeti Temizle"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                data-testid="close-chat-btn"
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8F9FF]">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-[#4CC9F0] text-[#073B4C]'
                      : 'bg-white border-2 border-[#E0E7FF] text-[#073B4C]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 bg-[#9B5DE5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => speakMessage(msg.content)}
                        className="w-6 h-6 bg-[#FFD166]/20 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#FFD166]/40 transition-colors"
                        title="Sesli Dinle"
                      >
                        <Volume2 className="w-3 h-3 text-[#073B4C]" />
                      </button>
                    )}
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 bg-[#073B4C]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-[#073B4C]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-[#E0E7FF] rounded-2xl p-3 flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#9B5DE5] rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#9B5DE5] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-[#9B5DE5] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[#9B5DE5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-[#E0E7FF]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Mesajını yaz..."
                data-testid="chat-input"
                className="flex-1 px-4 py-3 bg-[#F8F9FF] rounded-full border-2 border-transparent focus:border-[#9B5DE5] focus:outline-none text-sm font-medium"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                data-testid="send-message-btn"
                className="w-12 h-12 bg-[#9B5DE5] rounded-full flex items-center justify-center hover:bg-[#7B4BC4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
