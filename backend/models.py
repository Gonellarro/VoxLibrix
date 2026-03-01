from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import datetime
import os
import logging
import sys

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./audiobooks.db")

# SQLite needs check_same_thread: False, but MySQL doesn't
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Configure a local logger for models
logging.basicConfig(level=logging.INFO)
db_logger = logging.getLogger("db_init")

Base = declarative_base()

class Voice(Base):
    __tablename__ = "voices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)
    reference_audio_path = Column(String(512))
    reference_text = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AudiobookProject(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), index=True)
    status = Column(String(50), default="pending") # pending, processing, completed, error, paused
    total_segments = Column(Integer, default=0)
    completed_segments = Column(Integer, default=0)
    last_processed_index = Column(Integer, default=-1)
    current_sentence = Column(Text, nullable=True)
    is_multi_voice = Column(Boolean, default=False)
    output_path = Column(String(512), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AudioSegment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    voice_id = Column(Integer, ForeignKey("voices.id"))
    text = Column(Text)
    audio_path = Column(String(512), nullable=True)
    position = Column(Integer)
    status = Column(String(50), default="pending") # pending, done, error

def init_db():
    import time
    from sqlalchemy import inspect, text
    max_retries = 10
    retry_count = 0
    db_logger.info(f"Connecting to database: {DATABASE_URL}")
    while retry_count < max_retries:
        try:
            # Try to connect
            with engine.connect() as conn:
                db_logger.info("Connection established, creating tables...")
                Base.metadata.create_all(bind=engine)
                
                inspector = inspect(engine)
                # Tables and their expected columns
                expected_columns = {
                    "voices": {
                        "name": "VARCHAR(255)",
                        "reference_audio_path": "VARCHAR(512)",
                        "reference_text": "TEXT"
                    },
                    "projects": {
                        "last_processed_index": "INTEGER DEFAULT -1",
                        "is_multi_voice": "BOOLEAN DEFAULT FALSE",
                        "current_sentence": "TEXT",
                        "output_path": "VARCHAR(512)",
                        "error_message": "TEXT"
                    },
                    "segments": {
                        "status": "VARCHAR(50) DEFAULT 'pending'",
                        "audio_path": "VARCHAR(512)"
                    }
                }
                
                for table_name, columns in expected_columns.items():
                    if table_name in inspector.get_table_names():
                        existing_cols = [c["name"] for c in inspector.get_columns(table_name)]
                        for col_name, col_type in columns.items():
                            if col_name not in existing_cols:
                                db_logger.info(f"Migration: Adding column {col_name} to {table_name}")
                                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                conn.commit()

            db_logger.info("Database initialized successfully")
            return
        except Exception as e:
            retry_count += 1
            db_logger.error(f"Database connection failed ({retry_count}/{max_retries}): {e}")
            time.sleep(5)
    
    db_logger.critical("Could not connect to database after several retries")

if __name__ == "__main__":
    init_db()
