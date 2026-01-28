# KonuşBuddy - Konuşma Terapisi Uygulaması PRD

## Problem Statement
Özel gereksinimli ve konuşma bozukluğu olan çocuklar için dil konuşma terapisi egzersizleri yapabilecekleri bir web sayfası. Sesli yanıt ve kelimeyi sesli dinleme özelliği. Kelime doğru söylendiğinde olumlu dönüt, yanlış söylendiğinde uygun dönüt. Kullanıcı bilgileri saklanacak, ilerlemeler kaydedilecek. Kolay-Orta-Zor seviyeleri. Renkli arayüz.

## User Personas
1. **Çocuk (4-10 yaş)**: Konuşma bozukluğu olan, terapi egzersizleri yapması gereken çocuklar
2. **Ebeveyn**: Çocuklarının ilerlemesini takip etmek isteyen anne/babalar
3. **Terapist**: Çocuklara ev ödevi vermek isteyen konuşma terapistleri

## Core Requirements (Static)
- Web Speech API ile ses tanıma ve sentez (tarayıcı yerleşik)
- JWT tabanlı kullanıcı kayıt/giriş sistemi
- Türkçe kelime/cümle egzersizleri (60+ kelime)
- Kolay/Orta/Zor zorluk seviyeleri
- Olumlu ve düzeltici geri bildirim sistemi
- İlerleme takibi ve istatistikler
- Çocuk dostu, renkli arayüz

## Tech Stack
- Frontend: React + TailwindCSS + Shadcn/UI
- Backend: FastAPI + MongoDB
- Speech: Web Speech API (browser native)
- Auth: JWT

## What's Been Implemented (Jan 23, 2025)
✅ Landing Page - Renkli, çocuk dostu karşılama
✅ User Registration/Login - JWT authentication
✅ Dashboard - İstatistik kartları, seviye ilerleme
✅ Exercise Selection - Kategori ve zorluk filtreleri
✅ Exercise Page - Ses dinleme, mikrofon ile konuşma tanıma
✅ Progress Page - Detaylı ilerleme takibi
✅ 60+ Türkçe kelime/cümle (6 kategori)
✅ Olumlu/düzeltici geri bildirim modalleri
✅ Mobile responsive design

## Categories
1. Hayvanlar (animals)
2. Renkler (colors)
3. Objeler (objects)
4. Yiyecekler (foods)
5. Vücut Parçaları (body_parts)
6. Cümleler (phrases)

## Prioritized Backlog

### P0 (Critical) - Done
- [x] User authentication
- [x] Speech recognition
- [x] Text-to-speech
- [x] Exercise flow
- [x] Progress tracking

### P1 (High Priority) - Next
- [ ] Offline mode support
- [ ] Audio feedback sounds (success/error)
- [ ] Parent dashboard with detailed reports
- [ ] Custom word lists by therapists

### P2 (Medium Priority)
- [ ] Achievement badges and rewards
- [ ] Daily streaks with notifications
- [ ] Practice reminders
- [ ] Multiple child profiles per account

## Next Tasks
1. Audio feedback sounds eklemek (başarı/hata sesleri)
2. Ebeveyn için detaylı rapor paneli
3. Günlük egzersiz hatırlatıcıları
4. Çoklu profil desteği

---
## Update: Jan 28, 2025 - Fonetik Analiz & AI Desteği

### Yeni Özellikler
- ✅ Fonetik benzerlik analizi (Levenshtein Distance)
- ✅ 3 seviyeli değerlendirme: dogru / yakin / yanlis
- ✅ İlk harf kontrolü (kedi → tedi ASLA doğru sayılmaz)
- ✅ OpenRouter AI desteği (opsiyonel, nadir kullanım)
- ✅ Çocuk dostu geri bildirim mesajları

### API Endpoint
`POST /api/pronunciation-check`
- Fonetik analiz önce çalışır (ücretsiz)
- AI sadece gerekli durumlarda çağrılır

### Eşikler
- ≥92% benzerlik → dogru
- 75-91% benzerlik → yakin
- <75% benzerlik → yanlis

### Güvenlik
- OpenRouter API key sadece backend'de
- Frontend hiçbir zaman API key görmez
