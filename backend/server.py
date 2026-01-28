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

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    easy_completed: int
    medium_completed: int
    hard_completed: int
    categories_progress: dict
    streak_days: int
    last_activity: Optional[str] = None

# ============ HELPER FUNCTIONS ============

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
    # Animals
    {"id": "1", "word": "Kedi", "image_url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Ke-di"},
    {"id": "2", "word": "Köpek", "image_url": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Kö-pek"},
    {"id": "3", "word": "Kuş", "image_url": "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Kuş"},
    {"id": "4", "word": "Balık", "image_url": "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "Ba-lık"},
    {"id": "5", "word": "At", "image_url": "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400", "category": "animals", "difficulty": "easy", "pronunciation_hint": "At"},
    
    # Colors
    {"id": "6", "word": "Kırmızı", "image_url": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Kır-mı-zı"},
    {"id": "7", "word": "Mavi", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Ma-vi"},
    {"id": "8", "word": "Sarı", "image_url": "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Sa-rı"},
    {"id": "9", "word": "Yeşil", "image_url": "https://images.unsplash.com/photo-1564419320461-6870880221ad?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Ye-şil"},
    {"id": "10", "word": "Beyaz", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", "category": "colors", "difficulty": "easy", "pronunciation_hint": "Be-yaz"},
    
    # Objects
    {"id": "11", "word": "Top", "image_url": "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Top"},
    {"id": "12", "word": "Araba", "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "A-ra-ba"},
    {"id": "13", "word": "Ev", "image_url": "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Ev"},
    {"id": "14", "word": "Masa", "image_url": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Ma-sa"},
    {"id": "15", "word": "Kitap", "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400", "category": "objects", "difficulty": "easy", "pronunciation_hint": "Ki-tap"},
    
    # Foods
    {"id": "16", "word": "Elma", "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "El-ma"},
    {"id": "17", "word": "Muz", "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Muz"},
    {"id": "18", "word": "Ekmek", "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Ek-mek"},
    {"id": "19", "word": "Su", "image_url": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Su"},
    {"id": "20", "word": "Süt", "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400", "category": "foods", "difficulty": "easy", "pronunciation_hint": "Süt"},
    
    # MEDIUM - Two syllable words (Orta)
    # Animals
    {"id": "21", "word": "Kelebek", "image_url": "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Ke-le-bek"},
    {"id": "22", "word": "Tavşan", "image_url": "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Tav-şan"},
    {"id": "23", "word": "Kaplumbağa", "image_url": "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Kap-lum-ba-ğa"},
    {"id": "24", "word": "Penguen", "image_url": "https://images.unsplash.com/photo-1462888210965-cdf193fb74de?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "Pen-gu-en"},
    {"id": "25", "word": "Maymun", "image_url": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400", "category": "animals", "difficulty": "medium", "pronunciation_hint": "May-mun"},
    
    # Colors
    {"id": "26", "word": "Turuncu", "image_url": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Tu-run-cu"},
    {"id": "27", "word": "Pembe", "image_url": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Pem-be"},
    {"id": "28", "word": "Mor", "image_url": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Mor"},
    {"id": "29", "word": "Kahverengi", "image_url": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Kah-ve-ren-gi"},
    {"id": "30", "word": "Gri", "image_url": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400", "category": "colors", "difficulty": "medium", "pronunciation_hint": "Gri"},
    
    # Objects
    {"id": "31", "word": "Bilgisayar", "image_url": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Bil-gi-sa-yar"},
    {"id": "32", "word": "Telefon", "image_url": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Te-le-fon"},
    {"id": "33", "word": "Televizyon", "image_url": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Te-le-viz-yon"},
    {"id": "34", "word": "Buzdolabı", "image_url": "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "Buz-do-la-bı"},
    {"id": "35", "word": "Sandalye", "image_url": "https://images.unsplash.com/photo-1503602642458-232111445657?w=400", "category": "objects", "difficulty": "medium", "pronunciation_hint": "San-dal-ye"},
    
    # Foods
    {"id": "36", "word": "Portakal", "image_url": "https://images.unsplash.com/photo-1547514701-42782101795e?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Por-ta-kal"},
    {"id": "37", "word": "Çikolata", "image_url": "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Çi-ko-la-ta"},
    {"id": "38", "word": "Dondurma", "image_url": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Don-dur-ma"},
    {"id": "39", "word": "Sandviç", "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Sand-viç"},
    {"id": "40", "word": "Makarna", "image_url": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400", "category": "foods", "difficulty": "medium", "pronunciation_hint": "Ma-kar-na"},
    
    # HARD - Complex words and sentences (Zor)
    # Animals
    {"id": "41", "word": "Sincap ağaca tırmanıyor", "image_url": "https://images.unsplash.com/photo-1507666405895-422eee7d517f?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Sin-cap a-ğa-ca tır-ma-nı-yor"},
    {"id": "42", "word": "Fil çok büyük bir hayvan", "image_url": "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Fil çok bü-yük bir hay-van"},
    {"id": "43", "word": "Zürafa uzun boyunlu", "image_url": "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Zü-ra-fa u-zun boy-un-lu"},
    {"id": "44", "word": "Aslan ormanın kralı", "image_url": "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "As-lan or-ma-nın kra-lı"},
    {"id": "45", "word": "Timsah suda yüzüyor", "image_url": "https://images.unsplash.com/photo-1589652717521-10c0d092dea9?w=400", "category": "animals", "difficulty": "hard", "pronunciation_hint": "Tim-sah su-da yü-zü-yor"},
    
    # Daily phrases
    {"id": "46", "word": "Günaydın anne", "image_url": "https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Gü-nay-dın an-ne"},
    {"id": "47", "word": "İyi geceler baba", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "İ-yi ge-ce-ler ba-ba"},
    {"id": "48", "word": "Teşekkür ederim", "image_url": "https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Te-şek-kür e-de-rim"},
    {"id": "49", "word": "Rica ederim", "image_url": "https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Ri-ca e-de-rim"},
    {"id": "50", "word": "Nasılsın bugün", "image_url": "https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?w=400", "category": "phrases", "difficulty": "hard", "pronunciation_hint": "Na-sıl-sın bu-gün"},
    
    # Body parts
    {"id": "51", "word": "El", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "El"},
    {"id": "52", "word": "Ayak", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "A-yak"},
    {"id": "53", "word": "Göz", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "Göz"},
    {"id": "54", "word": "Kulak", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "Ku-lak"},
    {"id": "55", "word": "Burun", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "medium", "pronunciation_hint": "Bu-run"},
    {"id": "56", "word": "Parmak", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "medium", "pronunciation_hint": "Par-mak"},
    {"id": "57", "word": "Dirsek", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "medium", "pronunciation_hint": "Dir-sek"},
    {"id": "58", "word": "Diz kapağı", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "hard", "pronunciation_hint": "Diz ka-pa-ğı"},
    {"id": "59", "word": "Omuz silkmek", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "hard", "pronunciation_hint": "O-muz silk-mek"},
    {"id": "60", "word": "Kalp", "image_url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400", "category": "body_parts", "difficulty": "easy", "pronunciation_hint": "Kalp"},
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
