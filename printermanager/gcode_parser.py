"""
XplorePrint - G-code Parser
FRC Team 11019 Xplore

Parses sliced G-code files to extract:
  - Estimated print time (from slicer comments or calculated)
  - Material usage (grams)
  - Layer count
  - Bounding box dimensions (X, Y, Z)
  - Filament length (mm)

Uses gcodeparser for structured line parsing.
"""

import re
import math
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

FILAMENT_DIAMETER = 1.75
FILAMENT_CROSS_SECTION = math.pi * (FILAMENT_DIAMETER / 2) ** 2

MATERIAL_DENSITY = {
    "PLA": 1.24,
    "ABS": 1.04,
    "ASA": 1.07,
    "PETG": 1.27,
    "TPU": 1.22,
    "PC": 1.20,
    "PA": 1.14,
    "PA-CF": 1.25,
    "PAHT-CF": 1.25,
    "PET-CF": 1.30,
    "PLA-CF": 1.30,
    "PVA": 1.23,
    "HIPS": 1.04,
    "PP": 0.90,
    "PCTG": 1.23,
    "PEI": 1.27,
    "PPS": 1.34,
    "PPS-CF": 1.40,
    "PEEK": 1.32,
    "PEKK": 1.30,
    "ULTEM": 1.27,
}


@dataclass
class GcodeAnalysis:
    file_name: str = ""
    estimated_time_minutes: float = 0.0
    slicer_time_minutes: float = 0.0
    filament_length_mm: float = 0.0
    material_grams: float = 0.0
    layer_count: int = 0
    bounding_box: dict = field(default_factory=lambda: {
        "x_min": 0.0, "x_max": 0.0,
        "y_min": 0.0, "y_max": 0.0,
        "z_min": 0.0, "z_max": 0.0,
    })
    total_lines: int = 0
    print_lines: int = 0

    def to_dict(self) -> dict:
        return {
            "file_name": self.file_name,
            "estimated_time_minutes": round(self.estimated_time_minutes, 1),
            "slicer_time_minutes": round(self.slicer_time_minutes, 1),
            "filament_length_mm": round(self.filament_length_mm, 1),
            "material_grams": round(self.material_grams, 2),
            "layer_count": self.layer_count,
            "bounding_box": {k: round(v, 2) for k, v in self.bounding_box.items()},
            "total_lines": self.total_lines,
            "print_lines": self.print_lines,
        }


def parse_gcode_file(file_path: str, material: str = "PLA") -> GcodeAnalysis:
    """Parse a G-code file and extract print metrics.

    Args:
        file_path: Path to the .gcode file
        material: Material type for density lookup (default "PLA")

    Returns:
        GcodeAnalysis with parsed metrics
    """
    import os as _os
    from gcodeparser import parse_gcode_lines

    analysis = GcodeAnalysis(file_name=_os.path.basename(file_path))

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            gcode_text = f.read()
    except Exception as e:
        logger.error(f"Failed to read G-code file {file_path}: {e}")
        return analysis

    analysis.total_lines = len(gcode_text.splitlines())

    total_e = 0.0
    current_e = 0.0
    current_x = 0.0
    current_y = 0.0
    current_z = 0.0
    x_min, x_max = float("inf"), float("-inf")
    y_min, y_max = float("inf"), float("-inf")
    z_min, z_max = float("inf"), float("-inf")
    z_values = set()
    print_line_count = 0
    total_move_time = 0.0
    last_f = 6000.0
    relative_e = False
    line_index = 0
    last_error_line = 0

    try:
        for line in parse_gcode_lines(gcode_text, include_comments=False):
            line_index += 1
            try:
                cmd = line.command
                params = line.params

                if cmd[0] == "M":
                    if cmd[1] == 82:
                        relative_e = False
                    elif cmd[1] == 83:
                        relative_e = True

                if cmd[0] == "G" and cmd[1] in (0, 1, 2, 3):
                    print_line_count += 1

                    x = params.get("X")
                    y = params.get("Y")
                    z = params.get("Z")
                    e = params.get("E")
                    f = params.get("F", last_f)

                    if f is not None and f > 0:
                        last_f = f

                    if x is not None:
                        x = float(x)
                        x_min = min(x_min, x)
                        x_max = max(x_max, x)
                    if y is not None:
                        y = float(y)
                        y_min = min(y_min, y)
                        y_max = max(y_max, y)
                    if z is not None:
                        z = float(z)
                        z_min = min(z_min, z)
                        z_max = max(z_max, z)
                        z_values.add(round(z, 3))

                    if e is not None:
                        e = float(e)
                        if relative_e:
                            if cmd[1] in (0, 1):
                                total_e += e
                        else:
                            delta_e = max(0, e - current_e)
                            if cmd[1] in (0, 1):
                                total_e += delta_e
                        current_e = e

                    if f and f > 0:
                        dx = (float(x) - current_x) if x is not None else 0
                        dy = (float(y) - current_y) if y is not None else 0
                        dz = (float(z) - current_z) if z is not None else 0
                        travel_len = math.sqrt(dx**2 + dy**2 + dz**2)
                        total_move_time += (travel_len / f) * 60

                    if x is not None:
                        current_x = float(x)
                    if y is not None:
                        current_y = float(y)
                    if z is not None:
                        current_z = float(z)
            except Exception:
                last_error_line = line_index

    except Exception as e:
        logger.warning(f"G-code parsing interrupted at line {line_index}: {e}")

    if last_error_line:
        logger.warning(f"G-code had per-line errors, last at line {last_error_line}")

    logger.info(
        f"G-code parsed: {analysis.total_lines} total lines, "
        f"{print_line_count} moves, {total_e:.1f}mm filament, "
        f"{len(z_values)} layers, relative_e={relative_e}"
    )

    analysis.filament_length_mm = total_e
    analysis.layer_count = len(z_values) if z_values else 0
    analysis.print_lines = print_line_count

    density = MATERIAL_DENSITY.get(material.upper(), 1.24)
    analysis.material_grams = total_e * (FILAMENT_CROSS_SECTION / 1000) * density

    if x_min != float("inf"):
        analysis.bounding_box = {
            "x_min": x_min, "x_max": x_max,
            "y_min": y_min, "y_max": y_max,
            "z_min": z_min, "z_max": z_max,
        }

    analysis.slicer_time_minutes = _extract_slicer_time(gcode_text)
    analysis.estimated_time_minutes = _estimate_time_from_extrusion(
        total_e, total_move_time, analysis.slicer_time_minutes
    )

    return analysis


def _extract_slicer_time(gcode_text: str) -> float:
    """Extract estimated print time from slicer comments in G-code header.

    Supports:
      - Bambu Studio / OrcaSlicer: ; estimated printing time = Xm Ys
      - PrusaSlicer / SuperSlicer: ; estimated printing time = Xh Ym Zs
      - Cura: ;TIME:X
      - Simplify3D: ;   Build time: X hours Y minutes
    """
    patterns = [
        r";\s*estimated printing time\s*[=(]\s*(\d+)\s*[mM]\s*(\d*)\s*[sS]",
        r";\s*estimated printing time\s*[=(]\s*(\d+)\s*[hH]\s*(\d+)\s*[mM]\s*(\d*)\s*[sS]",
        r";TIME:(\d+)",
        r";\s*Build time:\s*(\d+)\s*hours?\s*(\d+)\s*minutes",
        r";\s*print time:\s*(\d+)\s*minutes",
        r";\s*total estimated time:\s*(\d+)\s*minutes",
    ]

    for pattern in patterns:
        m = re.search(pattern, gcode_text, re.IGNORECASE)
        if m:
            groups = m.groups()
            if len(groups) == 2:
                minutes = int(groups[0]) + int(groups[1] or 0) / 60.0
                return minutes
            elif len(groups) == 3:
                minutes = int(groups[0]) * 60 + int(groups[1]) + int(groups[2] or 0) / 60.0
                return minutes

    return 0.0


def _estimate_time_from_extrusion(
    total_e: float,
    total_move_time: float,
    slicer_time: float,
) -> float:
    """Estimate print time from extrusion data.

    If slicer_time is available, use it. Otherwise estimate from extrusion.
    """
    if slicer_time > 0:
        return slicer_time

    if total_move_time > 0:
        return max(1.0, total_move_time / 60.0)

    if total_e > 0:
        return max(1.0, total_e / 100.0)

    return 0.0


def quick_analyze(file_path: str, material: str = "PLA") -> dict:
    """Quick analysis returning a dict, suitable for API responses."""
    analysis = parse_gcode_file(file_path, material)
    return analysis.to_dict()