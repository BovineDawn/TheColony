from fastapi import APIRouter
from app.services.ld_service import get_ld_status

router = APIRouter()

@router.get("/status")
def ld_status():
    return get_ld_status()
