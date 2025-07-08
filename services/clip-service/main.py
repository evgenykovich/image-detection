from fastapi import FastAPI, File, UploadFile
from transformers import CLIPProcessor, CLIPModel
import torch
from PIL import Image
import io

app = FastAPI()

# Load the model and processor
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

@app.post("/embed")
async def create_embedding(file: UploadFile = File(...)):
    # Read the image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    # Process the image
    inputs = processor(images=image, return_tensors="pt", padding=True)
    
    # Get image features
    image_features = model.get_image_features(**inputs)
    
    # Convert to list and return
    embedding = image_features.detach().numpy().tolist()[0]
    
    return {"embedding": embedding}

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 