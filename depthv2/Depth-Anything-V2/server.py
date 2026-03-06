import base64
import io
import numpy as np
import torch
import cv2
from PIL import Image
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from depth_anything_v2.dpt import DepthAnythingV2

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"

model_configs = {
    "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    "vitb": {"encoder": "vitb", "features": 128, "out_channels": [96, 192, 384, 768]},
    "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
}

ENCODER = "vitl"

model = DepthAnythingV2(**model_configs[ENCODER])
model.load_state_dict(torch.load(f"checkpoints/depth_anything_v2_{ENCODER}.pth", map_location="cpu"))
model = model.to(DEVICE).eval()

print(f"Depth-Anything-V2 {ENCODER} loaded on {DEVICE}")

# --- Garment segmentation model (SegFormer) ---
seg_processor = None
seg_model = None

try:
    from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation
    seg_processor = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
    seg_model = SegformerForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes")
    seg_model = seg_model.to(DEVICE).eval()
    print("SegFormer garment segmentation model loaded")
except Exception as e:
    print(f"Warning: Could not load SegFormer model: {e}")
    print("Garment masking will be unavailable")

# ATR clothing labels that represent garments
GARMENT_LABELS = {4, 5, 6, 7}  # Upper-clothes, Skirt, Pants, Dress


def compute_garment_mask(pil_image: Image.Image, target_w: int, target_h: int) -> np.ndarray:
    """Run SegFormer segmentation and return a binary mask (255=garment, 0=other)
    at the specified target dimensions."""
    inputs = seg_processor(images=pil_image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        outputs = seg_model(**inputs)

    logits = outputs.logits  # (1, num_labels, H, W)
    # Upsample to target dimensions
    upsampled = torch.nn.functional.interpolate(
        logits, size=(target_h, target_w), mode="bilinear", align_corners=False
    )
    seg_map = upsampled.argmax(dim=1).squeeze().cpu().numpy()  # (target_h, target_w)

    # Create binary mask: 255 where garment, 0 elsewhere
    mask = np.zeros((target_h, target_w), dtype=np.uint8)
    for label in GARMENT_LABELS:
        mask[seg_map == label] = 255

    return mask


def feather_mask(mask: np.ndarray, blur_radius: int = 5) -> np.ndarray:
    """Apply Gaussian blur to soften mask edges."""
    # Kernel size must be odd
    ksize = blur_radius * 2 + 1
    return cv2.GaussianBlur(mask, (ksize, ksize), 0)


class DepthRequest(BaseModel):
    image: str  # base64 encoded image


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "encoder": ENCODER,
        "segmentation": seg_model is not None,
    }


@app.post("/depth")
def predict_depth(req: DepthRequest):
    img_bytes = base64.b64decode(req.image)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    raw_image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if raw_image is None:
        return {"error": "Could not decode image"}

    h, w = raw_image.shape[:2]

    depth = model.infer_image(raw_image, 518)

    # Normalize to 0-1 float
    d_min, d_max = depth.min(), depth.max()
    if d_max - d_min > 0:
        depth_normalized = (depth - d_min) / (d_max - d_min)
    else:
        depth_normalized = np.zeros_like(depth)

    # Grayscale PNG for preview
    depth_uint8 = (depth_normalized * 255).astype(np.uint8)
    depth_pil = Image.fromarray(depth_uint8, mode="L")
    buf = io.BytesIO()
    depth_pil.save(buf, format="PNG")
    depth_map_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # Float32 raw data for client-side warp
    depth_float32 = depth_normalized.astype(np.float32)
    depth_data_b64 = base64.b64encode(depth_float32.tobytes()).decode("utf-8")

    result = {
        "depth_map_image": depth_map_b64,
        "depth_data": depth_data_b64,
        "width": depth_float32.shape[1],
        "height": depth_float32.shape[0],
    }

    # --- Garment segmentation (optional) ---
    if seg_model is not None and seg_processor is not None:
        try:
            # Convert BGR to RGB PIL for SegFormer
            rgb_image = cv2.cvtColor(raw_image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_image)

            # Compute mask at depth map resolution for 1:1 correspondence
            mask = compute_garment_mask(pil_image, depth_float32.shape[1], depth_float32.shape[0])
            mask = feather_mask(mask, blur_radius=5)

            # PNG for preview
            mask_pil = Image.fromarray(mask, mode="L")
            mask_buf = io.BytesIO()
            mask_pil.save(mask_buf, format="PNG")
            result["garment_mask_image"] = base64.b64encode(mask_buf.getvalue()).decode("utf-8")

            # Raw bytes for client-side pixel ops
            result["garment_mask_data"] = base64.b64encode(mask.tobytes()).decode("utf-8")
        except Exception as e:
            print(f"Warning: Garment segmentation failed: {e}")
            # Omit mask fields — client falls back to unmasked behavior

    return result


# --- Vectorization endpoint (vtracer) ---
try:
    import vtracer
    print("vtracer loaded successfully")
except ImportError:
    vtracer = None
    print("Warning: vtracer not installed. /vectorize endpoint will be unavailable.")


class VectorizeRequest(BaseModel):
    image: str  # base64 encoded image


@app.post("/vectorize")
def vectorize(req: VectorizeRequest):
    if vtracer is None:
        return {"error": "vtracer not installed. Run: pip install vtracer"}

    img_bytes = base64.b64decode(req.image)
    svg_str = vtracer.convert_raw_image_to_svg(
        img_bytes,
        colormode="color",
        hierarchical="stacked",
        filter_speckle=4,
        color_precision=8,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=3,
    )
    return {"svg": svg_str}
