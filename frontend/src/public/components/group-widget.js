import { css, html, LitElement } from "lit";
import "./app-avatar.js";

export class GroupWidget extends LitElement {
  static properties = {
    group: { type: Object },
  };

  static styles = css`
    * {
      box-sizing: border-box;
    }
    :host {
      display: block;
      font-family: sans-serif;
    }

    .group-widget {
      width: 300px;
      max-height: 500px;
      background-color: #ffffff;
      border: 6px solid #9e9e9e;

      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

      transition:
        box-shadow 0.3s ease,
        transform 0.3s ease,
        border-color 0.3s ease;

      display: flex;
      flex-direction: column;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .group-link {
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }

    .group-link:hover {
      color: var(--dams-pink, #de007a);
    }

    .group-widget:hover {
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
      border-color: var(--dams-pink, #de007a);
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--polytech-blue, #005c97);
    }

    .group-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(
        135deg,
        var(--polytech-blue, #005c97),
        var(--dams-pink, #e91e63)
      );
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 1.3rem;
    }

    .group-title {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--polytech-blue, #005c97);
      margin: 0;
    }

    .members-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      overflow-y: auto;
    }

    .members-label {
      font-weight: bold;
      color: var(--polytech-blue, #005c97);
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .members-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      list-style-type: none;
      padding: 0;
      margin: 0;
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background-color: #f5f5f5;
      border-radius: 6px;
      transition: background-color 0.2s ease;
    }

    .member-avatar {
      width: 35px;
      height: 35px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--polytech-blue, #005c97);
      flex-shrink: 0;
    }

    .member-default-avatar {
      width: 35px;
      height: 35px;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        var(--dams-pink, #e91e63),
        var(--polytech-blue, #005c97)
      );
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .member-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      flex-grow: 1;
    }

    .member-username {
      font-weight: bold;
      color: #333;
      font-size: 0.95rem;
    }

    .member-email {
      font-size: 0.85rem;
      color: #666;
    }

    .empty-state {
      text-align: center;
      padding: 2rem 1rem;
      color: #999;
      font-style: italic;
    }

    .member-count {
      font-size: 0.85rem;
      color: #666;
      margin-top: 1rem;
      text-align: center;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }
  `;

  constructor() {
    super();
    this.group = {
      name: "Loading group...",
      users: [],
    };

    this._handleAuthChange = (e) => {
      let updatedUser = e.detail;
      if (!updatedUser) return;
      if (!this.group || !this.group.users) return;

      const userIndex = this.group.users.findIndex((u) =>
        u.id === updatedUser.id
      );

      if (userIndex !== -1) {
        const newUsers = [...this.group.users];
        newUsers[userIndex] = {
          ...newUsers[userIndex],
          url_profil_picture: updatedUser.url_profil_picture,
        };

        this.group = {
          ...this.group,
          users: newUsers,
        };
      }
    };
  }

  connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener("auth-change", this._handleAuthChange);
  }

  disconnectedCallback() {
    globalThis.removeEventListener("auth-change", this._handleAuthChange);
    super.disconnectedCallback();
  }

  render() {
    if (!this.group) {
      return html`
        <div class="empty-state">Groupe non disponible</div>
      `;
    }

    const { id, name, users = [] } = this.group;

    // URL de la page du groupe
    const groupUrl = `/groups/${id}`;

    return html`
      <div class="group-widget">
        <div class="group-header">
          <h2 class="group-title">
            <a href="${groupUrl}" class="group-link">${name}</a>
          </h2>
        </div>

        <div class="members-section">
          <div class="members-label">Membres (${users.length})</div>

          ${users.length > 0
        ? html`
          <ul class="members-list">
            ${users.map(
            (member) =>
              html`
                <li class="member-item">
                  <app-avatar
                    .url="${member.url_profil_picture}"
                    .username="${member.username}"
                    .size="small"
                  >
                  </app-avatar>
                  <div class="member-info">
                    <div class="member-username">${member.username}</div>
                    ${member.email
                  ? html`
                    <div class="member-email">${member.email}</div>
                  `
                  : ""}
                  </div>
                </li>
              `,
          )}
          </ul>
        `
        : html`
          <div class="empty-state">Aucun membre dans ce groupe</div>
        `}
        </div>
      </div>
    `;
  }
}

customElements.define("group-widget", GroupWidget);
