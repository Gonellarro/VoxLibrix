from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel


# ── Authors ──────────────────────────────────────────────────────────────────

class AuthorBase(BaseModel):
    name: str
    biography: Optional[str] = None
    birth_date: Optional[date] = None

class AuthorCreate(AuthorBase):
    pass

class AuthorResponse(AuthorBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Voices ──────────────────────────────────────────────────────────────────

class VoiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    gender: Optional[str]
    language: Optional[str]
    model_ref: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class VoiceTestRequest(BaseModel):
    text: str


# ── Books ────────────────────────────────────────────────────────────────────

class BookResponse(BaseModel):
    id: int
    title: str
    author_id: Optional[int]
    author: Optional[AuthorResponse]
    type: str
    word_count: int = 0
    publisher: Optional[str] = None
    year: Optional[int] = None
    cover_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Audiobooks ───────────────────────────────────────────────────────────────

class VoiceMappingItem(BaseModel):
    tag_name: str
    voice_id: int


class VoiceMappingResponse(BaseModel):
    id: int
    audiobook_id: int
    tag_name: str
    voice_id: int

    class Config:
        from_attributes = True


class AudiobookCreate(BaseModel):
    book_id: int
    narrator_voice_id: int
    engine: str = "qwen"
    engine_voice_id: Optional[str] = None
    output_format: str = "mp3"
    voice_mappings: Optional[List[VoiceMappingItem]] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None


class AudiobookUpdate(BaseModel):
    narrator_voice_id: Optional[int] = None
    engine: Optional[str] = None
    engine_voice_id: Optional[str] = None
    output_format: Optional[str] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    last_position: Optional[int] = None


class AudiobookResponse(BaseModel):
    id: int
    book_id: Optional[int]
    narrator_voice_id: Optional[int]
    engine: str
    engine_voice_id: Optional[str]
    output_format: str
    final_audio_path: Optional[str]
    status: str
    total_chunks: int
    completed_chunks: int
    total_words: int = 0
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    last_position: int = 0
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True
