from fastapi import Request, HTTPException
from jose import jwt, JWTError
from FastAPI_AI.config.config import Config


async def verify_jwt(request: Request): 
    auth_header = request.headers.get("Authorization", "") 
    if not auth_header.startswith("Bearer "): 
        raise HTTPException(status_code=401, detail="Unauthorised — no token provided") 
    token = auth_header.split(" ")[1] 
    try:
        payload = jwt.decode(token,Config.JWT_SECRET , algorithms=Config.ALGORITHM)
        return payload # { "id": ..., "email": ... }
    
    except JWTError:
        raise HTTPException(status_code=401, detail="Unauthorised — invalid token")