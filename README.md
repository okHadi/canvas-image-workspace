# Canvas Image Workspace

A canvas-based image workspace built with Next.js and Konva. Provides an interactive canvas for placing, transforming, and compositing images — including an AI-powered **Product Mockup** mode that uses depth estimation and garment segmentation.

## Frontend (Next.js)

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
pnpm install
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `pnpm dev`       | Start development server |
| `pnpm build`     | Create production build  |
| `pnpm start`     | Start production server  |
| `pnpm lint`      | Run ESLint               |

## Backend — Depth Model Server (for Product Mockup mode)

The Product Mockup feature requires a local Python server that runs [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) for depth estimation and [SegFormer](https://huggingface.co/mattmdjaga/segformer_b2_clothes) for garment segmentation.

### Prerequisites

- Python 3.9+
- pip

### Setup

```bash
cd depthv2/Depth-Anything-V2

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install fastapi uvicorn transformers
```

### Download model weights

Download the Depth Anything V2 checkpoint into `depthv2/Depth-Anything-V2/checkpoints/`. The default encoder is `vitl`:

| Encoder | Parameters | Checkpoint |
| ------- | ---------- | ---------- |
| `vits`  | 24.8M      | `depth_anything_v2_vits.pth` |
| `vitb`  | 97.5M      | `depth_anything_v2_vitb.pth` |
| `vitl`  | 335.3M     | `depth_anything_v2_vitl.pth` |

See the [Depth Anything V2 repo](https://github.com/DepthAnything/Depth-Anything-V2#pre-trained-models) for download links.

The SegFormer model (`mattmdjaga/segformer_b2_clothes`) is downloaded automatically from Hugging Face on first run.

### Run the server

```bash
cd depthv2/Depth-Anything-V2
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8100
```

The server runs on [http://localhost:8100](http://localhost:8100). The frontend proxies requests to it automatically via its `/api/mockup/depth` route — no extra configuration needed.

Verify with: `curl http://localhost:8100/health`

## How Product Mockup Mode Works

1. Place an image on the canvas (e.g. a photo of a person wearing a garment).
2. Select the image and open **AI Tools > Product Mockup**.
3. The frontend sends the image to the depth server, which returns a depth map and a garment segmentation mask.
4. Upload a design overlay (logo, pattern, etc.), adjust its position, scale, and opacity, then apply — the overlay warps to follow the garment's surface depth.
