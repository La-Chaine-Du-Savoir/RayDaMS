import { LitElement, html, css } from "lit";

export class AppFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    footer {
      background-color: #222;
      color: #ccc;
      text-align: center;
      padding: 2rem 1rem;
      margin-top: auto;
    }
    .authors-list {
      list-style-type: none;
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-top: 10px;
      padding: 0;
      margin: 0;
    }
    .authors-list a {
      color: var(--polytech-blue);
      text-decoration: none;
      font-weight: bold;
      display: inline-block;
      transition: color 0.3s ease, transform 0.3s ease;
    }
    .authors-list a:hover {
      color: var(--dams-pink);
      transform: translateY(-2px);
    }
  `;

  render() {
    return html`
      <footer>
        <p>Développé avec passion par la Chaine du Savoir :</p>
        <ul class="authors-list">
          <li><a href="https://www.linkedin.com/in/antoine-argaillot/" target="_blank">Antoine Argaillot</a></li>
          <li><a href="https://www.linkedin.com/in/norman-fran%C3%A7ois/" target="_blank">Norman François</a></li>
          <li><a href="https://www.linkedin.com/in/thibaut-scoto-di-suoccio/" target="_blank">Thibaut Scoto Di Suoccio</a></li>
        </ul>
      </footer>
    `;
  }
}

customElements.define('app-footer', AppFooter);

