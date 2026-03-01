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
    # Check if voice name exists
    existing = db.query(models.Voice).filter(models.Voice.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Voice name already exists")

    # Save audio file
    voice_dir = os.path.join(UPLOAD_DIR, name)
    os.makedirs(voice_dir, exist_ok=True)
    file_path = os.path.join(voice_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Save to database
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

    # Proxy to TTS engine
    # Note: In a real scenario, the TTS engine needs to know where the reference audio is.
    # Since they share /data/voices, the path in the DB (/data/voices/name/file.wav)
    # might match the path in the container if mapped correctly.
    # BUT: tts-engine maps ./data/voices to /voice. 
    # So /data/voices/name/file.wav on host is /voice/name/file.wav in container.
    
    ref_audio_container_path = voice.reference_audio_path.replace("/data/voices", "/voice")
    
    # Actually, the current servidor_tts.py uses environment variables for REF_AUDIO and REF_TEXT.
    # We might need to modify it to accept them in the request body.
    
    try:
        # We need to modify servidor_tts.py to accept ref_audio and ref_text in the POST body
        # For now, let's assume we will update it.
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
            
        # Return the audio stream
        from fastapi.responses import StreamingResponse
        return StreamingResponse(response.iter_content(chunk_size=8192), media_type="audio/wav")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/voices/{voice_id}")
def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    voice = db.query(models.Voice).filter(models.Voice.id == voice_id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    # Delete file and directory if empty
    if os.path.exists(voice.reference_audio_path):
        os.remove(voice.reference_audio_path)
        voice_dir = os.path.dirname(voice.reference_audio_path)
        try:
            os.rmdir(voice_dir)
        except:
            pass # Directory not empty

    db.delete(voice)
    db.commit()
    return {"message": "Voice deleted"}

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
        print(f"Error appending WAV: {e}")

def process_audiobook_task(project_id: int, voice_id: int, sentences: list):
    db = SessionLocal()
    try:
        project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
        voice = db.query(models.Voice).filter(models.Voice.id == voice_id).first()
        
        if not project or not voice:
            return

        project.status = "processing"
        project.total_segments = len(sentences)
        db.commit()

        # Create output directory
        project_dir = os.path.join("/data/output", str(project_id))
        os.makedirs(project_dir, exist_ok=True)
        final_path = os.path.join(project_dir, "final_audio.wav")
        project.output_path = final_path
        
        ref_audio_container_path = voice.reference_audio_path.replace("/data/voices", "/voice")

        for i, sentence in enumerate(sentences):
            project.current_sentence = sentence
            db.commit()

            try:
                response = requests.post(
                    f"{TTS_ENGINE_URL}/tts",
                    json={
                        "text": sentence,
                        "language": "Spanish",
                        "ref_audio": ref_audio_container_path,
                        "ref_text": voice.reference_text
                    },
                    timeout=300 # 5 minutes timeout per sentence
                )
                
                if response.status_code == 200:
                    seg_path = os.path.join(project_dir, f"seg_{i}.wav")
                    with open(seg_path, "wb") as f:
                        f.write(response.content)
                    
                    # Incremental merge
                    append_wav(final_path, seg_path)
                    
                    project.completed_segments = i + 1
                    db.commit()
                else:
                    print(f"Error generating segment {i}: {response.text}")
            except Exception as e:
                print(f"Exception generating segment {i}: {e}")

        if os.path.exists(final_path):
            project.status = "completed"
        else:
            project.status = "error"
            project.error_message = "No se pudo generar ningún segmento de audio con éxito."
            
        project.current_sentence = None
        db.commit()

    except Exception as e:
        print(f"Task error: {e}")
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

@app.get("/projects/{project_id}/download")
def download_audiobook(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.output_path or not os.path.exists(project.output_path):
         raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(project.output_path, filename=f"audiobook_{project_id}.wav")

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

    # Read TXT content
    content = (await file.read()).decode("utf-8")
    
    # Simple sentence splitting
    sentences = re.split(r'(?<=[.!?])\s+', content)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if not sentences:
        raise HTTPException(status_code=400, detail="No text found in file")

    # Create project record
    new_project = models.AudiobookProject(
        title=title or file.filename,
        status="pending",
        total_segments=len(sentences)
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    # Start background task
    background_tasks.add_task(process_audiobook_task, new_project.id, voice_id, sentences)

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
    # Parse text into segments
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
                raw_segments.append({"text": content, "voice_id": voice_id})
        else:
            content = part.strip()
            if content:
                raw_segments.append({"text": content, "voice_id": int(req.default_voice_id)})

    if not raw_segments:
        raise HTTPException(status_code=400, detail="No text fragments found to generate.")

    # Split into sentences for memory efficiency
    final_segments = []
    for seg in raw_segments:
        # Split by . ! ? while keeping the punctuation
        sentences = re.split(r'([.!?]+)', seg["text"])
        current_sentence = ""
        for i in range(0, len(sentences), 2):
            text = sentences[i].strip()
            punct = sentences[i+1] if i+1 < len(sentences) else ""
            if text:
                final_segments.append({"text": text + punct, "voice_id": seg["voice_id"]})

    # Create project record
    new_project = models.AudiobookProject(
        title=f"Libro Multi-voz {uuid.uuid4().hex[:6]}",
        status="pending",
        total_segments=len(final_segments)
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    background_tasks.add_task(process_multi_voice_task, new_project.id, final_segments)
    return {"project_id": new_project.id, "message": "Multi-voice generation started"}

def process_multi_voice_task(project_id: int, segments: list):
    db = SessionLocal()
    try:
        project = db.query(models.AudiobookProject).filter(models.AudiobookProject.id == project_id).first()
        if not project: return
        
        project.status = "processing"
        db.commit()

        project_dir = os.path.join("/data/output", str(project_id))
        os.makedirs(project_dir, exist_ok=True)
        final_wav_path = os.path.join(project_dir, "temp_final.wav")
        final_mp3_path = os.path.join(project_dir, "final_audio.mp3")
        
        combined_audio = AudioSegment.empty()
        silence = AudioSegment.silent(duration=400) # 400ms pause

        for i, seg in enumerate(segments):
            project.current_sentence = seg["text"]
            project.completed_segments = i
            db.commit()

            voice = db.query(models.Voice).filter(models.Voice.id == seg["voice_id"]).first()
            if not voice: continue

            ref_audio_container_path = voice.reference_audio_path.replace("/data/voices", "/voice")

            try:
                response = requests.post(
                    f"{TTS_ENGINE_URL}/tts",
                    json={
                        "text": seg["text"],
                        "language": "Spanish",
                        "ref_audio": ref_audio_container_path,
                        "ref_text": voice.reference_text
                    },
                    timeout=300
                )
                
                if response.status_code == 200:
                    # Load as AudioSegment
                    seg_audio = AudioSegment.from_file(io.BytesIO(response.content), format="wav")
                    
                    # Normalization to -20 dBFS
                    change_in_dbfs = -20.0 - seg_audio.dBFS
                    seg_audio = seg_audio.apply_gain(change_in_dbfs)
                    
                    # Add to combined
                    if len(combined_audio) > 0:
                        combined_audio += silence
                    combined_audio += seg_audio
                    
                else:
                    print(f"Error in segment {i}: {response.text}")
            except Exception as e:
                print(f"Exception in segment {i}: {e}")

        if len(combined_audio) > 0:
            # Export to MP3
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
        print(f"Multi-voice task error: {e}")
        if project:
            project.status = "error"
            project.error_message = str(e)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
