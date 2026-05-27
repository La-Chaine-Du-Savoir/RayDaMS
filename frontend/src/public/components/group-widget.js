import { LitElement, html, css } from "lit";

export class GroupWidget extends LitElement {
  static properties = {
    group: { type: Object },
  };

  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
    }

    .group-widget {
        width: 300px;
        max-height: 500px;
        overflow-y: auto;
        background-color: #ffffff;
        border: 2px solid var(--polytech-blue, #005c97);
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: box-shadow 0.3s ease, transform 0.3s ease;
        display: flex;
        flex-direction: column;
        overflow-wrap: break-word;
        word-break: break-word;
    }

    .group-widget:hover {
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
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
      background: linear-gradient(135deg, var(--polytech-blue, #005c97), var(--dams-pink, #e91e63));
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

    .member-item:hover {
      background-color: #efefef;
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
      background: linear-gradient(135deg, var(--dams-pink, #e91e63), var(--polytech-blue, #005c97));
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
      name: "Group Name",
      users: [],
    };
  }

  _getInitials(username) {
    return username
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  _getGroupInitial(groupName) {
    return groupName[0]?.toUpperCase() || "G";
  }

  render() {
    if (!this.group) {
      return html`<div class="empty-state">No group data available</div>`;
    }

    const { name, users = [] } = this.group;

    return html`
      <div class="group-widget">
        <div class="group-header">
          <h2 class="group-title">${name}</h2>
        </div>

        <div class="members-section">
          <div class="members-label">Membres (${users.length})</div>

          ${users.length > 0
            ? html`
                <ul class="members-list">
                  ${users.map(
                    (member) => html`
                      <li class="member-item">
                        ${member.avatar
                          ? html`<img src="${member.avatar}" alt="${member.username}" class="member-avatar" />`
                          : html`<div class="member-default-avatar">${this._getInitials(member.username)}</div>`}
                        <div class="member-info">
                          <div class="member-username">${member.username}</div>
                          ${member.email ? html`<div class="member-email">${member.email}</div>` : ""}
                        </div>
                      </li>
                    `
                  )}
                </ul>`
            : html`<div class="empty-state">Aucun membre dans ce groupe</div>`}
        </div>
      </div>
    `;
  }
}

customElements.define("group-widget", GroupWidget);

