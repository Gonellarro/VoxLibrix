from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, UniqueConstraint, DateTime, Date
from sqlalchemy.orm import relationship
from database import Base


class Author(Base):
    __tablename__ = "author"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    biography = Column(Text)
    birth_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    books = relationship("Book", back_populates="author")


class Voice(Base):
# ... (rest of the file follows)
    __tablename__ = "voice"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    gender = Column(String(20)) # masculine / feminine
    language = Column(String(20), default="Spanish") # Spanish / English
    sample_path = Column(String(500), nullable=False)
    model_ref = Column(Text)  # ref_text para Qwen3-TTS
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Book(Base):
    __tablename__ = "book"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    author_id = Column(Integer, ForeignKey("author.id", ondelete="SET NULL"))
    txt_path = Column(String(500), nullable=False)
    type = Column(String(20), nullable=False) # single_voice, multi_voice
    word_count = Column(Integer, default=0)
    
    # Metadata for EPUB/Books
    publisher = Column(String(200))
    year = Column(Integer)
    cover_path = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    author = relationship("Author", back_populates="books")


class Audiobook(Base):
    __tablename__ = "audiobook"
    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("book.id", ondelete="SET NULL"), nullable=True)
    narrator_voice_id = Column(Integer, ForeignKey("voice.id"), nullable=False)
    
    engine = Column(String(20), default="qwen") # qwen, cloud, piper
    engine_voice_id = Column(String(100)) # Specific voice for Piper or Cloud
    
    output_format = Column(String(10), default="mp3")
    final_audio_path = Column(String(500))
    status = Column(String(20), default="pending")
    total_chunks = Column(Integer, default=0)
    completed_chunks = Column(Integer, default=0)
    total_words = Column(Integer, default=0)
    start_char = Column(Integer) # Offset de inicio en el texto original
    end_char = Column(Integer)   # Offset de fin en el texto original
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    resumed_at = Column(DateTime)
    finished_at = Column(DateTime)

    book = relationship("Book")
    narrator_voice = relationship("Voice")


class AudiobookVoiceMapping(Base):
    __tablename__ = "audiobook_voice_mapping"
    id = Column(Integer, primary_key=True, index=True)
    audiobook_id = Column(Integer, ForeignKey("audiobook.id", ondelete="CASCADE"), nullable=False)
    tag_name = Column(String(100), nullable=False)
    voice_id = Column(Integer, ForeignKey("voice.id"), nullable=False)
    __table_args__ = (UniqueConstraint("audiobook_id", "tag_name"),)


class AudioChunk(Base):
    __tablename__ = "audio_chunk"
    id = Column(Integer, primary_key=True, index=True)
    audiobook_id = Column(Integer, ForeignKey("audiobook.id", ondelete="CASCADE"), nullable=False)
    voice_id = Column(Integer, ForeignKey("voice.id"), nullable=False)
    sequence_order = Column(Integer, nullable=False)
    tag_name = Column(String(100))
    source_text = Column(Text, nullable=False)
    audio_path = Column(String(500))
    duration_ms = Column(Integer)
    status = Column(String(20), default="pending")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
