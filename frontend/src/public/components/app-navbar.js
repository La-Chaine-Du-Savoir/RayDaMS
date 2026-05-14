import { LitElement, html, css } from "lit";

export class AppNavbar extends LitElement {
  static styles = css`
    :host { display: block; }
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background-color: var(--polytech-blue);
      color: white;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .nav-left { display: flex; align-items: center; gap: 10px; }
    .nav-right { display: flex; align-items: center; gap: 10px; }
    .nav-brand { font-size: 1.8rem; font-weight: bold; color: white; text-decoration: none; letter-spacing: 1px; }
    .nav-brand .highlight { color: var(--dams-pink); }
    .nav-logo { height: 55px; width: auto; object-fit: contain; }
    .logo-polytech { filter: brightness(0) invert(1); }
    .nav-separator { width: 2px; height: 35px; background-color: rgba(255,255,255,0.4); border-radius: 2px; margin: 0 10px; }
    .nav-link { color: white; text-decoration: none; font-weight: bold; font-size: 1.8rem; transition: color 0.3s; margin-right: 15px; }
    .nav-link:hover { color: var(--dams-pink); }
    .btn-outline, .btn-primary { text-decoration: none; padding: 0.5rem 1rem; border-radius: 5px; font-weight: bold; transition: all 0.3s; margin-left: 10px; }
    .btn-outline { border: 2px solid white; color: white; }
    .btn-outline:hover { background-color: white; color: var(--polytech-blue); }
    .btn-primary { background-color: var(--dams-pink); color: white; border: 2px solid var(--dams-pink); }
    .btn-primary:hover { background-color: var(--dams-pink-hover); border-color: var(--dams-pink-hover); }
  `;

  render() {
    return html`
      <nav class="navbar">
        <div class="nav-left">
          <a href="/" class="nav-brand">Ray<span class="highlight">DaMS</span></a>
          <img src="/public/assets/images/logo-dams.png" alt="Logo DaMS" class="nav-logo"/>
          <img src="/public/assets/images/logo-polytech.svg" alt="Logo Polytech" class="nav-logo logo-polytech"/>
          <div class="nav-separator"></div>
          <a href="#" class="nav-link">Jeux</a>
        </div>
        <div class="nav-right">
          <a href="/login" class="btn-outline">Se connecter</a>
          <a href="/register" class="btn-primary">S'inscrire</a>
        </div>
      </nav>
    `;
  }
}

customElements.define("app-navbar", AppNavbar);
