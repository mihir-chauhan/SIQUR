# Catapult (MinorityReport): Understanding

## What It Is

An end to end AI surveillance platform that solves two connected problems nobody has solved together.

## Problems

1. **Humans place cameras manually.** An architect walks through a building and picks spots by gut feel. Suboptimal coverage, no optimization.

2. **All past pre-crime prediction models failed.** LAPD, Chicago, Atlanta tried predictive policing. It backfired because training data was footage of crimes already on camera, which encoded racial and geographic bias. Models just learned to over-police wherever cameras already were (disproportionately marginalized neighborhoods).

**The connection:** Bad camera placement → biased data → biased predictions → over-policing. Catapult breaks this cycle by tackling both sides.

## Solution

### Camera Placement Solver
- Coverage maximization problem (graph/optimization)
- Accounts for: doors, wiring constraints, redundancy
- Outputs: optimal camera positions with coverage percentage
- Replaces the manual architect/worker process

### Synthetic Data Training
- Diffusion model generates realistic scenes of what your specific cameras in your specific property would actually see
- Controls for variables: race, body language, lighting, weather, time of day, suspicious activities (stealing, violence, loitering)
- Because it's synthetic, you control the distribution and eliminate the bias that poisoned every previous model
- Training data is always in labeled pairs: synthetic image + structured label

### VLM Wrapper (Vision Language Model)
- Makes camera feeds queryable through natural language
- GUI for viewing prompts, alerts, predictions
- "Post-action prediction" via reinforcement learning: predicts what happens next

## Platform Flow (from whiteboard)

1. **Initialize Your Property**: Upload photos or sketch a floor plan. System builds a "world model" of the space.
2. **Camera Placement Solver**: Optimizes where cameras go. Visualizes positions on floor plan with coverage %.
3. **Train Property Specific Models**: Using world model + placed cameras, generate synthetic training data via diffusion. Train ML models to detect suspicious behavior.
4. **Live Monitoring**: VLM wrapper, queryable feeds, alerts, post-action predictions.

## Architecture Decisions

- **Schema first**: Define API schema before splitting frontend/backend work. Lesson from previous hackathon where they were built independently and couldn't connect.
- **Dark themed UI**
- **Demo approach**: Dummy data initially, real backend swapped in later. A few selectable buildings. Model is "already trained" for demo purposes. Show side by side: bad manual placement vs. optimized.

## Team Split

- **Rohan**: Frontend (landing page, property init, world model view, camera placement viz, camera POV views, alert/monitoring GUI, co-own API schema)
- **Others**: Backend (camera placement solver, synthetic data pipeline, ML models, VLM integration)

## Future Considerations

### Data Annotation with OpenClaw
- OpenClaw: open source personal AI agent (68k GitHub stars), runs locally, model agnostic
- Could be used to auto-label synthetic training images using vision capabilities
- Would process batches of diffusion generated scenes and output structured labels (person attributes, environment, activity classification)
- For the demo: not needed (hardcode labels or use a VLM API call directly)
- For the real product: could serve as the annotation pipeline backbone or human-in-the-loop review tool

## Open Questions

- What is the blocking/response mechanism when suspicious activity is detected? (Alert only? Auto-call police? Message dispatch?)
- Prediction model architecture: sequence based or graph based?
- False positive tolerance for the demo vs. production?
- Which VLM to use for the wrapper? (GPT-4o, Claude vision, open source?)
