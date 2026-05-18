import { LitElement, html, css } from "lit";
import { apiService } from "../services/apiService.js";

export class AppNavbar extends LitElement {
  static properties = {
    _user: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
    }

    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background-color: var(--polytech-blue, #005c97);
      color: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    /* Section Gauche */
    .nav-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .nav-brand {
      font-size: 1.8rem;
      font-weight: bold;
      color: white;
      text-decoration: none;
      letter-spacing: 1px;
    }

    .nav-brand .highlight {
      color: var(--dams-pink, #e91e63);
    }

    .nav-logo {
      height: 55px;
      width: auto;
      object-fit: contain;
    }

    .logo-polytech {
      filter: brightness(0) invert(1);
    }

    .nav-separator {
      width: 2px;
      height: 35px;
      background-color: rgba(255, 255, 255, 0.4);
      border-radius: 2px;
      margin: 0 10px;
    }

    .nav-link {
      color: white;
      text-decoration: none;
      font-weight: bold;
      font-size: 1.2rem;
      transition: color 0.3s;
    }

    .nav-link:hover {
      color: var(--dams-pink, #e91e63);
    }

    /* Section Droite */
    .nav-right {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .user-greeting {
      font-weight: bold;
      font-size: 1.1rem;
      color: white;
    }

    /* Boutons */
    .btn {
      text-decoration: none;
      padding: 0.6rem 1.2rem;
      border-radius: 5px;
      font-weight: bold;
      transition: all 0.3s;
      cursor: pointer;
      font-family: inherit;
      font-size: 1rem;
    }

    .btn-outline {
      border: 2px solid white;
      color: white;
      background: transparent;
    }

    .btn-outline:hover {
      background-color: white;
      color: var(--polytech-blue, #005c97);
    }

    .btn-primary {
      background-color: var(--dams-pink, #e91e63);
      color: white;
      border: 2px solid var(--dams-pink, #e91e63);
    }

    .btn-primary:hover {
      background-color: var(--dams-pink-hover, #c2185b);
      border-color: var(--dams-pink-hover, #c2185b);
    }

    .btn-logout {
      background-color: var(--dams-pink, #e91e63);
      color: white;
      border: 2px solid var(--dams-pink, #e91e63);

      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-logout:hover {
      background-color: #ffffff;
      color: var(--dams-pink, #e91e63);
      border: 2px solid var(--dams-pink, #e91e63);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
  `;

  constructor() {
    super();
    this._user = apiService.connectedUser;

    this._handleAuthChange = (e) => {
      this._user = e.detail;
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("auth-change", this._handleAuthChange);
  }

  disconnectedCallback() {
    window.removeEventListener("auth-change", this._handleAuthChange);
    super.disconnectedCallback();
  }

  async _logout(e) {
    e.preventDefault();
    const confirmed = confirm("Voulez-vous vraiment vous déconnecter ?");
    if (confirmed) {
      await apiService.logout();
      window.location.href = "/";
    }
  }

  render() {
    return html`
      <nav class="navbar">
        <div class="nav-left">
          <a href="/" class="nav-brand">Ray<span class="highlight">DaMS</span></a>
          <img src="/assets/images/logo-dams.png" alt="Logo DaMS" class="nav-logo" />
          <img src="/assets/images/logo-polytech.svg" alt="Logo Polytech" class="nav-logo logo-polytech" />
          <div class="nav-separator"></div>
          <a href="/jeux" class="nav-link">Jeux</a>
        </div>
        
        <div class="nav-right">
          ${this._user
        ? html`
                <span class="user-greeting">Salut, ${this._user.username} !</span>
                <button @click="${this._logout}" class="btn btn-logout">Déconnexion</button>
              `
        : html`
                <a href="/login" class="btn btn-outline">Se connecter</a>
                <a href="/register" class="btn btn-primary">S'inscrire</a>
              `}
        </div>
      </nav>
    `;
  }
}

customElements.define("app-navbar", AppNavbar);