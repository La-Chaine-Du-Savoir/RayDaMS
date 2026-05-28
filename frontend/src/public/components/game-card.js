import { LitElement, html, css } from 'lit';

export class AppGameCard extends LitElement {
    static properties = {
        game: { type: Object },
        canEdit: { type: Boolean, attribute: 'can-edit' }
    };

    static styles = css`
        * {
            box-sizing: border-box;
        }

        :host {
            display: block;
            flex: 0 0 auto;
            width: 250px; 
        }

        .card {
            background-color: var(--card-bg, #FFFFFF);
            border: 6px solid #9e9e9e;
            display: flex;
            flex-direction: column;
            color: var(--text-color, #333333);
            transition: transform 0.3s ease, border-color 0.3s ease;
            height: 100%;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: var(--dams-pink, #DE007A);
        }

        .play-link {
            text-decoration: none;
            display: block;
            color: inherit;
        }

        .thumbnail-container {
            width: 100%;
            aspect-ratio: 16 / 9;
            background-color: #ddd;
            display: flex;
            justify-content: center;
            align-items: center;
            border-bottom: 4px solid #9e9e9e; 
            position: relative; /* Requis pour positionner l'overlay par-dessus */
            overflow: hidden;
        }

        .thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .placeholder {
            color: #888;
            font-weight: bold;
            font-family: 'Courier New', Courier, monospace;
            text-align: center;
        }

        .play-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .play-icon {
            color: var(--dams-pink, #DE007A);
            font-size: 3.5rem;
            text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.8);
            transform: scale(0.5);
            transition: transform 0.3s ease cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Effet de rebond sympa */
        }

        /* Animations au survol de la carte */
        .card:hover .play-overlay {
            opacity: 1;
        }

        .card:hover .play-icon {
            transform: scale(1);
        }

        .card-info {
            padding: 15px;
            display: flex;
            flex-direction: column;
            flex: 1;
            justify-content: space-between;
        }

        .game-title {
            margin: 0 0 15px 0;
            color: var(--polytech-blue, #009EE0);
            font-family: 'Grixel', sans-serif;
            font-size: 0.85rem; 
            text-align: center;
            line-height: 1.4;
            
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: normal;
            
            -webkit-font-smoothing: none;
            transition: color 0.3s ease;
        }

        .card:hover .game-title {
            color: var(--dams-pink, #DE007A);
        }

        .btn-edit {
            display: block;
            width: 100%;
            padding: 0.5rem;
            background-color: var(--dams-pink, #DE007A);
            color: white;
            border: none;
            border-radius: 5px;
            font-weight: bold;
            font-family: 'Courier New', Courier, monospace;
            font-size: 1rem;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            transition: all 0.3s;
        }

        .btn-edit:hover {
            background-color: var(--dams-pink-hover, #C5006A);
            transform: translateY(-2px);
        }
    `;

    constructor() {
        super();
        this.game = null;
        this.canEdit = false;
    }

    render() {
        if (!this.game) return html``;

        const thumbnailUrl = this.game.url_thumbnail ? this.game.url_thumbnail : null;

        return html`
            <div class="card">
                <a href="/games/${this.game.id}" class="play-link">
                    <div class="thumbnail-container">
                        ${thumbnailUrl 
                            ? html`<img src="${thumbnailUrl}" alt="${this.game.name}" class="thumbnail" loading="lazy">`
                            : html`<div class="placeholder">Aperçu indisponible</div>`
                        }
                        <div class="play-overlay">
                            <div class="play-icon">▶</div>
                        </div>
                    </div>
                    
                    <div class="card-info">
                        <h3 class="game-title" title="${this.game.name}">${this.game.name}</h3>
                    </div>
                </a>

                ${this.canEdit ? html`
                    <div style="padding: 0 15px 15px 15px;">
                        <a href="/edit-game?id=${this.game.id}" class="btn-edit">MODIFIER</a>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('app-game-card', AppGameCard);