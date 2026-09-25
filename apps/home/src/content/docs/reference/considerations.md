---
title: Considerations & Limitations
description: Running queries inside the browser has some limits - find out how they apply and how to set up your enviroment to not be affected.
---

Running analytical queries inside the browser has some limits - find out how they apply and how to set up your environment to not be affected.

## 32-Bit WASM memory limit
For now, WASM can only use ~4 gigabytes of RAM. This limits the size of the dataset you can load to this size. 

This does not mean your whole dataset can at most be 4gb, but the part loaded into your browser at any point can at most be this size (minus a bit to allow for querying).
Usually, this limitation shouldn't affect most users. If it does, let me know via [GitHub](https://github.com/xz3dev/quacklytics/issues).

64-Bit memory support is in Stage 4 (out of 5) - you can check the status here: [GitHub - WebAssembly](https://github.com/WebAssembly/memory64).
