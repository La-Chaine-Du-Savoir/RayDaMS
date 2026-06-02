import { css, html, LitElement } from "lit";

export class AppBuildLogs extends LitElement {
  static properties = {
    gameId: { type: Number, attribute: "game-id" },
    status: { type: String, state: true }, // 'connecting', 'connected', 'finished', 'error'
  };

  static styles = css`
    .terminal-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      font-family: "Courier New", Courier, monospace;
    }

    .terminal-header {
      background-color: #3d3c38;
      padding: 8px 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #d5d5d5;
      font-size: 0.9rem;
      user-select: none;
    }

    .terminal-buttons {
      display: flex;
      gap: 8px;
    }

    .btn {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .btn-close {
      background-color: #ff5f56;
    }
    .btn-minimize {
      background-color: #ffbd2e;
    }
    .btn-maximize {
      background-color: #27c93f;
    }

    .terminal-title {
      font-weight: bold;
      color: #e6e6e6;
    }

    .terminal-body {
      background-color: #300a24;
      color: #ffffff;
      padding: 15px;
      height: 400px;
      overflow-y: auto;
      font-size: 0.95rem;
      line-height: 1.4;
      text-align: left;
    }

    .log-line {
      margin-bottom: 2px;
      word-wrap: break-word;
    }

    .log-prefix {
      color: #4af626; /* Vert vif typique */
      font-weight: bold;
      margin-right: 8px;
    }

    .status-bar {
      background-color: #2b2b2b;
      color: #888;
      padding: 5px 15px;
      font-size: 0.8rem;
      text-align: right;
    }

    .status-connecting {
      color: #ffbd2e;
    }
    .status-connected {
      color: #27c93f;
    }
    .status-finished {
      color: #4af626;
    }
    .status-error {
      color: #ff5f56;
    }
  `;

  constructor() {
    super();
    this.gameId = null;
    this.status = "connecting";
    this.ws = null;
    this._scrollPending = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.gameId) {
      this.initWebSocket();
    }
  }

  disconnectedCallback() {
    if (this.ws) {
      this.ws.close();
    }
    super.disconnectedCallback();
  }

  initWebSocket() {
    // Transformation de l'URL de l'API en URL WebSocket
    const apiUrl = globalThis.APP_CONFIG?.API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace(/^http/, "ws") + `/games/${this.gameId}/logs`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.status = "connected";
      this.addLog("Connexion au serveur de compilation établie...");
    };

    this.ws.onmessage = (event) => {
      const message = event.data;
      if (message === "__END__") {
        this.status = "finished";
        this.addLog("Processus terminé avec succès.");
        this.ws.close();

        this.dispatchEvent(
          new CustomEvent("build-complete", {
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this.addLog(message);
      }
    };

    this.ws.onerror = (error) => {
      console.error("Erreur WebSocket:", error);
      this.status = "error";
      this.addLog("Erreur de connexion au flux de logs.");
    };

    this.ws.onclose = () => {
      if (this.status !== "finished") {
        this.status = "error";
        this.addLog("Connexion interrompue.");
      }
    };
  }

  addLog(message) {
    const body = this.shadowRoot?.querySelector(".terminal-body");
    if (body) {
      const line = document.createElement("div");
      line.className = "log-line";
      line.textContent = message;
      body.appendChild(line);
      this._scheduleScroll(body);
    }
  }

  _scheduleScroll(body) {
    if (this._scrollPending) return;
    this._scrollPending = true;
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
      this._scrollPending = false;
    });
  }

  render() {
    return html`
      <div class="terminal-container">
        <div class="terminal-header">
          <div class="terminal-buttons">
            <div class="btn btn-close"></div>
            <div class="btn btn-minimize"></div>
            <div class="btn btn-maximize"></div>
          </div>
          <div class="terminal-title">raydams@build-server:~</div>
          <div></div>
        </div>

        <div class="terminal-body">
          <div class="log-line">
            <span class="log-prefix">system@raydams:~$</span> Initialisation de la
            compilation pour le jeu #${this.gameId}...
          </div>
        </div>

        <div class="status-bar status-${this.status}">
          ${this.status === "connecting"
        ? "Connexion en cours..."
        : ""} ${this.status === "connected"
        ? "En écoute..."
        : ""} ${this.status === "finished"
        ? "Compilation terminée"
        : ""} ${this.status === "error" ? "Erreur de connexion" : ""}
        </div>
      </div>
    `;
  }
}

customElements.define("app-build-logs", AppBuildLogs);
