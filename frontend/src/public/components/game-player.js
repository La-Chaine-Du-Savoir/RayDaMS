import { LitElement, html, css } from 'lit';

export class GamePlayer extends LitElement {
    static properties = {
        statusText: { type: String },
        progressValue: { type: Number },
        progressMax: { type: Number },
        isProgressHidden: { type: Boolean },
        isSpinnerHidden: { type: Boolean },

        // --- Propriétés configurables depuis le parent ---
        wasmUrl: { type: String, attribute: 'wasm-url' },
        dataUrl: { type: String, attribute: 'data-url' },
        jsUrl: { type: String, attribute: 'js-url' }
    };

    static styles = css`
        :host {
            display: flex;
            width: 100%;
            height: 100%;
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        /* --- Conteneur Principal --- */
        .player-container {
            background-color: #FFFFFF;
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        /* --- Status & Zone de chargement --- */
        .status-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            min-height: 40px;
            width: 100%;
            padding: 0.5rem 0;
            background: #f4f4f4;
        }

        .status-text {
            font-family: 'Grixel', sans-serif;
            font-size: 1rem;
            color: #787878;
            -webkit-font-smoothing: none;
        }

        .spinner {
            height: 24px;
            width: 24px;
            animation: rotation .8s linear infinite;
            border-left: 4px solid #ebebeb;
            border-right: 4px solid #ebebeb;
            border-bottom: 4px solid #ebebeb;
            border-top: 4px solid var(--polytech-blue, #009EE0);
            border-radius: 100%;
            background-color: var(--dams-pink, #DE007A);
        }

        progress {
            width: 100%;
            max-width: 400px;
            height: 20px;
            accent-color: var(--dams-pink, #DE007A);
        }

        /* --- Zone de Canvas Emscripten --- */
        .canvas-wrapper {
            position: relative;
            flex: 1;
            width: 100%;
            max-height: 70vh;
            background-color: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            margin-top: 1.2rem;
        }

        canvas.emscripten {
            border: 0 none !important;
            background-color: #000 !important;
            max-width: 100% !important;
            max-height: 70vh !important;
            width: auto !important;
            height: auto !important;
            margin: 0 auto !important;
            object-fit: contain !important;
            display: block !important;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            outline: none !important;
        }

        /* --- Mode Plein Écran Natif API --- */
        .canvas-wrapper:fullscreen {
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            background-color: #000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-top: 0 !important;
        }

        .canvas-wrapper:fullscreen canvas.emscripten {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            margin: 0 !important;
            object-fit: contain !important;
        }

        /* --- Contrôles et Boutons --- */
        .controls-panel {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 1rem 1.5rem;
            box-sizing: border-box;
            border-top: 2px solid #f4f4f4;
        }

        .checkbox-group {
            display: flex;
            gap: 15px;
            color: #555;
            font-weight: bold;
            font-size: 0.9rem;
        }

        .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
        }

        .btn-fullscreen {
            font-family: 'Grixel', sans-serif;
            -webkit-font-smoothing: none;
            background-color: var(--dams-pink, #DE007A);
            color: white;
            border: 2px solid var(--dams-pink, #DE007A);
            padding: 0.6rem 1.2rem;
            max-width: 200px;
            border-radius: 5px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-fullscreen:hover {
            background-color: var(--dams-pink-hover, #C5006A);
            border-color: var(--dams-pink-hover, #C5006A);
            transform: translateY(-2px);
        }

        @keyframes rotation {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;

    constructor() {
        super();
        this.statusText = 'Downloading...';
        this.progressValue = 0;
        this.progressMax = 100;
        this.isProgressHidden = true;
        this.isSpinnerHidden = false;

        // Verrou anti-spam F11
        this._isFullscreenTransitioning = false;
    }

    firstUpdated() {
        if (!this.wasmUrl || !this.dataUrl || !this.jsUrl) {
            console.error("GamePlayer: missing attributes! 'wasm-url', 'data-url' and 'js-url' are required.");
            this.statusText = "Error: Missing resource configurations.";
            this.isSpinnerHidden = true;
            return;
        }

        const canvasElement = this.shadowRoot.getElementById("canvas");
        const wrapper = this.shadowRoot.getElementById("canvas-wrapper");

        canvasElement.addEventListener("webglcontextlost", (e) => {
            alert("WebGL context lost. You will need to reload the page.");
            e.preventDefault();
        }, false);

        wrapper.addEventListener("fullscreenchange", () => {
            setTimeout(() => {
                if (canvasElement) canvasElement.focus();
            }, 50);
        });

        const keysToBlock = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"];

        window.addEventListener("keydown", (e) => {
            if (e.key === "F11" || e.code === "F11") {
                e.preventDefault();
                this._toggleFullscreen();
                return;
            }

            if (this.shadowRoot.activeElement === canvasElement && keysToBlock.includes(e.code)) {
                e.preventDefault();
            }
        }, { passive: false });

        canvasElement.addEventListener("mousedown", () => {
            canvasElement.focus();
        });

        window.Module = {
            print: (...args) => console.log(...args),
            printErr: (...args) => console.error(...args),
            canvas: canvasElement,
            setStatus: (text) => this._setStatus(text),
            totalDependencies: 0,
            monitorRunDependencies: (left) => {
                window.Module.totalDependencies = Math.max(window.Module.totalDependencies, left);
                this._setStatus(left ? `Preparing... (${window.Module.totalDependencies - left}/${window.Module.totalDependencies})` : "All downloads complete.");
            },
            locateFile: (path, prefix) => {
                if (path.endsWith(".wasm")) return this.wasmUrl;
                if (path.endsWith(".data")) return this.dataUrl;
                return prefix + path;
            },
            instantiateWasm: (imports, successCallback) => {
                fetch(this.wasmUrl, { mode: 'cors' })
                    .then(response => {
                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                        return response.arrayBuffer();
                    })
                    .then(bytes => WebAssembly.instantiate(bytes, imports))
                    .then(output => successCallback(output.instance))
                    .catch(err => {
                        console.error("Custom instantiateWasm failed: ", err);
                        this._setStatus("Failed to compile WebAssembly.");
                    });
                return {};
            }
        };

        const script = document.createElement("script");
        script.src = this.jsUrl;
        script.async = true;
        this.shadowRoot.appendChild(script);
    }

    _setStatus(text) {
        if (!this._lastStatus) this._lastStatus = { time: Date.now(), text: "" };
        if (text === this._lastStatus.text) return;

        const match = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
        const now = Date.now();

        if (match && now - this._lastStatus.time < 30) return;

        this._lastStatus.time = now;
        this._lastStatus.text = text;

        if (match) {
            this.statusText = match[1];
            this.progressValue = 100 * parseInt(match[2]);
            this.progressMax = 100 * parseInt(match[4]);
            this.isProgressHidden = false;
            this.isSpinnerHidden = false;
        } else {
            this.progressValue = 0;
            this.isProgressHidden = true;
            this.statusText = text;
            if (!text) {
                this.isSpinnerHidden = true;
            }
        }
    }

    async _toggleFullscreen() {
        if (this._isFullscreenTransitioning) return;

        this._isFullscreenTransitioning = true;
        const wrapper = this.shadowRoot.getElementById('canvas-wrapper');
        const canvas = this.shadowRoot.getElementById('canvas');
        const pointerLockChecked = this.shadowRoot.getElementById('pointerLock').checked;

        try {
            if (!document.fullscreenElement) {
                await wrapper.requestFullscreen();
                if (canvas) {
                    canvas.focus();
                    // Si l'option est cochée, on verrouille le pointeur au passage en plein écran
                    if (pointerLockChecked && canvas.requestPointerLock) {
                        canvas.requestPointerLock();
                    }
                }
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error(`Erreur d'activation plein écran: ${err.message}`);
        } finally {
            setTimeout(() => {
                this._isFullscreenTransitioning = false;
            }, 200);
        }
    }

    render() {
        return html`
            <div class="player-container">
                <div class="status-bar">
                    ${!this.isSpinnerHidden ? html`<div class="spinner"></div>` : ''}
                    <div class="status-text">${this.statusText}</div>
                    <progress
                            ?hidden=${this.isProgressHidden}
                            .max=${this.progressMax}
                            .value=${this.progressValue}>
                    </progress>
                </div>

                <div id="canvas-wrapper" class="canvas-wrapper">
                    <canvas
                            class="emscripten"
                            id="canvas"
                            @contextmenu=${(e) => e.preventDefault()}
                            tabindex="-1">
                    </canvas>
                </div>

                <div class="controls-panel">
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="pointerLock">
                            Lock mouse pointer
                        </label>
                    </div>

                    <button class="btn-fullscreen" @click=${this._toggleFullscreen}>
                        Plein Écran
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('game-player', GamePlayer);