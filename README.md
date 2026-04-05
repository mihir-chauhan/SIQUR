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

```
/ (Hero)
  Click to start
    |
/v2/globe (Satellite Globe)
  Click building marker
    |
/building (Configure + 3D Interior)
  Set camera count, coverage, priority zones
  View 3D Gaussian splat with placed cameras
    |
/v2/training (Train Camera Models)
  Synthetic dataset generation
  Per camera neural network training
    |
/v2/evaluate (Evaluate Scenarios)
  Prompt based scenario simulation
  Real time threat classification
```

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
