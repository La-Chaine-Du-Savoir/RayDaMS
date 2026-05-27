import { LitElement, html, css } from "lit";

export class AppAvatar extends LitElement {
  static properties = {
    url: { type: String },
    username: { type: String },
    size: { type: String }, // 'small', 'medium', ou 'large'
  };

  static styles = css`
    :host {
      display: inline-block;
      vertical-align: middle;
    }

    .avatar {
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      text-transform: uppercase;
      font-family: sans-serif;
    }

    /* Définition des tailles */
    .small {
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
    }

    .medium {
      width: 65px;
      height: 65px;
      font-size: 1.8rem;
    }

    .large {
      width: 100px;
      height: 100px;
      font-size: 2.5rem;
    }
  `;

  constructor() {
    super();
    this.url = "";
    this.username = "?";
    this.size = "medium"; // par défaut
  }

  render() {
    // Si on a une URL d'image valide
    if (this.url) {
      return html`
        <img src="${this.url}" alt="Avatar de ${this.username}" class="avatar ${this.size}" />
      `;
    }

    // Sinon, fallback avec la première lettre du pseudo
    return html`
      <div class="avatar ${this.size}" style="background-color: var(--dams-pink, #e91e63); color: white;">
        ${this.username ? this.username.charAt(0) : "?"}
      </div>
    `;
  }
}

customElements.define("app-avatar", AppAvatar);