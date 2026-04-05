# SIQUR  
**See everything. Miss nothing.**

SIQUR is an AI-powered surveillance optimization platform that helps security teams design, train, and validate camera systems before deployment. Instead of relying on trial-and-error installation, SIQUR lets users select a building, optimize camera placement, generate synthetic footage from each camera’s point of view, train bespoke per-camera AI models, and evaluate how the full system performs under realistic security scenarios.

Built by **Team Catapult** at **Purdue University**.

---

## Table of Contents

- [Overview](#overview)
- [Why SIQUR](#why-siqur)
- [Core Workflow](#core-workflow)
- [Architecture](#architecture)
- [User Flow](#user-flow)
- [How the AI Pipeline Works](#how-the-ai-pipeline-works)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Running Locally](#running-locally)
- [Backend Modules](#backend-modules)
- [Key Design Ideas](#key-design-ideas)
- [Current Scope](#current-scope)
- [Team](#team)

---

## Overview

Modern surveillance systems often fail for a simple reason: camera networks are usually installed first and truly evaluated later. That leads to blind spots, poor angles, generic AI models, and expensive deployments that underperform when real incidents happen.

SIQUR solves this by shifting surveillance planning earlier in the process. The platform combines:

- **camera placement optimization**
- **3D building visualization**
- **synthetic scenario generation**
- **bespoke per-camera AI training**
- **multi-camera threat evaluation**

The result is a workflow that helps users answer critical questions before real-world deployment:

- Where should cameras be placed?
- How much coverage do those cameras actually provide?
- What does each camera really see from its own viewpoint?
- Can AI models trained on those viewpoints reliably detect threats?
- How does the full network perform when a realistic incident unfolds?

---

## Why SIQUR

SIQUR is designed around the idea that surveillance quality is not just about having cameras. It is about having the **right cameras**, in the **right places**, trained on the **right perspectives**, and validated against the **right scenarios**.

Traditional approaches usually treat surveillance as a static monitoring problem. SIQUR treats it as a **design + simulation + AI validation** problem.

That means the platform is not only meant to show video feeds. It is meant to help teams:

- reduce blind spots
- improve camera placement decisions
- tailor AI models to individual camera environments
- simulate incidents before deployment
- understand system-wide security coverage with more confidence

---

## Core Workflow

SIQUR is organized into three major stages:

### 1. Place
Users begin by selecting a building from a 3D satellite globe. After selecting a location, they configure deployment constraints such as:

- desired camera count
- coverage target
- priority zones

An optimization pipeline then places cameras at strong candidate locations inside a 3D reconstruction of the building interior. The user can inspect the resulting layout inside an immersive scene view.

### 2. Train
Once cameras are positioned, the platform generates synthetic surveillance datasets from each camera’s exact viewpoint. These synthetic scenes reflect how people and activity would appear from that field of view.

That data is then used to train **bespoke per-camera AI models**, allowing the system to adapt detection behavior to each camera’s specific environment rather than forcing one generic model across every feed.

### 3. Evaluate
After training, users move to evaluation. They run prompt-based or predefined scenarios such as:

- normal activity
- intrusions
- disturbances
- fights

The system simulates those events across all camera feeds and runs the trained models in real time, producing live threat classifications and helping users assess overall surveillance performance.

---

## Architecture

SIQUR utilizes a modular architecture that connects a modern web frontend with specialized backend pipelines for spatial optimization, synthetic data generation, machine learning, and real-time inference.

![SIQUR System Architecture](https://imgur.com/oWIYmI8)

### System Components & Data Flow

* **Client Layer (Next.js Frontend):** The primary interface where users navigate the 3D map, render building interiors via Gaussian splatting, configure system parameters, and monitor live scenario evaluations.
* **Placement Optimization Backend:** Receives the user's coverage targets and spatial constraints, running them through a Google OR-Tools algorithm to compute and return the mathematically optimal camera layout.
* **Synthetic Data Pipeline:** Utilizing the coordinates from the placement engine, this module programmatically generates tailored synthetic training datasets from the exact 3D perspective of every deployed camera.
* **AI Training Module:** Ingests the synthetic data to train bespoke, per-camera classification models. This ensures the neural networks are highly specialized to the unique lighting, angle, and depth of their specific deployment locations.
* **Simulation & Inference Engine:** Feeds prompt-driven synthetic security scenarios (e.g., intrusions, fights) into the trained models. It processes the feeds in real time, classifies threats, and returns the actionable telemetry back to the frontend dashboard for user review.

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
