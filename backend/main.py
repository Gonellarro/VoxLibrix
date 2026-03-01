from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pydub import AudioSegment
import os
import shutil
import requests
import uuid
import models
from models import SessionLocal, init_db
import wave
import re
import io
from fastapi.responses import FileResponse, StreamingResponse

# Initialize database
init_db()

app = FastAPI(title="Audiobook Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
UPLOAD_DIR = "/data/voices"
TTS_ENGINE_URL = os.getenv("TTS_ENGINE_URL", "http://tts-engine:8000")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# Dependency
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("audiobook-backend")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "Audiobook Backend API is running"}

@app.get("/voices")
def list_voices(db: Session = Depends(get_db)):
    return db.query(models.Voice).all()

@app.post("/voices")
async def create_voice(
    name: str = Form(...),
    reference_text: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    existing = db.query(models.Voice).filter(models.Voice.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Voice name already exists")

    voice_dir = os.path.join(UPLOAD_DIR, name)
    os.makedirs(voice_dir, exist_ok=True)
    file_path = os.path.join(voice_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_voice = models.Voice(
        name=name,
        reference_audio_path=file_path,
        reference_text=reference_text
    )
    db.add(new_voice)
    db.commit()
    db.refresh(new_voice)
    return new_voice

@app.get("/voices/{voice_id}/test")
async def test_voice(voice_id: int, text: str, db: Session = Depends(get_db)):
    voice = db.query(models.Voice).filter(models.Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    ref_audio_container_path = voice.reference_audio_path.replace("/data/voices", "/voice")
    
    try:
        response = requests.post(
            f"{TTS_ENGINE_URL}/tts",
            json={
                "text": text,
                "language": "Spanish",
                "ref_audio": ref_audio_container_path,
                "ref_text": voice.reference_text
            },
            stream=True
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return StreamingResponse(response.iter_content(chunk_size=8192), media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/voices/{voice_id}")
def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    voice = db.query(models.Voice).filter(models.Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    if os.path.exists(voice.reference_audio_path):
        os.remove(voice.reference_audio_path)
        voice_dir = os.path.dirname(voice.reference_audio_path)
        try: os.rmdir(voice_dir)
        except: pass

    db.delete(voice)
    db.commit()
    return {"message": "Voice deleted"}
@app.post("/projects/{project_id}/pause")
def pause_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status = "paused"
    db.commit()
    logger.info(f"Project {project_id} paused by user")
    return {"message": "Project paused"}

@app.post("/projects/{project_id}/resume")
def resume_project(project_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.status not in ["paused", "error", "pending"]:
         raise HTTPException(status_code=400, detail=f"Cannot resume project in status {project.status}")
    
    project.status = "processing"
    project.error_message = None
    db.commit()
    
    logger.info(f"Resuming project {project_id}")
    if project.is_multi_voice:
        background_tasks.add_task(process_multi_voice_task, project.id)
    else:
        background_tasks.add_task(process_audiobook_task, project.id)
        
    return {"message": "Project resumed"}

def append_wav(final_path, seg_path):
    if not os.path.exists(final_path):
        shutil.copyfile(seg_path, final_path)
        return

    try:
        with wave.open(final_path, 'rb') as w_old:
            params = w_old.getparams()
            frames = w_old.readframes(w_old.getnframes())

        with wave.open(seg_path, 'rb') as w_seg:
            new_frames = w_seg.readframes(w_seg.getnframes())

        with wave.open(final_path, 'wb') as w_new:
            w_new.setparams(params)
            w_new.writeframes(frames)
            w_new.writeframes(new_frames)
    except Exception as e:
        logger.error(f"Error appending WAV: {e}")

def process_audiobook_task(project_id: int):
    db = SessionLocal()
    try:
        project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
        if not project:
            logger.error(f"Task error: Project {project_id} not found")
            return

        logger.info(f"Starting/Resuming processing for project {project_id}: {project.title}")
        project.status = "processing"
        db.commit()

        # Create output directory
        project_dir = os.path.join("/data/output", str(project_id))
        os.makedirs(project_dir, exist_ok=True)
        final_path = os.path.join(project_dir, "final_audio.wav")
        project.output_path = final_path
        db.commit()
        db.refresh(project)
        # Get all segments ordered by position
        segments = db.query(models.AudioSegment).filter(models.AudioSegment.project_id == project_id).order_by(models.AudioSegment.position).all()
        
        for seg in segments:
            # Refresh project status to check for pause
            db.refresh(project)
            if project.status == "paused":
                logger.info(f"Processing for project {project_id} paused at segment {seg.position}")
                return

            if seg.status == "done":
                # If we are resuming, we might have already appended this.
                # In a robust system we would rebuild the final file or check if already appended.
                # For simplicity, we assume we append from the last processed index.
                continue

            project.current_sentence = seg.text
            project.last_processed_index = seg.position
            db.commit()

            voice = db.query(models.Voice).filter(models.Voice.id == seg.voice_id).first()
            if not voice:
                logger.error(f"Voice {seg.voice_id} not found for segment {seg.position}")
                continue

            ref_audio_container_path = voice.reference_audio_path.replace("/data/voices", "/voice")

            logger.info(f"Generating segment {seg.position}/{project.total_segments} for project {project_id}")
            start_time = time.time()
            try:
                response = requests.post(
                    f"{TTS_ENGINE_URL}/tts",
                    json={
                        "text": seg.text,
                        "language": "Spanish",
                        "ref_audio": ref_audio_container_path,
                        "ref_text": voice.reference_text
                    },
                    timeout=300
                )
                
                if response.status_code == 200:
                    seg_path = os.path.join(project_dir, f"seg_{seg.position}.wav")
                    with open(seg_path, "wb") as f:
                        f.write(response.content)
                    
                    # Incremental merge
                    append_wav(final_path, seg_path)
                    
                    seg.status = "done"
                    seg.audio_path = seg_path
                    project.completed_segments += 1
                    db.commit()
                    logger.info(f"Segment {seg.position} completed in {time.time() - start_time:.2f}s")
                else:
                    logger.error(f"Error generating segment {seg.position}: {response.text}")
                    # We might want to mark segment as error?
                    seg.status = "error"
                    db.commit()
            except Exception as e:
                logger.exception(f"Exception generating segment {seg.position}: {e}")
                project.status = "error"
                project.error_message = f"Error en segmento {seg.position}: {str(e)}"
                db.commit()
                return

        if os.path.exists(final_path):
            project.status = "completed"
            logger.info(f"Project {project_id} completed successfully")
        else:
            project.status = "error"
            project.error_message = "No se pudo generar ningún segmento de audio con éxito."
            logger.error(f"Project {project_id} failed: No segments generated")
            
        project.current_sentence = None
        db.commit()

    except Exception as e:
        logger.exception(f"Unexpected loop error in project {project_id}: {e}")
        if project:
            project.status = "error"
            project.error_message = str(e)
            db.commit()
    finally:
        db.close()

@app.get("/projects/{project_id}")
def get_project_status(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.get("/projects")
def list_projects(limit: int = 10, db: Session = Depends(get_db)):
    return db.query(models.AudiobookProject).order_by(models.AudiobookProject.created_at.desc()).limit(limit).all()

@app.get("/projects/{project_id}/download")
def download_audiobook(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.output_path or not os.path.exists(project.output_path):
         raise HTTPException(status_code=404, detail="Audio file not found")

    filename = f"audiobook_{project_id}"
    extension = ".mp3" if project.is_multi_voice else ".wav"
    return FileResponse(project.output_path, filename=filename + extension)

@app.post("/generate-from-txt")
async def generate_from_txt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_id: int = Form(...),
    title: str = Form(None),
    db: Session = Depends(get_db)
):
    voice = db.query(models.Voice).filter(models.Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    content = (await file.read()).decode("utf-8")
    sentences = re.split(r'(?<=[.!?])\s+', content)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if not sentences:
        raise HTTPException(status_code=400, detail="No text found in file")

    new_project = models.AudiobookProject(
        title=title or file.filename,
        status="pending",
        total_segments=len(sentences),
        is_multi_voice=False
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    # Save segments to database
    for i, sentence in enumerate(sentences):
        seg = models.AudioSegment(
            project_id=new_project.id,
            voice_id=voice_id,
            text=sentence,
            position=i
        )
        db.add(seg)
    db.commit()

    logger.info(f"Created simple project {new_project.id} with {len(sentences)} segments")
    background_tasks.add_task(process_audiobook_task, new_project.id)
    return {"project_id": new_project.id, "message": "Generation started"}

class MultiVoiceRequest(BaseModel):
    text: str
    mappings: dict  # { tag: voice_id }
    default_voice_id: int

@app.post("/generate-multi-voice")
async def generate_multi_voice(
    req: MultiVoiceRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    parts = re.split(r'(<[^>]+>[^<]*</[^>]+>)', req.text)
    raw_segments = []
    
    for part in parts:
        if not part.strip(): continue
        match = re.match(r'<([^>]+)>(.*)</\1>', part, re.DOTALL)
        if match:
            tag = match.group(1)
            content = match.group(2).strip()
            voice_id_raw = req.mappings.get(tag)
            voice_id = int(voice_id_raw) if voice_id_raw else req.default_voice_id
            if content:
                raw_segments.append({"text": content, "voice_id": int(voice_id)})
        else:
            content = part.strip()
            if content:
                raw_segments.append({"text": content, "voice_id": int(req.default_voice_id)})

    if not raw_segments:
        raise HTTPException(status_code=400, detail="No text fragments found to generate.")

    final_segments_data = []
    for seg in raw_segments:
        sentences = re.split(r'([.!?]+)', seg["text"])
        for i in range(0, len(sentences), 2):
            text = sentences[i].strip()
            punct = sentences[i+1] if i+1 < len(sentences) else ""
            if text:
                final_segments_data.append({"text": text + punct, "voice_id": seg["voice_id"]})

    new_project = models.AudiobookProject(
        title=f"Libro Multi-voz {uuid.uuid4().hex[:6]}",
        status="pending",
        total_segments=len(final_segments_data),
        is_multi_voice=True
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    for i, s_data in enumerate(final_segments_data):
        seg = models.AudioSegment(
            project_id=new_project.id,
            voice_id=s_data["voice_id"],
            text=s_data["text"],
            position=i
        )
        db.add(seg)
    db.commit()

    logger.info(f"Created multi-voice project {new_project.id} with {len(final_segments_data)} segments")
    background_tasks.add_task(process_multi_voice_task, new_project.id)
    return {"project_id": new_project.id, "message": "Multi-voice generation started"}

def process_multi_voice_task(project_id: int):
    db = SessionLocal()
    try:
        project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
        if not project: return
        
        logger.info(f"Starting/Resuming multi-voice processing for project {project_id}")
        project.status = "processing"
        db.commit()

        project_dir = os.path.join("/data/output", str(project_id))
        os.makedirs(project_dir, exist_ok=True)
        final_mp3_path = os.path.join(project_dir, "final_audio.mp3")
        
        combined_audio = AudioSegment.empty()
        silence = AudioSegment.silent(duration=400) # 400ms pause

        # If we are resuming, we should ideally load existing segments into combined_audio
        # But for now, let's just re-render everything or assume we start from scratch if combined is empty.
        # Robust version: Load all 'done' segments audio files and concatenate.
        segments = db.query(models.AudioSegment).filter(models.AudioSegment.project_id == project_id).order_by(models.AudioSegment.position).all()

        for seg in segments:
            db.refresh(project)
            if project.status == "paused":
                logger.info(f"Multi-voice project {project_id} paused at segment {seg.position}")
                return

            if seg.status == "done":
                # Load existing if available
                if os.path.exists(seg.audio_path):
                    seg_audio = AudioSegment.from_file(seg.audio_path)
                    if len(combined_audio) > 0: combined_audio += silence
                    combined_audio += seg_audio
                    continue

            project.current_sentence = seg.text
            project.last_processed_index = seg.position
            project.completed_segments = seg.position # approximate
            db.commit()

            voice = db.query(models.Voice).filter(models.Voice.id == seg.voice_id).first()
            if not voice: continue

            ref_audio_container_path = voice.reference_audio_path.replace("/data/voices", "/voice")

            logger.info(f"Generating multi-voice segment {seg.position}/{project.total_segments}")
            try:
                response = requests.post(
                    f"{TTS_ENGINE_URL}/tts",
                    json={
                        "text": seg.text,
                        "language": "Spanish",
                        "ref_audio": ref_audio_container_path,
                        "ref_text": voice.reference_text
                    },
                    timeout=300
                )
                
                if response.status_code == 200:
                    seg_audio = AudioSegment.from_file(io.BytesIO(response.content), format="wav")
                    
                    # Store individual segment
                    seg_path = os.path.join(project_dir, f"seg_{seg.position}.wav")
                    seg_audio.export(seg_path, format="wav")
                    
                    # Normalization
                    change_in_dbfs = -20.0 - seg_audio.dBFS
                    seg_audio = seg_audio.apply_gain(change_in_dbfs)
                    
                    if len(combined_audio) > 0:
                        combined_audio += silence
                    combined_audio += seg_audio
                    
                    seg.status = "done"
                    seg.audio_path = seg_path
                    db.commit()
                else:
                    logger.error(f"Error in segment {seg.position}: {response.text}")
            except Exception as e:
                logger.exception(f"Exception in segment {seg.position}: {e}")
                project.status = "error"
                project.error_message = str(e)
                db.commit()
                return

        if len(combined_audio) > 0:
            combined_audio.export(final_mp3_path, format="mp3", bitrate="192k")
            project.output_path = final_mp3_path
            project.status = "completed"
            project.completed_segments = len(segments)
        else:
            project.status = "error"
            project.error_message = "Could not generate any audio segments."

        project.current_sentence = None
        db.commit()

    except Exception as e:
        logger.exception(f"Multi-voice loop error: {e}")
        if project:
            project.status = "error"
            project.error_message = str(e)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
