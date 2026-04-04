#!/usr/bin/env python3
"""
main.py — Camera Placement Algorithm CLI

Usage:
    python main.py <floorplan.jpg> [options]

Example:
    python main.py ../lawson_1.JPG
    python main.py ../lawson_1.JPG --no-ilp --camera-count 20
    python main.py ../lawson_1.JPG --coverage-target 0.99 --max-range 12

Outputs (in --output-dir, default ./output):
    cameras_<timestamp>.json   — camera positions/orientations (API-compatible)
    cameras_<timestamp>.png    — annotated floorplan visualization
"""

import argparse
import os
import sys
import time


def parse_args():
    p = argparse.ArgumentParser(
        description='Optimal security camera placement from floorplan image'
    )
    p.add_argument('image', help='Path to floorplan image (JPG/PNG)')
    p.add_argument('--building-id', default='purdue-lawson',
                   help='Building ID for JSON output (default: purdue-lawson)')
    p.add_argument('--camera-count', type=int, default=None,
                   help='Fixed camera budget (default: auto-minimize)')
    p.add_argument('--coverage-target', type=float, default=0.98,
                   help='Target coverage fraction 0.0-1.0 (default: 0.98)')
    p.add_argument('--scale', type=float, default=29.5,
                   help='Pixels per metre (default: 29.5 for 1/8" scale at 72 DPI)')
    p.add_argument('--max-range', type=float, default=15.0,
                   help='Camera max range in metres (default: 15.0)')
    p.add_argument('--fov', type=float, default=90.0,
                   help='Camera field of view in degrees (default: 90.0)')
    p.add_argument('--no-ilp', action='store_true',
                   help='Skip ILP, use greedy only (faster)')
    p.add_argument('--output-dir', default='output',
                   help='Output directory (default: ./output)')
    p.add_argument('--grid-step', type=int, default=12,
                   help='Coverage grid step in pixels (default: 12)')
    p.add_argument('--wall-step', type=int, default=10,
                   help='Wall-adjacent candidate subsample step (default: 10)')
    p.add_argument('--n-rays', type=int, default=360,
                   help='Number of rays per candidate (default: 360)')
    return p.parse_args()


def main():
    args = parse_args()
    t_start = time.time()

    # Validate input
    if not os.path.isfile(args.image):
        print(f"ERROR: Image not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    # Import after arg parsing so --help is fast
    from floorplan import load_floorplan
    from visibility import compute_visibility
    from optimizer import optimize
    from output import build_cameras, save_json, save_visualization, timestamp_stem

    # -----------------------------------------------------------------------
    # Step 1: Load and preprocess floorplan
    # -----------------------------------------------------------------------
    print(f"\n[1/4] Loading floorplan: {args.image}")
    fp = load_floorplan(
        args.image,
        px_per_meter=args.scale,
        grid_step=args.grid_step,
        wall_step=args.wall_step,
    )
    print(f"      Image size:  {fp.img.shape[1]}×{fp.img.shape[0]}px")
    print(f"      Scale:       {args.scale:.1f} px/m  "
          f"(1px ≈ {1/args.scale:.3f}m)")
    print(f"      Building:    "
          f"~{fp.floor_mask.shape[1]/args.scale:.0f}m × "
          f"{fp.floor_mask.shape[0]/args.scale:.0f}m")

    if len(fp.candidates) == 0:
        print("ERROR: No candidate positions found. "
              "Check wall detection thresholds.", file=sys.stderr)
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Step 2: Compute visibility
    # -----------------------------------------------------------------------
    print(f"\n[2/4] Computing visibility (max range={args.max_range}m, "
          f"FOV={args.fov}°, rays={args.n_rays})")
    vis = compute_visibility(
        fp,
        fov_deg=args.fov,
        max_range_m=args.max_range,
        n_rays=args.n_rays,
    )
    # Report average coverage per candidate
    avg_cov = sum(len(cs) for cs in vis.coverage_sets) / max(len(vis.coverage_sets), 1)
    print(f"      Avg grid pts per camera: {avg_cov:.0f} / {vis.n_grid}")

    # -----------------------------------------------------------------------
    # Step 3: Optimize placement
    # -----------------------------------------------------------------------
    print(f"\n[3/4] Optimizing placement "
          f"({'budget=' + str(args.camera_count) if args.camera_count else 'auto-minimize'})")
    selected = optimize(
        vis,
        camera_count=args.camera_count,
        coverage_target=args.coverage_target,
        use_ilp=not args.no_ilp,
        ilp_timeout_sec=15.0,
    )

    # -----------------------------------------------------------------------
    # Step 4: Output
    # -----------------------------------------------------------------------
    print(f"\n[4/4] Generating output")
    stem = timestamp_stem()
    json_path = os.path.join(args.output_dir, f"cameras_{stem}.json")
    png_path = os.path.join(args.output_dir, f"cameras_{stem}.png")

    cameras = build_cameras(
        selected, fp, vis,
        building_id=args.building_id,
        fov_deg=args.fov,
        n_rays=args.n_rays,
    )

    save_json(cameras, selected, vis, json_path, args.building_id)
    save_visualization(fp, vis, selected, cameras, png_path,
                       fov_deg=args.fov, n_rays=args.n_rays)

    elapsed = time.time() - t_start
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Cameras placed: {len(cameras)}")

    # Coverage summary
    from optimizer import _coverage_fraction
    cov = _coverage_fraction(selected, vis.coverage_sets, vis.n_grid)
    print(f"  Coverage score: {cov:.1%}")
    print(f"  Output dir:     {os.path.abspath(args.output_dir)}/")


if __name__ == '__main__':
    main()
