"""Draw the shallow neural network used in the project: 16 inputs -> 32 -> 12 -> 1.

Run from the repository root:
    python study-guide/draw_neural_network.py
It writes study-guide/neural_network_diagram.png and needs only numpy and matplotlib.
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D
from matplotlib.patches import Circle

OUT = Path(__file__).with_name("neural_network_diagram.png")

# The 16 inputs, in the order of FEATURE_GROUPS in src/f1podium/pipeline.py.
GROUPS = {
    "grid": ["grid_position", "pit_lane_start", "front_row", "field_size"],
    "qualifying": ["qualifying_position", "qualifying_time_seconds", "qualifying_missing"],
    "form": ["driver_podium_rate_5", "constructor_podium_rate_5", "driver_races_before"],
    "standings": ["driver_points_before", "driver_rank_before",
                  "constructor_points_before", "constructor_rank_before"],
    "context": ["driver_age", "year"],
}
COLORS = {"grid": "#0072B2", "qualifying": "#E69F00", "form": "#009E73",
          "standings": "#CC79A7", "context": "#56B4E9"}
HIDDEN = (32, 12)      # MLPClassifier(hidden_layer_sizes=(32, 12))
THRESHOLD = 0.455      # this model's cutoff, chosen on validation

inputs = [(name, COLORS[group]) for group, names in GROUPS.items() for name in names]
sizes = [len(inputs), *HIDDEN, 1]                      # [16, 32, 12, 1]
params = [a * b + b for a, b in zip(sizes, sizes[1:])]  # weights + biases per step
X = [4.6, 8.0, 11.0, 13.6]                              # x position of each layer
TOP, BOTTOM = 9.6, 2.6                                  # vertical span of the nodes


def column(n, x):
    """Evenly spaced node centres for one layer."""
    ys = np.linspace(TOP, BOTTOM, n) if n > 1 else np.array([(TOP + BOTTOM) / 2])
    return [(x, y) for y in ys]


layers = [column(n, x) for n, x in zip(sizes, X)]

fig, ax = plt.subplots(figsize=(16, 11))
ax.set_xlim(0, 17.5)
ax.set_ylim(0, 11.8)
ax.set_aspect("equal")
ax.axis("off")

# Every neuron is connected to every neuron of the next layer (one weight per line).
for a, b in zip(layers, layers[1:]):
    lines = [[p, q] for p in a for q in b]
    ax.add_collection(LineCollection(lines, colors="#6c7a84", linewidths=0.4,
                                     alpha=0.55 if len(b) == 1 else 0.17, zorder=1))

radius = [0.17, 0.09, 0.19, 0.32]
for i, (layer, r) in enumerate(zip(layers, radius)):
    for k, (x, y) in enumerate(layer):
        face = inputs[k][1] if i == 0 else ("#111111" if i == len(layers) - 1 else "#264653")
        ax.add_patch(Circle((x, y), r, fc=face, ec="white", lw=0.6, zorder=3))

for (name, _), (x, y) in zip(inputs, layers[0]):
    ax.text(x - 0.35, y, name, ha="right", va="center", fontsize=10.5, color="#222222")

ax.text(8.75, 11.45, "Shallow neural network (MLP): 16 → 32 → 12 → 1",
        ha="center", va="center", fontsize=18, fontweight="bold")
ax.text(8.75, 10.95, "Each neuron adds up all neurons of the previous layer (every line is its own weight), "
        "then applies a bend. Inputs are median-filled and scaled first.",
        ha="center", va="center", fontsize=11.5, color="#444444")

headers = [(X[0] - 1.9, "Input\n16 features"),
           (X[1], f"Hidden layer 1\n{HIDDEN[0]} neurons\nReLU"),
           (X[2], f"Hidden layer 2\n{HIDDEN[1]} neurons\nReLU"),
           (X[3], "Output\n1 neuron\nsigmoid")]
for x, text in headers:
    ax.text(x, 10.35, text, ha="center", va="center", fontsize=12.5, fontweight="bold", linespacing=1.4)

# How many numbers each step has to learn.
for (a, b), p, (x0, x1) in zip(zip(sizes, sizes[1:]), params, zip(X, X[1:])):
    ax.text((x0 + x1) / 2, 2.2, f"{a} × {b} weights\n+ {b} biases\n= {p}", ha="center", va="top",
            fontsize=10.5, color="#333333", linespacing=1.35)

ax.text(X[3] + 0.8, layers[-1][0][1] + 0.25, "probability\nof a podium", ha="left", va="center", fontsize=11.5)
ax.text(X[3] + 0.8, layers[-1][0][1] - 0.75, f"≥ {THRESHOLD} → predict podium", ha="left", va="center",
        fontsize=11.5, fontweight="bold")

ax.text(8.75, 0.95, f"Total: {' + '.join(map(str, params))} = {sum(params)} learned numbers. "
        f"Logistic regression is this picture with no hidden layers (16 inputs → 1 output = {sizes[0] + 1} numbers).",
        ha="center", va="center", fontsize=11.5)
ax.text(8.75, 0.5, "Settings: alpha 0.02 (L2 penalty) · early stopping · at most 300 passes · "
        "no class weighting (sklearn's MLP has none)",
        ha="center", va="center", fontsize=10.5, color="#555555")

handles = [Line2D([], [], marker="o", ls="", color=c, label=g, markersize=9) for g, c in COLORS.items()]
ax.legend(handles=handles, title="Input feature group", loc="upper center", bbox_to_anchor=(0.5, 0.005),
          ncol=len(COLORS), frameon=False, fontsize=11, title_fontsize=11)

fig.savefig(OUT, dpi=170, bbox_inches="tight", facecolor="white")
print("wrote", OUT)
