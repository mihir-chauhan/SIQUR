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

<p align="center">
  <img src="https://i.imgur.com/oWIYmI8.png" alt="User Flow Diagram" width="800"/>
</p>
<p align="center"><em>Figure 1: SIQR User Flow Diagram.</em></p>

### System Components & Data Flow

* **Client Layer (Next.js Frontend):** The primary interface where users navigate the 3D map, render building interiors via Gaussian splatting, configure system parameters, and monitor live scenario evaluations.
* **Placement Optimization Backend:** Receives the user's coverage targets and spatial constraints, running them through a Google OR-Tools algorithm to compute and return the mathematically optimal camera layout.
* **Synthetic Data Pipeline:** Utilizing the coordinates from the placement engine, this module programmatically generates tailored synthetic training datasets from the exact 3D perspective of every deployed camera.
* **AI Training Module:** Ingests the synthetic data to train bespoke, per-camera classification models. This ensures the neural networks are highly specialized to the unique lighting, angle, and depth of their specific deployment locations.
* **Simulation & Inference Engine:** Feeds prompt-driven synthetic security scenarios (e.g., intrusions, fights) into the trained models. It processes the feeds in real time, classifies threats, and returns the actionable telemetry back to the frontend dashboard for user review.

### Running Locally
Frontend
cd frontend
npm install
npm run dev

By default, the frontend runs at:

[http://localhost:**3000**](http://localhost:**3000**) Backend cd backend pip install -r requirements.txt

Some backend modules may have their own setup steps, dependencies, or runtime instructions. Check the local **README** or module documentation inside each backend folder for service-specific details.

### Repository Structure
**SIQUR**/
    frontend/                         # Next.js application
    src/app/                        # Route-based pages
    v2/globe/                     # Satellite globe building selection
    building/                     # Building configuration + 3D view
    v2/training/                  # Training workflow
    v2/evaluate/                  # Evaluation workflow
    src/components/                 # Reusable UI and visualization components
    SceneView/
    CameraView/
    BuildingView/
    MapboxGlobe/
    public/splats/                  # Gaussian splat assets (.spz)
    public/models/                  # **OBJ**/**MTL** interior meshes and textures

    backend/
    CameraPlacementAlgorithm/       # OR-Tools optimization pipeline
    SyntheticDataset/               # Synthetic data generation pipeline
    bespoke-camera-ai/              # Per-camera training system
    Watchman/                       # Real-time inference engine
    MetaSAM/                        # Segmentation pipeline
    


### Backend Modules

CameraPlacementAlgorithm/

This module handles camera placement optimization. Given building geometry, placement constraints, and coverage goals, it uses Google OR-Tools to search for strong camera configurations.

SyntheticDataset/

This module generates synthetic surveillance data from each camera’s viewpoint. It is responsible for producing training-ready scenes that reflect camera-specific perspective and scenario variation.

bespoke-camera-ai/

This module trains neural networks tailored to individual camera feeds. It is the core of the per-camera intelligence pipeline.

Watchman/

This module acts as the inference and evaluation engine. It runs trained models against simulated or generated scenarios and returns threat classifications across feeds.

MetaSAM/

This module supports segmentation and scene-aware processing. It helps provide more structured visual understanding during analysis and model workflows.

### Key Design Ideas

## Surveillance should be validated before deployment

The platform is built around simulation-first thinking. Instead of deploying cameras and hoping for good results, **SIQUR** helps test camera networks ahead of time.

## Different cameras need different intelligence

A camera in a lobby and a camera in a hallway do not observe the same patterns. Per-camera model training allows the AI layer to reflect those differences.

## Spatial context matters

Coverage quality is not only about the number of cameras. It is about where they are placed, what they can see, and how their fields of view overlap or leave gaps.

## System-wide performance matters more than single-feed performance

A surveillance network should be judged as a complete system. **SIQUR** evaluates scenarios across all feeds simultaneously to reveal coordinated behavior, blind spots, and network-level weaknesses.

### Current Scope

**SIQUR** is currently structured as a research/prototype platform that demonstrates an end-to-end surveillance optimization workflow spanning placement, synthetic training, and evaluation. Its current value is in showing how these parts can be integrated into a unified system for smarter pre-deployment decision-making.

The platform is especially well suited for:

research demonstrations prototype security planning workflows computer vision experimentation AI-assisted camera network evaluation synthetic data and per-camera model studies Team

### Team Catapult

### Purdue University
