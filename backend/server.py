from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import httpx
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'speech-therapy-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# OpenRouter API (only used when needed)
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Track failed attempts per user per word (for AI triggering)
failed_attempts_cache: Dict[str, Dict[str, int]] = {}

# ============ MODELS ============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    age: Optional[int] = None
    parent_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    age: Optional[int] = None
    parent_name: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ExerciseWord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    word: str
    image_url: str
    category: str  # animals, colors, objects, foods, body_parts
    difficulty: str  # easy, medium, hard
    pronunciation_hint: Optional[str] = None

class ExerciseAttempt(BaseModel):
    word_id: str
    spoken_word: str
    is_correct: bool
    timestamp: str

class ProgressCreate(BaseModel):
    word_id: str
    spoken_word: str
    is_correct: bool
    difficulty: str
    category: str

class ProgressResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    word_id: str
    word: str
    spoken_word: str
    is_correct: bool
    difficulty: str
    category: str
    created_at: str

class UserStats(BaseModel):
    total_attempts: int
    correct_attempts: int
    accuracy_percentage: float

# ============ PRONUNCIATION CHECK MODELS ============

class PronunciationCheckRequest(BaseModel):
    target_word: str
    spoken_word: str
    word_id: str
    user_id: Optional[str] = None

class PronunciationCheckResponse(BaseModel):
    result: str  # dogru, yakin, yanlis
    feedback: Optional[str] = None
    similarity_percentage: float
    used_ai: bool = False

# ============ CHAT MODELS ============

class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    conversation_id: str

class ChatHistoryResponse(BaseModel):
    conversation_id: str
    messages: List[ChatMessage]

# ============ RECOMMENDATION MODELS ============

class StruggleWord(BaseModel):
    word: str
    word_id: str
    attempts: int
    success_rate: float
    category: str
    difficulty: str

class ExerciseRecommendation(BaseModel):
    title: str
    description: str
    words: List[str]
    category: str
    difficulty: str
    reason: str

class RecommendationsResponse(BaseModel):
    ai_analysis: str
    struggling_words: List[StruggleWord]
    recommendations: List[ExerciseRecommendation]
    encouragement: str

class UserStats(BaseModel):
    total_attempts: int
    correct_attempts: int
    accuracy_percentage: float
    easy_completed: int
    medium_completed: int
    hard_completed: int
    categories_progress: dict
    streak_days: int
    last_activity: Optional[str] = None

# ============ PHONETIC ANALYSIS FUNCTIONS ============

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate the Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def calculate_similarity(target: str, spoken: str) -> float:
    """Calculate similarity percentage between two strings."""
    target_clean = target.lower().strip()
    spoken_clean = spoken.lower().strip()
    
    if target_clean == spoken_clean:
        return 100.0
    
    max_len = max(len(target_clean), len(spoken_clean))
    if max_len == 0:
        return 0.0
    
    distance = levenshtein_distance(target_clean, spoken_clean)
    similarity = (1 - distance / max_len) * 100
    return max(0.0, similarity)

def check_first_letter(target: str, spoken: str) -> bool:
    """Check if first letters match (important for speech therapy)."""
    target_clean = target.lower().strip()
    spoken_clean = spoken.lower().strip()
    
    if not target_clean or not spoken_clean:
        return False
    
    return target_clean[0] == spoken_clean[0]

def phonetic_analysis(target_word: str, spoken_word: str) -> tuple:
    """
    Perform phonetic analysis.
    Returns: (result, similarity_percentage, feedback)
    result: 'dogru', 'yakin', 'yanlis'
    """
    target = target_word.lower().strip()
    spoken = spoken_word.lower().strip()
    
    # Exact match
    if target == spoken:
        return ('dogru', 100.0, None)
    
    similarity = calculate_similarity(target, spoken)
    first_letter_match = check_first_letter(target, spoken)
    
    # Rule: Different first letter = NEVER correct (e.g., kedi -> tedi)
    if not first_letter_match:
        if similarity >= 75:
            return ('yakin', similarity, f"İlk ses farklı. '{target[0].upper()}' sesi ile başlamalı.")
        else:
            return ('yanlis', similarity, f"'{target}' kelimesini tekrar deneyelim.")
    
    # Similarity thresholds
    if similarity >= 92:
        return ('dogru', similarity, None)
    elif similarity >= 75:
        return ('yakin', similarity, "Çok yaklaştın! Bir kez daha dene.")
    else:
        return ('yanlis', similarity, f"'{target}' kelimesini tekrar söyleyelim.")

async def call_openrouter_ai(target_word: str, spoken_word: str) -> Optional[dict]:
    """
    Call OpenRouter AI for pronunciation evaluation.
    Only called when phonetic result is 'yakin' or after 2 consecutive failures.
    Returns: {'result': 'dogru'|'yakin'|'yanlis', 'feedback': str or None}
    """
    if not OPENROUTER_API_KEY:
        logger.warning("OpenRouter API key not configured")
        return None
    
    prompt = f"""Sen bir çocuk dil ve konuşma terapisti yardımcısısın.

Hedef kelime: "{target_word}"
Çocuğun söylediği: "{spoken_word}"

Bu iki kelimeyi karşılaştır ve telaffuz yakınlığını değerlendir.

SADECE şu formatta yanıt ver:
SONUC: [dogru veya yakin veya yanlis]
GERIBIDRIM: [Eğer sonuç yakin veya yanlis ise, çocuğa yönelik 1 cümlelik (max 15 kelime) cesaretlendirici ve düzeltici geri bildirim yaz. Eğer dogru ise boş bırak.]

Kurallar:
- İlk harfler farklıysa ASLA "dogru" deme
- Çok küçük telaffuz farklılıkları kabul edilebilir
- Çocuk dostu, pozitif bir dil kullan"""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://konusbuddy.app"
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 100,
                    "temperature": 0.3
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code}")
                return None
            
            data = response.json()
            ai_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse AI response
            result = "yakin"  # default
            feedback = None
            
            if "SONUC:" in ai_response:
                result_match = re.search(r'SONUC:\s*(dogru|yakin|yanlis)', ai_response.lower())
                if result_match:
                    result = result_match.group(1)
            
            if "GERIBIDRIM:" in ai_response.upper():
                feedback_match = re.search(r'GERIBIDRIM:\s*(.+?)(?:\n|$)', ai_response, re.IGNORECASE)
                if feedback_match:
                    feedback_text = feedback_match.group(1).strip()
                    if feedback_text and feedback_text.lower() not in ['', 'boş', '-', 'yok']:
                        feedback = feedback_text
            
            return {'result': result, 'feedback': feedback}
            
    except Exception as e:
        logger.error(f"OpenRouter API call failed: {e}")
        return None

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Geçersiz token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi dolmuş")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı")
    
    user_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "age": user_data.age,
        "parent_name": user_data.parent_name,
        "created_at": created_at
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token(user_id, user_data.email)
    
    user_response = UserResponse(
        id=user_id,
        name=user_data.name,
        email=user_data.email,
        age=user_data.age,
        parent_name=user_data.parent_name,
        created_at=created_at
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    
    token = create_access_token(user["id"], user["email"])
    
    user_response = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        age=user.get("age"),
        parent_name=user.get("parent_name"),
        created_at=user["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============ EXERCISE DATA ============

EXERCISES = [
    # EASY - Simple words (Kolay)
    # Animals - Net, sade hayvan fotoğrafları
    {"id": "1", "word": "Kedi", "image_url": "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Ke-di"},
    {"id": "2", "word": "Köpek", "image_url": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Kö-pek"},
    {"id": "3", "word": "Kuş", "image_url": "https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Kuş"},
    {"id": "4", "word": "Balık", "image_url": "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Ba-lık"},
    {"id": "5", "word": "At", "image_url": "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "At"},
    
    # Colors - Tek renk, sade arka plan
    {"id": "6", "word": "Kırmızı", "image_url": "https://images.unsplash.com/photo-1562176566-e9afd27531d4?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Kır-mı-zı"},
    {"id": "7", "word": "Mavi", "image_url": "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Ma-vi"},
    {"id": "8", "word": "Sarı", "image_url": "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Sa-rı"},
    {"id": "9", "word": "Yeşil", "image_url": "https://images.unsplash.com/photo-1564419320461-6870880221ad?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Ye-şil"},
    {"id": "10", "word": "Beyaz", "image_url": "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Be-yaz"},
    
    # Objects - Net, tek nesne görselleri
    {"id": "11", "word": "Top", "image_url": "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Top"},
    {"id": "12", "word": "Araba", "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "A-ra-ba"},
    {"id": "13", "word": "Ev", "image_url": "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Ev"},
    {"id": "14", "word": "Masa", "image_url": "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Ma-sa"},
    {"id": "15", "word": "Kitap", "image_url": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Ki-tap"},
    
    # Foods - Tek yiyecek, sade arka plan
    {"id": "16", "word": "Elma", "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "El-ma"},
    {"id": "17", "word": "Muz", "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Muz"},
    {"id": "18", "word": "Ekmek", "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Ek-mek"},
    {"id": "19", "word": "Su", "image_url": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Su"},
    {"id": "20", "word": "Süt", "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Süt"},
    
    # MEDIUM - Two syllable words (Orta)
    # Animals
    {"id": "21", "word": "Kelebek", "image_url": "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Ke-le-bek"},
    {"id": "22", "word": "Tavşan", "image_url": "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Tav-şan"},
    {"id": "23", "word": "Kaplumbağa", "image_url": "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Kap-lum-ba-ğa"},
    {"id": "24", "word": "Penguen", "image_url": "https://images.unsplash.com/photo-1462888210965-cdf193fb74de?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Pen-gu-en"},
    {"id": "25", "word": "Maymun", "image_url": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "May-mun"},
    
    # Colors - Sade renk görselleri
    {"id": "26", "word": "Turuncu", "image_url": "https://images.unsplash.com/photo-1557683316-973673baf926?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Tu-run-cu"},
    {"id": "27", "word": "Pembe", "image_url": "https://images.unsplash.com/photo-1558470598-a5dda9640f68?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Pem-be"},
    {"id": "28", "word": "Mor", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Mor"},
    {"id": "29", "word": "Kahverengi", "image_url": "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Kah-ve-ren-gi"},
    {"id": "30", "word": "Gri", "image_url": "https://images.unsplash.com/photo-1553949345-eb786bb3f7ba?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Gri"},
    
    # Objects
    {"id": "31", "word": "Bilgisayar", "image_url": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Bil-gi-sa-yar"},
    {"id": "32", "word": "Telefon", "image_url": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Te-le-fon"},
    {"id": "33", "word": "Televizyon", "image_url": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Te-le-viz-yon"},
    {"id": "34", "word": "Buzdolabı", "image_url": "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Buz-do-la-bı"},
    {"id": "35", "word": "Sandalye", "image_url": "https://images.unsplash.com/photo-1503602642458-232111445657?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "San-dal-ye"},
    
    # Foods
    {"id": "36", "word": "Portakal", "image_url": "https://images.unsplash.com/photo-1547514701-42782101795e?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Por-ta-kal"},
    {"id": "37", "word": "Çikolata", "image_url": "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Çi-ko-la-ta"},
    {"id": "38", "word": "Dondurma", "image_url": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Don-dur-ma"},
    {"id": "39", "word": "Sandviç", "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Sand-viç"},
    {"id": "40", "word": "Makarna", "image_url": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Ma-kar-na"},
    
    # HARD - Complex words and sentences (Zor)
    # Animals - Hayvan fotoğrafları
    {"id": "41", "word": "Sincap", "image_url": "https://images.unsplash.com/photo-1507666405895-422eee7d517f?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Sin-cap"},
    {"id": "42", "word": "Fil", "image_url": "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Fil"},
    {"id": "43", "word": "Zürafa", "image_url": "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Zü-ra-fa"},
    {"id": "44", "word": "Aslan", "image_url": "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "As-lan"},
    {"id": "45", "word": "Timsah", "image_url": "https://images.unsplash.com/photo-1589652717521-10c0d092dea9?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Tim-sah"},
    
    # Daily phrases - İkon/sembol görselleri
    {"id": "46", "word": "Günaydın", "image_url": "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Gü-nay-dın"},
    {"id": "47", "word": "İyi geceler", "image_url": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "İ-yi ge-ce-ler"},
    {"id": "48", "word": "Teşekkürler", "image_url": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Te-şek-kür-ler"},
    {"id": "49", "word": "Lütfen", "image_url": "https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Lüt-fen"},
    {"id": "50", "word": "Merhaba", "image_url": "https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Mer-ha-ba"},
    
    # Body parts - Net vücut parçası görselleri
    {"id": "51", "word": "El", "image_url": "https://images.unsplash.com/photo-1516749712236-67f5688a642a?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "El"},
    {"id": "52", "word": "Ayak", "image_url": "https://images.unsplash.com/photo-1754560397228-78abc90e0a21?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "A-yak"},
    {"id": "53", "word": "Göz", "image_url": "https://images.unsplash.com/photo-1494869042583-f6c911f04b4c?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "Göz"},
    {"id": "54", "word": "Kulak", "image_url": "https://images.unsplash.com/photo-1590422749897-47036da0b0ff?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "Ku-lak"},
    {"id": "55", "word": "Burun", "image_url": "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400", "category": "body_parts", "difficulty": "medium", "pronunciation_hint": "Bu-run"},
    {"id": "56", "word": "Parmak", "image_url": "https://images.unsplash.com/photo-1559526324-593bc073d938?w=400", "category": "body_parts", "difficulty": "medium", "pronunciation_hint": "Par-mak"},
    {"id": "57", "word": "Dirsek", "image_url": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400", "category": "body_parts", "difficulty": "medium", "pronunciation_hint": "Dir-sek"},
    {"id": "58", "word": "Diz", "image_url": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400", "category": "body_parts", "difficulty": "hard", "pronunciation_hint": "Diz"},
    {"id": "59", "word": "Omuz", "image_url": "https://images.unsplash.com/photo-1599817878414-43ef36677cf0?w=400", "category": "body_parts", "difficulty": "hard", "pronunciation_hint": "O-muz"},
    {"id": "60", "word": "Kalp", "image_url": "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "Kalp"},
]

# ============ EXERCISE ROUTES ============

@api_router.get("/exercises", response_model=List[ExerciseWord])
async def get_exercises(
    difficulty: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    exercises = EXERCISES.copy()
    
    if difficulty:
        exercises = [e for e in exercises if e["difficulty"] == difficulty]
    if category:
        exercises = [e for e in exercises if e["category"] == category]
    
    return [ExerciseWord(**e) for e in exercises]

@api_router.get("/exercises/{exercise_id}", response_model=ExerciseWord)
async def get_exercise(exercise_id: str, current_user: dict = Depends(get_current_user)):
    exercise = next((e for e in EXERCISES if e["id"] == exercise_id), None)
    if not exercise:
        raise HTTPException(status_code=404, detail="Egzersiz bulunamadı")
    return ExerciseWord(**exercise)

@api_router.get("/categories")
async def get_categories(current_user: dict = Depends(get_current_user)):
    categories = [
        {"id": "animals", "name": "Hayvanlar", "icon": "🐾", "color": "#4CC9F0"},
        {"id": "colors", "name": "Renkler", "icon": "🎨", "color": "#FFD166"},
        {"id": "objects", "name": "Objeler", "icon": "🏠", "color": "#EF476F"},
        {"id": "foods", "name": "Yiyecekler", "icon": "🍎", "color": "#06D6A0"},
        {"id": "body_parts", "name": "Vücut", "icon": "🖐️", "color": "#118AB2"},
        {"id": "phrases", "name": "Cümleler", "icon": "💬", "color": "#9B5DE5"},
    ]
    return categories

@api_router.get("/difficulties")
async def get_difficulties():
    difficulties = [
        {"id": "easy", "name": "Kolay", "description": "Tek heceli basit kelimeler", "color": "#06D6A0"},
        {"id": "medium", "name": "Orta", "description": "Çok heceli kelimeler", "color": "#FFD166"},
        {"id": "hard", "name": "Zor", "description": "Cümleler ve karmaşık kelimeler", "color": "#EF476F"},
    ]
    return difficulties

# ============ PROGRESS ROUTES ============

# ============ PRONUNCIATION CHECK ROUTE ============

@api_router.post("/pronunciation-check", response_model=PronunciationCheckResponse)
async def check_pronunciation(
    request: PronunciationCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check pronunciation with phonetic analysis + optional AI support.
    Flow:
    1. Exact match -> dogru
    2. Phonetic analysis (free)
    3. If result is 'yakin' OR 2 consecutive failures -> call AI (rare)
    """
    target = request.target_word
    spoken = request.spoken_word
    user_id = current_user["id"]
    word_id = request.word_id
    
    # Cache key for tracking failures
    cache_key = f"{user_id}_{word_id}"
    
    # Step 1: Exact match check
    if target.lower().strip() == spoken.lower().strip():
        # Reset failure count on success
        if cache_key in failed_attempts_cache:
            del failed_attempts_cache[cache_key]
        return PronunciationCheckResponse(
            result="dogru",
            feedback=None,
            similarity_percentage=100.0,
            used_ai=False
        )
    
    # Step 2: Phonetic analysis (free)
    phonetic_result, similarity, phonetic_feedback = phonetic_analysis(target, spoken)
    
    # Determine if AI should be called
    should_call_ai = False
    consecutive_failures = failed_attempts_cache.get(cache_key, 0)
    
    if phonetic_result == "yakin":
        should_call_ai = True
    elif phonetic_result == "yanlis":
        # Track failures
        failed_attempts_cache[cache_key] = consecutive_failures + 1
        if consecutive_failures + 1 >= 2:
            should_call_ai = True
    
    # Step 3: Call AI if needed (and API key available)
    final_result = phonetic_result
    final_feedback = phonetic_feedback
    used_ai = False
    
    if should_call_ai and OPENROUTER_API_KEY:
        ai_response = await call_openrouter_ai(target, spoken)
        if ai_response:
            used_ai = True
            final_result = ai_response.get('result', phonetic_result)
            ai_feedback = ai_response.get('feedback')
            if ai_feedback:
                final_feedback = ai_feedback
    
    # Update failure cache based on final result
    if final_result == "dogru":
        if cache_key in failed_attempts_cache:
            del failed_attempts_cache[cache_key]
    elif final_result == "yanlis":
        failed_attempts_cache[cache_key] = failed_attempts_cache.get(cache_key, 0) + 1
    
    return PronunciationCheckResponse(
        result=final_result,
        feedback=final_feedback,
        similarity_percentage=round(similarity, 1),
        used_ai=used_ai
    )

@api_router.post("/progress", response_model=ProgressResponse)
async def save_progress(
    progress_data: ProgressCreate,
    current_user: dict = Depends(get_current_user)
):
    # Find the word
    exercise = next((e for e in EXERCISES if e["id"] == progress_data.word_id), None)
    word_text = exercise["word"] if exercise else "Bilinmeyen"
    
    progress_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    
    progress_doc = {
        "id": progress_id,
        "user_id": current_user["id"],
        "word_id": progress_data.word_id,
        "word": word_text,
        "spoken_word": progress_data.spoken_word,
        "is_correct": progress_data.is_correct,
        "difficulty": progress_data.difficulty,
        "category": progress_data.category,
        "created_at": created_at
    }
    
    await db.progress.insert_one(progress_doc)
    
    return ProgressResponse(**progress_doc)

@api_router.get("/progress", response_model=List[ProgressResponse])
async def get_progress(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    progress_list = await db.progress.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [ProgressResponse(**p) for p in progress_list]

@api_router.get("/stats", response_model=UserStats)
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    # Get all progress for user
    all_progress = await db.progress.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10000)
    
    total_attempts = len(all_progress)
    correct_attempts = len([p for p in all_progress if p.get("is_correct")])
    
    accuracy = (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0
    
    # Count by difficulty
    easy_correct = len([p for p in all_progress if p.get("difficulty") == "easy" and p.get("is_correct")])
    medium_correct = len([p for p in all_progress if p.get("difficulty") == "medium" and p.get("is_correct")])
    hard_correct = len([p for p in all_progress if p.get("difficulty") == "hard" and p.get("is_correct")])
    
    # Categories progress
    categories = ["animals", "colors", "objects", "foods", "body_parts", "phrases"]
    categories_progress = {}
    for cat in categories:
        cat_progress = [p for p in all_progress if p.get("category") == cat]
        cat_correct = len([p for p in cat_progress if p.get("is_correct")])
        cat_total = len(cat_progress)
        categories_progress[cat] = {
            "total": cat_total,
            "correct": cat_correct,
            "percentage": (cat_correct / cat_total * 100) if cat_total > 0 else 0
        }
    
    # Calculate streak (simplified - consecutive days with activity)
    streak = 0
    if all_progress:
        dates = sorted(set([p.get("created_at", "")[:10] for p in all_progress]), reverse=True)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        
        if dates and (dates[0] == today or dates[0] == yesterday):
            streak = 1
            for i in range(1, len(dates)):
                prev_date = datetime.strptime(dates[i-1], "%Y-%m-%d")
                curr_date = datetime.strptime(dates[i], "%Y-%m-%d")
                if (prev_date - curr_date).days == 1:
                    streak += 1
                else:
                    break
    
    last_activity = all_progress[0].get("created_at") if all_progress else None
    
    return UserStats(
        total_attempts=total_attempts,
        correct_attempts=correct_attempts,
        accuracy_percentage=round(accuracy, 1),
        easy_completed=easy_correct,
        medium_completed=medium_correct,
        hard_completed=hard_correct,
        categories_progress=categories_progress,
        streak_days=streak,
        last_activity=last_activity
    )

# ============ AI CHAT ASSISTANT ============

CHAT_SYSTEM_PROMPT = """Sen "KonuşBuddy" adında, 4-10 yaş arası çocuklarla Türkçe konuşma pratiği yapan eğlenceli ve sevecen bir yapay zeka asistanısın.

GÖREVLER:
- Çocuklarla basit, eğlenceli sohbetler yap
- Konuşma pratiği için sorular sor (örn: "En sevdiğin hayvan hangisi?", "Bugün ne yedin?")
- Çocuğun cevaplarını cesaretlendir ve olumlu geri bildirim ver
- Bazen basit kelime oyunları öner
- Telaffuzu zor kelimeleri heceleyerek söyle

KURALLAR:
- Her zaman Türkçe konuş
- Cümlelerini KISA ve BASİT tut (maksimum 2-3 cümle)
- Çocuk dostu, neşeli bir dil kullan
- Emojiler kullanabilirsin ama abartma
- Asla olumsuz veya korkutucu şeyler söyleme
- Kişisel bilgi (adres, telefon vb.) sorma

ÖNEMLİ: Her mesajında çocuğu konuşmaya teşvik eden bir soru veya aktivite öner."""

async def chat_with_ai(user_message: str, chat_history: List[dict], user_name: str) -> str:
    """Chat with OpenRouter AI."""
    if not OPENROUTER_API_KEY:
        return "Merhaba! Şu an sohbet özelliği aktif değil. Ama egzersizlere devam edebilirsin! 🎯"
    
    # Build messages for API
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT + f"\n\nÇocuğun adı: {user_name}"}]
    
    # Add last 10 messages from history for context
    for msg in chat_history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Add current user message
    messages.append({"role": "user", "content": user_message})
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://konusbuddy.app"
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": messages,
                    "max_tokens": 150,
                    "temperature": 0.8
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return "Hmm, bir şeyler ters gitti. Tekrar dener misin? 🤔"
            
            data = response.json()
            ai_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            if not ai_response:
                return "Hmm, düşünüyorum... Biraz sonra tekrar dener misin? 🤔"
            
            return ai_response.strip()
            
    except httpx.TimeoutException:
        logger.error("OpenRouter API timeout")
        return "Biraz yavaşladım, tekrar dener misin? ⏳"
    except Exception as e:
        logger.error(f"Chat API error: {e}")
        return "Bir hata oluştu. Tekrar dener misin? 🔄"

@api_router.post("/chat", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to the AI chat assistant."""
    user_id = current_user["id"]
    user_name = current_user.get("name", "Arkadaş")
    
    # Get or create conversation
    conversation = await db.conversations.find_one(
        {"user_id": user_id, "active": True},
        {"_id": 0}
    )
    
    if not conversation:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "user_id": user_id,
            "messages": [],
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.conversations.insert_one(conversation)
    else:
        conversation_id = conversation["id"]
    
    # Get chat history
    chat_history = conversation.get("messages", [])
    
    # Get AI response
    ai_response = await chat_with_ai(request.message, chat_history, user_name)
    
    # Save messages to conversation
    timestamp = datetime.now(timezone.utc).isoformat()
    
    user_msg = {"role": "user", "content": request.message, "timestamp": timestamp}
    assistant_msg = {"role": "assistant", "content": ai_response, "timestamp": timestamp}
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": {"updated_at": timestamp}
        }
    )
    
    return ChatResponse(response=ai_response, conversation_id=conversation_id)

@api_router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(current_user: dict = Depends(get_current_user)):
    """Get chat history for the current user."""
    user_id = current_user["id"]
    
    conversation = await db.conversations.find_one(
        {"user_id": user_id, "active": True},
        {"_id": 0}
    )
    
    if not conversation:
        return ChatHistoryResponse(conversation_id="", messages=[])
    
    messages = [
        ChatMessage(
            role=msg["role"],
            content=msg["content"],
            timestamp=msg.get("timestamp")
        )
        for msg in conversation.get("messages", [])
    ]
    
    return ChatHistoryResponse(
        conversation_id=conversation["id"],
        messages=messages
    )

@api_router.delete("/chat/history")
async def clear_chat_history(current_user: dict = Depends(get_current_user)):
    """Clear chat history and start a new conversation."""
    user_id = current_user["id"]
    
    # Mark current conversation as inactive
    await db.conversations.update_many(
        {"user_id": user_id, "active": True},
        {"$set": {"active": False}}
    )
    
    return {"message": "Sohbet geçmişi temizlendi"}

# ============ AI RECOMMENDATIONS ============

RECOMMENDATION_SYSTEM_PROMPT = """Sen bir çocuk dil ve konuşma terapisti yardımcısısın. Çocuğun egzersiz verilerini analiz edip kişiselleştirilmiş öneriler sunacaksın.

GÖREV: Verilen ilerleme verilerini analiz et ve çocuğa özel egzersiz önerileri sun.

ÇIKTI FORMATI (JSON):
{
  "analysis": "Kısa analiz (2-3 cümle, çocuğun durumunu özetle)",
  "recommendations": [
    {
      "title": "Öneri başlığı",
      "description": "Kısa açıklama",
      "words": ["kelime1", "kelime2", "kelime3"],
      "category": "kategori_id",
      "difficulty": "easy/medium/hard",
      "reason": "Neden bu önerildi (1 cümle)"
    }
  ],
  "encouragement": "Çocuğa cesaretlendirici mesaj (1 cümle)"
}

KURALLAR:
- Zorlandığı kelimelere odaklan
- Benzer sesler içeren kelimeleri grupla
- Başarılı olduğu kategorilerde daha zor kelimeler öner
- Her zaman pozitif ve cesaretlendirici ol
- Türkçe yaz
- JSON formatında yanıt ver"""

async def get_ai_recommendations(user_name: str, progress_data: dict) -> dict:
    """Get AI-powered exercise recommendations based on user progress."""
    if not OPENROUTER_API_KEY:
        return None
    
    # Prepare data summary for AI
    data_summary = f"""Çocuk: {user_name}
Deneme: {progress_data.get('total_attempts', 0)}, Başarı: %{progress_data.get('accuracy', 0):.0f}
Zorlandığı: {progress_data.get('struggling_words_text', 'Yok')}
Seviye: Kolay %{progress_data.get('easy_success', 0):.0f}, Orta %{progress_data.get('medium_success', 0):.0f}"""
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://konusbuddy.app"
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": RECOMMENDATION_SYSTEM_PROMPT},
                        {"role": "user", "content": data_summary}
                    ],
                    "max_tokens": 400,
                    "temperature": 0.5
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code}")
                return None
            
            data = response.json()
            ai_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse JSON response
            import json
            import re
            try:
                # Clean up response - remove markdown code blocks if present
                clean_response = ai_response.strip()
                
                # Try to find JSON in the response
                json_match = re.search(r'\{[\s\S]*\}', clean_response)
                if json_match:
                    clean_response = json_match.group(0)
                
                return json.loads(clean_response)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response: {e}")
                # Return a basic structure if parsing fails
                return {
                    "analysis": "Verileriniz analiz edildi.",
                    "recommendations": [],
                    "encouragement": "Harika gidiyorsun! 🌟"
                }
                
    except Exception as e:
        logger.error(f"Recommendation API error: {e}")
        return None

@api_router.get("/recommendations", response_model=RecommendationsResponse)
async def get_recommendations(current_user: dict = Depends(get_current_user)):
    """Get AI-powered personalized exercise recommendations."""
    user_id = current_user["id"]
    user_name = current_user.get("name", "Arkadaş")
    
    # Get all progress for user
    all_progress = await db.progress.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10000)
    
    if len(all_progress) < 3:
        # Not enough data for recommendations
        return RecommendationsResponse(
            ai_analysis="Henüz yeterli egzersiz yapmadın. Birkaç egzersiz yaptıktan sonra sana özel öneriler sunacağım!",
            struggling_words=[],
            recommendations=[
                ExerciseRecommendation(
                    title="Başlangıç Egzersizi",
                    description="Kolay kelimelerle başla!",
                    words=["Kedi", "Köpek", "Top", "Elma", "Ev"],
                    category="mixed",
                    difficulty="easy",
                    reason="Yeni başlayanlar için temel kelimeler"
                )
            ],
            encouragement="Hadi birlikte öğrenmeye başlayalım! 🌟"
        )
    
    # Analyze progress data
    total_attempts = len(all_progress)
    correct_attempts = len([p for p in all_progress if p.get("is_correct")])
    accuracy = (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0
    
    # Find struggling words (words with multiple failures)
    word_stats = {}
    for p in all_progress:
        word_id = p.get("word_id")
        word = p.get("word", "")
        if word_id not in word_stats:
            word_stats[word_id] = {
                "word": word,
                "word_id": word_id,
                "attempts": 0,
                "correct": 0,
                "category": p.get("category", ""),
                "difficulty": p.get("difficulty", "")
            }
        word_stats[word_id]["attempts"] += 1
        if p.get("is_correct"):
            word_stats[word_id]["correct"] += 1
    
    # Calculate success rate and find struggling words
    struggling_words = []
    for word_id, stats in word_stats.items():
        if stats["attempts"] >= 2:  # At least 2 attempts
            success_rate = (stats["correct"] / stats["attempts"]) * 100
            if success_rate < 70:  # Less than 70% success
                struggling_words.append(StruggleWord(
                    word=stats["word"],
                    word_id=stats["word_id"],
                    attempts=stats["attempts"],
                    success_rate=round(success_rate, 1),
                    category=stats["category"],
                    difficulty=stats["difficulty"]
                ))
    
    # Sort by success rate (lowest first)
    struggling_words.sort(key=lambda x: x.success_rate)
    struggling_words = struggling_words[:5]  # Top 5 struggling words
    
    # Category performance
    categories = ["animals", "colors", "objects", "foods", "body_parts", "phrases"]
    category_names = {
        "animals": "Hayvanlar", "colors": "Renkler", "objects": "Objeler",
        "foods": "Yiyecekler", "body_parts": "Vücut", "phrases": "Cümleler"
    }
    category_performance = {}
    for cat in categories:
        cat_progress = [p for p in all_progress if p.get("category") == cat]
        if cat_progress:
            cat_correct = len([p for p in cat_progress if p.get("is_correct")])
            cat_total = len(cat_progress)
            category_performance[cat] = round((cat_correct / cat_total) * 100, 1)
    
    # Difficulty performance
    easy_progress = [p for p in all_progress if p.get("difficulty") == "easy"]
    medium_progress = [p for p in all_progress if p.get("difficulty") == "medium"]
    hard_progress = [p for p in all_progress if p.get("difficulty") == "hard"]
    
    easy_success = round((len([p for p in easy_progress if p.get("is_correct")]) / len(easy_progress) * 100), 1) if easy_progress else 0
    medium_success = round((len([p for p in medium_progress if p.get("is_correct")]) / len(medium_progress) * 100), 1) if medium_progress else 0
    hard_success = round((len([p for p in hard_progress if p.get("is_correct")]) / len(hard_progress) * 100), 1) if hard_progress else 0
    
    # Prepare text summaries for AI
    struggling_words_text = "\n".join([
        f"- {sw.word} ({sw.category}): {sw.attempts} deneme, %{sw.success_rate} başarı"
        for sw in struggling_words
    ]) if struggling_words else "Zorlanılan kelime yok, harika gidiyorsun!"
    
    category_performance_text = "\n".join([
        f"- {category_names.get(cat, cat)}: %{perf} başarı"
        for cat, perf in category_performance.items()
    ]) if category_performance else "Henüz kategori verisi yok"
    
    # Get AI recommendations
    progress_data = {
        "total_attempts": total_attempts,
        "correct_attempts": correct_attempts,
        "accuracy": accuracy,
        "struggling_words_text": struggling_words_text,
        "category_performance_text": category_performance_text,
        "easy_success": easy_success,
        "medium_success": medium_success,
        "hard_success": hard_success
    }
    
    ai_result = await get_ai_recommendations(user_name, progress_data)
    
    # Build response
    if ai_result:
        recommendations = []
        for rec in ai_result.get("recommendations", [])[:3]:
            recommendations.append(ExerciseRecommendation(
                title=rec.get("title", "Egzersiz"),
                description=rec.get("description", ""),
                words=rec.get("words", [])[:5],
                category=rec.get("category", "mixed"),
                difficulty=rec.get("difficulty", "easy"),
                reason=rec.get("reason", "")
            ))
        
        return RecommendationsResponse(
            ai_analysis=ai_result.get("analysis", "Verileriniz analiz edildi."),
            struggling_words=struggling_words,
            recommendations=recommendations if recommendations else [
                ExerciseRecommendation(
                    title="Pratik Yap",
                    description="Egzersizlere devam et!",
                    words=["Kedi", "Köpek", "Elma"],
                    category="mixed",
                    difficulty="easy",
                    reason="Pratik yapmak önemli"
                )
            ],
            encouragement=ai_result.get("encouragement", "Harika gidiyorsun! 🌟")
        )
    else:
        # Fallback without AI
        default_recommendations = []
        
        # Recommend based on struggling categories
        weak_categories = [cat for cat, perf in category_performance.items() if perf < 70]
        if weak_categories:
            for cat in weak_categories[:2]:
                cat_words = [e["word"] for e in EXERCISES if e["category"] == cat and e["difficulty"] == "easy"][:5]
                default_recommendations.append(ExerciseRecommendation(
                    title=f"{category_names.get(cat, cat)} Pratiği",
                    description=f"{category_names.get(cat, cat)} kategorisinde pratik yap",
                    words=cat_words,
                    category=cat,
                    difficulty="easy",
                    reason=f"Bu kategoride daha fazla pratik gerekiyor"
                ))
        
        # Add struggling words practice
        if struggling_words:
            default_recommendations.append(ExerciseRecommendation(
                title="Zorlandığın Kelimeler",
                description="Bu kelimeleri tekrar pratik et",
                words=[sw.word for sw in struggling_words[:5]],
                category="mixed",
                difficulty="easy",
                reason="Bu kelimelerde daha fazla pratik gerekiyor"
            ))
        
        if not default_recommendations:
            default_recommendations.append(ExerciseRecommendation(
                title="Devam Et!",
                description="Harika gidiyorsun, egzersizlere devam et",
                words=["Kedi", "Köpek", "Elma", "Top", "Ev"],
                category="mixed",
                difficulty="easy",
                reason="Pratik yapmaya devam et"
            ))
        
        return RecommendationsResponse(
            ai_analysis=f"Toplam {total_attempts} deneme yaptın, %{accuracy:.1f} başarı oranın var.",
            struggling_words=struggling_words,
            recommendations=default_recommendations,
            encouragement="Harika gidiyorsun! Pratik yapmaya devam et! 🌟"
        )

# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "Konuşma Terapisi API'si çalışıyor!"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
