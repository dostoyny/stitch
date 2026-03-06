from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Message, User
from app.schemas.schemas import MessageResponse, MessageCreate
from app.dependencies import get_current_user
from typing import List, Optional
import shutil
import os
import uuid
from datetime import datetime
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Map user_id to list of WebSocket connections (in case multiple tabs open)
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@router.get("/history/{user_id}", response_model=List[MessageResponse])
def get_chat_history(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get messages between current_user and user_id
    messages = db.query(Message).filter(
        ((Message.sender_id == current_user.id) & (Message.receiver_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.receiver_id == current_user.id))
    ).order_by(Message.timestamp).all()
    return messages

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    upload_dir = "static/uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": unique_filename, "url": f"/static/uploads/{unique_filename}", "type": file.content_type}

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: int, token: str, db: Session = Depends(get_db)):
    # Validate token
    try:
        from app.core.config import settings
        from jose import jwt
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("id")
        if user_id is None or user_id != client_id:
             await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
             return
    except:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            receiver_id = int(message_data['receiver_id'])
            content = message_data.get('content')
            media_url = message_data.get('media_url')
            media_type = message_data.get('media_type')
            
            # Save to DB
            new_message = Message(
                sender_id=client_id,
                receiver_id=receiver_id,
                content=content,
                media_url=media_url,
                media_type=media_type,
                timestamp=datetime.utcnow()
            )
            db.add(new_message)
            db.commit()
            db.refresh(new_message)
            
            response_data = {
                "id": new_message.id,
                "sender_id": client_id,
                "receiver_id": receiver_id,
                "content": content,
                "media_url": media_url,
                "media_type": media_type,
                "timestamp": new_message.timestamp.isoformat()
            }
            
            # Send to receiver
            await manager.send_personal_message(response_data, receiver_id)
            # Send back to sender (for confirmation/UI update)
            await manager.send_personal_message(response_data, client_id)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
