import { LitElement, html, css } from 'lit';

export class AppGameCard extends LitElement {
    static properties = {
        game: { type: Object },
        canEdit: { type: Boolean, attribute: 'can-edit' }
    };

    static styles = css`
        /* 1. CORRECTION DU BOUTON : On applique le border-box à l'intérieur du composant */
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
            text-decoration: none;
            color: var(--text-color, #333333);
            transition: transform 0.3s ease, border-color 0.3s ease;
            height: 100%;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: var(--dams-pink, #DE007A);
        }

        .thumbnail-container {
            width: 100%;
            aspect-ratio: 16 / 9;
            background-color: #ddd;
            display: flex;
            justify-content: center;
            align-items: center;
            border-bottom: 4px solid #9e9e9e; 
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
            /* 2. CORRECTION DU TEXTE : Taille réduite */
            font-size: 0.85rem; 
            text-align: center;
            line-height: 1.4;
            
            /* Passage sur 2 lignes maximum, puis points de suspension */
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: normal; /* Autorise le retour à la ligne */
            
            -webkit-font-smoothing: none;
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

        const thumbnailUrl = this.game.url_thumbnail 
            ? `${this.game.url_thumbnail}` 
            : null;

        return html`
            <div class="card">
                <div class="thumbnail-container">
                    ${thumbnailUrl 
                        ? html`<img src="${thumbnailUrl}" alt="${this.game.name}" class="thumbnail" loading="lazy">`
                        : html`<div class="placeholder">Aperçu indisponible</div>`
                    }
                </div>
                
                <div class="card-info">
                    <h3 class="game-title" title="${this.game.name}">${this.game.name}</h3>
                    
                    ${this.canEdit ? html`
                        <a href="/edit-game?id=${this.game.id}" class="btn-edit">MODIFIER</a>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

customElements.define('app-game-card', AppGameCard);