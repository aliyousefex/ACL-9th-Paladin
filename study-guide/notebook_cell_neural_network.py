from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D
from matplotlib.patches import Circle


def draw_network(mlp, feature_groups, threshold, out_path=None):
    """Draw the fitted MLP: its layers, the numbers each step learned, and the decision cutoff."""
    colors = {"grid": "#0072B2", "qualifying": "#E69F00", "form": "#009E73",
              "standings": "#CC79A7", "context": "#56B4E9"}
    activation = {"relu": "ReLU", "logistic": "sigmoid", "tanh": "tanh", "identity": "identity"}
    inputs = [(name, colors[group]) for group, names in feature_groups.items() for name in names]
    # Sizes and counts are read from the fitted weights, so the picture cannot drift from the model.
    sizes = [mlp.coefs_[0].shape[0]] + [w.shape[1] for w in mlp.coefs_]
    params = [w.size + b.size for w, b in zip(mlp.coefs_, mlp.intercepts_)]
    assert len(sizes) == 4 and len(inputs) == sizes[0], "expects the 16 inputs and two hidden layers"
    xs, top, bottom = [4.6, 8.0, 11.0, 13.6], 9.6, 2.6

    def column(n, x):
        ys = np.linspace(top, bottom, n) if n > 1 else [(top + bottom) / 2]
        return [(x, y) for y in ys]

    layers = [column(n, x) for n, x in zip(sizes, xs)]
    fig, ax = plt.subplots(figsize=(16, 11))
    ax.set_xlim(0, 17.5); ax.set_ylim(0, 11.8); ax.set_aspect("equal"); ax.axis("off")

    # Every neuron feeds every neuron of the next layer: one weight per line.
    for a, b in zip(layers, layers[1:]):
        ax.add_collection(LineCollection([[p, q] for p in a for q in b], colors="#6c7a84",
                                         linewidths=0.4, alpha=0.55 if len(b) == 1 else 0.17, zorder=1))
    for i, (layer, r) in enumerate(zip(layers, [0.17, 0.09, 0.19, 0.32])):
        for k, (x, y) in enumerate(layer):
            face = inputs[k][1] if i == 0 else ("#111111" if i == 3 else "#264653")
            ax.add_patch(Circle((x, y), r, fc=face, ec="white", lw=0.6, zorder=3))
    for (name, _), (x, y) in zip(inputs, layers[0]):
        ax.text(x - 0.35, y, name, ha="right", va="center", fontsize=10.5, color="#222222")

    ax.text(8.75, 11.45, "Shallow neural network (MLP): " + " → ".join(map(str, sizes)),
            ha="center", va="center", fontsize=18, fontweight="bold")
    ax.text(8.75, 10.95, "Each neuron adds up all neurons of the previous layer (every line is its own weight), "
            "then applies a bend. Inputs are median-filled and scaled first.",
            ha="center", va="center", fontsize=11.5, color="#444444")
    headers = [(xs[0] - 1.9, f"Input\n{sizes[0]} features"),
               (xs[1], f"Hidden layer 1\n{sizes[1]} neurons\n{activation[mlp.activation]}"),
               (xs[2], f"Hidden layer 2\n{sizes[2]} neurons\n{activation[mlp.activation]}"),
               (xs[3], f"Output\n1 neuron\n{activation[mlp.out_activation_]}")]
    for x, text in headers:
        ax.text(x, 10.35, text, ha="center", va="center", fontsize=12.5, fontweight="bold", linespacing=1.4)
    for (a, b), p, (x0, x1) in zip(zip(sizes, sizes[1:]), params, zip(xs, xs[1:])):
        ax.text((x0 + x1) / 2, 2.2, f"{a} × {b} weights\n+ {b} biases\n= {p}", ha="center", va="top",
                fontsize=10.5, color="#333333", linespacing=1.35)

    ax.text(xs[3] + 0.8, layers[-1][0][1] + 0.25, "probability\nof a podium", ha="left", va="center", fontsize=11.5)
    ax.text(xs[3] + 0.8, layers[-1][0][1] - 0.75, f"≥ {threshold:.3f} → predict podium",
            ha="left", va="center", fontsize=11.5, fontweight="bold")
    ax.text(8.75, 0.95, f"Total: {' + '.join(map(str, params))} = {sum(params)} learned numbers. Logistic regression "
            f"is this picture with no hidden layers ({sizes[0]} inputs → 1 output = {sizes[0] + 1} numbers).",
            ha="center", va="center", fontsize=11.5)
    stopping = "early stopping" if mlp.early_stopping else "no early stopping"
    ax.text(8.75, 0.5, f"Settings: alpha {mlp.alpha} (L2 penalty) · {stopping} · ran {mlp.n_iter_} passes "
            f"(limit {mlp.max_iter}) · no class weighting (sklearn's MLP has none)",
            ha="center", va="center", fontsize=10.5, color="#555555")
    handles = [Line2D([], [], marker="o", ls="", color=c, label=g, markersize=9) for g, c in colors.items()]
    ax.legend(handles=handles, title="Input feature group", loc="upper center", bbox_to_anchor=(0.5, 0.005),
              ncol=len(colors), frameon=False, fontsize=11, title_fontsize=11)
    if out_path is not None:
        fig.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.show()


network = results["models"]["Shallow neural network"].named_steps["model"]
draw_network(network, FEATURE_GROUPS, results["thresholds"]["Shallow neural network"],
             OUT / "figures" / "neural_network.png")
