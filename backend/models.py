from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./audiobooks.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Voice(Base):
    __tablename__ = "voices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    reference_audio_path = Column(String)
    reference_text = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AudiobookProject(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    status = Column(String, default="pending") # pending, processing, completed, error
    total_segments = Column(Integer, default=0)
    completed_segments = Column(Integer, default=0)
    current_sentence = Column(Text, nullable=True)
    output_path = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AudioSegment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    voice_id = Column(Integer, ForeignKey("voices.id"))
    text = Column(Text)
    audio_path = Column(String, nullable=True)
    position = Column(Integer)
    status = Column(String, default="pending") # pending, done, error

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
