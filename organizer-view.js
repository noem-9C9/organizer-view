import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class OrganizerView extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            config: { type: Object },
            cards: { type: Array },
            lovelace: { type: Object },
            editMode: { type: Boolean },
            _foldedSections: { type: Array },
        };
    }

    constructor() {
        super();
        this._foldedSections = JSON.parse(localStorage.getItem("organizer-view-folded")) || [];
    }

    setConfig(config) {
        this.config = config;
    }

    get isEditMode() {
        return (
            this.editMode === true ||
            this.hass?.panels?.lovelace?.config?.edit_mode === true ||
            window.location.search.includes('edit=1') ||
            window.location.pathname.includes('/edit') ||
            document.querySelector("home-assistant")?.__hass?.panels?.lovelace?.config?.edit_mode === true
        );
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // 1. Hack pour charger l'éditeur natif HA en mémoire
        if (this.isEditMode && !customElements.get("hui-card-options") && !this._loadingEditUI) {
            this._loadingEditUI = true;
            const dummy = document.createElement("hui-view");
            dummy.lovelace = this.lovelace || this.hass?.panels?.lovelace;
            dummy.index = 0;
        }

        // 2. Déplacement automatique d'une carte fraîchement créée vers sa section
        if (changedProperties.has("cards") && this.cards && window._organizerInsert) {
            const insertInfo = window._organizerInsert;
            if (this.viewIndex === insertInfo.viewIndex && this.cards.length === insertInfo.expectedLength) {
                window._organizerInsert = null;
                const newCardIndex = this.cards.length - 1;
                const targetIndex = insertInfo.targetIndex;

                if (newCardIndex > targetIndex) {
                    const lovelace = this.lovelace || this.hass?.panels?.lovelace || document.querySelector("home-assistant")?.main?.lovelace || document.querySelector("home-assistant")?.hass?.panels?.lovelace;
                    if (lovelace && lovelace.config) {
                        const newConfig = JSON.parse(JSON.stringify(lovelace.config));
                        const view = newConfig.views[this.viewIndex];
                        const cardToMove = view.cards.splice(newCardIndex, 1)[0];
                        view.cards.splice(targetIndex, 0, cardToMove);
                        lovelace.saveConfig(newConfig).catch(e => console.error(e));
                    }
                }
            } else if (this.cards.length >= insertInfo.expectedLength) {
                window._organizerInsert = null;
            }
        }
    }

    get viewIndex() {
        const views = this.hass?.panels?.lovelace?.config?.views || this.lovelace?.config?.views;
        if (!views) return 0;

        let index = views.findIndex(v => v === this.config);
        if (index === -1) {
            index = views.findIndex(v => JSON.stringify(v) === JSON.stringify(this.config));
        }
        if (index === -1) {
            const currentPath = window.location.pathname.split('/').pop();
            index = views.findIndex(v => v.path === currentPath || views.indexOf(v).toString() === currentPath);
        }

        return index !== -1 ? index : 0;
    }

    _toggleSection(title) {
        if (this._foldedSections.includes(title)) {
            this._foldedSections = this._foldedSections.filter(t => t !== title);
        } else {
            this._foldedSections = [...this._foldedSections, title];
        }
        localStorage.setItem("organizer-view-folded", JSON.stringify(this._foldedSections));
    }

    _editCard(index) {
        const event = new CustomEvent("ll-edit-card", {
            detail: { path: [this.viewIndex, index] },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    _moveCard(index, direction) {
        const lovelace = this.lovelace || this.hass?.panels?.lovelace || document.querySelector("home-assistant")?.main?.lovelace || document.querySelector("home-assistant")?.hass?.panels?.lovelace;
        if (!lovelace || !lovelace.config) {
            console.error("Configuration Lovelace introuvable");
            return;
        }

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.cards.length) return;

        const newConfig = JSON.parse(JSON.stringify(lovelace.config));
        const view = newConfig.views[this.viewIndex];

        // Permutation
        const temp = view.cards[index];
        view.cards[index] = view.cards[newIndex];
        view.cards[newIndex] = temp;

        lovelace.saveConfig(newConfig).catch(e => console.error("Erreur de sauvegarde:", e));
    }

    _addCard(targetIndex) {
        window._organizerInsert = {
            viewIndex: this.viewIndex,
            targetIndex: targetIndex,
            expectedLength: this.cards.length + 1
        };
        const event = new CustomEvent("ll-create-card", {
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    _deleteCard(index) {
        if (!confirm("Voulez-vous vraiment supprimer cette carte ?")) return;

        const lovelace = this.lovelace || this.hass?.panels?.lovelace || document.querySelector("home-assistant")?.main?.lovelace || document.querySelector("home-assistant")?.hass?.panels?.lovelace;
        if (!lovelace || !lovelace.config) return;

        const newConfig = JSON.parse(JSON.stringify(lovelace.config));
        const view = newConfig.views[this.viewIndex];

        view.cards.splice(index, 1);

        lovelace.saveConfig(newConfig).catch(e => console.error("Erreur de suppression:", e));
    }

    _moveSection(secIndex, direction) {
        if (secIndex + direction < 1 || secIndex + direction >= this._computedSections.length) return;
        
        const lovelace = this.lovelace || this.hass?.panels?.lovelace || document.querySelector("home-assistant")?.main?.lovelace || document.querySelector("home-assistant")?.hass?.panels?.lovelace;
        if (!lovelace || !lovelace.config) return;

        const newConfig = JSON.parse(JSON.stringify(lovelace.config));
        const view = newConfig.views[this.viewIndex];
        
        const sectionsArray = [...this._computedSections];
        const temp = sectionsArray[secIndex];
        sectionsArray[secIndex] = sectionsArray[secIndex + direction];
        sectionsArray[secIndex + direction] = temp;
        
        const newCards = [];
        sectionsArray.forEach(sec => {
            if (sec.headerIndex !== undefined && sec.headerIndex !== -1) {
                newCards.push(view.cards[sec.headerIndex]);
            }
            sec.cards.forEach(c => {
                newCards.push(view.cards[c.index]);
            });
        });
        
        view.cards = newCards;
        lovelace.saveConfig(newConfig).catch(e => console.error("Erreur de déplacement de section:", e));
    }

    render() {
        if (!this.cards) return html`<p>Chargement des cartes...</p>`;

        const sections = [];
        let currentSection = {
            title: "Général",
            cards: [],
            isGeneral: true,
            headerCard: null
        };
        sections.push(currentSection);

        this.cards.forEach((card, index) => {
            // LIGNE MAGIQUE : On transmet l'état d'édition à la carte native HA
            if (this.isEditMode) {
                card.editMode = true;
                // Essentiel pour que l'éditeur natif connaisse la position de la carte (permet le déplacement haut/bas, duplication, etc.)
                card.lovelace = this.lovelace || this.hass?.panels?.lovelace;
                card.path = [this.viewIndex, index];
            }

            const cardConfig = card.config || card._config || {};
            let isHeader = false;
            let title = "";

            if (cardConfig.type === 'markdown' && cardConfig.content && cardConfig.content.trim() === '###### section delimiter') {
                isHeader = true;
                title = cardConfig.title || "Section sans titre";
            }

            if (isHeader) {
                currentSection = {
                    title: title,
                    cards: [],
                    isGeneral: false,
                    headerCard: card,
                    headerIndex: index
                };
                sections.push(currentSection);
            } else {
                currentSection.cards.push({ card, index });
            }
        });

        this._computedSections = sections;

        return html`
            <div class="view-container ${this.isEditMode ? 'edit-mode' : ''}">
                ${sections.map((sec, secIndex) => {
                    if (sec.cards.length === 0 && !sec.headerCard && !this.isEditMode) return html``;

                    const isFolded = this._foldedSections.includes(sec.title);

                    return html`
                        <div class="section-container ${isFolded ? 'folded' : ''}">
                            <div class="section-header" @click="${() => this._toggleSection(sec.title)}">
                                <h3>${sec.title}</h3>
                                ${this.isEditMode && !sec.isGeneral ? html`
                                    <div class="section-move-controls">
                                        <button class="section-action" @click="${(e) => { e.stopPropagation(); this._moveSection(secIndex, -1); }}" ?disabled="${secIndex === 1}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                                        <button class="section-action" @click="${(e) => { e.stopPropagation(); this._moveSection(secIndex, 1); }}" ?disabled="${secIndex === sections.length - 1}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                                    </div>
                                ` : ''}
                                <ha-icon icon="${isFolded ? 'mdi:chevron-down' : 'mdi:chevron-up'}"></ha-icon>
                            </div>
                            
                            ${this.isEditMode && sec.headerCard && !isFolded ? html`
                                <div class="header-edit-mode">
                                    <p class="edit-hint">En-tête de section (Markdown) :</p>
                                    <div class="card-wrapper">
                                        ${sec.headerCard}
                                        <div class="custom-edit-overlay">
                                            <div class="custom-edit-controls">
                                                <button class="action-btn" @click="${(e) => { e.stopPropagation(); this._moveCard(sec.headerIndex, -1); }}" ?disabled="${sec.headerIndex === 0}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                                                <button class="action-btn" @click="${(e) => { e.stopPropagation(); this._moveCard(sec.headerIndex, 1); }}" ?disabled="${sec.headerIndex === this.cards.length - 1}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                                                <button class="action-btn" @click="${(e) => { e.stopPropagation(); this._editCard(sec.headerIndex); }}"><ha-icon icon="mdi:pencil"></ha-icon></button>
                                                <button class="action-btn delete-btn" @click="${(e) => { e.stopPropagation(); this._deleteCard(sec.headerIndex); }}"><ha-icon icon="mdi:delete"></ha-icon></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}

                            <div class="grid-container">
                                ${sec.cards.map(({ card, index }) => html`
                                    <div class="card-wrapper">
                                        ${card}
                                        ${this.isEditMode ? html`
                                            <div class="custom-edit-overlay">
                                                <div class="custom-edit-controls">
                                                    <button class="action-btn" @click="${(e) => { e.stopPropagation(); this._moveCard(index, -1); }}" ?disabled="${index === 0}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                                                    <button class="action-btn" @click="${(e) => { e.stopPropagation(); this._moveCard(index, 1); }}" ?disabled="${index === this.cards.length - 1}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                                                    <button class="action-btn" @click="${(e) => { e.stopPropagation(); this._editCard(index); }}"><ha-icon icon="mdi:pencil"></ha-icon></button>
                                                    <button class="action-btn delete-btn" @click="${(e) => { e.stopPropagation(); this._deleteCard(index); }}"><ha-icon icon="mdi:delete"></ha-icon></button>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `)}
                            </div>

                            ${this.isEditMode && !isFolded ? html`
                                <div class="add-card-placeholder" @click="${() => this._addCard(sec.cards.length > 0 ? sec.cards[sec.cards.length - 1].index + 1 : (sec.headerCard ? sec.headerIndex + 1 : 0))}">
                                    <ha-icon icon="mdi:plus"></ha-icon>
                                    <span>Ajouter une carte à ${sec.title}</span>
                                </div>
                            ` : ''}
                        </div>
                    `;
        })}
            </div>
        `;
    }

    static get styles() {
        return css`
            .section-move-controls {
                display: flex;
                margin-right: 12px;
                background: rgba(120, 120, 120, 0.4);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .section-action {
                background: transparent;
                border: none;
                color: #ffffff;
                cursor: pointer;
                padding: 6px 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            .section-action:hover:not([disabled]) {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 8px;
            }
            .section-action[disabled] {
                opacity: 0.3;
                cursor: not-allowed;
            }
            :host {
                display: block;
                padding: 16px;
                --accent-color: var(--primary-color, #03a9f4);
            }
            .view-container { 
                display: flex; 
                flex-direction: column; 
                gap: 24px; 
            }
            .section-container {
                background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.05);
                border: 1px solid rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.1);
                border-radius: 16px;
                backdrop-filter: blur(10px);
                overflow: hidden;
            }
            .section-header {
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                background: rgba(0, 0, 0, 0.2);
                transition: background 0.2s;
            }
            .section-header:hover {
                background: rgba(0, 0, 0, 0.3);
            }
            .section-header h3 {
                margin: 0;
                font-size: 1.2rem;
                font-weight: 500;
                color: var(--primary-text-color);
                flex-grow: 1;
            }
            .grid-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 16px;
                padding: 20px;
                transition: max-height 0.3s ease, opacity 0.3s ease;
                opacity: 1;
            }
            .section-container.folded .grid-container {
                max-height: 0; 
                padding: 0 20px; 
                overflow: hidden; 
                opacity: 0;
            }
            .card-wrapper {
                position: relative;
                width: 100%;
            }
            .custom-edit-overlay {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                border: 2px dashed var(--accent-color);
                border-radius: var(--ha-card-border-radius, 12px);
                background: rgba(var(--rgb-primary-color), 0.1);
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
                z-index: 100;
                display: flex;
                justify-content: flex-end;
                align-items: flex-start;
                padding: 4px;
            }
            .card-wrapper:hover .custom-edit-overlay {
                opacity: 1;
                pointer-events: auto;
            }
            .custom-edit-controls {
                background: var(--card-background-color, white);
                border-radius: 20px;
                display: flex;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                overflow: hidden;
            }
            .action-btn {
                background: transparent;
                border: none;
                color: var(--primary-text-color);
                cursor: pointer;
                padding: 8px 12px;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .action-btn:hover:not([disabled]) {
                background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.1);
            }
            .delete-btn:hover:not([disabled]) {
                color: var(--error-color, #f44336);
                background: rgba(244, 67, 54, 0.1);
            }
            .action-btn[disabled] {
                opacity: 0.3;
                cursor: not-allowed;
            }
            hui-card-options {
                display: none; /* Masquer l'outil natif car remplacé par overlay custom */
            }
            .header-edit-mode {
                padding: 16px 20px 0 20px;
                border-bottom: 2px dashed rgba(var(--rgb-primary-color), 0.5);
                margin-bottom: 8px;
            }
            .edit-hint {
                font-size: 0.8rem;
                color: var(--primary-color);
                margin: 0 0 8px 0;
                font-weight: bold;
                text-transform: uppercase;
            }
            .add-card-placeholder {
                border: 2px dashed rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.2);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                margin: 0 20px 20px 20px;
                cursor: pointer;
                min-height: 80px;
                transition: all 0.2s;
                gap: 8px;
                color: rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.5);
            }
            .add-card-placeholder:hover {
                border-color: var(--accent-color);
                color: var(--accent-color);
                background: rgba(var(--rgb-primary-color), 0.05);
            }
            @media (max-width: 600px) {
                .grid-container { grid-template-columns: 1fr; }
            }
        `;
    }
}

customElements.define("organizer-view", OrganizerView);
