# SIQUR

**The First Fully-Integrated Intelligent Security Suite**

SIQUR is an AI powered surveillance optimization platform that automates camera placement, trains bespoke per camera AI models, and evaluates security coverage through synthetic scenario simulation.

Built by Mihir Chauhan, David Chen, Rohan Muppa, and David Wang at Purdue University.

## What It Does

1. **Place**: Select a building from a 3D satellite globe, configure placement parameters (camera count, coverage target, priority zones), and let an OR Tools optimization model place cameras at optimal positions inside a Gaussian splat reconstruction of the building interior.

2. **Train**: Generate synthetic training datasets from each camera's viewpoint, then train bespoke neural networks tailored to each camera's specific field of view and environment.

3. **Evaluate**: Run AI generated scenarios (fights, intrusions, normal activity) through the trained models and observe real time threat classification across all camera feeds simultaneously.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, React 19, TypeScript, Three.js, Mapbox GL |
| 3D Rendering | Gaussian Splatting (@mkkellogg/gaussian splats 3d), OBJ/MTL meshes |
| Camera Placement | Google OR Tools (coverage optimization) |
| AI Training | PyTorch, synthetic dataset generation, ONNX export |
| Video Analysis | Bespoke per camera CNN models, MetaSAM segmentation |
| Design System | Dark surveillance aesthetic, Space Mono, cyan #00e5ff accent |

## User Flow

flowchart TD
    A[Landing Page\n/] -->|Click to start| B[Satellite Globe\n/v2/globe]
    B -->|Select building marker| C[Building Configuration\n/building]

    C --> C1[Set camera count]
    C --> C2[Set coverage target]
    C --> C3[Define priority zones]
    C --> C4[Preview 3D Gaussian splat interior]
    C --> C5[View optimized camera placement]

    C -->|Continue to training| D[Training Workspace\n/v2/training]
    D --> D1[Generate synthetic datasets]
    D --> D2[Train per-camera AI models]

    D -->|Continue to evaluation| E[Scenario Evaluation\n/v2/evaluate]
    E --> E1[Enter prompt-based scenarios]
    E --> E2[Simulate security events]
    E --> E3[Run real-time threat classification]
    E --> E4[Compare activity across all feeds]

## Running Locally

```bash
# Frontend
cd frontend
npm install
npm run dev
# http://localhost:3000

# Backend (camera placement + AI)
cd backend
pip install -r requirements.txt
# See individual backend module READMEs
```

## Project Structure

```
SIQUR/
  frontend/           Next.js app
    src/app/           Pages (v2/globe, building, v2/training, v2/evaluate)
    src/components/    SceneView, CameraView, BuildingView, MapboxGlobe
    public/splats/     Gaussian splat files (.spz)
    public/models/     OBJ/MTL interior meshes + textures
  backend/
    CameraPlacementAlgorithm/   OR Tools optimizer
    SyntheticDataset/           Training data generation
    bespoke-camera-ai/          Per camera model training
    Watchman/                   Real time inference engine
    MetaSAM/                    Segmentation pipeline
```

## Team

Team Catapult, Purdue University
