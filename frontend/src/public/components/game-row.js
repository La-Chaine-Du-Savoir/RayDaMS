import { LitElement, html, css } from 'lit';
import './game-card.js';

export class AppGameRow extends LitElement {
    static properties = {
        group: { type: Object }
    };

    static styles = css`
        * {
            box-sizing: border-box;
        }

        :host {
            display: block;
            margin-bottom: 3.5rem;
            width: 100%;
        }

        .category-header {
            display: flex;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-right: 1rem;
        }

        .category-title {
            color: var(--polytech-blue-dark, #007BB5);
            font-family: 'Grixel', sans-serif;
            font-size: 1.5rem;
            margin: 0;
            padding-left: 1rem;
            border-left: 6px solid var(--dams-pink, #DE007A);
            white-space: nowrap;
            -webkit-font-smoothing: none;
        }

        .separator-line {
            flex-grow: 1;
            height: 3px;
            background-color: #e0e0e0;
            margin-left: 1.5rem;
            border-radius: 2px;
        }

        /* Conteneur principal pour positionner les boutons */
        .row-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }

        .scroll-container {
            display: flex;
            overflow-x: auto;
            padding: 10px 5px 20px 5px; 
            gap: 20px;
            scroll-behavior: smooth; /* Permet un défilement fluide lors du clic */
            width: 100%;
            
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .scroll-container::-webkit-scrollbar {
            display: none;
        }

        /* Boutons de navigation  */
        .scroll-btn {
            position: absolute;
            z-index: 10;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.2rem;
            opacity: 0; /* Cachés par défaut */
            transition: opacity 0.3s, background-color 0.3s, transform 0.2s;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        /* Apparition des boutons au survol de la rangée */
        .row-wrapper:hover .scroll-btn {
            opacity: 1;
        }

        .scroll-btn:hover {
            background-color: var(--dams-pink, #DE007A);
            border-color: var(--dams-pink, #DE007A);
            transform: scale(1.1);
        }

        .scroll-btn.left {
            left: -15px; /* Déborde un peu sur la gauche */
        }

        .scroll-btn.right {
            right: -15px; /* Déborde un peu sur la droite */
        }

        .empty-message {
            color: #888;
            font-style: italic;
            padding-left: 1rem;
            font-family: 'Courier New', Courier, monospace;
        }
    `;

    constructor() {
        super();
        this.group = null;
    }

    // faire défiler le conteneur
    _scroll(direction) {
        const container = this.shadowRoot.querySelector('.scroll-container');
        if (container) {
            // 300 px de décalage par clic sur un bouton
            const scrollAmount = direction === 'left' ? -300 : 300;
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }

    render() {
        if (!this.group) return html``;

        const hasGames = this.group.games && this.group.games.length > 0;
        

        const showArrows = hasGames && this.group.games.length > 3;

        return html`
            <div class="category-header">
                <h2 class="category-title">${this.group.name}</h2>
                <div class="separator-line"></div>
            </div>
            
            <div class="row-wrapper">
                ${showArrows ? html`
                    <button class="scroll-btn left" @click="${() => this._scroll('left')}" title="Défiler à gauche">❮</button>
                ` : ''}

                <div class="scroll-container">
                    ${hasGames 
                        ? this.group.games.map(game => html`
                            <app-game-card 
                                .game="${game}" 
                                ?can-edit="${this.group.canEdit}">
                            </app-game-card>
                          `)
                        : html`<div class="empty-message">Aucun jeu publié dans ce groupe pour le moment.</div>`
                    }
                </div>

                ${showArrows ? html`
                    <button class="scroll-btn right" @click="${() => this._scroll('right')}" title="Défiler à droite">❯</button>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('app-game-row', AppGameRow);